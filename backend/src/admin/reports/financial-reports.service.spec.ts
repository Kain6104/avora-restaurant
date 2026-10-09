import { Test, TestingModule } from '@nestjs/testing';
import { FinancialReportsService } from './financial-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { FinancialReportCalculationService } from './financial-report-calculation.service';
import { FinancialReportsExcelService } from './financial-reports-excel.service';
import { ForbiddenException } from '@nestjs/common';

describe('FinancialReportsService', () => {
  let service: FinancialReportsService;
  let mockPrisma: any;
  let mockAuthService: any;
  let mockCalcEngine: any;
  let mockExcelService: any;

  beforeEach(async () => {
    mockPrisma = {
      branch: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'b1', name: 'Chi nhánh 1', branchCode: 'AVO1' },
          { id: 'b2', name: 'Chi nhánh 2', branchCode: 'AVO2' },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          name: 'Chi nhánh 1',
          branchCode: 'AVO1',
        }),
      },
      paymentMethod: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'pm1', name: 'Tiền mặt', methodCode: 'CASH' },
          { id: 'pm2', name: 'Chuyển khoản SePay', methodCode: 'SEPAY' },
        ]),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue({ value: 'INCLUDED' }),
      },
    };

    mockAuthService = {
      getAllowedBranches: jest.fn(),
    };

    mockCalcEngine = new FinancialReportCalculationService();
    mockExcelService = {
      generateFinancialWorkbook: jest.fn().mockResolvedValue(Buffer.from('excel-mock')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthorizationService, useValue: mockAuthService },
        { provide: FinancialReportCalculationService, useValue: mockCalcEngine },
        { provide: FinancialReportsExcelService, useValue: mockExcelService },
      ],
    }).compile();

    service = module.get<FinancialReportsService>(FinancialReportsService);
  });

  describe('resolveBranchScope (RBAC)', () => {
    it('Admin toàn quyền (isAll: true) được phép xem tất cả chi nhánh', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: true,
        branchIds: [],
      });

      const scope = await service.resolveBranchScope('admin-id', 'ALL');
      expect(scope.isAll).toBe(true);
      expect(scope.allowedBranchIds).toEqual(['b1', 'b2']);
    });

    it('Manager chỉ được phép xem chi nhánh của mình', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: false,
        branchIds: ['b1'],
      });

      const scope = await service.resolveBranchScope('manager-id', 'b1');
      expect(scope.isAll).toBe(false);
      expect(scope.allowedBranchIds).toEqual(['b1']);
    });

    it('Manager cố tình xem chi nhánh khác bị ném lỗi 403 Forbidden', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: false,
        branchIds: ['b1'],
      });

      await expect(service.resolveBranchScope('manager-id', 'b2')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getFilterMetadata', () => {
    it('trả về danh sách bộ lọc đầy đủ', async () => {
      mockAuthService.getAllowedBranches.mockResolvedValue({
        isAll: true,
        branchIds: [],
      });

      const metadata = await service.getFilterMetadata('admin-id');
      expect(metadata.branches.length).toBe(2);
      expect(metadata.paymentMethods.length).toBe(2);
      expect(metadata.orderSources.length).toBeGreaterThan(0);
      expect(metadata.orderTypes.length).toBeGreaterThan(0);
      expect(metadata.orderStatuses.length).toBeGreaterThan(0);
    });
  });

  describe('buildOrderWhereClause', () => {
    it('xây dựng mệnh đề WHERE chính xác cho ngày, trạng thái và phương thức thanh toán', () => {
      const filter = {
        from: '2026-09-01',
        to: '2026-09-12',
        orderStatus: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'SEPAY',
        orderSource: 'ONLINE',
        orderType: 'DELIVERY',
      };

      const where = service.buildOrderWhereClause(filter, ['b1']);
      expect(where.branchId).toEqual({ in: ['b1'] });
      expect(where.status).toBe('COMPLETED');
      expect(where.paymentStatus).toBe('PAID');
      expect(where.paymentMethod).toBe('SEPAY');
      expect(where.orderSource).toBe('ONLINE');
      expect(where.orderType).toBe('DELIVERY');
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });
  });
});
