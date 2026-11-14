import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateOrderAuditLogDto {
  orderId: string;
  orderCode?: string | null;
  action: string;
  category?: string; // ORDER, PAYMENT, CANCEL, ITEM, KITCHEN, PRINT, POINTS, ADMIN
  actorId?: string | null;
  actorName?: string | null;
  actorUsername?: string | null;
  actorAvatarUrl?: string | null;
  actorRole?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  reason?: string | null;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
  correlationId?: string | null;
  isSensitive?: boolean;
}

@Injectable()
export class OrderAuditService {
  private readonly logger = new Logger(OrderAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an order audit event inside an existing Prisma transaction or standalone
   */
  async log(dto: CreateOrderAuditLogDto, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    try {
      // Resolve actor name and role snapshot if actorId is provided and missing name
      let actorName = dto.actorName;
      let actorUsername = dto.actorUsername;
      let actorAvatarUrl = dto.actorAvatarUrl;
      let actorRole = dto.actorRole;

      if (dto.actorId && (!actorName || !actorRole)) {
        const user = await client.user.findUnique({
          where: { id: dto.actorId },
          select: { fullName: true, email: true, role: true, avatarUrl: true },
        });
        if (user) {
          actorName = actorName || user.fullName || user.email;
          actorUsername = actorUsername || user.email;
          actorAvatarUrl = actorAvatarUrl || user.avatarUrl;
          actorRole = actorRole || user.role;
        }
      }

      // Sanitize values to prevent recording sensitive data like tokens/passwords
      const sanitizedOld = this.sanitizeJson(dto.oldValue);
      const sanitizedNew = this.sanitizeJson(dto.newValue);
      const sanitizedMeta = this.sanitizeJson(dto.metadata);

      return await client.orderAuditLog.create({
        data: {
          orderId: dto.orderId,
          orderCode: dto.orderCode,
          action: dto.action,
          category: dto.category || 'ORDER',
          actorId: dto.actorId,
          actorName: actorName || 'Hệ thống',
          actorUsername,
          actorAvatarUrl,
          actorRole: actorRole || 'SYSTEM',
          branchId: dto.branchId,
          branchName: dto.branchName,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
          reason: dto.reason,
          oldValue: sanitizedOld as Prisma.InputJsonValue,
          newValue: sanitizedNew as Prisma.InputJsonValue,
          metadata: sanitizedMeta as Prisma.InputJsonValue,
          correlationId: dto.correlationId,
          isSensitive: dto.isSensitive ?? false,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to record order audit log for order ${dto.orderId}: ${err?.message}`, err?.stack);
      // We do not rethrow to avoid failing caller unless inside critical audit requirement
      return null;
    }
  }

  /**
   * Fetch timeline for an order with filtering
   */
  async getTimeline(
    orderId: string,
    query?: {
      category?: string;
      includeSensitive?: boolean;
    }
  ) {
    const where: Prisma.OrderAuditLogWhereInput = {
      orderId,
    };

    if (query?.category && query.category !== 'ALL') {
      where.category = query.category;
    }

    if (!query?.includeSensitive) {
      where.isSensitive = false;
    }

    return await this.prisma.orderAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  private sanitizeJson(val: any): any {
    if (!val || typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map((v) => this.sanitizeJson(v));
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (/password|token|secret|credential|key/i.test(k)) {
        clean[k] = '[REDACTED]';
      } else {
        clean[k] = this.sanitizeJson(v);
      }
    }
    return clean;
  }
}

