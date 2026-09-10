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

    // 1. Calculate Current Date Range
    const now = new Date();
    const currentDateTo = to ? new Date(to) : new Date(now);
    currentDateTo.setHours(23, 59, 59, 999);

    const currentDateFrom = from
      ? new Date(from)
      : new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000); // default 30 days
    currentDateFrom.setHours(0, 0, 0, 0);

    const durationMs = currentDateTo.getTime() - currentDateFrom.getTime();

    // 2. Calculate Previous Date Range of equal length
    const prevDateTo = new Date(currentDateFrom.getTime() - 1);
    const prevDateFrom = new Date(prevDateTo.getTime() - durationMs);

    // Common WHERE filters for Orders
    const whereCurrent: any = {
      createdAt: {
        gte: currentDateFrom,
        lte: currentDateTo,
      },
    };

    const wherePrevious: any = {
      createdAt: {
        gte: prevDateFrom,
        lte: prevDateTo,
      },
    };

    if (branchIdScope) {
      whereCurrent.branchId = branchIdScope;
      wherePrevious.branchId = branchIdScope;
    }

    // 3. Parallel Queries for Current and Previous Periods
    const [
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      revenueAggr,
      prevTotalOrders,
      prevCompletedOrders,
      prevCancelledOrders,
      prevRevenueAggr,
      statusAggr,
      totalCustomers,
      newCustomersCurrent,
      newCustomersPrevious,
      channelAggr,
      recentOrders,
      recentAuditLogs,
      completedOrdersData,
    ] = await Promise.all([
      // Current period counts
      this.prisma.order.count({ where: whereCurrent }),
      this.prisma.order.count({
        where: { ...whereCurrent, status: OrderStatus.COMPLETED },
      }),
      this.prisma.order.count({
        where: {
          ...whereCurrent,
          status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.DELIVERING] },
        },
      }),
      this.prisma.order.count({
        where: { ...whereCurrent, status: OrderStatus.CANCELLED },
      }),
      this.prisma.order.aggregate({
        where: { ...whereCurrent, status: OrderStatus.COMPLETED },
        _sum: { totalAmount: true },
      }),

      // Previous period counts for percentage trend calculation
      this.prisma.order.count({ where: wherePrevious }),
      this.prisma.order.count({
        where: { ...wherePrevious, status: OrderStatus.COMPLETED },
      }),
      this.prisma.order.count({
        where: { ...wherePrevious, status: OrderStatus.CANCELLED },
      }),
      this.prisma.order.aggregate({
        where: { ...wherePrevious, status: OrderStatus.COMPLETED },
        _sum: { totalAmount: true },
      }),

      // Group by order status
      this.prisma.order.groupBy({
        by: ['status'],
        where: whereCurrent,
        _count: { _all: true },
      }),

      // Customers counts
      this.prisma.user.count({
        where: { role: 'USER' },
      }),
      this.prisma.user.count({
        where: {
          role: 'USER',
          createdAt: { gte: currentDateFrom, lte: currentDateTo },
        },
      }),
      this.prisma.user.count({
        where: {
          role: 'USER',
          createdAt: { gte: prevDateFrom, lte: prevDateTo },
        },
      }),

      // Sales by Payment Method / Channel
      this.prisma.order.groupBy({
        by: ['paymentMethod'],
        where: { ...whereCurrent, status: OrderStatus.COMPLETED },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),

      // Recent 10 Orders
      this.prisma.order.findMany({
        where: branchIdScope ? { branchId: branchIdScope } : {},
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, email: true } },
          branch: { select: { name: true } },
        },
      }),

      // Recent Audit Logs
      this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, email: true, role: true } },
        },
      }),

      // Detailed Completed Orders for daily chart, top products and category breakdown
      this.prisma.order.findMany({
        where: { ...whereCurrent, status: OrderStatus.COMPLETED },
        select: {
          createdAt: true,
          totalAmount: true,
          orderItems: {
            select: {
              quantity: true,
              priceAtSale: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    // 4. Calculate Financials & AOV
    const totalRevenue = revenueAggr._sum.totalAmount || 0;
    const prevTotalRevenue = prevRevenueAggr._sum.totalAmount || 0;

    const averageOrderValue = completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0;
    const prevAvgOrderValue =
      prevCompletedOrders > 0 ? Math.round(prevTotalRevenue / prevCompletedOrders) : 0;

    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const prevCancellationRate =
      prevTotalOrders > 0 ? (prevCancelledOrders / prevTotalOrders) * 100 : 0;

    // Helper: calculate percentage change
    const calcChange = (curr: number, prev: number): number => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
    };

    const revenueChangePercent = calcChange(totalRevenue, prevTotalRevenue);
    const ordersChangePercent = calcChange(totalOrders, prevTotalOrders);
    const completedOrdersChangePercent = calcChange(completedOrders, prevCompletedOrders);
    const avgOrderChangePercent = calcChange(averageOrderValue, prevAvgOrderValue);
    const customersChangePercent = calcChange(newCustomersCurrent, newCustomersPrevious);
    const cancellationRateChangePercent = parseFloat(
      (cancellationRate - prevCancellationRate).toFixed(1)
    );

    // 5. Aggregate Daily Revenue & Orders Series (Continuous Dates)
    const revenueByDayMap: Record<string, { revenue: number; orders: number }> = {};

    const cursor = new Date(currentDateFrom);
    while (cursor <= currentDateTo) {
      const dStr = cursor.toISOString().split('T')[0];
      revenueByDayMap[dStr] = { revenue: 0, orders: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    // Top Selling Products map & Categories map
    const productSalesMap: Record<
      string,
      { id: string; name: string; image: string; totalQuantity: number; revenue: number }
    > = {};

    const categorySalesMap: Record<
      string,
      { id: string; name: string; totalQuantity: number; revenue: number }
    > = {};

    let totalSoldItems = 0;

    completedOrdersData.forEach((order) => {
      const dStr = order.createdAt.toISOString().split('T')[0];
      if (revenueByDayMap[dStr]) {
        revenueByDayMap[dStr].revenue += order.totalAmount;
        revenueByDayMap[dStr].orders += 1;
      }

      // Aggregate item sales
      order.orderItems.forEach((item) => {
        if (item.product) {
          const itemRev = item.priceAtSale * item.quantity;
          totalSoldItems += item.quantity;

          // Product aggregation
          if (!productSalesMap[item.product.id]) {
            productSalesMap[item.product.id] = {
              id: item.product.id,
              name: item.product.name,
              image: item.product.imageUrl || '',
              totalQuantity: 0,
              revenue: 0,
            };
          }
          productSalesMap[item.product.id].totalQuantity += item.quantity;
          productSalesMap[item.product.id].revenue += itemRev;

          // Category aggregation
          const cat = item.product.category;
          const catId = cat?.id || 'uncategorized';
          const catName = cat?.name || 'Khác';

          if (!categorySalesMap[catId]) {
            categorySalesMap[catId] = {
              id: catId,
              name: catName,
              totalQuantity: 0,
              revenue: 0,
            };
          }
          categorySalesMap[catId].totalQuantity += item.quantity;
          categorySalesMap[catId].revenue += itemRev;
        }
      });
    });

    const revenueChart = Object.keys(revenueByDayMap)
      .sort()
      .map((date) => ({
        date,
        revenue: revenueByDayMap[date].revenue,
        orders: revenueByDayMap[date].orders,
      }));

    // Top Products with percentage of total product sales
    const totalProductRevenue = Object.values(productSalesMap).reduce(
      (sum, p) => sum + p.revenue,
      0
    );

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        percentage:
          totalProductRevenue > 0
            ? parseFloat(((p.revenue / totalProductRevenue) * 100).toFixed(2))
            : 0,
        qtyPercentage:
          totalSoldItems > 0
            ? parseFloat(((p.totalQuantity / totalSoldItems) * 100).toFixed(2))
            : 0,
      }));

    // Sales by Category with percentage
    const salesByCategory = Object.values(categorySalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map((c) => ({
        ...c,
        percentage:
          totalProductRevenue > 0
            ? parseFloat(((c.revenue / totalProductRevenue) * 100).toFixed(2))
            : 0,
        qtyPercentage:
          totalSoldItems > 0
            ? parseFloat(((c.totalQuantity / totalSoldItems) * 100).toFixed(2))
            : 0,
      }));

    // 6. Format Sales by Payment Method
    const salesChannels = channelAggr.map((ch) => {
      const rev = ch._sum.totalAmount || 0;
      const count = ch._count._all || 0;
      return {
        channel: ch.paymentMethod || 'OTHER',
        revenue: rev,
        orders: count,
        percentage:
          totalRevenue > 0 ? parseFloat(((rev / totalRevenue) * 100).toFixed(2)) : 0,
        orderPercentage:
          completedOrders > 0 ? parseFloat(((count / completedOrders) * 100).toFixed(2)) : 0,
      };
    });

    // 7. Format Tax Breakdown (VAT estimated 8% or 10%)
    const taxRate = 0.08;
    const taxAmount = Math.round(totalRevenue * (taxRate / (1 + taxRate)));
    const netRevenue = totalRevenue - taxAmount;

    // 8. Format Recent Activities
    const recentActivities = recentAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      target: log.target,
      userName: log.user?.fullName || 'Hệ thống',
      userRole: log.user?.role || 'SYSTEM',
      createdAt: log.createdAt,
    }));

    return {
      summary: {
        totalRevenue,
        prevTotalRevenue,
        revenueChangePercent,

        grossRevenue: totalRevenue,
        netRevenue,
        taxAmount,

        totalOrders,
        prevTotalOrders,
        ordersChangePercent,

        completedOrders,
        prevCompletedOrders,
        completedOrdersChangePercent,

        pendingOrders,
        cancelledOrders,
        cancellationRate: parseFloat(cancellationRate.toFixed(1)),
        cancellationRateChangePercent,

        averageOrderValue,
        prevAvgOrderValue,
        avgOrderChangePercent,

        totalCustomers,
        newCustomers: newCustomersCurrent,
        customersChangePercent,
      },
      revenueChart,
      topProducts,
      salesByCategory,
      salesChannels,
      ordersByStatus: statusAggr.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode || o.id.slice(0, 8),
        customerName: o.user?.fullName || o.customerName || 'Khách vãng lai',
        branchName: o.branch?.name || '-',
        totalAmount: o.totalAmount,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
      recentActivities,
    };
  }
}
