import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { PreviewVoucherAudienceDto, SendVoucherCampaignDto } from './dto/voucher-campaign.dto';

@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  // --- VOUCHERS ---
  @Get('vouchers')
  @RequirePermission('vouchers.view')
  async findAllVouchers(
    @Query('page') page: string = '1', 
    @Query('limit') limit: string = '10', 
    @Query('search') search?: string,
    @Query('membershipTierId') tierId?: string,
    @BranchScope() branchIdScope?: string
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    return this.promotionsService.findAllVouchers({ skip: (pageNumber - 1) * limitNumber, take: limitNumber, search, tierId, branchIdScope });
  }

  @Post('vouchers')
  @RequirePermission('vouchers.create')
  async createVoucher(@Body() data: any, @BranchScope() branchIdScope?: string) {
    if (branchIdScope) {
      data.branchIds = [branchIdScope];
      delete data.branchId;
    }
    const result = await this.promotionsService.createVoucher(data);
    return { data: result, message: 'Created voucher successfully' };
  }

  @Get('vouchers/analytics')
  @RequirePermission('vouchers.view')
  async getVoucherAnalytics(@BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.getVoucherAnalytics(branchIdScope);
    return { data: result, success: true };
  }

  @Get('vouchers/fraud-alerts')
  @RequirePermission('vouchers.view')
  async getVoucherFraudAlerts(@BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.getFraudAlerts(branchIdScope);
    return { data: result, success: true };
  }

  @Get('vouchers/recipients/search')
  @RequirePermission('vouchers.update')
  async searchVoucherRecipients(@Query('search') search?: string) {
    const result = await this.promotionsService.searchUsersForVoucher(search);
    return { data: result, success: true };
  }

  @Post('vouchers/:id/notify/preview')
  @RequirePermission('vouchers.update')
  async previewVoucherAudience(
    @Param('id') id: string,
    @Body() dto: PreviewVoucherAudienceDto,
    @BranchScope() branchIdScope?: string
  ) {
    const result = await this.promotionsService.previewVoucherAudience(id, dto, branchIdScope);
    return { data: result, success: true };
  }

  @Post('vouchers/:id/notify')
  @RequirePermission('vouchers.update')
  async sendVoucherNotification(
    @Param('id') id: string,
    @Body() dto: SendVoucherCampaignDto,
    @Req() req: any,
    @BranchScope() branchIdScope?: string
  ) {
    const userContext = req?.user;
    const ipAddress = req?.ip || req?.connection?.remoteAddress;
    const result = await this.promotionsService.sendVoucherNotification(id, dto, userContext, branchIdScope, ipAddress);
    return { data: result, success: true, message: result.message };
  }

  @Post('vouchers/:id/auto-distribute')
  @RequirePermission('vouchers.update')
  async autoDistributeVoucher(
    @Param('id') id: string,
    @BranchScope() branchIdScope?: string
  ) {
    const result = await this.promotionsService.autoDistributeVoucher(id, branchIdScope);
    return { data: result, success: true, message: result.message };
  }

  @Get('vouchers/:id')
  @RequirePermission('vouchers.view')
  async findOneVoucher(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.findOneVoucher(id, branchIdScope);
    return { data: result, success: true };
  }

  @Patch('vouchers/:id')
  @RequirePermission('vouchers.update')
  async updateVoucher(@Param('id') id: string, @Body() data: any, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.updateVoucher(id, data, branchIdScope);
    return { data: result, message: 'Updated voucher successfully' };
  }

  @Delete('vouchers/:id')
  @RequirePermission('vouchers.delete')
  async deleteVoucher(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.deleteVoucher(id, branchIdScope);
    return { data: result, message: 'Deleted voucher successfully' };
  }

  // --- FLASH SALES ---
  @Get('flash-sales')
  @RequirePermission('flashsales.view')
  async findAllFlashSales(
    @Query('page') page: string = '1', 
    @Query('limit') limit: string = '10', 
    @Query('search') search?: string,
    @Query('membershipTierId') tierId?: string,
    @BranchScope() branchIdScope?: string
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    return this.promotionsService.findAllFlashSales({ skip: (pageNumber - 1) * limitNumber, take: limitNumber, search, tierId, branchIdScope });
  }

  @Post('flash-sales')
  @RequirePermission('flashsales.create')
  async createFlashSale(@Body() data: any, @BranchScope() branchIdScope?: string) {
    if (branchIdScope) {
      data.branchIds = [branchIdScope];
      delete data.branchId;
    }
    const result = await this.promotionsService.createFlashSale(data);
    return { data: result, message: 'Created flash sale successfully' };
  }

  @Patch('flash-sales/:id')
  @RequirePermission('flashsales.update')
  async updateFlashSale(@Param('id') id: string, @Body() data: any, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.updateFlashSale(id, data, branchIdScope);
    return { data: result, message: 'Updated flash sale successfully' };
  }

  @Delete('flash-sales/:id')
  @RequirePermission('flashsales.delete')
  async deleteFlashSale(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.deleteFlashSale(id, branchIdScope);
    return { data: result, message: 'Deleted flash sale successfully' };
  }

  // --- COMBOS ---
  @Get('combos')
  @RequirePermission('combos.view')
  async findAllCombos(
    @Query('page') page: string = '1', 
    @Query('limit') limit: string = '10', 
    @Query('search') search?: string,
    @Query('membershipTierId') tierId?: string,
    @BranchScope() branchIdScope?: string
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    return this.promotionsService.findAllCombos({ skip: (pageNumber - 1) * limitNumber, take: limitNumber, search, tierId, branchIdScope });
  }

  @Post('combos')
  @RequirePermission('combos.create')
  async createCombo(@Body() data: any, @BranchScope() branchIdScope?: string) {
    if (branchIdScope) {
      data.branchIds = [branchIdScope];
      delete data.branchId;
    }
    const result = await this.promotionsService.createCombo(data);
    return { data: result, message: 'Created combo successfully' };
  }

  @Patch('combos/:id')
  @RequirePermission('combos.update')
  async updateCombo(@Param('id') id: string, @Body() data: any, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.updateCombo(id, data, branchIdScope);
    return { data: result, message: 'Updated combo successfully' };
  }

  @Delete('combos/:id')
  @RequirePermission('combos.delete')
  async deleteCombo(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.deleteCombo(id, branchIdScope);
    return { data: result, message: 'Deleted combo successfully' };
  }
}
