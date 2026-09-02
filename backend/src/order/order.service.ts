import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { OrderStatus, PointTransactionSource } from '@prisma/client';
import { PromotionService } from '../promotion/promotion.service';
import { MembershipService } from '../membership/membership.service';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private promotionService: PromotionService,
    private membershipService: MembershipService,
  ) { }

  async previewOrder(userId: string, payload: any) {
    const { addressId, cartItems, voucherCode, paymentMethod } = payload;

    if (!addressId || !cartItems || cartItems.length === 0) {
      throw new BadRequestException('Invalid payload');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address || address.userId !== userId) {
      throw new BadRequestException('Address not found or unauthorized');
    }

    const customerName = address.recipientName || user.fullName;
    const customerPhone = address.phone || user.phone || '';
    const deliveryAddress = `${address.streetDetail}, ${address.ward}, ${address.district ? address.district + ', ' : ''}${address.province}`;

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
              endTime: { gte: now }
            }
          }
        });

        if (fsItem) {
          let availableForUser = Math.max(0, fsItem.stock - fsItem.sold);
          if (fsItem.maxQuantityPerUser) {
            const pastOrders = await this.prisma.orderItem.aggregate({
              where: {
                productId: product.id,
                flashSaleId: cartItem.flashSaleId,
                order: { userId, status: { not: 'CANCELLED' } }
              },
              _sum: { quantity: true }
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
        const priceAtSale = flashSaleBasePrice + itemOptionsAdjustment;
        const total = priceAtSale * flashSaleQuantity;
        subTotal += total;
        itemsPreview.push({
          name: product.name,
          quantity: flashSaleQuantity,
          unitPrice: priceAtSale,
          total: total
        });
      }

      if (normalQuantity > 0) {
        const priceAtSale = product.price + itemOptionsAdjustment;
        const total = priceAtSale * normalQuantity;
        subTotal += total;
        itemsPreview.push({
          name: product.name,
          quantity: normalQuantity,
          unitPrice: priceAtSale,
          total: total
        });
      }
    }

    let discountAmount = 0;
    
    // Fetch shipping settings
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { in: ['delivery_fee', 'delivery_min_free'] } }
    });
    let baseShippingFee = 0;
    let deliveryMinFree = 0;
    settings.forEach(s => {
      if (s.key === 'delivery_fee') baseShippingFee = Number(s.value);
      if (s.key === 'delivery_min_free') deliveryMinFree = Number(s.value);
    });
    
    const shippingFee = subTotal >= deliveryMinFree ? 0 : baseShippingFee;
    let appliedVoucher = { applied: false, code: null as string | null, discount: 0 };

    if (voucherCode) {
      try {
        const voucher = await this.prisma.voucher.findUnique({ where: { code: voucherCode }, include: { membershipTiers: true } });
        let canUseVoucher = false;
        if (voucher && voucher.isActive && voucher.startDate <= now && voucher.endDate >= now && (voucher.usageLimit === null || voucher.usedCount < voucher.usageLimit) && subTotal >= voucher.minOrderValue && (voucher.membershipTiers.length === 0 || voucher.membershipTiers.some(t => t.id === user.membershipTierId))) {
          canUseVoucher = true;
          if (voucher.usageLimitPerUser !== null) {
            const usedByThisUser = await this.prisma.order.count({
              where: { userId: user.id, voucherId: voucher.id, status: { not: 'CANCELLED' } }
            });
            if (usedByThisUser >= voucher.usageLimitPerUser) {
              canUseVoucher = false;
            }
          }
        }

        if (canUseVoucher) {
          if (voucher!.discountType === 'PERCENTAGE') {
            discountAmount = (subTotal * voucher!.discountValue) / 100;
            if (voucher!.maxDiscount && discountAmount > voucher!.maxDiscount) discountAmount = voucher!.maxDiscount;
          } else if (voucher!.discountType === 'FIXED_AMOUNT') {
            discountAmount = voucher!.discountValue;
          } else if (voucher!.discountType === 'FREE_SHIP') {
            discountAmount = Math.min(voucher!.discountValue, shippingFee);
          }
          appliedVoucher = { applied: true, code: voucher!.code, discount: discountAmount };
        }
      } catch (e) {
        // Ignore voucher errors in preview, just don't apply it
      }
    }

    const totalAmount = Math.max(0, subTotal - discountAmount) + shippingFee;

    return {
      items: itemsPreview,
      subTotal,
      voucher: appliedVoucher,
      shippingFee,
      totalAmount,
      receiverName: customerName,
      phone: customerPhone,
      deliveryAddress,
      paymentMethod: paymentMethod || 'COD'
    };
  }

  async createOrder(userId: string, payload: any) {
    const { addressId, branchId, cartItems, note, paymentMethod, vatInfo } = payload;

    const maintenanceSetting = await this.prisma.systemSetting.findUnique({ where: { key: 'maintenance_mode' } });
    if (maintenanceSetting?.value === 'true') {
      throw new BadRequestException('Hệ thống đang bảo trì, vui lòng quay lại sau!');
    }

    if (!addressId || !cartItems || cartItems.length === 0) {
      throw new BadRequestException('Invalid payload');
    }

    // 1. Fetch User and Address securely from DB
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address || address.userId !== userId) {
      throw new BadRequestException('Address not found or unauthorized');
    }

    const customerName = address.recipientName || user.fullName;
    const customerPhone = address.phone || user.phone || '';
    const deliveryAddress = `${address.streetDetail}, ${address.ward}, ${address.district ? address.district + ', ' : ''}${address.province}`;

    // 2. Wrap order logic in Transaction
    const txResult = await this.prisma.$transaction(async (tx) => {
      const productIds = cartItems.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const allOptionItemIds = cartItems.flatMap((item) => item.optionItemIds || []);
      const optionItems = await tx.optionItem.findMany({
        where: { id: { in: allOptionItemIds } },
      });
      const optionItemMap = new Map(optionItems.map((o) => [o.id, o]));

      // 3. Server-side Calculation
      let subTotal = 0;
      const orderItemsData: any[] = [];
      const now = new Date();

      for (const cartItem of cartItems) {
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

        // Check if item is part of Flash Sale
        if (cartItem.isFlashSaleItem && cartItem.flashSaleId) {
          const fsItem = await tx.flashSaleItem.findFirst({
            where: {
              flashSaleId: cartItem.flashSaleId,
              productId: product.id,
              flashSale: {
                isActive: true,
                startTime: { lte: now },
                endTime: { gte: now }
              }
            }
          });

          if (fsItem) {
            let availableForUser = Math.max(0, fsItem.stock - fsItem.sold);
            
            if (fsItem.maxQuantityPerUser) {
              const pastOrders = await tx.orderItem.aggregate({
                where: {
                  productId: product.id,
                  flashSaleId: cartItem.flashSaleId,
                  order: { userId, status: { not: 'CANCELLED' } }
                },
                _sum: { quantity: true }
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

              await tx.flashSaleItem.update({
                where: { id: fsItem.id },
                data: { sold: { increment: flashSaleQuantity } }
              });
            }
          }
        }

        // Push Flash Sale Part
        if (flashSaleQuantity > 0) {
          const priceAtSale = flashSaleBasePrice + itemOptionsAdjustment;
          subTotal += priceAtSale * flashSaleQuantity;

          orderItemsData.push({
            productId: product.id,
            quantity: flashSaleQuantity,
            priceAtSale: priceAtSale,
            originalPriceAtSale: product.price,
            optionsTextSnapshot: optionsTextParts.join(', '),
            isFlashSaleItem: true,
            flashSaleId: actualFlashSaleId,
            selectedOptions: {
              create: itemOptionsData.map(o => ({...o})),
            },
          });
        }

        // Push Normal Price Part
        if (normalQuantity > 0) {
          const priceAtSale = product.price + itemOptionsAdjustment;
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
              create: itemOptionsData.map(o => ({...o})),
            },
          });
        }
      }

      let discountAmount = 0;
      let voucherId: string | null = null;
      
      // Fetch shipping settings in transaction
      const settings = await tx.systemSetting.findMany({
        where: { key: { in: ['delivery_fee', 'delivery_min_free'] } }
      });
      let baseShippingFee = 0;
      let deliveryMinFree = 0;
      settings.forEach(s => {
        if (s.key === 'delivery_fee') baseShippingFee = Number(s.value);
        if (s.key === 'delivery_min_free') deliveryMinFree = Number(s.value);
      });
      
      const shippingFee = subTotal >= deliveryMinFree ? 0 : baseShippingFee;

      if (payload.voucherCode) {
        try {
          const voucher = await tx.voucher.findUnique({ where: { code: payload.voucherCode }, include: { membershipTiers: true } });
          if (!voucher) throw new Error('Voucher không hợp lệ.');
          if (!voucher.isActive) throw new Error('Voucher không khả dụng.');
          if (voucher.startDate > now || voucher.endDate < now) throw new Error('Voucher đã hết hạn hoặc chưa bắt đầu.');
          if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) throw new Error('Voucher đã hết lượt sử dụng.');
          if (voucher.usageLimitPerUser !== null) {
            const usedByThisUser = await tx.order.count({
              where: { userId: user.id, voucherId: voucher.id, status: { not: 'CANCELLED' } }
            });
            if (usedByThisUser >= voucher.usageLimitPerUser) {
              throw new Error('Bạn đã hết lượt sử dụng voucher này.');
            }
          }
          if (subTotal < voucher.minOrderValue) throw new Error(`Đơn hàng chưa đạt giá trị tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ.`);
          if (voucher.membershipTiers.length > 0 && !voucher.membershipTiers.some(t => t.id === user.membershipTierId)) throw new Error('Voucher không dành cho hạng thành viên của bạn.');

          if (voucher.discountType === 'PERCENTAGE') {
            discountAmount = (subTotal * voucher.discountValue) / 100;
            if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
              discountAmount = voucher.maxDiscount;
            }
          } else if (voucher.discountType === 'FIXED_AMOUNT') {
            discountAmount = voucher.discountValue;
          } else if (voucher.discountType === 'FREE_SHIP') {
            discountAmount = Math.min(voucher.discountValue, shippingFee);
          }

          voucherId = voucher.id;
        } catch (e) {
          throw new BadRequestException(e.message || 'Invalid voucher');
        }
      }

      const totalAmount = Math.max(0, subTotal - discountAmount) + shippingFee;
      const orderCode = `ORD-${Date.now()}`;

      // 4. Create Order
      const newOrder = await tx.order.create({
        data: {
          orderCode,
          userId,
          branchId,
          customerName,
          customerPhone,
          deliveryAddress,
          latitude: address.latitude,
          longitude: address.longitude,
          note,
          paymentMethod: paymentMethod || 'COD',
          subTotal,
          discountAmount,
          shippingFee,
          totalAmount,
          voucherId,
          isInvoiceRequested: vatInfo?.isInvoiceRequested || false,
          invoiceCompanyName: vatInfo?.invoiceCompanyName,
          invoiceTaxCode: vatInfo?.invoiceTaxCode,
          invoiceAddress: vatInfo?.invoiceAddress,
          invoiceEmail: vatInfo?.invoiceEmail,
          status: 'PENDING',
          orderItems: {
            create: orderItemsData,
          },
        },
      });

      if (voucherId) {
        await tx.voucher.update({
          where: { id: voucherId },
          data: { usedCount: { increment: 1 } }
        });
      }

      return newOrder;
    });

    // Tạo thông báo đơn hàng
    await this.notificationService.createNotification({
      userId,
      title: 'Đặt hàng thành công!',
      content: `Đơn hàng ${txResult.orderCode} của bạn đã được tiếp nhận và đang chờ xử lý. Cảm ơn bạn đã chọn Avora!`,
      type: 'ORDER',
      referenceId: txResult.orderCode,
      url: `/orders/${txResult.orderCode}`,
    });

    return { success: true, orderId: txResult.id, orderCode: txResult.orderCode };
  }

  async getOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });
  }

  async getOrderByCode(userId: string, orderCode: string) {
    const order = await this.prisma.order.findFirst({
      where: { userId, orderCode },
      include: {
        branch: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: {
              include: {
                optionItem: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    return order;
  }

  async cancelOrder(userId: string, orderCode: string, reason: string, isAdmin: boolean = false) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Cancel reason is required');
    }

    const order = await this.prisma.order.findFirst({
      where: { userId, orderCode },
      include: { orderItems: true }
    });

    if (!order) {
      throw new BadRequestException('Đơn hàng không tìm thấy.');
    }

    if (!isAdmin && order.status !== 'PENDING') {
      throw new BadRequestException('Đơn hàng này không ở trạng thái có thể hủy. Vui lòng liên hệ hotline để được hỗ trợ!');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update order status
      const cancelledOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          cancelReason: reason,
          canceledBy: userId,
          canceledAt: new Date(),
        }
      });

      // 2. Hoàn lại số lượng đã bán (sold) cho Flash Sale nếu có
      for (const item of order.orderItems) {
        if (item.isFlashSaleItem && item.flashSaleId) {
          await tx.flashSaleItem.updateMany({
            where: {
              flashSaleId: item.flashSaleId,
              productId: item.productId,
            },
            data: {
              sold: { decrement: item.quantity }
            }
          });
        }
      }

      return cancelledOrder;
    });
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, actionByUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true }
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.status === status) {
      return order; // Không có gì thay đổi
    }

    const statusWeights: Record<OrderStatus, number> = {
      PENDING: 1,
      CONFIRMED: 2,
      PREPARING: 3,
      DELIVERING: 4,
      COMPLETED: 5,
      CANCELLED: 99,
    };

    if (statusWeights[status] < statusWeights[order.status]) {
      throw new BadRequestException('Không thể lùi trạng thái đơn hàng (chỉ có thể tiến lên).');
    }
    
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Đơn hàng đã đóng, không thể thay đổi trạng thái.');
    }

    // Dùng Transaction để đảm bảo tính toàn vẹn dữ liệu
    const txResult = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updateData: any = { status };
      
      // Ghi nhận tiến trình đơn hàng (Timeline)
      if (statusWeights[status] >= statusWeights.CONFIRMED && !order.confirmedAt) updateData.confirmedAt = now;
      if (statusWeights[status] >= statusWeights.DELIVERING && !order.deliveringAt) updateData.deliveringAt = now;
      if (statusWeights[status] >= statusWeights.COMPLETED && !order.deliveredAt) updateData.deliveredAt = now;
      if (status === OrderStatus.CANCELLED && !order.canceledAt) updateData.canceledAt = now;
      if (status === OrderStatus.COMPLETED) updateData.paymentStatus = 'PAID';

      // Nếu đơn hàng vừa hoàn thành, cộng điểm và nâng hạng
      if (status === OrderStatus.COMPLETED) {
        const amount = order.totalAmount;
        const newTotalSpending = order.user.totalSpending + amount;
        
        // Tỷ lệ quy đổi điểm cơ bản (Ví dụ 1,000 VNĐ = 1 Điểm)
        // Nếu muốn dùng PointMultiplier của hạng thẻ thì có thể nhân thêm
        let pointMultiplier = 1.0;
        if (order.user.membershipTierId) {
            const currentTier = await tx.membershipTier.findUnique({ where: { id: order.user.membershipTierId }});
            if (currentTier) pointMultiplier = currentTier.pointMultiplier;
        }

        const pointsEarned = Math.floor((amount / 1000) * pointMultiplier);
        updateData.pointsAwarded = pointsEarned; // Ghi nhận điểm kiếm được vào order

        // Cập nhật tổng chi tiêu và điểm
        await tx.user.update({
          where: { id: order.userId },
          data: {
            totalSpending: newTotalSpending,
            points: { increment: pointsEarned },
            currentPoints: { increment: pointsEarned },
          },
        });

        // Ghi lại lịch sử giao dịch điểm
        await tx.pointTransaction.create({
          data: {
            userId: order.userId,
            membershipTierId: order.user.membershipTierId, // Ghi nhận hạng lúc mua
            balanceBefore: order.user.points,
            amount: pointsEarned,
            balanceAfter: order.user.points + pointsEarned,
            source: PointTransactionSource.ORDER,
            orderId: order.id,
            description: `Tích điểm đơn hàng ${order.orderCode} (Hệ số x${pointMultiplier})`,
          },
        });
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      return updatedOrder;
    });

    if (status === OrderStatus.COMPLETED) {
      await this.membershipService.recalculateUserTier(order.userId);
    }

    return txResult;
  }
}
