import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FarmTransactionService } from './farm-transaction.service';
import { PointTransactionSource } from '@prisma/client';
import { getVietnamStartOfDay } from './farm-time.util';

@Injectable()
export class FarmExchangeService {
  private readonly logger = new Logger(FarmExchangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionService: FarmTransactionService,
  ) {}

  /**
   * Lấy cấu hình tỷ lệ quy đổi từ Database (Source of Truth)
   */
  async getExchangeSetting() {
    let setting = await (this.prisma as any).farmExchangeSetting.findUnique({
      where: { id: 'default' },
    });

    if (!setting) {
      setting = await (this.prisma as any).farmExchangeSetting.create({
        data: {
          id: 'default',
          coinPerPoint: 5,
          minCoins: 100,
          maxCoinsPerTransaction: 50000,
          dailyLimitCoins: 100000,
          exchangeStep: 1,
          isEnabled: true,
        },
      });
    }

    return setting;
  }

  /**
   * Admin cập nhật cấu hình quy đổi trong Database
   */
  async updateExchangeSetting(dto: {
    coinPerPoint?: number;
    minCoins?: number;
    maxCoinsPerTransaction?: number;
    dailyLimitCoins?: number;
    exchangeStep?: number;
    isEnabled?: boolean;
  }) {
    if (dto.coinPerPoint !== undefined && dto.coinPerPoint <= 0) {
      throw new BadRequestException('Tỷ lệ Xu/Điểm phải lớn hơn 0');
    }
    if (dto.minCoins !== undefined && dto.minCoins <= 0) {
      throw new BadRequestException('Số Xu tối thiểu phải lớn hơn 0');
    }

    return await (this.prisma as any).farmExchangeSetting.upsert({
      where: { id: 'default' },
      update: dto,
      create: {
        id: 'default',
        coinPerPoint: dto.coinPerPoint || 5,
        minCoins: dto.minCoins || 100,
        maxCoinsPerTransaction: dto.maxCoinsPerTransaction || 50000,
        dailyLimitCoins: dto.dailyLimitCoins || 100000,
        exchangeStep: dto.exchangeStep || 1,
        isEnabled: dto.isEnabled !== undefined ? dto.isEnabled : true,
      },
    });
  }

  /**
   * Lấy toàn bộ dữ liệu cấu hình + số dư + hạn mức thực tế cho Frontend render 100% động
   */
  async getUserExchangeOverview(userId: string) {
    const setting = await this.getExchangeSetting();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currentPoints: true, points: true },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    const farm = await this.prisma.userFarm.findUnique({
      where: { userId },
      select: { farmCoin: true },
    });
    if (!farm) throw new NotFoundException('Nông trại chưa được khởi tạo');

    // Tính tổng số Xu đã đổi hôm nay (theo múi giờ Asia/Ho_Chi_Minh)
    const todayStart = getVietnamStartOfDay();

    const todayExchanges = await (this.prisma as any).farmTransaction.findMany({
      where: {
        userId,
        type: 'COIN_TO_POINT_EXCHANGE',
        createdAt: { gte: todayStart },
      },
      select: { farmCoinDelta: true },
    });

    const exchangedTodayCoins = todayExchanges.reduce(
      (sum: number, tx: any) => sum + Math.abs(tx.farmCoinDelta || 0),
      0,
    );

    const availableExchangeCoins = Math.max(
      0,
      setting.dailyLimitCoins - exchangedTodayCoins,
    );

    return {
      farmCoins: farm.farmCoin,
      avoraPoints: Math.floor(user.currentPoints || user.points || 0),
      coinPerPoint: setting.coinPerPoint,
      minCoins: setting.minCoins,
      maxCoinsPerTransaction: setting.maxCoinsPerTransaction,
      dailyLimitCoins: setting.dailyLimitCoins,
      exchangedTodayCoins,
      availableExchangeCoins,
      isEnabled: setting.isEnabled,
    };
  }

  /**
   * Thực hiện giao dịch quy đổi Xu -> Điểm AVORA Loyalty Thật (Atomic Transaction)
   */
  async executeExchange(userId: string, amountCoin: number) {
    if (!amountCoin || typeof amountCoin !== 'number' || amountCoin <= 0) {
      throw new BadRequestException('Số lượng Xu quy đổi không hợp lệ');
    }

    const roundedCoin = Math.floor(amountCoin);

    return this.prisma.$transaction(async (tx) => {
      // 1. Load cấu hình từ DB (Source of Truth)
      const setting = await (tx as any).farmExchangeSetting.findUnique({
        where: { id: 'default' },
      });
      if (!setting || !setting.isEnabled) {
        throw new BadRequestException('Tính năng quy đổi Xu sang Điểm hiện đang tạm đóng');
      }

      // 2. Validate Min/Max
      if (roundedCoin < setting.minCoins) {
        throw new BadRequestException(
          `Số Xu tối thiểu cho mỗi lần đổi là ${setting.minCoins.toLocaleString('vi-VN')} Xu`,
        );
      }
      if (roundedCoin > setting.maxCoinsPerTransaction) {
        throw new BadRequestException(
          `Số Xu tối đa cho mỗi lần đổi là ${setting.maxCoinsPerTransaction.toLocaleString('vi-VN')} Xu`,
        );
      }

      // 3. Kiểm tra hạn mức đổi trong ngày
      const todayStart = getVietnamStartOfDay();
      const todayExchanges = await (tx as any).farmTransaction.findMany({
        where: {
          userId,
          type: 'COIN_TO_POINT_EXCHANGE',
          createdAt: { gte: todayStart },
        },
        select: { farmCoinDelta: true },
      });

      const exchangedToday = todayExchanges.reduce(
        (sum: number, t: any) => sum + Math.abs(t.farmCoinDelta || 0),
        0,
      );

      if (exchangedToday + roundedCoin > setting.dailyLimitCoins) {
        const remaining = Math.max(0, setting.dailyLimitCoins - exchangedToday);
        throw new BadRequestException(
          `Vượt quá hạn mức đổi Xu trong ngày! Bạn chỉ còn có thể đổi tối đa ${remaining.toLocaleString('vi-VN')} Xu hôm nay.`,
        );
      }

      // 4. Kiểm tra số dư người dùng
      const farm = await tx.userFarm.findUnique({
        where: { userId },
      });
      if (!farm) throw new NotFoundException('Nông trại chưa được khởi tạo');

      if (farm.farmCoin < roundedCoin) {
        throw new BadRequestException(
          `Bạn không đủ Xu Nông Trại để thực hiện giao dịch (Hiện có: ${farm.farmCoin.toLocaleString('vi-VN')}, Yêu cầu: ${roundedCoin.toLocaleString('vi-VN')})`,
        );
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { membershipTier: true },
      });
      if (!user) throw new NotFoundException('Người dùng không tồn tại');

      // 5. Tính điểm nhận server-side (Server Calculation Authority)
      const earnedPoints = Math.floor(roundedCoin / setting.coinPerPoint);
      if (earnedPoints <= 0) {
        throw new BadRequestException(
          `Số Xu đổi phải tạo ra ít nhất 1 Điểm (Cần tối thiểu ${setting.coinPerPoint} Xu)`,
        );
      }

      // 6. Thực hiện Atomic Mutation
      // Trừ Farm Coin
      const updatedFarm = await tx.userFarm.update({
        where: { id: farm.id },
        data: { farmCoin: { decrement: roundedCoin } },
      });

      // Cộng Điểm AVORA thật (Cập nhật cả points và currentPoints)
      const pointBalanceBefore = Math.floor(user.points || user.currentPoints || 0);
      const pointBalanceAfter = pointBalanceBefore + earnedPoints;

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: pointBalanceAfter,
          currentPoints: pointBalanceAfter,
        },
      });

      const refCode = `EXCHANGE_FARM_${Date.now()}`;

      // Tạo PointTransaction chuẩn AVORA
      await tx.pointTransaction.create({
        data: {
          userId,
          membershipTierId: user.membershipTierId,
          membershipTierName: user.membershipTier?.name,
          balanceBefore: pointBalanceBefore,
          amount: earnedPoints,
          balanceAfter: pointBalanceAfter,
          source: PointTransactionSource.REWARD,
          referenceCode: refCode,
          description: `Quy đổi từ ${roundedCoin.toLocaleString('vi-VN')} Xu Nông Trại AVORA (Tỷ lệ: ${setting.coinPerPoint} Xu = 1 Điểm)`,
        },
      });

      // Ghi FarmTransaction Ledger
      await this.transactionService.recordTransaction(tx, {
        userId,
        farmId: farm.id,
        type: 'COIN_TO_POINT_EXCHANGE',
        source: 'EXCHANGE',
        referenceId: refCode,
        itemNameSnapshot: 'Điểm Thưởng AVORA Loyalty',
        itemIconUrl: '⭐',
        quantity: earnedPoints,
        unitPrice: setting.coinPerPoint,
        totalValue: roundedCoin,
        farmCoinDelta: -roundedCoin,
        avoraPointDelta: earnedPoints,
        balanceCoinAfter: updatedFarm.farmCoin,
        balancePointAfter: pointBalanceAfter,
        status: 'COMPLETED',
        metadata: {
          coinPerPoint: setting.coinPerPoint,
          coinsSpent: roundedCoin,
          earnedPoints,
        },
      });

      return {
        success: true,
        message: `Chúc mừng bạn đã quy đổi thành công ${earnedPoints.toLocaleString('vi-VN')} Điểm AVORA!`,
        farmCoins: updatedFarm.farmCoin,
        avoraPoints: pointBalanceAfter,
        earnedPoints,
        coinsSpent: roundedCoin,
        exchangedTodayCoins: exchangedToday + roundedCoin,
        availableExchangeCoins: Math.max(0, setting.dailyLimitCoins - (exchangedToday + roundedCoin)),
      };
    });
  }
}
