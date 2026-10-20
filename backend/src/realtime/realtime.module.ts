import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CheckoutGateway } from '../order/checkout.gateway';
import { RealtimeBroadcastService } from '../order/realtime-broadcast.service';
import { PosModule } from '../pos/pos.module';
import { PrismaModule } from '../prisma/prisma.module';
import { getRequiredEnv } from '../common/utils/env.util';

@Global()
@Module({
  imports: [
    PrismaModule,
    PosModule,
    JwtModule.register({
      secret: getRequiredEnv('JWT_SECRET'),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [CheckoutGateway, RealtimeBroadcastService],
  exports: [CheckoutGateway, RealtimeBroadcastService],
})
export class RealtimeModule {}
