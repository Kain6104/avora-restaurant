import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async getAllCategories() {
    return this.prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        products: {
          where: { available: true },
          include: { 
            branches: { select: { id: true } },
            optionGroups: { include: { optionItems: true } }
          }
        }
      }
    });
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        products: {
          where: { available: true },
          include: { 
            branches: { select: { id: true } },
            optionGroups: { include: { optionItems: true } }
          }
        }
      }
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    return category;
  }
}
