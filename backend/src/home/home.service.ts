import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionService } from '../promotion/promotion.service';
import { toCleanSlug } from '../common/utils/slug.util';

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
        where: { isBestSeller: true, available: true, id: { notIn: ['prod-ai-meal-architect'] } },
        include: { 
          category: true,
          optionGroups: { include: { optionItems: true } },
          branches: { select: { id: true } }
        },
        take: 20,
      }),
      this.prisma.product.findMany({
        where: { isAiRecommended: true, available: true, id: { notIn: ['prod-ai-meal-architect'] } },
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
    const list = await this.prisma.branch.findMany({
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
        reservationEnabled: true,
        capacity: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return list.map(b => ({
      ...b,
      slug: toCleanSlug(b.name),
    }));
  }

  async getBranchDetail(slugOrId: string) {
    const branches = await this.prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        branchCode: true,
        street: true,
        ward: true,
        district: true,
        province: true,
        phone: true,
        email: true,
        latitude: true,
        longitude: true,
        openTime: true,
        closeTime: true,
        onlineOrderingEnabled: true,
        reservationEnabled: true,
        capacity: true,
        restaurantAreas: { select: { id: true, name: true } },
        specialHours: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
    const target = branches.find(b =>
      (isUUID && b.id === slugOrId) ||
      toCleanSlug(b.name) === slugOrId ||
      (b.branchCode && b.branchCode.toLowerCase() === slugOrId.toLowerCase())
    );

    if (!target) {
      throw new NotFoundException(`Chi nhánh không tồn tại: ${slugOrId}`);
    }

    const slug = toCleanSlug(target.name);
    const now = new Date();

    // 1. Món ăn đang phục vụ tại chi nhánh
    const branchProducts = await this.prisma.product.findMany({
      where: {
        available: true,
        id: { notIn: ['prod-ai-meal-architect'] },
        OR: [
          { branches: { some: { id: target.id } } },
          { branches: { none: {} } },
        ],
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ isBestSeller: 'desc' }, { soldQuantity: 'desc' }],
          });

    // 2. Voucher ưu đãi áp dụng cho chi nhánh
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        OR: [
          { branches: { some: { id: target.id } } },
          { branches: { none: {} } },
        ],
      },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        discountType: true,
        discountValue: true,
        maxDiscount: true,
        minOrderValue: true,
        startDate: true,
        endDate: true,
      },
      take: 12,
    });

    const enrichedProducts = await this.promotionService.enrichProductsWithFlashSale(branchProducts);

    return {
      branch: {
        ...target,
        slug,
      },
      menuItems: enrichedProducts,
      products: enrichedProducts,
      vouchers,
    };
  }
}
