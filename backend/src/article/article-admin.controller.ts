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
} from '@nestjs/common';
import { ArticleAdminService } from './article-admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import { SendNotificationCampaignDto, PreviewAudienceDto } from './dto/campaign.dto';

@Controller('admin/articles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArticleAdminController {
  constructor(private readonly articleAdminService: ArticleAdminService) {}

  @Get()
  @RequirePermission('articles.view')
  async findAll(@Query() query: QueryArticleDto, @Req() req: any) {
    return this.articleAdminService.findAll(query, req.user);
  }

  @Post()
  @RequirePermission('articles.create')
  async create(@Body() dto: CreateArticleDto, @Req() req: any, @Ip() ip: string) {
    return this.articleAdminService.create(dto, req.user, ip);
  }

  @Get(':id')
  @RequirePermission('articles.view')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.articleAdminService.findOne(id, req.user);
  }

  @Patch(':id')
  @RequirePermission('articles.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @Req() req: any,
    @Ip() ip: string
  ) {
    return this.articleAdminService.update(id, dto, req.user, ip);
  }

  @Delete(':id')
  @RequirePermission('articles.delete')
  async delete(@Param('id') id: string, @Req() req: any, @Ip() ip: string) {
    return this.articleAdminService.delete(id, req.user, ip);
  }

  @Post(':id/publish')
  @RequirePermission('articles.publish')
  async publish(@Param('id') id: string, @Req() req: any, @Ip() ip: string) {
    return this.articleAdminService.publish(id, req.user, ip);
  }

  @Post(':id/unpublish')
  @RequirePermission('articles.publish')
  async unpublish(@Param('id') id: string, @Req() req: any, @Ip() ip: string) {
    return this.articleAdminService.unpublish(id, req.user, ip);
  }

  @Post(':id/notification-audience-preview')
  @RequirePermission('article_campaigns.view')
  async previewAudience(
    @Param('id') id: string,
    @Body() dto: PreviewAudienceDto,
    @Req() req: any
  ) {
    return this.articleAdminService.previewAudience(id, dto, req.user);
  }

  @Post(':id/audience-preview')
  @RequirePermission('article_campaigns.view')
  async previewAudienceAlias(
    @Param('id') id: string,
    @Body() dto: PreviewAudienceDto,
    @Req() req: any
  ) {
    return this.articleAdminService.previewAudience(id, dto, req.user);
  }

  @Post(':id/send-notification')
  @RequirePermission('article_campaigns.send')
  async sendNotification(
    @Param('id') id: string,
    @Body() dto: SendNotificationCampaignDto,
    @Req() req: any,
    @Ip() ip: string
  ) {
    return this.articleAdminService.sendNotificationCampaign(id, dto, req.user, ip);
  }

  @Post(':id/notify')
  @RequirePermission('article_campaigns.send')
  async notifyAlias(
    @Param('id') id: string,
    @Body() dto: SendNotificationCampaignDto,
    @Req() req: any,
    @Ip() ip: string
  ) {
    return this.articleAdminService.sendNotificationCampaign(id, dto, req.user, ip);
  }

  @Get(':id/analytics')
  @RequirePermission('articles.view')
  async getAnalytics(
    @Param('id') id: string,
    @Query('days') days: string,
    @Req() req: any
  ) {
    return this.articleAdminService.getAnalytics(id, req.user, days ? parseInt(days, 10) : 30);
  }
}
