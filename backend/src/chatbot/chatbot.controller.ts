import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ChatbotService } from './chatbot.service';

class ChatDto {
  sessionId?: string;
  guestSessionToken?: string;
  message: string;
  branchId?: string;
  history?: unknown[];
  personality?: string;
  cartTotal?: number;
  cartSummary?: string;
  cartItems?: any[];
}

class ConfirmChatTransactionDto {
  sessionId: string;
  operation: 'ORDER' | 'RESERVATION';
  previewToken: string;
  paymentMethod?: string;
  usePoints?: boolean;
}

interface AuthenticatedRequest {
  user?: { id: string };
}

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(OptionalJwtAuthGuard)
  async chat(@Body() body: ChatDto, @Req() request?: AuthenticatedRequest) {
    try {
      const {
        sessionId,
        guestSessionToken,
        message,
        branchId,
        history,
        personality,
        cartTotal,
        cartSummary,
        cartItems,
      } = body;
      return await this.chatbotService.chat(
        request?.user?.id,
        sessionId,
        message,
        branchId,
        history,
        personality,
        cartTotal,
        cartSummary,
        guestSessionToken,
        cartItems,
      );
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Lỗi server nội bộ';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('confirmation')
  @UseGuards(JwtAuthGuard)
  async confirmTransaction(
    @Body() body: ConfirmChatTransactionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chatbotService.confirmTransaction(
      request.user!.id,
      body.sessionId,
      body.operation,
      body.previewToken,
      body.paymentMethod,
      body.usePoints,
    );
  }

  @Get('session/:sessionId')
  @UseGuards(JwtAuthGuard)
  async getSession(
    @Param('sessionId') sessionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chatbotService.getSession(sessionId, request.user!.id);
  }

  @Delete('session/:sessionId')
  @UseGuards(JwtAuthGuard)
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chatbotService.deleteSession(sessionId, request.user!.id);
  }
}
