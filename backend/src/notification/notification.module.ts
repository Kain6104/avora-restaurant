import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationRecipientService } from './notification-recipient.service';
import { NotificationEngineService } from './notification-engine.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PosModule } from '../pos/pos.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PosModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'AVORA_SECRET_2026',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    NotificationService,
    NotificationGateway,
    NotificationRecipientService,
    NotificationEngineService,
  ],
  controllers: [NotificationController],
  exports: [
    NotificationService,
    NotificationGateway,
    NotificationRecipientService,
    NotificationEngineService,
  ],
})
export class NotificationModule {}
