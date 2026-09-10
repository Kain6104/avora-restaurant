import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BannerTrackingService {
  private readonly logger = new Logger(BannerTrackingService.name);

  // In-memory slide cache để chống spam / deduplicate tương tác
  // Key: `${bannerId}_${identifier}_${type}`, Value: timestamp (ms)
  private readonly recentTrackingCache = new Map<string, number>();

  // TTL: 10 phút cho VIEW, 3 giây cho CLICK
  private readonly VIEW_DEDUPLICATION_WINDOW_MS = 10 * 60 * 1000;
  private readonly CLICK_THROTTLE_WINDOW_MS = 3 * 1000;

  constructor(private readonly prisma: PrismaService) {
    // Dọn dẹp cache định kỳ mỗi 15 phút
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.recentTrackingCache.entries()) {
        if (now - timestamp > this.VIEW_DEDUPLICATION_WINDOW_MS) {
          this.recentTrackingCache.delete(key);
        }
      }
    }, 15 * 60 * 1000);
  }

  /**
   * Ghi nhận lượt VIEW hoặc CLICK với cơ chế chống spam / deduplication
   */
  async trackInteraction(params: {
    bannerId: string;
    type: 'VIEW' | 'CLICK';
    userId?: string | null;
    sessionId?: string | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { bannerId, type, userId, sessionId, ipAddress, userAgent } = params;

    if (!bannerId) {
      return { success: false, message: 'bannerId is required' };
    }

    // Xác định identifier: ưu tiên userId, sau đó sessionId, cuối cùng là IP
    const identifier = userId || sessionId || ipAddress || 'anonymous';
    const cacheKey = `${bannerId}_${identifier}_${type}`;
    const now = Date.now();
    const lastTimestamp = this.recentTrackingCache.get(cacheKey);

    const windowMs =
      type === 'VIEW' ? this.VIEW_DEDUPLICATION_WINDOW_MS : this.CLICK_THROTTLE_WINDOW_MS;

    // Nếu tương tác nằm trong cửa sổ thời gian chống spam -> bỏ qua
    if (lastTimestamp && now - lastTimestamp < windowMs) {
      return {
        success: true,
        deduplicated: true,
        message: `Tương tác ${type} đã được ghi nhận trước đó`,
      };
    }

    // Cập nhật timestamp vào cache
    this.recentTrackingCache.set(cacheKey, now);

    try {
      // 1. Tăng số đếm tương ứng trên model Banner
      const updateData =
        type === 'VIEW' ? { viewCount: { increment: 1 } } : { clickCount: { increment: 1 } };

      await this.prisma.banner.update({
        where: { id: bannerId },
        data: updateData,
      });

      // 2. Tạo bản ghi chi tiết BannerInteraction (lưu vết thành viên)
      await this.prisma.bannerInteraction.create({
        data: {
          bannerId,
          type,
          userId: userId || null,
          sessionId: sessionId || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return {
        success: true,
        deduplicated: false,
        message: `Đã ghi nhận ${type} thành công`,
      };
    } catch (err: any) {
      this.logger.error(`Error tracking banner ${bannerId} interaction:`, err);
      return { success: false, message: 'Lỗi khi ghi nhận tracking' };
    }
  }

  /**
   * Lấy danh sách Banner đang hoạt động công khai cho Client/Website
   */
  async getActiveBanners(params: { position?: string; branchId?: string }) {
    const { position, branchId } = params;
    const now = new Date();

    const where: any = {
      active: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    };

    if (position && position !== 'ALL') {
      where.position = position;
    }

    if (branchId && branchId !== 'ALL') {
      where.AND.push({
        OR: [{ branches: { none: {} } }, { branches: { some: { id: branchId } } }],
      });
    }

    const banners = await this.prisma.banner.findMany({
      where,
      orderBy: [{ bannerOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      success: true,
      data: banners,
    };
  }
}
