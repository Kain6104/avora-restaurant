import { Controller, Get, Post, Delete, Body, Query, Param, Req, UseGuards } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Get('flash-sale/current')
  async getCurrentFlashSale(
    @Query('channel') channel?: 'ONLINE' | 'POS',
    @Query('branchId') branchId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.promotionService.getCurrentFlashSale(channel, branchId, userId);
  }

  @Post('flash-sale/quota')
  async getFlashSaleQuota(@Body('userId') userId: string) {
    if (!userId) return {};
    return this.promotionService.getFlashSaleQuota(userId);
  }

  @Post('flash-sale/remind')
  @UseGuards(OptionalJwtAuthGuard)
  async subscribeReminder(
    @Body('flashSaleId') flashSaleId: string,
    @Body('slotId') slotId?: string,
    @Body('productId') productId?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id;
    const result = await this.promotionService.subscribeFlashSaleReminder(userId, flashSaleId, slotId, productId);
    return { success: true, message: 'Đăng ký nhận thông báo thành công!', data: result };
  }

  @Get('vouchers')
  @UseGuards(OptionalJwtAuthGuard)
  async getVouchersGet(@Query('userId') queryUserId?: string, @Req() req?: any) {
    const userId = req?.user?.id || queryUserId;
    return this.promotionService.getVouchers(userId);
  }

  @Post('vouchers')
  @UseGuards(OptionalJwtAuthGuard)
  async getVouchers(@Body('userId') bodyUserId?: string, @Query('userId') queryUserId?: string, @Req() req?: any) {
    const userId = req?.user?.id || bodyUserId || queryUserId;
    return this.promotionService.getVouchers(userId);
  }

  @Get('vouchers/wallet')
  @UseGuards(OptionalJwtAuthGuard)
  async getWalletVouchers(@Query('userId') queryUserId?: string, @Req() req?: any) {
    const userId = req?.user?.id || queryUserId;
    return this.promotionService.getWalletVouchers(userId);
  }

  @Post('vouchers/claim')
  @UseGuards(OptionalJwtAuthGuard)
  async claimVoucher(
    @Body('code') code?: string,
    @Body('voucherId') voucherId?: string,
    @Body('userId') bodyUserId?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id || bodyUserId;
    return this.promotionService.claimVoucher(userId, { code, voucherId });
  }

  @Delete('vouchers/wallet/:voucherId')
  @UseGuards(OptionalJwtAuthGuard)
  async removeVoucherFromWallet(
    @Param('voucherId') voucherId: string,
    @Query('userId') queryUserId?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id || queryUserId;
    return this.promotionService.removeVoucherFromWallet(userId, voucherId);
  }

  @Post('vouchers/apply')
  @UseGuards(OptionalJwtAuthGuard)
  async applyVoucher(
    @Body('code') code: string,
    @Body('orderValue') orderValue: number,
    @Body('userId') bodyUserId?: string,
    @Body('shippingFee') shippingFee: number = 15000,
    @Body('branchId') branchId?: string,
    @Body('paymentMethodId') paymentMethodId?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id || bodyUserId;
    return this.promotionService.applyVoucher(code, orderValue, userId, shippingFee, branchId, paymentMethodId);
  }

  @Get('combos')
  async getCombos(
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    return this.promotionService.getCombos(branchId, search);
  }

  @Get('combos/:id')
  async getComboById(@Param('id') id: string) {
    return this.promotionService.getComboById(id);
  }
}
