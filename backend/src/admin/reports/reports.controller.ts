import { Controller, Get, UseGuards, Query, Param, Req, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ProductReportsService } from './product-reports.service';
import { FinancialReportsService } from './financial-reports.service';
import { TaxReportsService } from './tax-reports.service';
import { PaymentMethodReportsService } from './payment-method-reports.service';
import { VoucherReportsService } from './voucher-reports.service';
import { FlashSaleReportsService } from './flash-sale-reports.service';
import { CustomerReportsService } from './customer-reports.service';
import { MembershipPointReportsService } from './membership-point-reports.service';
import { EndOfDayReportService, EndOfDayQueryDto } from './end-of-day-report.service';
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
    private readonly financialReportsService: FinancialReportsService,
    private readonly taxReportsService: TaxReportsService,
    private readonly paymentMethodReportsService: PaymentMethodReportsService,
    private readonly voucherReportsService: VoucherReportsService,
    private readonly flashSaleReportsService: FlashSaleReportsService,
    private readonly customerReportsService: CustomerReportsService,
    private readonly membershipPointReportsService: MembershipPointReportsService,
    private readonly endOfDayReportService: EndOfDayReportService,
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

  // =========================================================================
  // ENTERPRISE FINANCIAL REPORTING & RECONCILIATION ENDPOINTS
  // =========================================================================

  @Get('financial/overview')
  @RequirePermission('reports.revenue.view')
  async getFinancialOverview(@Query() filter: any, @Req() req: any) {
    const data = await this.financialReportsService.getFinancialOverview(filter, req.user.id);
    return { success: true, data };
  }

  @Get('financial/branches')
  @RequirePermission('reports.revenue.view')
  async getFinancialBranches(@Query() filter: any, @Req() req: any) {
    const data = await this.financialReportsService.getBranchComparison(filter, req.user.id);
    return { success: true, data };
  }

  @Get('financial/branch/:branchId')
  @RequirePermission('reports.revenue.view')
  async getFinancialBranchDetail(
    @Param('branchId') branchId: string,
    @Query() filter: any,
    @Req() req: any,
  ) {
    const data = await this.financialReportsService.getBranchFinancialDetail(
      branchId,
      filter,
      req.user.id,
    );
    return { success: true, data };
  }

  @Get('financial/transactions')
  @RequirePermission('reports.revenue.view')
  async getFinancialTransactions(@Query() query: any, @Req() req: any) {
    const { page, limit, sortBy, sortOrder, ...filter } = query;
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
    };
    const data = await this.financialReportsService.getFinancialTransactions(
      filter,
      pagination,
      req.user.id,
    );
    return { success: true, data };
  }

  @Get('financial/transactions/:orderId')
  @RequirePermission('reports.revenue.view')
  async getFinancialTransactionDetail(
    @Param('orderId') orderId: string,
    @Req() req: any,
  ) {
    const data = await this.financialReportsService.getSingleOrderFinancialAudit(
      orderId,
      req.user.id,
    );
    return { success: true, data };
  }

  @Get('financial/metadata/filters')
  @RequirePermission('reports.revenue.view')
  async getFinancialFilterMetadata(@Req() req: any) {
    const data = await this.financialReportsService.getFilterMetadata(req.user.id);
    return { success: true, data };
  }

  @Get('financial/export')
  @RequirePermission('reports.export')
  async exportFinancialExcel(@Query() filter: any, @Req() req: any, @Res() res: any) {
    const buffer = await this.financialReportsService.exportFinancialExcel(filter, req.user.id);
    const filename = `AVORA_BaoCaoTaiChinh_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Get('financial/reconciliation')
  @RequirePermission('reports.revenue.view')
  async getReconciliationReport(@Query() filter: any, @Req() req: any) {
    const data = await this.financialReportsService.getReconciliationReport(filter, req.user.id);
    return { success: true, data };
  }

  // =========================================================================
  // ENTERPRISE TAX / VAT REPORTING ENDPOINTS (COMPLETED ORDERS ONLY)
  // =========================================================================

  @Get('tax/overview')
  @RequirePermission('reports.revenue.view')
  async getTaxOverview(@Query() filter: any, @Req() req: any) {
    const data = await this.taxReportsService.getTaxOverview(filter, req.user.id);
    return { success: true, data };
  }

  @Get('tax/rates')
  @RequirePermission('reports.revenue.view')
  async getTaxRates(@Query() filter: any, @Req() req: any) {
    const data = await this.taxReportsService.getTaxRates(filter, req.user.id);
    return { success: true, data };
  }

  @Get('tax/branches')
  @RequirePermission('reports.revenue.view')
  async getTaxBranches(@Query() filter: any, @Req() req: any) {
    const data = await this.taxReportsService.getTaxBranches(filter, req.user.id);
    return { success: true, data };
  }

  @Get('tax/categories')
  @RequirePermission('reports.revenue.view')
  async getTaxCategories(@Query() filter: any, @Req() req: any) {
    const data = await this.taxReportsService.getTaxCategories(filter, req.user.id);
    return { success: true, data };
  }

  @Get('tax/products')
  @RequirePermission('reports.revenue.view')
  async getTaxProducts(@Query() filter: any, @Req() req: any) {
    const data = await this.taxReportsService.getTaxProducts(filter, req.user.id);
    return { success: true, data };
  }

  @Get('tax/trend')
  @RequirePermission('reports.revenue.view')
  async getTaxTrend(@Query() filter: any, @Req() req: any) {
    const data = await this.taxReportsService.getTaxTrend(filter, req.user.id);
    return { success: true, data };
  }

  @Get('tax/transactions')
  @RequirePermission('reports.revenue.view')
  async getTaxTransactions(@Query() query: any, @Req() req: any) {
    const { page, limit, sortBy, sortOrder, ...filter } = query;
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || 'completionTimestamp',
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
    };
    const data = await this.taxReportsService.getTaxTransactions(filter, pagination, req.user.id);
    return { success: true, data };
  }

  @Get('tax/breakdown/:orderId')
  @RequirePermission('reports.revenue.view')
  async getTaxSingleOrderBreakdown(@Param('orderId') orderId: string, @Req() req: any) {
    const data = await this.taxReportsService.getTaxSingleOrderBreakdown(orderId, req.user.id);
    return { success: true, data };
  }

  @Get('tax/reconciliation')
  @RequirePermission('reports.revenue.view')
  async getTaxReconciliationReport(@Query() filter: any, @Req() req: any) {
    const data = await this.taxReportsService.getTaxReconciliationReport(filter, req.user.id);
    return { success: true, data };
  }

  @Get('tax/metadata/filters')
  @RequirePermission('reports.revenue.view')
  async getTaxFilterMetadata(@Req() req: any) {
    const data = await this.taxReportsService.getFilterMetadata(req.user.id);
    return { success: true, data };
  }

  @Get('tax/export')
  @RequirePermission('reports.export')
  async exportTaxExcel(@Query() filter: any, @Req() req: any, @Res() res: any) {
    const buffer = await this.taxReportsService.exportTaxExcel(filter, req.user.id);
    const filename = `AVORA_BaoCaoThue_VAT_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  // =========================================================================
  // PAYMENT METHODS REPORTING ENGINE (COMPLETED ORDERS ONLY - REVENUE & ORDER TABS)
  // =========================================================================

  @Get('payment-methods/overview')
  @RequirePermission('reports.revenue.view')
  async getPaymentMethodOverview(@Query() filter: any, @Req() req: any) {
    return this.paymentMethodReportsService.getOverview(req.user.id, filter);
  }

  @Get('payment-methods/methods')
  @RequirePermission('reports.revenue.view')
  async getPaymentMethodBreakdown(@Query() filter: any, @Req() req: any) {
    return this.paymentMethodReportsService.getMethods(req.user.id, filter);
  }

  @Get('payment-methods/branches')
  @RequirePermission('reports.revenue.view')
  async getPaymentMethodBranches(@Query() filter: any, @Req() req: any) {
    return this.paymentMethodReportsService.getBranches(req.user.id, filter);
  }

  @Get('payment-methods/trend')
  @RequirePermission('reports.revenue.view')
  async getPaymentMethodTrend(@Query() filter: any, @Req() req: any) {
    return this.paymentMethodReportsService.getTrend(req.user.id, filter);
  }

  @Get('payment-methods/transactions')
  @RequirePermission('reports.revenue.view')
  async getPaymentMethodTransactions(@Query() query: any, @Req() req: any) {
    const { page, limit, search, paymentMethod, sortBy, sortOrder, ...filter } = query;
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search: search || '',
      paymentMethod: paymentMethod || 'ALL',
      sortBy: sortBy || 'completedAt',
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
    };
    return this.paymentMethodReportsService.getTransactions(req.user.id, filter, pagination);
  }

  @Get('payment-methods/reconciliation')
  @RequirePermission('reports.revenue.view')
  async getPaymentMethodReconciliation(@Query() filter: any, @Req() req: any) {
    return this.paymentMethodReportsService.getReconciliation(req.user.id, filter);
  }

  @Get('payment-methods/metadata/filters')
  @RequirePermission('reports.revenue.view')
  async getPaymentMethodFilterMetadata(@Req() req: any) {
    return this.paymentMethodReportsService.getFilterMetadata(req.user.id);
  }

  @Get('payment-methods/export')
  @RequirePermission('reports.export')
  async exportPaymentMethodExcel(@Query() filter: any, @Req() req: any, @Res() res: any) {
    const buffer = await this.paymentMethodReportsService.exportExcel(req.user.id, filter);
    const filename = `AVORA_BaoCao_PhuongThucThanhToan_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  // =========================================================================
  // REPORT 1: VOUCHER & KHUYẾN MÃI (COMPLETED ORDERS ONLY)
  // =========================================================================

  @Get('vouchers/overview')
  @RequirePermission('reports.revenue.view')
  async getVoucherOverview(@Query() filter: any, @Req() req: any) {
    return this.voucherReportsService.getOverview(req.user.id, filter);
  }

  @Get('vouchers/performance')
  @RequirePermission('reports.revenue.view')
  async getVoucherPerformance(@Query() filter: any, @Req() req: any) {
    return this.voucherReportsService.getPerformance(req.user.id, filter);
  }

  @Get('vouchers/transactions')
  @RequirePermission('reports.revenue.view')
  async getVoucherTransactions(@Query() query: any, @Req() req: any) {
    const { page, limit, search, voucherId, sortBy, sortOrder, ...filter } = query;
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search: search || '',
      voucherId: voucherId || 'ALL',
      sortBy: sortBy || 'completedAt',
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
    };
    return this.voucherReportsService.getTransactions(req.user.id, filter, pagination);
  }

  @Get('vouchers/fraud')
  @RequirePermission('reports.revenue.view')
  async getVoucherFraudSignals(@Query() filter: any, @Req() req: any) {
    return this.voucherReportsService.getFraudSignals(req.user.id, filter);
  }

  @Get('vouchers/detail/:id')
  @RequirePermission('reports.revenue.view')
  async getVoucherDeepDive(@Param('id') id: string, @Query() filter: any, @Req() req: any) {
    return this.voucherReportsService.getVoucherDeepDive(req.user.id, id, filter);
  }

  @Get('vouchers/export')
  @RequirePermission('reports.export')
  async exportVoucherExcel(@Query() filter: any, @Req() req: any, @Res() res: any) {
    const buffer = await this.voucherReportsService.exportExcel(req.user.id, filter);
    const filename = `AVORA_BaoCao_Voucher_KhuyenMai_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  // =========================================================================
  // REPORT 2: FLASH SALE REPORTING ENGINE (COMPLETED ORDERS ONLY)
  // =========================================================================

  @Get('flash-sales/overview')
  @RequirePermission('reports.revenue.view')
  async getFlashSaleOverview(@Query() filter: any, @Req() req: any) {
    return this.flashSaleReportsService.getOverview(req.user.id, filter);
  }

  @Get('flash-sales/campaigns')
  @RequirePermission('reports.revenue.view')
  async getFlashSaleCampaigns(@Query() filter: any, @Req() req: any) {
    return this.flashSaleReportsService.getCampaigns(req.user.id, filter);
  }

  @Get('flash-sales/products')
  @RequirePermission('reports.revenue.view')
  async getFlashSaleProducts(@Query() filter: any, @Req() req: any) {
    return this.flashSaleReportsService.getProducts(req.user.id, filter);
  }

  @Get('flash-sales/timeslots')
  @RequirePermission('reports.revenue.view')
  async getFlashSaleTimeSlots(@Query() filter: any, @Req() req: any) {
    return this.flashSaleReportsService.getTimeSlots(req.user.id, filter);
  }

  @Get('flash-sales/reconciliation')
  @RequirePermission('reports.revenue.view')
  async getFlashSaleStockReconciliation(@Query() filter: any, @Req() req: any) {
    return this.flashSaleReportsService.getStockReconciliation(req.user.id, filter);
  }

  @Get('flash-sales/export')
  @RequirePermission('reports.export')
  async exportFlashSaleExcel(@Query() filter: any, @Req() req: any, @Res() res: any) {
    const buffer = await this.flashSaleReportsService.exportExcel(req.user.id, filter);
    const filename = `AVORA_BaoCao_FlashSale_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  // =========================================================================
  // REPORT 3: CUSTOMER REPORTING ENGINE (COMPLETED ORDERS ONLY - RFM & RETENTION)
  // =========================================================================

  @Get('customers/overview')
  @RequirePermission('reports.revenue.view')
  async getCustomerOverview(@Query() filter: any, @Req() req: any) {
    return this.customerReportsService.getOverview(req.user.id, filter);
  }

  @Get('customers/segments')
  @RequirePermission('reports.revenue.view')
  async getCustomerSegments(@Query() filter: any, @Req() req: any) {
    return this.customerReportsService.getSegments(req.user.id, filter);
  }

  @Get('customers/cohorts')
  @RequirePermission('reports.revenue.view')
  async getCustomerCohorts(@Query() filter: any, @Req() req: any) {
    return this.customerReportsService.getCohorts(req.user.id, filter);
  }

  @Get('customers/top')
  @RequirePermission('reports.revenue.view')
  async getTopCustomers(@Query() query: any, @Req() req: any) {
    const { page, limit, search, tierId, segment, sortBy, sortOrder, ...filter } = query;
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search: search || '',
      tierId: tierId || 'ALL',
      segment: segment || 'ALL',
      sortBy: sortBy || 'lifetimeNetSpend',
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
    };
    return this.customerReportsService.getTopCustomers(req.user.id, filter, pagination);
  }

  @Get('customers/detail/:id')
  @RequirePermission('reports.revenue.view')
  async getCustomerDetail(@Param('id') id: string, @Req() req: any) {
    return this.customerReportsService.getCustomerDetail(req.user.id, id);
  }

  @Get('customers/export')
  @RequirePermission('reports.export')
  async exportCustomerExcel(@Query() filter: any, @Req() req: any, @Res() res: any) {
    const buffer = await this.customerReportsService.exportExcel(req.user.id, filter);
    const filename = `AVORA_BaoCao_KhachHang_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  // =========================================================================
  // REPORT 4: MEMBERSHIP & POINT ENGINE (COMPLETED ORDERS & LEDGER RECONCILIATION)
  // =========================================================================

  @Get('membership-points/overview')
  @RequirePermission('reports.revenue.view')
  async getMembershipPointOverview(@Query() filter: any, @Req() req: any) {
    return this.membershipPointReportsService.getOverview(req.user.id, filter);
  }

  @Get('membership-points/tiers')
  @RequirePermission('reports.revenue.view')
  async getMembershipPointTiers(@Query() filter: any, @Req() req: any) {
    return this.membershipPointReportsService.getTiers(req.user.id, filter);
  }

  @Get('membership-points/dynamics')
  @RequirePermission('reports.revenue.view')
  async getMembershipPointDynamics(@Query() filter: any, @Req() req: any) {
    return this.membershipPointReportsService.getPointDynamics(req.user.id, filter);
  }

  @Get('membership-points/liability')
  @RequirePermission('reports.revenue.view')
  async getMembershipPointLiability(@Query() filter: any, @Req() req: any) {
    return this.membershipPointReportsService.getLiability(req.user.id, filter);
  }

  @Get('membership-points/reconciliation')
  @RequirePermission('reports.revenue.view')
  async getMembershipPointReconciliation(@Query() filter: any, @Req() req: any) {
    return this.membershipPointReportsService.getReconciliation(req.user.id, filter);
  }

  @Get('membership-points/transactions')
  @RequirePermission('reports.revenue.view')
  async getMembershipPointTransactions(@Query() query: any, @Req() req: any) {
    const { page, limit, search, source, tierId, sortBy, sortOrder, ...filter } = query;
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search: search || '',
      source: source || 'ALL',
      tierId: tierId || 'ALL',
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
    };
    return this.membershipPointReportsService.getTransactions(req.user.id, filter, pagination);
  }

  @Get('membership-points/export')
  @RequirePermission('reports.export')
  async exportMembershipPointExcel(@Query() filter: any, @Req() req: any, @Res() res: any) {
    const buffer = await this.membershipPointReportsService.exportExcel(req.user.id, filter);
    const filename = `AVORA_BaoCao_HoiVien_Diem_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Get('end-of-day')
  @RequirePermission('reports.view', { allowAllBranchesIfParamMissing: true })
  async getEndOfDayReport(@Query() query: EndOfDayQueryDto, @Req() req: any) {
    const data = await this.endOfDayReportService.getEndOfDayReport(query, req.user?.id);
    return {
      success: true,
      statusCode: 200,
      data,
    };
  }
}
