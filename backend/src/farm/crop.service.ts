import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FarmCropCategory, FarmRarity, FarmMutationType } from '@prisma/client';

export interface CalculatedCropState {
  stage: number; // 0: Seed, 1: Sprout, 2: Young, 3: Growing, 4: Mature, 5: Ready
  progressPercent: number;
  secondsRemaining: number;
  isReady: boolean;
}

@Injectable()
export class CropService implements OnModuleInit {
  private readonly logger = new Logger(CropService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultCropsAndMutations();
  }

  async getAllCrops() {
    return this.prisma.farmCrop.findMany({
      where: { isAvailable: true },
      include: { mutations: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getCropByCode(code: string) {
    return this.prisma.farmCrop.findUnique({
      where: { code },
      include: { mutations: true },
    });
  }

  async getAllMutations() {
    return this.prisma.farmCropMutation.findMany({
      include: { sourceCrop: true },
      orderBy: { rarity: 'asc' },
    });
  }

  /**
   * Tính toán giai đoạn và tiến độ lớn dựa trên timestamp math mà không cần timer server
   */
  calculateGrowthState(instance: {
    plantedAt: Date;
    stage1At: Date;
    stage2At: Date;
    stage3At: Date;
    readyAt: Date;
    harvestedAt?: Date | null;
  }): CalculatedCropState {
    const now = new Date().getTime();
    const plantedTime = new Date(instance.plantedAt).getTime();
    const s1 = new Date(instance.stage1At).getTime();
    const s2 = new Date(instance.stage2At).getTime();
    const s3 = new Date(instance.stage3At).getTime();
    const readyTime = new Date(instance.readyAt).getTime();

    const totalDuration = readyTime - plantedTime;
    const elapsed = Math.max(0, now - plantedTime);
    const progressPercent = Math.min(100, Math.round((elapsed / totalDuration) * 100));
    const secondsRemaining = Math.max(0, Math.ceil((readyTime - now) / 1000));

    if (now >= readyTime) {
      return {
        stage: 5,
        progressPercent: 100,
        secondsRemaining: 0,
        isReady: true,
      };
    }

    let stage = 0;
    if (now >= s3) {
      stage = 4; // Mature
    } else if (now >= s2) {
      stage = 3; // Growing
    } else if (now >= s1) {
      stage = 2; // Young
    } else if (elapsed > 0) {
      stage = 1; // Sprout
    } else {
      stage = 0; // Seed
    }

    return {
      stage,
      progressPercent,
      secondsRemaining,
      isReady: false,
    };
  }

  /**
   * Khởi tạo danh mục hạt giống & đột biến mẫu nếu DB chưa có
   */
  async seedDefaultCropsAndMutations() {
    const count = await this.prisma.farmCrop.count();
    if (count > 0) return;

    this.logger.log('Seeding initial AVORA Farm crops and mutations...');

    const defaultCrops = [
      // 1. Japanese Ingredients
      {
        code: 'JAPANESE_RICE',
        name: 'Gạo Koshihikari',
        category: FarmCropCategory.JAPANESE_INGREDIENT,
        rarity: FarmRarity.COMMON,
        description: 'Hạt ngọc trời Nhật Bản dẻo thơm, linh hồn của mọi món Sushi Avora.',
        growDuration: 120, // 2 phút (dễ trải nghiệm)
        seedPrice: 10,
        sellPrice: 15,
        baseYield: 4,
        rewardExp: 15,
        rewardFarmCoin: 15,
        rewardLoyaltyPoints: 0,
        baseMutationRate: 0.08,
        minFarmLevel: 1,
        sortOrder: 1,
      },
      {
        code: 'WASABI',
        name: 'Wasabi Tươi Shizuoka',
        category: FarmCropCategory.JAPANESE_INGREDIENT,
        rarity: FarmRarity.RARE,
        description: 'Củ wasabi thượng hạng trồng bên dòng suối trong vắt từ chân núi Phú Sĩ.',
        growDuration: 600, // 10 phút
        seedPrice: 40,
        sellPrice: 65,
        baseYield: 3,
        rewardExp: 45,
        rewardFarmCoin: 50,
        rewardLoyaltyPoints: 0,
        baseMutationRate: 0.1,
        minFarmLevel: 2,
        sortOrder: 2,
      },
      {
        code: 'SHISO',
        name: 'Tía Tô Đỏ Shiso',
        category: FarmCropCategory.JAPANESE_INGREDIENT,
        rarity: FarmRarity.UNCOMMON,
        description: 'Lá tía tô đỏ thanh nhã, tôn vinh hương vị cá tươi của đại dương.',
        growDuration: 300, // 5 phút
        seedPrice: 20,
        sellPrice: 32,
        baseYield: 4,
        rewardExp: 25,
        rewardFarmCoin: 28,
        rewardLoyaltyPoints: 0,
        baseMutationRate: 0.06,
        minFarmLevel: 2,
        sortOrder: 3,
      },
      {
        code: 'MATCHA_LEAF',
        name: 'Lá Trà Uji Matcha',
        category: FarmCropCategory.JAPANESE_INGREDIENT,
        rarity: FarmRarity.EPIC,
        description: 'Những búp trà xanh thượng phẩm từ vùng đất cố đô Kyoto.',
        growDuration: 1200, // 20 phút
        seedPrice: 80,
        sellPrice: 130,
        baseYield: 3,
        rewardExp: 80,
        rewardFarmCoin: 90,
        rewardLoyaltyPoints: 1,
        baseMutationRate: 0.12,
        minFarmLevel: 4,
        sortOrder: 4,
      },
      {
        code: 'YUZU',
        name: 'Quả Yuzu Hoàng Kim',
        category: FarmCropCategory.JAPANESE_INGREDIENT,
        rarity: FarmRarity.RARE,
        description: 'Chanh vàng thanh khiết với hương thơm nồng nàn đặc trưng của ẩm thực Nhật.',
        growDuration: 1800, // 30 phút
        seedPrice: 100,
        sellPrice: 160,
        baseYield: 3,
        rewardExp: 100,
        rewardFarmCoin: 110,
        rewardLoyaltyPoints: 1,
        baseMutationRate: 0.1,
        minFarmLevel: 5,
        sortOrder: 5,
      },

      // 2. Fruits
      {
        code: 'STRAWBERRY',
        name: 'Dâu Tây Tochigi',
        category: FarmCropCategory.FRUIT,
        rarity: FarmRarity.COMMON,
        description: 'Những quả dâu tây đỏ mọng nước, ngọt lịm như giọt sương mai.',
        growDuration: 240, // 4 phút
        seedPrice: 15,
        sellPrice: 22,
        baseYield: 4,
        rewardExp: 20,
        rewardFarmCoin: 20,
        rewardLoyaltyPoints: 0,
        baseMutationRate: 0.08,
        minFarmLevel: 1,
        sortOrder: 6,
      },
      {
        code: 'GRAPE',
        name: 'Nho Shine Muscat',
        category: FarmCropCategory.FRUIT,
        rarity: FarmRarity.EPIC,
        description: 'Chùm nho mẫu đơn xanh ngọc bích giòn ngọt, đỉnh cao trái cây Nhật Bản.',
        growDuration: 2400, // 40 phút
        seedPrice: 120,
        sellPrice: 200,
        baseYield: 4,
        rewardExp: 120,
        rewardFarmCoin: 140,
        rewardLoyaltyPoints: 1,
        baseMutationRate: 0.12,
        minFarmLevel: 6,
        sortOrder: 7,
      },
      {
        code: 'PEACH',
        name: 'Đào Hồng Yamanashi',
        category: FarmCropCategory.FRUIT,
        rarity: FarmRarity.RARE,
        description: 'Trái đào tiên căng mọng thơm ngát tỏa sắc hồng diệu kỳ.',
        growDuration: 3600, // 1 giờ
        seedPrice: 150,
        sellPrice: 250,
        baseYield: 3,
        rewardExp: 150,
        rewardFarmCoin: 180,
        rewardLoyaltyPoints: 2,
        baseMutationRate: 0.15,
        minFarmLevel: 8,
        sortOrder: 8,
      },

      // 3. Fantasy Food (Avora Signature)
      {
        code: 'SALMON_BLOSSOM',
        name: 'Hoa Hồi Cá Hồi',
        category: FarmCropCategory.FANTASY_FOOD,
        rarity: FarmRarity.EPIC,
        description: 'Cánh hoa bung nở từ vân mỡ cá hồi Nauy tươi rói, tuyệt phẩm độc quyền AVORA.',
        growDuration: 900, // 15 phút
        seedPrice: 70,
        sellPrice: 120,
        baseYield: 4,
        rewardExp: 75,
        rewardFarmCoin: 85,
        rewardLoyaltyPoints: 1,
        baseMutationRate: 0.15,
        minFarmLevel: 3,
        sortOrder: 9,
      },
      {
        code: 'TUNA_CORAL',
        name: 'San Hô Ngừ Đại Dương',
        category: FarmCropCategory.FANTASY_FOOD,
        rarity: FarmRarity.LEGENDARY,
        description: 'Bụi san hô kết tinh từ phần thịt bụng cá ngừ Otoro đỏ thắm dưới đáy đại dương.',
        growDuration: 2700, // 45 phút
        seedPrice: 160,
        sellPrice: 280,
        baseYield: 3,
        rewardExp: 180,
        rewardFarmCoin: 220,
        rewardLoyaltyPoints: 2,
        baseMutationRate: 0.15,
        minFarmLevel: 7,
        sortOrder: 10,
      },
      {
        code: 'WASABI_CRYSTAL',
        name: 'Pha Lê Wasabi',
        category: FarmCropCategory.FANTASY_FOOD,
        rarity: FarmRarity.LEGENDARY,
        description: 'Khối tinh thể ngọc bích cay nồng lấp lánh như kim cương hoàng gia.',
        growDuration: 5400, // 1.5 giờ
        seedPrice: 250,
        sellPrice: 450,
        baseYield: 2,
        rewardExp: 250,
        rewardFarmCoin: 300,
        rewardLoyaltyPoints: 3,
        baseMutationRate: 0.18,
        minFarmLevel: 10,
        sortOrder: 11,
      },
      {
        code: 'SAKURA_PEARL',
        name: 'Ngọc Trai Anh Đào',
        category: FarmCropCategory.FANTASY_FOOD,
        rarity: FarmRarity.MYTHIC,
        description: 'Hạt ngọc kỳ ảo phát sáng lung linh, tích tụ tinh hoa đất trời ngàn năm của AVORA.',
        growDuration: 7200, // 2 giờ
        seedPrice: 500,
        sellPrice: 1000,
        baseYield: 2,
        rewardExp: 500,
        rewardFarmCoin: 600,
        rewardLoyaltyPoints: 5,
        baseMutationRate: 0.2,
        minFarmLevel: 12,
        sortOrder: 12,
      },
    ];

    for (const cropData of defaultCrops) {
      const created = await this.prisma.farmCrop.create({ data: cropData });

      // Tạo các đột biến tương ứng cho từng loại cây
      if (cropData.code === 'STRAWBERRY') {
        await this.prisma.farmCropMutation.createMany({
          data: [
            {
              code: 'CRYSTAL_STRAWBERRY',
              name: 'Dâu Tây Pha Lê',
              sourceCropId: created.id,
              mutationType: FarmMutationType.CRYSTAL_MUTATION,
              rarity: FarmRarity.RARE,
              description: 'Thân dâu trong suốt như thủy tinh, tỏa ánh sáng lam ngọc thanh khiết.',
              mutationChance: 0.12,
              yieldMultiplier: 1.5,
              rewardExp: 60,
              rewardFarmCoin: 60,
              rewardLoyaltyPoints: 1,
              collectionScore: 100,
            },
            {
              code: 'MOONLIGHT_STRAWBERRY',
              name: 'Dâu Tây Ánh Trăng',
              sourceCropId: created.id,
              mutationType: FarmMutationType.MOONLIGHT_MUTATION,
              rarity: FarmRarity.EPIC,
              description: 'Hấp thụ ánh trăng rằm, phát quang ánh bạc huyền ảo lung linh.',
              mutationChance: 0.05,
              yieldMultiplier: 2.0,
              rewardExp: 120,
              rewardFarmCoin: 140,
              rewardLoyaltyPoints: 2,
              collectionScore: 250,
            },
            {
              code: 'SAKURA_QUEEN_STRAWBERRY',
              name: 'Nữ Hoàng Dâu Sakura',
              sourceCropId: created.id,
              mutationType: FarmMutationType.SAKURA_MUTATION,
              rarity: FarmRarity.LEGENDARY,
              description: 'Bảo vật vương giả tỏa ngát hương hoa anh đào và ánh hào quang màu hồng phấn.',
              mutationChance: 0.015,
              yieldMultiplier: 3.0,
              rewardExp: 300,
              rewardFarmCoin: 350,
              rewardLoyaltyPoints: 5,
              collectionScore: 600,
            },
          ],
        });
      } else if (cropData.code === 'JAPANESE_RICE') {
        await this.prisma.farmCropMutation.createMany({
          data: [
            {
              code: 'GOLDEN_RICE',
              name: 'Lúa Vàng 24K',
              sourceCropId: created.id,
              mutationType: FarmMutationType.GOLDEN_MUTATION,
              rarity: FarmRarity.UNCOMMON,
              description: 'Từng hạt thóc dát vàng óng ánh, biểu tượng của phú quý và no ấm.',
              mutationChance: 0.15,
              yieldMultiplier: 1.5,
              rewardExp: 40,
              rewardFarmCoin: 50,
              rewardLoyaltyPoints: 0,
              collectionScore: 80,
            },
            {
              code: 'MOONLIGHT_RICE',
              name: 'Gạo Nguyệt Quang',
              sourceCropId: created.id,
              mutationType: FarmMutationType.MOONLIGHT_MUTATION,
              rarity: FarmRarity.RARE,
              description: 'Bông lúa phát sáng ánh trăng dịu êm giữa đêm thanh tịnh.',
              mutationChance: 0.06,
              yieldMultiplier: 2.0,
              rewardExp: 90,
              rewardFarmCoin: 100,
              rewardLoyaltyPoints: 1,
              collectionScore: 200,
            },
          ],
        });
      } else if (cropData.code === 'WASABI') {
        await this.prisma.farmCropMutation.createMany({
          data: [
            {
              code: 'GOLDEN_WASABI',
              name: 'Wasabi Hoàng Gia',
              sourceCropId: created.id,
              mutationType: FarmMutationType.GOLDEN_MUTATION,
              rarity: FarmRarity.EPIC,
              description: 'Củ wasabi đúc từ vàng ròng, gia vị quý giá chỉ dành cho các bậc đế vương.',
              mutationChance: 0.08,
              yieldMultiplier: 2.0,
              rewardExp: 150,
              rewardFarmCoin: 180,
              rewardLoyaltyPoints: 2,
              collectionScore: 350,
            },
          ],
        });
      } else if (cropData.code === 'SALMON_BLOSSOM') {
        await this.prisma.farmCropMutation.createMany({
          data: [
            {
              code: 'RAINBOW_SALMON_BLOSSOM',
              name: 'Hoa Hồi Cầu Vồng',
              sourceCropId: created.id,
              mutationType: FarmMutationType.RAINBOW_MUTATION,
              rarity: FarmRarity.EPIC,
              description: 'Cánh hoa đổi màu theo sắc cầu vồng, thơm ngon đậm đà khó cưỡng.',
              mutationChance: 0.09,
              yieldMultiplier: 2.0,
              rewardExp: 180,
              rewardFarmCoin: 200,
              rewardLoyaltyPoints: 2,
              collectionScore: 400,
            },
            {
              code: 'AVORA_DRAGON_SALMON',
              name: 'Long Hoa Cá Hồi AVORA',
              sourceCropId: created.id,
              mutationType: FarmMutationType.AVORA_MUTATION,
              rarity: FarmRarity.MYTHIC,
              description: 'Tuyệt đỉnh đột biến thần thoại! Thần Long hộ thể mang phúc lành đến thực khách.',
              mutationChance: 0.008,
              yieldMultiplier: 4.0,
              rewardExp: 800,
              rewardFarmCoin: 1000,
              rewardLoyaltyPoints: 10,
              collectionScore: 1200,
            },
          ],
        });
      }
    }

    this.logger.log('Seeded AVORA Farm default crops & mutations successfully.');
  }
}
