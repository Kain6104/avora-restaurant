import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { PreviewVoucherAudienceDto, SendVoucherCampaignDto } from './dto/voucher-campaign.dto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  // --- VOUCHERS ---
  async findAllVouchers(params: { skip?: number; take?: number; search?: string; tierId?: string; branchIdScope?: string }) {
    const { skip = 0, take = 10, search, tierId, branchIdScope } = params;
    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { title: { contains: search } }
      ];
    }
    if (branchIdScope) {
      where.AND = [
        {
          OR: [
            { branches: { none: {} } },
            { branches: { some: { id: branchIdScope } } }
          ]
        }
      ];
    }
    if (tierId && tierId !== 'ALL') {
      where.membershipTiers = {
        some: { id: tierId }
      };
    }
    const [data, total] = await Promise.all([
      this.prisma.voucher.findMany({ 
        skip, take, where, 
        include: {
          branches: true,
          membershipTiers: true,
          voucherPaymentMethods: {
            include: { paymentMethod: true },
          },
        },
        orderBy: { createdAt: 'desc' } 
      }),
      this.prisma.voucher.count({ where }),
    ]);
    return { data, meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
  }

  async createVoucher(data: any) {
    data.startDate = data.startDate ? new Date(data.startDate) : null;
    data.endDate = data.endDate ? new Date(data.endDate) : null;
    
    const { branchIds, branchId, membershipTierIds, paymentMethodIds, appliesToAllPaymentMethods, ...restData } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);
    
    const isAllPm = appliesToAllPaymentMethods !== undefined ? Boolean(appliesToAllPaymentMethods) : true;

    return this.prisma.voucher.create({ 
      data: {
        ...restData,
        appliesToAllPaymentMethods: isAllPm,
        branches: branches.length > 0 ? { connect: branches.map((id: string) => ({ id })) } : undefined,
        membershipTiers: membershipTierIds && membershipTierIds.length > 0 ? { connect: membershipTierIds.map((id: string) => ({ id })) } : undefined,
        voucherPaymentMethods: !isAllPm && paymentMethodIds && paymentMethodIds.length > 0 ? {
          create: paymentMethodIds.map((pmId: string) => ({ paymentMethodId: pmId })),
        } : undefined,
      },
      include: {
        branches: true,
        membershipTiers: true,
        voucherPaymentMethods: { include: { paymentMethod: true } },
      },
    });
  }

  async updateVoucher(id: string, data: any, branchIdScope?: string) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id }, include: { branches: true } });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (branchIdScope && !voucher.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to update this voucher');
    }

    if ('startDate' in data) {
      data.startDate = data.startDate ? new Date(data.startDate) : undefined;
    }
    if ('endDate' in data) {
      data.endDate = data.endDate ? new Date(data.endDate) : undefined;
    }
    
    const { branchIds, branchId, membershipTierIds, paymentMethodIds, appliesToAllPaymentMethods, ...restData } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);

    const updateData: any = {
      ...restData,
      branches: branchIds !== undefined ? { set: branches.map((id: string) => ({ id })) } : undefined,
      membershipTiers: membershipTierIds !== undefined ? { set: membershipTierIds.map((id: string) => ({ id })) } : undefined,
    };

    if (appliesToAllPaymentMethods !== undefined) {
      updateData.appliesToAllPaymentMethods = Boolean(appliesToAllPaymentMethods);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.voucher.update({ 
        where: { id }, 
        data: updateData,
        include: {
          branches: true,
          membershipTiers: true,
          voucherPaymentMethods: { include: { paymentMethod: true } },
        },
      });

      if (paymentMethodIds !== undefined || appliesToAllPaymentMethods !== undefined) {
        await tx.voucherPaymentMethod.deleteMany({ where: { voucherId: id } });
        if (updateData.appliesToAllPaymentMethods === false && paymentMethodIds && paymentMethodIds.length > 0) {
          await tx.voucherPaymentMethod.createMany({
            data: paymentMethodIds.map((pmId: string) => ({
              voucherId: id,
              paymentMethodId: pmId,
            })),
          });
        }
      }

      return tx.voucher.findUnique({
        where: { id },
        include: {
          branches: true,
          membershipTiers: true,
          voucherPaymentMethods: { include: { paymentMethod: true } },
        },
      });
    });
  }

  async deleteVoucher(id: string, branchIdScope?: string) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id }, include: { branches: true } });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (branchIdScope && !voucher.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to delete this voucher');
    }
    return this.prisma.voucher.delete({ where: { id } });
  }

  async findOneVoucher(id: string, branchIdScope?: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      include: {
        branches: true,
        membershipTiers: true,
        voucherPaymentMethods: {
          include: { paymentMethod: true },
        },
        _count: {
          select: {
            orders: true,
            shippingOrders: true,
            customerVouchers: true,
          }
        }
      },
    });
    if (!voucher) throw new NotFoundException('Không tìm thấy thông tin Voucher');
    if (branchIdScope && voucher.branches.length > 0 && !voucher.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Bạn không có quyền xem Voucher của chi nhánh khác');
    }
    return voucher;
  }

  async getVoucherAnalytics(branchIdScope?: string) {
    const now = new Date();
    const branchFilter: any = branchIdScope ? { branchId: branchIdScope } : {};

    // 1. Vouchers counts
    const allVouchers = await this.prisma.voucher.findMany({
      where: branchIdScope ? {
        OR: [{ branches: { none: {} } }, { branches: { some: { id: branchIdScope } } }]
      } : {},
      select: {
        id: true,
        code: true,
        title: true,
        discountType: true,
        discountValue: true,
        minOrderValue: true,
        usedCount: true,
        usageLimit: true,
        startDate: true,
        endDate: true,
        isActive: true,
      }
    });

    const totalVouchers = allVouchers.length;
    const activeVouchers = allVouchers.filter(v => v.isActive && v.startDate <= now && v.endDate >= now).length;
    const expiredVouchers = allVouchers.filter(v => v.endDate < now).length;
    const exhaustedVouchers = allVouchers.filter(v => v.usageLimit !== null && v.usedCount >= v.usageLimit).length;

    // 2. Orders with Vouchers
    const ordersWithVoucher = await this.prisma.order.findMany({
      where: {
        ...branchFilter,
        status: { not: 'CANCELLED' },
        OR: [
          { voucherId: { not: null } },
          { shippingVoucherId: { not: null } }
        ]
      },
      select: {
        id: true,
        voucherId: true,
        shippingVoucherId: true,
        discountAmount: true,
        shippingDiscount: true,
        subTotal: true,
        totalAmount: true,
        createdAt: true,
      }
    });

    const totalUsageOrders = ordersWithVoucher.length;
    let totalDiscountAmount = 0;
    let totalOrderRevenue = 0;

    const voucherStatsMap = new Map<string, { usedOrders: number; totalDiscount: number; totalRevenue: number }>();

    ordersWithVoucher.forEach((order) => {
      const discount = (order.discountAmount || 0) + (order.shippingDiscount || 0);
      totalDiscountAmount += discount;
      totalOrderRevenue += (order.totalAmount || 0);

      const vId = order.voucherId || order.shippingVoucherId;
      if (vId) {
        const curr = voucherStatsMap.get(vId) || { usedOrders: 0, totalDiscount: 0, totalRevenue: 0 };
        curr.usedOrders += 1;
        curr.totalDiscount += discount;
        curr.totalRevenue += (order.totalAmount || 0);
        voucherStatsMap.set(vId, curr);
      }
    });

    // All Vouchers Stats Drill-Down
    const allVoucherStats = allVouchers.map(v => {
      const stats = voucherStatsMap.get(v.id) || { usedOrders: v.usedCount, totalDiscount: 0, totalRevenue: 0 };
      const aov = stats.usedOrders > 0 ? Math.round(stats.totalRevenue / stats.usedOrders) : 0;
      const roiMultiplier = stats.totalDiscount > 0 ? Number((stats.totalRevenue / stats.totalDiscount).toFixed(1)) : (stats.totalRevenue > 0 ? 99 : 0);
      return {
        id: v.id,
        code: v.code,
        title: v.title,
        discountType: v.discountType,
        discountValue: v.discountValue,
        minOrderValue: v.minOrderValue,
        usedCount: v.usedCount,
        usageLimit: v.usageLimit,
        isActive: v.isActive,
        startDate: v.startDate,
        endDate: v.endDate,
        totalDiscountGiven: stats.totalDiscount,
        totalRevenueGenerated: stats.totalRevenue,
        avgOrderValue: aov,
        roiMultiplier,
        conversionRate: v.usageLimit ? Math.round((v.usedCount / v.usageLimit) * 100) : null
      };
    }).sort((a, b) => b.totalRevenueGenerated - a.totalRevenueGenerated || b.usedCount - a.usedCount);

    const topVouchers = allVoucherStats.slice(0, 10);

    // Breakdown by discount type
    const byDiscountType = {
      FIXED_AMOUNT: { count: 0, usages: 0, revenue: 0, discount: 0 },
      PERCENTAGE: { count: 0, usages: 0, revenue: 0, discount: 0 },
      FREE_SHIP: { count: 0, usages: 0, revenue: 0, discount: 0 },
    };

    allVoucherStats.forEach(v => {
      const key = v.discountType as 'FIXED_AMOUNT' | 'PERCENTAGE' | 'FREE_SHIP';
      if (byDiscountType[key]) {
        byDiscountType[key].count += 1;
        byDiscountType[key].usages += v.usedCount;
        byDiscountType[key].revenue += v.totalRevenueGenerated;
        byDiscountType[key].discount += v.totalDiscountGiven;
      }
    });

    // Timeline last 14 days with calendar day metadata
    const timelineDays: { 
      date: string; 
      dayOfWeek: number;
      dayLabel: string;
      usageCount: number; 
      discountTotal: number; 
      revenueTotal: number;
      isPeak?: boolean;
    }[] = [];

    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      timelineDays.push({ 
        date: dateStr, 
        dayOfWeek: d.getDay(),
        dayLabel: dayNames[d.getDay()],
        usageCount: 0, 
        discountTotal: 0, 
        revenueTotal: 0 
      });
    }

    ordersWithVoucher.forEach(order => {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
      const entry = timelineDays.find(t => t.date === orderDate);
      if (entry) {
        entry.usageCount += 1;
        entry.discountTotal += (order.discountAmount || 0) + (order.shippingDiscount || 0);
        entry.revenueTotal += (order.totalAmount || 0);
      }
    });

    // Mark peak day
    let maxUsage = 0;
    timelineDays.forEach(t => {
      if (t.usageCount > maxUsage) maxUsage = t.usageCount;
    });
    if (maxUsage > 0) {
      timelineDays.forEach(t => {
        if (t.usageCount === maxUsage) t.isPeak = true;
      });
    }

    const marketingRoi = totalDiscountAmount > 0 
      ? Number((totalOrderRevenue / totalDiscountAmount).toFixed(1)) 
      : 0;

    return {
      summary: {
        totalVouchers,
        activeVouchers,
        expiredVouchers,
        exhaustedVouchers,
        totalUsageOrders,
        totalDiscountAmount: Math.round(totalDiscountAmount),
        totalOrderRevenue: Math.round(totalOrderRevenue),
        avgDiscountPerOrder: totalUsageOrders > 0 ? Math.round(totalDiscountAmount / totalUsageOrders) : 0,
        avgOrderValue: totalUsageOrders > 0 ? Math.round(totalOrderRevenue / totalUsageOrders) : 0,
        marketingRoi,
      },
      topVouchers,
      allVoucherStats,
      byDiscountType,
      timelineDays
    };
  }

  async getFraudAlerts(branchIdScope?: string) {
    const branchFilter: any = branchIdScope ? { branchId: branchIdScope } : {};
    const alerts: any[] = [];

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const orders = await this.prisma.order.findMany({
      where: {
        ...branchFilter,
        createdAt: { gte: sixtyDaysAgo },
        OR: [
          { voucherId: { not: null } },
          { shippingVoucherId: { not: null } }
        ]
      },
      include: {
        voucher: { select: { id: true, code: true, title: true, usageLimitPerUser: true } },
        shippingVoucher: { select: { id: true, code: true, title: true, usageLimitPerUser: true } },
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        branch: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 1. Multi-Account Phone Abuse
    const phoneUsersMap = new Map<string, { userIds: Set<string>; orders: any[]; vouchersUsed: Set<string> }>();
    orders.forEach(order => {
      const phone = order.customerPhone || order.user?.phone;
      if (!phone) return;
      const cleanPhone = phone.trim();
      const curr = phoneUsersMap.get(cleanPhone) || { userIds: new Set<string>(), orders: [], vouchersUsed: new Set<string>() };
      if (order.userId) curr.userIds.add(order.userId);
      curr.orders.push(order);
      if (order.voucher?.code) curr.vouchersUsed.add(order.voucher.code);
      if (order.shippingVoucher?.code) curr.vouchersUsed.add(order.shippingVoucher.code);
      phoneUsersMap.set(cleanPhone, curr);
    });

    phoneUsersMap.forEach((data, phone) => {
      if (data.userIds.size >= 2 && data.orders.length >= 2) {
        alerts.push({
          id: `PHONE_MULTI_${phone}`,
          type: 'MULTI_ACCOUNT_PHONE_ABUSE',
          severity: data.userIds.size >= 3 ? 'CRITICAL' : 'HIGH',
          title: `Nghi vấn clone nhiều tài khoản trên cùng 1 Số điện thoại (${phone})`,
          description: `Phát hiện ${data.userIds.size} tài khoản khác nhau dùng chung số điện thoại ${phone} để nhận ưu đãi (${Array.from(data.vouchersUsed).join(', ')}). Tổng cộng ${data.orders.length} đơn hàng.`,
          phone,
          occurrences: data.orders.length,
          accountCount: data.userIds.size,
          voucherCodes: Array.from(data.vouchersUsed),
          lastDetectedAt: data.orders[0]?.createdAt,
          recommendedAction: 'Khóa các tài khoản clone liên quan hoặc yêu cầu xác thực OTP.',
        });
      }
    });

    // 2. High Cancellation / Voucher Hoarding
    const userCancelMap = new Map<string, { user: any; total: number; cancelled: number; vouchersUsed: Set<string>; lastAt: Date }>();
    orders.forEach(order => {
      const uid = order.userId || order.customerPhone;
      if (!uid) return;
      const curr = userCancelMap.get(uid) || {
        user: order.user || { fullName: order.customerName, phone: order.customerPhone },
        total: 0,
        cancelled: 0,
        vouchersUsed: new Set<string>(),
        lastAt: order.createdAt
      };
      curr.total += 1;
      if (order.status === 'CANCELLED') curr.cancelled += 1;
      if (order.voucher?.code) curr.vouchersUsed.add(order.voucher.code);
      if (order.shippingVoucher?.code) curr.vouchersUsed.add(order.shippingVoucher.code);
      userCancelMap.set(uid, curr);
    });

    userCancelMap.forEach((data, uid) => {
      if (data.total >= 3 && data.cancelled >= 2 && (data.cancelled / data.total) >= 0.5) {
        alerts.push({
          id: `CANCEL_ABUSE_${uid}`,
          type: 'HIGH_CANCELLATION_HOARDING',
          severity: data.cancelled >= 4 ? 'CRITICAL' : 'HIGH',
          title: `Tỷ lệ hủy đơn áp voucher bất thường: ${data.user?.fullName || uid}`,
          description: `Khách hàng này đã đặt ${data.total} đơn có voucher nhưng hủy tới ${data.cancelled} đơn (${Math.round((data.cancelled / data.total) * 100)}%), có dấu hiệu spam giữ mã.`,
          customerName: data.user?.fullName,
          phone: data.user?.phone,
          occurrences: data.cancelled,
          cancelRate: Math.round((data.cancelled / data.total) * 100),
          voucherCodes: Array.from(data.vouchersUsed),
          lastDetectedAt: data.lastAt,
          recommendedAction: 'Cân nhắc tạm khóa quyền áp dụng mã khuyến mãi của tài khoản này.',
        });
      }
    });

    // 3. Spike Usage
    for (let i = 0; i < orders.length; i++) {
      const o1 = orders[i];
      const sameUserOrders = orders.filter(
        (o2, idx) => idx > i &&
        ((o1.userId && o1.userId === o2.userId) || (o1.customerPhone && o1.customerPhone === o2.customerPhone)) &&
        Math.abs(new Date(o1.createdAt).getTime() - new Date(o2.createdAt).getTime()) <= 30 * 60 * 1000
      );
      if (sameUserOrders.length >= 2) {
        const phone = o1.customerPhone || o1.user?.phone;
        const exists = alerts.find(a => a.type === 'SPIKE_USAGE' && a.phone === phone);
        if (!exists) {
          alerts.push({
            id: `SPIKE_${phone}_${o1.id}`,
            type: 'SPIKE_USAGE',
            severity: 'MEDIUM',
            title: `Đột biến áp dụng voucher trong thời gian ngắn (${phone})`,
            description: `Tài khoản thực hiện ${sameUserOrders.length + 1} đơn áp dụng mã trong vòng dưới 30 phút. Nghi vấn sử dụng công cụ tự động.`,
            phone,
            occurrences: sameUserOrders.length + 1,
            lastDetectedAt: o1.createdAt,
            recommendedAction: 'Kiểm tra xác thực đơn hàng tại quầy/bếp trước khi xuất kho.',
          });
        }
      }
    }

    // 4. Extreme Discount Ratio
    orders.forEach(order => {
      const discount = (order.discountAmount || 0) + (order.shippingDiscount || 0);
      if (order.subTotal > 0 && (discount / order.subTotal) >= 0.75) {
        alerts.push({
          id: `EXTREME_DISCOUNT_${order.id}`,
          type: 'EXTREME_DISCOUNT_RATIO',
          severity: 'LOW',
          title: `Đơn #${order.orderCode || order.id.slice(0, 8)} có mức giảm chiếm ${Math.round((discount / order.subTotal) * 100)}% giá trị`,
          description: `Đơn hàng subTotal: ${(order.subTotal).toLocaleString('vi-VN')}đ, được giảm ${discount.toLocaleString('vi-VN')}đ. Khách thanh toán: ${(order.totalAmount).toLocaleString('vi-VN')}đ.`,
          orderId: order.id,
          orderCode: order.orderCode,
          customerName: order.customerName,
          phone: order.customerPhone,
          occurrences: 1,
          lastDetectedAt: order.createdAt,
          recommendedAction: 'Kiểm tra cấu hình mức giảm tối đa (maxDiscount) của voucher.',
        });
      }
    });

    const severityWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    alerts.sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0));

    return {
      totalAlerts: alerts.length,
      criticalCount: alerts.filter(a => a.severity === 'CRITICAL').length,
      highCount: alerts.filter(a => a.severity === 'HIGH').length,
      mediumCount: alerts.filter(a => a.severity === 'MEDIUM').length,
      lowCount: alerts.filter(a => a.severity === 'LOW').length,
      alerts
    };
  }

  // --- FLASH SALES ---
  async findAllFlashSales(params: { skip?: number; take?: number; search?: string; tierId?: string; branchIdScope?: string }) {
    const { skip = 0, take = 10, search, tierId, branchIdScope } = params;
    const where: any = {};
    if (search) {
      where.name = { contains: search };
    }
    if (branchIdScope) {
      where.AND = [
        {
          OR: [
            { branches: { none: {} } },
            { branches: { some: { id: branchIdScope } } }
          ]
        }
      ];
    }
    if (tierId && tierId !== 'ALL') {
      where.membershipTiers = {
        some: { id: tierId }
      };
    }
    const [data, total] = await Promise.all([
      this.prisma.flashSale.findMany({
        skip, take, where,
        include: { items: { include: { product: true } }, branches: true, membershipTiers: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.flashSale.count({ where }),
    ]);
    return { data, meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
  }

  async createFlashSale(data: any) {
    const startTime = data.startTime ? new Date(data.startTime) : new Date();
    const endTime = data.endTime ? new Date(data.endTime) : new Date();
    
    const { items, branchIds, branchId, membershipTierIds } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);
    const cleanItems = items ? items.map((i: any) => ({
      productId: i.productId,
      flashSalePrice: Number(i.flashSalePrice || 0),
      stock: Number(i.stock !== undefined ? i.stock : (i.stockQuantity || 0)),
      maxQuantityPerUser: i.maxQuantityPerUser !== undefined ? Number(i.maxQuantityPerUser) : (i.userLimit !== undefined ? Number(i.userLimit) : null)
    })) : undefined;
    
    return this.prisma.flashSale.create({
      data: {
        name: data.name,
        startTime,
        endTime,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        applyOnline: data.applyOnline !== undefined ? Boolean(data.applyOnline) : true,
        applyPos: data.applyPos !== undefined ? Boolean(data.applyPos) : true,
        imageUrl: data.imageUrl || null,
        branches: branches.length > 0 ? { connect: branches.map((id: string) => ({ id })) } : undefined,
        membershipTiers: membershipTierIds && membershipTierIds.length > 0 ? { connect: membershipTierIds.map((id: string) => ({ id })) } : undefined,
        items: cleanItems ? { create: cleanItems } : undefined
      }
    });
  }

  async updateFlashSale(id: string, data: any, branchIdScope?: string) {
    const flashSale = await this.prisma.flashSale.findUnique({ where: { id }, include: { branches: true } });
    if (!flashSale) throw new NotFoundException('Flash sale not found');
    if (branchIdScope && !flashSale.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to update this flash sale');
    }

    const { items, branchIds, branchId, membershipTierIds } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);
    const cleanItems = items ? items.map((i: any) => ({
      productId: i.productId,
      flashSalePrice: Number(i.flashSalePrice || 0),
      stock: Number(i.stock !== undefined ? i.stock : (i.stockQuantity || 0)),
      maxQuantityPerUser: i.maxQuantityPerUser !== undefined ? Number(i.maxQuantityPerUser) : (i.userLimit !== undefined ? Number(i.userLimit) : null)
    })) : undefined;

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.startTime !== undefined) updateData.startTime = data.startTime ? new Date(data.startTime) : undefined;
    if (data.endTime !== undefined) updateData.endTime = data.endTime ? new Date(data.endTime) : undefined;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    if (data.applyOnline !== undefined) updateData.applyOnline = Boolean(data.applyOnline);
    if (data.applyPos !== undefined) updateData.applyPos = Boolean(data.applyPos);
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (branchIds !== undefined) {
      updateData.branches = { set: branches.map((id: string) => ({ id })) };
    }
    if (membershipTierIds !== undefined) {
      updateData.membershipTiers = { set: membershipTierIds.map((id: string) => ({ id })) };
    }

    return this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.flashSale.update({
        where: { id },
        data: updateData,
      });
      
      if (cleanItems) {
        await prisma.flashSaleItem.deleteMany({ where: { flashSaleId: id } });
        await prisma.flashSaleItem.createMany({
          data: cleanItems.map((item: any) => ({ ...item, flashSaleId: id }))
        });
      }
      return updated;
    });
  }

  async deleteFlashSale(id: string, branchIdScope?: string) {
    const flashSale = await this.prisma.flashSale.findUnique({ where: { id }, include: { branches: true } });
    if (!flashSale) throw new NotFoundException('Flash sale not found');
    if (branchIdScope && !flashSale.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to delete this flash sale');
    }
    return this.prisma.flashSale.delete({ where: { id } });
  }

  // --- COMBOS ---
  async findAllCombos(params: { skip?: number; take?: number; search?: string; tierId?: string; branchIdScope?: string }) {
    const { skip = 0, take = 10, search, tierId, branchIdScope } = params;
    const where: any = {};
    if (search) {
      where.name = { contains: search };
    }
    if (branchIdScope) {
      where.AND = [
        {
          OR: [
            { branches: { none: {} } },
            { branches: { some: { id: branchIdScope } } }
          ]
        }
      ];
    }
    if (tierId && tierId !== 'ALL') {
      where.membershipTiers = {
        some: { id: tierId }
      };
    }
    const [data, total] = await Promise.all([
      this.prisma.combo.findMany({
        skip, take, where,
        include: { items: { include: { product: true } }, branches: true, membershipTiers: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.combo.count({ where }),
    ]);
    return { data, meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
  }

  async createCombo(data: any) {
    data.startDate = data.startDate ? new Date(data.startDate) : null;
    data.endDate = data.endDate ? new Date(data.endDate) : null;
    
    const { items, branchIds, branchId, membershipTierIds, ...restData } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);
    const cleanItems = items ? items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })) : undefined;
    
    return this.prisma.combo.create({
      data: {
        ...restData,
        branches: branches.length > 0 ? { connect: branches.map((id: string) => ({ id })) } : undefined,
        membershipTiers: membershipTierIds && membershipTierIds.length > 0 ? { connect: membershipTierIds.map((id: string) => ({ id })) } : undefined,
        items: cleanItems ? { create: cleanItems } : undefined
      }
    });
  }

  async updateCombo(id: string, data: any, branchIdScope?: string) {
    const combo = await this.prisma.combo.findUnique({ where: { id }, include: { branches: true } });
    if (!combo) throw new NotFoundException('Combo not found');
    if (branchIdScope && !combo.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to update this combo');
    }

    if ('startDate' in data) {
      data.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if ('endDate' in data) {
      data.endDate = data.endDate ? new Date(data.endDate) : null;
    }
    
    const { items, branchIds, branchId, membershipTierIds, ...restData } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);
    const cleanItems = items ? items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })) : undefined;

    return this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.combo.update({
        where: { id },
        data: {
          ...restData,
          branches: branchIds !== undefined ? { set: branches.map((id: string) => ({ id })) } : undefined,
          membershipTiers: membershipTierIds !== undefined ? { set: membershipTierIds.map((id: string) => ({ id })) } : undefined
        }
      });
      
      if (cleanItems) {
        await prisma.comboItem.deleteMany({ where: { comboId: id } });
        await prisma.comboItem.createMany({
          data: cleanItems.map((item: any) => ({ ...item, comboId: id }))
        });
      }
      return updated;
    });
  }

  async deleteCombo(id: string, branchIdScope?: string) {
    const combo = await this.prisma.combo.findUnique({ where: { id }, include: { branches: true } });
    if (!combo) throw new NotFoundException('Combo not found');
    if (branchIdScope && !combo.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to delete this combo');
    }
    return this.prisma.combo.delete({ where: { id } });
  }

  // --- VOUCHER NOTIFICATIONS & EMAIL MARKETING ---

  /**
   * Tìm kiếm khách hàng phục vụ việc chọn người nhận cụ thể (SPECIFIC_USERS)
   */
  async searchUsersForVoucher(search?: string) {
    const where: any = {
      isAccountLocked: false,
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      take: 25,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        membershipTierId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Lấy thông tin hạng thẻ nếu có
    const tierIds = Array.from(new Set(users.map((u) => u.membershipTierId).filter(Boolean))) as string[];
    const tiers = tierIds.length > 0
      ? await this.prisma.membershipTier.findMany({
          where: { id: { in: tierIds } },
          select: { id: true, name: true, minSpending: true, discountPercent: true },
        })
      : [];
    const tierMap = new Map(tiers.map((t) => [t.id, t]));

    return users.map((u) => ({
      ...u,
      membershipTier: u.membershipTierId ? tierMap.get(u.membershipTierId) || null : null,
    }));
  }

  /**
   * Ước tính số lượng khách hàng tiếp cận (Audience Preview)
   */
  async previewVoucherAudience(voucherId: string, dto: PreviewVoucherAudienceDto, branchIdScope?: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      include: { branches: true, membershipTiers: true },
    });

    if (!voucher) {
      throw new NotFoundException('Không tìm thấy thông tin Voucher');
    }

    if (branchIdScope && voucher.branches.length > 0 && !voucher.branches.some((b) => b.id === branchIdScope)) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên Voucher này');
    }

    const userWhere: any = {
      isAccountLocked: false,
      role: 'USER',
    };

    const resolvedTierIds = dto.targetTierIds && dto.targetTierIds.length > 0
      ? dto.targetTierIds
      : (dto.targetType === 'MEMBERSHIP_TIER' ? voucher.membershipTiers.map((t) => t.id) : []);

    if (dto.targetType === 'MEMBERSHIP_TIER') {
      if (resolvedTierIds.length > 0) {
        userWhere.membershipTierId = { in: resolvedTierIds };
      } else {
        userWhere.id = '__NONE__';
      }
    } else if (dto.targetType === 'SPECIFIC_USERS') {
      if (dto.targetUserIds && dto.targetUserIds.length > 0) {
        userWhere.id = { in: dto.targetUserIds };
      } else {
        userWhere.id = '__NONE__';
      }
    }

    const [estimatedRecipients, emailRecipients, selectedTiers, selectedUsers] = await Promise.all([
      this.prisma.user.count({ where: userWhere }),
      this.prisma.user.count({
        where: {
          ...userWhere,
          email: { not: '' },
        },
      }),
      resolvedTierIds.length > 0
        ? this.prisma.membershipTier.findMany({
            where: { id: { in: resolvedTierIds } },
            select: { id: true, name: true, minSpending: true, discountPercent: true },
          })
        : [],
      dto.targetUserIds && dto.targetUserIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: dto.targetUserIds } },
            select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
          })
        : [],
    ]);

    return {
      estimatedRecipients,
      emailRecipients,
      targetType: dto.targetType,
      targetTierIds: resolvedTierIds,
      targetUserIds: dto.targetUserIds || [],
      selectedMembershipTiers: selectedTiers,
      selectedUsers,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        title: voucher.title,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        minOrderValue: voucher.minOrderValue,
        startDate: voucher.startDate,
        endDate: voucher.endDate,
        applicableScope: voucher.applicableScope,
      },
    };
  }

  /**
   * Phát hành thông báo & email voucher đến khách hàng mục tiêu
   */
  async sendVoucherNotification(
    voucherId: string,
    dto: SendVoucherCampaignDto,
    userContext: any,
    branchIdScope?: string,
    ipAddress?: string
  ) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      include: { branches: true, membershipTiers: true },
    });

    if (!voucher) {
      throw new NotFoundException('Không tìm thấy thông tin Voucher');
    }

    if (branchIdScope && voucher.branches.length > 0 && !voucher.branches.some((b) => b.id === branchIdScope)) {
      throw new ForbiddenException('Bạn không có quyền gửi thông báo cho Voucher này');
    }

    const notifTitle = dto.title.trim();
    const notifContent = dto.content.trim();

    if (!notifTitle || !notifContent) {
      throw new BadRequestException('Tiêu đề và nội dung thông báo không được để trống');
    }

    // Xác định tập khách hàng mục tiêu
    const userWhere: any = {
      isAccountLocked: false,
      role: 'USER',
    };

    if (dto.targetType === 'MEMBERSHIP_TIER') {
      const tierIds = dto.targetTierIds && dto.targetTierIds.length > 0
        ? dto.targetTierIds
        : voucher.membershipTiers.map((t) => t.id);

      if (tierIds.length === 0) {
        throw new BadRequestException('Vui lòng chọn ít nhất một hạng thành viên');
      }
      userWhere.membershipTierId = { in: tierIds };
    } else if (dto.targetType === 'SPECIFIC_USERS') {
      if (!dto.targetUserIds || dto.targetUserIds.length === 0) {
        throw new BadRequestException('Vui lòng chọn ít nhất một khách hàng cụ thể');
      }
      userWhere.id = { in: dto.targetUserIds };
    }

    const recipients = await this.prisma.user.findMany({
      where: userWhere,
      select: { id: true, fullName: true, email: true, phone: true },
    });

    if (recipients.length === 0) {
      throw new BadRequestException('Không tìm thấy khách hàng nào phù hợp với nhóm đối tượng đã chọn');
    }

    const sendInApp = dto.sendInApp !== false;
    const sendEmail = dto.sendEmail !== false;

    if (!sendInApp && !sendEmail) {
      throw new BadRequestException('Vui lòng chọn ít nhất một phương thức gửi (In-App hoặc Email)');
    }

    let sentInAppCount = 0;
    let failedInAppCount = 0;
    let sentEmailCount = 0;
    let failedEmailCount = 0;

    // 1. GỬI IN-APP & WEB SOCKET PUSH NOTIFICATIONS
    if (sendInApp) {
      const batchSize = 50;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async (u) => {
            try {
              await this.notificationService.createNotification({
                userId: u.id,
                title: notifTitle,
                content: notifContent,
                type: 'PROMOTION',
                referenceId: voucher.id,
                url: '/vouchers',
                priority: 2,
                metadata: {
                  voucherId: voucher.id,
                  voucherCode: voucher.code,
                  discountType: voucher.discountType,
                  discountValue: voucher.discountValue,
                  maxDiscount: voucher.maxDiscount,
                  minOrderValue: voucher.minOrderValue,
                  endDate: voucher.endDate,
                },
              });
              sentInAppCount++;
            } catch (err) {
              this.logger.error(`Error sending in-app notification to user ${u.id}:`, err);
              failedInAppCount++;
            }
          })
        );
      }
    }

    // 2. GỬI EMAIL MARKETING HTML
    const emailRecipients = recipients.filter((r) => r.email && r.email.trim().includes('@'));
    const isSmtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    if (sendEmail && emailRecipients.length > 0) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const voucherUrl = `${frontendUrl}/vouchers`;

      const discountText = voucher.discountType === 'PERCENTAGE'
        ? `GIẢM ${voucher.discountValue}%`
        : `GIẢM ${voucher.discountValue.toLocaleString('vi-VN')}đ`;

      const maxDiscountText = voucher.maxDiscount
        ? `(Tối đa ${voucher.maxDiscount.toLocaleString('vi-VN')}đ)`
        : '';

      const minOrderText = voucher.minOrderValue > 0
        ? `Đơn tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ`
        : 'Áp dụng cho mọi giá trị đơn';

      const scopeText = voucher.applicableScope === 'ONLINE'
        ? 'Chỉ áp dụng đặt hàng trực tuyến (Giao tận nơi)'
        : voucher.applicableScope === 'POS'
        ? 'Chỉ áp dụng khi dùng bữa tại nhà hàng'
        : 'Áp dụng toàn hệ thống (Ăn tại quán & Đặt online)';

      const endDateFormatted = new Date(voucher.endDate).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const emailSubject = dto.customEmailSubject?.trim() || `[AVORA] Tặng bạn mã ưu đãi ${voucher.code}: ${discountText} - Đừng bỏ lỡ!`;

      if (isSmtpConfigured) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          // Gửi theo đợt nhỏ 10 người để tránh rate limit của SMTP
          const emailBatchSize = 10;
          for (let i = 0; i < emailRecipients.length; i += emailBatchSize) {
            const batch = emailRecipients.slice(i, i + emailBatchSize);
            await Promise.allSettled(
              batch.map(async (u) => {
                try {
                  const emailHtml = this.buildVoucherEmailHtml({
                    customerName: u.fullName || 'Quý khách',
                    voucherCode: voucher.code,
                    voucherTitle: voucher.title || 'Ưu Đãi Đặc Biệt Từ Avora',
                    voucherContent: notifContent,
                    discountText,
                    maxDiscountText,
                    minOrderText,
                    scopeText,
                    endDateFormatted,
                    customNote: dto.customEmailNote?.trim() || '',
                    voucherUrl,
                  });

                  await transporter.sendMail({
                    from: `"Avora Restaurant" <${process.env.SMTP_USER}>`,
                    to: u.email,
                    subject: emailSubject,
                    html: emailHtml,
                  });
                  sentEmailCount++;
                } catch (err) {
                  this.logger.error(`Error sending email to ${u.email}:`, err);
                  failedEmailCount++;
                }
              })
            );
          }
        } catch (smtpErr) {
          this.logger.error('Failed to initialize or send via nodemailer:', smtpErr);
          failedEmailCount = emailRecipients.length;
        }
      } else {
        // Môi trường dev không có SMTP credentials, mô phỏng gửi thành công và log thông tin
        this.logger.log(`[SMTP DEV SIMULATION] Mã ${voucher.code} gửi tới ${emailRecipients.length} email. (Chưa cấu hình SMTP_USER/SMTP_PASS)`);
        sentEmailCount = emailRecipients.length;
      }
    }

    return {
      success: true,
      message: `Đã gửi thông báo voucher thành công cho ${recipients.length} khách hàng`,
      data: {
        totalRecipients: recipients.length,
        sentInAppCount,
        failedInAppCount,
        sentEmailCount,
        failedEmailCount,
        smtpConfigured: isSmtpConfigured,
        voucherId: voucher.id,
        voucherCode: voucher.code,
      },
    };
  }

  /**
   * Tạo giao diện HTML Email vé Voucher phong cách cao cấp
   */
  private buildVoucherEmailHtml(params: {
    customerName: string;
    voucherCode: string;
    voucherTitle: string;
    voucherContent: string;
    discountText: string;
    maxDiscountText: string;
    minOrderText: string;
    scopeText: string;
    endDateFormatted: string;
    customNote: string;
    voucherUrl: string;
  }): string {
    const {
      customerName,
      voucherCode,
      voucherTitle,
      voucherContent,
      discountText,
      maxDiscountText,
      minOrderText,
      scopeText,
      endDateFormatted,
      customNote,
      voucherUrl,
    } = params;

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ưu Đãi Đặc Biệt Từ Avora Restaurant</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Container chính -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
          
          <!-- Banner Header nhận diện thương hiệu -->
          <tr>
            <td style="background: linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ea580c 100%); padding: 32px 24px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 6px 16px; border-radius: 9999px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.3);">
                      <span style="color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">AVORA RESTAURANT & FINE DINING</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 26px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.5px;">QUÀ TẶNG ƯU ĐÃI DÀNH RIÊNG CHO BẠN</h1>
                    <p style="color: #fee2e2; font-size: 14px; margin: 0; font-weight: 500;">Đặc quyền thưởng thức ẩm thực tinh hoa cùng Avora</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Lời chào & Nội dung thông điệp -->
          <tr>
            <td style="padding: 28px 28px 16px 28px;">
              <p style="font-size: 16px; color: #1e293b; margin: 0 0 12px 0;">Xin chào <strong>${customerName}</strong>,</p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">${voucherContent}</p>
            </td>
          </tr>

          <!-- TẤM VÉ VOUCHER CẮT RỜI (TICKET CUTOUT) -->
          <tr>
            <td style="padding: 0 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(145deg, #fff7ed 0%, #fef2f2 100%); border-radius: 16px; border: 2px dashed #f87171; overflow: hidden; position: relative;">
                <tr>
                  <td style="padding: 24px 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 800; color: #dc2626; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">${voucherTitle}</div>
                    <div style="font-size: 32px; font-weight: 900; color: #b91c1c; margin-bottom: 2px; letter-spacing: -1px;">
                      ${discountText}
                    </div>
                    ${maxDiscountText ? `<div style="font-size: 12px; font-weight: 600; color: #ea580c; margin-bottom: 12px;">${maxDiscountText}</div>` : '<div style="margin-bottom: 12px;"></div>'}

                    <!-- Hộp Mã Voucher sao chép -->
                    <div style="background-color: #ffffff; border: 2px solid #dc2626; border-radius: 12px; padding: 12px 20px; display: inline-block; margin-bottom: 14px; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.1);">
                      <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 2px;">MÃ ƯU ĐÃI CỦA BẠN</div>
                      <div style="font-size: 26px; font-weight: 900; color: #dc2626; letter-spacing: 4px; font-family: monospace;">${voucherCode}</div>
                    </div>

                    <!-- Điều kiện vắn tắt -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 8px; border-top: 1px dashed #fca5a5; padding-top: 12px;">
                      <tr>
                        <td align="center">
                          <p style="font-size: 12px; color: #475569; margin: 3px 0;">• <strong>Đơn tối thiểu:</strong> ${minOrderText}</p>
                          <p style="font-size: 12px; color: #475569; margin: 3px 0;">• <strong>Phạm vi:</strong> ${scopeText}</p>
                          <p style="font-size: 12px; color: #b91c1c; font-weight: 700; margin: 3px 0;">• <strong>Hạn sử dụng:</strong> Đến hết ngày ${endDateFormatted}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${customNote ? `
          <!-- Ghi chú bổ sung từ Quản trị viên -->
          <tr>
            <td style="padding: 16px 28px 0 28px;">
              <div style="background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 10px 14px; border-radius: 0 8px 8px 0; font-size: 13px; color: #334155;">
                <strong>Lưu ý từ nhà hàng:</strong> ${customNote}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Nút Kêu gọi Hành động (CTA BUTTON) -->
          <tr>
            <td style="padding: 24px 28px 32px 28px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="border-radius: 12px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
                    <a href="${voucherUrl}" target="_blank" style="font-size: 15px; font-weight: 800; color: #ffffff; text-decoration: none; padding: 14px 32px; display: inline-block; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 10px 15px -3px rgba(220, 38, 38, 0.3);">
                      LƯU VÀO VÍ & SỬ DỤNG NGAY →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 12px; color: #94a3b8; margin: 12px 0 0 0;">Nhấn vào nút để mở trang Ví Voucher và áp dụng trực tiếp khi thanh toán</p>
            </td>
          </tr>

          <!-- Footer Email -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 12px; font-weight: 700; color: #64748b; margin: 0 0 4px 0;">HỆ THỐNG NHÀ HÀNG AVORA RESTAURANT</p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0 0 8px 0;">Bạn nhận được email này vì bạn là thành viên đã đăng ký tại hệ thống Avora Restaurant.</p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">Hotline hỗ trợ: <strong>1900 6868</strong> • Website: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="color: #dc2626; text-decoration: none;">avora.vn</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  async autoDistributeVoucher(voucherId: string, branchIdScope?: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      include: {
        membershipTiers: true,
        branches: true,
      },
    });

    if (!voucher) {
      throw new NotFoundException('Không tìm thấy voucher');
    }

    if (branchIdScope && voucher.branches.length > 0 && !voucher.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên voucher của chi nhánh khác');
    }

    // Determine eligible users based on targetCustomerScope
    let targetUsers: { id: string; name?: string | null; email?: string | null; phone?: string | null }[] = [];

    const scope = voucher.targetCustomerScope || 'ALL';

    if (scope === 'NEW_CUSTOMER') {
      // Users with 0 completed orders
      targetUsers = await this.prisma.user.findMany({
        where: {
          orders: {
            none: {
              status: 'COMPLETED',
            },
          },
        },
        select: { id: true, fullName: true, email: true, phone: true },
      });
    } else if (scope === 'MEMBERSHIP_TIER') {
      const tierIds = voucher.membershipTiers.map(t => t.id);
      if (tierIds.length > 0) {
        targetUsers = await this.prisma.user.findMany({
          where: {
            membershipTierId: { in: tierIds },
          },
          select: { id: true, fullName: true, email: true, phone: true },
        });
      } else {
        targetUsers = await this.prisma.user.findMany({
          select: { id: true, fullName: true, email: true, phone: true },
        });
      }
    } else if (scope === 'SPECIFIC_CUSTOMERS') {
      let specificIds: string[] = [];
      if (voucher.targetCustomerIds) {
        try {
          if (voucher.targetCustomerIds.startsWith('[')) {
            specificIds = JSON.parse(voucher.targetCustomerIds);
          } else {
            specificIds = voucher.targetCustomerIds.split(',').map(s => s.trim()).filter(Boolean);
          }
        } catch {
          specificIds = voucher.targetCustomerIds.split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      if (specificIds.length > 0) {
        targetUsers = await this.prisma.user.findMany({
          where: { id: { in: specificIds } },
          select: { id: true, fullName: true, email: true, phone: true },
        });
      }
    } else {
      // 'ALL' customers
      targetUsers = await this.prisma.user.findMany({
        select: { id: true, fullName: true, email: true, phone: true },
      });
    }

    if (targetUsers.length === 0) {
      return {
        success: true,
        count: 0,
        totalEligible: 0,
        message: 'Không tìm thấy khách hàng nào phù hợp với điều kiện của voucher này.',
      };
    }

    // Find users who already have this voucher in wallet
    const existingSaved = await this.prisma.customerVoucher.findMany({
      where: { voucherId },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingSaved.map(s => s.userId));
    const usersToDistribute = targetUsers.filter(u => !existingUserIds.has(u.id));

    if (usersToDistribute.length > 0) {
      // Add in chunks of 500
      for (let i = 0; i < usersToDistribute.length; i += 500) {
        const chunk = usersToDistribute.slice(i, i + 500);
        await this.prisma.customerVoucher.createMany({
          data: chunk.map(u => ({
            userId: u.id,
            voucherId: voucher.id,
          })),
          skipDuplicates: true,
        });
      }

      // Send realtime notification for users (top 200 to prevent overload)
      const notifyBatch = usersToDistribute.slice(0, 200);
      for (const u of notifyBatch) {
        try {
          await this.notificationService.createNotification({
            userId: u.id,
            title: `[AVORA] Bạn được tặng mã ưu đãi ${voucher.code}!`,
            content: `Voucher "${voucher.title}" đã được tự động lưu vào Ví voucher của bạn. Hãy sử dụng ngay khi đặt món tại Avora nhé!`,
            type: 'PROMOTION',
            url: '/vouchers',
            metadata: { voucherId: voucher.id, code: voucher.code },
          });
        } catch (err) {
          // ignore notification error
        }
      }
    }

    return {
      success: true,
      count: usersToDistribute.length,
      totalEligible: targetUsers.length,
      alreadyInWallet: existingUserIds.size,
      message: `Đã tự động lưu voucher vào ví cho ${usersToDistribute.length} khách hàng phù hợp (trên tổng số ${targetUsers.length} khách hàng đủ điều kiện)!`,
    };
  }
}
