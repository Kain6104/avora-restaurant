import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateLuckyEnvelopeConfigDto,
  CreateLuckyEnvelopeRewardDto,
  UpdateLuckyEnvelopeRewardDto,
  LuckyEnvelopeHistoryQueryDto,
} from './dto/lucky-envelope.dto';

@Injectable()
export class AdminLuckyEnvelopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy cấu hình sự kiện
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
   * Cập nhật cấu hình sự kiện (Master Switch ON/OFF, v.v.)
   */
  async updateConfig(dto: UpdateLuckyEnvelopeConfigDto) {
    await this.getConfig(); // Ensure exists

    return this.prisma.farmLuckyEnvelopeConfig.update({
      where: { key: 'DEFAULT' },
      data: {
        ...(dto.isEventActive !== undefined ? { isEventActive: dto.isEventActive } : {}),
        ...(dto.allowExistingTicketsToOpen !== undefined ? { allowExistingTicketsToOpen: dto.allowExistingTicketsToOpen } : {}),
        ...(dto.maxVisibleEnvelopes !== undefined ? { maxVisibleEnvelopes: dto.maxVisibleEnvelopes } : {}),
        ...(dto.ticketsPerMission !== undefined ? { ticketsPerMission: dto.ticketsPerMission } : {}),
      },
    });
  }

  /**
   * Danh sách tất cả phần thưởng trong pool kèm thống kê
   */
  async getRewards() {
    const rewards = await this.prisma.farmLuckyEnvelopeReward.findMany({
      orderBy: [{ isActive: 'desc' }, { weight: 'desc' }, { createdAt: 'desc' }],
    });

    const totalActiveWeight = rewards
      .filter((r) => r.isActive)
      .reduce((sum, r) => sum + r.weight, 0);

    return rewards.map((r) => {
      const calcPercent = totalActiveWeight > 0 && r.isActive
        ? (Number(r.weight) / totalActiveWeight) * 100
        : 0;
      const formattedPercent = calcPercent < 0.01 && calcPercent > 0
        ? Number(calcPercent.toFixed(4))
        : Number(calcPercent.toFixed(2));
      return {
        ...r,
        probabilityPercent: formattedPercent,
      };
    });
  }

  /**
   * Thêm phần thưởng mới vào pool
   */
  async createReward(dto: CreateLuckyEnvelopeRewardDto) {
    if (dto.minAmount > dto.maxAmount) {
      throw new BadRequestException('Giá trị min không được lớn hơn max');
    }

    return this.prisma.farmLuckyEnvelopeReward.create({
      data: {
        name: dto.name,
        description: dto.description,
        rewardType: dto.rewardType,
        referenceId: dto.referenceId,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        rarity: dto.rarity,
        weight: dto.weight,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        globalStock: dto.globalStock !== undefined ? dto.globalStock : null,
        perUserLimit: dto.perUserLimit !== undefined ? dto.perUserLimit : null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  /**
   * Sửa phần thưởng
   */
  async updateReward(id: string, dto: UpdateLuckyEnvelopeRewardDto) {
    const existing = await this.prisma.farmLuckyEnvelopeReward.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Phần thưởng không tồn tại');
    }

    const min = dto.minAmount !== undefined ? dto.minAmount : existing.minAmount;
    const max = dto.maxAmount !== undefined ? dto.maxAmount : existing.maxAmount;
    if (min > max) {
      throw new BadRequestException('Giá trị min không được lớn hơn max');
    }

    return this.prisma.farmLuckyEnvelopeReward.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.rewardType !== undefined ? { rewardType: dto.rewardType } : {}),
        ...(dto.referenceId !== undefined ? { referenceId: dto.referenceId } : {}),
        ...(dto.minAmount !== undefined ? { minAmount: dto.minAmount } : {}),
        ...(dto.maxAmount !== undefined ? { maxAmount: dto.maxAmount } : {}),
        ...(dto.rarity !== undefined ? { rarity: dto.rarity } : {}),
        ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.globalStock !== undefined ? { globalStock: dto.globalStock } : {}),
        ...(dto.perUserLimit !== undefined ? { perUserLimit: dto.perUserLimit } : {}),
        ...(dto.startDate !== undefined ? { startDate: dto.startDate ? new Date(dto.startDate) : null } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
      },
    });
  }

  /**
   * Xóa phần thưởng
   */
  async deleteReward(id: string) {
    const existing = await this.prisma.farmLuckyEnvelopeReward.findUnique({
      where: { id },
      include: { openings: { take: 1 } },
    });

    if (!existing) {
      throw new NotFoundException('Phần thưởng không tồn tại');
    }

    if (existing.openings.length > 0) {
      // Nếu đã từng được mở, chuyển sang Inactive để bảo toàn quan hệ foreign key & lịch sử
      return this.prisma.farmLuckyEnvelopeReward.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.farmLuckyEnvelopeReward.delete({
      where: { id },
    });
  }

  /**
   * Lịch sử mở bao lì xì kèm phân trang
   */
  async getHistory(query: LuckyEnvelopeHistoryQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.rarity) where.rarity = query.rarity;
    if (query.rewardType) where.rewardType = query.rewardType;

    const [total, items] = await Promise.all([
      this.prisma.farmLuckyEnvelopeOpening.count({ where }),
      this.prisma.farmLuckyEnvelopeOpening.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatarUrl: true,
            },
          },
          reward: {
            select: {
              name: true,
              imageUrl: true,
              rarity: true,
            },
          },
        },
        orderBy: { openedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Thống kê KPI Lì Xì May Mắn
   */
  async getAnalytics() {
    const [
      farmAggregate,
      totalOpened,
      rarityStats,
      topRewardsRaw,
      coinDistributedRaw,
    ] = await Promise.all([
      this.prisma.userFarm.aggregate({
        _sum: {
          luckyEnvelopeTickets: true,
          totalLuckyEnvelopeTicketsEarned: true,
          totalLuckyEnvelopesOpened: true,
        },
      }),
      this.prisma.farmLuckyEnvelopeOpening.count(),
      this.prisma.farmLuckyEnvelopeOpening.groupBy({
        by: ['rarity'],
        _count: { id: true },
      }),
      this.prisma.farmLuckyEnvelopeOpening.groupBy({
        by: ['rewardName', 'rarity'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.farmLuckyEnvelopeOpening.aggregate({
        where: { rewardType: 'COIN' },
        _sum: { rewardAmount: true },
      }),
    ]);

    const totalTicketsEarned = farmAggregate._sum.totalLuckyEnvelopeTicketsEarned || 0;
    const totalTicketsUnused = farmAggregate._sum.luckyEnvelopeTickets || 0;
    const totalCoinDistributed = coinDistributedRaw._sum.rewardAmount || 0;

    const rarityMap: Record<string, number> = {
      COMMON: 0,
      UNCOMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0,
      MYTHIC: 0,
    };

    for (const stat of rarityStats) {
      rarityMap[stat.rarity] = stat._count.id;
    }

    return {
      totalTicketsEarned,
      totalOpened,
      totalTicketsUnused,
      totalCoinDistributed,
      rarityBreakdown: rarityMap,
      topRewards: topRewardsRaw.map((r) => ({
        name: r.rewardName,
        rarity: r.rarity,
        count: r._count.id,
      })),
    };
  }
}
