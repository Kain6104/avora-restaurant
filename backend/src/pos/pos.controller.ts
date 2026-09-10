import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PosService } from './pos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CreatePosOrderDto,
  UpdatePosOrderDto,
  SendKitchenDto,
  HoldOrderDto,
  SplitOrderDto,
  MergeOrderDto,
  MoveTableDto,
  ProcessPaymentDto,
  OpenShiftDto,
  CloseShiftDto,
  UpdateKitchenItemStatusDto,
  ToggleProductAvailabilityDto,
  UpdateTableLayoutDto,
  CancelOrderDto,
  ValidateVoucherDto,
  CheckInReservationDto,
  CreateMemberDto,
  ConfirmPrintDto,
  ReprintLabelsDto,
  ReprintKitchenDto,
  AddServiceChargeDto,
  SendTableItemsDto,
} from './dto/pos.dto';
import { OrderStatus } from '@prisma/client';

@Controller('pos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('init')
  @RequirePermission('pos.access', { branchParam: 'branchId' })
  async getInitData(@Query('branchId') branchId?: string, @Req() req?: any) {
    const data = await this.posService.getInitData(branchId, req?.user);
    return { success: true, data };
  }

  @Get('invoices')
  @RequirePermission('pos.access', { branchParam: 'branchId' })
  async getInvoices(
    @Query('branchId') branchId: string,
    @Query() query: any,
  ) {
    const data = await this.posService.getInvoices(branchId, query);
    return { success: true, data };
  }

  @Get('products')
  @RequirePermission('pos.access', { branchParam: 'branchId' })
  async getProducts(
    @Query('branchId') branchId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.posService.getProducts(branchId, categoryId, search);
    return { success: true, data };
  }

  @Patch('products/:id/availability')
  @RequirePermission('products.availability.update', { branchParam: 'branchId' })
  async toggleProductAvailability(
    @Param('id') id: string,
    @Body() dto: ToggleProductAvailabilityDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.toggleProductAvailability(
      id,
      dto.available,
      dto.branchId,
      req?.user,
    );
    return { success: true, data };
  }

  @Get('tables')
  @RequirePermission('tables.view', { branchParam: 'branchId' })
  async getTables(@Query('branchId') branchId: string) {
    const data = await this.posService.getTables(branchId);
    return { success: true, data };
  }

  @Get('tables/:id/session')
  @RequirePermission('pos.order.view', { branchParam: 'branchId' })
  async getTableSession(
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.posService.getTableSessionDetail(id, branchId);
    return { success: true, data };
  }

  @Post('tables/:id/send-items')
  @RequirePermission('pos.item.add', {
    resourceResolver: async (req, prisma) =>
      (await prisma.restaurantTable.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async sendTableItems(
    @Param('id') id: string,
    @Body() dto: SendTableItemsDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.sendTableItemsToKitchen(id, dto, req?.user);
    return { success: true, data, printStatus: (data as any)?.printStatus };
  }

  @Get('qr-orders')
  @RequirePermission('pos.qr_order.process', { branchParam: 'branchId' })
  async getQrOrders(@Query('branchId') branchId: string) {
    const data = await this.posService.getQrOrders(branchId);
    return { success: true, data };
  }

  @Post('qr-orders/:id/confirm')
  @RequirePermission('pos.qr_order.process', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async confirmQrOrder(@Param('id') id: string, @Req() req?: any) {
    const data = await this.posService.confirmQrOrder(id, req?.user);
    return { success: true, data };
  }

  @Post('qr-orders/:id/reject')
  @RequirePermission('pos.qr_order.process', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async rejectQrOrder(
    @Param('id') id: string,
    @Body('reason') reason?: string,
    @Req() req?: any,
  ) {
    const data = await this.posService.rejectQrOrder(id, reason, req?.user);
    return { success: true, data };
  }

  @Post('tables/:id/call-waiter')
  async callWaiter(
    @Param('id') id: string,
    @Body('message') message?: string,
  ) {
    const data = await this.posService.requestCustomerHelp(id, message);
    return data;
  }

  @Post('tables/:id/request-payment')
  async requestTablePayment(@Param('id') id: string) {
    const data = await this.posService.requestTablePayment(id);
    return data;
  }

  @Put('tables/layout')
  @RequirePermission('tables.layout.update', { branchParam: 'branchId' })
  async updateTableLayout(
    @Query('branchId') branchId: string,
    @Body() dto: UpdateTableLayoutDto,
  ) {
    const data = await this.posService.updateTableLayout(branchId, dto);
    return { success: true, data };
  }

  @Post('orders/create')
  @RequirePermission('pos.order.create', { branchParam: 'branchId' })
  async createOrder(@Body() dto: CreatePosOrderDto, @Req() req?: any) {
    const data = await this.posService.createOrder(dto, req?.user);
    return { success: true, data };
  }

  @Get('orders/:id')
  @RequirePermission('pos.order.view', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async getOrderById(@Param('id') id: string) {
    const data = await this.posService.getOrderById(id);
    return { success: true, data };
  }

  @Put('orders/:id')
  @RequirePermission('pos.order.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updateOrder(
    @Param('id') id: string,
    @Body() dto: UpdatePosOrderDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.updateOrder(id, dto, req?.user);
    return { success: true, data };
  }

  @Put('orders/:id/update')
  @RequirePermission('pos.order.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updateOrderAlias(
    @Param('id') id: string,
    @Body() dto: UpdatePosOrderDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.updateOrder(id, dto, req?.user);
    return { success: true, data };
  }

  @Put('orders/:id/items/:itemId/discount')
  @RequirePermission('pos.order.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updateItemDiscount(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: { discountAmount: number; discountReason?: string },
    @Req() req?: any,
  ) {
    const data = await this.posService.updateItemDiscount(
      id,
      itemId,
      dto.discountAmount,
      dto.discountReason,
      req?.user,
    );
    return { success: true, data };
  }

  @Post('orders/:id/send-kitchen')
  @RequirePermission('pos.item.add', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async sendToKitchen(
    @Param('id') id: string,
    @Body() dto: SendKitchenDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.sendToKitchen(id, dto, req?.user);
    return { success: true, data, printStatus: (data as any)?.printStatus };
  }

  @Post('orders/:id/confirm-print')
  @RequirePermission('pos.receipt.print', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async confirmPrint(
    @Param('id') id: string,
    @Body() dto: ConfirmPrintDto,
  ) {
    const data = await this.posService.confirmPrint(id, dto);
    return { success: true, data };
  }

  @Post('orders/:id/reprint-labels')
  @RequirePermission('pos.receipt.print', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async reprintLabels(
    @Param('id') id: string,
    @Body() dto: ReprintLabelsDto,
  ) {
    const data = await this.posService.reprintLabels(id, dto);
    return { success: true, data };
  }

  @Post('orders/:id/reprint-kitchen')
  @RequirePermission('pos.kitchen_ticket.reprint', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async reprintKitchen(
    @Param('id') id: string,
    @Body() dto: ReprintKitchenDto,
  ) {
    const data = await this.posService.reprintKitchenTicket(id, dto);
    return { success: true, data };
  }

  @Post('orders/:id/hold')
  @RequirePermission('pos.order.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async holdOrder(
    @Param('id') id: string,
    @Body() dto: HoldOrderDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.holdOrder(id, dto, req?.user);
    return { success: true, data };
  }

  @Post('orders/:id/resume')
  @RequirePermission('pos.order.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async resumeOrder(@Param('id') id: string, @Req() req?: any) {
    const data = await this.posService.resumeOrder(id, req?.user);
    return { success: true, data };
  }

  @Post('orders/:id/request-payment')
  @RequirePermission('waiter.payment.request', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async requestPayment(@Param('id') id: string, @Req() req?: any) {
    const data = await this.posService.requestPayment(id, req?.user);
    return { success: true, data };
  }

  @Post('orders/:id/cancel-payment-request')
  @RequirePermission('waiter.payment.request', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async cancelPaymentRequest(@Param('id') id: string, @Req() req?: any) {
    const data = await this.posService.cancelPaymentRequest(id, req?.user);
    return { success: true, data };
  }

  @Post('orders/split')
  @RequirePermission('pos.table.split', { branchParam: 'branchId' })
  async splitOrder(@Body() dto: SplitOrderDto, @Req() req?: any) {
    const data = await this.posService.splitOrder(dto, req?.user);
    return { success: true, data };
  }

  @Post('orders/merge')
  @RequirePermission('pos.table.merge', { branchParam: 'branchId' })
  async mergeOrder(@Body() dto: MergeOrderDto, @Req() req?: any) {
    const data = await this.posService.mergeOrder(dto, req?.user);
    return { success: true, data };
  }

  @Post('orders/move-table')
  @RequirePermission('pos.table.change', { branchParam: 'branchId' })
  async moveTable(@Body() dto: MoveTableDto, @Req() req?: any) {
    const data = await this.posService.moveTable(dto, req?.user);
    return { success: true, data };
  }

  @Post('orders/:id/pay')
  @RequirePermission('pos.payment.collect', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async processPayment(
    @Param('id') id: string,
    @Body() dto: ProcessPaymentDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.processPayment(id, dto, req?.user);
    return { success: true, data };
  }

  @Get('orders/:id/service-charges')
  @RequirePermission('pos.service_charge.manage', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async getServiceCharges(@Param('id') id: string) {
    const data = await this.posService.getServiceCharges(id);
    return { success: true, data };
  }

  @Post('orders/:id/service-charges')
  @RequirePermission('pos.service_charge.manage', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async addServiceCharge(
    @Param('id') id: string,
    @Body() dto: AddServiceChargeDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.addServiceCharge(id, dto, req?.user);
    return { success: true, data };
  }

  @Delete('orders/:id/service-charges/:chargeId')
  @RequirePermission('pos.service_charge.manage', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async removeServiceCharge(
    @Param('id') id: string,
    @Param('chargeId') chargeId: string,
    @Req() req?: any,
  ) {
    const data = await this.posService.removeServiceCharge(id, chargeId, req?.user);
    return { success: true, data };
  }

  @Get('kitchen/tickets')
  @RequirePermission('kitchen.orders.view', { branchParam: 'branchId' })
  async getKitchenTickets(
    @Query('branchId') branchId: string,
    @Query('stationId') stationId?: string,
  ) {
    const data = await this.posService.getKitchenTickets(branchId, stationId);
    return { success: true, data };
  }

  @Patch('kitchen/items/:id/status')
  @RequirePermission('kitchen.item.prepare', {
    resourceResolver: async (req, prisma) =>
      (
        await prisma.orderItem.findUnique({
          where: { id: req.params.id },
          select: { order: { select: { branchId: true } } },
        })
      )?.order?.branchId,
  })
  async updateKitchenItemStatus(
    @Param('id') id: string,
    @Body() dto: UpdateKitchenItemStatusDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.updateKitchenItemStatus(id, dto.status, req?.user);
    return { success: true, data };
  }

  @Post('shifts/open')
  @RequirePermission('cash_shift.open', { branchParam: 'branchId' })
  async openShift(
    @Query('branchId') branchId: string,
    @Body() dto: OpenShiftDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.openShift(branchId, dto, req?.user);
    return { success: true, data };
  }

  @Post('shifts/:id/close')
  @RequirePermission('cash_shift.close', {
    resourceResolver: async (req, prisma) =>
      (await prisma.cashShift.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async closeShift(
    @Param('id') id: string,
    @Body() dto: CloseShiftDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.closeShift(id, dto, req?.user);
    return { success: true, data };
  }

  @Get('shifts/current')
  @RequirePermission('cash_shift.view', { branchParam: 'branchId' })
  async getCurrentShift(
    @Query('branchId') branchId: string,
    @Query('cashierId') cashierId: string,
  ) {
    const data = await this.posService.getCurrentShift(branchId, cashierId);
    return { success: true, data };
  }

  @Get('sync/snapshot')
  @RequirePermission('pos.access', { branchParam: 'branchId' })
  async getSnapshot(@Query('branchId') branchId: string) {
    const data = await this.posService.getSnapshot(branchId);
    return { success: true, data };
  }

  @Post('orders/:id/cancel')
  @RequirePermission('pos.order.cancel', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.cancelOrder(id, dto.reason, req?.user?.id);
    return { success: true, data };
  }

  @Patch('orders/:id/status')
  @RequirePermission('orders.status.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @Req() req?: any,
  ) {
    const data = await this.posService.updateOrderStatusFromPos(id, status, req?.user?.id);
    return { success: true, data };
  }

  @Put('orders/:id/fees')
  @RequirePermission('pos.service_charge.manage', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updateOrderFees(
    @Param('id') id: string,
    @Body() dto: {
      shippingFee?: number;
      taxCode?: string;
      companyName?: string;
      taxAddress?: string;
      invoiceEmail?: string;
      isInvoiceRequested?: boolean;
    },
    @Req() req?: any,
  ) {
    const data = await this.posService.updateOrderFeesFromPos(id, dto, req?.user?.id);
    return { success: true, data };
  }

  @Patch('orders/:id/fees')
  @RequirePermission('pos.service_charge.manage', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updateOrderFeesPatch(
    @Param('id') id: string,
    @Body() dto: {
      shippingFee?: number;
      taxCode?: string;
      companyName?: string;
      taxAddress?: string;
      invoiceEmail?: string;
      isInvoiceRequested?: boolean;
    },
    @Req() req?: any,
  ) {
    const data = await this.posService.updateOrderFeesFromPos(id, dto, req?.user?.id);
    return { success: true, data };
  }

  @Patch('orders/:id/invoice')
  @RequirePermission('pos.customer.attach', {
    resourceResolver: async (req, prisma) =>
      (await prisma.order.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updateOrderInvoice(
    @Param('id') id: string,
    @Body() dto: {
      isInvoiceRequested?: boolean;
      invoiceTaxCode?: string;
      invoiceCompanyName?: string;
      invoiceAddress?: string;
      invoiceEmail?: string;
      isInvoiceExported?: boolean;
    },
    @Req() req?: any,
  ) {
    const data = await this.posService.updateOrderInvoiceInfo(id, dto, req?.user?.id);
    return { success: true, data };
  }

  @Get('members/search')
  @RequirePermission('customers.view')
  async searchMembers(@Query('query') query: string) {
    const data = await this.posService.searchMembers(query);
    return { success: true, data };
  }

  @Get('customers/search')
  @RequirePermission('customers.view')
  async searchCustomers(
    @Query('query') query?: string,
    @Query('q') q?: string,
  ) {
    const term = query || q || '';
    const data = await this.posService.searchMembers(term);
    return { success: true, data };
  }

  @Get('rewards')
  @RequirePermission('products.view')
  async getRedeemableRewards(@Query('branchId') branchId?: string) {
    const data = await this.posService.getRedeemableRewards(branchId);
    return { success: true, data };
  }

  @Post('orders/:orderId/redeem-reward')
  @RequirePermission('pos.item.add', {
    resourceResolver: async (req, prisma) => {
      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        select: { branchId: true },
      });
      return order?.branchId;
    },
  })
  async redeemRewardToOrder(
    @Param('orderId') orderId: string,
    @Body() dto: { productId: string; userId: string; quantity?: number },
    @Req() req?: any,
  ) {
    const data = await this.posService.redeemRewardToOrder(orderId, dto, req?.user?.id);
    return { success: true, data };
  }

  @Post('members')
  @RequirePermission('customers.create')
  async createMember(@Body() dto: CreateMemberDto) {
    const data = await this.posService.createMember(dto);
    return { success: true, data };
  }

  @Put('members/:id/tax-info')
  @RequirePermission('customers.update', {
    resourceResolver: async (req, prisma) =>
      (await prisma.user.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async updateMemberTaxInfo(
    @Param('id') id: string,
    @Body() dto: { taxCode?: string; companyName?: string; taxAddress?: string; invoiceEmail?: string },
  ) {
    const data = await this.posService.updateMemberTaxInfo(id, dto);
    return { success: true, data };
  }

  @Get('tax-lookup/:mst')
  @RequirePermission('pos.customer.attach')
  async lookupTax(@Param('mst') mst: string) {
    const res = await this.posService.lookupTax(mst);
    return res;
  }

  @Get('vouchers')
  @RequirePermission('vouchers.view', { branchParam: 'branchId' })
  async getPosVouchers(
    @Query('branchId') branchId?: string,
    @Query('subTotal') subTotal?: string,
  ) {
    const data = await this.posService.getPosVouchers(
      branchId,
      subTotal ? parseFloat(subTotal) : undefined,
    );
    return { success: true, data };
  }

  @Post('vouchers/validate')
  @RequirePermission('pos.discount.apply', { branchParam: 'branchId' })
  async validateVoucher(@Body() dto: ValidateVoucherDto) {
    const data = await this.posService.validateVoucher(
      dto.code,
      dto.subTotal,
      dto.userId,
      dto.branchId,
    );
    return { success: true, data };
  }

  @Get('reservations')
  @RequirePermission('reservations.view', { branchParam: 'branchId' })
  async getReservations(
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.posService.getReservations(branchId, date, status);
    return { success: true, data };
  }

  @Post('reservations/:id/check-in')
  @RequirePermission('reservations.checkin', {
    resourceResolver: async (req, prisma) =>
      (await prisma.reservation.findUnique({ where: { id: req.params.id }, select: { branchId: true } }))?.branchId,
  })
  async checkInReservation(
    @Param('id') id: string,
    @Body() dto: CheckInReservationDto,
    @Req() req?: any,
  ) {
    const data = await this.posService.checkInReservation(
      id,
      dto.tableId,
      req?.user?.id,
    );
    return { success: true, data };
  }

  @Post('cash-drawer/open')
  @RequirePermission('cash_shift.view', { branchParam: 'branchId' })
  async openCashDrawer(@Body() dto: { branchId: string; reason?: string }, @Req() req?: any) {
    const data = await this.posService.openCashDrawer(dto, req?.user);
    return { success: true, data };
  }

  @Get('payment-methods')
  @RequirePermission('payment_methods.view')
  async getPaymentMethods() {
    const data = await this.posService.getPosPaymentMethods();
    return { success: true, data };
  }

  @Get('branches/:id/print-settings')
  @RequirePermission('settings.printing.view', { branchParam: 'id' })
  async getBranchPrintSettings(@Param('id') id: string) {
    const data = await this.posService.getBranchPrintSettings(id);
    return { success: true, data };
  }

  @Put('branches/:id/print-settings')
  @RequirePermission('settings.printing.update', { branchParam: 'id' })
  async updateBranchPrintSettings(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const data = await this.posService.updateBranchPrintSettings(id, body);
    return { success: true, data };
  }
}

