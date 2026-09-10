import { Injectable } from '@nestjs/common';

/* ==========================================================================
   INTERFACES & TYPES FOR THE CALCULATION ENGINE
   ========================================================================== */

export interface RawOrderItemOptionInput {
  id?: string;
  optionItemId?: string;
  nameAtSale: string;
  priceAdjustmentAtSale: number;
}

export interface RawProductInput {
  id: string;
  itemCode?: string;
  name: string;
  slug?: string;
  price: number;
  taxPercentage?: number;
  unit?: string | null;
  imageUrl?: string | null;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    slug: string;
    displayOrder?: number;
  } | null;
}

export interface RawOrderServiceChargeInput {
  id?: string;
  name: string;
  amount: number;
  isTaxable: boolean;
  taxPercentage?: number | null;
}

export interface RawPaymentRefundInput {
  id?: string;
  amount: number;
  reason?: string | null;
  createdAt?: Date;
}

export interface RawOrderPaymentInput {
  id?: string;
  paymentMethod: string;
  amount: number;
  status: string;
  refunds?: RawPaymentRefundInput[];
}

export interface RawVoucherInput {
  id: string;
  code: string;
  discountType: string; // PERCENTAGE, FIXED_AMOUNT, FREE_SHIP
  discountValue: number;
  applicableScope?: string; // ALL, POS, ONLINE
  applicableProductsScope?: string; // ALL, CATEGORY, SPECIFIC_PRODUCTS
  applicableCategoryIds?: string | null;
  applicableProductIds?: string | null;
}

export interface RawOrderInput {
  id: string;
  orderCode?: string | null;
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
  paymentMethod?: string;
  paymentStatus?: string;
  pointsUsed?: number;
  status: string;
  orderType?: string; // DINE_IN, TAKEAWAY, DELIVERY, ONLINE
  orderSource?: string; // ONLINE, POS, WEB, CHATBOT, VOICE, QR_ORDER, ADMIN
  tableId?: string | null;
  table?: { id: string; name?: string } | null;
  cashierId?: string | null;
  cashierName?: string | null;
  createdAt: Date | string;
  voucher?: RawVoucherInput | null;
  shippingVoucher?: RawVoucherInput | null;
  payments?: RawOrderPaymentInput[];
  serviceCharges?: RawOrderServiceChargeInput[];
}

export interface RawOrderItemInput {
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
  taxPercentageAtSale?: number;
  taxableAmountAtSale?: number;
  taxAmountAtSale?: number;
  vatPriceModeSnapshot?: string | null;
  isVatInclusive?: boolean;
  selectedOptions?: RawOrderItemOptionInput[];
  product?: RawProductInput;
  order?: RawOrderInput;
}

export interface CalculatedOrderItem {
  orderItemId: string;
  orderId: string;
  orderCode: string;
  createdAt: Date;
  branchId: string;
  branchName: string;
  orderSource: string;
  orderType: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  cashierName: string;
  tableName: string;
  note: string;

  productId: string;
  productCode: string;
  productName: string;
  productSlug: string;
  productUnit: string;
  productImageUrl: string | null;
  categoryId: string;
  categoryName: string;

  quantity: number;
  originalPriceAtSale: number;
  priceAtSale: number;
  isFlashSaleItem: boolean;
  flashSaleId: string | null;

  // Options
  unitOptionPriceAdjustment: number;
  totalOptionRevenue: number;
  unitBasePrice: number;
  totalBaseRevenue: number;
  optionsTextSnapshot: string;
  selectedOptions: RawOrderItemOptionInput[];

  // Gross & Discounts
  grossLineTotal: number; // = quantity * priceAtSale = totalBaseRevenue + totalOptionRevenue
  unitDirectDiscount: number;
  totalDirectDiscount: number; // = quantity * unitDirectDiscount
  allocatedOrderDiscount: number;
  totalDiscount: number; // = totalDirectDiscount + allocatedOrderDiscount

  // After Discount
  netAmountAfterDiscount: number; // = Math.max(0, grossLineTotal - totalDiscount)

  // Tax (VAT)
  taxPercentage: number;
  vatPriceMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED';
  isVatInclusive: boolean;
  taxCalculationSource: 'SNAPSHOT' | 'ZERO_TAX' | 'LEGACY_RECONSTRUCTED';
  taxableAmount: number;
  taxAmount: number;
  revenueBeforeTax: number;
  revenueWithTax: number;

  // Associated Order Metrics (Order-Level)
  orderShippingFee: number;
  orderShippingDiscount: number;
  orderNetShippingFee: number;
  orderServiceChargeTotal: number;
  orderVoucherCode: string | null;
  orderShippingVoucherCode: string | null;
  orderRefundAmount: number;
}

export interface ProductReportKPIs {
  totalSoldQuantity: number;
  totalNetQuantity: number;
  totalOrderCount: number;
  distinctCustomerCount: number;

  grossProductSales: number; // Tiền hàng trước giảm
  optionRevenue: number; // Doanh thu option
  directItemDiscount: number; // Giảm giá trực tiếp item
  allocatedOrderDiscount: number; // Giảm giá cấp order phân bổ
  totalProductDiscount: number; // Tổng giảm giá liên quan sản phẩm
  netProductSalesAfterDiscount: number; // Doanh thu sau giảm
  productRevenueBeforeTax: number; // Doanh thu chưa VAT
  productTaxAmount: number; // Tổng VAT hàng hóa
  productRevenueWithTax: number; // Doanh thu có VAT

  // Order-Level Metrics (Strictly separated)
  orderShippingFeeTotal: number; // Phí ship gốc của đơn
  orderShippingDiscountTotal: number; // Giảm phí giao hàng
  orderNetShippingFeeTotal: number; // Phí giao hàng khách thực trả
  orderServiceChargeTotal: number; // Tổng phí dịch vụ
  orderServiceChargeTaxTotal: number; // VAT của phí dịch vụ
  orderRefundTotal: number; // Tiền hoàn đơn hàng
  netRevenueOverall: number; // Doanh thu ròng tổng thể

  // Secondary metrics
  flashSaleQuantity: number;
  flashSaleRevenue: number;
  normalQuantity: number;
  normalRevenue: number;
  avgUnitPrice: number;
}

export interface CategoryReportItem {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  displayOrder: number;
  soldQuantity: number;
  netQuantity: number;
  quantitySharePercent: number;
  grossAmount: number;
  optionRevenue: number;
  directItemDiscount: number;
  allocatedOrderDiscount: number;
  totalDiscount: number;
  amountAfterDiscount: number;
  revenueBeforeTax: number;
  taxAmount: number;
  revenueWithTax: number;
  revenueSharePercent: number;
  orderCount: number;
  relatedOrderShippingFee: number;
  relatedOrderServiceCharge: number;
  products: ProductReportRow[];
}

export interface ProductReportRow {
  productId: string;
  productCode: string;
  productName: string;
  productSlug: string;
  productUnit: string;
  productImageUrl: string | null;
  categoryId: string;
  categoryName: string;

  soldQuantity: number;
  netQuantity: number;
  quantitySharePercent: number;
  grossAmount: number;
  optionRevenue: number;
  directItemDiscount: number;
  allocatedOrderDiscount: number;
  totalDiscount: number;
  amountAfterDiscount: number;
  revenueBeforeTax: number;
  taxAmount: number;
  revenueWithTax: number;
  revenueSharePercent: number;

  avgUnitPrice: number;
  orderCount: number;
  vatRateDisplay: string; // e.g. "8%", "10%", or "Mixed (8%, 10%)"
  vatModeDisplay: string; // "Included", "Excluded", or "Mixed"

  relatedOrderShippingFee: number;
  relatedOrderServiceCharge: number;
}

export interface SingleProductDetailReport {
  currentProductInfo: {
    id: string;
    itemCode: string;
    name: string;
    slug: string;
    unit: string;
    currentPrice: number;
    currentTaxPercentage: number;
    imageUrl: string | null;
    category: { id: string; name: string };
  };
  kpis: ProductReportKPIs & {
    minSoldPrice: number;
    maxSoldPrice: number;
  };
  priceBreakdown: {
    price: number;
    originalPrice: number;
    type: 'FLASH_SALE' | 'PROMO' | 'NORMAL';
    quantity: number;
    grossRevenue: number;
    netRevenue: number;
  }[];
  vatBreakdown: {
    taxPercentage: number;
    vatPriceMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED';
    quantity: number;
    taxableAmount: number;
    taxAmount: number;
    totalAmountWithTax: number;
  }[];
  optionBreakdown: {
    optionItemId: string;
    optionName: string;
    optionGroupName: string;
    selectionCount: number;
    totalQuantity: number;
    avgPriceAdjustment: number;
    totalOptionRevenue: number;
    attachRatePercent: number;
  }[];
  branchBreakdown: {
    branchId: string;
    branchName: string;
    quantity: number;
    orderCount: number;
    revenue: number;
    taxAmount: number;
    contributionPercent: number;
  }[];
  channelBreakdown: {
    channel: string;
    quantity: number;
    orderCount: number;
    revenue: number;
    contributionPercent: number;
  }[];
  orderTypeBreakdown: {
    orderType: string;
    quantity: number;
    orderCount: number;
    revenue: number;
    contributionPercent: number;
  }[];
  trendBreakdown: {
    period: string; // Hour, Date, Week, or Month
    quantity: number;
    grossSales: number;
    totalDiscount: number;
    taxAmount: number;
    netRevenue: number;
  }[];
}

/* ==========================================================================
   CALCULATION SERVICE IMPLEMENTATION
   ========================================================================== */

@Injectable()
export class ProductReportCalculationService {
  /**
   * Tính toán phân bổ Order Discount xuống từng dòng OrderItem theo tỷ trọng giá trị hợp lệ
   * Áp dụng thuật toán Largest Remainder để đảm bảo:
   * SUM(allocatedOrderDiscount) === orderDiscountAmount (không sai 1 đồng VND).
   */
  allocateOrderDiscount(
    items: RawOrderItemInput[],
    orderDiscountAmount: number,
    voucher?: RawVoucherInput | null,
  ): number[] {
    const totalDiscount = Math.max(0, Math.round(Number(orderDiscountAmount || 0)));
    if (totalDiscount <= 0 || !items || items.length === 0) {
      return new Array(items.length).fill(0);
    }

    // Xác định các item đủ điều kiện nhận voucher
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
          const itemCatId = (item.product?.categoryId || '').toLowerCase();
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

    // Thuật toán Largest Remainder Rounding (Hare-Niemeyer method)
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

    // Sắp xếp phần dư giảm dần
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
   * Tính toán toàn diện số liệu tài chính cho 1 OrderItem
   */
  calculateOrderItemFinancials(
    item: RawOrderItemInput,
    allocatedDiscount: number = 0,
    orderVatModeFallback: 'VAT_INCLUDED' | 'VAT_EXCLUDED' = 'VAT_INCLUDED',
  ): CalculatedOrderItem {
    const order = item.order;
    const product = item.product;

    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
    const priceAtSale = Math.max(0, Math.round(Number(item.priceAtSale || 0)));
    const originalPriceAtSale = Math.max(
      0,
      Math.round(Number(item.originalPriceAtSale || product?.price || priceAtSale)),
    );

    // 1. Gross line total
    const grossLineTotal = Math.round(quantity * priceAtSale);

    // 2. Options breakdown:
    // Kiểm chứng: priceAtSale trong AVORA đã chứa option price adjustments.
    const selectedOptions = item.selectedOptions || [];
    let unitOptionPriceAdjustment = 0;
    selectedOptions.forEach((opt) => {
      unitOptionPriceAdjustment += Math.round(Number(opt.priceAdjustmentAtSale || 0));
    });

    const totalOptionRevenue = Math.round(quantity * unitOptionPriceAdjustment);
    const unitBasePrice = Math.max(0, priceAtSale - unitOptionPriceAdjustment);
    const totalBaseRevenue = Math.max(0, grossLineTotal - totalOptionRevenue);

    // 3. Discounts:
    const unitDirectDiscount = Math.max(0, Math.round(Number(item.discountAmount || 0)));
    const totalDirectDiscount = Math.min(grossLineTotal, Math.round(quantity * unitDirectDiscount));
    const normalizedAllocatedDiscount = Math.min(
      Math.max(0, grossLineTotal - totalDirectDiscount),
      Math.max(0, Math.round(allocatedDiscount)),
    );
    const totalDiscount = totalDirectDiscount + normalizedAllocatedDiscount;
    const netAmountAfterDiscount = Math.max(0, grossLineTotal - totalDiscount);

    // 4. VAT Tax Calculation
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
      // Sử dụng trực tiếp snapshot khi không bị tái phân bổ discount khác
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
      // Reconstructed theo công thức chuẩn tài chính
      if (isVatInclusive) {
        // Thuế gồm trong giá: Tax = Net * r / (100 + r)
        taxAmount = Math.round((netAmountAfterDiscount * taxRate) / (100 + taxRate));
        revenueBeforeTax = netAmountAfterDiscount - taxAmount;
        taxableAmount = revenueBeforeTax;
        revenueWithTax = netAmountAfterDiscount;
      } else {
        // Thuế chưa gồm trong giá: Tax = Net * r / 100
        taxAmount = Math.round((netAmountAfterDiscount * taxRate) / 100);
        revenueBeforeTax = netAmountAfterDiscount;
        taxableAmount = netAmountAfterDiscount;
        revenueWithTax = netAmountAfterDiscount + taxAmount;
      }
      taxCalculationSource =
        item.taxPercentageAtSale !== undefined ? 'SNAPSHOT' : 'LEGACY_RECONSTRUCTED';
    }

    // 5. Order-level metrics
    const orderShippingFee = Math.max(0, Math.round(Number(order?.shippingFee || 0)));
    const orderShippingDiscount = Math.max(0, Math.round(Number(order?.shippingDiscount || 0)));
    const orderNetShippingFee = Math.max(0, orderShippingFee - orderShippingDiscount);
    const orderServiceChargeTotal = Math.max(
      0,
      Math.round(Number(order?.serviceChargeTotal || 0)),
    );

    let orderRefundAmount = 0;
    if (order?.payments) {
      for (const p of order.payments) {
        for (const rf of p.refunds || []) {
          orderRefundAmount += Math.max(0, Math.round(Number(rf.amount || 0)));
        }
      }
    }

    const createdAt = order?.createdAt ? new Date(order.createdAt) : new Date();

    return {
      orderItemId: item.id,
      orderId: item.orderId,
      orderCode: order?.orderCode || order?.id?.substring(0, 8) || '',
      createdAt,
      branchId: order?.branchId || order?.branch?.id || '',
      branchName: order?.branch?.name || 'Chi nhánh mặc định',
      orderSource: order?.orderSource || 'WEB',
      orderType: order?.orderType || 'DELIVERY',
      orderStatus: order?.status || 'COMPLETED',
      paymentStatus: order?.paymentStatus || 'COMPLETED',
      paymentMethod: order?.paymentMethod || 'COD',
      customerName: order?.customerName || 'Khách vãng lai',
      customerPhone: order?.customerPhone || '',
      cashierName: order?.cashierName || 'N/A',
      tableName: order?.table?.name || 'N/A',
      note: item.note || '',

      productId: item.productId,
      productCode: product?.itemCode || '',
      productName: product?.name || 'Món ăn',
      productSlug: product?.slug || '',
      productUnit: product?.unit || 'phần',
      productImageUrl: product?.imageUrl || null,
      categoryId: product?.categoryId || product?.category?.id || 'UNCATEGORIZED',
      categoryName: product?.category?.name || 'Chưa phân loại',

      quantity,
      originalPriceAtSale,
      priceAtSale,
      isFlashSaleItem: !!item.isFlashSaleItem,
      flashSaleId: item.flashSaleId || null,

      unitOptionPriceAdjustment,
      totalOptionRevenue,
      unitBasePrice,
      totalBaseRevenue,
      optionsTextSnapshot: item.optionsTextSnapshot || '',
      selectedOptions,

      grossLineTotal,
      unitDirectDiscount,
      totalDirectDiscount,
      allocatedOrderDiscount: normalizedAllocatedDiscount,
      totalDiscount,

      netAmountAfterDiscount,

      taxPercentage: taxRate,
      vatPriceMode: vatMode,
      isVatInclusive,
      taxCalculationSource,
      taxableAmount,
      taxAmount,
      revenueBeforeTax,
      revenueWithTax,

      orderShippingFee,
      orderShippingDiscount,
      orderNetShippingFee,
      orderServiceChargeTotal,
      orderVoucherCode: order?.discountVoucherCodeSnapshot || null,
      orderShippingVoucherCode: order?.shippingVoucherCodeSnapshot || null,
      orderRefundAmount,
    };
  }

  /**
   * Tính toán các chỉ số tài chính cấp Đơn hàng (Order-Level Metrics)
   * Duyệt qua DISTINCT Order để tuyệt đối không nhân thừa phí ship hoặc phụ phí theo số item.
   */
  calculateOrderLevelMetrics(orders: RawOrderInput[]): {
    distinctOrderCount: number;
    distinctCustomerCount: number;
    shippingFeeTotal: number;
    shippingDiscountTotal: number;
    netShippingFeeTotal: number;
    serviceChargeTotal: number;
    serviceChargeTaxTotal: number;
    orderRefundTotal: number;
  } {
    const seenOrderIds = new Set<string>();
    const seenCustomers = new Set<string>();

    let shippingFeeTotal = 0;
    let shippingDiscountTotal = 0;
    let netShippingFeeTotal = 0;
    let serviceChargeTotal = 0;
    let serviceChargeTaxTotal = 0;
    let orderRefundTotal = 0;

    for (const order of orders) {
      if (!order || seenOrderIds.has(order.id)) continue;
      seenOrderIds.add(order.id);

      if (order.customerPhone) {
        seenCustomers.add(order.customerPhone);
      } else if (order.userId) {
        seenCustomers.add(order.userId);
      } else if (order.customerName) {
        seenCustomers.add(order.customerName);
      }

      const ship = Math.max(0, Math.round(Number(order.shippingFee || 0)));
      const shipDisc = Math.max(0, Math.round(Number(order.shippingDiscount || 0)));
      const netShip = Math.max(0, ship - shipDisc);

      shippingFeeTotal += ship;
      shippingDiscountTotal += shipDisc;
      netShippingFeeTotal += netShip;

      const scTotal = Math.max(0, Math.round(Number(order.serviceChargeTotal || 0)));
      serviceChargeTotal += scTotal;

      // Tính VAT phụ phí dịch vụ nếu có
      const vatMode = order.vatPriceModeSnapshot || 'VAT_INCLUDED';
      for (const sc of order.serviceCharges || []) {
        if (sc.isTaxable) {
          const scAmt = Math.max(0, Math.round(Number(sc.amount || 0)));
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

      // Hoàn tiền thanh toán
      for (const p of order.payments || []) {
        for (const rf of p.refunds || []) {
          orderRefundTotal += Math.max(0, Math.round(Number(rf.amount || 0)));
        }
      }
    }

    return {
      distinctOrderCount: seenOrderIds.size,
      distinctCustomerCount: seenCustomers.size,
      shippingFeeTotal,
      shippingDiscountTotal,
      netShippingFeeTotal,
      serviceChargeTotal,
      serviceChargeTaxTotal,
      orderRefundTotal,
    };
  }

  /**
   * Tính toán toàn bộ 19 chỉ số KPI tổng quan từ danh sách OrderItem đã tính toán và Orders
   */
  calculateReportKPIs(
    calculatedItems: CalculatedOrderItem[],
    uniqueOrders: RawOrderInput[],
  ): ProductReportKPIs {
    let totalSoldQuantity = 0;
    let grossProductSales = 0;
    let optionRevenue = 0;
    let directItemDiscount = 0;
    let allocatedOrderDiscount = 0;
    let totalProductDiscount = 0;
    let netProductSalesAfterDiscount = 0;
    let productRevenueBeforeTax = 0;
    let productTaxAmount = 0;
    let productRevenueWithTax = 0;

    let flashSaleQuantity = 0;
    let flashSaleRevenue = 0;
    let normalQuantity = 0;
    let normalRevenue = 0;

    for (const item of calculatedItems) {
      totalSoldQuantity += item.quantity;
      grossProductSales += item.grossLineTotal;
      optionRevenue += item.totalOptionRevenue;
      directItemDiscount += item.totalDirectDiscount;
      allocatedOrderDiscount += item.allocatedOrderDiscount;
      totalProductDiscount += item.totalDiscount;
      netProductSalesAfterDiscount += item.netAmountAfterDiscount;
      productRevenueBeforeTax += item.revenueBeforeTax;
      productTaxAmount += item.taxAmount;
      productRevenueWithTax += item.revenueWithTax;

      if (item.isFlashSaleItem) {
        flashSaleQuantity += item.quantity;
        flashSaleRevenue += item.revenueWithTax;
      } else {
        normalQuantity += item.quantity;
        normalRevenue += item.revenueWithTax;
      }
    }

    const orderMetrics = this.calculateOrderLevelMetrics(uniqueOrders);

    // Doanh thu ròng tổng thể (Net Overall Revenue):
    // Doanh thu hàng hóa có VAT + Phí ship thực thu + Phụ phí dịch vụ (+ VAT phụ phí nếu Excluded) - Tiền hoàn trả
    const netRevenueOverall = Math.max(
      0,
      productRevenueWithTax +
        orderMetrics.netShippingFeeTotal +
        orderMetrics.serviceChargeTotal -
        orderMetrics.orderRefundTotal,
    );

    const avgUnitPrice =
      totalSoldQuantity > 0 ? Math.round(productRevenueWithTax / totalSoldQuantity) : 0;

    return {
      totalSoldQuantity,
      totalNetQuantity: totalSoldQuantity,
      totalOrderCount: orderMetrics.distinctOrderCount,
      distinctCustomerCount: orderMetrics.distinctCustomerCount,

      grossProductSales,
      optionRevenue,
      directItemDiscount,
      allocatedOrderDiscount,
      totalProductDiscount,
      netProductSalesAfterDiscount,
      productRevenueBeforeTax,
      productTaxAmount,
      productRevenueWithTax,

      orderShippingFeeTotal: orderMetrics.shippingFeeTotal,
      orderShippingDiscountTotal: orderMetrics.shippingDiscountTotal,
      orderNetShippingFeeTotal: orderMetrics.netShippingFeeTotal,
      orderServiceChargeTotal: orderMetrics.serviceChargeTotal,
      orderServiceChargeTaxTotal: orderMetrics.serviceChargeTaxTotal,
      orderRefundTotal: orderMetrics.orderRefundTotal,
      netRevenueOverall,

      flashSaleQuantity,
      flashSaleRevenue,
      normalQuantity,
      normalRevenue,
      avgUnitPrice,
    };
  }

  /**
   * Gom nhóm cây Danh mục + Mặt hàng (Collapsible Tree Table)
   */
  buildCategoryAndProductTree(
    calculatedItems: CalculatedOrderItem[],
    totalOverallSoldQuantity: number,
    totalOverallRevenue: number,
  ): CategoryReportItem[] {
    const categoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        displayOrder: number;
        items: CalculatedOrderItem[];
      }
    >();

    for (const it of calculatedItems) {
      const catId = it.categoryId || 'UNCATEGORIZED';
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: it.categoryName || 'Chưa phân loại',
          slug: it.productSlug || 'uncategorized',
          displayOrder: 0,
          items: [],
        });
      }
      categoryMap.get(catId)!.items.push(it);
    }

    const categories: CategoryReportItem[] = [];

    for (const [catId, catData] of categoryMap.entries()) {
      // Gom nhóm theo từng Product trong Category
      const productMap = new Map<string, CalculatedOrderItem[]>();
      for (const it of catData.items) {
        if (!productMap.has(it.productId)) {
          productMap.set(it.productId, []);
        }
        productMap.get(it.productId)!.push(it);
      }

      let catSoldQuantity = 0;
      let catGrossAmount = 0;
      let catOptionRevenue = 0;
      let catDirectItemDiscount = 0;
      let catAllocatedOrderDiscount = 0;
      let catTotalDiscount = 0;
      let catAmountAfterDiscount = 0;
      let catRevenueBeforeTax = 0;
      let catTaxAmount = 0;
      let catRevenueWithTax = 0;
      const catOrderIds = new Set<string>();

      let catRelatedShipping = 0;
      let catRelatedServiceCharge = 0;
      const catSeenShippingOrders = new Set<string>();

      const productRows: ProductReportRow[] = [];

      for (const [prodId, pItems] of productMap.entries()) {
        const first = pItems[0];
        let pQty = 0;
        let pGross = 0;
        let pOptionRev = 0;
        let pDirectDisc = 0;
        let pAllocatedDisc = 0;
        let pTotalDisc = 0;
        let pAfterDisc = 0;
        let pBeforeTax = 0;
        let pTax = 0;
        let pWithTax = 0;
        const pOrderIds = new Set<string>();
        const pTaxRates = new Set<number>();
        const pTaxModes = new Set<string>();

        let pRelatedShipping = 0;
        let pRelatedServiceCharge = 0;
        const pSeenShippingOrders = new Set<string>();

        for (const it of pItems) {
          pQty += it.quantity;
          pGross += it.grossLineTotal;
          pOptionRev += it.totalOptionRevenue;
          pDirectDisc += it.totalDirectDiscount;
          pAllocatedDisc += it.allocatedOrderDiscount;
          pTotalDisc += it.totalDiscount;
          pAfterDisc += it.netAmountAfterDiscount;
          pBeforeTax += it.revenueBeforeTax;
          pTax += it.taxAmount;
          pWithTax += it.revenueWithTax;
          pOrderIds.add(it.orderId);
          pTaxRates.add(it.taxPercentage);
          pTaxModes.add(it.vatPriceMode);

          if (!pSeenShippingOrders.has(it.orderId)) {
            pSeenShippingOrders.add(it.orderId);
            pRelatedShipping += it.orderNetShippingFee;
            pRelatedServiceCharge += it.orderServiceChargeTotal;
          }

          if (!catSeenShippingOrders.has(it.orderId)) {
            catSeenShippingOrders.add(it.orderId);
            catRelatedShipping += it.orderNetShippingFee;
            catRelatedServiceCharge += it.orderServiceChargeTotal;
          }
        }

        catSoldQuantity += pQty;
        catGrossAmount += pGross;
        catOptionRevenue += pOptionRev;
        catDirectItemDiscount += pDirectDisc;
        catAllocatedOrderDiscount += pAllocatedDisc;
        catTotalDiscount += pTotalDisc;
        catAmountAfterDiscount += pAfterDisc;
        catRevenueBeforeTax += pBeforeTax;
        catTaxAmount += pTax;
        catRevenueWithTax += pWithTax;
        pOrderIds.forEach((id) => catOrderIds.add(id));

        const pQtyShare =
          totalOverallSoldQuantity > 0 ? (pQty / totalOverallSoldQuantity) * 100 : 0;
        const pRevShare = totalOverallRevenue > 0 ? (pWithTax / totalOverallRevenue) * 100 : 0;
        const pAvgPrice = pQty > 0 ? Math.round(pWithTax / pQty) : 0;

        let vatRateDisplay = '0%';
        if (pTaxRates.size === 1) {
          vatRateDisplay = `${Array.from(pTaxRates)[0]}%`;
        } else if (pTaxRates.size > 1) {
          vatRateDisplay = `Hỗn hợp (${Array.from(pTaxRates)
            .sort((a, b) => a - b)
            .map((r) => `${r}%`)
            .join(', ')})`;
        }

        let vatModeDisplay = 'Included';
        if (pTaxModes.size === 1) {
          vatModeDisplay =
            Array.from(pTaxModes)[0] === 'VAT_INCLUDED' ? 'Giá gồm VAT' : 'Giá chưa VAT';
        } else if (pTaxModes.size > 1) {
          vatModeDisplay = 'Hỗn hợp';
        }

        productRows.push({
          productId: prodId,
          productCode: first.productCode,
          productName: first.productName,
          productSlug: first.productSlug,
          productUnit: first.productUnit,
          productImageUrl: first.productImageUrl,
          categoryId: catId,
          categoryName: catData.name,
          soldQuantity: pQty,
          netQuantity: pQty,
          quantitySharePercent: Number(pQtyShare.toFixed(2)),
          grossAmount: pGross,
          optionRevenue: pOptionRev,
          directItemDiscount: pDirectDisc,
          allocatedOrderDiscount: pAllocatedDisc,
          totalDiscount: pTotalDisc,
          amountAfterDiscount: pAfterDisc,
          revenueBeforeTax: pBeforeTax,
          taxAmount: pTax,
          revenueWithTax: pWithTax,
          revenueSharePercent: Number(pRevShare.toFixed(2)),
          avgUnitPrice: pAvgPrice,
          orderCount: pOrderIds.size,
          vatRateDisplay,
          vatModeDisplay,
          relatedOrderShippingFee: pRelatedShipping,
          relatedOrderServiceCharge: pRelatedServiceCharge,
        });
      }

      productRows.sort((a, b) => b.revenueWithTax - a.revenueWithTax);

      const catQtyShare =
        totalOverallSoldQuantity > 0 ? (catSoldQuantity / totalOverallSoldQuantity) * 100 : 0;
      const catRevShare =
        totalOverallRevenue > 0 ? (catRevenueWithTax / totalOverallRevenue) * 100 : 0;

      categories.push({
        categoryId: catId,
        categoryName: catData.name,
        categorySlug: catData.slug,
        displayOrder: catData.displayOrder,
        soldQuantity: catSoldQuantity,
        netQuantity: catSoldQuantity,
        quantitySharePercent: Number(catQtyShare.toFixed(2)),
        grossAmount: catGrossAmount,
        optionRevenue: catOptionRevenue,
        directItemDiscount: catDirectItemDiscount,
        allocatedOrderDiscount: catAllocatedOrderDiscount,
        totalDiscount: catTotalDiscount,
        amountAfterDiscount: catAmountAfterDiscount,
        revenueBeforeTax: catRevenueBeforeTax,
        taxAmount: catTaxAmount,
        revenueWithTax: catRevenueWithTax,
        revenueSharePercent: Number(catRevShare.toFixed(2)),
        orderCount: catOrderIds.size,
        relatedOrderShippingFee: catRelatedShipping,
        relatedOrderServiceCharge: catRelatedServiceCharge,
        products: productRows,
      });
    }

    categories.sort((a, b) => b.revenueWithTax - a.revenueWithTax);
    return categories;
  }

  /**
   * Tạo báo cáo chi tiết chuyên sâu 1 mặt hàng
   */
  buildSingleProductDeepDive(
    product: RawProductInput,
    items: CalculatedOrderItem[],
    uniqueOrders: RawOrderInput[],
    trendGrouping: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): SingleProductDetailReport {
    const kpis = this.calculateReportKPIs(items, uniqueOrders);

    let minSoldPrice = Number.MAX_SAFE_INTEGER;
    let maxSoldPrice = 0;

    // 1. Price Breakdown
    const priceGroupMap = new Map<
      string,
      {
        price: number;
        originalPrice: number;
        type: 'FLASH_SALE' | 'PROMO' | 'NORMAL';
        quantity: number;
        grossRevenue: number;
        netRevenue: number;
      }
    >();

    // 2. VAT Breakdown
    const vatGroupMap = new Map<
      string,
      {
        taxPercentage: number;
        vatPriceMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED';
        quantity: number;
        taxableAmount: number;
        taxAmount: number;
        totalAmountWithTax: number;
      }
    >();

    // 3. Option Breakdown
    const optionGroupMap = new Map<
      string,
      {
        optionItemId: string;
        optionName: string;
        optionGroupName: string;
        selectionCount: number;
        totalQuantity: number;
        totalAdjustmentSum: number;
        totalOptionRevenue: number;
      }
    >();

    // 4. Branch Breakdown
    const branchMap = new Map<
      string,
      {
        branchId: string;
        branchName: string;
        quantity: number;
        orderIds: Set<string>;
        revenue: number;
        taxAmount: number;
      }
    >();

    // 5. Channel Breakdown
    const channelMap = new Map<
      string,
      {
        channel: string;
        quantity: number;
        orderIds: Set<string>;
        revenue: number;
      }
    >();

    // 6. Order Type Breakdown
    const orderTypeMap = new Map<
      string,
      {
        orderType: string;
        quantity: number;
        orderIds: Set<string>;
        revenue: number;
      }
    >();

    // 7. Trend Breakdown
    const trendMap = new Map<
      string,
      {
        period: string;
        quantity: number;
        grossSales: number;
        totalDiscount: number;
        taxAmount: number;
        netRevenue: number;
      }
    >();

    const totalProductRevenue = kpis.productRevenueWithTax;

    for (const it of items) {
      if (it.priceAtSale < minSoldPrice) minSoldPrice = it.priceAtSale;
      if (it.priceAtSale > maxSoldPrice) maxSoldPrice = it.priceAtSale;

      // Price breakdown key
      let pType: 'FLASH_SALE' | 'PROMO' | 'NORMAL' = 'NORMAL';
      if (it.isFlashSaleItem) {
        pType = 'FLASH_SALE';
      } else if (it.originalPriceAtSale > it.priceAtSale) {
        pType = 'PROMO';
      }
      const priceKey = `${it.priceAtSale}_${it.originalPriceAtSale}_${pType}`;
      if (!priceGroupMap.has(priceKey)) {
        priceGroupMap.set(priceKey, {
          price: it.priceAtSale,
          originalPrice: it.originalPriceAtSale,
          type: pType,
          quantity: 0,
          grossRevenue: 0,
          netRevenue: 0,
        });
      }
      const pEntry = priceGroupMap.get(priceKey)!;
      pEntry.quantity += it.quantity;
      pEntry.grossRevenue += it.grossLineTotal;
      pEntry.netRevenue += it.revenueWithTax;

      // VAT breakdown key
      const vatKey = `${it.taxPercentage}_${it.vatPriceMode}`;
      if (!vatGroupMap.has(vatKey)) {
        vatGroupMap.set(vatKey, {
          taxPercentage: it.taxPercentage,
          vatPriceMode: it.vatPriceMode,
          quantity: 0,
          taxableAmount: 0,
          taxAmount: 0,
          totalAmountWithTax: 0,
        });
      }
      const vatEntry = vatGroupMap.get(vatKey)!;
      vatEntry.quantity += it.quantity;
      vatEntry.taxableAmount += it.taxableAmount;
      vatEntry.taxAmount += it.taxAmount;
      vatEntry.totalAmountWithTax += it.revenueWithTax;

      // Option breakdown
      for (const opt of it.selectedOptions) {
        const optKey = opt.optionItemId || opt.nameAtSale;
        if (!optionGroupMap.has(optKey)) {
          optionGroupMap.set(optKey, {
            optionItemId: opt.optionItemId || optKey,
            optionName: opt.nameAtSale,
            optionGroupName: 'Tùy chọn',
            selectionCount: 0,
            totalQuantity: 0,
            totalAdjustmentSum: 0,
            totalOptionRevenue: 0,
          });
        }
        const optEntry = optionGroupMap.get(optKey)!;
        optEntry.selectionCount += 1;
        optEntry.totalQuantity += it.quantity;
        optEntry.totalAdjustmentSum += opt.priceAdjustmentAtSale;
        optEntry.totalOptionRevenue += it.quantity * opt.priceAdjustmentAtSale;
      }

      // Branch breakdown
      const bKey = it.branchId || 'default_branch';
      if (!branchMap.has(bKey)) {
        branchMap.set(bKey, {
          branchId: bKey,
          branchName: it.branchName,
          quantity: 0,
          orderIds: new Set<string>(),
          revenue: 0,
          taxAmount: 0,
        });
      }
      const bEntry = branchMap.get(bKey)!;
      bEntry.quantity += it.quantity;
      bEntry.orderIds.add(it.orderId);
      bEntry.revenue += it.revenueWithTax;
      bEntry.taxAmount += it.taxAmount;

      // Channel breakdown
      const chKey = it.orderSource || 'WEB';
      if (!channelMap.has(chKey)) {
        channelMap.set(chKey, {
          channel: chKey,
          quantity: 0,
          orderIds: new Set<string>(),
          revenue: 0,
        });
      }
      const chEntry = channelMap.get(chKey)!;
      chEntry.quantity += it.quantity;
      chEntry.orderIds.add(it.orderId);
      chEntry.revenue += it.revenueWithTax;

      // Order type breakdown
      const otKey = it.orderType || 'DELIVERY';
      if (!orderTypeMap.has(otKey)) {
        orderTypeMap.set(otKey, {
          orderType: otKey,
          quantity: 0,
          orderIds: new Set<string>(),
          revenue: 0,
        });
      }
      const otEntry = orderTypeMap.get(otKey)!;
      otEntry.quantity += it.quantity;
      otEntry.orderIds.add(it.orderId);
      otEntry.revenue += it.revenueWithTax;

      // Trend period
      let periodKey = '';
      const d = it.createdAt;
      if (trendGrouping === 'hour') {
        periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
      } else if (trendGrouping === 'week') {
        const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
        const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        periodKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      } else if (trendGrouping === 'month') {
        periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        // default 'day'
        periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      if (!trendMap.has(periodKey)) {
        trendMap.set(periodKey, {
          period: periodKey,
          quantity: 0,
          grossSales: 0,
          totalDiscount: 0,
          taxAmount: 0,
          netRevenue: 0,
        });
      }
      const trEntry = trendMap.get(periodKey)!;
      trEntry.quantity += it.quantity;
      trEntry.grossSales += it.grossLineTotal;
      trEntry.totalDiscount += it.totalDiscount;
      trEntry.taxAmount += it.taxAmount;
      trEntry.netRevenue += it.revenueWithTax;
    }

    if (minSoldPrice === Number.MAX_SAFE_INTEGER) minSoldPrice = 0;

    // Build Option Breakdown list
    const totalOrderItemsCount = items.length;
    const optionBreakdown = Array.from(optionGroupMap.values())
      .map((opt) => ({
        optionItemId: opt.optionItemId,
        optionName: opt.optionName,
        optionGroupName: opt.optionGroupName,
        selectionCount: opt.selectionCount,
        totalQuantity: opt.totalQuantity,
        avgPriceAdjustment:
          opt.selectionCount > 0 ? Math.round(opt.totalAdjustmentSum / opt.selectionCount) : 0,
        totalOptionRevenue: opt.totalOptionRevenue,
        attachRatePercent:
          totalOrderItemsCount > 0
            ? Number(((opt.selectionCount / totalOrderItemsCount) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.totalOptionRevenue - a.totalOptionRevenue);

    const branchBreakdown = Array.from(branchMap.values())
      .map((b) => ({
        branchId: b.branchId,
        branchName: b.branchName,
        quantity: b.quantity,
        orderCount: b.orderIds.size,
        revenue: b.revenue,
        taxAmount: b.taxAmount,
        contributionPercent:
          totalProductRevenue > 0
            ? Number(((b.revenue / totalProductRevenue) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const channelBreakdown = Array.from(channelMap.values())
      .map((ch) => ({
        channel: ch.channel,
        quantity: ch.quantity,
        orderCount: ch.orderIds.size,
        revenue: ch.revenue,
        contributionPercent:
          totalProductRevenue > 0
            ? Number(((ch.revenue / totalProductRevenue) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const orderTypeBreakdown = Array.from(orderTypeMap.values())
      .map((ot) => ({
        orderType: ot.orderType,
        quantity: ot.quantity,
        orderCount: ot.orderIds.size,
        revenue: ot.revenue,
        contributionPercent:
          totalProductRevenue > 0
            ? Number(((ot.revenue / totalProductRevenue) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const trendBreakdown = Array.from(trendMap.values()).sort((a, b) =>
      a.period.localeCompare(b.period),
    );

    return {
      currentProductInfo: {
        id: product.id,
        itemCode: product.itemCode || '',
        name: product.name,
        slug: product.slug || '',
        unit: product.unit || 'phần',
        currentPrice: product.price,
        currentTaxPercentage: product.taxPercentage || 0,
        imageUrl: product.imageUrl || null,
        category: {
          id: product.categoryId,
          name: product.category?.name || 'Chưa phân loại',
        },
      },
      kpis: {
        ...kpis,
        minSoldPrice,
        maxSoldPrice,
      },
      priceBreakdown: Array.from(priceGroupMap.values()).sort((a, b) => b.price - a.price),
      vatBreakdown: Array.from(vatGroupMap.values()).sort(
        (a, b) => a.taxPercentage - b.taxPercentage,
      ),
      optionBreakdown,
      branchBreakdown,
      channelBreakdown,
      orderTypeBreakdown,
      trendBreakdown,
    };
  }
}
