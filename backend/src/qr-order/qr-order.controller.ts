import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { QrOrderService } from './qr-order.service';
import { JoinQrSessionDto } from './dto/join-qr-session.dto';
import { SubmitQrRoundDto } from './dto/submit-qr-round.dto';
import { CreateServiceRequestDto } from './dto/service-request.dto';
import { MemberLookupDto, MemberVerifyDto, RedeemRewardDto } from './dto/member-actions.dto';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('qr-order')
export class QrOrderController {
  constructor(private readonly qrOrderService: QrOrderService) {}

  // ==========================================
  // PUBLIC QR CLIENT ENDPOINTS
  // ==========================================

  @Get(':token')
  async getSession(@Param('token') token: string) {
    const session = await this.qrOrderService.resolveSessionByToken(token);
    return {
      success: true,
      data: {
        table: { id: session.table.id, name: session.table.name, tableCode: session.table.tableCode },
        branch: { id: session.branch.id, name: session.branch.name, branchCode: session.branch.branchCode },
        order: {
          id: session.order.id,
          orderCode: session.order.orderCode || (session.order as any).temporaryOrderCode,
          totalAmount: session.order.totalAmount,
          subTotal: session.order.subTotal,
          guestCount: session.order.guestCount,
        },
        buffetSession: session.order.buffetSessions?.[0] || null,
      },
    };
  }

  @Post(':token/join')
  async joinGuest(
    @Param('token') token: string,
    @Body() dto: JoinQrSessionDto,
  ) {
    return this.qrOrderService.joinGuest(token, dto);
  }

  @Post(':token/member/lookup')
  async lookupMember(@Body() dto: MemberLookupDto) {
    return this.qrOrderService.lookupMember(dto);
  }

  @Post(':token/member/verify')
  async verifyMember(
    @Param('token') token: string,
    @Body() dto: MemberVerifyDto,
  ) {
    return this.qrOrderService.verifyMember(token, dto);
  }

  @Get(':token/menu')
  async getMenu(@Param('token') token: string) {
    return this.qrOrderService.getMenu(token);
  }

  @Get(':token/order')
  async getOrder(@Param('token') token: string) {
    return this.qrOrderService.getOrder(token);
  }

  @Post(':token/rounds')
  async submitRound(
    @Param('token') token: string,
    @Body() dto: SubmitQrRoundDto,
  ) {
    return this.qrOrderService.submitRound(token, dto);
  }

  @Post(':token/service-requests')
  async createServiceRequest(
    @Param('token') token: string,
    @Body() dto: CreateServiceRequestDto,
  ) {
    return this.qrOrderService.createServiceRequest(token, dto);
  }

  @Get(':token/payment-methods')
  async getPaymentMethods(@Param('token') token: string) {
    return this.qrOrderService.getPaymentMethods(token);
  }

  @Post(':token/payment-request')
  async requestPayment(
    @Param('token') token: string,
    @Body('paymentMethodCode') paymentMethodCode: string,
    @Body('note') note?: string,
    @Body('deviceSessionId') deviceSessionId?: string,
  ) {
    return this.qrOrderService.requestPayment(token, paymentMethodCode, note, deviceSessionId);
  }

  @Get(':token/rewards')
  async getRewards(@Param('token') token: string) {
    return this.qrOrderService.getRedeemableRewards(token);
  }

  @Post(':token/redeem')
  async redeemReward(
    @Param('token') token: string,
    @Body() dto: RedeemRewardDto,
  ) {
    return this.qrOrderService.redeemReward(token, dto);
  }

  // ==========================================
  // INTERNAL POS/WAITER QR MANAGEMENT ENDPOINTS
  // ==========================================

  @Get('admin/tables/:tableId/qr')
  @UseGuards(OptionalJwtAuthGuard)
  async getTableQr(
    @Param('tableId') tableId: string,
    @Query('branchId') branchId: string,
    @Req() req?: any,
  ) {
    const data = await this.qrOrderService.getOrCreateQrSessionForTable(tableId, branchId, req?.user);
    return { success: true, data };
  }

  @Post('admin/tables/:tableId/qr/regenerate')
  @UseGuards(OptionalJwtAuthGuard)
  async regenerateTableQr(
    @Param('tableId') tableId: string,
    @Body('orderId') orderId: string,
    @Req() req?: any,
  ) {
    const data = await this.qrOrderService.regenerateQrSession(orderId, req?.user);
    return { success: true, data, message: 'Đã tạo lại mã QR thành công' };
  }

  @Post('admin/tables/:tableId/qr/disable')
  @UseGuards(OptionalJwtAuthGuard)
  async disableTableQr(
    @Param('tableId') tableId: string,
    @Body('orderId') orderId: string,
    @Req() req?: any,
  ) {
    const data = await this.qrOrderService.disableQrSession(orderId, req?.user);
    return { success: true, data };
  }

  @Get('admin/branches/:branchId/qr-rounds/pending')
  @UseGuards(OptionalJwtAuthGuard)
  async getPendingQrRounds(@Param('branchId') branchId: string) {
    const data = await this.qrOrderService.getPendingQrRounds(branchId);
    return { success: true, data };
  }

  @Post('admin/rounds/:roundId/approve')
  @UseGuards(OptionalJwtAuthGuard)
  async approveQrRound(
    @Param('roundId') roundId: string,
    @Req() req?: any,
  ) {
    const data = await this.qrOrderService.approveQrRound(roundId, req?.user?.id);
    return data;
  }

  @Post('admin/rounds/:roundId/reject')
  @UseGuards(OptionalJwtAuthGuard)
  async rejectQrRound(
    @Param('roundId') roundId: string,
    @Body('reason') reason?: string,
    @Req() req?: any,
  ) {
    const data = await this.qrOrderService.rejectQrRound(roundId, reason, req?.user?.id);
    return data;
  }

  @Get('admin/branches/:branchId/qr-settings')
  @UseGuards(OptionalJwtAuthGuard)
  async getBranchQrSettings(@Param('branchId') branchId: string) {
    return this.qrOrderService.getBranchQrSettings(branchId);
  }

  @Patch('admin/branches/:branchId/qr-settings')
  @UseGuards(OptionalJwtAuthGuard)
  async updateBranchQrSettings(
    @Param('branchId') branchId: string,
    @Body('qrAutoSendToKitchen') qrAutoSendToKitchen: boolean,
  ) {
    return this.qrOrderService.updateBranchQrSettings(branchId, qrAutoSendToKitchen);
  }
}
