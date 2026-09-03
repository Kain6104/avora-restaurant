import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    search?: string;
    userId?: string;
  }) {
    const { skip = 0, take = 20, search, userId } = params;
    
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (search) {
      where.OR = [
        { action: { contains: search } },
        { target: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take,
        where,
        include: {
          user: {
            select: { fullName: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: Math.floor(skip / take) + 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      }
    };
  }

  async logAction(data: {
    userId: string;
    action: string;
    target: string;
    oldValue?: string;
    newValue?: string;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        target: data.target,
        oldValue: data.oldValue,
        newValue: data.newValue,
        ipAddress: data.ipAddress,
      }
    });
  }
}
