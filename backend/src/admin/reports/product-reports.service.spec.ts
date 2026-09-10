import { Test, TestingModule } from '@nestjs/testing';
import { ProductReportsService } from './product-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { ProductReportCalculationService } from './product-report-calculation.service';
import { ProductReportsExcelService } from './product-reports-excel.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ProductReportsService', () => {
  let service: ProductReportsService;
  let prisma: any;
  let authService: any;
  let calcEngine: ProductReportCalculationService;
  let excelService: ProductReportsExcelService;

  const mockPrisma = {
    branch: {
      findMany: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAuthService = {
    getAllowedBranches: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductReportsService,
        ProductReportCalculationService,
        ProductReportsExcelService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AuthorizationService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<ProductReportsService>(ProductReportsService);
    prisma = module.get(PrismaService);
    authService = module.get(AuthorizationService);
    calcEngine = module.get(ProductReportCalculationService);
    excelService = module.get(ProductReportsExcelService);
  });

  describe('resolveBranchScope (RBAC)', () => {
    it('should throw ForbiddenException if user has no branch permissions', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: false,
        branchIds: [],
      });

      await expect(service.resolveBranchScope('user-1', 'ALL')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user requests branch not in allowedBranchIds', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: false,
        branchIds: ['branch-1'],
      });

      await expect(
        service.resolveBranchScope('user-1', 'branch-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ALL when isAll is true', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: true,
        branchIds: [],
      });
      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);

      const res = await service.resolveBranchScope('admin-user', 'ALL');
      expect(res.isAll).toBe(true);
      expect(res.allowedBranchIds).toEqual(['b1', 'b2']);
    });

    it('should return specific allowed branch when valid', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: false,
        branchIds: ['branch-1', 'branch-2'],
      });

      const res = await service.resolveBranchScope('user-1', 'branch-1');
      expect(res.isAll).toBe(false);
      expect(res.allowedBranchIds).toEqual(['branch-1']);
    });
  });

  describe('getFilterMetadata', () => {
    it('should return metadata with allowed branches and categories', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: true,
        branchIds: [],
      });

      mockPrisma.branch.findMany.mockResolvedValue([
        { id: 'b1', name: 'Branch 1', branchCode: 'B01' },
      ]);
      mockPrisma.category.findMany.mockResolvedValue([
        { id: 'c1', name: 'Sushi' },
      ]);

      const meta = await service.getFilterMetadata('admin-1');
      expect(meta.branches).toHaveLength(1);
      expect(meta.categories).toHaveLength(1);
      expect(meta.orderSources).toBeDefined();
      expect(meta.orderTypes).toBeDefined();
    });
  });

  describe('getProductReportOverview', () => {
    it('should fetch orders and return calculated KPIs, charts, and categories tree', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: true,
        branchIds: [],
      });
      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'b1' }]);

      const dummyItem = {
        id: 'item-1',
        orderId: 'ord-1',
        productId: 'p1',
        quantity: 2,
        priceAtSale: 50000,
        originalPriceAtSale: 50000,
        discountAmount: 0,
        taxPercentageAtSale: 0,
        taxableAmountAtSale: 100000,
        taxAmountAtSale: 0,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
        isFlashSaleAtSale: false,
        product: {
          id: 'p1',
          name: 'Nigiri Sake',
          itemCode: 'PRD001',
          unit: 'Phần',
          price: 50000,
          vatTaxPercentage: 0,
          isVatInclusive: true,
          category: { id: 'c1', name: 'Sushi' },
        },
        selectedOptions: [],
        order: {
          id: 'ord-1',
          orderCode: 'ORD001',
          createdAt: new Date('2026-03-01T12:00:00Z'),
          status: 'COMPLETED',
          orderSource: 'POS',
          servingType: 'DINE_IN',
          paymentMethod: 'CASH',
          paymentStatus: 'PAID',
          branchId: 'b1',
          branch: { id: 'b1', name: 'Quận 1', branchCode: 'Q1' },
          subTotal: 100000,
          discountAmount: 0,
          shippingFee: 0,
          shippingDiscount: 0,
          serviceChargeAmount: 0,
          serviceChargeTax: 0,
          isVatInclusive: true,
          totalAmount: 100000,
          customerName: 'Guest',
          customerPhone: '0901234567',
          user: null,
          payments: [],
          serviceCharges: [],
          voucher: null,
          shippingVoucher: null,
        },
      };

      mockPrisma.orderItem.findMany.mockResolvedValue([dummyItem]);

      const result = await service.getProductReportOverview(
        { from: '2026-03-01', to: '2026-03-01' },
        'admin-1',
      );

      expect(result).toBeDefined();
      expect(result.kpis.totalSoldQuantity).toBe(2);
      expect(result.kpis.grossProductSales).toBe(100000);
      expect(result.categoryTree).toHaveLength(1);
      expect(result.categoryTree[0].categoryName).toBe('Sushi');
      expect(result.categoryTree[0].products).toHaveLength(1);
    });
  });

  describe('getProductDetailReport', () => {
    it('should throw NotFoundException if product does not exist', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: true,
        branchIds: [],
      });
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.getProductDetailReport('non-existent', {}, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return deep dive breakdown for an existing product', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: true,
        branchIds: [],
      });
      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'b1' }]);

      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Nigiri Sake',
        itemCode: 'PRD001',
        unit: 'Phần',
        price: 50000,
        vatTaxPercentage: 8,
        isVatInclusive: true,
        imageUrl: '/img.png',
        category: { id: 'c1', name: 'Sushi' },
      });

      const dummyItem = {
        id: 'item-1',
        orderId: 'ord-1',
        productId: 'p1',
        quantity: 1,
        priceAtSale: 50000,
        originalPriceAtSale: 50000,
        discountAmount: 0,
        taxPercentageAtSale: 8,
        taxableAmountAtSale: 46296,
        taxAmountAtSale: 3704,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
        isFlashSaleAtSale: false,
        product: {
          id: 'p1',
          name: 'Nigiri Sake',
          itemCode: 'PRD001',
          unit: 'Phần',
          price: 50000,
          vatTaxPercentage: 8,
          isVatInclusive: true,
          category: { id: 'c1', name: 'Sushi' },
        },
        selectedOptions: [],
        order: {
          id: 'ord-1',
          orderCode: 'ORD001',
          createdAt: new Date('2026-03-01T12:00:00Z'),
          status: 'COMPLETED',
          orderSource: 'POS',
          servingType: 'DINE_IN',
          paymentMethod: 'CASH',
          paymentStatus: 'PAID',
          branchId: 'b1',
          branch: { id: 'b1', name: 'Quận 1', branchCode: 'Q1' },
          subTotal: 50000,
          discountAmount: 0,
          shippingFee: 0,
          shippingDiscount: 0,
          serviceChargeAmount: 0,
          serviceChargeTax: 0,
          isVatInclusive: true,
          totalAmount: 50000,
          customerName: 'Guest',
          customerPhone: '0901234567',
          user: null,
          payments: [],
          serviceCharges: [],
          voucher: null,
          shippingVoucher: null,
        },
      };

      mockPrisma.orderItem.findMany.mockResolvedValue([dummyItem]);

      const result = await service.getProductDetailReport('p1', {}, 'admin-1', 'day');

      expect(result).toBeDefined();
      expect(result.currentProductInfo.id).toBe('p1');
      expect(result.kpis.totalSoldQuantity).toBe(1);
      expect(result.priceBreakdown).toBeDefined();
      expect(result.vatBreakdown).toBeDefined();
    });
  });

  describe('exportProductReportExcel', () => {
    it('should generate a valid excel workbook buffer', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: true,
        branchIds: [],
      });
      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'b1' }]);
      mockPrisma.orderItem.findMany.mockResolvedValue([]);

      const buffer = await service.exportProductReportExcel({}, 'admin-1');
      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
