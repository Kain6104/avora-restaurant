import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminReviewService } from '../services/admin-review.service';
import { AdminProductReviewQueryDto, AdminOrderReviewQueryDto } from '../dto/admin-review-query.dto';
import { AdminReviewReplyDto } from '../dto/admin-review-reply.dto';
import { UpdateReviewSettingsDto } from '../dto/update-review-settings.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { ProductReviewStatus, OrderReviewStatus } from '@prisma/client';

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminReviewController {
  constructor(private readonly adminReviewService: AdminReviewService) {}

  /**
   * Thống kê tổng quan Đánh giá cho Admin dashboard & tabs
   */
  @Get('stats')
  @RequirePermission('reviews.view')
  async getStats(@BranchScope() branchIdScope?: string) {
    return this.adminReviewService.getReviewStats(branchIdScope);
  }

  /**
   * Danh sách đánh giá món ăn (Hỗ trợ lọc, tìm kiếm, phân trang và Branch Scope của Manager)
   */
  @Get('products')
  @RequirePermission('reviews.view')
  async getProductReviews(
    @Query() query: AdminProductReviewQueryDto,
    @BranchScope() branchIdScope?: string,
  ) {
    return this.adminReviewService.getProductReviews(query, branchIdScope);
  }

  /**
   * Danh sách đánh giá đơn hàng (Hỗ trợ lọc, tìm kiếm, phân trang và Branch Scope của Manager)
   */
  @Get('orders')
  @RequirePermission('reviews.view')
  async getOrderReviews(
    @Query() query: AdminOrderReviewQueryDto,
    @BranchScope() branchIdScope?: string,
  ) {
    return this.adminReviewService.getOrderReviews(query, branchIdScope);
  }

  /**
   * Lấy cấu hình hệ thống đánh giá
   */
  @Get('settings')
  @RequirePermission('reviews.settings')
  async getReviewSettings() {
    return this.adminReviewService.getReviewSettings();
  }

  /**
   * Cập nhật cấu hình hệ thống đánh giá (Thưởng điểm, hạn 14 ngày, toggles)
   */
  @Patch('settings')
  @RequirePermission('reviews.settings')
  async updateReviewSettings(
    @Body() dto: UpdateReviewSettingsDto,
    @Req() req: any,
  ) {
    return this.adminReviewService.updateReviewSettings(req.user.id, dto);
  }

  /**
   * Phản hồi đánh giá món ăn (Tạo mới hoặc chỉnh sửa)
   */
  @Post('products/:id/reply')
  @RequirePermission('reviews.reply')
  async replyProductReview(
    @Param('id') reviewId: string,
    @Body() dto: AdminReviewReplyDto,
    @Req() req: any,
  ) {
    return this.adminReviewService.upsertProductReviewReply(req.user.id, reviewId, dto);
  }

  /**
   * Xóa phản hồi đánh giá món ăn
   */
  @Delete('products/:id/reply')
  @RequirePermission('reviews.reply')
  async deleteProductReviewReply(
    @Param('id') reviewId: string,
    @Req() req: any,
  ) {
    return this.adminReviewService.deleteProductReviewReply(req.user.id, reviewId);
  }

  /**
   * Phản hồi đánh giá đơn hàng (Tạo mới hoặc chỉnh sửa)
   */
  @Post('orders/:id/reply')
  @RequirePermission('reviews.reply')
  async replyOrderReview(
    @Param('id') orderReviewId: string,
    @Body() dto: AdminReviewReplyDto,
    @Req() req: any,
  ) {
    return this.adminReviewService.upsertOrderReviewReply(req.user.id, orderReviewId, dto);
  }

  /**
   * Xóa phản hồi đánh giá đơn hàng
   */
  @Delete('orders/:id/reply')
  @RequirePermission('reviews.reply')
  async deleteOrderReviewReply(
    @Param('id') orderReviewId: string,
    @Req() req: any,
  ) {
    return this.adminReviewService.deleteOrderReviewReply(req.user.id, orderReviewId);
  }

  /**
   * Kiểm duyệt Product Review (Ẩn / Khôi phục, tự động đồng bộ lại Product.avgRating)
   */
  @Patch('products/:id/moderate')
  @RequirePermission('reviews.moderate')
  async moderateProductReview(
    @Param('id') reviewId: string,
    @Body('status') status: ProductReviewStatus,
    @Req() req: any,
  ) {
    return this.adminReviewService.moderateProductReview(req.user.id, reviewId, status);
  }

  /**
   * Kiểm duyệt Order Review (Ẩn / Khôi phục)
   */
  @Patch('orders/:id/moderate')
  @RequirePermission('reviews.moderate')
  async moderateOrderReview(
    @Param('id') orderReviewId: string,
    @Body('status') status: OrderReviewStatus,
    @Req() req: any,
  ) {
    return this.adminReviewService.moderateOrderReview(req.user.id, orderReviewId, status);
  }
}
