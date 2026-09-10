import { Controller, Get, Param, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { OrderStatus } from '@prisma/client';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermission('orders.view')
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('tab') tab?: 'ALL' | 'POS' | 'ONLINE',
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('status') status?: OrderStatus,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('isInvoiceRequested') isInvoiceRequested?: string,
    @Query('cashierName') cashierName?: string,
    @Query('sortBy') sortBy?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    let invoiceReqBool: boolean | undefined = undefined;
    if (isInvoiceRequested === 'true') invoiceReqBool = true;
    else if (isInvoiceRequested === 'false') invoiceReqBool = false;

    return this.ordersService.findAll({
      skip,
      take: limitNumber,
      tab,
      branchId,
      branchIdScope,
      search,
      status,
      paymentStatus,
      paymentMethod,
      isInvoiceRequested: invoiceReqBool,
      cashierName,
      sortBy,
      dateFrom: from || dateFrom,
      dateTo: to || dateTo,
    });
  }

  @Get('status-counts')
  @RequirePermission('orders.view')
  async getStatusCounts(
    @Query('tab') tab?: 'ALL' | 'POS' | 'ONLINE',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.ordersService.getStatusCounts({
      tab,
      branchId,
      branchIdScope,
      dateFrom: from || dateFrom,
      dateTo: to || dateTo,
    });
    return { success: true, data };
  }

  @Get('filter-options')
  @RequirePermission('orders.view')
  async getFilterOptions(@BranchScope() branchIdScope?: string) {
    const data = await this.ordersService.getFilterOptions(branchIdScope);
    return { success: true, data };
  }

  @Get('unread-count')
  @RequirePermission('orders.view')
  async getUnreadCount(@BranchScope() branchIdScope?: string) {
    const count = await this.ordersService.getUnreadCount(branchIdScope);
    return { data: count };
  }

  @Get(':id')
  @RequirePermission('orders.detail.view', {
    resourceResolver: async (req, prisma) => {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return order?.branchId;
    },
  })
  async findOne(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const data = await this.ordersService.findOne(id, branchIdScope);
    return { data };
  }

  @Patch(':id/status')
  @RequirePermission('orders.status.update', {
    resourceResolver: async (req, prisma) => {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return order?.branchId;
    },
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.ordersService.updateStatus(id, status, branchIdScope);
    return { data, message: 'Updated order status successfully' };
  }

  @Patch(':id/payment-status')
  @RequirePermission('orders.status.update', {
    resourceResolver: async (req, prisma) => {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return order?.branchId;
    },
  })
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body('paymentStatus') paymentStatus: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.ordersService.updatePaymentStatus(id, paymentStatus, branchIdScope);
    return { data, message: 'Updated payment status successfully' };
  }
}
