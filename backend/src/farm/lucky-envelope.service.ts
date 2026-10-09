import { Injectable, BadRequestException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { FarmItemType, FarmRarity } from '@prisma/client';
import { calculateExpProgression } from './farm-progression.util';

import { FarmTransactionService } from './farm-transaction.service';

@Injectable()
export class LuckyEnvelopeService implements OnModuleInit {
  private readonly logger = new Logger(LuckyEnvelopeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly transactionService: FarmTransactionService,
  ) {}

  async onModuleInit() {
    await this.ensureConfigExists();
    await this.seedDefaultRewards();
  }

  /**
   * Đảm bảo cấu hình hệ thống luôn tồn tại
   */
  async ensureConfigExists() {
    const existing = await this.prisma.farmLuckyEnvelopeConfig.findUnique({
      where: { key: 'DEFAULT' },
    });

    if (!existing) {
      await this.prisma.farmLuckyEnvelopeConfig.create({
        data: {
          key: 'DEFAULT',
          isEventActive: true,
          allowExistingTicketsToOpen: true,
          maxVisibleEnvelopes: 8,
          ticketsPerMission: 1,
        },
      });
      this.logger.log('Lucky Envelope Config initialized with default values.');
    }
  }

  /**
   * Lấy cấu hình sự kiện hiện tại
   */
  async getConfig() {
    let config = await this.prisma.farmLuckyEnvelopeConfig.findUnique({
      where: { key: 'DEFAULT' },
    });

    if (!config) {
      config = await this.prisma.farmLuckyEnvelopeConfig.create({
        data: {
          key: 'DEFAULT',
          isEventActive: true,
          allowExistingTicketsToOpen: true,
          maxVisibleEnvelopes: 8,
          ticketsPerMission: 1,
        },
      });
    }

    return config;
  }

  /**
   * Lấy trạng thái lì xì của người chơi
   */
  async getUserStatus(userId: string) {
    const farm = await this.prisma.userFarm.findUnique({
      where: { userId },
      select: {
        id: true,
        luckyEnvelopeTickets: true,
        totalLuckyEnvelopesOpened: true,
        totalLuckyEnvelopeTicketsEarned: true,
      },
    });

    if (!farm) {
      throw new NotFoundException('Nông trại người dùng không tồn tại');
    }

    const config = await this.getConfig();
    const availableTickets = Math.max(0, farm.luckyEnvelopeTickets);
    const canOpen = availableTickets > 0 && (config.isEventActive || config.allowExistingTicketsToOpen);
    const visibleEnvelopesCount = Math.min(availableTickets, config.maxVisibleEnvelopes);
    const overflowTicketsCount = Math.max(0, availableTickets - config.maxVisibleEnvelopes);

    return {
      availableTickets,
      totalOpened: farm.totalLuckyEnvelopesOpened,
      totalEarned: farm.totalLuckyEnvelopeTicketsEarned,
      isEventActive: config.isEventActive,
      allowExistingTicketsToOpen: config.allowExistingTicketsToOpen,
      canOpen,
      maxVisibleEnvelopes: config.maxVisibleEnvelopes,
      visibleEnvelopesCount,
      overflowTicketsCount,
    };
  }

  /**
   * Lấy danh sách phần thưởng và thể lệ chương trình (Động từ Database)
   */
  async getPublicRewardsAndRules() {
    const config = await this.getConfig();
    const now = new Date();

    const rewards = await this.prisma.farmLuckyEnvelopeReward.findMany({
      where: {
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      orderBy: [
        { rarity: 'desc' },
        { weight: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        rewardType: true,
        referenceId: true,
        minAmount: true,
        maxAmount: true,
        rarity: true,
        weight: true,
        imageUrl: true,
        globalStock: true,
        claimedStock: true,
        perUserLimit: true,
      },
    });

    const totalWeight = rewards.reduce((sum, r) => sum + Math.max(0.00001, Number(r.weight)), 0);
    const rewardsWithStats = rewards.map((r) => {
      const dropRate = totalWeight > 0 ? ((Number(r.weight) / totalWeight) * 100).toFixed(2) : '0.00';
      const remainingStock = r.globalStock !== null ? Math.max(0, r.globalStock - r.claimedStock) : null;
      return {
        ...r,
        dropRate: `${dropRate}%`,
        remainingStock,
      };
    });

    const rules = {
      title: 'Thể Lệ & Phần Thưởng Bao Lì Xì May Mắn',
      programPurpose: 'Chương trình "Bao Lì Xì May Mắn" là hoạt động tri ân thường niên dành cho cư dân nông trại AVORA Farm, mang đến cơ hội nhận các phần quà giá trị cao: Xu nông trại, Hạt giống quý hiếm, Phân bón tăng tốc, Phân bón vi sinh đột biến và đặc quyền ẩm thực.',
      howToEarnTickets: [
        {
          category: 'A. Hoạt động Hằng ngày & Nông trại',
          items: [
            'Điểm danh & hoàn thành nhiệm vụ mỗi ngày: Nhận từ +1 đến +3 bao lì xì.',
            'Hoàn tất toàn bộ nhiệm vụ ngày: Thưởng ngay +2 đến +5 bao lì xì may mắn.',
            'Thăng cấp Nông trại (Level Up): Thưởng bao lì xì theo cấp độ đạt được.',
            'Thu hoạch nông sản đặc biệt và đột biến thành công.',
          ],
        },
        {
          category: 'B. Đơn hàng & Dịch vụ Nhà hàng AVORA',
          items: [
            'Hoàn tất đơn hàng ăn uống tại nhà hàng: Nhận thêm lượt mở lì xì may mắn.',
            'Đánh giá món ăn & chia sẻ trải nghiệm: Nhận lượt mở thưởng.',
            'Đơn hàng giá trị từ 500.000đ: Thưởng thêm lượt mở lì xì đặc biệt.',
          ],
        },
      ],
      mechanics: [
        'Mỗi bao lì xì mở ra sẽ chọn ngẫu nhiên 1 phần thưởng theo hệ số xác suất minh bạch từ máy chủ.',
        'Toàn bộ quà tặng sau khi nhận sẽ lập tức được cộng vào tài khoản hoặc chuyển thẳng vào Túi Đồ nông trại.',
        `Cây Thần AVORA hiển thị tối đa ${config.maxVisibleEnvelopes} bao lì xì cùng lúc trên cành lá. Các lượt dư dả sẽ được lưu trữ an toàn trong kho tích lũy (+N) và xuất hiện dần khi mở.`,
      ],
    };

    return {
      config: {
        isEventActive: config.isEventActive,
        maxVisibleEnvelopes: config.maxVisibleEnvelopes,
        ticketsPerMission: config.ticketsPerMission,
      },
      rules,
      totalWeight,
      rewards: rewardsWithStats,
    };
  }

  /**
   * Lịch sử mở lì xì gần đây của người chơi
   */
  async getUserHistory(userId: string, limit: number = 20) {
    return this.prisma.farmLuckyEnvelopeOpening.findMany({
      where: { userId },
      orderBy: { openedAt: 'desc' },
      take: Math.min(limit, 50),
    });
  }

  /**
   * MỞ BAO LÌ XÌ MAY MẮN (Server-side Secure & Transaction-Safe)
   */
  async openEnvelope(userId: string) {
    const config = await this.getConfig();

    // 1. Kiểm tra trạng thái sự kiện
    if (!config.isEventActive && !config.allowExistingTicketsToOpen) {
      throw new BadRequestException('Sự kiện Lì Xì May Mắn hiện đang tạm dừng');
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Kiểm tra và trừ vé người chơi ATOMICALLY
      const farm = await tx.userFarm.findUnique({
        where: { userId },
      });

      if (!farm) {
        throw new NotFoundException('Nông trại người dùng không tồn tại');
      }

      if (farm.luckyEnvelopeTickets <= 0) {
        throw new BadRequestException('Bạn không còn lượt mở lì xì may mắn');
      }

      // Trừ 1 vé và tăng số lượt đã mở
      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: {
          luckyEnvelopeTickets: { decrement: 1 },
          totalLuckyEnvelopesOpened: { increment: 1 },
        },
      });

      // 3. Lấy danh sách phần thưởng hợp lệ
      const now = new Date();
      const activeRewards = await tx.farmLuckyEnvelopeReward.findMany({
        where: {
          isActive: true,
          OR: [{ startDate: null }, { startDate: { lte: now } }],
          AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
        },
      });

      // Lọc các reward còn stock toàn cục
      let eligibleRewards = activeRewards.filter((r) => {
        if (r.globalStock !== null && r.globalStock !== undefined) {
          return r.claimedStock < r.globalStock;
        }
        return true;
      });

      // Lọc các reward chưa vượt quá perUserLimit
      const rewardLimits = await Promise.all(
        eligibleRewards.map(async (r) => {
          if (r.perUserLimit && r.perUserLimit > 0) {
            const count = await tx.farmLuckyEnvelopeOpening.count({
              where: { userId, rewardId: r.id },
            });
            return count < r.perUserLimit;
          }
          return true;
        }),
      );

      eligibleRewards = eligibleRewards.filter((_, idx) => rewardLimits[idx]);

      // Fallback an toàn nếu kho quà trống
      let selectedReward: any = null;
      if (eligibleRewards.length === 0) {
        selectedReward = {
          id: 'FALLBACK_COIN',
          name: '100 Xu May Mắn',
          rewardType: 'COIN',
          referenceId: null,
          minAmount: 100,
          maxAmount: 200,
          rarity: FarmRarity.COMMON,
          weight: 100,
          imageUrl: '/game/farm/items/coin.png',
        };
      } else {
        // 4. Weighted Random Selection
        const totalWeight = eligibleRewards.reduce((sum, r) => sum + Math.max(0.00001, Number(r.weight)), 0);
        let randomVal = Math.random() * totalWeight;

        for (const r of eligibleRewards) {
          randomVal -= Math.max(0.00001, Number(r.weight));
          if (randomVal <= 0) {
            selectedReward = r;
            break;
          }
        }

        if (!selectedReward) {
          selectedReward = eligibleRewards[eligibleRewards.length - 1];
        }
      }

      // 5. Tính số lượng ngẫu nhiên trong khoảng [minAmount, maxAmount]
      const min = Math.min(selectedReward.minAmount, selectedReward.maxAmount);
      const max = Math.max(selectedReward.minAmount, selectedReward.maxAmount);
      const rewardAmount = Math.floor(Math.random() * (max - min + 1)) + min;

      // 6. Cập nhật claimedStock nếu có giới hạn
      if (selectedReward.id !== 'FALLBACK_COIN' && selectedReward.globalStock !== null) {
        await tx.farmLuckyEnvelopeReward.update({
          where: { id: selectedReward.id },
          data: { claimedStock: { increment: 1 } },
        });
      }

      // 7. Trao thưởng dựa trên rewardType
      let expGained = 0;
      let levelAfter = updatedFarm.level;
      let expAfter = updatedFarm.exp;
      let canLevelUp = updatedFarm.pendingLevelUp;

      switch (selectedReward.rewardType) {
        case 'COIN': {
          await tx.userFarm.update({
            where: { id: farm.id },
            data: { farmCoin: { increment: rewardAmount } },
          });
          break;
        }

        case 'EXP': {
          const expProg = calculateExpProgression(
            updatedFarm.level,
            updatedFarm.exp,
            updatedFarm.totalExp,
            rewardAmount,
          );
          expGained = expProg.expGained;
          levelAfter = expProg.levelAfter;
          expAfter = expProg.expAfter;
          canLevelUp = expProg.canLevelUp;

          await tx.userFarm.update({
            where: { id: farm.id },
            data: {
              level: expProg.levelAfter,
              exp: expProg.expAfter,
              totalExp: expProg.newTotalExp,
              pendingLevelUp: expProg.canLevelUp,
            },
          });
          break;
        }

        case 'ENERGY': {
          await tx.userFarm.update({
            where: { id: farm.id },
            data: {
              energy: { increment: rewardAmount },
            },
          });
          break;
        }

        case 'SEED': {
          const seedRef = selectedReward.referenceId || 'JAPANESE_RICE';
          await this.inventoryService.addItem(tx, farm.id, {
            itemType: FarmItemType.SEED,
            referenceId: seedRef,
            itemName: selectedReward.name,
            itemCode: seedRef,
            quantity: rewardAmount,
            rarity: selectedReward.rarity,
          });
          break;
        }

        case 'FERTILIZER': {
          const fertRef = selectedReward.referenceId || 'FERTILIZER_SPEED';
          await this.inventoryService.addItem(tx, farm.id, {
            itemType: FarmItemType.FERTILIZER,
            referenceId: fertRef,
            itemName: selectedReward.name,
            itemCode: fertRef,
            quantity: rewardAmount,
            rarity: selectedReward.rarity,
          });
          break;
        }

        case 'MUTATION_CROP': {
          const cropRef = selectedReward.referenceId || 'MOONLIGHT_RICE';
          await this.inventoryService.addItem(tx, farm.id, {
            itemType: FarmItemType.MUTATION_CROP,
            referenceId: cropRef,
            itemName: selectedReward.name,
            itemCode: cropRef,
            quantity: rewardAmount,
            rarity: selectedReward.rarity,
          });
          break;
        }

        case 'DECORATION':
        case 'ITEM':
        default: {
          const itemRef = selectedReward.referenceId || 'SPECIAL_ITEM';
          await this.inventoryService.addItem(tx, farm.id, {
            itemType: FarmItemType.TOOL,
            referenceId: itemRef,
            itemName: selectedReward.name,
            itemCode: itemRef,
            quantity: rewardAmount,
            rarity: selectedReward.rarity,
          });
          break;
        }
      }

      // 8. Ghi lại lịch sử mở lì xì
      let openingId = 'FALLBACK';
      if (selectedReward.id !== 'FALLBACK_COIN') {
        const opening = await tx.farmLuckyEnvelopeOpening.create({
          data: {
            userId,
            rewardId: selectedReward.id,
            rewardType: selectedReward.rewardType,
            rewardName: selectedReward.name,
            rewardAmount,
            rarity: selectedReward.rarity,
            referenceId: selectedReward.referenceId,
            ticketSource: 'LUCKY_TREE',
          },
        });
        openingId = opening.id;
      }

      // Ghi FarmTransaction Ledger
      await this.transactionService.recordTransaction(tx, {
        userId,
        farmId: farm.id,
        type: 'LUCKY_ENVELOPE_REWARD',
        source: 'LUCKY_ENVELOPE',
        referenceId: openingId,
        itemNameSnapshot: selectedReward.name,
        itemIconUrl: selectedReward.imageUrl || '🧧',
        quantity: rewardAmount,
        farmCoinDelta: selectedReward.rewardType === 'COIN' ? rewardAmount : 0,
        status: 'COMPLETED',
        metadata: {
          rarity: selectedReward.rarity,
          rewardType: selectedReward.rewardType,
        },
      });

      const remainingTickets = updatedFarm.luckyEnvelopeTickets;
      const visibleEnvelopesCount = Math.min(remainingTickets, config.maxVisibleEnvelopes);
      const overflowTicketsCount = Math.max(0, remainingTickets - config.maxVisibleEnvelopes);

      return {
        openingId,
        reward: {
          id: selectedReward.id,
          name: selectedReward.name,
          rewardType: selectedReward.rewardType,
          rewardAmount,
          rarity: selectedReward.rarity,
          referenceId: selectedReward.referenceId,
          imageUrl: selectedReward.imageUrl,
          description: selectedReward.description,
        },
        progression: {
          expGained,
          levelAfter,
          expAfter,
          canLevelUp,
        },
        tickets: {
          remainingTickets,
          totalOpened: updatedFarm.totalLuckyEnvelopesOpened,
          visibleEnvelopesCount,
          overflowTicketsCount,
        },
      };
    });
  }

  /**
   * Khởi tạo phần thưởng mặc định đa dạng, cân bằng theo tỷ lệ
   */
  async seedDefaultRewards() {
    const count = await this.prisma.farmLuckyEnvelopeReward.count();
    if (count > 0) return;

    this.logger.log('Seeding initial Lucky Envelope Reward Pool...');

    const defaultRewards = [
      // COMMON (Tổng weight ~ 55)
      {
        name: '300 Xu Nông Trại',
        description: 'Tiền xu may mắn đầu xuân',
        rewardType: 'COIN',
        referenceId: null,
        minAmount: 200,
        maxAmount: 500,
        rarity: FarmRarity.COMMON,
        weight: 35,
        imageUrl: '/game/farm/items/coin.png',
        isActive: true,
      },
      {
        name: '15 Năng Lượng',
        description: 'Nạp năng lượng chăm sóc cây trồng',
        rewardType: 'ENERGY',
        referenceId: null,
        minAmount: 10,
        maxAmount: 20,
        rarity: FarmRarity.COMMON,
        weight: 20,
        imageUrl: '/game/farm/items/energy.png',
        isActive: true,
      },

      // UNCOMMON (Tổng weight ~ 25)
      {
        name: '80 Điểm EXP Nông Trại',
        description: 'Kinh nghiệm thăng cấp thần tốc',
        rewardType: 'EXP',
        referenceId: null,
        minAmount: 50,
        maxAmount: 100,
        rarity: FarmRarity.UNCOMMON,
        weight: 15,
        imageUrl: '/game/farm/items/exp.png',
        isActive: true,
      },
      {
        name: 'Hạt Giống Lúa Nhật Cao Cấp',
        description: 'Gói 3 hạt giống lúa Nhật thuần chủng',
        rewardType: 'SEED',
        referenceId: 'JAPANESE_RICE',
        minAmount: 2,
        maxAmount: 5,
        rarity: FarmRarity.UNCOMMON,
        weight: 10,
        imageUrl: '/game/farm/crops/japanese_rice/seed.png',
        isActive: true,
      },

      // RARE (Tổng weight ~ 12)
      {
        name: 'Phân Bón Tăng Tốc Sinh Trưởng',
        description: 'Rút ngắn 30% thời gian phát triển cây',
        rewardType: 'FERTILIZER',
        referenceId: 'FERTILIZER_SPEED',
        minAmount: 1,
        maxAmount: 2,
        rarity: FarmRarity.RARE,
        weight: 7,
        imageUrl: '/game/farm/items/fertilizer_speed.png',
        isActive: true,
      },
      {
        name: '1.500 Xu Nông Trại',
        description: 'Bao lì xì lộc tài phú quý',
        rewardType: 'COIN',
        referenceId: null,
        minAmount: 1000,
        maxAmount: 2000,
        rarity: FarmRarity.RARE,
        weight: 5,
        imageUrl: '/game/farm/items/coin.png',
        isActive: true,
      },

      // EPIC (Tổng weight ~ 6)
      {
        name: 'Phân Bón Vi Sinh Đột Biến',
        description: 'Tăng mạnh tỷ lệ tạo biến dị quý hiếm',
        rewardType: 'FERTILIZER',
        referenceId: 'FERTILIZER_MUTATION',
        minAmount: 1,
        maxAmount: 2,
        rarity: FarmRarity.EPIC,
        weight: 4,
        imageUrl: '/game/farm/items/fertilizer_mutation.png',
        isActive: true,
      },
      {
        name: 'Hạt Giống Dâu Tây Hoàng Gia',
        description: 'Giống dâu tây trân quý đem lại thu nhập lớn',
        rewardType: 'SEED',
        referenceId: 'STRAWBERRY',
        minAmount: 2,
        maxAmount: 4,
        rarity: FarmRarity.EPIC,
        weight: 2,
        imageUrl: '/game/farm/crops/strawberry/seed.png',
        isActive: true,
      },

      // LEGENDARY (Tổng weight ~ 2)
      {
        name: '10.000 Xu Đại Cát Đại Lợi',
        description: 'Món quà đại phú đại quý hiếm có nhất AVORA Farm',
        rewardType: 'COIN',
        referenceId: null,
        minAmount: 8000,
        maxAmount: 12000,
        rarity: FarmRarity.LEGENDARY,
        weight: 2,
        imageUrl: '/game/farm/items/coin.png',
        globalStock: 50,
        perUserLimit: 1,
        isActive: true,
      },
    ];

    for (const reward of defaultRewards) {
      await this.prisma.farmLuckyEnvelopeReward.create({ data: reward });
    }

    this.logger.log('Default Lucky Envelope Rewards created successfully.');
  }
}
