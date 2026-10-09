import { Injectable, BadRequestException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { FarmMissionType, FarmItemType } from '@prisma/client';
import { calculateExpProgression } from './farm-progression.util';
import {
  getVietnamDateKey,
  getVietnamSecondsUntilNextReset,
  getVietnamNextReset,
} from './farm-time.util';

import { FarmTransactionService } from './farm-transaction.service';

@Injectable()
export class FarmMissionService implements OnModuleInit {
  private readonly logger = new Logger(FarmMissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly transactionService: FarmTransactionService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultMissions();
  }

  /**
   * Lấy tóm tắt số lượng nhiệm vụ cần nhận thưởng và thời gian reset (chuẩn múi giờ Việt Nam)
   */
  async getMissionsSummary(userId: string) {
    const todayStr = getVietnamDateKey();
    const missions = await this.prisma.farmMission.findMany({
      where: { isActive: true },
      select: { id: true, type: true, targetCount: true },
    });

    const progresses = await this.prisma.farmMissionProgress.findMany({
      where: {
        userId,
        periodKey: { in: [todayStr, 'LIFETIME'] },
      },
      select: { missionId: true, currentCount: true, isCompleted: true, isClaimed: true },
    });

    const progressMap = new Map<string, any>();
    for (const p of progresses) {
      progressMap.set(p.missionId, p);
    }

    let unclaimedCount = 0;
    let dailyCompletedCount = 0;
    let dailyTotalCount = 0;

    for (const m of missions) {
      const p = progressMap.get(m.id);
      const isCompleted = p?.isCompleted ?? ((p?.currentCount || 0) >= m.targetCount);
      const isClaimed = p?.isClaimed || false;

      if (m.type === FarmMissionType.DAILY) {
        dailyTotalCount++;
        if (isCompleted) dailyCompletedCount++;
      }
      if (isCompleted && !isClaimed) {
        unclaimedCount++;
      }
    }

    return {
      unclaimedCount,
      dailyCompletedCount,
      dailyTotalCount,
      secondsUntilReset: getVietnamSecondsUntilNextReset(),
      vietnamDateKey: todayStr,
      nextResetAt: getVietnamNextReset().toISOString(),
    };
  }

  /**
   * Lấy danh sách nhiệm vụ kèm tiến độ của người dùng (phân chương & nhiệm vụ ngày)
   * Sử dụng múi giờ Việt Nam (Asia/Ho_Chi_Minh) cho toàn bộ chu kỳ Daily
   */
  async getUserMissions(userId: string) {
    const todayStr = getVietnamDateKey();
    const missions = await this.prisma.farmMission.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    });

    const progresses = await this.prisma.farmMissionProgress.findMany({
      where: { userId },
    });

    const progressMap = new Map<string, any>();
    for (const p of progresses) {
      progressMap.set(`${p.missionId}_${p.periodKey}`, p);
    }

    let unclaimedCount = 0;
    let dailyCompletedCount = 0;
    let dailyTotalCount = 0;
    let achievementCompletedCount = 0;
    let achievementTotalCount = 0;

    const enrichedMissions = missions.map((m) => {
      const periodKey = m.type === FarmMissionType.DAILY ? todayStr : 'LIFETIME';
      const userProgress = progressMap.get(`${m.id}_${periodKey}`);

      const currentCount = userProgress?.currentCount || 0;
      const isCompleted = currentCount >= m.targetCount;
      const isClaimed = userProgress?.isClaimed || false;

      if (m.type === FarmMissionType.DAILY) {
        dailyTotalCount++;
        if (isCompleted) dailyCompletedCount++;
      } else {
        achievementTotalCount++;
        if (isCompleted) achievementCompletedCount++;
      }

      if (isCompleted && !isClaimed) {
        unclaimedCount++;
      }

      let chapter = 1;
      let chapterTitle = 'Chương 1: Khởi đầu nông trang';
      if (m.code.includes('CH2')) {
        chapter = 2;
        chapterTitle = 'Chương 2: Kinh doanh trong trồng trọt';
      } else if (m.code.includes('CH3')) {
        chapter = 3;
        chapterTitle = 'Chương 3: Bậc thầy thực vật & Biến dị';
      } else if (m.code.includes('CH4')) {
        chapter = 4;
        chapterTitle = 'Chương 4: Tinh hoa ẩm thực hoàng gia';
      }

      let rewardItemCode: string | null = null;
      let rewardItemName: string | null = null;
      if (m.code.includes('CH1_PLANT_10') || m.code.includes('CH1_LEVEL_3')) {
        rewardItemCode = 'SEED_PACK_BASIC';
        rewardItemName = 'Gói ngẫu nhiên';
      } else if (m.code.includes('CH2_COLLECT_10') || m.code.includes('CH2_LEVEL_5')) {
        rewardItemCode = 'SEED_PACK_RARE';
        rewardItemName = 'Gói ngẫu nhiên hiếm';
      } else if (m.code.includes('CH3_MUTATION_5') || m.code.includes('CH3_LEVEL_7') || m.code.includes('CH4_COLLECT_ALL')) {
        rewardItemCode = 'SEED_PACK_LEGENDARY';
        rewardItemName = 'Gói Thần Nông';
      }

      return {
        id: m.id,
        code: m.code,
        title: m.title,
        description: m.description,
        type: m.type,
        chapter,
        chapterTitle,
        actionType: m.actionType,
        targetCount: m.targetCount,
        currentCount: Math.min(currentCount, m.targetCount),
        isCompleted,
        isClaimed,
        rewardExp: m.rewardExp,
        rewardFarmCoin: m.rewardFarmCoin,
        rewardLoyaltyPoints: m.rewardLoyaltyPoints,
        rewardItemCode,
        rewardItemName,
        periodKey,
      };
    });

    const summary = {
      unclaimedCount,
      dailyCompletedCount,
      dailyTotalCount,
      achievementCompletedCount,
      achievementTotalCount,
      secondsUntilReset: getVietnamSecondsUntilNextReset(),
      vietnamDateKey: todayStr,
      nextResetAt: getVietnamNextReset().toISOString(),
    };

    return {
      missions: enrichedMissions,
      summary,
    };
  }

  /**
   * Ghi nhận tiến độ một hành động (PLANT, WATER, FERTILIZE, HARVEST, DISCOVER_MUTATION, HELP_FRIEND, STEAL_CROP)
   * Sử dụng múi giờ Việt Nam (Asia/Ho_Chi_Minh) cho Daily periodKey
   */
  async trackAction(userId: string, actionType: string, count: number = 1) {
    const todayStr = getVietnamDateKey();
    const missions = await this.prisma.farmMission.findMany({
      where: { actionType, isActive: true },
    });

    for (const m of missions) {
      const periodKey = m.type === FarmMissionType.DAILY ? todayStr : 'LIFETIME';
      const existing = await this.prisma.farmMissionProgress.findUnique({
        where: {
          userId_missionId_periodKey: {
            userId,
            missionId: m.id,
            periodKey,
          },
        },
      });

      if (!existing) {
        await this.prisma.farmMissionProgress.create({
          data: {
            userId,
            missionId: m.id,
            periodKey,
            currentCount: count,
            isCompleted: count >= m.targetCount,
            completedAt: count >= m.targetCount ? new Date() : null,
          },
        });
      } else if (!existing.isCompleted) {
        const newCount = existing.currentCount + count;
        const isCompleted = newCount >= m.targetCount;
        await this.prisma.farmMissionProgress.update({
          where: { id: existing.id },
          data: {
            currentCount: newCount,
            isCompleted,
            completedAt: isCompleted ? new Date() : null,
          },
        });
      }
    }
  }

  /**
   * Nhận toàn bộ phần thưởng nhiệm vụ đã hoàn thành
   */
  async claimAllRewards(userId: string, type?: FarmMissionType) {
    const todayStr = getVietnamDateKey();
    const missions = await this.prisma.farmMission.findMany({
      where: { isActive: true, ...(type ? { type } : {}) },
    });

    const progresses = await this.prisma.farmMissionProgress.findMany({
      where: {
        userId,
        periodKey: { in: [todayStr, 'LIFETIME'] },
        isClaimed: false,
      },
    });

    const progressMap = new Map<string, any>();
    for (const p of progresses) {
      progressMap.set(p.missionId, p);
    }

    const claimableMissions = missions.filter((m) => {
      const p = progressMap.get(m.id);
      return p && p.currentCount >= m.targetCount && !p.isClaimed;
    });

    if (claimableMissions.length === 0) {
      return {
        success: true,
        claimedCount: 0,
        message: 'Không có phần thưởng nhiệm vụ nào cần nhận',
        totalExpGained: 0,
        totalFarmCoinGained: 0,
        totalLuckyTicketsGained: 0,
      };
    }

    let totalExpGained = 0;
    let totalFarmCoinGained = 0;
    let totalLoyaltyGained = 0;
    let totalLuckyTicketsGained = 0;
    const claimedMissionIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      const luckyConfig = await tx.farmLuckyEnvelopeConfig.findUnique({
        where: { key: 'DEFAULT' },
      });
      const ticketsPerMission = (luckyConfig?.isEventActive ? luckyConfig.ticketsPerMission : 0) || 0;

      for (const mission of claimableMissions) {
        const periodKey = mission.type === FarmMissionType.DAILY ? todayStr : 'LIFETIME';
        const updated = await tx.farmMissionProgress.updateMany({
          where: {
            userId,
            missionId: mission.id,
            periodKey,
            isClaimed: false,
          },
          data: {
            isClaimed: true,
            claimedAt: new Date(),
          },
        });

        if (updated.count > 0) {
          totalExpGained += mission.rewardExp;
          totalFarmCoinGained += mission.rewardFarmCoin;
          totalLoyaltyGained += mission.rewardLoyaltyPoints;
          totalLuckyTicketsGained += ticketsPerMission;
          claimedMissionIds.push(mission.id);

          let pack: string | null = null;
          if (mission.code.includes('CH1_PLANT_10') || mission.code.includes('CH1_LEVEL_3')) {
            pack = 'SEED_PACK_BASIC';
          } else if (mission.code.includes('CH2_COLLECT_10') || mission.code.includes('CH2_LEVEL_5')) {
            pack = 'SEED_PACK_RARE';
          } else if (
            mission.code.includes('CH3_MUTATION_5') ||
            mission.code.includes('CH3_LEVEL_7') ||
            mission.code.includes('CH4_COLLECT_ALL')
          ) {
            pack = 'SEED_PACK_LEGENDARY';
          }

          if (pack) {
            const farm = await tx.userFarm.findUnique({ where: { userId } });
            if (farm) {
              await this.inventoryService.addItem(tx, farm.id, {
                itemType: FarmItemType.TOOL,
                referenceId: pack,
                itemName:
                  pack === 'SEED_PACK_BASIC'
                    ? 'Gói Hạt Giống Thường'
                    : pack === 'SEED_PACK_RARE'
                    ? 'Gói Hạt Giống Quý Hiếm'
                    : 'Gói Thần Nông Bí Ẩn',
                itemCode: pack,
                quantity: 1,
              });
            }
          }
        }
      }

      if (claimedMissionIds.length > 0) {
        const farm = await tx.userFarm.findUnique({ where: { userId } });
        if (farm) {
          const expProg = calculateExpProgression(farm.level, farm.exp, farm.totalExp, totalExpGained);
          await tx.userFarm.update({
            where: { userId },
            data: {
              level: expProg.levelAfter,
              exp: expProg.expAfter,
              totalExp: expProg.newTotalExp,
              farmCoin: { increment: totalFarmCoinGained },
              pendingLevelUp: expProg.canLevelUp,
              ...(totalLuckyTicketsGained > 0
                ? {
                    luckyEnvelopeTickets: { increment: totalLuckyTicketsGained },
                    totalLuckyEnvelopeTicketsEarned: { increment: totalLuckyTicketsGained },
                  }
                : {}),
            },
          });
        }

        if (totalLoyaltyGained > 0) {
          await tx.user.update({
            where: { id: userId },
            data: {
              points: { increment: totalLoyaltyGained },
              currentPoints: { increment: totalLoyaltyGained },
            },
          });
        }
      }
    });

    const updatedFarm = await this.prisma.userFarm.findUnique({ where: { userId } });

    return {
      success: true,
      claimedCount: claimedMissionIds.length,
      claimedMissionIds,
      totalExpGained,
      totalFarmCoinGained,
      totalLuckyTicketsGained,
      farm: updatedFarm,
    };
  }

  /**
   * Nhận phần thưởng nhiệm vụ
   */
  async claimReward(userId: string, missionCodeOrId: string) {
    if (!missionCodeOrId || typeof missionCodeOrId !== 'string') {
      throw new BadRequestException('Mã hoặc ID nhiệm vụ không hợp lệ');
    }

    return this.prisma.$transaction(async (tx) => {
      const mission = await tx.farmMission.findFirst({
        where: {
          OR: [{ code: missionCodeOrId }, { id: missionCodeOrId }],
        },
      });
      if (!mission) throw new NotFoundException('Nhiệm vụ không tồn tại');

      const todayStr = getVietnamDateKey();
      const periodKey = mission.type === FarmMissionType.DAILY ? todayStr : 'LIFETIME';

      const progress = await tx.farmMissionProgress.findUnique({
        where: {
          userId_missionId_periodKey: {
            userId,
            missionId: mission.id,
            periodKey,
          },
        },
      });

      if (!progress || progress.currentCount < mission.targetCount) {
        throw new BadRequestException('Bạn chưa hoàn thành mục tiêu nhiệm vụ này');
      }

      // Đánh dấu đã nhận ATOMICALLY (chống double claim, spam API, mở nhiều tab)
      const claimResult = await tx.farmMissionProgress.updateMany({
        where: {
          id: progress.id,
          isClaimed: false,
        },
        data: {
          isClaimed: true,
          claimedAt: new Date(),
        },
      });

      if (claimResult.count === 0) {
        throw new BadRequestException('Phần thưởng này đã được nhận rồi (MISSION_ALREADY_CLAIMED)');
      }

      // Lấy cấu hình sự kiện Lì Xì May Mắn
      let luckyEnvelopeTicketsGranted = 0;
      const luckyConfig = await tx.farmLuckyEnvelopeConfig.findUnique({
        where: { key: 'DEFAULT' },
      });
      if (luckyConfig?.isEventActive) {
        luckyEnvelopeTicketsGranted = luckyConfig.ticketsPerMission || 1;
      }

      // Lấy farm hiện tại
      const farm = await tx.userFarm.findUnique({
        where: { userId },
      });
      if (!farm) throw new NotFoundException('Nông trại không tồn tại');

      const expProg = calculateExpProgression(
        farm.level,
        farm.exp,
        farm.totalExp,
        mission.rewardExp,
      );

      // Thưởng gói hạt giống ngẫu nhiên nếu có
      let awardedPack: string | null = null;
      if (mission.code.includes('CH1_PLANT_10') || mission.code.includes('CH1_LEVEL_3')) {
        awardedPack = 'SEED_PACK_BASIC';
      } else if (mission.code.includes('CH2_COLLECT_10') || mission.code.includes('CH2_LEVEL_5')) {
        awardedPack = 'SEED_PACK_RARE';
      } else if (mission.code.includes('CH3_MUTATION_5') || mission.code.includes('CH3_LEVEL_7') || mission.code.includes('CH4_COLLECT_ALL')) {
        awardedPack = 'SEED_PACK_LEGENDARY';
      }

      if (awardedPack) {
        await this.inventoryService.addItem(tx, farm.id, {
          itemType: FarmItemType.TOOL,
          referenceId: awardedPack,
          itemName: awardedPack === 'SEED_PACK_BASIC' ? 'Gói Hạt Giống Thường' : (awardedPack === 'SEED_PACK_RARE' ? 'Gói Hạt Giống Quý Hiếm' : 'Gói Thần Nông Bí Ẩn'),
          itemCode: awardedPack,
          quantity: 1,
        });
      }

      // Cập nhật farm và cộng vé lì xì may mắn
      const updatedFarm = await tx.userFarm.update({
        where: { userId },
        data: {
          level: expProg.levelAfter,
          exp: expProg.expAfter,
          totalExp: expProg.newTotalExp,
          farmCoin: { increment: mission.rewardFarmCoin },
          pendingLevelUp: expProg.canLevelUp,
          ...(luckyEnvelopeTicketsGranted > 0
            ? {
                luckyEnvelopeTickets: { increment: luckyEnvelopeTicketsGranted },
                totalLuckyEnvelopeTicketsEarned: { increment: luckyEnvelopeTicketsGranted },
              }
            : {}),
        },
      });

      if (mission.rewardLoyaltyPoints > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            points: { increment: mission.rewardLoyaltyPoints },
            currentPoints: { increment: mission.rewardLoyaltyPoints },
          },
        });
      }

      // Ghi FarmTransaction Ledger
      if (mission.rewardFarmCoin > 0 || mission.rewardLoyaltyPoints > 0) {
        await this.transactionService.recordTransaction(tx, {
          userId,
          farmId: farm.id,
          type: 'MISSION_REWARD',
          source: 'MISSION',
          referenceId: mission.code,
          itemNameSnapshot: mission.title,
          itemIconUrl: '🎯',
          farmCoinDelta: mission.rewardFarmCoin || 0,
          avoraPointDelta: mission.rewardLoyaltyPoints || 0,
          balanceCoinAfter: updatedFarm.farmCoin,
          status: 'COMPLETED',
        });
      }

      return {
        success: true,
        missionId: mission.id,
        missionCode: mission.code,
        missionTitle: mission.title,
        expBefore: expProg.expBefore,
        expGained: expProg.expGained,
        expAfter: expProg.expAfter,
        levelBefore: expProg.levelBefore,
        levelAfter: expProg.levelAfter,
        canLevelUp: expProg.canLevelUp,
        rewardExp: mission.rewardExp,
        rewardFarmCoin: mission.rewardFarmCoin,
        rewardLoyaltyPoints: mission.rewardLoyaltyPoints,
        awardedPack,
        luckyEnvelopeTicketsGranted,
        luckyEnvelopeTickets: updatedFarm.luckyEnvelopeTickets,
        farm: {
          level: updatedFarm.level,
          exp: updatedFarm.exp,
          totalExp: updatedFarm.totalExp,
          farmCoin: updatedFarm.farmCoin,
          energy: updatedFarm.energy,
          pendingLevelUp: updatedFarm.pendingLevelUp,
          luckyEnvelopeTickets: updatedFarm.luckyEnvelopeTickets,
        },
      };
    });
  }

  /**
   * Khởi tạo và cập nhật đầy đủ các nhiệm vụ (Nhiệm vụ Ngày & Nhiệm vụ Chương)
   */
  private async seedDefaultMissions() {
    this.logger.log('Seeding AVORA Farm default & chapter missions...');

    const defaultMissions = [
      // 1. NHIỆM VỤ HÀNG NGÀY (DAILY)
      {
        code: 'DAILY_PLANT_5',
        title: 'Gieo Mầm Sự Sống',
        description: 'Gieo 5 hạt giống bất kỳ vào nông trại hôm nay.',
        type: FarmMissionType.DAILY,
        actionType: 'PLANT',
        targetCount: 5,
        rewardExp: 30,
        rewardFarmCoin: 25,
        rewardLoyaltyPoints: 0,
        sortOrder: 1,
      },
      {
        code: 'DAILY_WATER_6',
        title: 'Giọt Nước Tươi Mát',
        description: 'Tưới nước 6 lần cho cây trồng.',
        type: FarmMissionType.DAILY,
        actionType: 'WATER',
        targetCount: 6,
        rewardExp: 25,
        rewardFarmCoin: 20,
        rewardLoyaltyPoints: 0,
        sortOrder: 2,
      },
      {
        code: 'DAILY_FERTILIZE_2',
        title: 'Dinh Dưỡng Đất Mẹ',
        description: 'Bón phân 2 lần cho cây trồng trên đảo mây.',
        type: FarmMissionType.DAILY,
        actionType: 'FERTILIZE',
        targetCount: 2,
        rewardExp: 35,
        rewardFarmCoin: 30,
        rewardLoyaltyPoints: 0,
        sortOrder: 3,
      },
      {
        code: 'DAILY_HARVEST_5',
        title: 'Mùa Vụ Bội Thu',
        description: 'Thu hoạch 5 cây trồng chín tới.',
        type: FarmMissionType.DAILY,
        actionType: 'HARVEST',
        targetCount: 5,
        rewardExp: 40,
        rewardFarmCoin: 35,
        rewardLoyaltyPoints: 0,
        sortOrder: 4,
      },
      {
        code: 'DAILY_MUTATION_1',
        title: 'Điều Kỳ Diệu Tự Nhiên',
        description: 'Khám phá thành công 1 cây trồng đột biến sinh học.',
        type: FarmMissionType.DAILY,
        actionType: 'DISCOVER_MUTATION',
        targetCount: 1,
        rewardExp: 80,
        rewardFarmCoin: 60,
        rewardLoyaltyPoints: 1,
        sortOrder: 5,
      },
      {
        code: 'DAILY_HELP_3',
        title: 'Tình Làng Nghĩa Xóm',
        description: 'Tưới nước giúp đỡ 3 nông trại bạn bè.',
        type: FarmMissionType.DAILY,
        actionType: 'HELP_FRIEND',
        targetCount: 3,
        rewardExp: 35,
        rewardFarmCoin: 30,
        rewardLoyaltyPoints: 0,
        sortOrder: 6,
      },

      // 2. CHƯƠNG 1: KHỞI ĐẦU NÔNG TRANG
      {
        code: 'MAIN_CH1_PLANT_10',
        title: 'Vụ Mùa Đầu Tiên',
        description: 'Gieo 10 hạt giống các loại vào đất canh tác.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'PLANT',
        targetCount: 10,
        rewardExp: 100,
        rewardFarmCoin: 150,
        rewardLoyaltyPoints: 0,
        sortOrder: 10,
      },
      {
        code: 'MAIN_CH1_HARVEST_15',
        title: 'Gặt Hái Thành Quả',
        description: 'Thu hoạch tích lũy 15 cây trồng chín tới.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'HARVEST',
        targetCount: 15,
        rewardExp: 120,
        rewardFarmCoin: 180,
        rewardLoyaltyPoints: 0,
        sortOrder: 11,
      },
      {
        code: 'MAIN_CH1_WATER_20',
        title: 'Dòng Suối Sinh Mệnh',
        description: 'Tưới nước chăm sóc cây trồng 20 lần.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'WATER',
        targetCount: 20,
        rewardExp: 100,
        rewardFarmCoin: 100,
        rewardLoyaltyPoints: 0,
        sortOrder: 12,
      },
      {
        code: 'MAIN_CH1_LEVEL_3',
        title: 'Trang Trại Vươn Mình',
        description: 'Đạt cấp độ trang trại Cấp 3.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'LEVEL_UP',
        targetCount: 3,
        rewardExp: 150,
        rewardFarmCoin: 250,
        rewardLoyaltyPoints: 0,
        sortOrder: 13,
      },

      // 3. CHƯƠNG 2: KINH DOANH TRONG TRỒNG TRỌT
      {
        code: 'MAIN_CH2_COLLECT_10',
        title: 'Bách Khoa Toàn Thư Cây Trồng',
        description: 'Bách khoa toàn thư đã mở khóa 10 loại cây trồng.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'HARVEST',
        targetCount: 10,
        rewardExp: 200,
        rewardFarmCoin: 300,
        rewardLoyaltyPoints: 2,
        sortOrder: 20,
      },
      {
        code: 'MAIN_CH2_LEVEL_5',
        title: 'Đạt Cấp Độ Trang Trại Cấp 5',
        description: 'Nâng cấp nông trại đạt cấp độ 5 trở lên.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'LEVEL_UP',
        targetCount: 5,
        rewardExp: 250,
        rewardFarmCoin: 400,
        rewardLoyaltyPoints: 2,
        sortOrder: 21,
      },
      {
        code: 'MAIN_CH2_HARVEST_50',
        title: 'Canh Tác Bội Thu',
        description: 'Thu hoạch tích lũy 50 cây trồng trên nông trại.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'HARVEST',
        targetCount: 50,
        rewardExp: 250,
        rewardFarmCoin: 500,
        rewardLoyaltyPoints: 5,
        sortOrder: 22,
      },
      {
        code: 'MAIN_CH2_FERTILIZE_15',
        title: 'Thổ Nhưỡng Phì Nhiêu',
        description: 'Bón phân cho cây trồng 15 lần.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'FERTILIZE',
        targetCount: 15,
        rewardExp: 180,
        rewardFarmCoin: 250,
        rewardLoyaltyPoints: 0,
        sortOrder: 23,
      },

      // 4. CHƯƠNG 3: BẬC THẦY THỰC VẬT & BIẾN DỊ
      {
        code: 'MAIN_CH3_MUTATION_5',
        title: 'Nhà Sinh Học Tài Ba',
        description: 'Khám phá thành công 5 dạng đột biến thực vật.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'DISCOVER_MUTATION',
        targetCount: 5,
        rewardExp: 350,
        rewardFarmCoin: 600,
        rewardLoyaltyPoints: 5,
        sortOrder: 30,
      },
      {
        code: 'MAIN_CH3_LEVEL_7',
        title: 'Đại Phú Nông Đảo Mây',
        description: 'Đạt cấp độ trang trại Cấp 7.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'LEVEL_UP',
        targetCount: 7,
        rewardExp: 400,
        rewardFarmCoin: 800,
        rewardLoyaltyPoints: 5,
        sortOrder: 31,
      },
      {
        code: 'MAIN_CH3_HARVEST_100',
        title: 'Trăm Mùa Bội Thu',
        description: 'Thu hoạch tích lũy 100 cây trồng các loại.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'HARVEST',
        targetCount: 100,
        rewardExp: 450,
        rewardFarmCoin: 900,
        rewardLoyaltyPoints: 10,
        sortOrder: 32,
      },

      // 5. CHƯƠNG 4: TINH HOA ẨM THỰC HOÀNG GIA
      {
        code: 'MAIN_CH4_COLLECT_ALL',
        title: 'Bách Khoa Hoàn Hảo',
        description: 'Bách khoa toàn thư đã mở khóa 20 loại cây trồng & đột biến.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'HARVEST',
        targetCount: 20,
        rewardExp: 600,
        rewardFarmCoin: 1500,
        rewardLoyaltyPoints: 15,
        sortOrder: 40,
      },
      {
        code: 'MAIN_CH4_LEVEL_10',
        title: 'Huyền Thoại Nông Điền AVORA',
        description: 'Đạt cấp độ trang trại Cấp 10.',
        type: FarmMissionType.ACHIEVEMENT,
        actionType: 'LEVEL_UP',
        targetCount: 10,
        rewardExp: 800,
        rewardFarmCoin: 2000,
        rewardLoyaltyPoints: 20,
        sortOrder: 41,
      },
    ];

    for (const m of defaultMissions) {
      const existing = await this.prisma.farmMission.findUnique({ where: { code: m.code } });
      if (!existing) {
        await this.prisma.farmMission.create({ data: m });
      }
    }

    this.logger.log('AVORA Farm default & chapter missions seeded successfully.');
  }
}
