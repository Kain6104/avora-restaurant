import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { CropService } from './crop.service';
import { FarmGateway } from './farm.gateway';
import { FarmItemType, FarmPlotStatus } from '@prisma/client';
import { calculateExpProgression } from './farm-progression.util';
import { MutationEngine } from './mutation.engine';

@Injectable()
export class PlotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly cropService: CropService,
    private readonly farmGateway: FarmGateway,
    private readonly mutationEngine: MutationEngine,
  ) {}

  /**
   * Mở khóa ô đất mới bằng Farm Coin & Yêu cầu cấp độ
   */
  async unlockPlot(userId: string, plotIndex: number) {
    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({
        where: { userId },
        include: { plots: true },
      });
      if (!farm) throw new NotFoundException('Nông trại chưa được khởi tạo');

      const plot = farm.plots.find((p) => p.plotIndex === plotIndex);
      if (!plot) throw new NotFoundException(`Không tìm thấy ô đất số ${plotIndex}`);
      if (plot.status !== FarmPlotStatus.LOCKED) {
        throw new BadRequestException('Ô đất này đã được mở khóa trước đó');
      }

      // 1. Kiểm tra cấu hình mở khóa nâng cao từ Garden Layout (nếu có)
      const activeLayoutObj = await tx.farmGardenObject.findFirst({
        where: {
          plotIndex,
          objectType: 'PLOT',
          layoutVersion: { status: 'PUBLISHED' },
        },
        orderBy: { layoutVersion: { publishedAt: 'desc' } },
      });

      const unlockConditions = (activeLayoutObj?.styleConfig as any)?.unlockConditions;
      const requiredLevel = unlockConditions?.requiredLevel ?? Math.floor(plotIndex / 3) + 1;
      const requiredCoins = unlockConditions?.requiredCoins ?? Math.max(50, farm.unlockedPlotsCount * 30);
      const requiredPoints = unlockConditions?.requiredPoints ?? 0;
      const requiredCrops: Array<{ cropCode: string; quantity: number }> = unlockConditions?.requiredCrops ?? [];

      // Kiểm tra Cấp độ nông trại
      if (farm.level < requiredLevel) {
        throw new BadRequestException(
          `Bạn cần đạt Cấp độ ${requiredLevel} để mở khóa ô đất này (Cấp hiện tại: ${farm.level})`,
        );
      }

      // Kiểm tra Xu Nông Trại
      if (farm.farmCoin < requiredCoins) {
        throw new BadRequestException(
          `Bạn cần ${requiredCoins} Xu Nông Trại để mở khóa ô đất này (Hiện có: ${farm.farmCoin})`,
        );
      }

      // Kiểm tra Điểm AVORA (Loyalty Points)
      let userPoints = 0;
      if (requiredPoints > 0) {
        const userRec = await tx.user.findUnique({
          where: { id: userId },
          select: { points: true },
        });
        userPoints = userRec?.points ?? 0;
        if (userPoints < requiredPoints) {
          throw new BadRequestException(
            `Bạn cần ${requiredPoints} Điểm AVORA để mở khóa ô đất này (Hiện có: ${userPoints})`,
          );
        }
      }

      // Kiểm tra Nông sản yêu cầu trong kho
      for (const req of requiredCrops as any[]) {
        const cropCodeOrId = req.cropCode || req.cropId;
        if (!cropCodeOrId || !req.quantity) continue;
        const invItem = await tx.farmInventoryItem.findFirst({
          where: {
            farmId: farm.id,
            itemType: FarmItemType.CROP,
            OR: [
              { itemCode: cropCodeOrId },
              { referenceId: cropCodeOrId },
            ],
          },
        });
        const userQty = invItem?.quantity ?? 0;
        if (userQty < req.quantity) {
          const cropName = req.cropName || req.cropCode || 'nông sản';
          throw new BadRequestException(
            `Bạn cần ${req.quantity} ${cropName} để mở khóa ô đất này (Hiện có trong kho: ${userQty})`,
          );
        }
      }

      // Khấu trừ nông sản yêu cầu
      for (const req of requiredCrops as any[]) {
        const cropCodeOrId = req.cropCode || req.cropId;
        if (!cropCodeOrId || !req.quantity) continue;
        const invItem = await tx.farmInventoryItem.findFirst({
          where: {
            farmId: farm.id,
            itemType: FarmItemType.CROP,
            OR: [
              { itemCode: cropCodeOrId },
              { referenceId: cropCodeOrId },
            ],
          },
        });
        if (invItem) {
          await tx.farmInventoryItem.update({
            where: { id: invItem.id },
            data: {
              quantity: { decrement: req.quantity },
            },
          });
        }
      }

      // Khấu trừ Điểm AVORA nếu có
      if (requiredPoints > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            points: { decrement: requiredPoints },
          },
        });
      }

      const cost = requiredCoins;

      // Thưởng +30 EXP khi mở rộng bờ cõi
      const UNLOCK_EXP = 30;
      const expProg = calculateExpProgression(farm.level, farm.exp, farm.totalExp, UNLOCK_EXP);

      // Cập nhật farm và ô đất
      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          farmCoin: { decrement: cost },
          unlockedPlotsCount: { increment: 1 },
          level: expProg.levelAfter,
          exp: expProg.expAfter,
          totalExp: expProg.newTotalExp,
        },
      });

      const updatedPlot = await tx.farmPlot.update({
        where: { id: plot.id },
        data: {
          status: FarmPlotStatus.EMPTY,
          unlockCost: cost,
          unlockLevel: requiredLevel,
        },
      });

      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'UNLOCK_PLOT',
          plotIndex,
          details: { cost, expGained: UNLOCK_EXP },
        },
      });

      if (expProg.leveledUp) {
        this.farmGateway.emitFarmLeveledUp(userId, {
          newLevel: expProg.levelAfter,
          totalExp: expProg.newTotalExp,
        });
      }

      this.farmGateway.emitPlotUpdated(userId, { plotIndex, plot: updatedPlot });
      return {
        success: true,
        plot: updatedPlot,
        cost,
        expBefore: expProg.expBefore,
        expGained: expProg.expGained,
        expAfter: expProg.expAfter,
        levelBefore: expProg.levelBefore,
        levelAfter: expProg.levelAfter,
        leveledUp: expProg.leveledUp,
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
   * Gieo hạt giống vào ô đất trống
   */
  async plant(userId: string, plotIndex: number, cropCode: string) {
    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({
        where: { userId },
        include: { plots: { include: { cropInstance: true } } },
      });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const plot = farm.plots.find((p) => p.plotIndex === plotIndex);
      if (!plot) throw new NotFoundException('Không tìm thấy ô đất');
      if (plot.status === FarmPlotStatus.LOCKED) {
        throw new BadRequestException('Ô đất này đang bị khóa, hãy mở khóa trước');
      }
      if (plot.cropInstanceId || plot.status === FarmPlotStatus.GROWING || plot.status === FarmPlotStatus.PLANTED) {
        throw new BadRequestException('Ô đất này đang có cây trồng');
      }

      const crop = await tx.farmCrop.findUnique({
        where: { code: cropCode },
      });
      if (!crop || !crop.isAvailable) {
        throw new NotFoundException('Loại hạt giống không hợp lệ hoặc không có sẵn');
      }

      if (farm.level < crop.minFarmLevel) {
        throw new BadRequestException(`Yêu cầu cấp nông trại Lv.${crop.minFarmLevel} để trồng cây này`);
      }

      // Kiểm tra năng lượng (Tốn 3 energy mỗi lần gieo)
      const ENERGY_COST = 3;
      if (farm.energy < ENERGY_COST) {
        throw new BadRequestException(`Bạn không đủ năng lượng để gieo hạt (Cần ${ENERGY_COST}⚡, hiện có: ${farm.energy}⚡)`);
      }

      // Kiểm tra & Trừ 1 hạt giống trong kho
      await this.inventoryService.consumeItem(tx, farm.id, FarmItemType.SEED, crop.id, 1);

      // Tính toán các mốc thời gian timestamp math
      const now = new Date();
      const durationSeconds = crop.growDuration;
      const durationMs = durationSeconds * 1000;

      const stage1At = new Date(now.getTime() + durationMs * 0.2);
      const stage2At = new Date(now.getTime() + durationMs * 0.4);
      const stage3At = new Date(now.getTime() + durationMs * 0.65);
      const readyAt = new Date(now.getTime() + durationMs * 1.0);

      // Kiểm tra danh sách đột biến của cây trồng
      const cropWithMutations = await tx.farmCrop.findUnique({
        where: { id: crop.id },
        include: { mutations: true },
      });

      // Xác định Đột biến sinh học ngay từ khi gieo mầm
      const mutationResult = this.mutationEngine.resolveMutation({
        baseMutationRate: crop.baseMutationRate,
        fertilizerBonus: 0,
        soilQuality: plot.soilQuality,
        activeWeather: farm.activeWeather,
        cropCategory: crop.category,
        mutations: cropWithMutations?.mutations || [],
      });

      const isMutated = mutationResult.isMutated;
      const mutationId = mutationResult.selectedMutation?.id ?? null;

      // Tạo bản ghi CropInstance kèm snapshot dữ liệu an toàn & đột biến nếu có
      const cropInstance = await tx.farmCropInstance.create({
        data: {
          cropId: crop.id,
          mutationId,
          isMutated,
          plantedAt: now,
          stage1At,
          stage2At,
          stage3At,
          readyAt,
          cropNameSnapshot: crop.name,
          growDurationSnapshot: crop.growDuration,
          baseYieldSnapshot: crop.baseYield,
          mutationRateSnapshot: crop.baseMutationRate,
          rewardExpSnapshot: crop.rewardExp,
          rewardFarmCoinSnapshot: crop.rewardFarmCoin,
        },
      });

      // Cập nhật ô đất
      const updatedPlot = await tx.farmPlot.update({
        where: { id: plot.id },
        data: {
          status: FarmPlotStatus.PLANTED,
          cropInstanceId: cropInstance.id,
          waterLevel: 80,
          lastWateredAt: now,
          fertilizerItemId: null,
          fertilizerBonus: 0,
        },
        include: {
          cropInstance: {
            include: { crop: true, mutation: true },
          },
        },
      });

      // Trừ năng lượng & Thưởng +5 EXP khi gieo mầm
      const PLANT_EXP = 5;
      const expProg = calculateExpProgression(farm.level, farm.exp, farm.totalExp, PLANT_EXP);

      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          energy: { decrement: ENERGY_COST },
          level: expProg.levelAfter,
          exp: expProg.expAfter,
          totalExp: expProg.newTotalExp,
        },
      });

      // Ghi log
      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'PLANT',
          plotIndex,
          details: { cropCode, cropName: crop.name, expGained: PLANT_EXP },
        },
      });

      if (expProg.leveledUp) {
        this.farmGateway.emitFarmLeveledUp(userId, {
          newLevel: expProg.levelAfter,
          totalExp: expProg.newTotalExp,
        });
      }

      this.farmGateway.emitPlotUpdated(userId, { plotIndex, plot: updatedPlot });
      return {
        success: true,
        plot: updatedPlot,
        cropInstance,
        expBefore: expProg.expBefore,
        expGained: expProg.expGained,
        expAfter: expProg.expAfter,
        levelBefore: expProg.levelBefore,
        levelAfter: expProg.levelAfter,
        leveledUp: expProg.leveledUp,
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
   * Tưới nước cho cây trồng
   */
  async water(userId: string, plotIndex: number) {
    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({
        where: { userId },
        include: { plots: { include: { cropInstance: true } } },
      });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const plot = farm.plots.find((p) => p.plotIndex === plotIndex);
      if (!plot || !plot.cropInstance) {
        throw new BadRequestException('Không có cây nào trên ô đất này để tưới');
      }

      // Kiểm tra năng lượng (Tốn 1 energy)
      if (farm.energy < 1) {
        throw new BadRequestException('Bạn đã cạn năng lượng để tưới nước (Cần 1⚡)');
      }

      const now = new Date();
      // Cooldown tưới nước: Tối thiểu 1 phút giữa 2 lần tưới
      if (plot.lastWateredAt && now.getTime() - new Date(plot.lastWateredAt).getTime() < 60 * 1000) {
        throw new BadRequestException('Đất vẫn còn đủ độ ẩm, hãy quay lại sau ít phút');
      }

      const updatedPlot = await tx.farmPlot.update({
        where: { id: plot.id },
        data: {
          status: FarmPlotStatus.WATERED,
          waterLevel: 100,
          lastWateredAt: now,
        },
        include: {
          cropInstance: { include: { crop: true, mutation: true } },
        },
      });

      // Nâng cấp: Mỗi lần chăm sóc/tưới nước đều có cơ hội đột biến
      await this.checkAndApplyGrowthMutation(tx, updatedPlot, farm);

      await tx.farmCropInstance.update({
        where: { id: plot.cropInstance.id },
        data: { wateredCount: { increment: 1 } },
      });

      // Trừ năng lượng & Thưởng +2 EXP khi tưới nước
      const WATER_EXP = 2;
      const expProg = calculateExpProgression(farm.level, farm.exp, farm.totalExp, WATER_EXP);

      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          energy: { decrement: 1 },
          dailyWaterCount: { increment: 1 },
          level: expProg.levelAfter,
          exp: expProg.expAfter,
          totalExp: expProg.newTotalExp,
        },
      });

      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'WATER',
          plotIndex,
          details: { expGained: WATER_EXP },
        },
      });

      if (expProg.leveledUp) {
        this.farmGateway.emitFarmLeveledUp(userId, {
          newLevel: expProg.levelAfter,
          totalExp: expProg.newTotalExp,
        });
      }

      this.farmGateway.emitPlotUpdated(userId, { plotIndex, plot: updatedPlot });
      return {
        success: true,
        plot: updatedPlot,
        expBefore: expProg.expBefore,
        expGained: expProg.expGained,
        expAfter: expProg.expAfter,
        levelBefore: expProg.levelBefore,
        levelAfter: expProg.levelAfter,
        leveledUp: expProg.leveledUp,
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
   * Bón phân cho cây trồng
   */
  async fertilize(userId: string, plotIndex: number, fertilizerCode: string) {
    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({
        where: { userId },
        include: { plots: { include: { cropInstance: true } } },
      });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const plot = farm.plots.find((p) => p.plotIndex === plotIndex);
      if (!plot || !plot.cropInstance) {
        throw new BadRequestException('Không có cây trồng trên ô đất này để bón phân');
      }

      if (plot.fertilizerItemId) {
        throw new BadRequestException('Cây này đã được bón phân rồi');
      }

      // Chuẩn hóa mã phân bón
      let targetCode = fertilizerCode || 'FERTILIZER_SPEED';
      if (targetCode === 'GROWTH') targetCode = 'FERTILIZER_SPEED';
      if (targetCode === 'MUTATION') targetCode = 'FERTILIZER_MUTATION';
      if (targetCode === 'YIELD') targetCode = 'FERTILIZER_YIELD';

      // Kiểm tra kho đồ người chơi
      const invItem = await tx.farmInventoryItem.findUnique({
        where: {
          farmId_itemType_referenceId: {
            farmId: farm.id,
            itemType: FarmItemType.FERTILIZER,
            referenceId: targetCode,
          },
        },
      });

      if (!invItem || invItem.quantity < 1) {
        throw new BadRequestException('Bạn chưa có loại phân bón này trong kho đồ. Hãy mua thêm tại Cửa Hàng!');
      }

      // Tiêu thụ phân bón từ kho
      await this.inventoryService.consumeItem(
        tx,
        farm.id,
        FarmItemType.FERTILIZER,
        targetCode,
        1,
      );

      // Thưởng phân bón: +15% tỷ lệ đột biến hoặc tăng sản lượng/tốc độ
      const bonus = targetCode.includes('MUTATION') ? 0.15 : (targetCode.includes('YIELD') ? 0.10 : 0.08);

      const now = new Date();
      // Nếu là phân bón siêu tốc: rút ngắn 35% thời gian sinh trưởng còn lại
      if (targetCode.includes('SPEED') && plot.cropInstance) {
        const remainingMs = plot.cropInstance.readyAt.getTime() - now.getTime();
        if (remainingMs > 0) {
          const cutMs = Math.floor(remainingMs * 0.35);
          await tx.farmCropInstance.update({
            where: { id: plot.cropInstance.id },
            data: {
              stage1At: new Date(plot.cropInstance.stage1At.getTime() - cutMs),
              stage2At: new Date(plot.cropInstance.stage2At.getTime() - cutMs),
              stage3At: new Date(plot.cropInstance.stage3At.getTime() - cutMs),
              readyAt: new Date(plot.cropInstance.readyAt.getTime() - cutMs),
            },
          });
        }
      }

      // Kích hoạt xác suất đột biến sinh học ngay lập tức trong quá trình chăm sóc / bón phân
      if (plot.cropInstance && !plot.cropInstance.isMutated) {
        const cropWithMutations = await tx.farmCrop.findUnique({
          where: { id: plot.cropInstance.cropId },
          include: { mutations: true },
        });
        if (cropWithMutations && cropWithMutations.mutations.length > 0) {
          const mutationResult = this.mutationEngine.resolveMutation({
            baseMutationRate: plot.cropInstance.mutationRateSnapshot,
            fertilizerBonus: bonus,
            soilQuality: plot.soilQuality,
            activeWeather: farm.activeWeather,
            cropCategory: cropWithMutations.category,
            mutations: cropWithMutations.mutations,
          });
          if (mutationResult.isMutated && mutationResult.selectedMutation) {
            await tx.farmCropInstance.update({
              where: { id: plot.cropInstance.id },
              data: {
                isMutated: true,
                mutationId: mutationResult.selectedMutation.id,
              },
            });
          }
        }
      }

      const updatedPlot = await tx.farmPlot.update({
        where: { id: plot.id },
        data: {
          fertilizerItemId: targetCode,
          fertilizerBonus: bonus,
        },
        include: {
          cropInstance: { include: { crop: true, mutation: true } },
        },
      });

      // Thưởng +5 EXP khi bón phân
      const FERTILIZE_EXP = 5;
      const expProg = calculateExpProgression(farm.level, farm.exp, farm.totalExp, FERTILIZE_EXP);

      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          level: expProg.levelAfter,
          exp: expProg.expAfter,
          totalExp: expProg.newTotalExp,
          pendingLevelUp: expProg.canLevelUp,
        },
      });

      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'FERTILIZE',
          plotIndex,
          details: { fertilizerCode: targetCode, expGained: FERTILIZE_EXP },
        },
      });

      return {
        success: true,
        plot: updatedPlot,
        expGained: FERTILIZE_EXP,
        canLevelUp: expProg.canLevelUp,
        farm: {
          level: updatedFarm.level,
          exp: updatedFarm.exp,
          totalExp: updatedFarm.totalExp,
          farmCoin: updatedFarm.farmCoin,
          energy: updatedFarm.energy,
          pendingLevelUp: updatedFarm.pendingLevelUp,
        },
      };
    });
  }

  /**
   * Đào cây / Nhổ cây (Uproot Crop):
   * Hành động dọn sạch ô đất có cây không mong muốn.
   * Transaction an toàn, không thưởng EXP, không thưởng Farm Coin, không thưởng Yield.
   */
  async uproot(userId: string, plotIndex: number) {
    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({
        where: { userId },
        include: {
          plots: {
            where: { plotIndex },
            include: { cropInstance: { include: { crop: true } } },
          },
        },
      });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const plot = farm.plots[0];
      if (!plot) throw new NotFoundException(`Không tìm thấy ô đất số ${plotIndex}`);
      if (plot.status === FarmPlotStatus.LOCKED) {
        throw new BadRequestException('Ô đất này đang bị khóa');
      }
      if (!plot.cropInstance || !plot.cropInstanceId) {
        throw new BadRequestException('Không có cây trồng nào trên ô đất này để nhổ bỏ');
      }

      const instance = plot.cropInstance;

      // 1. Kiểm tra trạng thái cây: Nếu đã thu hoạch hoặc đã bị gỡ trước đó
      if (instance.harvestedAt !== null) {
        throw new ConflictException('Cây trồng này đã được thu hoạch trước đó (ALREADY_HARVESTED)');
      }

      // 2. Atomic lock: Đánh dấu kết thúc phiên cây trồng
      const now = new Date();
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
        throw new ConflictException('Cây trồng này đã bị nhổ bỏ hoặc thu hoạch trước đó (CROP_ALREADY_REMOVED)');
      }

      // 3. Reset ô đất về trạng thái EMPTY
      const updatedPlot = await tx.farmPlot.update({
        where: { id: plot.id },
        data: {
          status: FarmPlotStatus.EMPTY,
          cropInstanceId: null,
          fertilizerItemId: null,
          fertilizerBonus: 0,
          waterLevel: 50,
        },
        include: {
          cropInstance: true,
        },
      });

      // 4. Ghi Audit Log - Tuyệt đối không thưởng EXP, coin hay nông sản
      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'UPROOT',
          plotIndex,
          details: {
            cropCode: instance.crop.code,
            cropName: instance.cropNameSnapshot,
            message: 'Người chơi đã đào bỏ cây trồng',
          },
        },
      });

      // 5. Phát Socket realtime đến client
      this.farmGateway.emitPlotUpdated(userId, { plotIndex, plot: updatedPlot });

      return {
        success: true,
        message: `Đã đào bỏ ${instance.cropNameSnapshot}`,
        plot: updatedPlot,
        farm: {
          level: farm.level,
          exp: farm.exp,
          totalExp: farm.totalExp,
          farmCoin: farm.farmCoin,
          energy: farm.energy,
        },
      };
    });
  }

  /**
   * Gieo Gói Hạt Giống Bí Ẩn (Mystery Seed Pack) vào ô đất trống
   * - Tiêu hao 1 Mystery Pack từ kho (nguyên tử)
   * - Random roll loại cây server-side theo weighted probability
   * - Roll đột biến nếu trúng
   * - Tạo cropInstance, lưu kết quả bất biến vào DB
   * - Unlock collection discovery nếu là cây mới
   * - Trả về thông tin reveal cho client
   */
  async plantMysteryPack(userId: string, plotIndex: number, packCode: string = 'MYSTERY_SEED_PACK') {
    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({
        where: { userId },
        include: { plots: { include: { cropInstance: true } } },
      });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const plot = farm.plots.find((p) => p.plotIndex === plotIndex);
      if (!plot) throw new NotFoundException('Không tìm thấy ô đất');
      if (plot.status === FarmPlotStatus.LOCKED) {
        throw new BadRequestException('Ô đất này đang bị khóa, hãy mở khóa trước');
      }
      if (plot.cropInstanceId || plot.status === FarmPlotStatus.GROWING || plot.status === FarmPlotStatus.PLANTED) {
        throw new BadRequestException('Ô đất này đang có cây trồng');
      }

      // Kiểm tra năng lượng (Tốn 3 energy mỗi lần gieo)
      const ENERGY_COST = 3;
      if (farm.energy < ENERGY_COST) {
        throw new BadRequestException(`Bạn không đủ năng lượng để gieo hạt (Cần ${ENERGY_COST}⚡, hiện có: ${farm.energy}⚡)`);
      }

      // Kiểm tra & Trừ 1 Gói Hạt Giống Bí Ẩn trong kho
      const packItem = await tx.farmInventoryItem.findFirst({
        where: {
          farmId: farm.id,
          quantity: { gt: 0 },
          OR: [
            { itemCode: packCode },
            { itemCode: 'MYSTERY_SEED_PACK' },
            { itemCode: 'SEED_PACK_BASIC' },
            { itemCode: 'SEED_PACK_RARE' },
            { itemCode: 'SEED_PACK_LEGENDARY' },
          ],
        },
      });

      if (!packItem || packItem.quantity <= 0) {
        throw new BadRequestException('Bạn không còn Gói Hạt Giống Bí Ẩn nào trong túi đồ');
      }

      // Trừ 1 pack
      await tx.farmInventoryItem.update({
        where: { id: packItem.id },
        data: { quantity: { decrement: 1 } },
      });

      // Lấy danh sách cây khả dụng để roll
      const allCrops = await tx.farmCrop.findMany({
        where: { isAvailable: true },
        include: { mutations: true },
      });

      if (allCrops.length === 0) {
        throw new NotFoundException('Không có danh mục cây trồng khả dụng');
      }

      // Server-side weighted probability roll:
      const RARITY_WEIGHTS: Record<string, number> = {
        COMMON: 50,
        UNCOMMON: 30,
        RARE: 15,
        EPIC: 5,
        LEGENDARY: 1,
      };

      const weightedPool = allCrops.map((c) => ({
        crop: c,
        weight: RARITY_WEIGHTS[c.rarity] || 20,
      }));

      const totalWeight = weightedPool.reduce((acc, cur) => acc + cur.weight, 0);
      let randVal = Math.random() * totalWeight;
      let selectedCrop = weightedPool[0].crop;

      for (const entry of weightedPool) {
        if (randVal < entry.weight) {
          selectedCrop = entry.crop;
          break;
        }
        randVal -= entry.weight;
      }

      // Tính toán các mốc thời gian timestamp
      const now = new Date();
      const durationSeconds = selectedCrop.growDuration;
      const durationMs = durationSeconds * 1000;

      const stage1At = new Date(now.getTime() + durationMs * 0.2);
      const stage2At = new Date(now.getTime() + durationMs * 0.4);
      const stage3At = new Date(now.getTime() + durationMs * 0.65);
      const readyAt = new Date(now.getTime() + durationMs * 1.0);

      // Xác định Đột biến sinh học
      const mutationResult = this.mutationEngine.resolveMutation({
        baseMutationRate: selectedCrop.baseMutationRate,
        fertilizerBonus: 0,
        soilQuality: plot.soilQuality,
        activeWeather: farm.activeWeather,
        cropCategory: selectedCrop.category,
        mutations: selectedCrop.mutations || [],
      });

      const isMutated = mutationResult.isMutated;
      const mutationId = mutationResult.selectedMutation?.id ?? null;

      // Tạo CropInstance
      const cropInstance = await tx.farmCropInstance.create({
        data: {
          cropId: selectedCrop.id,
          mutationId,
          isMutated,
          plantedAt: now,
          stage1At,
          stage2At,
          stage3At,
          readyAt,
          cropNameSnapshot: selectedCrop.name,
          growDurationSnapshot: selectedCrop.growDuration,
          baseYieldSnapshot: selectedCrop.baseYield,
          mutationRateSnapshot: selectedCrop.baseMutationRate,
          rewardExpSnapshot: selectedCrop.rewardExp,
          rewardFarmCoinSnapshot: selectedCrop.rewardFarmCoin,
        },
      });

      // Cập nhật ô đất
      const updatedPlot = await tx.farmPlot.update({
        where: { id: plot.id },
        data: {
          status: FarmPlotStatus.PLANTED,
          cropInstanceId: cropInstance.id,
          waterLevel: 80,
          lastWateredAt: now,
          fertilizerItemId: null,
          fertilizerBonus: 0,
        },
        include: {
          cropInstance: {
            include: { crop: true, mutation: true },
          },
        },
      });

      // Trừ năng lượng & Thưởng +10 EXP khi gieo Gói Bí Ẩn
      const MYSTERY_EXP = 10;
      const expProg = calculateExpProgression(farm.level, farm.exp, farm.totalExp, MYSTERY_EXP);

      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          energy: { decrement: ENERGY_COST },
          level: expProg.levelAfter,
          exp: expProg.expAfter,
          totalExp: expProg.newTotalExp,
        },
      });

      // Kiểm tra Album Discovery
      let isNewDiscovery = false;
      const existingCollection = await tx.farmCollection.findFirst({
        where: {
          farmId: farm.id,
          cropId: selectedCrop.id,
          mutationId: mutationId ?? null,
          isUnlocked: true,
        },
      });
      if (!existingCollection) {
        isNewDiscovery = true;
        await tx.farmCollection.create({
          data: {
            farmId: farm.id,
            cropId: selectedCrop.id,
            mutationId: mutationId ?? null,
            isUnlocked: true,
            firstDiscoveredAt: now,
            harvestCount: 0,
            highestYield: 0,
          },
        });
      }

      // Ghi log
      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'PLANT',
          plotIndex,
          details: {
            packCode: packItem.itemCode,
            rolledCropCode: selectedCrop.code,
            rolledCropName: selectedCrop.name,
            isMutated,
            mutationName: mutationResult.selectedMutation?.name ?? null,
            isNewDiscovery,
          },
        },
      });

      if (expProg.leveledUp) {
        this.farmGateway.emitFarmLeveledUp(userId, {
          newLevel: expProg.levelAfter,
          totalExp: expProg.newTotalExp,
        });
      }

      this.farmGateway.emitPlotUpdated(userId, { plotIndex, plot: updatedPlot });

      return {
        success: true,
        plot: updatedPlot,
        cropInstance,
        rolledCrop: selectedCrop,
        isMutated,
        mutation: mutationResult.selectedMutation ?? null,
        isNewDiscovery,
        remainingPacks: packItem.quantity - 1,
        expBefore: expProg.expBefore,
        expGained: expProg.expGained,
        expAfter: expProg.expAfter,
        levelBefore: expProg.levelBefore,
        levelAfter: expProg.levelAfter,
        leveledUp: expProg.leveledUp,
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
   * Chế độ Tưới Nhanh (Quick Water Mode) cho danh sách nhiều ô đất
   */
  async waterBatch(userId: string, plotIndexes: number[]) {
    if (!plotIndexes || plotIndexes.length === 0) {
      throw new BadRequestException('Danh sách ô đất tưới không được để trống');
    }

    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({
        where: { userId },
        include: { plots: { include: { cropInstance: true } } },
      });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const now = new Date();
      const validPlotsToWater = farm.plots.filter((p) => {
        if (!plotIndexes.includes(p.plotIndex)) return false;
        if (!p.cropInstance) return false;
        if (p.status === FarmPlotStatus.WATERED) return false;
        if (p.lastWateredAt && now.getTime() - new Date(p.lastWateredAt).getTime() < 60 * 1000) {
          return false;
        }
        return true;
      });

      if (validPlotsToWater.length === 0) {
        return {
          success: true,
          wateredCount: 0,
          message: 'Tất cả các ô đất đã chọn đều đang đủ độ ẩm',
          plots: farm.plots,
        };
      }

      const totalEnergyCost = validPlotsToWater.length;
      if (farm.energy < totalEnergyCost) {
        throw new BadRequestException(
          `Không đủ năng lượng để tưới ${validPlotsToWater.length} cây (Cần ${totalEnergyCost}⚡, hiện có: ${farm.energy}⚡)`
        );
      }

      const updatedPlots: any[] = [];
      for (const plot of validPlotsToWater) {
        const upd = await tx.farmPlot.update({
          where: { id: plot.id },
          data: {
            status: FarmPlotStatus.WATERED,
            waterLevel: 100,
            lastWateredAt: now,
          },
          include: {
            cropInstance: { include: { crop: true, mutation: true } },
          },
        });

        await this.checkAndApplyGrowthMutation(tx, upd, farm);

        await tx.farmCropInstance.update({
          where: { id: plot.cropInstance!.id },
          data: { wateredCount: { increment: 1 } },
        });

        updatedPlots.push(upd);
        this.farmGateway.emitPlotUpdated(userId, { plotIndex: plot.plotIndex, plot: upd });
      }

      const expGained = validPlotsToWater.length * 2;
      const expProg = calculateExpProgression(farm.level, farm.exp, farm.totalExp, expGained);

      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          energy: { decrement: totalEnergyCost },
          dailyWaterCount: { increment: validPlotsToWater.length },
          level: expProg.levelAfter,
          exp: expProg.expAfter,
          totalExp: expProg.newTotalExp,
        },
      });

      if (expProg.leveledUp) {
        this.farmGateway.emitFarmLeveledUp(userId, {
          newLevel: expProg.levelAfter,
          totalExp: expProg.newTotalExp,
        });
      }

      return {
        success: true,
        wateredCount: validPlotsToWater.length,
        plots: updatedPlots,
        expGained,
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
   * Kiểm tra và kích hoạt đột biến ở từng giai đoạn phát triển và chăm sóc cây
   */
  async checkAndApplyGrowthMutation(tx: any, plot: any, farm: any) {
    if (!plot.cropInstance || plot.cropInstance.isMutated || !plot.cropInstance.cropId) {
      return null;
    }

    const cropWithMutations = await tx.farmCrop.findUnique({
      where: { id: plot.cropInstance.cropId },
      include: { mutations: true },
    });

    if (!cropWithMutations || !cropWithMutations.mutations || cropWithMutations.mutations.length === 0) {
      return null;
    }

    // Tỉ lệ đột biến mỗi lần chăm sóc/qua giai đoạn mới = 40% snapshot
    const mutationResult = this.mutationEngine.resolveMutation({
      baseMutationRate: (plot.cropInstance.mutationRateSnapshot || 0.05) * 0.4,
      fertilizerBonus: plot.fertilizerBonus || 0,
      soilQuality: plot.soilQuality,
      activeWeather: farm.activeWeather,
      cropCategory: cropWithMutations.category,
      mutations: cropWithMutations.mutations,
    });

    if (mutationResult.isMutated && mutationResult.selectedMutation) {
      await tx.farmCropInstance.update({
        where: { id: plot.cropInstance.id },
        data: {
          isMutated: true,
          mutationId: mutationResult.selectedMutation.id,
        },
      });
      plot.cropInstance.isMutated = true;
      plot.cropInstance.mutationId = mutationResult.selectedMutation.id;
      plot.cropInstance.mutation = mutationResult.selectedMutation;
      return mutationResult.selectedMutation;
    }

    return null;
  }
}

