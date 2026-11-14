import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WebPushSubscriptionService } from './web-push-subscription.service';
import { WebPushDeliveryService } from './web-push-delivery.service';
import { WEB_PUSH_STATUS } from './web-push.constants';
import * as webpush from 'web-push';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('WebPush Services', () => {
  let prismaMock: any;
  let subscriptionService: WebPushSubscriptionService;
  let deliveryService: WebPushDeliveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'TEST_PUBLIC_KEY';
    process.env.VAPID_PRIVATE_KEY = 'TEST_PRIVATE_KEY';
    process.env.VAPID_SUBJECT = 'mailto:test@avorafnb.com';

    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
      webPushSubscription: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
    };

    subscriptionService = new WebPushSubscriptionService(prismaMock);
    deliveryService = new WebPushDeliveryService(prismaMock);
  });

  describe('WebPushSubscriptionService', () => {
    it('should reject non-HTTPS endpoints', async () => {
      const sessionContext = { userId: 'u1' };
      const dto: any = {
        endpoint: 'http://push.example.com/sub123',
        keys: { p256dh: 'p256', auth: 'auth' },
        deviceInstallationId: 'dev-1',
        platform: 'IOS',
      };

      await expect(subscriptionService.subscribe(sessionContext, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject private or loopback IP endpoints (SSRF prevention)', async () => {
      const sessionContext = { userId: 'u1' };
      const dto: any = {
        endpoint: 'https://127.0.0.1:8080/push',
        keys: { p256dh: 'p256', auth: 'auth' },
        deviceInstallationId: 'dev-1',
        platform: 'ANDROID',
      };

      await expect(subscriptionService.subscribe(sessionContext, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject users lacking waiter permissions', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'USER', // regular customer
        isAccountLocked: false,
        roleAssignments: [],
      });

      const sessionContext = { userId: 'u1' };
      const dto: any = {
        endpoint: 'https://web.push.apple.com/sub/12345',
        keys: { p256dh: 'p256', auth: 'auth' },
        deviceInstallationId: 'dev-1',
        platform: 'IOS',
      };

      await expect(subscriptionService.subscribe(sessionContext, dto)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should successfully subscribe an authorized waiter and bind session', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'STAFF',
        isAccountLocked: false,
        roleAssignments: [
          {
            role: {
              code: 'BRANCH_WAITER',
              permissions: [{ permissionKey: 'waiter.access' }],
            },
          },
        ],
      });

      prismaMock.webPushSubscription.findUnique.mockResolvedValue(null);
      prismaMock.webPushSubscription.create.mockResolvedValue({
        id: 'sub-new-1',
        userId: 'u1',
        deviceInstallationId: 'dev-uuid-1',
        endpoint: 'https://web.push.apple.com/sub/12345',
        status: WEB_PUSH_STATUS.ACTIVE,
        platform: 'IOS',
        browser: 'Safari',
        categoryPreferences: { orders: true, qrOrders: true },
        lastSeenAt: new Date(),
      });

      const sessionContext = {
        userId: 'u1',
        sessionId: 'jti-session-123',
        sessionExpiresAt: new Date(Date.now() + 86400000),
        branchId: 'branch-avo1',
      };

      const dto: any = {
        endpoint: 'https://web.push.apple.com/sub/12345',
        keys: { p256dh: 'p256-key', auth: 'auth-key' },
        deviceInstallationId: 'dev-uuid-1',
        platform: 'IOS',
        browser: 'Safari',
      };

      const result = await subscriptionService.subscribe(sessionContext, dto);
      expect(result.status).toBe(WEB_PUSH_STATUS.ACTIVE);
      expect(prismaMock.webPushSubscription.create).toHaveBeenCalled();
    });

    it('should revoke previous user bindings on device account switch', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: 'ADMIN',
        isAccountLocked: false,
        roleAssignments: [],
      });

      prismaMock.webPushSubscription.findUnique.mockResolvedValue(null);
      prismaMock.webPushSubscription.create.mockResolvedValue({
        id: 'sub-new-2',
        userId: 'u2',
        deviceInstallationId: 'dev-shared-iphone',
        status: WEB_PUSH_STATUS.ACTIVE,
        platform: 'IOS',
      });

      const sessionContext = { userId: 'u2', sessionId: 'sess-u2' };
      const dto: any = {
        endpoint: 'https://web.push.apple.com/sub/switch-device',
        keys: { p256dh: 'p256', auth: 'auth' },
        deviceInstallationId: 'dev-shared-iphone',
        platform: 'IOS',
      };

      await subscriptionService.subscribe(sessionContext, dto);

      expect(prismaMock.webPushSubscription.updateMany).toHaveBeenCalledWith({
        where: {
          deviceInstallationId: 'dev-shared-iphone',
          userId: { not: 'u2' },
          status: WEB_PUSH_STATUS.ACTIVE,
        },
        data: expect.objectContaining({
          status: WEB_PUSH_STATUS.REVOKED,
        }),
      });
    });

    it('should revoke subscription by deviceInstallationId', async () => {
      prismaMock.webPushSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', deviceInstallationId: 'dev-1' },
      ]);
      prismaMock.webPushSubscription.updateMany.mockResolvedValue({ count: 1 });

      const res = await subscriptionService.revokeSubscription('u1', {
        deviceInstallationId: 'dev-1',
      });

      expect(res.revokedCount).toBe(1);
      expect(prismaMock.webPushSubscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['sub-1'] } },
        data: expect.objectContaining({ status: WEB_PUSH_STATUS.REVOKED }),
      });
    });
  });

  describe('WebPushDeliveryService', () => {
    it('should skip sending if user subscription session has expired', async () => {
      const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago
      prismaMock.webPushSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-exp',
          userId: 'u1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
          p256dh: 'p256',
          auth: 'auth',
          status: WEB_PUSH_STATUS.ACTIVE,
          sessionExpiresAt: expiredDate,
        },
      ]);

      const result = await deliveryService.sendToUser('u1', {
        eventId: 'test:1',
        category: 'ORDERS',
        title: 'Đơn mới',
        body: 'Bàn M01 gọi món',
      });

      expect(result.sent).toBe(0);
      expect(result.expired).toBe(1);
      expect(prismaMock.webPushSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-exp' },
        data: { status: WEB_PUSH_STATUS.EXPIRED },
      });
    });

    it('should skip sending when category preference is disabled', async () => {
      prismaMock.webPushSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-filtered',
          userId: 'u1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
          p256dh: 'p256',
          auth: 'auth',
          status: WEB_PUSH_STATUS.ACTIVE,
          categoryPreferences: { orders: false, buffet: true }, // orders disabled
        },
      ]);

      const result = await deliveryService.sendToUser('u1', {
        eventId: 'test:2',
        category: 'ORDERS',
        title: 'Đơn mới',
        body: 'Bàn M01',
      });

      expect(result.sent).toBe(0);
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('should handle HTTP 410 Gone by automatically marking subscription EXPIRED', async () => {
      prismaMock.webPushSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-dead',
          userId: 'u1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/dead',
          p256dh: 'p256',
          auth: 'auth',
          status: WEB_PUSH_STATUS.ACTIVE,
        },
      ]);

      const error410: any = new Error('Subscription no longer valid');
      error410.statusCode = 410;
      (webpush.sendNotification as jest.Mock).mockRejectedValueOnce(error410);

      const result = await deliveryService.sendToUser('u1', {
        eventId: 'test:3',
        category: 'ORDERS',
        title: 'Đơn mới',
        body: 'Bàn M02',
      });

      expect(result.sent).toBe(0);
      expect(result.expired).toBe(1);
      expect(prismaMock.webPushSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-dead' },
        data: expect.objectContaining({ status: WEB_PUSH_STATUS.EXPIRED }),
      });
    });
  });
});

