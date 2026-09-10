import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  namespace: '/print-agent',
  cors: { origin: '*' },
})
export class PrintAgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PrintAgentGateway.name);

  @WebSocketServer()
  server: Server;

  // Map agentId -> Socket
  private connectedAgents = new Map<string, Socket>();

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers['x-agent-token'] ||
        client.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        this.logger.warn(`Agent connection rejected: Missing token from ${client.id}`);
        client.disconnect(true);
        return;
      }

      // Look up agent by token hash / token prefix (for simple matching or bcrypt)
      const agent = await this.prisma.printAgent.findFirst({
        where: {
          isActive: true,
          OR: [
            { secretHash: token },
            { id: token },
          ],
        },
      });

      if (!agent) {
        this.logger.warn(`Agent connection rejected: Invalid token from ${client.id}`);
        client.disconnect(true);
        return;
      }

      client.data.agentId = agent.id;
      client.data.branchId = agent.branchId;
      this.connectedAgents.set(agent.id, client);

      await this.prisma.printAgent.update({
        where: { id: agent.id },
        data: {
          lastSeenAt: new Date(),
          ipAddress: client.handshake.address || undefined,
        },
      });

      this.logger.log(`Print Agent [${agent.name}] connected (ID: ${agent.id})`);
      client.emit('connection:ack', { success: true, agentId: agent.id });
    } catch (err: any) {
      this.logger.error(`Error in handleConnection: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const agentId = client.data?.agentId;
    if (agentId) {
      this.connectedAgents.delete(agentId);
      this.logger.log(`Print Agent disconnected (ID: ${agentId})`);
    }
  }

  isAgentOnline(agentId: string): boolean {
    const socket = this.connectedAgents.get(agentId);
    return !!socket && socket.connected;
  }

  isAgentOnlineForBranch(branchId: string): boolean {
    for (const [_, socket] of this.connectedAgents) {
      if (socket.connected && socket.data?.branchId === branchId) {
        return true;
      }
    }
    return false;
  }

  async sendJobToAgent(agentId: string, jobData: any): Promise<boolean> {
    const socket = this.connectedAgents.get(agentId);
    if (!socket || !socket.connected) {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      socket.emit('print:dispatch', jobData, (ack: any) => {
        clearTimeout(timeout);
        resolve(ack && ack.success === true);
      });
    });
  }

  @SubscribeMessage('agent:heartbeat')
  async handleHeartbeat(client: Socket) {
    const agentId = client.data?.agentId;
    if (agentId) {
      await this.prisma.printAgent.update({
        where: { id: agentId },
        data: { lastSeenAt: new Date() },
      }).catch(() => {});
      return { status: 'OK', time: new Date() };
    }
    return { status: 'UNAUTHORIZED' };
  }
}
