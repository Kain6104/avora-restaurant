import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from './attendance.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class AttendanceImportService {
  private readonly logger = new Logger(AttendanceImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  // ==========================================
  // 1. IMPORT LỊCH CA TUẦN TỪ EXCEL (PORT TỪ SHIFTSERVICE SUSHI WA)
  // ==========================================
  async importWeeklySchedule(
    fileBuffer: Buffer,
    roleId: string,
    branchId: string,
  ): Promise<{ addedShifts: number; message: string }> {
    const role = await this.prisma.accessRole.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Vai trò không tồn tại trong hệ thống.');

    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại.');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('File Excel không có trang tính nào.');

    let addedShifts = 0;

    // Đọc ô header (row 1, col 1) để tìm ngày Thứ 2 của tuần: dạng dd/MM/yyyy
    const headerCell = sheet.getRow(1).getCell(1).text || '';
    const dateMatch = headerCell.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    let mondayDate = new Date();
    if (dateMatch) {
      const [d, m, y] = dateMatch[1].split('/').map(Number);
      mondayDate = new Date(y, m - 1, d);
    } else {
      // Mặc định Thứ 2 tuần này
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      mondayDate = new Date(now.setDate(diff));
    }
    mondayDate.setHours(0, 0, 0, 0);

    const timeRegex = /(\d{1,2})(?:h)?\s*-\s*(\d{1,2})(?:h)?/;

    // Các cột cho từng ngày theo format Sushi Wa (1-based index)
    // T2: col 1, T3: col 3, T4: col 5, T5: col 7, T6: col 9, T7: col 11 & 12, CN: col 14 & 15
    const dayCols = [
      [1],
      [3],
      [5],
      [7],
      [9],
      [11, 12],
      [14, 15],
    ];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentShiftDate = new Date(mondayDate.getTime() + dayOffset * 86400000);
      currentShiftDate.setHours(0, 0, 0, 0);

      const colsToCheck = dayCols[dayOffset];

      const existingShiftsForDay = await this.prisma.shift.findMany({
        where: {
          shiftDate: currentShiftDate,
          roleId: role.id,
          branchId: branch.id,
        },
        include: { assignedUsers: true },
      });

      const rowCount = sheet.rowCount;
      for (let r = 2; r <= rowCount; r++) {
        const row = sheet.getRow(r);
        if (!row) continue;

        const time1 = colsToCheck.length > 0 ? (row.getCell(colsToCheck[0]).text || '').trim() : '';
        const time2 = colsToCheck.length > 1 ? (row.getCell(colsToCheck[1]).text || '').trim() : '';

        let names1 = '';
        let names2 = '';

        if (colsToCheck.length === 1) {
          names1 = (row.getCell(colsToCheck[0] + 1).text || '').trim();
        } else if (colsToCheck.length === 2) {
          const sharedName = (row.getCell(colsToCheck[1] + 1).text || '').trim();
          names1 = sharedName;
          names2 = sharedName;
        }

        const isSplit = time1 !== '' && time2 !== '' && timeRegex.test(time1) && timeRegex.test(time2);

        if (isSplit) {
          const tm1 = time1.match(timeRegex);
          const tm2 = time2.match(timeRegex);
          if (tm1 && tm2) {
            const st1 = `${String(parseInt(tm1[1], 10)).padStart(2, '0')}:00`;
            const et1 = `${String(parseInt(tm1[2], 10)).padStart(2, '0')}:00`;
            const st2 = `${String(parseInt(tm2[1], 10)).padStart(2, '0')}:00`;
            const et2 = `${String(parseInt(tm2[2], 10)).padStart(2, '0')}:00`;

            const combinedNames = `${names1},${names2}`;
            const userIds = await this.parseAndFindUsers(combinedNames, role.id);

            const duplicate = existingShiftsForDay.find(
              (s) =>
                s.isSplitShift &&
                s.startTime === st1 &&
                s.endTime === et1 &&
                s.startTime2 === st2 &&
                s.endTime2 === et2,
            );

            if (duplicate) {
              if (userIds.length > 0) {
                await this.prisma.shift.update({
                  where: { id: duplicate.id },
                  data: {
                    assignedUsers: {
                      connect: userIds.map((id) => ({ id })),
                    },
                  },
                });
              }
            } else {
              const newShift = await this.prisma.shift.create({
                data: {
                  shiftDate: currentShiftDate,
                  startTime: st1,
                  endTime: et1,
                  startTime2: st2,
                  endTime2: et2,
                  isSplitShift: true,
                  name: `${time1} & ${time2}`,
                  roleId: role.id,
                  branchId: branch.id,
                  gracePeriodMins: 5,
                  assignedUsers: {
                    connect: userIds.map((id) => ({ id })),
                  },
                },
                include: { assignedUsers: true },
              });
              existingShiftsForDay.push(newShift);
              addedShifts++;
            }
          }
        } else {
          if (time1 !== '') {
            const tm1 = time1.match(timeRegex);
            if (tm1) {
              const res = await this.processSingleShift(
                currentShiftDate,
                tm1,
                time1,
                role.id,
                branch.id,
                names1,
                existingShiftsForDay,
              );
              addedShifts += res;
            }
          }
          if (time2 !== '') {
            const tm2 = time2.match(timeRegex);
            if (tm2) {
              const res = await this.processSingleShift(
                currentShiftDate,
                tm2,
                time2,
                role.id,
                branch.id,
                names2,
                existingShiftsForDay,
              );
              addedShifts += res;
            }
          }
        }
      }

      await this.attendanceService.syncAttendancesWithShifts(currentShiftDate);
    }

    return {
      addedShifts,
      message: `Đã tự động nhận diện và lưu thành công ${addedShifts} khung ca làm việc từ Excel!`,
    };
  }

  private async processSingleShift(
    date: Date,
    tm: RegExpMatchArray,
    rawName: string,
    roleId: string,
    branchId: string,
    namesInExcel: string,
    existingShiftsForDay: any[],
  ): Promise<number> {
    const startTime = `${String(parseInt(tm[1], 10)).padStart(2, '0')}:00`;
    const endTime = `${String(parseInt(tm[2], 10)).padStart(2, '0')}:00`;

    const userIds = await this.parseAndFindUsers(namesInExcel, roleId);

    const duplicate = existingShiftsForDay.find(
      (s) => !s.isSplitShift && s.startTime === startTime && s.endTime === endTime,
    );

    if (duplicate) {
      if (userIds.length > 0) {
        await this.prisma.shift.update({
          where: { id: duplicate.id },
          data: {
            assignedUsers: {
              connect: userIds.map((id) => ({ id })),
            },
          },
        });
      }
      return 0;
    } else {
      const newShift = await this.prisma.shift.create({
        data: {
          shiftDate: date,
          startTime,
          endTime,
          name: rawName,
          roleId,
          branchId,
          gracePeriodMins: 5,
          isSplitShift: false,
          assignedUsers: {
            connect: userIds.map((id) => ({ id })),
          },
        },
        include: { assignedUsers: true },
      });
      existingShiftsForDay.push(newShift);
      return 1;
    }
  }

  private async parseAndFindUsers(namesInExcel: string, roleId: string): Promise<string[]> {
    const foundUserIds: string[] = [];
    if (!namesInExcel || !namesInExcel.trim()) return foundUserIds;

    const splitNames = namesInExcel.split(/[,;\n-]/);
    for (const namePart of splitNames) {
      const cleanName = namePart.trim().toLowerCase();
      if (!cleanName) continue;

      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: cleanName } },
            { username: { contains: cleanName } },
          ],
        },
        select: { id: true, fullName: true, username: true },
      });

      let exact = users.find(
        (u) =>
          u.fullName.trim().toLowerCase() === cleanName ||
          (u.username && u.username.trim().toLowerCase() === cleanName),
      );
      if (!exact && users.length > 0) {
        exact = users[0];
      }

      if (exact && !foundUserIds.includes(exact.id)) {
        foundUserIds.push(exact.id);
      }
    }
    return foundUserIds;
  }

  // ==========================================
  // 2. IMPORT BẢNG CÔNG LỊCH SỬ TỪ SUSHI WA
  // ==========================================
  async importHistoricalAttendance(
    fileBuffer: Buffer,
    targetBranchId: string,
    options?: { updateExisting?: boolean },
  ) {
    const branch = await this.prisma.branch.findUnique({ where: { id: targetBranchId } });
    if (!branch) throw new NotFoundException('Chi nhánh đích không tồn tại.');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    // Tìm sheet Nhật Ký Chi Tiết hoặc sheet đầu tiên
    const sheet = workbook.getWorksheet('Nhật Ký Chi Tiết') || workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Không tìm thấy dữ liệu trong file Excel.');

    const report: {
      totalRows: number;
      importedCount: number;
      updatedCount: number;
      skippedCount: number;
      errors: Array<{ row: number; reason: string }>;
    } = {
      totalRows: 0,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    // Quét dòng header xem ngày bắt đầu ở cột nào
    const row7 = sheet.getRow(7);
    const dateCols: Array<{ col: number; dateStr: string }> = [];

    for (let c = 11; c <= sheet.columnCount; c += 4) {
      const val = row7.getCell(c).text;
      if (val && /\d{1,2}\/\d{1,2}/.test(val)) {
        dateCols.push({ col: c, dateStr: val.trim() });
      }
    }

    const rowCount = sheet.rowCount;
    let currentEmpName = '';
    let matchedUser: any = null;

    for (let r = 10; r <= rowCount; r++) {
      const row = sheet.getRow(r);
      if (!row) continue;

      const nameCellVal = (row.getCell(2).text || '').trim();
      if (nameCellVal) {
        // Có dạng "Nguyễn Văn A\n(SERVER)"
        currentEmpName = nameCellVal.split('\n')[0].trim();
        matchedUser = await this.prisma.user.findFirst({
          where: {
            OR: [
              { fullName: { contains: currentEmpName } },
              { username: { contains: currentEmpName } },
            ],
          },
        });
      }

      if (!matchedUser) {
        if (nameCellVal) {
          report.errors.push({
            row: r,
            reason: `Không tìm thấy nhân viên trong hệ thống: "${currentEmpName}"`,
          });
        }
        report.skippedCount++;
        continue;
      }

      report.totalRows++;

      // Duyệt qua các ngày
      for (const dCol of dateCols) {
        const shiftName = (row.getCell(dCol.col).text || '').trim();
        const inStr = (row.getCell(dCol.col + 1).text || '').trim();
        const outStr = (row.getCell(dCol.col + 2).text || '').trim();
        const notes = (row.getCell(dCol.col + 3).text || '').trim();

        if (!inStr || inStr === '-' || inStr === '???') continue;

        const [d, m] = dCol.dateStr.split('/').map(Number);
        const now = new Date();
        const workDate = new Date(now.getFullYear(), m - 1, d);
        workDate.setHours(0, 0, 0, 0);

        let checkInTime: Date | null = null;
        if (/^\d{1,2}:\d{2}$/.test(inStr)) {
          const [h, min] = inStr.split(':').map(Number);
          checkInTime = new Date(workDate);
          checkInTime.setHours(h, min, 0, 0);
        }

        let checkOutTime: Date | null = null;
        if (/^\d{1,2}:\d{2}$/.test(outStr)) {
          const [h, min] = outStr.split(':').map(Number);
          checkOutTime = new Date(workDate);
          checkOutTime.setHours(h, min, 0, 0);
        }

        const existing = await this.prisma.attendance.findFirst({
          where: {
            userId: matchedUser.id,
            workDate,
            ...(checkInTime ? { checkInTime } : {}),
          },
        });

        if (existing) {
          if (options?.updateExisting) {
            await this.prisma.attendance.update({
              where: { id: existing.id },
              data: {
                checkOutTime: checkOutTime || existing.checkOutTime,
                notes: notes || existing.notes,
                sourceSystem: 'SUSHI_WA',
              },
            });
            report.updatedCount++;
          } else {
            report.skippedCount++;
          }
        } else {
          const newAtt: any = {
            userId: matchedUser.id,
            branchId: branch.id,
            workDate,
            checkInTime,
            checkOutTime,
            status: notes.includes('Đi trễ') ? 'LATE' : 'ON_TIME',
            notes: notes || 'Import từ Sushi Wa',
            sourceSystem: 'SUSHI_WA',
          };
          this.attendanceService.recalculateAttendanceData(newAtt);
          await this.prisma.attendance.create({ data: newAtt });
          report.importedCount++;
        }
      }
    }

    return {
      success: true,
      data: report,
      message: `Hoàn thành import dữ liệu chấm công: ${report.importedCount} mới, ${report.updatedCount} cập nhật, ${report.skippedCount} bỏ qua, ${report.errors.length} lỗi.`,
    };
  }

  // ==========================================
  // 3. PREVIEW DỮ LIỆU CHẤM CÔNG TRƯỚC KHI IMPORT
  // ==========================================
  async previewHistoricalAttendance(fileBuffer: Buffer, targetBranchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: targetBranchId } });
    if (!branch) throw new NotFoundException('Chi nhánh đích không tồn tại.');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const sheet = workbook.getWorksheet('Nhật Ký Chi Tiết') || workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Không tìm thấy dữ liệu trong file Excel.');

    const row7 = sheet.getRow(7);
    const dateCols: Array<{ col: number; dateStr: string }> = [];
    for (let c = 11; c <= sheet.columnCount; c += 4) {
      const val = row7.getCell(c).text;
      if (val && /\d{1,2}\/\d{1,2}/.test(val)) {
        dateCols.push({ col: c, dateStr: val.trim() });
      }
    }

    const employeesInFile = new Map<string, { rawName: string; cleanName: string; roleStr: string; sampleDays: number }>();
    const rowCount = sheet.rowCount;

    for (let r = 10; r <= rowCount; r++) {
      const row = sheet.getRow(r);
      if (!row) continue;
      const nameVal = (row.getCell(2).text || '').trim();
      if (!nameVal) continue;

      const lines = nameVal.split('\n');
      const cleanName = lines[0].trim();
      const roleStr = lines.length > 1 ? lines[1].replace(/[()]/g, '').trim() : '';

      if (!employeesInFile.has(cleanName)) {
        employeesInFile.set(cleanName, { rawName: nameVal, cleanName, roleStr, sampleDays: 0 });
      }

      // Đếm số ngày có dữ liệu
      let daysCount = 0;
      for (const d of dateCols) {
        const inStr = (row.getCell(d.col + 1).text || '').trim();
        if (inStr && inStr !== '-' && inStr !== '???') daysCount++;
      }
      employeesInFile.get(cleanName)!.sampleDays += daysCount;
    }

    // Đối chiếu với danh sách nhân viên trong DB
    const previewEmployees: Array<{
      nameInFile: string;
      roleInFile: string;
      shiftsCount: number;
      matchedUser: { id: string; fullName: string; username: string; email: string } | null;
      status: 'MATCHED' | 'NOT_FOUND';
    }> = [];

    for (const emp of employeesInFile.values()) {
      const matched = await this.prisma.user.findFirst({
        where: {
          OR: [
            { fullName: { contains: emp.cleanName } },
            { username: { contains: emp.cleanName } },
          ],
        },
        select: { id: true, fullName: true, username: true, email: true },
      });

      previewEmployees.push({
        nameInFile: emp.cleanName,
        roleInFile: emp.roleStr,
        shiftsCount: emp.sampleDays,
        matchedUser: matched ? {
          id: matched.id,
          fullName: matched.fullName || '',
          username: matched.username || '',
          email: matched.email,
        } : null,
        status: matched ? 'MATCHED' : 'NOT_FOUND',
      });
    }

    const matchedCount = previewEmployees.filter((e) => e.status === 'MATCHED').length;
    const totalRecordsEstimate = previewEmployees.reduce((sum, e) => sum + e.shiftsCount, 0);

    return {
      success: true,
      data: {
        branch: { id: branch.id, name: branch.name },
        dateColsCount: dateCols.length,
        dateRange: {
          start: dateCols[0]?.dateStr || '',
          end: dateCols[dateCols.length - 1]?.dateStr || '',
        },
        totalEmployeesInFile: previewEmployees.length,
        matchedEmployeesCount: matchedCount,
        unmatchedEmployeesCount: previewEmployees.length - matchedCount,
        totalRecordsEstimate,
        employees: previewEmployees,
      },
    };
  }
}
