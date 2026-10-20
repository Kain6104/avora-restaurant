import { Injectable, BadRequestException, NotFoundException, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationEngineService } from '../notification/notification-engine.service';
import { OrderStatus, PointTransactionSource, Voucher, User, OrderSource, SlotOrderType } from '@prisma/client';
import { PromotionService } from '../promotion/promotion.service';
import { MembershipService } from '../membership/membership.service';
import { OperatingSlotService } from '../operating-slot/operating-slot.service';
import { ShippingFeeService } from '../shipping/shipping-fee.service';
import { OrderPricingService } from '../pricing/order-pricing.service';
import { FarmIntegrationService } from '../farm/farm-integration.service';
import * as nodemailer from 'nodemailer';

export type OrderCancellationPrincipal =
  | { kind: 'ADMIN' }
  | { kind: 'USER'; userId: string }
  | { kind: 'GUEST'; phone: string };

export interface ChatbotVoucherValidationResult {
  isValid: boolean;
  code: string;
  discount: number;
  reason?: string;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private notificationEngine: NotificationEngineService,
    private promotionService: PromotionService,
    private membershipService: MembershipService,
    private slotService: OperatingSlotService,
    private shippingFeeService: ShippingFeeService,
    private orderPricingService: OrderPricingService,
    @Optional() private farmIntegrationService?: FarmIntegrationService,
  ) {}

  /**
   * Helper: Sinh mã đơn Online ngẫu nhiên chuẩn {MÃ_CHI_NHÁNH}-ONL{DDMMYY}{RAND3} (VD: AVO1-ONL070926P1V)
   * Sử dụng alphabet an toàn chống nhầm lẫn: ABCDEFGHJKLMNPQRSTUVWXYZ23456789
   */
  private async generateUniqueOnlineOrderCode(branchCode: string, tx?: any): Promise<string> {
    const db = tx || this.prisma;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = String(now.getFullYear()).slice(-2);
    const dateStr = `${d}${m}${y}`; // DDMMYY

    const cleanBranchCode = (branchCode || 'AVO1').trim().toUpperCase();

    for (let attempt = 0; attempt < 10; attempt++) {
      let rand3 = '';
      for (let i = 0; i < 3; i++) {
        rand3 += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
      }
      const candidate = `${cleanBranchCode}-ONL${dateStr}${rand3}`;
      const existing = await db.order.findUnique({
        where: { orderCode: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
    }
    return `${cleanBranchCode}-ONL${dateStr}${Date.now().toString().slice(-4)}`;
  }

  /**
   * Helper kiểm tra và tính toán mức giảm của 1 voucher
   */
  private async validateVoucherInternal(params: {
    voucher: any;
    subTotal: number;
    shippingFee: number;
    user: any;
    branchId?: string;
    now: Date;
    isShippingVoucher: boolean;
    tx?: any;
  }): Promise<{ isValid: boolean; reason?: string; discount: number; voucher?: any }> {
    const { voucher, subTotal, shippingFee, user, branchId, now, isShippingVoucher, tx } = params;
    const db = tx || this.prisma;

    if (!voucher) {
      return { isValid: false, reason: 'Mã khuyến mãi không tồn tại', discount: 0 };
    }

    if (!voucher.isActive) {
      return { isValid: false, reason: 'Mã khuyến mãi đang tạm ngưng', discount: 0 };
    }

    if (voucher.startDate > now || voucher.endDate < now) {
      return { isValid: false, reason: 'Mã khuyến mãi đã hết hạn hoặc chưa bắt đầu', discount: 0 };
    }

    // Kiểm tra đúng loại voucher
    if (isShippingVoucher) {
      if (voucher.discountType !== 'FREE_SHIP') {
        return { isValid: false, reason: 'Mã này không phải mã miễn phí vận chuyển', discount: 0 };
      }
    } else {
      if (voucher.discountType === 'FREE_SHIP') {
        return { isValid: false, reason: 'Mã này là mã freeship, không áp dụng cho giảm giá đơn hàng', discount: 0 };
      }
    }

    // Kiểm tra đơn tối thiểu (dựa trên subTotal thô của tiền món)
    if (subTotal < voucher.minOrderValue) {
      return {
        isValid: false,
        reason: `Đơn hàng tối thiểu ${Math.round(voucher.minOrderValue).toLocaleString('vi-VN')}đ để áp dụng mã này`,
        discount: 0,
      };
    }

    // Kiểm tra đơn hàng đầu tiên
    if (voucher.isFirstOrderOnly && user?.id) {
      const pastOrders = await db.order.count({
        where: { userId: user.id, status: { not: 'CANCELLED' } },
      });
      if (pastOrders > 0) {
        return { isValid: false, reason: 'Mã khuyến mãi chỉ áp dụng cho đơn hàng đầu tiên', discount: 0 };
      }
    }

    // Kiểm tra phạm vi khách hàng áp dụng (Rule mới)
    if (voucher.targetCustomerScope === 'NEW_CUSTOMER' && user?.id) {
      const pastOrders = await db.order.count({
        where: { userId: user.id, status: { in: ['COMPLETED', 'DELIVERED', 'PAID'] } },
      });
      if (pastOrders > 0) {
        return { isValid: false, reason: 'Mã khuyến mãi chỉ áp dụng cho khách hàng mới chưa có đơn', discount: 0 };
      }
    }

    if (voucher.targetCustomerScope === 'SPECIFIC_CUSTOMERS' && voucher.targetCustomerIds) {
      const allowedIds = voucher.targetCustomerIds.split(',').map((id: string) => id.trim()).filter(Boolean);
      if (!user?.id || !allowedIds.includes(user.id)) {
        return { isValid: false, reason: 'Mã khuyến mãi này chỉ áp dụng cho khách hàng được chỉ định', discount: 0 };
      }
    }

    // Kiểm tra hạng thành viên
    if (voucher.membershipTiers && voucher.membershipTiers.length > 0) {
      if (!user?.membershipTierId || !voucher.membershipTiers.some((t: any) => t.id === user.membershipTierId)) {
        return { isValid: false, reason: 'Mã khuyến mãi không áp dụng cho hạng thành viên của bạn', discount: 0 };
      }
    }

    // Kiểm tra chi nhánh
    if (voucher.branches && voucher.branches.length > 0 && branchId) {
      if (!voucher.branches.some((b: any) => b.id === branchId)) {
        return { isValid: false, reason: 'Mã khuyến mãi không áp dụng cho chi nhánh đã chọn', discount: 0 };
      }
    }

    // Kiểm tra giới hạn tổng lượt sử dụng toàn hệ thống
    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
      return { isValid: false, reason: 'Mã khuyến mãi đã hết lượt sử dụng', discount: 0 };
    }

    // Kiểm tra giới hạn lượt dùng của user này
    if (user?.id && voucher.usageLimitPerUser !== null) {
      const usedByThisUser = await db.order.count({
        where: {
          userId: user.id,
          OR: [{ voucherId: voucher.id }, { shippingVoucherId: voucher.id }],
          status: { not: 'CANCELLED' },
        },
      });
      if (usedByThisUser >= voucher.usageLimitPerUser) {
        return { isValid: false, reason: 'Bạn đã sử dụng hết số lần cho phép của mã này', discount: 0 };
      }
    }

    // Tính toán mức giảm chính xác & làm tròn số nguyên VNĐ
    let discount = 0;
    if (voucher.discountType === 'PERCENTAGE') {
      let rawDiscount = Math.round((subTotal * voucher.discountValue) / 100);
      if (voucher.maxDiscount && rawDiscount > voucher.maxDiscount) {
        rawDiscount = Math.round(voucher.maxDiscount);
      }
      discount = Math.min(rawDiscount, subTotal);
    } else if (voucher.discountType === 'FIXED_AMOUNT') {
      discount = Math.min(Math.round(voucher.discountValue), subTotal);
    } else if (voucher.discountType === 'FREE_SHIP') {
      const maxFreeship = voucher.discountValue > 0 ? Math.round(voucher.discountValue) : shippingFee;
      discount = Math.min(maxFreeship, shippingFee);
    }

    return { isValid: true, discount, voucher };
  }

  async validateVoucherForChatbot(params: {
    code: string;
    subTotal: number;
    shippingFee: number;
    branchId?: string;
    userId?: string;
    isShippingVoucher: boolean;
  }): Promise<ChatbotVoucherValidationResult> {
    const code = params.code.trim().toUpperCase();
    const [voucher, user] = await Promise.all([
      this.prisma.voucher.findUnique({
        where: { code },
        include: { membershipTiers: true, branches: true },
      }),
      params.userId
        ? this.prisma.user.findUnique({
            where: { id: params.userId },
            include: { membershipTier: true },
          })
        : Promise.resolve(null),
    ]);

    const result = await this.validateVoucherInternal({
      voucher,
      subTotal: params.subTotal,
      shippingFee: params.shippingFee,
      user,
      branchId: params.branchId,
      now: new Date(),
      isShippingVoucher: params.isShippingVoucher,
    });

    return {
      isValid: result.isValid,
      code,
      discount: result.discount,
      reason: result.reason,
    };
  }

  /**
   * Hàm dùng chung hoàn lượt voucher an toàn (Idempotent)
   */
  async refundVoucherUsage(orderId: string, txContext?: any) {
    const run = async (tx: any) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order || order.isVoucherRefunded) {
        return;
      }

      // Hoàn lượt voucher giảm giá món
      if (order.voucherId) {
        await tx.voucher.updateMany({
          where: { id: order.voucherId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      // Hoàn lượt voucher freeship
      if (order.shippingVoucherId) {
        await tx.voucher.updateMany({
          where: { id: order.shippingVoucherId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      // Đánh dấu đã hoàn thành công
      await tx.order.update({
        where: { id: orderId },
        data: { isVoucherRefunded: true },
      });
    };

    if (txContext) {
      await run(txContext);
    } else {
      await this.prisma.$transaction(async (tx) => {
        await run(tx);
      });
    }
  }

  /**
   * Xem trước và tính toán đơn hàng từ Backend (Single Source of Truth)
   */
  async previewOrder(userId: string, payload: any) {
    const { addressId, branchId, cartItems, voucherCode, shippingVoucherCode, pointsUsed, paymentMethod } = payload;

    if (!cartItems || cartItems.length === 0) {
      throw new BadRequestException('Giỏ hàng trống');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { membershipTier: true },
    });
    if (!user) throw new BadRequestException('User not found');

    let address: any = null;
    if (addressId) {
      address = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
    }
    if (!address) {
      address =
        (await this.prisma.address.findFirst({ where: { userId, isDefault: true } })) ||
        (await this.prisma.address.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } }));
    }

    const customerName = address?.recipientName || user.fullName || 'Quý khách';
    const customerPhone = address?.phone || user.phone || '';
    const deliveryAddress = address
      ? `${address.streetDetail}, ${address.ward}, ${address.province}`
      : 'Vui lòng chọn hoặc thêm địa chỉ nhận hàng';

    const productIds = cartItems.map((item: any) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const allOptionItemIds = cartItems.flatMap((item: any) => item.optionItemIds || []);
    const optionItems = await this.prisma.optionItem.findMany({
      where: { id: { in: allOptionItemIds } },
    });
    const optionItemMap = new Map(optionItems.map((o) => [o.id, o]));

    let subTotal = 0;
    const itemsPreview: any[] = [];
    const now = new Date();

    for (const cartItem of cartItems) {
      const product = productMap.get(cartItem.productId);
      if (!product) throw new BadRequestException(`Product not found: ${cartItem.productId}`);

      let itemOptionsAdjustment = 0;
      for (const optionId of cartItem.optionItemIds || []) {
        const optionItem = optionItemMap.get(optionId);
        if (!optionItem) throw new BadRequestException(`Option not found: ${optionId}`);
        itemOptionsAdjustment += optionItem.priceAdjustment;
      }

      let flashSaleQuantity = 0;
      let normalQuantity = cartItem.quantity;
      let flashSaleBasePrice = product.price;

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
          let availableForUser = Math.max(0, fsItem.stock - fsItem.sold);
          if (fsItem.maxQuantityPerUser) {
            const pastOrders = await this.prisma.orderItem.aggregate({
              where: {
                productId: product.id,
                flashSaleId: cartItem.flashSaleId,
                order: { userId, status: { not: 'CANCELLED' } },
              },
              _sum: { quantity: true },
            });
            const bought = pastOrders._sum.quantity || 0;
            const userQuota = Math.max(0, fsItem.maxQuantityPerUser - bought);
            availableForUser = Math.min(availableForUser, userQuota);
          }
          flashSaleQuantity = Math.min(cartItem.quantity, availableForUser);
          normalQuantity = cartItem.quantity - flashSaleQuantity;
          if (flashSaleQuantity > 0) flashSaleBasePrice = fsItem.flashSalePrice;
        }
      }

      if (flashSaleQuantity > 0) {
        const priceAtSale = Math.round(flashSaleBasePrice + itemOptionsAdjustment);
        const total = priceAtSale * flashSaleQuantity;
        subTotal += total;
        itemsPreview.push({
          name: product.name,
          quantity: flashSaleQuantity,
          unitPrice: priceAtSale,
          total: total,
        });
      }

      if (normalQuantity > 0) {
        const priceAtSale = Math.round(product.price + itemOptionsAdjustment);
        const total = priceAtSale * normalQuantity;
        subTotal += total;
        itemsPreview.push({
          name: product.name,
          quantity: normalQuantity,
          unitPrice: priceAtSale,
          total: total,
        });
      }
    }

    subTotal = Math.round(subTotal);

    // Tính phí vận chuyển thực tế từ Routing Engine & Tọa độ
    const shippingQuote = await this.shippingFeeService.getShippingQuote({
      branchId,
      addressId,
      subTotal,
      shippingVoucherCode,
      user,
    });
    const rawShippingFee = shippingQuote.deliveryAvailable ? shippingQuote.originalShippingFee : 0;

    // Validation không được trùng 2 mã
    if (voucherCode && shippingVoucherCode && voucherCode.trim().toUpperCase() === shippingVoucherCode.trim().toUpperCase()) {
      throw new BadRequestException('Mã giảm giá món ăn và mã freeship không được trùng nhau');
    }

    let discountAmount = 0;
    let shippingDiscount = 0;

    let discountVoucherState: any = { applied: false, code: null, discount: 0, reason: null };
    let shippingVoucherState: any = { applied: false, code: null, discount: 0, reason: null };

    // 1. Kiểm tra Voucher giảm giá món ăn
    if (voucherCode) {
      const v = await this.prisma.voucher.findUnique({
        where: { code: voucherCode.trim().toUpperCase() },
        include: { membershipTiers: true, branches: true },
      });
      const checkResult = await this.validateVoucherInternal({
        voucher: v,
        subTotal,
        shippingFee: rawShippingFee,
        user,
        branchId,
        now,
        isShippingVoucher: false,
      });

      if (checkResult.isValid) {
        discountAmount = checkResult.discount;
        discountVoucherState = {
          applied: true,
          code: v?.code,
          discount: discountAmount,
          title: v?.title,
          discountType: v?.discountType,
        };
      } else {
        discountVoucherState = {
          applied: false,
          code: voucherCode,
          discount: 0,
          reason: checkResult.reason,
        };
      }
    }

    // 2. Kiểm tra Voucher giảm phí vận chuyển (Freeship)
    if (shippingVoucherCode) {
      const sv = await this.prisma.voucher.findUnique({
        where: { code: shippingVoucherCode.trim().toUpperCase() },
        include: { membershipTiers: true, branches: true },
      });
      const checkResult = await this.validateVoucherInternal({
        voucher: sv,
        subTotal,
        shippingFee: rawShippingFee,
        user,
        branchId,
        now,
        isShippingVoucher: true,
      });

      if (checkResult.isValid) {
        shippingDiscount = checkResult.discount;
        shippingVoucherState = {
          applied: true,
          code: sv?.code,
          discount: shippingDiscount,
          title: sv?.title,
          discountType: sv?.discountType,
        };
      } else {
        shippingVoucherState = {
          applied: false,
          code: shippingVoucherCode,
          discount: 0,
          reason: checkResult.reason,
        };
      }
    }

    // Truy vấn thông tin chi nhánh nếu chưa có
    const branch = branchId
      ? await this.prisma.branch.findUnique({ where: { id: branchId } })
      : (await this.prisma.branch.findFirst({ where: { onlineOrderingEnabled: true } })) || (await this.prisma.branch.findFirst());

    // Điểm thưởng loyalty: Quy đổi theo chính sách chi nhánh (Single Source of Truth đồng bộ createOrder)
    let pointsDiscount = 0;
    const requestedPoints = pointsUsed ? Math.max(0, Math.floor(pointsUsed)) : 0;
    if (requestedPoints > 0 && user.points >= requestedPoints) {
      if (branch && branch.allowDirectDiscount !== false) {
        const pointRedeemRate = branch?.pointRedeemRate && branch.pointRedeemRate > 0 ? branch.pointRedeemRate : 1;
        const maxDiscountable = Math.max(0, subTotal - discountAmount);
        pointsDiscount = Math.min(Math.round(requestedPoints * pointRedeemRate), maxDiscountable);
      }
    }

    const pricingBreakdown = await this.orderPricingService.calculatePricing({
      items: itemsPreview.map((it) => ({ priceAtSale: it.unitPrice, quantity: it.quantity })),
      orderDiscountAmount: discountAmount,
      shippingFee: rawShippingFee,
      shippingDiscount,
      pointsDiscount,
    });

    return {
      items: itemsPreview,
      subTotal: pricingBreakdown.subTotal,
      shippingFee: pricingBreakdown.shippingFee,
      discountAmount: pricingBreakdown.discountAmount,
      shippingDiscount: pricingBreakdown.shippingDiscount,
      payableShipping: pricingBreakdown.payableShipping,
      pointsDiscount: pricingBreakdown.pointsDiscount,
      taxAmount: pricingBreakdown.taxAmount,
      vatPriceMode: pricingBreakdown.vatPriceMode,
      totalAmount: pricingBreakdown.totalAmount,
      shippingQuote: {
        distanceKm: shippingQuote.distanceKm,
        durationMinutes: shippingQuote.durationMinutes,
        deliveryAvailable: shippingQuote.deliveryAvailable,
        unavailabilityReason: shippingQuote.unavailabilityReason,
        provider: shippingQuote.provider,
      },
      voucher: discountVoucherState,
      shippingVoucher: shippingVoucherState,
      receiverName: customerName,
      phone: customerPhone,
      deliveryAddress,
      paymentMethod: paymentMethod || 'COD',
      addressId: address?.id || null,
    };
  }

  /**
   * Tạo đơn hàng với Prisma Transaction & Atomic Conditional Updates
   */
  async createOrder(userId: string, payload: any) {
    const {
      addressId,
      branchId,
      cartItems,
      note,
      paymentMethod,
      vatInfo,
      voucherCode,
      shippingVoucherCode,
      pointsUsed,
      operatingSlotId,
      deliveryDate,
      deliverySlotSnapshot,
      orderType,
      idempotencyKey,
    } = payload;

    if (idempotencyKey) {
      const existingOrder = await this.prisma.order.findUnique({
        where: { idempotencyKey },
        select: { id: true, userId: true, orderCode: true, temporaryOrderCode: true },
      });
      if (existingOrder) {
        if (existingOrder.userId !== userId) {
          throw new BadRequestException('Idempotency key is already in use');
        }
        return {
          success: true,
          orderId: existingOrder.id,
          orderCode: existingOrder.orderCode || existingOrder.temporaryOrderCode || '',
        };
      }
    }

    const maintenanceSetting = await this.prisma.systemSetting.findUnique({ where: { key: 'maintenance_mode' } });
    if (maintenanceSetting?.value === 'true') {
      throw new BadRequestException('Hệ thống đang bảo trì, vui lòng quay lại sau!');
    }

    if (!cartItems || cartItems.length === 0) {
      throw new BadRequestException('Giỏ hàng trống');
    }

    // Không cho trùng mã
    if (voucherCode && shippingVoucherCode && voucherCode.trim().toUpperCase() === shippingVoucherCode.trim().toUpperCase()) {
      throw new BadRequestException('Mã giảm giá món ăn và mã freeship không được trùng nhau');
    }

    // Bắt buộc phải chọn khung giờ giao hàng
    if (!operatingSlotId || !deliveryDate) {
      throw new BadRequestException('Vui lòng chọn khung giờ giao hàng trước khi đặt đơn.');
    }
    const chosenSlot = await this.prisma.operatingSlot.findUnique({ where: { id: operatingSlotId } });
    if (!chosenSlot || !chosenSlot.isActive) {
      throw new BadRequestException('Khung giờ đã chọn không tồn tại hoặc đã bị đóng.');
    }

    // 1. Fetch User and Address securely
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { membershipTier: true } });
    if (!user) throw new BadRequestException('User not found');

    let address: any = null;
    if (addressId) {
      address = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
    }
    if (!address) {
      address =
        (await this.prisma.address.findFirst({ where: { userId, isDefault: true } })) ||
        (await this.prisma.address.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } }));
    }

    if (!address) {
      throw new BadRequestException('Vui lòng chọn hoặc thêm địa chỉ nhận hàng trước khi đặt đơn.');
    }

    const customerName = address.recipientName || user.fullName || 'Quý khách';
    const customerPhone = address.phone || user.phone || '';
    const deliveryAddress = `${address.streetDetail}, ${address.ward}, ${address.province}`;

    // 2. Wrap order logic in Transaction with Atomic Updates
    let txResult: any;
    try {
      txResult = await this.prisma.$transaction(async (tx) => {
      const productIds = cartItems.map((item: any) => item.productId).filter(Boolean);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      // Tải thông tin Combos nếu có trong giỏ
      const comboIds = cartItems.filter((i: any) => i.isCombo && i.comboId).map((i: any) => i.comboId);
      const combos = comboIds.length > 0 ? await tx.combo.findMany({
        where: { id: { in: comboIds } },
        include: { items: { include: { product: true } } }
      }) : [];
      const comboMap = new Map(combos.map((c) => [c.id, c]));

      const allOptionItemIds = cartItems.flatMap((item: any) => item.optionItemIds || []);
      const optionItems = await tx.optionItem.findMany({
        where: { id: { in: allOptionItemIds } },
      });
      const optionItemMap = new Map(optionItems.map((o) => [o.id, o]));

      let subTotal = 0;
      const orderItemsData: any[] = [];
      const now = new Date();

      for (const cartItem of cartItems) {
        if (cartItem.isCombo && cartItem.comboId) {
          const combo = comboMap.get(cartItem.comboId);
          if (!combo) throw new BadRequestException(`Combo không tồn tại hoặc đã bị gỡ bỏ`);
          if (!combo.isActive) throw new BadRequestException(`Combo "${combo.name}" hiện đang tạm ngưng phục vụ`);
          if (combo.usageLimit && combo.usedCount >= combo.usageLimit) {
            throw new BadRequestException(`Combo "${combo.name}" đã hết số lượng phục vụ`);
          }

          const comboPrice = Math.round(combo.price);
          subTotal += comboPrice * cartItem.quantity;

          const comboItemsDescription = combo.items.map(i => `${i.quantity}x ${i.product.name}`).join(', ');
          const firstProductId = combo.items[0]?.productId || cartItem.productId;

          orderItemsData.push({
            productId: firstProductId,
            quantity: cartItem.quantity,
            priceAtSale: comboPrice,
            originalPriceAtSale: combo.originalPrice || comboPrice,
            optionsTextSnapshot: `[Combo: ${combo.name}] Gồm: ${comboItemsDescription}${cartItem.note ? ` | Ghi chú: ${cartItem.note}` : ''}`,
            isFlashSaleItem: false,
            flashSaleId: null,
          });

          await tx.combo.update({
            where: { id: combo.id },
            data: { usedCount: { increment: cartItem.quantity } }
          });
          continue;
        }

        const product = productMap.get(cartItem.productId);
        if (!product) throw new BadRequestException(`Product not found: ${cartItem.productId}`);

        let itemOptionsAdjustment = 0;
        const itemOptionsData: any[] = [];
        const optionsTextParts: string[] = [];

        for (const optionId of cartItem.optionItemIds || []) {
          const optionItem = optionItemMap.get(optionId);
          if (!optionItem) throw new BadRequestException(`Option not found: ${optionId}`);

          itemOptionsAdjustment += optionItem.priceAdjustment;
          itemOptionsData.push({
            optionItemId: optionItem.id,
            nameAtSale: optionItem.name,
            priceAdjustmentAtSale: optionItem.priceAdjustment,
          });
          optionsTextParts.push(optionItem.name);
        }

        let flashSaleQuantity = 0;
        let normalQuantity = cartItem.quantity;
        let flashSaleBasePrice = product.price;
        let actualFlashSaleId: string | null = null;
        let actualSlotId: string | null = null;
        let flashSaleNameSnapshot: string | null = null;

        if (cartItem.isFlashSaleItem && cartItem.flashSaleId) {
          const fsItem = await tx.flashSaleItem.findFirst({
            where: {
              flashSaleId: cartItem.flashSaleId,
              productId: product.id,
              isActive: true,
              flashSale: {
                isActive: true,
                status: { in: ['SCHEDULED', 'ACTIVE'] },
                startTime: { lte: now },
                endTime: { gte: now },
              },
            },
            include: {
              slot: true,
              flashSale: { select: { name: true } },
            },
          });

          // Kiểm tra xem slot có hợp lệ thời gian không
          let isSlotValid = true;
          if (fsItem?.slot) {
            const sStart = new Date(fsItem.slot.startTime);
            const sEnd = new Date(fsItem.slot.endTime);
            if (now < sStart || now >= sEnd || !fsItem.slot.isActive) {
              isSlotValid = false;
            }
          }

          if (fsItem && isSlotValid) {
            let availableForUser = Math.max(0, fsItem.stock - fsItem.sold);
            
            // Giới hạn số lượng mua trên mỗi đơn
            if (fsItem.maxQuantityPerOrder) {
              availableForUser = Math.min(availableForUser, fsItem.maxQuantityPerOrder);
            }

            // Giới hạn số lượng mua trên mỗi tài khoản
            if (fsItem.maxQuantityPerUser) {
              const pastOrders = await tx.orderItem.aggregate({
                where: {
                  productId: product.id,
                  flashSaleId: cartItem.flashSaleId,
                  order: { userId, status: { not: 'CANCELLED' } },
                },
                _sum: { quantity: true },
              });
              const bought = pastOrders._sum.quantity || 0;
              const userQuota = Math.max(0, fsItem.maxQuantityPerUser - bought);
              availableForUser = Math.min(availableForUser, userQuota);
            }

            flashSaleQuantity = Math.min(cartItem.quantity, availableForUser);
            normalQuantity = cartItem.quantity - flashSaleQuantity;

            if (flashSaleQuantity > 0) {
              flashSaleBasePrice = fsItem.flashSalePrice;
              actualFlashSaleId = fsItem.flashSaleId;
              actualSlotId = fsItem.flashSaleSlotId || null;
              flashSaleNameSnapshot = fsItem.flashSale?.name || null;

              // Atomic increment flash sale sold
              const updateFs = await tx.flashSaleItem.updateMany({
                where: {
                  id: fsItem.id,
                  stock: { gte: fsItem.sold + flashSaleQuantity },
                },
                data: { sold: { increment: flashSaleQuantity } },
              });

              if (updateFs.count === 0) {
                throw new BadRequestException(`Sản phẩm Flash Sale ${product.name} đã hết hàng`);
              }
            }
          }
        }

        if (flashSaleQuantity > 0) {
          const priceAtSale = Math.round(flashSaleBasePrice + itemOptionsAdjustment);
          subTotal += priceAtSale * flashSaleQuantity;

          orderItemsData.push({
            productId: product.id,
            quantity: flashSaleQuantity,
            priceAtSale: priceAtSale,
            originalPriceAtSale: product.price,
            optionsTextSnapshot: optionsTextParts.join(', '),
            isFlashSaleItem: true,
            flashSaleId: actualFlashSaleId,
            flashSaleSlotId: actualSlotId,
            flashSaleNameSnapshot: flashSaleNameSnapshot,
            flashSalePriceSnapshot: flashSaleBasePrice,
            selectedOptions: {
              create: itemOptionsData.map((o) => ({ ...o })),
            },
          });
        }

        if (normalQuantity > 0) {
          const priceAtSale = Math.round(product.price + itemOptionsAdjustment);
          subTotal += priceAtSale * normalQuantity;

          orderItemsData.push({
            productId: product.id,
            quantity: normalQuantity,
            priceAtSale: priceAtSale,
            originalPriceAtSale: product.price,
            optionsTextSnapshot: optionsTextParts.join(', '),
            isFlashSaleItem: false,
            flashSaleId: null,
            selectedOptions: {
              create: itemOptionsData.map((o) => ({ ...o })),
            },
          });
        }
      }

      subTotal = Math.round(subTotal);

      // 1. Lấy chi nhánh và tính quãng đường thực tế
      let orderBranchId = branchId;
      if (!orderBranchId) {
        const firstBranch = await tx.branch.findFirst({ where: { onlineOrderingEnabled: true } });
        orderBranchId = firstBranch?.id || null;
      }
      const branch = await tx.branch.findUnique({ where: { id: orderBranchId } });
      const branchCode = branch?.branchCode || 'AVO1';

      const branchLat = branch?.latitude ?? 21.028511;
      const branchLng = branch?.longitude ?? 105.854444;
      let destLat = address.latitude;
      let destLng = address.longitude;
      if (destLat === null || destLat === undefined || destLng === null || destLng === undefined) {
        destLat = branchLat + 0.025;
        destLng = branchLng + 0.025;
      }

      const route = await this.shippingFeeService.calculateRoute(
        { lat: branchLat, lng: branchLng },
        { lat: destLat, lng: destLng },
      );

      const distanceKm = Math.round((route.distanceMeters / 1000) * 10) / 10;
      const shippingPolicy = await this.shippingFeeService.getShippingPolicy(orderBranchId);

      if (!shippingPolicy.deliveryEnabled) {
        throw new BadRequestException('Dịch vụ giao hàng trực tuyến hiện đang tạm đóng.');
      }
      if (distanceKm > shippingPolicy.maxDeliveryDistanceKm) {
        throw new BadRequestException(
          `Địa chỉ nhận hàng nằm ngoài phạm vi giao hàng của chi nhánh (${distanceKm} km > tối đa ${shippingPolicy.maxDeliveryDistanceKm} km).`,
        );
      }

      const shippingFee = this.shippingFeeService.calculateFeeFromDistance(
        distanceKm,
        shippingPolicy,
        subTotal,
      );

      let discountAmount = 0;
      let shippingDiscount = 0;
      let appliedDiscountVoucher: any = null;
      let appliedShippingVoucher: any = null;

      // 3. Xử lý & Khóa slot Voucher giảm giá món ăn (Atomic)
      if (voucherCode) {
        const v = await tx.voucher.findUnique({
          where: { code: voucherCode.trim().toUpperCase() },
          include: { membershipTiers: true, branches: true },
        });

        if (!v) {
          throw new BadRequestException('Mã giảm giá không tồn tại');
        }

        const check = await this.validateVoucherInternal({
          voucher: v,
          subTotal,
          shippingFee,
          user,
          branchId,
          now,
          isShippingVoucher: false,
          tx,
        });

        if (!check.isValid) {
          throw new BadRequestException(check.reason || 'Mã giảm giá không hợp lệ');
        }

        const updateConditions: any[] = [{ usageLimit: null }];
        if (v.usageLimit !== null) {
          updateConditions.push({ usedCount: { lt: v.usageLimit } });
        }

        // Atomic Conditional Update: chỉ tăng nếu usedCount < usageLimit (hoặc usageLimit is null)
        const updateResult = await tx.voucher.updateMany({
          where: {
            id: v.id,
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
            OR: updateConditions,
          },
          data: { usedCount: { increment: 1 } },
        });

        if (updateResult.count === 0) {
          throw new BadRequestException(`Mã giảm giá ${v.code} vừa hết lượt sử dụng`);
        }

        discountAmount = check.discount;
        appliedDiscountVoucher = v;
      }

      // 4. Xử lý & Khóa slot Voucher Freeship (Atomic)
      if (shippingVoucherCode) {
        const sv = await tx.voucher.findUnique({
          where: { code: shippingVoucherCode.trim().toUpperCase() },
          include: { membershipTiers: true, branches: true },
        });

        if (!sv) {
          throw new BadRequestException('Mã freeship không tồn tại');
        }

        const check = await this.validateVoucherInternal({
          voucher: sv,
          subTotal,
          shippingFee,
          user,
          branchId,
          now,
          isShippingVoucher: true,
          tx,
        });

        if (!check.isValid) {
          throw new BadRequestException(check.reason || 'Mã freeship không hợp lệ');
        }

        const svUpdateConditions: any[] = [{ usageLimit: null }];
        if (sv.usageLimit !== null) {
          svUpdateConditions.push({ usedCount: { lt: sv.usageLimit } });
        }

        // Atomic Conditional Update: chỉ tăng nếu usedCount < usageLimit (hoặc usageLimit is null)
        const updateResult = await tx.voucher.updateMany({
          where: {
            id: sv.id,
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
            OR: svUpdateConditions,
          },
          data: { usedCount: { increment: 1 } },
        });

        if (updateResult.count === 0) {
          throw new BadRequestException(`Mã freeship ${sv.code} vừa hết lượt sử dụng`);
        }

        shippingDiscount = check.discount;
        appliedShippingVoucher = sv;
      }

      const payableShipping = Math.max(0, shippingFee - shippingDiscount);

      // 5. Điểm thưởng Loyalty
      let pointsUsedInt = 0;
      let pointsDiscount = 0;
      const requestedPoints = pointsUsed ? Math.max(0, Math.floor(pointsUsed)) : 0;
      if (requestedPoints > 0) {
        if (branch && branch.allowDirectDiscount === false) {
          throw new BadRequestException('Chi nhánh này hiện không áp dụng quy đổi điểm thành giảm giá trực tiếp');
        }
        if (user.points < requestedPoints) {
          throw new BadRequestException(`Số điểm tích lũy không đủ (Hiện có: ${user.points} điểm, yêu cầu: ${requestedPoints} điểm)`);
        }
        pointsUsedInt = requestedPoints;
        const pointRedeemRate = branch?.pointRedeemRate && branch.pointRedeemRate > 0 ? branch.pointRedeemRate : 1;
        const maxDiscountable = Math.max(0, subTotal - discountAmount);
        pointsDiscount = Math.min(Math.round(pointsUsedInt * pointRedeemRate), maxDiscountable);

        // Trừ điểm user (đồng bộ cả points và currentPoints)
        await tx.user.update({
          where: { id: userId },
          data: {
            points: { decrement: pointsUsedInt },
            currentPoints: { decrement: pointsUsedInt },
          },
        });
      }

      const pricingBreakdown = await this.orderPricingService.calculatePricing({
        items: orderItemsData.map((oi) => ({
          productId: oi.productId,
          name: productMap.get(oi.productId)?.name || 'Món',
          priceAtSale: oi.priceAtSale,
          quantity: oi.quantity,
          taxPercentage: productMap.get(oi.productId)?.taxPercentage || 0,
        })),
        orderDiscountAmount: discountAmount,
        shippingFee,
        shippingDiscount,
        pointsDiscount,
      });

      // Rule #42: Chống Race Condition nếu giá / khuyến mãi bị thay đổi giữa lúc xem và bấm Đặt hàng
      if (payload.expectedTotalAmount !== undefined && typeof payload.expectedTotalAmount === 'number') {
        if (Math.abs(payload.expectedTotalAmount - pricingBreakdown.totalAmount) > 10) {
          throw new BadRequestException({
            error: 'CHECKOUT_CHANGED',
            message: 'Đơn hàng vừa có thay đổi về giá hoặc điều kiện ưu đãi. Vui lòng kiểm tra lại tổng thanh toán trước khi xác nhận đặt hàng.',
            newTotal: pricingBreakdown.totalAmount,
          });
        }
      }

      // Gắn Financial Tax Snapshot tại thời điểm bán vào từng OrderItem (Rule #13)
      orderItemsData.forEach((item, idx) => {
        const taxDetail = pricingBreakdown.itemTaxDetails[idx];
        item.taxPercentageAtSale = taxDetail?.taxPercentage ?? (productMap.get(item.productId)?.taxPercentage || 0);
        item.taxableAmountAtSale = taxDetail?.netTaxableAmount ?? Math.round(item.priceAtSale * item.quantity);
        item.taxAmountAtSale = taxDetail?.taxAmount ?? 0;
        item.vatPriceModeSnapshot = taxDetail?.vatPriceMode ?? pricingBreakdown.vatPriceMode;
        item.isVatInclusive = taxDetail?.isVatInclusive ?? (pricingBreakdown.vatPriceMode === 'VAT_INCLUDED');
      });

      const totalAmount = pricingBreakdown.totalAmount;
      const orderCode = await this.generateUniqueOnlineOrderCode(branchCode, tx);

      // 6. Kiểm tra & Bắt buộc lựa chọn phương thức thanh toán hợp lệ
      if (!paymentMethod || typeof paymentMethod !== 'string' || !paymentMethod.trim()) {
        throw new BadRequestException('Vui lòng chọn 1 phương thức thanh toán');
      }

      const pMethod = await tx.paymentMethod.findFirst({
        where: {
          OR: [
            { methodCode: paymentMethod.toUpperCase().trim() },
            { gatewayType: paymentMethod.toUpperCase().trim() },
            { id: paymentMethod },
          ],
        },
        include: { branches: true },
      });

      if (pMethod) {
        if (!pMethod.isActive) {
          throw new BadRequestException(`Phương thức thanh toán "${pMethod.name}" hiện đang tạm ngưng phục vụ`);
        }
        if (!pMethod.isAllBranches && orderBranchId && pMethod.branches && pMethod.branches.length > 0) {
          const isBranchAllowed = pMethod.branches.some((b: any) => b.id === orderBranchId);
          if (!isBranchAllowed) {
            throw new BadRequestException(`Phương thức thanh toán "${pMethod.name}" không áp dụng cho chi nhánh đã chọn`);
          }
        }
        const orderSubTotal = pricingBreakdown.subTotal;
        if (orderSubTotal < pMethod.minOrderValue) {
          throw new BadRequestException(
            `Phương thức thanh toán "${pMethod.name}" yêu cầu đơn hàng tối thiểu (trước giảm giá) từ ${pMethod.minOrderValue.toLocaleString('vi-VN')}đ (Tiền hàng hiện tại: ${orderSubTotal.toLocaleString('vi-VN')}đ)`
          );
        }
      }

      // 7. Ghi nhận công suất khung giờ nếu có chọn slot
      if (operatingSlotId && deliveryDate) {
        await this.slotService.incrementDailyOrder(operatingSlotId, new Date(deliveryDate), tx);
        await tx.slotLock.deleteMany({
          where: { slotId: operatingSlotId, sessionId: userId },
        });
      }

      // 8. Tạo Order lưu đầy đủ Snapshots
      const newOrder = await tx.order.create({
        data: {
          orderCode,
          temporaryOrderCode: null,
          idempotencyKey: idempotencyKey || null,
          userId,
          branchId: orderBranchId,
          customerName,
          customerPhone,
          deliveryAddress,
          latitude: destLat,
          longitude: destLng,
          deliveryDistanceMeters: route.distanceMeters,
          deliveryDurationSeconds: route.durationSeconds,
          shippingProvider: route.provider,
          shippingCalculatedAt: route.calculatedAt,
          shippingOriginLatitude: branchLat,
          shippingOriginLongitude: branchLng,
          shippingDestinationLatitude: destLat,
          shippingDestinationLongitude: destLng,
          note,
          paymentMethod: pMethod?.methodCode || paymentMethod.toUpperCase().trim(),
          paymentStatus: 'PENDING',
          status: OrderStatus.PENDING,
          orderSource: OrderSource.ONLINE,
          orderType: SlotOrderType.DELIVERY,
          subTotal: pricingBreakdown.subTotal,
          discountAmount: pricingBreakdown.discountAmount,
          shippingFee: pricingBreakdown.shippingFee,
          shippingDiscount: pricingBreakdown.shippingDiscount,
          shippingDiscountReason: pricingBreakdown.shippingDiscountSource,
          serviceChargeTotal: 0,
          taxAmount: pricingBreakdown.taxAmount,
          vatPriceModeSnapshot: pricingBreakdown.vatPriceMode,
          totalAmount: pricingBreakdown.totalAmount,
          voucherId: appliedDiscountVoucher?.id || null,
          shippingVoucherId: appliedShippingVoucher?.id || null,
          discountVoucherCodeSnapshot: appliedDiscountVoucher?.code || null,
          shippingVoucherCodeSnapshot: appliedShippingVoucher?.code || null,
          isVoucherRefunded: false,
          pointsUsed: pointsUsedInt,
          operatingSlotId: operatingSlotId || null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          deliverySlotSnapshot: deliverySlotSnapshot || null,
          isInvoiceRequested: vatInfo?.isInvoiceRequested || false,
          invoiceCompanyName: vatInfo?.invoiceCompanyName,
          invoiceTaxCode: vatInfo?.invoiceTaxCode,
          invoiceAddress: vatInfo?.invoiceAddress,
          invoiceEmail: vatInfo?.invoiceEmail,
          orderItems: {
            create: orderItemsData,
          },
        },
        include: {
          branch: true,
        },
      });

      // Ghi nhận giao dịch trừ điểm loyalty
      if (pointsUsedInt > 0) {
        const pointRedeemRate = branch?.pointRedeemRate && branch.pointRedeemRate > 0 ? branch.pointRedeemRate : 1;
        const discountVal = pointsUsedInt * pointRedeemRate;
        const finalCode = newOrder.orderCode || newOrder.temporaryOrderCode || '';
        await tx.pointTransaction.create({
          data: {
            userId,
            membershipTierId: user.membershipTierId || null,
            membershipTierName: (user as any).membershipTier?.name || null,
            balanceBefore: user.points,
            amount: -pointsUsedInt,
            balanceAfter: user.points - pointsUsedInt,
            source: PointTransactionSource.ORDER,
            orderId: newOrder.id,
            orderCode: finalCode,
            referenceCode: finalCode,
            description: `Sử dụng ${pointsUsedInt} điểm quy đổi giảm ${discountVal.toLocaleString('vi-VN')}đ cho đơn hàng ${finalCode}`,
          },
        });
      }

        return newOrder;
      });
    } catch (error: any) {
      if (idempotencyKey && error?.code === 'P2002') {
        const existingOrder = await this.prisma.order.findUnique({
          where: { idempotencyKey },
          select: { id: true, userId: true, orderCode: true, temporaryOrderCode: true },
        });
        if (existingOrder) {
          if (existingOrder.userId !== userId) {
            throw new BadRequestException('Idempotency key is already in use');
          }
          return {
            success: true,
            orderId: existingOrder.id,
            orderCode: existingOrder.orderCode || existingOrder.temporaryOrderCode || '',
          };
        }
      }
      throw error;
    }

    // Tạo thông báo đơn hàng cho khách
    const displayCode = txResult.orderCode || txResult.temporaryOrderCode || '';
    const branchInfo = (txResult as any).branch;
    const branchLabel = branchInfo?.branchCode || branchInfo?.name || '';
    const branchTag = branchLabel ? ` (${branchLabel})` : '';

    await this.notificationService.createNotification({
      userId,
      title: 'Đặt hàng thành công!',
      content: `Đơn hàng ${displayCode} của bạn đã được tiếp nhận và đang chờ xử lý. Cảm ơn bạn đã chọn Avora!`,
      type: 'ORDER',
      referenceId: displayCode || undefined,
      url: `/orders/${displayCode}`,
    });

    // Phát sự kiện thông báo nội bộ cho nhân viên chi nhánh qua NotificationEngine
    try {
      await this.notificationEngine.publishEvent({
        eventType: 'ONLINE_ORDER_CREATED',
        category: 'ORDER',
        priority: 2, // HIGH
        branchId: txResult.branchId,
        entityId: txResult.id,
        title: 'Đơn Online mới',
        message: `Đơn ${displayCode}${branchTag} trị giá ${txResult.totalAmount.toLocaleString('vi-VN')}₫ vừa được khách hàng đặt.`,
        actor: {
          id: user.id,
          name: user.fullName || user.email || 'Khách hàng',
          avatarUrl: user.avatarUrl || undefined,
        },
        reference: {
          type: 'ORDER',
          id: txResult.id,
          url: `/admin/orders/${txResult.id}`,
        },
        metadata: {
          orderId: txResult.id,
          orderCode: displayCode,
          totalAmount: txResult.totalAmount,
          branchId: txResult.branchId,
          branchCode: branchInfo?.branchCode,
          branchName: branchInfo?.name,
          orderSource: txResult.orderSource,
        },
        requiredPermissions: ['orders.view', 'pos.order.view'],
        appScopes: ['ADMIN', 'POS'],
        legacyType: 'ORDER',
      });
    } catch (engineErr) {
      console.error('Error emitting ONLINE_ORDER_CREATED event:', engineErr);
    }

    // Gửi email đặt hàng thành công ngầm trong background (không chặn HTTP response)
    if (process.env.SMTP_USER && process.env.SMTP_PASS && user.email) {
      setImmediate(async () => {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          const formattedTotal = txResult.totalAmount.toLocaleString('vi-VN');
          const formattedDate = new Date(txResult.createdAt).toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
          });

          await transporter.sendMail({
            from: `"Avora Restaurant" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: `Xác nhận đặt hàng thành công - ${displayCode}`,
            html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                     <div style="background-color: #dc2626; padding: 20px; text-align: center;">
                       <h2 style="color: white; margin: 0;">ĐẶT HÀNG THÀNH CÔNG</h2>
                     </div>
                     <div style="padding: 20px;">
                       <p>Xin chào <strong>${user.fullName}</strong>,</p>
                       <p>Cảm ơn bạn đã đặt hàng tại <strong>Avora Restaurant</strong>. Đơn hàng của bạn đã được hệ thống ghi nhận và đang chờ xử lý.</p>
                       
                       <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                         <h3 style="margin-top: 0; color: #dc2626;">Thông tin đơn hàng</h3>
                         <p><strong>Mã đơn hàng:</strong> <span style="color: #dc2626; font-weight: bold;">${displayCode}</span></p>
                         <p><strong>Thời gian đặt:</strong> ${formattedDate}</p>
                         <p><strong>Khách hàng:</strong> ${txResult.customerName}</p>
                         <p><strong>Số điện thoại:</strong> ${txResult.customerPhone}</p>
                         <p><strong>Địa chỉ giao hàng:</strong> ${txResult.deliveryAddress}</p>
                         <p><strong>Tổng thanh toán:</strong> <span style="font-size: 18px; font-weight: bold; color: #dc2626;">${formattedTotal}đ</span></p>
                         <p><strong>Phương thức thanh toán:</strong> ${txResult.paymentMethod}</p>
                       </div>

                       <p>Bạn có thể theo dõi tiến trình đơn hàng tại mục <strong>Lịch sử đơn hàng</strong> trên website.</p>
                       
                       <div style="text-align: center; margin-top: 30px;">
                         <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${displayCode}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Xem Chi Tiết Đơn Hàng</a>
                       </div>
                     </div>
                     <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                       <p style="margin: 0;">Cảm ơn bạn đã lựa chọn Avora Restaurant!</p>
                       <p style="margin: 5px 0 0 0;">Nếu có thắc mắc, vui lòng liên hệ hotline: <strong>1900 1234</strong></p>
                     </div>
                   </div>`,
          });
        } catch (e) {
          console.error('[EMAIL BACKGROUND] Error sending order success email', e);
        }
      });
    }

    return { success: true, orderId: txResult.id, orderCode: displayCode };
  }

  async getOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        voucher: true,
        shippingVoucher: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async getOrderByCode(userId: string, orderCode: string) {
    const order = await this.prisma.order.findFirst({
      where: { userId, orderCode },
      include: {
        branch: true,
        voucher: true,
        shippingVoucher: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: {
              include: {
                optionItem: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    return order;
  }

  async checkOrderStatus(orderCode: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderCode },
      select: {
        id: true,
        orderCode: true,
        status: true,
        paymentStatus: true,
        transactionId: true,
        totalAmount: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ${orderCode}`);
    }

    const isPaid = order.paymentStatus === 'PAID' || order.status === OrderStatus.COMPLETED;

    return {
      orderCode: order.orderCode,
      status: isPaid ? 'PAID' : order.status,
      rawStatus: order.status,
      paymentStatus: order.paymentStatus,
      isPaid,
      transactionCode: order.transactionId,
    };
  }

  async cancelOrder(orderCode: string, reason: string, principal: OrderCancellationPrincipal) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Cancel reason is required');
    }

    const order = await this.prisma.order.findFirst({
      where: { orderCode },
      include: { orderItems: true },
    });

    const normalizeCustomerPhone = (value?: string | null) =>
      (value || '').replace(/[.\s-]/g, '');
    const isOwner =
      order &&
      (principal.kind === 'ADMIN' ||
        (principal.kind === 'USER' && order.userId === principal.userId) ||
        (principal.kind === 'GUEST' &&
          normalizeCustomerPhone(order.customerPhone) ===
            normalizeCustomerPhone(principal.phone)));

    if (!order || !isOwner) {
      throw new BadRequestException('Đơn hàng không tìm thấy.');
    }

    if (principal.kind !== 'ADMIN' && order.status !== 'PENDING') {
      throw new BadRequestException('Đơn hàng này không ở trạng thái có thể hủy. Vui lòng liên hệ hotline để được hỗ trợ!');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update order status
      const cancelledOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          cancelReason: reason,
          canceledBy: principal.kind === 'USER' ? principal.userId : principal.kind,
          canceledAt: new Date(),
        },
      });

      // 2. Hoàn lại quota Flash Sale nếu có
      for (const item of order.orderItems) {
        if (item.isFlashSaleItem && item.flashSaleId) {
          await tx.flashSaleItem.updateMany({
            where: {
              flashSaleId: item.flashSaleId,
              productId: item.productId,
            },
            data: {
              sold: { decrement: item.quantity },
            },
          });
        }
      }

      // 3. Hoàn lại lượt voucher (Idempotent)
      await this.refundVoucherUsage(order.id, tx);

      // 4. Hoàn lại điểm loyalty nếu đã dùng
      if (order.pointsUsed && order.pointsUsed > 0 && order.userId) {
        const currentUser = await tx.user.findUnique({ where: { id: order.userId } });
        if (currentUser) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              points: { increment: order.pointsUsed },
              currentPoints: { increment: order.pointsUsed },
            },
          });

          const finalCode = order.orderCode || order.temporaryOrderCode || '';
          await tx.pointTransaction.create({
            data: {
              userId: order.userId,
              membershipTierId: currentUser.membershipTierId || null,
              balanceBefore: currentUser.points,
              amount: order.pointsUsed,
              balanceAfter: currentUser.points + order.pointsUsed,
              source: PointTransactionSource.REFUND,
              orderId: order.id,
              orderCode: finalCode,
              referenceCode: finalCode,
              description: `Hoàn ${order.pointsUsed} điểm do hủy đơn hàng ${finalCode}`,
            },
          });
        }
      }

      // 4.1 Thu hồi điểm tích lũy nếu đơn hàng đã từng hoàn thành và tích điểm
      if (order.pointsAwarded && order.pointsAwarded > 0 && order.userId) {
        const currentUser = await tx.user.findUnique({ where: { id: order.userId } });
        if (currentUser) {
          const pointsToReclaim = Math.min(currentUser.points, order.pointsAwarded);
          await tx.user.update({
            where: { id: order.userId },
            data: {
              points: { decrement: pointsToReclaim },
              currentPoints: { decrement: pointsToReclaim },
              totalSpending: { decrement: Math.min(currentUser.totalSpending, order.totalAmount) },
            },
          });

          const finalCode = order.orderCode || order.temporaryOrderCode || '';
          await tx.pointTransaction.create({
            data: {
              userId: order.userId,
              membershipTierId: currentUser.membershipTierId || null,
              balanceBefore: currentUser.points,
              amount: -pointsToReclaim,
              balanceAfter: currentUser.points - pointsToReclaim,
              source: PointTransactionSource.REFUND,
              orderId: order.id,
              orderCode: finalCode,
              referenceCode: finalCode,
              description: `Thu hồi ${pointsToReclaim} điểm tích lũy do hủy đơn hàng đã hoàn thành ${finalCode}`,
            },
          });
        }
      }

      // 5. Hoàn lại slot công suất nếu có
      if (order.operatingSlotId && order.deliveryDate) {
        await this.slotService.decrementDailyOrder(order.operatingSlotId, order.deliveryDate, tx);
      }

      return cancelledOrder;
    });

    // Gửi thông báo hủy đơn hàng tới khách hàng
    const displayCode = order.orderCode || order.temporaryOrderCode || order.id;
    if (order.userId) {
      await this.notificationService.createNotification({
        userId: order.userId,
        title: 'Đơn hàng đã được hủy',
        content: `Đơn hàng ${displayCode} đã được hủy thành công.`,
        type: 'ORDER',
        referenceId: displayCode,
        url: `/orders/${displayCode}`,
      });
    }

    return result;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, actionByUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.status === status) {
      return order;
    }

    const statusWeights: Record<OrderStatus, number> = {
      DRAFT: 0,
      HELD: 0.5,
      PENDING: 1,
      CONFIRMED: 2,
      PREPARING: 3,
      DELIVERING: 4,
      COMPLETED: 5,
      CANCELLED: 99,
    };

    if (statusWeights[status] < statusWeights[order.status]) {
      throw new BadRequestException('Không thể lùi trạng thái đơn hàng.');
    }

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Đơn hàng đã đóng, không thể thay đổi trạng thái.');
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updateData: any = { status };

      if (statusWeights[status] >= statusWeights.CONFIRMED && !order.confirmedAt) updateData.confirmedAt = now;
      if (statusWeights[status] >= statusWeights.DELIVERING && !order.deliveringAt) updateData.deliveringAt = now;
      if (statusWeights[status] >= statusWeights.COMPLETED && !order.deliveredAt) updateData.deliveredAt = now;
      if (status === OrderStatus.COMPLETED && !order.completedAt) updateData.completedAt = now;
      if (status === OrderStatus.CANCELLED && !order.canceledAt) updateData.canceledAt = now;
      if (status === OrderStatus.COMPLETED) updateData.paymentStatus = 'PAID';

      // Nếu đơn hoàn thành: Tích điểm loyalty & nâng hạng (chỉ khi có tài khoản user)
      if (status === OrderStatus.COMPLETED && order.userId && order.user) {
        // Lấy thông tin chi nhánh để kiểm tra cấu hình tích điểm Online
        const branch = order.branchId ? await tx.branch.findUnique({ where: { id: order.branchId } }) : null;
        const isLoyaltyEnabled = branch ? branch.isLoyaltyOnlineEnabled : true;
        const earnRate = (branch?.loyaltyEarnRateOnline && branch.loyaltyEarnRateOnline > 0) ? branch.loyaltyEarnRateOnline : 40;

        const amount = order.totalAmount;
        const newTotalSpending = order.user.totalSpending + amount;

        let pointMultiplier = 1.0;
        let currentTier: any = null;
        if (order.user.membershipTierId) {
          currentTier = await tx.membershipTier.findUnique({ where: { id: order.user.membershipTierId } });
          if (currentTier) pointMultiplier = currentTier.pointMultiplier;
        }

        const pointsEarned = isLoyaltyEnabled ? Math.floor((amount / earnRate) * pointMultiplier) : 0;
        updateData.pointsAwarded = pointsEarned;

        await tx.user.update({
          where: { id: order.userId },
          data: {
            totalSpending: newTotalSpending,
            ...(pointsEarned > 0 ? {
              points: { increment: pointsEarned },
              currentPoints: { increment: pointsEarned },
            } : {}),
          },
        });

        if (pointsEarned > 0) {
          const finalCode = order.orderCode || order.temporaryOrderCode || '';
          await tx.pointTransaction.create({
            data: {
              userId: order.userId,
              membershipTierId: order.user.membershipTierId,
              membershipTierName: currentTier?.name || null,
              balanceBefore: order.user.points,
              amount: pointsEarned,
              balanceAfter: order.user.points + pointsEarned,
              source: PointTransactionSource.ORDER,
              orderId: order.id,
              orderCode: finalCode,
              referenceCode: finalCode,
              description: `Tích ${pointsEarned} điểm từ đơn hàng ${finalCode} (Tỷ lệ: ${earnRate}đ/điểm, Hạng ${currentTier?.name || 'Thành viên'} x${pointMultiplier})`,
            },
          });
        }
      }

      // Nếu chuyển sang CANCELLED: Hoàn lượt voucher
      if (status === OrderStatus.CANCELLED) {
        await this.refundVoucherUsage(order.id, tx);
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      return updatedOrder;
    });

    if (status === OrderStatus.COMPLETED && order.userId) {
      await this.membershipService.recalculateUserTier(order.userId);
      if (this.farmIntegrationService) {
        await this.farmIntegrationService.onOrderCompleted(order.userId, order.id, order.totalAmount);
      }
    }

    // Gửi thông báo cập nhật trạng thái đơn hàng tới khách hàng
    if (order.userId) {
      const displayCode = order.orderCode || order.temporaryOrderCode || order.id;
      const statusTitles: Record<string, string> = {
        CONFIRMED: 'Đơn hàng đã được xác nhận',
        PREPARING: 'Đơn hàng đang được chuẩn bị',
        DELIVERING: 'Đơn hàng đang được giao',
        COMPLETED: 'Đơn hàng đã hoàn thành',
        CANCELLED: 'Đơn hàng đã bị hủy',
      };

      const statusMessages: Partial<Record<OrderStatus, string>> = {
        CONFIRMED: `Đơn hàng ${displayCode} đã được nhà hàng xác nhận và chuyển đến bộ phận bếp.`,
        PREPARING: `Bếp đang chuẩn bị các món ăn nóng hổi cho đơn hàng ${displayCode}.`,
        DELIVERING: `Đơn hàng ${displayCode} đang trên đường giao đến địa chỉ của bạn.`,
        COMPLETED: `Đơn hàng ${displayCode} đã được giao thành công. Chúc bạn ngon miệng!`,
        CANCELLED: `Đơn hàng ${displayCode} đã bị hủy.`,
      };

      if (statusTitles[status]) {
        await this.notificationService.createNotification({
          userId: order.userId,
          title: statusTitles[status]!,
          content: statusMessages[status]!,
          type: 'ORDER',
          referenceId: displayCode,
          url: `/orders/${displayCode}`,
        });
      }

      // Nếu đơn chuyển sang COMPLETED: Gửi thông báo xin đánh giá trải nghiệm (Idempotent theo eventId)
      if (status === OrderStatus.COMPLETED) {
        try {
          const setting = await this.prisma.systemSetting.findUnique({
            where: { key: 'ORDER_REVIEW_REWARD_POINTS' },
          });
          const rewardPoints = setting?.value ? parseInt(setting.value, 10) : 999;
          await this.notificationService.createNotification({
            userId: order.userId,
            title: 'Bạn thấy trải nghiệm tại AVORA thế nào?',
            content: `Hãy chia sẻ trải nghiệm đơn hàng #${displayCode} và nhận ${rewardPoints} điểm AVORA.`,
            type: 'ORDER',
            referenceId: displayCode,
            url: `/orders/${displayCode}?review=1`,
            eventId: `ORDER_REVIEW_REQUEST:${order.id}:${order.userId}`,
            category: 'REVIEW',
            priority: 1,
            metadata: {
              orderId: order.id,
              orderCode: displayCode,
              rewardPoints,
            },
          });
        } catch (err: any) {
          this.logger.error(`Error sending review request notification: ${err?.message}`);
        }
      }
    }

    return txResult;
  }
}
