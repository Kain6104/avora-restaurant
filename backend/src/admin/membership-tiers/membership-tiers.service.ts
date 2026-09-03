import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MembershipTiersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { skip?: number; take?: number; search?: string }) {
    const { skip = 0, take = 10, search } = params;
    
    const where: any = {};
    if (search) {
      where.name = { contains: search };
    }

    const [data, total] = await Promise.all([
      this.prisma.membershipTier.findMany({
        skip,
        take,
        where,
        include: {
          _count: { select: { users: true } }
        },
        orderBy: { minSpending: 'asc' },
      }),
      this.prisma.membershipTier.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: Math.floor(skip / take) + 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      }
    };
  }

  async create(data: any) {
    // Basic validation
    if (data.minSpending < 0 || data.pointMultiplier <= 0 || data.discountPercent < 0) {
      throw new BadRequestException('Thông số không hợp lệ');
    }

    const exists = await this.prisma.membershipTier.findUnique({
      where: { name: data.name }
    });

    if (exists) {
      throw new BadRequestException('Tên hạng này đã tồn tại trong hệ thống. Vui lòng chọn tên khác.');
    }

    return this.prisma.membershipTier.create({ data });
  }

  async update(id: string, data: any) {
    if (data.name) {
      const exists = await this.prisma.membershipTier.findFirst({
        where: { name: data.name, id: { not: id } }
      });
      if (exists) {
        throw new BadRequestException('Tên hạng này đã tồn tại trong hệ thống. Vui lòng chọn tên khác.');
      }
    }

    return this.prisma.membershipTier.update({
      where: { id },
      data
    });
  }

  async remove(id: string) {
    const count = await this.prisma.user.count({ where: { membershipTierId: id } });
    if (count > 0) {
      throw new BadRequestException(`Không thể xóa! Hạng này đang có ${count} thành viên trực thuộc. Vui lòng hạ/thăng hạng cho các thành viên này sang hạng khác trước khi xóa để tránh mất dữ liệu.`);
    }
    
    return this.prisma.membershipTier.delete({ where: { id } });
  }

  async getAnalytics(id: string) {
    const [tier, totalUsers, pointData, orderData, voucherData] = await Promise.all([
      this.prisma.membershipTier.findUnique({ where: { id } }),
      this.prisma.user.count({ where: { membershipTierId: id } }),
      this.prisma.pointTransaction.aggregate({
        where: { membershipTierId: id, amount: { gt: 0 } },
        _sum: { amount: true }
      }),
      this.prisma.order.aggregate({
        where: { user: { membershipTierId: id }, status: 'COMPLETED' },
        _sum: { totalAmount: true }
      }),
      this.prisma.voucher.aggregate({
        where: { membershipTiers: { some: { id } } },
        _sum: { usedCount: true }
      })
    ]);

    if (!tier) throw new BadRequestException('Hạng không tồn tại');

    // Mốc chi tiêu có thể lấy top users (tùy chọn)
    const topUsers = await this.prisma.user.findMany({
      where: { membershipTierId: id },
      orderBy: { totalSpending: 'desc' },
      take: 10,
      select: { id: true, fullName: true, phone: true, totalSpending: true, currentPoints: true }
    });

    const activeVouchers = await this.prisma.voucher.findMany({
      where: { membershipTiers: { some: { id } }, isActive: true }
    });

    const activeFlashSales = await this.prisma.flashSale.findMany({
      where: { membershipTiers: { some: { id } }, isActive: true }
    });

    const activeCombos = await this.prisma.combo.findMany({
      where: { membershipTiers: { some: { id } }, isActive: true }
    });

    return {
      tier,
      analytics: {
        totalUsers,
        totalRevenue: orderData._sum.totalAmount || 0,
        pointsIssued: pointData._sum.amount || 0,
        vouchersUsed: voucherData._sum?.usedCount || 0
      },
      topUsers,
      activePromotions: {
        vouchers: activeVouchers,
        flashSales: activeFlashSales,
        combos: activeCombos
      }
    };
  }

  async getDashboardStats() {
    const [memberTierDistribution, recentTierMovements] = await Promise.all([
      this.prisma.membershipTier.findMany({
        select: {
          name: true,
          _count: { select: { users: true } }
        }
      }),
      this.prisma.pointTransaction.findMany({
        where: { membershipTierName: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { fullName: true, phone: true } } }
      })
    ]);

    return {
      memberTierDistribution: memberTierDistribution.map((t: any) => ({
        name: t.name,
        users: t._count.users
      })),
      recentTierMovements
    };
  }
}
