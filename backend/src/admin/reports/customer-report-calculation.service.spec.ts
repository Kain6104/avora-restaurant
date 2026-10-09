import {
  CustomerReportCalculationService,
  CustomerProfileInput,
} from './customer-report-calculation.service';

describe('CustomerReportCalculationService', () => {
  let service: CustomerReportCalculationService;

  beforeEach(() => {
    service = new CustomerReportCalculationService();
  });

  const mockCustomers: CustomerProfileInput[] = [
    {
      id: 'cust1',
      fullName: 'Khách Mới Trong Tháng 9',
      phone: '0901111111',
      email: 'cust1@example.com',
      memberCode: 'MEM001',
      membershipTierId: 'tier1',
      membershipTierName: 'Standard',
      createdAt: new Date('2026-08-01T00:00:00Z'), // Registered in Aug, but first completed order in Sept!
      completedOrders: [
        {
          id: 'ord1',
          orderCode: 'ORD-001',
          userId: 'cust1',
          customerName: 'Khách Mới Trong Tháng 9',
          customerPhone: '0901111111',
          subTotal: 300000,
          totalAmount: 300000,
          discountAmount: 0,
          shippingDiscount: 0,
          shippingFee: 0,
          taxAmount: 24000,
          branchId: 'b1',
          orderSource: 'POS',
          orderType: 'DINE_IN',
          paymentMethod: 'CASH',
          voucherId: null,
          pointsUsed: 0,
          pointsAwarded: 30,
          deliveredAt: new Date('2026-09-05T12:00:00Z'),
          createdAt: new Date('2026-09-05T11:45:00Z'),
        },
      ],
    },
    {
      id: 'cust2',
      fullName: 'Khách Quay Lại (Returning)',
      phone: '0902222222',
      email: 'cust2@example.com',
      memberCode: 'MEM002',
      membershipTierId: 'tier2',
      membershipTierName: 'Gold',
      createdAt: new Date('2026-05-01T00:00:00Z'),
      completedOrders: [
        {
          id: 'ord_old',
          orderCode: 'ORD-OLD',
          userId: 'cust2',
          customerName: 'Khách Quay Lại',
          customerPhone: '0902222222',
          subTotal: 500000,
          totalAmount: 500000,
          discountAmount: 0,
          shippingDiscount: 0,
          shippingFee: 0,
          taxAmount: 40000,
          branchId: 'b1',
          orderSource: 'POS',
          orderType: 'DINE_IN',
          paymentMethod: 'VNPAY',
          voucherId: null,
          pointsUsed: 0,
          pointsAwarded: 50,
          deliveredAt: new Date('2026-07-10T12:00:00Z'), // Completed before Sept!
          createdAt: new Date('2026-07-10T11:45:00Z'),
        },
        {
          id: 'ord_new',
          orderCode: 'ORD-NEW',
          userId: 'cust2',
          customerName: 'Khách Quay Lại',
          customerPhone: '0902222222',
          subTotal: 400000,
          totalAmount: 400000,
          discountAmount: 0,
          shippingDiscount: 0,
          shippingFee: 0,
          taxAmount: 32000,
          branchId: 'b1',
          orderSource: 'POS',
          orderType: 'DINE_IN',
          paymentMethod: 'VNPAY',
          voucherId: null,
          pointsUsed: 0,
          pointsAwarded: 40,
          deliveredAt: new Date('2026-09-10T19:00:00Z'), // Completed in Sept!
          createdAt: new Date('2026-09-10T18:30:00Z'),
        },
      ],
    },
  ];

  it('should identify New Customer strictly by FIRST COMPLETED ORDER, not registration date', () => {
    const fromDate = new Date('2026-09-01T00:00:00Z');
    const toDate = new Date('2026-09-30T23:59:59Z');

    const kpis = service.calculateCustomerKPIs(mockCustomers, fromDate, toDate);

    // cust1 registered in Aug, but first completed order is Sept 5 -> MUST be New Customer in Sept!
    expect(kpis.newCustomersInPeriod).toBe(1);
    // cust2 had order in July and order in Sept -> Returning Customer in Sept!
    expect(kpis.returningCustomersInPeriod).toBe(1);

    // Total completed orders in Sept: ord1 + ord_new = 2
    expect(kpis.totalCompletedOrders).toBe(2);
    // Revenue in Sept: 300,000 + 400,000 = 700,000
    expect(kpis.totalCustomerGrossRevenue).toBe(700000);
  });

  it('should calculate repeat purchase rate accurately', () => {
    const fromDate = new Date('2026-09-01T00:00:00Z');
    const toDate = new Date('2026-09-30T23:59:59Z');

    const kpis = service.calculateCustomerKPIs(mockCustomers, fromDate, toDate);
    // 1 customer has 1 order (cust1), 1 customer has 2 orders (cust2) -> 50%
    expect(kpis.repeatPurchaseRatePercent).toBe(50);
  });

  it('should calculate frequency distribution and cohorts without errors', () => {
    const freq = service.calculateFrequencyDistribution(mockCustomers);
    expect(freq.length).toBe(5);

    const cohorts = service.calculateCohortRetention(mockCustomers);
    expect(cohorts.length).toBeGreaterThan(0);
    expect(cohorts[0].m0).toBe(100);
  });
});
