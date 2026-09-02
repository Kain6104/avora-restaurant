import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { RoleType } from '@prisma/client';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.DASHBOARD_VIEW)
  async getStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.dashboardService.getStats({
      branchIdScope,
      from,
      to
    });
    return { data };
  }
}
