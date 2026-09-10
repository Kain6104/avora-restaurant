import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MembershipService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService
  ) {}

  async getTiers() {
    return this.prisma.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { minSpending: 'asc' }
    });
  }

  async getMyProgress(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { membershipTier: true }
    });

    if (!user) {
      return null;
    }

    const tiers = await this.prisma.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { minSpending: 'asc' }
    });

    const nextTier = tiers.find(t => t.minSpending > user.totalSpending);
    
    return {
      currentTier: user.membershipTier,
      totalSpending: user.totalSpending,
      currentPoints: user.points ?? user.currentPoints,
      nextTier: nextTier || null,
      amountNeededForNextTier: nextTier ? nextTier.minSpending - user.totalSpending : 0
    };
  }

  async getMyPointsHistory(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        membershipTier: true,
      },
    });

    if (!user) {
      return null;
    }

    const tiers = await this.prisma.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { minSpending: 'asc' },
    });

    const currentSpending = user.totalSpending || 0;
    const currentTier = user.membershipTier || (tiers.length > 0 ? tiers[0] : null);
    const nextTier = tiers.find((t) => t.minSpending > currentSpending) || null;

    let progressPercent = 100;
    let amountNeededForNextTier = 0;

    if (nextTier) {
      const prevTierMin = currentTier ? currentTier.minSpending : 0;
      const tierRange = nextTier.minSpending - prevTierMin;
      const userProgress = currentSpending - prevTierMin;
      progressPercent = tierRange > 0 ? Math.min(Math.max((userProgress / tierRange) * 100, 0), 100) : 0;
      amountNeededForNextTier = Math.max(nextTier.minSpending - currentSpending, 0);
    }

    // Đảm bảo user có memberCode
    let memberCode = user.memberCode;
    if (!memberCode) {
      memberCode = `AVR-${user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: { memberCode },
        });
      } catch (e) {
        // Ignored if collision
      }
    }

    const transactions = await this.prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let totalEarned = 0;
    let totalUsed = 0;

    transactions.forEach((tx) => {
      if (tx.amount > 0) {
        totalEarned += tx.amount;
      } else {
        totalUsed += Math.abs(tx.amount);
      }
    });

    // Lấy voucher dành riêng cho hạng thành viên
    const now = new Date();
    let exclusiveVouchers: any[] = [];
    if (currentTier) {
      exclusiveVouchers = await this.prisma.voucher.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
          OR: [
            {
              membershipTiers: {
                some: { id: currentTier.id },
              },
            },
            {
              membershipTierId: currentTier.id,
            },
          ],
        },
        orderBy: { discountValue: 'desc' },
      });
    }

    // Nếu chưa cấu hình voucher riêng cho hạng, lấy các voucher ưu đãi tốt nhất hiện có
    if (exclusiveVouchers.length === 0) {
      exclusiveVouchers = await this.prisma.voucher.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        take: 6,
        orderBy: { discountValue: 'desc' },
      });
    }

    return {
      points: user.points ?? Math.floor(user.currentPoints || 0),
      totalSpending: user.totalSpending,
      memberCode,
      currentTier,
      nextTier,
      progressPercent: Math.round(progressPercent),
      amountNeededForNextTier,
      allTiers: tiers,
      exclusiveVouchers,
      stats: {
        totalEarned,
        totalUsed,
        transactionCount: transactions.length,
      },
      transactions,
    };
  }

  async recalculateUserTier(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { upgraded: false };

    const tiers = await this.prisma.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { minSpending: 'desc' } // Sort highest to lowest
    });

    // Find the highest tier the user qualifies for
    const newTier = tiers.find(t => user.totalSpending >= t.minSpending);

    if (newTier && user.membershipTierId !== newTier.id) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { membershipTierId: newTier.id }
      });

      // Send congratulatory notification
      await this.notificationService.createNotification({
        userId,
        title: '🎉 Chúc mừng thăng hạng!',
        content: `Bạn đã chính thức trở thành Thành viên ${newTier.name} của Avora! Khám phá đặc quyền mới ngay!`,
        type: 'SYSTEM'
      });

      return { upgraded: true, oldTierId: user.membershipTierId, newTier };
    }
    
    return { upgraded: false };
  }
}
