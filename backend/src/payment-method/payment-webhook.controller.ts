import { Controller, Post, Get, Body, Headers, Param, Query, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SepayService } from './sepay.service';

@SkipThrottle()
@Controller('payment')
export class PaymentWebhookController {
  constructor(private readonly sepayService: SepayService) {}

  /**
   * =================================================================
   * API NHẬN WEBHOOK TỪ SEPAY (CHUYỂN KHOẢN TỰ ĐỘNG ĐA CỔNG)
   * URL: POST /api/payment/sepay hoặc POST /api/payment/webhook/sepay
   * =================================================================
   */
  @Post('sepay')
  @HttpCode(HttpStatus.OK)
  async handleSepayWebhook(
    @Body() payload: any,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.sepayService.handleSepayWebhook(payload, authHeader);
  }

  @Post('webhook/sepay')
  @HttpCode(HttpStatus.OK)
  async handleSepayWebhookAlt(
    @Body() payload: any,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.sepayService.handleSepayWebhook(payload, authHeader);
  }

  /**
   * Lấy cấu hình thanh toán chuyển khoản / VietQR cho trang thanh toán Client
   * URL: GET /api/payment/sepay/config?orderCode=SW12345 hoặc GET /api/payment/transfer/config?orderCode=SW12345
   */
  @Get(['sepay/config', 'transfer/config'])
  async getPaymentConfig(
    @Query('orderCode') orderCode: string,
    @Request() req: any,
  ) {
    const userId = req?.user?.id;
    return this.sepayService.getSepayPaymentConfig(orderCode, userId);
  }

  /**
   * API kiểm tra trạng thái đơn hàng (Dùng cho Polling mỗi 3000ms phía Client)
   * URL: GET /api/payment/check-status/:orderCode hoặc GET /api/orders/check-status/:orderCode
   */
  @Get('check-status/:orderCode')
  async checkOrderStatus(@Param('orderCode') orderCode: string) {
    return this.sepayService.checkOrderStatus(orderCode);
  }

  /**
   * API Hủy thanh toán / Hủy đơn hàng hoặc gói thuê bao
   * URL: POST /api/payment/cancel hoặc POST /api/payment/sepay/cancel
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPayment(
    @Body('orderCode') orderCode: string,
    @Body('reason') reason?: string,
  ) {
    return this.sepayService.cancelPayment(orderCode, reason);
  }

  @Post('sepay/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSepayPayment(
    @Body('orderCode') orderCode: string,
    @Body('reason') reason?: string,
  ) {
    return this.sepayService.cancelPayment(orderCode, reason);
  }
}
