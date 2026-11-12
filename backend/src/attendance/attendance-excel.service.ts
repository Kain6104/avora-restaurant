import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from './attendance.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

@Injectable()
export class AttendanceExcelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  private getVietnameseDayOfWeek(date: Date): string {
    const day = date.getDay();
    switch (day) {
      case 1:
        return 'Thứ 2';
      case 2:
        return 'Thứ 3';
      case 3:
        return 'Thứ 4';
      case 4:
        return 'Thứ 5';
      case 5:
        return 'Thứ 6';
      case 6:
        return 'Thứ 7';
      default:
        return 'CN';
    }
  }

  // Chuyển chỉ số cột 1-based thành chữ cái Excel (1 -> A, 27 -> AA)
  private colToLetter(col: number): string {
    let temp = '';
    let letter = '';
    while (col > 0) {
      temp = String.fromCharCode(((col - 1) % 26) + 65);
      letter = temp + letter;
      col = Math.floor((col - temp.charCodeAt(0) + 64) / 26);
    }
    return letter;
  }

  async exportToExcel(
    startDateStr: string,
    endDateStr: string,
    calculateOvertime: boolean,
    branchId: string | undefined,
    roleId: string | undefined,
    userId: string | undefined,
    res: Response,
  ) {
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateStr);
    endDate.setHours(0, 0, 0, 0);

    const numOfDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

    const queryEndDate = new Date(endDate);
    queryEndDate.setHours(23, 59, 59, 999);

    // Lọc dữ liệu chấm công
    const where: any = {
      workDate: { gte: startDate, lte: queryEndDate },
    };
    if (branchId) where.branchId = branchId;
    if (userId) where.userId = userId;

    let attendances = await this.prisma.attendance.findMany({
      where,
      include: {
        user: {
          include: {
            roleAssignments: { include: { role: true } },
          },
        },
        branch: true,
        shift: true,
      },
      orderBy: [{ workDate: 'asc' }, { checkInTime: 'asc' }],
    });

    if (roleId) {
      attendances = attendances.filter((a) => {
        const uRoleId = a.user?.roleAssignments?.[0]?.roleId;
        return uRoleId === roleId;
      });
    }

    if (attendances.length === 0) {
      throw new BadRequestException('Không có dữ liệu công nào phù hợp với bộ lọc bạn vừa chọn!');
    }

    // Nhóm theo User
    const groupedByUser = new Map<string, { user: any; attendances: any[] }>();
    for (const a of attendances) {
      if (!a.user) continue;
      if (!groupedByUser.has(a.user.id)) {
        groupedByUser.set(a.user.id, { user: a.user, attendances: [] });
      }
      groupedByUser.get(a.user.id)!.attendances.push(a);
    }

    // Nhóm theo Role
    const groupedByRole = new Map<string, Map<string, { user: any; attendances: any[] }>>();
    for (const [uId, entry] of groupedByUser.entries()) {
      const rName = entry.user.roleAssignments?.[0]?.role?.name || entry.user.role || 'Chưa phân loại';
      if (!groupedByRole.has(rName)) {
        groupedByRole.set(rName, new Map());
      }
      groupedByRole.get(rName)!.set(uId, entry);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.calcProperties.fullCalcOnLoad = true;

    // Bản đồ lưu tham chiếu ô tổng giờ công và tăng ca
    const userNormRefs = new Map<string, string>();
    const userOtRefs = new Map<string, string>();

    // 1. SHEET NHẬT KÝ CHI TIẾT
    this.renderSheetLogChiTiet(workbook, groupedByUser, startDate, numOfDays);

    // 2. SHEET BẢNG CÔNG THEO VAI TRÒ
    for (const [roleName, usersInRole] of groupedByRole.entries()) {
      let safeSheetName = `Bảng công - ${roleName}`;
      safeSheetName = safeSheetName.replace(/[\\/:*?"<>|]/g, '_');
      if (safeSheetName.length > 31) safeSheetName = safeSheetName.substring(0, 31);

      this.renderSheetBangCong(
        workbook,
        safeSheetName,
        roleName,
        usersInRole,
        startDate,
        numOfDays,
        calculateOvertime,
        userNormRefs,
        userOtRefs,
      );
    }

    // 3. SHEET PHIẾU LƯƠNG TỪNG NHÂN VIÊN
    for (const entry of groupedByUser.values()) {
      this.renderSheetPhieuLuong(
        workbook,
        entry.user,
        entry.attendances,
        startDate,
        endDate,
        calculateOvertime,
        userNormRefs,
        userOtRefs,
      );
    }

    const dayStr = String(startDate.getDate()).padStart(2, '0');
    const monStr = String(startDate.getMonth() + 1).padStart(2, '0');
    const yearStr = startDate.getFullYear();
    const filename = `BangChamCong_SushiWa_${dayStr}${monStr}${yearStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  // ==========================================
  // SHEET 1: NHẬT KÝ CHI TIẾT
  // ==========================================
  private renderSheetLogChiTiet(
    workbook: ExcelJS.Workbook,
    groupedByUser: Map<string, { user: any; attendances: any[] }>,
    startDate: Date,
    numOfDays: number,
  ) {
    const sheet = workbook.addWorksheet('Nhật Ký Chi Tiết', {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 9 }],
    });

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' }, // GREY_25_PERCENT
    };
    const weekendHeaderFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8CBAD' }, // LIGHT_ORANGE
    };
    const subHeaderFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFBDD7EE' }, // PALE_BLUE
    };
    const weekendDataFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8CBAD' },
    };

    // Row 1 (Index 1)
    const r1 = sheet.getRow(1);
    r1.getCell(1).value = 'CÔNG TY TNHH SUSHI WA';
    r1.getCell(1).font = { name: 'Calibri', size: 11, bold: true };

    // Row 2
    const r2 = sheet.getRow(2);
    const now = new Date();
    r2.getCell(1).value = `Ngày xuất báo cáo: ${now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    r2.getCell(1).font = { name: 'Calibri', size: 11, bold: true };

    // Row 4
    const r4 = sheet.getRow(4);
    r4.getCell(1).value = 'BẢNG NHẬT KÝ CHẤM CÔNG CHI TIẾT';
    r4.getCell(1).font = { name: 'Calibri', size: 16, bold: true };

    // Row 5
    const r5 = sheet.getRow(5);
    const endRangeDate = new Date(startDate.getTime() + (numOfDays - 1) * 86400000);
    const startStr = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`;
    const endStr = `${String(endRangeDate.getDate()).padStart(2, '0')}/${String(endRangeDate.getMonth() + 1).padStart(2, '0')}/${endRangeDate.getFullYear()}`;
    r5.getCell(1).value = `Từ ngày ${startStr} đến ngày ${endStr}`;
    r5.getCell(1).font = { name: 'Calibri', size: 11, bold: true };

    // Row 7, 8, 9 Headers
    const r7 = sheet.getRow(7);
    const r8 = sheet.getRow(8);
    const r9 = sheet.getRow(9);
    r7.height = 22;
    r8.height = 22;
    r9.height = 22;

    const staticHeaders = [
      'STT',
      'Tên Nhân viên',
      'Tổng số ca',
      'Tổng giờ',
      'Đúng giờ (Lần)',
      'Số lần đi trễ',
      'Số phút đi trễ',
      'Số giờ đi trễ',
      'Số phút về muộn',
      'Số giờ về muộn',
    ];

    for (let c = 0; c < staticHeaders.length; c++) {
      const colIdx = c + 1;
      sheet.mergeCells(7, colIdx, 9, colIdx);
      const cell = r7.getCell(colIdx);
      cell.value = staticHeaders[c];
      cell.fill = headerFill;
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = borderStyle;
    }

    const dateStartCol = 11; // Cột 11 trong Excel (1-based)
    for (let i = 0; i < numOfDays; i++) {
      const currDate = new Date(startDate.getTime() + i * 86400000);
      const colIdx = dateStartCol + i * 4;
      const isWeekend = currDate.getDay() === 0 || currDate.getDay() === 6;
      const fill = isWeekend ? weekendHeaderFill : headerFill;

      // Row 7 (Ngày dd/MM)
      sheet.mergeCells(7, colIdx, 7, colIdx + 3);
      const cDate = r7.getCell(colIdx);
      cDate.value = `${String(currDate.getDate()).padStart(2, '0')}/${String(currDate.getMonth() + 1).padStart(2, '0')}`;
      cDate.fill = fill;
      cDate.font = { name: 'Calibri', size: 11, bold: true };
      cDate.alignment = { horizontal: 'center', vertical: 'middle' };
      cDate.border = borderStyle;

      // Row 8 (Thứ)
      sheet.mergeCells(8, colIdx, 8, colIdx + 3);
      const cDay = r8.getCell(colIdx);
      cDay.value = this.getVietnameseDayOfWeek(currDate);
      cDay.fill = fill;
      cDay.font = { name: 'Calibri', size: 11, bold: true };
      cDay.alignment = { horizontal: 'center', vertical: 'middle' };
      cDay.border = borderStyle;

      // Row 9 (4 Subheaders)
      const subLabels = ['Thuộc ca', 'Giờ vào', 'Giờ ra', 'Ghi chú'];
      for (let s = 0; s < 4; s++) {
        const subCell = r9.getCell(colIdx + s);
        subCell.value = subLabels[s];
        subCell.fill = subHeaderFill;
        subCell.font = { name: 'Calibri', size: 11, bold: true };
        subCell.alignment = { horizontal: 'center', vertical: 'middle' };
        subCell.border = borderStyle;
      }
    }

    // Dữ liệu
    let rowNum = 10;
    let stt = 1;

    for (const { user, attendances: userAtts } of groupedByUser.values()) {
      // Phân nhóm theo ngày
      const dailyMap = new Map<string, any[]>();
      for (const a of userAtts) {
        const dKey = new Date(a.workDate).toISOString().split('T')[0];
        if (!dailyMap.has(dKey)) dailyMap.set(dKey, []);
        dailyMap.get(dKey)!.push(a);
      }

      let maxShiftsInDay = 1;
      for (const list of dailyMap.values()) {
        if (list.length > maxShiftsInDay) maxShiftsInDay = list.length;
      }

      const startUserRow = rowNum;
      const empTotalShifts = userAtts.length;
      let empTotalHrs = 0;
      let empOnTime = 0;
      let empLateCount = 0;
      let empLateMins = 0;
      let empOvertimeMins = 0;

      for (const a of userAtts) {
        empTotalHrs += this.attendanceService.calculateEffectiveHours(a);
        if (a.status === 'ON_TIME') empOnTime++;
        if (a.status && a.status !== 'ON_TIME' && a.status !== 'FLEXIBLE') empLateCount++;

        if (a.notes && a.notes.includes('Đi trễ')) {
          const match = a.notes.match(/(\d+)/);
          if (match) empLateMins += parseInt(match[1], 10);
        }

        if (a.shift && a.checkOutTime) {
          const outDate = new Date(a.checkOutTime);
          const outMin = outDate.getHours() * 60 + outDate.getMinutes();
          let expMin = this.parseTimeToMinutes(a.shift.endTime);
          if (a.shift.isSplitShift && a.shift.endTime2) {
            const exp2 = this.parseTimeToMinutes(a.shift.endTime2);
            if (Math.abs(outMin - exp2) < Math.abs(outMin - expMin)) expMin = exp2;
          }
          if (outMin > expMin) {
            empOvertimeMins += outMin - expMin;
          }
        }
      }

      for (let r = 0; r < maxShiftsInDay; r++) {
        const dataRow = sheet.getRow(rowNum++);
        dataRow.height = 20;

        if (r === 0) {
          const uRole = user.roleAssignments?.[0]?.role?.name || user.role || 'NV';
          dataRow.getCell(1).value = stt;
          dataRow.getCell(2).value = `${user.fullName || user.username}\n(${uRole})`;
          dataRow.getCell(3).value = empTotalShifts;
          dataRow.getCell(4).value = Math.round(empTotalHrs * 100) / 100;
          dataRow.getCell(5).value = empOnTime;
          dataRow.getCell(6).value = empLateCount;
          dataRow.getCell(7).value = empLateMins;
          dataRow.getCell(8).value = Math.round((empLateMins / 60) * 10) / 10;
          dataRow.getCell(9).value = empOvertimeMins;
          dataRow.getCell(10).value = Math.round((empOvertimeMins / 60) * 10) / 10;
        }

        for (let c = 1; c <= 10; c++) {
          const cell = dataRow.getCell(c);
          cell.font = { name: 'Calibri', size: 11 };
          cell.alignment = {
            horizontal: c === 2 ? 'left' : 'center',
            vertical: 'middle',
            wrapText: true,
          };
          cell.border = borderStyle;
        }

        for (let i = 0; i < numOfDays; i++) {
          const currDate = new Date(startDate.getTime() + i * 86400000);
          const dKey = currDate.toISOString().split('T')[0];
          const colIdx = dateStartCol + i * 4;
          const isWeekend = currDate.getDay() === 0 || currDate.getDay() === 6;

          const cShift = dataRow.getCell(colIdx);
          const cIn = dataRow.getCell(colIdx + 1);
          const cOut = dataRow.getCell(colIdx + 2);
          const cNote = dataRow.getCell(colIdx + 3);

          const cells = [cShift, cIn, cOut, cNote];
          for (const cell of cells) {
            cell.font = { name: 'Calibri', size: 11 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = borderStyle;
            if (isWeekend) cell.fill = weekendDataFill;
          }

          const dayAtts = dailyMap.get(dKey) || [];
          if (r < dayAtts.length) {
            const att = dayAtts[r];
            cShift.value = att.shift?.name || 'Ca tự do';
            cIn.value = att.checkInTime
              ? new Date(att.checkInTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit', minute: '2-digit' })
              : '-';
            cOut.value = att.checkOutTime
              ? new Date(att.checkOutTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit', minute: '2-digit' })
              : '-';
            cNote.value = att.notes || '';
          } else {
            cShift.value = '-';
            cIn.value = '-';
            cOut.value = '-';
            cNote.value = '-';
          }
        }
      }

      if (maxShiftsInDay > 1) {
        const endR = rowNum - 1;
        for (let c = 1; c <= 10; c++) {
          sheet.mergeCells(startUserRow, c, endR, c);
        }
      }
      stt++;
    }

    // Set Column Widths
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 22;
    for (let c = 3; c <= 10; c++) sheet.getColumn(c).width = 12;

    for (let c = dateStartCol; c < dateStartCol + numOfDays * 4; c += 4) {
      sheet.getColumn(c).width = 15;
      sheet.getColumn(c + 1).width = 8;
      sheet.getColumn(c + 2).width = 8;
      sheet.getColumn(c + 3).width = 18;
    }
  }

  // ==========================================
  // SHEET 2: BẢNG CÔNG THEO VAI TRÒ
  // ==========================================
  private renderSheetBangCong(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    roleName: string,
    usersInRole: Map<string, { user: any; attendances: any[] }>,
    startDate: Date,
    numOfDays: number,
    calculateOvertime: boolean,
    userNormRefs: Map<string, string>,
    userOtRefs: Map<string, string>,
  ) {
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: 6 }],
    });

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    const weekendHeaderFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8CBAD' },
    };
    const totalFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF2CC' }, // LEMON_CHIFFON
    };

    // Row 1
    sheet.getRow(1).getCell(1).value = 'CÔNG TY TNHH SUSHI WA';
    sheet.getRow(1).getCell(1).font = { name: 'Calibri', size: 11, bold: true };

    // Row 3
    sheet.getRow(3).getCell(1).value = `BẢNG TỔNG HỢP GIỜ CÔNG - ${roleName.toUpperCase()}`;
    sheet.getRow(3).getCell(1).font = { name: 'Calibri', size: 16, bold: true };

    // Headers: Rows 5 & 6
    const r5 = sheet.getRow(5);
    const r6 = sheet.getRow(6);
    r5.height = 25;
    r6.height = 20;

    sheet.mergeCells(5, 1, 6, 1);
    r5.getCell(1).value = 'HỌ TÊN NHÂN VIÊN';
    r5.getCell(1).font = { name: 'Calibri', size: 11, bold: true };
    r5.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    r5.getCell(1).fill = headerFill;
    r5.getCell(1).border = borderStyle;
    sheet.getColumn(1).width = 25;

    sheet.mergeCells(5, 2, 6, 2);
    r5.getCell(2).value = 'PHÂN LOẠI';
    r5.getCell(2).font = { name: 'Calibri', size: 11, bold: true };
    r5.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    r5.getCell(2).fill = headerFill;
    r5.getCell(2).border = borderStyle;
    sheet.getColumn(2).width = 16;

    for (let i = 0; i < numOfDays; i++) {
      const currDate = new Date(startDate.getTime() + i * 86400000);
      const colIdx = i + 3; // Cột bắt đầu từ C (3)
      const isWeekend = currDate.getDay() === 0 || currDate.getDay() === 6;
      const fill = isWeekend ? weekendHeaderFill : headerFill;

      const cDate = r5.getCell(colIdx);
      const dStr = `${String(currDate.getDate()).padStart(2, '0')}/${String(currDate.getMonth() + 1).padStart(2, '0')}`;
      if (this.attendanceService.isHoliday(currDate)) {
        cDate.value = `x3\n${dStr}`;
        r5.height = 35;
      } else {
        cDate.value = dStr;
      }
      cDate.font = { name: 'Calibri', size: 11, bold: true };
      cDate.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cDate.fill = fill;
      cDate.border = borderStyle;

      const cDay = r6.getCell(colIdx);
      cDay.value = this.getVietnameseDayOfWeek(currDate);
      cDay.font = { name: 'Calibri', size: 11, bold: true };
      cDay.alignment = { horizontal: 'center', vertical: 'middle' };
      cDay.fill = fill;
      cDay.border = borderStyle;

      sheet.getColumn(colIdx).width = 9;
    }

    const lastCol = numOfDays + 3;
    sheet.mergeCells(5, lastCol, 6, lastCol);
    const cTotalH = r5.getCell(lastCol);
    cTotalH.value = 'TỔNG GIỜ';
    cTotalH.font = { name: 'Calibri', size: 11, bold: true };
    cTotalH.alignment = { horizontal: 'center', vertical: 'middle' };
    cTotalH.fill = headerFill;
    cTotalH.border = borderStyle;
    sheet.getColumn(lastCol).width = 15;

    // Dữ liệu
    let rowIdx = 7;
    for (const { user, attendances: userAtts } of usersInRole.values()) {
      const rowNorm = sheet.getRow(rowIdx++);
      rowNorm.height = 22;
      let rowOt: ExcelJS.Row | null = null;
      if (calculateOvertime) {
        rowOt = sheet.getRow(rowIdx++);
        rowOt.height = 22;
      }

      rowNorm.getCell(1).value = user.fullName || user.username;
      rowNorm.getCell(1).font = { name: 'Calibri', size: 11 };
      rowNorm.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      rowNorm.getCell(1).border = borderStyle;

      if (calculateOvertime && rowOt) {
        rowOt.getCell(1).border = borderStyle;
        sheet.mergeCells(rowNorm.number, 1, rowOt.number, 1);

        rowNorm.getCell(2).value = 'Giờ chuẩn (<=8h)';
        rowOt.getCell(2).value = 'Tăng ca (>8h)';
        rowOt.getCell(2).font = { name: 'Calibri', size: 11 };
        rowOt.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        rowOt.getCell(2).border = borderStyle;
      } else {
        rowNorm.getCell(2).value = 'Tổng giờ làm';
      }
      rowNorm.getCell(2).font = { name: 'Calibri', size: 11 };
      rowNorm.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      rowNorm.getCell(2).border = borderStyle;

      for (let i = 0; i < numOfDays; i++) {
        const currDate = new Date(startDate.getTime() + i * 86400000);
        const dKey = currDate.toISOString().split('T')[0];
        const colIdx = i + 3;
        const isWeekend = currDate.getDay() === 0 || currDate.getDay() === 6;

        let dailyHours = 0;
        for (const a of userAtts) {
          const aKey = new Date(a.workDate).toISOString().split('T')[0];
          if (aKey === dKey) {
            dailyHours += this.attendanceService.calculateEffectiveHours(a);
          }
        }

        const isHol = this.attendanceService.isHoliday(currDate);
        const multiplier = isHol ? 3.0 : 1.0;

        const cNorm = rowNorm.getCell(colIdx);
        cNorm.font = { name: 'Calibri', size: 11 };
        cNorm.alignment = { horizontal: 'center', vertical: 'middle' };
        cNorm.border = borderStyle;
        if (isWeekend) cNorm.fill = weekendHeaderFill;

        let cOt: ExcelJS.Cell | null = null;
        if (calculateOvertime && rowOt) {
          cOt = rowOt.getCell(colIdx);
          cOt.font = { name: 'Calibri', size: 11 };
          cOt.alignment = { horizontal: 'center', vertical: 'middle' };
          cOt.border = borderStyle;
          if (isWeekend) cOt.fill = weekendHeaderFill;
        }

        if (dailyHours > 0) {
          let nHrs = 0;
          let oHrs = 0;

          if (isHol) {
            nHrs = dailyHours;
            oHrs = 0;
          } else {
            if (calculateOvertime) {
              nHrs = dailyHours > 8 ? 8 : dailyHours;
              oHrs = dailyHours > 8 ? dailyHours - 8 : 0;
            } else {
              nHrs = dailyHours;
              oHrs = 0;
            }
          }

          cNorm.value = Math.round(nHrs * multiplier * 100) / 100;
          if (cOt) {
            cOt.value = oHrs > 0 ? Math.round(oHrs * multiplier * 100) / 100 : '-';
          }
        } else {
          cNorm.value = '-';
          if (cOt) cOt.value = '-';
        }
      }

      // Cột Tổng công thức SUM()
      const startColLetter = 'C';
      const endColLetter = this.colToLetter(lastCol - 1);
      const rowNormNum = rowNorm.number;

      const cTotalNorm = rowNorm.getCell(lastCol);
      cTotalNorm.value = { formula: `SUM(${startColLetter}${rowNormNum}:${endColLetter}${rowNormNum})` };
      cTotalNorm.font = { name: 'Calibri', size: 11, bold: true };
      cTotalNorm.alignment = { horizontal: 'center', vertical: 'middle' };
      cTotalNorm.fill = totalFill;
      cTotalNorm.border = borderStyle;

      const sheetEscaped = `'${sheetName.replace(/'/g, "''")}'`;
      const normRef = `${sheetEscaped}!${this.colToLetter(lastCol)}${rowNormNum}`;
      userNormRefs.set(user.id, normRef);

      if (calculateOvertime && rowOt) {
        const rowOtNum = rowOt.number;
        const cTotalOt = rowOt.getCell(lastCol);
        cTotalOt.value = { formula: `SUM(${startColLetter}${rowOtNum}:${endColLetter}${rowOtNum})` };
        cTotalOt.font = { name: 'Calibri', size: 11, bold: true };
        cTotalOt.alignment = { horizontal: 'center', vertical: 'middle' };
        cTotalOt.fill = totalFill;
        cTotalOt.border = borderStyle;

        const otRef = `${sheetEscaped}!${this.colToLetter(lastCol)}${rowOtNum}`;
        userOtRefs.set(user.id, otRef);
      }
    }
  }

  // ==========================================
  // SHEET 3: PHIẾU LƯƠNG TỪNG NHÂN VIÊN
  // ==========================================
  private renderSheetPhieuLuong(
    workbook: ExcelJS.Workbook,
    user: any,
    userAtts: any[],
    start: Date,
    end: Date,
    calculateOvertime: boolean,
    userNormRefs: Map<string, string>,
    userOtRefs: Map<string, string>,
  ) {
    let sheetName = `PL - ${user.fullName || user.username}`;
    sheetName = sheetName.replace(/[\\/:*?"<>|]/g, '_');
    if (sheetName.length > 31) sheetName = sheetName.substring(0, 31);

    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: false }],
    });

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    const yellowFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF2CC' },
    };

    const normRef = userNormRefs.get(user.id) || '0';
    const otRef = userOtRefs.get(user.id) || '0';

    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 6;
    sheet.getColumn(3).width = 35;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 30;

    // Row 2: PHIẾU THANH TOÁN LƯƠNG
    sheet.mergeCells(2, 2, 2, 5);
    const r2Cell = sheet.getRow(2).getCell(2);
    r2Cell.value = 'PHIẾU THANH TOÁN LƯƠNG';
    r2Cell.font = { name: 'Calibri', size: 16, bold: true };
    r2Cell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Tháng MM/yyyy
    sheet.mergeCells(3, 2, 3, 5);
    const r3Cell = sheet.getRow(3).getCell(2);
    r3Cell.value = `Tháng ${String(start.getMonth() + 1).padStart(2, '0')}/${start.getFullYear()}`;
    r3Cell.font = { name: 'Calibri', size: 16, bold: true };
    r3Cell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 5: Mã nhân viên & Họ tên
    const r5 = sheet.getRow(5);
    r5.height = 20;
    sheet.mergeCells(5, 2, 5, 3);
    sheet.mergeCells(5, 4, 5, 5);
    r5.getCell(2).value = `Mã nhân viên: ${user.username || user.email}`;
    r5.getCell(2).font = { name: 'Calibri', size: 12 };
    r5.getCell(4).value = `Họ và tên: ${user.fullName || user.username}`;
    r5.getCell(4).font = { name: 'Calibri', size: 12 };

    // Row 6: Tổng giờ công & Chức vụ
    const r6 = sheet.getRow(6);
    r6.height = 20;
    sheet.mergeCells(6, 2, 6, 3);
    sheet.mergeCells(6, 4, 6, 5);
    r6.getCell(2).value = { formula: `"Tổng giờ công: " & ROUND(${normRef}, 2)` };
    r6.getCell(2).font = { name: 'Calibri', size: 12 };
    const uRole = user.roleAssignments?.[0]?.role?.name || user.role || 'NV';
    r6.getCell(4).value = `Chức vụ: ${uRole}`;
    r6.getCell(4).font = { name: 'Calibri', size: 12 };

    // Row 7: Tăng ca
    if (calculateOvertime) {
      const r7 = sheet.getRow(7);
      r7.height = 20;
      sheet.mergeCells(7, 2, 7, 3);
      r7.getCell(2).value = { formula: `"Giờ tăng ca: " & ROUND(${otRef}, 2)` };
      r7.getCell(2).font = { name: 'Calibri', size: 12 };
    }

    // Bảng thanh toán: Row 9 Header
    const startRow = 9;
    const rH = sheet.getRow(startRow);
    rH.height = 25;
    const hLabels = ['Stt', 'Chi tiết', 'Số tiền', 'Diễn giải'];
    for (let i = 0; i < 4; i++) {
      const c = rH.getCell(i + 2);
      c.value = hLabels[i];
      c.font = { name: 'Calibri', size: 11, bold: true };
      c.fill = headerFill;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = borderStyle;
    }

    // Mục I (Row 10 / Excel D10)
    const rI = sheet.getRow(startRow + 1);
    rI.height = 22;
    rI.getCell(2).value = 'I';
    rI.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    rI.getCell(3).value = 'Mức lương/ giờ lương';
    rI.getCell(4).value = 0; // Ô D10 để HR tự nhập mức lương theo giờ
    rI.getCell(4).numFmt = '[$-vi-VN]#,##0';
    rI.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    rI.getCell(5).value = '-';
    for (let c = 2; c <= 5; c++) rI.getCell(c).border = borderStyle;

    // Mục II (Row 11 / Excel D11)
    const rII = sheet.getRow(startRow + 2);
    rII.height = 25;
    rII.getCell(2).value = 'II';
    rII.getCell(3).value = 'Khoản cộng (1)';
    rII.getCell(4).value = { formula: 'SUM(D12:D17)' };
    rII.getCell(4).numFmt = '[$-vi-VN]#,##0';
    rII.getCell(4).font = { name: 'Calibri', size: 11, bold: true };
    rII.getCell(4).fill = yellowFill;
    rII.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    rII.getCell(5).value = '';
    for (let c = 2; c <= 5; c++) {
      rII.getCell(c).fill = yellowFill;
      rII.getCell(c).font = { name: 'Calibri', size: 11, bold: true };
      rII.getCell(c).border = borderStyle;
    }

    const adds = ['Lương chính', 'Lương tăng ca', 'Trách nhiệm', 'Hỗ trợ đi lại', 'Thưởng nóng', 'Khác'];
    for (let i = 0; i < 6; i++) {
      const rAdd = sheet.getRow(startRow + 3 + i);
      rAdd.height = 22;
      rAdd.getCell(2).value = String(i + 1);
      rAdd.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      rAdd.getCell(3).value = adds[i];
      const cAmt = rAdd.getCell(4);
      cAmt.numFmt = '[$-vi-VN]#,##0';
      cAmt.alignment = { horizontal: 'right', vertical: 'middle' };

      if (i === 0) {
        cAmt.value = { formula: `D10 * ${normRef}` };
      } else if (i === 1 && calculateOvertime) {
        cAmt.value = { formula: `D10 * ${otRef}` };
      } else {
        cAmt.value = 0;
      }

      rAdd.getCell(5).value = '-';
      for (let c = 2; c <= 5; c++) rAdd.getCell(c).border = borderStyle;
    }

    // Mục III (Row 18)
    const nextIdx = startRow + 9;
    const rIII = sheet.getRow(nextIdx);
    rIII.height = 25;
    rIII.getCell(2).value = 'III';
    rIII.getCell(3).value = 'Khoản trừ (2)';
    rIII.getCell(4).value = { formula: 'SUM(D19:D20)' };
    rIII.getCell(4).numFmt = '[$-vi-VN]#,##0';
    rIII.getCell(4).font = { name: 'Calibri', size: 11, bold: true };
    rIII.getCell(4).fill = yellowFill;
    rIII.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    for (let c = 2; c <= 5; c++) {
      rIII.getCell(c).fill = yellowFill;
      rIII.getCell(c).font = { name: 'Calibri', size: 11, bold: true };
      rIII.getCell(c).border = borderStyle;
    }

    const subs = ['Món ăn bị lỗi/ Lỗi vệ sinh', 'Khác'];
    for (let i = 0; i < 2; i++) {
      const rSub = sheet.getRow(nextIdx + 1 + i);
      rSub.height = 22;
      rSub.getCell(2).value = String(i + 1);
      rSub.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      rSub.getCell(3).value = subs[i];
      rSub.getCell(4).value = 0;
      rSub.getCell(4).numFmt = '[$-vi-VN]#,##0';
      rSub.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      rSub.getCell(5).value = '-';
      for (let c = 2; c <= 5; c++) rSub.getCell(c).border = borderStyle;
    }

    // Mục IV (Row 21)
    const rIV = sheet.getRow(nextIdx + 3);
    rIV.height = 25;
    rIV.getCell(2).value = 'IV';
    rIV.getCell(3).value = 'Tạm ứng (3)';
    rIV.getCell(4).value = 0;
    rIV.getCell(4).numFmt = '[$-vi-VN]#,##0';
    rIV.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    rIV.getCell(5).value = '-';
    for (let c = 2; c <= 5; c++) {
      rIV.getCell(c).fill = yellowFill;
      rIV.getCell(c).font = { name: 'Calibri', size: 11, bold: true };
      rIV.getCell(c).border = borderStyle;
    }

    // Tổng cộng (Row 22)
    const rSum = sheet.getRow(nextIdx + 4);
    rSum.height = 25;
    rSum.getCell(2).value = '-';
    rSum.getCell(3).value = 'Tổng cộng (1)-(2)-(3)';
    rSum.getCell(4).value = { formula: 'D11 - D18 - D21' };
    rSum.getCell(4).numFmt = '[$-vi-VN]#,##0';
    rSum.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    rSum.getCell(5).value = '-';
    for (let c = 2; c <= 5; c++) {
      rSum.getCell(c).fill = yellowFill;
      rSum.getCell(c).font = { name: 'Calibri', size: 11, bold: true };
      rSum.getCell(c).border = borderStyle;
    }

    // Ký nhận
    const rSig = sheet.getRow(nextIdx + 7);
    rSig.getCell(3).value = 'Người lập phiếu';
    rSig.getCell(3).font = { name: 'Calibri', size: 11, bold: true };
    rSig.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

    rSig.getCell(5).value = 'Nhân viên ký nhận';
    rSig.getCell(5).font = { name: 'Calibri', size: 11, bold: true };
    rSig.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  private parseTimeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }
}

