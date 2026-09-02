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
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { PromotionsController } from './promotions/promotions.controller';
import { PromotionsService } from './promotions/promotions.service';
import { SettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { AuditLogsController } from './audit-logs/audit-logs.controller';
import { AuditLogsService } from './audit-logs/audit-logs.service';
import { UploadModule } from './upload/upload.module';

@Module({
  controllers: [UsersController, BranchesController, OrdersController, DashboardController, ProductsController, CategoriesController, PromotionsController, SettingsController, ReportsController, AuditLogsController, MembershipTiersController],
  providers: [UsersService, BranchesService, OrdersService, DashboardService, ProductsService, CategoriesService, PromotionsService, SettingsService, ReportsService, AuditLogsService, MembershipTiersService],
  imports: [UploadModule, OrderModule]
})
export class AdminModule {}
