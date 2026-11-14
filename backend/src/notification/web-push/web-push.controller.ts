import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WebPushSubscriptionService } from './web-push-subscription.service';
import { WebPushDeliveryService } from './web-push-delivery.service';
import {
  RevokeSubscriptionDto,
  SendTestPushDto,
  SubscribeWebPushDto,
  UpdatePreferencesDto,
} from './dto/web-push.dto';

@Controller('notifications/web-push')
export class WebPushController {
  private lastTestPushTimestamps = new Map<string, number>();

  constructor(
    private readonly subscriptionService: WebPushSubscriptionService,
    private readonly deliveryService: WebPushDeliveryService
  ) {}

  /**
   * Get VAPID Public Key for client PushManager registration.
   */
  @Get('public-key')
  getPublicKey() {
    const publicKey = this.deliveryService.getPublicKey();
    if (!publicKey) {
      throw new BadRequestException('VAPID public key is not configured on this server');
    }
    return {
      success: true,
      data: {
        publicKey,
      },
    };
  }

  /**
   * Get subscription status & preferences for a specific device.
   */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Request() req: any, @Query('deviceInstallationId') deviceInstallationId: string) {
    const userId = req.user.id;
    const status = await this.subscriptionService.getStatus(userId, deviceInstallationId);
    return {
      success: true,
      data: {
        ...status,
        vapidPublicKey: this.deliveryService.getPublicKey(),
      },
    };
  }

  /**
   * Register or refresh Web Push subscription bound to user session.
   */
  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(@Request() req: any, @Body() dto: SubscribeWebPushDto) {
    const sessionContext = {
      userId: req.user.id,
      sessionId: req.user.jti || req.user.sessionId || null,
      sessionExpiresAt: req.user.exp ? new Date(req.user.exp * 1000) : null,
      branchId: req.user.branchId || null,
    };

    const result = await this.subscriptionService.subscribe(sessionContext, dto);
    return {
      success: true,
      data: result,
      message: 'Đăng ký thông báo đẩy thành công',
    };
  }

  /**
   * Update category preferences for a device.
   */
  @UseGuards(JwtAuthGuard)
  @Post('preferences')
  @HttpCode(HttpStatus.OK)
  async updatePreferences(@Request() req: any, @Body() dto: UpdatePreferencesDto) {
    const result = await this.subscriptionService.updatePreferences(req.user.id, dto);
    return {
      success: true,
      data: result,
      message: 'Cập nhật cài đặt thông báo thành công',
    };
  }

  /**
   * Revoke subscription for current device.
   */
  @UseGuards(JwtAuthGuard)
  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(@Request() req: any, @Body() dto: RevokeSubscriptionDto) {
    const result = await this.subscriptionService.revokeSubscription(req.user.id, dto);
    return {
      success: true,
      data: result,
      message: 'Đã hủy đăng ký nhận thông báo trên thiết bị này',
    };
  }

  /**
   * Send a test push notification to verify delivery on this physical device.
   */
  @UseGuards(JwtAuthGuard)
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTestPush(@Request() req: any, @Body() dto: SendTestPushDto) {
    const userId = req.user.id;
    const deviceId = dto.deviceInstallationId;

    if (!deviceId) {
      throw new BadRequestException('deviceInstallationId is required for test push');
    }

    // Rate limiting: max 1 test push every 5 seconds per device
    const now = Date.now();
    const lastSent = this.lastTestPushTimestamps.get(deviceId) || 0;
    if (now - lastSent < 5000) {
      throw new BadRequestException('Vui lòng đợi 5 giây trước khi gửi thông báo thử tiếp theo');
    }
    this.lastTestPushTimestamps.set(deviceId, now);

    const result = await this.deliveryService.sendTestPush(userId, deviceId, {
      title: dto.title,
      body: dto.body,
    });

    return {
      success: true,
      data: result,
      message: 'Đã gửi thông báo kiểm tra đến thiết bị của bạn',
    };
  }
}

