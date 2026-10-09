import {
  FinancialReportCalculationService,
  FinancialOrderInput,
  FinancialOrderItemInput,
} from './financial-report-calculation.service';

describe('FinancialReportCalculationService (Zero Tolerance VND Precision)', () => {
  let service: FinancialReportCalculationService;

  beforeEach(() => {
    service = new FinancialReportCalculationService();
  });

  describe('1. Voucher Allocation with Largest Remainder Method (Hare-Niemeyer)', () => {
    it('phân bổ voucher 50,000₫ cho 3 món có giá 100,000₫, 150,000₫, 200,000₫ không lệch dù chỉ 1 đồng', () => {
      const items: FinancialOrderItemInput[] = [
        { id: '1', orderId: 'o1', productId: 'p1', quantity: 1, priceAtSale: 100000, originalPriceAtSale: 100000 },
        { id: '2', orderId: 'o1', productId: 'p2', quantity: 1, priceAtSale: 150000, originalPriceAtSale: 150000 },
        { id: '3', orderId: 'o1', productId: 'p3', quantity: 1, priceAtSale: 200000, originalPriceAtSale: 200000 },
      ];
      const voucherAmount = 50000;

      const allocated = service.allocateOrderDiscount(items, voucherAmount);

      expect(allocated.length).toBe(3);
      const sumAllocated = allocated.reduce((a, b) => a + b, 0);
      expect(sumAllocated).toBe(voucherAmount);

      // Total base = 450,000
      // Item 1: 50,000 * 100,000 / 450,000 = 11,111.111 -> int 11111, rem 0.111
      // Item 2: 50,000 * 150,000 / 450,000 = 16,666.666 -> int 16666, rem 0.666 -> gets +1 -> 16667
      // Item 3: 50,000 * 200,000 / 450,000 = 22,222.222 -> int 22222, rem 0.222
      // Sum int: 11111 + 16666 + 22222 = 49999. Leftover = 1. Largest remainder is item 2 (0.666).
      expect(allocated[0]).toBe(11111);
      expect(allocated[1]).toBe(16667);
      expect(allocated[2]).toBe(22222);
      expect(allocated[0] + allocated[1] + allocated[2]).toBe(50000);
    });

    it('phân bổ voucher chỉ áp dụng cho Danh mục (CATEGORY scope)', () => {
      const items: FinancialOrderItemInput[] = [
        {
          id: '1',
          orderId: 'o1',
          productId: 'p1',
          quantity: 1,
          priceAtSale: 100000,
          originalPriceAtSale: 100000,
          product: { id: 'p1', name: 'Món A', price: 100000, categoryId: 'cat-drink' },
        },
        {
          id: '2',
          orderId: 'o1',
          productId: 'p2',
          quantity: 1,
          priceAtSale: 200000,
          originalPriceAtSale: 200000,
          product: { id: 'p2', name: 'Món B', price: 200000, categoryId: 'cat-food' },
        },
      ];
      const voucher = {
        id: 'v1',
        code: 'DRINK30',
        discountType: 'FIXED_AMOUNT',
        discountValue: 30000,
        applicableProductsScope: 'CATEGORY',
        applicableCategoryIds: 'cat-drink',
      };

      const allocated = service.allocateOrderDiscount(items, 30000, voucher);
      expect(allocated[0]).toBe(30000);
      expect(allocated[1]).toBe(0); // cat-food không nhận được voucher
    });
  });

  describe('2. VAT Calculations (0%, 5%, 8%, 10%, Included vs Excluded)', () => {
    it('tính chính xác VAT 8% chế độ VAT_INCLUDED (thuế gồm trong giá niêm yết)', () => {
      const item: FinancialOrderItemInput = {
        id: '1',
        orderId: 'o1',
        productId: 'p1',
        quantity: 1,
        priceAtSale: 108000,
        originalPriceAtSale: 108000,
        taxPercentageAtSale: 8,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
      };

      const calc = service.calculateOrderItemFinancials(item, 0, 'VAT_INCLUDED');
      // Tax = 108,000 * 8 / 108 = 8,000
      // Taxable = 108,000 - 8,000 = 100,000
      expect(calc.taxAmount).toBe(8000);
      expect(calc.taxableAmount).toBe(100000);
      expect(calc.revenueBeforeTax).toBe(100000);
      expect(calc.revenueWithTax).toBe(108000);
      expect(calc.grossLineTotal).toBe(108000);
    });

    it('tính chính xác VAT 10% chế độ VAT_EXCLUDED (thuế chưa gồm trong giá)', () => {
      const item: FinancialOrderItemInput = {
        id: '1',
        orderId: 'o1',
        productId: 'p1',
        quantity: 2,
        priceAtSale: 100000,
        originalPriceAtSale: 100000,
        taxPercentageAtSale: 10,
        vatPriceModeSnapshot: 'VAT_EXCLUDED',
      };

      const calc = service.calculateOrderItemFinancials(item, 0, 'VAT_EXCLUDED');
      // Gross = 2 * 100,000 = 200,000
      // Tax = 200,000 * 10% = 20,000
      // RevenueWithTax = 220,000
      expect(calc.grossLineTotal).toBe(200000);
      expect(calc.taxAmount).toBe(20000);
      expect(calc.taxableAmount).toBe(200000);
      expect(calc.revenueBeforeTax).toBe(200000);
      expect(calc.revenueWithTax).toBe(220000);
    });

    it('món VAT 0% hoặc 5%', () => {
      const item0: FinancialOrderItemInput = {
        id: '1',
        orderId: 'o1',
        productId: 'p1',
        quantity: 1,
        priceAtSale: 50000,
        originalPriceAtSale: 50000,
        taxPercentageAtSale: 0,
      };
      const calc0 = service.calculateOrderItemFinancials(item0, 0);
      expect(calc0.taxAmount).toBe(0);
      expect(calc0.taxableAmount).toBe(50000);

      const item5: FinancialOrderItemInput = {
        id: '2',
        orderId: 'o1',
        productId: 'p2',
        quantity: 1,
        priceAtSale: 105000,
        originalPriceAtSale: 105000,
        taxPercentageAtSale: 5,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
      };
      const calc5 = service.calculateOrderItemFinancials(item5, 0, 'VAT_INCLUDED');
      // Tax = 105,000 * 5 / 105 = 5,000
      expect(calc5.taxAmount).toBe(5000);
      expect(calc5.taxableAmount).toBe(100000);
    });
  });

  describe('3. Options/Topping & Flash Sale Calculations', () => {
    it('tách bạch tiền Topping khỏi tiền món gốc và tính đúng Flash Sale', () => {
      const item: FinancialOrderItemInput = {
        id: '1',
        orderId: 'o1',
        productId: 'p1',
        quantity: 2,
        priceAtSale: 85000, // 65,000 Flash sale + 20,000 Topping
        originalPriceAtSale: 90000,
        isFlashSaleItem: true,
        flashSalePriceSnapshot: 65000,
        selectedOptions: [
          { nameAtSale: 'Trân châu đen', priceAdjustmentAtSale: 10000, quantity: 1 },
          { nameAtSale: 'Thạch phô mai', priceAdjustmentAtSale: 10000, quantity: 1 },
        ],
      };

      const calc = service.calculateOrderItemFinancials(item, 0);
      expect(calc.grossLineTotal).toBe(170000); // 2 * 85,000
      expect(calc.totalOptionAmount).toBe(40000); // 2 * 20,000
      expect(calc.baseItemAmount).toBe(130000); // 170,000 - 40,000
      // Flash sale discount = 2 * (90,000 - 65,000) = 50,000
      expect(calc.flashSaleDiscount).toBe(50000);
    });
  });

  describe('4. Complete Order Financials & Reconciliation Engine', () => {
    it('kiểm tra Invariants thành công cho đơn hoàn chỉnh (VAT_INCLUDED, Voucher, Freeship, Points)', () => {
      const order: FinancialOrderInput = {
        id: 'order-1',
        orderCode: 'AVO-1001',
        branchId: 'branch-1',
        branch: { id: 'branch-1', name: 'Chi nhánh Quận 1', pointRedeemRate: 1 },
        customerName: 'Nguyễn Văn A',
        customerPhone: '0901234567',
        subTotal: 300000,
        discountAmount: 50000,
        shippingFee: 30000,
        shippingDiscount: 30000, // Freeship
        serviceChargeTotal: 10000, // Phụ thu phục vụ
        taxAmount: 20000,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
        pointsUsed: 5000, // Giảm 5,000₫
        // Total = 300,000 - 50,000 - 5,000 + 10,000 + (30,000 - 30,000) = 255,000₫
        totalAmount: 255000,
        paymentStatus: 'PAID',
        paymentMethod: 'SEPAY',
        status: 'COMPLETED',
        createdAt: new Date('2026-09-12T10:00:00Z'),
        orderItems: [
          {
            id: 'it-1',
            orderId: 'order-1',
            productId: 'p1',
            quantity: 3,
            priceAtSale: 100000,
            originalPriceAtSale: 100000,
            taxPercentageAtSale: 0,
          },
        ],
        payments: [
          {
            id: 'pay-1',
            paymentMethod: 'SEPAY',
            amount: 255000,
            status: 'COMPLETED',
          },
        ],
      };

      const result = service.calculateOrderFinancials(order);

      expect(result.grossSales).toBe(310000); // 300,000 items + 10,000 service charge
      expect(result.netSales).toBe(260000); // 310,000 - 50,000 voucher
      expect(result.shippingFeeCustomerPaid).toBe(0);
      expect(result.shippingFeeSubsidized).toBe(30000);
      expect(result.pointsDiscount).toBe(5000);
      expect(result.collectedRevenue).toBe(255000);
      expect(result.refundedAmount).toBe(0);
      expect(result.netCollected).toBe(255000);

      // Reconciliation Invariants
      expect(result.reconciliation.isReconciled).toBe(true);
      expect(result.reconciliation.errorCode).toBe('OK');
      expect(result.reconciliation.discrepancyTotal).toBe(0);
      expect(result.reconciliation.expectedTotalAmount).toBe(255000);
      expect(result.reconciliation.actualTotalAmount).toBe(255000);
    });

    it('phát hiện RECONCILIATION_ERROR nếu tổng tiền bị sai lệch 1 đồng', () => {
      const manipulatedOrder: FinancialOrderInput = {
        id: 'order-manipulated',
        orderCode: 'AVO-ERR-1',
        branchId: 'b1',
        subTotal: 100000,
        discountAmount: 0,
        shippingFee: 0,
        shippingDiscount: 0,
        serviceChargeTotal: 0,
        taxAmount: 0,
        totalAmount: 99999, // Cố tình lệch 1 đồng (Lẽ ra là 100,000)
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        createdAt: new Date(),
        orderItems: [
          {
            id: 'it-1',
            orderId: 'order-manipulated',
            productId: 'p1',
            quantity: 1,
            priceAtSale: 100000,
            originalPriceAtSale: 100000,
          },
        ],
        payments: [{ paymentMethod: 'CASH', amount: 99999, status: 'COMPLETED' }],
      };

      const result = service.calculateOrderFinancials(manipulatedOrder);

      expect(result.reconciliation.isReconciled).toBe(false);
      expect(result.reconciliation.errorCode).toBe('RECONCILIATION_ERROR');
      expect(result.reconciliation.discrepancyTotal).toBe(1);
      expect(result.reconciliation.expectedTotalAmount).toBe(100000);
      expect(result.reconciliation.actualTotalAmount).toBe(99999);
      expect(result.reconciliation.notes.length).toBeGreaterThan(0);
    });
  });

  describe('5. Multi-Branch Aggregation Equality Invariant', () => {
    it('tổng SUM(Branch KPI) phải bằng chính xác Global KPI không lệch 1 đồng', () => {
      const orderB1: FinancialOrderInput = {
        id: 'o-b1',
        orderCode: 'ORD-B1',
        branchId: 'branch-hn',
        branch: { id: 'branch-hn', name: 'Chi nhánh Hà Nội' },
        subTotal: 500000,
        discountAmount: 20000,
        shippingFee: 25000,
        shippingDiscount: 5000,
        serviceChargeTotal: 15000,
        taxAmount: 40000,
        totalAmount: 515000, // 500k - 20k + 15k + (25k - 5k) = 515,000
        paymentStatus: 'PAID',
        paymentMethod: 'CARD',
        status: 'COMPLETED',
        createdAt: new Date('2026-09-12T11:00:00Z'),
        orderItems: [
          {
            id: 'it-b1',
            orderId: 'o-b1',
            productId: 'p1',
            quantity: 5,
            priceAtSale: 100000,
            originalPriceAtSale: 100000,
          },
        ],
        payments: [{ paymentMethod: 'CARD', amount: 515000, status: 'COMPLETED' }],
      };

      const orderB2: FinancialOrderInput = {
        id: 'o-b2',
        orderCode: 'ORD-B2',
        branchId: 'branch-sg',
        branch: { id: 'branch-sg', name: 'Chi nhánh Sài Gòn' },
        subTotal: 800000,
        discountAmount: 100000,
        shippingFee: 40000,
        shippingDiscount: 40000,
        serviceChargeTotal: 0,
        taxAmount: 56000,
        totalAmount: 700000, // 800k - 100k = 700,000
        paymentStatus: 'PAID',
        paymentMethod: 'SEPAY',
        status: 'COMPLETED',
        createdAt: new Date('2026-09-12T12:00:00Z'),
        orderItems: [
          {
            id: 'it-b2',
            orderId: 'o-b2',
            productId: 'p2',
            quantity: 4,
            priceAtSale: 200000,
            originalPriceAtSale: 200000,
          },
        ],
        payments: [{ paymentMethod: 'SEPAY', amount: 700000, status: 'COMPLETED' }],
      };

      const calcB1 = service.calculateOrderFinancials(orderB1);
      const calcB2 = service.calculateOrderFinancials(orderB2);

      const aggregated = service.aggregateFinancialKPIs([calcB1, calcB2]);

      expect(aggregated.branchBreakdown.length).toBe(2);

      // Invariant checks
      const sumBranchGrossSales = aggregated.branchBreakdown.reduce((acc, b) => acc + b.grossSales, 0);
      expect(sumBranchGrossSales).toBe(aggregated.summary.grossSales);

      const sumBranchNetSales = aggregated.branchBreakdown.reduce((acc, b) => acc + b.netSales, 0);
      expect(sumBranchNetSales).toBe(aggregated.summary.netSales);

      const sumBranchCollected = aggregated.branchBreakdown.reduce((acc, b) => acc + b.collectedRevenue, 0);
      expect(sumBranchCollected).toBe(aggregated.summary.totalCollectedRevenue);

      const sumBranchDiscounts = aggregated.branchBreakdown.reduce((acc, b) => acc + b.totalDiscount, 0);
      expect(sumBranchDiscounts).toBe(aggregated.summary.totalDiscountOverall);

      expect(aggregated.summary.reconciliationHealth.reconciliationRatePercent).toBe(100);
      expect(aggregated.summary.reconciliationHealth.unreconciledOrdersCount).toBe(0);
    });
  });

  describe('6. Refund Processing', () => {
    it('trừ chính xác tiền hoàn trả khỏi Net Collected', () => {
      const refundedOrder: FinancialOrderInput = {
        id: 'order-refund',
        orderCode: 'AVO-REF-1',
        branchId: 'b1',
        subTotal: 200000,
        discountAmount: 0,
        shippingFee: 0,
        shippingDiscount: 0,
        serviceChargeTotal: 0,
        taxAmount: 0,
        totalAmount: 200000,
        paymentStatus: 'PARTIALLY_REFUNDED',
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        createdAt: new Date(),
        orderItems: [
          {
            id: 'it-1',
            orderId: 'order-refund',
            productId: 'p1',
            quantity: 2,
            priceAtSale: 100000,
            originalPriceAtSale: 100000,
          },
        ],
        payments: [
          {
            id: 'pay-1',
            paymentMethod: 'CASH',
            amount: 200000,
            status: 'COMPLETED',
            refunds: [
              {
                id: 'rf-1',
                orderPaymentId: 'pay-1',
                amount: 50000,
                reason: 'Khách đổi món',
              },
            ],
          },
        ],
      };

      const result = service.calculateOrderFinancials(refundedOrder);

      expect(result.collectedRevenue).toBe(200000);
      expect(result.refundedAmount).toBe(50000);
      expect(result.netCollected).toBe(150000); // 200k - 50k
    });
  });
});
