import { Module } from '@nestjs/common';
import { PaymentMethodService } from './payment-method.service';
import { SepayService } from './sepay.service';
import { PaymentMethodController } from './payment-method.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  providers: [PaymentMethodService, SepayService],
  controllers: [PaymentMethodController, PaymentWebhookController],
  exports: [PaymentMethodService, SepayService],
})
export class PaymentMethodModule {}

