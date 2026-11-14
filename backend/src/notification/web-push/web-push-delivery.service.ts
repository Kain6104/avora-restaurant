import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_CATEGORY_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
  WEB_PUSH_STATUS,
  WEB_PUSH_TTL,
  WebPushCategoryPreferences,
} from './web-push.constants';

export interface WebPushPayload {
  eventId: string;
  notificationId?: string;
  category: NotificationCategory | string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  targetPath?: string;
  branchId?: string | null;
  metadata?: Record<string, any>;
  createdAt?: string;
  expiresAt?: string;
}

export interface WebPushSendOptions {
  branchId?: string | null;
  ttl?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  topic?: string;
}

@Injectable()
export class WebPushDeliveryService {
  private readonly logger = new Logger(WebPushDeliveryService.name);
  private isConfigured = false;
  private publicKey: string = '';

  constructor(private readonly prisma: PrismaService) {
    this.initVapid();
  }

  private initVapid() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@avorafnb.com';

    if (publicKey && privateKey) {
      try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        this.publicKey = publicKey;
        this.isConfigured = true;
        this.logger.log(`VAPID initialized successfully. Subject: ${subject}`);
      } catch (err) {
        this.logger.error('Failed to configure VAPID credentials:', err);
      }
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is missing in environment variables');
    }
  }

  getPublicKey(): string {
    if (!this.publicKey) {
      this.publicKey = process.env.VAPID_PUBLIC_KEY || '';
    }
    return this.publicKey;
  }

  isReady(): boolean {
    return this.isConfigured && Boolean(this.publicKey);
  }

  /**
   * Map domain category string to category preference key.
   */
  private matchCategoryPreference(category: string): keyof WebPushCategoryPreferences | null {
    const upper = (category || '').toUpperCase();
    if (upper === 'ORDER' || upper === 'ORDERS') return 'orders';
    if (upper === 'QR' || upper === 'QR_ORDER' || upper === 'QR_ORDERS') return 'qrOrders';
    if (upper === 'SERVICE' || upper === 'CALL_STAFF' || upper === 'SERVICE_REQUESTS') return 'serviceRequests';
    if (upper === 'PAYMENT' || upper === 'PAYMENTS') return 'payments';
    if (upper === 'TABLE' || upper === 'TABLES') return 'tables';
    if (upper === 'BUFFET') return 'buffet';
    return null;
  }

  /**
   * Determine safe TTL based on notification category.
   */
  private resolveTtl(category: string, requestedTtl?: number): number {
    if (requestedTtl && requestedTtl > 0) return requestedTtl;
    const upper = (category || '').toUpperCase();
    if (upper.includes('SERVICE') || upper.includes('CALL')) return WEB_PUSH_TTL.SERVICE_REQUESTS;
    if (upper.includes('BUFFET')) return WEB_PUSH_TTL.BUFFET;
    if (upper.includes('QR')) return WEB_PUSH_TTL.QR_ORDERS;
    if (upper.includes('PAYMENT')) return WEB_PUSH_TTL.PAYMENTS;
    if (upper.includes('ORDER')) return WEB_PUSH_TTL.ORDERS;
    if (upper.includes('TABLE')) return WEB_PUSH_TTL.TABLES;
    return WEB_PUSH_TTL.DEFAULT;
  }

  /**
   * Send Web Push to all active, non-expired subscriptions of a user.
   */
  async sendToUser(
    userId: string,
    payload: WebPushPayload,
    options: WebPushSendOptions = {}
  ): Promise<{ sent: number; failed: number; expired: number }> {
    if (!this.isReady()) {
      this.logger.warn(`WebPushDeliveryService not configured. Skipping push for user ${userId}`);
      return { sent: 0, failed: 0, expired: 0 };
    }

    const now = new Date();

    // 1. Query all ACTIVE subscriptions for this user
    const subscriptions = await this.prisma.webPushSubscription.findMany({
      where: {
        userId,
        status: WEB_PUSH_STATUS.ACTIVE,
      },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, expired: 0 };
    }

    const results = { sent: 0, failed: 0, expired: 0 };
    const ttl = this.resolveTtl(payload.category, options.ttl);
    const prefKey = this.matchCategoryPreference(payload.category);

    const pushOptions: webpush.RequestOptions = {
      TTL: ttl,
      urgency: options.urgency || 'high',
      topic: options.topic || (payload.category ? payload.category.toLowerCase().substring(0, 32) : undefined),
    };

    // Prepare standardized payload
    const wirePayload = JSON.stringify({
      version: '1.0',
      eventId: payload.eventId,
      notificationId: payload.notificationId,
      category: payload.category,
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/avora_logo.png',
      badge: payload.badge || '/avora_logo.png',
      targetPath: payload.targetPath || '/admin/pos/waiter',
      branchId: payload.branchId || null,
      metadata: payload.metadata || {},
      createdAt: payload.createdAt || now.toISOString(),
      expiresAt: payload.expiresAt || new Date(now.getTime() + ttl * 1000).toISOString(),
    });

    for (const sub of subscriptions) {
      // A. Check session expiration
      if (sub.sessionExpiresAt && sub.sessionExpiresAt < now) {
        results.expired++;
        await this.prisma.webPushSubscription.update({
          where: { id: sub.id },
          data: { status: WEB_PUSH_STATUS.EXPIRED },
        });
        this.logger.log(`Skipped expired subscription ${sub.id} for user ${userId}`);
        continue;
      }

      // B. Check branch scope if subscription is locked to a specific branch
      if (options.branchId && sub.branchId && sub.branchId !== options.branchId) {
        continue;
      }

      // C. Check category preferences
      if (prefKey && sub.categoryPreferences) {
        const prefs = sub.categoryPreferences as Record<string, boolean>;
        if (prefs[prefKey] === false) {
          continue;
        }
      }

      // D. Dispatch push
      const pushSubscription: webpush.PushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await this.dispatchWithRetry(pushSubscription, wirePayload, pushOptions, sub.id);
        results.sent++;
        // Update last seen
        await this.prisma.webPushSubscription.update({
          where: { id: sub.id },
          data: { lastSeenAt: new Date() },
        });
      } catch (err: any) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Push subscription is dead / revoked by browser
          results.expired++;
          await this.prisma.webPushSubscription.update({
            where: { id: sub.id },
            data: {
              status: WEB_PUSH_STATUS.EXPIRED,
              revokedAt: new Date(),
            },
          });
          this.logger.warn(`Push subscription ${sub.id} returned HTTP ${statusCode}. Marked EXPIRED.`);
        } else {
          results.failed++;
          this.logger.error(`Failed to deliver Web Push to subscription ${sub.id}: ${err?.message || err}`);
        }
      }
    }

    return results;
  }

  /**
   * Dispatch push with transient error retry (429/5xx).
   */
  private async dispatchWithRetry(
    sub: webpush.PushSubscription,
    payload: string,
    options: webpush.RequestOptions,
    subId: string,
    maxRetries = 1
  ): Promise<webpush.SendResult> {
    try {
      return await webpush.sendNotification(sub, payload, options);
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if ((statusCode === 429 || (statusCode >= 500 && statusCode < 600)) && maxRetries > 0) {
        this.logger.warn(`Transient push error ${statusCode} for sub ${subId}. Retrying in 600ms...`);
        await new Promise((r) => setTimeout(r, 600));
        return await webpush.sendNotification(sub, payload, options);
      }
      throw err;
    }
  }

  /**
   * Send a test push notification to a specific physical device.
   */
  async sendTestPush(
    userId: string,
    deviceInstallationId: string,
    custom?: { title?: string; body?: string }
  ) {
    if (!this.isReady()) {
      throw new Error('Hệ thống Web Push chưa được cấu hình VAPID trên máy chủ');
    }

    const sub = await this.prisma.webPushSubscription.findFirst({
      where: {
        userId,
        deviceInstallationId,
        status: WEB_PUSH_STATUS.ACTIVE,
      },
    });

    if (!sub) {
      throw new Error('Không tìm thấy đăng ký Web Push hoạt động trên thiết bị này');
    }

    const pushSubscription: webpush.PushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    const wirePayload = JSON.stringify({
      version: '1.0',
      eventId: `test:${Date.now()}`,
      notificationId: `test-${Date.now()}`,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      title: custom?.title || 'AVORA Waiter Push Test',
      body: custom?.body || 'Thông báo đẩy hoạt động hoàn hảo trên thiết bị của bạn!',
      icon: '/avora_logo.png',
      badge: '/avora_logo.png',
      targetPath: '/admin/pos/waiter',
      createdAt: new Date().toISOString(),
      metadata: { isTest: true },
    });

    await webpush.sendNotification(pushSubscription, wirePayload, {
      TTL: 120,
      urgency: 'high',
    });

    await this.prisma.webPushSubscription.update({
      where: { id: sub.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      success: true,
      deliveredAt: new Date().toISOString(),
      platform: sub.platform,
      deviceInstallationId: sub.deviceInstallationId,
    };
  }
}
