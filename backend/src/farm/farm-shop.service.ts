import { Injectable, BadRequestException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { FarmGateway } from './farm.gateway';
import { FarmItemType, FarmRarity, FarmCropCategory } from '@prisma/client';

import { FarmTransactionService } from './farm-transaction.service';

@Injectable()
export class FarmShopService implements OnModuleInit {
  private readonly logger = new Logger(FarmShopService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly farmGateway: FarmGateway,
    private readonly transactionService: FarmTransactionService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultDecorations();
    await this.seedMissingCrops();
  }

  /**
   * Lấy danh mục hàng hóa trong Siêu Cửa Hàng AVORA (Seed Shop & Produce Exchange)
   */
  async getShopCatalog(userId: string) {
    const crops = await this.prisma.farmCrop.findMany({
      where: { isAvailable: true },
      orderBy: { minFarmLevel: 'asc' },
    });

    const decorations = await this.prisma.farmDecoration.findMany({
      where: { isAvailable: true },
      orderBy: { unlockLevel: 'asc' },
    });

    const fertilizers = [
      {
        code: 'FERTILIZER_SPEED',
        name: 'Phân Bón Sinh Học Siêu Tốc',
        description: 'Giúp rễ cây hấp thụ dinh dưỡng nhanh hơn, rút ngắn 35% thời gian sinh trưởng.',
        price: 30,
        rarity: FarmRarity.UNCOMMON,
        type: FarmItemType.FERTILIZER,
      },
      {
        code: 'FERTILIZER_MUTATION',
        name: 'Huyết Thanh Đột Biến Gen',
        description: 'Kích thích biến dị thực vật, tăng +15% cơ hội đột biến quý hiếm.',
        price: 60,
        rarity: FarmRarity.RARE,
        type: FarmItemType.FERTILIZER,
      },
      {
        code: 'FERTILIZER_YIELD',
        name: 'Bột Khoáng Đại Dương',
        description: 'Tăng thêm 2 sản lượng thu hoạch cho cây trồng.',
        price: 45,
        rarity: FarmRarity.RARE,
        type: FarmItemType.FERTILIZER,
      },
    ];

    const seedPacks = [
      {
        code: 'SEED_PACK_BASIC',
        name: 'Gói Hạt Giống Thường',
        description: 'Chứa 3-5 hạt giống các loại cấp 1-2 (Gạo Koshihikari, Dâu Tây Tochigi, Bắp Ngô Nếp).',
        price: 45,
        rarity: FarmRarity.COMMON,
        icon: '/game/farm/items/chest_wood.png',
        timerTag: '17d 8h',
        limitText: 'Không giới hạn',
      },
      {
        code: 'SEED_PACK_RARE',
        name: 'Gói Hạt Giống Quý Hiếm',
        description: 'Chứa 3-5 hạt giống hiếm và phân bón (Wasabi, Tía Tô, Hoa Hướng Dương, Cà Chua Bi).',
        price: 120,
        rarity: FarmRarity.RARE,
        icon: '/game/farm/items/chest_gold.png',
        timerTag: '17d 8h',
        limitText: '5/5 mỗi tuần',
      },
      {
        code: 'SEED_PACK_LEGENDARY',
        name: 'Gói Thần Nông Bí Ẩn',
        description: 'Chứa hạt giống thượng phẩm (Matcha, Yuzu, Nho Mẫu Đơn) cùng Huyết Thanh Đột Biến!',
        price: 280,
        rarity: FarmRarity.LEGENDARY,
        icon: '/game/farm/items/chest_legendary.png',
        timerTag: '26d 8h',
        limitText: '1/1 mỗi tuần',
        isHot: true,
      },
    ];

    const produceExchanges = [
      {
        code: 'EXCHANGE_FERT_SPEED',
        name: 'Phân Bón Sinh Học Siêu Tốc',
        description: 'Dùng 5 Gạo Koshihikari đổi lấy 1 Phân Bón Siêu Tốc.',
        requiredCropCode: 'JAPANESE_RICE',
        requiredCropName: 'Gạo Koshihikari',
        requiredCropQty: 5,
        rewardItemCode: 'FERTILIZER_SPEED',
        rewardItemName: 'Phân Bón Sinh Học Siêu Tốc',
        rewardType: FarmItemType.FERTILIZER,
        rewardQty: 1,
        icon: '/game/farm/items/fertilizer_speed.png',
        timerTag: '17d 8h',
        limitText: '50/50 có thể đổi',
      },
      {
        code: 'EXCHANGE_FERT_MUTATION',
        name: 'Huyết Thanh Đột Biến Gen',
        description: 'Dùng 5 Dâu Tây Tochigi đổi lấy 1 Huyết Thanh Đột Biến Gen.',
        requiredCropCode: 'STRAWBERRY',
        requiredCropName: 'Dâu Tây Tochigi',
        requiredCropQty: 5,
        rewardItemCode: 'FERTILIZER_MUTATION',
        rewardItemName: 'Huyết Thanh Đột Biến Gen',
        rewardType: FarmItemType.FERTILIZER,
        rewardQty: 1,
        icon: '/game/farm/items/fertilizer_mutation.png',
        timerTag: '17d 8h',
        limitText: '20/20 có thể đổi',
      },
      {
        code: 'EXCHANGE_FERT_YIELD',
        name: 'Bột Khoáng Đại Dương',
        description: 'Dùng 4 Wasabi Tươi đổi lấy 1 Bột Khoáng Đại Dương (+2 sản lượng).',
        requiredCropCode: 'WASABI',
        requiredCropName: 'Wasabi Tươi',
        requiredCropQty: 4,
        rewardItemCode: 'FERTILIZER_YIELD',
        rewardItemName: 'Bột Khoáng Đại Dương',
        rewardType: FarmItemType.FERTILIZER,
        rewardQty: 1,
        icon: '/game/farm/items/fertilizer_yield.png',
        timerTag: '26d 8h',
        limitText: '10/10 có thể đổi',
      },
      {
        code: 'EXCHANGE_AVORA_VOUCHER_50K',
        name: 'Voucher Giảm 50.000đ AVORA',
        description: 'Dùng 6 Lá Trà Uji Matcha đổi lấy Voucher 50.000đ dùng tại nhà hàng AVORA.',
        requiredCropCode: 'MATCHA_LEAF',
        requiredCropName: 'Lá Trà Uji Matcha',
        requiredCropQty: 6,
        rewardItemCode: 'VOUCHER_50K',
        rewardItemName: 'Voucher Ẩm Thực 50.000đ',
        rewardType: FarmItemType.EVENT,
        rewardQty: 1,
        icon: '/game/farm/items/ring_luxury.png',
        timerTag: '14d 12h',
        limitText: '1/1 có thể đổi',
        isHot: true,
      },
      {
        code: 'EXCHANGE_VIP_CHEST',
        name: 'Rương Trang Phục Chọn 1',
        description: 'Dùng 8 Nho Shine Muscat đổi Rương Thời Trang Thần Nông độc quyền!',
        requiredCropCode: 'GRAPE',
        requiredCropName: 'Nho Shine Muscat',
        requiredCropQty: 8,
        rewardItemCode: 'COSTUME_CHEST',
        rewardItemName: 'Rương Trang Phục Chọn 1',
        rewardType: FarmItemType.EVENT,
        rewardQty: 1,
        icon: '/game/farm/items/chest_gold.png',
        timerTag: '17d 8h',
        limitText: '1/1 có thể đổi',
        isHot: true,
      },
    ];

    return {
      seeds: crops.map((c) => ({
        code: c.code,
        name: c.name,
        category: c.category,
        rarity: c.rarity,
        price: c.seedPrice,
        sellPrice: c.sellPrice,
        growDuration: c.growDuration,
        minFarmLevel: c.minFarmLevel,
        description: c.description,
      })),
      fertilizers,
      decorations,
      seedPacks,
      produceExchanges,
    };
  }

  /**
   * Mua hạt giống, phân bón hoặc Gói hạt giống ngẫu nhiên bằng Farm Coin
   */
  async purchaseItem(userId: string, itemCode: string, quantity: number = 1) {
    if (quantity < 1) throw new BadRequestException('Số lượng phải từ 1 trở lên');

    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({
        where: { userId },
      });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      // 1. Kiểm tra xem có phải mua Gói Hạt Giống Ngẫu Nhiên không
      const SEED_PACK_PRICES: Record<string, { price: number; name: string; rarity: FarmRarity }> = {
        SEED_PACK_BASIC: {
          price: 45,
          name: 'Gói Hạt Giống Thường',
          rarity: FarmRarity.COMMON,
        },
        SEED_PACK_RARE: {
          price: 120,
          name: 'Gói Hạt Giống Quý Hiếm',
          rarity: FarmRarity.RARE,
        },
        SEED_PACK_LEGENDARY: {
          price: 280,
          name: 'Gói Thần Nông Bí Ẩn',
          rarity: FarmRarity.LEGENDARY,
        },
        MYSTERY_SEED_PACK: {
          price: 60,
          name: 'Gói Hạt Giống Bí Ẩn',
          rarity: FarmRarity.RARE,
        },
      };

      if (SEED_PACK_PRICES[itemCode]) {
        const pack = SEED_PACK_PRICES[itemCode];
        const totalCost = pack.price * quantity;
        if (farm.farmCoin < totalCost) {
          throw new BadRequestException(`Không đủ Farm Coin (Cần ${totalCost}, bạn có: ${farm.farmCoin})`);
        }

        await tx.userFarm.update({
          where: { id: farm.id },
          data: { farmCoin: { decrement: totalCost } },
        });

        // Thêm vào kho dưới dạng item nguyên vẹn, tuyệt đối không reveal trước
        await this.inventoryService.addItem(tx, farm.id, {
          itemType: FarmItemType.SEED,
          referenceId: itemCode,
          itemName: pack.name,
          itemCode,
          quantity,
          rarity: pack.rarity,
        });

        await tx.farmActivityLog.create({
          data: {
            userId,
            farmId: farm.id,
            action: 'BUY_MYSTERY_PACK',
            details: { itemCode, quantity, totalCost },
          },
        });

        // Ghi FarmTransaction Ledger
        await this.transactionService.recordTransaction(tx, {
          userId,
          farmId: farm.id,
          type: 'ITEM_PURCHASE',
          source: 'SHOP',
          referenceId: `BUY_PACK_${Date.now()}`,
          itemId: itemCode,
          itemCode,
          itemNameSnapshot: pack.name,
          itemIconUrl: '🎁',
          quantity,
          unitPrice: pack.price,
          totalValue: totalCost,
          farmCoinDelta: -totalCost,
          balanceCoinAfter: farm.farmCoin - totalCost,
          status: 'COMPLETED',
        });

        this.farmGateway.emitFarmUpdated(userId, { farmCoin: farm.farmCoin - totalCost });
        return {
          success: true,
          isPack: true,
          itemCode,
          packName: pack.name,
          quantity,
          totalCost,
          remainingCoin: farm.farmCoin - totalCost,
        };
      }

      // 2. Kiểm tra xem có phải mua Hạt giống đơn lẻ không
      const crop = await tx.farmCrop.findUnique({ where: { code: itemCode } });
      if (crop) {
        if (farm.level < crop.minFarmLevel) {
          throw new BadRequestException(`Cần cấp độ Lv.${crop.minFarmLevel} để mua hạt giống ${crop.name}`);
        }
        const totalCost = crop.seedPrice * quantity;
        if (farm.farmCoin < totalCost) {
          throw new BadRequestException(`Không đủ Farm Coin (Cần ${totalCost}, bạn có: ${farm.farmCoin})`);
        }

        await tx.userFarm.update({
          where: { id: farm.id },
          data: { farmCoin: { decrement: totalCost } },
        });

        await this.inventoryService.addItem(tx, farm.id, {
          itemType: FarmItemType.SEED,
          referenceId: crop.id,
          itemName: `Hạt giống ${crop.name}`,
          itemCode: crop.code,
          quantity,
          rarity: crop.rarity,
        });

        await tx.farmActivityLog.create({
          data: {
            userId,
            farmId: farm.id,
            action: 'BUY_SEED',
            details: { itemCode, quantity, totalCost },
          },
        });

        // Ghi FarmTransaction Ledger
        await this.transactionService.recordTransaction(tx, {
          userId,
          farmId: farm.id,
          type: 'SEED_PURCHASE',
          source: 'SHOP',
          referenceId: `BUY_SEED_${Date.now()}`,
          itemId: crop.id,
          itemCode: crop.code,
          itemNameSnapshot: `Hạt giống ${crop.name}`,
          itemIconUrl: crop.iconUrl || '🌱',
          quantity,
          unitPrice: crop.seedPrice,
          totalValue: totalCost,
          farmCoinDelta: -totalCost,
          balanceCoinAfter: farm.farmCoin - totalCost,
          status: 'COMPLETED',
        });

        this.farmGateway.emitFarmUpdated(userId, { farmCoin: farm.farmCoin - totalCost });
        return { success: true, itemCode, quantity, totalCost, remainingCoin: farm.farmCoin - totalCost };
      }

      // 3. Kiểm tra xem có phải mua Phân bón không
      const FERTILIZER_PRICES: Record<string, { price: number; name: string; rarity: FarmRarity }> = {
        FERTILIZER_SPEED: { price: 30, name: 'Phân Bón Sinh Học Siêu Tốc', rarity: FarmRarity.UNCOMMON },
        FERTILIZER_MUTATION: { price: 60, name: 'Huyết Thanh Đột Biến Gen', rarity: FarmRarity.RARE },
        FERTILIZER_YIELD: { price: 45, name: 'Bột Khoáng Đại Dương', rarity: FarmRarity.RARE },
      };

      if (FERTILIZER_PRICES[itemCode]) {
        const fert = FERTILIZER_PRICES[itemCode];
        const totalCost = fert.price * quantity;
        if (farm.farmCoin < totalCost) {
          throw new BadRequestException(`Không đủ Farm Coin (Cần ${totalCost}, bạn có: ${farm.farmCoin})`);
        }

        await tx.userFarm.update({
          where: { id: farm.id },
          data: { farmCoin: { decrement: totalCost } },
        });

        await this.inventoryService.addItem(tx, farm.id, {
          itemType: FarmItemType.FERTILIZER,
          referenceId: itemCode,
          itemName: fert.name,
          itemCode,
          quantity,
          rarity: fert.rarity,
        });

        // Ghi FarmTransaction Ledger
        await this.transactionService.recordTransaction(tx, {
          userId,
          farmId: farm.id,
          type: 'ITEM_PURCHASE',
          source: 'SHOP',
          referenceId: `BUY_FERT_${Date.now()}`,
          itemId: itemCode,
          itemCode,
          itemNameSnapshot: fert.name,
          itemIconUrl: '🧪',
          quantity,
          unitPrice: fert.price,
          totalValue: totalCost,
          farmCoinDelta: -totalCost,
          balanceCoinAfter: farm.farmCoin - totalCost,
          status: 'COMPLETED',
        });

        this.farmGateway.emitFarmUpdated(userId, { farmCoin: farm.farmCoin - totalCost });
        return { success: true, itemCode, quantity, totalCost, remainingCoin: farm.farmCoin - totalCost };
      }

      throw new NotFoundException(`Vật phẩm ${itemCode} không có trong cửa hàng`);
    });
  }

  /**
   * Đổi nông sản đã thu hoạch lấy vật phẩm/phân bón/voucher
   */
  async exchangeProduce(userId: string, exchangeCode: string) {
    const EXCHANGES: Record<string, {
      reqCropCode: string;
      reqCropName: string;
      reqCropQty: number;
      rewardCode: string;
      rewardName: string;
      rewardType: FarmItemType;
      rewardQty: number;
    }> = {
      EXCHANGE_FERT_SPEED: {
        reqCropCode: 'JAPANESE_RICE',
        reqCropName: 'Gạo Koshihikari',
        reqCropQty: 5,
        rewardCode: 'FERTILIZER_SPEED',
        rewardName: 'Phân Bón Sinh Học Siêu Tốc',
        rewardType: FarmItemType.FERTILIZER,
        rewardQty: 1,
      },
      EXCHANGE_FERT_MUTATION: {
        reqCropCode: 'STRAWBERRY',
        reqCropName: 'Dâu Tây Tochigi',
        reqCropQty: 5,
        rewardCode: 'FERTILIZER_MUTATION',
        rewardName: 'Huyết Thanh Đột Biến Gen',
        rewardType: FarmItemType.FERTILIZER,
        rewardQty: 1,
      },
      EXCHANGE_FERT_YIELD: {
        reqCropCode: 'WASABI',
        reqCropName: 'Wasabi Tươi',
        reqCropQty: 4,
        rewardCode: 'FERTILIZER_YIELD',
        rewardName: 'Bột Khoáng Đại Dương',
        rewardType: FarmItemType.FERTILIZER,
        rewardQty: 1,
      },
      EXCHANGE_AVORA_VOUCHER_50K: {
        reqCropCode: 'MATCHA_LEAF',
        reqCropName: 'Lá Trà Uji Matcha',
        reqCropQty: 6,
        rewardCode: 'VOUCHER_50K',
        rewardName: 'Voucher Ẩm Thực 50.000đ',
        rewardType: FarmItemType.EVENT,
        rewardQty: 1,
      },
      EXCHANGE_VIP_CHEST: {
        reqCropCode: 'GRAPE',
        reqCropName: 'Nho Shine Muscat',
        reqCropQty: 8,
        rewardCode: 'COSTUME_CHEST',
        rewardName: 'Rương Trang Phục Chọn 1',
        rewardType: FarmItemType.EVENT,
        rewardQty: 1,
      },
    };

    const ex = EXCHANGES[exchangeCode];
    if (!ex) throw new BadRequestException('Mã trao đổi không hợp lệ');

    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({ where: { userId } });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const crop = await tx.farmCrop.findUnique({ where: { code: ex.reqCropCode } });
      if (!crop) throw new NotFoundException('Không tìm thấy nông sản yêu cầu');

      const invItem = await tx.farmInventoryItem.findFirst({
        where: {
          farmId: farm.id,
          itemType: FarmItemType.CROP,
          referenceId: { in: [crop.code, crop.id] },
        },
      });

      if (!invItem || invItem.quantity < ex.reqCropQty) {
        throw new BadRequestException(
          `Bạn không đủ ${ex.reqCropName} để đổi! (Cần: ${ex.reqCropQty}, có: ${invItem?.quantity || 0})`,
        );
      }

      // Trừ nông sản
      await this.inventoryService.consumeItem(tx, farm.id, FarmItemType.CROP, crop.code, ex.reqCropQty);

      // Trao vật phẩm thưởng
      await this.inventoryService.addItem(tx, farm.id, {
        itemType: ex.rewardType,
        referenceId: ex.rewardCode,
        itemName: ex.rewardName,
        itemCode: ex.rewardCode,
        quantity: ex.rewardQty,
      });

      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'EXCHANGE_CROP',
          details: { exchangeCode, reqCropQty: ex.reqCropQty, rewardCode: ex.rewardCode },
        },
      });

      // Ghi FarmTransaction Ledger
      await this.transactionService.recordTransaction(tx, {
        userId,
        farmId: farm.id,
        type: 'ITEM_PURCHASE',
        source: 'SHOP',
        referenceId: `EXCHANGE_PRODUCE_${Date.now()}`,
        itemCode: ex.rewardCode,
        itemNameSnapshot: ex.rewardName,
        itemIconUrl: '🌾',
        quantity: ex.rewardQty || 1,
        status: 'COMPLETED',
        metadata: { exchangeCode, requiredCrop: `${ex.reqCropQty}x ${ex.reqCropName}` },
      });

      return {
        success: true,
        message: `Đã đổi thành công ${ex.reqCropQty}x ${ex.reqCropName} lấy 1x ${ex.rewardName}!`,
        rewardName: ex.rewardName,
        rewardQty: ex.rewardQty,
      };
    });
  }

  /**
   * Bán nông sản thu hoạch để lấy Farm Coin
   */
  async sellCrop(userId: string, itemCode: string, quantity: number = 1) {
    if (quantity < 1) throw new BadRequestException('Số lượng phải từ 1 trở lên');

    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.userFarm.findUnique({ where: { userId } });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const crop = await tx.farmCrop.findUnique({ where: { code: itemCode } });
      const mutation = await tx.farmCropMutation.findUnique({ where: { code: itemCode } });

      let unitPrice = 10;
      let refId = '';
      let itemType: FarmItemType = FarmItemType.CROP;

      if (crop) {
        unitPrice = this.inventoryService.calculateEffectiveSellPrice(crop, null);
        refId = crop.code;
        itemType = FarmItemType.CROP;
      } else if (mutation) {
        unitPrice = this.inventoryService.calculateEffectiveSellPrice(null, mutation);
        refId = mutation.code;
        itemType = FarmItemType.MUTATION_CROP;
      } else {
        throw new NotFoundException('Không tìm thấy nông sản cần bán');
      }

      // Trừ nông sản trong kho
      await this.inventoryService.consumeItem(tx, farm.id, itemType, refId, quantity);

      const totalEarned = unitPrice * quantity;
      await tx.userFarm.update({
        where: { id: farm.id },
        data: { farmCoin: { increment: totalEarned } },
      });

      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'SELL_CROP',
          details: { itemCode, quantity, totalEarned },
        },
      });

      // Ghi FarmTransaction Ledger
      await this.transactionService.recordTransaction(tx, {
        userId,
        farmId: farm.id,
        type: 'PRODUCE_SALE',
        source: 'SHOP',
        referenceId: `SELL_${Date.now()}`,
        itemId: refId,
        itemCode,
        itemNameSnapshot: crop?.name || mutation?.name || 'Nông sản',
        itemIconUrl: crop?.iconUrl || '🌾',
        quantity,
        unitPrice,
        totalValue: totalEarned,
        farmCoinDelta: totalEarned,
        balanceCoinAfter: farm.farmCoin + totalEarned,
        status: 'COMPLETED',
      });

      this.farmGateway.emitFarmUpdated(userId, { farmCoin: farm.farmCoin + totalEarned });
      return {
        success: true,
        itemCode,
        quantity,
        totalEarned,
        earnedCoins: totalEarned,
        currentCoin: farm.farmCoin + totalEarned,
      };
    });
  }

  /**
   * Tự động khởi tạo các loại cây trồng mới nếu chưa có
   */
  async seedMissingCrops() {
    const cropsToEnsure = [
      {
        code: 'CORN',
        name: 'Bắp Ngô Nếp',
        category: FarmCropCategory.JAPANESE_INGREDIENT,
        rarity: FarmRarity.COMMON,
        description: 'Bắp ngô vàng óng dẻo ngọt, nguyên liệu tuyệt hảo cho các món nướng & súp Avora.',
        growDuration: 180, // 3 phút
        seedPrice: 12,
        sellPrice: 18,
        baseYield: 4,
        rewardExp: 18,
        rewardFarmCoin: 18,
        rewardLoyaltyPoints: 0,
        baseMutationRate: 0.08,
        minFarmLevel: 1,
        sortOrder: 15,
      },
      {
        code: 'SUNFLOWER',
        name: 'Hoa Hướng Dương',
        category: FarmCropCategory.JAPANESE_INGREDIENT,
        rarity: FarmRarity.UNCOMMON,
        description: 'Đóa hoa hướng dương rực rỡ mang lại sinh khí và vẻ đẹp rạng ngời cho nông trại.',
        growDuration: 360, // 6 phút
        seedPrice: 25,
        sellPrice: 42,
        baseYield: 3,
        rewardExp: 35,
        rewardFarmCoin: 38,
        rewardLoyaltyPoints: 0,
        baseMutationRate: 0.1,
        minFarmLevel: 2,
        sortOrder: 16,
      },
      {
        code: 'TOMATO',
        name: 'Cà Chua Bi Nhật',
        category: FarmCropCategory.FRUIT,
        rarity: FarmRarity.UNCOMMON,
        description: 'Những quả cà chua bi đỏ mọng giòn ngọt, giàu vitamin từ nông trại trên mây.',
        growDuration: 420, // 7 phút
        seedPrice: 30,
        sellPrice: 50,
        baseYield: 4,
        rewardExp: 40,
        rewardFarmCoin: 45,
        rewardLoyaltyPoints: 0,
        baseMutationRate: 0.1,
        minFarmLevel: 3,
        sortOrder: 17,
      },
    ];

    for (const cropData of cropsToEnsure) {
      const existing = await this.prisma.farmCrop.findUnique({ where: { code: cropData.code } });
      if (!existing) {
        await this.prisma.farmCrop.create({ data: cropData });
      }
    }
  }

  /**
   * Khởi tạo các đồ trang trí sân vườn Nhật Bản
   */
  private async seedDefaultDecorations() {
    const count = await this.prisma.farmDecoration.count();
    if (count > 0) return;

    this.logger.log('Seeding AVORA Farm decorations...');
    await this.prisma.farmDecoration.createMany({
      data: [
        {
          code: 'TORII_GATE',
          name: 'Cổng Torii AVORA',
          category: 'STATUE',
          spriteKey: 'torii_gate',
          priceFarmCoin: 500,
          buffType: 'MUTATION_CHANCE',
          buffValue: 0.05, // +5% cơ hội đột biến
          unlockLevel: 3,
        },
        {
          code: 'STONE_LANTERN',
          name: 'Đèn Đá Nhật Toro',
          category: 'LANTERN',
          spriteKey: 'stone_lantern',
          priceFarmCoin: 200,
          buffType: 'GROWTH_SPEED',
          buffValue: 0.03,
          unlockLevel: 2,
        },
        {
          code: 'KOI_POND',
          name: 'Ao Cá Koi Ngũ Sắc',
          category: 'KOI_POND',
          spriteKey: 'koi_pond',
          priceFarmCoin: 800,
          buffType: 'TREE_XP',
          buffValue: 0.1,
          unlockLevel: 5,
        },
        {
          code: 'BAMBOO_FENCE',
          name: 'Hàng Rào Tre Takegaki',
          category: 'FENCE',
          spriteKey: 'bamboo_fence',
          priceFarmCoin: 150,
          buffType: null,
          buffValue: 0,
          unlockLevel: 1,
        },
        {
          code: 'SAKURA_BENCH',
          name: 'Ghế Gỗ Dưới Tán Sakura',
          category: 'BENCH',
          spriteKey: 'sakura_bench',
          priceFarmCoin: 300,
          buffType: 'ENERGY_RECOVERY',
          buffValue: 0.05,
          unlockLevel: 4,
        },
      ],
    });
    this.logger.log('Seeded AVORA Farm decorations successfully.');
  }
}
