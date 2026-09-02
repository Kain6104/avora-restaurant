import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(branchIdScope?: string, from?: string, to?: string) {
    const where: any = {};
    const userWhere: any = {};
    if (branchIdScope) {
      where.branchId = branchIdScope;
      userWhere.branchId = branchIdScope;
    }
    if (from && to) {
      const startDate = new Date(from);
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = { gte: startDate, lte: endDate };
      userWhere.createdAt = { gte: startDate, lte: endDate };
    }

    const [totalOrders, completedOrders, revenueData, usersData] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.order.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { totalAmount: true }
      }),
      this.prisma.user.count({ where: userWhere })
    ]);

    return {
      totalOrders,
      completedOrders,
      successRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
      totalRevenue: revenueData._sum.totalAmount || 0,
      totalUsers: usersData
    };
  }

  async getRevenueChart(days: number = 7, branchIdScope?: string) {
    const where: any = { status: 'COMPLETED' };
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);
    where.createdAt = { gte: startDate };

    const orders = await this.prisma.order.findMany({
      where,
      select: { createdAt: true, totalAmount: true }
    });

    const grouped: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      grouped[dateStr] = 0;
    }

    orders.forEach(o => {
      const dateStr = o.createdAt.toISOString().split('T')[0];
      if (grouped[dateStr] !== undefined) {
        grouped[dateStr] += o.totalAmount;
      }
    });

    return Object.keys(grouped).map(date => ({
      date,
      revenue: grouped[date]
    }));
  }

  async getTopProducts(branchIdScope?: string, from?: string, to?: string) {
    const where: any = { order: { status: 'COMPLETED' } };
    if (branchIdScope) {
      where.order.branchId = branchIdScope;
    }
    if (from && to) {
      const startDate = new Date(from);
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      where.order.createdAt = { gte: startDate, lte: endDate };
    }

    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where,
      _sum: { quantity: true, priceAtSale: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    });

    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map(i => i.productId) } },
      select: { id: true, name: true, imageUrl: true }
    });

    return items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        id: item.productId,
        name: product?.name || 'Unknown',
        imageUrl: product?.imageUrl || null,
        soldQuantity: item._sum.quantity || 0,
        revenue: (item._sum.priceAtSale || 0) * (item._sum.quantity || 0)
      };
    });
  }

  async getDishStats(branchIdScope?: string, from?: string, to?: string) {
    const where: any = { order: { status: 'COMPLETED' } };
    if (branchIdScope) {
      where.order.branchId = branchIdScope;
    }
    if (from && to) {
      const startDate = new Date(from);
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      where.order.createdAt = { gte: startDate, lte: endDate };
    }

    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where,
      _sum: { quantity: true, priceAtSale: true },
      orderBy: { _sum: { quantity: 'desc' } }
    });

    const products = await this.prisma.product.findMany({
      where: { available: true },
      select: { id: true, name: true, imageUrl: true }
    });

    // Create a map of sales for all products (including those with 0 sales)
    const productStats = products.map(product => {
      const item = items.find(i => i.productId === product.id);
      return {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        soldQuantity: item?._sum?.quantity || 0,
        revenue: (item?._sum?.priceAtSale || 0) * (item?._sum?.quantity || 0)
      };
    });

    const sortedBySales = [...productStats].sort((a, b) => b.soldQuantity - a.soldQuantity);
    
    return {
      allSelling: sortedBySales
    };
  }

  async getRevenueComparison(branchIdScope?: string, from?: string, to?: string) {
    const where: any = { status: 'COMPLETED' };
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }

    let startDate: Date;
    let endDate: Date = new Date();

    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default: Last 6 months
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 5);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    where.createdAt = { gte: startDate, lte: endDate };

    const orders = await this.prisma.order.findMany({
      where,
      select: { createdAt: true, totalAmount: true }
    });

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const groupByMonth = diffDays > 60;
    
    const grouped: Record<string, number> = {};
    
    if (groupByMonth) {
      // Group by month
      const startMonthStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      let current = new Date(startDate);
      while (current <= endDate) {
        const mStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        if (grouped[mStr] === undefined) grouped[mStr] = 0;
        current.setMonth(current.getMonth() + 1);
      }
      
      orders.forEach(o => {
        const mStr = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
        if (grouped[mStr] !== undefined) grouped[mStr] += o.totalAmount;
      });
    } else {
      // Group by day
      for (let i = 0; i <= diffDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        if (d > endDate) break;
        const dateStr = d.toISOString().split('T')[0];
        grouped[dateStr] = 0;
      }
      
      orders.forEach(o => {
        const dateStr = o.createdAt.toISOString().split('T')[0];
        if (grouped[dateStr] !== undefined) grouped[dateStr] += o.totalAmount;
      });
    }

    return Object.keys(grouped).map(key => ({
      time: key,
      revenue: grouped[key]
    }));
  }

  async getPaymentStats(branchIdScope?: string, from?: string, to?: string) {
    const where: any = { status: 'COMPLETED' };
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }
    if (from && to) {
      const startDate = new Date(from);
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const aggr = await this.prisma.order.groupBy({
      by: ['paymentMethod'],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true }
    });

    return aggr.map(a => ({
      method: a.paymentMethod || 'COD',
      count: a._count._all,
      revenue: a._sum.totalAmount || 0
    }));
  }

  async getPeakHoursStats(branchIdScope?: string, from?: string, to?: string) {
    const where: any = { status: 'COMPLETED' };
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }
    if (from && to) {
      const startDate = new Date(from);
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: { createdAt: true, totalAmount: true }
    });

    const hourlyStats = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      orderCount: 0,
      revenue: 0
    }));

    orders.forEach(o => {
      const h = o.createdAt.getHours();
      hourlyStats[h].orderCount += 1;
      hourlyStats[h].revenue += o.totalAmount;
    });

    // Combine hours into time slots like 6-8, 8-10, etc., or just return 24 hours.
    // For a cleaner chart, returning 24 hours is fine, the frontend can format it.
    return hourlyStats;
  }

  async getCategoryStats(branchIdScope?: string, from?: string, to?: string) {
    const where: any = { order: { status: 'COMPLETED' } };
    if (branchIdScope) {
      where.order.branchId = branchIdScope;
    }
    if (from && to) {
      const startDate = new Date(from);
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      where.order.createdAt = { gte: startDate, lte: endDate };
    }

    const items = await this.prisma.orderItem.findMany({
      where,
      select: {
        quantity: true,
        priceAtSale: true,
        product: {
          select: {
            categoryId: true,
            category: { select: { name: true } }
          }
        }
      }
    });

    const categoryAggr: Record<string, { name: string, soldQuantity: number, revenue: number }> = {};

    items.forEach(item => {
      if (item.product && item.product.categoryId) {
        const catId = item.product.categoryId;
        if (!categoryAggr[catId]) {
          categoryAggr[catId] = {
            name: item.product.category?.name || 'Khác',
            soldQuantity: 0,
            revenue: 0
          };
        }
        categoryAggr[catId].soldQuantity += item.quantity;
        categoryAggr[catId].revenue += item.priceAtSale * item.quantity;
      }
    });

    return Object.values(categoryAggr).sort((a, b) => b.revenue - a.revenue);
  }

  async getTierRevenueStats(branchIdScope?: string, from?: string, to?: string) {
    const where: any = { status: 'COMPLETED' };
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }
    if (from && to) {
      const startDate = new Date(from);
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        totalAmount: true,
        user: {
          select: {
            membershipTier: {
              select: { name: true }
            }
          }
        }
      }
    });

    const tierRevenue: Record<string, number> = {};

    orders.forEach(order => {
      const tierName = order.user?.membershipTier?.name || 'Khách vãng lai / Không có hạng';
      if (tierRevenue[tierName] === undefined) {
        tierRevenue[tierName] = 0;
      }
      tierRevenue[tierName] += order.totalAmount;
    });

    return Object.keys(tierRevenue).map(name => ({
      name,
      revenue: tierRevenue[name]
    })).sort((a, b) => b.revenue - a.revenue);
  }
}
