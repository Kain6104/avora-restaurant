import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) { }

  async createOrder(userId: string, payload: any) {
    const { addressId, branchId, cartItems, note, paymentMethod, vatInfo } = payload;

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

    // 2. Fetch all products and options to calculate prices securely on backend
    const productIds = cartItems.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const allOptionItemIds = cartItems.flatMap((item) => item.optionItemIds || []);
    const optionItems = await this.prisma.optionItem.findMany({
      where: { id: { in: allOptionItemIds } },
    });
    const optionItemMap = new Map(optionItems.map((o) => [o.id, o]));

    // 3. Server-side Calculation
    let subTotal = 0;
    const orderItemsData: any[] = [];

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

      // Final price for this item after options
      const priceAtSale = product.price + itemOptionsAdjustment;
      subTotal += priceAtSale * cartItem.quantity;

      orderItemsData.push({
        productId: product.id,
        quantity: cartItem.quantity,
        priceAtSale: priceAtSale,
        originalPriceAtSale: product.price,
        optionsTextSnapshot: optionsTextParts.join(', '),
        selectedOptions: {
          create: itemOptionsData,
        },
      });
    }

    const shippingFee = 15000;
    const totalAmount = subTotal + shippingFee;

    const orderCode = `ORD-${Date.now()}`;

    // 4. Create Order with Transaction
    const newOrder = await this.prisma.order.create({
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
        shippingFee,
        totalAmount,
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
    // Tạo thông báo đơn hàng
    await this.notificationService.createNotification({
      userId,
      title: 'Đặt hàng thành công!',
      content: `Đơn hàng ${orderCode} của bạn đã được tiếp nhận và đang chờ xử lý. Cảm ơn bạn đã chọn Avora!`,
      type: 'ORDER',
      referenceId: newOrder.orderCode,
      url: `/orders/${newOrder.orderCode}`,
    });

    return { success: true, orderId: newOrder.id, orderCode: newOrder.orderCode };
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

  async cancelOrder(userId: string, orderCode: string, reason: string) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Cancel reason is required');
    }

    const order = await this.prisma.order.findFirst({
      where: { userId, orderCode }
    });

    if (!order) {
      throw new BadRequestException('Đơn hàng không tìm thấy.');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Đơn hàng này không ở trạng thái có thể hủy. Vui lòng liên hệ hotline để được hỗ trợ!');
    }

    return this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        cancelReason: reason,
        canceledBy: userId,
        canceledAt: new Date(),
      }
    });
  }
}
