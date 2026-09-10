import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleStatus } from '@prisma/client';

@Injectable()
export class ArticleSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArticleSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('ArticleSchedulerService initialized - starting 60s interval worker.');
    // Chạy ngay lần đầu và lập lịch mỗi 60 giây
    this.handleScheduledPublishing();
    this.timer = setInterval(() => {
      this.handleScheduledPublishing();
    }, 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Chạy định kỳ mỗi phút để kiểm tra và tự động xuất bản các bài viết đã lên lịch
   */
  async handleScheduledPublishing() {
    const now = new Date();

    try {
      // 1. Tìm các bài viết đến hạn xuất bản
      const scheduledArticles = await this.prisma.article.findMany({
        where: {
          status: ArticleStatus.SCHEDULED,
          scheduledAt: { lte: now },
          deletedAt: null,
        },
        select: { id: true, title: true, scheduledAt: true },
      });

      if (scheduledArticles.length === 0) return;

      this.logger.log(`Found ${scheduledArticles.length} scheduled article(s) ready to publish.`);

      // 2. Cập nhật trạng thái từng bài Atomic Conditional Update chống xử lý trùng
      for (const article of scheduledArticles) {
        const updateResult = await this.prisma.article.updateMany({
          where: {
            id: article.id,
            status: ArticleStatus.SCHEDULED,
          },
          data: {
            status: ArticleStatus.PUBLISHED,
            publishedAt: article.scheduledAt || now,
          },
        });

        if (updateResult.count > 0) {
          this.logger.log(`Successfully auto-published article: "${article.title}" (ID: ${article.id})`);
        }
      }
    } catch (error) {
      this.logger.error('Error during scheduled article publishing worker:', error);
    }
  }
}
