import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AdminFarmService } from './admin-farm.service';
import { FarmMailService, CreateFarmMailDto } from './farm-mail.service';
import { FarmTransactionService } from './farm-transaction.service';
import { FarmExchangeService } from './farm-exchange.service';
import { CreateAdminCropDto, CreateAdminMutationDto, CreateAdminRewardDto, CreateAdminMissionDto, FarmConfigDto } from './dto/farm.dto';

@Controller('admin/farm')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminFarmController {
  constructor(
    private readonly adminFarmService: AdminFarmService,
    private readonly farmMailService: FarmMailService,
    private readonly farmTransactionService: FarmTransactionService,
    private readonly farmExchangeService: FarmExchangeService,
  ) {}

  // ==========================================
  // DASHBOARD & ANALYTICS
  // ==========================================

  @Get('dashboard')
  @RequirePermission('farm.view')
  async getDashboard() {
    const data = await this.adminFarmService.getDashboardMetrics();
    return { success: true, data };
  }

  // ==========================================
  // CROPS MANAGEMENT
  // ==========================================

  @Get('crops')
  @RequirePermission('farm.manage_crop')
  async getCrops() {
    const data = await this.adminFarmService.getAllCrops();
    return { success: true, data };
  }

  @Post('crops')
  @RequirePermission('farm.manage_crop')
  async createCrop(@Body() dto: CreateAdminCropDto) {
    const data = await this.adminFarmService.createCrop(dto);
    return { success: true, data };
  }

  @Patch('crops/:id')
  @RequirePermission('farm.manage_crop')
  async updateCrop(@Param('id') id: string, @Body() dto: Partial<CreateAdminCropDto>) {
    const data = await this.adminFarmService.updateCrop(id, dto);
    return { success: true, data };
  }

  @Delete('crops/:id')
  @RequirePermission('farm.manage_crop')
  async deleteCrop(@Param('id') id: string) {
    const data = await this.adminFarmService.deleteCrop(id);
    return { success: true, data };
  }

  // ==========================================
  // MUTATIONS MANAGEMENT
  // ==========================================

  @Get('mutations')
  @RequirePermission('farm.manage_mutation')
  async getMutations() {
    const data = await this.adminFarmService.getAllMutations();
    return { success: true, data };
  }

  @Post('mutations')
  @RequirePermission('farm.manage_mutation')
  async createMutation(@Body() dto: CreateAdminMutationDto) {
    const data = await this.adminFarmService.createMutation(dto);
    return { success: true, data };
  }

  @Patch('mutations/:id')
  @RequirePermission('farm.manage_mutation')
  async updateMutation(@Param('id') id: string, @Body() dto: Partial<CreateAdminMutationDto>) {
    const data = await this.adminFarmService.updateMutation(id, dto);
    return { success: true, data };
  }

  @Delete('mutations/:id')
  @RequirePermission('farm.manage_mutation')
  async deleteMutation(@Param('id') id: string) {
    const data = await this.adminFarmService.deleteMutation(id);
    return { success: true, data };
  }

  // ==========================================
  // REWARDS MANAGEMENT
  // ==========================================

  @Get('rewards')
  @RequirePermission('farm.manage_reward')
  async getRewards() {
    const data = await this.adminFarmService.getAllRewards();
    return { success: true, data };
  }

  @Post('rewards')
  @RequirePermission('farm.manage_reward')
  async createReward(@Body() dto: CreateAdminRewardDto) {
    const data = await this.adminFarmService.createReward(dto);
    return { success: true, data };
  }

  @Patch('rewards/:id')
  @RequirePermission('farm.manage_reward')
  async updateReward(@Param('id') id: string, @Body() dto: Partial<CreateAdminRewardDto>) {
    const data = await this.adminFarmService.updateReward(id, dto);
    return { success: true, data };
  }

  @Delete('rewards/:id')
  @RequirePermission('farm.manage_reward')
  async deleteReward(@Param('id') id: string) {
    const data = await this.adminFarmService.deleteReward(id);
    return { success: true, data };
  }

  // ==========================================
  // MISSIONS MANAGEMENT
  // ==========================================

  @Get('missions')
  @RequirePermission('farm.view')
  async getMissions() {
    const data = await this.adminFarmService.getAllMissions();
    return { success: true, data };
  }

  @Post('missions')
  @RequirePermission('farm.manage_reward')
  async createMission(@Body() dto: CreateAdminMissionDto) {
    const data = await this.adminFarmService.createMission(dto);
    return { success: true, data };
  }

  @Patch('missions/:id')
  @RequirePermission('farm.manage_reward')
  async updateMission(@Param('id') id: string, @Body() dto: Partial<CreateAdminMissionDto>) {
    const data = await this.adminFarmService.updateMission(id, dto);
    return { success: true, data };
  }

  @Delete('missions/:id')
  @RequirePermission('farm.manage_reward')
  async deleteMission(@Param('id') id: string) {
    const data = await this.adminFarmService.deleteMission(id);
    return { success: true, data };
  }

  // ==========================================
  // ECONOMY MONITORING
  // ==========================================

  @Get('economy')
  @RequirePermission('farm.view_economy')
  async getEconomy() {
    const data = await this.adminFarmService.getEconomyStats();
    return { success: true, data };
  }

  // ==========================================
  // FRAUD & SECURITY
  // ==========================================

  @Get('security')
  @RequirePermission('farm.view_security')
  async getSecurity() {
    const data = await this.adminFarmService.getSecurityAlerts();
    return { success: true, data };
  }

  // ==========================================
  // FARM INSPECTOR
  // ==========================================

  @Get('inspect/:identifier')
  @RequirePermission('farm.view_security')
  async inspectFarm(@Param('identifier') identifier: string) {
    const data = await this.adminFarmService.inspectUserFarm(identifier);
    return { success: true, data };
  }

  // ==========================================
  // MAINTENANCE MODE CONTROL
  // ==========================================

  @Get('maintenance')
  @RequirePermission('farm.view')
  async getMaintenance() {
    const data = await this.adminFarmService.getMaintenanceConfig();
    return { success: true, data };
  }

  @Post('maintenance')
  @RequirePermission('farm.manage_shop')
  async setMaintenance(@Body() dto: { enabled: boolean; message?: string; estimatedEndTime?: string }) {
    const data = await this.adminFarmService.setMaintenanceConfig(dto);
    return { success: true, data };
  }

  // ==========================================
  // GAME CONFIGURATION (DYNAMIC SETTINGS)
  // ==========================================

  @Get('config')
  @RequirePermission('farm.view')
  async getGameConfig() {
    const data = await this.adminFarmService.getGameConfig();
    return { success: true, data };
  }

  @Post('config')
  @RequirePermission('farm.manage_shop')
  async updateGameConfig(@Body() dto: FarmConfigDto) {
    const data = await this.adminFarmService.updateGameConfig(dto);
    return { success: true, data };
  }

  // ==========================================
  // MAILBOX & GIFTS MANAGEMENT
  // ==========================================

  @Get('mails')
  @RequirePermission('farm.view')
  async getAdminMails() {
    const data = await this.farmMailService.getAdminMails();
    return { success: true, data };
  }

  @Post('mails')
  @RequirePermission('farm.manage_reward')
  async sendMail(@Request() req: any, @Body() dto: CreateFarmMailDto) {
    const data = await this.farmMailService.createAdminMail(req.user.id, dto);
    return { success: true, data };
  }

  @Delete('mails/:id')
  @RequirePermission('farm.manage_reward')
  async deleteMail(@Param('id') id: string) {
    const data = await this.farmMailService.deleteAdminMail(id);
    return { success: true, data };
  }

  @Post('mails/:id/revoke')
  @RequirePermission('farm.manage_reward')
  async revokeMail(@Param('id') id: string) {
    const data = await this.farmMailService.revokeAdminMail(id);
    return { success: true, data };
  }

  @Get('mails/:id/recipients')
  @RequirePermission('farm.view')
  async getMailRecipients(@Param('id') id: string) {
    const data = await this.farmMailService.getAdminMailRecipients(id);
    return { success: true, data };
  }

  // ==========================================
  // USER FARM HISTORY INSPECTOR
  // ==========================================

  @Get('users/:id/history')
  @RequirePermission('farm.view_security')
  async getAdminUserFarmHistory(
    @Param('id') id: string,
    @Query() query: any,
  ) {
    const data = await this.farmTransactionService.getAdminUserFarmHistory(id, query);
    return { success: true, data };
  }

  // ==========================================
  // EXCHANGE SETTINGS
  // ==========================================

  @Get('exchange')
  @RequirePermission('farm.view')
  async getExchangeSetting() {
    const data = await this.farmExchangeService.getExchangeSetting();
    return { success: true, data };
  }

  @Patch('exchange')
  @RequirePermission('farm.manage_shop')
  async updateExchangeSetting(@Body() dto: any) {
    const data = await this.farmExchangeService.updateExchangeSetting(dto);
    return { success: true, data };
  }
}
