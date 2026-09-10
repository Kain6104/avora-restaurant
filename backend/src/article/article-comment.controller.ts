import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Ip,
  UseGuards,
} from '@nestjs/common';
import { ArticleService } from './article.service';
import { ArticleAdminService } from './article-admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CommentStatus } from '@prisma/client';
import { UpdateCommentDto } from './dto/comment.dto';

@Controller()
export class ArticleCommentController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly articleAdminService: ArticleAdminService
  ) {}

  /**
   * User: Danh sách bài viết đã lưu của tôi
   */
  @Get('users/me/saved-articles')
  @UseGuards(JwtAuthGuard)
  async getMySavedArticles(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.articleService.getUserSavedArticles(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10
    );
  }

  /**
   * User: Chỉnh sửa bình luận của chính mình
   */
  @Patch('article-comments/:id')
  @UseGuards(JwtAuthGuard)
  async updateComment(
    @Param('id') commentId: string,
    @Body() dto: UpdateCommentDto,
    @Req() req: any
  ) {
    return this.articleService.updateComment(commentId, req.user.id, dto.content);
  }

  /**
   * User / Admin: Xóa bình luận
   */
  @Delete('article-comments/:id')
  @UseGuards(JwtAuthGuard)
  async deleteComment(@Param('id') commentId: string, @Req() req: any) {
    return this.articleService.deleteComment(commentId, req.user.id, req.user.role);
  }

  /**
   * Admin / Manager: Quản trị & Duyệt bình luận toàn hệ thống
   */
  @Get('admin/article-comments')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('comments.view')
  async getAdminComments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: CommentStatus,
    @Query('articleId') articleId?: string
  ) {
    return this.articleAdminService.getAdminComments({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      articleId,
    });
  }

  /**
   * Admin / Manager: Ẩn / Khôi phục bình luận
   */
  @Patch('admin/article-comments/:id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('comments.moderate')
  async toggleCommentStatus(
    @Param('id') commentId: string,
    @Body('status') status: CommentStatus,
    @Req() req: any,
    @Ip() ip: string
  ) {
    return this.articleAdminService.toggleCommentStatus(commentId, status, req.user, ip);
  }
}
