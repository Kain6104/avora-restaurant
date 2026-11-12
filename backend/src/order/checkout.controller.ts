import { Controller, Post, Body, UseGuards, Request, Logger } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { OrderPricingService } from '../pricing/order-pricing.service';
import { ShippingFeeService } from '../shipping/shipping-fee.service';

@Controller('checkout')
export class CheckoutController {
  private async ensureArchitectProduct() {
    let master = await this.prisma.product.findFirst({
      where: {
        OR: [
          { id: 'prod-ai-meal-architect' },
          { slug: 'ai-meal-architect' },
        ],
      },
    });

    if (!master) {
      const cat = await this.prisma.category.findFirst({ orderBy: { displayOrder: 'asc' } });
      try {
        master = await this.prisma.product.create({
          data: {
            id: 'prod-ai-meal-architect',
            itemCode: 'ARCH-001',
            name: '[AI Architect™] Đĩa Ăn Độc Bản',
            slug: 'ai-meal-architect',
            price: 0,
            description: 'Đĩa ăn dinh dưỡng tùy chỉnh cá nhân hóa được tạo bởi AI Architect Mixer.',
            imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
            available: true,
            categoryId: cat?.id || 'cat-general',
          },
        });
      } catch (e) {
        master = await this.prisma.product.findFirst({
          where: {
            OR: [
              { id: 'prod-ai-meal-architect' },
              { slug: 'ai-meal-architect' },
            ],
          },
        });
      }
    }
    return master;
  }

  private readonly logger = new Logger(CheckoutController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderPricingService: OrderPricingService,
    private readonly shippingFeeService: ShippingFeeService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post('preview')
  async previewCheckout(@Request() req: any, @Body() payload: any) {
    const userId = req.user?.id || req.user?.sub || null;
    const {
      branchId,
      addressId,
      cartItems = [],
      voucherCode,
      discountVoucherCode,
      shippingVoucherCode,
      operatingSlotId,
      deliveryDate,
      paymentMethod,
      pointsUsed,
      pointsToUse,
    } = payload || {};

    const activeVoucherCode = (discountVoucherCode || voucherCode || '').trim().toUpperCase() || undefined;
    const activeShippingVoucherCode = (shippingVoucherCode || '').trim().toUpperCase() || undefined;
    const pointsCount = Math.max(0, Math.floor(Number(pointsUsed || pointsToUse || 0)));
    const now = new Date();
    const warnings: string[] = [];

    // 1. Resolve User (if logged in)
    let user: any = null;
    if (userId) {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { membershipTier: true },
      });
    }

    // 2. Resolve Address
    let address: any = null;
    if (addressId) {
      address = await this.prisma.address.findFirst({
        where: { id: addressId, ...(userId ? { userId } : {}) },
      });
    }
    if (!address && userId) {
      address =
        (await this.prisma.address.findFirst({ where: { userId, isDefault: true } })) ||
        (await this.prisma.address.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } }));
    }

    // 2.5 Resolve Branch
    const branch = branchId
      ? await this.prisma.branch.findUnique({ where: { id: branchId } })
      : (await this.prisma.branch.findFirst({ where: { onlineOrderingEnabled: true } })) || (await this.prisma.branch.findFirst());

    // 3. Early return if cart is empty
    if (!cartItems || cartItems.length === 0) {
      const [vatPriceMode, freeShippingSettings] = await Promise.all([
        this.orderPricingService.getGlobalVatPriceMode(),
        this.orderPricingService.getFreeShippingSettings(),
      ]);
      return {
        success: true,
        data: {
          items: [],
          subTotal: 0,
          itemDiscountTotal: 0,
          discountAmount: 0,
          serviceChargeTotal: 0,
          taxAmount: 0,
          vatPriceMode,
          taxBreakdown: [],
          shippingFeeOriginal: 0,
          shippingDiscount: 0,
          shippingFeeFinal: 0,
          shippingDiscountSource: 'NONE',
          freeShippingQualified: false,
          freeShippingThreshold: freeShippingSettings.threshold,
          freeShippingEligibleAmount: 0,
          freeShippingRemainingAmount: freeShippingSettings.threshold,
          pointsDiscount: 0,
          totalAmount: 0,
          branch: branch
            ? {
                id: branch.id,
                name: branch.name,
                allowDirectDiscount: branch.allowDirectDiscount,
                pointRedeemRate: branch.pointRedeemRate,
                isLoyaltyOnlineEnabled: branch.isLoyaltyOnlineEnabled,
                loyaltyEarnRateOnline: branch.loyaltyEarnRateOnline,
              }
            : null,
          warnings: ['Giỏ hàng của bạn đang trống'],
          pricingVersion: 1,
          calculatedAt: now.toISOString(),
        },
      };
    }

    // 4. Batch fetch Products, OptionItems, Combos
    const productIds = cartItems
      .filter((it: any) => !it.isCombo && it.productId)
      .map((it: any) => it.productId);
    const comboIds = cartItems
      .filter((it: any) => it.isCombo && it.comboId)
      .map((it: any) => it.comboId);
    const allOptionItemIds = cartItems.flatMap((it: any) => it.optionItemIds || []);

    const [products, optionItems, combos] = await Promise.all([
      productIds.length > 0
        ? this.prisma.product.findMany({ where: { id: { in: productIds } } })
        : [],
      allOptionItemIds.length > 0
        ? this.prisma.optionItem.findMany({ where: { id: { in: allOptionItemIds } } })
        : [],
      comboIds.length > 0
        ? this.prisma.combo.findMany({
            where: { id: { in: comboIds } },
            include: { items: { include: { product: true } } },
          })
        : [],
    ]);

    const productMap = new Map<string, any>();
    products.forEach((p: any) => productMap.set(p.id, p));

    const optionItemMap = new Map<string, any>();
    optionItems.forEach((o: any) => optionItemMap.set(o.id, o));

    const comboMap = new Map<string, any>();
    combos.forEach((c: any) => comboMap.set(c.id, c));

    // 5. Build line items with exact pricing & Flash Sale checking
    const resolvedItems: any[] = [];
    let computedSubTotal = 0;

    for (const cartItem of cartItems) {
      if (cartItem.isCombo && cartItem.comboId) {
        const combo = comboMap.get(cartItem.comboId);
        if (!combo || !combo.isActive) {
          warnings.push(`Combo "${combo?.name || 'Combo'}" hiện không khả dụng`);
          continue;
        }

        const comboPrice = Math.round(combo.price);
        const parsedComboQty = Number(cartItem.quantity);
        const qty = Number.isFinite(parsedComboQty) && parsedComboQty > 0
          ? Math.max(0.001, Math.round(parsedComboQty * 1000) / 1000)
          : 1;
        const grossLineTotal = Math.round(comboPrice * qty);
        computedSubTotal += grossLineTotal;

        // VAT cho combo: lấy thuế suất của sản phẩm thành phần đầu tiên hoặc 0%
        const comboTaxRate = combo.items[0]?.product?.taxPercentage || 0;

        resolvedItems.push({
          productId: combo.items[0]?.productId || cartItem.comboId,
          name: `[Combo] ${combo.name}`,
          priceAtSale: comboPrice,
          originalPriceAtSale: Math.round(combo.originalPrice || comboPrice),
          quantity: qty,
          taxPercentage: comboTaxRate,
          isCombo: true,
          comboId: combo.id,
        });
        continue;
      }

      let isCustomArchitect =
        Boolean(cartItem.isCustomRecipe) ||
        (typeof cartItem.name === 'string' && (cartItem.name.includes('AI Architect') || cartItem.name.includes('Đĩa Cơm') || cartItem.name.includes('Đĩa Ăn'))) ||
        cartItem.productId === 'prod-ai-meal-architect' ||
        cartItem.productId === 'ai-meal-architect' ||
        String(cartItem.id || '').startsWith('custom-architect-') ||
        String(cartItem.productId || '').includes('architect');

      let product = productMap.get(cartItem.productId);
      if (!product && !isCustomArchitect) {
        try {
          const ing = await (this.prisma as any).architectIngredient?.findFirst({
            where: { OR: [{ id: cartItem.productId }, { code: cartItem.productId }] },
          });
          if (ing) {
            isCustomArchitect = true;
          }
        } catch {}
      }

      if (!product && !isCustomArchitect) {
        const itemName = String(cartItem.name || '').toLowerCase();
        if (itemName.includes('architect') || itemName.includes('đĩa cơm') || itemName.includes('đĩa ăn') || itemName.includes('tùy chỉnh') || itemName.includes('chuẩn form') || itemName.includes('fit & healthy')) {
          isCustomArchitect = true;
        }
      }

      if (isCustomArchitect) {
        const customPrice = Math.max(0, Math.round(Number(cartItem.priceAtSale ?? cartItem.price ?? 0)));
        if (!product) {
          const archMaster = await this.ensureArchitectProduct();
          product = {
            ...archMaster,
            price: customPrice > 0 ? customPrice : Number(archMaster?.price || 0),
            name: cartItem.name || archMaster?.name || '[AI Architect™] Đĩa Ăn Độc Bản',
          };
          productMap.set(cartItem.productId, product);
        } else {
          product = {
            ...product,
            price: customPrice > 0 ? customPrice : product.price,
            name: cartItem.name || product.name,
          };
          productMap.set(cartItem.productId, product);
        }
      }

      if (!product) {
        warnings.push(`Sản phẩm không tồn tại: ${cartItem.productId}`);
        continue;
      }
      if (!product.available) {
        warnings.push(`Sản phẩm "${product.name}" hiện tạm hết hàng`);
      }

      let optionsAdjustment = 0;
      for (const optId of cartItem.optionItemIds || []) {
        const opt = optionItemMap.get(optId);
        if (opt) {
          optionsAdjustment += opt.priceAdjustment;
        }
      }

      const parsedCartQty = Number(cartItem.quantity);
      const qty = Number.isFinite(parsedCartQty) && parsedCartQty > 0
        ? Math.max(0.001, Math.round(parsedCartQty * 1000) / 1000)
        : 1;
      let flashSaleQty = 0;
      let normalQty = qty;
      let flashSalePrice = product.price;

      if (cartItem.isFlashSaleItem && cartItem.flashSaleId) {
        const fsItem = await this.prisma.flashSaleItem.findFirst({
          where: {
            flashSaleId: cartItem.flashSaleId,
            productId: product.id,
            flashSale: {
              isActive: true,
              startTime: { lte: now },
              endTime: { gte: now },
            },
          },
        });

        if (fsItem) {
          let available = Math.max(0, fsItem.stock - fsItem.sold);
          if (fsItem.maxQuantityPerUser && userId) {
            const pastOrders = await this.prisma.orderItem.aggregate({
              where: {
                productId: product.id,
                flashSaleId: cartItem.flashSaleId,
                order: { userId, status: { not: 'CANCELLED' } },
              },
              _sum: { quantity: true },
            });
            const bought = pastOrders._sum.quantity || 0;
            const quota = Math.max(0, fsItem.maxQuantityPerUser - bought);
            available = Math.min(available, quota);
          }
          flashSaleQty = Math.min(qty, available);
          normalQty = qty - flashSaleQty;
          if (flashSaleQty > 0) {
            flashSalePrice = fsItem.flashSalePrice;
          } else {
            warnings.push(`Ưu đãi Flash Sale cho "${product.name}" đã hết lượt.`);
          }
        } else {
          warnings.push(`Flash Sale của "${product.name}" đã kết thúc hoặc không còn hiệu lực.`);
        }
      }

      if (flashSaleQty > 0) {
        const unitPrice = Math.round(flashSalePrice + optionsAdjustment);
        computedSubTotal += unitPrice * flashSaleQty;
        resolvedItems.push({
          productId: product.id,
          name: product.name,
          priceAtSale: unitPrice,
          originalPriceAtSale: Math.round(product.price + optionsAdjustment),
          quantity: flashSaleQty,
          taxPercentage: product.taxPercentage || 0,
          isFlashSaleItem: true,
          flashSaleId: cartItem.flashSaleId,
        });
      }

      if (normalQty > 0) {
        const unitPrice = Math.round(product.price + optionsAdjustment);
        computedSubTotal += unitPrice * normalQty;
        resolvedItems.push({
          productId: product.id,
          name: product.name,
          priceAtSale: unitPrice,
          originalPriceAtSale: Math.round(product.price + optionsAdjustment),
          quantity: normalQty,
          taxPercentage: product.taxPercentage || 0,
          isFlashSaleItem: false,
        });
      }
    }

    computedSubTotal = Math.round(computedSubTotal);

    // 6. Calculate Shipping Quote from Routing Engine
    let shippingQuote: any = null;
    let rawShippingFee = 0;
    const isTakeaway = payload.orderType === 'TAKEAWAY' || payload.orderType === 'TAKE_AWAY';

    if (isTakeaway) {
      shippingQuote = {
        deliveryAvailable: true,
        distanceKm: 0,
        distanceMeters: 0,
        durationMinutes: 0,
        durationSeconds: 0,
        originalShippingFee: 0,
        shippingDiscount: 0,
        finalShippingFee: 0,
        provider: 'PICKUP_STORE',
        isFallback: false,
      };
      rawShippingFee = 0;
    } else if (branchId || address?.id) {
      try {
        shippingQuote = await this.shippingFeeService.getShippingQuote({
          branchId,
          addressId: address?.id,
          subTotal: computedSubTotal,
          shippingVoucherCode: activeShippingVoucherCode,
          user,
        });
        rawShippingFee = shippingQuote.deliveryAvailable ? shippingQuote.originalShippingFee : 0;
        if (!shippingQuote.deliveryAvailable && shippingQuote.unavailabilityReason) {
          warnings.push(shippingQuote.unavailabilityReason);
        }
      } catch (err: any) {
        this.logger.warn(`Shipping quote calculation error: ${err.message}`);
      }
    }

    // 7. Validate Vouchers
    let discountAmount = 0;
    let shippingDiscount = 0;
    let discountVoucherState: any = { applied: false, code: null, discount: 0, reason: null };
    let shippingVoucherState: any = { applied: false, code: null, discount: 0, reason: null };

    if (activeVoucherCode) {
      const v = await this.prisma.voucher.findUnique({
        where: { code: activeVoucherCode },
        include: { membershipTiers: true, branches: true, voucherPaymentMethods: true },
      });

      if (!v) {
        discountVoucherState = { applied: false, code: activeVoucherCode, discount: 0, reason: 'Mã giảm giá không tồn tại' };
        warnings.push(`Mã giảm giá "${activeVoucherCode}" không tồn tại`);
      } else if (!v.isActive) {
        discountVoucherState = { applied: false, code: activeVoucherCode, discount: 0, reason: 'Mã giảm giá đang tạm ngưng' };
        warnings.push(`Mã giảm giá "${v.code}" đang tạm ngưng`);
      } else if (v.startDate > now || v.endDate < now) {
        discountVoucherState = { applied: false, code: activeVoucherCode, discount: 0, reason: 'Mã giảm giá đã hết hạn' };
        warnings.push(`Mã giảm giá "${v.code}" đã hết hạn`);
      } else if (v.discountType === 'FREE_SHIP') {
        discountVoucherState = { applied: false, code: activeVoucherCode, discount: 0, reason: 'Mã này là mã freeship, vui lòng nhập vào ô Freeship' };
      } else if (computedSubTotal < v.minOrderValue) {
        discountVoucherState = {
          applied: false,
          code: v.code,
          discount: 0,
          reason: `Đơn tối thiểu ${Math.round(v.minOrderValue).toLocaleString('vi-VN')}đ`,
        };
        warnings.push(`Mã "${v.code}" yêu cầu đơn tối thiểu ${Math.round(v.minOrderValue).toLocaleString('vi-VN')}đ`);
      } else {
        // Calculate discount
        if ((v.discountType as any) === 'PERCENTAGE' || (v.discountType as any) === 'PERCENT') {
          let disc = (computedSubTotal * v.discountValue) / 100;
          if (v.maxDiscount) disc = Math.min(disc, v.maxDiscount);
          discountAmount = Math.round(disc);
        } else {
          discountAmount = Math.round(Math.min(computedSubTotal, v.discountValue));
        }
        discountVoucherState = {
          applied: true,
          code: v.code,
          title: v.title,
          discountType: v.discountType,
          discount: discountAmount,
        };
      }
    }

    if (activeShippingVoucherCode) {
      const sv = await this.prisma.voucher.findUnique({
        where: { code: activeShippingVoucherCode },
        include: { membershipTiers: true, branches: true },
      });

      if (!sv) {
        shippingVoucherState = { applied: false, code: activeShippingVoucherCode, discount: 0, reason: 'Mã freeship không tồn tại' };
      } else if (!sv.isActive || sv.startDate > now || sv.endDate < now) {
        shippingVoucherState = { applied: false, code: activeShippingVoucherCode, discount: 0, reason: 'Mã freeship đã hết hạn hoặc tạm ngưng' };
      } else if (sv.discountType !== 'FREE_SHIP') {
        shippingVoucherState = { applied: false, code: activeShippingVoucherCode, discount: 0, reason: 'Mã này không phải mã miễn phí vận chuyển' };
      } else if (computedSubTotal < sv.minOrderValue) {
        shippingVoucherState = {
          applied: false,
          code: sv.code,
          discount: 0,
          reason: `Đơn tối thiểu ${Math.round(sv.minOrderValue).toLocaleString('vi-VN')}đ để dùng mã freeship`,
        };
      } else {
        let sDisc = rawShippingFee;
        if (sv.maxDiscount) sDisc = Math.min(rawShippingFee, sv.maxDiscount);
        shippingDiscount = Math.round(sDisc);
        shippingVoucherState = {
          applied: true,
          code: sv.code,
          title: sv.title,
          discountType: sv.discountType,
          discount: shippingDiscount,
        };
      }
    }

    // 8. Loyalty Points Discount (Single Source of Truth đồng bộ với chi nhánh & createOrder)
    let pointsDiscount = 0;
    if (pointsCount > 0 && user && user.points >= pointsCount) {
      if (branch && branch.allowDirectDiscount !== false) {
        const pointRedeemRate = branch?.pointRedeemRate && branch.pointRedeemRate > 0 ? branch.pointRedeemRate : 1;
        const maxDiscountable = Math.max(0, computedSubTotal - discountAmount);
        pointsDiscount = Math.min(Math.round(pointsCount * pointRedeemRate), maxDiscountable);
      }
    }

    // 9. Single Source of Truth Pricing Calculation (OrderPricingService)
    const pricing = await this.orderPricingService.calculatePricing({
      items: resolvedItems,
      orderDiscountAmount: discountAmount,
      shippingFee: rawShippingFee,
      shippingDiscount,
      pointsDiscount,
    });

    // Check if Freeship threshold already covers shipping, making voucher redundant
    if (pricing.freeShippingQualified && shippingVoucherState.applied) {
      warnings.push('Đơn hàng đã đủ điều kiện miễn phí vận chuyển tự động, mã Freeship không cần áp dụng.');
    }

    // 10. Check Operating Slot availability
    let selectedSlotInfo: any = null;
    if (operatingSlotId) {
      const slot = await this.prisma.operatingSlot.findUnique({
        where: { id: operatingSlotId },
      });
      if (!slot || !slot.isActive) {
        warnings.push('Khung giờ giao hàng đã chọn không còn hoạt động. Vui lòng chọn khung giờ khác.');
      } else {
        selectedSlotInfo = {
          id: slot.id,
          name: `${slot.startTime} - ${slot.endTime}`,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxOrders: slot.maxOrders,
        };
      }
    }

    // 11. Check Payment Method
    let selectedPaymentInfo: any = null;
    if (paymentMethod) {
      const pm = await this.prisma.paymentMethod.findFirst({
        where: {
          OR: [
            { methodCode: paymentMethod.toUpperCase().trim() },
            { gatewayType: paymentMethod.toUpperCase().trim() },
            { id: paymentMethod },
          ],
        },
      });
      if (pm) {
        if (!pm.isActive) {
          warnings.push(`Phương thức thanh toán "${pm.name}" hiện đang tạm ngưng phục vụ.`);
        } else if (pricing.subTotal < pm.minOrderValue) {
          warnings.push(
            `Phương thức "${pm.name}" yêu cầu đơn tối thiểu ${pm.minOrderValue.toLocaleString('vi-VN')}đ (còn thiếu ${(pm.minOrderValue - pricing.subTotal).toLocaleString('vi-VN')}đ).`,
          );
        }
        selectedPaymentInfo = {
          id: pm.id,
          name: pm.name,
          methodCode: pm.methodCode,
          gatewayType: pm.gatewayType,
          minOrderValue: pm.minOrderValue,
          isActive: pm.isActive,
        };
      }
    }

    return {
      success: true,
      data: {
        items: resolvedItems,
        subTotal: pricing.subTotal,
        itemDiscountTotal: 0,
        discountAmount: pricing.discountAmount,
        serviceChargeTotal: pricing.serviceChargeTotal,
        taxAmount: pricing.taxAmount,
        vatPriceMode: pricing.vatPriceMode,
        taxBreakdown: pricing.taxBreakdown,
        itemTaxDetails: pricing.itemTaxDetails,

        shippingFeeOriginal: pricing.shippingFeeOriginal,
        shippingDiscount: pricing.shippingDiscount,
        shippingFeeFinal: pricing.shippingFeeFinal,
        shippingDiscountSource: pricing.shippingDiscountSource,

        freeShippingQualified: pricing.freeShippingQualified,
        freeShippingThreshold: pricing.freeShippingThreshold,
        freeShippingEligibleAmount: pricing.freeShippingEligibleAmount,
        freeShippingRemainingAmount: pricing.freeShippingRemainingAmount,

        pointsDiscount: pricing.pointsDiscount,
        totalAmount: pricing.totalAmount,

        selectedPaymentMethod: selectedPaymentInfo,
        selectedOperatingSlot: selectedSlotInfo,

        voucher: discountVoucherState,
        shippingVoucher: shippingVoucherState,
        shippingQuote: shippingQuote
          ? {
              distanceKm: shippingQuote.distanceKm,
              durationMinutes: shippingQuote.durationMinutes,
              deliveryAvailable: shippingQuote.deliveryAvailable,
              unavailabilityReason: shippingQuote.unavailabilityReason,
              provider: shippingQuote.provider,
            }
          : null,

        branch: branch
          ? {
              id: branch.id,
              name: branch.name,
              allowDirectDiscount: branch.allowDirectDiscount,
              pointRedeemRate: branch.pointRedeemRate,
              isLoyaltyOnlineEnabled: branch.isLoyaltyOnlineEnabled,
              loyaltyEarnRateOnline: branch.loyaltyEarnRateOnline,
            }
          : null,

        receiverName: address?.recipientName || user?.fullName || 'Quý khách',
        phone: address?.phone || user?.phone || '',
        deliveryAddress: address
          ? `${address.streetDetail}, ${address.ward}, ${address.province}`
          : 'Chưa có địa chỉ',
        addressId: address?.id || null,

        warnings,
        pricingVersion: Math.floor(Date.now() / 1000),
        calculatedAt: now.toISOString(),
      },
    };
  }
}
