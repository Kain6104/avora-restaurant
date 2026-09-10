import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationRecipientService } from './notification-recipient.service';
import { PosGateway } from '../pos/pos.gateway';
import { NotificationGateway } from './notification.gateway';
import { randomUUID } from 'crypto';
import { NotificationType } from '@prisma/client';

export interface DomainNotificationEvent {
  eventType: string;
  category: 'ORDER' | 'KITCHEN' | 'RESERVATION' | 'PAYMENT' | 'SERVICE' | 'MARKETING' | 'SYSTEM';
  priority?: number; // 0=LOW, 1=NORMAL, 2=HIGH, 3=CRITICAL
  branchId?: string | null;
  entityId: string;
  subId?: string;
  title: string;
  message: string;
  actor?: {
    id?: string;
    name?: string;
    avatarUrl?: string;
  };
  reference?: {
    type: string;
    id: string;
    url: string;
  };
  metadata?: Record<string, any>;
  requiredPermissions: string[];
  appScopes?: ('ADMIN' | 'POS' | 'WAITER' | 'KDS')[];
  excludeActor?: boolean;
  legacyType?: NotificationType;
}

export interface RealtimeNotificationEnvelope {
  eventId: string;
  eventType: string;
  category: string;
  notificationId?: string;
  title: string;
  message: string;
  priority: number;
  branchId?: string | null;
  actor?: {
    id?: string;
    name?: string;
    avatarUrl?: string;
  };
  reference?: {
    type: string;
    id: string;
    url: string;
  };
  metadata?: Record<string, any>;
  occurredAt: string;
}

@Injectable()
export class NotificationEngineService {
  private readonly logger = new Logger(NotificationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipientService: NotificationRecipientService,
    private readonly posGateway: PosGateway,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /**
   * Publish a business domain event to all authorized recipients.
   *
   * Flow:
   * 1. Calculate idempotent eventId (eventType:entityId[:subId])
   * 2. Resolve recipients via Enterprise RBAC + BranchScope
   * 3. Bulk persist to database with skipDuplicates: true
   * 4. Broadcast realtime envelope to personal user rooms (user:userId)
   * 5. Sync unread badge count
   * 6. Broadcast operational event to branch room(s) for live UI cache invalidation
   */
  async publishEvent(event: DomainNotificationEvent): Promise<{
    eventId: string;
    recipientsCount: number;
  }> {
    const eventId = `${event.eventType}:${event.entityId}${event.subId ? `:${event.subId}` : ''}`;
    const priority = event.priority ?? 1;
    const occurredAt = new Date().toISOString();

    const excludeUserIds: string[] = [];
    if (event.excludeActor && event.actor?.id) {
      excludeUserIds.push(event.actor.id);
    }

    // 1. Resolve recipients using Dynamic RBAC
    const recipients = await this.recipientService.resolveRecipients({
      eventType: event.eventType,
      branchId: event.branchId,
      requiredPermissions: event.requiredPermissions,
      appScopes: event.appScopes,
      excludeUserIds,
    });

    // 2. Build rows for bulk insert
    if (recipients.length > 0) {
      const notificationRows = recipients.map((recipient) => ({
        id: randomUUID(),
        userId: recipient.id,
        branchId: event.branchId || null,
        eventId,
        eventType: event.eventType,
        category: event.category,
        priority,
        title: event.title,
        content: event.message,
        actorId: event.actor?.id || null,
        referenceId: event.reference?.id || event.entityId,
        url: event.reference?.url || null,
        metadata: event.metadata ? (event.metadata as any) : undefined,
        type: event.legacyType || NotificationType.SYSTEM,
        isRead: false,
      }));

      try {
        // Bulk persist into MySQL with unique compound (eventId, userId) check
        await this.prisma.notification.createMany({
          data: notificationRows,
          skipDuplicates: true,
        });
      } catch (err) {
        this.logger.error(`Failed to bulk insert notifications for event ${eventId}:`, err);
      }

      // 3. Deliver realtime notification to each recipient's user room
      for (const recipient of recipients) {
        const envelope: RealtimeNotificationEnvelope = {
          eventId,
          eventType: event.eventType,
          category: event.category,
          title: event.title,
          message: event.message,
          priority,
          branchId: event.branchId || null,
          actor: event.actor,
          reference: event.reference,
          metadata: event.metadata,
          occurredAt,
        };

        try {
          // Push to PosGateway room `user:${recipient.id}`
          if (this.posGateway?.server) {
            this.posGateway.server.to(`user:${recipient.id}`).emit('notification', envelope);
          }

          // Push to NotificationGateway room `user_${recipient.id}`
          if (this.notificationGateway?.server) {
            this.notificationGateway.server.to(`user_${recipient.id}`).emit('notification', envelope);
          }

          // Fetch updated unread count asynchronously and emit
          this.emitUserUnreadCount(recipient.id);
        } catch (deliveryErr) {
          this.logger.error(`Delivery error for user ${recipient.id}:`, deliveryErr);
        }
      }
    }

    // 4. Deliver operational broadcast to branch and admin rooms for data cache invalidation
    try {
      const operationalEnvelope: RealtimeNotificationEnvelope = {
        eventId,
        eventType: event.eventType,
        category: event.category,
        title: event.title,
        message: event.message,
        priority,
        branchId: event.branchId || null,
        actor: event.actor,
        reference: event.reference,
        metadata: event.metadata,
        occurredAt,
      };

      if (this.posGateway?.server) {
        if (event.branchId && event.branchId !== 'ALL') {
          // Broadcast to branch room and specialized operational rooms
          this.posGateway.server.to(`branch:${event.branchId}`).emit('pos_event', operationalEnvelope);
          this.posGateway.server.to(`branch:${event.branchId}`).emit(event.eventType, operationalEnvelope);

          if (event.category === 'ORDER') {
            this.posGateway.server.to(`branch:${event.branchId}:orders`).emit('pos_event', operationalEnvelope);
          }
          if (event.category === 'KITCHEN') {
            this.posGateway.server.to(`branch:${event.branchId}:kds`).emit('pos_event', operationalEnvelope);
          }
        }
        // Broadcast to Admin Global room
        this.posGateway.server.to('admin:global').emit('pos_event', operationalEnvelope);
        this.posGateway.server.to('admin:global').emit(event.eventType, operationalEnvelope);
      }
    } catch (broadcastErr) {
      this.logger.error(`Operational broadcast error for event ${eventId}:`, broadcastErr);
    }

    this.logger.log(
      `[NotificationEngine] Published ${event.eventType} (eventId=${eventId}) to ${recipients.length} recipients. Branch=${event.branchId || 'GLOBAL'}`,
    );

    return {
      eventId,
      recipientsCount: recipients.length,
    };
  }

  /**
   * Helper to recalculate and emit authoritative unread count to a user
   */
  async emitUserUnreadCount(userId: string): Promise<number> {
    try {
      const unreadCount = await this.prisma.notification.count({
        where: { userId, isRead: false },
      });

      if (this.posGateway?.server) {
        this.posGateway.server.to(`user:${userId}`).emit('unread_count', { unreadCount });
      }
      if (this.notificationGateway?.server) {
        this.notificationGateway.server.to(`user_${userId}`).emit('unread_count', { unreadCount });
      }

      return unreadCount;
    } catch (err) {
      this.logger.error(`Error emitting unread count to user ${userId}:`, err);
      return 0;
    }
  }

  /**
   * Send a direct notification to a specific single user (e.g. customer personal alerts)
   */
  async sendDirectNotification(params: {
    userId: string;
    title: string;
    content: string;
    type?: NotificationType;
    category?: string;
    priority?: number;
    referenceId?: string;
    url?: string;
    branchId?: string;
    metadata?: Record<string, any>;
  }) {
    const {
      userId,
      title,
      content,
      type = NotificationType.SYSTEM,
      category = 'SYSTEM',
      priority = 1,
      referenceId,
      url,
      branchId,
      metadata,
    } = params;

    const eventId = `DIRECT:${userId}:${randomUUID()}`;

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        content,
        type,
        category,
        priority,
        referenceId,
        url,
        branchId,
        eventId,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });

    const envelope: RealtimeNotificationEnvelope = {
      eventId,
      eventType: 'DIRECT_NOTIFICATION',
      category,
      notificationId: notification.id,
      title,
      message: content,
      priority,
      branchId,
      reference: referenceId && url ? { type, id: referenceId, url } : undefined,
      metadata,
      occurredAt: notification.createdAt.toISOString(),
    };

    if (this.posGateway?.server) {
      this.posGateway.server.to(`user:${userId}`).emit('notification', envelope);
    }
    if (this.notificationGateway?.server) {
      this.notificationGateway.server.to(`user_${userId}`).emit('notification', envelope);
    }

    this.emitUserUnreadCount(userId);
    return notification;
  }
}
