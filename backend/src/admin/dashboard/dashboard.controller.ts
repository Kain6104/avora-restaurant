import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermission('dashboard.view')
  async getStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.dashboardService.getStats({
      branchIdScope,
      from,
      to,
    });
    return { data };
  }
}
