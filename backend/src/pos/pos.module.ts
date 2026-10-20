import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { PosController } from './pos.controller';
import { PosUpdateController } from './pos-update.controller';
import { PosService } from './pos.service';
import { PosGateway } from './pos.gateway';
import { NotificationModule } from '../notification/notification.module';

import { PrintRoutingModule } from '../print-routing/print-routing.module';
import { PrintTemplateModule } from '../print-template/print-template.module';
import { BuffetModule } from '../buffet/buffet.module';
import { QrOrderModule } from '../qr-order/qr-order.module';

import { PosPinController } from './pos-pin.controller';
import { PosPinService } from './pos-pin.service';
import { getRequiredEnv } from '../common/utils/env.util';

@Module({
  imports: [
    PrismaModule,
    PrintRoutingModule,
    PrintTemplateModule,
    BuffetModule,
    forwardRef(() => QrOrderModule),
    forwardRef(() => NotificationModule),
    JwtModule.register({
      secret: getRequiredEnv('JWT_SECRET'),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [PosController, PosUpdateController, PosPinController],
  providers: [PosService, PosGateway, PosPinService],
  exports: [PosService, PosGateway, PosPinService],
})
export class PosModule {}
