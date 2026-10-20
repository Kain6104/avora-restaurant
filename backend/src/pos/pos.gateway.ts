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
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/services/authorization.service';
import { randomUUID } from 'crypto';
import { getRequiredEnv } from '../common/utils/env.util';

export interface PosEventEnvelope<T = any> {
  eventId: string;
  eventType: string;
  entityType: 'ORDER' | 'TABLE' | 'KITCHEN' | 'PAYMENT' | 'SHIFT' | 'PRODUCT';
  entityId: string;
  branchId: string;
  version?: number;
  timestamp: string;
  actorId?: string;
  payload: T;
}

@WebSocketGateway({
  namespace: '/pos',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class PosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PosGateway.name);

  // Map branchId -> Map<socketId, { userId?: string; isAgentOnline?: boolean; updatedAt: Date }>
  private branchPosTerminals = new Map<string, Map<string, { userId?: string; isAgentOnline?: boolean; updatedAt: Date }>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly authorizationService: AuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    let token = client.handshake.auth?.token || client.handshake.query?.token;
    let userId = client.handshake.auth?.userId || client.handshake.query?.userId;
    const branchId = client.handshake.auth?.branchId || client.handshake.query?.branchId;

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

    if (userId) {
      client.data.userId = userId;
      client.join(`user:${userId}`);
      client.join(`cashier:${userId}`);

      // Check global admin access
      const hasAdminAccess = await this.authorizationService.hasPermission(userId, 'admin.access');
      if (hasAdminAccess) {
        client.join('admin:global');
      }
    }

    if (branchId && typeof branchId === 'string' && userId) {
      // Verify branch authorization on initial connect
      const hasPosAccess = await this.authorizationService.hasPermissionForBranch(userId, 'pos.access', branchId);
      const hasWaiterAccess = await this.authorizationService.hasPermissionForBranch(userId, 'waiter.access', branchId);
      const hasKdsAccess =
        (await this.authorizationService.hasPermissionForBranch(userId, 'kds.access', branchId)) ||
        (await this.authorizationService.hasPermissionForBranch(userId, 'kitchen.orders.view', branchId));
      const hasOrdersAccess = await this.authorizationService.hasPermissionForBranch(userId, 'orders.view', branchId);
      const hasDashboardAccess = await this.authorizationService.hasPermissionForBranch(userId, 'dashboard.view', branchId);

      const hasBranchAccess = hasPosAccess || hasWaiterAccess || hasKdsAccess || hasOrdersAccess || hasDashboardAccess;

      if (hasBranchAccess) {
        client.data.branchId = branchId;
        client.join(`branch:${branchId}`);
        if (hasPosAccess) client.join(`branch:${branchId}:pos`);
        if (hasWaiterAccess) client.join(`branch:${branchId}:waiter`);
        if (hasKdsAccess) client.join(`branch:${branchId}:kds`);
        if (hasOrdersAccess) client.join(`branch:${branchId}:orders`);
        this.logger.log(`Client ${client.id} joined branch:${branchId} and scoped rooms`);
      } else {
        this.logger.warn(`Client ${client.id} (user: ${userId}) denied initial join to branch ${branchId}`);
      }
    }

    this.logger.log(`POS Client connected: ${client.id} (user: ${userId || 'anonymous'})`);
  }

  handleDisconnect(client: Socket) {
    this.removePosTerminal(client.id);
    this.logger.log(`POS Client disconnected: ${client.id}`);
  }

  private removePosTerminal(socketId: string) {
    for (const [branchId, terminals] of this.branchPosTerminals) {
      if (terminals.has(socketId)) {
        terminals.delete(socketId);
        this.logger.log(`POS Terminal disconnected: ${socketId} from branch ${branchId}. Remaining: ${terminals.size}`);
        if (terminals.size === 0) {
          this.branchPosTerminals.delete(branchId);
        }
      }
    }
  }

  @SubscribeMessage('join_branch')
  async handleJoinBranch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId: string; cashierId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, message: 'Unauthorized: Authentication required' };
    }
    if (!data?.branchId) {
      return { success: false, message: 'branchId is required' };
    }

    // Check branch permissions
    const hasPosAccess = await this.authorizationService.hasPermissionForBranch(userId, 'pos.access', data.branchId);
    const hasWaiterAccess = await this.authorizationService.hasPermissionForBranch(userId, 'waiter.access', data.branchId);
    const hasKdsAccess =
      (await this.authorizationService.hasPermissionForBranch(userId, 'kds.access', data.branchId)) ||
      (await this.authorizationService.hasPermissionForBranch(userId, 'kitchen.orders.view', data.branchId));
    const hasOrdersAccess = await this.authorizationService.hasPermissionForBranch(userId, 'orders.view', data.branchId);
    const hasDashboardAccess = await this.authorizationService.hasPermissionForBranch(userId, 'dashboard.view', data.branchId);

    const hasBranchAccess = hasPosAccess || hasWaiterAccess || hasKdsAccess || hasOrdersAccess || hasDashboardAccess;

    if (!hasBranchAccess) {
      this.logger.warn(`User ${userId} rejected from joining branch ${data.branchId}: Insufficient branch permissions`);
      return { success: false, message: 'Forbidden: No access to this branch' };
    }

    client.data.branchId = data.branchId;
    client.join(`branch:${data.branchId}`);
    if (hasPosAccess) client.join(`branch:${data.branchId}:pos`);
    if (hasWaiterAccess) client.join(`branch:${data.branchId}:waiter`);
    if (hasKdsAccess) client.join(`branch:${data.branchId}:kds`);
    if (hasOrdersAccess) client.join(`branch:${data.branchId}:orders`);

    if (data.cashierId) {
      client.data.userId = data.cashierId;
      client.join(`cashier:${data.cashierId}`);
    }

    if ((data as any).clientType === 'POS_TERMINAL' || (data as any).isPrintHost) {
      if (!this.branchPosTerminals.has(data.branchId)) {
        this.branchPosTerminals.set(data.branchId, new Map());
      }
      this.branchPosTerminals.get(data.branchId)!.set(client.id, {
        userId,
        isAgentOnline: (data as any).isAgentOnline !== false,
        updatedAt: new Date(),
      });
      client.join(`pos_terminals:${data.branchId}`);
      this.logger.log(`POS Terminal registered via join_branch: socket ${client.id} for branch ${data.branchId}`);
    }

    this.logger.log(`Client ${client.id} (user: ${userId}) subscribed to branch:${data.branchId}`);
    return { success: true, room: `branch:${data.branchId}` };
  }

  @SubscribeMessage('register_pos_terminal')
  handleRegisterPosTerminal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId: string; isAgentOnline?: boolean },
  ) {
    if (!data?.branchId) return { success: false, message: 'branchId is required' };

    if (!this.branchPosTerminals.has(data.branchId)) {
      this.branchPosTerminals.set(data.branchId, new Map());
    }

    this.branchPosTerminals.get(data.branchId)!.set(client.id, {
      userId: client.data.userId,
      isAgentOnline: data.isAgentOnline !== false,
      updatedAt: new Date(),
    });

    client.join(`pos_terminals:${data.branchId}`);
    this.logger.log(`Registered POS Terminal: socket ${client.id} for branch ${data.branchId} (Agent ready: ${data.isAgentOnline !== false})`);

    return { success: true, count: this.branchPosTerminals.get(data.branchId)!.size };
  }

  @SubscribeMessage('pos_health_status')
  handlePosHealthStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId: string; isAgentOnline: boolean },
  ) {
    if (!data?.branchId) return { success: false };
    const terminals = this.branchPosTerminals.get(data.branchId);
    if (terminals && terminals.has(client.id)) {
      const term = terminals.get(client.id)!;
      term.isAgentOnline = data.isAgentOnline;
      term.updatedAt = new Date();
      this.logger.debug(`POS Terminal health updated for ${client.id}: agentOnline=${data.isAgentOnline}`);
    }
    return { success: true };
  }

  @SubscribeMessage('leave_branch')
  handleLeaveBranch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId: string },
  ) {
    if (data?.branchId) {
      client.leave(`branch:${data.branchId}`);
      return { success: true };
    }
    return { success: false };
  }

  @SubscribeMessage('join_order')
  async handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, message: 'Unauthorized: Authentication required' };
    }
    if (!data?.orderId) {
      return { success: false, message: 'orderId is required' };
    }

    // IDOR protection: Look up order branchId
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      select: { id: true, branchId: true },
    });

    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    const hasOrderAccess =
      (await this.authorizationService.hasPermissionForBranch(userId, 'pos.order.view', order.branchId)) ||
      (await this.authorizationService.hasPermissionForBranch(userId, 'orders.view', order.branchId));

    if (!hasOrderAccess) {
      this.logger.warn(`User ${userId} forbidden to join order ${data.orderId} at branch ${order.branchId}`);
      return { success: false, message: 'Forbidden: No access to this order' };
    }

    client.join(`order:${data.orderId}`);
    return { success: true, room: `order:${data.orderId}` };
  }

  @SubscribeMessage('leave_order')
  handleLeaveOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (data?.orderId) {
      client.leave(`order:${data.orderId}`);
      return { success: true };
    }
    return { success: false };
  }

  @SubscribeMessage('join_qr_session')
  handleJoinQrSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: string; orderId?: string; branchId?: string },
  ) {
    if (data?.orderId) {
      client.join(`order:${data.orderId}`);
    }
    if (data?.token) {
      client.join(`qr_token:${data.token}`);
    }
    if (data?.branchId) {
      client.join(`branch:${data.branchId}`);
    }
    this.logger.log(`Socket ${client.id} joined QR room (order: ${data?.orderId}, token: ${data?.token})`);
    return { success: true, orderId: data?.orderId };
  }

  @SubscribeMessage('join_kitchen')
  async handleJoinKitchen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId: string; stationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, message: 'Unauthorized: Authentication required' };
    }
    if (!data?.branchId || !data?.stationId) {
      return { success: false, message: 'branchId and stationId are required' };
    }

    // Must have kds.access or kitchen.orders.view for this branch
    const hasKdsAccess =
      (await this.authorizationService.hasPermissionForBranch(userId, 'kds.access', data.branchId)) ||
      (await this.authorizationService.hasPermissionForBranch(userId, 'kitchen.orders.view', data.branchId));

    if (!hasKdsAccess) {
      this.logger.warn(`User ${userId} rejected from joining kitchen in branch ${data.branchId}`);
      return { success: false, message: 'Forbidden: No KDS access to this branch' };
    }

    const room = `kitchen:${data.branchId}:${data.stationId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined kitchen station ${room}`);
    return { success: true, room };
  }

  @SubscribeMessage('leave_kitchen')
  handleLeaveKitchen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId: string; stationId: string },
  ) {
    if (data?.branchId && data?.stationId) {
      client.leave(`kitchen:${data.branchId}:${data.stationId}`);
      return { success: true };
    }
    return { success: false };
  }

  /**
   * Phát sự kiện cập nhật quyền hạn thời gian thực tới tất cả client hoặc user cụ thể
   */
  emitAuthorizationUpdated(userId?: string, roleId?: string) {
    if (!this.server) return;
    const payload = {
      type: 'AUTHORIZATION_UPDATED',
      userId,
      roleId,
      timestamp: new Date().toISOString(),
    };
    this.logger.log(`Emitting AUTHORIZATION_UPDATED for userId=${userId || 'ALL'}, roleId=${roleId || 'ALL'}`);
    if (userId) {
      this.server.to(`user:${userId}`).emit('AUTHORIZATION_UPDATED', payload);
      this.server.to(`cashier:${userId}`).emit('AUTHORIZATION_UPDATED', payload);
    }
    this.server.emit('AUTHORIZATION_UPDATED', payload);
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', timestamp: new Date().toISOString() };
  }

  // Generic envelope dispatcher with socket.io native room deduplication
  emitEnvelope(rooms: string | string[], envelope: PosEventEnvelope) {
    if (!this.server) return;
    if (Array.isArray(rooms)) {
      if (rooms.length === 0) return;
      let target: any = this.server.to(rooms[0]);
      for (let i = 1; i < rooms.length; i++) {
        target = target.to(rooms[i]);
      }
      target.emit(envelope.eventType, envelope);
      target.emit('pos_event', envelope);
    } else {
      this.server.to(rooms).emit(envelope.eventType, envelope);
      this.server.to(rooms).emit('pos_event', envelope);
    }
  }

  emitEvent(params: {
    eventType: string;
    entityType: 'ORDER' | 'TABLE' | 'KITCHEN' | 'PAYMENT' | 'SHIFT' | 'PRODUCT';
    entityId: string;
    branchId: string;
    payload: any;
  }) {
    const envelope: PosEventEnvelope = {
      eventId: randomUUID(),
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      branchId: params.branchId,
      timestamp: new Date().toISOString(),
      payload: params.payload,
    };
    const rooms: string[] = [];
    if (params.branchId && params.branchId !== 'ALL') {
      rooms.push(`branch:${params.branchId}`);
    }
    if (params.entityType === 'ORDER' && params.entityId) {
      rooms.push(`order:${params.entityId}`);
    }
    if (rooms.length > 0) {
      this.emitEnvelope(rooms, envelope);
    } else if (this.server) {
      this.server.emit(params.eventType, envelope);
      this.server.emit('pos_event', envelope);
    }
  }

  emitOrderCreated(order: any, actorId?: string) {
    const envelope: PosEventEnvelope = {
      eventId: randomUUID(),
      eventType: 'ORDER_CREATED',
      entityType: 'ORDER',
      entityId: order.id,
      branchId: order.branchId,
      version: order.version,
      timestamp: new Date().toISOString(),
      actorId,
      payload: order,
    };
    this.emitEnvelope(`branch:${order.branchId}`, envelope);
  }

  emitOrderUpdated(order: any, actorId?: string, tableName?: string) {
    const finalTableName = tableName || order?.table?.name || order?.tableName;
    const envelope: PosEventEnvelope = {
      eventId: randomUUID(),
      eventType: 'ORDER_UPDATED',
      entityType: 'ORDER',
      entityId: order.id,
      branchId: order.branchId,
      version: order.version,
      timestamp: new Date().toISOString(),
      actorId,
      payload: {
        ...order,
        tableName: finalTableName,
        notificationMessage: finalTableName ? `Có thay đổi ở bàn ${finalTableName}` : `Đơn hàng [${order.orderCode || order.temporaryOrderCode}] có cập nhật`,
      },
    };
    // Multi-room broadcast to both branch and order rooms with deduplication
    this.emitEnvelope([`branch:${order.branchId}`, `order:${order.id}`], envelope);
  }

  emitTableStatusChanged(
    branchId: string,
    tableId: string,
    status: string,
    session?: any,
    order?: any,
    actorId?: string,
    tableName?: string,
  ) {
    const finalTableName = tableName || order?.table?.name || order?.tableName;
    const envelope: PosEventEnvelope = {
      eventId: randomUUID(),
      eventType: 'TABLE_STATUS_CHANGED',
      entityType: 'TABLE',
      entityId: tableId,
      branchId,
      timestamp: new Date().toISOString(),
      actorId,
      payload: { 
        tableId, 
        status, 
        session, 
        order,
        tableName: finalTableName,
        notificationMessage: finalTableName ? `Có thay đổi ở bàn ${finalTableName}` : `Bàn có cập nhật trạng thái`,
      },
    };
    this.emitEnvelope(`branch:${branchId}`, envelope);
  }

  emitKitchenTicket(
    branchId: string,
    stationId: string,
    ticket: any,
    actorId?: string,
  ) {
    const envelope: PosEventEnvelope = {
      eventId: randomUUID(),
      eventType: 'KITCHEN_TICKET_NEW',
      entityType: 'KITCHEN',
      entityId: ticket.orderId,
      branchId,
      timestamp: new Date().toISOString(),
      actorId,
      payload: ticket,
    };
    this.emitEnvelope(`kitchen:${branchId}:${stationId}`, envelope);
    this.emitEnvelope(`branch:${branchId}`, envelope);
  }

  emitKitchenItemUpdated(branchId: string, item: any, actorId?: string) {
    const envelope: PosEventEnvelope = {
      eventId: randomUUID(),
      eventType: 'KITCHEN_ITEM_UPDATED',
      entityType: 'KITCHEN',
      entityId: item.id,
      branchId,
      timestamp: new Date().toISOString(),
      actorId,
      payload: item,
    };
    if (item.stationId) {
      this.emitEnvelope(`kitchen:${branchId}:${item.stationId}`, envelope);
    }
    this.emitEnvelope(`branch:${branchId}`, envelope);
    this.emitEnvelope(`branch:${branchId}:waiter`, envelope);
    this.emitEnvelope(`branch:${branchId}:kds`, envelope);
    if (item.orderId) {
      this.emitEnvelope(`order:${item.orderId}`, envelope);
    }

    // Direct event emission for waiter / UI listeners
    if (this.server) {
      this.server.to(`branch:${branchId}`).emit('KITCHEN_ITEM_STATUS_CHANGED', {
        ...item,
        status: item.kitchenStatus || item.status,
      });
      if (item.kitchenStatus === 'READY' || item.status === 'READY') {
        this.server.to(`branch:${branchId}`).emit('KITCHEN_ITEM_READY', envelope);
        this.server.to(`branch:${branchId}:waiter`).emit('KITCHEN_ITEM_READY', envelope);
      }
    }
  }

  emitPaymentCompleted(order: any, payment: any, actorId?: string) {
    const envelope: PosEventEnvelope = {
      eventId: randomUUID(),
      eventType: 'PAYMENT_COMPLETED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      branchId: order.branchId,
      version: order.version,
      timestamp: new Date().toISOString(),
      actorId,
      payload: { order, payment },
    };
    this.emitEnvelope([`branch:${order.branchId}`, `order:${order.id}`], envelope);
  }

  emitShiftUpdated(branchId: string, shift: any, actorId?: string) {
    const envelope: PosEventEnvelope = {
      eventId: randomUUID(),
      eventType: shift.status === 'OPEN' ? 'SHIFT_OPENED' : 'SHIFT_CLOSED',
      entityType: 'SHIFT',
      entityId: shift.id,
      branchId,
      timestamp: new Date().toISOString(),
      actorId,
      payload: shift,
    };
    this.emitEnvelope(`branch:${branchId}`, envelope);
    if (shift.cashierId) {
      this.emitEnvelope(`cashier:${shift.cashierId}`, envelope);
    }
  }

  emitProductAvailabilityChanged(
    branchId: string,
    productId: string,
    available: boolean,
    actorId?: string,
  ) {
    const envelope: PosEventEnvelope = {
      eventId: randomUUID(),
      eventType: 'PRODUCT_AVAILABILITY_CHANGED',
      entityType: 'PRODUCT',
      entityId: productId,
      branchId,
      timestamp: new Date().toISOString(),
      actorId,
      payload: { productId, available },
    };
    this.emitEnvelope(`branch:${branchId}`, envelope);
  }

  /**
   * Kiểm tra trạng thái máy chủ POS & Print Agent của chi nhánh
   */
  checkBranchPosStatus(branchId: string): { isOnline: boolean; isAgentOnline: boolean } {
    const terminals = this.branchPosTerminals.get(branchId);
    if (!terminals || terminals.size === 0) {
      return { isOnline: false, isAgentOnline: false };
    }

    let hasActiveSocket = false;
    let hasAgentOnline = false;
    const deadSockets: string[] = [];

    for (const [socketId, info] of terminals) {
      // Trong Socket.IO v4 của NestJS namespace gateway, this.server.sockets là Map<string, Socket>
      const socket =
        (this.server?.sockets as any)?.get?.(socketId) ||
        (this.server?.sockets as any)?.sockets?.get?.(socketId) ||
        (typeof (this.server as any)?.of === 'function'
          ? (this.server as any).of('/pos')?.sockets?.get(socketId)
          : null);

      if (socket) {
        if (socket.connected) {
          hasActiveSocket = true;
          if (info.isAgentOnline !== false) {
            hasAgentOnline = true;
            break;
          }
        } else {
          deadSockets.push(socketId);
        }
      } else {
        // Nếu không tìm thấy socket trong server sockets map, kiểm tra thời gian cập nhật gần nhất (< 90s)
        const isRecent = info.updatedAt && Date.now() - new Date(info.updatedAt).getTime() < 90000;
        if (isRecent) {
          hasActiveSocket = true;
          if (info.isAgentOnline !== false) {
            hasAgentOnline = true;
            break;
          }
        } else {
          deadSockets.push(socketId);
        }
      }
    }

    for (const sid of deadSockets) {
      terminals.delete(sid);
    }
    if (terminals.size === 0) {
      this.branchPosTerminals.delete(branchId);
    }

    return {
      isOnline: hasActiveSocket,
      isAgentOnline: hasAgentOnline,
    };
  }

  /**
   * Trả về true nếu máy chủ POS đang mở và Print Agent sẵn sàng
   */
  isBranchPosOnline(branchId: string): boolean {
    const status = this.checkBranchPosStatus(branchId);
    return status.isOnline && status.isAgentOnline;
  }

  /**
   * Phát lệnh in âm thầm từ Waiter về máy chủ POS bán hàng chi nhánh
   */
  emitPrintDispatch(branchId: string, payload: any) {
    const envelope: PosEventEnvelope = {
      eventId: randomUUID(),
      eventType: 'PRINT_DISPATCH' as any,
      entityType: 'PRINT_JOB' as any,
      entityId: payload.orderId,
      branchId,
      timestamp: new Date().toISOString(),
      payload,
    };

    // Emit duy nhất 1 lần tới phòng POS Terminals của chi nhánh
    this.server.to(`pos_terminals:${branchId}`).emit('print_dispatch', payload);
    this.logger.log(`Print dispatch emitted for branch ${branchId} (Order ${payload.orderCode || payload.orderId}) to POS hosts`);
  }
}
