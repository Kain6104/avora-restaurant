import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { RoleType } from '@prisma/client';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async getSummary(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string
  ) {
    const data = await this.reportsService.getSummary(branchIdScope, from, to);
    return { data };
  }

  @Get('revenue-chart')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async getRevenueChart(@Query('days') days: string = '7', @BranchScope() branchIdScope?: string) {
    const daysNumber = parseInt(days, 10) || 7;
    const data = await this.reportsService.getRevenueChart(daysNumber, branchIdScope);
    return { data };
  }

  @Get('top-products')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async getTopProducts(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string
  ) {
    const data = await this.reportsService.getTopProducts(branchIdScope, from, to);
    return { data };
  }

  @Get('dish-stats')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async getDishStats(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string
  ) {
    const data = await this.reportsService.getDishStats(branchIdScope, from, to);
    return { data };
  }

  @Get('revenue-comparison')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async getRevenueComparison(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string
  ) {
    const data = await this.reportsService.getRevenueComparison(branchIdScope, from, to);
    return { data };
  }

  @Get('payment-stats')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async getPaymentStats(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string
  ) {
    const data = await this.reportsService.getPaymentStats(branchIdScope, from, to);
    return { data };
  }

  @Get('peak-hours')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async getPeakHoursStats(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string
  ) {
    const data = await this.reportsService.getPeakHoursStats(branchIdScope, from, to);
    return { data };
  }

  @Get('category-stats')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async getCategoryStats(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string
  ) {
    const data = await this.reportsService.getCategoryStats(branchIdScope, from, to);
    return { data };
  }

  @Get('tier-revenue')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.REPORTS_VIEW)
  async getTierRevenueStats(
    @Query('from') from: string,
    @Query('to') to: string,
    @BranchScope() branchIdScope?: string
  ) {
    const data = await this.reportsService.getTierRevenueStats(branchIdScope, from, to);
    return { data };
  }
}
