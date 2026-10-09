import { Injectable } from '@nestjs/common';
import { PointTransactionSource } from '@prisma/client';

/* ==========================================================================
   MEMBERSHIP & POINT CALCULATION ENGINE (COMPLETED ORDERS ONLY - LEDGER RECONCILIATION)
   ========================================================================== */

export interface PointTransactionInput {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  userMemberCode?: string;
  membershipTierId: string | null;
  membershipTierName: string | null;
  balanceBefore: number;
  amount: number; // positive for earn/bonus/refund, negative for redeem/expire
  balanceAfter: number;
  source: PointTransactionSource;
  orderId: string | null;
  orderCode: string | null;
  referenceCode: string | null;
  description: string | null;
  expiresAt: Date | string | null;
  createdBy: string | null;
  createdAt: Date | string;
}

export interface MembershipOrderInput {
  id: string;
  orderCode: string | null;
  userId: string | null;
  branchId: string;
  subTotal: number;
  totalAmount: number;
  discountAmount: number;
  pointsUsed: number;
  pointsAwarded: number;
  deliveredAt: Date | string | null;
  createdAt: Date | string;
  userTierId?: string | null;
  userTierName?: string | null;
}

export interface UserPointSnapshotInput {
  id: string;
  fullName: string;
  phone: string | null;
  memberCode: string | null;
  membershipTierId: string | null;
  membershipTierName?: string | null;
  points: number; // integer points
  currentPoints: number; // float/integer points
  totalSpending: number;
}

export interface MembershipTierInput {
  id: string;
  name: string;
  minSpending: number;
  pointMultiplier: number;
  discountPercent: number;
  isActive: boolean;
}

export interface CalculatedMembershipKPIs {
  totalRegisteredMembers: number;
  activeMembersInPeriod: number;
  revenueFromMembers: number;
  completedOrdersFromMembers: number;
  memberAov: number;
  nonMemberRevenue: number;
  nonMemberCompletedOrders: number;
  nonMemberAov: number;
  totalPointsIssued: number; // Earned + Bonus + Adjustment + Refund
  totalPointsRedeemed: number; // Redeemed in orders
  totalPointsExpired: number;
  outstandingPointsBalance: number; // Total unredeemed points in system
  activePointHoldersCount: number; // Users with points > 0
  averagePointsPerHolder: number;
  pointRedemptionRatePercent: number; // Redeemed / Issued * 100
  estimatedPointLiabilityVnd: number; // Outstanding * redeemRate
  reconciliationDiscrepanciesCount: number;
}

export interface CalculatedTierPerformanceItem {
  tierId: string;
  tierName: string;
  minSpending: number;
  pointMultiplier: number;
  discountPercent: number;
  totalMembersCount: number;
  activeMembersCount: number;
  completedOrdersCount: number;
  revenue: number;
  aov: number;
  averageSpendPerMember: number;
  pointsEarned: number;
  pointsRedeemed: number;
  retentionRatePercent: number;
}

export interface CalculatedPointDynamicsItem {
  sourceType: PointTransactionSource;
  label: string;
  transactionCount: number;
  pointsIssuedOrRedeemed: number; // Absolute points
  netChange: number; // Signed (+/-)
  uniqueUsersCount: number;
  percentageOfActivity: number;
}

export interface CalculatedPointLiabilityItem {
  tierId: string;
  tierName: string;
  membersWithPointsCount: number;
  outstandingPoints: number;
  estimatedLiabilityVnd: number;
  expiringIn7Days: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  expiringIn90Days: number;
}

export interface PointLedgerReconciliationItem {
  userId: string;
  fullName: string;
  phone: string;
  memberCode: string;
  tierName: string;
  openingBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  totalExpired: number;
  totalAdjusted: number;
  calculatedClosingBalance: number;
  databaseCurrentPoints: number;
  discrepancy: number; // calculatedClosingBalance - databaseCurrentPoints
  isReconciled: boolean;
  reconciliationStatus: 'MATCHED' | 'DISCREPANCY_DETECTED';
}

@Injectable()
export class MembershipPointCalculationService {
  /**
   * Tính toán toàn diện KPI Hội viên & Điểm thưởng
   */
  calculateMembershipKPIs(
    tiers: MembershipTierInput[],
    users: UserPointSnapshotInput[],
    memberOrders: MembershipOrderInput[],
    nonMemberOrders: MembershipOrderInput[],
    transactions: PointTransactionInput[],
    pointRedeemRateVnd: number = 1000,
  ): CalculatedMembershipKPIs {
    const totalRegisteredMembers = users.length;

    const activeUserSet = new Set<string>();
    let revenueFromMembers = 0;
    for (const o of memberOrders) {
      if (o.userId) activeUserSet.add(o.userId);
      revenueFromMembers += Math.round(o.subTotal || 0);
    }
    const completedOrdersFromMembers = memberOrders.length;
    const memberAov =
      completedOrdersFromMembers > 0
        ? Math.round(revenueFromMembers / completedOrdersFromMembers)
        : 0;

    let nonMemberRevenue = 0;
    for (const o of nonMemberOrders) {
      nonMemberRevenue += Math.round(o.subTotal || 0);
    }
    const nonMemberCompletedOrders = nonMemberOrders.length;
    const nonMemberAov =
      nonMemberCompletedOrders > 0
        ? Math.round(nonMemberRevenue / nonMemberCompletedOrders)
        : 0;

    let totalPointsIssued = 0;
    let totalPointsRedeemed = 0;
    let totalPointsExpired = 0;

    for (const tx of transactions) {
      const amt = tx.amount;
      if (amt > 0) {
        totalPointsIssued += amt;
      } else {
        if (tx.source === PointTransactionSource.EXPIRED) {
          totalPointsExpired += Math.abs(amt);
        } else {
          totalPointsRedeemed += Math.abs(amt);
        }
      }
    }

    // Outstanding Points from user snapshots
    let outstandingPointsBalance = 0;
    let activePointHoldersCount = 0;
    for (const u of users) {
      const pts = Math.max(0, Math.round(u.currentPoints || u.points || 0));
      outstandingPointsBalance += pts;
      if (pts > 0) activePointHoldersCount++;
    }

    const averagePointsPerHolder =
      activePointHoldersCount > 0
        ? Math.round(outstandingPointsBalance / activePointHoldersCount)
        : 0;

    const pointRedemptionRatePercent =
      totalPointsIssued > 0
        ? Math.round((totalPointsRedeemed / totalPointsIssued) * 1000) / 10
        : 0;

    const estimatedPointLiabilityVnd = Math.round(outstandingPointsBalance * pointRedeemRateVnd);

    return {
      totalRegisteredMembers,
      activeMembersInPeriod: activeUserSet.size,
      revenueFromMembers,
      completedOrdersFromMembers,
      memberAov,
      nonMemberRevenue,
      nonMemberCompletedOrders,
      nonMemberAov,
      totalPointsIssued,
      totalPointsRedeemed,
      totalPointsExpired,
      outstandingPointsBalance,
      activePointHoldersCount,
      averagePointsPerHolder,
      pointRedemptionRatePercent,
      estimatedPointLiabilityVnd,
      reconciliationDiscrepanciesCount: 0,
    };
  }

  /**
   * Tính toán hiệu suất theo từng hạng thành viên (Tier Performance)
   */
  calculateTierPerformance(
    tiers: MembershipTierInput[],
    users: UserPointSnapshotInput[],
    memberOrders: MembershipOrderInput[],
    transactions: PointTransactionInput[],
  ): CalculatedTierPerformanceItem[] {
    const tierMap = new Map<
      string,
      {
        membersCount: number;
        activeMembers: Set<string>;
        ordersCount: number;
        revenue: number;
        pointsEarned: number;
        pointsRedeemed: number;
        userOrdersCountMap: Map<string, number>;
      }
    >();

    for (const t of tiers) {
      tierMap.set(t.id, {
        membersCount: 0,
        activeMembers: new Set(),
        ordersCount: 0,
        revenue: 0,
        pointsEarned: 0,
        pointsRedeemed: 0,
        userOrdersCountMap: new Map(),
      });
    }

    // Count members per tier
    const userTierLookup = new Map<string, string>();
    for (const u of users) {
      const tId = u.membershipTierId;
      if (tId && tierMap.has(tId)) {
        tierMap.get(tId)!.membersCount++;
        userTierLookup.set(u.id, tId);
      }
    }

    // Orders per tier
    for (const o of memberOrders) {
      const tId = o.userTierId || (o.userId ? userTierLookup.get(o.userId) : null);
      if (tId && tierMap.has(tId)) {
        const entry = tierMap.get(tId)!;
        entry.ordersCount++;
        entry.revenue += Math.round(o.subTotal || 0);
        if (o.userId) {
          entry.activeMembers.add(o.userId);
          entry.userOrdersCountMap.set(
            o.userId,
            (entry.userOrdersCountMap.get(o.userId) || 0) + 1,
          );
        }
      }
    }

    // Points per tier
    for (const tx of transactions) {
      const tId = tx.membershipTierId || (tx.userId ? userTierLookup.get(tx.userId) : null);
      if (tId && tierMap.has(tId)) {
        const entry = tierMap.get(tId)!;
        if (tx.amount > 0) {
          entry.pointsEarned += tx.amount;
        } else {
          entry.pointsRedeemed += Math.abs(tx.amount);
        }
      }
    }

    const results: CalculatedTierPerformanceItem[] = [];

    for (const t of tiers) {
      const entry = tierMap.get(t.id)!;
      const aov = entry.ordersCount > 0 ? Math.round(entry.revenue / entry.ordersCount) : 0;
      const avgSpend =
        entry.membersCount > 0 ? Math.round(entry.revenue / entry.membersCount) : 0;

      let repeatBuyers = 0;
      for (const cnt of entry.userOrdersCountMap.values()) {
        if (cnt >= 2) repeatBuyers++;
      }
      const activeCount = entry.activeMembers.size;
      const retention =
        activeCount > 0 ? Math.round((repeatBuyers / activeCount) * 1000) / 10 : 0;

      results.push({
        tierId: t.id,
        tierName: t.name,
        minSpending: t.minSpending,
        pointMultiplier: t.pointMultiplier,
        discountPercent: t.discountPercent,
        totalMembersCount: entry.membersCount,
        activeMembersCount: activeCount,
        completedOrdersCount: entry.ordersCount,
        revenue: entry.revenue,
        aov,
        averageSpendPerMember: avgSpend,
        pointsEarned: entry.pointsEarned,
        pointsRedeemed: entry.pointsRedeemed,
        retentionRatePercent: retention,
      });
    }

    return results.sort((a, b) => a.minSpending - b.minSpending);
  }

  /**
   * Phân tích biến động điểm theo nguồn giao dịch (Point Dynamics)
   */
  calculatePointDynamics(
    transactions: PointTransactionInput[],
  ): CalculatedPointDynamicsItem[] {
    const SOURCE_LABELS: Record<PointTransactionSource, string> = {
      [PointTransactionSource.ORDER]: 'Tích điểm đơn hoàn thành (Order)',
      [PointTransactionSource.REWARD]: 'Đổi quà / Trừ điểm thanh toán (Reward)',
      [PointTransactionSource.ADMIN]: 'Điều chỉnh thủ công từ Admin',
      [PointTransactionSource.BONUS]: 'Thưởng điểm sự kiện / Khuyến mãi',
      [PointTransactionSource.BIRTHDAY]: 'Quà tặng điểm sinh nhật',
      [PointTransactionSource.REFUND]: 'Hoàn trả điểm do hủy/hoàn đơn',
      [PointTransactionSource.EXPIRED]: 'Điểm hết hạn định kỳ',
      [PointTransactionSource.PROMOTION]: 'Điểm thưởng chiến dịch Marketing',
      [PointTransactionSource.SYSTEM]: 'Hệ thống tự động đồng bộ',
    };

    const typeStats = new Map<
      PointTransactionSource,
      { count: number; absPoints: number; netPoints: number; users: Set<string> }
    >();

    for (const src of Object.values(PointTransactionSource)) {
      typeStats.set(src, { count: 0, absPoints: 0, netPoints: 0, users: new Set() });
    }

    let grandTotalActivity = 0;

    for (const tx of transactions) {
      const src = tx.source;
      if (!typeStats.has(src)) {
        typeStats.set(src, { count: 0, absPoints: 0, netPoints: 0, users: new Set() });
      }
      const entry = typeStats.get(src)!;
      entry.count++;
      entry.absPoints += Math.abs(tx.amount);
      entry.netPoints += tx.amount;
      if (tx.userId) entry.users.add(tx.userId);
      grandTotalActivity += Math.abs(tx.amount);
    }

    const results: CalculatedPointDynamicsItem[] = [];

    for (const [src, entry] of typeStats.entries()) {
      const pct =
        grandTotalActivity > 0
          ? Math.round((entry.absPoints / grandTotalActivity) * 1000) / 10
          : 0;

      results.push({
        sourceType: src,
        label: SOURCE_LABELS[src] || src,
        transactionCount: entry.count,
        pointsIssuedOrRedeemed: entry.absPoints,
        netChange: entry.netPoints,
        uniqueUsersCount: entry.users.size,
        percentageOfActivity: pct,
      });
    }

    return results.sort((a, b) => b.pointsIssuedOrRedeemed - a.pointsIssuedOrRedeemed);
  }

  /**
   * Phân tích Nghĩa vụ Nợ điểm (Point Liability) & Điểm sắp hết hạn theo Hạng thành viên
   */
  calculatePointLiability(
    tiers: MembershipTierInput[],
    users: UserPointSnapshotInput[],
    transactions: PointTransactionInput[],
    now: Date = new Date(),
    pointRedeemRateVnd: number = 1000,
  ): CalculatedPointLiabilityItem[] {
    const tierMap = new Map<
      string,
      {
        name: string;
        holders: number;
        points: number;
        exp7: number;
        exp30: number;
        exp60: number;
        exp90: number;
      }
    >();

    for (const t of tiers) {
      tierMap.set(t.id, {
        name: t.name,
        holders: 0,
        points: 0,
        exp7: 0,
        exp30: 0,
        exp60: 0,
        exp90: 0,
      });
    }

    const userTierMap = new Map<string, string>();

    for (const u of users) {
      const tId = u.membershipTierId || tiers[0]?.id;
      if (tId && tierMap.has(tId)) {
        userTierMap.set(u.id, tId);
        const pts = Math.max(0, Math.round(u.currentPoints || u.points || 0));
        const entry = tierMap.get(tId)!;
        entry.points += pts;
        if (pts > 0) entry.holders++;
      }
    }

    // Expiration analysis from unexpired point transactions with expiresAt
    const nowMs = now.getTime();
    const d7 = nowMs + 7 * 24 * 60 * 60 * 1000;
    const d30 = nowMs + 30 * 24 * 60 * 60 * 1000;
    const d60 = nowMs + 60 * 24 * 60 * 60 * 1000;
    const d90 = nowMs + 90 * 24 * 60 * 60 * 1000;

    for (const tx of transactions) {
      if (!tx.expiresAt || tx.amount <= 0) continue;
      const expMs = new Date(tx.expiresAt).getTime();
      if (expMs <= nowMs) continue; // Already expired

      const tId = tx.membershipTierId || (tx.userId ? userTierMap.get(tx.userId) : null);
      if (tId && tierMap.has(tId)) {
        const entry = tierMap.get(tId)!;
        if (expMs <= d7) entry.exp7 += tx.amount;
        else if (expMs <= d30) entry.exp30 += tx.amount;
        else if (expMs <= d60) entry.exp60 += tx.amount;
        else if (expMs <= d90) entry.exp90 += tx.amount;
      }
    }

    const results: CalculatedPointLiabilityItem[] = [];

    for (const [tId, entry] of tierMap.entries()) {
      results.push({
        tierId: tId,
        tierName: entry.name,
        membersWithPointsCount: entry.holders,
        outstandingPoints: entry.points,
        estimatedLiabilityVnd: Math.round(entry.points * pointRedeemRateVnd),
        expiringIn7Days: entry.exp7,
        expiringIn30Days: entry.exp30,
        expiringIn60Days: entry.exp60,
        expiringIn90Days: entry.exp90,
      });
    }

    return results;
  }

  /**
   * Đối soát Sổ cái giao dịch Điểm thưởng (Point Ledger Reconciliation)
   * Kiểm tra: Opening Balance + Earn + Adjustment + Refund - Redeem - Expire = Closing Balance == User.currentPoints
   */
  reconcilePointLedgers(
    users: UserPointSnapshotInput[],
    transactions: PointTransactionInput[],
  ): PointLedgerReconciliationItem[] {
    // Group transactions by userId
    const userTxMap = new Map<string, PointTransactionInput[]>();
    for (const tx of transactions) {
      if (!userTxMap.has(tx.userId)) {
        userTxMap.set(tx.userId, []);
      }
      userTxMap.get(tx.userId)!.push(tx);
    }

    const results: PointLedgerReconciliationItem[] = [];

    for (const u of users) {
      const txs = userTxMap.get(u.id) || [];
      if (txs.length === 0 && (u.currentPoints || 0) === 0 && (u.points || 0) === 0) {
        continue;
      }

      txs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      let opening = txs.length > 0 ? txs[0].balanceBefore : 0;
      let earned = 0;
      let redeemed = 0;
      let expired = 0;
      let adjusted = 0;

      for (const t of txs) {
        if (t.source === PointTransactionSource.ORDER || t.source === PointTransactionSource.BONUS || t.source === PointTransactionSource.BIRTHDAY) {
          earned += Math.max(0, t.amount);
        } else if (t.source === PointTransactionSource.REWARD) {
          redeemed += Math.abs(t.amount);
        } else if (t.source === PointTransactionSource.EXPIRED) {
          expired += Math.abs(t.amount);
        } else if (t.source === PointTransactionSource.ADMIN || t.source === PointTransactionSource.SYSTEM) {
          adjusted += t.amount;
        } else if (t.source === PointTransactionSource.REFUND) {
          earned += Math.max(0, t.amount);
        }
      }

      const calculatedClosing =
        txs.length > 0 ? txs[txs.length - 1].balanceAfter : opening + earned - redeemed - expired + adjusted;

      const dbCurrent = Math.round(u.currentPoints || u.points || 0);
      const discrepancy = calculatedClosing - dbCurrent;
      const isReconciled = discrepancy === 0;

      results.push({
        userId: u.id,
        fullName: u.fullName || 'Khách hàng',
        phone: u.phone || '—',
        memberCode: u.memberCode || u.id.slice(0, 8).toUpperCase(),
        tierName: u.membershipTierName || 'Standard',
        openingBalance: opening,
        totalEarned: earned,
        totalRedeemed: redeemed,
        totalExpired: expired,
        totalAdjusted: adjusted,
        calculatedClosingBalance: calculatedClosing,
        databaseCurrentPoints: dbCurrent,
        discrepancy,
        isReconciled,
        reconciliationStatus: isReconciled ? 'MATCHED' : 'DISCREPANCY_DETECTED',
      });
    }

    return results.sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy));
  }
}
