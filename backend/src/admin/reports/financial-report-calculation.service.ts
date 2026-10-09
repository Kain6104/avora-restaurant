import { Injectable } from '@nestjs/common';
import { getVietnamDateString } from '../../common/utils/vietnam-time.util';

/* ==========================================================================
   INTERFACES & TYPES FOR THE FINANCIAL CALCULATION ENGINE
   ========================================================================== */

export interface FinancialOrderItemOptionInput {
  id?: string;
  nameAtSale: string;
  priceAdjustmentAtSale: number;
  quantity?: number;
}

export interface FinancialProductInput {
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

export interface FinancialServiceChargeInput {
  id?: string;
  name: string;
  amount: number;
  isTaxable: boolean;
  taxPercentage?: number | null;
}

export interface FinancialPaymentRefundInput {
  id?: string;
  orderPaymentId?: string;
  amount: number;
  reason?: string | null;
  cashierId?: string | null;
  createdAt?: Date | string;
}

export interface FinancialOrderPaymentInput {
  id?: string;
  paymentMethod: string;
  amount: number;
  status: string;
  transactionRef?: string | null;
  cashReceived?: number | null;
  cashChange?: number | null;
  createdAt?: Date | string;
  refunds?: FinancialPaymentRefundInput[];
}

export interface FinancialVoucherInput {
  id: string;
  code: string;
  discountType: string; // PERCENTAGE, FIXED_AMOUNT, FREE_SHIP
  discountValue: number;
  applicableScope?: string; // ALL, POS, ONLINE
  applicableProductsScope?: string; // ALL, CATEGORY, SPECIFIC_PRODUCTS
  applicableCategoryIds?: string | null;
  applicableProductIds?: string | null;
}

export interface FinancialOrderInput {
  id: string;
  orderCode?: string | null;
  temporaryOrderCode?: string | null;
  branchId: string;
  branch?: {
    id: string;
    name: string;
    branchCode?: string;
    pointRedeemRate?: number;
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
  status: string; // 'DRAFT' | 'HELD' | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED'
  orderType?: string; // 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY' | 'ONLINE'
  orderSource?: string; // 'ONLINE' | 'POS' | 'WEB' | 'CHATBOT' | 'VOICE' | 'QR_ORDER' | 'ADMIN'
  tableId?: string | null;
  table?: { id: string; name?: string } | null;
  cashierId?: string | null;
  cashierName?: string | null;
  createdAt: Date | string;
  voucher?: FinancialVoucherInput | null;
  shippingVoucher?: FinancialVoucherInput | null;
  orderItems?: FinancialOrderItemInput[];
  payments?: FinancialOrderPaymentInput[];
  serviceCharges?: FinancialServiceChargeInput[];
}

export interface FinancialOrderItemInput {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  priceAtSale: number;
  originalPriceAtSale: number;
  discountAmount?: number; // Direct item discount per unit
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
  selectedOptions?: FinancialOrderItemOptionInput[];
  product?: FinancialProductInput;
  order?: FinancialOrderInput;
}

export interface CalculatedOrderItemFinancials {
  orderItemId: string;
  orderId: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPriceAtSale: number;
  originalPriceAtSale: number;
  grossLineTotal: number;

  // Options
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

  // Tax
  taxPercentage: number;
  vatPriceMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED';
  taxableAmount: number;
  taxAmount: number;
  revenueBeforeTax: number;
  revenueWithTax: number;
  taxCalculationSource: 'SNAPSHOT' | 'ZERO_TAX' | 'LEGACY_RECONSTRUCTED';
}

export interface CalculatedOrderFinancials {
  orderId: string;
  orderCode: string;
  createdAt: Date;
  branchId: string;
  branchName: string;
  customerName: string;
  customerPhone: string;
  cashierName: string;
  tableName: string;
  orderSource: string;
  orderType: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;

  // Item Aggregates
  totalItemCount: number;
  grossItemAmount: number;
  optionAmount: number;
  baseItemAmount: number;
  directItemDiscount: number;
  allocatedOrderDiscount: number;
  flashSaleDiscount: number;
  totalItemDiscount: number;
  netItemAmountAfterDiscount: number;

  // Order Level
  orderVoucherDiscount: number;
  shippingFeeOriginal: number;
  shippingDiscount: number;
  shippingFeeCustomerPaid: number;
  shippingFeeSubsidized: number;
  shippingVoucherCode: string | null;
  discountVoucherCode: string | null;

  // Service Charges
  serviceChargeTotal: number;
  serviceChargeTaxTotal: number;

  // VAT
  vatTotalAmount: number;
  taxableRevenueBeforeVat: number;
  revenueWithVat: number;
  vatPriceMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED';

  // Points
  pointsUsed: number;
  pointRedeemRate: number;
  pointsDiscount: number;

  // Sales Totals
  grossSales: number; // grossItemAmount + serviceChargeTotal
  netSales: number;   // grossSales - totalItemDiscount
  orderTotalAmount: number; // Stored totalAmount from DB

  // Cashflow & Payments
  collectedRevenue: number;
  outstandingRevenue: number;
  refundedAmount: number;
  netCollected: number;

  // Reconciliation Details
  reconciliation: OrderReconciliationResult;
  items: CalculatedOrderItemFinancials[];
}

export interface OrderReconciliationResult {
  isReconciled: boolean;
  errorCode?: 'OK' | 'RECONCILIATION_ERROR';
  expectedTotalAmount: number;
  actualTotalAmount: number;
  discrepancyTotal: number;

  expectedItemSubtotal: number;
  actualItemSubtotal: number;
  discrepancySubtotal: number;

  expectedTaxAmount: number;
  actualTaxAmount: number;
  discrepancyTax: number;

  expectedDiscountAllocated: number;
  actualDiscountAllocated: number;
  discrepancyDiscountAllocated: number;

  notes: string[];
}

export interface FinancialKPIsSummary {
  // Order Counts
  totalOrderCount: number;
  completedOrderCount: number;
  cancelledOrderCount: number;
  refundedOrderCount: number;
  distinctCustomerCount: number;
  totalItemsSold: number;

  // Revenue & Sales
  grossItemAmount: number;
  optionAmount: number;
  baseItemAmount: number;
  grossSales: number;
  netSales: number;
  revenueBeforeVat: number;
  revenueWithVat: number;

  // Discounts
  directItemDiscount: number;
  orderVoucherDiscount: number;
  flashSaleDiscount: number;
  pointsDiscount: number;
  totalDiscountOverall: number;

  // Shipping
  shippingFeeOriginal: number;
  shippingDiscount: number;
  shippingFeeCustomerPaid: number;
  shippingFeeSubsidized: number;

  // Service Charge & VAT
  serviceChargeTotal: number;
  serviceChargeTaxTotal: number;
  vatTotalAmount: number;

  // Customer Payable & Cashflow
  totalCustomerPayable: number;
  totalCollectedRevenue: number;
  totalOutstandingRevenue: number;
  totalRefundedAmount: number;
  netCollectedRevenue: number;

  // AOV
  averageOrderValue: number;

  // Reconciliation Health
  reconciliationHealth: {
    totalCheckedOrders: number;
    reconciledOrdersCount: number;
    unreconciledOrdersCount: number;
    reconciliationRatePercent: number;
    totalDiscrepancyAmount: number;
  };
}

export interface BranchFinancialSummary {
  branchId: string;
  branchCode: string;
  branchName: string;
  orderCount: number;
  completedOrderCount: number;
  cancelledOrderCount: number;
  grossSales: number;
  totalDiscount: number;
  netSales: number;
  vatAmount: number;
  shippingPaid: number;
  serviceCharge: number;
  totalPayable: number;
  collectedRevenue: number;
  outstandingRevenue: number;
  refundedAmount: number;
  netCollected: number;
  aov: number;
  itemsSold: number;
  unreconciledCount: number;
}

export interface PaymentMethodFinancialSummary {
  paymentMethod: string;
  orderCount: number;
  collectedAmount: number;
  refundedAmount: number;
  netCollectedAmount: number;
  sharePercent: number;
}

export interface VatRateFinancialSummary {
  rate: number;
  vatPriceMode: string;
  itemCount: number;
  taxableAmount: number;
  vatAmount: number;
  totalAmountWithTax: number;
}

export interface DiscountFinancialSummary {
  flashSaleDiscount: number;
  itemDirectDiscount: number;
  orderVoucherDiscount: number;
  shippingDiscount: number;
  pointsDiscount: number;
  totalDiscount: number;
}

export interface DailyRevenueFinancialSummary {
  dateStr: string; // YYYY-MM-DD
  orderCount: number;
  completedOrderCount: number;
  grossSales: number;
  netSales: number;
  vatAmount: number;
  collectedRevenue: number;
  refundedAmount: number;
  netCollected: number;
}

/* ==========================================================================
   CALCULATION SERVICE IMPLEMENTATION
   ========================================================================== */

@Injectable()
export class FinancialReportCalculationService {
  /**
   * Phân bổ Order Discount xuống từng dòng OrderItem theo tỷ trọng giá trị hợp lệ.
   * Áp dụng thuật toán Hare-Niemeyer (Largest Remainder Method) đảm bảo:
   * SUM(allocatedDiscounts) === orderDiscountAmount chính xác tuyệt đối, không lệch dù chỉ 1 đồng VND.
   */
  allocateOrderDiscount(
    items: FinancialOrderItemInput[],
    orderDiscountAmount: number,
    voucher?: FinancialVoucherInput | null,
  ): number[] {
    const totalDiscount = Math.max(0, Math.round(Number(orderDiscountAmount || 0)));
    if (totalDiscount <= 0 || !items || items.length === 0) {
      return new Array(items.length).fill(0);
    }

    const eligibleIndices: number[] = [];
    const eligibleBases: number[] = [];
    let sumEligibleBase = 0;

    items.forEach((item, idx) => {
      const qty = Math.max(1, Math.floor(Number(item.quantity || 1)));
      const unitPrice = Math.max(0, Math.round(Number(item.priceAtSale || 0)));
      const unitDirectDiscount = Math.max(0, Math.round(Number(item.discountAmount || 0)));
      const lineGross = Math.round(qty * unitPrice);
      const lineDirectDiscount = Math.min(lineGross, Math.round(qty * unitDirectDiscount));
      const lineEligibleBase = Math.max(0, lineGross - lineDirectDiscount);

      let isEligible = true;
      if (voucher && voucher.applicableProductsScope) {
        const scope = voucher.applicableProductsScope.toUpperCase();
        if (scope === 'CATEGORY' && voucher.applicableCategoryIds) {
          const allowedCats = voucher.applicableCategoryIds
            .split(',')
            .map((c) => c.trim().toLowerCase());
          const itemCatId = (item.product?.categoryId || item.product?.category?.id || '').toLowerCase();
          if (!allowedCats.includes(itemCatId)) {
            isEligible = false;
          }
        } else if (scope === 'SPECIFIC_PRODUCTS' && voucher.applicableProductIds) {
          const allowedProds = voucher.applicableProductIds
            .split(',')
            .map((p) => p.trim().toLowerCase());
          const itemProdId = (item.productId || '').toLowerCase();
          if (!allowedProds.includes(itemProdId)) {
            isEligible = false;
          }
        }
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

    // Sắp xếp phần dư giảm dần (Hare-Niemeyer rule)
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
   * Tính toán các chỉ số tài chính cho từng OrderItem riêng lẻ
   */
  calculateOrderItemFinancials(
    item: FinancialOrderItemInput,
    allocatedDiscount: number = 0,
    orderVatModeFallback: 'VAT_INCLUDED' | 'VAT_EXCLUDED' = 'VAT_INCLUDED',
  ): CalculatedOrderItemFinancials {
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

    // 2. Options / Topping
    const selectedOptions = item.selectedOptions || [];
    let unitOptionAdjustment = 0;
    selectedOptions.forEach((opt) => {
      const optQty = Math.max(1, Math.floor(Number(opt.quantity || 1)));
      unitOptionAdjustment += Math.round(Number(opt.priceAdjustmentAtSale || 0) * optQty);
    });

    const totalOptionAmount = Math.round(quantity * unitOptionAdjustment);
    const baseItemAmount = Math.max(0, grossLineTotal - totalOptionAmount);

    // 3. Direct discount & Allocated discount
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
    let revenueBeforeTax = netAmountAfterDiscount;
    let revenueWithTax = netAmountAfterDiscount;
    let taxCalculationSource: 'SNAPSHOT' | 'ZERO_TAX' | 'LEGACY_RECONSTRUCTED' = 'SNAPSHOT';

    const hasStoredSnapshot =
      (Number(item.taxableAmountAtSale) > 0 || Number(item.taxAmountAtSale) > 0) &&
      normalizedAllocatedDiscount === 0;

    if (taxRate === 0) {
      taxAmount = 0;
      taxableAmount = netAmountAfterDiscount;
      revenueBeforeTax = netAmountAfterDiscount;
      revenueWithTax = netAmountAfterDiscount;
      taxCalculationSource = 'ZERO_TAX';
    } else if (hasStoredSnapshot && item.taxAmountAtSale !== undefined) {
      taxAmount = Math.max(0, Math.round(Number(item.taxAmountAtSale)));
      taxableAmount = Math.max(0, Math.round(Number(item.taxableAmountAtSale)));
      if (isVatInclusive) {
        revenueBeforeTax = Math.max(0, netAmountAfterDiscount - taxAmount);
        revenueWithTax = netAmountAfterDiscount;
      } else {
        revenueBeforeTax = netAmountAfterDiscount;
        revenueWithTax = netAmountAfterDiscount + taxAmount;
      }
      taxCalculationSource = 'SNAPSHOT';
    } else {
      if (isVatInclusive) {
        taxAmount = Math.round((netAmountAfterDiscount * taxRate) / (100 + taxRate));
        revenueBeforeTax = Math.max(0, netAmountAfterDiscount - taxAmount);
        taxableAmount = revenueBeforeTax;
        revenueWithTax = netAmountAfterDiscount;
      } else {
        taxAmount = Math.round((netAmountAfterDiscount * taxRate) / 100);
        revenueBeforeTax = netAmountAfterDiscount;
        taxableAmount = netAmountAfterDiscount;
        revenueWithTax = netAmountAfterDiscount + taxAmount;
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
      revenueBeforeTax,
      revenueWithTax,
      taxCalculationSource,
    };
  }

  /**
   * Tính toán toàn diện số liệu tài chính cấp Đơn hàng và chạy Reconciliation Engine
   */
  calculateOrderFinancials(
    order: FinancialOrderInput,
    globalVatMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED' = 'VAT_INCLUDED',
  ): CalculatedOrderFinancials {
    const rawItems = order.orderItems || [];
    const orderDiscountAmount = Math.max(0, Math.round(Number(order.discountAmount || 0)));

    // 1. Phân bổ Order Discount bằng Largest Remainder
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
    let itemsRevenueBeforeTax = 0;
    let itemsRevenueWithTax = 0;

    const vatMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED' =
      (order.vatPriceModeSnapshot as any) || globalVatMode;

    const calculatedItems: CalculatedOrderItemFinancials[] = rawItems.map((item, idx) => {
      const calc = this.calculateOrderItemFinancials(item, allocatedDiscounts[idx], vatMode);
      grossItemAmount += calc.grossLineTotal;
      optionAmount += calc.totalOptionAmount;
      baseItemAmount += calc.baseItemAmount;
      directItemDiscount += calc.totalDirectDiscount;
      allocatedDiscountSum += calc.allocatedOrderDiscount;
      flashSaleDiscount += calc.flashSaleDiscount;
      netItemAmountAfterDiscount += calc.netAmountAfterDiscount;
      itemsTaxTotal += calc.taxAmount;
      itemsRevenueBeforeTax += calc.revenueBeforeTax;
      itemsRevenueWithTax += calc.revenueWithTax;
      return calc;
    });

    const totalItemDiscount = directItemDiscount + allocatedDiscountSum;

    // 3. Phụ phí dịch vụ (Service Charges)
    let serviceChargeTotal = Math.max(0, Math.round(Number(order.serviceChargeTotal || 0)));
    let serviceChargeTaxTotal = 0;

    if (order.serviceCharges && order.serviceCharges.length > 0) {
      let calcScTotal = 0;
      for (const sc of order.serviceCharges) {
        const scAmt = Math.max(0, Math.round(Number(sc.amount || 0)));
        calcScTotal += scAmt;
        if (sc.isTaxable) {
          const scRate = Math.max(0, Number(sc.taxPercentage ?? 10));
          if (scRate > 0 && scAmt > 0) {
            if (vatMode === 'VAT_INCLUDED') {
              serviceChargeTaxTotal += Math.round((scAmt * scRate) / (100 + scRate));
            } else {
              serviceChargeTaxTotal += Math.round((scAmt * scRate) / 100);
            }
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
    const revenueWithVat =
      vatMode === 'VAT_INCLUDED'
        ? netItemAmountAfterDiscount + serviceChargeTotal
        : netItemAmountAfterDiscount + serviceChargeTotal + vatTotalAmount;

    // 5. Vận chuyển (Shipping)
    const shippingFeeOriginal = Math.max(0, Math.round(Number(order.shippingFee || 0)));
    const shippingDiscount = Math.min(
      shippingFeeOriginal,
      Math.max(0, Math.round(Number(order.shippingDiscount || 0))),
    );
    const shippingFeeCustomerPaid = Math.max(0, shippingFeeOriginal - shippingDiscount);
    const shippingFeeSubsidized = shippingDiscount;

    // 6. Điểm loyalty (Points)
    const pointsUsed = Math.max(0, Math.floor(Number(order.pointsUsed || 0)));
    const pointRedeemRate = Math.max(1, Math.round(Number(order.branch?.pointRedeemRate || 1)));
    const pointsDiscount = Math.round(pointsUsed * pointRedeemRate);

    // 7. Doanh số (Sales Totals)
    const grossSales = grossItemAmount + serviceChargeTotal;
    const netSales = Math.max(0, grossSales - totalItemDiscount);

    // 8. Tổng tiền khách thanh toán (Stored vs Calculated Expected)
    const storedTotalAmount = Math.max(0, Math.round(Number(order.totalAmount || 0)));
    let expectedTotalAmount = 0;
    if (vatMode === 'VAT_EXCLUDED') {
      expectedTotalAmount = Math.max(
        0,
        grossItemAmount - orderDiscountAmount - pointsDiscount + serviceChargeTotal + vatTotalAmount,
      ) + shippingFeeCustomerPaid;
    } else {
      expectedTotalAmount = Math.max(
        0,
        grossItemAmount - orderDiscountAmount - pointsDiscount + serviceChargeTotal,
      ) + shippingFeeCustomerPaid;
    }

    // 9. Dòng tiền thực thu & Hoàn tiền (Cashflow)
    let collectedRevenue = 0;
    let refundedAmount = 0;

    const payments = order.payments || [];
    if (payments.length > 0) {
      for (const p of payments) {
        if (p.status === 'COMPLETED' || p.status === 'PAID') {
          collectedRevenue += Math.max(0, Math.round(Number(p.amount || 0)));
        }
        for (const rf of p.refunds || []) {
          refundedAmount += Math.max(0, Math.round(Number(rf.amount || 0)));
        }
      }
    } else {
      // Online order fallback nếu chưa có row OrderPayment
      if (order.paymentStatus === 'PAID' || order.status === 'COMPLETED') {
        collectedRevenue = storedTotalAmount;
      }
      if (order.paymentStatus === 'REFUNDED') {
        refundedAmount = storedTotalAmount;
      }
    }

    const netCollected = Math.max(0, collectedRevenue - refundedAmount);
    const outstandingRevenue =
      order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED' && order.status !== 'COMPLETED'
        ? Math.max(0, storedTotalAmount - collectedRevenue)
        : 0;

    // 10. RECONCILIATION ENGINE (Kiểm tra 4 Invariants)
    const reconciliation = this.reconcileOrder({
      order,
      grossItemAmount,
      orderDiscountAmount,
      allocatedDiscountSum,
      storedTotalAmount,
      expectedTotalAmount,
      vatTotalAmount,
      collectedRevenue,
      refundedAmount,
      netCollected,
    });

    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();

    return {
      orderId: order.id,
      orderCode: order.orderCode || order.temporaryOrderCode || order.id.substring(0, 8),
      createdAt,
      branchId: order.branchId || order.branch?.id || '',
      branchName: order.branch?.name || 'Chi nhánh mặc định',
      customerName: order.customerName || 'Khách vãng lai',
      customerPhone: order.customerPhone || '',
      cashierName: order.cashierName || 'N/A',
      tableName: order.table?.name || 'N/A',
      orderSource: order.orderSource || 'WEB',
      orderType: order.orderType || 'DELIVERY',
      orderStatus: order.status || 'COMPLETED',
      paymentStatus: order.paymentStatus || 'PENDING',
      paymentMethod: order.paymentMethod || 'COD',

      totalItemCount: calculatedItems.reduce((acc, it) => acc + it.quantity, 0),
      grossItemAmount,
      optionAmount,
      baseItemAmount,
      directItemDiscount,
      allocatedOrderDiscount: allocatedDiscountSum,
      flashSaleDiscount,
      totalItemDiscount,
      netItemAmountAfterDiscount,

      orderVoucherDiscount: orderDiscountAmount,
      shippingFeeOriginal,
      shippingDiscount,
      shippingFeeCustomerPaid,
      shippingFeeSubsidized,
      shippingVoucherCode: order.shippingVoucherCodeSnapshot || null,
      discountVoucherCode: order.discountVoucherCodeSnapshot || null,

      serviceChargeTotal,
      serviceChargeTaxTotal,

      vatTotalAmount,
      taxableRevenueBeforeVat,
      revenueWithVat,
      vatPriceMode: vatMode,

      pointsUsed,
      pointRedeemRate,
      pointsDiscount,

      grossSales,
      netSales,
      orderTotalAmount: storedTotalAmount,

      collectedRevenue,
      outstandingRevenue,
      refundedAmount,
      netCollected,

      reconciliation,
      items: calculatedItems,
    };
  }

  /**
   * Bộ kiểm tra đối soát toán học cho 1 Đơn hàng
   */
  private reconcileOrder(params: {
    order: FinancialOrderInput;
    grossItemAmount: number;
    orderDiscountAmount: number;
    allocatedDiscountSum: number;
    storedTotalAmount: number;
    expectedTotalAmount: number;
    vatTotalAmount: number;
    collectedRevenue: number;
    refundedAmount: number;
    netCollected: number;
  }): OrderReconciliationResult {
    const {
      order,
      grossItemAmount,
      orderDiscountAmount,
      allocatedDiscountSum,
      storedTotalAmount,
      expectedTotalAmount,
      vatTotalAmount,
      collectedRevenue,
      refundedAmount,
      netCollected,
    } = params;

    const notes: string[] = [];
    let isReconciled = true;

    // Invariant 1: Total Amount Invariant
    const discrepancyTotal = Math.abs(storedTotalAmount - expectedTotalAmount);
    if (discrepancyTotal > 0) {
      isReconciled = false;
      notes.push(
        `Lệch tổng tiền đơn: Lưu trữ = ${storedTotalAmount.toLocaleString('vi-VN')}₫, Tính toán = ${expectedTotalAmount.toLocaleString('vi-VN')}₫ (Lệch: ${discrepancyTotal.toLocaleString('vi-VN')}₫)`,
      );
    }

    // Invariant 2: Subtotal Consistency
    const storedSubtotal = Math.max(0, Math.round(Number(order.subTotal || 0)));
    const discrepancySubtotal = Math.abs(storedSubtotal - grossItemAmount);
    if (discrepancySubtotal > 0) {
      isReconciled = false;
      notes.push(
        `Lệch tiền hàng (Subtotal): Lưu trữ = ${storedSubtotal.toLocaleString('vi-VN')}₫, Tổng items = ${grossItemAmount.toLocaleString('vi-VN')}₫ (Lệch: ${discrepancySubtotal.toLocaleString('vi-VN')}₫)`,
      );
    }

    // Invariant 3: Voucher Discount Allocation Consistency
    const discrepancyDiscountAllocated = Math.abs(orderDiscountAmount - allocatedDiscountSum);
    if (discrepancyDiscountAllocated > 0 && grossItemAmount >= orderDiscountAmount) {
      isReconciled = false;
      notes.push(
        `Lệch phân bổ voucher: Voucher đơn = ${orderDiscountAmount.toLocaleString('vi-VN')}₫, Đã phân bổ = ${allocatedDiscountSum.toLocaleString('vi-VN')}₫`,
      );
    }

    // Invariant 4: Tax Amount Consistency (nếu đơn có lưu taxAmount > 0)
    const storedTax = Math.max(0, Math.round(Number(order.taxAmount || 0)));
    let discrepancyTax = 0;
    if (storedTax > 0) {
      discrepancyTax = Math.abs(storedTax - vatTotalAmount);
      if (discrepancyTax > 0) {
        notes.push(
          `Chênh lệch thuế VAT: Lưu trữ = ${storedTax.toLocaleString('vi-VN')}₫, Tính lại = ${vatTotalAmount.toLocaleString('vi-VN')}₫`,
        );
      }
    }

    // Invariant 5: Net Collected Consistency
    const expectedNetCollected = Math.max(0, collectedRevenue - refundedAmount);
    if (netCollected !== expectedNetCollected) {
      isReconciled = false;
      notes.push(
        `Lệch dòng tiền thực thu: Thực thu = ${collectedRevenue}, Hoàn trả = ${refundedAmount}, Net = ${netCollected}`,
      );
    }

    return {
      isReconciled,
      errorCode: isReconciled ? 'OK' : 'RECONCILIATION_ERROR',
      expectedTotalAmount,
      actualTotalAmount: storedTotalAmount,
      discrepancyTotal,

      expectedItemSubtotal: grossItemAmount,
      actualItemSubtotal: storedSubtotal,
      discrepancySubtotal,

      expectedTaxAmount: vatTotalAmount,
      actualTaxAmount: storedTax,
      discrepancyTax,

      expectedDiscountAllocated: orderDiscountAmount,
      actualDiscountAllocated: allocatedDiscountSum,
      discrepancyDiscountAllocated,

      notes,
    };
  }

  /**
   * Gom cụm toàn bộ KPI tài chính từ danh sách các đơn hàng đã tính toán
   * Đảm bảo: SUM(Branch KPI) === Global KPI chính xác 100%.
   */
  aggregateFinancialKPIs(orders: CalculatedOrderFinancials[]): {
    summary: FinancialKPIsSummary;
    branchBreakdown: BranchFinancialSummary[];
    paymentBreakdown: PaymentMethodFinancialSummary[];
    vatBreakdown: VatRateFinancialSummary[];
    discountBreakdown: DiscountFinancialSummary;
    dailyTrend: DailyRevenueFinancialSummary[];
  } {
    let totalOrderCount = 0;
    let completedOrderCount = 0;
    let cancelledOrderCount = 0;
    let refundedOrderCount = 0;
    let totalItemsSold = 0;

    let grossItemAmount = 0;
    let optionAmount = 0;
    let baseItemAmount = 0;
    let grossSales = 0;
    let netSales = 0;
    let revenueBeforeVat = 0;
    let revenueWithVat = 0;

    let directItemDiscount = 0;
    let orderVoucherDiscount = 0;
    let flashSaleDiscount = 0;
    let pointsDiscount = 0;
    let totalDiscountOverall = 0;

    let shippingFeeOriginal = 0;
    let shippingDiscount = 0;
    let shippingFeeCustomerPaid = 0;
    let shippingFeeSubsidized = 0;

    let serviceChargeTotal = 0;
    let serviceChargeTaxTotal = 0;
    let vatTotalAmount = 0;

    let totalCustomerPayable = 0;
    let totalCollectedRevenue = 0;
    let totalOutstandingRevenue = 0;
    let totalRefundedAmount = 0;
    let netCollectedRevenue = 0;

    let totalDiscrepancyAmount = 0;
    let unreconciledOrdersCount = 0;

    const seenCustomers = new Set<string>();
    const branchMap = new Map<string, BranchFinancialSummary>();
    const paymentMap = new Map<string, { collected: number; refunded: number; count: number }>();
    const vatRateMap = new Map<string, { rate: number; mode: string; count: number; taxable: number; vat: number; total: number }>();
    const dailyMap = new Map<string, DailyRevenueFinancialSummary>();

    for (const o of orders) {
      totalOrderCount++;
      const isCompleted = o.orderStatus === 'COMPLETED';
      const isCancelled = o.orderStatus === 'CANCELLED';
      const isRefunded = o.refundedAmount > 0 || o.paymentStatus === 'REFUNDED' || o.paymentStatus === 'PARTIALLY_REFUNDED';

      if (isCompleted) completedOrderCount++;
      if (isCancelled) cancelledOrderCount++;
      if (isRefunded) refundedOrderCount++;

      if (o.customerPhone) {
        seenCustomers.add(o.customerPhone);
      } else if (o.customerName) {
        seenCustomers.add(o.customerName);
      }

      if (!o.reconciliation.isReconciled) {
        unreconciledOrdersCount++;
        totalDiscrepancyAmount += o.reconciliation.discrepancyTotal;
      }

      // Doanh số & Món ăn (chỉ tính cho đơn thành công và đơn không hủy)
      if (!isCancelled) {
        grossItemAmount += o.grossItemAmount;
        optionAmount += o.optionAmount;
        baseItemAmount += o.baseItemAmount;
        grossSales += o.grossSales;
        netSales += o.netSales;
        revenueBeforeVat += o.taxableRevenueBeforeVat;
        revenueWithVat += o.revenueWithVat;

        directItemDiscount += o.directItemDiscount;
        orderVoucherDiscount += o.orderVoucherDiscount;
        flashSaleDiscount += o.flashSaleDiscount;
        pointsDiscount += o.pointsDiscount;
        totalDiscountOverall += (o.totalItemDiscount + o.pointsDiscount);

        shippingFeeOriginal += o.shippingFeeOriginal;
        shippingDiscount += o.shippingDiscount;
        shippingFeeCustomerPaid += o.shippingFeeCustomerPaid;
        shippingFeeSubsidized += o.shippingFeeSubsidized;

        serviceChargeTotal += o.serviceChargeTotal;
        serviceChargeTaxTotal += o.serviceChargeTaxTotal;
        vatTotalAmount += o.vatTotalAmount;

        totalCustomerPayable += o.orderTotalAmount;
      }

      if (isCompleted) {
        totalItemsSold += o.totalItemCount;
      }

      // Dòng tiền thực tế (Real Cashflow)
      totalCollectedRevenue += o.collectedRevenue;
      totalOutstandingRevenue += o.outstandingRevenue;
      totalRefundedAmount += o.refundedAmount;
      netCollectedRevenue += o.netCollected;

      // 1. Branch Aggregation
      if (!branchMap.has(o.branchId)) {
        branchMap.set(o.branchId, {
          branchId: o.branchId,
          branchCode: o.branchName ? o.branchName.substring(0, 4) : 'AVO',
          branchName: o.branchName,
          orderCount: 0,
          completedOrderCount: 0,
          cancelledOrderCount: 0,
          grossSales: 0,
          totalDiscount: 0,
          netSales: 0,
          vatAmount: 0,
          shippingPaid: 0,
          serviceCharge: 0,
          totalPayable: 0,
          collectedRevenue: 0,
          outstandingRevenue: 0,
          refundedAmount: 0,
          netCollected: 0,
          aov: 0,
          itemsSold: 0,
          unreconciledCount: 0,
        });
      }

      const b = branchMap.get(o.branchId)!;
      b.orderCount++;
      if (isCompleted) b.completedOrderCount++;
      if (isCancelled) b.cancelledOrderCount++;
      if (!o.reconciliation.isReconciled) b.unreconciledCount++;

      if (!isCancelled) {
        b.grossSales += o.grossSales;
        b.totalDiscount += (o.totalItemDiscount + o.pointsDiscount);
        b.netSales += o.netSales;
        b.vatAmount += o.vatTotalAmount;
        b.shippingPaid += o.shippingFeeCustomerPaid;
        b.serviceCharge += o.serviceChargeTotal;
        b.totalPayable += o.orderTotalAmount;
      }

      if (isCompleted) {
        b.itemsSold += o.totalItemCount;
      }

      b.collectedRevenue += o.collectedRevenue;
      b.outstandingRevenue += o.outstandingRevenue;
      b.refundedAmount += o.refundedAmount;
      b.netCollected += o.netCollected;

      // 2. Payment Method Breakdown
      const pMethod = (o.paymentMethod || 'COD').toUpperCase();
      if (!paymentMap.has(pMethod)) {
        paymentMap.set(pMethod, { collected: 0, refunded: 0, count: 0 });
      }
      const pData = paymentMap.get(pMethod)!;
      pData.count++;
      pData.collected += o.collectedRevenue;
      pData.refunded += o.refundedAmount;

      // 3. VAT Rate Breakdown
      if (!isCancelled) {
        for (const item of o.items) {
          const key = `${item.taxPercentage}_${item.vatPriceMode}`;
          if (!vatRateMap.has(key)) {
            vatRateMap.set(key, {
              rate: item.taxPercentage,
              mode: item.vatPriceMode,
              count: 0,
              taxable: 0,
              vat: 0,
              total: 0,
            });
          }
          const v = vatRateMap.get(key)!;
          v.count += item.quantity;
          v.taxable += item.taxableAmount;
          v.vat += item.taxAmount;
          v.total += item.revenueWithTax;
        }
      }

      // 4. Daily Revenue Breakdown (Theo chuẩn ngày lịch Việt Nam Asia/Ho_Chi_Minh)
      const dateStr = getVietnamDateString(o.createdAt);
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, {
          dateStr,
          orderCount: 0,
          completedOrderCount: 0,
          grossSales: 0,
          netSales: 0,
          vatAmount: 0,
          collectedRevenue: 0,
          refundedAmount: 0,
          netCollected: 0,
        });
      }
      const day = dailyMap.get(dateStr)!;
      day.orderCount++;
      if (isCompleted) day.completedOrderCount++;
      if (!isCancelled) {
        day.grossSales += o.grossSales;
        day.netSales += o.netSales;
        day.vatAmount += o.vatTotalAmount;
      }
      day.collectedRevenue += o.collectedRevenue;
      day.refundedAmount += o.refundedAmount;
      day.netCollected += o.netCollected;
    }

    // Tính AOV cho từng chi nhánh
    branchMap.forEach((b) => {
      b.aov = b.completedOrderCount > 0 ? Math.round(b.netSales / b.completedOrderCount) : 0;
    });

    const averageOrderValue =
      completedOrderCount > 0 ? Math.round(netSales / completedOrderCount) : 0;

    const reconciledOrdersCount = totalOrderCount - unreconciledOrdersCount;
    const reconciliationRatePercent =
      totalOrderCount > 0 ? Math.round((reconciledOrdersCount / totalOrderCount) * 1000) / 10 : 100;

    // Format danh sách chi nhánh
    const branchBreakdown: BranchFinancialSummary[] = Array.from(branchMap.values()).sort(
      (a, b) => b.netSales - a.netSales,
    );

    // Format phương thức thanh toán
    const totalCollectedForShare = totalCollectedRevenue > 0 ? totalCollectedRevenue : 1;
    const paymentBreakdown: PaymentMethodFinancialSummary[] = Array.from(paymentMap.entries())
      .map(([method, data]) => ({
        paymentMethod: method,
        orderCount: data.count,
        collectedAmount: data.collected,
        refundedAmount: data.refunded,
        netCollectedAmount: Math.max(0, data.collected - data.refunded),
        sharePercent: Math.round((data.collected / totalCollectedForShare) * 1000) / 10,
      }))
      .sort((a, b) => b.collectedAmount - a.collectedAmount);

    // Format phân rã VAT
    const vatBreakdown: VatRateFinancialSummary[] = Array.from(vatRateMap.values())
      .map((v) => ({
        rate: v.rate,
        vatPriceMode: v.mode,
        itemCount: v.count,
        taxableAmount: Math.round(v.taxable),
        vatAmount: Math.round(v.vat),
        totalAmountWithTax: Math.round(v.total),
      }))
      .sort((a, b) => a.rate - b.rate);

    // Format xu hướng ngày
    const dailyTrend: DailyRevenueFinancialSummary[] = Array.from(dailyMap.values()).sort((a, b) =>
      a.dateStr.localeCompare(b.dateStr),
    );

    const discountBreakdown: DiscountFinancialSummary = {
      flashSaleDiscount,
      itemDirectDiscount: directItemDiscount,
      orderVoucherDiscount,
      shippingDiscount,
      pointsDiscount,
      totalDiscount: totalDiscountOverall,
    };

    return {
      summary: {
        totalOrderCount,
        completedOrderCount,
        cancelledOrderCount,
        refundedOrderCount,
        distinctCustomerCount: seenCustomers.size,
        totalItemsSold,

        grossItemAmount,
        optionAmount,
        baseItemAmount,
        grossSales,
        netSales,
        revenueBeforeVat,
        revenueWithVat,

        directItemDiscount,
        orderVoucherDiscount,
        flashSaleDiscount,
        pointsDiscount,
        totalDiscountOverall,

        shippingFeeOriginal,
        shippingDiscount,
        shippingFeeCustomerPaid,
        shippingFeeSubsidized,

        serviceChargeTotal,
        serviceChargeTaxTotal,
        vatTotalAmount,

        totalCustomerPayable,
        totalCollectedRevenue,
        totalOutstandingRevenue,
        totalRefundedAmount,
        netCollectedRevenue,

        averageOrderValue,

        reconciliationHealth: {
          totalCheckedOrders: totalOrderCount,
          reconciledOrdersCount,
          unreconciledOrdersCount,
          reconciliationRatePercent,
          totalDiscrepancyAmount,
        },
      },
      branchBreakdown,
      paymentBreakdown,
      vatBreakdown,
      discountBreakdown,
      dailyTrend,
    };
  }
}
