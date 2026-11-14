import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_CATEGORY_PREFERENCES,
  WEB_PUSH_STATUS,
  WebPushCategoryPreferences,
} from './web-push.constants';
import {
  SubscribeWebPushDto,
  UpdatePreferencesDto,
} from './dto/web-push.dto';
import { SYSTEM_ROLE_CODES } from '../../common/constants/permissions-registry';

export interface SessionContext {
  userId: string;
  sessionId?: string;
  sessionExpiresAt?: Date | null;
  branchId?: string | null;
}

@Injectable()
export class WebPushSubscriptionService {
  private readonly logger = new Logger(WebPushSubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that the push endpoint is a legitimate public HTTPS URL and prevent SSRF attacks.
   */
  private validatePushEndpoint(endpoint: string): void {
    let parsed: URL;
    try {
      parsed = new URL(endpoint);
    } catch {
      throw new BadRequestException('Invalid push endpoint URL format');
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Push endpoint must strictly use HTTPS protocol');
    }

    const hostname = parsed.hostname.toLowerCase();

    // Prevent loopback and private IP SSRF
    const isPrivateIp =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal');

    if (isPrivateIp) {
      throw new BadRequestException('Private or loopback push endpoints are rejected for security');
    }
  }

  /**
   * Verify that the user is an active employee authorized to access AVORA Waiter.
   */
  private async verifyWaiterAccess(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isAccountLocked: true,
        forceRelogin: true,
        roleAssignments: {
          where: { isActive: true },
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    if (user.isAccountLocked) {
      throw new ForbiddenException('Tài khoản đã bị khóa');
    }

    // Role check: ADMIN or system staff role
    const isSuperAdmin = user.role === 'ADMIN';
    const hasAdminAssignment = user.roleAssignments.some(
      (a) => a.role.code === SYSTEM_ROLE_CODES.ADMIN || a.role.code === SYSTEM_ROLE_CODES.BRANCH_MANAGER
    );
    const hasWaiterPermission = user.roleAssignments.some(
      (a) =>
        a.role.permissions.some(
          (p) => p.permissionKey === 'waiter.access' || p.permissionKey === 'pos.access'
        ) || a.role.code === SYSTEM_ROLE_CODES.BRANCH_WAITER
    );

    if (!isSuperAdmin && !hasAdminAssignment && !hasWaiterPermission) {
      this.logger.warn(`User ${userId} rejected from Web Push: missing waiter.access permission`);
      throw new ForbiddenException('Chỉ tài khoản nhân viên được phân quyền Waiter mới có thể bật Web Push');
    }
  }

  /**
   * Register or update a device's Web Push subscription bound to the current authenticated session.
   */
  async subscribe(sessionContext: SessionContext, dto: SubscribeWebPushDto) {
    this.validatePushEndpoint(dto.endpoint);
    await this.verifyWaiterAccess(sessionContext.userId);

    const effectiveBranchId = dto.branchId || sessionContext.branchId || null;
    const initialPrefs = dto.categoryPreferences
      ? { ...DEFAULT_CATEGORY_PREFERENCES, ...dto.categoryPreferences }
      : DEFAULT_CATEGORY_PREFERENCES;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Account-switch protection:
      // If this physical device (deviceInstallationId) was previously bound to another user,
      // revoke all previous bindings on this device immediately so no cross-account notifications bleed over.
      await tx.webPushSubscription.updateMany({
        where: {
          deviceInstallationId: dto.deviceInstallationId,
          userId: { not: sessionContext.userId },
          status: WEB_PUSH_STATUS.ACTIVE,
        },
        data: {
          status: WEB_PUSH_STATUS.REVOKED,
          revokedAt: new Date(),
        },
      });

      // 2. Upsert subscription by endpoint
      const existing = await tx.webPushSubscription.findUnique({
        where: { endpoint: dto.endpoint },
      });

      let subscription;
      if (existing) {
        subscription = await tx.webPushSubscription.update({
          where: { endpoint: dto.endpoint },
          data: {
            userId: sessionContext.userId,
            deviceInstallationId: dto.deviceInstallationId,
            p256dh: dto.keys.p256dh,
            auth: dto.keys.auth,
            platform: dto.platform,
            browser: dto.browser || existing.browser,
            userAgent: dto.userAgent || existing.userAgent,
            sessionId: sessionContext.sessionId || existing.sessionId,
            sessionExpiresAt: sessionContext.sessionExpiresAt || existing.sessionExpiresAt,
            branchId: effectiveBranchId,
            status: WEB_PUSH_STATUS.ACTIVE,
            categoryPreferences: initialPrefs as any,
            revokedAt: null,
            lastSeenAt: new Date(),
          },
        });
      } else {
        subscription = await tx.webPushSubscription.create({
          data: {
            userId: sessionContext.userId,
            deviceInstallationId: dto.deviceInstallationId,
            endpoint: dto.endpoint,
            p256dh: dto.keys.p256dh,
            auth: dto.keys.auth,
            platform: dto.platform,
            browser: dto.browser || null,
            userAgent: dto.userAgent || null,
            sessionId: sessionContext.sessionId || null,
            sessionExpiresAt: sessionContext.sessionExpiresAt || null,
            branchId: effectiveBranchId,
            status: WEB_PUSH_STATUS.ACTIVE,
            categoryPreferences: initialPrefs as any,
            lastSeenAt: new Date(),
          },
        });
      }

      // Record audit log
      try {
        await tx.auditLog.create({
          data: {
            userId: sessionContext.userId,
            action: 'WEB_PUSH_SUBSCRIBED',
            target: 'WebPushSubscription',
            newValue: `Registered Web Push on ${dto.platform} (device: ${dto.deviceInstallationId.substring(0, 8)}...)`,
          },
        });
      } catch (auditErr) {
        this.logger.warn(`Failed to write audit log: ${auditErr}`);
      }

      this.logger.log(
        `Web Push subscription bound: userId=${sessionContext.userId} device=${dto.deviceInstallationId} platform=${dto.platform}`
      );

      return {
        id: subscription.id,
        status: subscription.status,
        deviceInstallationId: subscription.deviceInstallationId,
        platform: subscription.platform,
        browser: subscription.browser,
        categoryPreferences: subscription.categoryPreferences || DEFAULT_CATEGORY_PREFERENCES,
        lastSeenAt: subscription.lastSeenAt,
      };
    });
  }

  /**
   * Get device subscription status and category preferences.
   */
  async getStatus(userId: string, deviceInstallationId: string) {
    if (!deviceInstallationId) {
      return {
        isRegistered: false,
        status: 'NOT_REGISTERED',
        preferences: DEFAULT_CATEGORY_PREFERENCES,
      };
    }

    const sub = await this.prisma.webPushSubscription.findFirst({
      where: {
        userId,
        deviceInstallationId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      return {
        isRegistered: false,
        status: 'NOT_REGISTERED',
        preferences: DEFAULT_CATEGORY_PREFERENCES,
      };
    }

    // Check if session expired
    let effectiveStatus = sub.status;
    if (sub.status === WEB_PUSH_STATUS.ACTIVE && sub.sessionExpiresAt && sub.sessionExpiresAt < new Date()) {
      effectiveStatus = WEB_PUSH_STATUS.EXPIRED;
      await this.prisma.webPushSubscription.update({
        where: { id: sub.id },
        data: { status: WEB_PUSH_STATUS.EXPIRED },
      });
    }

    const preferences = (sub.categoryPreferences as unknown as WebPushCategoryPreferences) || DEFAULT_CATEGORY_PREFERENCES;

    return {
      isRegistered: effectiveStatus === WEB_PUSH_STATUS.ACTIVE,
      status: effectiveStatus,
      id: sub.id,
      deviceInstallationId: sub.deviceInstallationId,
      platform: sub.platform,
      browser: sub.browser,
      branchId: sub.branchId,
      sessionExpiresAt: sub.sessionExpiresAt,
      lastSeenAt: sub.lastSeenAt,
      preferences,
    };
  }

  /**
   * Update category preferences for a registered device.
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const sub = await this.prisma.webPushSubscription.findFirst({
      where: {
        userId,
        deviceInstallationId: dto.deviceInstallationId,
        status: WEB_PUSH_STATUS.ACTIVE,
      },
    });

    if (!sub) {
      throw new NotFoundException('Thiết bị chưa được kích hoạt nhận thông báo');
    }

    const current = (sub.categoryPreferences as Record<string, boolean>) || DEFAULT_CATEGORY_PREFERENCES;
    const updated = {
      ...current,
      ...dto.categoryPreferences,
    };

    const result = await this.prisma.webPushSubscription.update({
      where: { id: sub.id },
      data: {
        categoryPreferences: updated as any,
        lastSeenAt: new Date(),
      },
    });

    return {
      success: true,
      preferences: result.categoryPreferences,
    };
  }

  /**
   * Revoke subscription for current device upon user request or logout.
   */
  async revokeSubscription(
    userId: string,
    options: { deviceInstallationId?: string; endpoint?: string; reason?: string }
  ) {
    const { deviceInstallationId, endpoint, reason = 'User manual disable / logout' } = options;

    if (!deviceInstallationId && !endpoint) {
      throw new BadRequestException('Either deviceInstallationId or endpoint must be provided');
    }

    const whereClause: any = {
      userId,
      status: WEB_PUSH_STATUS.ACTIVE,
    };

    if (deviceInstallationId) {
      whereClause.deviceInstallationId = deviceInstallationId;
    }
    if (endpoint) {
      whereClause.endpoint = endpoint;
    }

    const matched = await this.prisma.webPushSubscription.findMany({
      where: whereClause,
    });

    if (matched.length === 0) {
      return { revokedCount: 0, message: 'No active subscription found to revoke' };
    }

    await this.prisma.webPushSubscription.updateMany({
      where: {
        id: { in: matched.map((m) => m.id) },
      },
      data: {
        status: WEB_PUSH_STATUS.REVOKED,
        revokedAt: new Date(),
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'WEB_PUSH_REVOKED',
          target: 'WebPushSubscription',
          newValue: `Revoked ${matched.length} subscription(s). Reason: ${reason}`,
        },
      });
    } catch (auditErr) {
      this.logger.warn(`Failed to write audit log: ${auditErr}`);
    }

    this.logger.log(`Revoked ${matched.length} subscription(s) for user=${userId}. Reason: ${reason}`);

    return {
      revokedCount: matched.length,
      message: 'Subscription successfully revoked',
    };
  }

  /**
   * Revoke subscriptions tied to a specific session token identifier (jti).
   */
  async revokeBySessionId(sessionId: string, reason = 'Session expired/terminated') {
    if (!sessionId) return;
    const result = await this.prisma.webPushSubscription.updateMany({
      where: {
        sessionId,
        status: WEB_PUSH_STATUS.ACTIVE,
      },
      data: {
        status: WEB_PUSH_STATUS.REVOKED,
        revokedAt: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.log(`Revoked ${result.count} subscription(s) for sessionId=${sessionId}`);
    }
  }
}
