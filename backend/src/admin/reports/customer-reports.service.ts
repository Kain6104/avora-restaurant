import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { OrderStatus, RoleType } from '@prisma/client';
import {
  CustomerReportCalculationService,
  CustomerProfileInput,
  CustomerOrderHistoryItem,
  CalculatedCustomerKPIs,
  CustomerRFMSegmentItem,
  CustomerCohortRetentionRow,
  CalculatedTopCustomerItem,
  CustomerFrequencyDistributionItem,
} from './customer-report-calculation.service';
import { CustomerReportsExcelService } from './customer-reports-excel.service';

export interface CustomerReportFilterDto {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  branchId?: string; // 'ALL' or specific branch UUID
  membershipTierId?: string;
  segment?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CustomerPaginationDto {
  page?: number;
  limit?: number;
  search?: string;
  tierId?: string;
  segment?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class CustomerReportsService {
  private readonly logger = new Logger(CustomerReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthorizationService,
    private readonly calcEngine: CustomerReportCalculationService,
    private readonly excelService: CustomerReportsExcelService,
  ) {}

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
            code: 'FORBIDDEN_CUSTOMER_REPORT_BRANCH',
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo khách hàng tại bất kỳ chi nhánh nào.',
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

  private async fetchCustomerProfilesWithCompletedOrders(
    allowedBranchIds: string[],
  ): Promise<CustomerProfileInput[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: RoleType.USER,
      },
      include: {
        membershipTier: { select: { name: true } },
        orders: {
          where: {
            status: OrderStatus.COMPLETED,
            branchId: { in: allowedBranchIds },
          },
          include: {
            branch: { select: { name: true } },
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      phone: u.phone,
      email: u.email,
      memberCode: u.memberCode,
      membershipTierId: u.membershipTierId,
      membershipTierName: u.membershipTier?.name,
      createdAt: u.createdAt,
      completedOrders: u.orders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        userId: o.userId,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        subTotal: Number(o.subTotal) || 0,
        totalAmount: Number(o.totalAmount) || 0,
        discountAmount: Number(o.discountAmount) || 0,
        shippingDiscount: Number(o.shippingDiscount) || 0,
        shippingFee: Number(o.shippingFee) || 0,
        taxAmount: Number(o.taxAmount) || 0,
        branchId: o.branchId,
        branchName: o.branch?.name,
        orderSource: o.orderSource,
        orderType: o.orderType,
        paymentMethod: o.paymentMethod,
        voucherId: o.voucherId,
        pointsUsed: Number(o.pointsUsed) || 0,
        pointsAwarded: Number(o.pointsAwarded) || 0,
        deliveredAt: o.deliveredAt,
        createdAt: o.createdAt,
      })),
    }));
  }

  async getOverview(userId: string, filter: CustomerReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const customers = await this.fetchCustomerProfilesWithCompletedOrders(allowedBranchIds);

    const fromDate = filter.from ? new Date(filter.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = filter.to ? new Date(filter.to) : new Date();

    const kpis = this.calcEngine.calculateCustomerKPIs(customers, fromDate, toDate);
    const frequency = this.calcEngine.calculateFrequencyDistribution(customers);

    return {
      success: true,
      data: {
        kpis,
        frequency,
        dateRange: { from: filter.from, to: filter.to },
      },
    };
  }

  async getSegments(userId: string, filter: CustomerReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const customers = await this.fetchCustomerProfilesWithCompletedOrders(allowedBranchIds);

    const segments = this.calcEngine.calculateRFMSegments(customers, new Date());

    return {
      success: true,
      data: segments,
    };
  }

  async getCohorts(userId: string, filter: CustomerReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const customers = await this.fetchCustomerProfilesWithCompletedOrders(allowedBranchIds);

    const cohorts = this.calcEngine.calculateCohortRetention(customers);

    return {
      success: true,
      data: cohorts,
    };
  }

  async getTopCustomers(
    userId: string,
    filter: CustomerReportFilterDto,
    pagination: CustomerPaginationDto,
  ) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const customers = await this.fetchCustomerProfilesWithCompletedOrders(allowedBranchIds);

    let top = this.calcEngine.calculateTopCustomers(customers, new Date());

    // Filter by tier
    if (filter.membershipTierId && filter.membershipTierId !== 'ALL') {
      top = top.filter((c) => c.membershipTier === filter.membershipTierId);
    }

    // Filter by segment
    if (filter.segment && filter.segment !== 'ALL') {
      top = top.filter((c) => c.analyticalSegment.includes(filter.segment!));
    }

    // Search by name, phone, email, memberCode
    if (pagination.search && pagination.search.trim()) {
      const q = pagination.search.trim().toLowerCase();
      top = top.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.memberCode && c.memberCode.toLowerCase().includes(q)),
      );
    }

    // Sort
    const sortBy = pagination.sortBy || 'lifetimeNetSpend';
    const isAsc = pagination.sortOrder === 'asc';
    top.sort((a: any, b: any) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      return isAsc ? valA - valB : valB - valA;
    });

    const total = top.length;
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;
    const paginatedItems = top.slice(skip, skip + limit);

    return {
      success: true,
      data: paginatedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCustomerDetail(userId: string, customerId: string) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      include: {
        membershipTier: true,
        orders: {
          where: {
            status: OrderStatus.COMPLETED,
            branchId: { in: allowedBranchIds },
          },
          orderBy: { deliveredAt: 'desc' },
          include: {
            branch: { select: { name: true } },
            orderItems: {
              include: {
                product: { select: { name: true, category: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Không tìm thấy khách hàng' },
      });
    }

    let grossSpend = 0;
    let totalDiscount = 0;
    let netSpend = 0;
    const branchCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const productCounts = new Map<string, number>();
    const paymentCounts = new Map<string, number>();

    for (const o of user.orders) {
      const gross = Number(o.subTotal) || 0;
      const disc = Number(o.discountAmount) || 0;
      const net = Number(o.totalAmount) || 0;

      grossSpend += gross;
      totalDiscount += disc;
      netSpend += net;

      const bName = o.branch?.name || o.branchId;
      branchCounts.set(bName, (branchCounts.get(bName) || 0) + 1);

      paymentCounts.set(o.paymentMethod, (paymentCounts.get(o.paymentMethod) || 0) + 1);

      for (const it of o.orderItems) {
        const pName = it.product?.name || 'Món';
        productCounts.set(pName, (productCounts.get(pName) || 0) + it.quantity);
        const cName = it.product?.category?.name || 'Chung';
        categoryCounts.set(cName, (categoryCounts.get(cName) || 0) + it.quantity);
      }
    }

    const orderCount = user.orders.length;
    const aov = orderCount > 0 ? Math.round(netSpend / orderCount) : 0;

    const favoriteBranch = Array.from(branchCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const favoriteCategory = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const topProducts = Array.from(productCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));
    const preferredPayment = Array.from(paymentCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    return {
      success: true,
      data: {
        profile: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          memberCode: user.memberCode,
          tierName: user.membershipTier?.name || 'Tiêu chuẩn',
          registeredAt: user.createdAt,
        },
        metrics: {
          completedOrdersCount: orderCount,
          grossSpend,
          totalDiscount,
          netSpend,
          aov,
          favoriteBranch,
          favoriteCategory,
          preferredPayment,
          topProducts,
        },
        recentOrders: user.orders.slice(0, 10).map((o) => ({
          id: o.id,
          orderCode: o.orderCode,
          branchName: o.branch?.name,
          completedAt: o.deliveredAt || o.createdAt,
          subTotal: Number(o.subTotal),
          discountAmount: Number(o.discountAmount),
          totalAmount: Number(o.totalAmount),
          paymentMethod: o.paymentMethod,
        })),
      },
    };
  }

  async exportExcel(userId: string, filter: CustomerReportFilterDto): Promise<Buffer> {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);
    const customers = await this.fetchCustomerProfilesWithCompletedOrders(allowedBranchIds);

    const fromDate = filter.from ? new Date(filter.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = filter.to ? new Date(filter.to) : new Date();

    const kpis = this.calcEngine.calculateCustomerKPIs(customers, fromDate, toDate);
    const segments = this.calcEngine.calculateRFMSegments(customers, new Date());
    const cohorts = this.calcEngine.calculateCohortRetention(customers);
    const top = this.calcEngine.calculateTopCustomers(customers, new Date());
    const frequency = this.calcEngine.calculateFrequencyDistribution(customers);

    let branchName = 'Toàn hệ thống';
    if (filter.branchId && filter.branchId !== 'ALL') {
      const b = await this.prisma.branch.findUnique({
        where: { id: filter.branchId },
        select: { name: true },
      });
      if (b) branchName = b.name;
    }

    return this.excelService.exportCustomerExcel(
      kpis,
      segments,
      cohorts,
      top,
      frequency,
      branchName,
      filter.from,
      filter.to,
    );
  }
}
