import {
  VoucherReportCalculationService,
  VoucherOrderInput,
  VoucherMetadataInput,
} from './voucher-report-calculation.service';

describe('VoucherReportCalculationService', () => {
  let service: VoucherReportCalculationService;

  beforeEach(() => {
    service = new VoucherReportCalculationService();
  });

  const mockVouchers: VoucherMetadataInput[] = [
    {
      id: 'v1',
      code: 'GIAM20K',
      title: 'Giảm 20k đơn từ 100k',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderValue: 100000,
      usedCount: 5,
      isFirstOrderOnly: false,
      isPublic: true,
      applicableScope: 'ALL',
      applicableProductsScope: 'ALL',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    },
    {
      id: 'v2',
      code: 'FREESHIP',
      title: 'Miễn phí vận chuyển',
      discountType: 'FREE_SHIP',
      discountValue: 15000,
      minOrderValue: 50000,
      usedCount: 3,
      isFirstOrderOnly: false,
      isPublic: true,
      applicableScope: 'ONLINE',
      applicableProductsScope: 'ALL',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    },
  ];

  const mockCompletedOrders: VoucherOrderInput[] = [
    {
      id: 'ord1',
      orderCode: 'AV-001',
      branchId: 'b1',
      userId: 'user1',
      customerName: 'Nguyễn Văn A',
      customerPhone: '0901112222',
      subTotal: 200000,
      discountAmount: 20000,
      shippingDiscount: 0,
      shippingFee: 15000,
      taxAmount: 18000,
      totalAmount: 213000,
      pointsUsed: 0,
      voucherId: 'v1',
      shippingVoucherId: null,
      discountVoucherCodeSnapshot: 'GIAM20K',
      shippingVoucherCodeSnapshot: null,
      orderSource: 'POS',
      paymentMethod: 'CASH',
      deliveredAt: new Date('2026-09-01T12:00:00Z'),
      createdAt: new Date('2026-09-01T11:45:00Z'),
      status: 'COMPLETED',
      userTotalCompletedOrders: 1, // First order
    },
    {
      id: 'ord2',
      orderCode: 'AV-002',
      branchId: 'b1',
      userId: 'user2',
      customerName: 'Trần Thị B',
      customerPhone: '0903334444',
      subTotal: 150000,
      discountAmount: 0,
      shippingDiscount: 15000,
      shippingFee: 15000,
      taxAmount: 15000,
      totalAmount: 150000,
      pointsUsed: 0,
      voucherId: null,
      shippingVoucherId: 'v2',
      discountVoucherCodeSnapshot: null,
      shippingVoucherCodeSnapshot: 'FREESHIP',
      orderSource: 'ONLINE',
      paymentMethod: 'VNPAY',
      deliveredAt: new Date('2026-09-02T13:00:00Z'),
      createdAt: new Date('2026-09-02T12:50:00Z'),
      status: 'COMPLETED',
      userTotalCompletedOrders: 3, // Returning customer
    },
    {
      id: 'ord3',
      orderCode: 'AV-003',
      branchId: 'b1',
      userId: 'user3',
      customerName: 'Lê Văn C',
      customerPhone: '0905556666',
      subTotal: 100000,
      discountAmount: 0,
      shippingDiscount: 0,
      shippingFee: 0,
      taxAmount: 10000,
      totalAmount: 110000,
      pointsUsed: 0,
      voucherId: null,
      shippingVoucherId: null,
      discountVoucherCodeSnapshot: null,
      shippingVoucherCodeSnapshot: null,
      orderSource: 'POS',
      paymentMethod: 'CASH',
      deliveredAt: new Date('2026-09-03T18:00:00Z'),
      createdAt: new Date('2026-09-03T17:40:00Z'),
      status: 'COMPLETED',
      userTotalCompletedOrders: 1,
    },
  ];

  it('should calculate accurate KPIs for completed orders with voucher', () => {
    const fraudSignals = service.detectVoucherFraudSignals(mockCompletedOrders, mockVouchers);
    const kpis = service.calculateVoucherKPIs(mockCompletedOrders, mockCompletedOrders, fraudSignals);

    // 2 out of 3 completed orders used a voucher
    expect(kpis.totalCompletedOrdersWithVoucher).toBe(2);
    expect(kpis.totalCompletedOrdersOverall).toBe(3);
    expect(kpis.uniqueVoucherUsers).toBe(2);

    // Gross revenue for voucher orders: 200,000 + 150,000 = 350,000
    expect(kpis.grossRevenueGenerated).toBe(350000);
    // Discount cost: 20,000 + 15,000 = 35,000
    expect(kpis.totalDiscountCost).toBe(35000);
    expect(kpis.orderDiscountCost).toBe(20000);
    expect(kpis.shippingDiscountCost).toBe(15000);

    // Ratio: 350,000 / 35,000 = 10.0x
    expect(kpis.revenueToDiscountRatio).toBe(10);

    // AOV voucher: 350,000 / 2 = 175,000
    expect(kpis.voucherAov).toBe(175000);
    // AOV non-voucher: 100,000 / 1 = 100,000
    expect(kpis.nonVoucherAov).toBe(100000);
    // Incremental: 75,000
    expect(kpis.incrementalAov).toBe(75000);
  });

  it('should separate voucher performance accurately', () => {
    const fraudSignals = service.detectVoucherFraudSignals(mockCompletedOrders, mockVouchers);
    const performance = service.calculateVoucherPerformance(mockVouchers, mockCompletedOrders, fraudSignals);

    expect(performance.length).toBe(2);
    const v1Perf = performance.find((p) => p.code === 'GIAM20K');
    expect(v1Perf).toBeDefined();
    expect(v1Perf?.completedUses).toBe(1);
    expect(v1Perf?.grossRevenue).toBe(200000);
    expect(v1Perf?.totalDiscountCost).toBe(20000);
    expect(v1Perf?.revenueToDiscountRatio).toBe(10);

    const v2Perf = performance.find((p) => p.code === 'FREESHIP');
    expect(v2Perf).toBeDefined();
    expect(v2Perf?.completedUses).toBe(1);
    expect(v2Perf?.grossRevenue).toBe(150000);
    expect(v2Perf?.totalDiscountCost).toBe(15000);
    expect(v2Perf?.discountType).toBe('FREE_SHIP');
  });

  it('should detect high discount ratio fraud signals', () => {
    const suspiciousOrder: VoucherOrderInput = {
      id: 'ord-fraud',
      orderCode: 'AV-FRAUD',
      branchId: 'b1',
      userId: 'user-bad',
      customerName: 'Gian lận',
      customerPhone: '0999999999',
      subTotal: 120000,
      discountAmount: 110000, // > 90% discount
      shippingDiscount: 0,
      shippingFee: 0,
      taxAmount: 0,
      totalAmount: 10000,
      pointsUsed: 0,
      voucherId: 'v1',
      shippingVoucherId: null,
      discountVoucherCodeSnapshot: 'GIAM20K',
      shippingVoucherCodeSnapshot: null,
      orderSource: 'ONLINE',
      paymentMethod: 'CASH',
      deliveredAt: new Date('2026-09-04T10:00:00Z'),
      createdAt: new Date('2026-09-04T09:50:00Z'),
      status: 'COMPLETED',
    };

    const signals = service.detectVoucherFraudSignals([suspiciousOrder], mockVouchers);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0].signalType).toBe('HIGH_DISCOUNT_RATIO');
    expect(signals[0].severity).toBe('HIGH');
  });
});
