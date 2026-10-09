import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ChatbotToolEngineService } from '../src/chatbot/chatbot-tool-engine.service';
import { ChatSessionContext } from '../src/chatbot/dto/chatbot-tool.dto';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ChatbotToolEngineService (Integration Tests)', () => {
  jest.setTimeout(120000);
  let app: INestApplication;
  let toolEngine: ChatbotToolEngineService;
  let prisma: PrismaService;
  let testBranchId: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    toolEngine = app.get<ChatbotToolEngineService>(ChatbotToolEngineService);
    prisma = app.get<PrismaService>(PrismaService);

    // Fetch existing branch for testing
    const branch = await prisma.branch.findFirst();
    testBranchId = branch ? branch.id : 'BR-TEST';

    // Fetch or find a test user
    const user = await prisma.user.findFirst();
    testUserId = user ? user.id : 'user-test';
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Branch & Menu Discovery Tools', () => {
    it('listBranches should return active branches', async () => {
      const res = await toolEngine.executeTool('listBranches', {});
      expect(res.success).toBe(true);
      expect(res.code).toBe('BRANCH_LIST_LOADED');
      expect(Array.isArray(res.data?.branches)).toBe(true);
    });

    it('searchMenu should return product items', async () => {
      const res = await toolEngine.executeTool('searchMenu', { query: 'cá' });
      expect(res.success).toBe(true);
      expect(res.code).toBe('MENU_SEARCH_COMPLETED');
      expect(res.data?.products).toBeDefined();
    });

    it('listCategories should return categories', async () => {
      const res = await toolEngine.executeTool('listCategories', {});
      expect(res.success).toBe(true);
      expect(res.code).toBe('CATEGORIES_LOADED');
    });
  });

  describe('Table Reservation Flow Tools', () => {
    it('getReservationSlots should compute slots for branch', async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const res = await toolEngine.executeTool('getReservationSlots', {
        branchId: testBranchId,
        date: tomorrow,
        partySize: 4,
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe('RESERVATION_SLOTS_LOADED');
      expect(Array.isArray(res.data?.slots)).toBe(true);
    });

    it('previewReservation should require missing fields if incomplete', async () => {
      const ctx: ChatSessionContext = {
        channel: 'TEXT',
        reservationDraft: {
          partySize: 4,
        },
      };

      const res = await toolEngine.executeTool('previewReservation', {}, ctx);
      expect(res.success).toBe(false);
      expect(res.code).toBe('MISSING_RESERVATION_FIELDS');
      expect(res.data?.missingFields).toContain('branch');
    });

    it('placeReservation should create a reservation atomically', async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const testPhone = '0901234567';
      const ctx: ChatSessionContext = {
        channel: 'TEXT',
        currentBranchId: testBranchId,
        reservationDraft: {
          branchId: testBranchId,
          reservationDate: tomorrow,
          reservationTime: '18:00',
          partySize: 2,
          customerName: 'Test AI Guest',
          customerPhone: testPhone,
        },
      };

      const idempotencyKey = `idemp-test-${Date.now()}`;
      const res = await toolEngine.executeTool('placeReservation', { idempotencyKey }, ctx, testUserId);
      if (!res.success) {
        console.error('placeReservation failed with:', res);
      }

      expect(res.success).toBe(true);
      expect(res.code).toBe('RESERVATION_PLACED_SUCCESS');
      expect(res.data?.reservationId).toBeDefined();
      expect(res.actionType).toBe('CONFIRM_RESERVATION');

      const reservationId = res.data?.reservationId;

      // Test idempotency: calling placeReservation again with same idempotency key
      const duplicateRes = await toolEngine.executeTool('placeReservation', { idempotencyKey }, ctx, testUserId);
      expect(duplicateRes.success).toBe(true);
      expect(duplicateRes.data?.reservationId).toBe(reservationId);

      // Clean up test reservation
      if (reservationId) {
        await toolEngine.executeTool('cancelReservation', {
          reservationId,
          reason: 'Automated test cleanup',
        }, ctx, testUserId);
      }
    });
  });

  describe('Cart & Food Ordering Flow Tools', () => {
    it('addToCart should require required options if unselected', async () => {
      // Find a product that has required options
      const productWithRequiredOpt = await prisma.product.findFirst({
        where: {
          optionGroups: {
            some: { isRequired: true },
          },
        },
        include: { optionGroups: { include: { optionItems: true } } },
      });

      if (productWithRequiredOpt) {
        const ctx: ChatSessionContext = { channel: 'TEXT', cart: [] };
        const res = await toolEngine.executeTool('addToCart', {
          productId: productWithRequiredOpt.id,
          quantity: 1,
          options: [], // intentionally empty
        }, ctx);

        expect(res.success).toBe(false);
        expect(res.code).toBe('REQUIRED_OPTIONS_MISSING');
      }
    });

    it('addToCart, updateCartItem, and getCart should work cohesively', async () => {
      const product = await prisma.product.findFirst({
        where: { available: true },
        include: { optionGroups: { include: { optionItems: true } } },
      });

      if (product) {
        const ctx: ChatSessionContext = { channel: 'TEXT', cart: [] };

        // Select options if required
        const selectedOptions = product.optionGroups.map((g) => ({
          optionGroupId: g.id,
          optionItemId: g.optionItems[0]?.id || '',
        })).filter((o) => o.optionItemId);

        const addRes = await toolEngine.executeTool('addToCart', {
          productId: product.id,
          quantity: 2,
          options: selectedOptions,
        }, ctx);

        expect(addRes.success).toBe(true);
        expect(addRes.code).toBe('CART_UPDATED');
        expect(ctx.cart.length).toBe(1);
        expect(ctx.cart[0].quantity).toBe(2);

        // Update quantity
        const updateRes = await toolEngine.executeTool('updateCartItem', {
          cartItemId: ctx.cart[0].id,
          quantity: 3,
        }, ctx);

        expect(updateRes.success).toBe(true);
        expect(ctx.cart[0].quantity).toBe(3);

        // Get cart
        const cartRes = await toolEngine.executeTool('getCart', {}, ctx);
        expect(cartRes.success).toBe(true);
        expect(cartRes.code).toBe('CART_VIEW_READY');
        expect(cartRes.data?.items.length).toBe(1);
      }
    });

    it('getAvailableOrderSlots should return delivery slots', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await toolEngine.executeTool('getAvailableOrderSlots', {
        branchId: testBranchId,
        date: todayStr,
        orderType: 'DELIVERY',
      }, { channel: 'TEXT' });

      expect(res.success).toBe(true);
      expect(res.code).toBe('ORDER_SLOTS_RETRIEVED');
    });

    it('getAvailableOrderSlots should support smart matching for requestedTime and return SELECT_ORDER_SLOT action', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await toolEngine.executeTool('getAvailableOrderSlots', {
        branchId: testBranchId,
        date: todayStr,
        orderType: 'DELIVERY',
        requestedTime: '11:45',
      }, { channel: 'TEXT' });

      expect(res.success).toBe(true);
      expect(res.actionType).toBe('SELECT_ORDER_SLOT');
      expect(res.code).toBe('ORDER_SLOT_SELECTED');
      expect(res.data?.selectedSlot).toBeDefined();
    });

    it('validateDeliveryAddress should reverse geocode GPS coordinates and compute shipping quote', async () => {
      const ctx: ChatSessionContext = {
        channel: 'TEXT',
        currentBranchId: testBranchId,
        cart: [],
      };

      // Tọa độ gần trung tâm TP.HCM
      const res = await toolEngine.executeTool('validateDeliveryAddress', {
        latitude: 10.7769,
        longitude: 106.7009,
        branchId: testBranchId,
      }, ctx, testUserId);

      expect(res.success).toBe(true);
      expect(res.code).toBe('DELIVERY_ADDRESS_VALID');
      expect(res.data?.quote).toBeDefined();
      expect(res.data?.quote?.distanceKm).toBeGreaterThan(0);
      expect(ctx.deliveryAddressSummary).toBeDefined();
    });

    it('previewOrder should calculate comprehensive pricing breakdown', async () => {
      const product = await prisma.product.findFirst({ where: { available: true } });
      if (!product) return;

      const ctx: ChatSessionContext = {
        channel: 'TEXT',
        currentBranchId: testBranchId,
        fulfillmentType: 'TAKE_AWAY',
        cart: [
          {
            id: 'item-1',
            productId: product.id,
            productName: product.name,
            basePrice: product.price,
            priceAtSale: product.price,
            quantity: 2,
            selectedOptions: [],
            isFlashSale: false,
          },
        ],
      };

      const res = await toolEngine.executeTool('previewOrder', {}, ctx, testUserId);
      if (!res.success) {
        console.error('previewOrder failed with:', res);
      }
      expect(res.success).toBe(true);
      expect(res.code).toBe('ORDER_PREVIEW_READY');
      expect(res.data?.subTotal).toBe(product.price * 2);
      expect(res.data?.totalAmount || res.data?.finalTotal).toBeGreaterThan(0);
      expect(res.actionType).toBe('ORDER_PREVIEW');
    });
  });
});
