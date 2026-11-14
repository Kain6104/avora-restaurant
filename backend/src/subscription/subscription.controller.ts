import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto, PauseSkipScheduleDto, ChooseScheduleDishDto } from './dto/create-subscription.dto';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) { }

  @Get('plans')
  async getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Post('subscribe')
  async subscribe(@Body() dto: CreateSubscriptionDto, @Req() req: any) {
    const userId = req.user?.id || req.body?.userId || 'demo-user-id';
    return this.subscriptionService.subscribe(userId, dto);
  }

  @Get('my-subscriptions')
  async getMySubscriptions(
    @Req() req: any,
    @Query('userId') queryUserId?: string,
    @Query('phone') queryPhone?: string,
  ) {
    let userId = req.user?.id || queryUserId;
    if (!userId && req.headers?.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, '');
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
          userId = decoded?.sub || decoded?.id || userId;
        }
      } catch { }
    }
    return this.subscriptionService.getMySubscriptions(userId, queryPhone);
  }

  @Get(':id')
  async getSubscriptionDetails(@Param('id') id: string, @Req() req: any) {
    let userId = req.user?.id;
    let userRole = req.user?.role;
    if (!userId && req.headers?.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, '');
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
          userId = decoded?.sub || decoded?.id || userId;
          userRole = decoded?.role || userRole;
        }
      } catch { }
    }
    return this.subscriptionService.getSubscriptionDetails(id, userId, userRole);
  }

  @Post('schedules/:scheduleId/pause-skip')
  async pauseOrSkipSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: PauseSkipScheduleDto,
    @Req() req: any,
  ) {
    let userId = req.user?.id || req.body?.userId;
    let userRole = req.user?.role;
    if (!userId && req.headers?.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, '');
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
          userId = decoded?.sub || decoded?.id || userId;
          userRole = decoded?.role || userRole;
        }
      } catch { }
    }
    return this.subscriptionService.pauseOrSkipSchedule(scheduleId, userId, dto, userRole);
  }

  @Post('schedules/:scheduleId/choose-dish')
  async chooseDishForSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: ChooseScheduleDishDto,
    @Req() req: any,
  ) {
    let userId = req.user?.id || req.body?.userId;
    let userRole = req.user?.role;
    if (!userId && req.headers?.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, '');
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
          userId = decoded?.sub || decoded?.id || userId;
          userRole = decoded?.role || userRole;
        }
      } catch { }
    }
    return this.subscriptionService.chooseDishForSchedule(scheduleId, userId, dto, userRole);
  }

  @Get('admin/list')
  async getAdminSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('planId') planId?: string,
  ) {
    return this.subscriptionService.getAdminSubscriptions({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 12,
      search,
      status,
      branchId,
      planId,
    });
  }

  @Patch('admin/:id/status')
  async updateAdminSubscriptionStatus(
    @Param('id') id: string,
    @Body('status') status: any,
    @Body('notes') notes?: string,
  ) {
    return this.subscriptionService.updateAdminSubscriptionStatus(id, status, notes);
  }

  @Patch('admin/schedules/:scheduleId/status')
  async updateAdminScheduleStatus(
    @Param('scheduleId') scheduleId: string,
    @Body('status') status: any,
  ) {
    return this.subscriptionService.updateAdminScheduleStatus(scheduleId, status);
  }

  @Get('admin/dispatch-summary')
  async getAdminDispatchSummary(
    @Query('date') date?: string,
    @Query('mealSlot') mealSlot?: 'LUNCH' | 'DINNER',
    @Query('branchId') branchId?: string,
  ) {
    return this.subscriptionService.getAdminDispatchSummary(date, mealSlot, branchId);
  }

  @Post('cron/daily-dispatch')
  async runDailyDispatchCron(@Query('slot') slot?: 'LUNCH' | 'DINNER') {
    return this.subscriptionService.dispatchDailyMealsCron(slot);
  }
}

