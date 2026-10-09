import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateFarmTransactionInput {
  userId: string;
  farmId?: string;
  type: string;
  source?: string;
  referenceId?: string;
  itemId?: string;
  itemCode?: string;
  itemNameSnapshot?: string;
  itemIconUrl?: string;
  quantity?: number;
  unitPrice?: number;
  totalValue?: number;
  farmCoinDelta?: number;
  avoraPointDelta?: number;
  balanceCoinAfter?: number;
  balancePointAfter?: number;
  status?: string;
  metadata?: any;
}

@Injectable()
export class FarmTransactionService {
  private readonly logger = new Logger(FarmTransactionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ghi nhận 1 bản ghi sổ cái FarmTransaction trong transaction client Prisma
   */
  async recordTransaction(
    tx: Prisma.TransactionClient,
    data: CreateFarmTransactionInput,
  ) {
    try {
      return await (tx as any).farmTransaction.create({
        data: {
          userId: data.userId,
          farmId: data.farmId,
          type: data.type,
          source: data.source || 'SYSTEM',
          referenceId: data.referenceId,
          itemId: data.itemId,
          itemCode: data.itemCode,
          itemNameSnapshot: data.itemNameSnapshot,
          itemIconUrl: data.itemIconUrl,
          quantity: data.quantity || 0,
          unitPrice: data.unitPrice || 0,
          totalValue: data.totalValue || 0,
          farmCoinDelta: data.farmCoinDelta || 0,
          avoraPointDelta: data.avoraPointDelta || 0,
          balanceCoinAfter: data.balanceCoinAfter,
          balancePointAfter: data.balancePointAfter,
          status: data.status || 'COMPLETED',
          metadata: data.metadata || null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to record farm transaction:', error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử giao dịch nông trại của người chơi theo tab
   * Các tab:
   * 1. ALL: Tất cả
   * 2. BUY: Mua vật phẩm (SEED_PURCHASE, ITEM_PURCHASE)
   * 3. SELL: Bán nông sản (PRODUCE_SALE)
   * 4. REDEEM: Đổi thưởng (VOUCHER_REDEMPTION)
   * 5. EXCHANGE: Xu & Điểm AVORA (COIN_TO_POINT_EXCHANGE)
   * 6. GIFT: Quà nhận được (ADMIN_GIFT, MAINTENANCE_GIFT, SYSTEM_COMPENSATION, LUCKY_ENVELOPE_REWARD, MISSION_REWARD, LEVEL_REWARD)
   * 7. SOCIAL: Bạn bè (FRIEND_STEAL_GAIN, FRIEND_STEAL_LOSS, FRIEND_WATER)
   */
  async getUserHistory(
    userId: string,
    tab: string = 'ALL',
    page: number = 1,
    limit: number = 20,
    search?: string,
  ) {
    const skip = (Math.max(1, page) - 1) * limit;

    const where: any = { userId };

    const typeFilterMap: Record<string, string[]> = {
      BUY: ['SEED_PURCHASE', 'ITEM_PURCHASE'],
      SELL: ['PRODUCE_SALE'],
      REDEEM: ['VOUCHER_REDEMPTION'],
      EXCHANGE: ['COIN_TO_POINT_EXCHANGE'],
      GIFT: [
        'ADMIN_GIFT',
        'MAINTENANCE_GIFT',
        'SYSTEM_COMPENSATION',
        'LUCKY_ENVELOPE_REWARD',
        'MISSION_REWARD',
        'LEVEL_REWARD',
      ],
      SOCIAL: ['FRIEND_STEAL_GAIN', 'FRIEND_STEAL_LOSS', 'FRIEND_WATER'],
    };

    if (tab && tab !== 'ALL' && typeFilterMap[tab]) {
      where.type = { in: typeFilterMap[tab] };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { itemNameSnapshot: { contains: q } },
        { referenceId: { contains: q } },
        { type: { contains: q } },
      ];
    }

    const [total, items, summary] = await Promise.all([
      (this.prisma as any).farmTransaction.count({ where }),
      (this.prisma as any).farmTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.getUserSummary(userId),
    ]);

    return {
      tab,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary,
      transactions: items.map((item: any) => ({
        id: item.id,
        type: item.type,
        source: item.source,
        referenceId: item.referenceId,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemNameSnapshot || 'Vật phẩm Nông Trại',
        itemIconUrl: item.itemIconUrl,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalValue: item.totalValue,
        farmCoinDelta: item.farmCoinDelta,
        avoraPointDelta: item.avoraPointDelta,
        balanceCoinAfter: item.balanceCoinAfter,
        balancePointAfter: item.balancePointAfter,
        status: item.status,
        metadata: item.metadata,
        createdAt: item.createdAt,
      })),
    };
  }

  /**
   * Thống kê tổng hợp số dư và biến động của người chơi
   */
  async getUserSummary(userId: string) {
    const userFarm = await this.prisma.userFarm.findUnique({
      where: { userId },
      select: { farmCoin: true, level: true, exp: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currentPoints: true, points: true },
    });

    // Thống kê tổng Xu kiếm được và tiêu từ FarmTransaction
    const txCoinStats = await (this.prisma as any).farmTransaction.groupBy({
      by: ['userId'],
      where: { userId },
      _sum: {
        farmCoinDelta: true,
        avoraPointDelta: true,
      },
    });

    return {
      farmCoin: userFarm?.farmCoin || 0,
      avoraPoints: user?.currentPoints || user?.points || 0,
      farmLevel: userFarm?.level || 1,
      totalCoinNetDelta: txCoinStats[0]?._sum?.farmCoinDelta || 0,
      totalPointEarnedFromFarm: txCoinStats[0]?._sum?.avoraPointDelta || 0,
    };
  }

  /**
   * Dành cho Admin xem chi tiết lịch sử Farm của 1 User bất kỳ
   */
  async getAdminUserFarmHistory(
    userId: string,
    query: {
      type?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { itemNameSnapshot: { contains: q } },
        { referenceId: { contains: q } },
        { type: { contains: q } },
      ];
    }

    const [total, items, userFarm, user] = await Promise.all([
      (this.prisma as any).farmTransaction.count({ where }),
      (this.prisma as any).farmTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userFarm.findUnique({
        where: { userId },
        include: {
          inventory: true,
          redemptions: { include: { reward: true } },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          memberCode: true,
          currentPoints: true,
          points: true,
          membershipTier: true,
        },
      }),
    ]);

    return {
      user: {
        ...user,
        farmLevel: userFarm?.level || 1,
        farmCoin: userFarm?.farmCoin || 0,
        totalHarvested: userFarm?.dailyGatherCount || 0,
      },
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      transactions: items,
    };
  }
}
