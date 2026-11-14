import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationService, GetNotificationsFilterDto } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ==========================================
  // STAFF NOTIFICATION PREFERENCES (PHASE 2.3)
  // ==========================================

  @Get('preferences')
  async getPreferences(@Req() req: any) {
    const data = await this.notificationService.getStaffPreferences(req.user.id);
    return { success: true, data };
  }

  @Put('preferences')
  async updatePreferences(@Req() req: any, @Body() body: any) {
    const data = await this.notificationService.updateStaffPreferences(req.user.id, body);
    return { success: true, data, message: 'Đã cập nhật cài đặt thông báo' };
  }

  @Post('preferences/reset')
  async resetPreferences(@Req() req: any) {
    const data = await this.notificationService.resetStaffPreferences(req.user.id);
    return { success: true, data, message: 'Đã khôi phục cài đặt thông báo mặc định' };
  }

  // ==========================================
  // NATIVE ANDROID PUSH TOKEN (PHASE 5.1)
  // ==========================================

  @Post('native-token')
  async registerNativeToken(@Req() req: any, @Body() body: any) {
    const data = await this.notificationService.registerNativePushToken(req.user.id, {
      ...body,
      sessionId: req.user.sessionId || body.sessionId,
      branchId: req.user.branchId || body.branchId,
    });
    return { success: true, data, message: 'Đã đăng ký thiết bị nhận thông báo thành công' };
  }

  @Post('native-token/revoke')
  async revokeNativeToken(@Req() req: any, @Body() body: any) {
    await this.notificationService.revokeNativePushToken(req.user.id, body.deviceInstallationId);
    return { success: true, message: 'Đã thu hồi token thiết bị' };
  }

  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('category') category?: string,
    @Query('branchId') branchId?: string,
  ) {
    const filter: GetNotificationsFilterDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      unreadOnly: unreadOnly === 'true',
      category,
      branchId,
    };
    return this.notificationService.getUserNotifications(req.user.id, filter);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: any) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationService.markAsRead(req.user.id, id);
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Req() req: any) {
    return this.notificationService.deleteNotification(req.user.id, id);
  }

  @Delete()
  async deleteAllNotifications(@Req() req: any) {
    return this.notificationService.deleteAllNotifications(req.user.id);
  }
}
