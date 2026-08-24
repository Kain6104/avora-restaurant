import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionService } from '../promotion/promotion.service';

@Injectable()
export class HomeService {
  constructor(private prisma: PrismaService, private promotionService: PromotionService) {}

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

    const enrichedBestSellers = await this.promotionService.enrichProductsWithFlashSale(bestSellers);
    const enrichedAiRecommended = await this.promotionService.enrichProductsWithFlashSale(aiRecommended);

    return {
      banners,
      categories,
      bestSellers: enrichedBestSellers,
      aiRecommended: enrichedAiRecommended,
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
