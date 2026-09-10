import { Controller, Get, Patch, Param, Query, UseGuards, Req } from '@nestjs/common';
import { NotificationService, GetNotificationsFilterDto } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

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
}
