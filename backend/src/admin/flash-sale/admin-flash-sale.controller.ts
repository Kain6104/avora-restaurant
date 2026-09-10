import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AdminFlashSaleService, FlashSaleFilterDto } from './admin-flash-sale.service';
import { FlashSaleValidationService } from '../../flash-sale/flash-sale-validation.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';

@Controller('admin/flash-sales')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminFlashSaleController {
  constructor(
    private readonly flashSaleService: AdminFlashSaleService,
    private readonly validationService: FlashSaleValidationService,
  ) {}

  @Get()
  @RequirePermission('flashsales.view')
  async findAll(
    @Query() query: FlashSaleFilterDto,
    @BranchScope() branchIdScope?: string,
  ) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;
    const result = await this.flashSaleService.findAll(
      { ...query, page, limit },
      branchIdScope,
    );
    return { success: true, ...result, campaigns: result.data };
  }

  @Get('kpis')
  @RequirePermission('flashsales.view')
  async getKPIs(@BranchScope() branchIdScope?: string) {
    const data = await this.flashSaleService.getRealtimeKPIs(branchIdScope);
    return { success: true, data };
  }

  @Get('timeline')
  @RequirePermission('flashsales.view')
  async getTimeline(
    @Query('date') date: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.flashSaleService.getCalendarTimeline(date, branchIdScope);
    return { success: true, data };
  }

  @Post('validate')
  @RequirePermission('flashsales.view')
  async validateChecklist(@Body('id') id: string) {
    const result = await this.validationService.validatePrePublishChecklist(id);
    return { success: true, data: result };
  }

  @Get('recommendations/products')
  @RequirePermission('flashsales.view')
  async getProductRecommendations(@BranchScope() branchIdScope?: string) {
    const data = await this.flashSaleService.getProductRecommendations(branchIdScope);
    return { success: true, data };
  }

  @Post('check-collisions')
  @RequirePermission('flashsales.view')
  async checkCollisions(
    @Body()
    body: {
      campaignId?: string;
      startTime: string;
      endTime: string;
      branchIds?: string[];
      slots?: Array<{ name: string; startTime: string; endTime: string }>;
    },
    @BranchScope() branchIdScope?: string,
  ) {
    if (branchIdScope && (!body.branchIds || body.branchIds.length === 0)) {
      body.branchIds = [branchIdScope];
    }
    const data = await this.flashSaleService.checkCollisions(body);
    return { success: true, data };
  }

  @Get('reports/export')
  @RequirePermission('flashsales.view')
  async exportGlobalReportsExcel(
    @Query('range') range: string = '30days',
    @BranchScope() branchIdScope: string | undefined,
    @Res() res: any,
  ) {
    const buffer = await this.flashSaleService.exportGlobalReportsExcel(range, branchIdScope);
    const filename = `AVORA_FlashSale_Global_Report_${range}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Get('reports')
  @RequirePermission('flashsales.view')
  async getGlobalReports(
    @Query('range') range: string = '30days',
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.flashSaleService.getGlobalReports(range, branchIdScope);
    return { success: true, data };
  }

  @Get(':id/report')
  @RequirePermission('flashsales.view')
  async getReport(
    @Param('id') id: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.flashSaleService.getCampaignReport(id, branchIdScope);
    return { success: true, data };
  }

  @Get(':id/export')
  @RequirePermission('flashsales.view')
  async exportExcel(
    @Param('id') id: string,
    @BranchScope() branchIdScope: string | undefined,
    @Res() res: any,
  ) {
    const buffer = await this.flashSaleService.exportReportExcel(id, branchIdScope);
    const filename = `AVORA_FlashSale_Report_${id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Get(':id')
  @RequirePermission('flashsales.view')
  async findOne(
    @Param('id') id: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.flashSaleService.findOne(id, branchIdScope);
    return { success: true, data };
  }

  @Post()
  @RequirePermission('flashsales.create')
  async create(
    @Body() dto: any,
    @Req() req: any,
    @BranchScope() branchIdScope?: string,
  ) {
    if (branchIdScope) {
      dto.branchIds = [branchIdScope];
      delete dto.branchId;
    }
    const data = await this.flashSaleService.create(dto, req.user);
    return { success: true, data, message: 'Tạo chiến dịch Flash Sale thành công.' };
  }

  @Patch(':id')
  @RequirePermission('flashsales.update')
  async update(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: any,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.flashSaleService.update(id, dto, req.user, branchIdScope);
    return { success: true, data, message: 'Cập nhật chiến dịch Flash Sale thành công.' };
  }

  @Delete(':id')
  @RequirePermission('flashsales.delete')
  async cancel(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const data = await this.flashSaleService.cancel(id, req.user);
    return { success: true, data, message: 'Hủy chiến dịch Flash Sale thành công.' };
  }

  @Post(':id/cancel')
  @RequirePermission('flashsales.delete')
  async cancelPost(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const data = await this.flashSaleService.cancel(id, req.user);
    return { success: true, data, message: 'Hủy chiến dịch Flash Sale thành công.' };
  }

  @Post(':id/publish')
  @RequirePermission('flashsales.update')
  async publish(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const data = await this.flashSaleService.publish(id, req.user);
    return { success: true, data, message: 'Xuất bản chiến dịch thành công.' };
  }

  @Post(':id/pause')
  @RequirePermission('flashsales.update')
  async pause(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const data = await this.flashSaleService.pause(id, req.user);
    return { success: true, data, message: 'Tạm dừng chiến dịch thành công.' };
  }

  @Post(':id/resume')
  @RequirePermission('flashsales.update')
  async resume(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const data = await this.flashSaleService.resume(id, req.user);
    return { success: true, data, message: 'Tiếp tục chiến dịch thành công.' };
  }

  @Post(':id/clone')
  @RequirePermission('flashsales.create')
  async clone(
    @Param('id') id: string,
    @Body() body: { newStartTime: string; newEndTime: string; name?: string },
    @Req() req: any,
  ) {
    const data = await this.flashSaleService.clone(id, body, req.user);
    return { success: true, data, message: 'Nhân bản chiến dịch thành công.' };
  }
}
