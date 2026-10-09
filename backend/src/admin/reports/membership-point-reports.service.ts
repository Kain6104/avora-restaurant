import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { OrderStatus, PointTransactionSource, RoleType } from '@prisma/client';
import {
  MembershipPointCalculationService,
  MembershipTierInput,
  UserPointSnapshotInput,
  MembershipOrderInput,
  PointTransactionInput,
  CalculatedMembershipKPIs,
  CalculatedTierPerformanceItem,
  CalculatedPointDynamicsItem,
  CalculatedPointLiabilityItem,
  PointLedgerReconciliationItem,
} from './membership-point-calculation.service';
import { MembershipPointReportsExcelService } from './membership-point-reports-excel.service';

export interface MembershipReportFilterDto {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  branchId?: string; // 'ALL' or specific branch UUID
  tierId?: string;
  sourceType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PointTransactionPaginationDto {
  page?: number;
  limit?: number;
  search?: string;
  source?: string;
  tierId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class MembershipPointReportsService {
  private readonly logger = new Logger(MembershipPointReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthorizationService,
    private readonly calcEngine: MembershipPointCalculationService,
    private readonly excelService: MembershipPointReportsExcelService,
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
            code: 'FORBIDDEN_MEMBERSHIP_REPORT_BRANCH',
            message: 'Bạn không có quyền truy cập dữ liệu báo cáo hội viên & điểm tại bất kỳ chi nhánh nào.',
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

  private async fetchTiers(): Promise<MembershipTierInput[]> {
    const tiers = await this.prisma.membershipTier.findMany({
      orderBy: { minSpending: 'asc' },
    });
    return tiers.map((t) => ({
      id: t.id,
      name: t.name,
      minSpending: Number(t.minSpending) || 0,
      pointMultiplier: Number(t.pointMultiplier) || 1,
      discountPercent: Number(t.discountPercent) || 0,
      isActive: t.isActive,
    }));
  }

  private async fetchUsersSnapshot(): Promise<UserPointSnapshotInput[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: RoleType.USER,
      },
      include: {
        membershipTier: { select: { name: true } },
      },
    });

    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      phone: u.phone,
      memberCode: u.memberCode,
      membershipTierId: u.membershipTierId,
      membershipTierName: u.membershipTier?.name,
      points: u.points,
      currentPoints: Number(u.currentPoints) || u.points || 0,
      totalSpending: Number(u.totalSpending) || 0,
    }));
  }

  private async fetchCompletedOrders(allowedBranchIds: string[], filter: MembershipReportFilterDto): Promise<{
    memberOrders: MembershipOrderInput[];
    nonMemberOrders: MembershipOrderInput[];
  }> {
    const where: any = {
      status: OrderStatus.COMPLETED,
      branchId: { in: allowedBranchIds },
    };

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
      { deliveredAt: { gte: startDate, lte: endDate } },
      { deliveredAt: null, createdAt: { gte: startDate, lte: endDate } },
    ];

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            membershipTierId: true,
            membershipTier: { select: { name: true } },
          },
        },
      },
    });

    const memberOrders: MembershipOrderInput[] = [];
    const nonMemberOrders: MembershipOrderInput[] = [];

    for (const o of orders) {
      const item: MembershipOrderInput = {
        id: o.id,
        orderCode: o.orderCode,
        userId: o.userId,
        branchId: o.branchId,
        subTotal: Number(o.subTotal) || 0,
        totalAmount: Number(o.totalAmount) || 0,
        discountAmount: Number(o.discountAmount) || 0,
        pointsUsed: Number(o.pointsUsed) || 0,
        pointsAwarded: Number(o.pointsAwarded) || 0,
        deliveredAt: o.deliveredAt,
        createdAt: o.createdAt,
        userTierId: o.user?.membershipTierId,
        userTierName: o.user?.membershipTier?.name,
      };

      if (o.userId) {
        memberOrders.push(item);
      } else {
        nonMemberOrders.push(item);
      }
    }

    return { memberOrders, nonMemberOrders };
  }

  private async fetchPointTransactions(filter: MembershipReportFilterDto): Promise<PointTransactionInput[]> {
    const where: any = {};

    let startDate: Date;
    let endDate: Date;

    if (filter.from && filter.to) {
      startDate = new Date(filter.from);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(filter.to);
      endDate.setHours(23, 59, 59, 999);

      where.createdAt = { gte: startDate, lte: endDate };
    }

    if (filter.sourceType && filter.sourceType !== 'ALL') {
      where.source = filter.sourceType as PointTransactionSource;
    }

    const txs = await this.prisma.pointTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
            phone: true,
            memberCode: true,
            membershipTierId: true,
            membershipTier: { select: { name: true } },
          },
        },
        order: {
          select: {
            orderCode: true,
          },
        },
      },
    });

    return txs.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: t.user?.fullName,
      userPhone: t.user?.phone || undefined,
      userMemberCode: t.user?.memberCode || undefined,
      membershipTierId: t.user?.membershipTierId || null,
      membershipTierName: t.user?.membershipTier?.name || null,
      balanceBefore: t.balanceBefore,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      source: t.source,
      orderId: t.orderId,
      orderCode: t.order?.orderCode || null,
      referenceCode: t.referenceCode,
      description: t.description,
      expiresAt: t.expiresAt,
      createdBy: t.createdBy,
      createdAt: t.createdAt,
    }));
  }

  async getOverview(userId: string, filter: MembershipReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);

    const [tiers, users, { memberOrders, nonMemberOrders }, transactions] = await Promise.all([
      this.fetchTiers(),
      this.fetchUsersSnapshot(),
      this.fetchCompletedOrders(allowedBranchIds, filter),
      this.fetchPointTransactions(filter),
    ]);

    const kpis = this.calcEngine.calculateMembershipKPIs(
      tiers,
      users,
      memberOrders,
      nonMemberOrders,
      transactions,
    );

    return {
      success: true,
      data: {
        kpis,
        totalRegisteredMembers: users.length,
        tiersCount: tiers.length,
      },
    };
  }

  async getTiers(userId: string, filter: MembershipReportFilterDto) {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);

    const [tiers, users, { memberOrders }, transactions] = await Promise.all([
      this.fetchTiers(),
      this.fetchUsersSnapshot(),
      this.fetchCompletedOrders(allowedBranchIds, filter),
      this.fetchPointTransactions(filter),
    ]);

    const tierPerformance = this.calcEngine.calculateTierPerformance(
      tiers,
      users,
      memberOrders,
      transactions,
    );

    return {
      success: true,
      data: tierPerformance,
    };
  }

  async getPointDynamics(userId: string, filter: MembershipReportFilterDto) {
    await this.resolveBranchScope(userId, filter.branchId);
    const transactions = await this.fetchPointTransactions(filter);
    const dynamics = this.calcEngine.calculatePointDynamics(transactions);

    return {
      success: true,
      data: dynamics,
    };
  }

  async getLiability(userId: string, filter: MembershipReportFilterDto) {
    await this.resolveBranchScope(userId, filter.branchId);

    const [tiers, users, transactions] = await Promise.all([
      this.fetchTiers(),
      this.fetchUsersSnapshot(),
      this.fetchPointTransactions(filter),
    ]);

    const liabilities = this.calcEngine.calculatePointLiability(tiers, users, transactions);

    return {
      success: true,
      data: liabilities,
    };
  }

  async getReconciliation(userId: string, filter: MembershipReportFilterDto) {
    await this.resolveBranchScope(userId, filter.branchId);

    const [users, transactions] = await Promise.all([
      this.fetchUsersSnapshot(),
      this.fetchPointTransactions({}), // All-time ledger for reconciliation
    ]);

    const reconciliations = this.calcEngine.reconcilePointLedgers(users, transactions);

    return {
      success: true,
      data: reconciliations,
      meta: {
        totalUsers: reconciliations.length,
        discrepanciesCount: reconciliations.filter((r) => !r.isReconciled).length,
      },
    };
  }

  async getTransactions(
    userId: string,
    filter: MembershipReportFilterDto,
    pagination: PointTransactionPaginationDto,
  ) {
    await this.resolveBranchScope(userId, filter.branchId);

    const where: any = {};

    if (pagination.source && pagination.source !== 'ALL') {
      where.source = pagination.source as PointTransactionSource;
    }

    if (pagination.search && pagination.search.trim()) {
      const q = pagination.search.trim();
      where.OR = [
        { user: { fullName: { contains: q } } },
        { user: { phone: { contains: q } } },
        { user: { memberCode: { contains: q } } },
        { order: { orderCode: { contains: q } } },
        { description: { contains: q } },
      ];
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [total, txs] = await Promise.all([
      this.prisma.pointTransaction.count({ where }),
      this.prisma.pointTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              fullName: true,
              phone: true,
              memberCode: true,
              membershipTier: { select: { name: true } },
            },
          },
          order: {
            select: { orderCode: true },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: txs.map((t) => ({
        id: t.id,
        userName: t.user?.fullName || '—',
        userPhone: t.user?.phone || '—',
        memberCode: t.user?.memberCode || '—',
        tierName: t.user?.membershipTier?.name || 'Tiêu chuẩn',
        source: t.source,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        orderCode: t.order?.orderCode || null,
        expiresAt: t.expiresAt,
        description: t.description,
        createdAt: t.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportExcel(userId: string, filter: MembershipReportFilterDto): Promise<Buffer> {
    const { allowedBranchIds } = await this.resolveBranchScope(userId, filter.branchId);

    const [tiers, users, { memberOrders }, transactions] = await Promise.all([
      this.fetchTiers(),
      this.fetchUsersSnapshot(),
      this.fetchCompletedOrders(allowedBranchIds, filter),
      this.fetchPointTransactions(filter),
    ]);

    const kpis = this.calcEngine.calculateMembershipKPIs(
      tiers,
      users,
      memberOrders,
      [],
      transactions,
    );
    const tierPerf = this.calcEngine.calculateTierPerformance(
      tiers,
      users,
      memberOrders,
      transactions,
    );
    const dynamics = this.calcEngine.calculatePointDynamics(transactions);
    const liabilities = this.calcEngine.calculatePointLiability(tiers, users, transactions);
    const reconciliations = this.calcEngine.reconcilePointLedgers(users, transactions);

    let branchName = 'Toàn hệ thống';
    if (filter.branchId && filter.branchId !== 'ALL') {
      const b = await this.prisma.branch.findUnique({
        where: { id: filter.branchId },
        select: { name: true },
      });
      if (b) branchName = b.name;
    }

    return this.excelService.exportMembershipPointExcel(
      kpis,
      tierPerf,
      dynamics,
      liabilities,
      reconciliations,
      transactions,
      branchName,
      filter.from,
      filter.to,
    );
  }
}
