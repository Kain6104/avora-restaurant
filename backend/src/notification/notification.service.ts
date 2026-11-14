import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { PosGateway } from '../pos/pos.gateway';
import { NotificationType } from '@prisma/client';

export interface GetNotificationsFilterDto {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  category?: string;
  branchId?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
    private readonly posGateway: PosGateway,
  ) {}

  /**
   * Lấy danh sách thông báo của người dùng kèm phân trang & lọc
   */
  async getUserNotifications(userId: string, filter?: GetNotificationsFilterDto) {
    const page = Math.max(1, Number(filter?.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filter?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (filter?.unreadOnly === true || String(filter?.unreadOnly) === 'true') {
      where.isRead = false;
    }
    if (filter?.category && filter.category !== 'ALL') {
      where.category = filter.category;
    }
    if (filter?.branchId && filter.branchId !== 'ALL') {
      where.OR = [
        { branchId: filter.branchId },
        { branchId: null },
      ];
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    };
  }

  /**
   * Lấy số lượng thông báo chưa đọc của user
   */
  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { success: true, unreadCount };
  }

  /**
   * Đánh dấu 1 thông báo là đã đọc (IDOR-safe: bắt buộc trùng userId)
   */
  async markAsRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên thông báo của người khác');
    }

    const now = new Date();
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: now },
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    this.emitUnreadCount(userId, unreadCount);

    return {
      success: true,
      affectedCount: 1,
      unreadCount,
    };
  }

  /**
   * Đánh dấu tất cả thông báo của user là đã đọc
   */
  async markAllAsRead(userId: string) {
    const now = new Date();
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: now },
    });

    this.emitUnreadCount(userId, 0);

    return {
      success: true,
      affectedCount: result.count,
      unreadCount: 0,
    };
  }

  /**
   * Xóa 1 thông báo của user (IDOR-safe)
   */
  async deleteNotification(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa thông báo của người khác');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    this.emitUnreadCount(userId, unreadCount);
    if (this.posGateway?.server) {
      this.posGateway.server.to(`user:${userId}`).emit('notification_deleted', { id: notificationId, unreadCount });
    }

    return {
      success: true,
      deletedId: notificationId,
      unreadCount,
    };
  }

  /**
   * Xóa toàn bộ thông báo của user
   */
  async deleteAllNotifications(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { userId },
    });

    this.emitUnreadCount(userId, 0);
    if (this.posGateway?.server) {
      this.posGateway.server.to(`user:${userId}`).emit('notifications_cleared', { unreadCount: 0 });
    }

    return {
      success: true,
      deletedCount: result.count,
      unreadCount: 0,
    };
  }

  /**
   * Phát số lượng chưa đọc tới cả 2 socket gateway
   */
  private emitUnreadCount(userId: string, count: number) {
    try {
      if (typeof this.notificationGateway?.sendUnreadCountToUser === 'function') {
        this.notificationGateway.sendUnreadCountToUser(userId, count);
      }
      if (this.posGateway?.server) {
        this.posGateway.server.to(`user:${userId}`).emit('unread_count', { unreadCount: count });
      }
    } catch (err) {
      this.logger.error(`Error emitting unread count to user ${userId}:`, err);
    }
  }

  /**
   * Hàm tạo thông báo trực tiếp (tương thích backward)
   */
  async createNotification(data: {
    userId: string;
    title: string;
    content: string;
    type: NotificationType | 'SYSTEM' | 'ORDER' | 'PROMOTION' | 'REWARD' | 'RESERVATION' | 'ARTICLE' | 'NEWS' | 'KITCHEN';
    referenceId?: string;
    url?: string;
    branchId?: string;
    eventId?: string;
    category?: string;
    priority?: number;
    metadata?: any;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        content: data.content,
        type: data.type as NotificationType,
        referenceId: data.referenceId,
        url: data.url,
        branchId: data.branchId,
        eventId: data.eventId,
        category: data.category,
        priority: data.priority ?? 1,
        metadata: data.metadata,
      },
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId: data.userId, isRead: false },
    });

    try {
      const envelope = {
        eventId: notification.eventId || notification.id,
        eventType: notification.eventType || 'NOTIFICATION',
        category: notification.category || 'SYSTEM',
        notificationId: notification.id,
        title: notification.title,
        message: notification.content,
        priority: notification.priority,
        branchId: notification.branchId,
        reference: notification.referenceId && notification.url ? {
          type: notification.type,
          id: notification.referenceId,
          url: notification.url,
        } : undefined,
        metadata: notification.metadata,
        occurredAt: notification.createdAt.toISOString(),
      };

      if (this.notificationGateway?.server) {
        this.notificationGateway.sendNotificationToUser(data.userId, notification, unreadCount);
      }
      if (this.posGateway?.server) {
        this.posGateway.server.to(`user:${data.userId}`).emit('notification', envelope);
        this.posGateway.server.to(`user:${data.userId}`).emit('unread_count', { unreadCount });
      }
    } catch (err) {
      this.logger.error('Error emitting realtime notification:', err);
    }

    return notification;
  }

  // ==========================================
  // STAFF NOTIFICATION PREFERENCES (PHASE 2.3)
  // ==========================================

  async getStaffPreferences(userId: string) {
    const existing = await this.prisma.staffNotificationPreference.findUnique({
      where: { userId },
    });

    if (!existing) {
      return {
        orderEnabled: true,
        itemEnabled: true,
        kitchenEnabled: true,
        qrOrderEnabled: true,
        serviceEnabled: true,
        paymentEnabled: true,
        tableEnabled: true,
        buffetEnabled: true,
        alertEnabled: true,
      };
    }

    return {
      orderEnabled: existing.orderEnabled,
      itemEnabled: existing.itemEnabled,
      kitchenEnabled: existing.kitchenEnabled,
      qrOrderEnabled: existing.qrOrderEnabled,
      serviceEnabled: existing.serviceEnabled,
      paymentEnabled: existing.paymentEnabled,
      tableEnabled: existing.tableEnabled,
      buffetEnabled: existing.buffetEnabled,
      alertEnabled: existing.alertEnabled,
      updatedAt: existing.updatedAt,
    };
  }

  async updateStaffPreferences(
    userId: string,
    prefs: Partial<{
      orderEnabled: boolean;
      itemEnabled: boolean;
      kitchenEnabled: boolean;
      qrOrderEnabled: boolean;
      serviceEnabled: boolean;
      paymentEnabled: boolean;
      tableEnabled: boolean;
      buffetEnabled: boolean;
      alertEnabled: boolean;
    }>,
  ) {
    return this.prisma.staffNotificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        orderEnabled: prefs.orderEnabled ?? true,
        itemEnabled: prefs.itemEnabled ?? true,
        kitchenEnabled: prefs.kitchenEnabled ?? true,
        qrOrderEnabled: prefs.qrOrderEnabled ?? true,
        serviceEnabled: prefs.serviceEnabled ?? true,
        paymentEnabled: prefs.paymentEnabled ?? true,
        tableEnabled: prefs.tableEnabled ?? true,
        buffetEnabled: prefs.buffetEnabled ?? true,
        alertEnabled: prefs.alertEnabled ?? true,
      },
      update: {
        ...(prefs.orderEnabled !== undefined ? { orderEnabled: prefs.orderEnabled } : {}),
        ...(prefs.itemEnabled !== undefined ? { itemEnabled: prefs.itemEnabled } : {}),
        ...(prefs.kitchenEnabled !== undefined ? { kitchenEnabled: prefs.kitchenEnabled } : {}),
        ...(prefs.qrOrderEnabled !== undefined ? { qrOrderEnabled: prefs.qrOrderEnabled } : {}),
        ...(prefs.serviceEnabled !== undefined ? { serviceEnabled: prefs.serviceEnabled } : {}),
        ...(prefs.paymentEnabled !== undefined ? { paymentEnabled: prefs.paymentEnabled } : {}),
        ...(prefs.tableEnabled !== undefined ? { tableEnabled: prefs.tableEnabled } : {}),
        ...(prefs.buffetEnabled !== undefined ? { buffetEnabled: prefs.buffetEnabled } : {}),
        ...(prefs.alertEnabled !== undefined ? { alertEnabled: prefs.alertEnabled } : {}),
      },
    });
  }

  async resetStaffPreferences(userId: string) {
    return this.prisma.staffNotificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        orderEnabled: true,
        itemEnabled: true,
        kitchenEnabled: true,
        qrOrderEnabled: true,
        serviceEnabled: true,
        paymentEnabled: true,
        tableEnabled: true,
        buffetEnabled: true,
        alertEnabled: true,
      },
      update: {
        orderEnabled: true,
        itemEnabled: true,
        kitchenEnabled: true,
        qrOrderEnabled: true,
        serviceEnabled: true,
        paymentEnabled: true,
        tableEnabled: true,
        buffetEnabled: true,
        alertEnabled: true,
      },
    });
  }

  // ==========================================
  // NATIVE ANDROID PUSH TOKEN (PHASE 5.1)
  // ==========================================

  async registerNativePushToken(
    userId: string,
    dto: {
      deviceInstallationId: string;
      token: string;
      platform?: string;
      sessionId?: string;
      branchId?: string;
    },
  ) {
    const { deviceInstallationId, token, platform = 'ANDROID_NATIVE', sessionId, branchId } = dto;
    if (!token || !deviceInstallationId) return null;

    // Upsert into WebPushSubscription table as an ANDROID_NATIVE entry
    return this.prisma.webPushSubscription.upsert({
      where: { endpoint: `native://${deviceInstallationId}/${token.substring(0, 64)}` },
      create: {
        userId,
        deviceInstallationId,
        endpoint: `native://${deviceInstallationId}/${token.substring(0, 64)}`,
        p256dh: token, // Stores native push token safely
        auth: 'NATIVE_FCM',
        platform: platform.toUpperCase(),
        browser: 'Native App',
        sessionId,
        branchId,
        status: 'ACTIVE',
      },
      update: {
        userId,
        p256dh: token,
        sessionId,
        branchId,
        status: 'ACTIVE',
        lastSeenAt: new Date(),
        revokedAt: null,
      },
    });
  }

  async revokeNativePushToken(userId: string, deviceInstallationId: string) {
    if (!deviceInstallationId) return;
    await this.prisma.webPushSubscription.updateMany({
      where: {
        userId,
        deviceInstallationId,
        platform: 'ANDROID_NATIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });
  }
}
