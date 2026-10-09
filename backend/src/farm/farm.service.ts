import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CropService, CalculatedCropState } from './crop.service';
import { InventoryService } from './inventory.service';
import { FarmGateway } from './farm.gateway';
import { FarmItemType, FarmPlotStatus, FarmRarity } from '@prisma/client';
import { PlantDetailResponseDto } from './dto/farm.dto';
import { getLevelUpgradeRequirements } from './farm-progression.util';

export function formatGrowDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 giây';
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) {
    return remSec > 0 ? `${minutes} phút ${remSec}s` : `${minutes} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) {
    return remMin > 0 ? `${hours} giờ ${remMin}p` : `${hours} giờ`;
  }
  const days = Math.floor(hours / 24);
  const remHour = hours % 24;
  return remHour > 0 ? `${days} ngày ${remHour}h` : `${days} ngày`;
}

@Injectable()
export class FarmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cropService: CropService,
    private readonly inventoryService: InventoryService,
    private readonly farmGateway: FarmGateway,
  ) {}

  /**
   * Lấy hoặc tự động khởi tạo Nông trại người dùng (Welcome Onboarding)
   */
  async getOrCreateUserFarm(userId: string) {
    let farm = await this.prisma.userFarm.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            memberCode: true,
            points: true,
            currentPoints: true,
            membershipTier: true,
          },
        },
        plots: {
          include: {
            cropInstance: {
              include: { crop: true, mutation: true },
            },
          },
          orderBy: { plotIndex: 'asc' },
        },
      },
    });

    if (!farm) {
      farm = await this.initializeNewUserFarm(userId);
    } else {
      // Hồi phục năng lượng theo thời gian: +1 năng lượng mỗi 3 phút (180s)
      farm = await this.recoverEnergy(farm);
    }

    if (!farm) {
      throw new NotFoundException('Không thể khởi tạo nông trại');
    }

    return farm;
  }

  /**
   * Lấy trạng thái đầy đủ của Nông trại (State Sync)
   */
  async getFarmState(userId: string) {
    const farm = await this.getOrCreateUserFarm(userId);
    if (!farm) {
      throw new NotFoundException('Nông trại không tồn tại');
    }

    // Tính toán stage và tiến độ thực tế cho từng ô đất bằng Timestamp Math
    const enrichedPlots = farm.plots.map((plot) => {
      let growthState: CalculatedCropState | null = null;
      let effectiveStatus = plot.status;

      if (plot.cropInstance && !plot.cropInstance.harvestedAt) {
        growthState = this.cropService.calculateGrowthState(plot.cropInstance);
        if (growthState.isReady) {
          effectiveStatus = FarmPlotStatus.READY;
        } else if (plot.status === FarmPlotStatus.PLANTED || plot.status === FarmPlotStatus.WATERED) {
          effectiveStatus = FarmPlotStatus.GROWING;
        }
      }

      return {
        id: plot.id,
        plotIndex: plot.plotIndex,
        gridRow: plot.gridRow,
        gridCol: plot.gridCol,
        worldX: plot.worldX,
        worldY: plot.worldY,
        status: effectiveStatus,
        soilQuality: plot.soilQuality,
        waterLevel: plot.waterLevel,
        lastWateredAt: plot.lastWateredAt,
        fertilizerItemId: plot.fertilizerItemId,
        fertilizerBonus: plot.fertilizerBonus,
        unlockCost: plot.unlockCost,
        unlockLevel: plot.unlockLevel,
        cropInstance: plot.cropInstance,
        growthState,
      };
    });

    // Lấy số lượng bộ sưu tập đã mở khóa
    const totalCropsCount = await this.prisma.farmCrop.count();
    const totalMutationsCount = await this.prisma.farmCropMutation.count();
    const unlockedCollectionCount = await this.prisma.farmCollection.count({
      where: { farmId: farm.id, isUnlocked: true },
    });

    const inventory = await this.inventoryService.getUserInventory(farm.id, farm.level);
    const unseenInventoryCount = inventory.filter((item) => !item.isSeen).length;

    return {
      farm: {
        id: farm.id,
        level: farm.level,
        exp: farm.exp,
        totalExp: farm.totalExp,
        farmCoin: farm.farmCoin,
        energy: farm.energy,
        maxEnergy: farm.maxEnergy,
        treeLevel: farm.treeLevel,
        treeExp: farm.treeExp,
        activeWeather: farm.activeWeather,
        selectedTheme: farm.selectedTheme,
        unlockedPlotsCount: farm.unlockedPlotsCount,
        hasCompletedTutorial: (farm as any).hasCompletedTutorial ?? false,
        pendingLevelUp: farm.exp >= farm.level * 100,
        levelUpgradeRequirements: getLevelUpgradeRequirements(farm.level),
        luckyEnvelopeTickets: (farm as any).luckyEnvelopeTickets ?? 0,
        totalLuckyEnvelopesOpened: (farm as any).totalLuckyEnvelopesOpened ?? 0,
        totalLuckyEnvelopeTicketsEarned: (farm as any).totalLuckyEnvelopeTicketsEarned ?? 0,
      },
      user: {
        id: farm.user.id,
        fullName: farm.user.fullName,
        avatarUrl: farm.user.avatarUrl,
        memberCode: farm.user.memberCode,
        loyaltyPoints: farm.user.points ?? 0,
        membershipTier: farm.user.membershipTier?.name || 'Thành viên mới',
      },
      plots: enrichedPlots,
      inventory,
      unseenInventoryCount,
      collection: {
        unlocked: unlockedCollectionCount,
        total: totalCropsCount + totalMutationsCount,
      },
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Lấy chi tiết Bộ Sưu Tập (Pokédex Album) của người chơi cùng 5 mốc tiến độ giải thưởng
   */
  async getCollectionAlbum(userId: string) {
    const farm = await this.getOrCreateUserFarm(userId);
    if (!farm) {
      throw new NotFoundException('Nông trại không tồn tại');
    }

    const allCrops = await this.prisma.farmCrop.findMany({
      include: { mutations: true },
      orderBy: { sortOrder: 'asc' },
    });

    const [unlockedEntries, inventoryItems] = await Promise.all([
      this.prisma.farmCollection.findMany({
        where: { farmId: farm.id },
      }),
      this.prisma.farmInventoryItem.findMany({
        where: {
          farmId: farm.id,
          itemType: { in: [FarmItemType.CROP, FarmItemType.MUTATION_CROP] },
        },
      }),
    ]);

    const collectionMap = new Map<string, { harvestCount: number; highestYield: number; isUnlocked: boolean }>();
    const unlockedMap = new Set<string>();
    for (const e of unlockedEntries) {
      const key = `${e.cropId}_${e.mutationId || 'BASE'}`;
      unlockedMap.add(key);
      collectionMap.set(key, {
        harvestCount: e.harvestCount || 0,
        highestYield: e.highestYield || 1,
        isUnlocked: e.isUnlocked,
      });
    }

    const invMap = new Map<string, number>();
    for (const inv of inventoryItems) {
      invMap.set(inv.referenceId, (invMap.get(inv.referenceId) || 0) + inv.quantity);
    }

    // Lấy các mốc tiến độ đã nhận
    const claimedMilestoneLogs = await this.prisma.farmActivityLog.findMany({
      where: {
        userId,
        farmId: farm.id,
        action: 'COLLECTION_MILESTONE_CLAIM',
      },
    });
    const claimedMilestoneTiers = new Set<number>();
    for (const log of claimedMilestoneLogs) {
      const details = log.details as any;
      if (details?.tier) claimedMilestoneTiers.add(details.tier);
    }

    // Lấy các phần thưởng hoàn thành loại cây đã nhận
    const claimedCropMasteryLogs = await this.prisma.farmActivityLog.findMany({
      where: {
        userId,
        farmId: farm.id,
        action: 'CROP_MASTERY_CLAIM',
      },
    });
    const claimedCropIds = new Set<string>();
    for (const log of claimedCropMasteryLogs) {
      const details = log.details as any;
      if (details?.cropId) claimedCropIds.add(details.cropId);
    }

    // Đếm số lượng voucher 500k Tier 5 đã phát hành trên toàn hệ thống (giới hạn 11 cái)
    const claimedTier5Count = await this.prisma.voucher.count({
      where: {
        code: { startsWith: 'FARM_ROYAL_500K_' },
      },
    });
    const remainingTier5Vouchers = Math.max(0, 11 - claimedTier5Count);

    let totalSpecimens = 0;
    let unlockedSpecimens = 0;

    const items = allCrops.map((crop) => {
      totalSpecimens += 1;
      const isCropBaseUnlocked = unlockedMap.has(`${crop.id}_BASE`);
      if (isCropBaseUnlocked) unlockedSpecimens += 1;

      const cropColl = collectionMap.get(`${crop.id}_BASE`);
      const cropHarvestCount = cropColl?.harvestCount ?? 0;
      const cropInventoryQty = invMap.get(crop.code) ?? 0;
      const cropGrowDurationSeconds = crop.growDuration;
      const cropGrowDurationLabel = formatGrowDuration(cropGrowDurationSeconds);
      const cropSellPrice = this.inventoryService.calculateEffectiveSellPrice(crop, null);

      let allMutationsUnlocked = true;
      const mutations = crop.mutations.map((m) => {
        totalSpecimens += 1;
        const isMUnlocked = unlockedMap.has(`${crop.id}_${m.id}`);
        if (isMUnlocked) {
          unlockedSpecimens += 1;
        } else {
          allMutationsUnlocked = false;
        }

        const mColl = collectionMap.get(`${crop.id}_${m.id}`);
        const mHarvestCount = mColl?.harvestCount ?? 0;
        const mInventoryQty = invMap.get(m.code) ?? 0;
        const mEffectiveSellPrice = this.inventoryService.calculateEffectiveSellPrice(null, m);

        return {
          mutationId: m.id,
          code: m.code,
          name: m.name,
          mutationType: m.mutationType,
          rarity: m.rarity,
          description: m.description,
          isUnlocked: isMUnlocked,
          growDurationSeconds: cropGrowDurationSeconds,
          growDurationLabel: cropGrowDurationLabel,
          effectiveSellPrice: mEffectiveSellPrice,
          harvestCount: mHarvestCount,
          inventoryQuantity: mInventoryQty,
          mutationChance: m.mutationChance,
          unlockLevel: crop.minFarmLevel,
        };
      });

      const isCropFullyCompleted = isCropBaseUnlocked && (crop.mutations.length > 0 ? allMutationsUnlocked : true);
      const isMasteryClaimed = claimedCropIds.has(crop.id);

      return {
        cropId: crop.id,
        code: crop.code,
        name: crop.name,
        category: crop.category,
        rarity: crop.rarity,
        description: crop.description,
        isUnlocked: isCropBaseUnlocked,
        isCropFullyCompleted,
        isMasteryClaimed,
        growDurationSeconds: cropGrowDurationSeconds,
        growDurationLabel: cropGrowDurationLabel,
        effectiveSellPrice: cropSellPrice,
        harvestCount: cropHarvestCount,
        inventoryQuantity: cropInventoryQty,
        minFarmLevel: crop.minFarmLevel,
        mutations,
      };
    });

    const progressPercent = totalSpecimens > 0 ? Math.floor((unlockedSpecimens / totalSpecimens) * 100) : 0;

    const milestones = [
      {
        tier: 1,
        targetPercent: 20,
        title: 'Thợ Vườn Khởi Sự',
        rewardDescription: '150 Xu + 3 Hạt giống Bí Ẩn Phổ Thông',
        isReached: progressPercent >= 20,
        isClaimed: claimedMilestoneTiers.has(1),
      },
      {
        tier: 2,
        targetPercent: 40,
        title: 'Nông Dân Chăm Chỉ',
        rewardDescription: '350 Xu + 1 Bình Phân Bón Siêu Cấp + 20 Điểm Thành Viên',
        isReached: progressPercent >= 40,
        isClaimed: claimedMilestoneTiers.has(2),
      },
      {
        tier: 3,
        targetPercent: 60,
        title: 'Chuyên Gia Thần Nông',
        rewardDescription: '700 Xu + 3 Hạt giống Quý Hiếm + 50 Điểm Thành Viên',
        isReached: progressPercent >= 60,
        isClaimed: claimedMilestoneTiers.has(3),
      },
      {
        tier: 4,
        targetPercent: 80,
        title: 'Đại Sư Nông Nghiệp AVORA',
        rewardDescription: '1.200 Xu + 2 Túi Phân Thần Tốc + 100 Điểm Thành Viên',
        isReached: progressPercent >= 80,
        isClaimed: claimedMilestoneTiers.has(4),
      },
      {
        tier: 5,
        targetPercent: 100,
        title: 'Huyền Thoại Thần Nông Độc Bản',
        rewardDescription: 'VOUCHER GIẢM 500K ĐƠN TỪ 0đ (GIỚI HẠN 11 VOUCHER) + 1.500 Xu + 200 Điểm Thành Viên',
        isReached: progressPercent >= 100,
        isClaimed: claimedMilestoneTiers.has(5),
        totalLimitedVouchers: 11,
        remainingVouchers: remainingTier5Vouchers,
      },
    ];

    return {
      items,
      totalSpecimens,
      unlockedSpecimens,
      progressPercent,
      milestones,
      remainingTier5Vouchers,
    };
  }

  /**
   * Lấy chi tiết cây hoặc biến thể đột biến (DTO chuẩn hóa thống nhất 100% dữ liệu thật từ DB)
   */
  async getPlantDetail(
    userId: string,
    cropCode: string,
    mutationCode?: string,
  ): Promise<PlantDetailResponseDto> {
    const farm = await this.getOrCreateUserFarm(userId);
    if (!farm) {
      throw new NotFoundException('Nông trại không tồn tại');
    }

    const cleanCropCode = cropCode ? cropCode.trim().toUpperCase() : '';
    let cleanMutationCode = mutationCode ? mutationCode.trim().toUpperCase() : undefined;

    let crop = cleanCropCode
      ? await this.prisma.farmCrop.findUnique({
          where: { code: cleanCropCode },
          include: { mutations: true },
        })
      : null;

    // Nếu không tìm thấy cây bằng cropCode, kiểm tra xem cropCode có phải là mã biến thể không
    if (!crop && cleanCropCode) {
      const mutByCropCode = await this.prisma.farmCropMutation.findUnique({
        where: { code: cleanCropCode },
        include: { sourceCrop: { include: { mutations: true } } },
      });
      if (mutByCropCode) {
        crop = mutByCropCode.sourceCrop;
        cleanMutationCode = mutByCropCode.code;
      }
    }

    // Nếu có mutationCode mà chưa có crop
    if (!crop && cleanMutationCode) {
      const mut = await this.prisma.farmCropMutation.findUnique({
        where: { code: cleanMutationCode },
        include: { sourceCrop: { include: { mutations: true } } },
      });
      if (mut) {
        crop = mut.sourceCrop;
      }
    }

    if (!crop) {
      throw new NotFoundException(`Không tìm thấy thông tin cây trồng cho mã: ${cleanCropCode || cleanMutationCode}`);
    }

    // Trường hợp 1: Xem chi tiết biến thể đột biến
    if (cleanMutationCode) {
      const mutation = crop.mutations.find((m) => m.code === cleanMutationCode);
      if (!mutation) {
        throw new NotFoundException(
          `Không tìm thấy biến thể đột biến có mã: ${cleanMutationCode} thuộc cây ${crop.name}`,
        );
      }

      // Đã thu hoạch của biến thể này: farmId, cropId, mutationId = mutation.id
      const collection = await this.prisma.farmCollection.findFirst({
        where: {
          farmId: farm.id,
          cropId: crop.id,
          mutationId: mutation.id,
        },
      });

      // Trong kho của biến thể này: itemType = MUTATION_CROP, referenceId = mutation.code
      const invItem = await this.prisma.farmInventoryItem.findFirst({
        where: {
          farmId: farm.id,
          itemType: FarmItemType.MUTATION_CROP,
          referenceId: mutation.code,
        },
      });

      const isUnlocked = Boolean(
        collection?.isUnlocked || (collection?.harvestCount && collection.harvestCount > 0),
      );
      const effectiveSellPrice = this.inventoryService.calculateEffectiveSellPrice(null, mutation);
      const harvestCount = collection?.harvestCount ?? 0;
      const inventoryQuantity = invItem?.quantity ?? 0;
      const growDurationSeconds = crop.growDuration;
      const growDurationLabel = formatGrowDuration(growDurationSeconds);

      return {
        cropId: crop.id,
        cropCode: crop.code,
        cropName: crop.name,
        mutationId: mutation.id,
        mutationCode: isUnlocked ? mutation.code : undefined,
        mutationName: isUnlocked ? mutation.name : '??? Biến Thể Bí Ẩn',
        isMutation: true,
        rarity: mutation.rarity,
        description: isUnlocked
          ? mutation.description || 'Biến thể đột biến quý hiếm với giá trị kinh tế vượt trội.'
          : `Biến thể bí ẩn của ${crop.name}. Có cơ hội xuất hiện ngẫu nhiên khi gieo trồng và chăm sóc.`,
        imageUrl: isUnlocked ? mutation.spriteKey : null,
        growDurationSeconds,
        growDurationLabel,
        effectiveSellPrice,
        harvestCount,
        inventoryQuantity,
        isUnlocked,
        mutationChance: mutation.mutationChance,
        unlockLevel: crop.minFarmLevel,
      };
    }

    // Trường hợp 2: Xem chi tiết cây gốc thường: farmId, cropId, mutationId = null
    const collection = await this.prisma.farmCollection.findFirst({
      where: {
        farmId: farm.id,
        cropId: crop.id,
        mutationId: null,
      },
    });

    const invItem = await this.prisma.farmInventoryItem.findFirst({
      where: {
        farmId: farm.id,
        itemType: FarmItemType.CROP,
        referenceId: crop.code,
      },
    });

    const isUnlocked = Boolean(
      collection?.isUnlocked ||
        (collection?.harvestCount && collection.harvestCount > 0) ||
        farm.level >= crop.minFarmLevel,
    );
    const effectiveSellPrice = this.inventoryService.calculateEffectiveSellPrice(crop, null);
    const harvestCount = collection?.harvestCount ?? 0;
    const inventoryQuantity = invItem?.quantity ?? 0;
    const growDurationSeconds = crop.growDuration;
    const growDurationLabel = formatGrowDuration(growDurationSeconds);

    return {
      cropId: crop.id,
      cropCode: crop.code,
      cropName: crop.name,
      mutationId: null,
      mutationCode: null,
      mutationName: null,
      isMutation: false,
      rarity: crop.rarity,
      description: crop.description || 'Giống cây trồng truyền thống của nông trại AVORA.',
      imageUrl: crop.iconUrl,
      growDurationSeconds,
      growDurationLabel,
      effectiveSellPrice,
      harvestCount,
      inventoryQuantity,
      isUnlocked,
      mutationChance: null,
      unlockLevel: crop.minFarmLevel,
    };
  }

  /**
   * Nhận phần thưởng Mốc Tiến Độ Bộ Sưu Tập (5 Tiers)
   */
  async claimCollectionMilestone(userId: string, tier: number) {
    if (![1, 2, 3, 4, 5].includes(tier)) {
      throw new BadRequestException('Mốc tiến độ không hợp lệ');
    }

    const farm = await this.getOrCreateUserFarm(userId);
    if (!farm) throw new NotFoundException('Nông trại không tồn tại');

    const album = await this.getCollectionAlbum(userId);
    const milestone = album.milestones.find((m) => m.tier === tier);
    if (!milestone) throw new BadRequestException('Không tìm thấy mốc tiến độ');

    if (!milestone.isReached) {
      throw new BadRequestException(`Bạn chưa đạt mốc tiến độ ${milestone.targetPercent}%!`);
    }

    if (milestone.isClaimed) {
      throw new BadRequestException('Bạn đã nhận phần thưởng mốc tiến độ này rồi');
    }

    return this.prisma.$transaction(async (tx) => {
      let coinsToAdd = 0;
      let loyaltyToAdd = 0;
      let voucherCodeIssued = '';
      let rewardText = '';

      if (tier === 1) {
        coinsToAdd = 150;
        rewardText = '150 Xu Nông Trại + 3 Hạt giống Bí Ẩn Phổ Thông';
        const commonCrops = await tx.farmCrop.findMany({ where: { rarity: 'COMMON' } });
        if (commonCrops.length > 0) {
          const randomCrop = commonCrops[Math.floor(Math.random() * commonCrops.length)];
          await this.inventoryService.addItem(tx, farm.id, {
            itemType: FarmItemType.SEED,
            referenceId: randomCrop.id,
            itemName: `Hạt giống ${randomCrop.name}`,
            itemCode: randomCrop.code,
            quantity: 3,
            rarity: randomCrop.rarity,
          });
        }
      } else if (tier === 2) {
        coinsToAdd = 350;
        loyaltyToAdd = 20;
        rewardText = '350 Xu + 1 Bình Phân Bón Siêu Cấp + 20 Điểm Thành Viên';
        await this.inventoryService.addItem(tx, farm.id, {
          itemType: FarmItemType.FERTILIZER,
          referenceId: 'SPEED_FERT_SUPER',
          itemName: 'Phân bón Thần Tốc Siêu Cấp',
          itemCode: 'SPEED_FERTILIZER',
          quantity: 1,
          rarity: FarmRarity.UNCOMMON,
        });
      } else if (tier === 3) {
        coinsToAdd = 700;
        loyaltyToAdd = 50;
        rewardText = '700 Xu + 3 Hạt giống Quý Hiếm + 50 Điểm Thành Viên';
        const rareCrops = await tx.farmCrop.findMany({ where: { rarity: { in: ['UNCOMMON', 'RARE'] } } });
        if (rareCrops.length > 0) {
          const randomCrop = rareCrops[Math.floor(Math.random() * rareCrops.length)];
          await this.inventoryService.addItem(tx, farm.id, {
            itemType: FarmItemType.SEED,
            referenceId: randomCrop.id,
            itemName: `Hạt giống ${randomCrop.name}`,
            itemCode: randomCrop.code,
            quantity: 3,
            rarity: randomCrop.rarity,
          });
        }
      } else if (tier === 4) {
        coinsToAdd = 1200;
        loyaltyToAdd = 100;
        rewardText = '1.200 Xu + 2 Túi Phân Thần Tốc + 100 Điểm Thành Viên';
        await this.inventoryService.addItem(tx, farm.id, {
          itemType: FarmItemType.FERTILIZER,
          referenceId: 'SPEED_FERT_SUPER',
          itemName: 'Phân bón Thần Tốc Siêu Cấp',
          itemCode: 'SPEED_FERTILIZER',
          quantity: 2,
          rarity: FarmRarity.RARE,
        });
      } else if (tier === 5) {
        const currentCount = await tx.voucher.count({
          where: { code: { startsWith: 'FARM_ROYAL_500K_' } },
        });
        if (currentCount >= 11) {
          throw new BadRequestException('Rất tiếc! Toàn bộ 11 Voucher 500K giới hạn của mùa giải đã được trao hết.');
        }

        coinsToAdd = 1500;
        loyaltyToAdd = 200;
        const shortCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        voucherCodeIssued = `FARM_ROYAL_500K_${shortCode}`;
        const now = new Date();
        const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        const newVoucher = await tx.voucher.create({
          data: {
            code: voucherCodeIssued,
            title: 'VOUCHER HOÀNG GIA 500.000đ (BỘ SƯU TẬP HOÀN HẢO)',
            description: 'Voucher độc bản tri ân 500.000đ từ Nông Trại AVORA Farm. Áp dụng cho mọi hóa đơn từ 0đ (Số lượng giới hạn 11 voucher toàn hệ thống)!',
            discountType: 'FIXED_AMOUNT',
            discountValue: 500000,
            minOrderValue: 0,
            startDate: now,
            endDate,
            isActive: true,
            applicableScope: 'ALL',
            usageLimit: 1,
            usageLimitPerUser: 1,
          },
        });

        await tx.customerVoucher.create({
          data: {
            userId,
            voucherId: newVoucher.id,
            isUsed: false,
            savedAt: now,
          },
        });

        rewardText = `Voucher Hoàng Gia 500.000đ (Đơn từ 0đ - Mã: ${voucherCodeIssued}) + 1.500 Xu + 200 Điểm Thành Viên`;
      }

      if (coinsToAdd > 0) {
        await tx.userFarm.update({
          where: { id: farm.id },
          data: { farmCoin: { increment: coinsToAdd } },
        });
      }

      if (loyaltyToAdd > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { points: { increment: loyaltyToAdd } },
        });
      }

      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'COLLECTION_MILESTONE_CLAIM',
          details: {
            tier,
            voucherCode: voucherCodeIssued || undefined,
            rewardText,
            claimedAt: new Date(),
          },
        },
      });

      return {
        tier,
        rewardText,
        voucherCode: voucherCodeIssued || undefined,
        coinsEarned: coinsToAdd,
        loyaltyEarned: loyaltyToAdd,
      };
    });
  }

  /**
   * Nhận quà Hoàn thành 1 Loại Cây (Tất cả biến thể thuần chủng + đột biến)
   */
  async claimCropMasteryReward(userId: string, cropId: string) {
    const farm = await this.getOrCreateUserFarm(userId);
    if (!farm) throw new NotFoundException('Nông trại không tồn tại');

    const crop = await this.prisma.farmCrop.findUnique({
      where: { id: cropId },
      include: { mutations: true },
    });
    if (!crop) throw new NotFoundException('Không tìm thấy loại cây trồng');

    const unlockedList = await this.prisma.farmCollection.findMany({
      where: { farmId: farm.id, cropId },
    });
    const unlockedIds = new Set(unlockedList.map((e) => e.mutationId || 'BASE'));

    if (!unlockedIds.has('BASE')) {
      throw new BadRequestException('Bạn chưa mở khóa dạng thuần chủng của nông sản này');
    }
    for (const m of crop.mutations) {
      if (!unlockedIds.has(m.id)) {
        throw new BadRequestException(`Bạn chưa mở khóa đột biến "${m.name}" của cây này`);
      }
    }

    const existingLogs = await this.prisma.farmActivityLog.findMany({
      where: {
        userId,
        farmId: farm.id,
        action: 'CROP_MASTERY_CLAIM',
      },
    });
    const alreadyClaimed = existingLogs.some((l) => (l.details as any)?.cropId === cropId);
    if (alreadyClaimed) {
      throw new BadRequestException('Bạn đã nhận phần thưởng hoàn thành loại cây này rồi');
    }

    return this.prisma.$transaction(async (tx) => {
      let seedQty = 3;
      let coinBonus = 100;
      let seedPoolRarity: any[] = ['COMMON'];
      let packName = 'Gói Hạt Giống Thần Nông Phổ Thông';

      if (crop.rarity === 'UNCOMMON') {
        seedQty = 4;
        coinBonus = 200;
        seedPoolRarity = ['UNCOMMON', 'RARE'];
        packName = 'Gói Hạt Giống Quý Báu';
      } else if (crop.rarity === 'RARE') {
        seedQty = 4;
        coinBonus = 350;
        seedPoolRarity = ['RARE', 'EPIC'];
        packName = 'Gói Hạt Giống Thượng Hạng';
      } else if (['EPIC', 'LEGENDARY'].includes(crop.rarity as string)) {
        seedQty = 5;
        coinBonus = 600;
        seedPoolRarity = ['EPIC', 'LEGENDARY'];
        packName = 'Gói Hạt Giống Hoàng Gia Thần Thoại';
      }

      const candidates = await tx.farmCrop.findMany({
        where: { rarity: { in: seedPoolRarity } },
      });
      const selectedSeedCrop = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : crop;

      await this.inventoryService.addItem(tx, farm.id, {
        itemType: FarmItemType.SEED,
        referenceId: selectedSeedCrop.id,
        itemName: `Hạt giống ${selectedSeedCrop.name}`,
        itemCode: selectedSeedCrop.code,
        quantity: seedQty,
        rarity: selectedSeedCrop.rarity,
      });

      await tx.userFarm.update({
        where: { id: farm.id },
        data: { farmCoin: { increment: coinBonus } },
      });

      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'CROP_MASTERY_CLAIM',
          details: {
            cropId,
            cropCode: crop.code,
            cropName: crop.name,
            packName,
            rewardSeed: selectedSeedCrop.name,
            seedQty,
            coinBonus,
            claimedAt: new Date(),
          },
        },
      });

      return {
        cropName: crop.name,
        packName,
        rewardSeedName: selectedSeedCrop.name,
        seedQuantity: seedQty,
        coinsEarned: coinBonus,
      };
    });
  }

  /**
   * Khởi tạo Nông trại mới tinh với 6 ô đất mở sẵn và tặng hạt giống tân thủ
   */
  private async initializeNewUserFarm(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo UserFarm
      const newFarm = await tx.userFarm.create({
        data: {
          userId,
          level: 1,
          exp: 0,
          totalExp: 0,
          farmCoin: 100, // Tặng 100 Farm Coin khởi nghiệp
          energy: 100,
          maxEnergy: 100,
          treeLevel: 1,
          treeExp: 0,
          unlockedPlotsCount: 6,
        },
      });

      // 2. Tạo 25 ô đất (Lưới 5x5: Row 0..4, Col 0..4)
      const plotsData: any[] = [];
      for (let i = 0; i < 25; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const isInitialUnlocked = i < 6; // 6 ô đầu mở sẵn

        plotsData.push({
          farmId: newFarm.id,
          plotIndex: i,
          gridRow: row,
          gridCol: col,
          status: isInitialUnlocked ? FarmPlotStatus.EMPTY : FarmPlotStatus.LOCKED,
          soilQuality: 1.0,
          waterLevel: 80,
          unlockCost: isInitialUnlocked ? 0 : 50 + i * 20,
          unlockLevel: isInitialUnlocked ? 1 : Math.min(20, Math.floor(i / 2) + 1),
        });
      }

      await tx.farmPlot.createMany({ data: plotsData });

      // 3. Tặng hạt giống khởi nghiệp vào kho: 5x Gạo Koshihikari và 3x Dâu tây Tochigi
      const defaultCrops = await tx.farmCrop.findMany({
        where: { code: { in: ['JAPANESE_RICE', 'STRAWBERRY'] } },
      });

      for (const c of defaultCrops) {
        const qty = c.code === 'JAPANESE_RICE' ? 5 : 3;
        await tx.farmInventoryItem.create({
          data: {
            farmId: newFarm.id,
            itemType: FarmItemType.SEED,
            referenceId: c.id,
            itemName: `Hạt giống ${c.name}`,
            itemCode: c.code,
            quantity: qty,
            rarity: c.rarity,
          },
        });
      }

      return tx.userFarm.findUniqueOrThrow({
        where: { id: newFarm.id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              memberCode: true,
              points: true,
              currentPoints: true,
              membershipTier: true,
            },
          },
          plots: {
            include: {
              cropInstance: {
                include: { crop: true, mutation: true },
              },
            },
            orderBy: { plotIndex: 'asc' },
          },
        },
      });
    });
  }

  /**
   * Hồi phục năng lượng theo hiệu số thời gian
   */
  private async recoverEnergy(farm: any) {
    if (farm.energy >= farm.maxEnergy) return farm;

    const now = new Date().getTime();
    const lastRecovery = new Date(farm.lastEnergyRecoveryAt).getTime();
    const elapsedSeconds = Math.floor((now - lastRecovery) / 1000);

    // 1 energy mỗi 180 giây (3 phút)
    const energyToAdd = Math.floor(elapsedSeconds / 180);
    if (energyToAdd <= 0) return farm;

    const newEnergy = Math.min(farm.maxEnergy, farm.energy + energyToAdd);
    const updated = await this.prisma.userFarm.update({
      where: { id: farm.id },
      data: {
        energy: newEnergy,
        lastEnergyRecoveryAt: new Date(lastRecovery + energyToAdd * 180 * 1000),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            memberCode: true,
            points: true,
            currentPoints: true,
            membershipTier: true,
          },
        },
        plots: {
          include: {
            cropInstance: {
              include: { crop: true, mutation: true },
            },
          },
          orderBy: { plotIndex: 'asc' },
        },
      },
    });

    return updated;
  }

  /**
   * Kiểm tra trạng thái bảo trì của Farm
   */
  async getMaintenanceStatus() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'farm_maintenance' },
    });
    if (!setting) {
      return { isMaintenance: false };
    }
    try {
      const parsed = JSON.parse(setting.value);
      return {
        isMaintenance: !!parsed.enabled,
        message: parsed.message || 'Hệ thống nông trại AVORA Farm đang bảo trì định kỳ. Quý khách vui lòng quay lại sau!',
        estimatedEndTime: parsed.estimatedEndTime || null,
      };
    } catch {
      return { isMaintenance: false };
    }
  }

  /**
   * Nâng cấp cấp độ nông trại thủ công (Manual Level Up)
   * Yêu cầu: Đủ EXP + Farm Coin + Nông sản yêu cầu theo cấp
   */
  async manualLevelUp(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({
        where: { userId },
        include: { user: true },
      });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const req = getLevelUpgradeRequirements(farm.level);

      // 1. Kiểm tra EXP
      if (farm.exp < req.expRequired) {
        throw new BadRequestException(
          `Bạn chưa đủ điểm kinh nghiệm để nâng cấp! (Hiện có: ${farm.exp}/${req.expRequired} EXP)`,
        );
      }

      // 2. Kiểm tra Farm Coin
      if (farm.farmCoin < req.coinCost) {
        throw new BadRequestException(
          `Bạn không đủ Xu Nông Trại để nâng cấp! (Cần: ${req.coinCost} Xu, bạn có: ${farm.farmCoin} Xu)`,
        );
      }

      // 3. Kiểm tra Nông sản yêu cầu trong kho
      const targetCrop = await tx.farmCrop.findUnique({
        where: { code: req.requiredCropCode },
      });

      if (targetCrop && req.requiredCropQty > 0) {
        const invItem = await tx.farmInventoryItem.findUnique({
          where: {
            farmId_itemType_referenceId: {
              farmId: farm.id,
              itemType: FarmItemType.CROP,
              referenceId: targetCrop.id,
            },
          },
        });

        const currentQty = invItem?.quantity || 0;
        if (currentQty < req.requiredCropQty) {
          throw new BadRequestException(
            `Bạn chưa đủ nông sản ${req.requiredCropName} để nâng cấp! (Cần: ${req.requiredCropQty}, bạn có: ${currentQty})`,
          );
        }

        // Tiêu thụ nông sản từ kho
        await this.inventoryService.consumeItem(
          tx,
          farm.id,
          FarmItemType.CROP,
          targetCrop.id,
          req.requiredCropQty,
        );
      }

      // 4. Thăng cấp & trừ xu
      const newLevel = farm.level + 1;
      const leftoverExp = farm.exp - req.expRequired;
      const nextReq = getLevelUpgradeRequirements(newLevel);
      const isStillPending = leftoverExp >= nextReq.expRequired;

      // Mở khóa thêm ô đất khi đạt mốc nhất định (mỗi 2 cấp mở thêm 1 ô nếu chưa full 24)
      let unlockedPlots = farm.unlockedPlotsCount;
      if (newLevel % 2 === 0 && unlockedPlots < 24) {
        unlockedPlots = Math.min(24, unlockedPlots + 1);
        // Cập nhật ô đất tiếp theo sang UNLOCKED nếu có
        const nextPlot = await tx.farmPlot.findFirst({
          where: { farmId: farm.id, status: FarmPlotStatus.LOCKED },
          orderBy: { plotIndex: 'asc' },
        });
        if (nextPlot) {
          await tx.farmPlot.update({
            where: { id: nextPlot.id },
            data: { status: FarmPlotStatus.EMPTY },
          });
        }
      }

      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          level: newLevel,
          exp: leftoverExp,
          unlockedPlotsCount: unlockedPlots,
          farmCoin: { decrement: req.coinCost },
          pendingLevelUp: isStillPending,
        },
      });

      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'LEVEL_UP',
          details: {
            fromLevel: farm.level,
            toLevel: newLevel,
            coinCost: req.coinCost,
            cropCode: req.requiredCropCode,
            cropQty: req.requiredCropQty,
          },
        },
      });

      this.farmGateway.emitFarmLeveledUp(userId, {
        newLevel,
        unlockedPlotsCount: updatedFarm.unlockedPlotsCount,
        farmCoinBonus: 0,
      });

      return {
        success: true,
        newLevel,
        farm: {
          level: updatedFarm.level,
          exp: updatedFarm.exp,
          totalExp: updatedFarm.totalExp,
          farmCoin: updatedFarm.farmCoin,
          energy: updatedFarm.energy,
          unlockedPlotsCount: updatedFarm.unlockedPlotsCount,
          pendingLevelUp: updatedFarm.pendingLevelUp,
        },
        perks: req.perks,
      };
    });
  }

  /**
   * Hoàn thành hướng dẫn tân thủ (Interactive Onboarding Tutorial)
   */
  async completeTutorial(userId: string) {
    const farm = await this.prisma.userFarm.findUnique({ where: { userId } });
    if (!farm) throw new NotFoundException('Nông trại không tồn tại');

    if ((farm as any).hasCompletedTutorial) {
      return { success: true, alreadyCompleted: true };
    }

    return this.prisma.$transaction(async (tx) => {
      // Tặng gói quà khởi đầu
      const riceCrop = await tx.farmCrop.findUnique({ where: { code: 'JAPANESE_RICE' } });
      if (riceCrop) {
        await this.inventoryService.addItem(tx, farm.id, {
          itemType: FarmItemType.SEED,
          referenceId: riceCrop.id,
          itemName: `Hạt giống ${riceCrop.name}`,
          itemCode: riceCrop.code,
          quantity: 5,
        });
      }

      await this.inventoryService.addItem(tx, farm.id, {
        itemType: FarmItemType.FERTILIZER,
        referenceId: 'FERTILIZER_SPEED',
        itemName: 'Phân Bón Sinh Học Siêu Tốc',
        itemCode: 'FERTILIZER_SPEED',
        quantity: 2,
      });

      await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          hasCompletedTutorial: true,
          farmCoin: { increment: 50 },
        },
      });

      return {
        success: true,
        rewardText: '🎁 Quà tân thủ: 50 Xu + 5 Hạt Gạo Koshihikari + 2 Phân Bón Siêu Tốc!',
      };
    });
  }
}
