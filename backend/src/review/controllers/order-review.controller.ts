import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrderReviewService } from '../services/order-review.service';
import { CreateOrderReviewDto } from '../dto/create-order-review.dto';
import { CreateOrderFollowUpDto } from '../dto/create-order-follow-up.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller()
export class OrderReviewController {
  constructor(private readonly orderReviewService: OrderReviewService) {}

  /**
   * Kiểm tra điều kiện đánh giá đơn hàng của khách hàng (Eligible, 14 ngày, điểm thưởng)
   */
  @Get('orders/:orderId/review-eligibility')
  @UseGuards(JwtAuthGuard)
  async checkEligibility(@Param('orderId') orderId: string, @Req() req: any) {
    return this.orderReviewService.checkEligibility(req.user.id, orderId);
  }

  /**
   * Xem nội dung đánh giá đơn hàng đã gửi (Readonly kèm timeline follow-ups & reply)
   */
  @Get('orders/:orderId/review')
  @UseGuards(JwtAuthGuard)
  async getOrderReview(@Param('orderId') orderId: string, @Req() req: any) {
    const data = await this.orderReviewService.getOrderReview(req.user.id, orderId);
    return {
      success: true,
      data,
    };
  }

  /**
   * Gửi đánh giá đơn hàng LẦN ĐẦU VÀ DUY NHẤT (Bất biến, nhận điểm thưởng tự động)
   */
  @Post('orders/:orderId/review')
  @UseGuards(JwtAuthGuard)
  async createOrderReview(
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrderReviewDto,
    @Req() req: any,
  ) {
    return this.orderReviewService.createOrderReview(req.user.id, orderId, dto);
  }

  /**
   * Gửi phản hồi bổ sung (Append-Only Follow-Up, không thưởng thêm điểm, trong thời hạn 14 ngày)
   */
  @Post('order-reviews/:id/follow-ups')
  @UseGuards(JwtAuthGuard)
  async createFollowUp(
    @Param('id') orderReviewId: string,
    @Body() dto: CreateOrderFollowUpDto,
    @Req() req: any,
  ) {
    return this.orderReviewService.createFollowUp(req.user.id, orderReviewId, dto);
  }
}
