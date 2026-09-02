import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    search?: string;
    categoryId?: string;
    branchIdScope?: string;
    status?: string;
  }) {
    const { skip = 0, take = 10, search, categoryId, branchIdScope, status } = params;
    
    const where: any = {};
    
    if (branchIdScope) {
      where.branches = {
        some: { id: branchIdScope }
      };
    }
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (status === 'available') {
      where.available = true;
    } else if (status === 'unavailable') {
      where.available = false;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { itemCode: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take,
        where,
        include: {
          category: { select: { name: true } },
          branches: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
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

  async toggleAvailability(id: string, branchIdScope?: string) {
    const where: any = { id };
    if (branchIdScope) {
      where.branches = {
        some: { id: branchIdScope }
      };
    }
    
    const product = await this.prisma.product.findFirst({
      where
    });
    
    if (!product) {
      throw new NotFoundException('Product not found or access denied in this branch');
    }
    
    return this.prisma.product.update({
      where: { id: product.id },
      data: { available: !product.available }
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { branches: true, category: true }
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
  async create(data: any) {
    const { branchIds, slug, ...restData } = data;
    return this.prisma.product.create({
      data: {
        ...restData,
        slug: slug || data.name.toLowerCase().replace(/ /g, '-'),
        branches: branchIds ? {
          connect: branchIds.map((id: string) => ({ id }))
        } : undefined
      }
    });
  }

  async update(id: string, data: any) {
    const updateData: any = { ...data };
    
    if (data.branchIds) {
      updateData.branches = {
        set: data.branchIds.map((branchId: string) => ({ id: branchId }))
      };
      delete updateData.branchIds;
    }
    
    return this.prisma.product.update({
      where: { id },
      data: updateData
    });
  }

  async remove(id: string) {
    return this.prisma.product.delete({
      where: { id }
    });
  }
}
