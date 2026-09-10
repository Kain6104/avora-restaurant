import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DayOfWeek, SlotOrderType, SlotStatus } from '@prisma/client';

export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function doTimesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && eA > sB;
}

export function getDayOfWeekFromDate(dateInput: Date | string): DayOfWeek {
  let dayIndex: number;
  if (typeof dateInput === 'string') {
    const [y, m, d] = dateInput.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    dayIndex = dateObj.getDay();
  } else {
    const vnWeekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
    }).format(dateInput);
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    dayIndex = weekdayMap[vnWeekday] ?? dateInput.getDay();
  }
  const mapping: Record<number, DayOfWeek> = {
    0: DayOfWeek.SUNDAY,
    1: DayOfWeek.MONDAY,
    2: DayOfWeek.TUESDAY,
    3: DayOfWeek.WEDNESDAY,
    4: DayOfWeek.THURSDAY,
    5: DayOfWeek.FRIDAY,
    6: DayOfWeek.SATURDAY,
  };
  return mapping[dayIndex];
}

@Injectable()
export class OperatingSlotService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lấy danh sách khung giờ hoạt động cho Admin (có phân trang / lọc chi nhánh)
   */
  async findAll(params: {
    branchId?: string;
    dayOfWeek?: DayOfWeek;
    orderType?: SlotOrderType;
    isActive?: boolean;
    branchIdScope?: string;
  }) {
    const where: any = {};
    const effectiveBranch = params.branchIdScope || params.branchId;
    if (effectiveBranch) where.branchId = effectiveBranch;
    if (params.dayOfWeek) where.dayOfWeek = params.dayOfWeek;
    if (params.orderType) where.orderType = params.orderType;
    if (typeof params.isActive === 'boolean') where.isActive = params.isActive;

    const data = await this.prisma.operatingSlot.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
      },
      orderBy: [{ branchId: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return data;
  }

  /**
   * Lấy khung giờ theo ngày cụ thể cho trang Checkout (tự động tính công suất & lead time)
   */
  async getSlotsForDate(params: {
    branchId: string;
    dateStr: string; // YYYY-MM-DD
    orderType?: SlotOrderType;
  }) {
    const { branchId, dateStr, orderType = SlotOrderType.DELIVERY } = params;

    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ (định dạng chuẩn YYYY-MM-DD)');
    }

    const dayOfWeek = getDayOfWeekFromDate(dateStr);

    // Lấy các template slot đang hoạt động
    const templateSlots = await this.prisma.operatingSlot.findMany({
      where: {
        branchId,
        dayOfWeek,
        orderType,
        isActive: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Lấy thông tin tracking đơn của ngày đó
    const dailyTrackings = await this.prisma.dailySlotTracking.findMany({
      where: {
        slotId: { in: templateSlots.map((s) => s.id) },
        date: targetDate,
      },
    });
    const trackingMap = new Map<string, number>();
    dailyTrackings.forEach((t) => trackingMap.set(t.slotId, t.currentOrders));

    // Lấy số lượng giữ chỗ tạm thời còn hiệu lực
    const now = new Date();
    const activeLocks = await this.prisma.slotLock.findMany({
      where: {
        slotId: { in: templateSlots.map((s) => s.id) },
        date: targetDate,
        expiresAt: { gt: now },
      },
    });
    const lockCountMap = new Map<string, number>();
    activeLocks.forEach((l) => {
      lockCountMap.set(l.slotId, (lockCountMap.get(l.slotId) || 0) + 1);
    });

    // Tính toán thời gian hiện tại (theo giờ VN GMT+7)
    const vnFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = vnFormatter.formatToParts(now);
    const vnYear = parts.find((p) => p.type === 'year')?.value;
    const vnMonth = parts.find((p) => p.type === 'month')?.value;
    const vnDay = parts.find((p) => p.type === 'day')?.value;
    const vnHour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
    const vnMinute = Number(parts.find((p) => p.type === 'minute')?.value || 0);

    const todayStr = `${vnYear}-${vnMonth}-${vnDay}`;
    const currentMinutesVn = vnHour * 60 + vnMinute;

    const isToday = dateStr === todayStr;
    const isPastDay = dateStr < todayStr;

    return templateSlots.map((slot) => {
      const dbOrders = trackingMap.get(slot.id) || 0;
      const locks = lockCountMap.get(slot.id) || 0;
      const effectiveOrders = dbOrders + locks;

      const isCapacityFull = slot.maxOrders > 0 && effectiveOrders >= slot.maxOrders;
      const remainingOrders = slot.maxOrders > 0 ? Math.max(0, slot.maxOrders - effectiveOrders) : 999;

      // Kiểm tra Lead Time: nếu đặt cho hôm nay, giờ bắt đầu phải >= giờ hiện tại + leadTimeMinutes
      let isLeadTimeRestricted = false;
      if (isPastDay) {
        isLeadTimeRestricted = true;
      } else if (isToday) {
        const slotStartMin = timeToMinutes(slot.startTime);
        if (slotStartMin < currentMinutesVn + slot.leadTimeMinutes) {
          isLeadTimeRestricted = true;
        }
      }

      const calculatedStatus = isCapacityFull ? SlotStatus.FULL : SlotStatus.OPEN;

      return {
        ...slot,
        effectiveCurrentOrders: effectiveOrders,
        remainingOrders,
        calculatedStatus,
        isCapacityFull,
        isLeadTimeRestricted,
        isAvailable: !isCapacityFull && !isLeadTimeRestricted && slot.isActive,
      };
    });
  }

  /**
   * Tạo khóa giữ chỗ tạm tính trong 10 phút tại Checkout
   */
  async lockSlot(params: { slotId: string; dateStr: string; sessionId: string }) {
    const { slotId, dateStr, sessionId } = params;
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

    const slot = await this.prisma.operatingSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot || !slot.isActive) {
      throw new BadRequestException('Khung giờ không tồn tại hoặc đã bị vô hiệu hóa.');
    }

    // Xóa lock cũ của cùng session trên slot/ngày này nếu có
    await this.prisma.slotLock.deleteMany({
      where: {
        slotId,
        date: targetDate,
        sessionId,
      },
    });

    // Dọn dẹp lock hết hạn
    await this.prisma.slotLock.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });

    // Đếm tổng số đơn đã đặt + lock còn hạn
    const tracking = await this.prisma.dailySlotTracking.findUnique({
      where: { slotId_date: { slotId, date: targetDate } },
    });
    const currentOrders = tracking?.currentOrders || 0;

    const activeLocks = await this.prisma.slotLock.count({
      where: {
        slotId,
        date: targetDate,
        expiresAt: { gt: new Date() },
      },
    });

    if (slot.maxOrders > 0 && currentOrders + activeLocks >= slot.maxOrders) {
      throw new BadRequestException('Khung giờ này đã kín chỗ, vui lòng chọn khung giờ khác.');
    }

    // Tạo lock 10 phút
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const lock = await this.prisma.slotLock.create({
      data: {
        slotId,
        date: targetDate,
        sessionId,
        expiresAt,
      },
    });

    return {
      success: true,
      message: 'Đã giữ chỗ khung giờ trong 10 phút',
      lockId: lock.id,
      expiresAt,
    };
  }

  /**
   * Lưu hàng loạt cấu hình khung giờ chi tiết (Hỗ trợ Sinh tự động nhanh & Thêm thủ công & Áp dụng Tất cả chi nhánh)
   */
  async bulkSave(params: {
    branchId?: string;
    branchIds?: string[];
    dayOfWeek?: DayOfWeek;
    daysOfWeek?: DayOfWeek[];
    orderType: SlotOrderType;
    leadTimeMinutes: number;
    slots: Array<{
      startTime: string;
      endTime: string;
      maxOrders: number;
      isActive?: boolean;
    }>;
  }) {
    const { branchId, branchIds, dayOfWeek, daysOfWeek, orderType, leadTimeMinutes, slots } = params;

    if (!slots || slots.length === 0) {
      throw new BadRequestException('Danh sách mốc giờ không được để trống.');
    }

    // 1. Xác định danh sách chi nhánh áp dụng
    let targetBranchIds: string[] = [];
    if (branchId === 'ALL' || (branchIds && branchIds.includes('ALL'))) {
      const allBranches = await this.prisma.branch.findMany({ select: { id: true } });
      targetBranchIds = allBranches.map((b) => b.id);
    } else if (branchIds && branchIds.length > 0) {
      targetBranchIds = branchIds;
    } else if (branchId) {
      targetBranchIds = [branchId];
    } else {
      const allBranches = await this.prisma.branch.findMany({ select: { id: true } });
      targetBranchIds = allBranches.map((b) => b.id);
    }

    if (targetBranchIds.length === 0) {
      throw new BadRequestException('Không tìm thấy chi nhánh nào để áp dụng cấu hình.');
    }

    // 2. Validate từng mốc giờ
    for (const slot of slots) {
      if (!slot.startTime || !slot.endTime) {
        throw new BadRequestException('Giờ bắt đầu và giờ kết thúc không được để trống.');
      }
      if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
        throw new BadRequestException(
          `Mốc giờ (${slot.startTime} - ${slot.endTime}) không hợp lệ: Giờ bắt đầu phải nhỏ hơn giờ kết thúc.`,
        );
      }
    }

    // 3. Validate chống trùng lặp giữa các mốc trong danh sách gửi lên
    const sorted = [...slots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    for (let i = 0; i < sorted.length - 1; i++) {
      if (timeToMinutes(sorted[i].endTime) > timeToMinutes(sorted[i + 1].startTime)) {
        throw new BadRequestException(
          `Mốc giờ (${sorted[i].startTime} - ${sorted[i].endTime}) bị giao cắt/chồng lấn với mốc (${sorted[i + 1].startTime} - ${sorted[i + 1].endTime}).`,
        );
      }
    }

    // 4. Xác định danh sách ngày áp dụng
    let targetDays: DayOfWeek[] = [];
    if (daysOfWeek && daysOfWeek.length > 0) {
      targetDays = daysOfWeek;
    } else if (dayOfWeek && dayOfWeek.toString() !== 'ALL') {
      targetDays = [dayOfWeek];
    } else {
      targetDays = [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
        DayOfWeek.SATURDAY,
        DayOfWeek.SUNDAY,
      ];
    }

    // 5. Lưu vào cơ sở dữ liệu qua transaction cho toàn bộ chi nhánh và ngày đã chọn
    await this.prisma.$transaction(async (tx) => {
      for (const bId of targetBranchIds) {
        for (const day of targetDays) {
          // Xóa các mốc cũ của cùng (bId, day, orderType)
          await tx.operatingSlot.deleteMany({
            where: {
              branchId: bId,
              dayOfWeek: day,
              orderType,
            },
          });

          // Tạo danh sách mốc mới
          await tx.operatingSlot.createMany({
            data: slots.map((s) => ({
              branchId: bId,
              dayOfWeek: day,
              startTime: s.startTime,
              endTime: s.endTime,
              maxOrders: Number(s.maxOrders || 0),
              leadTimeMinutes: Number(leadTimeMinutes || 60),
              orderType,
              isActive: s.isActive !== undefined ? Boolean(s.isActive) : true,
              status: SlotStatus.OPEN,
            })),
          });
        }
      }
    });

    return {
      success: true,
      message: `Đã lưu thành công ${slots.length} mốc giờ cho ${targetDays.length} ngày trên ${targetBranchIds.length} chi nhánh.`,
      count: slots.length * targetDays.length * targetBranchIds.length,
    };
  }

  /**
   * Thêm mới Khung giờ hoạt động với thuật toán chống trùng lặp (Anti-Overlapping)
   */
  async create(data: {
    branchId: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    maxOrders?: number;
    leadTimeMinutes?: number;
    orderType?: SlotOrderType;
    isActive?: boolean;
  }) {
    const {
      branchId,
      dayOfWeek,
      startTime,
      endTime,
      maxOrders = 0,
      leadTimeMinutes = 60,
      orderType = SlotOrderType.DELIVERY,
      isActive = true,
    } = data;

    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      throw new BadRequestException('Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.');
    }

    // Kiểm tra giao cắt thời gian với các slot đã tồn tại của cùng (branchId, dayOfWeek, orderType)
    const existingSlots = await this.prisma.operatingSlot.findMany({
      where: {
        branchId,
        dayOfWeek,
        orderType,
      },
    });

    for (const ex of existingSlots) {
      if (doTimesOverlap(startTime, endTime, ex.startTime, ex.endTime)) {
        throw new BadRequestException(
          `Khung giờ (${startTime} - ${endTime}) bị giao cắt/trùng lặp với khung giờ đã có (${ex.startTime} - ${ex.endTime}) của chi nhánh này vào ${dayOfWeek}.`,
        );
      }
    }

    return this.prisma.operatingSlot.create({
      data: {
        branchId,
        dayOfWeek,
        startTime,
        endTime,
        maxOrders,
        leadTimeMinutes,
        orderType,
        isActive,
        status: SlotStatus.OPEN,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Cập nhật Khung giờ hoạt động (Anti-Overlapping)
   */
  async update(
    id: string,
    data: {
      startTime?: string;
      endTime?: string;
      maxOrders?: number;
      leadTimeMinutes?: number;
      orderType?: SlotOrderType;
      isActive?: boolean;
      dayOfWeek?: DayOfWeek;
      branchId?: string;
    },
  ) {
    const slot = await this.prisma.operatingSlot.findUnique({ where: { id } });
    if (!slot) {
      throw new NotFoundException('Không tìm thấy khung giờ.');
    }

    const newStart = data.startTime || slot.startTime;
    const newEnd = data.endTime || slot.endTime;
    const newBranch = data.branchId || slot.branchId;
    const newDay = data.dayOfWeek || slot.dayOfWeek;
    const newType = data.orderType || slot.orderType;

    if (timeToMinutes(newStart) >= timeToMinutes(newEnd)) {
      throw new BadRequestException('Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.');
    }

    // Kiểm tra giao cắt với các slot khác (ngoại trừ chính nó)
    const existingSlots = await this.prisma.operatingSlot.findMany({
      where: {
        id: { not: id },
        branchId: newBranch,
        dayOfWeek: newDay,
        orderType: newType,
      },
    });

    for (const ex of existingSlots) {
      if (doTimesOverlap(newStart, newEnd, ex.startTime, ex.endTime)) {
        throw new BadRequestException(
          `Khung giờ cập nhật (${newStart} - ${newEnd}) bị giao cắt/trùng lặp với khung giờ (${ex.startTime} - ${ex.endTime}) đã tồn tại.`,
        );
      }
    }

    return this.prisma.operatingSlot.update({
      where: { id },
      data,
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Xóa toàn bộ khung giờ của một nhóm (branchId, dayOfWeek, orderType)
   */
  async deleteGroup(branchId: string, dayOfWeek: DayOfWeek, orderType: SlotOrderType) {
    return this.prisma.operatingSlot.deleteMany({
      where: { branchId, dayOfWeek, orderType },
    });
  }

  /**
   * Bật / tắt trạng thái toàn bộ khung giờ của một nhóm
   */
  async toggleGroup(branchId: string, dayOfWeek: DayOfWeek, orderType: SlotOrderType, isActive: boolean) {
    return this.prisma.operatingSlot.updateMany({
      where: { branchId, dayOfWeek, orderType },
      data: { isActive },
    });
  }

  /**
   * Xóa khung giờ
   */
  async delete(id: string) {
    const slot = await this.prisma.operatingSlot.findUnique({ where: { id } });
    if (!slot) {
      throw new NotFoundException('Không tìm thấy khung giờ');
    }
    return this.prisma.operatingSlot.delete({ where: { id } });
  }

  /**
   * Ghi nhận 1 đơn hàng mới vào DailySlotTracking (atomic & tự động chuyển status FULL)
   */
  async incrementDailyOrder(slotId: string, date: Date, tx?: any) {
    const prismaClient = tx || this.prisma;
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);

    const slot = await prismaClient.operatingSlot.findUnique({ where: { id: slotId } });
    if (!slot) return null;

    const tracking = await prismaClient.dailySlotTracking.upsert({
      where: { slotId_date: { slotId, date: targetDate } },
      create: {
        slotId,
        date: targetDate,
        currentOrders: 1,
        status: slot.maxOrders > 0 && 1 >= slot.maxOrders ? SlotStatus.FULL : SlotStatus.OPEN,
      },
      update: {
        currentOrders: { increment: 1 },
      },
    });

    // Cập nhật lại status nếu vượt quá maxOrders
    if (slot.maxOrders > 0 && tracking.currentOrders >= slot.maxOrders) {
      await prismaClient.dailySlotTracking.update({
        where: { id: tracking.id },
        data: { status: SlotStatus.FULL },
      });
    }

    return tracking;
  }

  /**
   * Giảm 1 đơn hàng khi hủy đơn (tự động trả về status OPEN)
   */
  async decrementDailyOrder(slotId: string, date: Date, tx?: any) {
    const prismaClient = tx || this.prisma;
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);

    const slot = await prismaClient.operatingSlot.findUnique({ where: { id: slotId } });
    if (!slot) return null;

    const tracking = await prismaClient.dailySlotTracking.findUnique({
      where: { slotId_date: { slotId, date: targetDate } },
    });

    if (tracking && tracking.currentOrders > 0) {
      const newCount = tracking.currentOrders - 1;
      return prismaClient.dailySlotTracking.update({
        where: { id: tracking.id },
        data: {
          currentOrders: newCount,
          status: slot.maxOrders > 0 && newCount >= slot.maxOrders ? SlotStatus.FULL : SlotStatus.OPEN,
        },
      });
    }
    return null;
  }
}
