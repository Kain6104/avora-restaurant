import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import {
  FinancialReportCalculationService,
  CalculatedOrderFinancials,
  FinancialOrderInput,
} from './financial-report-calculation.service';
import { FinancialReportsExcelService } from './financial-reports-excel.service';
import { OrderStatus } from '@prisma/client';
import {
  parseVietnamDateRange,
  getVietnamHour,
  getVietnamNow,
} from '../../common/utils/vietnam-time.util';

export interface FinancialReportFilterDto {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  fromHour?: string; // 0 - 23
  toHour?: string; // 0 - 23
  branchId?: string; // 'ALL' or specific branch UUID
  orderSource?: string; // ONLINE, POS, WEB, CHATBOT, VOICE, QR_ORDER, ADMIN
  orderType?: string; // DINE_IN, TAKE_AWAY, DELIVERY
  orderStatus?: string; // COMPLETED, CANCELLED, etc.
  paymentStatus?: string; // PAID, PENDING, REFUNDED, etc.
  paymentMethod?: string;
  taxRate?: string; // 0, 5, 8, 10
  vatPriceMode?: string; // VAT_INCLUDED, VAT_EXCLUDED
  isFlashSale?: string; // 'true' | 'false'
  hasVoucher?: string; // 'true' | 'false'
  cashierId?: string;
  search?: string;
}

export interface FinancialPaginationDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class FinancialReportsService {
  private readonly logger = new Logger(FinancialReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthorizationService,
    private readonly calcEngine: FinancialReportCalculationService,
    private readonly excelService: FinancialReportsExcelService,
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
      // Thử fallback kiểm tra reports.view
      const fallbackScope = await this.authService.getAllowedBranches(userId, 'reports.view');
      if (!fallbackScope.isAll && fallbackScope.branchIds.length === 0) {
        throw new ForbiddenException({
          success: false,
          statusCode: 403,
          error: {
            code: 'FORBIDDEN_REPORT_BRANCH',
            message: 'Bạn không có quyền xem báo cáo tài chính tại bất kỳ chi nhánh nào.',
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
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo tài chính của chi nhánh này.',
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
   * Xây dựng mệnh đề WHERE cho Prisma Order
   */
  buildOrderWhereClause(
    filter: FinancialReportFilterDto,
    allowedBranchIds: string[],
  ): any {
    const where: any = {};

    // 1. Phân quyền chi nhánh
    where.branchId = { in: allowedBranchIds };

    // 2. Dải ngày theo chuẩn Giờ Việt Nam (Asia/Ho_Chi_Minh) -> convert UTC cho Prisma
    let startDate: Date;
    let endDate: Date;

    if (filter.from && filter.to) {
      const parsed = parseVietnamDateRange(filter.from, filter.to, filter.fromHour, filter.toHour);
      startDate = parsed.startUtc;
      endDate = parsed.endUtc;
    } else {
      // Mặc định 30 ngày gần nhất theo giờ Việt Nam
      const vnNow = getVietnamNow();
      endDate = vnNow.endOf('day').toDate();
      startDate = vnNow.subtract(30, 'day').startOf('day').toDate();
    }

    where.createdAt = {
      gte: startDate,
      lte: endDate,
    };

    // 3. Trạng thái đơn hàng
    if (filter.orderStatus && filter.orderStatus !== 'ALL') {
      where.status = filter.orderStatus as OrderStatus;
    }

    // 4. Trạng thái thanh toán
    if (filter.paymentStatus && filter.paymentStatus !== 'ALL') {
      where.paymentStatus = filter.paymentStatus;
    }

    // 5. Phương thức thanh toán
    if (filter.paymentMethod && filter.paymentMethod !== 'ALL') {
      where.paymentMethod = filter.paymentMethod;
    }

    // 6. Nguồn đơn
    if (filter.orderSource && filter.orderSource !== 'ALL') {
      where.orderSource = filter.orderSource as any;
    }

    // 7. Loại đơn
    if (filter.orderType && filter.orderType !== 'ALL') {
      where.orderType = filter.orderType as any;
    }

    // 8. Chế độ VAT
    if (filter.vatPriceMode && filter.vatPriceMode !== 'ALL') {
      where.vatPriceModeSnapshot = filter.vatPriceMode;
    }

    // 9. Thu ngân (Cashier)
    if (filter.cashierId && filter.cashierId !== 'ALL') {
      where.cashierId = filter.cashierId;
    }

    // 10. Voucher
    if (filter.hasVoucher === 'true') {
      where.OR = [{ voucherId: { not: null } }, { shippingVoucherId: { not: null } }];
    } else if (filter.hasVoucher === 'false') {
      where.voucherId = null;
      where.shippingVoucherId = null;
    }

    // 11. Tìm kiếm theo mã đơn, sđt hoặc tên khách
    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { orderCode: { contains: q } },
        { customerPhone: { contains: q } },
        { customerName: { contains: q } },
      ];
    }

    return where;
  }

  /**
   * Truy vấn đầy đủ dữ liệu các đơn hàng và chạy qua Financial Calculation Engine
   */
  private async fetchAndCalculateOrders(
    filter: FinancialReportFilterDto,
    userId: string,
  ): Promise<{
    orders: CalculatedOrderFinancials[];
    allowedBranchIds: string[];
    isAllBranches: boolean;
  }> {
    const { allowedBranchIds, isAll } = await this.resolveBranchScope(userId, filter.branchId);
    const where = this.buildOrderWhereClause(filter, allowedBranchIds);

    const rawOrders = await this.prisma.order.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, branchCode: true, pointRedeemRate: true },
        },
        voucher: true,
        shippingVoucher: true,
        serviceCharges: true,
        payments: {
          include: {
            refunds: true,
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                slug: true,
                price: true,
                taxPercentage: true,
                unit: true,
                categoryId: true,
                category: { select: { id: true, name: true, slug: true } },
              },
            },
            selectedOptions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Lọc theo khung giờ nếu có
    const hasHourFilter = filter.fromHour !== undefined || filter.toHour !== undefined;
    const fHour = filter.fromHour !== undefined ? parseInt(filter.fromHour, 10) : 0;
    const tHour = filter.toHour !== undefined ? parseInt(filter.toHour, 10) : 23;

    const filteredOrders = rawOrders.filter((o) => {
      if (hasHourFilter) {
        const h = getVietnamHour(o.createdAt);
        if (h < fHour || h > tHour) return false;
      }
      return true;
    });

    // Lấy global VAT mode từ SystemSetting
    let globalVatMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED' = 'VAT_INCLUDED';
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'vat_price_mode' },
      });
      const val = (setting?.value || '').toUpperCase();
      if (val === 'EXCLUDED' || val === 'VAT_EXCLUDED') {
        globalVatMode = 'VAT_EXCLUDED';
      }
    } catch {
      globalVatMode = 'VAT_INCLUDED';
    }

    const calculatedOrders: CalculatedOrderFinancials[] = filteredOrders.map((o) =>
      this.calcEngine.calculateOrderFinancials(o as any, globalVatMode),
    );

    return {
      orders: calculatedOrders,
      allowedBranchIds,
      isAllBranches: isAll,
    };
  }

  /**
   * 1. GET Financial Overview (KPIs, Charts, Branch Comparison, Daily Trends)
   */
  async getFinancialOverview(filter: FinancialReportFilterDto, userId: string) {
    const { orders } = await this.fetchAndCalculateOrders(filter, userId);
    const aggregated = this.calcEngine.aggregateFinancialKPIs(orders);

    return {
      summary: aggregated.summary,
      branchBreakdown: aggregated.branchBreakdown,
      paymentBreakdown: aggregated.paymentBreakdown,
      vatBreakdown: aggregated.vatBreakdown,
      discountBreakdown: aggregated.discountBreakdown,
      dailyTrend: aggregated.dailyTrend,
    };
  }

  /**
   * 2. GET Branch Comparison Table
   */
  async getBranchComparison(filter: FinancialReportFilterDto, userId: string) {
    const { orders } = await this.fetchAndCalculateOrders(filter, userId);
    const aggregated = this.calcEngine.aggregateFinancialKPIs(orders);

    return {
      branches: aggregated.branchBreakdown,
      globalSummary: aggregated.summary,
    };
  }

  /**
   * 3. GET Financial Deep Dive cho 1 chi nhánh
   */
  async getBranchFinancialDetail(
    branchId: string,
    filter: FinancialReportFilterDto,
    userId: string,
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        branchCode: true,
        phone: true,
        email: true,
        province: true,
        district: true,
        ward: true,
        street: true,
        pointRedeemRate: true,
      },
    });

    if (!branch) {
      throw new NotFoundException(`Không tìm thấy chi nhánh với ID: ${branchId}`);
    }

    const branchFilter: FinancialReportFilterDto = {
      ...filter,
      branchId,
    };

    const { orders } = await this.fetchAndCalculateOrders(branchFilter, userId);
    const aggregated = this.calcEngine.aggregateFinancialKPIs(orders);

    // Tính toán phân bổ theo giờ trong ngày (Hourly Peak)
    const hourlyMap = new Map<number, { hour: number; orderCount: number; netSales: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { hour: h, orderCount: 0, netSales: 0 });
    }

    orders.forEach((o) => {
      const h = getVietnamHour(o.createdAt);
      const slot = hourlyMap.get(h)!;
      slot.orderCount++;
      if (o.orderStatus !== 'CANCELLED') {
        slot.netSales += o.netSales;
      }
    });

    const hourlyTrend = Array.from(hourlyMap.values());

    return {
      branch,
      summary: aggregated.summary,
      paymentBreakdown: aggregated.paymentBreakdown,
      vatBreakdown: aggregated.vatBreakdown,
      discountBreakdown: aggregated.discountBreakdown,
      dailyTrend: aggregated.dailyTrend,
      hourlyTrend,
      recentOrders: orders.slice(0, 15),
    };
  }

  /**
   * 4. GET Paginated Financial Transactions Audit Table
   */
  async getFinancialTransactions(
    filter: FinancialReportFilterDto,
    pagination: FinancialPaginationDto,
    userId: string,
  ) {
    const { orders } = await this.fetchAndCalculateOrders(filter, userId);

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.max(1, Math.min(100, pagination.limit || 20));
    const sortBy = pagination.sortBy || 'createdAt';
    const sortOrder = pagination.sortOrder || 'desc';

    // Sort
    const sorted = [...orders].sort((a: any, b: any) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (valA === undefined || valB === undefined) return 0;
      if (sortOrder === 'asc') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    const total = sorted.length;
    const startIndex = (page - 1) * limit;
    const paginatedOrders = sorted.slice(startIndex, startIndex + limit);

    return {
      orders: paginatedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 5. GET Single Order Financial Audit (Modal Drill-down)
   */
  async getSingleOrderFinancialAudit(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        voucher: true,
        shippingVoucher: true,
        serviceCharges: true,
        payments: {
          include: {
            refunds: true,
          },
        },
        orderItems: {
          include: {
            product: {
              include: { category: true },
            },
            selectedOptions: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderId}`);
    }

    // Check branch scope
    await this.resolveBranchScope(userId, order.branchId);

    const calculated = this.calcEngine.calculateOrderFinancials(order as any);
    return calculated;
  }

  /**
   * 6. GET Filter Metadata (Branches, Payment Methods, Order Types, Order Sources)
   */
  async getFilterMetadata(userId: string) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId);

    const [branches, paymentMethods] = await Promise.all([
      this.prisma.branch.findMany({
        where: { id: { in: allowedBranchIds } },
        select: { id: true, name: true, branchCode: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.paymentMethod.findMany({
        where: { isActive: true },
        select: { id: true, name: true, methodCode: true },
      }),
    ]);

    return {
      branches,
      paymentMethods: paymentMethods.map((p) => ({
        code: p.methodCode,
        name: p.name,
      })),
      orderSources: [
        { code: 'ALL', name: 'Tất cả nguồn' },
        { code: 'POS', name: 'Tại quầy POS' },
        { code: 'ONLINE', name: 'Đặt hàng Online' },
        { code: 'WEB', name: 'Website' },
        { code: 'QR_ORDER', name: 'Gọi món tại bàn QR' },
        { code: 'CHATBOT', name: 'Trợ lý ảo AI' },
        { code: 'VOICE', name: 'Tổng đài thoại' },
        { code: 'ADMIN', name: 'Admin điều phối' },
      ],
      orderTypes: [
        { code: 'ALL', name: 'Tất cả loại đơn' },
        { code: 'DINE_IN', name: 'Ăn tại bàn (Dine-in)' },
        { code: 'TAKE_AWAY', name: 'Mang đi (Takeaway)' },
        { code: 'DELIVERY', name: 'Giao hàng tận nơi' },
      ],
      orderStatuses: [
        { code: 'ALL', name: 'Tất cả trạng thái' },
        { code: 'COMPLETED', name: 'Hoàn thành' },
        { code: 'PENDING', name: 'Chờ xử lý' },
        { code: 'CONFIRMED', name: 'Đã xác nhận' },
        { code: 'PREPARING', name: 'Đang chuẩn bị' },
        { code: 'DELIVERING', name: 'Đang giao hàng' },
        { code: 'CANCELLED', name: 'Đã hủy' },
      ],
      paymentStatuses: [
        { code: 'ALL', name: 'Tất cả thanh toán' },
        { code: 'PAID', name: 'Đã thanh toán' },
        { code: 'PENDING', name: 'Chờ thanh toán' },
        { code: 'FAILED', name: 'Thất bại' },
        { code: 'REFUNDED', name: 'Đã hoàn tiền' },
        { code: 'PARTIALLY_REFUNDED', name: 'Hoàn một phần' },
      ],
      taxRates: [
        { rate: 'ALL', name: 'Tất cả thuế suất' },
        { rate: '0', name: 'VAT 0%' },
        { rate: '5', name: 'VAT 5%' },
        { rate: '8', name: 'VAT 8%' },
        { rate: '10', name: 'VAT 10%' },
      ],
    };
  }

  /**
   * 7. Xuất Báo Cáo Tài Chính Excel 8 Sheets
   */
  async exportFinancialExcel(filter: FinancialReportFilterDto, userId: string): Promise<Buffer> {
    const { orders } = await this.fetchAndCalculateOrders(filter, userId);
    const aggregated = this.calcEngine.aggregateFinancialKPIs(orders);

    const fromStr = filter.from || '30 ngày trước';
    const toStr = filter.to || 'Hôm nay';
    const filterSummary = `Từ ${fromStr} đến ${toStr} | Chi nhánh: ${filter.branchId || 'Tất cả chi nhánh'} | Trạng thái: ${filter.orderStatus || 'Tất cả'}`;

    return this.excelService.generateFinancialWorkbook({
      filterSummary,
      summary: aggregated.summary,
      branchBreakdown: aggregated.branchBreakdown,
      paymentBreakdown: aggregated.paymentBreakdown,
      vatBreakdown: aggregated.vatBreakdown,
      discountBreakdown: aggregated.discountBreakdown,
      dailyTrend: aggregated.dailyTrend,
      orders,
    });
  }

  /**
   * 8. Báo cáo đối soát độc lập (Reconciliation Alerts)
   */
  async getReconciliationReport(filter: FinancialReportFilterDto, userId: string) {
    const { orders } = await this.fetchAndCalculateOrders(filter, userId);
    const unreconciled = orders.filter((o) => !o.reconciliation.isReconciled);

    return {
      totalOrdersChecked: orders.length,
      unreconciledCount: unreconciled.length,
      reconciliationRatePercent:
        orders.length > 0
          ? Math.round(((orders.length - unreconciled.length) / orders.length) * 1000) / 10
          : 100,
      unreconciledOrders: unreconciled.map((o) => ({
        orderId: o.orderId,
        orderCode: o.orderCode,
        createdAt: o.createdAt,
        branchName: o.branchName,
        customerName: o.customerName,
        storedTotalAmount: o.orderTotalAmount,
        expectedTotalAmount: o.reconciliation.expectedTotalAmount,
        discrepancyTotal: o.reconciliation.discrepancyTotal,
        notes: o.reconciliation.notes,
      })),
    };
  }
}
