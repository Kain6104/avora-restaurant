import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminCropDto, CreateAdminMutationDto, CreateAdminRewardDto, CreateAdminMissionDto, FarmConfigDto } from './dto/farm.dto';

@Injectable()
export class AdminFarmService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tổng quan số liệu thống kê Dashboard Admin Farm
   */
  async getDashboardMetrics() {
    const totalFarms = await this.prisma.userFarm.count();
    const totalCropsPlanted = await this.prisma.farmCropInstance.count();
    const totalHarvests = await this.prisma.farmActivityLog.count({ where: { action: 'HARVEST' } });
    const totalMutations = await this.prisma.farmCropInstance.count({ where: { isMutated: true } });
    const totalRedemptions = await this.prisma.farmRewardRedemption.count();

    // Tính tổng Farm Coin đang lưu hành
    const coinAggregate = await this.prisma.userFarm.aggregate({
      _sum: { farmCoin: true },
      _avg: { level: true },
    });

    // Top cây trồng phổ biến nhất
    const topCrops = await this.prisma.farmCrop.findMany({
      take: 5,
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        rarity: true,
        _count: { select: { instances: true } },
      },
    });

    // Lịch sử đổi thưởng gần đây
    const recentRedemptions = await this.prisma.farmRewardRedemption.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        reward: true,
        farm: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, memberCode: true },
            },
          },
        },
      },
    });

    return {
      totalFarms,
      totalCropsPlanted,
      totalHarvests,
      totalMutations,
      mutationRatePercent: totalHarvests > 0 ? ((totalMutations / totalHarvests) * 100).toFixed(1) : '0',
      totalRedemptions,
      totalCoinsCirculating: coinAggregate._sum.farmCoin || 0,
      averageFarmLevel: coinAggregate._avg.level ? coinAggregate._avg.level.toFixed(1) : '1.0',
      topCrops,
      recentRedemptions,
    };
  }

  /**
   * Quản lý cây trồng (Crops)
   */
  async getAllCrops() {
    return this.prisma.farmCrop.findMany({
      include: {
        mutations: true,
        _count: { select: { instances: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCrop(dto: CreateAdminCropDto) {
    return this.prisma.farmCrop.create({ data: dto });
  }

  async updateCrop(id: string, dto: Partial<CreateAdminCropDto>) {
    return this.prisma.farmCrop.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCrop(id: string) {
    return this.prisma.farmCrop.update({
      where: { id },
      data: { isAvailable: false },
    });
  }

  /**
   * Quản lý đột biến (Mutations)
   */
  async getAllMutations() {
    return this.prisma.farmCropMutation.findMany({
      include: { sourceCrop: true },
      orderBy: { rarity: 'asc' },
    });
  }

  async createMutation(dto: CreateAdminMutationDto) {
    return this.prisma.farmCropMutation.create({ data: dto });
  }

  async updateMutation(id: string, dto: Partial<CreateAdminMutationDto>) {
    return this.prisma.farmCropMutation.update({
      where: { id },
      data: dto,
    });
  }

  async deleteMutation(id: string) {
    return this.prisma.farmCropMutation.delete({ where: { id } });
  }

  /**
   * Quản lý kho quà đổi thưởng (Rewards)
   */
  async getAllRewards() {
    return this.prisma.farmReward.findMany({
      include: { voucher: true },
      orderBy: { costLoyaltyPoints: 'asc' },
    });
  }

  async createReward(dto: CreateAdminRewardDto) {
    return this.prisma.farmReward.create({ data: dto });
  }

  async updateReward(id: string, dto: Partial<CreateAdminRewardDto>) {
    return this.prisma.farmReward.update({
      where: { id },
      data: dto,
    });
  }

  async deleteReward(id: string) {
    return this.prisma.farmReward.delete({
      where: { id },
    });
  }

  /**
   * Quản lý Nhiệm vụ (Missions Admin CRUD)
   */
  async getAllMissions() {
    return this.prisma.farmMission.findMany({
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createMission(dto: CreateAdminMissionDto) {
    return this.prisma.farmMission.create({
      data: {
        code: dto.code,
        title: dto.title,
        description: dto.description,
        type: dto.type as any,
        actionType: dto.actionType,
        targetCount: dto.targetCount,
        rewardExp: dto.rewardExp ?? 50,
        rewardFarmCoin: dto.rewardFarmCoin ?? 30,
        rewardLoyaltyPoints: dto.rewardLoyaltyPoints ?? 0,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateMission(id: string, dto: Partial<CreateAdminMissionDto>) {
    const data: any = { ...dto };
    if (data.type) data.type = data.type as any;
    return this.prisma.farmMission.update({
      where: { id },
      data,
    });
  }

  async deleteMission(id: string) {
    return this.prisma.farmMission.delete({
      where: { id },
    });
  }

  /**
   * Quản trị Kinh tế & Chỉ số lạm phát (Economy)
   */
  async getEconomyStats() {
    const redemptions = await this.prisma.farmRewardRedemption.aggregate({
      _sum: {
        farmCoinSpent: true,
        loyaltyPointsSpent: true,
      },
      _count: { id: true },
    });

    const coinCirculation = await this.prisma.userFarm.aggregate({
      _sum: { farmCoin: true },
    });

    return {
      totalCoinsCirculation: coinCirculation._sum.farmCoin || 0,
      totalCoinsSpentOnRewards: redemptions._sum.farmCoinSpent || 0,
      totalLoyaltyPointsSpent: redemptions._sum.loyaltyPointsSpent || 0,
      totalRedemptionsCount: redemptions._count.id,
    };
  }

  /**
   * Giám sát Gian lận & Cảnh báo an ninh (Security)
   */
  async getSecurityAlerts() {
    const recentLogs = await this.prisma.farmActivityLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        farm: {
          include: {
            user: { select: { id: true, fullName: true, email: true, memberCode: true } },
          },
        },
      },
    });

    return {
      recentLogs,
      alertCount: 0,
    };
  }

  /**
   * Tra cứu chi tiết Nông trại khách hàng (Farm Inspector)
   */
  async inspectUserFarm(identifier: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: identifier },
          { email: identifier },
          { phone: identifier },
          { memberCode: identifier },
        ],
      },
      include: {
        userFarm: {
          include: {
            plots: {
              include: {
                cropInstance: {
                  include: { crop: true, mutation: true },
                },
              },
              orderBy: { plotIndex: 'asc' },
            },
            inventory: true,
            collections: { include: { crop: true, mutation: true } },
            activityLogs: { take: 20, orderBy: { createdAt: 'desc' } },
            redemptions: { include: { reward: true } },
          },
        },
        membershipTier: true,
      },
    });

    if (!user || !user.userFarm) {
      throw new NotFoundException('Không tìm thấy nông trại tương ứng với người dùng này');
    }

    return user;
  }

  /**
   * Lấy cấu hình bảo trì Nông trại
   */
  async getMaintenanceConfig() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'farm_maintenance' },
    });
    if (!setting) {
      return {
        enabled: false,
        message: 'Khu vườn AVORA Farm đang được các nghệ nhân chăm sóc nâng cấp định kỳ. Quý khách vui lòng trở lại sau!',
        estimatedEndTime: null,
      };
    }
    try {
      return JSON.parse(setting.value);
    } catch {
      return { enabled: false, message: '', estimatedEndTime: null };
    }
  }

  /**
   * Cập nhật trạng thái bảo trì Nông trại
   */
  async setMaintenanceConfig(dto: { enabled: boolean; message?: string; estimatedEndTime?: string }) {
    const value = JSON.stringify({
      enabled: dto.enabled,
      message: dto.message || 'Khu vườn AVORA Farm đang được các nghệ nhân chăm sóc nâng cấp định kỳ. Quý khách vui lòng trở lại sau!',
      estimatedEndTime: dto.estimatedEndTime || null,
      updatedAt: new Date().toISOString(),
    });

    const setting = await this.prisma.systemSetting.upsert({
      where: { key: 'farm_maintenance' },
      update: { value },
      create: { key: 'farm_maintenance', value },
    });

    return JSON.parse(setting.value);
  }

  /**
   * Cấu hình tham số vận hành Game Farm (Game Config)
   */
  async getGameConfig() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'farm_game_config' },
    });

    const defaultConfig = {
      strangerDailyStealLimit: 3,
      friendDailyStealLimit: 10,
      protectionWindowMinutes: 15,
      coinsToPointsRatio: 2,
      maxEnergy: 100,
      maintenanceMode: false,
    };

    if (!setting) return defaultConfig;

    try {
      return { ...defaultConfig, ...JSON.parse(setting.value) };
    } catch {
      return defaultConfig;
    }
  }

  async updateGameConfig(dto: FarmConfigDto) {
    const current = await this.getGameConfig();
    const updated = { ...current, ...dto };

    await this.prisma.systemSetting.upsert({
      where: { key: 'farm_game_config' },
      update: { value: JSON.stringify(updated) },
      create: { key: 'farm_game_config', value: JSON.stringify(updated) },
    });

    return updated;
  }
}
