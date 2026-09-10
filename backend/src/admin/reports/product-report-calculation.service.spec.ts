import { ProductReportCalculationService, RawOrderItemInput, RawOrderInput } from './product-report-calculation.service';

describe('ProductReportCalculationService - 23 Enterprise Test Cases', () => {
  let service: ProductReportCalculationService;

  beforeEach(() => {
    service = new ProductReportCalculationService();
  });

  // CASE 1: 1 món 100.000, VAT 0%
  it('CASE 1: 1 item 100.000đ with VAT 0%', () => {
    const item: RawOrderItemInput = {
      id: 'item-1',
      orderId: 'order-1',
      productId: 'prod-1',
      quantity: 1,
      priceAtSale: 100000,
      originalPriceAtSale: 100000,
      taxPercentageAtSale: 0,
      vatPriceModeSnapshot: 'VAT_INCLUDED',
      product: { id: 'prod-1', name: 'Trà đá', price: 100000, taxPercentage: 0, categoryId: 'c1' },
      order: {
        id: 'order-1',
        branchId: 'b1',
        subTotal: 100000,
        shippingFee: 0,
        discountAmount: 0,
        shippingDiscount: 0,
        serviceChargeTotal: 0,
        taxAmount: 0,
        totalAmount: 100000,
        status: 'COMPLETED',
        createdAt: new Date(),
      },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.grossLineTotal).toBe(100000);
    expect(res.revenueBeforeTax).toBe(100000);
    expect(res.taxAmount).toBe(0);
    expect(res.revenueWithTax).toBe(100000);
  });

  // CASE 2: 108.000 đã gồm VAT 8% -> trước VAT 100.000, VAT 8.000
  it('CASE 2: 108.000đ VAT 8% included -> 100.000đ before VAT, 8.000đ VAT', () => {
    const item: RawOrderItemInput = {
      id: 'item-2',
      orderId: 'order-2',
      productId: 'prod-2',
      quantity: 1,
      priceAtSale: 108000,
      originalPriceAtSale: 108000,
      taxPercentageAtSale: 8,
      vatPriceModeSnapshot: 'VAT_INCLUDED',
      isVatInclusive: true,
      product: { id: 'prod-2', name: 'Sushi cá hồi', price: 108000, taxPercentage: 8, categoryId: 'c1' },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.grossLineTotal).toBe(108000);
    expect(res.revenueBeforeTax).toBe(100000);
    expect(res.taxAmount).toBe(8000);
    expect(res.revenueWithTax).toBe(108000);
  });

  // CASE 3: 100.000 chưa VAT 8% -> VAT 8.000, tổng 108.000
  it('CASE 3: 100.000đ VAT 8% excluded -> 8.000đ VAT, total with VAT 108.000đ', () => {
    const item: RawOrderItemInput = {
      id: 'item-3',
      orderId: 'order-3',
      productId: 'prod-3',
      quantity: 1,
      priceAtSale: 100000,
      originalPriceAtSale: 100000,
      taxPercentageAtSale: 8,
      vatPriceModeSnapshot: 'VAT_EXCLUDED',
      isVatInclusive: false,
      product: { id: 'prod-3', name: 'Bò Wagyu A5', price: 100000, taxPercentage: 8, categoryId: 'c1' },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.grossLineTotal).toBe(100000);
    expect(res.revenueBeforeTax).toBe(100000);
    expect(res.taxAmount).toBe(8000);
    expect(res.revenueWithTax).toBe(108000);
  });

  // CASE 4: Món + option +20.000 (priceAtSale = 120.000)
  it('CASE 4: Item base 100.000đ + option 20.000đ -> option revenue 20.000đ, base 100.000đ, gross 120.000đ', () => {
    const item: RawOrderItemInput = {
      id: 'item-4',
      orderId: 'order-4',
      productId: 'prod-4',
      quantity: 1,
      priceAtSale: 120000,
      originalPriceAtSale: 100000,
      selectedOptions: [{ nameAtSale: 'Thêm phô mai', priceAdjustmentAtSale: 20000 }],
      taxPercentageAtSale: 0,
      product: { id: 'prod-4', name: 'Mì Udon', price: 100000, categoryId: 'c1' },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.grossLineTotal).toBe(120000);
    expect(res.totalOptionRevenue).toBe(20000);
    expect(res.totalBaseRevenue).toBe(100000);
    expect(res.unitBasePrice).toBe(100000);
    expect(res.unitOptionPriceAdjustment).toBe(20000);
  });

  // CASE 5: Món VAT 8% + option
  it('CASE 5: Item VAT 8% included + option -> taxes computed on grossLineTotal accurately', () => {
    // Base 108k (gồm 8% VAT) + Option 54k (gồm 8% VAT) = 162.000đ
    // 162.000 / 1.08 = 150.000 net, 12.000 VAT
    const item: RawOrderItemInput = {
      id: 'item-5',
      orderId: 'order-5',
      productId: 'prod-5',
      quantity: 1,
      priceAtSale: 162000,
      originalPriceAtSale: 108000,
      selectedOptions: [{ nameAtSale: 'Thêm trứng cá chuồn', priceAdjustmentAtSale: 54000 }],
      taxPercentageAtSale: 8,
      vatPriceModeSnapshot: 'VAT_INCLUDED',
      product: { id: 'prod-5', name: 'Cơm lươn Nhật', price: 108000, taxPercentage: 8, categoryId: 'c1' },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.grossLineTotal).toBe(162000);
    expect(res.totalOptionRevenue).toBe(54000);
    expect(res.totalBaseRevenue).toBe(108000);
    expect(res.revenueBeforeTax).toBe(150000);
    expect(res.taxAmount).toBe(12000);
    expect(res.revenueWithTax).toBe(162000);
  });

  // CASE 6: Món VAT included + direct item discount
  it('CASE 6: Item VAT included 108.000đ + direct discount 10.800đ -> after discount 97.200đ, before VAT 90.000đ, VAT 7.200đ', () => {
    const item: RawOrderItemInput = {
      id: 'item-6',
      orderId: 'order-6',
      productId: 'prod-6',
      quantity: 1,
      priceAtSale: 108000,
      originalPriceAtSale: 108000,
      discountAmount: 10800,
      taxPercentageAtSale: 8,
      vatPriceModeSnapshot: 'VAT_INCLUDED',
      product: { id: 'prod-6', name: 'Sashimi cá hồi', price: 108000, taxPercentage: 8, categoryId: 'c1' },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.grossLineTotal).toBe(108000);
    expect(res.totalDirectDiscount).toBe(10800);
    expect(res.netAmountAfterDiscount).toBe(97200);
    expect(res.revenueBeforeTax).toBe(90000);
    expect(res.taxAmount).toBe(7200);
    expect(res.revenueWithTax).toBe(97200);
  });

  // CASE 7: Món VAT excluded + discount
  it('CASE 7: Item VAT excluded 100.000đ + discount 20.000đ -> net base 80.000đ, VAT 8% = 6.400đ, total 86.400đ', () => {
    const item: RawOrderItemInput = {
      id: 'item-7',
      orderId: 'order-7',
      productId: 'prod-7',
      quantity: 1,
      priceAtSale: 100000,
      originalPriceAtSale: 100000,
      discountAmount: 20000,
      taxPercentageAtSale: 8,
      vatPriceModeSnapshot: 'VAT_EXCLUDED',
      product: { id: 'prod-7', name: 'Bò nướng Teppanyaki', price: 100000, taxPercentage: 8, categoryId: 'c1' },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.grossLineTotal).toBe(100000);
    expect(res.netAmountAfterDiscount).toBe(80000);
    expect(res.revenueBeforeTax).toBe(80000);
    expect(res.taxAmount).toBe(6400);
    expect(res.revenueWithTax).toBe(86400);
  });

  // CASE 8: Một order có món VAT 8% và món VAT 10%
  it('CASE 8: Order with mixed VAT items (Item 1: 8% included, Item 2: 10% included)', () => {
    const item1: RawOrderItemInput = {
      id: 'i8-1',
      orderId: 'o8',
      productId: 'p8-1',
      quantity: 1,
      priceAtSale: 108000,
      originalPriceAtSale: 108000,
      taxPercentageAtSale: 8,
      vatPriceModeSnapshot: 'VAT_INCLUDED',
      product: { id: 'p8-1', name: 'Món 8%', price: 108000, taxPercentage: 8, categoryId: 'c1' },
    };
    const item2: RawOrderItemInput = {
      id: 'i8-2',
      orderId: 'o8',
      productId: 'p8-2',
      quantity: 1,
      priceAtSale: 110000,
      originalPriceAtSale: 110000,
      taxPercentageAtSale: 10,
      vatPriceModeSnapshot: 'VAT_INCLUDED',
      product: { id: 'p8-2', name: 'Món 10%', price: 110000, taxPercentage: 10, categoryId: 'c1' },
    };

    const c1 = service.calculateOrderItemFinancials(item1, 0);
    const c2 = service.calculateOrderItemFinancials(item2, 0);

    expect(c1.taxAmount).toBe(8000);
    expect(c1.revenueBeforeTax).toBe(100000);
    expect(c2.taxAmount).toBe(10000);
    expect(c2.revenueBeforeTax).toBe(100000);

    const kpi = service.calculateReportKPIs([c1, c2], []);
    expect(kpi.grossProductSales).toBe(218000);
    expect(kpi.productTaxAmount).toBe(18000);
    expect(kpi.productRevenueBeforeTax).toBe(200000);
    expect(kpi.productRevenueWithTax).toBe(218000);
  });

  // CASE 9: Voucher giảm 50.000 cho order có nhiều món -> phân bổ chính xác, tổng allocated discount = 50.000
  it('CASE 9: Order voucher 50.000đ across multiple items -> proportional allocation with largest remainder equals strictly 50.000đ', () => {
    const items: RawOrderItemInput[] = [
      { id: 'i9-1', orderId: 'o9', productId: 'p1', quantity: 1, priceAtSale: 100000, originalPriceAtSale: 100000 },
      { id: 'i9-2', orderId: 'o9', productId: 'p2', quantity: 2, priceAtSale: 50000, originalPriceAtSale: 50000 }, // line: 100k
      { id: 'i9-3', orderId: 'o9', productId: 'p3', quantity: 1, priceAtSale: 100000, originalPriceAtSale: 100000 },
    ];
    // Total subtotal = 300.000đ. Each item has 100k base (1/3).
    // 50.000 / 3 = 16.666,666...
    // Largest remainder must round to: 16.667 + 16.667 + 16.666 = 50.000 strictly!

    const allocations = service.allocateOrderDiscount(items, 50000);
    const sumAllocated = allocations.reduce((acc, v) => acc + v, 0);

    expect(sumAllocated).toBe(50000);
    expect(allocations[0] + allocations[1] + allocations[2]).toBe(50000);
    expect(allocations[0]).toBeGreaterThanOrEqual(16666);
    expect(allocations[0]).toBeLessThanOrEqual(16667);
  });

  // CASE 10: Freeship 30.000 -> không làm giảm Product Revenue
  it('CASE 10: Freeship 30.000đ does not reduce product sales revenue', () => {
    const order: RawOrderInput = {
      id: 'o10',
      branchId: 'b1',
      subTotal: 100000,
      shippingFee: 30000,
      shippingDiscount: 30000,
      discountAmount: 0,
      serviceChargeTotal: 0,
      taxAmount: 0,
      totalAmount: 100000,
      status: 'COMPLETED',
      createdAt: new Date(),
    };
    const item: RawOrderItemInput = {
      id: 'i10',
      orderId: 'o10',
      productId: 'p1',
      quantity: 1,
      priceAtSale: 100000,
      originalPriceAtSale: 100000,
      order,
    };

    const calculated = service.calculateOrderItemFinancials(item, 0);
    const kpis = service.calculateReportKPIs([calculated], [order]);

    expect(kpis.grossProductSales).toBe(100000);
    expect(kpis.netProductSalesAfterDiscount).toBe(100000);
    expect(kpis.orderShippingFeeTotal).toBe(30000);
    expect(kpis.orderShippingDiscountTotal).toBe(30000);
    expect(kpis.orderNetShippingFeeTotal).toBe(0);
    expect(kpis.netRevenueOverall).toBe(100000);
  });

  // CASE 11: ShippingFee 30.000, shippingDiscount 10.000 -> net shipping = 20.000
  it('CASE 11: ShippingFee 30.000đ, shippingDiscount 10.000đ -> net shipping = 20.000đ', () => {
    const order: RawOrderInput = {
      id: 'o11',
      branchId: 'b1',
      subTotal: 100000,
      shippingFee: 30000,
      shippingDiscount: 10000,
      discountAmount: 0,
      serviceChargeTotal: 0,
      taxAmount: 0,
      totalAmount: 120000,
      status: 'COMPLETED',
      createdAt: new Date(),
    };

    const metrics = service.calculateOrderLevelMetrics([order]);
    expect(metrics.shippingFeeTotal).toBe(30000);
    expect(metrics.shippingDiscountTotal).toBe(10000);
    expect(metrics.netShippingFeeTotal).toBe(20000);
  });

  // CASE 12: Order có 5 item, shipping = 30.000 -> report tổng shipping vẫn = 30.000, KHÔNG thành 150.000
  it('CASE 12: Order with 5 items and shipping 30.000đ -> distinct aggregation maintains total shipping = 30.000đ, not 150.000đ', () => {
    const order: RawOrderInput = {
      id: 'o12',
      branchId: 'b1',
      subTotal: 500000,
      shippingFee: 30000,
      shippingDiscount: 0,
      discountAmount: 0,
      serviceChargeTotal: 0,
      taxAmount: 0,
      totalAmount: 530000,
      status: 'COMPLETED',
      createdAt: new Date(),
    };

    const items: RawOrderItemInput[] = [1, 2, 3, 4, 5].map((idx) => ({
      id: `i12-${idx}`,
      orderId: 'o12',
      productId: `p-${idx}`,
      quantity: 1,
      priceAtSale: 100000,
      originalPriceAtSale: 100000,
      order,
    }));

    const calculated = items.map((it) => service.calculateOrderItemFinancials(it, 0));
    const kpis = service.calculateReportKPIs(calculated, [order]);

    expect(kpis.totalSoldQuantity).toBe(5);
    expect(kpis.grossProductSales).toBe(500000);
    expect(kpis.orderShippingFeeTotal).toBe(30000);
    expect(kpis.orderNetShippingFeeTotal).toBe(30000);
  });

  // CASE 13: Service charge chịu VAT
  it('CASE 13: Taxable service charge -> tracked at order level without inflating product sales', () => {
    const order: RawOrderInput = {
      id: 'o13',
      branchId: 'b1',
      subTotal: 100000,
      shippingFee: 0,
      shippingDiscount: 0,
      discountAmount: 0,
      serviceChargeTotal: 10000,
      taxAmount: 1000,
      totalAmount: 111000,
      status: 'COMPLETED',
      vatPriceModeSnapshot: 'VAT_INCLUDED',
      serviceCharges: [
        { name: 'Phí phục vụ phòng VIP', amount: 11000, isTaxable: true, taxPercentage: 10 },
      ],
      createdAt: new Date(),
    };
    const item: RawOrderItemInput = {
      id: 'i13',
      orderId: 'o13',
      productId: 'p1',
      quantity: 1,
      priceAtSale: 100000,
      originalPriceAtSale: 100000,
      order,
    };

    const calculated = service.calculateOrderItemFinancials(item, 0);
    const kpis = service.calculateReportKPIs([calculated], [order]);

    expect(kpis.grossProductSales).toBe(100000);
    expect(kpis.orderServiceChargeTotal).toBe(10000);
    expect(kpis.orderServiceChargeTaxTotal).toBe(1000); // 11000 * 10 / 110 = 1000
  });

  // CASE 14: Service charge không chịu VAT
  it('CASE 14: Non-taxable service charge -> 0 service charge VAT', () => {
    const order: RawOrderInput = {
      id: 'o14',
      branchId: 'b1',
      subTotal: 100000,
      shippingFee: 0,
      shippingDiscount: 0,
      discountAmount: 0,
      serviceChargeTotal: 20000,
      taxAmount: 0,
      totalAmount: 120000,
      status: 'COMPLETED',
      serviceCharges: [{ name: 'Phụ thu đêm', amount: 20000, isTaxable: false }],
      createdAt: new Date(),
    };

    const metrics = service.calculateOrderLevelMetrics([order]);
    expect(metrics.serviceChargeTotal).toBe(20000);
    expect(metrics.serviceChargeTaxTotal).toBe(0);
  });

  // CASE 15: Flash Sale
  it('CASE 15: Flash Sale item tracked accurately with flashSaleId and flash sale metrics', () => {
    const item: RawOrderItemInput = {
      id: 'i15',
      orderId: 'o15',
      productId: 'p15',
      quantity: 2,
      priceAtSale: 89000,
      originalPriceAtSale: 149000,
      isFlashSaleItem: true,
      flashSaleId: 'fs-999',
      product: { id: 'p15', name: 'Nigiri Cá Hồi', price: 149000, categoryId: 'c1' },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.isFlashSaleItem).toBe(true);
    expect(res.flashSaleId).toBe('fs-999');
    expect(res.grossLineTotal).toBe(178000);
    expect(res.originalPriceAtSale).toBe(149000);

    const kpis = service.calculateReportKPIs([res], []);
    expect(kpis.flashSaleQuantity).toBe(2);
    expect(kpis.flashSaleRevenue).toBe(178000);
  });

  // CASE 16: Cancelled order không tính doanh thu mặc định
  it('CASE 16: Cancelled orders are excluded from net sales revenue by default', () => {
    const order: RawOrderInput = {
      id: 'o16',
      branchId: 'b1',
      subTotal: 200000,
      shippingFee: 0,
      discountAmount: 0,
      shippingDiscount: 0,
      serviceChargeTotal: 0,
      taxAmount: 0,
      totalAmount: 200000,
      status: 'CANCELLED',
      createdAt: new Date(),
    };
    const item: RawOrderItemInput = {
      id: 'i16',
      orderId: 'o16',
      productId: 'p16',
      quantity: 1,
      priceAtSale: 200000,
      originalPriceAtSale: 200000,
      order,
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.orderStatus).toBe('CANCELLED');
  });

  // CASE 17: Full refund
  it('CASE 17: Full payment refund deducted from net overall revenue without distorting product sold quantity', () => {
    const order: RawOrderInput = {
      id: 'o17',
      branchId: 'b1',
      subTotal: 100000,
      shippingFee: 0,
      shippingDiscount: 0,
      discountAmount: 0,
      serviceChargeTotal: 0,
      taxAmount: 0,
      totalAmount: 100000,
      status: 'COMPLETED',
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 100000,
          status: 'REFUNDED',
          refunds: [{ amount: 100000, reason: 'Khách đổi ý' }],
        },
      ],
      createdAt: new Date(),
    };
    const item: RawOrderItemInput = {
      id: 'i17',
      orderId: 'o17',
      productId: 'p1',
      quantity: 1,
      priceAtSale: 100000,
      originalPriceAtSale: 100000,
      order,
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    const kpis = service.calculateReportKPIs([res], [order]);

    expect(kpis.grossProductSales).toBe(100000);
    expect(kpis.orderRefundTotal).toBe(100000);
    expect(kpis.netRevenueOverall).toBe(0); // 100k sales - 100k refund = 0
  });

  // CASE 18: Partial refund
  it('CASE 18: Partial payment refund deducted accurately', () => {
    const order: RawOrderInput = {
      id: 'o18',
      branchId: 'b1',
      subTotal: 100000,
      shippingFee: 0,
      shippingDiscount: 0,
      discountAmount: 0,
      serviceChargeTotal: 0,
      taxAmount: 0,
      totalAmount: 100000,
      status: 'COMPLETED',
      payments: [
        {
          paymentMethod: 'CARD',
          amount: 100000,
          status: 'PARTIALLY_REFUNDED',
          refunds: [{ amount: 30000, reason: 'Hoàn tiền bồi thường' }],
        },
      ],
      createdAt: new Date(),
    };
    const item: RawOrderItemInput = {
      id: 'i18',
      orderId: 'o18',
      productId: 'p1',
      quantity: 1,
      priceAtSale: 100000,
      originalPriceAtSale: 100000,
      order,
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    const kpis = service.calculateReportKPIs([res], [order]);

    expect(kpis.orderRefundTotal).toBe(30000);
    expect(kpis.netRevenueOverall).toBe(70000);
  });

  // CASE 19: Legacy OrderItem thiếu tax snapshot
  it('CASE 19: Legacy OrderItem missing tax snapshot reconstructs safely and flags LEGACY_RECONSTRUCTED', () => {
    const item: RawOrderItemInput = {
      id: 'i19',
      orderId: 'o19',
      productId: 'p19',
      quantity: 1,
      priceAtSale: 108000,
      originalPriceAtSale: 108000,
      // No snapshot fields provided
      product: { id: 'p19', name: 'Legacy Dish', price: 108000, taxPercentage: 8, categoryId: 'c1' },
      order: {
        id: 'o19',
        branchId: 'b1',
        subTotal: 108000,
        shippingFee: 0,
        discountAmount: 0,
        shippingDiscount: 0,
        serviceChargeTotal: 0,
        taxAmount: 0,
        totalAmount: 108000,
        status: 'COMPLETED',
        createdAt: new Date(),
      },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.taxCalculationSource).toBe('LEGACY_RECONSTRUCTED');
    expect(res.taxAmount).toBe(8000);
    expect(res.revenueBeforeTax).toBe(100000);
  });

  // CASE 20: Split/Merged POS order không double-count
  it('CASE 20: Merged order marks source as CANCELLED, ensuring 0 double counting in sales aggregation', () => {
    const sourceOrder: RawOrderInput = {
      id: 'src-order',
      branchId: 'b1',
      subTotal: 100000,
      shippingFee: 0,
      discountAmount: 0,
      shippingDiscount: 0,
      serviceChargeTotal: 0,
      taxAmount: 0,
      totalAmount: 100000,
      status: 'CANCELLED', // Cancelled due to merge
      createdAt: new Date(),
    };
    const targetOrder: RawOrderInput = {
      id: 'target-order',
      branchId: 'b1',
      subTotal: 200000,
      shippingFee: 0,
      discountAmount: 0,
      shippingDiscount: 0,
      serviceChargeTotal: 0,
      taxAmount: 0,
      totalAmount: 200000,
      status: 'COMPLETED',
      createdAt: new Date(),
    };

    const targetItem: RawOrderItemInput = {
      id: 'target-item',
      orderId: 'target-order',
      productId: 'p1',
      quantity: 2,
      priceAtSale: 100000,
      originalPriceAtSale: 100000,
      order: targetOrder,
    };

    // Filter valid (COMPLETED) orders
    const validOrders = [targetOrder];
    const res = service.calculateOrderItemFinancials(targetItem, 0);
    const kpis = service.calculateReportKPIs([res], validOrders);

    expect(kpis.totalSoldQuantity).toBe(2);
    expect(kpis.grossProductSales).toBe(200000);
  });

  // CASE 21: Option đã được include sẵn trong priceAtSale -> không được cộng option lần 2
  it('CASE 21: Option already in priceAtSale -> verified option revenue is a component of grossLineTotal and not double-added', () => {
    const item: RawOrderItemInput = {
      id: 'i21',
      orderId: 'o21',
      productId: 'p21',
      quantity: 2,
      priceAtSale: 120000, // 100k base + 20k option
      originalPriceAtSale: 100000,
      selectedOptions: [{ nameAtSale: 'Phô mai', priceAdjustmentAtSale: 20000 }],
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.grossLineTotal).toBe(240000);
    expect(res.totalOptionRevenue).toBe(40000); // 2 * 20k
    expect(res.totalBaseRevenue).toBe(200000); // 2 * 100k
    // Gross = base + option strictly:
    expect(res.totalBaseRevenue + res.totalOptionRevenue).toBe(res.grossLineTotal);
  });

  // CASE 22: Product hiện tại đổi VAT từ 8% -> 10% nhưng OrderItem cũ snapshot 8% -> report cũ vẫn phải là 8%
  it('CASE 22: Current Product tax changed from 8% to 10%, historical snapshot 8% is preserved', () => {
    const item: RawOrderItemInput = {
      id: 'i22',
      orderId: 'o22',
      productId: 'p22',
      quantity: 1,
      priceAtSale: 108000,
      originalPriceAtSale: 108000,
      taxPercentageAtSale: 8, // Stored snapshot was 8%
      taxAmountAtSale: 8000,
      taxableAmountAtSale: 100000,
      vatPriceModeSnapshot: 'VAT_INCLUDED',
      product: {
        id: 'p22',
        name: 'Món ăn đổi thuế',
        price: 110000,
        taxPercentage: 10, // CURRENT TAX CHANGED TO 10%!
        categoryId: 'c1',
      },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.taxPercentage).toBe(8); // Must strictly remain 8% from snapshot!
    expect(res.taxAmount).toBe(8000);
    expect(res.revenueBeforeTax).toBe(100000);
  });

  // CASE 23: Product hiện tại đổi giá -> doanh thu lịch sử không thay đổi
  it('CASE 23: Current Product price changed, historical sales revenue remains 100% unchanged', () => {
    const item: RawOrderItemInput = {
      id: 'i23',
      orderId: 'o23',
      productId: 'p23',
      quantity: 2,
      priceAtSale: 150000, // Sold at 150.000đ
      originalPriceAtSale: 150000,
      product: {
        id: 'p23',
        name: 'Món ăn tăng giá',
        price: 250000, // CURRENT PRICE INFLATED TO 250.000đ!
        categoryId: 'c1',
      },
    };

    const res = service.calculateOrderItemFinancials(item, 0);
    expect(res.priceAtSale).toBe(150000);
    expect(res.grossLineTotal).toBe(300000); // 2 * 150.000đ = 300.000đ, NOT 500.000đ!
  });

  // =========================================================================
  // TESTS FOR SNAPSHOT SEMANTICS (PER-UNIT vs PER-LINE) WITH QUANTITY > 1
  // =========================================================================

  it('SEMANTICS TEST: quantity = 5, verifying PER-UNIT (price, discount, options) vs PER-LINE (taxableAmount, taxAmount)', () => {
    // 1 item: 108.000đ (VAT 8% included: 100k net + 8k tax). Option: +10.000đ. Direct discount: -8.000đ/unit.
    // priceAtSale = 118.000đ (108k base + 10k option) -> PER_UNIT
    // discountAmount = 8.000đ -> PER_UNIT
    // For quantity = 5:
    // grossLineTotal = 5 * 118.000 = 590.000đ
    // totalOptionRevenue = 5 * 10.000 = 50.000đ
    // totalBaseRevenue = 5 * 108.000 = 540.000đ
    // totalDirectDiscount = 5 * 8.000 = 40.000đ
    // netAmountAfterDiscount = 590.000 - 40.000 = 550.000đ
    // At VAT 8% included:
    // taxAmount = 550.000 * 8 / 108 = 40.741đ (PER-LINE snapshot in OrderItem)
    // taxableAmount = 550.000 - 40.741 = 509.259đ (PER-LINE snapshot in OrderItem)

    const itemWithSnapshot: RawOrderItemInput = {
      id: 'i-qty5',
      orderId: 'o-qty5',
      productId: 'p-qty5',
      quantity: 5,
      priceAtSale: 118000, // PER-UNIT
      originalPriceAtSale: 108000, // PER-UNIT
      discountAmount: 8000, // PER-UNIT
      selectedOptions: [{ nameAtSale: 'Size L', priceAdjustmentAtSale: 10000 }], // PER-UNIT
      taxPercentageAtSale: 8,
      vatPriceModeSnapshot: 'VAT_INCLUDED',
      taxableAmountAtSale: 509259, // PER-LINE snapshot
      taxAmountAtSale: 40741, // PER-LINE snapshot
      product: { id: 'p-qty5', name: 'Lẩu hải sản', price: 108000, categoryId: 'c1' },
    };

    const res = service.calculateOrderItemFinancials(itemWithSnapshot, 0);

    // Verify PER-UNIT multiplied by quantity
    expect(res.quantity).toBe(5);
    expect(res.grossLineTotal).toBe(590000);
    expect(res.totalOptionRevenue).toBe(50000);
    expect(res.totalBaseRevenue).toBe(540000);
    expect(res.totalDirectDiscount).toBe(40000);
    expect(res.netAmountAfterDiscount).toBe(550000);

    // Verify PER-LINE tax snapshot is NOT multiplied again by quantity
    expect(res.taxAmount).toBe(40741); // NOT 40.741 * 5 = 203.705!
    expect(res.taxableAmount).toBe(509259); // NOT 509.259 * 5 = 2.546.295!
    expect(res.revenueBeforeTax).toBe(509259);
    expect(res.revenueWithTax).toBe(550000);
  });

  it('SEMANTICS TEST: quantity = 10, VAT excluded reconstructed -> prevents double multiplication', () => {
    // 1 item: 100.000đ (VAT 10% excluded). Option: +20.000đ. Direct discount: 10.000đ/unit.
    // priceAtSale = 120.000đ
    // quantity = 10
    // grossLineTotal = 1.200.000đ
    // optionRevenue = 200.000đ
    // directDiscount = 100.000đ
    // netAfterDiscount = 1.100.000đ
    // VAT 10% excluded: tax = 110.000đ (PER-LINE)
    // withTax = 1.210.000đ

    const item: RawOrderItemInput = {
      id: 'i-qty10',
      orderId: 'o-qty10',
      productId: 'p-qty10',
      quantity: 10,
      priceAtSale: 120000,
      originalPriceAtSale: 100000,
      discountAmount: 10000,
      selectedOptions: [{ nameAtSale: 'Extra Beef', priceAdjustmentAtSale: 20000 }],
      taxPercentageAtSale: 10,
      vatPriceModeSnapshot: 'VAT_EXCLUDED',
      product: { id: 'p-qty10', name: 'Bò nướng', price: 100000, categoryId: 'c1' },
    };

    const res = service.calculateOrderItemFinancials(item, 0);

    expect(res.grossLineTotal).toBe(1200000);
    expect(res.totalOptionRevenue).toBe(200000);
    expect(res.totalBaseRevenue).toBe(1000000);
    expect(res.totalDirectDiscount).toBe(100000);
    expect(res.netAmountAfterDiscount).toBe(1100000);
    expect(res.taxAmount).toBe(110000); // 110.000đ, not 1.100.000đ!
    expect(res.revenueBeforeTax).toBe(1100000);
    expect(res.revenueWithTax).toBe(1210000);
  });
});
