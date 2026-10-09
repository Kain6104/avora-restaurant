import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AdminLuckyEnvelopeService } from './admin-lucky-envelope.service';
import {
  UpdateLuckyEnvelopeConfigDto,
  CreateLuckyEnvelopeRewardDto,
  UpdateLuckyEnvelopeRewardDto,
  LuckyEnvelopeHistoryQueryDto,
} from './dto/lucky-envelope.dto';

@Controller('admin/farm/lucky-envelope')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminLuckyEnvelopeController {
  constructor(private readonly adminService: AdminLuckyEnvelopeService) {}

  // ==========================================
  // 1. CONFIGURATION & MASTER SWITCH
  // ==========================================

  @Get('config')
  @RequirePermission('farm.view')
  async getConfig() {
    const data = await this.adminService.getConfig();
    return { success: true, data };
  }

  @Put('config')
  @RequirePermission('farm.manage_reward')
  async updateConfig(@Body() dto: UpdateLuckyEnvelopeConfigDto) {
    const data = await this.adminService.updateConfig(dto);
    return { success: true, data };
  }

  // ==========================================
  // 2. REWARD POOL MANAGEMENT (CRUD)
  // ==========================================

  @Get('rewards')
  @RequirePermission('farm.view')
  async getRewards() {
    const data = await this.adminService.getRewards();
    return { success: true, data };
  }

  @Post('rewards')
  @RequirePermission('farm.manage_reward')
  async createReward(@Body() dto: CreateLuckyEnvelopeRewardDto) {
    const data = await this.adminService.createReward(dto);
    return { success: true, data };
  }

  @Put('rewards/:id')
  @RequirePermission('farm.manage_reward')
  async updateReward(
    @Param('id') id: string,
    @Body() dto: UpdateLuckyEnvelopeRewardDto,
  ) {
    const data = await this.adminService.updateReward(id, dto);
    return { success: true, data };
  }

  @Delete('rewards/:id')
  @RequirePermission('farm.manage_reward')
  async deleteReward(@Param('id') id: string) {
    const data = await this.adminService.deleteReward(id);
    return { success: true, data };
  }

  // ==========================================
  // 3. AUDIT & OPENING HISTORY
  // ==========================================

  @Get('history')
  @RequirePermission('farm.view')
  async getHistory(@Query() query: LuckyEnvelopeHistoryQueryDto) {
    const data = await this.adminService.getHistory(query);
    return { success: true, data };
  }

  // ==========================================
  // 4. ANALYTICS & KPIS
  // ==========================================

  @Get('analytics')
  @RequirePermission('farm.view')
  async getAnalytics() {
    const data = await this.adminService.getAnalytics();
    return { success: true, data };
  }
}
