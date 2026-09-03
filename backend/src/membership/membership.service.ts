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
      currentPoints: user.currentPoints,
      nextTier: nextTier || null,
      amountNeededForNextTier: nextTier ? nextTier.minSpending - user.totalSpending : 0
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
