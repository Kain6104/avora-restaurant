import { Injectable, BadRequestException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FarmRewardCategory, PointTransactionSource } from '@prisma/client';

import { FarmTransactionService } from './farm-transaction.service';
import { FarmExchangeService } from './farm-exchange.service';

@Injectable()
export class FarmRewardService implements OnModuleInit {
  private readonly logger = new Logger(FarmRewardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionService: FarmTransactionService,
    private readonly exchangeService: FarmExchangeService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultRewards();
  }

  /**
   * Lấy danh sách quà đổi thưởng (Voucher, Giảm ship, Món ăn miễn phí)
   */
  async getRewardsCatalog(userId: string) {
    const rewards = await this.prisma.farmReward.findMany({
      where: { isActive: true },
      include: { voucher: true },
      orderBy: { costLoyaltyPoints: 'asc' },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    const userFarm = await this.prisma.userFarm.findUnique({
      where: { userId },
      select: { farmCoin: true, level: true },
    });

    const redemptions = await this.prisma.farmRewardRedemption.findMany({
      where: { userId },
      select: { rewardId: true },
    });

    const redeemedMap: Record<string, number> = {};
    for (const r of redemptions) {
      redeemedMap[r.rewardId] = (redeemedMap[r.rewardId] || 0) + 1;
    }

    return {
      userPoints: user?.points || 0,
      userCoin: userFarm?.farmCoin || 0,
      farmLevel: userFarm?.level || 1,
      rewards: rewards.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        description: r.description,
        imageUrl: r.imageUrl,
        category: r.category,
        costLoyaltyPoints: r.costLoyaltyPoints,
        costFarmCoin: r.costFarmCoin,
        stock: r.stock,
        redeemedCount: r.redeemedCount,
        limitPerUser: r.limitPerUser,
        minFarmLevel: r.minFarmLevel,
        voucher: r.voucher
          ? {
              code: r.voucher.code,
              discountType: r.voucher.discountType,
              discountValue: r.voucher.discountValue,
              maxDiscount: r.voucher.maxDiscount,
              minOrderValue: r.voucher.minOrderValue,
              startDate: r.voucher.startDate,
              endDate: r.voucher.endDate,
              applicableScope: r.voucher.applicableScope,
              description: r.voucher.description,
            }
          : null,
        myRedeemedCount: redeemedMap[r.id] || 0,
        canRedeem:
          (user?.points || 0) >= r.costLoyaltyPoints &&
          (userFarm?.farmCoin || 0) >= r.costFarmCoin &&
          (userFarm?.level || 1) >= r.minFarmLevel &&
          (r.stock === null || r.stock > r.redeemedCount) &&
          (redeemedMap[r.id] || 0) < r.limitPerUser,
      })),
    };
  }

  /**
   * Đổi quà bằng Điểm Loyalty thật và Farm Coin
   */
  async redeemReward(userId: string, rewardCodeOrId: string) {
    return this.prisma.$transaction(async (tx) => {
      const reward = await tx.farmReward.findFirst({
        where: {
          OR: [
            { code: rewardCodeOrId },
            { id: rewardCodeOrId },
          ],
        },
        include: { voucher: true },
      });

      if (!reward || !reward.isActive) {
        throw new NotFoundException('Phần thưởng không tồn tại hoặc đã hết hạn');
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { membershipTier: true },
      });
      if (!user) throw new NotFoundException('Người dùng không tồn tại');

      const farm = await tx.userFarm.findUnique({ where: { userId } });
      if (!farm) throw new NotFoundException('Nông trại chưa được khởi tạo');

      // 1. Kiểm tra cấp độ nông trại
      if (farm.level < reward.minFarmLevel) {
        throw new BadRequestException(`Cần đạt cấp Nông trại Lv.${reward.minFarmLevel} để đổi phần thưởng này`);
      }

      // 2. Kiểm tra giới hạn số lượng toàn hệ thống (Stock)
      if (reward.stock !== null && reward.redeemedCount >= reward.stock) {
        throw new BadRequestException('Phần thưởng này đã hết số lượng phát hành');
      }

      // 3. Kiểm tra số lần đã đổi của người dùng
      const userRedeemedCount = await tx.farmRewardRedemption.count({
        where: { userId, rewardId: reward.id },
      });
      if (userRedeemedCount >= reward.limitPerUser) {
        throw new BadRequestException(`Bạn đã đạt giới hạn đổi thưởng của vật phẩm này (${reward.limitPerUser} lần)`);
      }

      // 4. Kiểm tra Điểm loyalty
      if (reward.costLoyaltyPoints > 0 && user.points < reward.costLoyaltyPoints) {
        throw new BadRequestException(`Không đủ điểm tích lũy AVORA (Cần ${reward.costLoyaltyPoints} điểm, bạn có: ${user.points} điểm)`);
      }

      // 5. Kiểm tra Farm Coin
      if (reward.costFarmCoin > 0 && farm.farmCoin < reward.costFarmCoin) {
        throw new BadRequestException(`Không đủ Farm Coin (Cần ${reward.costFarmCoin} coin, bạn có: ${farm.farmCoin} coin)`);
      }

      // 6. Thực hiện trừ Điểm Loyalty thật & Ghi nhận PointTransaction
      let pointTxId: string | null = null;
      if (reward.costLoyaltyPoints > 0) {
        const balanceBefore = user.points;
        const balanceAfter = user.points - reward.costLoyaltyPoints;

        await tx.user.update({
          where: { id: userId },
          data: {
            points: balanceAfter,
            currentPoints: balanceAfter,
          },
        });

        const pointTx = await tx.pointTransaction.create({
          data: {
            userId,
            membershipTierId: user.membershipTierId,
            membershipTierName: user.membershipTier?.name,
            balanceBefore,
            amount: -reward.costLoyaltyPoints,
            balanceAfter,
            source: PointTransactionSource.REWARD,
            referenceCode: `FARM_${reward.code}`,
            description: `Đổi quà AVORA Farm: ${reward.title}`,
          },
        });
        pointTxId = pointTx.id;
      }

      // 7. Thực hiện trừ Farm Coin
      if (reward.costFarmCoin > 0) {
        await tx.userFarm.update({
          where: { id: farm.id },
          data: { farmCoin: { decrement: reward.costFarmCoin } },
        });
      }

      // 8. Tăng số lượng đã đổi của Reward
      await tx.farmReward.update({
        where: { id: reward.id },
        data: { redeemedCount: { increment: 1 } },
      });

      // 9. Phát hành Voucher vào Ví CustomerVoucher (Đảm bảo có bản ghi Voucher thực tế)
      let issuedVoucherCode: string = reward.code;
      let customerVoucherId: string | null = null;

      let targetVoucherId = reward.voucherId;

      // Nếu reward chưa liên kết Voucher thì tự động tạo mới 1 Voucher chuẩn áp dụng toàn hệ thống
      if (!targetVoucherId) {
        const generatedCode = `AVORA_${reward.code}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30); // 30 ngày sử dụng

        let discountVal = 20000;
        let minOrder = 50000;
        let discountType: any = 'FIXED_AMOUNT';

        if (reward.category === FarmRewardCategory.FREE_SHIPPING) {
          discountType = 'FREE_SHIP';
          discountVal = 30000;
          minOrder = 0;
        } else if (reward.code.includes('50K')) {
          discountVal = 50000;
          minOrder = 200000;
        }

        const newVoucher = await tx.voucher.create({
          data: {
            code: generatedCode,
            title: reward.title,
            description: reward.description || 'Ưu đãi đổi thưởng từ Nông Trại AVORA Farm',
            discountType,
            discountValue: discountVal,
            minOrderValue: minOrder,
            startDate: now,
            endDate,
            isActive: true,
            applicableScope: 'ALL',
            usageLimitPerUser: 5,
          },
        });

        targetVoucherId = newVoucher.id;
        issuedVoucherCode = generatedCode;

        // Cập nhật lại FarmReward để lần sau dùng chung
        await tx.farmReward.update({
          where: { id: reward.id },
          data: { voucherId: newVoucher.id },
        });
      }

      const existingCv = await tx.customerVoucher.findUnique({
        where: {
          userId_voucherId: {
            userId,
            voucherId: targetVoucherId,
          },
        },
        include: { voucher: true },
      });

      let customerVoucher;
      if (existingCv) {
        customerVoucher = await tx.customerVoucher.update({
          where: { id: existingCv.id },
          data: {
            isUsed: false,
            usedAt: null,
            savedAt: new Date(),
          },
          include: { voucher: true },
        });
      } else {
        customerVoucher = await tx.customerVoucher.create({
          data: {
            userId,
            voucherId: targetVoucherId,
            isUsed: false,
            savedAt: new Date(),
          },
          include: { voucher: true },
        });
      }
      issuedVoucherCode = customerVoucher.voucher?.code || issuedVoucherCode;
      customerVoucherId = customerVoucher.id;

      // 10. Tạo bản ghi Redemption
      const redemption = await tx.farmRewardRedemption.create({
        data: {
          userId,
          farmId: farm.id,
          rewardId: reward.id,
          farmCoinSpent: reward.costFarmCoin,
          loyaltyPointsSpent: reward.costLoyaltyPoints,
          voucherCodeIssued: issuedVoucherCode,
          customerVoucherId,
          pointTxId,
        },
      });

      await tx.farmActivityLog.create({
        data: {
          userId,
          farmId: farm.id,
          action: 'REDEEM_REWARD',
          details: { rewardCode: reward.code, issuedVoucherCode, pointsSpent: reward.costLoyaltyPoints },
        },
      });

      // Ghi FarmTransaction Ledger
      await this.transactionService.recordTransaction(tx, {
        userId,
        farmId: farm.id,
        type: 'VOUCHER_REDEMPTION',
        source: 'REDEMPTION',
        referenceId: issuedVoucherCode,
        itemId: reward.id,
        itemCode: reward.code,
        itemNameSnapshot: reward.title,
        itemIconUrl: reward.imageUrl || '🎫',
        quantity: 1,
        totalValue: reward.costFarmCoin,
        farmCoinDelta: -reward.costFarmCoin,
        avoraPointDelta: -reward.costLoyaltyPoints,
        balanceCoinAfter: farm.farmCoin - reward.costFarmCoin,
        balancePointAfter: user.points - reward.costLoyaltyPoints,
        status: 'COMPLETED',
        metadata: {
          voucherCode: issuedVoucherCode,
          customerVoucherId,
          pointTxId,
        },
      });

      return {
        success: true,
        message: `Đổi thành công: ${reward.title}! Voucher đã được thêm vào ví của bạn.`,
        rewardTitle: reward.title,
        voucherCode: issuedVoucherCode,
        remainingPoints: user.points - reward.costLoyaltyPoints,
        remainingCoin: farm.farmCoin - reward.costFarmCoin,
        redemptionId: redemption.id,
      };
    });
  }

  /**
   * Đổi Farm Coins sang Điểm Thành Viên AVORA (Loyalty Points)
   */
  async exchangeCoinsToPoints(userId: string, coinsAmount: number) {
    return this.exchangeService.executeExchange(userId, coinsAmount);
  }

  /**
   * Lấy danh sách Voucher người chơi đã đổi từ nông trại (Ví Voucher)
   */
  async getUserCustomerVouchers(userId: string) {
    const customerVouchers = await this.prisma.customerVoucher.findMany({
      where: { userId },
      include: {
        voucher: true,
      },
      orderBy: { savedAt: 'desc' },
    });

    const now = new Date();

    return customerVouchers.map((cv) => ({
      id: cv.id,
      voucherId: cv.voucherId,
      code: cv.voucher.code,
      title: cv.voucher.title,
      description: cv.voucher.description,
      discountType: cv.voucher.discountType,
      discountValue: cv.voucher.discountValue,
      maxDiscount: cv.voucher.maxDiscount,
      minOrderValue: cv.voucher.minOrderValue,
      applicableScope: cv.voucher.applicableScope,
      startDate: cv.voucher.startDate,
      endDate: cv.voucher.endDate,
      isUsed: cv.isUsed,
      usedAt: cv.usedAt,
      savedAt: cv.savedAt,
      isExpired: now > new Date(cv.voucher.endDate),
    }));
  }

  /**
   * Khởi tạo các phần thưởng loyalty mẫu
   */
  private async seedDefaultRewards() {
    const count = await this.prisma.farmReward.count();
    if (count > 0) return;

    this.logger.log('Seeding AVORA Farm rewards catalog...');

    const now = new Date();
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    // Đảm bảo tạo các Voucher chuẩn với điều kiện thực tế
    let v20k = await this.prisma.voucher.findFirst({ where: { code: 'AVORA_FARM_20K' } });
    if (!v20k) {
      v20k = await this.prisma.voucher.create({
        data: {
          code: 'AVORA_FARM_20K',
          title: 'Voucher Giảm 20.000đ từ Nông Trại',
          description: 'Áp dụng cho mọi hóa đơn từ 100.000đ tại nhà hàng hoặc đặt món online.',
          discountType: 'FIXED_AMOUNT',
          discountValue: 20000,
          minOrderValue: 100000,
          startDate: now,
          endDate: oneYearLater,
          isActive: true,
          applicableScope: 'ALL',
        },
      });
    }

    let vFreeship = await this.prisma.voucher.findFirst({ where: { code: 'AVORA_FARM_FREESHIP' } });
    if (!vFreeship) {
      vFreeship = await this.prisma.voucher.create({
        data: {
          code: 'AVORA_FARM_FREESHIP',
          title: 'Mã Miễn Phí Vận Chuyển 30.000đ',
          description: 'Miễn phí giao hàng tối đa 30.000đ cho đơn hàng trực tuyến từ 80.000đ.',
          discountType: 'FREE_SHIP',
          discountValue: 30000,
          minOrderValue: 80000,
          startDate: now,
          endDate: oneYearLater,
          isActive: true,
          applicableScope: 'ONLINE',
        },
      });
    }

    let vSushi = await this.prisma.voucher.findFirst({ where: { code: 'AVORA_FARM_SUSHI' } });
    if (!vSushi) {
      vSushi = await this.prisma.voucher.create({
        data: {
          code: 'AVORA_FARM_SUSHI',
          title: 'Tặng 1 Đĩa Salmon Nigiri Cá Hồi',
          description: 'Thưởng thức 2 miếng Sushi cá hồi Na Uy thượng hạng miễn phí khi dùng bữa tại quầy.',
          discountType: 'FIXED_AMOUNT',
          discountValue: 65000,
          minOrderValue: 150000,
          startDate: now,
          endDate: oneYearLater,
          isActive: true,
          applicableScope: 'POS',
        },
      });
    }

    await this.prisma.farmReward.createMany({
      data: [
        {
          code: 'VOUCHER_20K',
          title: 'Voucher Giảm 20.000đ',
          description: 'Áp dụng cho mọi hóa đơn từ 100.000đ tại nhà hàng hoặc đặt món online.',
          category: FarmRewardCategory.VOUCHER,
          voucherId: v20k.id,
          costLoyaltyPoints: 0,
          costFarmCoin: 200,
          stock: 500,
          limitPerUser: 5,
          minFarmLevel: 1,
        },
        {
          code: 'FREE_SHIP',
          title: 'Mã Miễn Phí Vận Chuyển',
          description: 'Freeship tối đa 30.000đ cho đơn hàng trực tuyến từ 80.000đ.',
          category: FarmRewardCategory.FREE_SHIPPING,
          voucherId: vFreeship.id,
          costLoyaltyPoints: 0,
          costFarmCoin: 300,
          stock: 300,
          limitPerUser: 5,
          minFarmLevel: 2,
        },
        {
          code: 'SUSHI_FREE',
          title: 'Tặng 1 Đĩa Salmon Nigiri',
          description: 'Thưởng thức 2 miếng Sushi cá hồi tươi thượng hạng miễn phí khi dùng bữa từ 150.000đ.',
          category: FarmRewardCategory.FOOD_DISCOUNT,
          voucherId: vSushi.id,
          costLoyaltyPoints: 50,
          costFarmCoin: 450,
          stock: 100,
          limitPerUser: 3,
          minFarmLevel: 3,
        },
        {
          code: 'SPECIAL_SAKURA_GIFT',
          title: 'Bộ Quà Tặng Lễ Hội Hoa Anh Đào',
          description: 'Ly sứ phong cách Zen Nhật Bản phiên bản giới hạn kỷ niệm AVORA.',
          category: FarmRewardCategory.SPECIAL_GIFT,
          costLoyaltyPoints: 200,
          costFarmCoin: 800,
          stock: 50,
          limitPerUser: 1,
          minFarmLevel: 5,
        },
      ],
    });
    this.logger.log('Seeded AVORA Farm rewards successfully.');
  }
}
