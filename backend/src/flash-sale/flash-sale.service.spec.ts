import { Test, TestingModule } from '@nestjs/testing';
import { FlashSaleValidationService } from './flash-sale-validation.service';
import { FlashSaleStockService } from './flash-sale-stock.service';
import { FlashSalePricingService } from './flash-sale-pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('Flash Sale Enterprise System Unit Tests', () => {
  let validationService: FlashSaleValidationService;
  let stockService: FlashSaleStockService;
  let pricingService: FlashSalePricingService;

  const mockPrisma = {
    flashSale: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    flashSaleItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    orderItem: {
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlashSaleValidationService,
        FlashSaleStockService,
        FlashSalePricingService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    validationService = module.get<FlashSaleValidationService>(FlashSaleValidationService);
    stockService = module.get<FlashSaleStockService>(FlashSaleStockService);
    pricingService = module.get<FlashSalePricingService>(FlashSalePricingService);
  });

  describe('1. Time Bounds & Teaser Validation', () => {
    it('should pass when startTime < endTime and teaserStartAt <= startTime', () => {
      const start = new Date('2026-09-09T10:00:00Z');
      const end = new Date('2026-09-09T12:00:00Z');
      const teaser = new Date('2026-09-09T08:00:00Z');

      expect(() => validationService.validateTimeBounds(start, end, teaser)).not.toThrow();
    });

    it('should throw when startTime >= endTime', () => {
      const start = new Date('2026-09-09T12:00:00Z');
      const end = new Date('2026-09-09T10:00:00Z');

      expect(() => validationService.validateTimeBounds(start, end)).toThrow(BadRequestException);
    });

    it('should throw when teaserStartAt > startTime', () => {
      const start = new Date('2026-09-09T10:00:00Z');
      const end = new Date('2026-09-09T12:00:00Z');
      const teaser = new Date('2026-09-09T10:30:00Z');

      expect(() => validationService.validateTimeBounds(start, end, teaser)).toThrow(BadRequestException);
    });
  });

  describe('2. Slots Boundary & Overlap Validation', () => {
    const campaignStart = new Date('2026-09-09T08:00:00Z');
    const campaignEnd = new Date('2026-09-09T22:00:00Z');

    it('should pass with multiple non-overlapping slots inside campaign', () => {
      const slots = [
        { name: 'Slot 1', startTime: '2026-09-09T08:00:00Z', endTime: '2026-09-09T12:00:00Z' },
        { name: 'Slot 2', startTime: '2026-09-09T12:00:00Z', endTime: '2026-09-09T14:00:00Z' },
        { name: 'Slot 3', startTime: '2026-09-09T18:00:00Z', endTime: '2026-09-09T21:00:00Z' },
      ];

      expect(() => validationService.validateSlots(slots, campaignStart, campaignEnd)).not.toThrow();
    });

    it('should throw when a slot is outside campaign bounds', () => {
      const slots = [
        { name: 'Slot Out', startTime: '2026-09-09T07:00:00Z', endTime: '2026-09-09T10:00:00Z' },
      ];

      expect(() => validationService.validateSlots(slots, campaignStart, campaignEnd)).toThrow(BadRequestException);
    });

    it('should throw when slots overlap each other', () => {
      const slots = [
        { name: 'Slot 1', startTime: '2026-09-09T10:00:00Z', endTime: '2026-09-09T12:00:00Z' },
        { name: 'Slot 2', startTime: '2026-09-09T11:30:00Z', endTime: '2026-09-09T13:00:00Z' },
      ];

      expect(() => validationService.validateSlots(slots, campaignStart, campaignEnd)).toThrow(BadRequestException);
    });
  });

  describe('3. Campaign & Branch Collision Detection', () => {
    it('should detect collision when another campaign runs in same time for ALL_BRANCHES', async () => {
      mockPrisma.flashSale.findMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Flash Sale Trưa',
          startTime: new Date('2026-09-09T11:00:00Z'),
          endTime: new Date('2026-09-09T13:00:00Z'),
          branches: [], // All branches
        },
      ]);

      await expect(
        validationService.detectCampaignCollisions({
          startTime: new Date('2026-09-09T12:00:00Z'),
          endTime: new Date('2026-09-09T14:00:00Z'),
          branchIds: ['branch-1'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow concurrent campaigns if they run in completely different branches', async () => {
      mockPrisma.flashSale.findMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Flash Sale Q1',
          startTime: new Date('2026-09-09T11:00:00Z'),
          endTime: new Date('2026-09-09T13:00:00Z'),
          branches: [{ id: 'branch-q1', name: 'Quận 1' }],
        },
      ]);

      // Creating for Hoan Kiem branch -> NO collision
      await expect(
        validationService.detectCampaignCollisions({
          startTime: new Date('2026-09-09T12:00:00Z'),
          endTime: new Date('2026-09-09T14:00:00Z'),
          branchIds: ['branch-hn1'],
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('4. Concurrency & Oversell Protection (Stock Service)', () => {
    it('should atomically reserve stock when available', async () => {
      const mockTx: any = {
        flashSaleItem: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'item-1',
            stock: 20,
            sold: 15,
            isActive: true,
            product: { name: 'Sushi Sake' },
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const res = await stockService.atomicReserveStock(mockTx, 'item-1', 2, 'Sushi Sake');
      expect(res.quantity).toBe(2);
      expect(mockTx.flashSaleItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', stock: { gte: 17 }, isActive: true },
        data: { sold: { increment: 2 } },
      });
    });

    it('should throw FLASH_SALE_SOLD_OUT when requested exceeds remaining stock', async () => {
      const mockTx: any = {
        flashSaleItem: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'item-1',
            stock: 20,
            sold: 19,
            isActive: true,
            product: { name: 'Sushi Sake' },
          }),
        },
      };

      // Requesting 2 when only 1 is left
      await expect(
        stockService.atomicReserveStock(mockTx, 'item-1', 2, 'Sushi Sake'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw FLASH_SALE_SOLD_OUT when updateMany count is 0 (Race Condition simulation)', async () => {
      const mockTx: any = {
        flashSaleItem: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'item-1',
            stock: 20,
            sold: 19,
            isActive: true,
            product: { name: 'Sushi Sake' },
          }),
          // Another concurrent transaction updated first
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      await expect(
        stockService.atomicReserveStock(mockTx, 'item-1', 1, 'Sushi Sake'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should refund stock on order cancellation', async () => {
      const mockTx: any = {
        flashSaleItem: {
          findUnique: jest.fn().mockResolvedValue({ id: 'item-1', sold: 10 }),
          update: jest.fn().mockResolvedValue({ id: 'item-1', sold: 8 }),
        },
      };

      await stockService.atomicRefundStock(mockTx, 'item-1', 2);
      expect(mockTx.flashSaleItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { sold: 8 },
      });
    });
  });

  describe('5. Pricing Engine Single Source of Truth', () => {
    it('UPCOMING: before startTime during teaser window -> returns normal price and upcoming details', async () => {
      const now = new Date('2026-09-09T11:00:00Z');
      const start = new Date('2026-09-09T12:00:00Z');
      const end = new Date('2026-09-09T14:00:00Z');
      const teaser = new Date('2026-09-09T08:00:00Z');

      mockPrisma.flashSaleItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          productId: 'prod-1',
          flashSalePrice: 69000,
          stock: 20,
          sold: 0,
          isActive: true,
          flashSale: {
            id: 'camp-1',
            name: 'Siêu Sale',
            priority: 1,
            isActive: true,
            status: 'ACTIVE',
            applyOnline: true,
            branches: [],
            startTime: start,
            endTime: end,
            teaserStartAt: teaser,
          },
          slot: {
            id: 'slot-1',
            name: 'Trưa Giảm Sốc',
            startTime: start,
            endTime: end,
            teaserStartAt: teaser,
            isActive: true,
          },
        },
      ]);

      const result = await pricingService.resolveProductPrice({
        productId: 'prod-1',
        originalPrice: 89000,
        currentTime: now,
      });

      expect(result.pricingSource).toBe('NORMAL');
      expect(result.originalPrice).toBe(89000);
      expect(result.isFlashSaleActive).toBe(false);
      expect(result.isUpcoming).toBe(true);
      expect(result.upcomingFlashSale).toBeDefined();
      expect(result.upcomingFlashSale?.flashSalePrice).toBe(69000);
      expect(result.upcomingFlashSale?.countdownSeconds).toBe(3600); // 1 hour until start
    });

    it('ACTIVE: during slot time with stock available -> returns FLASH_SALE price and discount', async () => {
      const now = new Date('2026-09-09T12:30:00Z');
      const start = new Date('2026-09-09T12:00:00Z');
      const end = new Date('2026-09-09T14:00:00Z');

      mockPrisma.flashSaleItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          productId: 'prod-1',
          flashSalePrice: 69000,
          stock: 20,
          sold: 5,
          isActive: true,
          flashSale: {
            id: 'camp-1',
            name: 'Siêu Sale',
            priority: 1,
            isActive: true,
            status: 'ACTIVE',
            applyOnline: true,
            branches: [],
            startTime: start,
            endTime: end,
          },
          slot: {
            id: 'slot-1',
            name: 'Trưa Giảm Sốc',
            startTime: start,
            endTime: end,
            isActive: true,
          },
        },
      ]);

      const result = await pricingService.resolveProductPrice({
        productId: 'prod-1',
        originalPrice: 89000,
        currentTime: now,
      });

      expect(result.pricingSource).toBe('FLASH_SALE');
      expect(result.isFlashSaleActive).toBe(true);
      expect(result.flashSalePrice).toBe(69000);
      expect(result.discountAmount).toBe(20000);
      expect(result.remainingStock).toBe(15);
      expect(result.countdownSeconds).toBe(5400); // 1h30m until end
    });

    it('SOLD OUT: active time but sold >= stock -> reverts pricing to NORMAL and flags isSoldOut', async () => {
      const now = new Date('2026-09-09T12:30:00Z');
      const start = new Date('2026-09-09T12:00:00Z');
      const end = new Date('2026-09-09T14:00:00Z');

      mockPrisma.flashSaleItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          productId: 'prod-1',
          flashSalePrice: 69000,
          stock: 20,
          sold: 20, // All sold out!
          isActive: true,
          flashSale: {
            id: 'camp-1',
            name: 'Siêu Sale',
            priority: 1,
            isActive: true,
            status: 'ACTIVE',
            applyOnline: true,
            branches: [],
            startTime: start,
            endTime: end,
          },
          slot: {
            id: 'slot-1',
            name: 'Trưa Giảm Sốc',
            startTime: start,
            endTime: end,
            isActive: true,
          },
        },
      ]);

      const result = await pricingService.resolveProductPrice({
        productId: 'prod-1',
        originalPrice: 89000,
        currentTime: now,
      });

      expect(result.pricingSource).toBe('NORMAL');
      expect(result.isFlashSaleActive).toBe(false);
      expect(result.isSoldOut).toBe(true);
      expect(result.originalPrice).toBe(89000);
    });
  });
});
