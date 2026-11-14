import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WebPushSubscriptionService } from './web-push-subscription.service';
import { WebPushDeliveryService } from './web-push-delivery.service';
import { WebPushCleanupService } from './web-push-cleanup.service';
import { WebPushController } from './web-push.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WebPushController],
  providers: [
    WebPushSubscriptionService,
    WebPushDeliveryService,
    WebPushCleanupService,
  ],
  exports: [
    WebPushSubscriptionService,
    WebPushDeliveryService,
  ],
})
export class WebPushModule {}

