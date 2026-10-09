import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { AdminModule } from '../admin/admin.module';

// Services
import { ReviewMediaService } from './services/review-media.service';
import { ProductReviewService } from './services/product-review.service';
import { OrderReviewService } from './services/order-review.service';
import { AdminReviewService } from './services/admin-review.service';

// Controllers
import { ProductReviewController } from './controllers/product-review.controller';
import { OrderReviewController } from './controllers/order-review.controller';
import { AdminReviewController } from './controllers/admin-review.controller';

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    AdminModule,
  ],
  controllers: [
    ProductReviewController,
    OrderReviewController,
    AdminReviewController,
  ],
  providers: [
    ReviewMediaService,
    ProductReviewService,
    OrderReviewService,
    AdminReviewService,
  ],
  exports: [
    ReviewMediaService,
    ProductReviewService,
    OrderReviewService,
    AdminReviewService,
  ],
})
export class ReviewModule {}
