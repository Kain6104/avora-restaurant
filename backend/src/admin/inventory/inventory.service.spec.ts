import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { InventoryLedgerService } from './inventory-ledger.service';
import { RecipeService } from './recipe.service';
import { InventoryReservationService } from './inventory-reservation.service';
import { FoodCostCalculationService } from './food-cost-calculation.service';
import { ProcurementService } from './procurement.service';
import { StockTransferService } from './stock-transfer.service';
import { StocktakeService } from './stocktake.service';
import { WasteService } from './waste.service';
import { InventoryMonitorService } from './inventory-monitor.service';
import { Avo1OnboardingService } from './avo1-onboarding.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InventoryTransactionType,
  RecipeStatus,
  PurchaseOrderStatus,
  InventoryTrackingPolicy,
} from '@prisma/client';

describe('Phase 3 Enterprise Inventory & Recipe Costing Suite', () => {
  let ledgerService: InventoryLedgerService;
  let recipeService: RecipeService;
  let reservationService: InventoryReservationService;
  let foodCostService: FoodCostCalculationService;
  let procurementService: ProcurementService;
  let transferService: StockTransferService;
  let stocktakeService: StocktakeService;
  let wasteService: WasteService;
  let monitorService: InventoryMonitorService;
  let onboardingService: Avo1OnboardingService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      ingredient: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      inventoryBalance: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      ingredientBatch: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      inventoryTransaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      inventoryReservation: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      inventoryOperationalException: {
        create: jest.fn(),
      },
      purchaseRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrder: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      goodsReceipt: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      goodsReceiptItem: {
        create: jest.fn(),
      },
      stockTransfer: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      stocktake: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      stocktakeItem: {
        create: jest.fn(),
        update: jest.fn(),
      },
      recipe: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      systemSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      recipeVersion: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      recipeIngredient: {
        create: jest.fn(),
      },
      recipeOptionModifier: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      optionItem: {
        findMany: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      orderItem: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      warehouse: {
        findMany: jest.fn(),
      },
      inventoryWaste: {
        findUnique: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      branch: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      supplier: {
        findMany: jest.fn(),
      },
      supplierIngredient: {
        count: jest.fn(),
      },
      buffetPackage: {
        updateMany: jest.fn(),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryLedgerService,
        RecipeService,
        InventoryReservationService,
        FoodCostCalculationService,
        ProcurementService,
        StockTransferService,
        StocktakeService,
        WasteService,
        InventoryMonitorService,
        Avo1OnboardingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    ledgerService = module.get<InventoryLedgerService>(InventoryLedgerService);
    recipeService = module.get<RecipeService>(RecipeService);
    reservationService = module.get<InventoryReservationService>(InventoryReservationService);
    foodCostService = module.get<FoodCostCalculationService>(FoodCostCalculationService);
    procurementService = module.get<ProcurementService>(ProcurementService);
    transferService = module.get<StockTransferService>(StockTransferService);
    stocktakeService = module.get<StocktakeService>(StocktakeService);
    wasteService = module.get<WasteService>(WasteService);
    monitorService = module.get<InventoryMonitorService>(InventoryMonitorService);
    onboardingService = module.get<Avo1OnboardingService>(Avo1OnboardingService);
  });

  describe('1. Inventory Ledger Engine & Concurrency Protection', () => {
    it('Scenario I: Prevents negative stock when issuing exceeds currentStock', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-salmon',
        name: 'Cá hồi tươi Na Uy',
        costPerPrimaryUnit: 490,
      });
      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        currentStock: 100, // 100g available
        reservedStock: 0,
        availableStock: 100,
      });

      await expect(
        ledgerService.recordTransaction({
          ingredientId: 'ing-salmon',
          branchId: 'branch-1',
          warehouseId: 'wh-1',
          type: InventoryTransactionType.RECIPE_CONSUMPTION,
          quantityOut: 250, // trying to deduct 250g when only 100g exists
          unitSymbol: 'g',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('FEFO Enforcement: Automatically consumes oldest non-expired batch first', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-salmon',
        name: 'Cá hồi tươi Na Uy',
        costPerPrimaryUnit: 490,
      });
      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        currentStock: 2000,
        reservedStock: 0,
        availableStock: 2000,
      });
      mockPrisma.ingredientBatch.findFirst.mockResolvedValue({
        id: 'batch-expiring-soon',
        batchNumber: 'LOT-001',
        remainingQuantity: 500,
        expirationDate: new Date('2026-11-12'),
      });
      mockPrisma.inventoryTransaction.create.mockResolvedValue({
        id: 'tx-1',
        transactionCode: 'ITX-20261110-1234',
        quantityOut: 150,
        batchId: 'batch-expiring-soon',
      });

      const res = await ledgerService.recordTransaction({
        ingredientId: 'ing-salmon',
        branchId: 'branch-1',
        warehouseId: 'wh-1',
        type: InventoryTransactionType.RECIPE_CONSUMPTION,
        quantityOut: 150,
        unitSymbol: 'g',
      });

      expect(res.batchId).toBe('batch-expiring-soon');
      expect(mockPrisma.ingredientBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-expiring-soon' },
          data: { remainingQuantity: 350, status: 'ACTIVE' },
        }),
      );
      expect(mockPrisma.inventoryBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentStock: 1850 }),
        }),
      );
    });

    it('Idempotency: Ignores duplicate execution for the same idempotencyKey', async () => {
      mockPrisma.inventoryTransaction.findUnique.mockResolvedValue({
        id: 'existing-tx',
        transactionCode: 'ITX-20261110-9999',
        idempotencyKey: 'CONSUME-item1-ing1',
      });

      const res = await ledgerService.recordTransaction({
        ingredientId: 'ing-1',
        branchId: 'b-1',
        warehouseId: 'wh-1',
        type: InventoryTransactionType.RECIPE_CONSUMPTION,
        quantityOut: 50,
        unitSymbol: 'g',
        idempotencyKey: 'CONSUME-item1-ing1',
      });

      expect(res.id).toBe('existing-tx');
      expect(mockPrisma.inventoryBalance.update).not.toHaveBeenCalled();
    });
  });

  describe('2. Recipe Costing & Gross Margin Precision', () => {
    it('Scenario A: Saves initial recipe as DRAFT with exact BOM cost and updates product costPrice only upon Chef Approval & Publish', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);
      mockPrisma.ingredient.findUnique
        .mockResolvedValueOnce({ id: 'ing-salmon', costPerPrimaryUnit: 500 }) // 500d/g
        .mockResolvedValueOnce({ id: 'ing-rice', costPerPrimaryUnit: 60 }); // 60d/g

      mockPrisma.recipe.create.mockResolvedValue({ id: 'rec-sushi', code: 'REC-SUSHI-01' });
      mockPrisma.recipeVersion.create.mockResolvedValue({ id: 'ver-1', versionNumber: 1, status: RecipeStatus.DRAFT });

      // Salmon: 50g * 500 = 25,000d + 10% prep loss = 27,500d
      // Rice: 80g * 60 = 4,800d
      // Total Recipe Cost = 32,300d
      await recipeService.createRecipe(
        {
          code: 'REC-SUSHI-01',
          name: 'Sushi Cá Hồi Phô Mai',
          productId: 'prod-sushi-1',
          servingSize: 1,
          ingredients: [
            { ingredientId: 'ing-salmon', quantity: 50, unitSymbol: 'g', preparationLossPercent: 10 },
            { ingredientId: 'ing-rice', quantity: 80, unitSymbol: 'g', preparationLossPercent: 0 },
          ],
        },
        { id: 'u1', fullName: 'Chef A' },
      );

      expect(mockPrisma.recipeVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            costPerServing: 32300,
            totalRecipeCost: 32300,
            status: RecipeStatus.DRAFT,
          }),
        }),
      );
      expect(mockPrisma.product.update).not.toHaveBeenCalled();

      // Publish after review/approval by a different actor updates product.costPrice
      mockPrisma.recipeVersion.findUnique.mockResolvedValue({
        id: 'ver-1',
        recipeId: 'rec-sushi',
        status: RecipeStatus.DRAFT,
        createdById: 'u1',
        approvedById: 'u2',
        approvedByName: 'Chef Lead B',
        approvedAt: new Date(),
        costPerServing: 32300,
        notes: '[WORKFLOW:APPROVED]',
        recipe: { id: 'rec-sushi', productId: 'prod-sushi-1' },
      });
      mockPrisma.recipeVersion.update.mockResolvedValue({
        id: 'ver-1',
        status: RecipeStatus.PUBLISHED,
      });

      await recipeService.publishVersion('rec-sushi', 'ver-1', { id: 'u2', fullName: 'Chef Lead B' });

      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-sushi-1' },
          data: { costPrice: 32300 },
        }),
      );
    });
  });

  describe('3. POS / KDS Integration, Buffet & Loyalty Zero-Price Consumption', () => {
    it('Scenario B & C: Consumes ingredients normally for ZERO-PRICE Buffet & Loyalty items', async () => {
      const mockBuffetOrderItem = {
        id: 'item-buffet-01',
        orderId: 'order-buffet',
        quantity: 2,
        priceAtSale: 0, // Zero price!
        pricingMode: 'BUFFET_INCLUDED',
        isPointRedemption: false,
        order: {
          branchId: 'branch-1',
          branch: { warehouses: [{ id: 'wh-kitchen' }] },
        },
        inventoryReservations: [
          {
            id: 'res-1',
            ingredientId: 'ing-salmon',
            warehouseId: 'wh-kitchen',
            reservedQuantity: 100, // 2 portions * 50g
            unitSymbol: 'g',
            status: 'ACTIVE',
          },
        ],
        inventoryTransactions: [],
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockBuffetOrderItem);
      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        currentStock: 1000,
        reservedStock: 100,
        availableStock: 900,
      });
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-salmon',
        name: 'Cá hồi',
        costPerPrimaryUnit: 500,
      });
      mockPrisma.inventoryTransaction.create.mockResolvedValue({
        id: 'tx-consume-1',
        quantityOut: 100,
        totalCost: 50000,
      });

      await reservationService.consumeOrderItemIngredients('item-buffet-01', 'wh-kitchen', {
        id: 'chef-1',
        fullName: 'Bếp KDS',
      });

      expect(mockPrisma.inventoryReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({ status: 'CONSUMED' }),
        }),
      );
      expect(mockPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: InventoryTransactionType.RECIPE_CONSUMPTION,
            quantityOut: 100,
            orderItemId: 'item-buffet-01',
          }),
        }),
      );
    });

    it('Scenario D: Releases inventory reservation cleanly when unpaid order is cancelled before prep', async () => {
      mockPrisma.inventoryReservation.findMany.mockResolvedValue([
        {
          id: 'res-cancel-1',
          ingredientId: 'ing-salmon',
          warehouseId: 'wh-kitchen',
          reservedQuantity: 150,
          status: 'ACTIVE',
        },
      ]);
      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        currentStock: 1000,
        reservedStock: 150,
        availableStock: 850,
      });

      await reservationService.releaseOrderReservations('order-cancelled');

      expect(mockPrisma.inventoryReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-cancel-1' },
          data: expect.objectContaining({ status: 'RELEASED' }),
        }),
      );
      expect(mockPrisma.inventoryBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            reservedStock: 0,
            availableStock: 1000,
          },
        }),
      );
    });
  });

  describe('4. Food Cost & Profitability Intelligence', () => {
    it('Scenario J: Reconciles Theoretical COGS, Actual COGS, Waste Loss, and Gross Margin %', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'o1',
          subTotal: 1000000,
          totalAmount: 1000000,
          orderItems: [{ costPriceSnapshot: 300000 }],
        },
      ]);
      mockPrisma.inventoryTransaction.aggregate.mockResolvedValue({
        _sum: { totalCost: 310000 },
      });
      mockPrisma.inventoryWaste.aggregate.mockResolvedValue({
        _sum: { totalLossValue: 20000 },
      });

      const report = await foodCostService.getFoodCostReport({ branchId: 'branch-1' });

      expect(report.financialKpis.totalNetFoodSales).toBe(1000000);
      expect(report.financialKpis.theoreticalCOGS).toBe(300000);
      expect(report.financialKpis.actualConsumptionCost).toBe(310000);
      expect(report.financialKpis.totalWasteCost).toBe(20000);
      expect(report.financialKpis.actualCOGS).toBe(330000); // 310k + 20k
      expect(report.financialKpis.grossProfit).toBe(670000); // 1000k - 330k
      expect(report.financialKpis.actualFoodCostPercent).toBe(33);
      expect(report.financialKpis.grossMarginPercent).toBe(67);
    });

    it('Workstream 9 Financial Certification: Excludes VAT, Shipping, Service Charge, and Refunded Sales while keeping physical COGS & Buffet 0d cost', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'o-vat-incl',
          subTotal: 1100000,
          discountAmount: 100000,
          taxAmount: 80000, // Included VAT inside net 1,000,000 -> Net Food Sales Ex-VAT = 920,000
          serviceChargeTotal: 50000,
          shippingFee: 30000,
          shippingDiscount: 0,
          vatPriceModeSnapshot: 'VAT_INCLUDED',
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          totalAmount: 1080000,
          orderItems: [
            { priceAtSale: 550000, costPriceSnapshot: 200000, pricingMode: 'REGULAR', isPointRedemption: false },
            { priceAtSale: 0, costPriceSnapshot: 90000, pricingMode: 'BUFFET_INCLUDED', isPointRedemption: false },
          ],
        },
        {
          id: 'o-refunded',
          subTotal: 500000,
          discountAmount: 0,
          taxAmount: 0,
          serviceChargeTotal: 0,
          shippingFee: 0,
          vatPriceModeSnapshot: 'VAT_EXCLUDED',
          paymentStatus: 'REFUNDED',
          status: 'COMPLETED',
          totalAmount: 500000,
          orderItems: [
            { priceAtSale: 0, costPriceSnapshot: 150000, pricingMode: 'REGULAR', isPointRedemption: true },
          ],
        },
      ]);
      mockPrisma.inventoryTransaction.aggregate.mockResolvedValue({
        _sum: { totalCost: 440000 }, // 200k + 90k + 150k physically consumed & never erased
      });
      mockPrisma.inventoryWaste.aggregate.mockResolvedValue({
        _sum: { totalLossValue: 10000 },
      });

      const report = await foodCostService.getFoodCostReport({ branchId: 'branch-1' });

      expect(report.financialKpis.totalNetFoodSales).toBe(920000);
      expect(report.certificationBreakdown.vatExcludedAmount).toBe(80000);
      expect(report.certificationBreakdown.shippingFeeExcluded).toBe(30000);
      expect(report.certificationBreakdown.serviceChargeExcluded).toBe(50000);
      expect(report.certificationBreakdown.refundedRevenueExcluded).toBe(500000);
      expect(report.certificationBreakdown.buffetIncludedCost).toBe(90000);
      expect(report.certificationBreakdown.loyaltyRedemptionCost).toBe(150000);
      expect(report.financialKpis.actualCOGS).toBe(450000); // 440k consumption + 10k waste
      expect(report.financialKpis.grossProfit).toBe(470000); // 920k - 450k
    });
  });

  describe('5. Phase 3.1 Multi-Batch FEFO, Procurement WAC, Policy & Segregation of Duties', () => {
    it('Workstream 8 FEFO Multi-Lot Waterfall: Consumes 7kg across Batch A (5kg) and Batch B (2kg/10kg), leaving Batch C (8kg) untouched', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-salmon',
        name: 'Cá hồi tươi',
        costPerPrimaryUnit: 500000,
      });
      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        currentStock: 23,
        reservedStock: 0,
        availableStock: 23,
      });
      mockPrisma.ingredientBatch.findMany.mockResolvedValue([
        { id: 'batch-A', batchNumber: 'LOT-A', remainingQuantity: 5, expirationDate: new Date('2026-11-11') },
        { id: 'batch-B', batchNumber: 'LOT-B', remainingQuantity: 10, expirationDate: new Date('2026-11-13') },
        { id: 'batch-C', batchNumber: 'LOT-C', remainingQuantity: 8, expirationDate: new Date('2026-11-17') },
      ]);
      mockPrisma.inventoryTransaction.create
        .mockResolvedValueOnce({ id: 'tx-a', batchId: 'batch-A', quantityOut: 5 })
        .mockResolvedValueOnce({ id: 'tx-b', batchId: 'batch-B', quantityOut: 2 });

      await ledgerService.recordTransaction({
        ingredientId: 'ing-salmon',
        branchId: 'b-1',
        warehouseId: 'wh-1',
        type: InventoryTransactionType.RECIPE_CONSUMPTION,
        quantityOut: 7,
        unitSymbol: 'kg',
      });

      expect(mockPrisma.ingredientBatch.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'batch-A' },
          data: { remainingQuantity: 0, status: 'DEPLETED' },
        }),
      );
      expect(mockPrisma.ingredientBatch.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: 'batch-B' },
          data: { remainingQuantity: 8, status: 'ACTIVE' },
        }),
      );
      expect(mockPrisma.ingredientBatch.update).toHaveBeenCalledTimes(2);
    });

    it('Workstream 8 Safety: Blocks issuing from EXPIRED or QUARANTINED batch', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-salmon',
        name: 'Cá hồi',
        costPerPrimaryUnit: 500,
      });
      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        currentStock: 10,
        reservedStock: 0,
        availableStock: 10,
      });
      mockPrisma.ingredientBatch.findUnique.mockResolvedValue({
        id: 'batch-quarantined',
        batchNumber: 'LOT-Q',
        status: 'QUARANTINED',
        remainingQuantity: 5,
      });

      await expect(
        ledgerService.recordTransaction({
          ingredientId: 'ing-salmon',
          branchId: 'b-1',
          warehouseId: 'wh-1',
          batchId: 'batch-quarantined',
          type: InventoryTransactionType.RECIPE_CONSUMPTION,
          quantityOut: 2,
          unitSymbol: 'kg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Workstream 7 Procurement & WAC: Rejects CANCELLED PO and computes exact Weighted Average Cost on GRN', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-cancelled',
        orderCode: 'PO-CANCEL-1',
        status: PurchaseOrderStatus.CANCELLED,
      });

      await expect(
        procurementService.createAndConfirmGoodsReceipt({
          purchaseOrderId: 'po-cancelled',
          branchId: 'b-1',
          warehouseId: 'wh-1',
          items: [{ ingredientId: 'ing-1', receivedQuantity: 5, unitSymbol: 'kg', unitCost: 400000 }],
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify WAC Calculation: Existing 10kg @ 400d/g (10,000g) + New 10kg (10,000g) @ 500d/g => New WAC = 450d/g
      mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce({
        id: 'po-approved',
        orderCode: 'PO-OK-1',
        status: PurchaseOrderStatus.APPROVED,
      });
      mockPrisma.goodsReceipt.findFirst.mockResolvedValue(null);
      mockPrisma.goodsReceipt.create.mockResolvedValue({ id: 'grn-1', receiptCode: 'GRN-TEST-1' });
      mockPrisma.ingredient.findUnique
        .mockResolvedValueOnce({
          id: 'ing-salmon',
          name: 'Cá hồi',
          purchaseToPrimaryFactor: 1000,
          costPerPrimaryUnit: 400, // 400d/g => 400,000d/kg
          primaryUnit: { symbol: 'g' },
          purchaseUnit: { symbol: 'kg' },
          unitConversionsFrom: [],
        })
        .mockResolvedValueOnce({
          id: 'ing-salmon',
          name: 'Cá hồi',
          costPerPrimaryUnit: 450,
        });
      mockPrisma.inventoryBalance.aggregate.mockResolvedValue({
        _sum: { currentStock: 10000 }, // 10kg already on hand
      });
      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        id: 'bal-1',
        currentStock: 10000,
        reservedStock: 0,
        availableStock: 10000,
      });
      mockPrisma.ingredientBatch.create.mockResolvedValue({ id: 'batch-new-1' });
      mockPrisma.inventoryTransaction.create.mockResolvedValue({ id: 'tx-grn-1' });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce({
        id: 'po-approved',
        items: [{ receivedQuantity: 10, orderQuantity: 10 }],
      });

      await procurementService.createAndConfirmGoodsReceipt({
        purchaseOrderId: 'po-approved',
        branchId: 'b-1',
        warehouseId: 'wh-1',
        items: [
          {
            ingredientId: 'ing-salmon',
            receivedQuantity: 10,
            unitSymbol: 'kg',
            unitCost: 500000, // 500k/kg => 500d/g
            batchNumber: 'LOT-WAC-1',
            expirationDate: '2026-12-30',
          },
        ],
      });

      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ing-salmon' },
          data: {
            latestPurchaseCost: 500000,
            averagePurchaseCost: 450000,
            costPerPrimaryUnit: 450,
          },
        }),
      );
    });

    it('Workstream 12 Segregation of Duties: Prevents self-approval on PO, Stock Transfer, Stocktake & Waste', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', createdById: 'user-staff-1' });
      await expect(
        procurementService.approvePurchaseOrder('po-1', { id: 'user-staff-1', fullName: 'Staff 1' }),
      ).rejects.toThrow(ForbiddenException);

      mockPrisma.stockTransfer.findUnique.mockResolvedValue({ id: 'tr-1', requestedById: 'user-staff-1' });
      await expect(
        transferService.approveTransfer('tr-1', { id: 'user-staff-1', fullName: 'Staff 1' }),
      ).rejects.toThrow(ForbiddenException);

      mockPrisma.stocktake.findUnique.mockResolvedValue({
        id: 'stk-1',
        status: 'SUBMITTED',
        conductedById: 'user-staff-1',
      });
      await expect(
        stocktakeService.reviewStocktake('stk-1', { approved: true }, { id: 'user-staff-1' }),
      ).rejects.toThrow(ForbiddenException);

      mockPrisma.inventoryWaste.findUnique.mockResolvedValue({ id: 'wst-1', reportedById: 'user-staff-1' });
      await expect(
        wasteService.reviewWaste('wst-1', { approved: true }, { id: 'user-staff-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Workstream 5 Operational Policy: Logs exception on WARN_AND_ALLOW & blocks on STRICT_TRACKING when branch is activated', async () => {
      const orderMissingRecipe = (policy: InventoryTrackingPolicy, activated: boolean) => ({
        id: 'ord-policy-1',
        orderCode: 'ORD-P1',
        branchId: 'branch-1',
        branch: {
          inventoryActivated: activated,
          inventoryPolicy: policy,
          warehouses: [{ id: 'wh-1' }],
        },
        orderItems: [
          {
            id: 'oi-1',
            productId: 'prod-no-rec',
            quantity: 1,
            inventoryReservations: [],
            product: { id: 'prod-no-rec', name: 'Món Mới Chưa Có CT', inventoryTracked: true, recipes: [] },
          },
        ],
      });

      // 1. WARN_AND_ALLOW: Allows service & logs InventoryOperationalException
      mockPrisma.order.findUnique.mockResolvedValueOnce(
        orderMissingRecipe(InventoryTrackingPolicy.WARN_AND_ALLOW, true),
      );
      await reservationService.reserveOrderIngredients('ord-policy-1', 'wh-1', { id: 'u1', fullName: 'Cashier' });
      expect(mockPrisma.inventoryOperationalException.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            exceptionType: 'MISSING_RECIPE',
            policyApplied: InventoryTrackingPolicy.WARN_AND_ALLOW,
            productId: 'prod-no-rec',
          }),
        }),
      );

      // 2. STRICT_TRACKING + inventoryActivated: Logs exception & throws BadRequestException
      mockPrisma.order.findUnique.mockResolvedValueOnce(
        orderMissingRecipe(InventoryTrackingPolicy.STRICT_TRACKING, true),
      );
      await expect(
        reservationService.reserveOrderIngredients('ord-policy-1', 'wh-1', { id: 'u1', fullName: 'Cashier' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('6. Phase 3.2 Chef Recipe Governance, Circular Dependency & Physical Opening Stocktake', () => {
    it('Enforces DRAFT -> SUBMITTED_FOR_REVIEW -> APPROVED -> PUBLISHED and blocks author self-approval', async () => {
      mockPrisma.recipeVersion.findUnique.mockResolvedValueOnce({
        id: 'ver-draft-1',
        recipeId: 'rec-1',
        status: RecipeStatus.DRAFT,
        createdById: 'chef-author-1',
        notes: null,
        recipe: { id: 'rec-1' },
      });
      mockPrisma.recipeVersion.update.mockResolvedValueOnce({
        id: 'ver-draft-1',
        status: RecipeStatus.DRAFT,
        notes: '[WORKFLOW:SUBMITTED_FOR_REVIEW]',
      });

      const submitted = await recipeService.submitVersionForReview(
        'rec-1',
        'ver-draft-1',
        { id: 'chef-author-1', fullName: 'Chef Author' },
      );
      expect(submitted.workflowStage).toBe('SUBMITTED_FOR_REVIEW');

      // Author tries to self-approve -> ForbiddenException
      mockPrisma.recipeVersion.findUnique.mockResolvedValueOnce({
        id: 'ver-draft-1',
        recipeId: 'rec-1',
        status: RecipeStatus.DRAFT,
        createdById: 'chef-author-1',
        notes: '[WORKFLOW:SUBMITTED_FOR_REVIEW]',
        recipe: { id: 'rec-1' },
      });
      await expect(
        recipeService.approveVersion('rec-1', 'ver-draft-1', { id: 'chef-author-1', fullName: 'Chef Author' }),
      ).rejects.toThrow(ForbiddenException);

      // Different R&D lead approves -> APPROVED
      mockPrisma.recipeVersion.findUnique.mockResolvedValueOnce({
        id: 'ver-draft-1',
        recipeId: 'rec-1',
        status: RecipeStatus.DRAFT,
        createdById: 'chef-author-1',
        notes: '[WORKFLOW:SUBMITTED_FOR_REVIEW]',
        recipe: { id: 'rec-1' },
      });
      mockPrisma.recipeVersion.update.mockResolvedValueOnce({
        id: 'ver-draft-1',
        status: RecipeStatus.DRAFT,
        approvedById: 'rd-lead-2',
        notes: '[WORKFLOW:APPROVED]',
      });

      const approved = await recipeService.approveVersion(
        'rec-1',
        'ver-draft-1',
        { id: 'rd-lead-2', fullName: 'R&D Lead' },
      );
      expect(approved.workflowStage).toBe('APPROVED');
    });

    it('Rejects circular dependency in semi-finished recipes', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);
      mockPrisma.recipe.findMany.mockResolvedValueOnce([]);
      mockPrisma.ingredient.findMany = jest.fn().mockResolvedValueOnce([
        { id: 'ing-sushi-rice', code: 'SEMI-SUSHI-RICE' },
      ]);

      await expect(
        recipeService.createRecipe(
          {
            code: 'SEMI-SUSHI-RICE',
            name: 'Cơm Sushi (Semi-Finished)',
            isSemiFinished: true,
            ingredients: [{ ingredientId: 'ing-sushi-rice', quantity: 100, unitSymbol: 'g' }],
          },
          { id: 'chef-1', fullName: 'Chef' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Commits OPENING_BALANCE ledger transactions and IngredientBatch records on approved Opening Stocktake', async () => {
      mockPrisma.stocktake.findUnique.mockResolvedValueOnce({
        id: 'stk-open-1',
        stocktakeCode: 'STK-OPEN-20261110-1234',
        branchId: 'branch-avo1',
        warehouseId: 'wh-avo1-kitchen',
        status: 'SUBMITTED',
        conductedById: 'staff-wh-1',
        notes: '[TYPE:OPENING_BALANCE]',
        items: [
          {
            id: 'stki-1',
            ingredientId: 'ing-salmon',
            systemQuantity: 0,
            actualQuantity: 4500,
            varianceQuantity: 4500,
            unitSymbol: 'g',
            unitCost: 490,
            notes: '[BATCH_META:{"batchNumber":"LOT-AVO1-SAL-01","expirationDate":"2026-11-14","unitCost":490}]',
          },
        ],
      });
      mockPrisma.ingredientBatch.create.mockResolvedValueOnce({ id: 'batch-open-1' });
      mockPrisma.ingredient.findUnique.mockResolvedValueOnce({
        id: 'ing-salmon',
        name: 'Cá hồi tươi Na Uy',
        costPerPrimaryUnit: 490,
      });
      mockPrisma.inventoryBalance.findUnique.mockResolvedValueOnce(null);
      mockPrisma.inventoryBalance.create.mockResolvedValueOnce({
        id: 'bal-new-1',
        currentStock: 0,
        reservedStock: 0,
        availableStock: 0,
      });
      mockPrisma.inventoryTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.inventoryTransaction.create.mockResolvedValueOnce({
        id: 'tx-open-1',
        type: InventoryTransactionType.OPENING_BALANCE,
        quantityIn: 4500,
      });
      mockPrisma.stocktake.update.mockResolvedValueOnce({
        id: 'stk-open-1',
        status: 'COMPLETED',
      });

      await stocktakeService.reviewStocktake(
        'stk-open-1',
        { approved: true },
        { id: 'mgr-avo1-2', fullName: 'Branch Manager AVO1' },
      );

      expect(mockPrisma.ingredientBatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            batchNumber: 'LOT-AVO1-SAL-01',
            initialQuantity: 4500,
            remainingQuantity: 4500,
          }),
        }),
      );
      expect(mockPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: InventoryTransactionType.OPENING_BALANCE,
            quantityIn: 4500,
            batchId: 'batch-open-1',
          }),
        }),
      );
    });
  });

  describe('7. Phase 3.3 Recipe Import Pipeline, Modifier Policy, Seed Reconciliation & Historical COGS Flag', () => {
    it('Dry-run validates CSV import, blocks overwriting PUBLISHED recipes, and commits valid rows strictly as DRAFT', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', itemCode: 'PRD-001', name: 'Sushi Cá Hồi', inventoryTracked: true },
        { id: 'prod-pub', itemCode: 'PRD-002', name: 'Sashimi Cá Hồi', inventoryTracked: true },
      ]);
      mockPrisma.ingredient.findMany.mockResolvedValue([
        {
          id: 'ing-sal',
          code: 'ING-SALMON-NORWAY',
          name: 'Cá hồi',
          costPerPrimaryUnit: 490,
          purchaseToPrimaryFactor: 1000,
          storageToPrimaryFactor: 1000,
          primaryUnit: { symbol: 'g' },
          purchaseUnit: { symbol: 'kg' },
          storageUnit: { symbol: 'kg' },
          unitConversionsFrom: [],
        },
      ]);
      mockPrisma.recipe.findMany.mockResolvedValue([
        {
          id: 'rec-pub',
          productId: 'prod-pub',
          versions: [{ id: 'v1', versionNumber: 1, status: RecipeStatus.PUBLISHED }],
        },
      ]);

      const csv = [
        'Product ID,Product Code,Product Name,Ingredient Code,Ingredient Quantity,Unit,Preparation Loss %,Yield Quantity,Preparation Notes,Chef Name',
        'prod-1,PRD-001,Sushi Cá Hồi,ING-SALMON-NORWAY,0.05,kg,10,1,Cắt lát 50g,Chef Minh',
        'prod-pub,PRD-002,Sashimi Cá Hồi,ING-SALMON-NORWAY,80,g,0,1,Protected published,Chef Minh',
      ].join('\n');

      const preview = await recipeService.previewRecipeImport({ csvContent: csv });
      expect(preview.summary.validRecipesCount).toBe(1);
      expect(preview.summary.invalidCount).toBe(1); // PRD-002 protected from overwrite
      expect(preview.recipes[0].estimatedTotalCost).toBe(26950); // 0.05kg = 50g * 1.1 * 490 = 26,950

      // Commit calls previewRecipeImport again (needs rec-pub still present so prod-pub is protected)
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);
      mockPrisma.recipe.findMany.mockResolvedValueOnce([
        {
          id: 'rec-pub',
          productId: 'prod-pub',
          versions: [{ id: 'v1', versionNumber: 1, status: RecipeStatus.PUBLISHED }],
        },
      ]);
      mockPrisma.ingredient.findUnique.mockResolvedValueOnce({
        id: 'ing-sal',
        code: 'ING-SALMON-NORWAY',
        name: 'Cá hồi',
        costPerPrimaryUnit: 490,
        purchaseToPrimaryFactor: 1000,
        storageToPrimaryFactor: 1000,
        primaryUnit: { symbol: 'g' },
        purchaseUnit: { symbol: 'kg' },
        storageUnit: { symbol: 'kg' },
      });
      mockPrisma.recipe.create.mockResolvedValueOnce({ id: 'rec-new-1', code: 'REC-PRD-001' });
      mockPrisma.recipeVersion.create.mockResolvedValueOnce({ id: 'ver-new-1', status: RecipeStatus.DRAFT });

      const committed = await recipeService.commitRecipeImport(
        { csvContent: csv },
        { id: 'chef-1', fullName: 'Chef Minh' },
      );
      expect(committed.importedCount).toBe(1);
      expect(committed.skippedInvalidCount).toBe(1);
      expect(mockPrisma.recipeVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: RecipeStatus.DRAFT }),
        }),
      );
    });

    it('Detects catalog modifier anomalies and supports 4-state bulk classification', async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([
        {
          id: 'p-anomaly',
          itemCode: 'PRD-102',
          name: 'Khoai tây chiên(combo)',
          category: { name: 'MÓN TRONG SET' },
          recipes: [],
          optionGroups: [
            {
              id: 'og-1',
              name: 'Lượng đá',
              optionItems: [{ id: 'oi-ice-1', name: 'Ít đá', priceAdjustment: 0 }],
            },
          ],
        },
      ]);
      mockPrisma.systemSetting.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          value: JSON.stringify({
            'oi-ice-1': { classification: 'INVALID_CATALOG_ASSIGNMENT', reason: 'Drink option on fries' },
          }),
        });

      const matrixRes = await recipeService.getModifierCoverageMatrix();
      expect(matrixRes.summary.invalidCatalogCount).toBe(1);
      expect(matrixRes.summary.anomaliesDetectedCount).toBe(1);
      expect(matrixRes.matrix[0].anomalyFlag).toContain('MÓN TRONG SET');
    });

    it('Guards AVO1-only vs Full-5-Branch seed reconciliation scope, requires dual approval, and isolates other branches', async () => {
      await expect(
        monitorService.executeAuthorizedSeedReconciliation({
          scope: 'AVO1_ONLY',
          balanceIds: ['bal-1'],
          managerApprovalRef: '',
          approvedById: '',
        }),
      ).rejects.toThrow(ForbiddenException);

      const avo1Ids = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'];

      // Rejects AVO1_ONLY without financeApprovalRef
      await expect(
        monitorService.executeAuthorizedSeedReconciliation({
          scope: 'AVO1_ONLY',
          balanceIds: avo1Ids,
          managerApprovalRef: 'MGR-AVO1-01',
          approvedById: 'mgr-1',
        }),
      ).rejects.toThrow(ForbiddenException);

      // Rejects AVO1_ONLY if non-WH-AVO1-KITCHEN row is included
      mockPrisma.inventoryBalance.findMany.mockResolvedValueOnce(
        avo1Ids.map((id, i) => ({
          id,
          warehouseId: i === 0 ? 'wh-avo2' : 'wh-avo1',
          warehouse: { code: i === 0 ? 'WH-AVO2-KITCHEN' : 'WH-AVO1-KITCHEN' },
          currentStock: 3000,
          reservedStock: 0,
          valuation: 660000,
        })),
      );
      await expect(
        monitorService.executeAuthorizedSeedReconciliation({
          scope: 'AVO1_ONLY',
          balanceIds: avo1Ids,
          managerApprovalRef: 'MGR-AVO1-01',
          approvedById: 'mgr-1',
          financeApprovalRef: 'FIN-01',
          financeApprovedById: 'fin-1',
        }),
      ).rejects.toThrow(ForbiddenException);

      // Passes dry-run and executes AVO1_ONLY updating ONLY those exact 8 IDs
      const avo1Rows = avo1Ids.map((id) => ({
        id,
        warehouseId: 'wh-avo1',
        warehouse: { code: 'WH-AVO1-KITCHEN' },
        currentStock: 3000,
        reservedStock: 0,
        valuation: 660000,
      }));
      mockPrisma.inventoryBalance.findMany.mockResolvedValue(avo1Rows);
      mockPrisma.inventoryTransaction.count.mockResolvedValue(0);
      mockPrisma.inventoryReservation.count.mockResolvedValue(0);
      mockPrisma.ingredientBatch.count.mockResolvedValue(0);
      mockPrisma.order.count.mockResolvedValue(0);

      const dryRun = await monitorService.executeAuthorizedSeedReconciliation({
        scope: 'AVO1_ONLY',
        balanceIds: avo1Ids,
        managerApprovalRef: 'MGR-AVO1-01',
        approvedById: 'mgr-1',
        financeApprovalRef: 'FIN-01',
        financeApprovedById: 'fin-1',
        dryRun: true,
      });
      expect(dryRun.eligible).toBe(true);
      expect(dryRun.scope).toBe('AVO1_ONLY');
      expect(mockPrisma.inventoryBalance.updateMany).not.toHaveBeenCalled();

      const execRes = await monitorService.executeAuthorizedSeedReconciliation(
        {
          scope: 'AVO1_ONLY',
          balanceIds: avo1Ids,
          managerApprovalRef: 'MGR-AVO1-01',
          approvedById: 'mgr-1',
          financeApprovalRef: 'FIN-01',
          financeApprovedById: 'fin-1',
          dryRun: false,
        },
        { id: 'admin-1', fullName: 'Ops Admin' },
      );
      expect(execRes.reconciledRowsCount).toBe(8);
      expect(mockPrisma.inventoryBalance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: avo1Ids } },
          data: { currentStock: 0, reservedStock: 0, availableStock: 0, valuation: 0 },
        }),
      );
    });

    it('Marks historical Food Cost completeness as INCOMPLETE when historical OrderItems have costPriceSnapshot = 0', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-hist',
          subTotal: 150000,
          totalAmount: 150000,
          orderItems: [{ costPriceSnapshot: 0, priceAtSale: 150000 }],
        },
      ]);
      mockPrisma.inventoryTransaction.aggregate.mockResolvedValueOnce({ _sum: { totalCost: 0 } });
      mockPrisma.inventoryWaste.aggregate.mockResolvedValueOnce({ _sum: { totalLossValue: 0 } });

      const report = await foodCostService.getFoodCostReport({});
      expect(report.certificationBreakdown.missingCostSnapshotItemCount).toBe(1);
      expect(report.certificationBreakdown.historicalCostCompleteness).toBe(
        'INCOMPLETE_MISSING_HISTORICAL_SNAPSHOTS',
      );
    });

    it('Updates existing RecipeOptionModifier idempotently instead of creating duplicates during bulk PHYSICAL_INGREDIENT_DELTA mapping', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValueOnce({
        id: 'ing-cheese',
        code: 'ING-CREAM-CHEESE',
        name: 'Cream Cheese',
        costPerPrimaryUnit: 220,
        purchaseToPrimaryFactor: 1000,
        storageToPrimaryFactor: 1000,
        primaryUnit: { symbol: 'g' },
        purchaseUnit: { symbol: 'kg' },
        storageUnit: { symbol: 'kg' },
        unitConversionsFrom: [],
      });
      mockPrisma.optionItem.findMany.mockResolvedValueOnce([
        {
          id: 'opt-add-cheese',
          optionGroup: {
            product: {
              recipes: [{ versions: [{ id: 'ver-draft-1', status: RecipeStatus.DRAFT }] }],
            },
          },
        },
      ]);
      mockPrisma.recipeOptionModifier.findFirst.mockResolvedValueOnce({ id: 'mod-existing-1' });
      mockPrisma.recipeOptionModifier.update.mockResolvedValueOnce({ id: 'mod-existing-1' });

      const res = await recipeService.bulkClassifyModifiers(
        {
          optionItemIds: ['opt-add-cheese'],
          classification: 'PHYSICAL_INGREDIENT_DELTA',
          ingredientId: 'ing-cheese',
          quantityDelta: 15,
          unitSymbol: 'g',
        },
        { id: 'chef-1', fullName: 'Chef A' },
      );

      expect(res.updatedCount).toBe(1);
      expect(mockPrisma.recipeOptionModifier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mod-existing-1' },
          data: expect.objectContaining({ quantityDelta: 15, costDeltaSnapshot: 3300 }),
        }),
      );
      expect(mockPrisma.recipeOptionModifier.create).not.toHaveBeenCalled();
    });
  });

  describe('8. Phase 3.5 AVO1 Onboarding Workspace, RBAC Supplier Masking, Checksum Guard & Stage B Activation Gates', () => {
    it('Verifies real User identity on task assignment and rejects unknown employee IDs', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        onboardingService.assignTaskOwner('WS-02-RECIPES', { employeeId: 'fake-emp' }, { id: 'admin-1' }),
      ).rejects.toThrow(NotFoundException);

      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'real-chef-1', fullName: 'Bếp Trưởng Minh', email: 'chef@avora.vn' });
      mockPrisma.systemSetting.findUnique.mockResolvedValueOnce(null);
      const assigned = await onboardingService.assignTaskOwner(
        'WS-02-RECIPES',
        { employeeId: 'real-chef-1', targetDate: '2026-11-15' },
        { id: 'admin-1', fullName: 'Ops Admin' },
      );
      expect(assigned.assignedEmployeeName).toBe('Bếp Trưởng Minh');
    });

    it('Rejects invalid file types, duplicate SHA-256 submissions, self-approval, and premature commit', async () => {
      await expect(
        onboardingService.submitOnboardingEvidence(
          {
            workstreamType: 'SUPPLIER_DATA',
            workstreamId: 'WS-06-SUPPLIERS',
            fileName: 'malware.exe',
            content: 'data',
          },
          { id: 'staff-1', fullName: 'Staff 1' },
        ),
      ).rejects.toThrow(BadRequestException);

      // Valid submission stored as PENDING_APPROVAL
      mockPrisma.systemSetting.findUnique.mockResolvedValueOnce({ value: JSON.stringify([]) });
      const sub = await onboardingService.submitOnboardingEvidence(
        {
          workstreamType: 'SUPPLIER_DATA',
          workstreamId: 'WS-06-SUPPLIERS',
          fileName: 'suppliers_verified.csv',
          content: 'code,taxCode\nSUP-1,0101234567',
        },
        { id: 'staff-1', fullName: 'Staff 1' },
      );
      expect(sub.status).toBe('PENDING_APPROVAL');
      expect(sub.fileSha256).toHaveLength(64);

      // Duplicate checksum blocked
      mockPrisma.systemSetting.findUnique.mockResolvedValueOnce({
        value: JSON.stringify([sub]),
      });
      await expect(
        onboardingService.submitOnboardingEvidence(
          {
            workstreamType: 'SUPPLIER_DATA',
            workstreamId: 'WS-06-SUPPLIERS',
            fileName: 'suppliers_verified_copy.csv',
            content: 'code,taxCode\nSUP-1,0101234567',
          },
          { id: 'staff-1', fullName: 'Staff 1' },
        ),
      ).rejects.toThrow(ConflictException);

      // Cannot commit before APPROVED
      mockPrisma.systemSetting.findUnique.mockResolvedValueOnce({
        value: JSON.stringify([sub]),
      });
      await expect(
        onboardingService.commitApprovedSubmission(sub.id, { id: 'mgr-2' }),
      ).rejects.toThrow(BadRequestException);

      // Submitter cannot self-approve
      mockPrisma.systemSetting.findUnique.mockResolvedValueOnce({
        value: JSON.stringify([sub]),
      });
      await expect(
        onboardingService.reviewOnboardingSubmission(sub.id, { approved: true }, { id: 'staff-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Enforces exception closure SoD and Set/Buffet maker-checker approval', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValueOnce({
        value: JSON.stringify([
          {
            id: 'EXC-AVO1-001',
            assignedEmployeeId: 'chef-1',
            approvalStatus: 'PENDING_INPUT',
          },
        ]),
      });
      await expect(
        onboardingService.closeOnboardingException(
          'EXC-AVO1-001',
          { evidenceRef: 'EVD-1', closureReason: 'Done' },
          { id: 'chef-1', fullName: 'Chef 1' },
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        onboardingService.approveCompositeDecision(
          {
            decisionType: 'BUFFET_TICKETS_NON_TRACKED',
            strategyOrOutcome: 'NON_TRACKED',
            approvalRef: 'OPS-2026-01',
            submittedById: 'ops-1',
          },
          { id: 'ops-1', fullName: 'Ops 1' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Masks supplier banking details by default and blocks premature Stage B or cross-branch activation', async () => {
      mockPrisma.supplier.findMany.mockResolvedValueOnce([
        {
          id: 'sup-1',
          code: 'SUP-1',
          name: 'Tokyo Star',
          bankName: 'Techcombank',
          bankAccountNumber: '19034567891011',
          bankAccountHolder: 'CTY TOKYO STAR',
        },
      ]);
      const maskedSuppliers = await procurementService.getSuppliers(false);
      expect(maskedSuppliers[0].bankAccountNumber).toBe('****1011');
      expect(maskedSuppliers[0].bankAccountHolder).toBe('[RESTRICTED_FINANCE_ONLY]');

      // Blocks cross-branch activation before AVO1
      mockPrisma.branch.findUnique.mockResolvedValueOnce({
        id: 'b-avo2',
        branchCode: 'AVO2',
        inventoryActivated: false,
      });
      mockPrisma.branch.findFirst.mockResolvedValueOnce({
        id: 'b-avo1',
        branchCode: 'AVO1',
        inventoryActivated: false,
      });
      await expect(
        monitorService.updateBranchActivation(
          'b-avo2',
          {
            inventoryActivated: true,
            inventoryPolicy: InventoryTrackingPolicy.WARN_AND_ALLOW,
            approvalRef: 'APR-AVO2',
          },
          { id: 'mgr-1' },
        ),
      ).rejects.toThrow(BadRequestException);

      // Blocks STRICT_TRACKING before 7-day WARN_AND_ALLOW pilot on AVO1
      mockPrisma.branch.findUnique.mockResolvedValueOnce({
        id: 'b-avo1',
        branchCode: 'AVO1',
        inventoryActivated: false,
        inventoryActivatedAt: null,
      });
      await expect(
        monitorService.updateBranchActivation(
          'b-avo1',
          {
            inventoryActivated: true,
            inventoryPolicy: InventoryTrackingPolicy.STRICT_TRACKING,
            approvalRef: 'APR-AVO1',
          },
          { id: 'mgr-1' },
        ),
      ).rejects.toThrow(BadRequestException);

      // Blocks AVO1 Stage B when recipes/opening stock gates fail
      mockPrisma.branch.findUnique.mockResolvedValueOnce({
        id: 'b-avo1',
        branchCode: 'AVO1',
        inventoryActivated: false,
      });
      mockPrisma.product.count.mockResolvedValueOnce(212).mockResolvedValueOnce(0);
      mockPrisma.inventoryTransaction.count.mockResolvedValueOnce(0);
      mockPrisma.inventoryBalance.count.mockResolvedValueOnce(8);
      mockPrisma.supplier.findMany.mockResolvedValueOnce([{ taxCode: null }]);
      await expect(
        monitorService.updateBranchActivation(
          'b-avo1',
          {
            inventoryActivated: true,
            inventoryPolicy: InventoryTrackingPolicy.WARN_AND_ALLOW,
            approvalRef: 'APR-AVO1',
          },
          { id: 'mgr-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

