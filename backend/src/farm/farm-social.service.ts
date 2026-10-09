import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { FarmGateway } from './farm.gateway';
import { FarmItemType, FarmPlotStatus } from '@prisma/client';
import { getVietnamStartOfDay } from './farm-time.util';

import { FarmTransactionService } from './farm-transaction.service';

@Injectable()
export class FarmSocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly farmGateway: FarmGateway,
    private readonly transactionService: FarmTransactionService,
  ) {}

  /**
   * Lấy danh sách bạn bè & gợi ý người lạ cùng hạn mức trộm (3 lượt người lạ, 10 lượt bạn bè)
   */
  async getSocialOverview(userId: string) {
    const today = getVietnamStartOfDay();

    // 1. Lấy danh sách bạn bè đã kết nối (ACCEPTED)
    const friendships = await (this.prisma as any).farmFriendship.findMany({
      where: {
        OR: [
          { userId, status: 'ACCEPTED' },
          { friendId: userId, status: 'ACCEPTED' },
        ],
      },
    });

    const friendUserIds = new Set<string>();
    for (const f of friendships) {
      if (f.userId === userId) friendUserIds.add(f.friendId);
      else friendUserIds.add(f.userId);
    }

    // 1b. Lấy lời mời đã gửi đang chờ duyệt (PENDING)
    const sentRequests = await (this.prisma as any).farmFriendship.findMany({
      where: {
        userId,
        status: 'PENDING',
      },
    });
    const pendingSentIds = sentRequests.map((r: any) => r.friendId);

    // 1c. Lấy lời mời nhận được đang chờ duyệt (PENDING)
    const receivedRequests = await (this.prisma as any).farmFriendship.findMany({
      where: {
        friendId: userId,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            memberCode: true,
            userFarm: {
              select: { level: true, treeLevel: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingReceived = receivedRequests.map((r: any) => ({
      requestId: r.id,
      userId: r.user.id,
      name: r.user.fullName,
      avatarUrl: r.user.avatarUrl,
      memberCode: r.user.memberCode,
      level: r.user.userFarm?.level || 1,
      treeLevel: r.user.userFarm?.treeLevel || 1,
      createdAt: r.createdAt,
    }));

    // 2. Đọc cấu hình hạn mức từ SystemSetting nếu có
    let strangerMax = 3;
    let friendMax = 10;
    let protectionMinutes = 15;
    try {
      const configSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'farm_game_config' },
      });
      if (configSetting) {
        const parsed = JSON.parse(configSetting.value);
        if (typeof parsed.strangerDailyStealLimit === 'number') strangerMax = parsed.strangerDailyStealLimit;
        if (typeof parsed.friendDailyStealLimit === 'number') friendMax = parsed.friendDailyStealLimit;
        if (typeof parsed.protectionWindowMinutes === 'number') protectionMinutes = parsed.protectionWindowMinutes;
      }
    } catch {}

    // 3. Lấy danh sách các nông trại đang hoạt động khác
    const allActiveFarms = await this.prisma.userFarm.findMany({
      where: { userId: { not: userId } },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            memberCode: true,
          },
        },
        plots: {
          include: { cropInstance: true },
        },
      },
      take: 50,
      orderBy: { level: 'desc' },
    });

    const now = new Date().getTime();

    const mapFarm = (f: any, isFriend: boolean) => {
      let needWaterCount = 0;
      let canGatherCount = 0;

      for (const plot of f.plots) {
        if (plot.cropInstance && !plot.cropInstance.harvestedAt) {
          const isReady = now >= new Date(plot.cropInstance.readyAt).getTime();
          const elapsedSinceReady = now - new Date(plot.cropInstance.readyAt).getTime();

          if (!isReady && (plot.cropInstance.wateredCount ?? 0) < 2) {
            needWaterCount++;
          }

          // Cửa sổ bảo vệ: X phút đầu tiên bảo vệ tuyệt đối
          if (
            isReady &&
            elapsedSinceReady > protectionMinutes * 60 * 1000 &&
            plot.cropInstance.gatheredCount < plot.cropInstance.maxGatherAllowed
          ) {
            canGatherCount++;
          }
        }
      }

      const isPendingSent = pendingSentIds.includes(f.user.id);

      return {
        userId: f.user.id,
        farmId: f.id,
        name: f.user.fullName,
        avatarUrl: f.user.avatarUrl,
        memberCode: f.user.memberCode,
        level: f.level,
        treeLevel: f.treeLevel,
        needWaterCount,
        canGatherCount,
        isFriend,
        isPendingSent,
      };
    };

    const friends = allActiveFarms
      .filter((f) => friendUserIds.has(f.user.id))
      .map((f) => mapFarm(f, true));

    const strangers = allActiveFarms
      .filter((f) => !friendUserIds.has(f.user.id))
      .sort(() => 0.5 - Math.random())
      .slice(0, 20)
      .map((f) => mapFarm(f, false));

    // 4. Đếm số lượt trộm trong ngày
    const friendGathersCount = await this.prisma.farmFriendAction.count({
      where: {
        actorUserId: userId,
        actionType: 'GATHER',
        isFriend: true,
        createdAt: { gte: today },
      },
    });

    const strangerGathersCount = await this.prisma.farmFriendAction.count({
      where: {
        actorUserId: userId,
        actionType: 'GATHER',
        isFriend: false,
        createdAt: { gte: today },
      },
    });

    return {
      friends,
      strangers,
      pendingReceived,
      pendingSentIds,
      limits: {
        strangerMax,
        strangerUsed: strangerGathersCount,
        strangerRemaining: Math.max(0, strangerMax - strangerGathersCount),
        friendMax,
        friendUsed: friendGathersCount,
        friendRemaining: Math.max(0, friendMax - friendGathersCount),
      },
    };
  }

  /**
   * Gửi lời mời kết bạn (yêu cầu đối phương đồng ý)
   */
  async addFriend(userId: string, friendUserId: string) {
    if (userId === friendUserId) {
      throw new BadRequestException('Không thể kết bạn với chính mình');
    }

    const existing = await (this.prisma as any).farmFriendship.findFirst({
      where: {
        OR: [
          { userId, friendId: friendUserId },
          { userId: friendUserId, friendId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return { success: true, message: 'Hai bạn đã là bạn bè từ trước!' };
      }
      if (existing.userId === userId && existing.status === 'PENDING') {
        return { success: true, message: 'Đã gửi lời mời kết bạn, đang chờ đối phương đồng ý!' };
      }
      if (existing.friendId === userId && existing.status === 'PENDING') {
        // Đối phương đã gửi lời mời cho mình rồi -> tự động chấp nhận luôn!
        await (this.prisma as any).farmFriendship.update({
          where: { id: existing.id },
          data: { status: 'ACCEPTED' },
        });
        return { success: true, message: 'Đã chấp nhận lời mời kết bạn từ đối phương!' };
      }
    }

    await (this.prisma as any).farmFriendship.create({
      data: {
        userId,
        friendId: friendUserId,
        status: 'PENDING',
      },
    });

    return {
      success: true,
      message: 'Đã gửi lời mời kết bạn! Đang chờ đối phương đồng ý.',
    };
  }

  /**
   * Đồng ý lời mời kết bạn
   */
  async acceptFriendRequest(userId: string, requesterUserId: string) {
    const request = await (this.prisma as any).farmFriendship.findFirst({
      where: {
        userId: requesterUserId,
        friendId: userId,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new NotFoundException('Không tìm thấy lời mời kết bạn tương ứng');
    }

    await (this.prisma as any).farmFriendship.update({
      where: { id: request.id },
      data: { status: 'ACCEPTED' },
    });

    return {
      success: true,
      message: 'Đã đồng ý kết bạn thành công!',
    };
  }

  /**
   * Từ chối lời mời kết bạn
   */
  async rejectFriendRequest(userId: string, requesterUserId: string) {
    const request = await (this.prisma as any).farmFriendship.findFirst({
      where: {
        userId: requesterUserId,
        friendId: userId,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new NotFoundException('Không tìm thấy lời mời kết bạn tương ứng');
    }

    await (this.prisma as any).farmFriendship.delete({
      where: { id: request.id },
    });

    return {
      success: true,
      message: 'Đã từ chối lời mời kết bạn',
    };
  }

  /**
   * Lấy danh sách bạn bè & gợi ý các nông trại đang hoạt động (backward compatibility)
   */
  async getFriendsList(userId: string) {
    const overview = await this.getSocialOverview(userId);
    return [...overview.friends, ...overview.strangers];
  }

  /**
   * Xem trạng thái nông trại của bạn bè / người chơi khác
   */
  async getFriendFarmState(userId: string, friendUserId: string) {
    const friendFarm = await this.prisma.userFarm.findUnique({
      where: { userId: friendUserId },
      include: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true, memberCode: true },
        },
        plots: {
          include: {
            cropInstance: {
              include: { crop: true, mutation: true },
            },
          },
          orderBy: { plotIndex: 'asc' },
        },
      },
    });

    if (!friendFarm) throw new NotFoundException('Không tìm thấy nông trại bạn bè');

    // Kiểm tra quan hệ bạn bè
    const friendship = await (this.prisma as any).farmFriendship.findFirst({
      where: {
        OR: [
          { userId, friendId: friendUserId },
          { userId: friendUserId, friendId: userId },
        ],
      },
    });

    const isFriend = friendship?.status === 'ACCEPTED';
    let relation: 'FRIEND' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'NONE' = 'NONE';
    if (friendship) {
      if (friendship.status === 'ACCEPTED') relation = 'FRIEND';
      else if (friendship.userId === userId) relation = 'PENDING_SENT';
      else relation = 'PENDING_RECEIVED';
    }

    // Ghi nhận ghé thăm nếu cách lần trước > 15 phút
    if (userId !== friendUserId) {
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const recentVisit = await (this.prisma as any).farmSocialActivity.findFirst({
          where: {
            farmOwnerId: friendUserId,
            actorUserId: userId,
            action: 'VISIT',
            createdAt: { gte: fifteenMinutesAgo },
          },
        });
        if (!recentVisit) {
          await (this.prisma as any).farmSocialActivity.create({
            data: {
              farmOwnerId: friendUserId,
              actorUserId: userId,
              action: 'VISIT',
            },
          });
        }
      } catch (e) {
        // non-blocking
      }
    }

    // Đọc thời gian bảo vệ từ config
    let protectionMinutes = 15;
    try {
      const configSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'farm_game_config' },
      });
      if (configSetting) {
        const parsed = JSON.parse(configSetting.value);
        if (typeof parsed.protectionWindowMinutes === 'number') protectionMinutes = parsed.protectionWindowMinutes;
      }
    } catch {}

    const now = new Date().getTime();
    const protectionWindowMs = protectionMinutes * 60 * 1000;

    // Lấy các lượt tưới nước trên nông trại này để kiểm tra giới hạn 2 user / cây
    const activePlotsPlantedAts = friendFarm.plots
      .filter((p) => p.cropInstance && !p.cropInstance.harvestedAt)
      .map((p) => p.cropInstance!.plantedAt);

    const oldestPlantedAt = activePlotsPlantedAts.length > 0
      ? new Date(Math.min(...activePlotsPlantedAts.map((d) => new Date(d).getTime())))
      : new Date();

    const friendWaterActions = await (this.prisma as any).farmFriendAction.findMany({
      where: {
        targetFarmId: friendFarm.id,
        actionType: 'WATER',
        createdAt: { gte: oldestPlantedAt },
      },
    });

    const enrichedPlots = friendFarm.plots.map((plot) => {
      let isReady = false;
      let isProtected = false;
      let protectionRemainingSec = 0;
      let canGather = false;
      let canWater = false;
      let needWater = false;
      let wateredUsersCount = 0;
      let hasUserWatered = false;

      if (plot.cropInstance && !plot.cropInstance.harvestedAt) {
        const readyTime = new Date(plot.cropInstance.readyAt).getTime();
        isReady = now >= readyTime;
        const elapsedSinceReady = now - readyTime;

        // Tìm các user khác nhau đã tưới nước cho cây trồng này kể từ khi gieo hạt
        const plotWaterActions = friendWaterActions.filter(
          (a: any) =>
            a.plotIndex === plot.plotIndex &&
            new Date(a.createdAt).getTime() >= new Date(plot.cropInstance!.plantedAt).getTime()
        );
        const distinctWaterers = new Set<string>(plotWaterActions.map((a: any) => a.actorUserId));
        wateredUsersCount = distinctWaterers.size;
        hasUserWatered = distinctWaterers.has(userId);

        if (isReady) {
          if (elapsedSinceReady < protectionWindowMs) {
            isProtected = true;
            protectionRemainingSec = Math.max(0, Math.ceil((protectionWindowMs - elapsedSinceReady) / 1000));
          } else if (plot.cropInstance.gatheredCount < plot.cropInstance.maxGatherAllowed) {
            canGather = true;
          }
        } else {
          // Cây đang lớn: Có thể tưới nếu chưa đủ 2 người và user này chưa tưới cây đó
          canWater = wateredUsersCount < 2 && !hasUserWatered;
          needWater = canWater;
        }
      }

      return {
        ...plot,
        status: isReady ? 'READY' : plot.status,
        isReady,
        isProtected,
        protectionRemainingSec,
        canGather,
        canWater,
        needWater,
        wateredUsersCount,
        hasUserWatered,
        maxWaterUsers: 2,
      };
    });

    return {
      farmId: friendFarm.id,
      userId: friendFarm.userId,
      user: friendFarm.user,
      level: friendFarm.level,
      treeLevel: friendFarm.treeLevel,
      plots: enrichedPlots,
      isFriend,
      relation,
    };
  }

  /**
   * Tưới nước giúp bạn bè (Giới hạn tối đa 15 lần/ngày; Mỗi cây có thể được tưới từ 2 user khác nhau)
   */
  async waterFriendPlot(userId: string, friendUserId: string, plotIndex: number) {
    if (userId === friendUserId) {
      throw new BadRequestException('Bạn không thể tưới hộ nông trại của chính mình');
    }

    return this.prisma.$transaction(async (tx) => {
      const today = getVietnamStartOfDay();

      // 1. Kiểm tra giới hạn số lần tưới hộ trong ngày
      const dailyCount = await tx.farmFriendAction.count({
        where: {
          actorUserId: userId,
          actionType: 'WATER',
          createdAt: { gte: today },
        },
      });

      if (dailyCount >= 15) {
        throw new BadRequestException('Bạn đã dùng hết 15 lượt tưới nước giúp bạn bè hôm nay');
      }

      const friendFarm = await tx.userFarm.findUnique({
        where: { userId: friendUserId },
        include: {
          plots: {
            where: { plotIndex },
            include: { cropInstance: true },
          },
        },
      });

      if (!friendFarm) throw new NotFoundException('Nông trại bạn bè không tồn tại');
      const plot = friendFarm.plots[0];
      if (!plot || !plot.cropInstance || plot.cropInstance.harvestedAt) {
        throw new BadRequestException('Không có cây nào trên ô đất này để tưới nước');
      }

      const now = new Date();
      if (now.getTime() >= new Date(plot.cropInstance.readyAt).getTime()) {
        throw new BadRequestException('Cây trồng đã chín rồi, không thể tưới nước thêm');
      }

      // 2. Kiểm tra danh sách các user đã tưới cho cây trồng này từ lúc gieo hạt (tối đa 2 user khác nhau)
      const previousWaterActions = await tx.farmFriendAction.findMany({
        where: {
          targetFarmId: friendFarm.id,
          plotIndex,
          actionType: 'WATER',
          createdAt: { gte: plot.cropInstance.plantedAt },
        },
      });

      const distinctActors = new Set<string>(previousWaterActions.map((a: any) => a.actorUserId));

      if (distinctActors.has(userId)) {
        throw new BadRequestException('Bạn đã tưới nước cho cây này rồi, hãy nhường cho bạn bè khác giúp đỡ nhé!');
      }

      if (distinctActors.size >= 2) {
        throw new BadRequestException('Cây này đã được 2 bạn bè khác tưới nước đầy đủ rồi (tối đa 2 người)!');
      }

      // 3. Rút ngắn thời gian sinh trưởng 5 phút khi được bạn bè tưới nước giúp đỡ
      const timeBonusMs = 5 * 60 * 1000;
      const currentReadyAt = new Date(plot.cropInstance.readyAt).getTime();
      const currentStage3At = new Date(plot.cropInstance.stage3At).getTime();
      const currentStage2At = new Date(plot.cropInstance.stage2At).getTime();
      const currentStage1At = new Date(plot.cropInstance.stage1At).getTime();

      await tx.farmCropInstance.update({
        where: { id: plot.cropInstance.id },
        data: {
          wateredCount: { increment: 1 },
          readyAt: new Date(Math.max(now.getTime(), currentReadyAt - timeBonusMs)),
          stage3At: new Date(Math.max(now.getTime(), currentStage3At - timeBonusMs)),
          stage2At: new Date(Math.max(now.getTime(), currentStage2At - timeBonusMs)),
          stage1At: new Date(Math.max(now.getTime(), currentStage1At - timeBonusMs)),
        },
      });

      await tx.farmPlot.update({
        where: { id: plot.id },
        data: {
          waterLevel: 100,
          status: FarmPlotStatus.WATERED,
          lastWateredAt: now,
        },
      });

      // Thưởng cho người tưới hộ: +15 Farm Coin, +10 EXP
      const myFarmWater = await tx.userFarm.upsert({
        where: { userId },
        create: {
          userId,
          farmCoin: 15,
          exp: 10,
          totalExp: 10,
          level: 1,
        },
        update: {
          farmCoin: { increment: 15 },
          exp: { increment: 10 },
          totalExp: { increment: 10 },
        },
      });

      // Ghi log hành động bạn bè
      await tx.farmFriendAction.create({
        data: {
          actorUserId: userId,
          targetFarmId: friendFarm.id,
          plotIndex,
          actionType: 'WATER',
          actionDate: today,
        },
      });

      // Ghi FarmSocialActivity nhật ký bạn bè
      await (tx as any).farmSocialActivity.create({
        data: {
          farmOwnerId: friendUserId,
          actorUserId: userId,
          action: 'WATER',
          plotIndex,
          cropId: plot.cropInstance?.cropId,
          cropName: plot.cropInstance?.cropNameSnapshot || 'Cây trồng',
          quantity: 1,
        },
      });

      // Ghi FarmTransaction cho người tưới
      await this.transactionService.recordTransaction(tx, {
        userId,
        farmId: myFarmWater?.id,
        type: 'FRIEND_WATER',
        source: 'SOCIAL',
        referenceId: `PLOT_${plotIndex}`,
        itemNameSnapshot: `Tưới nước ${plot.cropInstance?.cropNameSnapshot || 'Cây trồng'} (${distinctActors.size + 1}/2)`,
        itemIconUrl: '💧',
        quantity: 1,
        farmCoinDelta: 15,
        balanceCoinAfter: myFarmWater ? myFarmWater.farmCoin : undefined,
        status: 'COMPLETED',
      });

      this.farmGateway.emitPlotUpdated(friendUserId, {
        plotIndex,
        plot: {
          ...plot,
          waterLevel: 100,
          cropInstance: {
            ...plot.cropInstance,
            wateredCount: (plot.cropInstance.wateredCount || 0) + 1,
            readyAt: new Date(Math.max(now.getTime(), currentReadyAt - timeBonusMs)),
          },
        },
      });

      return {
        success: true,
        message: `Bạn đã tưới nước giúp bạn bè thành công! (Cây đã được ${distinctActors.size + 1}/2 bạn bè tưới)`,
        rewardCoin: 15,
        rewardExp: 10,
        wateredUsersCount: distinctActors.size + 1,
        maxWaterUsers: 2,
        remainingHelpsToday: 14 - dailyCount,
      };
    });
  }

  /**
   * Hái trộm may mắn (Lucky Gather) có kiểm soát thân thiện
   */
  async gatherFriendCrop(userId: string, friendUserId: string, plotIndex: number) {
    if (userId === friendUserId) {
      throw new BadRequestException('Không thể tự hái trộm chính mình');
    }

    return this.prisma.$transaction(async (tx) => {
      const today = getVietnamStartOfDay();

      // 1. Kiểm tra quan hệ bạn bè hay người lạ
      const friendship = await (tx as any).farmFriendship.findFirst({
        where: {
          OR: [
            { userId, friendId: friendUserId, status: 'ACCEPTED' },
            { userId: friendUserId, friendId: userId, status: 'ACCEPTED' },
          ],
        },
      });

      const isFriend = !!friendship;
      let strangerMax = 3;
      let friendMax = 10;
      let protectionMinutes = 15;
      try {
        const configSetting = await tx.systemSetting.findUnique({
          where: { key: 'farm_game_config' },
        });
        if (configSetting) {
          const parsed = JSON.parse(configSetting.value);
          if (typeof parsed.strangerDailyStealLimit === 'number') strangerMax = parsed.strangerDailyStealLimit;
          if (typeof parsed.friendDailyStealLimit === 'number') friendMax = parsed.friendDailyStealLimit;
          if (typeof parsed.protectionWindowMinutes === 'number') protectionMinutes = parsed.protectionWindowMinutes;
        }
      } catch {}

      const maxAllowed = isFriend ? friendMax : strangerMax;

      // 2. Kiểm tra giới hạn lượt lấy trộm trong ngày
      const dailyCount = await tx.farmFriendAction.count({
        where: {
          actorUserId: userId,
          actionType: 'GATHER',
          isFriend,
          createdAt: { gte: today },
        },
      });

      if (dailyCount >= maxAllowed) {
        const typeStr = isFriend ? `bạn bè (tối đa ${friendMax} lượt/ngày)` : `người lạ (tối đa ${strangerMax} lượt/ngày)`;
        throw new BadRequestException(`Bạn đã dùng hết số lượt hái trộm từ ${typeStr}!`);
      }

      const friendFarm = await tx.userFarm.findUnique({
        where: { userId: friendUserId },
        include: {
          plots: {
            where: { plotIndex },
            include: {
              cropInstance: {
                include: { crop: true, mutation: true },
              },
            },
          },
        },
      });

      if (!friendFarm) throw new NotFoundException('Nông trại bạn bè không tồn tại');
      const plot = friendFarm.plots[0];
      if (!plot || !plot.cropInstance || plot.cropInstance.harvestedAt) {
        throw new BadRequestException('Ô đất này không có cây chín để hái');
      }

      const instance = plot.cropInstance;
      const now = new Date().getTime();
      const readyTime = new Date(instance.readyAt).getTime();

      if (now < readyTime) {
        throw new BadRequestException('Cây trên ô đất này chưa chín tới');
      }

      // Cửa sổ bảo vệ: Trong X phút đầu kể từ khi chín, chỉ chủ nông trại mới được thu hoạch
      const elapsedSinceReady = now - readyTime;
      if (elapsedSinceReady < protectionMinutes * 60 * 1000) {
        throw new BadRequestException(`Cây vừa mới chín và đang trong thời gian bảo vệ của chủ nông trại (${protectionMinutes} phút)`);
      }

      if (instance.gatheredCount >= instance.maxGatherAllowed) {
        throw new BadRequestException('Cây này đã có người hái phần may mắn rồi');
      }

      // Đánh dấu đã hái 1 quả
      await tx.farmCropInstance.update({
        where: { id: instance.id },
        data: { gatheredCount: { increment: 1 } },
      });

      // Tặng 1 sản phẩm cho người hái
      const myFarm = await tx.userFarm.findUnique({ where: { userId } });
      if (myFarm) {
        await this.inventoryService.addItem(tx, myFarm.id, {
          itemType: FarmItemType.CROP,
          referenceId: instance.cropId,
          itemName: instance.cropNameSnapshot,
          itemCode: instance.crop.code,
          quantity: 1,
          rarity: instance.crop.rarity,
        });
      }

      await tx.farmFriendAction.create({
        data: {
          actorUserId: userId,
          targetFarmId: friendFarm.id,
          plotIndex,
          actionType: 'GATHER',
          yieldTaken: 1,
          isFriend,
          actionDate: today,
        },
      });

      // Ghi 1 bản ghi FarmSocialActivity chung cho cả 2 phía
      await (tx as any).farmSocialActivity.create({
        data: {
          farmOwnerId: friendUserId,
          actorUserId: userId,
          action: 'STEAL',
          plotIndex,
          cropId: instance.cropId,
          cropCode: instance.crop?.code,
          cropName: instance.cropNameSnapshot || instance.crop?.name || 'Nông sản',
          quantity: 1,
        },
      });

      // Ghi FarmTransaction cho người đi hái (GAIN)
      await this.transactionService.recordTransaction(tx, {
        userId,
        farmId: myFarm?.id,
        type: 'FRIEND_STEAL_GAIN',
        source: 'SOCIAL',
        referenceId: instance.id,
        itemId: instance.cropId,
        itemCode: instance.crop?.code,
        itemNameSnapshot: instance.cropNameSnapshot || instance.crop?.name || 'Nông sản',
        itemIconUrl: '🌾',
        quantity: 1,
        status: 'COMPLETED',
        metadata: { friendUserId, plotIndex },
      });

      // Ghi FarmTransaction cho chủ nông trại (LOSS)
      await this.transactionService.recordTransaction(tx, {
        userId: friendUserId,
        farmId: friendFarm.id,
        type: 'FRIEND_STEAL_LOSS',
        source: 'SOCIAL',
        referenceId: instance.id,
        itemId: instance.cropId,
        itemCode: instance.crop?.code,
        itemNameSnapshot: instance.cropNameSnapshot || instance.crop?.name || 'Nông sản',
        itemIconUrl: '🌾',
        quantity: 1,
        status: 'COMPLETED',
        metadata: { stealerUserId: userId, plotIndex },
      });

      const remainingToday = Math.max(0, maxAllowed - dailyCount - 1);

      return {
        success: true,
        message: `Bạn đã lấy trộm 1 ${instance.cropNameSnapshot || instance.crop?.name || 'Nông sản'} từ nông trại ${isFriend ? 'bạn bè' : 'người lạ'}!`,
        cropName: instance.cropNameSnapshot || instance.crop?.name || 'Nông sản',
        quantity: 1,
        isFriend,
        remainingGathersToday: remainingToday,
      };
    });
  }

  /**
   * Lấy nhật ký bạn bè (Ai ghé thăm, ai tưới nước, ai hái trộm nông sản gì, bao nhiêu, lúc nào)
   */
  async getSocialJournal(userId: string, limit: number = 40) {
    const activities = await (this.prisma as any).farmSocialActivity.findMany({
      where: {
        OR: [{ farmOwnerId: userId }, { actorUserId: userId }],
      },
      include: {
        actorUser: {
          select: { id: true, fullName: true, username: true, avatarUrl: true, memberCode: true },
        },
        farmOwner: {
          select: { id: true, fullName: true, username: true, avatarUrl: true, memberCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return activities.map((act: any) => {
      const isOwner = act.farmOwnerId === userId;
      const isActor = act.actorUserId === userId;

      const actorName = act.actorUser?.fullName || act.actorUser?.username || 'Bạn bè';
      const ownerName = act.farmOwner?.fullName || act.farmOwner?.username || 'Bạn bè';
      const cropName = act.cropName || 'Nông sản';
      const plotNum = act.plotIndex !== null && act.plotIndex !== undefined ? act.plotIndex + 1 : null;

      let message = '';
      let isPositive = true;

      if (act.action === 'VISIT') {
        message = isOwner
          ? `${actorName} đã ghé thăm nông trại của bạn.`
          : `Bạn đã ghé thăm nông trại của ${ownerName}.`;
      } else if (act.action === 'WATER') {
        message = isOwner
          ? `${actorName} đã tưới nước cho ${cropName}${plotNum ? ` tại Ô đất #${plotNum}` : ''}.`
          : `Bạn đã giúp tưới cây cho ${ownerName}${plotNum ? ` tại Ô đất #${plotNum}` : ''}.`;
      } else if (act.action === 'STEAL') {
        isPositive = false;
        message = isOwner
          ? `${actorName} đã lấy ${act.quantity} ${cropName} từ nông trại của bạn.`
          : `Bạn đã lấy ${act.quantity} ${cropName} từ nông trại của ${ownerName}.`;
      } else {
        message = isOwner
          ? `${actorName} đã tương tác với nông trại của bạn.`
          : `Bạn đã tương tác với nông trại của ${ownerName}.`;
      }

      return {
        id: act.id,
        action: act.action,
        isOwner,
        isActor,
        isPositive,
        message,
        actor: act.actorUser,
        targetOwner: act.farmOwner,
        cropName,
        quantity: act.quantity,
        plotIndex: act.plotIndex,
        createdAt: act.createdAt,
      };
    });
  }
}
