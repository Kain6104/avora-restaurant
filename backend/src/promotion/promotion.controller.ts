import { Controller, Get, Post, Body } from '@nestjs/common';
import { PromotionService } from './promotion.service';

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Get('flash-sale/current')
  async getCurrentFlashSale() {
    return this.promotionService.getCurrentFlashSale();
  }

  @Post('flash-sale/quota')
  async getFlashSaleQuota(@Body('userId') userId: string) {
    if (!userId) return {};
    return this.promotionService.getFlashSaleQuota(userId);
  }

  @Post('vouchers')
  async getVouchers(@Body('userId') userId?: string) {
    return this.promotionService.getVouchers(userId);
  }

  @Post('vouchers/apply')
  async applyVoucher(
    @Body('code') code: string,
    @Body('orderValue') orderValue: number,
    @Body('userId') userId?: string,
    @Body('shippingFee') shippingFee: number = 15000,
  ) {
    return this.promotionService.applyVoucher(code, orderValue, userId, shippingFee);
  }
}
