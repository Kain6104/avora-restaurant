import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Ip,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ArticleService } from './article.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { QueryArticleDto } from './dto/query-article.dto';
import { ToggleReactionDto } from './dto/reaction.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  /**
   * Public: Lấy danh sách bài viết công khai / theo phân quyền
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getFeed(
    @Query() query: QueryArticleDto,
    @Req() req: any,
    @Query('branchId') branchId?: string
  ) {
    const user = req.user || null;
    return this.articleService.getFeed(query, user, branchId);
  }

  /**
   * User: Danh sách bài viết đã lưu của tôi
   */
  @Get('user/saved')
  @UseGuards(JwtAuthGuard)
  async getUserSavedArticles(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.articleService.getUserSavedArticles(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20
    );
  }

  /**
   * Public / User: Lấy chi tiết bài viết theo slug
   */
  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  async getDetail(
    @Param('slug') slug: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Query('branchId') branchId?: string
  ) {
    const user = req.user || null;
    return this.articleService.getArticleBySlug(slug, user, branchId, ipAddress, userAgent);
  }

  /**
   * User: Thả / Đổi / Bỏ cảm xúc Facebook-style
   */
  @Post(':id/reactions')
  @UseGuards(JwtAuthGuard)
  async toggleReaction(
    @Param('id') articleId: string,
    @Body() dto: ToggleReactionDto,
    @Req() req: any
  ) {
    return this.articleService.toggleReaction(articleId, req.user.id, dto.type, req.user);
  }

  /**
   * Public / User: Lấy danh sách bình luận (2 cấp)
   */
  @Get(':id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  async getComments(
    @Param('id') articleId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: any
  ) {
    const user = req?.user || null;
    return this.articleService.getComments(
      articleId,
      user,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 15
    );
  }

  /**
   * User: Thêm bình luận hoặc trả lời
   */
  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  async addComment(
    @Param('id') articleId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: any
  ) {
    return this.articleService.addComment(
      articleId,
      req.user.id,
      dto.content,
      dto.parentId,
      req.user
    );
  }

  /**
   * User: Chỉnh sửa bình luận của chính mình
   */
  @Patch('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @Req() req: any
  ) {
    return this.articleService.updateComment(commentId, req.user.id, dto.content);
  }

  /**
   * User / Admin: Xóa bình luận
   */
  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  async deleteComment(@Param('commentId') commentId: string, @Req() req: any) {
    return this.articleService.deleteComment(commentId, req.user.id, req.user.role);
  }

  /**
   * User: Lưu / Bỏ lưu bài viết vào hồ sơ
   */
  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  async toggleFavorite(@Param('id') articleId: string, @Req() req: any) {
    return this.articleService.toggleFavorite(articleId, req.user.id, req.user);
  }

  /**
   * Public / User: Ghi nhận lượt chia sẻ (Share Intent)
   */
  @Post(':id/share')
  @UseGuards(OptionalJwtAuthGuard)
  async trackShare(
    @Param('id') articleId: string,
    @Req() req: any,
    @Ip() ipAddress: string
  ) {
    const userId = req.user?.id;
    return this.articleService.trackShare(articleId, userId, ipAddress);
  }

  /**
   * Public / User: Ghi nhận click chuyển đổi sang món ăn
   */
  @Post(':id/track-product-click')
  @UseGuards(OptionalJwtAuthGuard)
  async trackProductClick(
    @Param('id') articleId: string,
    @Body('productId') productId: string,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.articleService.trackProductClick(articleId, productId, userId);
  }

  /**
   * Public / User: Ghi nhận click chuyển đổi sang voucher
   */
  @Post(':id/track-voucher-click')
  @UseGuards(OptionalJwtAuthGuard)
  async trackVoucherClick(
    @Param('id') articleId: string,
    @Body('voucherId') voucherId: string,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.articleService.trackVoucherClick(articleId, voucherId, userId);
  }
}
