import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlashSalePricingService } from '../flash-sale/flash-sale-pricing.service';

@Injectable()
export class PromotionService {
  constructor(
    private prisma: PrismaService,
    private flashSalePricing: FlashSalePricingService,
  ) {}

  async getCurrentFlashSale(channel?: 'ONLINE' | 'POS', branchId?: string, userId?: string) {
    const overview = await this.flashSalePricing.getPublicFlashSaleOverview(channel, branchId, userId);
    if (!overview || !overview.hasFlashSale) return null;

    // Tương thích ngược: cấp thêm items và countdown ở root cho frontend hiện tại
    const activeItems = overview.activeSlot?.items || [];
    return {
      ...overview,
      id: overview.campaign?.id,
      name: overview.campaign?.name,
      items: activeItems,
      countdown: overview.activeSlot?.countdown || 0,
    };
  }

  async enrichProductsWithFlashSale(products: any[], branchId?: string, userId?: string, channel?: 'ONLINE' | 'POS') {
    return this.flashSalePricing.enrichProductsWithFlashSale(products, branchId, userId, channel);
  }

  async getFlashSaleQuota(userId: string) {
    const activeFlashSale: any = await this.getCurrentFlashSale();
    if (!activeFlashSale || !activeFlashSale.items) return {};

    const quotaMap: Record<string, number> = {};

    for (const item of activeFlashSale.items) {
      const overallAvailable = Math.max(0, item.stock - item.sold);
      let userAvailable = overallAvailable;

      if (item.maxQuantityPerUser) {
        const pastOrders = await this.prisma.orderItem.aggregate({
          where: {
            productId: item.productId,
            flashSaleId: activeFlashSale.id,
            order: { userId, status: { not: 'CANCELLED' } }
          },
          _sum: { quantity: true }
        });
        const bought = pastOrders._sum.quantity || 0;
        const remainingQuota = Math.max(0, item.maxQuantityPerUser - bought);
        userAvailable = Math.min(overallAvailable, remainingQuota);
      }

      quotaMap[item.productId] = userAvailable;
    }

    return quotaMap;
  }

  async subscribeFlashSaleReminder(userId: string, flashSaleId: string, slotId?: string, productId?: string) {
    if (!userId) {
      throw new BadRequestException('Vui lòng đăng nhập để đăng ký nhận thông báo.');
    }

    return this.prisma.flashSaleReminder.upsert({
      where: {
        userId_flashSaleId_slotId_productId: {
          userId,
          flashSaleId,
          slotId: slotId || null as any,
          productId: productId || null as any,
        },
      },
      create: {
        userId,
        flashSaleId,
        slotId: slotId || null,
        productId: productId || null,
      },
      update: {},
    });
  }

  async getVouchers(userId?: string) {
    const now = new Date();
    let userTierId: string | null = null;
    let userOrderCount = 0;
    const savedVoucherIds = new Set<string>();

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: { select: { orders: true } },
          savedVouchers: { select: { voucherId: true } }
        }
      });
      if (user) {
        userTierId = user.membershipTierId;
        userOrderCount = user._count.orders;
        user.savedVouchers.forEach((sv) => savedVoucherIds.add(sv.voucherId));
      }
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        isActive: true,
        isPublic: true,
        startDate: { lte: now },
        endDate: { gte: now },
        // Chỉ lấy những voucher không yêu cầu hạng thẻ HOẶC yêu cầu đúng hạng thẻ của user này
        OR: [
          { membershipTiers: { none: {} } },
          ...(userTierId ? [{ membershipTiers: { some: { id: userTierId } } }] : [])
        ]
      },
      include: {
        branches: true,
        membershipTiers: true,
        voucherPaymentMethods: {
          include: { paymentMethod: true }
        }
      },
      orderBy: [
        { usedCount: 'asc' },
        { endDate: 'asc' }
      ]
    });

    const vouchersWithDetails = await Promise.all(vouchers.map(async (voucher) => {
      let usedCountByUser = 0;
      if (userId) {
        usedCountByUser = await this.prisma.order.count({
          where: {
            userId,
            OR: [{ voucherId: voucher.id }, { shippingVoucherId: voucher.id }],
            status: { not: 'CANCELLED' }
          }
        });
      }

      const isSystemExhausted = voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit;
      const isUserExhausted = voucher.usageLimitPerUser !== null && usedCountByUser >= voucher.usageLimitPerUser;
      const isFirstOrderViolated = voucher.isFirstOrderOnly && userOrderCount > 0;
      const isNewCustomerViolated = voucher.targetCustomerScope === 'NEW_CUSTOMER' && userOrderCount > 0;
      let isSpecificCustomerViolated = false;
      if (voucher.targetCustomerScope === 'SPECIFIC_CUSTOMERS' && voucher.targetCustomerIds) {
        const allowedIds = voucher.targetCustomerIds.split(',').map((id: string) => id.trim()).filter(Boolean);
        if (!userId || !allowedIds.includes(userId)) {
          isSpecificCustomerViolated = true;
        }
      }
      const isSavedInWallet = savedVoucherIds.has(voucher.id);

      let ineligibleReason: string | null = null;
      if (isUserExhausted) {
        ineligibleReason = 'Bạn đã sử dụng hết số lần cho phép của mã này';
      } else if (isSystemExhausted) {
        ineligibleReason = 'Mã khuyến mãi đã hết lượt sử dụng toàn hệ thống';
      } else if (isFirstOrderViolated || isNewCustomerViolated) {
        ineligibleReason = 'Mã chỉ áp dụng cho khách hàng mới / đơn đầu tiên';
      } else if (isSpecificCustomerViolated) {
        ineligibleReason = 'Mã chỉ áp dụng cho khách hàng được chỉ định';
      }

      const canApply = !isSystemExhausted && !isUserExhausted && !isFirstOrderViolated && !isNewCustomerViolated && !isSpecificCustomerViolated;
      const remainingUserQuota = voucher.usageLimitPerUser !== null ? Math.max(0, voucher.usageLimitPerUser - usedCountByUser) : null;
      const remainingSystemQuota = voucher.usageLimit !== null ? Math.max(0, voucher.usageLimit - voucher.usedCount) : null;

      return {
        ...voucher,
        usedCountByUser,
        userOrderCount,
        isSystemExhausted,
        isUserExhausted,
        isSavedInWallet,
        canApply,
        ineligibleReason,
        remainingUserQuota,
        remainingSystemQuota,
      };
    }));

    return vouchersWithDetails;
  }

  async applyVoucher(
    code: string,
    orderValue: number,
    userId?: string,
    shippingFee: number = 0,
    branchId?: string,
    paymentMethodId?: string,
  ) {
    const now = new Date();
    const cleanCode = (code || '').trim().toUpperCase();
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: cleanCode },
      include: {
        membershipTiers: true,
        branches: true,
        voucherPaymentMethods: {
          include: { paymentMethod: true },
        },
      },
    });

    if (!voucher) {
      throw new NotFoundException('Mã khuyến mãi không tồn tại');
    }

    if (!voucher.isActive || voucher.startDate > now || voucher.endDate < now) {
      throw new BadRequestException('Mã khuyến mãi đã hết hạn hoặc chưa khả dụng');
    }

    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
      throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
    }

    if (userId && voucher.usageLimitPerUser !== null) {
      const usedByThisUser = await this.prisma.order.count({
        where: {
          userId,
          OR: [{ voucherId: voucher.id }, { shippingVoucherId: voucher.id }],
          status: { not: 'CANCELLED' }
        }
      });
      if (usedByThisUser >= voucher.usageLimitPerUser) {
        throw new BadRequestException('Bạn đã hết lượt sử dụng mã khuyến mãi này');
      }
    }

    if (voucher.isFirstOrderOnly && userId) {
      const orderCount = await this.prisma.order.count({
        where: { userId, status: { not: 'CANCELLED' } }
      });
      if (orderCount > 0) {
        throw new BadRequestException('Mã khuyến mãi này chỉ áp dụng cho đơn hàng đầu tiên của bạn');
      }
    }

    if (voucher.targetCustomerScope === 'NEW_CUSTOMER' && userId) {
      const orderCount = await this.prisma.order.count({
        where: { userId, status: 'COMPLETED' }
      });
      if (orderCount > 0) {
        throw new BadRequestException('Mã khuyến mãi này chỉ áp dụng cho khách hàng mới');
      }
    }

    if (voucher.targetCustomerScope === 'SPECIFIC_CUSTOMERS' && voucher.targetCustomerIds) {
      const allowedIds = voucher.targetCustomerIds.split(',').map((id: string) => id.trim()).filter(Boolean);
      if (!userId || !allowedIds.includes(userId)) {
        throw new BadRequestException('Mã khuyến mãi này chỉ áp dụng cho khách hàng được chỉ định');
      }
    }

    if (orderValue < voucher.minOrderValue) {
      throw new BadRequestException(`Đơn hàng tối thiểu ${Math.round(voucher.minOrderValue).toLocaleString('vi-VN')}đ để áp dụng mã này`);
    }

    // Check membership tier if required
    if (voucher.membershipTiers && voucher.membershipTiers.length > 0 && userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!voucher.membershipTiers.some((t: any) => t.id === user?.membershipTierId)) {
        throw new BadRequestException('Bạn không đủ điều kiện hạng thẻ để sử dụng mã này');
      }
    } else if (voucher.membershipTiers && voucher.membershipTiers.length > 0 && !userId) {
      throw new BadRequestException('Vui lòng đăng nhập để sử dụng mã khuyến mãi này');
    }

    // Check branch if required
    if (voucher.branches && voucher.branches.length > 0 && branchId) {
      if (!voucher.branches.some((b: any) => b.id === branchId)) {
        throw new BadRequestException('Mã khuyến mãi không áp dụng cho chi nhánh này');
      }
    }

    // Check payment method restriction
    if (!voucher.appliesToAllPaymentMethods && voucher.voucherPaymentMethods && voucher.voucherPaymentMethods.length > 0) {
      if (paymentMethodId) {
        const isAllowed = voucher.voucherPaymentMethods.some((vpm: any) => vpm.paymentMethodId === paymentMethodId);
        if (!isAllowed) {
          const allowedNames = voucher.voucherPaymentMethods
            .map((vpm: any) => vpm.paymentMethod?.name)
            .filter(Boolean)
            .join(', ');
          throw new BadRequestException(`Mã giảm giá này chỉ áp dụng cho phương thức thanh toán: ${allowedNames || 'được chỉ định'}`);
        }
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (voucher.discountType === 'PERCENTAGE') {
      let rawDiscount = Math.round((orderValue * voucher.discountValue) / 100);
      if (voucher.maxDiscount && rawDiscount > voucher.maxDiscount) {
        rawDiscount = Math.round(voucher.maxDiscount);
      }
      discountAmount = Math.min(rawDiscount, orderValue);
    } else if (voucher.discountType === 'FIXED_AMOUNT') {
      discountAmount = Math.min(Math.round(voucher.discountValue), orderValue);
    } else if (voucher.discountType === 'FREE_SHIP') {
      const maxFreeship = voucher.discountValue > 0 ? Math.round(voucher.discountValue) : shippingFee;
      discountAmount = Math.min(maxFreeship, shippingFee);
    }

    return {
      success: true,
      voucher,
      discountAmount
    };
  }

  async getCombos(branchId?: string, search?: string) {
    const now = new Date();
    const where: any = {
      isActive: true,
      OR: [
        { startDate: null },
        { startDate: { lte: now } }
      ],
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } }
          ]
        }
      ]
    };

    if (search && search.trim()) {
      where.AND.push({
        name: { contains: search.trim(), mode: 'insensitive' }
      });
    }

    if (branchId) {
      where.AND.push({
        OR: [
          { branches: { none: {} } },
          { branches: { some: { id: branchId } } }
        ]
      });
    }

    const combos = await this.prisma.combo.findMany({
      where,
      include: {
        branches: true,
        membershipTiers: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
                optionGroups: {
                  include: {
                    optionItems: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return combos.map(combo => {
      const calculatedOriginalPrice = combo.items.reduce((sum, item) => {
        return sum + (item.product?.price || 0) * (item.quantity || 1);
      }, 0);

      const effectiveOriginalPrice = combo.originalPrice && combo.originalPrice > combo.price
        ? combo.originalPrice
        : calculatedOriginalPrice > combo.price
          ? calculatedOriginalPrice
          : Math.round(combo.price * 1.25);

      const savingsAmount = Math.max(0, effectiveOriginalPrice - combo.price);
      const discountPercent = effectiveOriginalPrice > 0
        ? Math.round((savingsAmount / effectiveOriginalPrice) * 100)
        : 0;

      return {
        ...combo,
        calculatedOriginalPrice,
        effectiveOriginalPrice,
        savingsAmount,
        discountPercent,
        totalItemsCount: combo.items.reduce((cnt, i) => cnt + (i.quantity || 1), 0)
      };
    });
  }

  async getComboById(id: string) {
    const combo = await this.prisma.combo.findUnique({
      where: { id },
      include: {
        branches: true,
        membershipTiers: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
                optionGroups: {
                  include: {
                    optionItems: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!combo) {
      throw new NotFoundException('Combo không tồn tại hoặc đã ngừng phục vụ');
    }

    const calculatedOriginalPrice = combo.items.reduce((sum, item) => {
      return sum + (item.product?.price || 0) * (item.quantity || 1);
    }, 0);

    const effectiveOriginalPrice = combo.originalPrice && combo.originalPrice > combo.price
      ? combo.originalPrice
      : calculatedOriginalPrice > combo.price
        ? calculatedOriginalPrice
        : Math.round(combo.price * 1.25);

    const savingsAmount = Math.max(0, effectiveOriginalPrice - combo.price);
    const discountPercent = effectiveOriginalPrice > 0
      ? Math.round((savingsAmount / effectiveOriginalPrice) * 100)
      : 0;

    return {
      ...combo,
      calculatedOriginalPrice,
      effectiveOriginalPrice,
      savingsAmount,
      discountPercent,
      totalItemsCount: combo.items.reduce((cnt, i) => cnt + (i.quantity || 1), 0)
    };
  }

  // --- VÍ VOUCHER KHÁCH HÀNG (CUSTOMER WALLET) ---

  async getWalletVouchers(userId: string) {
    if (!userId) return [];
    const now = new Date();

    const saved = await this.prisma.customerVoucher.findMany({
      where: {
        userId,
        voucher: {
          isActive: true,
          endDate: { gte: now },
        },
      },
      include: {
        voucher: {
          include: {
            branches: true,
            membershipTiers: true,
            voucherPaymentMethods: {
              include: { paymentMethod: true },
            },
          },
        },
      },
      orderBy: { savedAt: 'desc' },
    });

    const results = await Promise.all(saved.map(async (item) => {
      const v = item.voucher;
      const usedCountByUser = await this.prisma.order.count({
        where: {
          userId,
          OR: [{ voucherId: v.id }, { shippingVoucherId: v.id }],
          status: { not: 'CANCELLED' }
        }
      });

      const isSystemExhausted = v.usageLimit !== null && v.usedCount >= v.usageLimit;
      const isUserExhausted = v.usageLimitPerUser !== null && usedCountByUser >= v.usageLimitPerUser;
      const isExpired = now > v.endDate;
      const isNotStarted = now < v.startDate;
      const canUseNow = v.isActive && !isExpired && !isNotStarted && !isSystemExhausted && !isUserExhausted;

      let statusText = 'Sẵn sàng sử dụng';
      if (!v.isActive) statusText = 'Tạm khóa';
      else if (isUserExhausted) statusText = 'Đã hết số lần dùng của bạn';
      else if (isSystemExhausted) statusText = 'Đã hết lượt toàn hệ thống';
      else if (isExpired) statusText = 'Đã hết hạn';
      else if (isNotStarted) statusText = 'Chưa đến ngày sử dụng';

      return {
        id: item.id,
        savedAt: item.savedAt,
        isUsed: item.isUsed || isUserExhausted,
        voucher: {
          ...v,
          usedCountByUser,
          isSystemExhausted,
          isUserExhausted,
          isExpired,
          isNotStarted,
          canUseNow,
          statusText,
          remainingUserQuota: v.usageLimitPerUser !== null ? Math.max(0, v.usageLimitPerUser - usedCountByUser) : null,
        }
      };
    }));

    return results;
  }

  async claimVoucher(userId: string, identifier: { code?: string; voucherId?: string }) {
    if (!userId) {
      throw new BadRequestException('Vui lòng đăng nhập để lưu voucher vào ví');
    }

    const now = new Date();
    let voucher: any = null;

    if (identifier.code) {
      const cleanCode = identifier.code.trim().toUpperCase();
      voucher = await this.prisma.voucher.findUnique({
        where: { code: cleanCode },
        include: {
          branches: true,
          membershipTiers: true
        }
      });
    } else if (identifier.voucherId) {
      voucher = await this.prisma.voucher.findUnique({
        where: { id: identifier.voucherId },
        include: {
          branches: true,
          membershipTiers: true
        }
      });
    }

    if (!voucher) {
      throw new NotFoundException('Mã voucher không tồn tại trên hệ thống');
    }

    if (!voucher.isActive) {
      throw new BadRequestException('Mã khuyến mãi này hiện đang tạm ngưng');
    }

    if (now > voucher.endDate) {
      throw new BadRequestException('Mã khuyến mãi này đã hết hạn sử dụng');
    }

    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
      throw new BadRequestException('Mã khuyến mãi này đã hết số lượt sử dụng toàn hệ thống');
    }

    // Kiểm tra số lần user này đã dùng
    const usedCountByUser = await this.prisma.order.count({
      where: {
        userId,
        OR: [{ voucherId: voucher.id }, { shippingVoucherId: voucher.id }],
        status: { not: 'CANCELLED' }
      }
    });

    if (voucher.usageLimitPerUser !== null && usedCountByUser >= voucher.usageLimitPerUser) {
      throw new BadRequestException('Bạn đã sử dụng hết số lần cho phép của mã này');
    }

    // Lưu vào CustomerVoucher
    const saved = await this.prisma.customerVoucher.upsert({
      where: {
        userId_voucherId: {
          userId,
          voucherId: voucher.id
        }
      },
      create: {
        userId,
        voucherId: voucher.id
      },
      update: {
        savedAt: new Date()
      },
      include: {
        voucher: true
      }
    });

    return {
      success: true,
      message: `Đã lưu thành công mã ưu đãi [${voucher.code}] vào ví voucher của bạn!`,
      data: saved
    };
  }

  async removeVoucherFromWallet(userId: string, voucherId: string) {
    if (!userId || !voucherId) return { success: false };

    await this.prisma.customerVoucher.deleteMany({
      where: {
        userId,
        voucherId
      }
    });

    return {
      success: true,
      message: 'Đã gỡ mã ưu đãi khỏi ví voucher của bạn'
    };
  }
}
