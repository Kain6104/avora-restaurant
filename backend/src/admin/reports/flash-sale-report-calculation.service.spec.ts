import {
  FlashSaleReportCalculationService,
  FlashSaleCampaignInput,
  FlashSaleOrderItemInput,
} from './flash-sale-report-calculation.service';

describe('FlashSaleReportCalculationService', () => {
  let service: FlashSaleReportCalculationService;

  beforeEach(() => {
    service = new FlashSaleReportCalculationService();
  });

  const mockCampaigns: FlashSaleCampaignInput[] = [
    {
      id: 'fs1',
      code: 'FS-GOLDEN-HOUR',
      name: 'Giờ Vàng Giá Sốc',
      status: 'ACTIVE',
      startTime: new Date('2026-09-01T11:00:00Z'),
      endTime: new Date('2026-09-01T14:00:00Z'),
      isActive: true,
      slots: [
        {
          id: 'slot1',
          name: '11:30 - 13:30',
          startTime: new Date('2026-09-01T11:30:00Z'),
          endTime: new Date('2026-09-01T13:30:00Z'),
        },
      ],
      items: [
        {
          id: 'fsi1',
          flashSaleSlotId: 'slot1',
          productId: 'prod1',
          productName: 'Bò Wagyu Nướng',
          flashSalePrice: 199000,
          originalPriceSnapshot: 299000,
          stock: 10,
          reservedStock: 0,
          sold: 8,
          maxQuantityPerUser: 2,
          isActive: true,
        },
      ],
    },
  ];

  const mockCompletedItems: FlashSaleOrderItemInput[] = [
    {
      id: 'oi1',
      orderId: 'ord1',
      orderCode: 'AV-001',
      branchId: 'b1',
      productId: 'prod1',
      productName: 'Bò Wagyu Nướng',
      quantity: 2,
      priceAtSale: 199000,
      originalPriceAtSale: 299000,
      isFlashSaleItem: true,
      flashSaleId: 'fs1',
      flashSaleSlotId: 'slot1',
      flashSaleNameSnapshot: 'Giờ Vàng Giá Sốc',
      flashSalePriceSnapshot: 199000,
      orderDiscountAmount: 0,
      deliveredAt: new Date('2026-09-01T12:00:00Z'),
      createdAt: new Date('2026-09-01T11:45:00Z'),
      customerName: 'Khách A',
      customerPhone: '0901111111',
    },
    {
      id: 'oi2',
      orderId: 'ord2',
      orderCode: 'AV-002',
      branchId: 'b1',
      productId: 'prod1',
      productName: 'Bò Wagyu Nướng',
      quantity: 6,
      priceAtSale: 199000,
      originalPriceAtSale: 299000,
      isFlashSaleItem: true,
      flashSaleId: 'fs1',
      flashSaleSlotId: 'slot1',
      flashSaleNameSnapshot: 'Giờ Vàng Giá Sốc',
      flashSalePriceSnapshot: 199000,
      orderDiscountAmount: 0,
      deliveredAt: new Date('2026-09-01T12:30:00Z'),
      createdAt: new Date('2026-09-01T12:15:00Z'),
      customerName: 'Khách B',
      customerPhone: '0902222222',
    },
  ];

  it('should reconcile stock accurately and detect balanced stock', () => {
    const reconciliation = service.reconcileFlashSaleStock(mockCampaigns, mockCompletedItems);
    expect(reconciliation.length).toBe(1);

    const r = reconciliation[0];
    expect(r.initialStock).toBe(10);
    expect(r.systemSoldCounter).toBe(8);
    expect(r.actualCompletedSoldQuantity).toBe(8); // 2 + 6 = 8
    expect(r.remainingStock).toBe(2);
    expect(r.isOverselling).toBe(false);
    expect(r.isNegativeStock).toBe(false);
    expect(r.hasReconciliationError).toBe(false);
    expect(r.reconciliationStatus).toBe('BALANCED');
  });

  it('should detect overselling when actual sold exceeds initial stock', () => {
    const oversoldItems: FlashSaleOrderItemInput[] = [
      ...mockCompletedItems,
      {
        id: 'oi3',
        orderId: 'ord3',
        orderCode: 'AV-003',
        branchId: 'b1',
        productId: 'prod1',
        productName: 'Bò Wagyu Nướng',
        quantity: 5, // Total sold will be 8 + 5 = 13 > initial 10!
        priceAtSale: 199000,
        originalPriceAtSale: 299000,
        isFlashSaleItem: true,
        flashSaleId: 'fs1',
        flashSaleSlotId: 'slot1',
        flashSaleNameSnapshot: 'Giờ Vàng Giá Sốc',
        flashSalePriceSnapshot: 199000,
        orderDiscountAmount: 0,
        deliveredAt: new Date('2026-09-01T13:00:00Z'),
        createdAt: new Date('2026-09-01T12:45:00Z'),
      },
    ];

    const reconciliation = service.reconcileFlashSaleStock(mockCampaigns, oversoldItems);
    expect(reconciliation[0].isOverselling).toBe(true);
    expect(reconciliation[0].hasReconciliationError).toBe(true);
  });

  it('should calculate accurate Flash Sale KPIs for completed orders', () => {
    const reconciliation = service.reconcileFlashSaleStock(mockCampaigns, mockCompletedItems);
    const kpis = service.calculateFlashSaleKPIs(mockCampaigns, mockCompletedItems, reconciliation);

    expect(kpis.totalCompletedFlashSaleOrders).toBe(2);
    expect(kpis.totalFlashSaleItemsSold).toBe(8);
    expect(kpis.uniqueBuyers).toBe(2);

    // Revenue: 8 * 199,000 = 1,592,000
    expect(kpis.grossFlashSaleRevenue).toBe(1592000);
    // Original: 8 * 299,000 = 2,392,000
    expect(kpis.originalValueTotal).toBe(2392000);
    // Discount: 800,000
    expect(kpis.flashSaleDiscountCost).toBe(800000);

    // Sell-through: 8 / 10 = 80.0%
    expect(kpis.overallSellThroughRate).toBe(80);
  });
});
