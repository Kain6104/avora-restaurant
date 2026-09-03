import { Controller, Get, Param, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { RoleType, OrderStatus } from '@prisma/client';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Roles(RoleType.ADMIN, RoleType.MANAGER, RoleType.CHEF)
  @Permissions(PERMISSIONS.ORDERS_VIEW)
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
    @Query('status') status?: OrderStatus,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    return this.ordersService.findAll({
      skip,
      take: limitNumber,
      search,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      branchIdScope,
    });
  }

  @Get('unread-count')
  @Roles(RoleType.ADMIN, RoleType.MANAGER, RoleType.CHEF)
  @Permissions(PERMISSIONS.ORDERS_VIEW)
  async getUnreadCount(@BranchScope() branchIdScope?: string) {
    const count = await this.ordersService.getUnreadCount(branchIdScope);
    return { data: count };
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.MANAGER, RoleType.CHEF)
  @Permissions(PERMISSIONS.ORDERS_VIEW)
  async findOne(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const data = await this.ordersService.findOne(id, branchIdScope);
    return { data };
  }

  @Patch(':id/status')
  @Roles(RoleType.ADMIN, RoleType.MANAGER, RoleType.CHEF)
  @Permissions(PERMISSIONS.ORDERS_UPDATE_STATUS)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.ordersService.updateStatus(id, status, branchIdScope);
    return { data, message: 'Updated order status successfully' };
  }

  @Patch(':id/payment-status')
  @Roles(RoleType.ADMIN, RoleType.MANAGER, RoleType.CHEF)
  @Permissions(PERMISSIONS.ORDERS_UPDATE_STATUS)
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body('paymentStatus') paymentStatus: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.ordersService.updatePaymentStatus(id, paymentStatus, branchIdScope);
    return { data, message: 'Updated payment status successfully' };
  }
}
