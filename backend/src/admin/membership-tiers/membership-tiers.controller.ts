import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { MembershipTiersService } from './membership-tiers.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('admin/membership-tiers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MembershipTiersController {
  constructor(private readonly membershipTiersService: MembershipTiersService) {}

  @Get()
  @RequirePermission('membership.view')
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ) {
    return this.membershipTiersService.findAll({
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      search,
    });
  }

  @Post()
  @RequirePermission('membership.create')
  create(@Body() data: any) {
    return this.membershipTiersService.create(data);
  }

  @Patch(':id')
  @RequirePermission('membership.update')
  update(@Param('id') id: string, @Body() data: any) {
    return this.membershipTiersService.update(id, data);
  }

  @Get('dashboard-stats')
  @RequirePermission('membership.view')
  async getDashboardStats() {
    const data = await this.membershipTiersService.getDashboardStats();
    return { data };
  }

  @Get(':id/analytics')
  @RequirePermission('membership.view')
  async getAnalytics(@Param('id') id: string) {
    const data = await this.membershipTiersService.getAnalytics(id);
    return { data };
  }

  @Delete(':id')
  @RequirePermission('membership.delete')
  remove(@Param('id') id: string) {
    return this.membershipTiersService.remove(id);
  }
}
