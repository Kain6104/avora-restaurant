import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryTransactionType } from '@prisma/client';

@Injectable()
export class FoodCostCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Báo cáo Định giá Tồn kho hiện tại (Inventory Valuation Report)
   */
  async getInventoryValuation(branchId?: string) {
    const whereWh: any = {};
    if (branchId) {
      whereWh.OR = [{ branchId }, { isCentral: true }];
    }

    const warehouses = await this.prisma.warehouse.findMany({
      where: whereWh,
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        balances: {
          include: {
            ingredient: {
              include: { category: true, primaryUnit: true },
            },
          },
        },
      },
    });

    let totalInventoryValue = 0;
    let totalItems = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const branchSummary = new Map<string, { branchName: string; totalValue: number; itemCount: number }>();
    const categorySummary = new Map<string, { categoryName: string; totalValue: number; itemCount: number }>();

    for (const wh of warehouses) {
      const bKey = wh.branch?.name || 'Tổng kho Trung tâm';
      if (!branchSummary.has(bKey)) {
        branchSummary.set(bKey, { branchName: bKey, totalValue: 0, itemCount: 0 });
      }

      for (const bal of wh.balances) {
        const val = Number(bal.valuation);
        const curr = Number(bal.currentStock);
        const min = Number(bal.ingredient.minimumStock);

        totalInventoryValue += val;
        totalItems++;

        if (curr <= 0) outOfStockCount++;
        else if (curr <= min) lowStockCount++;

        // Theo chi nhánh
        const bEntry = branchSummary.get(bKey)!;
        bEntry.totalValue += val;
        bEntry.itemCount++;

        // Theo danh mục
        const catName = bal.ingredient.category.name;
        if (!categorySummary.has(catName)) {
          categorySummary.set(catName, { categoryName: catName, totalValue: 0, itemCount: 0 });
        }
        const cEntry = categorySummary.get(catName)!;
        cEntry.totalValue += val;
        cEntry.itemCount++;
      }
    }

    return {
      kpis: {
        totalInventoryValue: Math.round(totalInventoryValue),
        totalItems,
        lowStockCount,
        outOfStockCount,
      },
      byBranch: Array.from(branchSummary.values()),
      byCategory: Array.from(categorySummary.values()),
      warehouses: warehouses.map((w) => ({
        id: w.id,
        code: w.code,
        name: w.name,
        branchName: w.branch?.name || 'Trung tâm',
        totalValue: Math.round(w.balances.reduce((s, b) => s + Number(b.valuation), 0)),
        itemCount: w.balances.length,
      })),
    };
  }

  /**
   * 2. Báo cáo Food Cost & Tỷ suất Lợi nhuận gộp (Food Cost & Gross Margin Intelligence)
   */
  async getFoodCostReport(params: { branchId?: string; startDate?: string; endDate?: string }) {
    const { branchId, startDate, endDate } = params;

    const orderWhere: any = {
      status: 'COMPLETED',
    };
    if (branchId) orderWhere.branchId = branchId;

    if (startDate || endDate) {
      orderWhere.completedAt = {};
      if (startDate) orderWhere.completedAt.gte = new Date(startDate);
      if (endDate) orderWhere.completedAt.lte = new Date(endDate);
    }

    // Lấy toàn bộ đơn hoàn tất trong kỳ (bao gồm đơn đã hoàn tiền để bóc tách doanh thu vs giá vốn thực tế)
    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      include: {
        orderItems: {
          include: {
            product: { select: { id: true, name: true, categoryId: true } },
          },
        },
      },
    });

    let totalGrossSales = 0;
    let totalDiscounts = 0;
    let totalVatExcluded = 0;
    let totalShippingExcluded = 0;
    let totalServiceChargeExcluded = 0;
    let refundedRevenueExcluded = 0;
    let totalNetFoodSales = 0;
    let theoreticalCOGS = 0;
    let buffetIncludedCost = 0;
    let loyaltyRedemptionCost = 0;
    let zeroPriceItemCount = 0;
    let totalOrderItemCount = 0;
    let missingCostSnapshotItemCount = 0;

    for (const order of orders as any[]) {
      const subTotal = Number(order.subTotal ?? order.totalAmount ?? 0);
      const discount = Number(order.discountAmount ?? 0);
      const vatAmount = Number(order.taxAmount ?? 0);
      const serviceCharge = Number(order.serviceChargeTotal ?? 0);
      const shippingNet = Math.max(0, Number(order.shippingFee ?? 0) - Number(order.shippingDiscount ?? 0));
      const vatMode = order.vatPriceModeSnapshot || 'VAT_INCLUDED';

      const netItemsBeforeVat =
        vatMode === 'VAT_EXCLUDED'
          ? Math.max(0, subTotal - discount)
          : Math.max(0, subTotal - discount - vatAmount);

      totalGrossSales += subTotal;
      totalDiscounts += discount;
      totalVatExcluded += vatAmount;
      totalShippingExcluded += shippingNet;
      totalServiceChargeExcluded += serviceCharge;

      if (order.paymentStatus === 'REFUNDED' || order.status === 'CANCELLED') {
        refundedRevenueExcluded += netItemsBeforeVat;
      } else {
        totalNetFoodSales += netItemsBeforeVat;
      }

      for (const item of order.orderItems || []) {
        totalOrderItemCount++;
        const snapCost = Number(item.costPriceSnapshot || 0);
        if (!item.costPriceSnapshot || snapCost === 0) {
          missingCostSnapshotItemCount++;
        }
        theoreticalCOGS += snapCost;
        if (Number(item.priceAtSale || 0) === 0) {
          zeroPriceItemCount++;
        }
        if (item.pricingMode === 'BUFFET_INCLUDED') {
          buffetIncludedCost += snapCost;
        }
        if (item.isPointRedemption) {
          loyaltyRedemptionCost += snapCost;
        }
      }
    }

    // Lấy chi phí thực tế tiêu hao (Actual COGS) từ Sổ cái kho (Không xóa kể cả khi đơn hoàn tiền)
    const txWhere: any = {
      type: InventoryTransactionType.RECIPE_CONSUMPTION,
    };
    if (branchId) txWhere.branchId = branchId;
    if (startDate || endDate) {
      txWhere.createdAt = {};
      if (startDate) txWhere.createdAt.gte = new Date(startDate);
      if (endDate) txWhere.createdAt.lte = new Date(endDate);
    }

    const consumptionTxs = await this.prisma.inventoryTransaction.aggregate({
      where: txWhere,
      _sum: { totalCost: true },
    });
    const actualConsumptionCost = Number(consumptionTxs._sum.totalCost || 0);

    // Lấy chi phí hao hụt & hủy hàng (Waste & Spoilage)
    const wasteWhere: any = {};
    if (branchId) wasteWhere.branchId = branchId;
    if (startDate || endDate) {
      wasteWhere.createdAt = {};
      if (startDate) wasteWhere.createdAt.gte = new Date(startDate);
      if (endDate) wasteWhere.createdAt.lte = new Date(endDate);
    }

    const wasteAgg = await this.prisma.inventoryWaste.aggregate({
      where: wasteWhere,
      _sum: { totalLossValue: true },
    });
    const totalWasteCost = Number(wasteAgg._sum.totalLossValue || 0);

    const actualTotalCOGS = actualConsumptionCost + totalWasteCost;
    const grossProfit = totalNetFoodSales - actualTotalCOGS;
    const actualFoodCostPercent =
      totalNetFoodSales > 0 ? (actualTotalCOGS / totalNetFoodSales) * 100 : 0;
    const theoreticalFoodCostPercent =
      totalNetFoodSales > 0 ? (theoreticalCOGS / totalNetFoodSales) * 100 : 0;
    const varianceCOGS = actualTotalCOGS - theoreticalCOGS;

    return {
      financialKpis: {
        totalGrossFoodSales: Math.round(totalGrossSales),
        totalDiscounts: Math.round(totalDiscounts),
        totalNetFoodSales: Math.round(totalNetFoodSales),
        actualCOGS: Math.round(actualTotalCOGS),
        actualConsumptionCost: Math.round(actualConsumptionCost),
        totalWasteCost: Math.round(totalWasteCost),
        theoreticalCOGS: Math.round(theoreticalCOGS),
        varianceCOGS: Math.round(varianceCOGS),
        grossProfit: Math.round(grossProfit),
        actualFoodCostPercent: Number(actualFoodCostPercent.toFixed(2)),
        theoreticalFoodCostPercent: Number(theoreticalFoodCostPercent.toFixed(2)),
        grossMarginPercent: Number(
          (totalNetFoodSales > 0 ? (grossProfit / totalNetFoodSales) * 100 : 0).toFixed(2),
        ),
      },
      certificationBreakdown: {
        denominatorDefinition: 'Net Food Sales (Ex-VAT, Ex-Shipping, Ex-ServiceCharge, Net of Discounts & Refunds)',
        vatExcludedAmount: Math.round(totalVatExcluded),
        shippingFeeExcluded: Math.round(totalShippingExcluded),
        serviceChargeExcluded: Math.round(totalServiceChargeExcluded),
        refundedRevenueExcluded: Math.round(refundedRevenueExcluded),
        buffetIncludedCost: Math.round(buffetIncludedCost),
        loyaltyRedemptionCost: Math.round(loyaltyRedemptionCost),
        zeroPriceItemCount,
        totalOrderItemCount,
        missingCostSnapshotItemCount,
        historicalCostCompleteness:
          totalOrderItemCount === 0
            ? 'NO_ORDERS'
            : missingCostSnapshotItemCount > 0
            ? 'INCOMPLETE_MISSING_HISTORICAL_SNAPSHOTS'
            : 'COMPLETE',
      },
      orderCount: orders.length,
    };
  }

  /**
   * 3. Cảnh báo Hạn sử dụng (FEFO Expiration Alert)
   */
  async getExpirationAlerts(branchId?: string) {
    const now = new Date();
    const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const where: any = {
      status: 'ACTIVE',
      remainingQuantity: { gt: 0 },
    };
    if (branchId) {
      where.warehouse = { branchId };
    }

    const batches = await this.prisma.ingredientBatch.findMany({
      where,
      include: {
        ingredient: { select: { id: true, code: true, name: true, storageCondition: true } },
        warehouse: { select: { id: true, name: true, branch: { select: { name: true } } } },
        supplier: { select: { name: true } },
      },
      orderBy: { expirationDate: 'asc' },
    });

    const expired: any[] = [];
    const expiringIn1Day: any[] = [];
    const expiringIn3Days: any[] = [];
    const expiringIn7Days: any[] = [];

    for (const b of batches) {
      const exp = b.expirationDate;
      if (exp < now) {
        expired.push(b);
      } else if (exp <= in1Day) {
        expiringIn1Day.push(b);
      } else if (exp <= in3Days) {
        expiringIn3Days.push(b);
      } else if (exp <= in7Days) {
        expiringIn7Days.push(b);
      }
    }

    return {
      summary: {
        expiredCount: expired.length,
        expiringIn1DayCount: expiringIn1Day.length,
        expiringIn3DaysCount: expiringIn3Days.length,
        expiringIn7DaysCount: expiringIn7Days.length,
      },
      expired,
      expiringIn1Day,
      expiringIn3Days,
      expiringIn7Days,
    };
  }
}
