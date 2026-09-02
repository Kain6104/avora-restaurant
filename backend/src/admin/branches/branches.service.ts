import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) { }

  async findAll(branchId?: string) {
    return this.prisma.branch.findMany({
      where: branchId ? { id: branchId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true, users: true }
        }
      }
    });
  }

  async create(data: any) {
    // Generate a default branchCode if not provided
    if (!data.branchCode) {
      data.branchCode = `BR-${Date.now()}`;
    }
    return this.prisma.branch.create({
      data,
    });
  }

  async update(id: string, data: any) {
    return this.prisma.branch.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true, users: true }
        }
      }
    });

    if (!branch) {
      throw new Error('Branch not found');
    }

    if (branch._count.orders > 0 || branch._count.users > 0) {
      throw new Error('Cannot delete branch because it has associated orders or users');
    }

    return this.prisma.branch.delete({
      where: { id },
    });
  }
}
