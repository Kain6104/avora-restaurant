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

  @Get('sessions')
  @UseGuards(OptionalJwtAuthGuard)
  async getSessions(@Req() request?: AuthenticatedRequest) {
    if (!request?.user?.id) {
      return [];
    }
    return this.chatbotService.getUserSessions(request.user.id);
  }

  @Post('session')
  @UseGuards(OptionalJwtAuthGuard)
  async createSession(
    @Body('title') title?: string,
    @Body('channel') channel?: 'TEXT' | 'VOICE',
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.chatbotService.createNewSession(request?.user?.id, title, channel);
  }

  @Get('session/:sessionId')
  @UseGuards(OptionalJwtAuthGuard)
  async getSession(
    @Param('sessionId') sessionId: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.chatbotService.getSession(sessionId, request?.user?.id);
  }

  @Delete('session/:sessionId')
  @UseGuards(OptionalJwtAuthGuard)
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.chatbotService.deleteSession(sessionId, request?.user?.id);
  }

  @Post('session/:sessionId/share')
  @UseGuards(OptionalJwtAuthGuard)
  async createShareLink(
    @Param('sessionId') sessionId: string,
    @Body('duration') duration?: string,
    @Body('maskSensitive') maskSensitive?: boolean,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.chatbotService.createShareLink(
      sessionId,
      request?.user?.id,
      duration || '24h',
      maskSensitive !== false,
    );
  }

  @Get('share/:token')
  async getSharedChat(@Param('token') token: string) {
    return this.chatbotService.getSharedChat(token);
  }

  @Post('share/:token/revoke')
  async revokeSharedChat(@Param('token') token: string) {
    return this.chatbotService.revokeShareLink(token);
  }
}
