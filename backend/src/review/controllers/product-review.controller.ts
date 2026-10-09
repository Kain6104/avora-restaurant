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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductReviewService } from '../services/product-review.service';
import { ReviewMediaService } from '../services/review-media.service';
import { CreateProductReviewDto } from '../dto/create-product-review.dto';
import { UpdateProductReviewDto } from '../dto/update-product-review.dto';
import { ReviewReactionDto } from '../dto/review-reaction.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';

@Controller()
export class ProductReviewController {
  constructor(
    private readonly productReviewService: ProductReviewService,
    private readonly reviewMediaService: ReviewMediaService,
  ) {}

  /**
   * Upload hình ảnh hoặc video cho review (giới hạn <= 5MB sau xử lý)
   */
  @Post('reviews/media/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // Giới hạn tệp nhận vào tối đa 50MB
      },
    }),
  )
  async uploadReviewMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp hình ảnh hoặc video để tải lên');
    }
    const result = await this.reviewMediaService.processAndSaveMedia(file);
    return {
      success: true,
      data: result,
      message: 'Tải tệp lên thành công',
    };
  }

  /**
   * Lấy danh sách đánh giá của món ăn (Công khai, hỗ trợ token tùy chọn để check like)
   */
  @Get('products/:productId/reviews')
  @UseGuards(OptionalJwtAuthGuard)
  async getProductReviews(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('rating') rating?: string,
    @Query('verifiedOnly') verifiedOnly?: string,
    @Query('hasMedia') hasMedia?: string,
    @Query('sort') sort?: 'newest' | 'helpful' | 'highest' | 'lowest',
    @Req() req?: any,
  ) {
    const currentUserId = req?.user?.id;
    return this.productReviewService.getProductReviews(
      productId,
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        rating: rating ? parseInt(rating, 10) : undefined,
        verifiedOnly: verifiedOnly === 'true',
        hasMedia: hasMedia === 'true',
        sort,
      },
      currentUserId,
    );
  }

  /**
   * Lấy tóm tắt phân bố Rating của món ăn
   */
  @Get('products/:productId/reviews/summary')
  async getProductReviewSummary(@Param('productId') productId: string) {
    return this.productReviewService.getProductReviewSummary(productId);
  }

  /**
   * Khách hàng thành viên gửi đánh giá món ăn mới
   */
  @Post('products/:productId/reviews')
  @UseGuards(JwtAuthGuard)
  async createProductReview(
    @Param('productId') productId: string,
    @Body() dto: CreateProductReviewDto,
    @Req() req: any,
  ) {
    return this.productReviewService.createProductReview(req.user.id, productId, dto);
  }

  /**
   * Khách hàng chỉnh sửa đánh giá món ăn của chính mình
   */
  @Patch('product-reviews/:id')
  @UseGuards(JwtAuthGuard)
  async updateProductReview(
    @Param('id') reviewId: string,
    @Body() dto: UpdateProductReviewDto,
    @Req() req: any,
  ) {
    return this.productReviewService.updateProductReview(req.user.id, reviewId, dto);
  }

  /**
   * Khách hàng xóa đánh giá món ăn của chính mình
   */
  @Delete('product-reviews/:id')
  @UseGuards(JwtAuthGuard)
  async deleteProductReview(@Param('id') reviewId: string, @Req() req: any) {
    return this.productReviewService.deleteProductReview(req.user.id, reviewId);
  }

  /**
   * Like hoặc Dislike đánh giá món ăn
   */
  @Post('product-reviews/:id/reaction')
  @UseGuards(JwtAuthGuard)
  async reactToReview(
    @Param('id') reviewId: string,
    @Body() dto: ReviewReactionDto,
    @Req() req: any,
  ) {
    return this.productReviewService.reactToReview(req.user.id, reviewId, dto.type);
  }
}
