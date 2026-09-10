import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { AdminModule } from '../admin/admin.module';
import { ArticleService } from './article.service';
import { ArticleAdminService } from './article-admin.service';
import { ArticleAccessPolicyService } from './article-access-policy.service';
import { ArticleSchedulerService } from './article-scheduler.service';
import { ArticleController } from './article.controller';
import { ArticleAdminController } from './article-admin.controller';
import { ArticleCommentController } from './article-comment.controller';

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    AdminModule,
  ],
  controllers: [
    ArticleController,
    ArticleAdminController,
    ArticleCommentController,
  ],
  providers: [
    ArticleService,
    ArticleAdminService,
    ArticleAccessPolicyService,
    ArticleSchedulerService,
  ],
  exports: [
    ArticleService,
    ArticleAdminService,
    ArticleAccessPolicyService,
  ],
})
export class ArticleModule {}
