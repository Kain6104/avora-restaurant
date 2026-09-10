import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import {
  CalculatedOrderItem,
  CategoryReportItem,
  ProductReportCalculationService,
  ProductReportKPIs,
  RawOrderInput,
  RawOrderItemInput,
  SingleProductDetailReport,
} from './product-report-calculation.service';
import { ProductReportsExcelService } from './product-reports-excel.service';
import { OrderStatus } from '@prisma/client';

export interface ProductReportFilterDto {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  fromHour?: string; // 0 - 23
  toHour?: string; // 0 - 23
  branchId?: string; // 'ALL' or branch uuid
  categoryId?: string;
  productId?: string;
  orderSource?: string; // ONLINE, POS, WEB, CHATBOT, VOICE, QR_ORDER, ADMIN
  orderType?: string; // DINE_IN, TAKEAWAY, DELIVERY, ONLINE
  orderStatus?: string; // COMPLETED, CANCELLED, etc.
  paymentStatus?: string;
  paymentMethod?: string;
  taxRate?: string;
  vatPriceMode?: string; // VAT_INCLUDED, VAT_EXCLUDED
  isFlashSale?: string; // 'true' | 'false'
  hasVoucher?: string; // 'true' | 'false'
  search?: string;
}

export interface PaginationDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ProductReportsService {
  private readonly logger = new Logger(ProductReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthorizationService,
    private readonly calcEngine: ProductReportCalculationService,
    private readonly excelService: ProductReportsExcelService,
  ) {}

  /**
   * Kiểm tra và áp dụng phân quyền chi nhánh (RBAC)
   */
  async resolveBranchScope(
    userId: string,
    requestedBranchId?: string,
  ): Promise<{ allowedBranchIds: string[]; isAll: boolean }> {
    const permScope = await this.authService.getAllowedBranches(userId, 'reports.products.view');

    if (!permScope.isAll && permScope.branchIds.length === 0) {
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: {
          code: 'FORBIDDEN_REPORT_BRANCH',
          message: 'Bạn không có quyền xem báo cáo tại bất kỳ chi nhánh nào.',
        },
      });
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

    // Người dùng chọn 'ALL' hoặc không chỉ định
    if (permScope.isAll) {
      const allBranches = await this.prisma.branch.findMany({ select: { id: true } });
      return { allowedBranchIds: allBranches.map((b) => b.id), isAll: true };
    }

    // Người dùng có quyền trên một số chi nhánh cụ thể
    return { allowedBranchIds: permScope.branchIds, isAll: false };
  }

  /**
   * Xây dựng mệnh đề WHERE cho Prisma Order & OrderItem
   */
  buildWhereClauses(
    filter: ProductReportFilterDto,
    allowedBranchIds: string[],
  ): {
    orderWhere: any;
    orderItemWhere: any;
  } {
    const orderWhere: any = {};
    const orderItemWhere: any = {};

    // 1. Phân quyền chi nhánh
    orderWhere.branchId = { in: allowedBranchIds };

    // 2. Dải ngày & Khung giờ
    let startDate: Date;
    let endDate: Date;

    if (filter.from) {
      startDate = new Date(filter.from);
      const fromH = filter.fromHour !== undefined ? parseInt(filter.fromHour, 10) : 0;
      startDate.setHours(fromH, 0, 0, 0);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    if (filter.to) {
      endDate = new Date(filter.to);
      const toH = filter.toHour !== undefined ? parseInt(filter.toHour, 10) : 23;
      endDate.setHours(toH, 59, 59, 999);
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    orderWhere.createdAt = { gte: startDate, lte: endDate };

    // 3. Trạng thái đơn hàng (Mặc định: CHỈ LẤY DANH SÁCH ĐƠN HOÀN THÀNH - COMPLETED)
    if (filter.orderStatus && filter.orderStatus !== 'ALL' && filter.orderStatus !== 'VALID') {
      orderWhere.status = filter.orderStatus as OrderStatus;
    } else if (filter.orderStatus === 'ALL') {
      orderWhere.status = {
        notIn: [OrderStatus.CANCELLED, OrderStatus.DRAFT, OrderStatus.HELD],
      };
    } else {
      // Mặc định hoặc 'VALID': Chỉ lấy các đơn đã hoàn tất
      orderWhere.status = OrderStatus.COMPLETED;
    }

    // 4. Kênh bán (Order Source)
    if (filter.orderSource && filter.orderSource !== 'ALL') {
      orderWhere.orderSource = filter.orderSource as any;
    }

    // 5. Loại đơn (Order Type)
    if (filter.orderType && filter.orderType !== 'ALL') {
      orderWhere.orderType = filter.orderType as any;
    }

    // 6. Trạng thái thanh toán
    if (filter.paymentStatus && filter.paymentStatus !== 'ALL') {
      orderWhere.paymentStatus = filter.paymentStatus;
    }

    // 7. Phương thức thanh toán
    if (filter.paymentMethod && filter.paymentMethod !== 'ALL') {
      orderWhere.paymentMethod = filter.paymentMethod;
    }

    // 8. Khuyến mãi / Voucher
    if (filter.hasVoucher === 'true') {
      orderWhere.voucherId = { not: null };
    } else if (filter.hasVoucher === 'false') {
      orderWhere.voucherId = null;
    }

    // 9. Lọc theo Danh mục
    if (filter.categoryId && filter.categoryId !== 'ALL') {
      orderItemWhere.product = { categoryId: filter.categoryId };
    }

    // 10. Lọc theo Sản phẩm
    if (filter.productId && filter.productId !== 'ALL') {
      orderItemWhere.productId = filter.productId;
    }

    // 11. Flash Sale
    if (filter.isFlashSale === 'true') {
      orderItemWhere.isFlashSaleItem = true;
    } else if (filter.isFlashSale === 'false') {
      orderItemWhere.isFlashSaleItem = false;
    }

    // 12. Mức thuế VAT
    if (filter.taxRate !== undefined && filter.taxRate !== 'ALL') {
      const rateVal = parseFloat(filter.taxRate);
      if (!isNaN(rateVal)) {
        orderItemWhere.taxPercentageAtSale = rateVal;
      }
    }

    // 13. Kiểu giá VAT
    if (filter.vatPriceMode && filter.vatPriceMode !== 'ALL') {
      orderItemWhere.vatPriceModeSnapshot = filter.vatPriceMode;
    }

    // 14. Tìm kiếm từ khóa (tên món hoặc mã đơn)
    if (filter.search?.trim()) {
      const term = filter.search.trim();
      orderItemWhere.OR = [
        { product: { name: { contains: term } } },
        { product: { itemCode: { contains: term } } },
        { order: { orderCode: { contains: term } } },
      ];
    }

    // Nối quan hệ order vào orderItemWhere
    orderItemWhere.order = orderWhere;

    return { orderWhere, orderItemWhere };
  }

  /**
   * Tải toàn bộ dữ liệu đơn hàng và OrderItem liên quan từ cơ sở dữ liệu
   */
  private async loadOrdersAndItems(
    orderItemWhere: any,
  ): Promise<{ rawOrders: RawOrderInput[]; rawItems: RawOrderItemInput[] }> {
    const rawOrderItems = await this.prisma.orderItem.findMany({
      where: orderItemWhere,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        selectedOptions: true,
        order: {
          include: {
            branch: true,
            voucher: true,
            shippingVoucher: true,
            table: true,
            payments: {
              include: {
                refunds: true,
              },
            },
            serviceCharges: true,
          },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
    });

    const orderMap = new Map<string, RawOrderInput>();
    const typedItems: RawOrderItemInput[] = [];

    for (const it of rawOrderItems) {
      if (it.order && !orderMap.has(it.order.id)) {
        orderMap.set(it.order.id, it.order as any);
      }
      typedItems.push(it as any);
    }

    return {
      rawOrders: Array.from(orderMap.values()),
      rawItems: typedItems,
    };
  }

  /**
   * Chạy Calculation Engine trên tập dữ liệu đã tải
   */
  private processCalculations(
    rawOrders: RawOrderInput[],
    rawItems: RawOrderItemInput[],
  ): {
    calculatedItems: CalculatedOrderItem[];
    kpis: ProductReportKPIs;
  } {
    // 1. Phân nhóm các item theo orderId để phân bổ discount chính xác
    const orderItemsMap = new Map<string, RawOrderItemInput[]>();
    for (const item of rawItems) {
      if (!orderItemsMap.has(item.orderId)) {
        orderItemsMap.set(item.orderId, []);
      }
      orderItemsMap.get(item.orderId)!.push(item);
    }

    // 2. Chạy phân bổ voucher discount và tính toán tài chính từng item
    const calculatedItems: CalculatedOrderItem[] = [];

    for (const order of rawOrders) {
      const itemsInOrder = orderItemsMap.get(order.id) || [];
      if (itemsInOrder.length === 0) continue;

      const allocatedDiscounts = this.calcEngine.allocateOrderDiscount(
        itemsInOrder,
        order.discountAmount,
        order.voucher,
      );

      itemsInOrder.forEach((item, idx) => {
        const allocated = allocatedDiscounts[idx] || 0;
        const calculated = this.calcEngine.calculateOrderItemFinancials(
          item,
          allocated,
          (order.vatPriceModeSnapshot as any) || 'VAT_INCLUDED',
        );
        calculatedItems.push(calculated);
      });
    }

    // 3. Tính toán 19 KPIs tổng quan
    const kpis = this.calcEngine.calculateReportKPIs(calculatedItems, rawOrders);

    return { calculatedItems, kpis };
  }

  /**
   * API 1: /admin/reports/products/overview
   * Báo cáo tổng hợp danh mục + mặt hàng (KPIs, Charts, Tree Table)
   */
  async getProductReportOverview(
    filter: ProductReportFilterDto,
    userId: string,
  ): Promise<{
    kpis: ProductReportKPIs;
    charts: {
      categoryRevenueChart: { categoryName: string; revenue: number; quantity: number }[];
      topProductsRevenue: { productName: string; revenue: number; quantity: number; imageUrl: string | null }[];
      topProductsQuantity: { productName: string; quantity: number; revenue: number; imageUrl: string | null }[];
      salesTrend: { period: string; grossSales: number; netRevenue: number; taxAmount: number; quantity: number }[];
      salesByBranch: { branchName: string; revenue: number; quantity: number }[];
      salesByChannel: { channel: string; revenue: number; quantity: number }[];
      salesByOrderType: { orderType: string; revenue: number; quantity: number }[];
      vatBreakdown: { rateDisplay: string; modeDisplay: string; taxableAmount: number; taxAmount: number; totalRevenue: number; quantity: number }[];
    };
    categoryTree: CategoryReportItem[];
    totalProductsCount: number;
    totalCategoriesCount: number;
  }> {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const { orderItemWhere } = this.buildWhereClauses(filter, allowedBranchIds);

    const { rawOrders, rawItems } = await this.loadOrdersAndItems(orderItemWhere);
    const { calculatedItems, kpis } = this.processCalculations(rawOrders, rawItems);

    // Xây dựng cây Danh mục & Mặt hàng
    const categoryTree = this.calcEngine.buildCategoryAndProductTree(
      calculatedItems,
      kpis.totalSoldQuantity,
      kpis.productRevenueWithTax,
    );

    // Charts 1: Phân bổ theo Danh mục (Category Chart)
    const categoryRevenueChart = categoryTree.map((c) => ({
      categoryName: c.categoryName,
      revenue: c.revenueWithTax,
      quantity: c.soldQuantity,
    }));

    // Charts 2: Top 10 sản phẩm doanh thu & số lượng
    const allProductsFlat = categoryTree.flatMap((c) => c.products);
    const topProductsRevenue = [...allProductsFlat]
      .sort((a, b) => b.revenueWithTax - a.revenueWithTax)
      .slice(0, 10)
      .map((p) => ({
        productName: p.productName,
        revenue: p.revenueWithTax,
        quantity: p.soldQuantity,
        imageUrl: p.productImageUrl,
      }));

    const topProductsQuantity = [...allProductsFlat]
      .sort((a, b) => b.soldQuantity - a.soldQuantity)
      .slice(0, 10)
      .map((p) => ({
        productName: p.productName,
        quantity: p.soldQuantity,
        revenue: p.revenueWithTax,
        imageUrl: p.productImageUrl,
      }));

    // Charts 3: Xu hướng doanh thu theo thời gian (Trend)
    const trendMap = new Map<
      string,
      { grossSales: number; netRevenue: number; taxAmount: number; quantity: number }
    >();

    for (const it of calculatedItems) {
      const d = it.createdAt;
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, { grossSales: 0, netRevenue: 0, taxAmount: 0, quantity: 0 });
      }
      const tr = trendMap.get(dateKey)!;
      tr.grossSales += it.grossLineTotal;
      tr.netRevenue += it.revenueWithTax;
      tr.taxAmount += it.taxAmount;
      tr.quantity += it.quantity;
    }

    const salesTrend = Array.from(trendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, val]) => ({
        period,
        grossSales: val.grossSales,
        netRevenue: val.netRevenue,
        taxAmount: val.taxAmount,
        quantity: val.quantity,
      }));

    // Charts 4: Phân bổ theo Chi nhánh
    const branchMap = new Map<string, { revenue: number; quantity: number }>();
    for (const it of calculatedItems) {
      const bName = it.branchName;
      if (!branchMap.has(bName)) branchMap.set(bName, { revenue: 0, quantity: 0 });
      const b = branchMap.get(bName)!;
      b.revenue += it.revenueWithTax;
      b.quantity += it.quantity;
    }
    const salesByBranch = Array.from(branchMap.entries()).map(([branchName, val]) => ({
      branchName,
      revenue: val.revenue,
      quantity: val.quantity,
    }));

    // Charts 5: Phân bổ theo Kênh bán (Channel)
    const channelMap = new Map<string, { revenue: number; quantity: number }>();
    for (const it of calculatedItems) {
      const ch = it.orderSource;
      if (!channelMap.has(ch)) channelMap.set(ch, { revenue: 0, quantity: 0 });
      const c = channelMap.get(ch)!;
      c.revenue += it.revenueWithTax;
      c.quantity += it.quantity;
    }
    const salesByChannel = Array.from(channelMap.entries()).map(([channel, val]) => ({
      channel,
      revenue: val.revenue,
      quantity: val.quantity,
    }));

    // Charts 6: Phân bổ theo Loại đơn (Order Type)
    const typeMap = new Map<string, { revenue: number; quantity: number }>();
    for (const it of calculatedItems) {
      const t = it.orderType;
      if (!typeMap.has(t)) typeMap.set(t, { revenue: 0, quantity: 0 });
      const o = typeMap.get(t)!;
      o.revenue += it.revenueWithTax;
      o.quantity += it.quantity;
    }
    const salesByOrderType = Array.from(typeMap.entries()).map(([orderType, val]) => ({
      orderType,
      revenue: val.revenue,
      quantity: val.quantity,
    }));

    // Charts 7: Phân rã VAT
    const vatMap = new Map<
      string,
      {
        rateDisplay: string;
        modeDisplay: string;
        taxableAmount: number;
        taxAmount: number;
        totalRevenue: number;
        quantity: number;
      }
    >();

    for (const it of calculatedItems) {
      const k = `${it.taxPercentage}_${it.vatPriceMode}`;
      if (!vatMap.has(k)) {
        vatMap.set(k, {
          rateDisplay: `${it.taxPercentage}%`,
          modeDisplay: it.isVatInclusive ? 'Giá gồm VAT' : 'Giá chưa VAT',
          taxableAmount: 0,
          taxAmount: 0,
          totalRevenue: 0,
          quantity: 0,
        });
      }
      const v = vatMap.get(k)!;
      v.taxableAmount += it.taxableAmount;
      v.taxAmount += it.taxAmount;
      v.totalRevenue += it.revenueWithTax;
      v.quantity += it.quantity;
    }

    const vatBreakdown = Array.from(vatMap.values());

    return {
      kpis,
      charts: {
        categoryRevenueChart,
        topProductsRevenue,
        topProductsQuantity,
        salesTrend,
        salesByBranch,
        salesByChannel,
        salesByOrderType,
        vatBreakdown,
      },
      categoryTree,
      totalProductsCount: allProductsFlat.length,
      totalCategoriesCount: categoryTree.length,
    };
  }

  /**
   * API 2: /admin/reports/products/:productId
   * Báo cáo chuyên sâu 1 mặt hàng (Price, VAT, Options, Branch, Channel, OrderType, Trend)
   */
  async getProductDetailReport(
    productId: string,
    filter: ProductReportFilterDto,
    userId: string,
    trendGrouping: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<SingleProductDetailReport> {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: `Không tìm thấy sản phẩm có ID: ${productId}`,
        },
      });
    }

    const singleFilter = { ...filter, productId };
    const { orderItemWhere } = this.buildWhereClauses(singleFilter, allowedBranchIds);

    const { rawOrders, rawItems } = await this.loadOrdersAndItems(orderItemWhere);
    const { calculatedItems } = this.processCalculations(rawOrders, rawItems);

    return this.calcEngine.buildSingleProductDeepDive(
      product as any,
      calculatedItems,
      rawOrders,
      trendGrouping,
    );
  }

  /**
   * API 3: /admin/reports/products/:productId/transactions
   * Lịch sử giao dịch OrderItem (Server-side Pagination, Sort, Search)
   */
  async getProductTransactions(
    productId: string,
    filter: ProductReportFilterDto,
    pagination: PaginationDto,
    userId: string,
  ): Promise<{
    transactions: CalculatedOrderItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const singleFilter = { ...filter, productId };
    const { orderItemWhere } = this.buildWhereClauses(singleFilter, allowedBranchIds);

    const { rawOrders, rawItems } = await this.loadOrdersAndItems(orderItemWhere);
    const { calculatedItems } = this.processCalculations(rawOrders, rawItems);

    // Sắp xếp
    const sortBy = pagination.sortBy || 'createdAt';
    const sortOrder = pagination.sortOrder || 'desc';

    calculatedItems.sort((a: any, b: any) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    const page = Math.max(1, Number(pagination.page || 1));
    const limit = Math.max(1, Math.min(100, Number(pagination.limit || 20)));
    const total = calculatedItems.length;
    const totalPages = Math.ceil(total / limit) || 1;

    const startIndex = (page - 1) * limit;
    const paginatedItems = calculatedItems.slice(startIndex, startIndex + limit);

    return {
      transactions: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * API 4: Xuất Excel Báo cáo Tổng hợp Danh mục + Mặt hàng
   */
  async exportProductReportExcel(filter: ProductReportFilterDto, userId: string): Promise<Buffer> {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const { orderItemWhere } = this.buildWhereClauses(filter, allowedBranchIds);

    const { rawOrders, rawItems } = await this.loadOrdersAndItems(orderItemWhere);
    const { calculatedItems, kpis } = this.processCalculations(rawOrders, rawItems);

    const categories = this.calcEngine.buildCategoryAndProductTree(
      calculatedItems,
      kpis.totalSoldQuantity,
      kpis.productRevenueWithTax,
    );

    const filterDesc: Record<string, string> = {
      'Thời gian': `${filter.from || '30 ngày trước'} đến ${filter.to || 'Hôm nay'}`,
      'Chi nhánh': filter.branchId === 'ALL' || !filter.branchId ? 'Tất cả chi nhánh được phép' : filter.branchId,
      'Kênh bán': filter.orderSource || 'Tất cả kênh',
      'Loại đơn': filter.orderType || 'Tất cả loại',
      'Trạng thái đơn': filter.orderStatus || 'Đơn hợp lệ (loại CANCELLED/DRAFT)',
    };

    return this.excelService.exportProductReportWorkbook({
      kpis,
      categories,
      items: calculatedItems,
      filterDescription: filterDesc,
    });
  }

  /**
   * API 5: Xuất Excel Báo cáo Chi tiết 1 Mặt hàng
   */
  async exportSingleProductExcel(
    productId: string,
    filter: ProductReportFilterDto,
    userId: string,
  ): Promise<Buffer> {
    const detail = await this.getProductDetailReport(productId, filter, userId);
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const singleFilter = { ...filter, productId };
    const { orderItemWhere } = this.buildWhereClauses(singleFilter, allowedBranchIds);

    const { rawOrders, rawItems } = await this.loadOrdersAndItems(orderItemWhere);
    const { calculatedItems } = this.processCalculations(rawOrders, rawItems);

    const filterDesc: Record<string, string> = {
      'Thời gian': `${filter.from || '30 ngày trước'} đến ${filter.to || 'Hôm nay'}`,
      'Sản phẩm': detail.currentProductInfo.name,
      'Mã hàng': detail.currentProductInfo.itemCode,
    };

    return this.excelService.exportSingleProductWorkbook({
      detail,
      items: calculatedItems,
      filterDescription: filterDesc,
    });
  }

  /**
   * API 6: Metadata phục vụ dropdown filters
   */
  async getFilterMetadata(userId: string) {
    const { allowedBranchIds, isAll } = await this.resolveBranchScope(userId, 'ALL');

    const [branches, categories] = await Promise.all([
      this.prisma.branch.findMany({
        where: isAll ? {} : { id: { in: allowedBranchIds } },
        select: { id: true, name: true, branchCode: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    return {
      branches,
      categories,
      orderSources: ['ONLINE', 'POS', 'WEB', 'CHATBOT', 'VOICE', 'QR_ORDER', 'ADMIN'],
      orderTypes: ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ONLINE'],
      orderStatuses: ['COMPLETED', 'PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERING', 'CANCELLED'],
      paymentStatuses: ['COMPLETED', 'PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED'],
      paymentMethods: ['CASH', 'CARD', 'TRANSFER', 'PAYOS', 'MOMO', 'VNPAY', 'POINT', 'COD'],
      vatRates: [0, 5, 8, 10],
      vatPriceModes: [
        { label: 'Giá đã gồm VAT', value: 'VAT_INCLUDED' },
        { label: 'Giá chưa gồm VAT', value: 'VAT_EXCLUDED' },
      ],
    };
  }
}
