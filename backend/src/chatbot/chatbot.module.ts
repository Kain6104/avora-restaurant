import { Module, forwardRef } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotGateway } from './chatbot.gateway';
import { ChatbotToolEngineService } from './chatbot-tool-engine.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ReservationModule } from '../reservation/reservation.module';
import { OrderModule } from '../order/order.module';
import { OperatingSlotModule } from '../operating-slot/operating-slot.module';
import { PaymentMethodModule } from '../payment-method/payment-method.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'AVORA_SECRET_2026',
    }),
    forwardRef(() => ReservationModule),
    forwardRef(() => OrderModule),
    OperatingSlotModule,
    PaymentMethodModule,
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotGateway, ChatbotToolEngineService],
  exports: [ChatbotService, ChatbotToolEngineService],
})
export class ChatbotModule {}
