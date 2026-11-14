import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { WEB_PUSH_STATUS } from './web-push.constants';

@Injectable()
export class WebPushCleanupService {
  private readonly logger = new Logger(WebPushCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Automatically transition expired subscriptions every 6 hours.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleSubscriptionCleanup() {
    const now = new Date();
    try {
      // 1. Mark expired sessions
      const expiredResult = await this.prisma.webPushSubscription.updateMany({
        where: {
          status: WEB_PUSH_STATUS.ACTIVE,
          sessionExpiresAt: {
            lt: now,
          },
        },
        data: {
          status: WEB_PUSH_STATUS.EXPIRED,
        },
      });

      if (expiredResult.count > 0) {
        this.logger.log(`Cleaned up ${expiredResult.count} expired Web Push subscriptions`);
      }

      // 2. Mark inactive subscriptions (not seen in > 90 days)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const staleResult = await this.prisma.webPushSubscription.updateMany({
        where: {
          status: WEB_PUSH_STATUS.ACTIVE,
          lastSeenAt: {
            lt: ninetyDaysAgo,
          },
        },
        data: {
          status: WEB_PUSH_STATUS.EXPIRED,
        },
      });

      if (staleResult.count > 0) {
        this.logger.log(`Marked ${staleResult.count} stale Web Push subscriptions as EXPIRED`);
      }
    } catch (err) {
      this.logger.error('Error during Web Push subscription cleanup routine:', err);
    }
  }
}

