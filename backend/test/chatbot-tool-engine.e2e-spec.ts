import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ChatbotToolEngineService } from '../src/chatbot/chatbot-tool-engine.service';
import { ChatSessionContext, ChatbotToolResult } from '../src/chatbot/dto/chatbot-tool.dto';
import { PrismaService } from '../src/prisma/prisma.service';

function resultData<T>(result: ChatbotToolResult): T {
  return result.data as T;
}

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
      const data = resultData<{ branches: unknown[] }>(res);
      expect(res.success).toBe(true);
      expect(res.code).toBe('BRANCH_LIST_LOADED');
      expect(Array.isArray(data.branches)).toBe(true);
    });

    it('searchMenu should return product items', async () => {
      const res = await toolEngine.executeTool('searchMenu', { query: 'cá' });
      const data = resultData<{ products: unknown[] }>(res);
      expect(res.success).toBe(true);
      expect(res.code).toBe('MENU_SEARCH_COMPLETED');
      expect(data.products).toBeDefined();
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
      const data = resultData<{ slots: unknown[] }>(res);

      expect(res.success).toBe(true);
      expect(res.code).toBe('RESERVATION_SLOTS_LOADED');
      expect(Array.isArray(data.slots)).toBe(true);
    });

    it('previewReservation should reject incomplete arguments before business logic', async () => {
      const ctx: ChatSessionContext = {
        channel: 'TEXT',
        reservationDraft: {
          partySize: 4,
        },
      };

      const res = await toolEngine.executeTool('previewReservation', {}, ctx);
      expect(res.success).toBe(false);
      expect(res.code).toBe('TOOL_ARGUMENTS_INVALID');
    });

    it('createReservation should consume a confirmed server draft', async () => {
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

      const preview = await toolEngine.executeTool('previewReservation', {
        branchId: testBranchId,
        reservationDate: tomorrow,
        reservationTime: '18:00',
        partySize: 2,
        customerName: 'Test AI Guest',
        customerPhone: testPhone,
      }, ctx, testUserId);
      expect(preview.success).toBe(true);
      expect(ctx.reservationConfirmation).toBeDefined();
      ctx.reservationConfirmation!.status = 'CONFIRMED';

      const res = await toolEngine.executeTool('createReservation', {}, ctx, testUserId);

      expect(res.success).toBe(true);
      expect(res.code).toBe('RESERVATION_PLACED_SUCCESS');
      const reservationData = res.data as { reservationId: string; reservationCode: string };
      expect(reservationData.reservationId).toBeDefined();
      expect(res.actionType).toBe('CONFIRM_RESERVATION');

      const reservationId = reservationData.reservationId;

      const replayRes = await toolEngine.executeTool('createReservation', {}, ctx, testUserId);
      expect(replayRes.success).toBe(false);
      expect(replayRes.code).toBe('CONFIRMATION_REQUIRED');

      // Clean up test reservation
      if (reservationId) {
        await toolEngine.executeTool('cancelReservation', {
          reservationCode: reservationData.reservationCode,
          phone: testPhone,
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
          optionItemIds: [], // intentionally empty
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
        const selectedOptionIds = product.optionGroups
          .map((group) => group.optionItems[0]?.id || '')
          .filter(Boolean);

        const addRes = await toolEngine.executeTool('addToCart', {
          productId: product.id,
          quantity: 2,
          optionItemIds: selectedOptionIds,
        }, ctx);

        expect(addRes.success).toBe(true);
        expect(addRes.code).toBe('CART_UPDATED');
        expect(ctx.cart.length).toBe(1);
        expect(ctx.cart[0].quantity).toBe(2);

        // Update quantity
        const updateRes = await toolEngine.executeTool('updateCartItem', {
          lineId: ctx.cart[0].lineId,
          quantity: 3,
        }, ctx);

        expect(updateRes.success).toBe(true);
        expect(ctx.cart[0].quantity).toBe(3);

        // Get cart
        const cartRes = await toolEngine.executeTool('getCart', {}, ctx);
        const cartData = resultData<{ items: unknown[] }>(cartRes);
        expect(cartRes.success).toBe(true);
        expect(cartRes.code).toBe('CART_VIEW_READY');
        expect(cartData.items.length).toBe(1);
      }
    });

    it('getAvailableOrderSlots should return delivery slots', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await toolEngine.executeTool('getAvailableOrderSlots', {
        branchId: testBranchId,
        date: todayStr,
        orderType: 'DELIVERY',
      }, { channel: 'TEXT' });
      const data = resultData<{ selectedSlot: unknown }>(res);

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
      expect(data.selectedSlot).toBeDefined();
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
      const data = resultData<{ quote: { distanceKm: number } }>(res);

      expect(res.success).toBe(true);
      expect(res.code).toBe('DELIVERY_ADDRESS_VALID');
      expect(data.quote).toBeDefined();
      expect(data.quote.distanceKm).toBeGreaterThan(0);
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
            lineId: 'item-1',
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
      const data = resultData<{ subTotal: number; totalAmount?: number; finalTotal?: number }>(res);
      expect(res.success).toBe(true);
      expect(res.code).toBe('ORDER_PREVIEW_READY');
      expect(data.subTotal).toBe(product.price * 2);
      expect(data.totalAmount || data.finalTotal).toBeGreaterThan(0);
      expect(res.actionType).toBe('ORDER_PREVIEW');
    });
  });
});
