import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FarmItemType, FarmRarity } from '@prisma/client';
import { FarmGateway } from './farm.gateway';

import { getUpcomingUpgradeRequirements } from './farm-progression.util';

export interface UpgradeMaterialInfo {
  purpose: string;
  description: string;
  targetSystem?: 'FARM_LEVEL' | 'WAREHOUSE' | 'PLOT' | 'TOOL';
  targetLevel?: number;
  neededQty?: number;
  currentQty?: number;
}

export const UPGRADE_MATERIAL_REGISTRY: Record<string, UpgradeMaterialInfo> = {
  JAPANESE_RICE: {
    purpose: 'Nâng cấp Nông Trại Cấp 1 & Cấp 3',
    description: 'Dùng 3 lúa để thăng cấp lên Cấp 2 và 5 lúa để thăng cấp lên Cấp 4.',
    targetSystem: 'FARM_LEVEL',
  },
  STRAWBERRY: {
    purpose: 'Nâng cấp Nông Trại Cấp 2',
    description: 'Dùng 3 dâu tây Tochigi để thăng cấp nông trại lên Cấp 3.',
    targetSystem: 'FARM_LEVEL',
  },
  MATCHA_LEAF: {
    purpose: 'Nâng cấp Nông Trại Cấp 4',
    description: 'Dùng 5 lá trà Uji Matcha để thăng cấp nông trại lên Cấp 5.',
    targetSystem: 'FARM_LEVEL',
  },
  YUZU: {
    purpose: 'Nâng cấp Nông Trại Cấp 5',
    description: 'Dùng 6 quả Yuzu hoàng kim để thăng cấp nông trại lên Cấp 6.',
    targetSystem: 'FARM_LEVEL',
  },
  GRAPE: {
    purpose: 'Nâng cấp Nông Trại Cấp 6',
    description: 'Dùng 6 chùm nho Shine Muscat để thăng cấp nông trại lên Cấp 7.',
    targetSystem: 'FARM_LEVEL',
  },
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmGateway: FarmGateway,
  ) {}

  /**
   * Chuẩn hóa khóa kho cho mọi vật phẩm theo đúng quy ước:
   * - Cây thường: CROP + crop.code
   * - Biến thể: MUTATION_CROP + mutation.code
   */
  normalizeInventoryKey(params: {
    itemType: FarmItemType;
    referenceId?: string;
    itemCode?: string;
  }): { itemType: FarmItemType; referenceId: string; itemCode: string } {
    const { itemType } = params;
    const referenceId = (params.referenceId || '').trim();
    const itemCode = (params.itemCode || '').trim();

    if (itemType === FarmItemType.CROP || itemType === FarmItemType.MUTATION_CROP) {
      const code = itemCode || referenceId;
      return {
        itemType,
        referenceId: code,
        itemCode: code,
      };
    }

    const finalRefId = referenceId || itemCode;
    const finalItemCode = itemCode || referenceId;
    return {
      itemType,
      referenceId: finalRefId,
      itemCode: finalItemCode,
    };
  }

  /**
   * Tính giá bán chính thức thống nhất cho cả hệ thống (bán thường, bán nhanh, hiển thị DTO)
   */
  calculateEffectiveSellPrice(
    crop?: { sellPrice: number } | null,
    mutation?: { sellPrice?: number | null; rewardFarmCoin: number } | null,
  ): number {
    if (mutation) {
      if (typeof mutation.sellPrice === 'number' && mutation.sellPrice > 0) {
        return mutation.sellPrice;
      }
      return Math.round(mutation.rewardFarmCoin * 1.5);
    }
    if (crop) {
      return crop.sellPrice ?? 10;
    }
    return 10;
  }

  /**
   * Lấy kho đồ người dùng kèm thông tin mở rộng:
   * - isUpgradeMaterial & upgradeInfo (chỉ tính các cấp độ TƯƠNG LAI >= farm.level)
   * - canSell & sellPrice (tính toán chuẩn xác từ cơ sở dữ liệu)
   * - isLocked & isSeen (bảo vệ chống bán nhầm và badge Mới)
   */
  async getUserInventory(farmId: string, currentFarmLevel?: number) {
    const items = await this.prisma.farmInventoryItem.findMany({
      where: { farmId, quantity: { gt: 0 } },
      orderBy: [{ itemType: 'asc' }, { updatedAt: 'desc' }],
    });

    if (items.length === 0) return [];

    let userLevel = currentFarmLevel;
    if (userLevel === undefined) {
      const farm = await this.prisma.userFarm.findUnique({
        where: { id: farmId },
        select: { level: true },
      });
      userLevel = farm?.level ?? 1;
    }

    const upcomingReqs = getUpcomingUpgradeRequirements(userLevel, 15);

    // Lấy thông tin giá bán từ DB
    const cropCodes = items
      .filter((i) => i.itemType === FarmItemType.CROP)
      .map((i) => i.itemCode);
    const mutationCodes = items
      .filter((i) => i.itemType === FarmItemType.MUTATION_CROP)
      .map((i) => i.itemCode);

    const [crops, mutations] = await Promise.all([
      cropCodes.length > 0
        ? this.prisma.farmCrop.findMany({
            where: { code: { in: cropCodes } },
            select: { code: true, sellPrice: true, rarity: true, iconUrl: true },
          })
        : [],
      mutationCodes.length > 0
        ? this.prisma.farmCropMutation.findMany({
            where: { code: { in: mutationCodes } },
            select: { code: true, sellPrice: true, rewardFarmCoin: true, rarity: true },
          })
        : [],
    ]);

    const cropMap = new Map<string, { code: string; sellPrice: number; rarity: any; iconUrl: string | null }>();
    (crops as any[]).forEach((c) => cropMap.set(c.code, c));

    const mutationMap = new Map<string, { code: string; sellPrice?: number | null; rewardFarmCoin: number; rarity: any }>();
    (mutations as any[]).forEach((m) => mutationMap.set(m.code, m));

    return items.map((item) => {
      // Chỉ đánh dấu là nguyên liệu hữu ích nếu cần cho các cấp độ TƯƠNG LAI
      const matchedReq = upcomingReqs.find((req) => req.cropCode === item.itemCode);
      let upgradeInfo: UpgradeMaterialInfo | null = null;
      let isUpgradeMaterial = false;

      if (matchedReq) {
        isUpgradeMaterial = true;
        upgradeInfo = {
          purpose: `Cần cho nâng cấp Lv.${matchedReq.level}`,
          description: `Cần ${matchedReq.cropQty} • Hiện có ${item.quantity}`,
          targetSystem: 'FARM_LEVEL',
          targetLevel: matchedReq.level,
          neededQty: matchedReq.cropQty,
          currentQty: item.quantity,
        };
      }

      let sellPrice = 0;
      let canSell = false;

      if (item.itemType === FarmItemType.CROP) {
        canSell = true;
        const crop = cropMap.get(item.itemCode);
        sellPrice = this.calculateEffectiveSellPrice(crop, null);
      } else if (item.itemType === FarmItemType.MUTATION_CROP) {
        canSell = true;
        const mut = mutationMap.get(item.itemCode);
        sellPrice = this.calculateEffectiveSellPrice(null, mut);
      }

      // Xác định Category/Subcategory chuẩn
      let itemCategory = 'SPECIAL';
      if (item.itemType === FarmItemType.SEED) {
        itemCategory = 'SEED';
      } else if (isUpgradeMaterial) {
        itemCategory = 'UPGRADE';
      } else if (item.itemType === FarmItemType.CROP || item.itemType === FarmItemType.MUTATION_CROP) {
        itemCategory = 'CROP';
      } else if (item.itemType === FarmItemType.FERTILIZER || item.itemType === FarmItemType.TOOL) {
        itemCategory = 'ITEM';
      } else if (item.itemType === FarmItemType.DECORATION) {
        itemCategory = 'DECORATION';
      }

      return {
        id: item.id,
        farmId: item.farmId,
        itemType: item.itemType,
        referenceId: item.referenceId,
        itemName: item.itemName,
        itemCode: item.itemCode,
        rarity: item.rarity,
        quantity: item.quantity,
        isLocked: item.isLocked,
        isSeen: item.isSeen,
        seenAt: item.seenAt,
        metadata: item.metadata,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        isUpgradeMaterial,
        upgradeInfo,
        canSell,
        sellPrice,
        itemCategory,
      };
    });
  }

  /**
   * Đếm số lượng vật phẩm mới chưa xem trong túi đồ của người chơi
   */
  async getUnseenCount(farmId: string): Promise<number> {
    return this.prisma.farmInventoryItem.count({
      where: {
        farmId,
        quantity: { gt: 0 },
        isSeen: false,
      },
    });
  }

  /**
   * Đánh dấu vật phẩm đã xem (xóa badge Mới)
   */
  async markItemsSeen(farmId: string, itemIds?: string[]) {
    const now = new Date();
    if (itemIds && itemIds.length > 0) {
      await this.prisma.farmInventoryItem.updateMany({
        where: {
          farmId,
          id: { in: itemIds },
          isSeen: false,
        },
        data: {
          isSeen: true,
          seenAt: now,
        },
      });
    } else {
      await this.prisma.farmInventoryItem.updateMany({
        where: {
          farmId,
          isSeen: false,
        },
        data: {
          isSeen: true,
          seenAt: now,
        },
      });
    }

    const unseenCount = await this.getUnseenCount(farmId);
    return { success: true, unseenCount };
  }

  /**
   * Khóa hoặc mở khóa vật phẩm trong kho (chống vô ý bán nhầm)
   */
  async toggleItemLock(farmId: string, itemId: string) {
    const item = await this.prisma.farmInventoryItem.findFirst({
      where: { id: itemId, farmId },
    });

    if (!item) {
      throw new NotFoundException('Không tìm thấy vật phẩm trong kho đồ');
    }

    const updated = await this.prisma.farmInventoryItem.update({
      where: { id: itemId },
      data: { isLocked: !item.isLocked },
    });

    return {
      success: true,
      itemId: updated.id,
      itemName: updated.itemName,
      isLocked: updated.isLocked,
      message: updated.isLocked
        ? `Đã khóa "${updated.itemName}" (Không thể bán nhanh)`
        : `Đã mở khóa "${updated.itemName}"`,
    };
  }

  /**
   * Thêm vật phẩm vào kho đồ người chơi (hỗ trợ transaction Prisma)
   */
  async addItem(
    tx: any,
    farmId: string,
    params: {
      itemType: FarmItemType;
      referenceId: string;
      itemName: string;
      itemCode: string;
      quantity: number;
      rarity?: FarmRarity;
      metadata?: any;
      expiresAt?: Date;
    },
  ) {
    const norm = this.normalizeInventoryKey({
      itemType: params.itemType,
      referenceId: params.referenceId,
      itemCode: params.itemCode,
    });
    const itemType = norm.itemType;
    const referenceId = norm.referenceId;
    const itemCode = norm.itemCode;
    const {
      itemName,
      quantity,
      rarity = FarmRarity.COMMON,
      metadata,
      expiresAt,
    } = params;

    const existing = await tx.farmInventoryItem.findUnique({
      where: {
        farmId_itemType_referenceId: {
          farmId,
          itemType,
          referenceId,
        },
      },
    });

    if (existing) {
      return tx.farmInventoryItem.update({
        where: { id: existing.id },
        data: {
          quantity: { increment: quantity },
          ...(metadata ? { metadata } : {}),
        },
      });
    }

    return tx.farmInventoryItem.create({
      data: {
        farmId,
        itemType,
        referenceId,
        itemName,
        itemCode,
        quantity,
        rarity,
        isSeen: false, // Vật phẩm lần đầu nhận đánh dấu Mới
        isLocked: false,
        metadata,
        expiresAt,
      },
    });
  }

  /**
   * Tiêu thụ vật phẩm trong kho (hỗ trợ transaction Prisma)
   */
  async consumeItem(
    tx: any,
    farmId: string,
    itemType: FarmItemType,
    referenceId: string,
    quantityToConsume: number = 1,
  ) {
    const norm = this.normalizeInventoryKey({ itemType, referenceId, itemCode: referenceId });
    let item = await tx.farmInventoryItem.findUnique({
      where: {
        farmId_itemType_referenceId: {
          farmId,
          itemType: norm.itemType,
          referenceId: norm.referenceId,
        },
      },
    });

    // Fallback tìm theo referenceId gốc nếu người gọi truyền UUID cũ
    if (!item && referenceId !== norm.referenceId) {
      item = await tx.farmInventoryItem.findUnique({
        where: {
          farmId_itemType_referenceId: {
            farmId,
            itemType,
            referenceId,
          },
        },
      });
    }

    if (!item || item.quantity < quantityToConsume) {
      throw new BadRequestException('Số lượng vật phẩm trong kho không đủ');
    }

    if (item.quantity === quantityToConsume) {
      return tx.farmInventoryItem.update({
        where: { id: item.id },
        data: { quantity: 0 },
      });
    }

    return tx.farmInventoryItem.update({
      where: { id: item.id },
      data: { quantity: { decrement: quantityToConsume } },
    });
  }

  /**
   * BÁN NHANH HÀNG LOẠT (QUICK SELL)
   * - Hỗ trợ chọn nhiều vật phẩm và bán cùng lúc
   * - Kiểm tra nghiêm ngặt: không bán item bị khóa (🔒), không bán nguyên liệu nâng cấp, không bán nông cụ/hạt giống
   * - Giá bán tính toán hoàn toàn từ Backend
   * - Thực thi Atomic trong Prisma $transaction chống race condition, duplicate
   */
  async quickSell(
    userId: string,
    itemsToSell: Array<{ itemId: string; quantity: number }>,
  ) {
    if (!Array.isArray(itemsToSell) || itemsToSell.length === 0) {
      throw new BadRequestException('Danh sách vật phẩm bán không được để trống');
    }

    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({ where: { userId } });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const itemIds = itemsToSell.map((i) => i.itemId);
      const inventoryItems = await tx.farmInventoryItem.findMany({
        where: {
          id: { in: itemIds },
          farmId: farm.id,
        },
      });

      const itemMap = new Map(inventoryItems.map((i) => [i.id, i]));

      // 1. Kiểm tra tính hợp lệ của toàn bộ lô hàng
      const cropCodes: string[] = [];
      const mutationCodes: string[] = [];

      for (const sellRequest of itemsToSell) {
        const item = itemMap.get(sellRequest.itemId);
        if (!item) {
          throw new NotFoundException(`Không tìm thấy vật phẩm có ID: ${sellRequest.itemId}`);
        }

        if (sellRequest.quantity <= 0) {
          throw new BadRequestException(`Số lượng bán của "${item.itemName}" phải lớn hơn 0`);
        }

        if (item.quantity < sellRequest.quantity) {
          throw new BadRequestException(
            `Số lượng trong kho không đủ để bán "${item.itemName}" (Cần: ${sellRequest.quantity}, Có: ${item.quantity})`,
          );
        }

        if (item.isLocked) {
          throw new BadRequestException(`Vật phẩm "${item.itemName}" đang bị khóa (🔒), không thể bán`);
        }

        if (item.itemType === FarmItemType.CROP) {
          cropCodes.push(item.itemCode);
        } else if (item.itemType === FarmItemType.MUTATION_CROP) {
          mutationCodes.push(item.itemCode);
        } else {
          throw new BadRequestException(`Chỉ có thể bán nông sản hoặc biến thể thu hoạch, không thể bán "${item.itemName}"`);
        }
      }

      // 2. Tra cứu giá bán chính xác từ DB
      const [crops, mutations] = await Promise.all([
        cropCodes.length > 0
          ? tx.farmCrop.findMany({
              where: { code: { in: cropCodes } },
              select: { code: true, sellPrice: true },
            })
          : [],
        mutationCodes.length > 0
          ? tx.farmCropMutation.findMany({
              where: { code: { in: mutationCodes } },
              select: { code: true, sellPrice: true, rewardFarmCoin: true },
            })
          : [],
      ]);

      const cropPriceMap = new Map<string, number>();
      (crops as any[]).forEach((c) => cropPriceMap.set(c.code, this.calculateEffectiveSellPrice(c, null)));

      const mutationPriceMap = new Map<string, number>();
      (mutations as any[]).forEach((m) => mutationPriceMap.set(m.code, this.calculateEffectiveSellPrice(null, m)));

      let grandTotalCoins = 0;
      const soldDetails: Array<{
        itemId: string;
        itemName: string;
        quantity: number;
        unitPrice: number;
        totalCoins: number;
      }> = [];

      // 3. Trừ số lượng kho và tính tổng tiền
      for (const sellRequest of itemsToSell) {
        const item = itemMap.get(sellRequest.itemId)!;
        let unitPrice = 10;

        if (item.itemType === FarmItemType.CROP) {
          unitPrice = cropPriceMap.get(item.itemCode) ?? 10;
        } else if (item.itemType === FarmItemType.MUTATION_CROP) {
          unitPrice = mutationPriceMap.get(item.itemCode) ?? 30;
        }

        const itemTotal = unitPrice * sellRequest.quantity;
        grandTotalCoins += itemTotal;

        if (item.quantity === sellRequest.quantity) {
          await tx.farmInventoryItem.update({
            where: { id: item.id },
            data: { quantity: 0 },
          });
        } else {
          await tx.farmInventoryItem.update({
            where: { id: item.id },
            data: { quantity: { decrement: sellRequest.quantity } },
          });
        }

        soldDetails.push({
          itemId: item.id,
          itemName: item.itemName,
          quantity: sellRequest.quantity,
          unitPrice,
          totalCoins: itemTotal,
        });
      }

      // 4. Cộng tiền vào ví nông trại
      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          farmCoin: { increment: grandTotalCoins },
        },
      });

      // 5. Ghi log hoạt động
      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'QUICK_SELL',
          details: {
            soldItems: soldDetails,
            totalCoinsEarned: grandTotalCoins,
          },
        },
      });

      // 6. Phát tín hiệu realtime qua FarmGateway
      this.farmGateway.emitFarmUpdated(userId, { farmCoin: updatedFarm.farmCoin });

      return {
        success: true,
        totalSold: itemsToSell.length,
        totalCoinsEarned: grandTotalCoins,
        currentFarmCoin: updatedFarm.farmCoin,
        soldItems: soldDetails,
      };
    });
  }
}
