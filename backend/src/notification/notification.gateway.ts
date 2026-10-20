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

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    let token = client.handshake.auth?.token || client.handshake.query?.token;
    let userId = client.handshake.auth?.userId || client.handshake.query?.userId;

    // Trích xuất token từ cookie nếu có
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
        this.logger.debug(`Token verification failed for socket ${client.id}`);
      }
    }

    if (userId && typeof userId === 'string') {
      client.data.userId = userId;
      client.join(`user_${userId}`);
      this.logger.log(`Client ${client.id} joined notification room: user_${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected from /notifications`);
  }

  @SubscribeMessage('join_user_room')
  handleJoinUserRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (data?.userId) {
      client.data.userId = data.userId;
      client.join(`user_${data.userId}`);
      this.logger.log(`Client ${client.id} joined user_${data.userId}`);
      return { success: true, room: `user_${data.userId}` };
    }
    return { success: false };
  }

  /**
   * Phát sự kiện thông báo mới tới người dùng theo thời gian thực
   */
  sendNotificationToUser(userId: string, notification: any, unreadCount?: number) {
    if (!this.server) return;
    this.server.to(`user_${userId}`).emit('notification', notification);
    if (typeof unreadCount === 'number') {
      this.server.to(`user_${userId}`).emit('unread_count', { unreadCount });
    }
  }

  /**
   * Đồng bộ số lượng thông báo chưa đọc tới mọi thiết bị của người dùng
   */
  sendUnreadCountToUser(userId: string, unreadCount: number) {
    if (!this.server) return;
    this.server.to(`user_${userId}`).emit('unread_count', { unreadCount });
  }
}
