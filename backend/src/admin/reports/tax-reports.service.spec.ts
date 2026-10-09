import { Test, TestingModule } from '@nestjs/testing';
import { TaxReportsService } from './tax-reports.service';
import { TaxReportCalculationService } from './tax-report-calculation.service';
import { TaxReportsExcelService } from './tax-reports-excel.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { OrderStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

describe('TaxReportsService', () => {
  let service: TaxReportsService;
  let prisma: PrismaService;
  let authService: AuthorizationService;
  let calcEngine: TaxReportCalculationService;

  const mockPrisma = {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    branch: {
      findMany: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
  };

  const mockAuthService = {
    getAllowedBranches: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxReportsService,
        TaxReportCalculationService,
        TaxReportsExcelService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthorizationService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<TaxReportsService>(TaxReportsService);
    prisma = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthorizationService>(AuthorizationService);
    calcEngine = module.get<TaxReportCalculationService>(TaxReportCalculationService);

    jest.clearAllMocks();
  });

  describe('TEST STATUS FILTER ĐẶC BIỆT (Cardinal Status Test)', () => {
    it('MUST query ONLY OrderStatus.COMPLETED and return exactly 10 completed orders out of 60 orders in dataset', async () => {
      // Setup mock RBAC
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: true,
        branchIds: ['branch-1'],
      });

      mockPrisma.branch.findMany.mockResolvedValue([
        { id: 'branch-1', name: 'Chi nhánh Quận 1', branchCode: 'Q1' },
      ]);

      // Create dataset with 60 orders (10 each of PENDING, CONFIRMED, PREPARING, DELIVERING, CANCELLED, COMPLETED)
      const mockDatabaseAllOrders: any[] = [];
      const statuses = [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.DELIVERING,
        OrderStatus.CANCELLED,
        OrderStatus.COMPLETED,
      ];

      statuses.forEach((st) => {
        for (let i = 1; i <= 10; i++) {
          mockDatabaseAllOrders.push({
            id: `ord-${st}-${i}`,
            orderCode: `CODE-${st}-${i}`,
            branchId: 'branch-1',
            status: st,
            subTotal: 108000,
            discountAmount: 0,
            shippingFee: 0,
            shippingDiscount: 0,
            serviceChargeTotal: 0,
            taxAmount: 8000,
            totalAmount: 108000,
            vatPriceModeSnapshot: 'VAT_INCLUDED',
            paymentStatus: st === OrderStatus.COMPLETED ? 'PAID' : 'PENDING',
            paymentMethod: 'COD',
            deliveredAt: new Date('2026-09-12T10:00:00Z'),
            createdAt: new Date('2026-09-12T09:00:00Z'),
            updatedAt: new Date('2026-09-12T10:00:00Z'),
            branch: { id: 'branch-1', name: 'Chi nhánh Quận 1', branchCode: 'Q1' },
            orderItems: [
              {
                id: `item-${st}-${i}`,
                orderId: `ord-${st}-${i}`,
                productId: 'prod-1',
                quantity: 1,
                priceAtSale: 108000,
                originalPriceAtSale: 108000,
                taxPercentageAtSale: 8,
                product: {
                  id: 'prod-1',
                  name: 'Món Bò 8%',
                  price: 108000,
                  categoryId: 'cat-1',
                  category: { id: 'cat-1', name: 'Món Chính' },
                },
              },
            ],
            payments: [
              {
                id: `pay-${st}-${i}`,
                amount: 108000,
                status: st === OrderStatus.COMPLETED ? 'COMPLETED' : 'PENDING',
                refunds: [],
              },
            ],
            serviceCharges: [],
          });
        }
      });

      expect(mockDatabaseAllOrders.length).toBe(60);

      // Prisma findMany implementation simulating the DB filter:
      mockPrisma.order.findMany.mockImplementation(async (args) => {
        // Assert that the WHERE clause enforces COMPLETED strictly!
        expect(args.where.status).toBe(OrderStatus.COMPLETED);

        // Filter the dataset exactly as MySQL would
        return mockDatabaseAllOrders.filter((o) => o.status === args.where.status);
      });

      // Execute overview API
      const result = await service.getTaxOverview(
        { from: '2026-09-01', to: '2026-09-30', branchId: 'ALL' },
        'user-admin',
      );

      // Verify: EXACTLY 10 completed orders, NOT 60!
      expect(result.kpis.completedOrders).toBe(10);
      expect(result.kpis.completedOrderItems).toBe(10);

      // VAT Amount must be exactly 10 * 8,000 = 80,000 VND
      expect(result.kpis.totalVat).toBe(80000);
      expect(result.kpis.netVat).toBe(80000);
      expect(result.kpis.vat8Amount).toBe(80000);
      expect(result.kpis.vat0Amount).toBe(0);
      expect(result.kpis.vat5Amount).toBe(0);
      expect(result.kpis.vat10Amount).toBe(0);

      // Verify rates breakdown contains 10 completed orders for 8% rate
      const rate8 = result.rates.find((r) => r.ratePercentage === 8);
      expect(rate8).toBeDefined();
      expect(rate8?.completedOrdersCount).toBe(10);
      expect(rate8?.taxAmount).toBe(80000);
    });
  });

  describe('RBAC & Branch Permissions', () => {
    it('should throw ForbiddenException when manager tries to access unauthorized branch', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: false,
        branchIds: ['branch-allowed'],
      });

      await expect(
        service.getTaxOverview(
          { branchId: 'branch-forbidden', from: '2026-09-01', to: '2026-09-30' },
          'user-manager',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow manager to view authorized branch only', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: false,
        branchIds: ['branch-allowed'],
      });

      mockPrisma.branch.findMany.mockResolvedValue([
        { id: 'branch-allowed', name: 'CN Được Phép' },
      ]);
      mockPrisma.order.findMany.mockResolvedValue([]);

      const res = await service.getTaxOverview(
        { branchId: 'branch-allowed', from: '2026-09-01', to: '2026-09-30' },
        'user-manager',
      );

      expect(res.filterScope.isAllBranches).toBe(false);
      expect(res.filterScope.allowedBranchCount).toBe(1);
    });
  });

  describe('Single Order Breakdown & Validation', () => {
    it('should reject viewing tax breakdown for an order that is not COMPLETED', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'ord-cancelled',
        status: OrderStatus.CANCELLED,
        branchId: 'branch-1',
      });

      await expect(
        service.getTaxSingleOrderBreakdown('ord-cancelled', 'user-admin'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
