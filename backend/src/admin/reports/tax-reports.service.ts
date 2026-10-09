import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import {
  TaxReportCalculationService,
  CalculatedOrderTax,
  TaxOrderInput,
  TaxKPIsSummary,
  TaxRateBreakdownItem,
  TaxBranchSummaryItem,
  TaxCategorySummaryItem,
  TaxProductSummaryItem,
  TaxDailyTrendItem,
} from './tax-report-calculation.service';
import { TaxReportsExcelService } from './tax-reports-excel.service';
import { OrderStatus } from '@prisma/client';

export interface TaxReportFilterDto {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  branchId?: string; // 'ALL' or specific branch UUID
  taxRate?: string; // 0, 5, 8, 10
  vatPriceMode?: string; // VAT_INCLUDED, VAT_EXCLUDED
  categoryId?: string;
  productId?: string;
  orderSource?: string; // ONLINE, POS, WEB, CHATBOT, VOICE, QR_ORDER, ADMIN
  orderType?: string; // DINE_IN, TAKE_AWAY, DELIVERY
  paymentMethod?: string; // COD, VNPAY, MOMO, CASH, BANK_TRANSFER
  paymentStatus?: string; // PAID, PENDING, REFUNDED
  hasWarning?: string; // 'true' | 'false'
  isLegacy?: string; // 'true' | 'false'
  search?: string;
}

export interface TaxPaginationDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FlatTaxTransaction {
  orderId: string;
  orderCode: string;
  completionTimestamp: Date;
  branchName: string;
  customerName: string;
  orderSource: string;
  orderType: string;
  paymentMethod: string;
  paymentStatus: string;
  isReconciled: boolean;
  warningCode: string | null;

  orderItemId: string;
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string;
  quantity: number;
  unitPriceAtSale: number;
  originalPriceAtSale: number;
  grossLineTotal: number;
  optionAmount: number;
  directDiscount: number;
  allocatedVoucherDiscount: number;
  totalDiscount: number;
  netAmountAfterDiscount: number;
  taxPercentage: number;
  vatPriceMode: string;
  taxableAmount: number;
  taxAmount: number;
  grossRevenueWithTax: number;
  taxCalculationSource: string;
}

@Injectable()
export class TaxReportsService {
  private readonly logger = new Logger(TaxReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthorizationService,
    private readonly calcEngine: TaxReportCalculationService,
    private readonly excelService: TaxReportsExcelService,
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
            code: 'FORBIDDEN_TAX_REPORT_BRANCH',
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo thuế tại bất kỳ chi nhánh nào.',
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
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo thuế của chi nhánh này.',
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
   * QUY TẮC TỐI THƯỢNG: status BẮT BUỘC là OrderStatus.COMPLETED!
   * Thời điểm tính: deliveredAt (hoặc updatedAt nếu deliveredAt null).
   */
  buildOrderWhereClause(
    filter: TaxReportFilterDto,
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

    if (filter.vatPriceMode && filter.vatPriceMode !== 'ALL') {
      where.vatPriceModeSnapshot = filter.vatPriceMode;
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
   * Tải danh sách đơn hàng hoàn thành và tính toán chi tiết thuế
   */
  async loadAndCalculateOrders(
    filter: TaxReportFilterDto,
    allowedBranchIds: string[],
  ): Promise<CalculatedOrderTax[]> {
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
        table: {
          select: {
            id: true,
            name: true,
          },
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
                price: true,
                taxPercentage: true,
                categoryId: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            selectedOptions: true,
          },
        },
      },
      orderBy: { deliveredAt: 'desc' },
    });

    const calculatedOrders: CalculatedOrderTax[] = [];

    for (const ord of orders) {
      const orderInput: TaxOrderInput = {
        ...ord,
        orderSource: ord.orderSource as any,
        orderType: ord.orderType as any,
        orderItems: (ord.orderItems || []).map((it) => ({
          ...it,
          product: it.product as any,
          selectedOptions: it.selectedOptions as any,
        })),
        payments: ord.payments as any,
        serviceCharges: ord.serviceCharges as any,
      };

      const calc = this.calcEngine.calculateOrderTax(orderInput);

      // Lọc cấp Item nếu có filter taxRate hoặc categoryId hoặc productId
      if (filter.taxRate && filter.taxRate !== 'ALL') {
        const requiredRate = Number(filter.taxRate);
        const hasRate = calc.items.some((it) => it.taxPercentage === requiredRate);
        if (!hasRate) continue;
      }

      if (filter.categoryId && filter.categoryId !== 'ALL') {
        const hasCat = calc.items.some((it) => it.categoryId === filter.categoryId);
        if (!hasCat) continue;
      }

      if (filter.productId && filter.productId !== 'ALL') {
        const hasProd = calc.items.some((it) => it.productId === filter.productId);
        if (!hasProd) continue;
      }

      if (filter.hasWarning === 'true' && !calc.reconciliation.hasWarning) {
        continue;
      }

      if (filter.isLegacy === 'true' && !calc.isLegacyTimestampFallback) {
        continue;
      }

      calculatedOrders.push(calc);
    }

    return calculatedOrders;
  }

  /**
   * 1. API: Tổng quan Báo Cáo Thuế / VAT (Overview)
   */
  async getTaxOverview(filter: TaxReportFilterDto, userId: string) {
    const { allowedBranchIds, isAll } = await this.resolveBranchScope(userId, filter.branchId);
    const calculatedOrders = await this.loadAndCalculateOrders(filter, allowedBranchIds);

    const allBranches = await this.prisma.branch.findMany({
      where: { id: { in: allowedBranchIds } },
      select: { id: true, name: true, branchCode: true },
    });

    const kpis: TaxKPIsSummary = this.calcEngine.aggregateTaxKPIs(calculatedOrders);
    const rates: TaxRateBreakdownItem[] = this.calcEngine.aggregateTaxRates(calculatedOrders);
    const branches: TaxBranchSummaryItem[] = this.calcEngine.aggregateTaxBranches(
      calculatedOrders,
      allBranches,
    );
    const categories: TaxCategorySummaryItem[] = this.calcEngine.aggregateTaxCategories(calculatedOrders);
    const dailyTrends: TaxDailyTrendItem[] = this.calcEngine.aggregateTaxDailyTrends(calculatedOrders);

    // Lọc các vấn đề đối soát gần nhất
    const reconciliationIssues = calculatedOrders
      .filter((o) => !o.reconciliation.isReconciled || o.reconciliation.hasWarning)
      .slice(0, 10)
      .map((o) => ({
        orderId: o.orderId,
        orderCode: o.orderCode,
        branchName: o.branchName,
        completionTimestamp: o.completionTimestamp,
        errorCode: o.reconciliation.errorCode,
        warningCode: o.reconciliation.warningCode,
        notes: o.reconciliation.notes,
        storedTotalAmount: o.orderTotalAmount,
        expectedTotalAmount: o.reconciliation.expectedTotalAmount,
        discrepancyTotal: o.reconciliation.discrepancyTotal,
      }));

    return {
      kpis,
      rates,
      branches,
      categories: categories.slice(0, 8),
      dailyTrends,
      reconciliationIssues,
      filterScope: {
        isAllBranches: isAll,
        allowedBranchCount: allowedBranchIds.length,
        appliedDateRange: {
          from: filter.from || null,
          to: filter.to || null,
        },
      },
    };
  }

  /**
   * 2. API: Báo cáo thuế theo Mức thuế suất (Rates)
   */
  async getTaxRates(filter: TaxReportFilterDto, userId: string) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const calculatedOrders = await this.loadAndCalculateOrders(filter, allowedBranchIds);
    const rates = this.calcEngine.aggregateTaxRates(calculatedOrders);
    return { rates };
  }

  /**
   * 3. API: Báo cáo thuế theo Chi nhánh (Branches)
   */
  async getTaxBranches(filter: TaxReportFilterDto, userId: string) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const calculatedOrders = await this.loadAndCalculateOrders(filter, allowedBranchIds);
    const allBranches = await this.prisma.branch.findMany({
      where: { id: { in: allowedBranchIds } },
      select: { id: true, name: true, branchCode: true },
    });
    const branches = this.calcEngine.aggregateTaxBranches(calculatedOrders, allBranches);
    return { branches };
  }

  /**
   * 4. API: Báo cáo thuế theo Danh mục (Categories)
   */
  async getTaxCategories(filter: TaxReportFilterDto, userId: string) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const calculatedOrders = await this.loadAndCalculateOrders(filter, allowedBranchIds);
    const categories = this.calcEngine.aggregateTaxCategories(calculatedOrders);
    return { categories };
  }

  /**
   * 5. API: Báo cáo thuế theo Sản phẩm (Products)
   */
  async getTaxProducts(filter: TaxReportFilterDto, userId: string) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const calculatedOrders = await this.loadAndCalculateOrders(filter, allowedBranchIds);
    const products = this.calcEngine.aggregateTaxProducts(calculatedOrders);
    return { products };
  }

  /**
   * 6. API: Biểu đồ xu hướng thuế (Trend)
   */
  async getTaxTrend(filter: TaxReportFilterDto, userId: string) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const calculatedOrders = await this.loadAndCalculateOrders(filter, allowedBranchIds);
    const trends = this.calcEngine.aggregateTaxDailyTrends(calculatedOrders);
    return { trends };
  }

  /**
   * 7. API: Chi tiết giao dịch thuế từng OrderItem (Transactions)
   */
  async getTaxTransactions(
    filter: TaxReportFilterDto,
    pagination: TaxPaginationDto,
    userId: string,
  ) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const calculatedOrders = await this.loadAndCalculateOrders(filter, allowedBranchIds);

    // Trải phẳng toàn bộ các OrderItem của các đơn hoàn thành
    const flatItems: FlatTaxTransaction[] = [];

    for (const ord of calculatedOrders) {
      for (const it of ord.items) {
        if (filter.taxRate && filter.taxRate !== 'ALL') {
          if (it.taxPercentage !== Number(filter.taxRate)) continue;
        }
        if (filter.categoryId && filter.categoryId !== 'ALL') {
          if (it.categoryId !== filter.categoryId) continue;
        }
        if (filter.productId && filter.productId !== 'ALL') {
          if (it.productId !== filter.productId) continue;
        }

        flatItems.push({
          orderId: ord.orderId,
          orderCode: ord.orderCode,
          completionTimestamp: ord.completionTimestamp,
          branchName: ord.branchName,
          customerName: ord.customerName,
          orderSource: ord.orderSource,
          orderType: ord.orderType,
          paymentMethod: ord.paymentMethod,
          paymentStatus: ord.paymentStatus,
          isReconciled: ord.reconciliation.isReconciled,
          warningCode: ord.reconciliation.warningCode || null,

          orderItemId: it.orderItemId,
          productId: it.productId,
          productCode: it.productCode,
          productName: it.productName,
          categoryName: it.categoryName,
          quantity: it.quantity,
          unitPriceAtSale: it.unitPriceAtSale,
          originalPriceAtSale: it.originalPriceAtSale,
          grossLineTotal: it.grossLineTotal,
          optionAmount: it.totalOptionAmount,
          directDiscount: it.totalDirectDiscount,
          allocatedVoucherDiscount: it.allocatedOrderDiscount,
          totalDiscount: it.totalDiscount,
          netAmountAfterDiscount: it.netAmountAfterDiscount,
          taxPercentage: it.taxPercentage,
          vatPriceMode: it.vatPriceMode,
          taxableAmount: it.taxableAmount,
          taxAmount: it.taxAmount,
          grossRevenueWithTax: it.grossRevenueWithTax,
          taxCalculationSource: it.taxCalculationSource,
        });
      }
    }

    // Sort
    const sortBy = pagination.sortBy || 'completionTimestamp';
    const sortOrder = pagination.sortOrder === 'asc' ? 1 : -1;

    flatItems.sort((a: any, b: any) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();
      if (valA < valB) return -1 * sortOrder;
      if (valA > valB) return 1 * sortOrder;
      return 0;
    });

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.max(1, Math.min(100, pagination.limit || 20));
    const total = flatItems.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedItems = flatItems.slice((page - 1) * limit, page * limit);

    return {
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * 8. API: Chi tiết bóc tách thuế 1 đơn hàng (Single Order Drill-down Breakdown)
   */
  async getTaxSingleOrderBreakdown(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            branchCode: true,
          },
        },
        table: {
          select: {
            id: true,
            name: true,
          },
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
                price: true,
                taxPercentage: true,
                categoryId: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            selectedOptions: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng yêu cầu.');
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new ForbiddenException({
        success: false,
        statusCode: 400,
        error: {
          code: 'ORDER_NOT_COMPLETED',
          message: 'Báo cáo thuế chỉ áp dụng cho các đơn hàng đã hoàn thành.',
        },
      });
    }

    // Check RBAC
    await this.resolveBranchScope(userId, order.branchId);

    const orderInput: TaxOrderInput = {
      ...order,
      orderSource: order.orderSource as any,
      orderType: order.orderType as any,
      orderItems: (order.orderItems || []).map((it) => ({
        ...it,
        product: it.product as any,
        selectedOptions: it.selectedOptions as any,
      })),
      payments: order.payments as any,
      serviceCharges: order.serviceCharges as any,
    };

    const calculated = this.calcEngine.calculateOrderTax(orderInput);

    return {
      order: calculated,
    };
  }

  /**
   * 9. API: Báo cáo đối soát thuế (Reconciliation Audit)
   */
  async getTaxReconciliationReport(filter: TaxReportFilterDto, userId: string) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const calculatedOrders = await this.loadAndCalculateOrders(filter, allowedBranchIds);

    const totalOrders = calculatedOrders.length;
    let reconciledCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    const errorOrders: any[] = [];
    const warningOrders: any[] = [];

    for (const ord of calculatedOrders) {
      if (ord.reconciliation.isReconciled) {
        reconciledCount++;
      } else {
        errorCount++;
        errorOrders.push({
          orderId: ord.orderId,
          orderCode: ord.orderCode,
          branchName: ord.branchName,
          completionTimestamp: ord.completionTimestamp,
          discrepancyTotal: ord.reconciliation.discrepancyTotal,
          discrepancyTax: ord.reconciliation.discrepancyTax,
          discrepancyDiscountAllocated: ord.reconciliation.discrepancyDiscountAllocated,
          notes: ord.reconciliation.notes,
        });
      }

      if (ord.reconciliation.hasWarning) {
        warningCount++;
        warningOrders.push({
          orderId: ord.orderId,
          orderCode: ord.orderCode,
          branchName: ord.branchName,
          paymentStatus: ord.paymentStatus,
          storedTotalAmount: ord.orderTotalAmount,
          collectedRevenue: ord.collectedRevenue,
          notes: ord.reconciliation.notes,
        });
      }
    }

    return {
      summary: {
        totalCompletedOrdersChecked: totalOrders,
        reconciledOrdersCount: reconciledCount,
        errorOrdersCount: errorCount,
        warningOrdersCount: warningCount,
        reconciliationRatePercent:
          totalOrders > 0 ? Number(((reconciledCount / totalOrders) * 100).toFixed(2)) : 100,
      },
      errors: errorOrders,
      warnings: warningOrders,
    };
  }

  /**
   * 10. API: Xuất Excel Báo Cáo Thuế 9 Sheets chuẩn Thuế Doanh Nghiệp
   */
  async exportTaxExcel(filter: TaxReportFilterDto, userId: string): Promise<Buffer> {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const calculatedOrders = await this.loadAndCalculateOrders(filter, allowedBranchIds);

    const allBranches = await this.prisma.branch.findMany({
      where: { id: { in: allowedBranchIds } },
      select: { id: true, name: true, branchCode: true },
    });

    const kpis = this.calcEngine.aggregateTaxKPIs(calculatedOrders);
    const rates = this.calcEngine.aggregateTaxRates(calculatedOrders);
    const branches = this.calcEngine.aggregateTaxBranches(calculatedOrders, allBranches);
    const categories = this.calcEngine.aggregateTaxCategories(calculatedOrders);
    const products = this.calcEngine.aggregateTaxProducts(calculatedOrders);
    const trends = this.calcEngine.aggregateTaxDailyTrends(calculatedOrders);

    return this.excelService.generateTaxExcelWorkbook({
      kpis,
      rates,
      branches,
      categories,
      products,
      trends,
      orders: calculatedOrders,
      filter,
    });
  }

  /**
   * Lấy danh sách metadata phục vụ dropdown bộ lọc
   */
  async getFilterMetadata(userId: string) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId);
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: allowedBranchIds } },
      select: { id: true, name: true, branchCode: true },
    });

    const categories = await this.prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return {
      branches,
      categories,
      vatRates: [
        { label: '0% (Không chịu thuế)', value: '0' },
        { label: '5%', value: '5' },
        { label: '8%', value: '8' },
        { label: '10%', value: '10' },
      ],
      orderSources: [
        { label: 'Tất cả nguồn', value: 'ALL' },
        { label: 'POS tại quầy', value: 'POS' },
        { label: 'Web đặt món', value: 'WEB' },
        { label: 'QR tại bàn', value: 'QR_ORDER' },
        { label: 'Chatbot AI', value: 'CHATBOT' },
        { label: 'Voice AI', value: 'VOICE' },
      ],
      paymentMethods: [
        { label: 'Tất cả phương thức', value: 'ALL' },
        { label: 'Tiền mặt (CASH)', value: 'CASH' },
        { label: 'COD (Giao hàng thu tiền)', value: 'COD' },
        { label: 'VNPAY QR', value: 'VNPAY' },
        { label: 'MoMo', value: 'MOMO' },
        { label: 'Chuyển khoản (BANK_TRANSFER)', value: 'BANK_TRANSFER' },
      ],
    };
  }
}
