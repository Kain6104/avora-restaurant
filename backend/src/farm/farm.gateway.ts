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

@WebSocketGateway({
  namespace: '/farm',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class FarmGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(FarmGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    let token = client.handshake.auth?.token || client.handshake.query?.token;
    let userId = client.handshake.auth?.userId || client.handshake.query?.userId;

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
          secret: process.env.JWT_SECRET || 'AVORA_SECRET_2026',
        });
        userId = payload.sub || payload.id || payload.userId;
      } catch (e) {
        this.logger.debug(`Token verification failed for farm socket ${client.id}`);
      }
    }

    if (userId && typeof userId === 'string') {
      client.data.userId = userId;
      client.join(`user_farm_${userId}`);
      this.logger.log(`Client ${client.id} joined user_farm_${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected from /farm`);
  }

  @SubscribeMessage('join_farm_room')
  handleJoinFarmRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { farmId: string },
  ) {
    if (data?.farmId) {
      client.join(`farm_${data.farmId}`);
      return { success: true, room: `farm_${data.farmId}` };
    }
    return { success: false };
  }

  /**
   * Phát sự kiện cập nhật ô đất tới người dùng
   */
  emitPlotUpdated(userId: string, payload: any) {
    if (!this.server) return;
    this.server.to(`user_farm_${userId}`).emit('plot:updated', payload);
  }

  /**
   * Phát sự kiện cập nhật kho đồ
   */
  emitInventoryUpdated(userId: string, payload: any) {
    if (!this.server) return;
    this.server.to(`user_farm_${userId}`).emit('inventory:updated', payload);
  }

  /**
   * Phát sự kiện mở khóa đột biến
   */
  emitMutationDiscovered(userId: string, payload: any) {
    if (!this.server) return;
    this.server.to(`user_farm_${userId}`).emit('mutation:discovered', payload);
  }

  /**
   * Phát sự kiện nông trại lên cấp
   */
  emitFarmLeveledUp(userId: string, payload: any) {
    if (!this.server) return;
    this.server.to(`user_farm_${userId}`).emit('farm:leveled_up', payload);
  }

  /**
   * Phát sự kiện Bố cục khu vườn toàn cục được Admin xuất bản / cập nhật
   * Phát tới TOÀN BỘ client đang kết nối trên namespace /farm
   */
  emitLayoutUpdated(layoutData: any) {
    if (!this.server) return;
    this.logger.log(`Broadcast FARM_LAYOUT_UPDATED to all /farm clients`);
    this.server.emit('FARM_LAYOUT_UPDATED', layoutData);
    this.server.emit('farm:layout_updated', layoutData);
  }

  /**
   * Phát sự kiện trạng thái nông trại cập nhật tổng thể
   */
  emitFarmUpdated(userId: string, payload: any) {
    if (!this.server) return;
    this.server.to(`user_farm_${userId}`).emit('farm:updated', payload);
  }
}
