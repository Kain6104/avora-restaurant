import { Injectable } from '@nestjs/common';

/* ==========================================================================
   INTERFACES FOR PAYMENT METHOD REPORT CALCULATION ENGINE
   ========================================================================== */

export interface PaymentMethodConfigInput {
  methodCode: string;
  name: string;
  gatewayType?: string;
  isActive?: boolean;
}

export interface PaymentRefundItemInput {
  id?: string;
  amount: number;
  reason?: string | null;
  createdAt?: Date | string;
}

export interface OrderPaymentItemInput {
  id?: string;
  paymentMethod: string;
  amount: number;
  status: string; // COMPLETED, PENDING, REFUNDED, etc.
  transactionRef?: string | null;
  cashReceived?: number | null;
  cashChange?: number | null;
  createdAt?: Date | string;
  refunds?: PaymentRefundItemInput[];
}

export interface PaymentReportOrderInput {
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
  totalAmount: number;
  subTotal: number;
  discountAmount?: number;
  shippingFee?: number;
  shippingDiscount?: number;
  serviceChargeTotal?: number;
  taxAmount?: number;
  paymentMethod: string; // Primary method snapshot on Order (e.g. COD, CASH, TRANSFER, VNPAY)
  paymentStatus: string; // PAID, PENDING, REFUNDED, etc.
  transactionId?: string | null;
  status: string; // Must be 'COMPLETED'
  orderType?: string; // DINE_IN, TAKE_AWAY, DELIVERY
  orderSource?: string; // POS, WEB, QR_ORDER, etc.
  cashierName?: string | null;
  tableName?: string | null;
  createdAt: Date | string;
  deliveredAt?: Date | string | null;
  updatedAt?: Date | string;
  payments?: OrderPaymentItemInput[];
}

export interface CalculatedPaymentLine {
  methodCode: string;
  methodName: string;
  paidAmount: number;
  refundedAmount: number;
  netCollected: number;
  isPrimary: boolean;
}

export interface CalculatedOrderPaymentAudit {
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
  primaryPaymentMethod: string;
  primaryPaymentMethodName: string;
  orderTotalAmount: number;
  collectedRevenue: number;
  refundedAmount: number;
  netCollected: number;
  isSplitPayment: boolean;
  paymentLines: CalculatedPaymentLine[];
  hasWarning: boolean;
  warningCode?: 'PAYMENT_RECONCILIATION_WARNING' | null;
  notes: string[];
}

export interface PaymentMethodSummaryItem {
  methodCode: string;
  methodName: string;
  orderCount: number;
  transactionCount: number;
  grossRevenue: number;
  refundedAmount: number;
  netCollected: number;
  averageOrderValue: number;
  revenueSharePercent: number;
  orderSharePercent: number;
  isCash: boolean;
}

export interface PaymentMethodBranchSummaryItem {
  branchId: string;
  branchCode: string;
  branchName: string;
  totalOrders: number;
  totalRevenue: number;
  totalRefunded: number;
  netCollected: number;
  cashOrders: number;
  cashlessOrders: number;
  cashlessRatePercent: number;
  methods: Array<{
    methodCode: string;
    methodName: string;
    orderCount: number;
    grossRevenue: number;
    netCollected: number;
  }>;
}

export interface PaymentMethodTrendItem {
  dateKey: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  totalOrders: number;
  totalRevenue: number;
  netCollected: number;
  refundedAmount: number;
  methodRevenues: { [methodCode: string]: number };
  methodOrders: { [methodCode: string]: number };
}

export interface PaymentMethodKPIsSummary {
  totalCompletedOrders: number;
  totalGrossRevenue: number;
  totalCollectedRevenue: number;
  totalRefundedAmount: number;
  netCollected: number;
  activeMethodCount: number;
  topMethodByRevenue: {
    methodCode: string;
    methodName: string;
    grossRevenue: number;
    revenueSharePercent: number;
  } | null;
  topMethodByOrders: {
    methodCode: string;
    methodName: string;
    orderCount: number;
    orderSharePercent: number;
  } | null;
  overallAov: number;
  cashOrderCount: number;
  cashlessOrderCount: number;
  cashlessRatePercent: number;
  cashlessRevenuePercent: number;
  splitPaymentOrderCount: number;
  reconciliationErrorsCount: number;
  paymentWarningCount: number;
}

export interface PaymentMethodReconciliationResult {
  isReconciled: boolean;
  errorCode?: 'OK' | 'PAYMENT_METHOD_RECONCILIATION_ERROR';
  expectedRevenue: number;
  actualRevenue: number;
  discrepancyRevenue: number;
  expectedOrderCount: number;
  actualOrderCount: number;
  discrepancyOrderCount: number;
  expectedNetCollected: number;
  actualNetCollected: number;
  discrepancyNetCollected: number;
  expectedRefund: number;
  actualRefund: number;
  discrepancyRefund: number;
  notes: string[];
}

@Injectable()
export class PaymentMethodReportCalculationService {
  /**
   * Mapping chuẩn hóa tên phương thức thanh toán thân thiện
   */
  private readonly DEFAULT_METHOD_NAME_MAP: Record<string, string> = {
    CASH: 'Tiền mặt tại quầy (POS)',
    TIEN_MAT: 'Tiền mặt tại quầy (POS)',
    CARD: 'Quẹt thẻ ngân hàng (POS)',
    THE: 'Quẹt thẻ ngân hàng (POS)',
    TRANSFER: 'Chuyển khoản',
    CHUYEN_KHOAN: 'Chuyển khoản',
    SEPAY: 'Chuyển khoản SePay',
    SEPAY_QR: 'Chuyển khoản (SePay QR)',
    PAYOS: 'Cổng thanh toán PayOS',
    VNPAY: 'Cổng thanh toán VNPAY-QR',
    MOMO: 'Ví điện tử MoMo',
    ZALOPAY: 'Ví điện tử ZaloPay',
    COD: 'Thanh toán tiền mặt khi nhận hàng (COD)',
    POINT: 'Điểm thưởng thành viên',
  };

  /**
   * Chuẩn hóa tên hiển thị phương thức từ Database cấu hình hoặc fallback map
   */
  resolveMethodName(
    rawCode: string,
    dbMethods?: PaymentMethodConfigInput[],
  ): { methodCode: string; methodName: string; isCash: boolean } {
    const cleanCode = (rawCode || 'COD').trim();
    const upperCode = cleanCode.toUpperCase();

    // 1. Tra cứu trong DB cấu hình PaymentMethod
    if (dbMethods && dbMethods.length > 0) {
      const found = dbMethods.find(
        (m) =>
          m.methodCode.toUpperCase() === upperCode ||
          m.methodCode.toUpperCase() === cleanCode.toUpperCase(),
      );
      if (found && found.name) {
        const isCash =
          upperCode === 'CASH' ||
          upperCode === 'TIEN_MAT' ||
          upperCode === 'COD' ||
          found.name.toLowerCase().includes('tiền mặt');
        return {
          methodCode: cleanCode,
          methodName: found.name,
          isCash,
        };
      }
    }

    // 2. Tra cứu trong bảng ánh xạ mặc định
    if (this.DEFAULT_METHOD_NAME_MAP[upperCode]) {
      const isCash = upperCode === 'CASH' || upperCode === 'TIEN_MAT' || upperCode === 'COD';
      return {
        methodCode: cleanCode,
        methodName: this.DEFAULT_METHOD_NAME_MAP[upperCode],
        isCash,
      };
    }

    // 3. Nếu là tên tùy chỉnh (ví dụ: 'OCB', 'CKCN', 'Bank OCB') giữ nguyên
    const isCash =
      upperCode.includes('CASH') ||
      upperCode.includes('TIEN') ||
      upperCode.includes('COD');
    return {
      methodCode: cleanCode,
      methodName: cleanCode, // Giữ nguyên tên gốc lịch sử
      isCash,
    };
  }

  /**
   * Tính toán và chuẩn hóa thanh toán cho từng đơn hàng hoàn thành
   */
  calculateOrderPayment(
    order: PaymentReportOrderInput,
    dbMethods?: PaymentMethodConfigInput[],
  ): CalculatedOrderPaymentAudit {
    const storedTotalAmount = Math.max(0, Math.round(Number(order.totalAmount || 0)));

    let completionTimestamp = order.deliveredAt ? new Date(order.deliveredAt) : null;
    let isLegacyTimestampFallback = false;
    if (!completionTimestamp || isNaN(completionTimestamp.getTime())) {
      completionTimestamp = order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt);
      isLegacyTimestampFallback = true;
    }

    const payments = order.payments || [];
    const paymentLines: CalculatedPaymentLine[] = [];

    let collectedRevenue = 0;
    let refundedAmount = 0;

    if (payments.length > 0) {
      for (const p of payments) {
        const linePaid =
          p.status === 'COMPLETED' || p.status === 'PAID'
            ? Math.max(0, Math.round(Number(p.amount || 0)))
            : 0;

        let lineRefund = 0;
        for (const rf of p.refunds || []) {
          lineRefund += Math.max(0, Math.round(Number(rf.amount || 0)));
        }

        collectedRevenue += linePaid;
        refundedAmount += lineRefund;

        const { methodCode, methodName } = this.resolveMethodName(p.paymentMethod, dbMethods);

        paymentLines.push({
          methodCode,
          methodName,
          paidAmount: linePaid,
          refundedAmount: lineRefund,
          netCollected: Math.max(0, linePaid - lineRefund),
          isPrimary: false,
        });
      }
    } else {
      // Fallback nếu đơn Online / POS chưa có row OrderPayment chi tiết
      if (order.paymentStatus === 'PAID' || order.status === 'COMPLETED') {
        collectedRevenue = storedTotalAmount;
      }
      if (order.paymentStatus === 'REFUNDED') {
        refundedAmount = storedTotalAmount;
      }

      const { methodCode, methodName } = this.resolveMethodName(order.paymentMethod, dbMethods);
      paymentLines.push({
        methodCode,
        methodName,
        paidAmount: collectedRevenue,
        refundedAmount,
        netCollected: Math.max(0, collectedRevenue - refundedAmount),
        isPrimary: true,
      });
    }

    // Xác định Primary Payment Method: phương thức có paidAmount lớn nhất
    let primaryIdx = 0;
    let maxPaid = -1;
    paymentLines.forEach((line, idx) => {
      if (line.paidAmount > maxPaid) {
        maxPaid = line.paidAmount;
        primaryIdx = idx;
      }
    });

    if (paymentLines[primaryIdx]) {
      paymentLines[primaryIdx].isPrimary = true;
    }

    const primaryMethodCode = paymentLines[primaryIdx]?.methodCode || order.paymentMethod || 'COD';
    const primaryMethodName =
      paymentLines[primaryIdx]?.methodName ||
      this.resolveMethodName(primaryMethodCode, dbMethods).methodName;

    const netCollected = Math.max(0, collectedRevenue - refundedAmount);
    const isSplitPayment = paymentLines.length > 1;

    // Kiểm tra cảnh báo bất thường thanh toán
    const notes: string[] = [];
    let hasWarning = false;
    let warningCode: 'PAYMENT_RECONCILIATION_WARNING' | null = null;

    if (
      order.paymentStatus !== 'PAID' &&
      order.paymentStatus !== 'REFUNDED' &&
      order.paymentStatus !== 'PARTIALLY_REFUNDED'
    ) {
      hasWarning = true;
      warningCode = 'PAYMENT_RECONCILIATION_WARNING';
      notes.push(
        `Đơn hoàn thành nhưng paymentStatus='${order.paymentStatus}' (Đã thu: ${collectedRevenue}đ / Cần thu: ${storedTotalAmount}đ)`,
      );
    } else if (collectedRevenue < storedTotalAmount && order.paymentStatus !== 'REFUNDED') {
      hasWarning = true;
      warningCode = 'PAYMENT_RECONCILIATION_WARNING';
      notes.push(
        `Số tiền thực thu (${collectedRevenue}đ) nhỏ hơn tổng đơn (${storedTotalAmount}đ)`,
      );
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
      tableName: order.tableName || 'N/A',
      orderSource: order.orderSource || 'WEB',
      orderType: order.orderType || 'DELIVERY',
      orderStatus: order.status || 'COMPLETED',
      paymentStatus: order.paymentStatus || 'PENDING',
      primaryPaymentMethod: primaryMethodCode,
      primaryPaymentMethodName: primaryMethodName,
      orderTotalAmount: storedTotalAmount,
      collectedRevenue,
      refundedAmount,
      netCollected,
      isSplitPayment,
      paymentLines,
      hasWarning,
      warningCode,
      notes,
    };
  }

  /**
   * Tổng hợp toàn diện Báo cáo Phương thức thanh toán cho tập hợp đơn hoàn thành
   */
  aggregatePaymentMethodsReport(params: {
    orders: PaymentReportOrderInput[];
    dbMethods?: PaymentMethodConfigInput[];
    allBranches?: Array<{ id: string; name: string; branchCode?: string }>;
  }): {
    kpis: PaymentMethodKPIsSummary;
    methods: PaymentMethodSummaryItem[];
    branches: PaymentMethodBranchSummaryItem[];
    trends: PaymentMethodTrendItem[];
    reconciliation: PaymentMethodReconciliationResult;
    calculatedOrders: CalculatedOrderPaymentAudit[];
  } {
    const { orders, dbMethods, allBranches = [] } = params;

    const calculatedOrders: CalculatedOrderPaymentAudit[] = [];

    // Map theo Payment Method
    const methodMap = new Map<
      string,
      {
        methodCode: string;
        methodName: string;
        orderCount: number;
        transactionCount: number;
        grossRevenue: number;
        refundedAmount: number;
        isCash: boolean;
      }
    >();

    // Map theo Branch
    const branchMap = new Map<string, PaymentMethodBranchSummaryItem>();
    allBranches.forEach((b) => {
      branchMap.set(b.id, {
        branchId: b.id,
        branchCode: b.branchCode || '',
        branchName: b.name,
        totalOrders: 0,
        totalRevenue: 0,
        totalRefunded: 0,
        netCollected: 0,
        cashOrders: 0,
        cashlessOrders: 0,
        cashlessRatePercent: 0,
        methods: [],
      });
    });

    // Map theo Daily Trend
    const dailyMap = new Map<
      string,
      {
        dateKey: string;
        displayDate: string;
        totalOrders: number;
        totalRevenue: number;
        refundedAmount: number;
        methodRevenues: { [code: string]: number };
        methodOrders: { [code: string]: number };
      }
    >();

    let totalCompletedOrders = 0;
    let totalGrossRevenue = 0;
    let totalCollectedRevenue = 0;
    let totalRefundedAmount = 0;
    let cashOrderCount = 0;
    let cashlessOrderCount = 0;
    let splitPaymentOrderCount = 0;
    let paymentWarningCount = 0;

    for (const rawOrd of orders) {
      // Bỏ qua nếu đơn không phải hoàn thành (Secondary check)
      if (rawOrd.status !== 'COMPLETED') continue;

      const calc = this.calculateOrderPayment(rawOrd, dbMethods);
      calculatedOrders.push(calc);

      totalCompletedOrders++;
      totalGrossRevenue += calc.orderTotalAmount;
      totalCollectedRevenue += calc.collectedRevenue;
      totalRefundedAmount += calc.refundedAmount;

      if (calc.isSplitPayment) splitPaymentOrderCount++;
      if (calc.hasWarning) paymentWarningCount++;

      // 1. Phân bổ theo Phương thức thanh toán:
      // - Doanh thu & Refund: theo từng payment line
      // - Số đơn hoàn thành: tính 1 lần cho Primary Method để SUM(orderCount) === totalCompletedOrders
      if (calc.paymentLines.length > 0) {
        for (const line of calc.paymentLines) {
          if (!methodMap.has(line.methodCode)) {
            const { isCash } = this.resolveMethodName(line.methodCode, dbMethods);
            methodMap.set(line.methodCode, {
              methodCode: line.methodCode,
              methodName: line.methodName,
              orderCount: 0,
              transactionCount: 0,
              grossRevenue: 0,
              refundedAmount: 0,
              isCash,
            });
          }
          const m = methodMap.get(line.methodCode)!;
          m.transactionCount++;
          m.grossRevenue += line.paidAmount;
          m.refundedAmount += line.refundedAmount;
        }

        // Tăng orderCount cho primary method duy nhất của đơn
        const primaryCode = calc.primaryPaymentMethod;
        if (methodMap.has(primaryCode)) {
          methodMap.get(primaryCode)!.orderCount++;
        }
      }

      // Xác định Cash vs Cashless cho đơn
      const isPrimaryCash = this.resolveMethodName(calc.primaryPaymentMethod, dbMethods).isCash;
      if (isPrimaryCash) {
        cashOrderCount++;
      } else {
        cashlessOrderCount++;
      }

      // 2. Phân bổ theo Chi nhánh (Branch Summary)
      let bSummary = branchMap.get(calc.branchId);
      if (!bSummary) {
        bSummary = {
          branchId: calc.branchId,
          branchCode: calc.branchCode,
          branchName: calc.branchName,
          totalOrders: 0,
          totalRevenue: 0,
          totalRefunded: 0,
          netCollected: 0,
          cashOrders: 0,
          cashlessOrders: 0,
          cashlessRatePercent: 0,
          methods: [],
        };
        branchMap.set(calc.branchId, bSummary);
      }

      bSummary.totalOrders++;
      bSummary.totalRevenue += calc.orderTotalAmount;
      bSummary.totalRefunded += calc.refundedAmount;
      bSummary.netCollected += calc.netCollected;
      if (isPrimaryCash) {
        bSummary.cashOrders++;
      } else {
        bSummary.cashlessOrders++;
      }

      // 3. Phân bổ theo Trend ngày (Daily Trend)
      const d = calc.completionTimestamp;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const displayDate = `${dd}/${mm}/${yyyy}`;

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          dateKey,
          displayDate,
          totalOrders: 0,
          totalRevenue: 0,
          refundedAmount: 0,
          methodRevenues: {},
          methodOrders: {},
        });
      }
      const dayItem = dailyMap.get(dateKey)!;
      dayItem.totalOrders++;
      dayItem.totalRevenue += calc.orderTotalAmount;
      dayItem.refundedAmount += calc.refundedAmount;

      if (!dayItem.methodOrders[calc.primaryPaymentMethod]) {
        dayItem.methodOrders[calc.primaryPaymentMethod] = 0;
      }
      dayItem.methodOrders[calc.primaryPaymentMethod]++;

      for (const line of calc.paymentLines) {
        if (!dayItem.methodRevenues[line.methodCode]) {
          dayItem.methodRevenues[line.methodCode] = 0;
        }
        dayItem.methodRevenues[line.methodCode] += line.paidAmount;
      }
    }

    const netCollectedOverall = Math.max(0, totalCollectedRevenue - totalRefundedAmount);
    const overallAov =
      totalCompletedOrders > 0 ? Math.round(totalGrossRevenue / totalCompletedOrders) : 0;
    const cashlessRatePercent =
      totalCompletedOrders > 0
        ? Number(((cashlessOrderCount / totalCompletedOrders) * 100).toFixed(2))
        : 0;

    // Tổng hợp Method Summary Items
    const methodItems: PaymentMethodSummaryItem[] = [];
    let sumMethodRevenue = 0;
    let sumMethodOrders = 0;
    let sumMethodNet = 0;
    let sumMethodRefund = 0;

    const baseRevenueForShare = totalGrossRevenue > 0 ? totalGrossRevenue : 1;
    const baseOrdersForShare = totalCompletedOrders > 0 ? totalCompletedOrders : 1;

    for (const m of methodMap.values()) {
      const net = Math.max(0, m.grossRevenue - m.refundedAmount);
      const aov = m.orderCount > 0 ? Math.round(m.grossRevenue / m.orderCount) : 0;
      const revShare = Number(((m.grossRevenue / baseRevenueForShare) * 100).toFixed(2));
      const ordShare = Number(((m.orderCount / baseOrdersForShare) * 100).toFixed(2));

      sumMethodRevenue += m.grossRevenue;
      sumMethodOrders += m.orderCount;
      sumMethodNet += net;
      sumMethodRefund += m.refundedAmount;

      methodItems.push({
        methodCode: m.methodCode,
        methodName: m.methodName,
        orderCount: m.orderCount,
        transactionCount: m.transactionCount,
        grossRevenue: m.grossRevenue,
        refundedAmount: m.refundedAmount,
        netCollected: net,
        averageOrderValue: aov,
        revenueSharePercent: revShare,
        orderSharePercent: ordShare,
        isCash: m.isCash,
      });
    }

    // Sắp xếp mặc định Doanh thu cao -> thấp
    methodItems.sort((a, b) => b.grossRevenue - a.grossRevenue);

    // Top method
    const topMethodByRevenue =
      methodItems.length > 0
        ? {
            methodCode: methodItems[0].methodCode,
            methodName: methodItems[0].methodName,
            grossRevenue: methodItems[0].grossRevenue,
            revenueSharePercent: methodItems[0].revenueSharePercent,
          }
        : null;

    const sortedByOrders = [...methodItems].sort((a, b) => b.orderCount - a.orderCount);
    const topMethodByOrders =
      sortedByOrders.length > 0
        ? {
            methodCode: sortedByOrders[0].methodCode,
            methodName: sortedByOrders[0].methodName,
            orderCount: sortedByOrders[0].orderCount,
            orderSharePercent: sortedByOrders[0].orderSharePercent,
          }
        : null;

    const cashlessRevenue = methodItems
      .filter((m) => !m.isCash)
      .reduce((sum, m) => sum + m.grossRevenue, 0);
    const cashlessRevenuePercent =
      totalGrossRevenue > 0 ? Number(((cashlessRevenue / totalGrossRevenue) * 100).toFixed(2)) : 0;

    // Tổng hợp Branch Summary Items
    const branchItems = Array.from(branchMap.values()).map((b) => {
      b.cashlessRatePercent =
        b.totalOrders > 0 ? Number(((b.cashlessOrders / b.totalOrders) * 100).toFixed(2)) : 0;
      return b;
    });

    // Tổng hợp Daily Trend Items
    const trendItems: PaymentMethodTrendItem[] = Array.from(dailyMap.values())
      .map((d) => ({
        dateKey: d.dateKey,
        displayDate: d.displayDate,
        totalOrders: d.totalOrders,
        totalRevenue: d.totalRevenue,
        netCollected: Math.max(0, d.totalRevenue - d.refundedAmount),
        refundedAmount: d.refundedAmount,
        methodRevenues: d.methodRevenues,
        methodOrders: d.methodOrders,
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    // RECONCILIATION INVARIANTS CHECK
    const notes: string[] = [];
    let isReconciled = true;

    // Invariant 1: Revenue match
    const discrepancyRevenue = Math.abs(totalGrossRevenue - sumMethodRevenue);
    if (discrepancyRevenue > 0) {
      isReconciled = false;
      notes.push(
        `Lệch doanh thu: Tổng doanh thu (${totalGrossRevenue}đ) != Tổng các phương thức (${sumMethodRevenue}đ) (Lệch ${discrepancyRevenue}đ)`,
      );
    }

    // Invariant 2: Order count match
    const discrepancyOrderCount = Math.abs(totalCompletedOrders - sumMethodOrders);
    if (discrepancyOrderCount > 0) {
      isReconciled = false;
      notes.push(
        `Lệch số đơn: Tổng đơn hoàn thành (${totalCompletedOrders}) != Tổng đơn các phương thức (${sumMethodOrders}) (Lệch ${discrepancyOrderCount})`,
      );
    }

    // Invariant 3: Refund match
    const discrepancyRefund = Math.abs(totalRefundedAmount - sumMethodRefund);
    if (discrepancyRefund > 0) {
      isReconciled = false;
      notes.push(
        `Lệch hoàn tiền: Tổng hoàn tiền (${totalRefundedAmount}đ) != Tổng hoàn tiền các phương thức (${sumMethodRefund}đ)`,
      );
    }

    // Invariant 4: Net collected match
    const discrepancyNetCollected = Math.abs(netCollectedOverall - sumMethodNet);
    if (discrepancyNetCollected > 0) {
      isReconciled = false;
      notes.push(
        `Lệch thực thu: Tổng thực thu (${netCollectedOverall}đ) != Tổng thực thu các phương thức (${sumMethodNet}đ)`,
      );
    }

    const reconciliation: PaymentMethodReconciliationResult = {
      isReconciled,
      errorCode: isReconciled ? 'OK' : 'PAYMENT_METHOD_RECONCILIATION_ERROR',
      expectedRevenue: totalGrossRevenue,
      actualRevenue: sumMethodRevenue,
      discrepancyRevenue,
      expectedOrderCount: totalCompletedOrders,
      actualOrderCount: sumMethodOrders,
      discrepancyOrderCount,
      expectedNetCollected: netCollectedOverall,
      actualNetCollected: sumMethodNet,
      discrepancyNetCollected,
      expectedRefund: totalRefundedAmount,
      actualRefund: sumMethodRefund,
      discrepancyRefund,
      notes,
    };

    const kpis: PaymentMethodKPIsSummary = {
      totalCompletedOrders,
      totalGrossRevenue,
      totalCollectedRevenue,
      totalRefundedAmount,
      netCollected: netCollectedOverall,
      activeMethodCount: methodItems.length,
      topMethodByRevenue,
      topMethodByOrders,
      overallAov,
      cashOrderCount,
      cashlessOrderCount,
      cashlessRatePercent,
      cashlessRevenuePercent,
      splitPaymentOrderCount,
      reconciliationErrorsCount: isReconciled ? 0 : 1,
      paymentWarningCount,
    };

    return {
      kpis,
      methods: methodItems,
      branches: branchItems,
      trends: trendItems,
      reconciliation,
      calculatedOrders,
    };
  }
}
