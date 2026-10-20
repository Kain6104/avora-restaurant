import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRequiredEnv } from '../common/utils/env.util';

export interface CheckoutSignalEnvelope<T = any> {
  eventId: string;
  eventType: string;
  branchId?: string;
  version?: number;
  timestamp: string;
  payload?: T;
}

@WebSocketGateway({
  namespace: '/checkout',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class CheckoutGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CheckoutGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    let token = client.handshake.auth?.token || client.handshake.query?.token;
    let userId = client.handshake.auth?.userId || client.handshake.query?.userId;
    const branchId = client.handshake.auth?.branchId || client.handshake.query?.branchId;
    const sessionId = client.handshake.auth?.sessionId || client.handshake.query?.sessionId;

    if (!token && client.handshake.headers.cookie) {
      const cookies = client.handshake.headers.cookie.split(';');
      const tokenCookie = cookies.find((c) => c.trim().startsWith('token='));
      if (tokenCookie) {
        const cookieVal = tokenCookie.substring(tokenCookie.indexOf('=') + 1).trim();
        token = decodeURIComponent(cookieVal);
      }
    }

    if (token && token !== 'guest' && token !== 'null') {
      try {
        const payload = this.jwtService.verify(token, {
          secret: getRequiredEnv('JWT_SECRET'),
        });
        userId = payload.sub || payload.id || payload.userId;
      } catch (e) {
        this.logger.debug(`Token verification failed for checkout socket ${client.id}`);
      }
    }

    // Luôn cho client tham gia room toàn cục
    client.join('checkout:global');

    if (userId) {
      client.data.userId = userId;
      client.join(`checkout:user:${userId}`);
    }

    if (branchId && typeof branchId === 'string') {
      client.data.branchId = branchId;
      client.join(`checkout:branch:${branchId}`);
    }

    if (sessionId && typeof sessionId === 'string') {
      client.data.sessionId = sessionId;
      client.join(`checkout:session:${sessionId}`);
    }

    this.logger.log(`Checkout client connected: ${client.id} (user: ${userId || 'guest'}, branch: ${branchId || 'none'})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Checkout client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_checkout')
  handleJoinCheckout(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId?: string; userId?: string; sessionId?: string },
  ) {
    if (data?.branchId) {
      client.data.branchId = data.branchId;
      client.join(`checkout:branch:${data.branchId}`);
    }
    if (data?.userId) {
      client.data.userId = data.userId;
      client.join(`checkout:user:${data.userId}`);
    }
    if (data?.sessionId) {
      client.data.sessionId = data.sessionId;
      client.join(`checkout:session:${data.sessionId}`);
    }
    return { success: true };
  }

  /**
   * Phát tín hiệu thay đổi đến các room tương ứng
   */
  emitSignal(eventType: string, payload: any = {}, branchId?: string, userId?: string) {
    if (!this.server) return;

    const envelope: CheckoutSignalEnvelope = {
      eventId: Math.random().toString(36).substring(2, 10),
      eventType,
      branchId,
      timestamp: new Date().toISOString(),
      payload,
    };

    if (userId) {
      this.server.to(`checkout:user:${userId}`).emit(eventType, envelope);
    } else if (branchId) {
      this.server.to(`checkout:branch:${branchId}`).emit(eventType, envelope);
      this.server.to('checkout:global').emit(eventType, envelope);
    } else {
      this.server.to('checkout:global').emit(eventType, envelope);
    }

    this.logger.debug(`[Signal emitted] ${eventType} -> branch: ${branchId || 'all'}, user: ${userId || 'all'}`);
  }
}
