import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { MembershipTiersService } from './membership-tiers.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@Controller('admin/membership-tiers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembershipTiersController {
  constructor(private readonly membershipTiersService: MembershipTiersService) {}

  @Get()
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ) {
    return this.membershipTiersService.findAll({
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      search
    });
  }

  @Post()
  @Roles(RoleType.ADMIN)
  create(@Body() data: any) {
    return this.membershipTiersService.create(data);
  }

  @Patch(':id')
  @Roles(RoleType.ADMIN)
  update(@Param('id') id: string, @Body() data: any) {
    return this.membershipTiersService.update(id, data);
  }

  @Get('dashboard-stats')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  async getDashboardStats() {
    const data = await this.membershipTiersService.getDashboardStats();
    return { data };
  }

  @Get(':id/analytics')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  async getAnalytics(@Param('id') id: string) {
    const data = await this.membershipTiersService.getAnalytics(id);
    return { data };
  }

  @Delete(':id')
  @Roles(RoleType.ADMIN)
  remove(@Param('id') id: string) {
    return this.membershipTiersService.remove(id);
  }
}
