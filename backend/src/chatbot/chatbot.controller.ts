import { Controller, Post, Body, Get, Param, Delete, HttpException, HttpStatus } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';

class ChatDto {
  userId?: string;
  sessionId?: string;
  message: string;
  branchId?: string;
  history?: any[];
  personality?: string;
  cartTotal?: number;
  cartSummary?: string;
}

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('chat')
  async chat(@Body() body: ChatDto) {
    try {
      const { userId, sessionId, message, branchId, history, personality, cartTotal, cartSummary } = body;
      console.log('Incoming chat request:', { userId, sessionId, message, branchId, personality, cartTotal, cartSummary });
      return await this.chatbotService.chat(userId, sessionId, message, branchId, history, personality, cartTotal, cartSummary);
    } catch (e) {
      console.error('CHAT ERROR:', e);
      throw new HttpException(e.message || 'Lỗi server nội bộ', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('session/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    return this.chatbotService.getSession(sessionId);
  }

  @Delete('session/:sessionId')
  async deleteSession(@Param('sessionId') sessionId: string) {
    return this.chatbotService.deleteSession(sessionId);
  }
}
