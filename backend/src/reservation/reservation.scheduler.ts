import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ReservationStatus } from '@prisma/client';
import { formatTimeVN, formatDateVN } from './utils/reservation-time.util';

@Injectable()
export class ReservationScheduler {
  private readonly logger = new Logger(ReservationScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleReservationCron() {
    await this.processReminders24h();
    await this.processReminders2h();
    await this.processNoShowGracePeriod();
  }

  // =========================================================================
  // 1. Nhắc hẹn 24 giờ trước giờ hẹn (Idempotent qua ReservationReminderLog)
  // =========================================================================
  private async processReminders24h() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 3600 * 1000);
    const windowEnd = new Date(now.getTime() + 25 * 3600 * 1000);

    const candidates = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        startAt: { gte: windowStart, lte: windowEnd },
        reminderLogs: {
          none: { reminderType: 'REMINDER_24H' },
        },
      },
      include: {
        branch: true,
      },
    });

    for (const r of candidates) {
      try {
        if (r.userId && r.startAt) {
          const timeStr = formatTimeVN(r.startAt);
          const dateStr = formatDateVN(r.startAt);
          await this.notificationService.createNotification({
            userId: r.userId,
            title: 'Nhắc hẹn đặt bàn ngày mai',
            content: `Kính gửi quý khách, bạn có lịch đặt bàn mã ${r.reservationCode} tại ${r.branch.name} vào lúc ${timeStr} ngày ${dateStr}.`,
            type: 'RESERVATION',
            referenceId: r.id,
            url: `/profile/reservations/${r.reservationCode}`,
          });
        }

        await this.prisma.reservationReminderLog.create({
          data: {
            reservationId: r.id,
            reminderType: 'REMINDER_24H',
            scheduledFor: r.startAt || now,
            status: 'SENT',
          },
        });
      } catch (err: any) {
        this.logger.error(`Error sending 24h reminder for ${r.id}:`, err?.message);
      }
    }
  }

  // =========================================================================
  // 2. Nhắc hẹn 2 giờ trước giờ hẹn (Idempotent qua ReservationReminderLog)
  // =========================================================================
  private async processReminders2h() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 105 * 60 * 1000); // 1h45m
    const windowEnd = new Date(now.getTime() + 135 * 60 * 1000); // 2h15m

    const candidates = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        startAt: { gte: windowStart, lte: windowEnd },
        reminderLogs: {
          none: { reminderType: 'REMINDER_2H' },
        },
      },
      include: {
        branch: true,
      },
    });

    for (const r of candidates) {
      try {
        if (r.userId && r.startAt) {
          const timeStr = formatTimeVN(r.startAt);
          await this.notificationService.createNotification({
            userId: r.userId,
            title: 'Lịch đặt bàn sắp đến',
            content: `Lịch đặt bàn ${r.reservationCode} tại ${r.branch.name} sẽ bắt đầu lúc ${timeStr} (trong khoảng 2 giờ nữa). Nhà hàng đã sẵn sàng chào đón bạn!`,
            type: 'RESERVATION',
            referenceId: r.id,
            url: `/profile/reservations/${r.reservationCode}`,
          });
        }

        await this.prisma.reservationReminderLog.create({
          data: {
            reservationId: r.id,
            reminderType: 'REMINDER_2H',
            scheduledFor: r.startAt || now,
            status: 'SENT',
          },
        });
      } catch (err: any) {
        this.logger.error(`Error sending 2h reminder for ${r.id}:`, err?.message);
      }
    }
  }

  // =========================================================================
  // 3. Tự động xử lý No-show sau Grace Period (Requirement R)
  // =========================================================================
  private async processNoShowGracePeriod() {
    const now = new Date();

    // Find confirmed reservations where startAt + grace period is past
    const overdue = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        startAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) }, // at least 30 mins past start
      },
      include: {
        branch: true,
      },
    });

    for (const r of overdue) {
      const graceMinutes = r.branch.noShowGraceMinutes || 30;
      const cutoffTime = new Date((r.startAt?.getTime() || 0) + graceMinutes * 60 * 1000);

      if (now > cutoffTime) {
        try {
          await this.prisma.reservation.update({
            where: { id: r.id },
            data: {
              status: ReservationStatus.NO_SHOW,
              noShowAt: now,
            },
          });

          const adminUser = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
          if (adminUser) {
            await this.prisma.auditLog.create({
              data: {
                userId: adminUser.id,
                action: 'AUTO_NO_SHOW (SYSTEM)',
                target: `Reservation:${r.id}`,
                oldValue: ReservationStatus.CONFIRMED,
                newValue: ReservationStatus.NO_SHOW,
              },
            });
          }

          this.logger.log(`Marked reservation ${r.reservationCode} as NO_SHOW (actor = SYSTEM)`);
        } catch (err: any) {
          this.logger.error(`Failed to auto-mark no-show for ${r.id}:`, err?.message);
        }
      }
    }
  }
}
