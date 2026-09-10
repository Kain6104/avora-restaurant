import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto, ReorderBannersDto } from './dto/banner.dto';

@Injectable()
export class AdminBannerService {
  private readonly logger = new Logger(AdminBannerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách toàn bộ Banner theo bộ lọc và phân trang
   */
  async findAllBanners(params: {
    page?: number;
    limit?: number;
    search?: string;
    position?: string;
    status?: string; // 'ALL' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED'
    branchIdScope?: string;
  }) {
    const { page = 1, limit = 20, search, position, status, branchIdScope } = params;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { altText: { contains: search } },
        { linkUrl: { contains: search } },
      ];
    }

    if (position && position !== 'ALL') {
      where.position = position;
    }

    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        where.active = true;
        where.AND = [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ];
      } else if (status === 'INACTIVE') {
        where.active = false;
      } else if (status === 'EXPIRED') {
        where.endDate = { lt: now };
      }
    }

    if (branchIdScope && branchIdScope !== 'ALL') {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { branches: { none: {} } },
            { branches: { some: { id: branchIdScope } } },
          ],
        },
      ];
    }

    const [banners, total] = await Promise.all([
      this.prisma.banner.findMany({
        where,
        include: {
          branches: { select: { id: true, name: true } },
        },
        orderBy: [{ bannerOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.banner.count({ where }),
    ]);

    // Thống kê thành viên độc nhất cho từng banner
    const bannerIds = banners.map((b) => b.id);
    const memberReachMap = new Map<string, number>();

    if (bannerIds.length > 0) {
      const memberReach = await this.prisma.bannerInteraction.groupBy({
        by: ['bannerId'],
        where: {
          bannerId: { in: bannerIds },
          type: 'VIEW',
          userId: { not: null },
        },
        _count: {
          userId: true,
        },
      });

      memberReach.forEach((m) => {
        memberReachMap.set(m.bannerId, m._count.userId);
      });
    }

    const data = banners.map((b) => {
      const isExpired = b.endDate ? new Date(b.endDate) < now : false;
      const isUpcoming = b.startDate ? new Date(b.startDate) > now : false;
      const isLive = b.active && !isExpired && !isUpcoming;
      const impressions = b.viewCount || 0;
      const clicks = b.clickCount || 0;
      const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
      const uniqueMembers = memberReachMap.get(b.id) || 0;

      return {
        ...b,
        impressions,
        clicks,
        ctr,
        uniqueMembers,
        isLive,
        isExpired,
        isUpcoming,
      };
    });

    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy danh sách Banner ĐANG THỰC SỰ HOẠT ĐỘNG (Phục vụ kéo thả sắp xếp)
   * Chỉ lấy banner active = true, nằm trong khoảng ngày hiệu lực, khớp chi nhánh
   */
  async findActiveBanners(params: { position?: string; branchIdScope?: string }) {
    const { position = 'HERO', branchIdScope } = params;
    const now = new Date();

    const where: any = {
      active: true,
      position,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    };

    if (branchIdScope && branchIdScope !== 'ALL') {
      where.AND.push({
        OR: [
          { branches: { none: {} } },
          { branches: { some: { id: branchIdScope } } },
        ],
      });
    }

    const banners = await this.prisma.banner.findMany({
      where,
      include: {
        branches: { select: { id: true, name: true } },
      },
      orderBy: [{ bannerOrder: 'asc' }, { createdAt: 'desc' }],
    });

    // Lấy số thành viên độc nhất đã xem
    const bannerIds = banners.map((b) => b.id);
    const memberReachMap = new Map<string, number>();

    if (bannerIds.length > 0) {
      const memberReach = await this.prisma.bannerInteraction.groupBy({
        by: ['bannerId'],
        where: {
          bannerId: { in: bannerIds },
          type: 'VIEW',
          userId: { not: null },
        },
        _count: {
          userId: true,
        },
      });

      memberReach.forEach((m) => {
        memberReachMap.set(m.bannerId, m._count.userId);
      });
    }

    const data = banners.map((b, index) => {
      const impressions = b.viewCount || 0;
      const clicks = b.clickCount || 0;
      const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
      const uniqueMembers = memberReachMap.get(b.id) || 0;

      return {
        ...b,
        displayIndex: index + 1, // #1, #2, #3...
        impressions,
        clicks,
        ctr,
        uniqueMembers,
      };
    });

    return {
      success: true,
      data,
      total: data.length,
    };
  }

  /**
   * Kéo thả sắp xếp thứ tự hiển thị bằng Database Transaction
   */
  async reorderBanners(dto: ReorderBannersDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Danh sách sắp xếp không được để trống');
    }

    // Thực hiện trong một Database Transaction đảm bảo không bị sai lệch thứ tự
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.banner.update({
          where: { id: item.id },
          data: { bannerOrder: Number(item.bannerOrder) },
        })
      )
    );

    this.logger.log(`Reordered ${dto.items.length} banners successfully`);

    return {
      success: true,
      message: 'Cập nhật thứ tự hiển thị thành công',
    };
  }

  /**
   * Báo cáo Thống kê Tổng quan (KPIs, CTR, Lượt xem thành viên độc nhất)
   */
  async getBannerAnalytics(branchIdScope?: string) {
    const now = new Date();
    const whereScope: any = {};

    if (branchIdScope && branchIdScope !== 'ALL') {
      whereScope.OR = [
        { branches: { none: {} } },
        { branches: { some: { id: branchIdScope } } },
      ];
    }

    // 1. Tổng số banner & banner đang active
    const [allBanners, activeCount, totalInteractions] = await Promise.all([
      this.prisma.banner.findMany({
        where: whereScope,
        select: {
          id: true,
          title: true,
          imageUrl: true,
          position: true,
          viewCount: true,
          clickCount: true,
          active: true,
          startDate: true,
          endDate: true,
          bannerOrder: true,
        },
        orderBy: { clickCount: 'desc' },
      }),
      this.prisma.banner.count({
        where: {
          ...whereScope,
          active: true,
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ],
        },
      }),
      this.prisma.bannerInteraction.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
    ]);

    const totalBanners = allBanners.length;
    let totalImpressions = 0;
    let totalClicks = 0;

    allBanners.forEach((b) => {
      totalImpressions += b.viewCount || 0;
      totalClicks += b.clickCount || 0;
    });

    const avgCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;

    // 2. Số lượng Khách hàng thành viên độc nhất đã nhìn thấy (Unique Member Reach)
    const uniqueMembers = await this.prisma.bannerInteraction.groupBy({
      by: ['userId'],
      where: {
        type: 'VIEW',
        userId: { not: null },
      },
    });
    const uniqueMembersReached = uniqueMembers.length;

    // 3. Thống kê theo ngày trong 7 ngày gần nhất
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentInteractions = await this.prisma.bannerInteraction.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        type: true,
        createdAt: true,
      },
    });

    // Gom nhóm theo ngày (YYYY-MM-DD)
    const dailyMap = new Map<string, { date: string; views: number; clicks: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = `${d.getDate()}/${d.getMonth() + 1}`;
      dailyMap.set(dateStr, { date: displayDate, views: 0, clicks: 0 });
    }

    recentInteractions.forEach((inter) => {
      const dateStr = inter.createdAt.toISOString().split('T')[0];
      const entry = dailyMap.get(dateStr);
      if (entry) {
        if (inter.type === 'VIEW') entry.views += 1;
        else if (inter.type === 'CLICK') entry.clicks += 1;
      }
    });

    const dailyTrends = Array.from(dailyMap.values());

    // 4. Top 5 Banners hiệu quả nhất
    const topBanners = allBanners.slice(0, 5).map((b) => ({
      id: b.id,
      title: b.title || 'Banner quảng cáo',
      imageUrl: b.imageUrl,
      position: b.position,
      impressions: b.viewCount,
      clicks: b.clickCount,
      ctr: b.viewCount > 0 ? Number(((b.clickCount / b.viewCount) * 100).toFixed(2)) : 0,
    }));

    return {
      success: true,
      data: {
        totalBanners,
        activeCount,
        totalImpressions,
        totalClicks,
        avgCtr,
        uniqueMembersReached,
        dailyTrends,
        topBanners,
      },
    };
  }

  /**
   * Lấy chi tiết Banner theo ID
   */
  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
      include: {
        branches: { select: { id: true, name: true } },
      },
    });

    if (!banner) {
      throw new NotFoundException('Không tìm thấy Banner');
    }

    // Lấy số thành viên đã nhìn thấy banner này
    const memberReach = await this.prisma.bannerInteraction.groupBy({
      by: ['userId'],
      where: {
        bannerId: id,
        type: 'VIEW',
        userId: { not: null },
      },
    });

    const impressions = banner.viewCount || 0;
    const clicks = banner.clickCount || 0;
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;

    return {
      success: true,
      data: {
        ...banner,
        impressions,
        clicks,
        ctr,
        uniqueMembers: memberReach.length,
      },
    };
  }

  /**
   * Tạo mới Banner / Popup
   */
  async createBanner(dto: CreateBannerDto) {
    const { branchIds, startDate, endDate, ...rest } = dto;

    // Tự động gán bannerOrder ở cuối nếu chưa có
    let order = dto.bannerOrder;
    if (order === undefined) {
      const maxOrder = await this.prisma.banner.aggregate({
        where: { position: dto.position || 'HERO' },
        _max: { bannerOrder: true },
      });
      order = (maxOrder._max.bannerOrder || 0) + 1;
    }

    const created = await this.prisma.banner.create({
      data: {
        ...rest,
        bannerOrder: order,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        branches: branchIds && branchIds.length > 0 ? { connect: branchIds.map((id) => ({ id })) } : undefined,
      },
      include: {
        branches: true,
      },
    });

    return {
      success: true,
      data: created,
      message: 'Tạo banner mới thành công',
    };
  }

  /**
   * Cập nhật Banner / Popup
   */
  async updateBanner(id: string, dto: UpdateBannerDto) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException('Không tìm thấy Banner');
    }

    const { branchIds, startDate, endDate, ...rest } = dto;

    const dataToUpdate: any = {
      ...rest,
    };

    if (startDate !== undefined) {
      dataToUpdate.startDate = startDate ? new Date(startDate) : null;
    }
    if (endDate !== undefined) {
      dataToUpdate.endDate = endDate ? new Date(endDate) : null;
    }

    if (branchIds !== undefined) {
      dataToUpdate.branches = {
        set: branchIds.map((bId) => ({ id: bId })),
      };
    }

    const updated = await this.prisma.banner.update({
      where: { id },
      data: dataToUpdate,
      include: {
        branches: true,
      },
    });

    return {
      success: true,
      data: updated,
      message: 'Cập nhật banner thành công',
    };
  }

  /**
   * Bật / Tắt trạng thái nhanh
   */
  async toggleStatus(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException('Không tìm thấy Banner');
    }

    const updated = await this.prisma.banner.update({
      where: { id },
      data: { active: !banner.active },
    });

    return {
      success: true,
      data: updated,
      message: `Đã ${updated.active ? 'kích hoạt' : 'tạm dừng'} banner`,
    };
  }

  /**
   * Xóa Banner
   */
  async deleteBanner(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException('Không tìm thấy Banner');
    }

    await this.prisma.banner.delete({ where: { id } });

    return {
      success: true,
      message: 'Đã xóa banner thành công',
    };
  }
}
