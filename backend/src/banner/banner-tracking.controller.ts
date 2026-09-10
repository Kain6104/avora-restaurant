import { Controller, Post, Get, Body, Query, Req, UseGuards, Ip } from '@nestjs/common';
import { BannerTrackingService } from './banner-tracking.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('banners')
export class BannerTrackingController {
  constructor(private readonly trackingService: BannerTrackingService) {}

  /**
   * Endpoint ghi nhận VIEW hoặc CLICK vào Banner/Popup
   * Công khai, tự động nhận diện thành viên nếu đã đăng nhập qua OptionalJwtAuthGuard
   */
  @Post('track')
  @UseGuards(OptionalJwtAuthGuard)
  async trackInteraction(
    @Body() body: { bannerId: string; type: 'VIEW' | 'CLICK'; sessionId?: string },
    @Req() req: any,
    @Ip() ipAddress: string
  ) {
    const userId = req.user?.id || null;
    const userAgent = req.headers['user-agent'] || '';

    return this.trackingService.trackInteraction({
      bannerId: body.bannerId,
      type: body.type,
      userId,
      sessionId: body.sessionId,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Lấy danh sách Banner đang hoạt động công khai cho trang chủ / popup website
   */
  @Get('active')
  async getActiveBanners(
    @Query('position') position?: string,
    @Query('branchId') branchId?: string
  ) {
    return this.trackingService.getActiveBanners({ position, branchId });
  }
}
