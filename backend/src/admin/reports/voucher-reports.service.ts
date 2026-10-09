import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { OrderStatus } from '@prisma/client';
import {
  VoucherReportCalculationService,
  VoucherOrderInput,
  VoucherMetadataInput,
  CalculatedVoucherKPIs,
  CalculatedVoucherPerformanceItem,
  VoucherFraudSignalItem,
} from './voucher-report-calculation.service';
import { VoucherReportsExcelService } from './voucher-reports-excel.service';

export interface VoucherReportFilterDto {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  branchId?: string; // 'ALL' or specific branch UUID
  voucherId?: string;
  orderSource?: string;
  orderType?: string;
  discountType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface VoucherPaginationDto {
  page?: number;
  limit?: number;
  search?: string;
  voucherId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class VoucherReportsService {
  private readonly logger = new Logger(VoucherReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthorizationService,
    private readonly calcEngine: VoucherReportCalculationService,
    private readonly excelService: VoucherReportsExcelService,
  ) {}

  /**
   * Phân quyền phạm vi chi nhánh (RBAC)
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
            code: 'FORBIDDEN_VOUCHER_REPORT_BRANCH',
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo voucher tại bất kỳ chi nhánh nào.',
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
   * Xây dựng WHERE clause tuân thủ nghiêm ngặt:
   * 1. CARDINAL RULE: CHỈ LẤY ĐƠN ĐÃ HOÀN THÀNH (COMPLETED)
   * 2. Ưu tiên deliveredAt, fallback createdAt
   */
  buildOrderWhereClause(filter: VoucherReportFilterDto, allowedBranchIds: string[]): any {
    const where: any = {};

    // 1. BẮT BUỘC: ĐƠN COMPLETED
    where.status = OrderStatus.COMPLETED;

    // 2. Chi nhánh được phép
    where.branchId = { in: allowedBranchIds };

    // 3. Dải ngày
    let startDate: Date;
    let endDate: Date;

    if (filter.from && filter.to) {
      startDate = new Date(filter.from);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(filter.to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    where.OR = [
      {
        deliveredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      {
        deliveredAt: null,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    ];

    // 4. Bộ lọc nguồn đơn / loại đơn
    if (filter.orderSource && filter.orderSource !== 'ALL') {
      where.orderSource = filter.orderSource as any;
    }
    if (filter.orderType && filter.orderType !== 'ALL') {
      where.orderType = filter.orderType as any;
    }

    return where;
  }

  private async fetchCompletedOrders(whereClause: any): Promise<VoucherOrderInput[]> {
    const orders = await this.prisma.order.findMany({
      where: whereClause,
      include: {
        branch: { select: { name: true } },
      },
    });

    return orders.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      branchId: o.branchId,
      branchName: o.branch?.name,
      userId: o.userId,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      subTotal: Number(o.subTotal) || 0,
      totalAmount: Number(o.totalAmount) || 0,
      discountAmount: Number(o.discountAmount) || 0,
      shippingDiscount: Number(o.shippingDiscount) || 0,
      shippingFee: Number(o.shippingFee) || 0,
      pointsUsed: Number(o.pointsUsed) || 0,
      taxAmount: Number(o.taxAmount) || 0,
      voucherId: o.voucherId,
      shippingVoucherId: o.shippingVoucherId,
      discountVoucherCodeSnapshot: o.discountVoucherCodeSnapshot,
      shippingVoucherCodeSnapshot: o.shippingVoucherCodeSnapshot,
      paymentMethod: o.paymentMethod,
      orderSource: o.orderSource,
      deliveredAt: o.deliveredAt,
      createdAt: o.createdAt,
      status: o.status,
    }));
  }

  private async fetchVouchersConfig(): Promise<VoucherMetadataInput[]> {
    const vouchers = await this.prisma.voucher.findMany();

    return vouchers.map((v) => ({
      id: v.id,
      code: v.code,
      title: v.title,
      discountType: v.discountType,
      discountValue: Number(v.discountValue) || 0,
      maxDiscount: v.maxDiscount ? Number(v.maxDiscount) : null,
      minOrderValue: Number(v.minOrderValue) || 0,
      isFirstOrderOnly: v.isFirstOrderOnly,
      usageLimit: v.usageLimit,
      usageLimitPerUser: v.usageLimitPerUser,
      usedCount: v.usedCount,
      isPublic: v.isPublic,
      applicableScope: v.applicableScope,
      applicableProductsScope: v.applicableProductsScope,
      startDate: v.startDate,
      endDate: v.endDate,
      isActive: v.isActive,
    }));
  }

  /**
   * API 1: KPI Tổng quan Voucher & Khuyến mãi
   */
  async getOverview(userId: string, filter: VoucherReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const where = this.buildOrderWhereClause(filter, allowedBranchIds);

    const [orders, vouchers] = await Promise.all([
      this.fetchCompletedOrders(where),
      this.fetchVouchersConfig(),
    ]);

    const fraudSignals = this.calcEngine.detectVoucherFraudSignals(orders, vouchers);
    const kpis = this.calcEngine.calculateVoucherKPIs(orders, orders, fraudSignals);

    return {
      success: true,
      data: {
        kpis,
        totalCompletedOrdersInDataset: orders.length,
        vouchersCount: vouchers.length,
        dateRange: { from: filter.from, to: filter.to },
      },
    };
  }

  /**
   * API 2: Bảng hiệu suất từng voucher
   */
  async getPerformance(userId: string, filter: VoucherReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const where = this.buildOrderWhereClause(filter, allowedBranchIds);

    const [orders, vouchers] = await Promise.all([
      this.fetchCompletedOrders(where),
      this.fetchVouchersConfig(),
    ]);

    const fraudSignals = this.calcEngine.detectVoucherFraudSignals(orders, vouchers);
    let performance = this.calcEngine.calculateVoucherPerformance(vouchers, orders, fraudSignals);

    // Filter by voucherId if requested
    if (filter.voucherId && filter.voucherId !== 'ALL') {
      performance = performance.filter((p) => p.voucherId === filter.voucherId || p.code === filter.voucherId);
    }

    // Filter by discountType
    if (filter.discountType && filter.discountType !== 'ALL') {
      performance = performance.filter((p) => p.discountType === filter.discountType);
    }

    // Search by code or title
    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      performance = performance.filter(
        (p) => p.code.toLowerCase().includes(q) || p.title.toLowerCase().includes(q),
      );
    }

    // Sort
    const sortBy = filter.sortBy || 'revenue';
    const isAsc = filter.sortOrder === 'asc';
    performance.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      switch (sortBy) {
        case 'revenue':
          valA = a.grossRevenue;
          valB = b.grossRevenue;
          break;
        case 'net':
          valA = a.netRevenue;
          valB = b.netRevenue;
          break;
        case 'discount':
          valA = a.totalDiscountCost;
          valB = b.totalDiscountCost;
          break;
        case 'uses':
          valA = a.completedUses;
          valB = b.completedUses;
          break;
        case 'users':
          valA = a.uniqueUsers;
          valB = b.uniqueUsers;
          break;
        case 'aov':
          valA = a.aov;
          valB = b.aov;
          break;
        default:
          valA = a.grossRevenue;
          valB = b.grossRevenue;
      }
      return isAsc ? valA - valB : valB - valA;
    });

    return {
      success: true,
      data: performance,
    };
  }

  /**
   * API 3: Danh sách giao dịch đơn hàng có voucher (Server-side pagination)
   */
  async getTransactions(
    userId: string,
    filter: VoucherReportFilterDto,
    pagination: VoucherPaginationDto,
  ) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const where = this.buildOrderWhereClause(filter, allowedBranchIds);

    // Chỉ lấy đơn có voucher
    where.OR = [
      { voucherId: { not: null } },
      { shippingVoucherId: { not: null } },
      { discountVoucherCodeSnapshot: { not: null } },
      { shippingVoucherCodeSnapshot: { not: null } },
    ];

    if (pagination.voucherId && pagination.voucherId !== 'ALL') {
      where.OR = [
        { voucherId: pagination.voucherId },
        { shippingVoucherId: pagination.voucherId },
        { discountVoucherCodeSnapshot: pagination.voucherId },
      ];
    }

    if (pagination.search && pagination.search.trim()) {
      const q = pagination.search.trim();
      where.AND = [
        {
          OR: [
            { orderCode: { contains: q } },
            { customerPhone: { contains: q } },
            { customerName: { contains: q } },
            { discountVoucherCodeSnapshot: { contains: q } },
          ],
        },
      ];
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deliveredAt: 'desc' },
        include: {
          branch: { select: { name: true } },
        },
      }),
    ]);

    return {
      success: true,
      data: orders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        customerName: o.customerName || 'Khách vãng lai',
        customerPhone: o.customerPhone || '—',
        branchName: o.branch?.name || o.branchId,
        voucherCode: o.discountVoucherCodeSnapshot || o.shippingVoucherCodeSnapshot || 'VOUCHER',
        orderSource: o.orderSource,
        paymentMethod: o.paymentMethod,
        subTotal: Number(o.subTotal) || 0,
        discountAmount: Number(o.discountAmount) || 0,
        shippingDiscount: Number(o.shippingDiscount) || 0,
        pointsUsed: Number(o.pointsUsed) || 0,
        taxAmount: Number(o.taxAmount) || 0,
        totalAmount: Number(o.totalAmount) || 0,
        completedAt: o.deliveredAt || o.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * API 4: Dấu hiệu bất thường / nghi ngờ gian lận voucher
   */
  async getFraudSignals(userId: string, filter: VoucherReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const where = this.buildOrderWhereClause(filter, allowedBranchIds);

    const [orders, vouchers] = await Promise.all([
      this.fetchCompletedOrders(where),
      this.fetchVouchersConfig(),
    ]);

    const signals = this.calcEngine.detectVoucherFraudSignals(orders, vouchers);

    return {
      success: true,
      data: signals,
      meta: {
        totalSignals: signals.length,
        highRiskCount: signals.filter((s) => s.severity === 'HIGH').length,
        mediumRiskCount: signals.filter((s) => s.severity === 'MEDIUM').length,
      },
    };
  }

  /**
   * API 5: Deep-dive chi tiết một Voucher
   */
  async getVoucherDeepDive(userId: string, voucherId: string, filter: VoucherReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);

    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      include: {
        branches: { select: { id: true, name: true } },
        membershipTiers: { select: { id: true, name: true } },
      },
    });

    if (!voucher) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'VOUCHER_NOT_FOUND', message: 'Không tìm thấy voucher' },
      });
    }

    const where = this.buildOrderWhereClause(filter, allowedBranchIds);
    where.OR = [
      { voucherId: voucher.id },
      { shippingVoucherId: voucher.id },
      { discountVoucherCodeSnapshot: voucher.code },
      { shippingVoucherCodeSnapshot: voucher.code },
    ];

    const completedOrders = await this.fetchCompletedOrders(where);

    let grossRevenue = 0;
    let discountCost = 0;
    let shippingDiscount = 0;
    const userKeys = new Set<string>();
    const branchBreakdown = new Map<string, { branchName: string; count: number; revenue: number }>();

    for (const o of completedOrders) {
      grossRevenue += o.subTotal;
      discountCost += o.discountAmount;
      shippingDiscount += o.shippingDiscount;
      const uKey = o.customerPhone || o.customerName || o.id;
      userKeys.add(uKey);

      const bName = o.branchName || o.branchId;
      if (!branchBreakdown.has(bName)) {
        branchBreakdown.set(bName, { branchName: bName, count: 0, revenue: 0 });
      }
      const bItem = branchBreakdown.get(bName)!;
      bItem.count += 1;
      bItem.revenue += o.subTotal;
    }

    const completedCount = completedOrders.length;
    const aov = completedCount > 0 ? Math.round(grossRevenue / completedCount) : 0;
    const netRevenue = Math.max(0, grossRevenue - discountCost);
    const ratio = discountCost > 0 ? Number((grossRevenue / discountCost).toFixed(2)) : 0;

    return {
      success: true,
      data: {
        voucher: {
          id: voucher.id,
          code: voucher.code,
          title: voucher.title,
          description: voucher.description,
          discountType: voucher.discountType,
          discountValue: Number(voucher.discountValue),
          maxDiscount: voucher.maxDiscount ? Number(voucher.maxDiscount) : null,
          minOrderValue: Number(voucher.minOrderValue),
          startDate: voucher.startDate,
          endDate: voucher.endDate,
          usageLimit: voucher.usageLimit,
          usageLimitPerUser: voucher.usageLimitPerUser,
          usedCount: voucher.usedCount,
          isFirstOrderOnly: voucher.isFirstOrderOnly,
          isActive: voucher.isActive,
          applicableScope: voucher.applicableScope,
          scopes: {
            branches: voucher.branches.map((b) => b.name),
            tiers: voucher.membershipTiers.map((t) => t.name),
          },
        },
        performance: {
          completedRedemptions: completedCount,
          uniqueUsers: userKeys.size,
          grossRevenue,
          discountCost,
          shippingDiscount,
          netRevenue,
          aov,
          revenueToDiscountRatio: ratio,
        },
        branchBreakdown: Array.from(branchBreakdown.values()),
        funnelNotice: 'Phễu lượt áp dụng (Impression -> Applied -> Completed) yêu cầu bổ sung Event Tracking phía Client',
      },
    };
  }

  /**
   * API 6: Xuất Excel đa trang Báo cáo Voucher
   */
  async exportExcel(userId: string, filter: VoucherReportFilterDto): Promise<Buffer> {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const where = this.buildOrderWhereClause(filter, allowedBranchIds);

    const [orders, vouchers] = await Promise.all([
      this.fetchCompletedOrders(where),
      this.fetchVouchersConfig(),
    ]);

    const fraudSignals = this.calcEngine.detectVoucherFraudSignals(orders, vouchers);
    const kpis = this.calcEngine.calculateVoucherKPIs(orders, orders, fraudSignals);
    const performance = this.calcEngine.calculateVoucherPerformance(vouchers, orders, fraudSignals);

    let branchName = 'Toàn hệ thống';
    if (filter.branchId && filter.branchId !== 'ALL') {
      const b = await this.prisma.branch.findUnique({
        where: { id: filter.branchId },
        select: { name: true },
      });
      if (b) branchName = b.name;
    }

    return this.excelService.exportVoucherExcel(
      kpis,
      performance,
      orders,
      fraudSignals,
      branchName,
      filter.from,
      filter.to,
    );
  }
}
