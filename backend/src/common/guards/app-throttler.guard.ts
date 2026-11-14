import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Determine whether the current request should bypass rate limiting.
   */
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    // 1. If @SkipThrottle() decorator is present on route or controller
    const isSkipped = await super.shouldSkip(context);
    if (isSkipped) {
      return true;
    }

    if (context.getType() !== 'http') {
      return true;
    }

    const { req } = this.getRequestResponse(context);
    const path = req.path || req.url || '';

    // 2. Critical payment webhooks (SePay VietQR callbacks) must never be throttled
    if (
      path.includes('/payment/sepay') ||
      path.includes('/payment/webhook')
    ) {
      return true;
    }

    // 3. Skip internal hardware print agent or local POS desktop agent
    if (
      req.headers?.['x-internal-pos-agent'] === 'true' ||
      req.headers?.['x-internal-agent'] === 'true'
    ) {
      return true;
    }

    return false;
  }

  /**
   * Resolve client tracker key.
   * Extracts real IP through proxies (x-forwarded-for) and binds with authenticated user if present.
   */
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const forwarded = req.headers?.['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.ip || req.connection?.remoteAddress || '127.0.0.1';

    if (req.user?.id) {
      return `usr_${req.user.id}_${clientIp}`;
    }
    return `ip_${clientIp}`;
  }

  /**
   * Standardize 429 response structure matching repository guidelines:
   * { success: false, statusCode: 429, error: { code: 'RATE_LIMIT_EXCEEDED', message: '...', retryAfter: N } }
   */
  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const retryAfterSec =
      throttlerLimitDetail.timeToBlockExpire ||
      Math.ceil((throttlerLimitDetail.timeToExpire || 1000) / 1000);

    const { res } = this.getRequestResponse(context);
    if (res) {
      this.setResponseHeader(res, 'Retry-After', retryAfterSec);
    }

    throw new HttpException(
      {
        success: false,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message:
            'Hệ thống ghi nhận quá nhiều thao tác trong thời gian ngắn. Vui lòng đợi trong giây lát rồi thử lại.',
          retryAfter: retryAfterSec,
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
