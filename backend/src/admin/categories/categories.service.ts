import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    search?: string;
    branchIdScope?: string;
  }) {
    const { skip = 0, take = 10, search, branchIdScope } = params;
    
    const where: any = {};
    
    if (branchIdScope) {
      where.branches = {
        some: { id: branchIdScope }
      };
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        skip,
        take,
        where,
        include: {
          branches: { select: { id: true, name: true } },
          _count: { 
            select: { 
              products: branchIdScope ? {
                where: { branches: { some: { id: branchIdScope } } }
              } : true 
            } 
          }
        },
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.category.count({ where }),
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

  async create(data: any) {
    const { name, slug, description, displayOrder, image } = data;
    return this.prisma.category.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/ /g, '-'),
        description,
        displayOrder: displayOrder || 0,
        image,
      }
    });
  }

  async update(id: string, data: any) {
    return this.prisma.category.update({
      where: { id },
      data
    });
  }

  async remove(id: string) {
    return this.prisma.category.delete({
      where: { id }
    });
  }
}
