import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionService } from '../promotion/promotion.service';

@Injectable()
export class HomeService {
  constructor(private prisma: PrismaService, private promotionService: PromotionService) {}

  async getHomePageData() {
    const now = new Date();
    const [banners, categories, bestSellers, aiRecommended] = await Promise.all([
      this.prisma.banner.findMany({
        where: {
          active: true,
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ],
        },
        include: {
          branches: { select: { id: true, name: true } },
        },
        orderBy: [{ bannerOrder: 'asc' }, { createdAt: 'desc' }],
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

    const settingsList = await this.prisma.systemSetting.findMany();
    const settings: any = {};
    settingsList.forEach(s => {
      try { settings[s.key] = JSON.parse(s.value); } catch { settings[s.key] = s.value; }
    });

    return {
      banners,
      categories,
      bestSellers: enrichedBestSellers,
      aiRecommended: enrichedAiRecommended,
      settings,
    };
  }

  async getSettings() {
    const settingsList = await this.prisma.systemSetting.findMany();
    const settings: any = {};
    settingsList.forEach(s => {
      try { settings[s.key] = JSON.parse(s.value); } catch { settings[s.key] = s.value; }
    });
    return settings;
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
        allowDirectDiscount: true,
        pointRedeemRate: true,
        isLoyaltyOnlineEnabled: true,
        loyaltyEarnRateOnline: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
