import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { FarmGateway } from './farm.gateway';
import { FarmItemType, FarmRarity } from '@prisma/client';

@Injectable()
export class FarmIntegrationService {
  private readonly logger = new Logger(FarmIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly farmGateway: FarmGateway,
  ) {}

  /**
   * Hook được gọi khi đơn hàng nhà hàng AVORA hoàn tất (COMPLETED)
   */
  async onOrderCompleted(userId: string, orderId: string, totalAmount: number) {
    if (!userId) return;

    try {
      let farm = await this.prisma.userFarm.findUnique({
        where: { userId },
      });

      if (!farm) {
        this.logger.debug(`User ${userId} does not have a farm yet; skipping order hook`);
        return;
      }

      // 1. Thưởng Tree XP cho cây AVORA Tree dựa trên chi tiêu thực tế (1.000đ = 1 Tree XP)
      const earnedTreeXp = Math.floor(totalAmount / 1000);
      const newTreeXp = farm.treeExp + earnedTreeXp;
      const newTreeLevel = Math.min(10, Math.floor(newTreeXp / 500) + 1);

      // 2. Nạp đầy năng lượng Nông trại (Max 100)
      const energyBonus = 50;
      const newEnergy = Math.min(farm.maxEnergy, farm.energy + energyBonus);

      await this.prisma.userFarm.update({
        where: { id: farm.id },
        data: {
          treeExp: newTreeXp,
          treeLevel: newTreeLevel,
          energy: newEnergy,
        },
      });

      // 3. Tặng hạt giống quý hiếm nếu đơn hàng đạt ngưỡng chi tiêu
      let rewardSeedCode: string | null = null;
      let rewardSeedName: string | null = null;

      if (totalAmount >= 500000) {
        rewardSeedCode = 'SALMON_BLOSSOM';
        rewardSeedName = 'Hoa Hồi Cá Hồi (Signature AVORA)';
      } else if (totalAmount >= 300000) {
        rewardSeedCode = 'WASABI';
        rewardSeedName = 'Wasabi Tươi Shizuoka';
      }

      if (rewardSeedCode) {
        const crop = await this.prisma.farmCrop.findUnique({
          where: { code: rewardSeedCode },
        });

        if (crop) {
          await this.inventoryService.addItem(this.prisma, farm.id, {
            itemType: FarmItemType.SEED,
            referenceId: crop.id,
            itemName: `Hạt giống ${rewardSeedName}`,
            itemCode: crop.code,
            quantity: 2,
            rarity: crop.rarity,
          });
        }
      }

      // 4. Ghi log hoạt động
      await this.prisma.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'ORDER_COMPLETED_REWARD',
          details: {
            orderId,
            totalAmount,
            earnedTreeXp,
            energyRestored: energyBonus,
            rewardSeedCode,
          },
        },
      });

      this.farmGateway.emitFarmUpdated(userId, {
        treeExp: newTreeXp,
        treeLevel: newTreeLevel,
        energy: newEnergy,
      });

      this.logger.log(
        `Farm order reward processed for user ${userId}: +${earnedTreeXp} Tree XP, Refilled Energy, Seed: ${rewardSeedCode}`,
      );
    } catch (error) {
      this.logger.error(`Error processing farm onOrderCompleted hook: ${error.message}`);
    }
  }
}
