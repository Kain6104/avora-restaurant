import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CheckoutGateway } from '../order/checkout.gateway';
import { RealtimeBroadcastService } from '../order/realtime-broadcast.service';
import { PosModule } from '../pos/pos.module';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    PosModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'AVORA_SECRET_2026',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [CheckoutGateway, RealtimeBroadcastService],
  exports: [CheckoutGateway, RealtimeBroadcastService],
})
export class RealtimeModule {}
