import { ChatbotToolEngineService } from './chatbot-tool-engine.service';
import { ChatSessionContext } from './dto/chatbot-tool.dto';

describe('ChatbotToolEngineService - Contextual Suggestions & Category Search', () => {
  let service: ChatbotToolEngineService;
  let mockPrisma: any;
  let mockReservationService: any;
  let mockOrderService: any;
  let mockPricingService: any;
  let mockShippingFeeService: any;
  let mockOperatingSlotService: any;
  let mockPaymentMethodService: any;

  beforeEach(() => {
    mockPrisma = {
      category: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      voucher: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      branch: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      chatSession: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockReservationService = {};
    mockOrderService = {
      validateVoucherForChatbot: jest.fn().mockResolvedValue({ isValid: true }),
    };
    mockPricingService = {
      calculatePricing: jest.fn().mockResolvedValue({ subTotal: 250000 }),
    };
    mockShippingFeeService = {};
    mockOperatingSlotService = {
      getSlotsForDate: jest.fn().mockResolvedValue([]),
    };
    mockPaymentMethodService = {};

    service = new ChatbotToolEngineService(
      mockPrisma,
      mockReservationService,
      mockOrderService,
      mockPricingService,
      mockShippingFeeService,
      mockOperatingSlotService,
      mockPaymentMethodService,
    );
  });

  describe('Test A: Category Search & Contextual Suggestion Chips', () => {
    it('1. should match category when query is "Sushi & Maki" and return structured chips', async () => {
      mockPrisma.category.findFirst.mockResolvedValue({
        id: 'cat-sushi-maki',
        name: 'Sushi & Maki',
        slug: 'sushi-maki',
      });

      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Maki Cá Hồi Bơ',
          price: 95000,
          imageUrl: '/salmon-maki.jpg',
          category: { name: 'Sushi & Maki', slug: 'sushi-maki' },
          optionGroups: [],
          FlashSaleItem: [],
        },
        {
          id: 'prod-2',
          name: 'Cuộn Núi Lửa',
          price: 180000,
          imageUrl: '/volcano.jpg',
          category: { name: 'Sushi & Maki', slug: 'sushi-maki' },
          optionGroups: [],
          FlashSaleItem: [],
        },
      ]);

      const ctx: ChatSessionContext = { cart: [] };
      const res = await service.executeTool('searchMenu', { query: 'Gợi ý món trong danh mục Sushi & Maki' }, ctx);

      expect(res.success).toBe(true);
      expect(res.code).toBe('MENU_SEARCH_COMPLETED');
      expect(mockPrisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'Sushi & Maki' } },
            ]),
          }),
        }),
      );
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 'cat-sushi-maki',
          }),
        }),
      );
      expect(res.suggestedReplies).toBeDefined();
      expect(res.suggestedReplies?.length).toBeGreaterThan(0);
      expect((res.suggestedReplies?.[0] as any).label).toContain('Thêm Maki Cá Hồi Bơ vào giỏ');
      expect((res.suggestedReplies?.[0] as any).action).toBe('ADD_TO_CART');
    });

    it('2. toolListCategories should return category list and chips for top categories', async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Sushi & Maki', displayOrder: 1 },
        { id: 'cat-2', name: 'Sashimi Tươi Sống', displayOrder: 2 },
        { id: 'cat-3', name: 'Mì Ramen', displayOrder: 3 },
      ]);

      const res = await service.executeTool('listCategories', {});
      expect(res.success).toBe(true);
      expect(res.code).toBe('CATEGORIES_LOADED');
      expect(res.suggestedReplies).toHaveLength(3);
      expect((res.suggestedReplies?.[0] as any).label).toBe('Gợi ý món trong danh mục Sushi & Maki');
      expect((res.suggestedReplies?.[1] as any).label).toBe('Gợi ý món trong danh mục Sashimi Tươi Sống');
    });
  });

  describe('Test B: Budget Search & Suggestions', () => {
    it('should query dishes under specified budget and return budget-aware suggestions', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-nigiri',
          name: 'Nigiri Cá Hồi',
          price: 45000,
          category: { name: 'Sushi & Maki' },
          optionGroups: [],
          FlashSaleItem: [],
        },
      ]);

      const ctx: ChatSessionContext = { cart: [] };
      const res = await service.executeTool('searchMenu', { budget: 150000, query: 'món ăn nhẹ' }, ctx);

      expect(res.success).toBe(true);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: { lte: 150000 },
          }),
        }),
      );
      expect(res.suggestedReplies).toBeDefined();
      expect((res.suggestedReplies?.[0] as any).action).toBe('ADD_TO_CART');
    });
  });

  describe('Test C: Cart Operations & Follow-up Chips', () => {
    it('should add item to cart and suggest checking cart or proceeding to checkout', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-sushi',
        name: 'Nigiri Cá Hồi (Sake)',
        price: 45000,
        available: true,
        branches: [{ id: 'branch-1' }],
        optionGroups: [],
        FlashSaleItem: [],
      });

      const ctx: ChatSessionContext = { cart: [], currentBranchId: 'branch-1' };
      const res = await service.executeTool('addToCart', { productName: 'Nigiri Cá Hồi', quantity: 2 }, ctx);

      expect(res.success).toBe(true);
      expect(res.code).toBe('CART_UPDATED');
      expect(ctx.cart).toHaveLength(1);
      expect(ctx.cart[0].quantity).toBe(2);
      expect(res.suggestedReplies).toBeDefined();
      const labels = (res.suggestedReplies || []).map((s: any) => s.label);
      expect(labels).toContain('Kiểm tra giỏ hàng');
      expect(labels).toContain('Tiến hành chốt đơn');
    });
  });
});
