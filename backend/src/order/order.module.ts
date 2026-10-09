import { Module } from '@nestjs/common';
import { MembershipModule } from '../membership/membership.module';
import { OrderController } from './order.controller';
import { CheckoutController } from './checkout.controller';
import { OrderService } from './order.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { PromotionModule } from '../promotion/promotion.module';
import { OperatingSlotModule } from '../operating-slot/operating-slot.module';
import { FarmModule } from '../farm/farm.module';

@Module({
  imports: [PrismaModule, NotificationModule, PromotionModule, MembershipModule, OperatingSlotModule, FarmModule],
  controllers: [OrderController, CheckoutController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
