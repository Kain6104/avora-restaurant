import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FarmTransactionService } from './farm-transaction.service';
import { InventoryService } from './inventory.service';
import { FarmItemType, PointTransactionSource } from '@prisma/client';

export interface FarmMailRewardItem {
  type: 'COIN' | 'AVORA_POINT' | 'SEED' | 'PRODUCE' | 'ITEM' | 'MYSTERY_PACK' | 'VOUCHER' | 'DECORATION';
  code?: string;
  name: string;
  quantity: number;
  iconUrl?: string;
  voucherId?: string;
}

export interface CreateFarmMailDto {
  title: string;
  sender?: string;
  content: string;
  bannerUrl?: string;
  type?: 'MAINTENANCE' | 'EVENT' | 'COMPENSATION' | 'ADMIN_CUSTOM' | 'SYSTEM' | 'SEASONAL';
  targetType?: 'ALL' | 'SPECIFIC_USERS' | 'LEVEL_RANGE' | 'MEMBERSHIP_TIER' | 'INACTIVE_USERS' | 'BRANCH';
  targetValue?: any;
  rewards: FarmMailRewardItem[];
  scheduledAt?: string | Date;
  expiresAt?: string | Date;
}

@Injectable()
export class FarmMailService {
  private readonly logger = new Logger(FarmMailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionService: FarmTransactionService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Đồng bộ các thư phát hành chung (ALL, LEVEL_RANGE, MEMBERSHIP_TIER) vào hộp thư người chơi nếu chưa có
   */
  async syncBroadcastMailsForUser(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { userFarm: true },
      });
      if (!user) return;

      const farmLevel = user.userFarm?.level || 1;
      const membershipTierId = user.membershipTierId;
      const branchId = user.branchId;

      // Lấy tất cả thư đang phát hành chung còn hạn hoặc không thời hạn, KHÔNG bị thu hồi và ĐÃ đến lịch gửi
      const now = new Date();
      const broadcastMails = await (this.prisma as any).farmMail.findMany({
        where: {
          isRevoked: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          AND: [
            {
              OR: [
                { scheduledAt: null },
                { scheduledAt: { lte: now } },
              ],
            },
          ],
        },
      });

      // Lấy danh sách mailId mà user này đã có trong hộp thư
      const existingUserMails = await (this.prisma as any).farmUserMail.findMany({
        where: { userId },
        select: { mailId: true },
      });
      const existingMailIds = new Set(existingUserMails.map((m: any) => m.mailId));

      const mailsToAdd: string[] = [];

      for (const mail of broadcastMails) {
        if (existingMailIds.has(mail.id)) continue;

        if (mail.targetType === 'ALL') {
          mailsToAdd.push(mail.id);
        } else if (mail.targetType === 'LEVEL_RANGE') {
          try {
            const range = typeof mail.targetValue === 'string' ? JSON.parse(mail.targetValue) : mail.targetValue;
            const min = Number(range?.minLevel ?? range?.min ?? 1);
            const max = Number(range?.maxLevel ?? range?.max ?? 999);
            if (farmLevel >= min && farmLevel <= max) {
              mailsToAdd.push(mail.id);
            }
          } catch {}
        } else if (mail.targetType === 'MEMBERSHIP_TIER') {
          if (mail.targetValue === membershipTierId || mail.targetValue === user.membershipTierId) {
            mailsToAdd.push(mail.id);
          }
        } else if (mail.targetType === 'INACTIVE_USERS') {
          try {
            let days = 7;
            if (typeof mail.targetValue === 'string') {
              try {
                const parsed = JSON.parse(mail.targetValue);
                days = Number(parsed.days || parsed);
              } catch {
                days = Number(mail.targetValue) || 7;
              }
            } else if (typeof mail.targetValue === 'number') {
              days = mail.targetValue;
            }
            const lastActive = user.updatedAt ? new Date(user.updatedAt).getTime() : (user.createdAt ? new Date(user.createdAt).getTime() : 0);
            const inactiveMs = now.getTime() - lastActive;
            if (inactiveMs >= days * 86400 * 1000) {
              mailsToAdd.push(mail.id);
            }
          } catch {}
        } else if (mail.targetType === 'BRANCH') {
          if (mail.targetValue === branchId) {
            mailsToAdd.push(mail.id);
          }
        }
      }

      if (mailsToAdd.length > 0) {
        await (this.prisma as any).farmUserMail.createMany({
          data: mailsToAdd.map((mailId) => ({
            mailId,
            userId,
            isRead: false,
            isClaimed: false,
          })),
          skipDuplicates: true,
        });
      }
    } catch (e) {
      this.logger.warn('Failed to sync broadcast mails for user:', e);
    }
  }

  /**
   * Lấy danh sách thư trong hòm thư của người chơi
   */
  async getUserMails(userId: string) {
    await this.syncBroadcastMailsForUser(userId);

    const userMails = await (this.prisma as any).farmUserMail.findMany({
      where: { userId },
      include: { mail: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    return userMails.map((um: any) => {
      const isExpired = um.mail.expiresAt && new Date(um.mail.expiresAt) <= now;
      let parsedRewards: FarmMailRewardItem[] = [];
      try {
        parsedRewards = typeof um.mail.rewards === 'string' ? JSON.parse(um.mail.rewards) : (um.mail.rewards || []);
      } catch {
        parsedRewards = [];
      }

      return {
        id: um.id,
        mailId: um.mailId,
        title: um.mail.title,
        sender: um.mail.sender || 'Hệ thống AVORA',
        content: um.mail.content,
        bannerUrl: um.mail.bannerUrl,
        type: um.mail.type,
        rewards: parsedRewards,
        isRead: um.isRead,
        isClaimed: um.isClaimed,
        isExpired,
        claimedAt: um.claimedAt,
        sentAt: um.mail.sentAt || um.createdAt,
        expiresAt: um.mail.expiresAt,
      };
    });
  }

  /**
   * Đếm số thư chưa nhận còn hạn để hiển thị badge đỏ
   */
  async getUnreadCount(userId: string) {
    await this.syncBroadcastMailsForUser(userId);

    const now = new Date();
    const count = await (this.prisma as any).farmUserMail.count({
      where: {
        userId,
        isClaimed: false,
        OR: [
          { mail: { expiresAt: null } },
          { mail: { expiresAt: { gt: now } } },
        ],
      },
    });

    return { unreadCount: count };
  }

  /**
   * Đánh dấu thư đã đọc
   */
  async markAsRead(userId: string, userMailId: string) {
    await (this.prisma as any).farmUserMail.updateMany({
      where: { id: userMailId, userId },
      data: { isRead: true },
    });
    return { success: true };
  }

  /**
   * Nhận quà an toàn (Atomic Transaction & Idempotency)
   */
  async claimMail(userId: string, userMailId: string) {
    return this.prisma.$transaction(async (tx) => {
      const userMail = await (tx as any).farmUserMail.findFirst({
        where: { id: userMailId, userId },
        include: { mail: true },
      });

      if (!userMail) {
        throw new NotFoundException('Không tìm thấy thư yêu cầu');
      }

      if (userMail.isClaimed) {
        throw new BadRequestException('Bạn đã nhận phần thưởng từ thư này rồi!');
      }

      const now = new Date();
      if (userMail.mail.isRevoked) {
        throw new BadRequestException('Thư này đã bị Ban Quản Trị thu hồi, không thể nhận phần thưởng!');
      }

      if (userMail.mail.scheduledAt && new Date(userMail.mail.scheduledAt) > now) {
        throw new BadRequestException('Thư này chưa đến thời gian phát hành!');
      }

      if (userMail.mail.expiresAt && new Date(userMail.mail.expiresAt) <= now) {
        throw new BadRequestException('Thư này đã hết thời hạn nhận thưởng!');
      }

      const farm = await tx.userFarm.findUnique({
        where: { userId },
      });
      if (!farm) throw new NotFoundException('Nông trại chưa được khởi tạo');

      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new NotFoundException('Người dùng không tồn tại');

      // 1. Đánh dấu đã nhận ngay trong transaction (Idempotent lock)
      await (tx as any).farmUserMail.update({
        where: { id: userMail.id },
        data: {
          isClaimed: true,
          claimedAt: now,
          isRead: true,
        },
      });

      // 2. Parse rewards
      let rewards: FarmMailRewardItem[] = [];
      try {
        rewards = typeof userMail.mail.rewards === 'string'
          ? JSON.parse(userMail.mail.rewards)
          : (userMail.mail.rewards || []);
      } catch {
        rewards = [];
      }

      let totalCoinsGranted = 0;
      let totalPointsGranted = 0;
      const grantedItems: any[] = [];

      for (const r of rewards) {
        const qty = Math.max(1, r.quantity || 1);

        if (r.type === 'COIN') {
          totalCoinsGranted += qty;
        } else if (r.type === 'AVORA_POINT') {
          totalPointsGranted += qty;
        } else if (
          r.type === 'SEED' ||
          r.type === 'PRODUCE' ||
          r.type === 'ITEM' ||
          r.type === 'MYSTERY_PACK'
        ) {
          const itemType =
            r.type === 'SEED'
              ? FarmItemType.SEED
              : r.type === 'PRODUCE'
              ? FarmItemType.CROP
              : r.type === 'MYSTERY_PACK'
              ? FarmItemType.TOOL
              : FarmItemType.FERTILIZER;

          await this.inventoryService.addItem(tx, farm.id, {
            itemType,
            referenceId: r.code || r.name,
            itemName: r.name,
            itemCode: r.code || r.name,
            quantity: qty,
          });
          grantedItems.push({ name: r.name, quantity: qty, iconUrl: r.iconUrl });
        } else if (r.type === 'VOUCHER' && r.voucherId) {
          // Cấp voucher vào CustomerVoucher
          try {
            await (tx as any).customerVoucher.create({
              data: {
                userId,
                voucherId: r.voucherId,
                status: 'AVAILABLE',
                source: 'FARM_MAIL',
              },
            });
            grantedItems.push({ name: r.name, quantity: 1, iconUrl: '🎫' });
          } catch (e) {
            this.logger.warn('Could not assign voucher from mail:', e);
          }
        }
      }

      // Cập nhật Farm Coin nếu có
      let newCoins = farm.farmCoin;
      if (totalCoinsGranted > 0) {
        const updatedFarm = await tx.userFarm.update({
          where: { id: farm.id },
          data: { farmCoin: { increment: totalCoinsGranted } },
        });
        newCoins = updatedFarm.farmCoin;
      }

      // Cập nhật Điểm AVORA nếu có
      let newPoints = Math.floor(user.currentPoints || user.points || 0);
      if (totalPointsGranted > 0) {
        newPoints += totalPointsGranted;
        await tx.user.update({
          where: { id: userId },
          data: {
            points: newPoints,
            currentPoints: newPoints,
          },
        });

        // Tạo PointTransaction
        await tx.pointTransaction.create({
          data: {
            userId,
            balanceBefore: Math.floor(user.points || user.currentPoints || 0),
            amount: totalPointsGranted,
            balanceAfter: newPoints,
            source: PointTransactionSource.ADMIN,
            referenceCode: `MAIL_${userMail.mail.id}`,
            description: `Nhận thưởng từ Hòm Thư AVORA: ${userMail.mail.title}`,
          },
        });
      }

      // 3. Ghi FarmTransaction Ledger
      const txType =
        userMail.mail.type === 'MAINTENANCE'
          ? 'MAINTENANCE_GIFT'
          : userMail.mail.type === 'COMPENSATION'
          ? 'SYSTEM_COMPENSATION'
          : 'ADMIN_GIFT';

      await this.transactionService.recordTransaction(tx, {
        userId,
        farmId: farm.id,
        type: txType,
        source: 'MAILBOX',
        referenceId: `MAIL_${userMail.mail.id}`,
        itemNameSnapshot: userMail.mail.title,
        itemIconUrl: userMail.mail.bannerUrl || '🎁',
        quantity: 1,
        totalValue: totalCoinsGranted,
        farmCoinDelta: totalCoinsGranted,
        avoraPointDelta: totalPointsGranted,
        balanceCoinAfter: newCoins,
        balancePointAfter: newPoints,
        status: 'COMPLETED',
        metadata: {
          mailId: userMail.mail.id,
          mailTitle: userMail.mail.title,
          rewards,
        },
      });

      return {
        success: true,
        message: `Đã nhận thành công phần thưởng từ thư "${userMail.mail.title}"!`,
        rewards,
        farmCoins: newCoins,
        avoraPoints: newPoints,
        totalCoinsGranted,
        totalPointsGranted,
      };
    });
  }

  /**
   * Nhận tất cả phần thưởng từ toàn bộ thư chưa nhận (Claim All)
   */
  async claimAllMails(userId: string) {
    await this.syncBroadcastMailsForUser(userId);

    const now = new Date();
    const unclaimedMails = await (this.prisma as any).farmUserMail.findMany({
      where: {
        userId,
        isClaimed: false,
        OR: [
          { mail: { expiresAt: null } },
          { mail: { expiresAt: { gt: now } } },
        ],
      },
    });

    if (unclaimedMails.length === 0) {
      throw new BadRequestException('Hòm thư không có phần thưởng mới nào chưa nhận');
    }

    const claimResults: any[] = [];
    for (const um of unclaimedMails) {
      try {
        const res = await this.claimMail(userId, um.id);
        claimResults.push(res);
      } catch (e) {
        this.logger.warn(`Could not claim mail ${um.id}:`, e);
      }
    }

    const latestOverview = await this.getUserMails(userId);

    return {
      success: true,
      message: `Đã nhận thành công quà từ ${claimResults.length} thư!`,
      claimedCount: claimResults.length,
      mails: latestOverview,
    };
  }

  /**
   * Admin tạo và gửi thư đến người chơi
   */
  /**
   * Admin tạo và gửi thư đến người chơi (hỗ trợ lên lịch, target chi tiết)
   */
  async createAdminMail(adminId: string, dto: CreateFarmMailDto) {
    if (!dto.title || !dto.content) {
      throw new BadRequestException('Tiêu đề và nội dung thư không được để trống');
    }
    if (!dto.rewards || !Array.isArray(dto.rewards)) {
      throw new BadRequestException('Danh sách phần thưởng không hợp lệ');
    }

    const now = new Date();
    const scheduledDate = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const isScheduled = scheduledDate && scheduledDate.getTime() > now.getTime();
    const status = isScheduled ? 'SCHEDULED' : 'SENT';

    const mail = await (this.prisma as any).farmMail.create({
      data: {
        title: dto.title,
        sender: dto.sender || 'Hệ thống AVORA',
        content: dto.content,
        bannerUrl: dto.bannerUrl,
        type: dto.type || 'ADMIN_CUSTOM',
        targetType: dto.targetType || 'ALL',
        targetValue:
          dto.targetValue && typeof dto.targetValue === 'object'
            ? JSON.stringify(dto.targetValue)
            : dto.targetValue?.toString() || null,
        rewards: dto.rewards,
        scheduledAt: scheduledDate,
        status,
        isRevoked: false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: adminId,
      },
    });

    // Nếu không phải scheduled và là SPECIFIC_USERS, phân phát ngay
    if (!isScheduled && dto.targetType === 'SPECIFIC_USERS') {
      let userIds: string[] = [];
      if (Array.isArray(dto.targetValue)) {
        userIds = dto.targetValue;
      } else if (typeof dto.targetValue === 'string') {
        try {
          const parsed = JSON.parse(dto.targetValue);
          userIds = Array.isArray(parsed) ? parsed : [dto.targetValue];
        } catch {
          userIds = dto.targetValue.split(',').map((s: string) => s.trim());
        }
      }

      if (userIds.length > 0) {
        await (this.prisma as any).farmUserMail.createMany({
          data: userIds.map((uId) => ({
            mailId: mail.id,
            userId: uId,
            isRead: false,
            isClaimed: false,
          })),
          skipDuplicates: true,
        });
      }
    }

    return {
      success: true,
      message: isScheduled ? 'Đã lên lịch phát hành thư thành công!' : 'Tạo và phát hành thư thành công!',
      mail,
    };
  }

  /**
   * Admin lấy danh sách các thư đã gửi kèm số liệu nhận quà
   */
  async getAdminMails() {
    const mails = await (this.prisma as any).farmMail.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { userMails: true },
        },
        userMails: {
          select: { isClaimed: true },
        },
      },
    });

    return mails.map((m: any) => {
      const totalRecipients = m._count?.userMails || 0;
      const claimedCount = (m.userMails || []).filter((um: any) => um.isClaimed).length;
      const unclaimedCount = totalRecipients - claimedCount;
      const claimRate = totalRecipients > 0 ? Math.round((claimedCount / totalRecipients) * 100) : 0;

      return {
        id: m.id,
        title: m.title,
        sender: m.sender,
        content: m.content,
        bannerUrl: m.bannerUrl,
        type: m.type,
        targetType: m.targetType,
        targetValue: m.targetValue,
        rewards: m.rewards,
        status: m.status || (m.isRevoked ? 'REVOKED' : (m.scheduledAt && new Date(m.scheduledAt) > new Date() ? 'SCHEDULED' : 'SENT')),
        isRevoked: Boolean(m.isRevoked),
        revokedAt: m.revokedAt,
        scheduledAt: m.scheduledAt,
        sentAt: m.sentAt,
        expiresAt: m.expiresAt,
        createdAt: m.createdAt,
        totalRecipients,
        claimedCount,
        unclaimedCount,
        claimRate,
      };
    });
  }

  /**
   * Admin thu hồi thư & vật phẩm/quà tặng chưa nhận
   */
  async revokeAdminMail(mailId: string) {
    const mail = await (this.prisma as any).farmMail.findUnique({
      where: { id: mailId },
    });
    if (!mail) throw new NotFoundException('Không tìm thấy thư');

    const updated = await (this.prisma as any).farmMail.update({
      where: { id: mailId },
      data: {
        isRevoked: true,
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    // Thu hồi: Xóa sạch FarmUserMail chưa nhận
    const deletedUserMails = await (this.prisma as any).farmUserMail.deleteMany({
      where: {
        mailId,
        isClaimed: false,
      },
    });

    return {
      success: true,
      message: `Đã thu hồi thư "${mail.title}" và hủy phát quà của ${deletedUserMails.count} người chơi chưa nhận!`,
      mail: updated,
      revokedCount: deletedUserMails.count,
    };
  }

  /**
   * Admin xem phân tích chi tiết ai đã nhận, ai chưa nhận của 1 thư
   */
  async getAdminMailRecipients(mailId: string) {
    const mail = await (this.prisma as any).farmMail.findUnique({
      where: { id: mailId },
      include: {
        userMails: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                avatarUrl: true,
                userFarm: { select: { level: true, farmCoin: true } },
                membershipTier: { select: { name: true, rank: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!mail) throw new NotFoundException('Không tìm thấy thư');

    const totalRecipients = mail.userMails.length;
    const claimedCount = mail.userMails.filter((um: any) => um.isClaimed).length;
    const unclaimedCount = totalRecipients - claimedCount;
    const claimRate = totalRecipients > 0 ? Math.round((claimedCount / totalRecipients) * 100) : 0;

    return {
      mail: {
        id: mail.id,
        title: mail.title,
        sender: mail.sender,
        type: mail.type,
        targetType: mail.targetType,
        targetValue: mail.targetValue,
        rewards: mail.rewards,
        status: mail.status,
        isRevoked: mail.isRevoked,
        revokedAt: mail.revokedAt,
        scheduledAt: mail.scheduledAt,
        sentAt: mail.sentAt,
        expiresAt: mail.expiresAt,
        createdAt: mail.createdAt,
      },
      metrics: {
        totalRecipients,
        claimedCount,
        unclaimedCount,
        claimRate,
      },
      recipients: mail.userMails.map((um: any) => ({
        userMailId: um.id,
        userId: um.userId,
        fullName: um.user?.fullName || 'Người chơi',
        email: um.user?.email || '',
        phone: um.user?.phone || '',
        avatarUrl: um.user?.avatarUrl || null,
        farmLevel: um.user?.userFarm?.level || 1,
        membershipTierName: um.user?.membershipTier?.name || 'Thành viên mới',
        isRead: um.isRead,
        isClaimed: um.isClaimed,
        claimedAt: um.claimedAt,
        receivedAt: um.createdAt,
      })),
    };
  }

  /**
   * Admin xóa thư
   */
  async deleteAdminMail(mailId: string) {
    await (this.prisma as any).farmMail.delete({
      where: { id: mailId },
    });
    return { success: true, message: 'Đã xóa thư' };
  }
}
