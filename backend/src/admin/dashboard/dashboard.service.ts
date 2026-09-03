import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(params: {
    branchIdScope?: string;
    from?: string;
    to?: string;
  }) {
    const { branchIdScope, from, to } = params;
    
    const whereOrder: any = {};
    if (branchIdScope) {
      whereOrder.branchId = branchIdScope;
    }
    
    if (from || to) {
      whereOrder.createdAt = {};
      if (from) whereOrder.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        whereOrder.createdAt.lte = toDate;
      }
    }

    // Run parallel aggregation queries
    const [
      totalOrders,
      completedOrders,
      cancelledOrders,
      revenueAggr,
      recentOrders,
      statusAggr,
      totalCustomers,
      memberTierDistribution,
      recentTierMovements
    ] = await Promise.all([
      this.prisma.order.count({ where: whereOrder }),
      this.prisma.order.count({ where: { ...whereOrder, status: OrderStatus.COMPLETED } }),
      this.prisma.order.count({ where: { ...whereOrder, status: OrderStatus.CANCELLED } }),
      this.prisma.order.aggregate({
        where: { ...whereOrder, status: OrderStatus.COMPLETED },
        _sum: { totalAmount: true }
      }),
      this.prisma.order.findMany({
        where: whereOrder,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { fullName: true } } }
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: whereOrder,
        _count: { _all: true }
      }),
      this.prisma.user.count({
        where: { role: 'USER' } // Customers
      }),
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

    const totalRevenue = revenueAggr._sum.totalAmount || 0;
    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Fetch completed orders to calculate revenue by day and top products
    const completedOrdersData = await this.prisma.order.findMany({
      where: { ...whereOrder, status: OrderStatus.COMPLETED },
      select: { 
        createdAt: true, 
        totalAmount: true,
        orderItems: {
          select: {
            quantity: true,
            product: { select: { id: true, name: true, imageUrl: true } }
          }
        }
      }
    });

    const revenueByDay: Record<string, number> = {};
    const productSales: Record<string, { id: string, name: string, image: string, totalQuantity: number }> = {};

    completedOrdersData.forEach(order => {
      // Revenue by day
      const dateStr = order.createdAt.toISOString().split('T')[0];
      revenueByDay[dateStr] = (revenueByDay[dateStr] || 0) + order.totalAmount;

      // Top products
      order.orderItems.forEach(item => {
        if (item.product) {
          if (!productSales[item.product.id]) {
            productSales[item.product.id] = {
              id: item.product.id,
              name: item.product.name,
              image: item.product.imageUrl || '',
              totalQuantity: 0
            };
          }
          productSales[item.product.id].totalQuantity += item.quantity;
        }
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);

    return {
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
      averageOrderValue,
      recentOrders,
      totalCustomers,
      topProducts,
      ordersByStatus: statusAggr.map(s => ({
        status: s.status,
        count: s._count._all
      })),
      revenueByDay: Object.keys(revenueByDay).map(date => ({
        date,
        revenue: revenueByDay[date]
      })).sort((a, b) => a.date.localeCompare(b.date)),
      memberTierDistribution: memberTierDistribution.map(t => ({
        name: t.name,
        users: t._count.users
      })),
      recentTierMovements
    };
  }
}

