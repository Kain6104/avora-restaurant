import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { QrOrderService } from './qr-order.service';
import { AuthService } from '../auth/auth.service';

describe('QrOrderService & Google OAuth QR Integration', () => {
  const originalEnv = process.env;
  let mockPrisma: any;
  let mockPosGateway: any;
  let mockPricingService: any;
  let mockBuffetService: any;
  let mockNotificationEngine: any;
  let mockOrderAuditService: any;
  let mockAuthService: AuthService;
  let service: QrOrderService;

  const rawToken = 'valid-test-token-123';
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const baseSession = {
    id: 'qr-sess-1',
    tokenHash,
    status: 'ACTIVE',
    branchId: 'branch-1',
    tableId: 'table-1',
    tableSessionId: 'ts-1',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    table: { id: 'table-1', name: 'Bàn M08', tableCode: 'M08' },
    branch: { id: 'branch-1', name: 'Avora Landmark 81', branchCode: 'L81', onlineOrderingEnabled: true },
    order: {
      id: 'ord-1',
      orderCode: 'TMP-001',
      temporaryOrderCode: 'TMP-001',
      orderType: 'DINE_IN',
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
      totalAmount: 150000,
      userId: null,
      pointsUsed: 0,
      buffetSessions: [],
    },
    guests: [],
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      QR_ORDER_TOKEN_SECRET: 'test-qr-secret',
      GOOGLE_CLIENT_ID: 'google-client-123.apps.googleusercontent.com',
      JWT_SECRET: 'test-jwt-secret-key',
    };

    mockPrisma = {
      qrOrderSession: {
        findUnique: jest.fn().mockResolvedValue({ ...baseSession, order: { ...baseSession.order } }),
        update: jest.fn().mockResolvedValue({}),
      },
      qrOrderGuest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'guest-1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'guest-1', ...data })),
      },
      qrOrderRound: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tableServiceRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'req-1', createdAt: new Date(), ...data }),
        ),
      },
      pointTransaction: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderPayment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      order: {
        update: jest.fn().mockResolvedValue({}),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      paymentMethod: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      notification: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockPosGateway = {
      emitEvent: jest.fn(),
      emitOrderUpdated: jest.fn(),
    };
    mockPricingService = {};
    mockBuffetService = {};
    mockNotificationEngine = {
      publishEvent: jest.fn().mockResolvedValue(true),
    };
    mockOrderAuditService = {
      log: jest.fn().mockResolvedValue(true),
    };

    const mockJwtService: any = {
      sign: jest.fn().mockReturnValue('signed-jwt-token'),
    };
    const mockNotificationService: any = {
      createNotification: jest.fn().mockResolvedValue(true),
    };
    mockAuthService = new AuthService(mockPrisma, mockJwtService, mockNotificationService);

    service = new QrOrderService(
      mockPrisma,
      mockPosGateway,
      mockPricingService,
      mockBuffetService,
      mockNotificationEngine,
      mockOrderAuditService,
      mockAuthService,
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Menu Resolution (Global Categories + QR_ORDER Channel Filter)', () => {
    it('returns global categories (branches: []) with QR_ORDER products and excludes non-QR or hidden categories', async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Món Chính',
          slug: 'mon-chinh',
          displayOrder: 1,
          products: [
            {
              id: 'prod-1',
              itemCode: 'MC01',
              name: 'Bò Lúc Lắc',
              price: 120000,
              discountedPrice: null,
              oldPrice: null,
              unit: 'Phần',
              badge: 'Bán chạy',
              imageUrl: '/uploads/bo.jpg',
              description: 'Thơm ngon',
              isBestSeller: true,
              available: true,
              salesChannels: ['POS', 'QR_ORDER', 'DINE_IN'],
              FlashSaleItem: [],
              optionGroups: [
                {
                  id: 'og-1',
                  name: 'Độ chín',
                  isRequired: false,
                  minSelections: 0,
                  maxSelections: 1,
                  optionItems: [{ id: 'oi-1', name: 'Chín vừa', priceAdjustment: 0, available: true }],
                },
              ],
            },
            {
              id: 'prod-2',
              itemCode: 'POSONLY',
              name: 'Phụ thu khăn lạnh POS',
              price: 5000,
              available: true,
              salesChannels: ['POS'], // NOT enabled on QR_ORDER
              FlashSaleItem: [],
              optionGroups: [],
            },
          ],
        },
      ]);

      const menu = await service.getMenu(rawToken);

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: { not: 'system-hidden' },
            OR: [{ branches: { none: {} } }, { branches: { some: { id: 'branch-1' } } }],
          },
        }),
      );
      expect(menu.retailCategories).toHaveLength(1);
      expect(menu.retailCategories[0].products).toHaveLength(1);
      expect(menu.retailCategories[0].products[0].id).toBe('prod-1');
      // Normalizes both items and optionItems for compatibility
      expect(menu.retailCategories[0].products[0].optionGroups[0].items).toHaveLength(1);
      expect(menu.retailCategories[0].products[0].optionGroups[0].optionItems).toHaveLength(1);
    });
  });

  describe('QR Payment Methods Rules (Phase 6 - 9 Scenarios)', () => {
    const dbMethods = [
      {
        id: 'pm-transfer',
        methodCode: 'TRANSFER',
        name: 'Chuyển khoản VietQR',
        gatewayType: 'TRANSFER',
        bankCode: 'VCB',
        accountNumber: '1019224767',
        accountName: 'AVORA RESTAURANT',
        minOrderValue: 0,
        isActiveForQr: true,
        isAllBranches: true,
        displayOrder: 1,
      },
      {
        id: 'pm-cash',
        methodCode: 'CASH',
        name: 'Tiền mặt - tại quầy',
        gatewayType: 'CASH',
        minOrderValue: 0,
        isActiveForQr: true,
        isAllBranches: true,
        displayOrder: 2,
      },
      {
        id: 'pm-card',
        methodCode: 'CARD',
        name: 'Thẻ - qua máy POS',
        gatewayType: 'CARD',
        minOrderValue: 0,
        isActiveForQr: true,
        isAllBranches: true,
        displayOrder: 3,
      },
    ];

    it('1 & 8. returns all 3 configured active QR methods sorted by displayOrder & strips internal secrets', async () => {
      mockPrisma.paymentMethod.findMany.mockResolvedValue([
        ...dbMethods,
        {
          id: 'pm-payos-secret',
          methodCode: 'PAYOS',
          name: 'PayOS',
          gatewayType: 'PAYOS',
          configId: 'cfg-1',
          configKey1: 'secret-key-should-be-stripped',
          minOrderValue: 0,
          displayOrder: 4,
        },
      ]);

      const res = await service.getPaymentMethods(rawToken);
      expect(res.methods.map((m) => m.methodCode)).toEqual(['TRANSFER', 'CASH', 'CARD', 'PAYOS']);
      expect((res.methods[3] as any).configKey1).toBeUndefined();
      expect((res.methods[3] as any).configId).toBeUndefined();
      expect(mockPrisma.paymentMethod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActiveForQr: true,
            minOrderValue: { lte: 150000 },
          }),
          orderBy: { displayOrder: 'asc' },
        }),
      );
    });

    it('2, 3, 4, 7. filters out unconfigured gateways (e.g. TRANSFER missing bank info / PAYOS missing keys)', async () => {
      mockPrisma.paymentMethod.findMany.mockResolvedValue([
        dbMethods[1], // CASH
        dbMethods[2], // CARD
        {
          id: 'pm-broken-transfer',
          methodCode: 'TRANSFER_BROKEN',
          name: 'Broken Transfer',
          gatewayType: 'TRANSFER',
          bankCode: null,
          accountNumber: null,
          accountName: null,
        },
        {
          id: 'pm-broken-payos',
          methodCode: 'PAYOS',
          name: 'PayOS',
          gatewayType: 'PAYOS',
          configId: null,
          configKey1: null,
        },
      ]);

      const res = await service.getPaymentMethods(rawToken);
      expect(res.methods.map((m) => m.methodCode)).toEqual(['CASH', 'CARD']);
    });

    it('6 & 9. payment request creates OPEN TableServiceRequest without marking order PAID, and rejects disabled methodCode', async () => {
      mockPrisma.paymentMethod.findMany.mockResolvedValue([dbMethods[0], dbMethods[1]]);

      // Rejects CARD if not in active QR list for this branch/order
      await expect(
        service.createServiceRequest(rawToken, {
          deviceSessionId: 'dev-1',
          requestType: 'PAYMENT',
          paymentMethodCode: 'CARD',
        }),
      ).rejects.toThrow(BadRequestException);

      const okRes = await service.createServiceRequest(rawToken, {
        deviceSessionId: 'dev-1',
        requestType: 'PAYMENT',
        paymentMethodCode: 'CASH',
      });
      expect(okRes.success).toBe(true);
      expect(okRes.request.status).toBe('OPEN');
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('Google OAuth & Account Linking Security (Phase 4)', () => {
    it('reports enabled=false when GOOGLE_CLIENT_ID is missing without leaking secrets', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      const cfg = await service.getGoogleAuthConfig(rawToken);
      expect(cfg.enabled).toBe(false);
      expect(cfg.clientId).toBeNull();
    });

    it('rejects ID token with wrong audience or unverified email', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          iss: 'https://accounts.google.com',
          aud: 'wrong-app-client-id',
          email: 'attacker@gmail.com',
          email_verified: 'true',
          sub: 'sub-999',
        }),
      } as any);

      await expect(
        service.authenticateWithGoogle(rawToken, { idToken: 'x'.repeat(30), deviceSessionId: 'dev-1' }),
      ).rejects.toThrow(UnauthorizedException);

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          iss: 'https://accounts.google.com',
          aud: 'google-client-123.apps.googleusercontent.com',
          email: 'unverified@gmail.com',
          email_verified: false,
          sub: 'sub-111',
        }),
      } as any);

      await expect(
        service.authenticateWithGoogle(rawToken, { idToken: 'y'.repeat(30), deviceSessionId: 'dev-1' }),
      ).rejects.toThrow(UnauthorizedException);

      fetchSpy.mockRestore();
    });

    it('verifies valid Google ID token, links existing email without duplicating user or changing role, and honors point lock', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          iss: 'https://accounts.google.com',
          aud: 'google-client-123.apps.googleusercontent.com',
          email: 'customer@example.com',
          email_verified: 'true',
          sub: 'google-sub-777',
          name: 'Nguyễn Văn A',
        }),
      } as any);

      const existingCustomer = {
        id: 'user-cust-1',
        email: 'customer@example.com',
        fullName: 'Nguyễn Văn A',
        role: 'USER',
        points: 1200,
        memberCode: '6868000010',
        googleId: null,
        avatarUrl: null,
        isAccountLocked: false,
        membershipTier: { name: 'Gold', discountPercent: 5 },
      };

      mockPrisma.user.findFirst.mockResolvedValue(existingCustomer);
      mockPrisma.user.update.mockResolvedValue({ ...existingCustomer, googleId: 'google-sub-777' });

      const res = await service.authenticateWithGoogle(rawToken, {
        idToken: 'valid-token-'.padEnd(30, 'a'),
        deviceSessionId: 'dev-1',
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-cust-1' },
          data: expect.objectContaining({ googleId: 'google-sub-777', isEmailVerified: true }),
        }),
      );
      expect(res.guest.memberVerified).toBe(true);
      expect(res.guest.user.points).toBe(1200);
      expect(res.jwtToken).toBe('signed-jwt-token');

      // Now simulate another user trying to replace an order that already redeemed points
      mockPrisma.qrOrderSession.findUnique.mockResolvedValueOnce({
        ...baseSession,
        order: { ...baseSession.order, userId: 'different-user', pointsUsed: 500 },
      });
      await expect(
        service.authenticateWithGoogle(rawToken, {
          idToken: 'valid-token-'.padEnd(30, 'a'),
          deviceSessionId: 'dev-1',
        }),
      ).rejects.toThrow(BadRequestException);

      fetchSpy.mockRestore();
    });
  });

  describe('QR Activity History Timeline (Phase 5)', () => {
    it('aggregates session-scoped rounds, service requests, point redemptions, and payments in descending order', async () => {
      mockPrisma.qrOrderRound.findMany.mockResolvedValue([
        {
          id: 'r-1',
          roundNumber: 1,
          status: 'APPROVED',
          submittedAt: new Date('2026-11-12T07:00:00.000Z'),
          createdAt: new Date('2026-11-12T07:00:00.000Z'),
          guest: { id: 'g-1', guestName: 'Minh' },
          orderItems: [{ id: 'oi-1', quantity: 2, status: 'SENT', product: { name: 'Bò Lúc Lắc' } }],
        },
      ]);
      mockPrisma.tableServiceRequest.findMany.mockResolvedValue([
        {
          id: 'sr-1',
          requestType: 'PAYMENT',
          paymentMethodCode: 'TRANSFER',
          status: 'OPEN',
          note: null,
          createdAt: new Date('2026-11-12T07:20:00.000Z'),
          acknowledgedAt: null,
          completedAt: null,
        },
      ]);
      mockPrisma.pointTransaction.findMany.mockResolvedValue([
        {
          id: 'pt-1',
          amount: -200,
          balanceAfter: 1000,
          description: 'Đổi 1x Trà đào',
          createdAt: new Date('2026-11-12T07:10:00.000Z'),
        },
      ]);

      const history = await service.getActivityHistory(rawToken);
      expect(history.success).toBe(true);
      expect(history.summary.totalEvents).toBe(3);
      expect(history.summary.pendingRequests).toBe(1);
      expect(history.activities.map((a) => a.type)).toEqual([
        'PAYMENT_REQUEST',
        'REWARD_REDEEM',
        'ROUND',
      ]);
    });
  });

  describe('Buffet Per-Submission Limit (Phase 0)', () => {
    const setupSubmitRoundMocks = (maxItemsPerSubmission: number | null) => {
      const buffetSession = {
        id: 'bs-1',
        buffetPackageId: 'bp-1',
        packageNameSnapshot: 'Buffet 599',
        status: 'ACTIVE',
        buffetPackage: {
          id: 'bp-1',
          name: 'Buffet 599',
          maxItemsPerSubmission,
          items: [
            { productId: 'prod-a', availableForQr: true },
            { productId: 'prod-b', availableForQr: true },
          ],
        },
      };

      mockPrisma.qrOrderSession.findUnique.mockResolvedValue({
        ...baseSession,
        order: {
          ...baseSession.order,
          buffetSessions: [buffetSession],
        },
      });
      mockPrisma.qrOrderRound = {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `round-${Math.random()}`, ...data }),
        ),
      };
      mockPrisma.qrOrderGuest.findFirst.mockResolvedValue({
        id: 'guest-1',
        guestName: 'Khách M07',
      });
      mockPrisma.branch = {
        findUnique: jest.fn().mockResolvedValue({ qrAutoSendToKitchen: false }),
      };
      mockPrisma.product = {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prod-a',
            name: 'Cuốn Cá Hồi Chiên',
            price: 69000,
            discountedPrice: null,
            taxPercentage: 0,
            available: true,
            salesChannels: ['POS', 'QR_ORDER'],
            category: { slug: 'cuon' },
            optionGroups: [],
            FlashSaleItem: [],
          },
          {
            id: 'prod-b',
            name: 'Sushi Cá Hồi',
            price: 45000,
            discountedPrice: null,
            taxPercentage: 0,
            available: true,
            salesChannels: ['POS', 'QR_ORDER'],
            category: { slug: 'sushi' },
            optionGroups: [],
            FlashSaleItem: [],
          },
        ]),
        findUnique: jest.fn().mockResolvedValue(null),
      };
      mockPricingService.calculatePricing = jest.fn().mockResolvedValue({
        subTotal: 0,
        taxAmount: 0,
        totalAmount: 0,
      });

      mockPrisma.$transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = {
          buffetPackage: {
            findUnique: jest.fn().mockResolvedValue({ maxItemsPerSubmission }),
          },
          qrOrderRound: mockPrisma.qrOrderRound,
          orderItem: {
            create: jest.fn().mockResolvedValue({ id: 'oi-1' }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          order: {
            update: jest.fn().mockResolvedValue({
              id: 'ord-1',
              orderCode: 'TMP-001',
              totalAmount: 0,
              branchId: 'branch-1',
              table: baseSession.table,
              orderItems: [],
            }),
          },
        };
        return cb(tx);
      });
    };

    it('rejects a single submission exceeding maxItemsPerSubmission (12 > 10) with exact payload & message', async () => {
      setupSubmitRoundMocks(10);

      await expect(
        service.submitRound(rawToken, {
          deviceSessionId: 'dev-1',
          idempotencyKey: 'idem-exceed-1',
          items: [
            { productId: 'prod-a', quantity: 9, selectedOptionIds: [] },
            { productId: 'prod-b', quantity: 3, selectedOptionIds: [] },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.submitRound(rawToken, {
          deviceSessionId: 'dev-1',
          idempotencyKey: 'idem-exceed-2',
          items: [
            { productId: 'prod-a', quantity: 6, selectedOptionIds: [] },
            { productId: 'prod-b', quantity: 6, selectedOptionIds: [] },
          ],
        });
      } catch (err: any) {
        const resp = err.getResponse();
        expect(resp.code).toBe('BUFFET_SUBMISSION_LIMIT_EXCEEDED');
        expect(resp.maxItemsPerSubmission).toBe(10);
        expect(resp.requestedQuantity).toBe(12);
        expect(resp.message).toBe(
          'Bạn đang chọn 12 món, vượt quá giới hạn 10 món cho mỗi lần gọi. Vui lòng điều chỉnh số lượng trước khi gửi.',
        );
      }
    });

    it('allows independent multi-round submissions (10 -> 8 -> 10) without cumulative lock', async () => {
      setupSubmitRoundMocks(10);

      const r1 = await service.submitRound(rawToken, {
        deviceSessionId: 'dev-1',
        idempotencyKey: 'idem-r1',
        items: [{ productId: 'prod-a', quantity: 10, selectedOptionIds: [] }],
      });
      const r2 = await service.submitRound(rawToken, {
        deviceSessionId: 'dev-1',
        idempotencyKey: 'idem-r2',
        items: [{ productId: 'prod-b', quantity: 8, selectedOptionIds: [] }],
      });
      const r3 = await service.submitRound(rawToken, {
        deviceSessionId: 'dev-1',
        idempotencyKey: 'idem-r3',
        items: [
          { productId: 'prod-a', quantity: 6, selectedOptionIds: [] },
          { productId: 'prod-b', quantity: 4, selectedOptionIds: [] },
        ],
      });

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r3.success).toBe(true);
    });

    it('allows unlimited items when maxItemsPerSubmission is null', async () => {
      setupSubmitRoundMocks(null);

      const res = await service.submitRound(rawToken, {
        deviceSessionId: 'dev-1',
        idempotencyKey: 'idem-unlim',
        items: [{ productId: 'prod-a', quantity: 25, selectedOptionIds: [] }],
      });
      expect(res.success).toBe(true);
    });

    it('rejects a dish exceeding maxQuantityPerRound (3 > 2) for BUFFET_INCLUDED items', async () => {
      setupSubmitRoundMocks(10);
      mockPrisma.product.findMany.mockResolvedValueOnce([
        {
          id: 'prod-a',
          name: 'Sashimi Bụng Cá Hồi',
          price: 189000,
          discountedPrice: null,
          taxPercentage: 0,
          available: true,
          salesChannels: ['POS', 'QR_ORDER'],
          category: { slug: 'sashimi' },
          optionGroups: [],
          FlashSaleItem: [],
          buffetPackageItems: [
            {
              availableForQr: true,
              maxQuantityPerRound: 2,
              maxTotalQuantity: 10,
            },
          ],
        },
      ]);

      try {
        await service.submitRound(rawToken, {
          deviceSessionId: 'dev-1',
          idempotencyKey: 'idem-dish-round-limit',
          items: [
            {
              productId: 'prod-a',
              quantity: 3,
              requestedPricingMode: 'BUFFET_INCLUDED',
              selectedOptionIds: [],
            },
          ],
        });
        fail('Expected BadRequestException for BUFFET_ITEM_ROUND_LIMIT_EXCEEDED');
      } catch (err: any) {
        const resp = err.getResponse();
        expect(resp.code).toBe('BUFFET_ITEM_ROUND_LIMIT_EXCEEDED');
        expect(resp.maxQuantityPerRound).toBe(2);
        expect(resp.requestedQuantity).toBe(3);
      }
    });

    it('enforces cumulative maxTotalQuantity across rounds (used 9 + req 2 > 10 fails; req 1 succeeds)', async () => {
      setupSubmitRoundMocks(10);
      const buffetProduct = {
        id: 'prod-a',
        name: 'Sashimi Bụng Cá Hồi',
        price: 189000,
        discountedPrice: null,
        taxPercentage: 0,
        available: true,
        salesChannels: ['POS', 'QR_ORDER'],
        category: { slug: 'sashimi' },
        optionGroups: [],
        FlashSaleItem: [],
        buffetPackageItems: [
          {
            availableForQr: true,
            maxQuantityPerRound: 2,
            maxTotalQuantity: 10,
          },
        ],
      };

      mockPrisma.product.findMany.mockResolvedValue([buffetProduct]);
      mockPrisma.$transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = {
          buffetPackage: {
            findUnique: jest.fn().mockResolvedValue({ maxItemsPerSubmission: 10 }),
          },
          qrOrderRound: mockPrisma.qrOrderRound,
          orderItem: {
            create: jest.fn().mockResolvedValue({ id: 'oi-1' }),
            findMany: jest.fn().mockResolvedValue([{ productId: 'prod-a', quantity: 9 }]),
          },
          order: {
            update: jest.fn().mockResolvedValue({
              id: 'ord-1',
              orderCode: 'TMP-001',
              totalAmount: 0,
              branchId: 'branch-1',
              table: baseSession.table,
              orderItems: [],
            }),
          },
        };
        return cb(tx);
      });

      try {
        await service.submitRound(rawToken, {
          deviceSessionId: 'dev-1',
          idempotencyKey: 'idem-dish-total-fail',
          items: [
            {
              productId: 'prod-a',
              quantity: 2,
              requestedPricingMode: 'BUFFET_INCLUDED',
              selectedOptionIds: [],
            },
          ],
        });
        fail('Expected BadRequestException for BUFFET_ITEM_TOTAL_LIMIT_EXCEEDED');
      } catch (err: any) {
        const resp = err.getResponse();
        expect(resp.code).toBe('BUFFET_ITEM_TOTAL_LIMIT_EXCEEDED');
        expect(resp.maxTotalQuantity).toBe(10);
        expect(resp.usedTotalQuantity).toBe(9);
        expect(resp.remainingTotalQuantity).toBe(1);
      }

      const okRes = await service.submitRound(rawToken, {
        deviceSessionId: 'dev-1',
        idempotencyKey: 'idem-dish-total-ok',
        items: [
          {
            productId: 'prod-a',
            quantity: 1,
            requestedPricingMode: 'BUFFET_INCLUDED',
            selectedOptionIds: [],
          },
        ],
      });
      expect(okRes.success).toBe(true);
    });
  });

  describe('VAT Invoice Lookup & Normalization (QR Utility)', () => {
    it('normalizes Vietnamese address with TP. Hồ Chí Minh and appends Việt Nam', () => {
      const raw = 'B1-11 Tầng B1, TTTM Gigamall, 240-242 Phạm Văn Đồng, Phường Hiệp Bình, TP. Hồ Chí Minh';
      const normalized = service.normalizeVietnameseAddress(raw);
      expect(normalized).toBe(
        'B1-11 Tầng B1, TTTM Gigamall, 240-242 Phạm Văn Đồng, Phường Hiệp Bình, Thành phố Hồ Chí Minh, Việt Nam',
      );
    });

    it('handles null or empty address safely', () => {
      expect(service.normalizeVietnameseAddress('')).toBe('');
      expect(service.normalizeVietnameseAddress('   ')).toBe('');
    });

    it('saves VAT invoice request to order with normalized address', async () => {
      mockPrisma.order.update = jest.fn().mockResolvedValue({
        id: 'ord-1',
        isInvoiceRequested: true,
        invoiceTaxCode: '0312345678',
        invoiceCompanyName: 'CÔNG TY TNHH ABC',
        invoiceAddress: '123 Lê Lợi, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh, Việt Nam',
        invoiceEmail: 'ketoan@abc.com',
      });

      const res = await service.requestVatInvoice(rawToken, {
        taxCode: '0312345678',
        companyName: 'CÔNG TY TNHH ABC',
        address: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        email: 'ketoan@abc.com',
        deviceSessionId: 'dev-1',
      });

      expect(res.success).toBe(true);
      expect(res.data.invoiceTaxCode).toBe('0312345678');
      expect(res.data.invoiceAddress).toContain('Thành phố Hồ Chí Minh, Việt Nam');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseSession.order.id },
          data: expect.objectContaining({
            isInvoiceRequested: true,
            invoiceTaxCode: '0312345678',
            invoiceCompanyName: 'CÔNG TY TNHH ABC',
            invoiceAddress: expect.stringContaining('Thành phố Hồ Chí Minh, Việt Nam'),
            invoiceEmail: 'ketoan@abc.com',
          }),
        }),
      );
    });
  });
});
