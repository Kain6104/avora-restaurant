import { Injectable } from '@nestjs/common';

/* ==========================================================================
   VOUCHER REPORT CALCULATION ENGINE (COMPLETED ORDERS ONLY - SINGLE SOURCE OF TRUTH)
   ========================================================================== */

export interface VoucherOrderInput {
  id: string;
  orderCode: string | null;
  branchId: string;
  branchName?: string;
  userId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  subTotal: number;
  totalAmount: number;
  discountAmount: number; // Order discount from voucher
  shippingDiscount: number; // Shipping discount from voucher
  shippingFee: number;
  pointsUsed: number;
  taxAmount: number;
  voucherId: string | null;
  shippingVoucherId: string | null;
  discountVoucherCodeSnapshot: string | null;
  shippingVoucherCodeSnapshot: string | null;
  paymentMethod: string;
  orderSource: string;
  deliveredAt: Date | string | null;
  createdAt: Date | string;
  status: string;
  // Metadata for fraud / first order check
  userTotalCompletedOrders?: number;
  userCompletedOrdersBeforeThis?: number;
}

export interface VoucherMetadataInput {
  id: string;
  code: string;
  title: string;
  discountType: string; // PERCENTAGE, FIXED_AMOUNT, FREE_SHIP
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue: number;
  isFirstOrderOnly: boolean;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  usedCount: number;
  isPublic: boolean;
  applicableScope: string;
  applicableProductsScope: string;
  startDate: Date | string;
  endDate: Date | string;
  isActive: boolean;
}

export interface CalculatedVoucherKPIs {
  totalCompletedOrdersWithVoucher: number;
  totalCompletedOrdersOverall: number;
  voucherOrderPenetrationRate: number; // % orders using voucher
  uniqueVoucherUsers: number;
  totalVoucherRedemptions: number;
  grossRevenueGenerated: number;
  orderDiscountCost: number;
  shippingDiscountCost: number;
  totalDiscountCost: number;
  netRevenueGenerated: number;
  averageDiscountPerOrder: number;
  voucherAov: number;
  nonVoucherAov: number;
  incrementalAov: number;
  revenueToDiscountRatio: number; // e.g. 8.4x
  firstOrderVoucherUsageCount: number;
  returningCustomerVoucherUsageCount: number;
  potentialAbuseSignalsCount: number;
}

export interface CalculatedVoucherPerformanceItem {
  voucherId: string;
  code: string;
  title: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number;
  isFirstOrderOnly: boolean;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  completedUses: number;
  uniqueUsers: number;
  grossRevenue: number;
  orderDiscountCost: number;
  shippingDiscountCost: number;
  totalDiscountCost: number;
  netRevenue: number;
  aov: number;
  revenueToDiscountRatio: number;
  firstOrderUses: number;
  returningUses: number;
  abuseSignalsCount: number;
  isActive: boolean;
}

export interface VoucherFraudSignalItem {
  id: string;
  orderId: string;
  orderCode: string;
  voucherCode: string;
  customerName: string;
  customerPhone: string;
  completedAt: string;
  signalType: 'EXCESSIVE_PER_USER' | 'BURST_USAGE' | 'REPEATED_FIRST_ORDER' | 'HIGH_DISCOUNT_RATIO';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  grossAmount: number;
  discountAmount: number;
  discountRatioPercent: number;
  confirmedFraud: boolean; // Flag to distinguish signal from confirmed fraud
}

@Injectable()
export class VoucherReportCalculationService {
  /**
   * Tính toán toàn bộ KPI tổng quan Voucher cho đơn hoàn thành
   */
  calculateVoucherKPIs(
    completedOrders: VoucherOrderInput[],
    allCompletedOrdersInPeriod: VoucherOrderInput[],
    fraudSignals: VoucherFraudSignalItem[],
  ): CalculatedVoucherKPIs {
    const voucherOrders = completedOrders.filter(
      (o) => o.voucherId || o.shippingVoucherId || o.discountAmount > 0 || o.shippingDiscount > 0,
    );

    const nonVoucherOrders = allCompletedOrdersInPeriod.filter(
      (o) => !o.voucherId && !o.shippingVoucherId && o.discountAmount === 0 && o.shippingDiscount === 0,
    );

    const totalCompletedOrdersWithVoucher = voucherOrders.length;
    const totalCompletedOrdersOverall = allCompletedOrdersInPeriod.length;
    const voucherOrderPenetrationRate =
      totalCompletedOrdersOverall > 0
        ? Math.round((totalCompletedOrdersWithVoucher / totalCompletedOrdersOverall) * 1000) / 10
        : 0;

    const uniqueUserSet = new Set<string>();
    let grossRevenueGenerated = 0;
    let orderDiscountCost = 0;
    let shippingDiscountCost = 0;
    let totalDiscountCost = 0;
    let netRevenueGenerated = 0;
    let firstOrderVoucherUsageCount = 0;
    let returningCustomerVoucherUsageCount = 0;

    for (const o of voucherOrders) {
      const userKey = o.userId || o.customerPhone || o.id;
      uniqueUserSet.add(userKey);

      const gross = Math.round(o.subTotal || 0);
      const oDiscount = Math.round(o.discountAmount || 0);
      const sDiscount = Math.round(o.shippingDiscount || 0);
      const tDiscount = oDiscount + sDiscount;
      const net = Math.round(Math.max(0, (o.totalAmount || 0) - (o.shippingFee || 0)));

      grossRevenueGenerated += gross;
      orderDiscountCost += oDiscount;
      shippingDiscountCost += sDiscount;
      totalDiscountCost += tDiscount;
      netRevenueGenerated += net;

      // First order check
      if (o.userCompletedOrdersBeforeThis === 0) {
        firstOrderVoucherUsageCount++;
      } else {
        returningCustomerVoucherUsageCount++;
      }
    }

    const uniqueVoucherUsers = uniqueUserSet.size;
    const totalVoucherRedemptions = totalCompletedOrdersWithVoucher;

    const averageDiscountPerOrder =
      totalCompletedOrdersWithVoucher > 0
        ? Math.round(totalDiscountCost / totalCompletedOrdersWithVoucher)
        : 0;

    const voucherAov =
      totalCompletedOrdersWithVoucher > 0
        ? Math.round(grossRevenueGenerated / totalCompletedOrdersWithVoucher)
        : 0;

    let nonVoucherGrossTotal = 0;
    for (const o of nonVoucherOrders) {
      nonVoucherGrossTotal += Math.round(o.subTotal || 0);
    }
    const nonVoucherAov =
      nonVoucherOrders.length > 0
        ? Math.round(nonVoucherGrossTotal / nonVoucherOrders.length)
        : 0;

    const incrementalAov = voucherAov - nonVoucherAov;

    // Revenue-to-Discount Ratio (e.g., 8.4x)
    const revenueToDiscountRatio =
      totalDiscountCost > 0
        ? Math.round((grossRevenueGenerated / totalDiscountCost) * 100) / 100
        : 0;

    return {
      totalCompletedOrdersWithVoucher,
      totalCompletedOrdersOverall,
      voucherOrderPenetrationRate,
      uniqueVoucherUsers,
      totalVoucherRedemptions,
      grossRevenueGenerated,
      orderDiscountCost,
      shippingDiscountCost,
      totalDiscountCost,
      netRevenueGenerated,
      averageDiscountPerOrder,
      voucherAov,
      nonVoucherAov,
      incrementalAov,
      revenueToDiscountRatio,
      firstOrderVoucherUsageCount,
      returningCustomerVoucherUsageCount,
      potentialAbuseSignalsCount: fraudSignals.length,
    };
  }

  /**
   * Tính toán bảng hiệu suất chi tiết cho từng mã Voucher
   */
  calculateVoucherPerformance(
    vouchers: VoucherMetadataInput[],
    completedOrders: VoucherOrderInput[],
    fraudSignals: VoucherFraudSignalItem[],
  ): CalculatedVoucherPerformanceItem[] {
    const voucherMap = new Map<string, VoucherMetadataInput>();
    for (const v of vouchers) {
      voucherMap.set(v.id, v);
      if (v.code) voucherMap.set(v.code.toUpperCase(), v);
    }

    // Group orders by voucher identifier (ID or Code)
    const groupedOrders = new Map<string, VoucherOrderInput[]>();

    for (const o of completedOrders) {
      const vId = o.voucherId;
      const sId = o.shippingVoucherId;
      const vCode = o.discountVoucherCodeSnapshot?.toUpperCase();
      const sCode = o.shippingVoucherCodeSnapshot?.toUpperCase();

      const matchedKeys = new Set<string>();
      if (vId) matchedKeys.add(vId);
      if (vCode) matchedKeys.add(vCode);
      if (sId) matchedKeys.add(sId);
      if (sCode) matchedKeys.add(sCode);

      for (const k of matchedKeys) {
        if (!groupedOrders.has(k)) {
          groupedOrders.set(k, []);
        }
        groupedOrders.get(k)!.push(o);
      }
    }

    const performanceList: CalculatedVoucherPerformanceItem[] = [];

    // Duyệt qua từng voucher trong danh mục
    for (const v of vouchers) {
      const ordersForVoucher = [
        ...(groupedOrders.get(v.id) || []),
        ...(v.code ? (groupedOrders.get(v.code.toUpperCase()) || []) : []),
      ];

      // Remove duplicates for the same order
      const uniqueOrderMap = new Map<string, VoucherOrderInput>();
      for (const ord of ordersForVoucher) {
        uniqueOrderMap.set(ord.id, ord);
      }
      const uniqueOrders = Array.from(uniqueOrderMap.values());

      const userSet = new Set<string>();
      let grossRevenue = 0;
      let orderDiscountCost = 0;
      let shippingDiscountCost = 0;
      let netRevenue = 0;
      let firstOrderUses = 0;
      let returningUses = 0;

      for (const o of uniqueOrders) {
        const uKey = o.userId || o.customerPhone || o.id;
        userSet.add(uKey);

        grossRevenue += Math.round(o.subTotal || 0);
        if (o.voucherId === v.id || o.discountVoucherCodeSnapshot?.toUpperCase() === v.code.toUpperCase()) {
          orderDiscountCost += Math.round(o.discountAmount || 0);
        }
        if (o.shippingVoucherId === v.id || o.shippingVoucherCodeSnapshot?.toUpperCase() === v.code.toUpperCase()) {
          shippingDiscountCost += Math.round(o.shippingDiscount || 0);
        }
        netRevenue += Math.round(Math.max(0, (o.totalAmount || 0) - (o.shippingFee || 0)));

        if (o.userCompletedOrdersBeforeThis === 0) {
          firstOrderUses++;
        } else {
          returningUses++;
        }
      }

      const totalDiscountCost = orderDiscountCost + shippingDiscountCost;
      const completedUses = uniqueOrders.length;
      const uniqueUsers = userSet.size;
      const aov = completedUses > 0 ? Math.round(grossRevenue / completedUses) : 0;
      const revenueToDiscountRatio =
        totalDiscountCost > 0
          ? Math.round((grossRevenue / totalDiscountCost) * 100) / 100
          : 0;

      const voucherSignals = fraudSignals.filter(
        (s) => s.voucherCode.toUpperCase() === v.code.toUpperCase(),
      );

      performanceList.push({
        voucherId: v.id,
        code: v.code,
        title: v.title,
        discountType: v.discountType,
        discountValue: v.discountValue,
        maxDiscount: v.maxDiscount || null,
        minOrderValue: v.minOrderValue,
        isFirstOrderOnly: v.isFirstOrderOnly,
        usageLimit: v.usageLimit || null,
        usageLimitPerUser: v.usageLimitPerUser || null,
        completedUses,
        uniqueUsers,
        grossRevenue,
        orderDiscountCost,
        shippingDiscountCost,
        totalDiscountCost,
        netRevenue,
        aov,
        revenueToDiscountRatio,
        firstOrderUses,
        returningUses,
        abuseSignalsCount: voucherSignals.length,
        isActive: v.isActive,
      });
    }

    // Sort by gross revenue descending
    return performanceList.sort((a, b) => b.grossRevenue - a.grossRevenue);
  }

  /**
   * Phát hiện các tín hiệu bất thường / nguy cơ gian lận Voucher (Fraud Signals)
   */
  detectVoucherFraudSignals(
    completedOrders: VoucherOrderInput[],
    vouchers: VoucherMetadataInput[],
  ): VoucherFraudSignalItem[] {
    const signals: VoucherFraudSignalItem[] = [];
    const voucherCodeMap = new Map<string, VoucherMetadataInput>();
    for (const v of vouchers) {
      voucherCodeMap.set(v.code.toUpperCase(), v);
      voucherCodeMap.set(v.id, v);
    }

    // 1. Phân tích theo User & Mã Voucher để tìm vượt giới hạn perUser
    const userVoucherUsage = new Map<string, { count: number; orders: VoucherOrderInput[] }>();
    // 2. Phân tích burst redemptions (cùng sđt đặt liên tục < 15 phút)
    const phoneTimeline = new Map<string, VoucherOrderInput[]>();

    for (const o of completedOrders) {
      const vCode =
        o.discountVoucherCodeSnapshot ||
        o.shippingVoucherCodeSnapshot ||
        (o.voucherId ? voucherCodeMap.get(o.voucherId)?.code : null);

      if (!vCode) continue;

      const userIdentifier = o.userId || o.customerPhone || 'UNKNOWN';
      const key = `${userIdentifier}_${vCode.toUpperCase()}`;

      if (!userVoucherUsage.has(key)) {
        userVoucherUsage.set(key, { count: 0, orders: [] });
      }
      const entry = userVoucherUsage.get(key)!;
      entry.count++;
      entry.orders.push(o);

      if (o.customerPhone) {
        if (!phoneTimeline.has(o.customerPhone)) {
          phoneTimeline.set(o.customerPhone, []);
        }
        phoneTimeline.get(o.customerPhone)!.push(o);
      }

      // Tín hiệu: Chiết khấu voucher chiếm tỷ lệ quá lớn (> 70% giá trị đơn hàng)
      const totalDisc = (o.discountAmount || 0) + (o.shippingDiscount || 0);
      const gross = o.subTotal || 1;
      const ratio = Math.round((totalDisc / gross) * 100);
      if (ratio > 70 && totalDisc > 100000) {
        signals.push({
          id: `SIG_RATIO_${o.id}`,
          orderId: o.id,
          orderCode: o.orderCode || o.id.slice(0, 8),
          voucherCode: vCode,
          customerName: o.customerName || 'Khách vãng lai',
          customerPhone: o.customerPhone || 'Không có',
          completedAt: new Date(o.deliveredAt || o.createdAt).toISOString(),
          signalType: 'HIGH_DISCOUNT_RATIO',
          severity: ratio >= 85 ? 'HIGH' : 'MEDIUM',
          description: `Voucher giảm giá chiếm ${ratio}% giá trị đơn hàng (${totalDisc.toLocaleString('vi-VN')}₫ trên ${gross.toLocaleString('vi-VN')}₫).`,
          grossAmount: gross,
          discountAmount: totalDisc,
          discountRatioPercent: ratio,
          confirmedFraud: false,
        });
      }

      // Tín hiệu: Dùng voucher First Order nhưng không phải đơn đầu tiên
      const vMeta = voucherCodeMap.get(vCode.toUpperCase());
      if (vMeta?.isFirstOrderOnly && o.userCompletedOrdersBeforeThis && o.userCompletedOrdersBeforeThis > 0) {
        signals.push({
          id: `SIG_FIRST_${o.id}`,
          orderId: o.id,
          orderCode: o.orderCode || o.id.slice(0, 8),
          voucherCode: vCode,
          customerName: o.customerName || 'Khách hàng',
          customerPhone: o.customerPhone || 'Không có',
          completedAt: new Date(o.deliveredAt || o.createdAt).toISOString(),
          signalType: 'REPEATED_FIRST_ORDER',
          severity: 'HIGH',
          description: `Voucher dành riêng cho khách hàng mới bị áp dụng trên tài khoản đã có ${o.userCompletedOrdersBeforeThis} đơn hàng hoàn tất.`,
          grossAmount: o.subTotal,
          discountAmount: totalDisc,
          discountRatioPercent: ratio,
          confirmedFraud: false,
        });
      }
    }

    // Kiểm tra vượt giới hạn perUser
    for (const [key, val] of userVoucherUsage.entries()) {
      const parts = key.split('_');
      const vCode = parts[parts.length - 1];
      const vMeta = voucherCodeMap.get(vCode.toUpperCase());
      const maxPerUser = vMeta?.usageLimitPerUser || 1;

      if (val.count > maxPerUser) {
        const sampleOrder = val.orders[0];
        signals.push({
          id: `SIG_PER_USER_${sampleOrder.id}`,
          orderId: sampleOrder.id,
          orderCode: sampleOrder.orderCode || sampleOrder.id.slice(0, 8),
          voucherCode: vCode,
          customerName: sampleOrder.customerName || 'Khách hàng',
          customerPhone: sampleOrder.customerPhone || 'Không có',
          completedAt: new Date(sampleOrder.deliveredAt || sampleOrder.createdAt).toISOString(),
          signalType: 'EXCESSIVE_PER_USER',
          severity: val.count >= maxPerUser * 2 ? 'HIGH' : 'MEDIUM',
          description: `Khách hàng đã áp dụng voucher ${val.count} lần, vượt quá giới hạn cấu hình ${maxPerUser} lần/người.`,
          grossAmount: sampleOrder.subTotal,
          discountAmount: sampleOrder.discountAmount,
          discountRatioPercent: 0,
          confirmedFraud: false,
        });
      }
    }

    // Kiểm tra burst redemptions (< 15 phút)
    for (const [phone, orders] of phoneTimeline.entries()) {
      if (orders.length < 3) continue;
      orders.sort(
        (a, b) =>
          new Date(a.deliveredAt || a.createdAt).getTime() -
          new Date(b.deliveredAt || b.createdAt).getTime(),
      );

      for (let i = 0; i < orders.length - 2; i++) {
        const t1 = new Date(orders[i].deliveredAt || orders[i].createdAt).getTime();
        const t3 = new Date(orders[i + 2].deliveredAt || orders[i + 2].createdAt).getTime();
        const diffMinutes = (t3 - t1) / (1000 * 60);

        if (diffMinutes <= 15) {
          signals.push({
            id: `SIG_BURST_${orders[i].id}`,
            orderId: orders[i].id,
            orderCode: orders[i].orderCode || orders[i].id.slice(0, 8),
            voucherCode: orders[i].discountVoucherCodeSnapshot || 'PROMO',
            customerName: orders[i].customerName || 'Khách hàng',
            customerPhone: phone,
            completedAt: new Date(orders[i].deliveredAt || orders[i].createdAt).toISOString(),
            signalType: 'BURST_USAGE',
            severity: 'HIGH',
            description: `Số điện thoại ${phone} hoàn tất 3 đơn hàng áp dụng mã khuyến mãi chỉ trong vòng ${Math.round(diffMinutes)} phút.`,
            grossAmount: orders[i].subTotal,
            discountAmount: orders[i].discountAmount,
            discountRatioPercent: 0,
            confirmedFraud: false,
          });
          break; // Record once per burst cluster
        }
      }
    }

    return signals;
  }
}
