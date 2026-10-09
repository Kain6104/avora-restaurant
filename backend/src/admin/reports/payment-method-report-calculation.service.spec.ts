import { Test, TestingModule } from '@nestjs/testing';
import {
  PaymentMethodReportCalculationService,
  PaymentReportOrderInput,
  PaymentMethodConfigInput,
} from './payment-method-report-calculation.service';

describe('PaymentMethodReportCalculationService', () => {
  let service: PaymentMethodReportCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentMethodReportCalculationService],
    }).compile();

    service = module.get<PaymentMethodReportCalculationService>(
      PaymentMethodReportCalculationService,
    );
  });

  describe('CARDINAL TEST: 16 Completed Orders with exact revenue 4,458,400 VND', () => {
    it('should aggregate 16 orders across multiple payment methods with exact 100% total match', () => {
      // Setup dataset:
      // - 4 Chuyển khoản (2.127.000 ₫)
      // - 4 Card (1.626.500 ₫)
      // - 4 Cash (584.000 ₫)
      // - 1 CKCN (72.900 ₫)
      // - 2 OCB (38.000 ₫)
      // - 1 Bank OCB (10.000 ₫)
      // Total orders = 16
      // Total revenue = 4,458,400 ₫
      const orders: PaymentReportOrderInput[] = [
        // 4 Chuyển khoản (sum = 2,127,000)
        {
          id: 'ck-1',
          branchId: 'b-1',
          paymentMethod: 'Chuyển khoản',
          totalAmount: 500000,
          subTotal: 500000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
        {
          id: 'ck-2',
          branchId: 'b-1',
          paymentMethod: 'Chuyển khoản',
          totalAmount: 600000,
          subTotal: 600000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
        {
          id: 'ck-3',
          branchId: 'b-1',
          paymentMethod: 'Chuyển khoản',
          totalAmount: 527000,
          subTotal: 527000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
        {
          id: 'ck-4',
          branchId: 'b-1',
          paymentMethod: 'Chuyển khoản',
          totalAmount: 500000,
          subTotal: 500000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },

        // 4 Card (sum = 1,626,500)
        {
          id: 'card-1',
          branchId: 'b-1',
          paymentMethod: 'Card',
          totalAmount: 400000,
          subTotal: 400000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
        {
          id: 'card-2',
          branchId: 'b-1',
          paymentMethod: 'Card',
          totalAmount: 426500,
          subTotal: 426500,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
        {
          id: 'card-3',
          branchId: 'b-1',
          paymentMethod: 'Card',
          totalAmount: 400000,
          subTotal: 400000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
        {
          id: 'card-4',
          branchId: 'b-1',
          paymentMethod: 'Card',
          totalAmount: 400000,
          subTotal: 400000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },

        // 4 Cash (sum = 584,000)
        {
          id: 'cash-1',
          branchId: 'b-1',
          paymentMethod: 'Cash',
          totalAmount: 100000,
          subTotal: 100000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
        {
          id: 'cash-2',
          branchId: 'b-1',
          paymentMethod: 'Cash',
          totalAmount: 200000,
          subTotal: 200000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
        {
          id: 'cash-3',
          branchId: 'b-1',
          paymentMethod: 'Cash',
          totalAmount: 184000,
          subTotal: 184000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
        {
          id: 'cash-4',
          branchId: 'b-1',
          paymentMethod: 'Cash',
          totalAmount: 100000,
          subTotal: 100000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },

        // 1 CKCN (72,900)
        {
          id: 'ckcn-1',
          branchId: 'b-1',
          paymentMethod: 'CKCN',
          totalAmount: 72900,
          subTotal: 72900,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },

        // 2 OCB (sum = 38,000)
        {
          id: 'ocb-1',
          branchId: 'b-1',
          paymentMethod: 'OCB',
          totalAmount: 19000,
          subTotal: 19000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
        {
          id: 'ocb-2',
          branchId: 'b-1',
          paymentMethod: 'OCB',
          totalAmount: 19000,
          subTotal: 19000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },

        // 1 Bank OCB (10,000)
        {
          id: 'bank-ocb-1',
          branchId: 'b-1',
          paymentMethod: 'Bank OCB',
          totalAmount: 10000,
          subTotal: 10000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
          deliveredAt: new Date(),
        },
      ];

      expect(orders.length).toBe(16);

      const result = service.aggregatePaymentMethodsReport({ orders });

      // Invariant 1: Total Completed Orders must be EXACTLY 16
      expect(result.kpis.totalCompletedOrders).toBe(16);

      // Invariant 2: Total Revenue must be EXACTLY 4,458,400 ₫
      expect(result.kpis.totalGrossRevenue).toBe(4458400);
      expect(result.kpis.netCollected).toBe(4458400);

      // Invariant 3: SUM(orderCount of each method) must equal 16
      const sumMethodOrders = result.methods.reduce((sum, m) => sum + m.orderCount, 0);
      expect(sumMethodOrders).toBe(16);

      // Invariant 4: SUM(grossRevenue of each method) must equal 4,458,400 ₫
      const sumMethodRevenue = result.methods.reduce((sum, m) => sum + m.grossRevenue, 0);
      expect(sumMethodRevenue).toBe(4458400);

      // Verify individual methods
      const methodCK = result.methods.find((m) => m.methodCode === 'Chuyển khoản');
      expect(methodCK?.orderCount).toBe(4);
      expect(methodCK?.grossRevenue).toBe(2127000);

      const methodCard = result.methods.find((m) => m.methodCode === 'Card');
      expect(methodCard?.orderCount).toBe(4);
      expect(methodCard?.grossRevenue).toBe(1626500);

      const methodCash = result.methods.find((m) => m.methodCode === 'Cash');
      expect(methodCash?.orderCount).toBe(4);
      expect(methodCash?.grossRevenue).toBe(584000);

      const methodCKCN = result.methods.find((m) => m.methodCode === 'CKCN');
      expect(methodCKCN?.orderCount).toBe(1);
      expect(methodCKCN?.grossRevenue).toBe(72900);

      const methodOCB = result.methods.find((m) => m.methodCode === 'OCB');
      expect(methodOCB?.orderCount).toBe(2);
      expect(methodOCB?.grossRevenue).toBe(38000);

      const methodBankOCB = result.methods.find((m) => m.methodCode === 'Bank OCB');
      expect(methodBankOCB?.orderCount).toBe(1);
      expect(methodBankOCB?.grossRevenue).toBe(10000);

      // Reconciliation must pass with 0 errors
      expect(result.reconciliation.isReconciled).toBe(true);
      expect(result.reconciliation.errorCode).toBe('OK');
      expect(result.reconciliation.discrepancyRevenue).toBe(0);
      expect(result.reconciliation.discrepancyOrderCount).toBe(0);
    });
  });

  describe('Split Payment Handling', () => {
    it('should correctly allocate revenue to multiple methods while counting order only ONCE', () => {
      // 1 order with 500,000 VND:
      // 200,000 CASH
      // 300,000 TRANSFER
      const splitOrder: PaymentReportOrderInput = {
        id: 'ord-split-1',
        orderCode: 'AVR-SPLIT-1',
        branchId: 'b-1',
        totalAmount: 500000,
        subTotal: 500000,
        paymentMethod: 'CASH', // Initial method
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        createdAt: new Date(),
        deliveredAt: new Date(),
        payments: [
          {
            id: 'pay-1',
            paymentMethod: 'CASH',
            amount: 200000,
            status: 'COMPLETED',
          },
          {
            id: 'pay-2',
            paymentMethod: 'TRANSFER',
            amount: 300000,
            status: 'COMPLETED',
          },
        ],
      };

      const result = service.aggregatePaymentMethodsReport({ orders: [splitOrder] });

      // Total orders must still be 1 (NOT 2)
      expect(result.kpis.totalCompletedOrders).toBe(1);
      expect(result.kpis.totalGrossRevenue).toBe(500000);
      expect(result.kpis.splitPaymentOrderCount).toBe(1);

      // Methods revenue allocation:
      const cashMethod = result.methods.find((m) => m.methodCode === 'CASH');
      const transferMethod = result.methods.find((m) => m.methodCode === 'TRANSFER');

      expect(cashMethod?.grossRevenue).toBe(200000);
      expect(transferMethod?.grossRevenue).toBe(300000);

      // Primary method is TRANSFER (300k > 200k), so TRANSFER has orderCount = 1, CASH has orderCount = 0
      expect(transferMethod?.orderCount).toBe(1);
      expect(cashMethod?.orderCount).toBe(0);

      // Both methods have transactionCount = 1
      expect(cashMethod?.transactionCount).toBe(1);
      expect(transferMethod?.transactionCount).toBe(1);

      // Invariant: SUM(orderCount) must still equal 1
      const totalOrdersAcrossMethods = result.methods.reduce((sum, m) => sum + m.orderCount, 0);
      expect(totalOrdersAcrossMethods).toBe(1);

      // Invariant: SUM(grossRevenue) must equal 500,000
      const totalRevAcrossMethods = result.methods.reduce((sum, m) => sum + m.grossRevenue, 0);
      expect(totalRevAcrossMethods).toBe(500000);
    });
  });

  describe('Refund & Net Collected Handling', () => {
    it('should deduct refund from net collected for the specific payment method', () => {
      const order: PaymentReportOrderInput = {
        id: 'ord-rf',
        branchId: 'b-1',
        paymentMethod: 'CARD',
        totalAmount: 1000000,
        subTotal: 1000000,
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        createdAt: new Date(),
        deliveredAt: new Date(),
        payments: [
          {
            id: 'p-rf',
            paymentMethod: 'CARD',
            amount: 1000000,
            status: 'COMPLETED',
            refunds: [
              {
                id: 'rf-1',
                amount: 200000,
                reason: 'Khách đổi món',
              },
            ],
          },
        ],
      };

      const result = service.aggregatePaymentMethodsReport({ orders: [order] });
      const cardMethod = result.methods.find((m) => m.methodCode === 'CARD');

      expect(cardMethod?.grossRevenue).toBe(1000000);
      expect(cardMethod?.refundedAmount).toBe(200000);
      expect(cardMethod?.netCollected).toBe(800000);

      expect(result.kpis.totalRefundedAmount).toBe(200000);
      expect(result.kpis.netCollected).toBe(800000);
    });
  });

  describe('Cash vs Cashless Rate Calculation', () => {
    it('should compute Cashless Rate accurately', () => {
      const orders: PaymentReportOrderInput[] = [
        {
          id: '1',
          branchId: 'b-1',
          paymentMethod: 'CASH',
          totalAmount: 100000,
          subTotal: 100000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
        },
        {
          id: '2',
          branchId: 'b-1',
          paymentMethod: 'CARD',
          totalAmount: 200000,
          subTotal: 200000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
        },
        {
          id: '3',
          branchId: 'b-1',
          paymentMethod: 'VNPAY',
          totalAmount: 300000,
          subTotal: 300000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
        },
        {
          id: '4',
          branchId: 'b-1',
          paymentMethod: 'SEPAY_QR',
          totalAmount: 400000,
          subTotal: 400000,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: new Date(),
        },
      ];

      const result = service.aggregatePaymentMethodsReport({ orders });
      // 1 Cash (100k), 3 Cashless (Card, VNPAY, SEPAY_QR = 900k)
      // Total orders = 4 -> Cashless rate = 3/4 = 75%
      // Total revenue = 1,000,000 -> Cashless revenue = 900k = 90%
      expect(result.kpis.cashOrderCount).toBe(1);
      expect(result.kpis.cashlessOrderCount).toBe(3);
      expect(result.kpis.cashlessRatePercent).toBe(75);
      expect(result.kpis.cashlessRevenuePercent).toBe(90);
    });
  });
});
