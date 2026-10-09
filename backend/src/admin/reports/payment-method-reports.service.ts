import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { OrderStatus } from '@prisma/client';
import {
  PaymentMethodReportCalculationService,
  PaymentReportOrderInput,
  PaymentMethodConfigInput,
  PaymentMethodKPIsSummary,
  PaymentMethodSummaryItem,
  PaymentMethodBranchSummaryItem,
  PaymentMethodTrendItem,
  PaymentMethodReconciliationResult,
  CalculatedOrderPaymentAudit,
} from './payment-method-report-calculation.service';
import { PaymentMethodReportsExcelService } from './payment-method-reports-excel.service';

export interface PaymentMethodFilterDto {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  branchId?: string; // 'ALL' or specific branch UUID
  paymentMethod?: string;
  orderSource?: string; // WEB, POS, WAITER, QR_ORDER, CHATBOT, VOICE
  orderType?: string; // DINE_IN, TAKE_AWAY, DELIVERY
  paymentStatus?: string; // PAID, PENDING, REFUNDED
  search?: string;
  sortBy?: 'revenue' | 'orders' | 'name' | 'aov' | 'net';
  sortOrder?: 'asc' | 'desc';
}

export interface PaymentMethodPaginationDto {
  page?: number;
  limit?: number;
  search?: string;
  paymentMethod?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class PaymentMethodReportsService {
  private readonly logger = new Logger(PaymentMethodReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthorizationService,
    private readonly calcEngine: PaymentMethodReportCalculationService,
    private readonly excelService: PaymentMethodReportsExcelService,
  ) {}

  /**
   * Phân quyền phạm vi chi nhánh (RBAC):
   * MANAGER chỉ xem được chi nhánh được phân quyền.
   * ADMIN được xem tất cả hoặc chọn từng chi nhánh.
   */
  async resolveBranchScope(
    userId: string,
    requestedBranchId?: string,
  ): Promise<{ allowedBranchIds: string[]; isAll: boolean }> {
    const permScope = await this.authService.getAllowedBranches(userId, 'reports.revenue.view');

    if (!permScope.isAll && permScope.branchIds.length === 0) {
      const fallbackScope = await this.authService.getAllowedBranches(userId, 'reports.view');
      if (!fallbackScope.isAll && fallbackScope.branchIds.length === 0) {
        throw new ForbiddenException({
          success: false,
          statusCode: 403,
          error: {
            code: 'FORBIDDEN_PAYMENT_REPORT_BRANCH',
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo phương thức thanh toán tại bất kỳ chi nhánh nào.',
          },
        });
      }
      permScope.isAll = fallbackScope.isAll;
      permScope.branchIds = fallbackScope.branchIds;
    }

    if (
      requestedBranchId &&
      requestedBranchId !== 'ALL' &&
      requestedBranchId !== 'undefined' &&
      requestedBranchId !== 'null'
    ) {
      if (!permScope.isAll && !permScope.branchIds.includes(requestedBranchId)) {
        throw new ForbiddenException({
          success: false,
          statusCode: 403,
          error: {
            code: 'FORBIDDEN_BRANCH_ACCESS',
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo của chi nhánh này.',
          },
        });
      }
      return { allowedBranchIds: [requestedBranchId], isAll: false };
    }

    if (permScope.isAll) {
      const allBranches = await this.prisma.branch.findMany({ select: { id: true } });
      return { allowedBranchIds: allBranches.map((b) => b.id), isAll: true };
    }

    return { allowedBranchIds: permScope.branchIds, isAll: false };
  }

  /**
   * Xây dựng mệnh đề WHERE cho Prisma Order.
   * QUY TẮC TỐI THƯỢNG #1: status BẮT BUỘC là OrderStatus.COMPLETED!
   * Thời điểm tính: deliveredAt (hoặc updatedAt nếu deliveredAt null).
   */
  buildOrderWhereClause(
    filter: PaymentMethodFilterDto,
    allowedBranchIds: string[],
  ): any {
    const where: any = {};

    // 1. CARDINAL RULE: CHỈ LẤY ĐƠN ĐÃ HOÀN THÀNH (COMPLETED)
    where.status = OrderStatus.COMPLETED;

    // 2. Phân quyền chi nhánh
    where.branchId = { in: allowedBranchIds };

    // 3. Dải ngày hoàn thành đơn (Completion Date Range)
    let startDate: Date;
    let endDate: Date;

    if (filter.from && filter.to) {
      startDate = new Date(filter.from);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(filter.to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Mặc định 30 ngày gần nhất
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    // Completion timestamp: ưu tiên deliveredAt, fallback sang updatedAt
    where.OR = [
      {
        deliveredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      {
        deliveredAt: null,
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    ];

    // 4. Các bộ lọc bổ sung
    if (filter.orderSource && filter.orderSource !== 'ALL') {
      where.orderSource = filter.orderSource as any;
    }

    if (filter.orderType && filter.orderType !== 'ALL') {
      where.orderType = filter.orderType as any;
    }

    if (filter.paymentStatus && filter.paymentStatus !== 'ALL') {
      where.paymentStatus = filter.paymentStatus;
    }

    if (filter.paymentMethod && filter.paymentMethod !== 'ALL') {
      where.paymentMethod = filter.paymentMethod;
    }

    if (filter.search && filter.search.trim()) {
      const s = filter.search.trim();
      where.AND = [
        {
          OR: [
            { orderCode: { contains: s } },
            { temporaryOrderCode: { contains: s } },
            { customerName: { contains: s } },
            { customerPhone: { contains: s } },
          ],
        },
      ];
    }

    return where;
  }

  /**
   * Load danh sách cấu hình PaymentMethod từ DB để ánh xạ tên động
   */
  async loadConfiguredPaymentMethods(): Promise<PaymentMethodConfigInput[]> {
    try {
      const methods = await this.prisma.paymentMethod.findMany({
        select: {
          methodCode: true,
          name: true,
          gatewayType: true,
          isActive: true,
        },
      });
      return methods;
    } catch (e) {
      this.logger.warn(`Failed to load configured payment methods from DB: ${e.message}`);
      return [];
    }
  }

  /**
   * Tải danh sách đơn hàng hoàn thành
   */
  async loadCompletedOrders(
    filter: PaymentMethodFilterDto,
    allowedBranchIds: string[],
  ): Promise<PaymentReportOrderInput[]> {
    const where = this.buildOrderWhereClause(filter, allowedBranchIds);

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            branchCode: true,
          },
        },
        payments: {
          include: {
            refunds: true,
          },
        },
      },
      orderBy: {
        deliveredAt: 'desc',
      },
    });

    return orders.map((o) => ({
      id: o.id,
      orderCode: o.orderCode || o.temporaryOrderCode || o.id.substring(0, 8),
      temporaryOrderCode: o.temporaryOrderCode,
      branchId: o.branchId,
      branch: o.branch,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      totalAmount: o.totalAmount,
      subTotal: o.subTotal,
      discountAmount: o.discountAmount,
      shippingFee: o.shippingFee,
      shippingDiscount: o.shippingDiscount,
      serviceChargeTotal: o.serviceChargeTotal,
      taxAmount: o.taxAmount,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      transactionId: o.transactionId,
      status: o.status,
      orderType: o.orderType,
      orderSource: o.orderSource,
      cashierName: o.cashierName,
      createdAt: o.createdAt,
      deliveredAt: o.deliveredAt,
      updatedAt: o.updatedAt,
      payments: o.payments?.map((p) => ({
        id: p.id,
        paymentMethod: p.paymentMethod,
        amount: p.amount,
        status: p.status,
        transactionRef: p.transactionRef,
        cashReceived: p.cashReceived,
        cashChange: p.cashChange,
        createdAt: p.createdAt,
        refunds: p.refunds?.map((r) => ({
          id: r.id,
          amount: r.amount,
          reason: r.reason,
          createdAt: r.createdAt,
        })),
      })),
    }));
  }

  /**
   * Tính toán toàn diện dataset phương thức thanh toán
   */
  private async calculateReportDataset(userId: string, filter: PaymentMethodFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const dbMethods = await this.loadConfiguredPaymentMethods();
    const orders = await this.loadCompletedOrders(filter, allowedBranchIds);

    const branches = await this.prisma.branch.findMany({
      where: { id: { in: allowedBranchIds } },
      select: { id: true, name: true, branchCode: true },
    });

    const aggregated = this.calcEngine.aggregatePaymentMethodsReport({
      orders,
      dbMethods,
      allBranches: branches,
    });

    return {
      ...aggregated,
      allowedBranchIds,
    };
  }

  /**
   * API 1: Overview KPIs & Reconciliation
   */
  async getOverview(userId: string, filter: PaymentMethodFilterDto) {
    const dataset = await this.calculateReportDataset(userId, filter);

    return {
      success: true,
      data: {
        kpis: dataset.kpis,
        reconciliation: dataset.reconciliation,
        filterInfo: {
          from: filter.from || '',
          to: filter.to || '',
          branchId: filter.branchId || 'ALL',
        },
      },
    };
  }

  /**
   * API 2: Phương Thức Breakdown (Dùng chung cho cả 2 Tab Doanh Thu & Số Đơn)
   */
  async getMethods(userId: string, filter: PaymentMethodFilterDto) {
    const dataset = await this.calculateReportDataset(userId, filter);
    let methods = [...dataset.methods];

    // Sorting
    const sortBy = filter.sortBy || 'revenue';
    const sortOrder = filter.sortOrder || 'desc';

    methods.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortBy === 'revenue') {
        valA = a.grossRevenue;
        valB = b.grossRevenue;
      } else if (sortBy === 'orders') {
        valA = a.orderCount;
        valB = b.orderCount;
      } else if (sortBy === 'name') {
        valA = a.methodName.toLowerCase();
        valB = b.methodName.toLowerCase();
      } else if (sortBy === 'aov') {
        valA = a.averageOrderValue;
        valB = b.averageOrderValue;
      } else if (sortBy === 'net') {
        valA = a.netCollected;
        valB = b.netCollected;
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      }
      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

    return {
      success: true,
      data: {
        kpis: dataset.kpis,
        methods,
        reconciliation: dataset.reconciliation,
        total: {
          totalCompletedOrders: dataset.kpis.totalCompletedOrders,
          totalRevenue: dataset.kpis.totalGrossRevenue,
          totalPaid: dataset.kpis.totalCollectedRevenue,
          totalRefunded: dataset.kpis.totalRefundedAmount,
          netCollected: dataset.kpis.netCollected,
          averageOrderValue: dataset.kpis.overallAov,
        },
      },
    };
  }

  /**
   * API 3: So Sánh Chi Nhánh
   */
  async getBranches(userId: string, filter: PaymentMethodFilterDto) {
    const dataset = await this.calculateReportDataset(userId, filter);
    return {
      success: true,
      data: dataset.branches,
    };
  }

  /**
   * API 4: Xu Hướng Theo Thời Gian (Daily Trend)
   */
  async getTrend(userId: string, filter: PaymentMethodFilterDto) {
    const dataset = await this.calculateReportDataset(userId, filter);
    return {
      success: true,
      data: dataset.trends,
    };
  }

  /**
   * API 5: Drill-down Danh Sách Giao Dịch
   */
  async getTransactions(
    userId: string,
    filter: PaymentMethodFilterDto,
    pagination: PaymentMethodPaginationDto,
  ) {
    const dataset = await this.calculateReportDataset(userId, filter);
    let transactions = [...dataset.calculatedOrders];

    // Filter by payment method
    if (pagination.paymentMethod && pagination.paymentMethod !== 'ALL') {
      const pMethod = pagination.paymentMethod.toLowerCase();
      transactions = transactions.filter(
        (t) =>
          t.primaryPaymentMethod.toLowerCase() === pMethod ||
          t.primaryPaymentMethodName.toLowerCase() === pMethod ||
          t.paymentLines.some(
            (l) => l.methodCode.toLowerCase() === pMethod || l.methodName.toLowerCase() === pMethod,
          ),
      );
    }

    // Filter by search
    if (pagination.search && pagination.search.trim()) {
      const s = pagination.search.trim().toLowerCase();
      transactions = transactions.filter(
        (t) =>
          t.orderCode.toLowerCase().includes(s) ||
          t.customerName.toLowerCase().includes(s) ||
          t.customerPhone.toLowerCase().includes(s),
      );
    }

    const total = transactions.length;
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 20;
    const startIndex = (page - 1) * limit;
    const paginatedItems = transactions.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data: {
        items: paginatedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    };
  }

  /**
   * API 6: Đối Soát Toán Học Chi Tiết
   */
  async getReconciliation(userId: string, filter: PaymentMethodFilterDto) {
    const dataset = await this.calculateReportDataset(userId, filter);
    return {
      success: true,
      data: dataset.reconciliation,
    };
  }

  /**
   * API 7: Filter Metadata (Chi nhánh được phép & Danh sách Payment Methods)
   */
  async getFilterMetadata(userId: string) {
    const permScope = await this.authService.getAllowedBranches(userId, 'reports.revenue.view');
    let branches: { id: string; name: string; branchCode: string }[] = [];

    if (permScope.isAll) {
      branches = await this.prisma.branch.findMany({
        select: { id: true, name: true, branchCode: true },
        orderBy: { name: 'asc' },
      });
    } else {
      branches = await this.prisma.branch.findMany({
        where: { id: { in: permScope.branchIds } },
        select: { id: true, name: true, branchCode: true },
        orderBy: { name: 'asc' },
      });
    }

    const dbMethods = await this.prisma.paymentMethod.findMany({
      select: { methodCode: true, name: true, gatewayType: true, isActive: true },
      orderBy: { methodCode: 'asc' },
    });

    return {
      success: true,
      data: {
        branches,
        paymentMethods: dbMethods,
      },
    };
  }

  /**
   * API 8: Xuất Excel Báo Cáo 6 Sheets
   */
  async exportExcel(userId: string, filter: PaymentMethodFilterDto): Promise<Buffer> {
    const dataset = await this.calculateReportDataset(userId, filter);

    let branchName = 'Tất cả chi nhánh';
    if (filter.branchId && filter.branchId !== 'ALL') {
      const b = await this.prisma.branch.findUnique({
        where: { id: filter.branchId },
        select: { name: true },
      });
      if (b) branchName = b.name;
    }

    return this.excelService.generatePaymentMethodExcelWorkbook({
      kpis: dataset.kpis,
      methods: dataset.methods,
      branches: dataset.branches,
      trend: dataset.trends,
      transactions: dataset.calculatedOrders,
      reconciliation: dataset.reconciliation,
      filterInfo: {
        from: filter.from || '30 ngày trước',
        to: filter.to || 'Hôm nay',
        branchName,
        orderSource: filter.orderSource,
        orderType: filter.orderType,
      },
    });
  }
}
