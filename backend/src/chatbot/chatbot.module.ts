import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotGateway } from './chatbot.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule, 
    JwtModule.register({ secret: 'AVORA_SECRET_2026' })
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotGateway],
})
export class ChatbotModule {}
