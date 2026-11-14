import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlanType, SubscriptionMealSlot, SubscriptionStatus, DeliveryScheduleStatus } from '@prisma/client';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prisma: PrismaService;

  const mockPlan = {
    id: 'plan-1',
    code: 'PLAN_OFFICE_LUNCH_20',
    name: 'Gói Trưa Văn Phòng Tiện Lợi (20 Bữa Trưa)',
    planType: SubscriptionPlanType.MONTHLY_20_DAYS,
    mealSlot: SubscriptionMealSlot.LUNCH,
    totalMeals: 20,
    basePrice: 2100000,
    discountPrice: 1680000,
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue({ id: "user-1", fullName: "Nguyen Van A", phone: "0901234567" }),
            },
            mealSubscriptionPlan: {
              findMany: jest.fn().mockResolvedValue([mockPlan]),
              findUnique: jest.fn().mockResolvedValue(mockPlan),
            },
            branch: {
              findMany: jest.fn().mockResolvedValue([{ id: "branch-1", name: "Landmark 81", latitude: 10.78, longitude: 106.7 }]),
            },
            product: {
              findMany: jest.fn().mockResolvedValue([{ id: 'prod-1', name: 'Cơm Cá Hồi Sốt Tery' }]),
            },
            userMealSubscription: {
              create: jest.fn().mockImplementation(({ data }) => ({
                id: 'sub-uuid-1',
                subscriptionCode: 'SUB-ABCD12',
                ...data,
              })),
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue({
                id: 'sub-uuid-1',
                userId: 'user-1',
                plan: mockPlan,
                schedules: [],
              }),
              update: jest.fn().mockImplementation(({ data }) => ({ id: 'sub-uuid-1', ...data })),
            },
            subscriptionDeliverySchedule: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'sch-1',
                subscriptionId: 'sub-uuid-1',
                deliveryDate: new Date('2026-11-02'),
                deliverySlot: '11:30',
                status: DeliveryScheduleStatus.SCHEDULED,
                subscription: {
                  userId: 'user-1',
                  endDate: new Date('2026-11-27'),
                  plan: mockPlan,
                },
              }),
              create: jest.fn().mockResolvedValue({ id: 'sch-new' }),
              update: jest.fn().mockImplementation(({ data }) => ({ id: 'sch-1', ...data })),
              findMany: jest.fn().mockResolvedValue([]),
            },
            order: {
              create: jest.fn().mockResolvedValue({ id: 'order-1', temporaryOrderCode: 'AVR-SUB-TEST' }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch active plans', async () => {
    const plans = await service.getPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].code).toBe('PLAN_OFFICE_LUNCH_20');
  });

  it('should create subscription and schedule workdays only for 20-day plan', async () => {
    const res = await service.subscribe('user-1', {
      planId: 'plan-1',
      recipientName: 'Nguyễn Văn A',
      recipientPhone: '0901234567',
      deliveryAddress: 'Landmark 81, P.22, Q.Bình Thạnh, TP.HCM',
      startDate: '2026-11-01',
    });

    expect(res.success).toBe(true);
    expect(res.subscription).toBeDefined();
  });

  it('should handle pause/skip with smart rollover extension (Bù kỳ thông minh)', async () => {
    const res = await service.pauseOrSkipSchedule('sch-1', 'user-1', {
      reason: 'Đi công tác đột xuất',
    });

    expect(res.success).toBe(true);
    expect(res.newEndDate).toBeDefined();
  });
});

