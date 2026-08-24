import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { PromotionModule } from '../promotion/promotion.module';

@Module({
  imports: [PrismaModule, NotificationModule, PromotionModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
