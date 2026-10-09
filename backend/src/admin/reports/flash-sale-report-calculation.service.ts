import { Injectable } from '@nestjs/common';

/* ==========================================================================
   FLASH SALE REPORT CALCULATION ENGINE (COMPLETED ORDERS ONLY - RECONCILIATION)
   ========================================================================== */

export interface FlashSaleOrderItemInput {
  id: string;
  orderId: string;
  orderCode: string | null;
  branchId: string;
  branchName?: string;
  productId: string;
  productName: string;
  productCategoryName?: string;
  quantity: number;
  priceAtSale: number; // Flash sale price
  originalPriceAtSale: number; // Original retail price
  isFlashSaleItem: boolean;
  flashSaleId: string | null;
  flashSaleSlotId: string | null;
  flashSaleNameSnapshot: string | null;
  flashSalePriceSnapshot: number | null;
  orderDiscountAmount: number; // Order-level discount
  deliveredAt: Date | string | null;
  createdAt: Date | string;
  customerName?: string | null;
  customerPhone?: string | null;
}

export interface FlashSaleCampaignInput {
  id: string;
  code: string | null;
  name: string;
  status: string;
  startTime: Date | string;
  endTime: Date | string;
  isActive: boolean;
  slots: Array<{
    id: string;
    name: string;
    startTime: Date | string;
    endTime: Date | string;
  }>;
  items: Array<{
    id: string;
    flashSaleSlotId: string | null;
    productId: string;
    productName?: string;
    flashSalePrice: number;
    originalPriceSnapshot: number | null;
    stock: number; // Initial stock
    reservedStock: number;
    sold: number;
    maxQuantityPerUser: number | null;
    isActive: boolean;
  }>;
}

export interface FlashSaleStockReconciliationItem {
  campaignId: string;
  campaignName: string;
  slotName: string;
  productId: string;
  productName: string;
  flashPrice: number;
  originalPrice: number;
  initialStock: number;
  systemSoldCounter: number;
  actualCompletedSoldQuantity: number;
  remainingStock: number;
  reservedStock: number;
  calculatedExpectedStock: number; // Initial - Sold
  discrepancyQuantity: number; // Discrepancy between system counter and actual completed items
  isOverselling: boolean;
  isNegativeStock: boolean;
  hasReconciliationError: boolean;
  reconciliationStatus: 'BALANCED' | 'DISCREPANCY_DETECTED' | 'OVERSELLING_ALERT' | 'NEGATIVE_STOCK_ALERT';
}

export interface CalculatedFlashSaleKPIs {
  totalActiveCampaigns: number;
  totalCompletedFlashSaleOrders: number;
  totalFlashSaleItemsSold: number;
  uniqueBuyers: number;
  grossFlashSaleRevenue: number; // Total sold at flash price
  originalValueTotal: number; // Total sold at retail price
  flashSaleDiscountCost: number; // Original - Flash Sale revenue
  netRevenue: number;
  averageFlashSaleOrderValue: number;
  totalStockAllocated: number;
  totalStockSold: number;
  totalStockRemaining: number;
  overallSellThroughRate: number; // (Sold / Allocated) * 100
  topCampaignName: string | null;
  topProductName: string | null;
  reconciliationErrorsCount: number;
  oversellingIncidentsCount: number;
  conversionRateText: string; // Transparent message for unmeasured traffic
}

export interface CalculatedCampaignPerformanceItem {
  campaignId: string;
  campaignCode: string;
  name: string;
  status: string;
  startTime: string;
  endTime: string;
  completedOrdersCount: number;
  uniqueBuyersCount: number;
  itemsSoldCount: number;
  originalValue: number;
  discountCost: number;
  revenue: number;
  sellThroughRate: number;
  totalStockAllocated: number;
  totalStockRemaining: number;
  hasStockError: boolean;
}

export interface CalculatedFlashSaleSlotItem {
  timeSlotLabel: string; // e.g. "10:00 - 12:00", "14:00 - 16:00"
  completedOrdersCount: number;
  itemsSoldCount: number;
  uniqueBuyersCount: number;
  revenue: number;
  discountCost: number;
  sellThroughRate: number;
  aov: number;
}

export interface CalculatedFlashSaleProductPerformanceItem {
  productId: string;
  productName: string;
  categoryName: string;
  campaignId: string;
  campaignName: string;
  flashPrice: number;
  originalPrice: number;
  discountPercent: number;
  initialStock: number;
  soldQuantity: number;
  remainingStock: number;
  completedOrdersCount: number;
  uniqueBuyersCount: number;
  revenue: number;
  discountCost: number;
  sellThroughRate: number;
  averageQtyPerOrder: number;
  hasStockAnomaly: boolean;
}

@Injectable()
export class FlashSaleReportCalculationService {
  /**
   * Tính toán toàn diện KPI Flash Sale từ các OrderItem thuộc đơn COMPLETED
   */
  calculateFlashSaleKPIs(
    campaigns: FlashSaleCampaignInput[],
    completedFlashSaleItems: FlashSaleOrderItemInput[],
    reconciliationItems: FlashSaleStockReconciliationItem[],
  ): CalculatedFlashSaleKPIs {
    const totalActiveCampaigns = campaigns.filter((c) => c.isActive).length;

    const uniqueOrderIds = new Set<string>();
    const uniqueUserKeys = new Set<string>();
    let totalFlashSaleItemsSold = 0;
    let grossFlashSaleRevenue = 0;
    let originalValueTotal = 0;

    const campaignRevenueMap = new Map<string, { name: string; rev: number }>();
    const productSalesMap = new Map<string, { name: string; qty: number; rev: number }>();

    for (const it of completedFlashSaleItems) {
      uniqueOrderIds.add(it.orderId);
      const uKey = it.customerPhone || it.customerName || it.orderId;
      uniqueUserKeys.add(uKey);

      const qty = it.quantity || 0;
      const flashPrice = it.priceAtSale || 0;
      const origPrice = it.originalPriceAtSale || flashPrice;

      const itemRev = Math.round(flashPrice * qty);
      const itemOrig = Math.round(origPrice * qty);

      totalFlashSaleItemsSold += qty;
      grossFlashSaleRevenue += itemRev;
      originalValueTotal += itemOrig;

      // Track by campaign
      const cId = it.flashSaleId || 'UNKNOWN';
      const cName = it.flashSaleNameSnapshot || 'Chiến dịch Flash Sale';
      if (!campaignRevenueMap.has(cId)) {
        campaignRevenueMap.set(cId, { name: cName, rev: 0 });
      }
      campaignRevenueMap.get(cId)!.rev += itemRev;

      // Track by product
      if (!productSalesMap.has(it.productId)) {
        productSalesMap.set(it.productId, { name: it.productName, qty: 0, rev: 0 });
      }
      const pEntry = productSalesMap.get(it.productId)!;
      pEntry.qty += qty;
      pEntry.rev += itemRev;
    }

    const totalCompletedFlashSaleOrders = uniqueOrderIds.size;
    const uniqueBuyers = uniqueUserKeys.size;
    const flashSaleDiscountCost = Math.max(0, originalValueTotal - grossFlashSaleRevenue);
    const netRevenue = grossFlashSaleRevenue; // Flash sale direct net contribution
    const averageFlashSaleOrderValue =
      totalCompletedFlashSaleOrders > 0
        ? Math.round(grossFlashSaleRevenue / totalCompletedFlashSaleOrders)
        : 0;

    // Stock totals from reconciliation
    let totalStockAllocated = 0;
    let totalStockSold = 0;
    let totalStockRemaining = 0;
    let oversellingIncidentsCount = 0;
    let reconciliationErrorsCount = 0;

    for (const r of reconciliationItems) {
      totalStockAllocated += r.initialStock;
      totalStockSold += r.actualCompletedSoldQuantity;
      totalStockRemaining += r.remainingStock;
      if (r.isOverselling) oversellingIncidentsCount++;
      if (r.hasReconciliationError) reconciliationErrorsCount++;
    }

    const overallSellThroughRate =
      totalStockAllocated > 0
        ? Math.round((totalStockSold / totalStockAllocated) * 1000) / 10
        : 0;

    // Top campaign & product
    let topCampaignName: string | null = null;
    let maxCampRev = -1;
    for (const entry of campaignRevenueMap.values()) {
      if (entry.rev > maxCampRev) {
        maxCampRev = entry.rev;
        topCampaignName = entry.name;
      }
    }

    let topProductName: string | null = null;
    let maxProdQty = -1;
    for (const entry of productSalesMap.values()) {
      if (entry.qty > maxProdQty) {
        maxProdQty = entry.qty;
        topProductName = entry.name;
      }
    }

    return {
      totalActiveCampaigns,
      totalCompletedFlashSaleOrders,
      totalFlashSaleItemsSold,
      uniqueBuyers,
      grossFlashSaleRevenue,
      originalValueTotal,
      flashSaleDiscountCost,
      netRevenue,
      averageFlashSaleOrderValue,
      totalStockAllocated,
      totalStockSold,
      totalStockRemaining,
      overallSellThroughRate,
      topCampaignName,
      topProductName,
      reconciliationErrorsCount,
      oversellingIncidentsCount,
      conversionRateText: 'Chưa khả dụng (Cần bổ sung event tracking impression & campaign views)',
    };
  }

  /**
   * Đối soát kho hàng Flash Sale chi tiết từng món (Stock Reconciliation)
   */
  reconcileFlashSaleStock(
    campaigns: FlashSaleCampaignInput[],
    completedItems: FlashSaleOrderItemInput[],
  ): FlashSaleStockReconciliationItem[] {
    // Map completed items sold count by `campaignId_productId`
    const actualSoldMap = new Map<string, number>();
    for (const it of completedItems) {
      const key = `${it.flashSaleId}_${it.productId}`;
      actualSoldMap.set(key, (actualSoldMap.get(key) || 0) + it.quantity);
    }

    const reconciliationList: FlashSaleStockReconciliationItem[] = [];

    for (const c of campaigns) {
      const slotMap = new Map<string, string>();
      for (const s of c.slots || []) {
        slotMap.set(s.id, s.name);
      }

      for (const item of c.items || []) {
        const key = `${c.id}_${item.productId}`;
        const actualSold = actualSoldMap.get(key) || 0;
        const initial = item.stock || 0;
        const remaining = initial - (item.sold || 0);
        const reserved = item.reservedStock || 0;
        const systemSold = item.sold || 0;

        const isOverselling = actualSold > initial || systemSold > initial;
        const isNegativeStock = remaining < 0;
        const hasDiscrepancy = Math.abs(systemSold - actualSold) > 0;
        const hasReconciliationError = isOverselling || isNegativeStock || hasDiscrepancy;

        let status: 'BALANCED' | 'DISCREPANCY_DETECTED' | 'OVERSELLING_ALERT' | 'NEGATIVE_STOCK_ALERT' =
          'BALANCED';
        if (isNegativeStock) status = 'NEGATIVE_STOCK_ALERT';
        else if (isOverselling) status = 'OVERSELLING_ALERT';
        else if (hasDiscrepancy) status = 'DISCREPANCY_DETECTED';

        reconciliationList.push({
          campaignId: c.id,
          campaignName: c.name,
          slotName: (item.flashSaleSlotId && slotMap.get(item.flashSaleSlotId)) || 'Toàn thời gian',
          productId: item.productId,
          productName: item.productName || 'Sản phẩm Flash Sale',
          flashPrice: item.flashSalePrice,
          originalPrice: item.originalPriceSnapshot || item.flashSalePrice,
          initialStock: initial,
          systemSoldCounter: systemSold,
          actualCompletedSoldQuantity: actualSold,
          remainingStock: remaining,
          reservedStock: reserved,
          calculatedExpectedStock: Math.max(0, initial - actualSold),
          discrepancyQuantity: actualSold - systemSold,
          isOverselling,
          isNegativeStock,
          hasReconciliationError,
          reconciliationStatus: status,
        });
      }
    }

    return reconciliationList;
  }

  /**
   * Tính hiệu suất theo từng chiến dịch Flash Sale (Campaign Performance)
   */
  calculateCampaignPerformance(
    campaigns: FlashSaleCampaignInput[],
    completedItems: FlashSaleOrderItemInput[],
    reconciliationItems: FlashSaleStockReconciliationItem[],
  ): CalculatedCampaignPerformanceItem[] {
    const campaignItemsMap = new Map<string, FlashSaleOrderItemInput[]>();
    for (const it of completedItems) {
      const cId = it.flashSaleId || 'UNKNOWN';
      if (!campaignItemsMap.has(cId)) {
        campaignItemsMap.set(cId, []);
      }
      campaignItemsMap.get(cId)!.push(it);
    }

    const campaignReconMap = new Map<string, FlashSaleStockReconciliationItem[]>();
    for (const r of reconciliationItems) {
      if (!campaignReconMap.has(r.campaignId)) {
        campaignReconMap.set(r.campaignId, []);
      }
      campaignReconMap.get(r.campaignId)!.push(r);
    }

    const results: CalculatedCampaignPerformanceItem[] = [];

    for (const c of campaigns) {
      const cItems = campaignItemsMap.get(c.id) || [];
      const cRecon = campaignReconMap.get(c.id) || [];

      const ordersSet = new Set<string>();
      const buyersSet = new Set<string>();
      let itemsSoldCount = 0;
      let revenue = 0;
      let originalValue = 0;

      for (const it of cItems) {
        ordersSet.add(it.orderId);
        buyersSet.add(it.customerPhone || it.customerName || it.orderId);
        itemsSoldCount += it.quantity;
        revenue += Math.round(it.priceAtSale * it.quantity);
        originalValue += Math.round((it.originalPriceAtSale || it.priceAtSale) * it.quantity);
      }

      let totalStockAllocated = 0;
      let totalStockRemaining = 0;
      let hasStockError = false;

      for (const r of cRecon) {
        totalStockAllocated += r.initialStock;
        totalStockRemaining += r.remainingStock;
        if (r.hasReconciliationError) hasStockError = true;
      }

      const discountCost = Math.max(0, originalValue - revenue);
      const sellThroughRate =
        totalStockAllocated > 0
          ? Math.round((itemsSoldCount / totalStockAllocated) * 1000) / 10
          : 0;

      results.push({
        campaignId: c.id,
        campaignCode: c.code || c.id.slice(0, 8).toUpperCase(),
        name: c.name,
        status: c.status,
        startTime: new Date(c.startTime).toISOString(),
        endTime: new Date(c.endTime).toISOString(),
        completedOrdersCount: ordersSet.size,
        uniqueBuyersCount: buyersSet.size,
        itemsSoldCount,
        originalValue,
        discountCost,
        revenue,
        sellThroughRate,
        totalStockAllocated,
        totalStockRemaining,
        hasStockError,
      });
    }

    return results.sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Phân tích theo khung giờ Flash Sale (Time Slot Analysis)
   */
  calculateTimeSlotAnalysis(
    completedItems: FlashSaleOrderItemInput[],
  ): CalculatedFlashSaleSlotItem[] {
    const slotBuckets = new Map<
      string,
      { orders: Set<string>; buyers: Set<string>; qty: number; rev: number; orig: number }
    >();

    // Chuẩn hóa 6 khung giờ phổ biến trong ngày của nhà hàng
    const BUCKET_LABELS = [
      '06:00 - 09:00 (Sáng sớm)',
      '09:00 - 11:30 (Trưa sớm)',
      '11:30 - 14:00 (Giờ vàng Trưa)',
      '14:00 - 17:00 (Xế chiều)',
      '17:00 - 20:30 (Giờ vàng Tối)',
      '20:30 - 23:59 (Đêm muộn)',
    ];

    for (const label of BUCKET_LABELS) {
      slotBuckets.set(label, {
        orders: new Set(),
        buyers: new Set(),
        qty: 0,
        rev: 0,
        orig: 0,
      });
    }

    for (const it of completedItems) {
      const orderDate = new Date(it.deliveredAt || it.createdAt);
      const hour = orderDate.getHours();
      const minute = orderDate.getMinutes();
      const timeInMinutes = hour * 60 + minute;

      let bucketLabel = BUCKET_LABELS[5]; // Default đêm muộn
      if (timeInMinutes >= 360 && timeInMinutes < 540) bucketLabel = BUCKET_LABELS[0];
      else if (timeInMinutes >= 540 && timeInMinutes < 690) bucketLabel = BUCKET_LABELS[1];
      else if (timeInMinutes >= 690 && timeInMinutes < 840) bucketLabel = BUCKET_LABELS[2];
      else if (timeInMinutes >= 840 && timeInMinutes < 1020) bucketLabel = BUCKET_LABELS[3];
      else if (timeInMinutes >= 1020 && timeInMinutes < 1230) bucketLabel = BUCKET_LABELS[4];

      const bucket = slotBuckets.get(bucketLabel)!;
      bucket.orders.add(it.orderId);
      bucket.buyers.add(it.customerPhone || it.customerName || it.orderId);
      bucket.qty += it.quantity;
      bucket.rev += Math.round(it.priceAtSale * it.quantity);
      bucket.orig += Math.round((it.originalPriceAtSale || it.priceAtSale) * it.quantity);
    }

    const results: CalculatedFlashSaleSlotItem[] = [];
    let totalItemsAllSlots = 0;
    for (const b of slotBuckets.values()) {
      totalItemsAllSlots += b.qty;
    }

    for (const [label, b] of slotBuckets.entries()) {
      const ordersCount = b.orders.size;
      const aov = ordersCount > 0 ? Math.round(b.rev / ordersCount) : 0;
      const discountCost = Math.max(0, b.orig - b.rev);
      const slotShare =
        totalItemsAllSlots > 0 ? Math.round((b.qty / totalItemsAllSlots) * 1000) / 10 : 0;

      results.push({
        timeSlotLabel: label,
        completedOrdersCount: ordersCount,
        itemsSoldCount: b.qty,
        uniqueBuyersCount: b.buyers.size,
        revenue: b.rev,
        discountCost,
        sellThroughRate: slotShare, // Tỷ trọng bán trong ngày
        aov,
      });
    }

    return results;
  }

  /**
   * Phân tích chi tiết hiệu suất từng món Flash Sale (Product Performance)
   */
  calculateProductPerformance(
    reconciliationItems: FlashSaleStockReconciliationItem[],
    completedItems: FlashSaleOrderItemInput[],
  ): CalculatedFlashSaleProductPerformanceItem[] {
    const productSalesMap = new Map<
      string,
      { orders: Set<string>; buyers: Set<string>; qty: number; rev: number; orig: number; cat: string }
    >();

    for (const it of completedItems) {
      const key = `${it.flashSaleId}_${it.productId}`;
      if (!productSalesMap.has(key)) {
        productSalesMap.set(key, {
          orders: new Set(),
          buyers: new Set(),
          qty: 0,
          rev: 0,
          orig: 0,
          cat: it.productCategoryName || 'Khác',
        });
      }
      const entry = productSalesMap.get(key)!;
      entry.orders.add(it.orderId);
      entry.buyers.add(it.customerPhone || it.customerName || it.orderId);
      entry.qty += it.quantity;
      entry.rev += Math.round(it.priceAtSale * it.quantity);
      entry.orig += Math.round((it.originalPriceAtSale || it.priceAtSale) * it.quantity);
    }

    const results: CalculatedFlashSaleProductPerformanceItem[] = [];

    for (const r of reconciliationItems) {
      const key = `${r.campaignId}_${r.productId}`;
      const sales = productSalesMap.get(key) || {
        orders: new Set(),
        buyers: new Set(),
        qty: 0,
        rev: 0,
        orig: 0,
        cat: 'Món ăn',
      };

      const discountCost = Math.max(0, sales.orig - sales.rev);
      const ordersCount = sales.orders.size;
      const avgQty = ordersCount > 0 ? Math.round((sales.qty / ordersCount) * 10) / 10 : 0;
      const discountPercent =
        r.originalPrice > 0
          ? Math.round(((r.originalPrice - r.flashPrice) / r.originalPrice) * 100)
          : 0;
      const sellThrough =
        r.initialStock > 0 ? Math.round((sales.qty / r.initialStock) * 1000) / 10 : 0;

      results.push({
        productId: r.productId,
        productName: r.productName,
        categoryName: sales.cat,
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        flashPrice: r.flashPrice,
        originalPrice: r.originalPrice,
        discountPercent,
        initialStock: r.initialStock,
        soldQuantity: sales.qty,
        remainingStock: r.remainingStock,
        completedOrdersCount: ordersCount,
        uniqueBuyersCount: sales.buyers.size,
        revenue: sales.rev,
        discountCost,
        sellThroughRate: sellThrough,
        averageQtyPerOrder: avgQty,
        hasStockAnomaly: r.hasReconciliationError,
      });
    }

    return results.sort((a, b) => b.revenue - a.revenue);
  }
}
