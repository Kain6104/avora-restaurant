import { Test, TestingModule } from '@nestjs/testing';
import {
  TaxReportCalculationService,
  TaxOrderInput,
  TaxOrderItemInput,
} from './tax-report-calculation.service';

describe('TaxReportCalculationService', () => {
  let service: TaxReportCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaxReportCalculationService],
    }).compile();

    service = module.get<TaxReportCalculationService>(TaxReportCalculationService);
  });

  describe('Largest Remainder Method Voucher Allocation', () => {
    it('should allocate discount with 100% exactness without losing 1 VND', () => {
      // 3 items with prices 100,000, 200,000, 300,000
      // Discount to distribute = 10,000
      const items: TaxOrderItemInput[] = [
        {
          id: 'item-1',
          orderId: 'order-1',
          productId: 'prod-1',
          quantity: 1,
          priceAtSale: 100000,
          originalPriceAtSale: 100000,
        },
        {
          id: 'item-2',
          orderId: 'order-1',
          productId: 'prod-2',
          quantity: 1,
          priceAtSale: 200000,
          originalPriceAtSale: 200000,
        },
        {
          id: 'item-3',
          orderId: 'order-1',
          productId: 'prod-3',
          quantity: 1,
          priceAtSale: 300000,
          originalPriceAtSale: 300000,
        },
      ];

      const discount = 10000;
      const allocations = service.allocateOrderDiscount(items, discount);

      // Total of allocations must exactly equal discount
      const sumAlloc = allocations.reduce((a, b) => a + b, 0);
      expect(sumAlloc).toBe(discount);
      expect(allocations.length).toBe(3);
      // 100k / 600k * 10k = 1666.66 -> 1667
      // 200k / 600k * 10k = 3333.33 -> 3333
      // 300k / 600k * 10k = 5000.00 -> 5000
      expect(allocations[0]).toBe(1667);
      expect(allocations[1]).toBe(3333);
      expect(allocations[2]).toBe(5000);
      expect(allocations[0] + allocations[1] + allocations[2]).toBe(10000);
    });

    it('should handle uneven odd amounts and distribute remainder correctly', () => {
      const items: TaxOrderItemInput[] = [
        {
          id: 'item-1',
          orderId: 'order-1',
          productId: 'prod-1',
          quantity: 1,
          priceAtSale: 33333,
          originalPriceAtSale: 33333,
        },
        {
          id: 'item-2',
          orderId: 'order-1',
          productId: 'prod-2',
          quantity: 1,
          priceAtSale: 33333,
          originalPriceAtSale: 33333,
        },
        {
          id: 'item-3',
          orderId: 'order-1',
          productId: 'prod-3',
          quantity: 1,
          priceAtSale: 33334,
          originalPriceAtSale: 33334,
        },
      ];

      const discount = 10001;
      const allocations = service.allocateOrderDiscount(items, discount);
      const sumAlloc = allocations.reduce((a, b) => a + b, 0);
      expect(sumAlloc).toBe(10001);
    });
  });

  describe('calculateOrderItemTax', () => {
    it('should compute VAT Included 8% correctly', () => {
      // Net amount = 108,000 VND
      // Tax = 108,000 * 8 / 108 = 8,000 VND
      // Taxable = 108,000 - 8,000 = 100,000 VND
      const item: TaxOrderItemInput = {
        id: 'item-1',
        orderId: 'order-1',
        productId: 'prod-1',
        quantity: 1,
        priceAtSale: 108000,
        originalPriceAtSale: 108000,
        taxPercentageAtSale: 8,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
      };

      const result = service.calculateOrderItemTax(item, 0, 'VAT_INCLUDED');
      expect(result.taxPercentage).toBe(8);
      expect(result.taxAmount).toBe(8000);
      expect(result.taxableAmount).toBe(100000);
      expect(result.grossLineTotal).toBe(108000);
    });

    it('should compute VAT Excluded 10% correctly', () => {
      // Net amount = 100,000 VND
      // Tax = 100,000 * 10 / 100 = 10,000 VND
      // Taxable = 100,000 VND
      // GrossWithTax = 110,000 VND
      const item: TaxOrderItemInput = {
        id: 'item-2',
        orderId: 'order-1',
        productId: 'prod-2',
        quantity: 2,
        priceAtSale: 50000,
        originalPriceAtSale: 50000,
        taxPercentageAtSale: 10,
        vatPriceModeSnapshot: 'VAT_EXCLUDED',
      };

      const result = service.calculateOrderItemTax(item, 0, 'VAT_EXCLUDED');
      expect(result.quantity).toBe(2);
      expect(result.grossLineTotal).toBe(100000);
      expect(result.taxPercentage).toBe(10);
      expect(result.taxAmount).toBe(10000);
      expect(result.taxableAmount).toBe(100000);
      expect(result.grossRevenueWithTax).toBe(110000);
    });

    it('should compute 0% tax correctly', () => {
      const item: TaxOrderItemInput = {
        id: 'item-3',
        orderId: 'order-1',
        productId: 'prod-3',
        quantity: 1,
        priceAtSale: 50000,
        originalPriceAtSale: 50000,
        taxPercentageAtSale: 0,
      };

      const result = service.calculateOrderItemTax(item, 0, 'VAT_INCLUDED');
      expect(result.taxPercentage).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.taxableAmount).toBe(50000);
    });

    it('should not double-count options since priceAtSale already includes options', () => {
      const item: TaxOrderItemInput = {
        id: 'item-4',
        orderId: 'order-1',
        productId: 'prod-4',
        quantity: 2,
        priceAtSale: 65000, // 50k base + 15k option
        originalPriceAtSale: 65000,
        taxPercentageAtSale: 8,
        selectedOptions: [
          {
            nameAtSale: 'Trân châu đen',
            priceAdjustmentAtSale: 15000,
            quantity: 1,
          },
        ],
      };

      const result = service.calculateOrderItemTax(item, 0, 'VAT_INCLUDED');
      // grossLineTotal must be 2 * 65000 = 130000 (NOT 130000 + 30000)
      expect(result.grossLineTotal).toBe(130000);
      expect(result.totalOptionAmount).toBe(30000);
      expect(result.baseItemAmount).toBe(100000);
      expect(result.baseItemAmount + result.totalOptionAmount).toBe(result.grossLineTotal);
    });
  });

  describe('calculateOrderTax & Invariants Reconciliation', () => {
    it('should calculate complete order tax and verify all invariants pass', () => {
      const order: TaxOrderInput = {
        id: 'order-101',
        orderCode: 'AVR-101',
        branchId: 'branch-1',
        branch: { id: 'branch-1', name: 'Chi nhánh Quận 1', branchCode: 'Q1' },
        status: 'COMPLETED',
        createdAt: new Date('2026-09-10T10:00:00Z'),
        deliveredAt: new Date('2026-09-10T10:30:00Z'),
        subTotal: 216000,
        discountAmount: 16000,
        shippingFee: 30000,
        shippingDiscount: 10000,
        serviceChargeTotal: 0,
        taxAmount: 14815,
        totalAmount: 220000, // (216,000 - 16,000) + 20,000 shipping = 220,000
        vatPriceModeSnapshot: 'VAT_INCLUDED',
        paymentStatus: 'PAID',
        paymentMethod: 'VNPAY',
        payments: [
          {
            id: 'pay-1',
            paymentMethod: 'VNPAY',
            amount: 220000,
            status: 'COMPLETED',
          },
        ],
        orderItems: [
          {
            id: 'item-1',
            orderId: 'order-101',
            productId: 'p-1',
            quantity: 2,
            priceAtSale: 108000,
            originalPriceAtSale: 108000,
            taxPercentageAtSale: 8,
            vatPriceModeSnapshot: 'VAT_INCLUDED',
            product: {
              id: 'p-1',
              itemCode: 'DISH-1',
              name: 'Bò Wagyu Nướng',
              price: 108000,
              taxPercentage: 8,
              categoryId: 'cat-1',
              category: { id: 'cat-1', name: 'Món Nướng' },
            },
          },
        ],
      };

      const result = service.calculateOrderTax(order, 'VAT_INCLUDED');

      expect(result.orderStatus).toBe('COMPLETED');
      expect(result.completionTimestamp).toEqual(new Date('2026-09-10T10:30:00Z'));
      expect(result.isLegacyTimestampFallback).toBe(false);
      expect(result.grossItemAmount).toBe(216000);
      expect(result.allocatedOrderDiscount).toBe(16000);
      expect(result.netItemAmountAfterDiscount).toBe(200000);

      // Tax Included 8% of 200,000 = 200,000 * 8 / 108 = 14,815 VND
      expect(result.vatTotalAmount).toBe(14815);
      expect(result.taxableRevenueBeforeVat).toBe(200000 - 14815);
      expect(result.shippingFeeCustomerPaid).toBe(20000);

      // Reconciliation
      expect(result.reconciliation.isReconciled).toBe(true);
      expect(result.reconciliation.errorCode).toBe('OK');
      expect(result.reconciliation.hasWarning).toBe(false);
    });

    it('should flag PAYMENT_RECONCILIATION_WARNING if completed order has incomplete payment', () => {
      const order: TaxOrderInput = {
        id: 'order-warn',
        orderCode: 'AVR-WARN',
        branchId: 'branch-1',
        status: 'COMPLETED',
        createdAt: new Date(),
        deliveredAt: new Date(),
        subTotal: 100000,
        discountAmount: 0,
        shippingFee: 0,
        shippingDiscount: 0,
        serviceChargeTotal: 0,
        taxAmount: 8000,
        totalAmount: 100000,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
        paymentStatus: 'PENDING', // Warning: completed order with pending payment!
        paymentMethod: 'COD',
        payments: [],
        orderItems: [
          {
            id: 'item-1',
            orderId: 'order-warn',
            productId: 'p-1',
            quantity: 1,
            priceAtSale: 100000,
            originalPriceAtSale: 100000,
            taxPercentageAtSale: 8,
          },
        ],
      };

      const result = service.calculateOrderTax(order, 'VAT_INCLUDED');
      expect(result.reconciliation.hasWarning).toBe(true);
      expect(result.reconciliation.warningCode).toBe('PAYMENT_RECONCILIATION_WARNING');
    });

    it('should compute Refunded VAT accurately for partially refunded completed orders', () => {
      const order: TaxOrderInput = {
        id: 'order-refund',
        orderCode: 'AVR-REFUND',
        branchId: 'branch-1',
        status: 'COMPLETED',
        createdAt: new Date(),
        deliveredAt: new Date(),
        subTotal: 108000,
        discountAmount: 0,
        shippingFee: 0,
        shippingDiscount: 0,
        serviceChargeTotal: 0,
        taxAmount: 8000,
        totalAmount: 108000,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
        paymentStatus: 'PAID',
        payments: [
          {
            id: 'pay-rf',
            paymentMethod: 'TRANSFER',
            amount: 108000,
            status: 'COMPLETED',
            refunds: [
              {
                id: 'rf-1',
                amount: 54000, // 50% refund
                reason: 'Khách đổi món',
              },
            ],
          },
        ],
        orderItems: [
          {
            id: 'item-1',
            orderId: 'order-refund',
            productId: 'p-1',
            quantity: 1,
            priceAtSale: 108000,
            originalPriceAtSale: 108000,
            taxPercentageAtSale: 8,
          },
        ],
      };

      const result = service.calculateOrderTax(order, 'VAT_INCLUDED');
      expect(result.vatTotalAmount).toBe(8000);
      expect(result.refundedAmountTotal).toBe(54000);
      // 50% refund of 8000 = 4000
      expect(result.refundedTaxTotal).toBe(4000);
      expect(result.netVatTotal).toBe(4000);
    });
  });

  describe('Aggregations: Rates, Branches, Categories, Products, Trends', () => {
    it('should aggregate global, branch, category, and rate totals consistently', () => {
      const order1: TaxOrderInput = {
        id: 'ord-1',
        branchId: 'b-1',
        status: 'COMPLETED',
        createdAt: new Date('2026-09-12T08:00:00Z'),
        deliveredAt: new Date('2026-09-12T08:30:00Z'),
        subTotal: 108000,
        discountAmount: 0,
        shippingFee: 0,
        shippingDiscount: 0,
        serviceChargeTotal: 0,
        taxAmount: 8000,
        totalAmount: 108000,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
        orderItems: [
          {
            id: 'it-1',
            orderId: 'ord-1',
            productId: 'prod-1',
            quantity: 1,
            priceAtSale: 108000,
            originalPriceAtSale: 108000,
            taxPercentageAtSale: 8,
            product: {
              id: 'prod-1',
              name: 'Món 8%',
              price: 108000,
              categoryId: 'cat-1',
              category: { id: 'cat-1', name: 'Đồ Uống' },
            },
          },
        ],
      };

      const order2: TaxOrderInput = {
        id: 'ord-2',
        branchId: 'b-2',
        status: 'COMPLETED',
        createdAt: new Date('2026-09-12T09:00:00Z'),
        deliveredAt: new Date('2026-09-12T09:45:00Z'),
        subTotal: 110000,
        discountAmount: 0,
        shippingFee: 0,
        shippingDiscount: 0,
        serviceChargeTotal: 0,
        taxAmount: 10000,
        totalAmount: 110000,
        vatPriceModeSnapshot: 'VAT_INCLUDED',
        orderItems: [
          {
            id: 'it-2',
            orderId: 'ord-2',
            productId: 'prod-2',
            quantity: 1,
            priceAtSale: 110000,
            originalPriceAtSale: 110000,
            taxPercentageAtSale: 10,
            product: {
              id: 'prod-2',
              name: 'Món 10%',
              price: 110000,
              categoryId: 'cat-2',
              category: { id: 'cat-2', name: 'Món Chính' },
            },
          },
        ],
      };

      const calc1 = service.calculateOrderTax(order1);
      const calc2 = service.calculateOrderTax(order2);
      const orders = [calc1, calc2];

      const kpi = service.aggregateTaxKPIs(orders);
      expect(kpi.completedOrders).toBe(2);
      expect(kpi.totalVat).toBe(18000); // 8,000 + 10,000
      expect(kpi.vat8Amount).toBe(8000);
      expect(kpi.vat10Amount).toBe(10000);

      const rates = service.aggregateTaxRates(orders);
      const rate8 = rates.find((r) => r.ratePercentage === 8);
      const rate10 = rates.find((r) => r.ratePercentage === 10);
      expect(rate8?.taxAmount).toBe(8000);
      expect(rate10?.taxAmount).toBe(10000);

      const branches = service.aggregateTaxBranches(orders, [
        { id: 'b-1', name: 'CN 1' },
        { id: 'b-2', name: 'CN 2' },
      ]);
      const sumBranchVat = branches.reduce((sum, b) => sum + b.totalVat, 0);
      expect(sumBranchVat).toBe(kpi.totalVat);

      const categories = service.aggregateTaxCategories(orders);
      const sumCategoryVat = categories.reduce((sum, c) => sum + c.vatAmount, 0);
      expect(sumCategoryVat).toBe(kpi.totalVat);

      const products = service.aggregateTaxProducts(orders);
      const sumProductVat = products.reduce((sum, p) => sum + p.vatAmount, 0);
      expect(sumProductVat).toBe(kpi.totalVat);

      // Consistency invariant: Sum(Product VAT) === Sum(Category VAT) === Sum(Branch VAT) === Total VAT
      expect(sumProductVat).toBe(sumCategoryVat);
      expect(sumCategoryVat).toBe(sumBranchVat);
      expect(sumBranchVat).toBe(kpi.totalVat);
    });
  });
});
