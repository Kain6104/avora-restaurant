import { BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';

describe('OrderService - Dual Voucher System & Concurrency Testing', () => {
  let service: OrderService;
  let mockPrisma: any;
  let mockNotificationService: any;
  let mockPromotionService: any;
  let mockMembershipService: any;

  const mockUser = {
    id: 'user-1',
    fullName: 'Nguyen Van A',
    email: 'a@example.com',
    phone: '0901234567',
    points: 50,
    membershipTierId: 'tier-gold',
  };

  const mockProduct = {
    id: 'prod-1',
    name: 'Cơm Chiên Hải Sản',
    price: 100000,
  };

  const mockSettings = [
    { key: 'delivery_fee', value: '20000' },
    { key: 'delivery_min_free', value: '500000' },
  ];

  beforeEach(() => {
    mockPrisma = {
      systemSetting: {
        findMany: jest.fn().mockResolvedValue(mockSettings),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue(mockUser),
      },
      address: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'addr-1',
          recipientName: 'Nguyen Van A',
          phone: '0901234567',
          streetDetail: '123 Đường ABC',
          ward: 'Phường 1',
          district: 'Quận 1',
          province: 'TP. Hồ Chí Minh',
        }),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([mockProduct]),
      },
      optionItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      voucher: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      flashSaleItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
      pointTransaction: {
        create: jest.fn(),
      },
      operatingSlot: {
        findUnique: jest.fn().mockResolvedValue({ id: 'slot-1', isActive: true }),
      },
      slotLock: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', branchCode: 'AVO1', onlineOrderingEnabled: true }),
        findUnique: jest.fn().mockResolvedValue({ id: 'branch-1', branchCode: 'AVO1', onlineOrderingEnabled: true }),
      },
      paymentMethod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pm-1',
          name: 'COD',
          methodCode: 'COD',
          isActive: true,
          minOrderValue: 0,
          isAllBranches: true,
          branches: [],
        }),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockNotificationService = {
      createNotification: jest.fn().mockResolvedValue(true),
    };
    mockPromotionService = {};
    mockMembershipService = {
      recalculateUserTier: jest.fn().mockResolvedValue(true),
    };
    const mockOperatingSlotService: any = {
      incrementDailyOrder: jest.fn().mockResolvedValue(true),
      decrementDailyOrder: jest.fn().mockResolvedValue(true),
    };
    const mockShippingFeeService: any = {
      getShippingQuote: jest.fn().mockImplementation(async () => ({
        distanceKm: 2,
        durationMinutes: 15,
        deliveryAvailable: true,
        originalShippingFee: 20000,
        finalShippingFee: 20000,
        provider: 'DIRECT',
      })),
      calculateRoute: jest.fn().mockImplementation(async () => ({
        distanceMeters: 2000,
        distanceKm: 2,
        durationSeconds: 900,
        durationMinutes: 15,
        provider: 'DIRECT',
        calculatedAt: new Date(),
      })),
      getShippingPolicy: jest.fn().mockResolvedValue({
        deliveryEnabled: true,
        maxDistanceKm: 25,
        baseDistanceKm: 2,
        baseFee: 15000,
        pricePerKm: 5000,
      }),
      calculateFeeFromDistance: jest.fn().mockReturnValue(20000),
    };
    const mockOrderPricingService: any = {
      getGlobalVatPriceMode: jest.fn().mockResolvedValue('VAT_INCLUDED'),
      calculatePricingWithMode: jest.fn().mockImplementation((params) => {
        const subTotal = params.items.reduce((s: number, it: any) => s + it.priceAtSale * it.quantity, 0);
        const discountAmount = params.orderDiscountAmount || 0;
        const shippingFee = params.shippingFee || 0;
        const shippingDiscount = params.shippingDiscount || 0;
        const payableShipping = Math.max(0, shippingFee - shippingDiscount);
        const pointsDiscount = params.pointsDiscount || 0;
        const totalAmount = Math.max(0, subTotal - discountAmount) + payableShipping - pointsDiscount;
        return {
          subTotal,
          discountAmount,
          serviceChargeTotal: 0,
          taxAmount: 0,
          vatPriceMode: 'VAT_INCLUDED',
          taxBreakdown: [],
          itemTaxDetails: params.items.map((it: any) => ({
            taxPercentage: it.taxPercentage || 0,
            netTaxableAmount: it.priceAtSale * it.quantity,
            taxAmount: 0,
          })),
          shippingFee,
          shippingFeeOriginal: shippingFee,
          shippingDiscount,
          payableShipping,
          shippingFeeFinal: payableShipping,
          shippingDiscountSource: shippingDiscount > 0 ? 'VOUCHER' : 'NONE',
          freeShippingQualified: false,
          freeShippingThreshold: 500000,
          freeShippingEligibleAmount: subTotal,
          freeShippingRemainingAmount: 500000 - subTotal,
          pointsDiscount,
          totalAmount,
        };
      }),
    };

    service = new OrderService(
      mockPrisma,
      mockNotificationService,
      mockPromotionService,
      mockMembershipService,
      mockOperatingSlotService,
      mockShippingFeeService,
      mockOrderPricingService,
    );
  });

  // 1. Chỉ dùng 1 voucher giảm giá
  it('1. test_only_discount_voucher: should calculate order discount only', async () => {
    const discountVoucher = {
      id: 'v-1',
      code: 'GIAM20K',
      title: 'Giảm 20K',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderValue: 50000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: 100,
      usedCount: 0,
      usageLimitPerUser: 5,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(discountVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      voucherCode: 'GIAM20K',
    });

    expect(preview.subTotal).toBe(100000);
    expect(preview.discountAmount).toBe(20000);
    expect(preview.shippingDiscount).toBe(0);
    expect(preview.shippingFee).toBe(20000);
    expect(preview.totalAmount).toBe(100000); // 100k - 20k + 20k ship = 100k
    expect(preview.voucher.applied).toBe(true);
  });

  // 2. Chỉ dùng 1 voucher freeship
  it('2. test_only_freeship_voucher: should calculate shipping discount only', async () => {
    const freeshipVoucher = {
      id: 'v-ship',
      code: 'FREESHIP15K',
      title: 'Freeship 15K',
      discountType: 'FREE_SHIP',
      discountValue: 15000,
      minOrderValue: 50000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: 100,
      usedCount: 0,
      usageLimitPerUser: 5,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(freeshipVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      shippingVoucherCode: 'FREESHIP15K',
    });

    expect(preview.subTotal).toBe(100000);
    expect(preview.discountAmount).toBe(0);
    expect(preview.shippingDiscount).toBe(15000);
    expect(preview.payableShipping).toBe(5000); // 20k - 15k = 5k
    expect(preview.totalAmount).toBe(105000); // 100k + 5k = 105k
    expect(preview.shippingVoucher.applied).toBe(true);
  });

  // 3. Dùng đồng thời 1 Freeship + 1 Giảm giá món
  it('3. test_dual_vouchers_success: should apply both vouchers simultaneously', async () => {
    const discountVoucher = {
      id: 'v-discount',
      code: 'GIAM10P',
      title: 'Giảm 10%',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxDiscount: 50000,
      minOrderValue: 50000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: null,
      usedCount: 0,
      usageLimitPerUser: 5,
      membershipTiers: [],
      branches: [],
    };

    const freeshipVoucher = {
      id: 'v-freeship',
      code: 'FREESHIPMAX',
      title: 'Freeship 20K',
      discountType: 'FREE_SHIP',
      discountValue: 20000,
      minOrderValue: 50000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: null,
      usedCount: 0,
      usageLimitPerUser: 5,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockImplementation(({ where: { code } }: any) => {
      if (code === 'GIAM10P') return Promise.resolve(discountVoucher);
      if (code === 'FREESHIPMAX') return Promise.resolve(freeshipVoucher);
      return Promise.resolve(null);
    });

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 2 }], // subtotal = 200k
      voucherCode: 'GIAM10P',
      shippingVoucherCode: 'FREESHIPMAX',
    });

    expect(preview.subTotal).toBe(200000);
    expect(preview.discountAmount).toBe(20000); // 10% of 200k = 20k
    expect(preview.shippingDiscount).toBe(20000); // 20k capped at shippingFee 20k
    expect(preview.payableShipping).toBe(0);
    expect(preview.totalAmount).toBe(180000); // 200k - 20k + 0k = 180k
    expect(preview.voucher.applied).toBe(true);
    expect(preview.shippingVoucher.applied).toBe(true);
  });

  // 4. Từ chối nếu đưa 2 voucher freeship
  it('4. test_reject_two_freeship: should reject if voucherCode is of type FREE_SHIP', async () => {
    const freeshipVoucher = {
      id: 'v-ship',
      code: 'FREESHIP1',
      discountType: 'FREE_SHIP',
      discountValue: 20000,
      minOrderValue: 50000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: 10,
      usedCount: 0,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(freeshipVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      voucherCode: 'FREESHIP1', // Cố tình truyền mã freeship vào slot voucherCode
    });

    expect(preview.voucher.applied).toBe(false);
    expect(preview.discountAmount).toBe(0);
  });

  // 5. Từ chối nếu đưa 2 voucher giảm giá món
  it('5. test_reject_two_discount: should reject if shippingVoucherCode is not FREE_SHIP', async () => {
    const discountVoucher = {
      id: 'v-disc',
      code: 'GIAM20K',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderValue: 50000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: 10,
      usedCount: 0,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(discountVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      shippingVoucherCode: 'GIAM20K', // Cố tình truyền mã giảm giá vào slot freeship
    });

    expect(preview.shippingVoucher.applied).toBe(false);
    expect(preview.shippingDiscount).toBe(0);
  });

  // 6. Từ chối nếu truyền 2 code giống nhau
  it('6. test_reject_duplicate_code: should throw BadRequestException if both codes are identical', async () => {
    await expect(
      service.previewOrder('user-1', {
        cartItems: [{ productId: 'prod-1', quantity: 1 }],
        voucherCode: 'SAMECODE',
        shippingVoucherCode: 'SAMECODE',
      })
    ).rejects.toThrow(BadRequestException);
  });

  // 7. Voucher hết hạn
  it('7. test_expired_voucher: should reject expired voucher', async () => {
    const expiredVoucher = {
      id: 'v-exp',
      code: 'EXPIRED',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderValue: 10000,
      isActive: true,
      startDate: new Date(Date.now() - 200000),
      endDate: new Date(Date.now() - 100000), // đã hết hạn
      usageLimit: null,
      usedCount: 0,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(expiredVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      voucherCode: 'EXPIRED',
    });

    expect(preview.voucher.applied).toBe(false);
    expect(preview.voucher.reason).toContain('hết hạn');
  });

  // 8. Voucher chưa bắt đầu
  it('8. test_not_started_voucher: should reject not-started voucher', async () => {
    const futureVoucher = {
      id: 'v-fut',
      code: 'FUTURE',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderValue: 10000,
      isActive: true,
      startDate: new Date(Date.now() + 100000), // chưa bắt đầu
      endDate: new Date(Date.now() + 200000),
      usageLimit: null,
      usedCount: 0,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(futureVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      voucherCode: 'FUTURE',
    });

    expect(preview.voucher.applied).toBe(false);
    expect(preview.voucher.reason).toContain('chưa bắt đầu');
  });

  // 9. Voucher đang tắt (isActive = false)
  it('9. test_inactive_voucher: should reject inactive voucher', async () => {
    const inactiveVoucher = {
      id: 'v-inact',
      code: 'INACTIVE',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderValue: 10000,
      isActive: false, // tắt
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: null,
      usedCount: 0,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(inactiveVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      voucherCode: 'INACTIVE',
    });

    expect(preview.voucher.applied).toBe(false);
    expect(preview.voucher.reason).toContain('tạm ngưng');
  });

  // 10. Không đủ minOrderValue
  it('10. test_min_order_value: should reject voucher if subtotal < minOrderValue', async () => {
    const highMinVoucher = {
      id: 'v-high',
      code: 'MIN500K',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50000,
      minOrderValue: 500000, // yêu cầu đơn 500k
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: null,
      usedCount: 0,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(highMinVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }], // subtotal = 100k
      voucherCode: 'MIN500K',
    });

    expect(preview.voucher.applied).toBe(false);
    expect(preview.voucher.reason).toContain('tối thiểu');
  });

  // 11. Hết usageLimit toàn hệ thống
  it('11. test_usage_limit_exhausted: should reject when usedCount >= usageLimit', async () => {
    const exhaustedVoucher = {
      id: 'v-exh',
      code: 'EXHAUSTED',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderValue: 10000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: 10,
      usedCount: 10, // đã hết
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(exhaustedVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      voucherCode: 'EXHAUSTED',
    });

    expect(preview.voucher.applied).toBe(false);
    expect(preview.voucher.reason).toContain('hết lượt sử dụng');
  });

  // 12. User đã dùng hết lượt cho phép
  it('12. test_user_usage_limit_exhausted: should reject if user has reached usageLimitPerUser', async () => {
    const userLimitVoucher = {
      id: 'v-userlim',
      code: 'ONETIME',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderValue: 10000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: 100,
      usedCount: 5,
      usageLimitPerUser: 1,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(userLimitVoucher);
    mockPrisma.order.count.mockResolvedValue(1); // user đã dùng 1 lần

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      voucherCode: 'ONETIME',
    });

    expect(preview.voucher.applied).toBe(false);
    expect(preview.voucher.reason).toContain('hết số lần cho phép');
  });

  // 13. Sai hạng thành viên
  it('13. test_membership_tier_mismatch: should reject if user tier is not included in voucher membershipTiers', async () => {
    const tierVoucher = {
      id: 'v-tier',
      code: 'DIAMONDONLY',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50000,
      minOrderValue: 10000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: 100,
      usedCount: 0,
      membershipTiers: [{ id: 'tier-diamond' }], // yêu cầu hạng Diamond nhưng user là tier-gold
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(tierVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      voucherCode: 'DIAMONDONLY',
    });

    expect(preview.voucher.applied).toBe(false);
    expect(preview.voucher.reason).toContain('hạng thành viên');
  });

  // 14. Sai chi nhánh
  it('14. test_branch_mismatch: should reject if branch is not in voucher branches', async () => {
    const branchVoucher = {
      id: 'v-branch',
      code: 'BRANCH_HN',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderValue: 10000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: 100,
      usedCount: 0,
      membershipTiers: [],
      branches: [{ id: 'branch-hanoi' }], // chỉ áp dụng chi nhánh Hà Nội
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(branchVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      branchId: 'branch-saigon',
      voucherCode: 'BRANCH_HN',
    });

    expect(preview.voucher.applied).toBe(false);
    expect(preview.voucher.reason).toContain('chi nhánh');
  });

  // 15. Capping mức giảm Freeship không vượt quá shippingFee
  it('15. test_freeship_cap: freeship discount should be strictly capped at shippingFee', async () => {
    const bigFreeshipVoucher = {
      id: 'v-bigship',
      code: 'FREESHIP50K',
      discountType: 'FREE_SHIP',
      discountValue: 50000, // giảm 50k nhưng phí ship thực tế là 20k
      minOrderValue: 10000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: null,
      usedCount: 0,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(bigFreeshipVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }], // shippingFee = 20k
      shippingVoucherCode: 'FREESHIP50K',
    });

    expect(preview.shippingDiscount).toBe(20000); // capped at 20k
    expect(preview.payableShipping).toBe(0);
    expect(preview.totalAmount).toBe(100000); // không bị trừ âm sang tiền món
  });

  // 16. Capping FIXED_AMOUNT không vượt quá subtotal
  it('16. test_fixed_amount_cap: discountAmount should be strictly capped at subtotal', async () => {
    const bigDiscountVoucher = {
      id: 'v-bigdisc',
      code: 'GIAM150K',
      discountType: 'FIXED_AMOUNT',
      discountValue: 150000, // giảm 150k nhưng subtotal chỉ 100k
      minOrderValue: 10000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: null,
      usedCount: 0,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(bigDiscountVoucher);

    const preview = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }], // subtotal = 100k, shippingFee = 20k
      voucherCode: 'GIAM150K',
    });

    expect(preview.discountAmount).toBe(100000); // capped at 100k
    expect(preview.totalAmount).toBe(20000); // 100k - 100k + 20k ship = 20k
  });

  // 17. Atomic Conditional Update chống Concurrency Race Condition
  it('17. test_concurrency_race_condition_atomic: should fail if atomic updateMany returns count 0', async () => {
    const voucher = {
      id: 'v-lastslot',
      code: 'LASTSLOT',
      discountType: 'FIXED_AMOUNT',
      discountValue: 20000,
      minOrderValue: 10000,
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: 1,
      usedCount: 0,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(voucher);
    // Giả lập cuộc đua: một transaction khác đã lấy slot trước, khiến updateMany trả về count: 0
    mockPrisma.voucher.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.createOrder('user-1', {
        cartItems: [{ productId: 'prod-1', quantity: 1 }],
        voucherCode: 'LASTSLOT',
        operatingSlotId: 'slot-1',
        deliveryDate: '2026-09-04',
      })
    ).rejects.toThrow(BadRequestException);
  });

  // 18. Hoàn lượt voucher khi đơn hàng bị hủy
  it('18. test_order_cancellation_refund: should decrement usedCount of both vouchers on order cancel', async () => {
    const mockExistingOrder = {
      id: 'order-1',
      orderCode: 'ORD-12345',
      userId: 'user-1',
      status: 'PENDING',
      voucherId: 'v-disc',
      shippingVoucherId: 'v-ship',
      isVoucherRefunded: false,
      pointsUsed: 0,
      orderItems: [],
    };

    mockPrisma.order.findFirst.mockResolvedValue(mockExistingOrder);
    mockPrisma.order.findUnique.mockResolvedValue(mockExistingOrder);
    mockPrisma.order.update.mockResolvedValue({ ...mockExistingOrder, status: 'CANCELLED' });

    await service.cancelOrder('user-1', 'ORD-12345', 'Đổi ý không mua nữa');

    // Kiểm tra đã gọi decrement usedCount cho cả 2 voucher
    expect(mockPrisma.voucher.updateMany).toHaveBeenCalledWith({
      where: { id: 'v-disc', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
    expect(mockPrisma.voucher.updateMany).toHaveBeenCalledWith({
      where: { id: 'v-ship', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
    // Đánh dấu isVoucherRefunded: true
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { isVoucherRefunded: true },
    });
  });

  // 19. Tính chất Idempotency của hoàn lượt voucher (không hoàn 2 lần)
  it('19. test_refund_idempotency: should not refund vouchers if already marked isVoucherRefunded', async () => {
    const alreadyRefundedOrder = {
      id: 'order-refunded',
      orderCode: 'ORD-REFUNDED',
      userId: 'user-1',
      voucherId: 'v-disc',
      shippingVoucherId: 'v-ship',
      isVoucherRefunded: true, // đã hoàn trước đó
    };

    mockPrisma.order.findUnique.mockResolvedValue(alreadyRefundedOrder);

    await service.refundVoucherUsage('order-refunded');

    // Tuyệt đối không gọi updateMany trừ lượt nữa
    expect(mockPrisma.voucher.updateMany).not.toHaveBeenCalled();
  });

  // 20. Auto-Revalidation khi giỏ hàng thay đổi
  it('20. test_cart_change_revalidation: preview should invalidate voucher if quantity decreases below minOrderValue', async () => {
    const min200kVoucher = {
      id: 'v-min200k',
      code: 'MIN200K',
      discountType: 'FIXED_AMOUNT',
      discountValue: 30000,
      minOrderValue: 200000, // yêu cầu đơn 200k
      isActive: true,
      startDate: new Date(Date.now() - 100000),
      endDate: new Date(Date.now() + 100000),
      usageLimit: null,
      usedCount: 0,
      membershipTiers: [],
      branches: [],
    };

    mockPrisma.voucher.findUnique.mockResolvedValue(min200kVoucher);

    // TH1: 2 món x 100k = 200k -> Hợp lệ
    const preview1 = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 2 }],
      voucherCode: 'MIN200K',
    });
    expect(preview1.voucher.applied).toBe(true);
    expect(preview1.discountAmount).toBe(30000);

    // TH2: Giảm xuống 1 món x 100k = 100k -> Mất điều kiện
    const preview2 = await service.previewOrder('user-1', {
      cartItems: [{ productId: 'prod-1', quantity: 1 }],
      voucherCode: 'MIN200K',
    });
    expect(preview2.voucher.applied).toBe(false);
    expect(preview2.discountAmount).toBe(0);
  });

  // 21. Hoàn lượt voucher khi thanh toán thất bại
  it('21. test_payment_failure_refund: should refund both vouchers on payment failure or timeout', async () => {
    const failedOrder = {
      id: 'order-fail',
      orderCode: 'ORD-FAIL',
      userId: 'user-1',
      voucherId: 'v-disc',
      shippingVoucherId: 'v-ship',
      isVoucherRefunded: false,
    };

    mockPrisma.order.findUnique.mockResolvedValue(failedOrder);

    await service.refundVoucherUsage('order-fail');

    expect(mockPrisma.voucher.updateMany).toHaveBeenCalledWith({
      where: { id: 'v-disc', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
    expect(mockPrisma.voucher.updateMany).toHaveBeenCalledWith({
      where: { id: 'v-ship', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });
});
