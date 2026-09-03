import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RoleType } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    search?: string;
    role?: RoleType;
    branchIdScope?: string;
  }) {
    const { skip = 0, take = 10, search, role, branchIdScope } = params;
    
    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    
    if (role) {
      where.role = role;
    }
    
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          branchId: true,
          branch: {
            select: { name: true }
          },
          isAccountLocked: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
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

  async findOne(id: string, branchIdScope?: string) {
    const where: any = { id };
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }
    const user = await this.prisma.user.findFirst({
      where,
      include: {
        branch: { select: { name: true, id: true } },
        membershipTier: true,
        addresses: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            branch: { select: { name: true } },
            orderItems: {
              include: { product: { select: { name: true, imageUrl: true } } }
            }
          }
        }
      }
    });
    if (!user) {
      throw new BadRequestException('User not found or access denied');
    }
    return user;
  }

  async updateUserRole(id: string, role: RoleType, branchId: string | null, adminId?: string) {
    if ((role === RoleType.MANAGER || role === RoleType.CHEF) && !branchId) {
      throw new BadRequestException(`Branch ID is required for role ${role}`);
    }
    
    const oldUser = await this.prisma.user.findUnique({ where: { id }, select: { role: true, branchId: true, fullName: true } });

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        role,
        branchId: branchId || null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
      }
    });
    
    if (adminId && oldUser) {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'UPDATE_ROLE',
          target: `User: ${oldUser.fullName} (${id})`,
          oldValue: `Role: ${oldUser.role}, Branch: ${oldUser.branchId}`,
          newValue: `Role: ${role}, Branch: ${branchId}`,
        }
      });
    }
    
    return user;
  }

  async create(data: any) {
    // Nếu có password, hash nó
    if (data.password) {
      const bcrypt = require('bcryptjs');
      data.passwordHash = await bcrypt.hash(data.password, 10);
    }
    delete data.password;

    return this.prisma.user.create({
      data
    });
  }

  async update(id: string, data: any) {
    if (data.password) {
      const bcrypt = require('bcryptjs');
      data.passwordHash = await bcrypt.hash(data.password, 10);
    }
    delete data.password;

    return this.prisma.user.update({
      where: { id },
      data
    });
  }
}
