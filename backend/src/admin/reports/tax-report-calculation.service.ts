import { Injectable } from '@nestjs/common';

/* ==========================================================================
   INTERFACES & TYPES FOR THE TAX / VAT CALCULATION ENGINE
   ========================================================================== */

export interface TaxOrderItemOptionInput {
  id?: string;
  nameAtSale: string;
  priceAdjustmentAtSale: number;
  quantity?: number;
}

export interface TaxProductInput {
  id: string;
  itemCode?: string;
  name: string;
  slug?: string;
  price: number;
  taxPercentage?: number;
  unit?: string | null;
  imageUrl?: string | null;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    slug?: string;
  } | null;
}

export interface TaxServiceChargeInput {
  id?: string;
  name: string;
  amount: number;
  isTaxable: boolean;
  taxPercentage?: number | null;
}

export interface TaxPaymentRefundInput {
  id?: string;
  orderPaymentId?: string;
  amount: number;
  reason?: string | null;
  cashierId?: string | null;
  createdAt?: Date | string;
}

export interface TaxOrderPaymentInput {
  id?: string;
  paymentMethod: string;
  amount: number;
  status: string;
  transactionRef?: string | null;
  cashReceived?: number | null;
  cashChange?: number | null;
  createdAt?: Date | string;
  refunds?: TaxPaymentRefundInput[];
}

export interface TaxVoucherInput {
  id: string;
  code: string;
  discountType: string; // PERCENTAGE, FIXED_AMOUNT, FREE_SHIP
  discountValue: number;
  applicableScope?: string; // ALL, POS, ONLINE
  applicableProductsScope?: string; // ALL, CATEGORY, SPECIFIC_PRODUCTS
  applicableCategoryIds?: string | null;
  applicableProductIds?: string | null;
}

export interface TaxOrderItemInput {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  priceAtSale: number;
  originalPriceAtSale: number;
  discountAmount?: number; // Direct discount per unit
  discountReason?: string | null;
  note?: string | null;
  optionsTextSnapshot?: string | null;
  isFlashSaleItem?: boolean;
  flashSaleId?: string | null;
  flashSaleSlotId?: string | null;
  flashSaleNameSnapshot?: string | null;
  flashSalePriceSnapshot?: number | null;
  taxPercentageAtSale?: number;
  taxableAmountAtSale?: number;
  taxAmountAtSale?: number;
  vatPriceModeSnapshot?: string | null;
  isVatInclusive?: boolean;
  selectedOptions?: TaxOrderItemOptionInput[];
  product?: TaxProductInput;
  order?: TaxOrderInput;
}

export interface TaxOrderInput {
  id: string;
  orderCode?: string | null;
  temporaryOrderCode?: string | null;
  branchId: string;
  branch?: {
    id: string;
    name: string;
    branchCode?: string;
  } | null;
  customerName?: string | null;
  customerPhone?: string | null;
  userId?: string | null;
  subTotal: number;
  shippingFee: number;
  discountAmount: number;
  discountReason?: string | null;
  discountPercent?: number | null;
  discountType?: string | null;
  shippingDiscount: number;
  shippingDiscountReason?: string | null;
  serviceChargeTotal: number;
  taxAmount: number;
  vatPriceModeSnapshot?: string | null; // 'VAT_INCLUDED' | 'VAT_EXCLUDED'
  totalAmount: number;
  voucherId?: string | null;
  shippingVoucherId?: string | null;
  discountVoucherCodeSnapshot?: string | null;
  shippingVoucherCodeSnapshot?: string | null;
  isVoucherRefunded?: boolean;
  paymentMethod?: string;
  paymentStatus?: string; // 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
  transactionId?: string | null;
  pointsUsed?: number;
  pointsAwarded?: number;
  status: string; // Must be 'COMPLETED' for VAT reports
  orderType?: string; // 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY'
  orderSource?: string; // 'ONLINE' | 'POS' | 'WEB' | 'CHATBOT' | 'VOICE' | 'QR_ORDER' | 'ADMIN'
  tableId?: string | null;
  table?: { id: string; name?: string } | null;
  cashierId?: string | null;
  cashierName?: string | null;
  createdAt: Date | string;
  deliveredAt?: Date | string | null;
  updatedAt?: Date | string;
  voucher?: TaxVoucherInput | null;
  shippingVoucher?: TaxVoucherInput | null;
  orderItems?: TaxOrderItemInput[];
  payments?: TaxOrderPaymentInput[];
  serviceCharges?: TaxServiceChargeInput[];
}

export interface CalculatedOrderItemTax {
  orderItemId: string;
  orderId: string;
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  quantity: number;
  unitPriceAtSale: number;
  originalPriceAtSale: number;
  grossLineTotal: number;

  // Options decomposition (priceAtSale already includes options, we extract for breakdown)
  unitOptionAdjustment: number;
  totalOptionAmount: number;
  baseItemAmount: number;

  // Discounts
  unitDirectDiscount: number;
  totalDirectDiscount: number;
  allocatedOrderDiscount: number;
  totalDiscount: number;
  netAmountAfterDiscount: number;

  // Flash Sale
  isFlashSaleItem: boolean;
  flashSaleDiscount: number;

  // Tax metrics
  taxPercentage: number;
  vatPriceMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED';
  taxableAmount: number;
  taxAmount: number;
  grossRevenueWithTax: number;
  taxCalculationSource: 'SNAPSHOT' | 'ZERO_TAX' | 'LEGACY_RECONSTRUCTED';
}

export interface OrderTaxReconciliationResult {
  isReconciled: boolean;
  hasWarning: boolean;
  errorCode?: 'OK' | 'VAT_RECONCILIATION_ERROR';
  warningCode?: 'PAYMENT_RECONCILIATION_WARNING' | null;

  expectedTotalAmount: number;
  actualTotalAmount: number;
  discrepancyTotal: number;

  expectedTaxAmount: number;
  actualTaxAmount: number;
  discrepancyTax: number;

  expectedDiscountAllocated: number;
  actualDiscountAllocated: number;
  discrepancyDiscountAllocated: number;

  expectedCollectedRevenue: number;
  actualCollectedRevenue: number;
  discrepancyPayment: number;

  notes: string[];
}

export interface CalculatedOrderTax {
  orderId: string;
  orderCode: string;
  completionTimestamp: Date;
  isLegacyTimestampFallback: boolean;
  branchId: string;
  branchName: string;
  branchCode: string;
  customerName: string;
  customerPhone: string;
  cashierName: string;
  tableName: string;
  orderSource: string;
  orderType: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;

  // Item counts & Sales
  totalItemCount: number;
  grossItemAmount: number;
  optionAmount: number;
  baseItemAmount: number;
  directItemDiscount: number;
  allocatedOrderDiscount: number;
  flashSaleDiscount: number;
  totalItemDiscount: number;
  netItemAmountAfterDiscount: number;

  // Shipping
  shippingFeeOriginal: number;
  shippingDiscount: number;
  shippingFeeCustomerPaid: number;
  shippingFeeSubsidized: number;

  // Service Charge
  serviceChargeTotal: number;
  serviceChargeTaxTotal: number;
  serviceChargeTaxableTotal: number;

  // Tax Breakdown
  vatTotalAmount: number;
  taxableRevenueBeforeVat: number;
  grossRevenueWithVat: number;
  vatPriceMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED';

  // Refund Tax
  refundedAmountTotal: number;
  refundedTaxTotal: number;
  netVatTotal: number;

  // Rate Breakdown for this order
  taxByRate: {
    [rate: number]: {
      taxableAmount: number;
      taxAmount: number;
      grossAmount: number;
      quantity: number;
    };
  };
  hasMixedVatRates: boolean;

  // Order Total
  orderTotalAmount: number;

  // Payment Audit
  collectedRevenue: number;
  outstandingRevenue: number;

  // Reconciliation
  reconciliation: OrderTaxReconciliationResult;
  items: CalculatedOrderItemTax[];
}

export interface TaxRateBreakdownItem {
  ratePercentage: number;
  rateLabel: string;
  completedOrdersCount: number;
  quantitySold: number;
  taxableAmount: number;
  taxAmount: number;
  grossAmount: number;
  refundedTaxAmount: number;
  netTaxAmount: number;
  effectiveTaxRatePercent: number;
}

export interface TaxBranchSummaryItem {
  branchId: string;
  branchCode: string;
  branchName: string;
  completedOrders: number;
  itemsSold: number;
  grossSales: number;
  taxableAmount: number;
  nonTaxableAmount: number;
  vat0Amount: number;
  vat5Amount: number;
  vat8Amount: number;
  vat10Amount: number;
  vatOtherAmount: number;
  totalVat: number;
  refundedVat: number;
  netVat: number;
  effectiveTaxRatePercent: number;
  unreconciledOrdersCount: number;
}

export interface TaxCategorySummaryItem {
  categoryId: string;
  categoryName: string;
  completedOrdersCount: number;
  quantitySold: number;
  grossRevenue: number;
  taxableAmount: number;
  vatAmount: number;
  refundedVatAmount: number;
  netVatAmount: number;
  contributionPercent: number;
  averageVatPerOrder: number;
}

export interface TaxProductSummaryItem {
  productId: string;
  itemCode: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  completedOrdersCount: number;
  quantitySold: number;
  originalPrice: number;
  averageSalePrice: number;
  totalDiscount: number;
  taxPercentage: number;
  taxableAmount: number;
  vatAmount: number;
  grossAmount: number;
  refundedVatAmount: number;
  netVatAmount: number;
}

export interface TaxDailyTrendItem {
  dateKey: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  completedOrdersCount: number;
  itemsSold: number;
  grossSales: number;
  taxableRevenue: number;
  nonTaxableRevenue: number;
  totalVat: number;
  refundedVat: number;
  netVat: number;
}

export interface TaxKPIsSummary {
  // Order & Item Counts
  completedOrders: number;
  completedOrderItems: number;
  distinctCustomers: number;

  // Sales & Revenues
  grossSales: number;
  taxableRevenue: number;
  nonTaxableRevenue: number;
  vatIncludedRevenue: number;
  vatExcludedRevenue: number;

  // VAT Metrics
  totalVat: number;
  vatRefunded: number;
  netVat: number;
  averageVatPerCompletedOrder: number;

  // Rates Breakdown
  vat0Amount: number;
  vat5Amount: number;
  vat8Amount: number;
  vat10Amount: number;
  vatOtherAmount: number;

  // Specific Quality Counters
  ordersWithMixedVatRates: number;
  legacyVatRecordsCount: number;
  reconciliationErrorsCount: number;
  paymentWarningCount: number;
}

@Injectable()
export class TaxReportCalculationService {
  /**
   * Phân bổ Voucher đơn hàng xuống từng OrderItem hợp lệ bằng thuật toán
   * Largest Remainder Method (Hare-Niemeyer).
   * Đảm bảo: SUM(allocatedDiscounts) === discountToDistribute tuyệt đối 100% không lệch 1 đồng.
   */
  allocateOrderDiscount(
    items: TaxOrderItemInput[],
    totalDiscount: number,
    voucher?: TaxVoucherInput | null,
  ): number[] {
    if (!items || items.length === 0 || totalDiscount <= 0) {
      return (items || []).map(() => 0);
    }

    let sumEligibleBase = 0;
    const eligibleIndices: number[] = [];
    const eligibleBases: number[] = [];

    // Parse voucher scope nếu có
    let allowedCatIds: string[] = [];
    let allowedProdIds: string[] = [];
    if (voucher?.applicableProductsScope === 'CATEGORY' && voucher.applicableCategoryIds) {
      try {
        allowedCatIds = JSON.parse(voucher.applicableCategoryIds);
      } catch {
        allowedCatIds = [voucher.applicableCategoryIds];
      }
    } else if (voucher?.applicableProductsScope === 'SPECIFIC_PRODUCTS' && voucher.applicableProductIds) {
      try {
        allowedProdIds = JSON.parse(voucher.applicableProductIds);
      } catch {
        allowedProdIds = [voucher.applicableProductIds];
      }
    }

    items.forEach((item, idx) => {
      const qty = Math.max(1, Math.floor(Number(item.quantity || 1)));
      const unitPrice = Math.max(0, Math.round(Number(item.priceAtSale || 0)));
      const directDiscUnit = Math.max(0, Math.round(Number(item.discountAmount || 0)));
      const lineGross = Math.round(qty * unitPrice);
      const lineDirectDisc = Math.min(lineGross, Math.round(qty * directDiscUnit));
      const lineEligibleBase = Math.max(0, lineGross - lineDirectDisc);

      let isEligible = true;
      if (voucher?.applicableProductsScope === 'CATEGORY' && allowedCatIds.length > 0) {
        isEligible = !!(item.product?.categoryId && allowedCatIds.includes(item.product.categoryId));
      } else if (voucher?.applicableProductsScope === 'SPECIFIC_PRODUCTS' && allowedProdIds.length > 0) {
        isEligible = allowedProdIds.includes(item.productId);
      }

      if (isEligible && lineEligibleBase > 0) {
        eligibleIndices.push(idx);
        eligibleBases.push(lineEligibleBase);
        sumEligibleBase += lineEligibleBase;
      }
    });

    const allocatedDiscounts = new Array(items.length).fill(0);
    if (eligibleIndices.length === 0 || sumEligibleBase <= 0) {
      return allocatedDiscounts;
    }

    const discountToDistribute = Math.min(totalDiscount, sumEligibleBase);

    interface RemainderEntry {
      idx: number;
      intPart: number;
      remainder: number;
    }

    const entries: RemainderEntry[] = [];
    let sumIntPart = 0;

    eligibleIndices.forEach((actualIdx, i) => {
      const base = eligibleBases[i];
      const exactShare = (discountToDistribute * base) / sumEligibleBase;
      const intPart = Math.floor(exactShare);
      const remainder = exactShare - intPart;

      entries.push({ idx: actualIdx, intPart, remainder });
      sumIntPart += intPart;
    });

    let leftover = Math.round(discountToDistribute - sumIntPart);

    // Sắp xếp phần dư giảm dần theo Hare-Niemeyer rule
    entries.sort((a, b) => b.remainder - a.remainder);

    for (let i = 0; i < entries.length; i++) {
      let extra = 0;
      if (leftover > 0) {
        extra = 1;
        leftover--;
      }
      allocatedDiscounts[entries[i].idx] = entries[i].intPart + extra;
    }

    return allocatedDiscounts;
  }

  /**
   * Tính toán các chỉ số thuế cho 1 OrderItem đơn lẻ
   */
  calculateOrderItemTax(
    item: TaxOrderItemInput,
    allocatedDiscount: number = 0,
    orderVatModeFallback: 'VAT_INCLUDED' | 'VAT_EXCLUDED' = 'VAT_INCLUDED',
  ): CalculatedOrderItemTax {
    const order = item.order;
    const product = item.product;

    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
    const unitPriceAtSale = Math.max(0, Math.round(Number(item.priceAtSale || 0)));
    const originalPriceAtSale = Math.max(
      0,
      Math.round(Number(item.originalPriceAtSale || product?.price || unitPriceAtSale)),
    );

    // 1. Gross line total
    const grossLineTotal = Math.round(quantity * unitPriceAtSale);

    // 2. Options / Topping (Tách thành phần để phân tích, KHÔNG cộng thêm vào grossLineTotal)
    const selectedOptions = item.selectedOptions || [];
    let unitOptionAdjustment = 0;
    selectedOptions.forEach((opt) => {
      const optQty = Math.max(1, Math.floor(Number(opt.quantity || 1)));
      unitOptionAdjustment += Math.round(Number(opt.priceAdjustmentAtSale || 0) * optQty);
    });
    const totalOptionAmount = Math.round(quantity * unitOptionAdjustment);
    const baseItemAmount = Math.max(0, grossLineTotal - totalOptionAmount);

    // 3. Giảm giá trực tiếp & Voucher phân bổ
    const unitDirectDiscount = Math.max(0, Math.round(Number(item.discountAmount || 0)));
    const totalDirectDiscount = Math.min(grossLineTotal, Math.round(quantity * unitDirectDiscount));
    const normalizedAllocatedDiscount = Math.min(
      Math.max(0, grossLineTotal - totalDirectDiscount),
      Math.max(0, Math.round(allocatedDiscount)),
    );
    const totalDiscount = totalDirectDiscount + normalizedAllocatedDiscount;
    const netAmountAfterDiscount = Math.max(0, grossLineTotal - totalDiscount);

    // 4. Flash Sale discount
    let flashSaleDiscount = 0;
    const isFlashSale = !!item.isFlashSaleItem;
    if (isFlashSale) {
      const fsPrice = Math.max(0, Math.round(Number(item.flashSalePriceSnapshot || unitPriceAtSale)));
      flashSaleDiscount = Math.max(0, Math.round(quantity * (originalPriceAtSale - fsPrice)));
    }

    // 5. VAT Tax Calculation
    const vatMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED' =
      (item.vatPriceModeSnapshot as any) ||
      (order?.vatPriceModeSnapshot as any) ||
      (item.isVatInclusive !== undefined
        ? item.isVatInclusive
          ? 'VAT_INCLUDED'
          : 'VAT_EXCLUDED'
        : orderVatModeFallback);

    const isVatInclusive = vatMode === 'VAT_INCLUDED';
    const taxRate = Math.max(
      0,
      Number(
        item.taxPercentageAtSale !== undefined && item.taxPercentageAtSale !== null
          ? item.taxPercentageAtSale
          : product?.taxPercentage || 0,
      ),
    );

    let taxAmount = 0;
    let taxableAmount = netAmountAfterDiscount;
    let grossRevenueWithTax = netAmountAfterDiscount;
    let taxCalculationSource: 'SNAPSHOT' | 'ZERO_TAX' | 'LEGACY_RECONSTRUCTED' = 'SNAPSHOT';

    const hasStoredSnapshot =
      (Number(item.taxableAmountAtSale) > 0 || Number(item.taxAmountAtSale) > 0) &&
      normalizedAllocatedDiscount === 0;

    if (taxRate === 0) {
      taxAmount = 0;
      taxableAmount = netAmountAfterDiscount;
      grossRevenueWithTax = netAmountAfterDiscount;
      taxCalculationSource = 'ZERO_TAX';
    } else if (hasStoredSnapshot && item.taxAmountAtSale !== undefined) {
      taxAmount = Math.max(0, Math.round(Number(item.taxAmountAtSale)));
      taxableAmount = Math.max(0, Math.round(Number(item.taxableAmountAtSale)));
      grossRevenueWithTax = isVatInclusive ? netAmountAfterDiscount : netAmountAfterDiscount + taxAmount;
      taxCalculationSource = 'SNAPSHOT';
    } else {
      if (isVatInclusive) {
        // Công thức chuẩn VAT Included: Tax = Net * rate / (100 + rate)
        taxAmount = Math.round((netAmountAfterDiscount * taxRate) / (100 + taxRate));
        taxableAmount = Math.max(0, netAmountAfterDiscount - taxAmount);
        grossRevenueWithTax = netAmountAfterDiscount;
      } else {
        // Công thức chuẩn VAT Excluded: Tax = Net * rate / 100
        taxAmount = Math.round((netAmountAfterDiscount * taxRate) / 100);
        taxableAmount = netAmountAfterDiscount;
        grossRevenueWithTax = netAmountAfterDiscount + taxAmount;
      }
      taxCalculationSource =
        item.taxPercentageAtSale !== undefined ? 'SNAPSHOT' : 'LEGACY_RECONSTRUCTED';
    }

    return {
      orderItemId: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productCode: product?.itemCode || '',
      productName: product?.name || 'Món ăn',
      categoryId: product?.categoryId || product?.category?.id || 'UNGROUPED',
      categoryName: product?.category?.name || 'Chưa phân loại',
      quantity,
      unitPriceAtSale,
      originalPriceAtSale,
      grossLineTotal,

      unitOptionAdjustment,
      totalOptionAmount,
      baseItemAmount,

      unitDirectDiscount,
      totalDirectDiscount,
      allocatedOrderDiscount: normalizedAllocatedDiscount,
      totalDiscount,
      netAmountAfterDiscount,

      isFlashSaleItem: isFlashSale,
      flashSaleDiscount,

      taxPercentage: taxRate,
      vatPriceMode: vatMode,
      taxableAmount,
      taxAmount,
      grossRevenueWithTax,
      taxCalculationSource,
    };
  }

  /**
   * Tính toán chi tiết thuế cho một Đơn hàng đã hoàn thành và thực hiện đối soát
   */
  calculateOrderTax(
    order: TaxOrderInput,
    globalVatMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED' = 'VAT_INCLUDED',
  ): CalculatedOrderTax {
    const rawItems = order.orderItems || [];
    const orderDiscountAmount = Math.max(0, Math.round(Number(order.discountAmount || 0)));

    // 1. Phân bổ Voucher bằng Largest Remainder
    const allocatedDiscounts = this.allocateOrderDiscount(
      rawItems,
      orderDiscountAmount,
      order.voucher,
    );

    // 2. Tính toán từng OrderItem
    let grossItemAmount = 0;
    let optionAmount = 0;
    let baseItemAmount = 0;
    let directItemDiscount = 0;
    let allocatedDiscountSum = 0;
    let flashSaleDiscount = 0;
    let netItemAmountAfterDiscount = 0;
    let itemsTaxTotal = 0;
    let itemsTaxableTotal = 0;
    let itemsGrossWithTax = 0;

    const vatMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED' =
      (order.vatPriceModeSnapshot as any) || globalVatMode;

    const taxByRate: {
      [rate: number]: {
        taxableAmount: number;
        taxAmount: number;
        grossAmount: number;
        quantity: number;
      };
    } = {};

    const distinctRates = new Set<number>();

    const calculatedItems: CalculatedOrderItemTax[] = rawItems.map((item, idx) => {
      const calc = this.calculateOrderItemTax(item, allocatedDiscounts[idx], vatMode);
      grossItemAmount += calc.grossLineTotal;
      optionAmount += calc.totalOptionAmount;
      baseItemAmount += calc.baseItemAmount;
      directItemDiscount += calc.totalDirectDiscount;
      allocatedDiscountSum += calc.allocatedOrderDiscount;
      flashSaleDiscount += calc.flashSaleDiscount;
      netItemAmountAfterDiscount += calc.netAmountAfterDiscount;

      itemsTaxTotal += calc.taxAmount;
      itemsTaxableTotal += calc.taxableAmount;
      itemsGrossWithTax += calc.grossRevenueWithTax;

      const rate = calc.taxPercentage;
      distinctRates.add(rate);
      if (!taxByRate[rate]) {
        taxByRate[rate] = { taxableAmount: 0, taxAmount: 0, grossAmount: 0, quantity: 0 };
      }
      taxByRate[rate].taxableAmount += calc.taxableAmount;
      taxByRate[rate].taxAmount += calc.taxAmount;
      taxByRate[rate].grossAmount += calc.grossRevenueWithTax;
      taxByRate[rate].quantity += calc.quantity;

      return calc;
    });

    const totalItemDiscount = directItemDiscount + allocatedDiscountSum;

    // 3. Phụ thu dịch vụ (Service Charge)
    let serviceChargeTotal = Math.max(0, Math.round(Number(order.serviceChargeTotal || 0)));
    let serviceChargeTaxTotal = 0;
    let serviceChargeTaxableTotal = serviceChargeTotal;

    if (order.serviceCharges && order.serviceCharges.length > 0) {
      let calcScTotal = 0;
      for (const sc of order.serviceCharges) {
        const scAmt = Math.max(0, Math.round(Number(sc.amount || 0)));
        calcScTotal += scAmt;
        if (sc.isTaxable) {
          const scRate = Math.max(0, Number(sc.taxPercentage ?? 10));
          if (scRate > 0 && scAmt > 0) {
            let scTax = 0;
            if (vatMode === 'VAT_INCLUDED') {
              scTax = Math.round((scAmt * scRate) / (100 + scRate));
            } else {
              scTax = Math.round((scAmt * scRate) / 100);
            }
            serviceChargeTaxTotal += scTax;

            distinctRates.add(scRate);
            if (!taxByRate[scRate]) {
              taxByRate[scRate] = { taxableAmount: 0, taxAmount: 0, grossAmount: 0, quantity: 0 };
            }
            taxByRate[scRate].taxAmount += scTax;
            taxByRate[scRate].taxableAmount +=
              vatMode === 'VAT_INCLUDED' ? scAmt - scTax : scAmt;
            taxByRate[scRate].grossAmount +=
              vatMode === 'VAT_INCLUDED' ? scAmt : scAmt + scTax;
          }
        }
      }
      if (serviceChargeTotal === 0 && calcScTotal > 0) {
        serviceChargeTotal = calcScTotal;
      }
    }

    // 4. Tổng VAT đơn hàng
    const vatTotalAmount = itemsTaxTotal + serviceChargeTaxTotal;
    const taxableRevenueBeforeVat =
      vatMode === 'VAT_INCLUDED'
        ? Math.max(0, netItemAmountAfterDiscount + serviceChargeTotal - vatTotalAmount)
        : netItemAmountAfterDiscount + serviceChargeTotal;
    const grossRevenueWithVat =
      vatMode === 'VAT_INCLUDED'
        ? netItemAmountAfterDiscount + serviceChargeTotal
        : netItemAmountAfterDiscount + serviceChargeTotal + vatTotalAmount;

    // 5. Vận chuyển (Shipping Fee) - Phân tách riêng
    const shippingFeeOriginal = Math.max(0, Math.round(Number(order.shippingFee || 0)));
    const shippingDiscount = Math.min(
      shippingFeeOriginal,
      Math.max(0, Math.round(Number(order.shippingDiscount || 0))),
    );
    const shippingFeeCustomerPaid = Math.max(0, shippingFeeOriginal - shippingDiscount);
    const shippingFeeSubsidized = shippingDiscount;

    // 6. Tổng tiền thanh toán lưu trong DB
    const storedTotalAmount = Math.max(0, Math.round(Number(order.totalAmount || 0)));

    // 7. Hoàn tiền & Hoàn thuế (Refunds)
    let refundedAmountTotal = 0;
    let collectedRevenue = 0;

    const payments = order.payments || [];
    if (payments.length > 0) {
      for (const p of payments) {
        if (p.status === 'COMPLETED' || p.status === 'PAID') {
          collectedRevenue += Math.max(0, Math.round(Number(p.amount || 0)));
        }
        for (const rf of p.refunds || []) {
          refundedAmountTotal += Math.max(0, Math.round(Number(rf.amount || 0)));
        }
      }
    } else {
      if (order.paymentStatus === 'PAID' || order.status === 'COMPLETED') {
        collectedRevenue = storedTotalAmount;
      }
      if (order.paymentStatus === 'REFUNDED') {
        refundedAmountTotal = storedTotalAmount;
      }
    }

    // Tính Refund VAT tỉ lệ theo số tiền refund / tổng tiền đơn hàng
    let refundedTaxTotal = 0;
    if (refundedAmountTotal > 0 && storedTotalAmount > 0 && vatTotalAmount > 0) {
      if (refundedAmountTotal >= storedTotalAmount) {
        refundedTaxTotal = vatTotalAmount;
      } else {
        refundedTaxTotal = Math.round((vatTotalAmount * refundedAmountTotal) / storedTotalAmount);
      }
    }
    const netVatTotal = Math.max(0, vatTotalAmount - refundedTaxTotal);

    const outstandingRevenue =
      order.paymentStatus !== 'PAID' && order.status === 'COMPLETED'
        ? Math.max(0, storedTotalAmount - collectedRevenue)
        : 0;

    // 8. Chạy VAT Reconciliation Engine
    const reconciliation = this.reconcileOrderTax({
      order,
      grossItemAmount,
      orderDiscountAmount,
      allocatedDiscountSum,
      storedTotalAmount,
      serviceChargeTotal,
      vatTotalAmount,
      vatMode,
      shippingFeeCustomerPaid,
      collectedRevenue,
      refundedAmountTotal,
    });

    // 9. Xác định Completion Timestamp
    let completionTimestamp = order.deliveredAt ? new Date(order.deliveredAt) : null;
    let isLegacyTimestampFallback = false;
    if (!completionTimestamp || isNaN(completionTimestamp.getTime())) {
      completionTimestamp = order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt);
      isLegacyTimestampFallback = true;
    }

    return {
      orderId: order.id,
      orderCode: order.orderCode || order.temporaryOrderCode || order.id.substring(0, 8),
      completionTimestamp,
      isLegacyTimestampFallback,
      branchId: order.branchId || order.branch?.id || '',
      branchName: order.branch?.name || 'Chi nhánh mặc định',
      branchCode: order.branch?.branchCode || '',
      customerName: order.customerName || 'Khách vãng lai',
      customerPhone: order.customerPhone || '',
      cashierName: order.cashierName || 'N/A',
      tableName: order.table?.name || 'N/A',
      orderSource: order.orderSource || 'WEB',
      orderType: order.orderType || 'DELIVERY',
      orderStatus: order.status || 'COMPLETED',
      paymentStatus: order.paymentStatus || 'PENDING',
      paymentMethod: order.paymentMethod || 'COD',

      totalItemCount: calculatedItems.reduce((sum, it) => sum + it.quantity, 0),
      grossItemAmount,
      optionAmount,
      baseItemAmount,
      directItemDiscount,
      allocatedOrderDiscount: allocatedDiscountSum,
      flashSaleDiscount,
      totalItemDiscount,
      netItemAmountAfterDiscount,

      shippingFeeOriginal,
      shippingDiscount,
      shippingFeeCustomerPaid,
      shippingFeeSubsidized,

      serviceChargeTotal,
      serviceChargeTaxTotal,
      serviceChargeTaxableTotal,

      vatTotalAmount,
      taxableRevenueBeforeVat,
      grossRevenueWithVat,
      vatPriceMode: vatMode,

      refundedAmountTotal,
      refundedTaxTotal,
      netVatTotal,

      taxByRate,
      hasMixedVatRates: distinctRates.size > 1,

      orderTotalAmount: storedTotalAmount,
      collectedRevenue,
      outstandingRevenue,

      reconciliation,
      items: calculatedItems,
    };
  }

  /**
   * Kiểm tra các Bất biến đối soát thuế (Invariants) cho 1 Đơn hàng
   */
  private reconcileOrderTax(params: {
    order: TaxOrderInput;
    grossItemAmount: number;
    orderDiscountAmount: number;
    allocatedDiscountSum: number;
    storedTotalAmount: number;
    serviceChargeTotal: number;
    vatTotalAmount: number;
    vatMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED';
    shippingFeeCustomerPaid: number;
    collectedRevenue: number;
    refundedAmountTotal: number;
  }): OrderTaxReconciliationResult {
    const {
      order,
      grossItemAmount,
      orderDiscountAmount,
      allocatedDiscountSum,
      storedTotalAmount,
      serviceChargeTotal,
      vatTotalAmount,
      vatMode,
      shippingFeeCustomerPaid,
      collectedRevenue,
      refundedAmountTotal,
    } = params;

    const notes: string[] = [];
    let isReconciled = true;
    let hasWarning = false;
    let warningCode: 'PAYMENT_RECONCILIATION_WARNING' | null = null;

    // 1. Phân bổ Voucher Invariant (Largest Remainder)
    const discrepancyDiscountAllocated = Math.abs(orderDiscountAmount - allocatedDiscountSum);
    if (discrepancyDiscountAllocated > 0) {
      isReconciled = false;
      notes.push(
        `Sai lệch phân bổ voucher: Đơn ${orderDiscountAmount}đ vs Đã phân bổ ${allocatedDiscountSum}đ (Lệch ${discrepancyDiscountAllocated}đ)`,
      );
    }

    // 2. Total Amount Invariant
    let expectedTotal = 0;
    if (vatMode === 'VAT_EXCLUDED') {
      expectedTotal = Math.max(
        0,
        grossItemAmount - orderDiscountAmount + serviceChargeTotal + vatTotalAmount,
      ) + shippingFeeCustomerPaid;
    } else {
      expectedTotal = Math.max(
        0,
        grossItemAmount - orderDiscountAmount + serviceChargeTotal,
      ) + shippingFeeCustomerPaid;
    }

    const discrepancyTotal = Math.abs(storedTotalAmount - expectedTotal);
    if (discrepancyTotal > 1) { // Sai số lớn hơn 1 VND
      isReconciled = false;
      notes.push(
        `Lệch tổng tiền đơn hàng: DB ghi ${storedTotalAmount}đ, Tính toán ra ${expectedTotal}đ (Lệch ${discrepancyTotal}đ)`,
      );
    }

    // 3. Tax Amount Invariant (Order.taxAmount vs Computed VAT)
    const storedTaxAmount = Math.max(0, Math.round(Number(order.taxAmount || 0)));
    const discrepancyTax = storedTaxAmount > 0 ? Math.abs(storedTaxAmount - vatTotalAmount) : 0;
    if (storedTaxAmount > 0 && discrepancyTax > 1) {
      isReconciled = false;
      notes.push(
        `Lệch tiền thuế: DB lưu ${storedTaxAmount}đ, Tính toán ra ${vatTotalAmount}đ (Lệch ${discrepancyTax}đ)`,
      );
    }

    // 4. Payment Reconciliation Warning
    const discrepancyPayment = Math.abs(storedTotalAmount - collectedRevenue);
    if (
      order.paymentStatus !== 'PAID' &&
      order.paymentStatus !== 'REFUNDED' &&
      order.paymentStatus !== 'PARTIALLY_REFUNDED'
    ) {
      hasWarning = true;
      warningCode = 'PAYMENT_RECONCILIATION_WARNING';
      notes.push(
        `Cảnh báo thanh toán: Đơn hoàn thành nhưng paymentStatus='${order.paymentStatus}' hoặc chưa thu đủ tiền (Đã thu ${collectedRevenue}đ / Cần thu ${storedTotalAmount}đ)`,
      );
    }

    return {
      isReconciled,
      hasWarning,
      errorCode: isReconciled ? 'OK' : 'VAT_RECONCILIATION_ERROR',
      warningCode,
      expectedTotalAmount: expectedTotal,
      actualTotalAmount: storedTotalAmount,
      discrepancyTotal,
      expectedTaxAmount: vatTotalAmount,
      actualTaxAmount: storedTaxAmount,
      discrepancyTax,
      expectedDiscountAllocated: orderDiscountAmount,
      actualDiscountAllocated: allocatedDiscountSum,
      discrepancyDiscountAllocated,
      expectedCollectedRevenue: storedTotalAmount,
      actualCollectedRevenue: collectedRevenue,
      discrepancyPayment,
      notes,
    };
  }

  /**
   * Tổng hợp các chỉ số KPI thuế tổng quan cho tập hợp các đơn hoàn thành
   */
  aggregateTaxKPIs(calculatedOrders: CalculatedOrderTax[]): TaxKPIsSummary {
    let grossSales = 0;
    let taxableRevenue = 0;
    let nonTaxableRevenue = 0;
    let vatIncludedRevenue = 0;
    let vatExcludedRevenue = 0;
    let totalVat = 0;
    let vatRefunded = 0;
    let netVat = 0;

    let vat0Amount = 0;
    let vat5Amount = 0;
    let vat8Amount = 0;
    let vat10Amount = 0;
    let vatOtherAmount = 0;

    let totalItems = 0;
    let ordersWithMixedVatRates = 0;
    let legacyVatRecordsCount = 0;
    let reconciliationErrorsCount = 0;
    let paymentWarningCount = 0;

    const customers = new Set<string>();

    for (const ord of calculatedOrders) {
      totalItems += ord.totalItemCount;
      if (ord.customerPhone) customers.add(ord.customerPhone);

      grossSales += ord.grossItemAmount + ord.serviceChargeTotal;
      totalVat += ord.vatTotalAmount;
      vatRefunded += ord.refundedTaxTotal;
      netVat += ord.netVatTotal;

      if (ord.vatPriceMode === 'VAT_INCLUDED') {
        vatIncludedRevenue += ord.netItemAmountAfterDiscount + ord.serviceChargeTotal;
      } else {
        vatExcludedRevenue += ord.netItemAmountAfterDiscount + ord.serviceChargeTotal;
      }

      if (ord.hasMixedVatRates) {
        ordersWithMixedVatRates++;
      }
      if (ord.isLegacyTimestampFallback) {
        legacyVatRecordsCount++;
      }
      if (!ord.reconciliation.isReconciled) {
        reconciliationErrorsCount++;
      }
      if (ord.reconciliation.hasWarning) {
        paymentWarningCount++;
      }

      // Aggregate theo các mức rate của order
      for (const [rateStr, data] of Object.entries(ord.taxByRate)) {
        const rate = Number(rateStr);
        taxableRevenue += data.taxableAmount;
        if (rate === 0) {
          nonTaxableRevenue += data.taxableAmount;
          vat0Amount += data.taxAmount;
        } else if (rate === 5) {
          vat5Amount += data.taxAmount;
        } else if (rate === 8) {
          vat8Amount += data.taxAmount;
        } else if (rate === 10) {
          vat10Amount += data.taxAmount;
        } else {
          vatOtherAmount += data.taxAmount;
        }
      }
    }

    const completedOrders = calculatedOrders.length;
    const averageVatPerCompletedOrder =
      completedOrders > 0 ? Math.round(totalVat / completedOrders) : 0;

    return {
      completedOrders,
      completedOrderItems: totalItems,
      distinctCustomers: customers.size,
      grossSales,
      taxableRevenue,
      nonTaxableRevenue,
      vatIncludedRevenue,
      vatExcludedRevenue,
      totalVat,
      vatRefunded,
      netVat,
      averageVatPerCompletedOrder,
      vat0Amount,
      vat5Amount,
      vat8Amount,
      vat10Amount,
      vatOtherAmount,
      ordersWithMixedVatRates,
      legacyVatRecordsCount,
      reconciliationErrorsCount,
      paymentWarningCount,
    };
  }

  /**
   * Bảng phân tích chi tiết theo Mức thuế suất (0%, 5%, 8%, 10%, Khác)
   */
  aggregateTaxRates(calculatedOrders: CalculatedOrderTax[]): TaxRateBreakdownItem[] {
    const rateMap = new Map<
      number,
      {
        completedOrdersSet: Set<string>;
        quantitySold: number;
        taxableAmount: number;
        taxAmount: number;
        grossAmount: number;
        refundedTaxAmount: number;
      }
    >();

    // Khởi tạo trước 4 mức thuế phổ biến
    [0, 5, 8, 10].forEach((r) => {
      rateMap.set(r, {
        completedOrdersSet: new Set(),
        quantitySold: 0,
        taxableAmount: 0,
        taxAmount: 0,
        grossAmount: 0,
        refundedTaxAmount: 0,
      });
    });

    for (const ord of calculatedOrders) {
      for (const [rateStr, data] of Object.entries(ord.taxByRate)) {
        const rate = Number(rateStr);
        if (!rateMap.has(rate)) {
          rateMap.set(rate, {
            completedOrdersSet: new Set(),
            quantitySold: 0,
            taxableAmount: 0,
            taxAmount: 0,
            grossAmount: 0,
            refundedTaxAmount: 0,
          });
        }
        const entry = rateMap.get(rate)!;
        entry.completedOrdersSet.add(ord.orderId);
        entry.quantitySold += data.quantity;
        entry.taxableAmount += data.taxableAmount;
        entry.taxAmount += data.taxAmount;
        entry.grossAmount += data.grossAmount;

        if (ord.vatTotalAmount > 0 && ord.refundedTaxTotal > 0) {
          const rateRatio = data.taxAmount / ord.vatTotalAmount;
          entry.refundedTaxAmount += Math.round(ord.refundedTaxTotal * rateRatio);
        }
      }
    }

    const results: TaxRateBreakdownItem[] = [];
    const sortedRates = Array.from(rateMap.keys()).sort((a, b) => a - b);

    for (const rate of sortedRates) {
      const entry = rateMap.get(rate)!;
      const netTax = Math.max(0, entry.taxAmount - entry.refundedTaxAmount);
      const effectiveRate =
        entry.taxableAmount > 0
          ? Number(((entry.taxAmount / entry.taxableAmount) * 100).toFixed(2))
          : rate;

      results.push({
        ratePercentage: rate,
        rateLabel: rate === 0 ? '0% (Không chịu thuế)' : `${rate}%`,
        completedOrdersCount: entry.completedOrdersSet.size,
        quantitySold: entry.quantitySold,
        taxableAmount: entry.taxableAmount,
        taxAmount: entry.taxAmount,
        grossAmount: entry.grossAmount,
        refundedTaxAmount: entry.refundedTaxAmount,
        netTaxAmount: netTax,
        effectiveTaxRatePercent: effectiveRate,
      });
    }

    return results;
  }

  /**
   * Bảng phân bổ thuế theo từng Chi nhánh (Branch VAT)
   */
  aggregateTaxBranches(
    calculatedOrders: CalculatedOrderTax[],
    allBranches: Array<{ id: string; name: string; branchCode?: string }>,
  ): TaxBranchSummaryItem[] {
    const branchMap = new Map<string, TaxBranchSummaryItem>();

    allBranches.forEach((b) => {
      branchMap.set(b.id, {
        branchId: b.id,
        branchCode: b.branchCode || '',
        branchName: b.name,
        completedOrders: 0,
        itemsSold: 0,
        grossSales: 0,
        taxableAmount: 0,
        nonTaxableAmount: 0,
        vat0Amount: 0,
        vat5Amount: 0,
        vat8Amount: 0,
        vat10Amount: 0,
        vatOtherAmount: 0,
        totalVat: 0,
        refundedVat: 0,
        netVat: 0,
        effectiveTaxRatePercent: 0,
        unreconciledOrdersCount: 0,
      });
    });

    for (const ord of calculatedOrders) {
      let bSummary = branchMap.get(ord.branchId);
      if (!bSummary) {
        bSummary = {
          branchId: ord.branchId,
          branchCode: ord.branchCode,
          branchName: ord.branchName,
          completedOrders: 0,
          itemsSold: 0,
          grossSales: 0,
          taxableAmount: 0,
          nonTaxableAmount: 0,
          vat0Amount: 0,
          vat5Amount: 0,
          vat8Amount: 0,
          vat10Amount: 0,
          vatOtherAmount: 0,
          totalVat: 0,
          refundedVat: 0,
          netVat: 0,
          effectiveTaxRatePercent: 0,
          unreconciledOrdersCount: 0,
        };
        branchMap.set(ord.branchId, bSummary);
      }

      bSummary.completedOrders++;
      bSummary.itemsSold += ord.totalItemCount;
      bSummary.grossSales += ord.grossItemAmount + ord.serviceChargeTotal;
      bSummary.totalVat += ord.vatTotalAmount;
      bSummary.refundedVat += ord.refundedTaxTotal;
      bSummary.netVat += ord.netVatTotal;

      if (!ord.reconciliation.isReconciled) {
        bSummary.unreconciledOrdersCount++;
      }

      for (const [rateStr, data] of Object.entries(ord.taxByRate)) {
        const rate = Number(rateStr);
        bSummary.taxableAmount += data.taxableAmount;
        if (rate === 0) {
          bSummary.nonTaxableAmount += data.taxableAmount;
          bSummary.vat0Amount += data.taxAmount;
        } else if (rate === 5) {
          bSummary.vat5Amount += data.taxAmount;
        } else if (rate === 8) {
          bSummary.vat8Amount += data.taxAmount;
        } else if (rate === 10) {
          bSummary.vat10Amount += data.taxAmount;
        } else {
          bSummary.vatOtherAmount += data.taxAmount;
        }
      }
    }

    const results = Array.from(branchMap.values());
    results.forEach((b) => {
      b.effectiveTaxRatePercent =
        b.taxableAmount > 0
          ? Number(((b.totalVat / b.taxableAmount) * 100).toFixed(2))
          : 0;
    });

    return results;
  }

  /**
   * Báo cáo thuế theo Danh mục (Category VAT)
   */
  aggregateTaxCategories(calculatedOrders: CalculatedOrderTax[]): TaxCategorySummaryItem[] {
    const catMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        orderSet: Set<string>;
        quantitySold: number;
        grossRevenue: number;
        taxableAmount: number;
        vatAmount: number;
        refundedVatAmount: number;
      }
    >();

    let totalGlobalVat = 0;

    for (const ord of calculatedOrders) {
      for (const it of ord.items) {
        const catId = it.categoryId || 'UNGROUPED';
        const catName = it.categoryName || 'Chưa phân loại';

        if (!catMap.has(catId)) {
          catMap.set(catId, {
            categoryId: catId,
            categoryName: catName,
            orderSet: new Set(),
            quantitySold: 0,
            grossRevenue: 0,
            taxableAmount: 0,
            vatAmount: 0,
            refundedVatAmount: 0,
          });
        }

        const entry = catMap.get(catId)!;
        entry.orderSet.add(ord.orderId);
        entry.quantitySold += it.quantity;
        entry.grossRevenue += it.grossLineTotal;
        entry.taxableAmount += it.taxableAmount;
        entry.vatAmount += it.taxAmount;
        totalGlobalVat += it.taxAmount;

        if (ord.vatTotalAmount > 0 && ord.refundedTaxTotal > 0) {
          const itemRatio = it.taxAmount / ord.vatTotalAmount;
          entry.refundedVatAmount += Math.round(ord.refundedTaxTotal * itemRatio);
        }
      }
    }

    const results: TaxCategorySummaryItem[] = [];
    for (const entry of catMap.values()) {
      const netVat = Math.max(0, entry.vatAmount - entry.refundedVatAmount);
      const contribution =
        totalGlobalVat > 0 ? Number(((entry.vatAmount / totalGlobalVat) * 100).toFixed(2)) : 0;
      const orderCount = entry.orderSet.size;
      const avgVat = orderCount > 0 ? Math.round(entry.vatAmount / orderCount) : 0;

      results.push({
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        completedOrdersCount: orderCount,
        quantitySold: entry.quantitySold,
        grossRevenue: entry.grossRevenue,
        taxableAmount: entry.taxableAmount,
        vatAmount: entry.vatAmount,
        refundedVatAmount: entry.refundedVatAmount,
        netVatAmount: netVat,
        contributionPercent: contribution,
        averageVatPerOrder: avgVat,
      });
    }

    return results.sort((a, b) => b.vatAmount - a.vatAmount);
  }

  /**
   * Báo cáo thuế theo từng Sản phẩm (Product VAT)
   */
  aggregateTaxProducts(calculatedOrders: CalculatedOrderTax[]): TaxProductSummaryItem[] {
    const prodMap = new Map<
      string,
      {
        productId: string;
        itemCode: string;
        productName: string;
        categoryId: string;
        categoryName: string;
        orderSet: Set<string>;
        quantitySold: number;
        originalPrice: number;
        grossRevenue: number;
        totalDiscount: number;
        taxPercentage: number;
        taxableAmount: number;
        vatAmount: number;
        refundedVatAmount: number;
      }
    >();

    for (const ord of calculatedOrders) {
      for (const it of ord.items) {
        if (!prodMap.has(it.productId)) {
          prodMap.set(it.productId, {
            productId: it.productId,
            itemCode: it.productCode,
            productName: it.productName,
            categoryId: it.categoryId,
            categoryName: it.categoryName,
            orderSet: new Set(),
            quantitySold: 0,
            originalPrice: it.originalPriceAtSale,
            grossRevenue: 0,
            totalDiscount: 0,
            taxPercentage: it.taxPercentage,
            taxableAmount: 0,
            vatAmount: 0,
            refundedVatAmount: 0,
          });
        }

        const entry = prodMap.get(it.productId)!;
        entry.orderSet.add(ord.orderId);
        entry.quantitySold += it.quantity;
        entry.grossRevenue += it.grossLineTotal;
        entry.totalDiscount += it.totalDiscount;
        entry.taxableAmount += it.taxableAmount;
        entry.vatAmount += it.taxAmount;

        if (ord.vatTotalAmount > 0 && ord.refundedTaxTotal > 0) {
          const itemRatio = it.taxAmount / ord.vatTotalAmount;
          entry.refundedVatAmount += Math.round(ord.refundedTaxTotal * itemRatio);
        }
      }
    }

    const results: TaxProductSummaryItem[] = [];
    for (const entry of prodMap.values()) {
      const avgSalePrice =
        entry.quantitySold > 0 ? Math.round(entry.grossRevenue / entry.quantitySold) : 0;
      const netVat = Math.max(0, entry.vatAmount - entry.refundedVatAmount);

      results.push({
        productId: entry.productId,
        itemCode: entry.itemCode,
        productName: entry.productName,
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        completedOrdersCount: entry.orderSet.size,
        quantitySold: entry.quantitySold,
        originalPrice: entry.originalPrice,
        averageSalePrice: avgSalePrice,
        totalDiscount: entry.totalDiscount,
        taxPercentage: entry.taxPercentage,
        taxableAmount: entry.taxableAmount,
        vatAmount: entry.vatAmount,
        grossAmount: entry.grossRevenue,
        refundedVatAmount: entry.refundedVatAmount,
        netVatAmount: netVat,
      });
    }

    return results.sort((a, b) => b.vatAmount - a.vatAmount);
  }

  /**
   * Biểu đồ xu hướng thuế theo ngày (Daily VAT Trend)
   * Sử dụng completionTimestamp (deliveredAt || updatedAt)
   */
  aggregateTaxDailyTrends(calculatedOrders: CalculatedOrderTax[]): TaxDailyTrendItem[] {
    const trendMap = new Map<string, TaxDailyTrendItem>();

    for (const ord of calculatedOrders) {
      const d = ord.completionTimestamp;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const displayDate = `${dd}/${mm}/${yyyy}`;

      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, {
          dateKey,
          displayDate,
          completedOrdersCount: 0,
          itemsSold: 0,
          grossSales: 0,
          taxableRevenue: 0,
          nonTaxableRevenue: 0,
          totalVat: 0,
          refundedVat: 0,
          netVat: 0,
        });
      }

      const item = trendMap.get(dateKey)!;
      item.completedOrdersCount++;
      item.itemsSold += ord.totalItemCount;
      item.grossSales += ord.grossItemAmount + ord.serviceChargeTotal;
      item.totalVat += ord.vatTotalAmount;
      item.refundedVat += ord.refundedTaxTotal;
      item.netVat += ord.netVatTotal;

      for (const [rateStr, data] of Object.entries(ord.taxByRate)) {
        const rate = Number(rateStr);
        item.taxableRevenue += data.taxableAmount;
        if (rate === 0) {
          item.nonTaxableRevenue += data.taxableAmount;
        }
      }
    }

    return Array.from(trendMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }
}
