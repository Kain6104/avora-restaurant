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
          optionGroups: { include: { optionItems: true } },
          branches: { select: { id: true } }
        },
        take: 20,
      }),
      this.prisma.product.findMany({
        where: { isAiRecommended: true, available: true },
        include: { 
          category: true,
          optionGroups: { include: { optionItems: true } },
          branches: { select: { id: true } }
        },
        take: 10,
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
      select: {
        id: true,
        name: true,
        street: true,
        ward: true,
        district: true,
        province: true,
        phone: true,
        openTime: true,
        closeTime: true,
        latitude: true,
        longitude: true,
        onlineOrderingEnabled: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
