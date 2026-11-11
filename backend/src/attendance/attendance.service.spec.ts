import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceQrService } from './attendance-qr.service';
import { NotificationService } from '../notification/notification.service';

describe('AttendanceService (Sushi Wa Parity Tests)', () => {
  let service: AttendanceService;

  const mockPrismaService = {
    attendance: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    shift: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    attendanceLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockQrService = {
    verifyQr: jest.fn(),
  };

  const mockNotificationService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AttendanceQrService, useValue: mockQrService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  describe('Haversine Geofence Distance Calculation', () => {
    it('should calculate distance between two coordinates accurately in meters', () => {
      // Branch at HCM (10.7769, 106.7009)
      // Client 100 meters away approx
      const lat1 = 10.7769;
      const lon1 = 106.7009;
      const lat2 = 10.7778;
      const lon2 = 106.7009;

      const distance = service.calculateDistance(lat1, lon1, lat2, lon2);
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(110);
    });

    it('should return 0 meters for identical coordinates', () => {
      const distance = service.calculateDistance(10.7769, 106.7009, 10.7769, 106.7009);
      expect(distance).toBe(0);
    });
  });

  describe('calculateShiftOverlap (Sushi Wa Exact 3-minute grace buffer & boundaries)', () => {
    it('should calculate standard 240 mins (4.0h) for exact on-time check-in and check-out', () => {
      const actualIn = new Date('2026-03-10T08:00:00');
      const actualOut = new Date('2026-03-10T12:00:00');

      const overlapMinutes = (service as any).calculateShiftOverlap(
        actualIn,
        actualOut,
        '08:00',
        '12:00',
        3,
      );
      expect(overlapMinutes).toBe(240);
      expect(overlapMinutes / 60).toBe(4.0);
    });

    it('should clamp extra early arrival within 3-minute grace buffer to shift start (240 mins)', () => {
      // Arrived at 07:58 (within 3 min buffer of 08:00)
      const actualIn = new Date('2026-03-10T07:58:00');
      const actualOut = new Date('2026-03-10T12:00:00');

      const overlapMinutes = (service as any).calculateShiftOverlap(
        actualIn,
        actualOut,
        '08:00',
        '12:00',
        3,
      );
      // Even though worker arrived 2 mins early, working hours must be clamped to 240 mins (4.0h)
      expect(overlapMinutes).toBe(240);
      expect(overlapMinutes / 60).toBe(4.0);
    });

    it('should calculate overlap for split shift segment (480 mins / 8.0h total)', () => {
      // Morning segment: 08:00 - 12:00
      const actualIn = new Date('2026-03-10T08:00:00');
      const actualOut = new Date('2026-03-10T21:00:00');

      const morningMinutes = (service as any).calculateShiftOverlap(
        actualIn,
        actualOut,
        '08:00',
        '12:00',
        3,
      );
      const eveningMinutes = (service as any).calculateShiftOverlap(
        actualIn,
        actualOut,
        '17:00',
        '21:00',
        3,
      );
      // 240 mins morning + 240 mins evening = 480 mins (8.0 hours)
      expect(morningMinutes).toBe(240);
      expect(eveningMinutes).toBe(240);
      expect((morningMinutes + eveningMinutes) / 60).toBe(8.0);
    });
  });

  describe('Vietnam Holiday Detection (Solar & Lunar x3 Rate)', () => {
    it('should detect New Year (01/01)', () => {
      const date = new Date('2026-01-01T08:00:00');
      expect(service.isHoliday(date)).toBe(true);
    });

    it('should detect Reunification Day (30/04)', () => {
      const date = new Date('2026-04-30T08:00:00');
      expect(service.isHoliday(date)).toBe(true);
    });

    it('should detect International Workers Day (01/05)', () => {
      const date = new Date('2026-05-01T08:00:00');
      expect(service.isHoliday(date)).toBe(true);
    });

    it('should detect National Day (02/09)', () => {
      const date = new Date('2026-09-02T08:00:00');
      expect(service.isHoliday(date)).toBe(true);
    });

    it('should detect Lunar New Year 2026 (17/02/2026)', () => {
      const date = new Date(2026, 1, 17); // Month is 0-indexed in JS (1 = Feb)
      expect(service.isHoliday(date)).toBe(true);
    });

    it('should return false for regular days', () => {
      const date = new Date('2026-03-10T08:00:00');
      expect(service.isHoliday(date)).toBe(false);
    });
  });
});
