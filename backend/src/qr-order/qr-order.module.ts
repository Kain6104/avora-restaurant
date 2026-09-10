import { Module, forwardRef } from '@nestjs/common';
import { QrOrderController } from './qr-order.controller';
import { QrOrderService } from './qr-order.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PosModule } from '../pos/pos.module';
import { PricingModule } from '../pricing/pricing.module';
import { BuffetModule } from '../buffet/buffet.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PosModule),
    PricingModule,
    BuffetModule,
    forwardRef(() => NotificationModule),
  ],
  controllers: [QrOrderController],
  providers: [QrOrderService],
  exports: [QrOrderService],
})
export class QrOrderModule {}
