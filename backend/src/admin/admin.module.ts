import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { MembershipTiersController } from './membership-tiers/membership-tiers.controller';
import { MembershipTiersService } from './membership-tiers/membership-tiers.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { BranchesController } from './branches/branches.controller';
import { BranchesService } from './branches/branches.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { ProductsExcelService } from './products/products-excel.service';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { PromotionsController } from './promotions/promotions.controller';
import { PromotionsService } from './promotions/promotions.service';
import { SettingsController } from './settings/settings.controller';
import { PublicSettingsController } from './settings/public-settings.controller';
import { SettingsService } from './settings/settings.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { ProductReportCalculationService } from './reports/product-report-calculation.service';
import { ProductReportsService } from './reports/product-reports.service';
import { ProductReportsExcelService } from './reports/product-reports-excel.service';
import { FinancialReportCalculationService } from './reports/financial-report-calculation.service';
import { FinancialReportsService } from './reports/financial-reports.service';
import { FinancialReportsExcelService } from './reports/financial-reports-excel.service';
import { TaxReportCalculationService } from './reports/tax-report-calculation.service';
import { TaxReportsService } from './reports/tax-reports.service';
import { TaxReportsExcelService } from './reports/tax-reports-excel.service';
import { PaymentMethodReportCalculationService } from './reports/payment-method-report-calculation.service';
import { PaymentMethodReportsService } from './reports/payment-method-reports.service';
import { PaymentMethodReportsExcelService } from './reports/payment-method-reports-excel.service';
import { VoucherReportCalculationService } from './reports/voucher-report-calculation.service';
import { VoucherReportsService } from './reports/voucher-reports.service';
import { VoucherReportsExcelService } from './reports/voucher-reports-excel.service';
import { FlashSaleReportCalculationService } from './reports/flash-sale-report-calculation.service';
import { FlashSaleReportsService } from './reports/flash-sale-reports.service';
import { FlashSaleReportsExcelService } from './reports/flash-sale-reports-excel.service';
import { CustomerReportCalculationService } from './reports/customer-report-calculation.service';
import { CustomerReportsService } from './reports/customer-reports.service';
import { CustomerReportsExcelService } from './reports/customer-reports-excel.service';
import { MembershipPointCalculationService } from './reports/membership-point-calculation.service';
import { MembershipPointReportsService } from './reports/membership-point-reports.service';
import { MembershipPointReportsExcelService } from './reports/membership-point-reports-excel.service';
import { EndOfDayReportService } from './reports/end-of-day-report.service';
import { AuditLogsController } from './audit-logs/audit-logs.controller';
import { AuditLogsService } from './audit-logs/audit-logs.service';
import { UploadModule } from './upload/upload.module';
import { NotificationModule } from '../notification/notification.module';

import { AdminBannerController } from './banner/admin-banner.controller';
import { AdminBannerService } from './banner/admin-banner.service';

import { AdminFlashSaleModule } from './flash-sale/admin-flash-sale.module';
import { FlashSaleCoreModule } from '../flash-sale/flash-sale.module';

@Module({
  controllers: [
    UsersController,
    BranchesController,
    OrdersController,
    DashboardController,
    ProductsController,
    CategoriesController,
    PromotionsController,
    AdminBannerController,
    SettingsController,
    PublicSettingsController,
    ReportsController,
    AuditLogsController,
    MembershipTiersController,
  ],
  providers: [
    UsersService,
    BranchesService,
    OrdersService,
    DashboardService,
    ProductsService,
    ProductsExcelService,
    CategoriesService,
    PromotionsService,
    AdminBannerService,
    SettingsService,
    ReportsService,
    ProductReportCalculationService,
    ProductReportsService,
    ProductReportsExcelService,
    FinancialReportCalculationService,
    FinancialReportsService,
    FinancialReportsExcelService,
    TaxReportCalculationService,
    TaxReportsService,
    TaxReportsExcelService,
    PaymentMethodReportCalculationService,
    PaymentMethodReportsService,
    PaymentMethodReportsExcelService,
    VoucherReportCalculationService,
    VoucherReportsService,
    VoucherReportsExcelService,
    FlashSaleReportCalculationService,
    FlashSaleReportsService,
    FlashSaleReportsExcelService,
    CustomerReportCalculationService,
    CustomerReportsService,
    CustomerReportsExcelService,
    MembershipPointCalculationService,
    MembershipPointReportsService,
    MembershipPointReportsExcelService,
    EndOfDayReportService,
    AuditLogsService,
    MembershipTiersService,
  ],
  imports: [UploadModule, OrderModule, NotificationModule, FlashSaleCoreModule, AdminFlashSaleModule],
  exports: [
    AuditLogsService,
    AdminBannerService,
    TaxReportsService,
    PaymentMethodReportsService,
    VoucherReportsService,
    FlashSaleReportsService,
    CustomerReportsService,
    MembershipPointReportsService,
    EndOfDayReportService,
  ],
})
export class AdminModule {}
