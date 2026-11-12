import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceQrService } from './attendance-qr.service';
import { NotificationService } from '../notification/notification.service';
import { AttendanceScanDto } from './dto/attendance-scan.dto';
import { ShiftSaveDto } from './dto/shift-save.dto';
import { ManualActionDto, ManualAddDto } from './dto/manual-attendance.dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qrService: AttendanceQrService,
    private readonly notificationService: NotificationService,
  ) {}

  // ==========================================
  // HÀM TÍNH KHOẢNG CÁCH HAVERSINE (MÉT)
  // ==========================================
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Bán kính Trái Đất (mét)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ==========================================
  // KIỂM TRA NGÀY LỄ (X3 LƯƠNG THEO SUSHI WA)
  // ==========================================
  isHoliday(date: Date): boolean {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Dương lịch
    if (day === 1 && month === 1) return true; // Tết Dương lịch
    if (day === 30 && month === 4) return true; // Giải phóng miền Nam
    if (day === 1 && month === 5) return true; // Quốc tế Lao động
    if (day === 2 && month === 9) return true; // Quốc khánh

    // Âm lịch (Đã mapping các năm theo Sushi Wa gốc)
    const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    const lunarHolidays = [
      // 2024
      '10/02/2024', '11/02/2024', '12/02/2024', '13/02/2024', '18/04/2024',
      // 2025
      '29/01/2025', '30/01/2025', '31/01/2025', '01/02/2025', '07/04/2025',
      // 2026
      '17/02/2026', '18/02/2026', '19/02/2026', '20/02/2026', '26/04/2026',
      // 2027
      '06/02/2027', '07/02/2027', '08/02/2027', '09/02/2027', '16/04/2027',
    ];

    return lunarHolidays.includes(dateStr);
  }

  private parseTimeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
    return h * 60 + m;
  }

  private minutesBetween(t1: string, t2: string): number {
    return this.parseTimeToMinutes(t2) - this.parseTimeToMinutes(t1);
  }

  // ==========================================
  // TÍNH GIỜ CÔNG HIỆU QUẢ CỦA 1 KHUNG CA
  // ==========================================
  calculateShiftOverlap(
    actualIn: Date,
    actualOut: Date,
    shiftStartStr: string,
    shiftEndStr: string,
    gracePeriod: number,
  ): number {
    const workDate = new Date(actualIn);
    const [sH, sM] = shiftStartStr.split(':').map(Number);
    const [eH, eM] = shiftEndStr.split(':').map(Number);

    const sStart = new Date(workDate);
    sStart.setHours(sH, sM, 0, 0);

    const sEnd = new Date(workDate);
    sEnd.setHours(eH, eM, 0, 0);
    if (sEnd.getTime() < sStart.getTime()) {
      sEnd.setDate(sEnd.getDate() + 1); // Ca xuyên đêm
    }

    // Mở rộng biên độ 3 phút
    let effectiveIn = new Date(actualIn.getTime() - 3 * 60000);
    let effectiveOut = new Date(actualOut.getTime() + 3 * 60000);

    // Khoan hồng grace period cho đầu ca
    if (
      effectiveIn.getTime() > sStart.getTime() &&
      effectiveIn.getTime() < sStart.getTime() + (gracePeriod + 1) * 60000
    ) {
      effectiveIn = new Date(sStart);
    }

    // Khoan hồng grace period cho cuối ca
    if (
      effectiveOut.getTime() < sEnd.getTime() &&
      effectiveOut.getTime() > sEnd.getTime() - (gracePeriod + 1) * 60000
    ) {
      effectiveOut = new Date(sEnd);
    }

    const overlapStart = effectiveIn.getTime() < sStart.getTime() ? sStart : effectiveIn;
    const overlapEnd = effectiveOut.getTime() > sEnd.getTime() ? sEnd : effectiveOut;

    if (overlapStart.getTime() < overlapEnd.getTime()) {
      return (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
    }
    return 0;
  }

  calculateEffectiveHours(att: any): number {
    if (!att.checkInTime || !att.checkOutTime) return 0.0;
    const inDate = new Date(att.checkInTime);
    const outDate = new Date(att.checkOutTime);

    if (att.shift) {
      const s = att.shift;
      const grace = s.gracePeriodMins || 5;
      let totalMinutes = 0;

      if (!s.isSplitShift) {
        totalMinutes = this.calculateShiftOverlap(inDate, outDate, s.startTime, s.endTime, grace);
      } else {
        const m1 = this.calculateShiftOverlap(inDate, outDate, s.startTime, s.endTime, grace);
        let m2 = 0;
        if (s.startTime2 && s.endTime2) {
          m2 = this.calculateShiftOverlap(inDate, outDate, s.startTime2, s.endTime2, grace);
        }
        totalMinutes = m1 + m2;
      }
      return totalMinutes / 60.0;
    }

    return (outDate.getTime() - inDate.getTime()) / 3600000.0;
  }

  findClosestShift(shifts: any[], checkInTimeStr: string): any {
    let closest: any = null;
    let minDiff = Number.MAX_SAFE_INTEGER;
    const inMinutes = this.parseTimeToMinutes(checkInTimeStr);

    for (const s of shifts) {
      const startMin1 = this.parseTimeToMinutes(s.startTime);
      const diff1 = Math.abs(inMinutes - startMin1);

      if (diff1 < minDiff && diff1 <= 120) {
        minDiff = diff1;
        closest = s;
      }

      if (s.isSplitShift && s.startTime2) {
        const startMin2 = this.parseTimeToMinutes(s.startTime2);
        const diff2 = Math.abs(inMinutes - startMin2);
        if (diff2 < minDiff && diff2 <= 120) {
          minDiff = diff2;
          closest = s;
        }
      }
    }
    return closest;
  }

  // ==========================================
  // TÍNH TOÁN LẠI DỮ LIỆU BẢNG CÔNG (RECALCULATE)
  // ==========================================
  recalculateAttendanceData(att: any) {
    if (!att.checkInTime) return;
    const inDate = new Date(att.checkInTime);
    const inTimeStr = inDate.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' });

    if (att.shift) {
      const bestMatchShift = att.shift;
      const prefix = bestMatchShift.isSplitShift ? '[CA GÃY] ' : '';
      let lateMinutes = 0;

      const inMin = this.parseTimeToMinutes(inTimeStr);
      const startMin1 = this.parseTimeToMinutes(bestMatchShift.startTime);

      if (bestMatchShift.isSplitShift && bestMatchShift.startTime2) {
        const startMin2 = this.parseTimeToMinutes(bestMatchShift.startTime2);
        const diff1 = Math.abs(inMin - startMin1);
        const diff2 = Math.abs(inMin - startMin2);
        lateMinutes = diff1 <= diff2 ? inMin - startMin1 : inMin - startMin2;
      } else {
        lateMinutes = inMin - startMin1;
      }

      lateMinutes -= 3; // Bù trừ 3 phút

      let notes = '';
      let status = 'ON_TIME';
      if (lateMinutes > (bestMatchShift.gracePeriodMins || 5)) {
        status = 'LATE';
        notes = `${prefix}Đi trễ ${lateMinutes} phút`;
      } else {
        status = 'ON_TIME';
        notes = `${prefix}Vào ca đúng giờ`;
      }

      if (att.checkOutTime) {
        const outDate = new Date(att.checkOutTime);
        const outTimeStr = outDate.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' });
        const outMin = this.parseTimeToMinutes(outTimeStr);

        let expectedEndStr = bestMatchShift.endTime;
        if (bestMatchShift.isSplitShift && bestMatchShift.endTime2) {
          const endMin1 = this.parseTimeToMinutes(bestMatchShift.endTime);
          const endMin2 = this.parseTimeToMinutes(bestMatchShift.endTime2);
          const d1 = Math.abs(outMin - endMin1);
          const d2 = Math.abs(outMin - endMin2);
          expectedEndStr = d1 <= d2 ? bestMatchShift.endTime : bestMatchShift.endTime2;
        }

        const expectedEndMin = this.parseTimeToMinutes(expectedEndStr);
        const earlyMinutes = expectedEndMin - outMin - 3;

        if (earlyMinutes > 0) {
          notes += ` | Về sớm ${earlyMinutes} phút`;
          status = status === 'LATE' ? 'LATE_AND_EARLY_LEAVE' : 'EARLY_LEAVE';
        }

        const effectiveHrs = this.calculateEffectiveHours(att);
        att.totalWorkHours = Math.round(effectiveHrs * 100) / 100;
      }

      att.status = status;
      att.notes = notes;
    } else {
      att.status = 'FLEXIBLE';
      att.notes = 'Làm ca tự do';
      if (att.checkOutTime) {
        const inDate = new Date(att.checkInTime);
        const outDate = new Date(att.checkOutTime);
        const hours = (outDate.getTime() - inDate.getTime()) / 3600000;
        att.totalWorkHours = Math.round(hours * 100) / 100;
      }
    }
  }

  // ==========================================
  // ĐỒNG BỘ CA LÀM VÀ BẢNG CÔNG TRONG NGÀY
  // ==========================================
  async syncAttendancesWithShifts(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const attendances = await this.prisma.attendance.findMany({
      where: {
        workDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        user: {
          include: {
            roleAssignments: {
              include: { role: true },
            },
          },
        },
        shift: true,
      },
    });

    for (const att of attendances) {
      const emp = att.user;
      if (!emp) continue;

      const userRole = emp.roleAssignments?.[0]?.role?.name || emp.role;
      const isFlexibleRole =
        typeof userRole === 'string' &&
        (userRole.toUpperCase().includes('KITCHEN') || userRole.toUpperCase().includes('BẾP') || userRole === 'CHEF');

      if (isFlexibleRole) continue;

      const availableShifts = await this.prisma.shift.findMany({
        where: {
          shiftDate: startOfDay,
          ...(emp.roleAssignments?.[0]?.roleId ? { roleId: emp.roleAssignments[0].roleId } : {}),
        },
        include: { assignedUsers: true },
      });

      const assignedShifts = availableShifts.filter(
        (s) => s.assignedUsers && s.assignedUsers.some((u) => u.id === emp.id),
      );

      const checkInTimeStr = att.checkInTime
        ? new Date(att.checkInTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' })
        : '08:00';

      let bestMatchShift: any = null;
      if (assignedShifts.length > 0) {
        bestMatchShift = this.findClosestShift(assignedShifts, checkInTimeStr);
      }
      if (!bestMatchShift) {
        const generalShifts = availableShifts.filter((s) => !s.assignedUsers || s.assignedUsers.length === 0);
        bestMatchShift = this.findClosestShift(generalShifts, checkInTimeStr);
      }

      att.shift = bestMatchShift;
      att.shiftId = bestMatchShift ? bestMatchShift.id : null;
      this.recalculateAttendanceData(att);

      await this.prisma.attendance.update({
        where: { id: att.id },
        data: {
          shiftId: att.shiftId,
          status: att.status,
          notes: att.notes,
          totalWorkHours: att.totalWorkHours,
        },
      });
    }
  }

  // ==========================================
  // XỬ LÝ CHẤM CÔNG QUÉT QR TỪ NHÂN VIÊN
  // ==========================================
  async processQRScan(userId: string, request: AttendanceScanDto) {
    const employee = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleAssignments: { include: { role: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException('Không tìm thấy tài khoản nhân viên.');
    }

    const effectiveQrData = request.qrCodeData || request.qrData;
    if (!effectiveQrData) {
      throw new BadRequestException('Dữ liệu mã QR không được để trống.');
    }

    const logData: any = {
      userId: employee.id,
      scanTime: new Date(),
      scanType: request.scanType || 'AUTO',
      clientLatitude: request.latitude ?? 0,
      clientLongitude: request.longitude ?? 0,
      clientAccuracy: request.accuracy ?? request.gpsAccuracy ?? 0,
      deviceId: request.deviceId || 'UNKNOWN_DEVICE',
      rawQrData: effectiveQrData,
      isSuccess: false,
    };

    try {
      // 1. Kiểm tra / Đăng ký thiết bị
      let isNewDeviceRegistration = false;
      if (!employee.registeredDeviceId) {
        await this.prisma.user.update({
          where: { id: employee.id },
          data: { registeredDeviceId: request.deviceId },
        });
        isNewDeviceRegistration = true;
      } else if (request.deviceId && employee.registeredDeviceId !== request.deviceId) {
        logData.errorCode = 'DEVICE_MISMATCH';
        throw new BadRequestException(
          'THIẾT BỊ KHÔNG HỢP LỆ! Tài khoản của bạn đã được liên kết với một thiết bị khác. Vui lòng liên hệ Quản lý chi nhánh để mở khóa đổi máy.',
        );
      }

      // 2. Xác minh QR
      const { branchId: branchIdFromQr } = await this.qrService.verifyAndExtractBranch(effectiveQrData);
      const branchId = request.branchId || branchIdFromQr;

      const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        throw new BadRequestException('Chi nhánh không tồn tại.');
      }
      logData.branchId = branch.id;

      // 3. Kiểm tra vị trí GPS
      const clientLat = request.latitude ?? 0;
      const clientLng = request.longitude ?? 0;
      const clientAcc = request.accuracy ?? request.gpsAccuracy ?? 0;

      if (branch.latitude && branch.longitude) {
        if (!clientLat || !clientLng) {
          throw new BadRequestException('Vui lòng bật quyền truy cập vị trí (GPS) trên thiết bị để chấm công!');
        }

        const distance = this.calculateDistance(
          branch.latitude,
          branch.longitude,
          clientLat,
          clientLng,
        );
        logData.distanceCalculated = distance;

        const configuredRadius = branch.allowedRadiusMeters > 0 ? branch.allowedRadiusMeters : 500;
        const allowedRadius = Math.min(configuredRadius, 400.0);

        if (clientAcc > 300) {
          throw new BadRequestException('Tín hiệu GPS quá yếu. Hãy ra ngoài trời hoặc bật cho phép vị trí chính xác.');
        }

        if (distance > allowedRadius) {
          if (distance <= allowedRadius + clientAcc) {
            logData.errorCode = 'WARNING_HIGH_ACCURACY_ERROR';
          } else {
            throw new BadRequestException(
              `Bạn đang ở cách quán ${distance.toFixed(1)}m (Vượt quá ${Math.round(allowedRadius)}m). Không thể chấm công!`,
            );
          }
        }
      }

      // 4. Xác định AUTO Check-in / Check-out
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endToday = new Date(today);
      endToday.setHours(23, 59, 59, 999);

      const latestAtt = await this.prisma.attendance.findFirst({
        where: {
          userId: employee.id,
          workDate: { gte: today, lte: endToday },
        },
        orderBy: { checkInTime: 'desc' },
        include: { shift: true },
      });

      let effectiveScanType = request.scanType || 'AUTO';
      if (effectiveScanType === 'AUTO') {
        const isCurrentlyWorking = latestAtt && latestAtt.checkInTime && !latestAtt.checkOutTime;
        effectiveScanType = isCurrentlyWorking ? 'CHECK_OUT' : 'CHECK_IN';
      }
      logData.scanType = effectiveScanType;

      // 5. Kiểm tra trạng thái Check-in/Check-out
      if (latestAtt) {
        const isCurrentlyWorking = latestAtt.checkInTime && !latestAtt.checkOutTime;
        if (effectiveScanType === 'CHECK_IN' && isCurrentlyWorking) {
          throw new BadRequestException('Bạn đang TRONG CA làm. Vui lòng Check-out ca hiện tại trước khi bắt đầu ca mới!');
        }
        if (effectiveScanType === 'CHECK_OUT' && !isCurrentlyWorking) {
          throw new BadRequestException('Bạn chưa Check-in hoặc đã kết thúc ca trước đó rồi. Không thể Check-out!');
        }
      } else {
        if (effectiveScanType === 'CHECK_OUT') {
          throw new BadRequestException('Bạn chưa có lịch sử Check-in trong ngày hôm nay. Không thể Check-out!');
        }
      }

      // 6. Thực hiện lưu Chấm công
      const now = new Date();
      const nowTimeStr = now.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' });
      let savedAtt: any = null;

      const userRole = employee.roleAssignments?.[0]?.role?.name || employee.role;
      const isFlexibleRole =
        typeof userRole === 'string' &&
        (userRole.toUpperCase().includes('KITCHEN') || userRole.toUpperCase().includes('BẾP') || userRole === 'CHEF');

      if (effectiveScanType === 'CHECK_IN') {
        let bestMatchShift: any = null;

        if (!isFlexibleRole) {
          const availableShifts = await this.prisma.shift.findMany({
            where: {
              shiftDate: today,
              ...(employee.roleAssignments?.[0]?.roleId ? { roleId: employee.roleAssignments[0].roleId } : {}),
            },
            include: { assignedUsers: true },
          });

          const assignedShifts = availableShifts.filter(
            (s) => s.assignedUsers && s.assignedUsers.some((u) => u.id === employee.id),
          );

          if (assignedShifts.length > 0) {
            bestMatchShift = this.findClosestShift(assignedShifts, nowTimeStr);
          }
          if (!bestMatchShift) {
            const generalShifts = availableShifts.filter((s) => !s.assignedUsers || s.assignedUsers.length === 0);
            bestMatchShift = this.findClosestShift(generalShifts, nowTimeStr);
          }
        }

        const newAttData: any = {
          userId: employee.id,
          branchId: branch.id,
          workDate: today,
          checkInTime: now,
          shiftId: bestMatchShift ? bestMatchShift.id : null,
        };

        if (isFlexibleRole) {
          newAttData.status = 'FLEXIBLE';
          newAttData.notes = 'Làm ca tự do';
        } else if (bestMatchShift) {
          const prefix = bestMatchShift.isSplitShift ? '[CA GÃY] ' : '';
          const inMin = this.parseTimeToMinutes(nowTimeStr);
          const startMin1 = this.parseTimeToMinutes(bestMatchShift.startTime);
          let lateMinutes = 0;

          if (bestMatchShift.isSplitShift && bestMatchShift.startTime2) {
            const startMin2 = this.parseTimeToMinutes(bestMatchShift.startTime2);
            const diff1 = Math.abs(inMin - startMin1);
            const diff2 = Math.abs(inMin - startMin2);
            lateMinutes = diff1 <= diff2 ? inMin - startMin1 : inMin - startMin2;
          } else {
            lateMinutes = inMin - startMin1;
          }

          lateMinutes -= 3;
          if (lateMinutes > (bestMatchShift.gracePeriodMins || 5)) {
            newAttData.status = 'LATE';
            newAttData.notes = `${prefix}Đi trễ ${lateMinutes} phút`;
          } else {
            newAttData.status = 'ON_TIME';
            newAttData.notes = `${prefix}Vào ca đúng giờ`;
          }
        } else {
          newAttData.status = 'FLEXIBLE';
          newAttData.notes = '';
        }

        savedAtt = await this.prisma.attendance.create({
          data: newAttData,
          include: { shift: true },
        });

        logData.shiftName = bestMatchShift ? bestMatchShift.name : 'Ca tự do';
      } else {
        // CHECK_OUT
        if (latestAtt && !latestAtt.checkOutTime) {
          latestAtt.checkOutTime = now;
          this.recalculateAttendanceData(latestAtt);

          savedAtt = await this.prisma.attendance.update({
            where: { id: latestAtt.id },
            data: {
              checkOutTime: now,
              status: latestAtt.status,
              notes: latestAtt.notes,
              totalWorkHours: latestAtt.totalWorkHours,
            },
            include: { shift: true },
          });

          logData.shiftName = latestAtt.shift ? latestAtt.shift.name : 'Ca tự do';
        }
      }

      // 7. Hoàn tất & Ghi log thành công
      logData.isSuccess = true;
      logData.errorCode = logData.errorCode || 'SUCCESS';
      await this.prisma.attendanceLog.create({ data: logData });

      // Gửi thông báo đến quản trị viên
      try {
        const actionText = effectiveScanType === 'CHECK_IN' ? 'vào ca (Check-in)' : 'tan ca (Check-out)';
        const timeFormatted = now.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' });
        await this.notificationService.createNotification({
          userId: employee.id,
          title: 'Thông báo chấm công',
          content: `Nhân viên ${employee.fullName} vừa ${actionText} lúc ${timeFormatted}.`,
          type: 'SYSTEM',
          branchId: branch.id,
          category: 'ATTENDANCE',
        });
      } catch (e) {
        this.logger.warn('Could not broadcast attendance notification:', e);
      }

      return {
        status: isNewDeviceRegistration ? 'SUCCESS_REGISTERED' : 'SUCCESS',
        action: effectiveScanType,
        time: nowTimeStr,
        workDate: today.toISOString().split('T')[0],
        shiftName: logData.shiftName,
        message: isNewDeviceRegistration
          ? 'Chấm công thành công! THIẾT BỊ NÀY ĐÃ ĐƯỢC ĐĂNG KÝ. Từ nay bạn chỉ được phép dùng điện thoại này để chấm công.'
          : 'Chấm công thành công!',
      };
    } catch (err: any) {
      logData.isSuccess = false;
      logData.errorCode = err?.message || 'UNKNOWN_ERROR';
      await this.prisma.attendanceLog.create({ data: logData });
      throw err;
    }
  }

  // ==========================================
  // API LẤY TRẠNG THÁI HIỆN TẠI (VÀO CA / RA CA)
  // ==========================================
  async getEmployeeAttendanceStatus(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endToday = new Date(today);
    endToday.setHours(23, 59, 59, 999);

    const latest = await this.prisma.attendance.findFirst({
      where: {
        userId,
        workDate: { gte: today, lte: endToday },
      },
      orderBy: { checkInTime: 'desc' },
      include: { shift: true },
    });

    const isWorking = latest && latest.checkInTime && !latest.checkOutTime;
    const nextAction = isWorking ? 'RA CA (Check-out)' : 'VÀO CA (Check-in)';

    return {
      isWorking: !!isWorking,
      nextAction,
      currentShift: latest?.shift?.name || (isWorking ? 'Ca tự do' : null),
      checkInTime: latest?.checkInTime
        ? new Date(latest.checkInTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' })
        : null,
    };
  }

  // ==========================================
  // LỊCH SỬ CHẤM CÔNG CỦA NHÂN VIÊN (WAITER)
  // ==========================================
  async getMyAttendanceHistory(userId: string, startDateStr?: string, endDateStr?: string) {
    const where: any = { userId };
    if (startDateStr && endDateStr) {
      const s = new Date(startDateStr);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDateStr);
      e.setHours(23, 59, 59, 999);
      where.workDate = { gte: s, lte: e };
    }

    const attendances = await this.prisma.attendance.findMany({
      where,
      orderBy: [{ workDate: 'desc' }, { checkInTime: 'desc' }],
      include: { shift: true },
    });

    return attendances.map((a) => {
      const d = new Date(a.workDate);
      const dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      return {
        id: a.id,
        date: dateFormatted,
        shiftName: a.shift?.name || 'Ca tự do',
        checkIn: a.checkInTime
          ? new Date(a.checkInTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' })
          : '--:--',
        checkOut: a.checkOutTime
          ? new Date(a.checkOutTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' })
          : 'Đang làm',
        hours: a.totalWorkHours || 0,
        status: a.status || 'UNKNOWN',
        notes: a.notes || '',
      };
    });
  }

  // ==========================================
  // DANH SÁCH CHẤM CÔNG HÔM NAY TẠI CHI NHÁNH (MÀN HÌNH QR)
  // ==========================================
  async getBranchTodayAttendance(branchId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endToday = new Date(today);
    endToday.setHours(23, 59, 59, 999);

    const attendances = await this.prisma.attendance.findMany({
      where: {
        branchId,
        workDate: { gte: today, lte: endToday },
      },
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return attendances.map((a) => {
      const isCheckOut = !!a.checkOutTime;
      const targetTime = isCheckOut ? a.checkOutTime : a.checkInTime;
      const timeStr = targetTime
        ? new Date(targetTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';
      return {
        id: a.id,
        employeeName: a.user?.fullName || 'Không xác định',
        action: isCheckOut ? 'CHECK-OUT' : 'CHECK-IN',
        time: timeStr,
      };
    });
  }

  // ==========================================
  // XỬ LÝ CHỈNH SỬA TAY BẢNG CÔNG (ADMIN)
  // ==========================================
  async processManualAction(dto: ManualActionDto) {
    const att = await this.prisma.attendance.findUnique({
      where: { id: dto.attendanceId },
      include: { user: true, branch: true, shift: true },
    });

    if (!att) {
      throw new NotFoundException('Không tìm thấy dữ liệu chấm công!');
    }

    const workDate = new Date(att.workDate);
    const dateStr = `${String(workDate.getDate()).padStart(2, '0')}/${String(workDate.getMonth() + 1).padStart(2, '0')}/${workDate.getFullYear()}`;

    let sName = att.shift ? att.shift.name : 'Ca tự do';
    if (dto.actionType === 'UPDATE' && dto.shiftId) {
      const newShift = await this.prisma.shift.findUnique({ where: { id: dto.shiftId } });
      if (newShift) sName = newShift.name;
    }

    const manualLogData: any = {
      userId: att.userId,
      branchId: att.branchId,
      scanTime: new Date(),
      deviceId: 'ADMIN_DASHBOARD',
      distanceCalculated: 0.0,
      clientAccuracy: 0.0,
      isSuccess: true,
      errorCode: `MANUAL_${dto.actionType}`,
      shiftName: `${sName} (Ngày: ${dateStr})`,
    };

    if (dto.actionType === 'DELETE') {
      manualLogData.scanType = 'DELETE_RECORD';
      manualLogData.rawQrData = `Xóa do: ${dto.reason}`;

      await this.prisma.$transaction([
        this.prisma.attendance.delete({ where: { id: att.id } }),
        this.prisma.attendanceLog.create({ data: manualLogData }),
      ]);

      return { message: 'Đã xóa bản ghi công và lưu log thành công!' };
    } else if (dto.actionType === 'UPDATE') {
      const updateData: any = {};

      if (dto.checkIn) {
        const [h, m] = dto.checkIn.split(':').map(Number);
        const inDate = new Date(workDate);
        inDate.setHours(h, m, 0, 0);
        updateData.checkInTime = inDate;
      }
      if (dto.checkOut) {
        const [h, m] = dto.checkOut.split(':').map(Number);
        const outDate = new Date(workDate);
        outDate.setHours(h, m, 0, 0);
        updateData.checkOutTime = outDate;
      }

      if (dto.shiftId) {
        updateData.shiftId = dto.shiftId === '-1' ? null : dto.shiftId;
      }

      const tempAtt = {
        ...att,
        ...updateData,
        shift: updateData.shiftId
          ? await this.prisma.shift.findUnique({ where: { id: updateData.shiftId } })
          : updateData.shiftId === null
            ? null
            : att.shift,
      };

      this.recalculateAttendanceData(tempAtt);

      const existingNotes = att.notes ? att.notes.replace('[Admin Sửa]', '').trim() : '';
      const cleanExisting = existingNotes ? ` | Cũ: ${existingNotes}` : '';
      updateData.notes = `[Admin Sửa] Lý do: ${dto.reason}${cleanExisting}`;
      updateData.status = tempAtt.status;
      updateData.totalWorkHours = tempAtt.totalWorkHours;

      manualLogData.scanType = 'UPDATE_RECORD';
      manualLogData.rawQrData = `Cập nhật giờ/ca. Lý do: ${dto.reason}`;

      await this.prisma.$transaction([
        this.prisma.attendance.update({
          where: { id: att.id },
          data: updateData,
        }),
        this.prisma.attendanceLog.create({ data: manualLogData }),
      ]);

      return { message: 'Cập nhật giờ công và ghi log thành công!' };
    }
  }

  // ==========================================
  // THÊM CÔNG THỦ CÔNG (ADMIN — HỖ TRỢ CA GÃY)
  // ==========================================
  async addManualAttendance(dto: ManualAddDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên.');

    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh.');

    const workDate = new Date(dto.workDate);
    workDate.setHours(0, 0, 0, 0);

    const shift = dto.shiftId ? await this.prisma.shift.findUnique({ where: { id: dto.shiftId } }) : null;

    // Khung 1
    const att1: any = {
      userId: user.id,
      branchId: branch.id,
      workDate,
      shiftId: shift ? shift.id : null,
      notes: `[Admin Tạo Thủ Công] Lý do: ${dto.reason}`,
    };

    if (dto.checkIn) {
      const [h, m] = dto.checkIn.split(':').map(Number);
      const d = new Date(workDate);
      d.setHours(h, m, 0, 0);
      att1.checkInTime = d;
    }
    if (dto.checkOut) {
      const [h, m] = dto.checkOut.split(':').map(Number);
      const d = new Date(workDate);
      d.setHours(h, m, 0, 0);
      att1.checkOutTime = d;
    }
    this.recalculateAttendanceData({ ...att1, shift });
    await this.prisma.attendance.create({ data: att1 });

    // Khung 2 (nếu là ca gãy)
    if (dto.isSplit && dto.checkIn2 && dto.checkOut2) {
      const att2: any = {
        userId: user.id,
        branchId: branch.id,
        workDate,
        shiftId: shift ? shift.id : null,
        notes: `[Admin Tạo Thủ Công] [Khung giờ 2] Lý do: ${dto.reason}`,
      };

      const [h1, m1] = dto.checkIn2.split(':').map(Number);
      const d1 = new Date(workDate);
      d1.setHours(h1, m1, 0, 0);
      att2.checkInTime = d1;

      const [h2, m2] = dto.checkOut2.split(':').map(Number);
      const d2 = new Date(workDate);
      d2.setHours(h2, m2, 0, 0);
      att2.checkOutTime = d2;

      this.recalculateAttendanceData({ ...att2, shift });
      await this.prisma.attendance.create({ data: att2 });
    }

    const dateStr = `${String(workDate.getDate()).padStart(2, '0')}/${String(workDate.getMonth() + 1).padStart(2, '0')}/${workDate.getFullYear()}`;
    const sName = shift ? shift.name : 'Ca tự do';
    await this.prisma.attendanceLog.create({
      data: {
        userId: user.id,
        branchId: branch.id,
        scanTime: new Date(),
        deviceId: 'ADMIN_DASHBOARD',
        distanceCalculated: 0.0,
        clientAccuracy: 0.0,
        isSuccess: true,
        errorCode: 'SUCCESS',
        scanType: 'MANUAL_ADD',
        rawQrData: dto.reason,
        shiftName: `${sName} (Ngày: ${dateStr})`,
      },
    });

    return { message: 'Đã thêm thủ công và ghi vào nhật ký hệ thống thành công!' };
  }

  // ==========================================
  // RESET THIẾT BỊ ĐÃ ĐĂNG KÝ
  // ==========================================
  async resetEmployeeDevice(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { registeredDeviceId: null },
    });

    return { message: 'Đã xóa liên kết thiết bị. Nhân viên có thể dùng điện thoại mới để chấm công lần tới.' };
  }

  // ==========================================
  // DỮ LIỆU TỔNG HỢP CHO DASHBOARD ADMIN (5 TABS)
  // ==========================================
  async getAdminDashboardData(startDateStr?: string, endDateStr?: string, branchId?: string, roleId?: string) {
    let startDate: Date;
    let endDate: Date;

    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Thứ 2
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }

    const whereAtt: any = {
      workDate: { gte: startDate, lte: endDate },
    };
    if (branchId) whereAtt.branchId = branchId;

    const attendances = await this.prisma.attendance.findMany({
      where: whereAtt,
      include: {
        user: {
          include: {
            roleAssignments: { include: { role: true } },
          },
        },
        branch: true,
        shift: true,
      },
      orderBy: [{ workDate: 'desc' }, { checkInTime: 'desc' }],
    });

    const shifts = await this.prisma.shift.findMany({
      where: {
        shiftDate: { gte: startDate, lte: endDate },
        ...(branchId ? { branchId } : {}),
        ...(roleId ? { roleId } : {}),
      },
      include: {
        role: true,
        branch: true,
        assignedUsers: true,
      },
      orderBy: [{ shiftDate: 'asc' }, { startTime: 'asc' }],
    });

    const logs = await this.prisma.attendanceLog.findMany({
      where: {
        scanTime: { gte: startDate, lte: endDate },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        user: true,
        branch: true,
      },
      orderBy: { scanTime: 'desc' },
      take: 200,
    });

    const branches = await this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });

    const roles = await this.prisma.accessRole.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const users = await this.prisma.user.findMany({
      where: {
        role: { notIn: ['USER'] },
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        registeredDeviceId: true,
        roleAssignments: {
          include: { role: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      attendances,
      shifts,
      logs,
      branches,
      roles,
      users,
    };
  }

  // ==========================================
  // LƯU / SỬA CA LÀM VIỆC (SHIFT)
  // ==========================================
  async saveShift(dto: ShiftSaveDto) {
    const shiftDate = new Date(dto.shiftDate);
    shiftDate.setHours(0, 0, 0, 0);

    const shiftData: any = {
      shiftDate,
      name: dto.name,
      startTime: dto.startTime,
      endTime: dto.endTime,
      gracePeriodMins: dto.gracePeriodMins ?? 5,
      branchId: dto.branchId || null,
      roleId: dto.roleId || null,
      isSplitShift: dto.isSplitShift ?? false,
      startTime2: dto.startTime2 || null,
      endTime2: dto.endTime2 || null,
    };

    if (dto.assignedUserIds && Array.isArray(dto.assignedUserIds)) {
      shiftData.assignedUsers = {
        set: dto.assignedUserIds.map((id) => ({ id })),
      };
    }

    let saved: any;
    if (dto.id) {
      saved = await this.prisma.shift.update({
        where: { id: dto.id },
        data: shiftData,
      });
    } else {
      saved = await this.prisma.shift.create({
        data: shiftData,
      });
    }

    // Tự động đồng bộ lại toàn bộ bảng công của ngày đó
    await this.syncAttendancesWithShifts(shiftDate);

    return saved;
  }

  async deleteShift(id: string) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Không tìm thấy ca làm việc.');

    const shiftDate = new Date(shift.shiftDate);

    await this.prisma.shift.delete({ where: { id } });
    await this.syncAttendancesWithShifts(shiftDate);

    return { message: 'Đã xóa ca làm việc thành công!' };
  }

  async bulkDeleteShifts(ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 ca để xóa.');
    }

    const shifts = await this.prisma.shift.findMany({
      where: { id: { in: ids } },
    });

    const dates = Array.from(new Set(shifts.map((s) => s.shiftDate.toISOString())));

    await this.prisma.shift.deleteMany({
      where: { id: { in: ids } },
    });

    for (const dStr of dates) {
      await this.syncAttendancesWithShifts(new Date(dStr));
    }

    return { message: `Đã xóa thành công ${ids.length} ca làm việc!` };
  }
}

