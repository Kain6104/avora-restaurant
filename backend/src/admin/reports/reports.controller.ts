import { Controller, Get, UseGuards, Query, Param, Req, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ProductReportsService } from './product-reports.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';

@Controller('admin/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly productReportsService: ProductReportsService,
  ) {}

  @Get('summary')
  @RequirePermission('reports.view')
  async getSummary(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.reportsService.getSummary(branchIdScope, from, to);
    return { data };
  }

  @Get('revenue-chart')
  @RequirePermission('reports.revenue.view')
  async getRevenueChart(@Query('days') days: string = '7', @BranchScope() branchIdScope?: string) {
    const daysNumber = parseInt(days, 10) || 7;
    const data = await this.reportsService.getRevenueChart(daysNumber, branchIdScope);
    return { data };
  }

  @Get('top-products')
  @RequirePermission('reports.products.view')
  async getTopProducts(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.reportsService.getTopProducts(branchIdScope, from, to);
    return { data };
  }

  @Get('dish-stats')
  @RequirePermission('reports.products.view')
  async getDishStats(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.reportsService.getDishStats(branchIdScope, from, to);
    return { data };
  }

  @Get('revenue-comparison')
  @RequirePermission('reports.revenue.view')
  async getRevenueComparison(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.reportsService.getRevenueComparison(branchIdScope, from, to);
    return { data };
  }

  @Get('payment-stats')
  @RequirePermission('reports.revenue.view')
  async getPaymentStats(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.reportsService.getPaymentStats(branchIdScope, from, to);
    return { data };
  }

  @Get('peak-hours')
  @RequirePermission('reports.orders.view')
  async getPeakHoursStats(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.reportsService.getPeakHoursStats(branchIdScope, from, to);
    return { data };
  }

  @Get('category-stats')
  @RequirePermission('reports.products.view')
  async getCategoryStats(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.reportsService.getCategoryStats(branchIdScope, from, to);
    return { data };
  }

  @Get('tier-revenue')
  @RequirePermission('reports.revenue.view')
  async getTierRevenueStats(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.reportsService.getTierRevenueStats(branchIdScope, from, to);
    return { data };
  }

  // =========================================================================
  // ENTERPRISE PRODUCT SALES REPORTING ENDPOINTS
  // =========================================================================

  @Get('products/overview')
  @RequirePermission('reports.products.view')
  async getProductsOverview(
    @Query() filter: any,
    @Req() req: any,
  ) {
    const data = await this.productReportsService.getProductReportOverview(filter, req.user.id);
    return { success: true, data };
  }

  @Get('products/metadata/filters')
  @RequirePermission('reports.products.view')
  async getProductsFilterMetadata(@Req() req: any) {
    const data = await this.productReportsService.getFilterMetadata(req.user.id);
    return { success: true, data };
  }

  @Get('products/export')
  @RequirePermission('reports.export')
  async exportProductsExcel(
    @Query() filter: any,
    @Req() req: any,
    @Res() res: any,
  ) {
    const buffer = await this.productReportsService.exportProductReportExcel(filter, req.user.id);
    const filename = `AVORA_BaoCaoMatHang_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Get('products/:productId/transactions')
  @RequirePermission('reports.products.view')
  async getProductTransactions(
    @Param('productId') productId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const { page, limit, sortBy, sortOrder, ...filter } = query;
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
    };
    const data = await this.productReportsService.getProductTransactions(
      productId,
      filter,
      pagination,
      req.user.id,
    );
    return { success: true, data };
  }

  @Get('products/:productId/export')
  @RequirePermission('reports.export')
  async exportSingleProductExcel(
    @Param('productId') productId: string,
    @Query() filter: any,
    @Req() req: any,
    @Res() res: any,
  ) {
    const buffer = await this.productReportsService.exportSingleProductExcel(productId, filter, req.user.id);
    const filename = `AVORA_BaoCao_${productId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Get('products/:productId')
  @RequirePermission('reports.products.view')
  async getProductDetail(
    @Param('productId') productId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const { trendGrouping, ...filter } = query;
    const data = await this.productReportsService.getProductDetailReport(
      productId,
      filter,
      req.user.id,
      trendGrouping || 'day',
    );
    return { success: true, data };
  }
}
