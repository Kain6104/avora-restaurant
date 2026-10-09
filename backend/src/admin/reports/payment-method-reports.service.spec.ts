import { Test, TestingModule } from '@nestjs/testing';
import { PaymentMethodReportsService } from './payment-method-reports.service';
import { PaymentMethodReportCalculationService } from './payment-method-report-calculation.service';
import { PaymentMethodReportsExcelService } from './payment-method-reports-excel.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { OrderStatus } from '@prisma/client';

describe('PaymentMethodReportsService (Integration & Cardinal Tests)', () => {
  let service: PaymentMethodReportsService;
  let prisma: PrismaService;
  let authService: AuthorizationService;

  const mockBranch = {
    id: 'branch-1',
    name: 'Chi nhánh Quận 1',
    branchCode: 'CN-Q1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodReportsService,
        PaymentMethodReportCalculationService,
        PaymentMethodReportsExcelService,
        {
          provide: PrismaService,
          useValue: {
            branch: {
              findMany: jest.fn().mockResolvedValue([mockBranch]),
              findUnique: jest.fn().mockResolvedValue(mockBranch),
            },
            paymentMethod: {
              findMany: jest.fn().mockResolvedValue([
                { methodCode: 'TRANSFER', name: 'Chuyển khoản', gatewayType: 'TRANSFER', isActive: true },
                { methodCode: 'CARD', name: 'Thẻ', gatewayType: 'CARD', isActive: true },
                { methodCode: 'CASH', name: 'Tiền mặt', gatewayType: 'CASH', isActive: true },
              ]),
            },
            order: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: AuthorizationService,
          useValue: {
            getAllowedBranches: jest.fn().mockResolvedValue({ isAll: true, branchIds: ['branch-1'] }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentMethodReportsService>(PaymentMethodReportsService);
    prisma = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthorizationService>(AuthorizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('CARDINAL TEST: 16 Completed Orders vs 40 Incomplete Orders', () => {
    it('MUST strictly enforce COMPLETED status and return exactly 16 orders and 4,458,400 VND', async () => {
      // 16 Completed Orders:
      // 4 Chuyển khoản (2.127.000)
      // 4 Card (1.626.500)
      // 4 Cash (584.000)
      // 2 OCB (38.000)
      // 1 CKCN (72.900)
      // 1 Bank OCB (10.000)
      // Total Revenue = 4.458.400 VND

      const completedOrders = [
        // 4 Chuyển khoản = 2.127.000
        { id: 'c1', orderCode: 'ORD-CK-1', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'TRANSFER', totalAmount: 500000, subTotal: 500000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
        { id: 'c2', orderCode: 'ORD-CK-2', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'TRANSFER', totalAmount: 600000, subTotal: 600000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
        { id: 'c3', orderCode: 'ORD-CK-3', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'TRANSFER', totalAmount: 527000, subTotal: 527000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
        { id: 'c4', orderCode: 'ORD-CK-4', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'TRANSFER', totalAmount: 500000, subTotal: 500000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },

        // 4 Card = 1.626.500
        { id: 'c5', orderCode: 'ORD-CD-1', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'CARD', totalAmount: 400000, subTotal: 400000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
        { id: 'c6', orderCode: 'ORD-CD-2', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'CARD', totalAmount: 426500, subTotal: 426500, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
        { id: 'c7', orderCode: 'ORD-CD-3', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'CARD', totalAmount: 400000, subTotal: 400000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
        { id: 'c8', orderCode: 'ORD-CD-4', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'CARD', totalAmount: 400000, subTotal: 400000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },

        // 4 Cash = 584.000
        { id: 'c9', orderCode: 'ORD-CS-1', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'CASH', totalAmount: 146000, subTotal: 146000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
        { id: 'c10', orderCode: 'ORD-CS-2', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'CASH', totalAmount: 146000, subTotal: 146000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
        { id: 'c11', orderCode: 'ORD-CS-3', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'CASH', totalAmount: 146000, subTotal: 146000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
        { id: 'c12', orderCode: 'ORD-CS-4', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'CASH', totalAmount: 146000, subTotal: 146000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },

        // 2 OCB = 38.000
        { id: 'c13', orderCode: 'ORD-OCB-1', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'OCB', totalAmount: 19000, subTotal: 19000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
        { id: 'c14', orderCode: 'ORD-OCB-2', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'OCB', totalAmount: 19000, subTotal: 19000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },

        // 1 CKCN = 72.900
        { id: 'c15', orderCode: 'ORD-CKCN-1', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'CKCN', totalAmount: 72900, subTotal: 72900, deliveredAt: new Date(), createdAt: new Date(), payments: [] },

        // 1 Bank OCB = 10.000
        { id: 'c16', orderCode: 'ORD-BOCB-1', branchId: 'branch-1', branch: mockBranch, status: OrderStatus.COMPLETED, paymentStatus: 'PAID', paymentMethod: 'Bank OCB', totalAmount: 10000, subTotal: 10000, deliveredAt: new Date(), createdAt: new Date(), payments: [] },
      ];

      // Giả lập prisma.order.findMany được gọi với WHERE clause
      (prisma.order.findMany as jest.Mock).mockImplementation((args) => {
        // Enforce: Query MUST have where.status === OrderStatus.COMPLETED
        expect(args.where.status).toBe(OrderStatus.COMPLETED);
        return Promise.resolve(completedOrders);
      });

      const res = await service.getMethods('admin-user-id', {});

      expect(res.success).toBe(true);
      expect(res.data.kpis.totalCompletedOrders).toBe(16);
      expect(res.data.kpis.totalGrossRevenue).toBe(4458400);

      // Total sum of all methods must match exactly 16 orders and 4,458,400 VND
      const sumRevenue = res.data.methods.reduce((sum, m) => sum + m.grossRevenue, 0);
      const sumOrders = res.data.methods.reduce((sum, m) => sum + m.orderCount, 0);

      expect(sumRevenue).toBe(4458400);
      expect(sumOrders).toBe(16);

      // Reconciliation must be 100% true
      expect(res.data.reconciliation.isReconciled).toBe(true);
      expect(res.data.reconciliation.discrepancyRevenue).toBe(0);
      expect(res.data.reconciliation.discrepancyOrderCount).toBe(0);
    });

    it('buildOrderWhereClause MUST ALWAYS set status: OrderStatus.COMPLETED', () => {
      const where = service.buildOrderWhereClause({}, ['branch-1']);
      expect(where.status).toBe(OrderStatus.COMPLETED);
      expect(where.branchId).toEqual({ in: ['branch-1'] });
    });
  });

  describe('Excel Export', () => {
    it('should generate valid excel buffer for payment methods report', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'c1',
          orderCode: 'ORD-1',
          branchId: 'branch-1',
          branch: mockBranch,
          status: OrderStatus.COMPLETED,
          paymentStatus: 'PAID',
          paymentMethod: 'TRANSFER',
          totalAmount: 500000,
          subTotal: 500000,
          deliveredAt: new Date(),
          createdAt: new Date(),
          payments: [],
        },
      ]);

      const buffer = await service.exportExcel('admin-user-id', {});
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
    });
  });
});
