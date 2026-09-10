import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlashSaleStockService } from './flash-sale-stock.service';

export interface ResolvedProductPricing {
  pricingSource: 'FLASH_SALE' | 'NORMAL';
  isFlashSaleActive: boolean;
  isUpcoming: boolean;
  isSoldOut: boolean;
  flashSalePrice?: number;
  originalPrice: number;
  discountAmount: number;
  discountPercent: number;
  flashSaleId?: string | null;
  flashSaleSlotId?: string | null;
  flashSaleItemId?: string | null;
  campaignName?: string | null;
  slotName?: string | null;
  slotStartTime?: Date | null;
  slotEndTime?: Date | null;
  remainingStock?: number;
  soldCount?: number;
  totalStock?: number;
  userQuotaRemaining?: number;
  countdownSeconds?: number;
  upcomingFlashSale?: {
    flashSalePrice: number;
    startTime: Date;
    endTime: Date;
    slotName: string;
    countdownSeconds: number;
    stock: number;
    maxQuantityPerUser?: number | null;
  } | null;
}

@Injectable()
export class FlashSalePricingService {
  private readonly logger = new Logger(FlashSalePricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: FlashSaleStockService,
  ) {}

  /**
   * 1. Định giá 1 sản phẩm duy nhất (Single Source of Truth)
   */
  async resolveProductPrice(params: {
    productId: string;
    originalPrice: number;
    branchId?: string | null;
    userId?: string | null;
    currentTime?: Date;
    channel?: 'ONLINE' | 'POS';
  }): Promise<ResolvedProductPricing> {
    const {
      productId,
      originalPrice,
      branchId,
      userId,
      currentTime = new Date(),
      channel = 'ONLINE',
    } = params;

    const now = currentTime;

    // Tìm tất cả item Flash Sale của sản phẩm trong các chiến dịch không bị hủy/nháp
    const candidateItems = await this.prisma.flashSaleItem.findMany({
      where: {
        productId,
        isActive: true,
        flashSale: {
          isActive: true,
          status: { in: ['SCHEDULED', 'UPCOMING', 'ACTIVE'] },
          // Thời gian bao phủ cả Teaser và Chiến dịch
          OR: [
            { startTime: { lte: now }, endTime: { gte: now } },
            { teaserStartAt: { lte: now }, endTime: { gte: now } },
          ],
        },
      },
      include: {
        flashSale: {
          include: {
            branches: { select: { id: true, name: true } },
          },
        },
        slot: true,
      },
      orderBy: [{ flashSale: { priority: 'desc' } }, { flashSalePrice: 'asc' }],
    });

    let activeMatch: any = null;
    let upcomingMatch: any = null;

    for (const item of candidateItems) {
      const camp = item.flashSale;
      const slot = item.slot || {
        id: null,
        name: 'Khung giờ chính',
        startTime: camp.startTime,
        endTime: camp.endTime,
        teaserStartAt: camp.teaserStartAt,
        isActive: true,
      };

      if (!slot.isActive) continue;

      // Kiểm tra kênh bán
      if (channel === 'ONLINE' && !camp.applyOnline) continue;
      if (channel === 'POS' && !camp.applyPos) continue;

      // Kiểm tra chi nhánh (nếu camp có giới hạn chi nhánh và branchId được cung cấp)
      if (branchId && camp.branches.length > 0) {
        const branchIds = camp.branches.map((b) => b.id);
        if (!branchIds.includes(branchId)) continue;
      }

      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      const slotTeaser = slot.teaserStartAt ? new Date(slot.teaserStartAt) : camp.teaserStartAt ? new Date(camp.teaserStartAt) : null;

      // Trường hợp 1: Slot đang ACTIVE (slotStart <= now < slotEnd)
      if (slotStart <= now && now < slotEnd) {
        if (!activeMatch) {
          activeMatch = { item, camp, slot, slotStart, slotEnd };
          break; // Đã tìm thấy active match có priority cao nhất
        }
      }

      // Trường hợp 2: Slot đang UPCOMING (slotTeaser <= now < slotStart)
      if (slotTeaser && slotTeaser <= now && now < slotStart) {
        if (!upcomingMatch) {
          upcomingMatch = { item, camp, slot, slotStart, slotEnd };
        }
      }
    }

    // XỬ LÝ ACTIVE FLASH SALE
    if (activeMatch) {
      const { item, camp, slot, slotStart, slotEnd } = activeMatch;
      const availableStock = Math.max(0, item.stock - item.sold);
      const isSoldOut = availableStock <= 0;

      let userQuotaRemaining = item.maxQuantityPerUser ?? 9999;
      if (userId && item.maxQuantityPerUser) {
        const purchased = await this.stockService.getUserPurchasedQuantity(
          userId,
          productId,
          camp.id,
          slot.id,
        );
        userQuotaRemaining = Math.max(0, item.maxQuantityPerUser - purchased);
      }

      const countdownSeconds = Math.max(0, Math.floor((slotEnd.getTime() - now.getTime()) / 1000));

      // Chỉ áp dụng giá Flash Sale khi CÒN STOCK và USER CÒN QUOTA
      if (!isSoldOut && userQuotaRemaining > 0) {
        const discountAmount = Math.max(0, originalPrice - item.flashSalePrice);
        const discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;

        return {
          pricingSource: 'FLASH_SALE',
          isFlashSaleActive: true,
          isUpcoming: false,
          isSoldOut: false,
          flashSalePrice: item.flashSalePrice,
          originalPrice,
          discountAmount,
          discountPercent,
          flashSaleId: camp.id,
          flashSaleSlotId: slot.id,
          flashSaleItemId: item.id,
          campaignName: camp.name,
          slotName: slot.name,
          slotStartTime: slotStart,
          slotEndTime: slotEnd,
          remainingStock: availableStock,
          soldCount: item.sold,
          totalStock: item.stock,
          userQuotaRemaining,
          countdownSeconds,
          upcomingFlashSale: null,
        };
      }

      // Đã hết suất hoặc hết quota -> Bán giá thường nhưng vẫn hiển thị thông tin sold out
      return {
        pricingSource: 'NORMAL',
        isFlashSaleActive: false,
        isUpcoming: false,
        isSoldOut: true,
        flashSalePrice: item.flashSalePrice,
        originalPrice,
        discountAmount: 0,
        discountPercent: 0,
        flashSaleId: camp.id,
        flashSaleSlotId: slot.id,
        flashSaleItemId: item.id,
        campaignName: camp.name,
        slotName: slot.name,
        slotStartTime: slotStart,
        slotEndTime: slotEnd,
        remainingStock: availableStock,
        soldCount: item.sold,
        totalStock: item.stock,
        userQuotaRemaining,
        countdownSeconds,
        upcomingFlashSale: null,
      };
    }

    // XỬ LÝ UPCOMING FLASH SALE (Hiển thị trước nhưng KHÔNG áp dụng giá)
    if (upcomingMatch) {
      const { item, slot, slotStart, slotEnd } = upcomingMatch;
      const countdownSeconds = Math.max(0, Math.floor((slotStart.getTime() - now.getTime()) / 1000));

      return {
        pricingSource: 'NORMAL',
        isFlashSaleActive: false,
        isUpcoming: true,
        isSoldOut: false,
        originalPrice,
        discountAmount: 0,
        discountPercent: 0,
        upcomingFlashSale: {
          flashSalePrice: item.flashSalePrice,
          startTime: slotStart,
          endTime: slotEnd,
          slotName: slot.name,
          countdownSeconds,
          stock: item.stock,
          maxQuantityPerUser: item.maxQuantityPerUser,
        },
      };
    }

    // GIÁ BÁN THƯỜNG
    return {
      pricingSource: 'NORMAL',
      isFlashSaleActive: false,
      isUpcoming: false,
      isSoldOut: false,
      originalPrice,
      discountAmount: 0,
      discountPercent: 0,
      upcomingFlashSale: null,
    };
  }

  /**
   * 2. Batch Enrich sản phẩm với Flash Sale (dùng cho Menu, Trang chủ, Search)
   */
  async enrichProductsWithFlashSale(
    products: any[],
    branchId?: string | null,
    userId?: string | null,
    channel: 'ONLINE' | 'POS' = 'ONLINE',
  ): Promise<any[]> {
    if (!products || products.length === 0) return products;

    const now = new Date();

    return Promise.all(
      products.map(async (p) => {
        const originalPrice = p.price || 0;
        const resolved = await this.resolveProductPrice({
          productId: p.id,
          originalPrice,
          branchId,
          userId,
          currentTime: now,
          channel,
        });

        return {
          ...p,
          isFlashSaleItem: resolved.isFlashSaleActive,
          flashSalePrice: resolved.isFlashSaleActive ? resolved.flashSalePrice : null,
          flashSaleId: resolved.flashSaleId || null,
          flashSaleSlotId: resolved.flashSaleSlotId || null,
          flashSaleItemId: resolved.flashSaleItemId || null,
          flashSaleStock: resolved.totalStock || null,
          flashSaleSold: resolved.soldCount || 0,
          flashSaleRemaining: resolved.remainingStock || 0,
          isFlashSaleSoldOut: resolved.isSoldOut,
          isUpcomingFlashSale: resolved.isUpcoming,
          upcomingFlashSale: resolved.upcomingFlashSale || null,
          flashSaleCountdown: resolved.countdownSeconds || 0,
        };
      }),
    );
  }

  /**
   * 3. Public API: Lấy chiến dịch Flash Sale hiện tại theo chuẩn Shopee (Hỗ trợ Multi-Slots)
   */
  async getPublicFlashSaleOverview(
    channel: 'ONLINE' | 'POS' = 'ONLINE',
    branchId?: string | null,
    userId?: string | null,
  ): Promise<any> {
    const now = new Date();

    // Tìm chiến dịch đang hoạt động có priority cao nhất
    const campaign = await this.prisma.flashSale.findFirst({
      where: {
        isActive: true,
        status: { in: ['SCHEDULED', 'UPCOMING', 'ACTIVE'] },
        startTime: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, // Tìm trong 24h
        endTime: { gte: now },
        ...(channel === 'ONLINE' ? { applyOnline: true } : {}),
        ...(channel === 'POS' ? { applyPos: true } : {}),
        ...(branchId
          ? {
              OR: [
                { branches: { none: {} } },
                { branches: { some: { id: branchId } } },
              ],
            }
          : {}),
      },
      include: {
        branches: { select: { id: true, name: true, branchCode: true } },
        items: {
          where: { isActive: true },
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        slots: {
          orderBy: { startTime: 'asc' },
          include: {
            items: {
              where: { isActive: true },
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { startTime: 'asc' }],
    });

    if (!campaign) {
      return {
        hasFlashSale: false,
        serverTime: now.toISOString(),
        activeSlot: null,
        slots: [],
      };
    }

    // Phân loại các slots theo trạng thái: ENDED, ACTIVE, UPCOMING
    let activeSlot: any = null;
    let nextUpcomingSlot: any = null;

    const formattedSlots = await Promise.all(
      campaign.slots.map(async (slot, idx) => {
        const sStart = new Date(slot.startTime);
        const sEnd = new Date(slot.endTime);

        let slotStatus: 'ENDED' | 'ACTIVE' | 'UPCOMING' = 'UPCOMING';
        let countdown = 0;

        if (now >= sEnd) {
          slotStatus = 'ENDED';
        } else if (now >= sStart && now < sEnd) {
          slotStatus = 'ACTIVE';
          countdown = Math.max(0, Math.floor((sEnd.getTime() - now.getTime()) / 1000));
        } else {
          slotStatus = 'UPCOMING';
          countdown = Math.max(0, Math.floor((sStart.getTime() - now.getTime()) / 1000));
        }

        const slotItemsList = slot.items && slot.items.length > 0 ? slot.items : (campaign.items || []);

        const slotObj = {
          id: slot.id,
          name: slot.name,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: slotStatus,
          countdown,
          itemsCount: slotItemsList.length,
          items: slotItemsList.map((item) => {
            const prod = item.product;
            const progress = item.stock > 0 ? Math.min(100, Math.round((item.sold / item.stock) * 100)) : 0;
            const isSoldOut = item.sold >= item.stock;
            const discountPercent = prod.price > 0 ? Math.round((1 - item.flashSalePrice / prod.price) * 100) : 0;

            return {
              id: item.id,
              productId: item.productId,
              productName: prod.name,
              productSlug: prod.slug,
              productImage: prod.imageUrl,
              categoryName: prod.category?.name,
              categorySlug: prod.category?.slug,
              originalPrice: prod.price,
              flashSalePrice: item.flashSalePrice,
              discountPercent,
              stock: item.stock,
              sold: item.sold,
              remaining: Math.max(0, item.stock - item.sold),
              progress,
              isSoldOut,
              maxQuantityPerUser: item.maxQuantityPerUser,
              maxQuantityPerOrder: item.maxQuantityPerOrder,
              product: {
                id: prod.id,
                name: prod.name,
                slug: prod.slug,
                price: prod.price,
                imageUrl: prod.imageUrl,
                categoryId: prod.categoryId,
                category: prod.category
                  ? {
                      id: prod.category.id,
                      name: prod.category.name,
                      slug: prod.category.slug,
                    }
                  : null,
              },
            };
          }),
        };

        if (slotStatus === 'ACTIVE' && !activeSlot) {
          activeSlot = slotObj;
        }
        if (slotStatus === 'UPCOMING' && !nextUpcomingSlot) {
          nextUpcomingSlot = slotObj;
        }

        return slotObj;
      }),
    );

    const primarySlot = activeSlot || nextUpcomingSlot || formattedSlots[0] || null;

    return {
      hasFlashSale: true,
      id: campaign.id,
      code: campaign.code,
      name: campaign.name,
      description: campaign.description,
      startTime: campaign.startTime,
      endTime: campaign.endTime,
      countdown: primarySlot?.countdown || 0,
      bannerImageUrl: campaign.bannerImageUrl || campaign.imageUrl,
      items: primarySlot?.items || [],
      serverTime: now.toISOString(),
      campaign: {
        id: campaign.id,
        code: campaign.code,
        name: campaign.name,
        description: campaign.description,
        bannerImageUrl: campaign.bannerImageUrl || campaign.imageUrl,
        mobileBannerImageUrl: campaign.mobileBannerImageUrl,
        startTime: campaign.startTime,
        endTime: campaign.endTime,
        allowVouchers: campaign.allowVouchers,
        allowFreeship: campaign.allowFreeship,
        allowPoints: campaign.allowPoints,
        allowMembershipDiscount: campaign.allowMembershipDiscount,
      },
      activeSlot: primarySlot,
      slots: formattedSlots,
    };
  }
}
