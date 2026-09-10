import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PricingItemInput {
  productId?: string;
  name?: string;
  priceAtSale: number;
  originalPriceAtSale?: number;
  quantity: number;
  taxPercentage?: number;
  pricingMode?: 'REGULAR' | 'BUFFET_TICKET' | 'BUFFET_INCLUDED';
  buffetSessionId?: string | null;
}

export interface PricingServiceChargeInput {
  name: string;
  amount: number;
  note?: string | null;
  isTaxable?: boolean;
  taxPercentage?: number | null;
}

export interface CalculateOrderPricingParams {
  items: PricingItemInput[];
  orderDiscountAmount?: number;
  serviceCharges?: PricingServiceChargeInput[];
  shippingFee?: number;
  shippingDiscount?: number;
  pointsDiscount?: number;
  freeShippingThresholdOverride?: number;
  freeShippingEnabledOverride?: boolean;
}

export interface TaxGroupItem {
  name: string;
  quantity: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface TaxRateGroup {
  rate: number;
  taxableAmount: number;
  taxAmount: number;
  items: TaxGroupItem[];
}

export interface ItemTaxDetail {
  productId?: string;
  name?: string;
  quantity: number;
  priceAtSale: number;
  grossLineTotal: number;
  allocatedDiscount: number;
  netTaxableAmount: number;
  taxPercentage: number;
  taxAmount: number;
  vatPriceMode?: 'VAT_INCLUDED' | 'VAT_EXCLUDED';
  isVatInclusive?: boolean;
}

export interface OrderPricingBreakdown {
  subTotal: number;
  discountAmount: number;
  serviceChargeTotal: number;
  taxAmount: number;
  vatPriceMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED';
  taxBreakdown: TaxRateGroup[];
  itemTaxDetails: ItemTaxDetail[];

  shippingFee: number;
  shippingFeeOriginal: number;
  shippingDiscount: number;
  payableShipping: number;
  shippingFeeFinal: number;
  shippingDiscountSource: 'NONE' | 'ORDER_THRESHOLD' | 'VOUCHER' | 'ORDER_THRESHOLD_AND_VOUCHER';

  freeShippingQualified: boolean;
  freeShippingThreshold: number;
  freeShippingEligibleAmount: number;
  freeShippingRemainingAmount: number;

  pointsDiscount: number;
  totalAmount: number;
}

@Injectable()
export class OrderPricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy cấu hình VAT toàn hệ thống từ SystemSetting
   * Giá trị chuẩn: 'INCLUDED' hoặc 'EXCLUDED' (hỗ trợ legacy: 'VAT_INCLUDED', 'VAT_EXCLUDED')
   */
  async getGlobalVatPriceMode(): Promise<'VAT_INCLUDED' | 'VAT_EXCLUDED'> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'vat_price_mode' },
      });
      const val = (setting?.value || '').toUpperCase();
      if (val === 'EXCLUDED' || val === 'VAT_EXCLUDED') {
        return 'VAT_EXCLUDED';
      }
      return 'VAT_INCLUDED';
    } catch {
      return 'VAT_INCLUDED';
    }
  }

  /**
   * Lấy cấu hình miễn phí vận chuyển theo giá trị đơn hàng
   */
  async getFreeShippingSettings(): Promise<{ enabled: boolean; threshold: number }> {
    try {
      const [thresholdSetting, minFreeSetting, enabledSetting] = await Promise.all([
        this.prisma.systemSetting.findUnique({ where: { key: 'free_shipping_threshold' } }),
        this.prisma.systemSetting.findUnique({ where: { key: 'delivery_min_free' } }),
        this.prisma.systemSetting.findUnique({ where: { key: 'free_shipping_enabled' } }),
      ]);

      const thresholdVal = Number(thresholdSetting?.value || minFreeSetting?.value || 500000);
      const enabledVal = enabledSetting?.value !== 'false';

      return {
        enabled: enabledVal,
        threshold: Math.max(0, thresholdVal),
      };
    } catch {
      return { enabled: true, threshold: 500000 };
    }
  }

  /**
   * Tính toán toàn bộ tài chính đơn hàng (Single Source of Truth cho Online & POS)
   */
  async calculatePricing(params: CalculateOrderPricingParams): Promise<OrderPricingBreakdown> {
    const [vatPriceMode, freeShippingSettings] = await Promise.all([
      this.getGlobalVatPriceMode(),
      this.getFreeShippingSettings(),
    ]);

    return this.calculatePricingWithMode(
      params,
      vatPriceMode,
      freeShippingSettings.threshold,
      freeShippingSettings.enabled,
    );
  }

  /**
   * Hàm tính toán đồng bộ nhận vatPriceMode và freeship settings đã biết
   */
  calculatePricingWithMode(
    params: CalculateOrderPricingParams,
    vatPriceMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED',
    freeShippingThreshold: number = 500000,
    freeShippingEnabled: boolean = true,
  ): OrderPricingBreakdown {
    const {
      items = [],
      orderDiscountAmount = 0,
      serviceCharges = [],
      shippingFee = 0,
      shippingDiscount = 0,
      pointsDiscount = 0,
      freeShippingThresholdOverride,
      freeShippingEnabledOverride,
    } = params;

    const finalThreshold = freeShippingThresholdOverride !== undefined ? freeShippingThresholdOverride : freeShippingThreshold;
    const finalFreeshipEnabled = freeShippingEnabledOverride !== undefined ? freeShippingEnabledOverride : freeShippingEnabled;

    // 1. Tính Subtotal món ăn
    let subTotal = 0;
    const rawLines = items.map((item, idx) => {
      const unitPrice = Math.max(0, Math.round(Number(item.priceAtSale || 0)));
      const qty = Math.max(1, Math.floor(Number(item.quantity || 1)));
      const grossLineTotal = Math.round(unitPrice * qty);
      subTotal += grossLineTotal;

      return {
        idx,
        productId: item.productId,
        name: item.name || `Món #${idx + 1}`,
        quantity: qty,
        priceAtSale: unitPrice,
        grossLineTotal,
        taxPercentage: Math.max(0, Number(item.taxPercentage || 0)),
      };
    });

    subTotal = Math.round(subTotal);
    const normalizedOrderDiscount = Math.min(subTotal, Math.max(0, Math.round(Number(orderDiscountAmount || 0))));

    // 2. Phân bổ Voucher Discount vào từng dòng theo tỷ trọng (Rule #12)
    let remainingDiscountToAllocate = normalizedOrderDiscount;
    const allocatedDiscounts: number[] = new Array(rawLines.length).fill(0);

    if (subTotal > 0 && normalizedOrderDiscount > 0) {
      rawLines.forEach((line, i) => {
        if (i === rawLines.length - 1) {
          allocatedDiscounts[i] = remainingDiscountToAllocate;
        } else {
          const share = Math.round((normalizedOrderDiscount * line.grossLineTotal) / subTotal);
          allocatedDiscounts[i] = Math.min(share, remainingDiscountToAllocate);
          remainingDiscountToAllocate -= allocatedDiscounts[i];
        }
      });
    }

    // 3. Tính thuế VAT từng dòng sản phẩm (Rule #5, #6, #7, #8)
    const itemTaxDetails: ItemTaxDetail[] = [];
    const taxGroupMap = new Map<number, { taxableAmount: number; taxAmount: number; items: TaxGroupItem[] }>();

    let itemsTaxTotal = 0;

    rawLines.forEach((line, i) => {
      const lineDiscount = allocatedDiscounts[i] || 0;
      const netTaxableAmount = Math.max(0, line.grossLineTotal - lineDiscount);
      const taxRate = line.taxPercentage;

      let taxVal = 0;
      let baseVal = netTaxableAmount;

      if (taxRate > 0 && netTaxableAmount > 0) {
        if (vatPriceMode === 'VAT_INCLUDED') {
          // Công thức INCLUDED: Tax = Gross * Rate / (100 + Rate)
          taxVal = Math.round((netTaxableAmount * taxRate) / (100 + taxRate));
          baseVal = netTaxableAmount - taxVal;
        } else {
          // Công thức EXCLUDED: Tax = Base * Rate / 100
          taxVal = Math.round((netTaxableAmount * taxRate) / 100);
          baseVal = netTaxableAmount;
        }
      }

      itemsTaxTotal += taxVal;

      itemTaxDetails.push({
        productId: line.productId,
        name: line.name,
        quantity: line.quantity,
        priceAtSale: line.priceAtSale,
        grossLineTotal: line.grossLineTotal,
        allocatedDiscount: lineDiscount,
        netTaxableAmount: baseVal,
        taxPercentage: taxRate,
        taxAmount: taxVal,
        vatPriceMode,
        isVatInclusive: vatPriceMode === 'VAT_INCLUDED',
      });

      // Nhóm theo thuế suất
      if (!taxGroupMap.has(taxRate)) {
        taxGroupMap.set(taxRate, { taxableAmount: 0, taxAmount: 0, items: [] });
      }
      const group = taxGroupMap.get(taxRate)!;
      group.taxableAmount += baseVal;
      group.taxAmount += taxVal;
      group.items.push({
        name: line.name,
        quantity: line.quantity,
        taxableAmount: baseVal,
        taxAmount: taxVal,
      });
    });

    // 4. Phụ thu / Phí dịch vụ (Service Charges cho POS - Rule #3, #31)
    let serviceChargeTotal = 0;
    let serviceChargesTaxTotal = 0;

    for (const sc of serviceCharges) {
      const scAmount = Math.max(0, Math.round(Number(sc.amount || 0)));
      serviceChargeTotal += scAmount;

      if (sc.isTaxable) {
        const scTaxRate = Math.max(0, Number(sc.taxPercentage ?? 10));
        let scTaxVal = 0;
        let scBaseVal = scAmount;

        if (scTaxRate > 0 && scAmount > 0) {
          if (vatPriceMode === 'VAT_INCLUDED') {
            scTaxVal = Math.round((scAmount * scTaxRate) / (100 + scTaxRate));
            scBaseVal = scAmount - scTaxVal;
          } else {
            scTaxVal = Math.round((scAmount * scTaxRate) / 100);
            scBaseVal = scAmount;
          }
        }

        serviceChargesTaxTotal += scTaxVal;

        if (!taxGroupMap.has(scTaxRate)) {
          taxGroupMap.set(scTaxRate, { taxableAmount: 0, taxAmount: 0, items: [] });
        }
        const group = taxGroupMap.get(scTaxRate)!;
        group.taxableAmount += scBaseVal;
        group.taxAmount += scTaxVal;
        group.items.push({
          name: `Phụ thu: ${sc.name}`,
          quantity: 1,
          taxableAmount: scBaseVal,
          taxAmount: scTaxVal,
        });
      }
    }

    const taxAmount = itemsTaxTotal + serviceChargesTaxTotal;

    const taxBreakdown: TaxRateGroup[] = Array.from(taxGroupMap.entries())
      .map(([rate, g]) => ({
        rate,
        taxableAmount: Math.round(g.taxableAmount),
        taxAmount: Math.round(g.taxAmount),
        items: g.items,
      }))
      .sort((a, b) => a.rate - b.rate);

    // 5. Miễn phí vận chuyển theo giá trị đơn hàng (Free Shipping Threshold - Rule #20-27)
    const normalizedShippingFee = Math.max(0, Math.round(Number(shippingFee || 0)));
    const freeShippingEligibleAmount = Math.max(0, subTotal - normalizedOrderDiscount);

    let freeShippingQualified = false;
    let freeShippingRemainingAmount = 0;

    if (finalFreeshipEnabled && finalThreshold > 0) {
      freeShippingRemainingAmount = Math.max(0, finalThreshold - freeShippingEligibleAmount);
      freeShippingQualified = freeShippingEligibleAmount >= finalThreshold;
    }

    let finalShippingDiscount = 0;
    let shippingDiscountSource: 'NONE' | 'ORDER_THRESHOLD' | 'VOUCHER' | 'ORDER_THRESHOLD_AND_VOUCHER' = 'NONE';

    const voucherShippingDiscount = Math.min(
      normalizedShippingFee,
      Math.max(0, Math.round(Number(shippingDiscount || 0))),
    );

    if (freeShippingQualified && normalizedShippingFee > 0) {
      // Đạt ngưỡng freeship tự động
      finalShippingDiscount = normalizedShippingFee;
      shippingDiscountSource = voucherShippingDiscount > 0 ? 'ORDER_THRESHOLD_AND_VOUCHER' : 'ORDER_THRESHOLD';
    } else if (voucherShippingDiscount > 0) {
      // Giảm giá vận chuyển từ Voucher
      finalShippingDiscount = voucherShippingDiscount;
      shippingDiscountSource = 'VOUCHER';
    }

    const payableShipping = Math.max(0, normalizedShippingFee - finalShippingDiscount);

    // 6. Điểm thưởng loyalty
    const normalizedPointsDiscount = Math.max(0, Math.round(Number(pointsDiscount || 0)));

    // 7. Tổng thanh toán thực tế (Grand Total)
    let totalAmount = 0;
    if (vatPriceMode === 'VAT_EXCLUDED') {
      // Chưa bao gồm thuế -> Cộng thêm taxAmount vào tổng
      totalAmount = Math.max(
        0,
        subTotal - normalizedOrderDiscount + serviceChargeTotal + taxAmount - normalizedPointsDiscount,
      ) + payableShipping;
    } else {
      // Đã bao gồm thuế -> Thuế chỉ mang tính phân rã thông tin, KHÔNG cộng thêm
      totalAmount = Math.max(
        0,
        subTotal - normalizedOrderDiscount + serviceChargeTotal - normalizedPointsDiscount,
      ) + payableShipping;
    }

    return {
      subTotal,
      discountAmount: normalizedOrderDiscount,
      serviceChargeTotal,
      taxAmount,
      vatPriceMode,
      taxBreakdown,
      itemTaxDetails,

      shippingFee: normalizedShippingFee,
      shippingFeeOriginal: normalizedShippingFee,
      shippingDiscount: finalShippingDiscount,
      payableShipping,
      shippingFeeFinal: payableShipping,
      shippingDiscountSource,

      freeShippingQualified,
      freeShippingThreshold: finalThreshold,
      freeShippingEligibleAmount,
      freeShippingRemainingAmount,

      pointsDiscount: normalizedPointsDiscount,
      totalAmount: Math.round(totalAmount),
    };
  }
}
