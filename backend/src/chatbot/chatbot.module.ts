import { Module, forwardRef } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotGateway } from './chatbot.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ReservationModule } from '../reservation/reservation.module';

@Module({
  imports: [
    PrismaModule, 
    JwtModule.register({ secret: 'AVORA_SECRET_2026' }),
    forwardRef(() => ReservationModule),
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotGateway],
})
export class ChatbotModule {}
