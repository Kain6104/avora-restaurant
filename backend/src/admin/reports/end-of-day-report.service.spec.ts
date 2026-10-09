import { Test, TestingModule } from '@nestjs/testing';
import { EndOfDayReportService } from './end-of-day-report.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { FinancialReportCalculationService } from './financial-report-calculation.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import {
  parseVietnamDateRange,
  validateSevenDaysRule,
  getVietnamNow,
  toVietnamTime,
  getVietnamBusinessDayBounds,
} from '../../common/utils/vietnam-time.util';

describe('EndOfDayReportService & Vietnam Timezone Tests', () => {
  let service: EndOfDayReportService;
  let prisma: PrismaService;
  let authService: AuthorizationService;

  const mockBranch = {
    id: 'branch-1',
    name: 'AVORA Landmark 81',
    branchCode: 'AVR-LM81',
    street: '720A Điện Biên Phủ, P.22, Bình Thạnh',
    phone: '028-7777-8888',
    pointRedeemRate: 1,
  };

  const mockPrismaService = {
    branch: {
      findUnique: jest.fn().mockResolvedValue(mockBranch),
      findMany: jest.fn().mockResolvedValue([mockBranch]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1', fullName: 'Nguyễn Văn Thu Ngân', role: 'ADMIN', branchId: 'branch-1' }),
    },
    cashShift: {
      findUnique: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAuthService = {
    getAllowedBranches: jest.fn().mockResolvedValue({ isAll: true, branchIds: ['branch-1'] }),
  };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-13T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EndOfDayReportService,
        FinancialReportCalculationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuthorizationService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<EndOfDayReportService>(EndOfDayReportService);
    prisma = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthorizationService>(AuthorizationService);
    jest.clearAllMocks();
  });

  describe('1. Central Completed-Order Scope & Revenue Exclusion', () => {
    it('chỉ tính đơn hoàn thành (COMPLETED), không đưa đơn PENDING/PREPARING/CANCELLED vào doanh thu', async () => {
      // Mock completed order
      const completedOrder = {
        id: 'order-1',
        orderCode: 'AVR-001',
        branchId: 'branch-1',
        status: OrderStatus.COMPLETED,
        subTotal: 500000,
        totalAmount: 500000,
        shippingFee: 0,
        discountAmount: 0,
        serviceChargeTotal: 0,
        taxAmount: 50000,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        createdAt: new Date('2026-09-13T04:00:00.000Z'),
        orderItems: [
          {
            id: 'item-1',
            orderId: 'order-1',
            productId: 'prod-1',
            quantity: 2,
            priceAtSale: 250000,
            originalPriceAtSale: 250000,
            discountAmount: 0,
            taxPercentageAtSale: 10,
            taxAmountAtSale: 50000,
            vatPriceModeSnapshot: 'VAT_INCLUDED',
            product: {
              id: 'prod-1',
              itemCode: 'SASHIMI-01',
              name: 'Sashimi Cá Hồi',
              category: { id: 'cat-1', name: 'SASHIMI', slug: 'sashimi' },
            },
            selectedOptions: [],
          },
        ],
        payments: [
          {
            id: 'pay-1',
            paymentMethod: 'CASH',
            amount: 500000,
            status: 'COMPLETED',
            refunds: [],
          },
        ],
        serviceCharges: [],
      };

      mockPrismaService.order.findMany.mockResolvedValue([completedOrder]);
      mockPrismaService.order.count.mockResolvedValue(2); // 2 đơn hủy tham khảo

      const result = await service.getEndOfDayReport(
        {
          from: '2026-09-13',
          to: '2026-09-13',
          branchId: 'branch-1',
        },
        'user-1',
      );

      // Verify Prisma query was strictly called with COMPLETED
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [OrderStatus.COMPLETED] },
          }),
        }),
      );

      // Verify summary numbers
      expect(result.summary.completedOrderCount).toBe(1);
      expect(result.summary.cancelledOrderCount).toBe(2);
      expect(result.summary.totalActualCollected).toBe(500000);
      expect(result.summary.totalVat).toBe(50000);
      expect(result.summary.netSales).toBe(450000); // 500k - 50k VAT
      expect(result.reconciliation.valid).toBe(true);
      expect(result.payments[0]).toEqual(
        expect.objectContaining({
          method: 'CASH',
          amount: 500000,
          netAmount: 500000,
        }),
      );
    });
  });

  describe('2. Split Payments, Refunds & Reconciliation', () => {
    it('xử lý chính xác split payment (Tiền mặt + Chuyển khoản) và trừ refund khỏi thực thu', async () => {
      const splitOrder = {
        id: 'order-2',
        orderCode: 'AVR-SPLIT',
        branchId: 'branch-1',
        status: OrderStatus.COMPLETED,
        subTotal: 1000000,
        totalAmount: 1000000,
        shippingFee: 0,
        discountAmount: 0,
        serviceChargeTotal: 0,
        taxAmount: 0,
        paymentStatus: 'PAID',
        createdAt: new Date('2026-09-13T05:00:00.000Z'),
        orderItems: [
          {
            id: 'item-2',
            orderId: 'order-2',
            productId: 'prod-2',
            quantity: 1,
            priceAtSale: 1000000,
            originalPriceAtSale: 1000000,
            discountAmount: 0,
            taxPercentageAtSale: 0,
            taxAmountAtSale: 0,
            product: {
              id: 'prod-2',
              itemCode: 'BUFFET-VIP',
              name: 'Buffet Thượng Hạng',
              category: { id: 'cat-2', name: 'BUFFET', slug: 'buffet' },
            },
            selectedOptions: [],
          },
        ],
        payments: [
          {
            id: 'pay-2a',
            paymentMethod: 'CASH',
            amount: 400000,
            status: 'COMPLETED',
            refunds: [],
          },
          {
            id: 'pay-2b',
            paymentMethod: 'TRANSFER',
            amount: 600000,
            status: 'COMPLETED',
            refunds: [{ id: 'ref-1', amount: 100000 }], // Hoàn 100k
          },
        ],
        serviceCharges: [],
      };

      mockPrismaService.order.findMany.mockResolvedValue([splitOrder]);
      mockPrismaService.order.count.mockResolvedValue(0);

      const result = await service.getEndOfDayReport(
        { from: '2026-09-13', to: '2026-09-13', branchId: 'branch-1' },
        'user-1',
      );

      expect(result.summary.refundTotal).toBe(100000);
      expect(result.summary.totalActualCollected).toBe(900000); // 1,000,000 - 100,000
      expect(result.reconciliation.valid).toBe(true);
      expect(result.reconciliation.difference).toBe(0);

      const cashPay = result.payments.find((p) => p.method === 'CASH');
      const transferPay = result.payments.find((p) => p.method === 'TRANSFER');
      expect(cashPay?.netAmount).toBe(400000);
      expect(transferPay?.netAmount).toBe(500000); // 600k - 100k refund
    });
  });

  describe('3. Category & Product Sales Aggregation (Hàng hóa bán ra)', () => {
    it('tổng hợp đúng nhóm hàng và chi tiết món với toggle includeItemDetails', async () => {
      const order = {
        id: 'order-3',
        orderCode: 'AVR-003',
        branchId: 'branch-1',
        status: OrderStatus.COMPLETED,
        subTotal: 800000,
        totalAmount: 800000,
        shippingFee: 0,
        discountAmount: 0,
        serviceChargeTotal: 0,
        taxAmount: 0,
        paymentStatus: 'PAID',
        createdAt: new Date('2026-09-13T06:00:00.000Z'),
        orderItems: [
          {
            id: 'item-3a',
            productId: 'prod-sashimi',
            quantity: 2,
            priceAtSale: 300000,
            originalPriceAtSale: 300000,
            discountAmount: 0,
            taxPercentageAtSale: 0,
            taxAmountAtSale: 0,
            product: {
              id: 'prod-sashimi',
              itemCode: 'SSH-01',
              name: 'Sashimi Cá Trích',
              category: { id: 'cat-ssh', name: 'SASHIMI', slug: 'sashimi' },
            },
            selectedOptions: [],
          },
          {
            id: 'item-3b',
            productId: 'prod-drink',
            quantity: 4,
            priceAtSale: 50000,
            originalPriceAtSale: 50000,
            discountAmount: 0,
            taxPercentageAtSale: 0,
            taxAmountAtSale: 0,
            product: {
              id: 'prod-drink',
              itemCode: 'DRK-01',
              name: 'Trà Oolong Vải',
              category: { id: 'cat-drk', name: 'ĐỒ UỐNG', slug: 'drinks' },
            },
            selectedOptions: [],
          },
        ],
        payments: [{ paymentMethod: 'CASH', amount: 800000, status: 'COMPLETED' }],
        serviceCharges: [],
      };

      mockPrismaService.order.findMany.mockResolvedValue([order]);
      mockPrismaService.order.count.mockResolvedValue(0);

      const result = await service.getEndOfDayReport(
        { from: '2026-09-13', to: '2026-09-13', branchId: 'branch-1', includeItemDetails: 'true' },
        'user-1',
      );

      // Category Sales
      expect(result.categorySales).toHaveLength(2);
      const catSsh = result.categorySales.find((c) => c.categoryName === 'SASHIMI');
      const catDrk = result.categorySales.find((c) => c.categoryName === 'ĐỒ UỐNG');
      expect(catSsh?.quantitySold).toBe(2);
      expect(catSsh?.revenue).toBe(600000);
      expect(catDrk?.quantitySold).toBe(4);
      expect(catDrk?.revenue).toBe(200000);

      // Product Sales
      expect(result.productSales).toBeDefined();
      expect(result.productSales).toHaveLength(2);
      const prodSsh = result.productSales?.find((p) => p.itemCode === 'SSH-01');
      expect(prodSsh?.name).toBe('Sashimi Cá Trích');
      expect(prodSsh?.quantitySold).toBe(2);
      expect(prodSsh?.lineTotal).toBe(600000);
    });
  });

  describe('4. 7-Day Restriction Rule Enforcement', () => {
    it('chặn truy vấn thời gian trong tương lai', () => {
      const now = getVietnamNow();
      const futureStart = now.add(1, 'day').toDate();
      const futureEnd = now.add(2, 'day').toDate();

      expect(() => validateSevenDaysRule(futureStart, futureEnd)).toThrow(BadRequestException);
      expect(() => validateSevenDaysRule(futureStart, futureEnd)).toThrow(
        'Không được chọn thời gian trong tương lai',
      );
    });

    it('chặn truy vấn dữ liệu cũ hơn 7 ngày tính theo giờ Việt Nam', () => {
      const now = getVietnamNow();
      const oldStart = now.subtract(10, 'day').toDate();
      const oldEnd = now.subtract(8, 'day').toDate();

      expect(() => validateSevenDaysRule(oldStart, oldEnd)).toThrow(BadRequestException);
      expect(() => validateSevenDaysRule(oldStart, oldEnd)).toThrow(
        'Chỉ được xem và in dữ liệu trong 7 ngày gần nhất',
      );
    });

    it('chặn khoảng truy vấn vượt quá 7 ngày', () => {
      const now = getVietnamNow();
      const start = now.subtract(6, 'day').toDate();
      const end = now.add(3, 'day').toDate(); // > 7 days range

      expect(() => validateSevenDaysRule(start, end)).toThrow(BadRequestException);
    });

    it('chấp nhận khoảng thời gian hợp lệ trong 7 ngày gần nhất', () => {
      const now = getVietnamNow();
      const start = now.subtract(3, 'day').startOf('day').toDate();
      const end = now.toDate();

      expect(() => validateSevenDaysRule(start, end)).not.toThrow();
    });
  });

  describe('5. Vietnam Timezone (Asia/Ho_Chi_Minh UTC+07:00) Boundary Accuracy', () => {
    it('chuyển đổi đúng ngày nghiệp vụ Việt Nam sang UTC interval cho Prisma', () => {
      const bounds = getVietnamBusinessDayBounds('2026-09-13');

      // 2026-09-13 00:00:00.000 Asia/Ho_Chi_Minh = 2026-09-12 17:00:00.000 UTC
      expect(bounds.startUtc.toISOString()).toBe('2026-09-12T17:00:00.000Z');

      // 2026-09-13 23:59:59.999 Asia/Ho_Chi_Minh = 2026-09-13 16:59:59.999 UTC
      expect(bounds.endUtc.toISOString()).toBe('2026-09-13T16:59:59.999Z');
    });

    it('đơn lúc 00:01 sáng giờ VN được nhận diện đúng vào ngày mới', () => {
      // 00:01 sáng ngày 13/09/2026 tại VN = 17:01 ngày 12/09/2026 UTC
      const orderDateUtc = new Date('2026-09-12T17:01:00.000Z');
      const vnTime = toVietnamTime(orderDateUtc);

      expect(vnTime.format('YYYY-MM-DD')).toBe('2026-09-13');
      expect(vnTime.format('HH:mm')).toBe('00:01');
    });

    it('đơn lúc 23:59:59 giờ VN được nhận diện đúng vào ngày hiện tại', () => {
      // 23:59:59 ngày 13/09/2026 tại VN = 16:59:59 ngày 13/09/2026 UTC
      const orderDateUtc = new Date('2026-09-13T16:59:59.000Z');
      const vnTime = toVietnamTime(orderDateUtc);

      expect(vnTime.format('YYYY-MM-DD')).toBe('2026-09-13');
      expect(vnTime.format('HH:mm')).toBe('23:59');
    });
  });
});
