import { BadRequestException } from '@nestjs/common';
import { OperatingSlotService, doTimesOverlap, timeToMinutes } from './operating-slot.service';
import { DayOfWeek, SlotOrderType, SlotStatus } from '@prisma/client';

describe('OperatingSlotService - Anti-Overlapping, Capacity & Lead Time', () => {
  let service: OperatingSlotService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      operatingSlot: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'slot-1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'slot-1', ...data })),
        delete: jest.fn().mockResolvedValue({ id: 'slot-1' }),
      },
      dailySlotTracking: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn().mockImplementation(({ create, update }) => Promise.resolve({ id: 'track-1', currentOrders: 1, status: SlotStatus.OPEN })),
        update: jest.fn().mockResolvedValue({ id: 'track-1', currentOrders: 1, status: SlotStatus.OPEN }),
      },
      slotLock: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'lock-1', ...data })),
      },
    };

    service = new OperatingSlotService(mockPrisma);
  });

  describe('Anti-Overlapping Time Logic', () => {
    it('1. helper timeToMinutes should convert "11:30" to 690', () => {
      expect(timeToMinutes('11:30')).toBe(690);
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('2. doTimesOverlap should accurately detect overlapping intervals', () => {
      // Giao cắt 1 phần
      expect(doTimesOverlap('11:00', '12:30', '12:00', '13:30')).toBe(true);
      // Nằm trọn bên trong
      expect(doTimesOverlap('10:00', '14:00', '11:00', '12:00')).toBe(true);
      // Bao trọn bên ngoài
      expect(doTimesOverlap('11:00', '12:00', '10:00', '14:00')).toBe(true);
      // Tiếp giáp (không giao cắt)
      expect(doTimesOverlap('11:00', '12:00', '12:00', '13:00')).toBe(false);
      // Rời nhau hoàn toàn
      expect(doTimesOverlap('08:00', '10:00', '14:00', '16:00')).toBe(false);
    });

    it('3. should reject creating slot if it overlaps with an existing slot in the same branch, day & type', async () => {
      mockPrisma.operatingSlot.findMany.mockResolvedValue([
        {
          id: 'ex-1',
          branchId: 'b-1',
          dayOfWeek: DayOfWeek.MONDAY,
          orderType: SlotOrderType.DELIVERY,
          startTime: '11:00',
          endTime: '13:00',
        },
      ]);

      await expect(
        service.create({
          branchId: 'b-1',
          dayOfWeek: DayOfWeek.MONDAY,
          orderType: SlotOrderType.DELIVERY,
          startTime: '12:00',
          endTime: '14:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. should allow creating non-overlapping slot (e.g. 13:00 - 15:00)', async () => {
      mockPrisma.operatingSlot.findMany.mockResolvedValue([
        {
          id: 'ex-1',
          branchId: 'b-1',
          dayOfWeek: DayOfWeek.MONDAY,
          orderType: SlotOrderType.DELIVERY,
          startTime: '11:00',
          endTime: '13:00',
        },
      ]);

      const res = await service.create({
        branchId: 'b-1',
        dayOfWeek: DayOfWeek.MONDAY,
        orderType: SlotOrderType.DELIVERY,
        startTime: '13:00',
        endTime: '15:00',
      });

      expect(res).toBeDefined();
      expect(mockPrisma.operatingSlot.create).toHaveBeenCalled();
    });
  });

  describe('Capacity and Lead Time Calculation', () => {
    it('5. should mark calculatedStatus = FULL when effective orders >= maxOrders for calendar date', async () => {
      mockPrisma.operatingSlot.findMany.mockResolvedValue([
        {
          id: 'slot-1',
          branchId: 'b-1',
          dayOfWeek: DayOfWeek.MONDAY,
          orderType: SlotOrderType.DELIVERY,
          startTime: '18:00',
          endTime: '20:00',
          maxOrders: 5,
          leadTimeMinutes: 30,
          isActive: true,
        },
      ]);

      // Giả lập ngày đó đã có 5 đơn
      mockPrisma.dailySlotTracking.findMany.mockResolvedValue([
        { slotId: 'slot-1', currentOrders: 5 },
      ]);

      const slots = await service.getSlotsForDate({
        branchId: 'b-1',
        dateStr: '2026-09-07', // Một ngày Thứ 2
        orderType: SlotOrderType.DELIVERY,
      });

      expect(slots).toHaveLength(1);
      expect(slots[0].calculatedStatus).toBe(SlotStatus.FULL);
      expect(slots[0].isCapacityFull).toBe(true);
      expect(slots[0].remainingOrders).toBe(0);
      expect(slots[0].isAvailable).toBe(false);
    });

    it('6. lockSlot should throw BadRequestException if capacity is already exhausted', async () => {
      mockPrisma.operatingSlot.findUnique.mockResolvedValue({
        id: 'slot-1',
        maxOrders: 3,
        isActive: true,
      });
      mockPrisma.dailySlotTracking.findUnique.mockResolvedValue({
        currentOrders: 3,
      });
      mockPrisma.slotLock.count.mockResolvedValue(0);

      await expect(
        service.lockSlot({
          slotId: 'slot-1',
          dateStr: '2026-09-07',
          sessionId: 'sess-123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. lockSlot should create a 10-minute hold when capacity is available', async () => {
      mockPrisma.operatingSlot.findUnique.mockResolvedValue({
        id: 'slot-1',
        maxOrders: 10,
        isActive: true,
      });
      mockPrisma.dailySlotTracking.findUnique.mockResolvedValue({
        currentOrders: 2,
      });
      mockPrisma.slotLock.count.mockResolvedValue(1);

      const res = await service.lockSlot({
        slotId: 'slot-1',
        dateStr: '2026-09-07',
        sessionId: 'sess-123',
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.slotLock.create).toHaveBeenCalled();
    });
  });
});
