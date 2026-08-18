import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HomeService {
  constructor(private prisma: PrismaService) {}

  async getHomePageData() {
    const [banners, categories, bestSellers, aiRecommended] = await Promise.all([
      this.prisma.banner.findMany({
        where: { active: true },
        orderBy: { bannerOrder: 'asc' },
      }),
      this.prisma.category.findMany({
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { isBestSeller: true, available: true },
        include: { 
          category: true,
          optionGroups: { include: { optionItems: true } }
        },
        take: 8,
      }),
      this.prisma.product.findMany({
        where: { isAiRecommended: true, available: true },
        include: { 
          category: true,
          optionGroups: { include: { optionItems: true } }
        },
        take: 4,
      }),
    ]);

    return {
      banners,
      categories,
      bestSellers,
      aiRecommended,
    };
  }

  async getBranches() {
    return this.prisma.branch.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }
}
