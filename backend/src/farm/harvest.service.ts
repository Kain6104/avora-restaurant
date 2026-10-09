import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { MutationEngine } from './mutation.engine';
import { FarmGateway } from './farm.gateway';
import { FarmItemType, FarmPlotStatus } from '@prisma/client';
import { calculateExpProgression } from './farm-progression.util';

@Injectable()
export class HarvestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly mutationEngine: MutationEngine,
    private readonly farmGateway: FarmGateway,
  ) {}

  /**
   * Thu hoạch nông sản với Transaction an toàn và chống Race Condition
   */
  async harvestPlot(userId: string, plotIndex: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lấy thông tin nông trại của người chơi
      const farm = await tx.userFarm.findUnique({
        where: { userId },
      });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      // 2. Lấy ô đất cần thu hoạch kèm CropInstance
      const plot = await tx.farmPlot.findFirst({
        where: { farmId: farm.id, plotIndex },
        include: {
          cropInstance: {
            include: {
              crop: { include: { mutations: true } },
              mutation: true,
            },
          },
        },
      });

      if (!plot) throw new NotFoundException(`Không tìm thấy ô đất số ${plotIndex}`);
      if (plot.status === FarmPlotStatus.LOCKED) {
        throw new BadRequestException('Ô đất này đang bị khóa, không thể thu hoạch');
      }
      if (!plot.cropInstance || !plot.cropInstanceId) {
        throw new BadRequestException('Không có cây trồng nào trên ô đất này để thu hoạch');
      }

      const instance = plot.cropInstance;

      // 3. Chống Race condition & Double Harvest: Kiểm tra sơ bộ
      if (instance.harvestedAt !== null) {
        throw new ConflictException('Cây trồng này đã được thu hoạch trước đó (ALREADY_HARVESTED)');
      }

      // 4. Kiểm tra độ chín (Ready State)
      const now = new Date();
      const readyAt = new Date(instance.readyAt);
      if (now.getTime() < readyAt.getTime()) {
        const secondsLeft = Math.ceil((readyAt.getTime() - now.getTime()) / 1000);
        throw new BadRequestException(`Cây chưa chín! Vui lòng đợi thêm ${secondsLeft} giây nữa`);
      }

      // 5. ATOMIC CONDITIONAL CLAIM LOCK:
      // Thực hiện conditional update độc quyền: Chỉ 1 transaction duy nhất được claim khi harvestedAt IS NULL
      // Nếu 2 request đồng thời vào cùng mili-giây, transaction thứ 2 sẽ có count === 0 và bị ngắt lập tức!
      const claimResult = await tx.farmCropInstance.updateMany({
        where: {
          id: instance.id,
          harvestedAt: null,
        },
        data: {
          harvestedAt: now,
        },
      });

      if (claimResult.count === 0) {
        throw new ConflictException('Cây trồng này đã được thu hoạch trước đó (ALREADY_HARVESTED)');
      }

      // 6. Tính toán Đột biến sinh học (Ưu tiên trạng thái đột biến đã phát triển trong quá trình trồng)
      let isMutated = instance.isMutated;
      let mutation = instance.mutation;

      if (!isMutated) {
        const mutationResult = this.mutationEngine.resolveMutation({
          baseMutationRate: instance.mutationRateSnapshot,
          fertilizerBonus: plot.fertilizerBonus || 0,
          soilQuality: plot.soilQuality,
          activeWeather: farm.activeWeather,
          cropCategory: instance.crop.category,
          mutations: instance.crop.mutations,
        });
        isMutated = mutationResult.isMutated;
        mutation = mutationResult.selectedMutation;
      }

      // 7. Tính toán Sản lượng Thu hoạch (Yield Math)
      let yieldMultiplier = 1.0;
      if (isMutated && mutation) {
        yieldMultiplier = mutation.yieldMultiplier;
      }
      const waterBonus = instance.wateredCount > 0 ? 1 : 0;
      const fertilizerBonus = plot.fertilizerBonus > 0 ? 1 : 0;
      const calculatedYield = Math.max(
        1,
        Math.round(instance.baseYieldSnapshot * yieldMultiplier + waterBonus + fertilizerBonus) - instance.gatheredCount,
      );

      // 8. Cập nhật thông số sản lượng và đột biến vào CropInstance đã được claim độc quyền
      await tx.farmCropInstance.update({
        where: { id: instance.id },
        data: {
          calculatedYield,
          isMutated,
          mutationId: mutation?.id ?? null,
        },
      });

      // 8. Tính thưởng EXP & Farm Coin & Level Curve
      const expReward = isMutated && mutation ? mutation.rewardExp : instance.rewardExpSnapshot;
      const coinReward = isMutated && mutation ? mutation.rewardFarmCoin : instance.rewardFarmCoinSnapshot;
      const loyaltyPointReward = isMutated && mutation ? mutation.rewardLoyaltyPoints : (instance.crop.rewardLoyaltyPoints || 0);

      // Cập nhật Cấp độ Nông trại với overflow EXP chuẩn xác
      const expProg = calculateExpProgression(farm.level, farm.exp, farm.totalExp, expReward);

      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          level: expProg.levelAfter,
          exp: expProg.expAfter,
          totalExp: expProg.newTotalExp,
          farmCoin: { increment: coinReward },
        },
      });

      // 9. Thêm Nông sản vào Kho đồ (Inventory)
      const itemType = isMutated ? FarmItemType.MUTATION_CROP : FarmItemType.CROP;
      const itemCode = isMutated && mutation ? mutation.code : instance.crop.code;
      const itemName = isMutated && mutation ? mutation.name : instance.cropNameSnapshot;
      const itemRarity = isMutated && mutation ? mutation.rarity : instance.crop.rarity;

      await this.inventoryService.addItem(tx, farm.id, {
        itemType,
        referenceId: itemCode,
        itemName,
        itemCode,
        quantity: calculatedYield,
        rarity: itemRarity,
      });

      // 9. Nếu có thưởng Điểm Loyalty thật (cho đột biến hiếm/legendary)
      if (loyaltyPointReward > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            points: { increment: loyaltyPointReward },
            currentPoints: { increment: loyaltyPointReward },
          },
        });
      }

      // 10. Cập nhật Bộ Sưu Tập (Pokédex Album)
      const existingCollection = await tx.farmCollection.findFirst({
        where: {
          farmId: farm.id,
          cropId: instance.cropId,
          mutationId: mutation?.id ?? null,
        },
      });

      let isNewDiscovery = false;
      if (!existingCollection) {
        isNewDiscovery = true;
        await tx.farmCollection.create({
          data: {
            farmId: farm.id,
            cropId: instance.cropId,
            mutationId: mutation?.id || null,
            isUnlocked: true,
            harvestCount: 1,
            highestYield: calculatedYield,
          },
        });
      } else {
        await tx.farmCollection.update({
          where: { id: existingCollection.id },
          data: {
            harvestCount: { increment: 1 },
            highestYield: Math.max(existingCollection.highestYield, calculatedYield),
          },
        });
      }

      // 11. Reset ô đất về trạng thái EMPTY
      const resetPlot = await tx.farmPlot.update({
        where: { id: plot.id },
        data: {
          status: FarmPlotStatus.EMPTY,
          cropInstanceId: null,
          fertilizerItemId: null,
          fertilizerBonus: 0,
          waterLevel: 50,
        },
      });

      // 12. Ghi Audit Activity Log
      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'HARVEST',
          plotIndex,
          details: {
            cropCode: instance.crop.code,
            isMutated,
            mutationCode: mutation?.code,
            yield: calculatedYield,
            expReward,
            coinReward,
            loyaltyPointReward,
          },
        },
      });

      // 13. Phát Socket Realtime
      this.farmGateway.emitPlotUpdated(userId, { plotIndex, plot: resetPlot });
      if (isMutated && mutation) {
        this.farmGateway.emitMutationDiscovered(userId, {
          cropName: instance.cropNameSnapshot,
          mutation,
          yield: calculatedYield,
        });
      }
      if (expProg.leveledUp) {
        this.farmGateway.emitFarmLeveledUp(userId, {
          newLevel: expProg.levelAfter,
          totalExp: expProg.newTotalExp,
        });
      }

      return {
        success: true,
        cropName: instance.cropNameSnapshot,
        isMutated,
        mutation,
        yield: calculatedYield,
        expReward,
        coinReward,
        loyaltyPointReward,
        isNewDiscovery,
        expBefore: expProg.expBefore,
        expGained: expProg.expGained,
        expAfter: expProg.expAfter,
        levelBefore: expProg.levelBefore,
        levelAfter: expProg.levelAfter,
        leveledUp: expProg.leveledUp,
        newLevel: expProg.levelAfter,
        plot: resetPlot,
        farm: {
          level: updatedFarm.level,
          exp: updatedFarm.exp,
          totalExp: updatedFarm.totalExp,
          farmCoin: updatedFarm.farmCoin,
          energy: updatedFarm.energy,
        },
      };
    });
  }

  /**
   * Thu hoạch tất cả các ô đất đã chín (Yêu cầu nông trại Level >= 5)
   */
  async harvestAll(userId: string) {
    const farm = await this.prisma.userFarm.findUnique({
      where: { userId },
      include: {
        plots: {
          include: { cropInstance: true },
        },
      },
    });

    if (!farm) throw new NotFoundException('Nông trại không tồn tại');
    if (farm.level < 5) {
      throw new BadRequestException('Tính năng "Thu hoạch tất cả" mở khóa tại cấp độ Lv.5');
    }

    const now = new Date().getTime();
    const readyPlots = farm.plots.filter(
      (p) =>
        p.cropInstance &&
        p.cropInstance.harvestedAt === null &&
        now >= new Date(p.cropInstance.readyAt).getTime(),
    );

    if (readyPlots.length === 0) {
      return { success: true, count: 0, message: 'Không có ô đất nào đã chín để thu hoạch' };
    }

    const results: any[] = [];
    for (const plot of readyPlots) {
      try {
        const res = await this.harvestPlot(userId, plot.plotIndex);
        results.push(res);
      } catch (e) {
        // Skip individual conflict if concurrent
      }
    }

    return {
      success: true,
      harvestedCount: results.length,
      results,
    };
  }
}
