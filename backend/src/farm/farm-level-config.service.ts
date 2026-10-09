import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLevelConfigDto, UpdateLevelConfigDto } from './dto/farm-level-config.dto';

@Injectable()
export class FarmLevelConfigService {
  private readonly logger = new Logger(FarmLevelConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách toàn bộ cấu hình cấp độ nông trại (tự động seed nếu rỗng)
   */
  async getAllLevels() {
    let levels = await this.prisma.farmLevelConfig.findMany({
      orderBy: { level: 'asc' },
    });

    if (levels.length === 0) {
      this.logger.log('Bảng FarmLevelConfig rỗng, đang khởi tạo cấu hình mặc định (Cấp 1-20)...');
      levels = await this.seedDefaultLevels();
    }

    return levels;
  }

  /**
   * Lấy cấu hình một cấp độ cụ thể
   */
  async getLevel(level: number) {
    const config = await this.prisma.farmLevelConfig.findUnique({
      where: { level },
    });
    if (!config) {
      throw new NotFoundException(`Không tìm thấy cấu hình cho Cấp độ ${level}`);
    }
    return config;
  }

  /**
   * Cập nhật hoặc tạo mới cấu hình cho một cấp độ
   */
  async upsertLevel(level: number, dto: UpdateLevelConfigDto) {
    return this.prisma.farmLevelConfig.upsert({
      where: { level },
      update: {
        expRequired: dto.expRequired ?? 100,
        coinCost: dto.coinCost ?? 0,
        pointCost: dto.pointCost ?? 0,
        requiredCrops: (dto.requiredCrops as any) ?? undefined,
        speedBoost: dto.speedBoost ?? 0,
        energyBonus: dto.energyBonus ?? 5,
        sellPriceBoost: dto.sellPriceBoost ?? 0,
        unlockTitle: dto.unlockTitle,
      },
      create: {
        level,
        expRequired: dto.expRequired ?? 100,
        coinCost: dto.coinCost ?? 0,
        pointCost: dto.pointCost ?? 0,
        requiredCrops: (dto.requiredCrops as any) ?? undefined,
        speedBoost: dto.speedBoost ?? 0,
        energyBonus: dto.energyBonus ?? 5,
        sellPriceBoost: dto.sellPriceBoost ?? 0,
        unlockTitle: dto.unlockTitle,
      },
    });
  }

  /**
   * Tạo cấp độ mới
   */
  async createLevel(dto: CreateLevelConfigDto) {
    return this.prisma.farmLevelConfig.create({
      data: {
        level: dto.level,
        expRequired: dto.expRequired,
        coinCost: dto.coinCost ?? 0,
        pointCost: dto.pointCost ?? 0,
        requiredCrops: (dto.requiredCrops as any) ?? undefined,
        speedBoost: dto.speedBoost ?? 0,
        energyBonus: dto.energyBonus ?? 5,
        sellPriceBoost: dto.sellPriceBoost ?? 0,
        unlockTitle: dto.unlockTitle,
      },
    });
  }

  /**
   * Xóa một cấp độ
   */
  async deleteLevel(level: number) {
    const existing = await this.prisma.farmLevelConfig.findUnique({
      where: { level },
    });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy Cấp độ ${level}`);
    }

    await this.prisma.farmLevelConfig.delete({
      where: { level },
    });

    return { success: true, message: `Đã xóa cấu hình Cấp độ ${level}` };
  }

  /**
   * Khởi tạo cấu hình mặc định ban đầu cho 20 cấp độ
   */
  private async seedDefaultLevels() {
    const defaultConfigs: Array<{
      level: number;
      expRequired: number;
      coinCost: number;
      pointCost: number;
      requiredCrops: Array<{ cropCode: string; quantity: number }>;
      speedBoost: number;
      energyBonus: number;
      sellPriceBoost: number;
      unlockTitle: string;
    }> = [
      {
        level: 1,
        expRequired: 0,
        coinCost: 0,
        pointCost: 0,
        requiredCrops: [],
        speedBoost: 0,
        energyBonus: 30,
        sellPriceBoost: 0,
        unlockTitle: 'Nông Dân Tập Sự',
      },
      {
        level: 2,
        expRequired: 100,
        coinCost: 50,
        pointCost: 10,
        requiredCrops: [{ cropCode: 'JAPANESE_RICE', quantity: 3 }],
        speedBoost: 0.02,
        energyBonus: 5,
        sellPriceBoost: 0.05,
        unlockTitle: 'Gạo Koshihikari & Dâu Tây Tochigi',
      },
      {
        level: 3,
        expRequired: 250,
        coinCost: 120,
        pointCost: 20,
        requiredCrops: [{ cropCode: 'STRAWBERRY', quantity: 3 }],
        speedBoost: 0.04,
        energyBonus: 5,
        sellPriceBoost: 0.08,
        unlockTitle: 'Wasabi Tươi & Hoa Hướng Dương',
      },
      {
        level: 4,
        expRequired: 450,
        coinCost: 250,
        pointCost: 35,
        requiredCrops: [
          { cropCode: 'JAPANESE_RICE', quantity: 5 },
          { cropCode: 'STRAWBERRY', quantity: 2 },
        ],
        speedBoost: 0.065,
        energyBonus: 10,
        sellPriceBoost: 0.12,
        unlockTitle: 'Lá Trà Uji Matcha & Cà Chua Bi',
      },
      {
        level: 5,
        expRequired: 700,
        coinCost: 450,
        pointCost: 50,
        requiredCrops: [{ cropCode: 'MATCHA_LEAF', quantity: 5 }],
        speedBoost: 0.09,
        energyBonus: 10,
        sellPriceBoost: 0.18,
        unlockTitle: 'Quả Yuzu Hoàng Kim & Thửa đất mới',
      },
      {
        level: 6,
        expRequired: 1000,
        coinCost: 700,
        pointCost: 75,
        requiredCrops: [{ cropCode: 'YUZU', quantity: 6 }],
        speedBoost: 0.12,
        energyBonus: 15,
        sellPriceBoost: 0.25,
        unlockTitle: 'Nho Mẫu Đơn Shine Muscat',
      },
      {
        level: 7,
        expRequired: 1400,
        coinCost: 1000,
        pointCost: 100,
        requiredCrops: [
          { cropCode: 'GRAPE', quantity: 6 },
          { cropCode: 'MATCHA_LEAF', quantity: 4 },
        ],
        speedBoost: 0.15,
        energyBonus: 20,
        sellPriceBoost: 0.35,
        unlockTitle: 'Đào Hồng Yamanashi & Thần Điền',
      },
    ];

    // Tạo thêm các cấp từ 8 đến 20 với công thức tăng tiến cân đối
    for (let lv = 8; lv <= 20; lv++) {
      defaultConfigs.push({
        level: lv,
        expRequired: lv * (lv - 1) * 35,
        coinCost: lv * 200,
        pointCost: lv * 25,
        requiredCrops: [
          { cropCode: 'JAPANESE_RICE', quantity: Math.min(20, lv * 2) },
        ],
        speedBoost: Math.min(0.35, lv * 0.02),
        energyBonus: Math.min(50, lv * 3),
        sellPriceBoost: Math.min(0.60, lv * 0.03),
        unlockTitle: `Thần Điền Tầng ${lv}`,
      });
    }

    const createdList: any[] = [];
    for (const item of defaultConfigs) {
      const row = await this.prisma.farmLevelConfig.upsert({
        where: { level: item.level },
        update: {},
        create: {
          level: item.level,
          expRequired: item.expRequired,
          coinCost: item.coinCost,
          pointCost: item.pointCost,
          requiredCrops: item.requiredCrops as any,
          speedBoost: item.speedBoost,
          energyBonus: item.energyBonus,
          sellPriceBoost: item.sellPriceBoost,
          unlockTitle: item.unlockTitle,
        },
      });
      createdList.push(row);
    }

    return createdList;
  }
}
