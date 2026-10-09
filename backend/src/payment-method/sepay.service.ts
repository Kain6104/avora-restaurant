import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationEngineService } from '../notification/notification-engine.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class SepayService {
  private readonly logger = new Logger(SepayService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private notificationEngine: NotificationEngineService,
  ) {}

  /**
   * 1. Xử lý Webhook từ SePay (Chuyển khoản tự động VietQR đa cổng)
   */
  async handleSepayWebhook(payload: any, authHeader?: string) {
    this.logger.log('====== [SEPAY WEBHOOK] RECEIVED WEBHOOK FROM SEPAY ======');
    this.logger.log(`Payload: ${JSON.stringify(payload)}`);
    this.logger.log(`Authorization Header: ${authHeader}`);

    // 1.1 Xác thực bảo mật (Kiểm tra token với tất cả các cổng SePay đang BẬT)
    if (!authHeader || !authHeader.trim()) {
      this.logger.error('❌ SePay không gửi khóa bảo mật (Authorization Header)!');
      throw new UnauthorizedException('Thiếu khóa bảo mật (Authorization Header)');
    }

    const activeSepayMethods = await this.prisma.paymentMethod.findMany({
      where: {
        gatewayType: 'SEPAY',
        isActive: true,
      },
    });

    let validSepayConfig: any = null;
    for (const pm of activeSepayMethods) {
      const token1 = pm.configKey1?.trim();
      const token2 = pm.configKey2?.trim();
      if (
        (token1 && authHeader.includes(token1)) ||
        (token2 && authHeader.includes(token2))
      ) {
        validSepayConfig = pm;
        break;
      }
    }

    if (!validSepayConfig) {
      this.logger.error('❌ Sai khóa bảo mật! Không có cấu hình SePay nào khớp với Request này.');
      throw new UnauthorizedException('Xác thực thất bại. Sai khóa bảo mật.');
    }

    // 1.2 Trích xuất dữ liệu từ SePay
    const transferType = payload.transferType || payload.type || 'in';
    if (transferType.toLowerCase() !== 'in') {
      return { success: true, message: 'Chỉ xử lý giao dịch nhận tiền (transferType = in).' };
    }

    const content = (payload.content || payload.code || payload.description || '').toString();
    const transferAmount = Number(payload.transferAmount || payload.amount || 0);
    const referenceCode = (payload.referenceCode || payload.transactionId || payload.id || `SEPAY-${Date.now()}`).toString();

    // 1.3 Tìm mã đơn hàng trong nội dung chuyển khoản (Hỗ trợ AVO, SW, TMP, AVR, ORD, POS và fix lỗi ngân hàng xóa dấu '-')
    const normalizedContent = content.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const pattern = /(AVO-?[A-Z0-9-]*|SW[0-9A-Z-]+|TMP-?[0-9A-Z-]+|AVR-?[0-9A-Z-]+|ORD-?[0-9A-Z-]+|POS-?[0-9A-Z-]+)/i;
    const match = content.toUpperCase().match(pattern);

    let orderCode: string | null = null;
    if (match) {
      let code = match[0].replace(/[^A-Z0-9-]/g, '');

      // Khôi phục dấu "-" nếu bị ngân hàng xóa bỏ
      if (code.startsWith('TMP') && !code.startsWith('TMP-')) {
        code = code.replace(/^TMP/, 'TMP-');
      }
      if (code.startsWith('AVR') && !code.startsWith('AVR-')) {
        code = code.replace(/^AVR/, 'AVR-');
      }
      if (code.startsWith('ORD') && !code.startsWith('ORD-')) {
        code = code.replace(/^ORD/, 'ORD-');
      }
      if (code.startsWith('POS') && !code.startsWith('POS-')) {
        code = code.replace(/^POS/, 'POS-');
      }
      orderCode = code;
    }

    // 1.4 Kiểm tra đơn hàng trong Database
    const order = await this.findMatchingOrder(orderCode, normalizedContent);

    if (!order) {
      this.logger.warn(`⚠️ Không tìm thấy đơn hàng phù hợp trong Database cho nội dung: "${content}"`);
      return { success: false, message: `Không tìm thấy đơn hàng tương ứng với nội dung "${content}" trong hệ thống.` };
    }

    this.logger.log(`🔍 Khớp thành công đơn hàng: ${order.orderCode} - Số tiền: ${transferAmount} VNĐ`);

    if (order.paymentStatus === 'PAID') {
      this.logger.log(`ℹ️ Đơn hàng ${order.orderCode} đã được thanh toán từ trước.`);
      return { success: true, message: 'Đơn hàng này đã được gạch nợ từ trước.', orderCode: order.orderCode };
    }

    const expectedAmount = Math.round(order.totalAmount);
    if (transferAmount < expectedAmount) {
      this.logger.error(`❌ Đơn hàng ${order.orderCode} chuyển THIẾU TIỀN! Cần: ${expectedAmount}, Nhận: ${transferAmount}`);
      return {
        success: false,
        message: `Số tiền chuyển không đủ. Cần: ${expectedAmount}đ, Thực nhận: ${transferAmount}đ.`,
      };
    }

    // 1.5 Cập nhật trạng thái đơn hàng sang PAID
    this.logger.log(`✅ Giao dịch hợp lệ! Gạch nợ thành công cho đơn hàng: ${order.orderCode}`);
    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        status: order.status === OrderStatus.PENDING ? OrderStatus.CONFIRMED : order.status,
        confirmedAt: order.confirmedAt || new Date(),
        transactionId: referenceCode,
        paymentMethod: 'SEPAY',
      },
    });

    // 1.6 Bắn thông báo realtime cho User
    const displayCode = order.orderCode || order.temporaryOrderCode || order.id;
    if (order.userId) {
      await this.notificationService.createNotification({
        userId: order.userId,
        title: 'Thanh toán thành công qua SePay VietQR!',
        content: `Đơn hàng ${displayCode} (${transferAmount.toLocaleString('vi-VN')}đ) đã được xác nhận thanh toán tự động. Nhà hàng đang chuẩn bị món ăn!`,
        type: 'ORDER',
        referenceId: displayCode,
        url: `/orders/${displayCode}`,
      });
    }

    // Gửi thông báo tới nhân viên chi nhánh qua NotificationEngine
    try {
      await this.notificationEngine.publishEvent({
        eventType: 'PAYMENT_SUCCESS',
        category: 'PAYMENT',
        priority: 1, // NORMAL
        branchId: order.branchId,
        entityId: order.id,
        subId: referenceCode,
        title: 'Thanh toán SePay thành công',
        message: `Đơn ${displayCode} đã được thanh toán ${transferAmount.toLocaleString('vi-VN')}₫ qua SePay VietQR (Mã GD: ${referenceCode}).`,
        actor: {
          name: 'SePay VietQR',
        },
        reference: {
          type: 'ORDER',
          id: order.id,
          url: `/admin/orders/${order.id}`,
        },
        metadata: {
          orderId: order.id,
          orderCode: displayCode,
          amount: transferAmount,
          transactionCode: referenceCode,
          paymentMethod: 'SEPAY',
        },
        requiredPermissions: ['orders.view', 'pos.payment.view'],
        appScopes: ['ADMIN', 'POS', 'WAITER'],
        legacyType: 'ORDER',
      });
    } catch (engineErr) {
      this.logger.error('Error publishing SePay PAYMENT_SUCCESS:', engineErr);
    }

    return {
      success: true,
      message: 'Đã gạch nợ tự động thành công qua SePay VietQR',
      orderCode: displayCode,
      transactionCode: referenceCode,
      amount: transferAmount,
    };
  }

  /**
   * 2. Lấy thông tin thanh toán SePay VietQR cho trang thanh toán Client
   */
  async getSepayPaymentConfig(orderCode: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderCode },
      include: {
        user: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ${orderCode}`);
    }

    // Kiểm tra quyền sở hữu đơn hàng nếu đã đăng nhập
    if (userId && order.userId && order.userId !== userId) {
      throw new UnauthorizedException('Bạn không có quyền truy cập vào trang thanh toán của đơn hàng này.');
    }

    // Tìm cấu hình SePay đang hoạt động
    const sepayMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        gatewayType: 'SEPAY',
        isActive: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    const bankCode = sepayMethod?.bankCode?.trim() || 'MB';
    const accountNumber = sepayMethod?.accountNumber?.trim() || 'SEPSUSHIWA';
    const accountName = (sepayMethod?.accountName?.trim() || 'AVORA RESTAURANT').toUpperCase();
    const amount = Math.round(order.totalAmount);
    const encodedAccountName = encodeURIComponent(accountName);
    const encodedAddInfo = encodeURIComponent(order.orderCode || order.temporaryOrderCode || order.id);

    const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodedAddInfo}&accountName=${encodedAccountName}`;

    // Format danh sách món ăn cho Dropdown
    const orderItems = (order.orderItems || []).map((item) => {
      let optionsText = item.optionsTextSnapshot || '';
      if (!optionsText && item.selectedOptions && item.selectedOptions.length > 0) {
        optionsText = item.selectedOptions.map((o) => o.nameAtSale || o.optionItem?.name).filter(Boolean).join(', ');
      }
      return {
        name: item.product?.name || 'Món ăn',
        optionsText,
        quantity: item.quantity,
        price: (item.priceAtSale || item.originalPriceAtSale || 0) * item.quantity,
      };
    });

    return {
      orderCode: order.orderCode,
      amount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      isPaid: order.paymentStatus === 'PAID' || order.status === OrderStatus.COMPLETED,
      qrUrl,
      bankCode,
      accountNumber,
      accountName,
      hasConfig: !!sepayMethod && !!sepayMethod.bankCode && !!sepayMethod.accountNumber,
      orderItems,
      subTotal: order.subTotal,
      shippingFee: order.shippingFee,
      discountAmount: order.discountAmount + order.shippingDiscount,
      pointsUsed: order.pointsUsed,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
    };
  }

  /**
   * 3. Kiểm tra trạng thái đơn hàng (Dùng cho Polling phía Client)
   */
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

  /**
   * Helper tìm đơn hàng phù hợp với cơ chế đa tầng (hỗ trợ trường hợp ngân hàng lọc bỏ dấu '-')
   */
  private async findMatchingOrder(orderCode: string | null, normalizedContent: string) {
    // Tầng 1: Khớp trực tiếp theo orderCode nếu regex nhận diện được
    if (orderCode) {
      const directMatch = await this.prisma.order.findFirst({
        where: {
          OR: [
            { orderCode },
            { orderCode: { contains: orderCode } },
            { id: orderCode },
          ],
        },
        include: {
          user: true,
          branch: true,
          orderItems: { include: { product: true } },
        },
      });
      if (directMatch) return directMatch;
    }

    // Tầng 2: Đối sánh chuỗi chuẩn hóa (bỏ dấu '-') với danh sách đơn hàng PENDING trong 48h
    if (normalizedContent.length >= 6) {
      const recentPendingOrders = await this.prisma.order.findMany({
        where: {
          paymentStatus: 'PENDING',
          createdAt: {
            gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
          },
        },
        include: {
          user: true,
          branch: true,
          orderItems: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const matched = recentPendingOrders.find((ord) => {
        const normOrderCode = (ord.orderCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const normTempCode = (ord.temporaryOrderCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return (
          (normOrderCode.length >= 6 && normalizedContent.includes(normOrderCode)) ||
          (normTempCode.length >= 6 && normalizedContent.includes(normTempCode))
        );
      });
      if (matched) return matched;
    }

    // Tầng 3: Trích xuất hậu tố mã đơn Online dạng ONLxxxxxx (ví dụ: ONL160926WGU)
    const onlMatch = normalizedContent.match(/ONL[0-9]{6}[A-Z0-9]{3}/i);
    if (onlMatch) {
      const onlOrder = await this.prisma.order.findFirst({
        where: {
          orderCode: { contains: onlMatch[0] },
        },
        include: {
          user: true,
          branch: true,
          orderItems: { include: { product: true } },
        },
      });
      if (onlOrder) return onlOrder;
    }

    return null;
  }
}

