import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationEngineService } from '../notification/notification-engine.service';
import {
  buildOrderNotificationPayload,
  mapPriorityToNumeric,
} from '../notification/order-notification.helper';
import { OrderAuditService } from '../common/services/order-audit.service';
import { PosGateway } from '../pos/pos.gateway';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class SepayService {
  private readonly logger = new Logger(SepayService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private notificationEngine: NotificationEngineService,
    @Optional() private orderAuditService?: OrderAuditService,
    @Optional() private posGateway?: PosGateway,
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

    const displayCode = order.orderCode || order.temporaryOrderCode || order.id;
    const expectedAmount = Math.round(order.totalAmount);
    if (transferAmount < expectedAmount) {
      const underpayReason = `Chuyển thiếu tiền: cần ${expectedAmount.toLocaleString('vi-VN')}₫, nhận ${transferAmount.toLocaleString('vi-VN')}₫`;
      this.logger.error(`❌ Đơn hàng ${displayCode} chuyển THIẾU TIỀN! Cần: ${expectedAmount}, Nhận: ${transferAmount}`);

      if (this.orderAuditService) {
        this.orderAuditService
          .log({
            orderId: order.id,
            orderCode: displayCode,
            action: 'PAYMENT_FAILED',
            category: 'PAYMENT',
            actorName: 'SePay VietQR',
            branchId: order.branchId,
            reason: underpayReason,
            newValue: {
              expectedAmount,
              receivedAmount: transferAmount,
              transactionCode: referenceCode,
              gateway: 'SEPAY',
            },
          })
          .catch(() => {});
      }

      const builtFail = buildOrderNotificationPayload({
        eventType: 'PAYMENT_FAILED',
        orderCode: displayCode,
        orderType: order.orderType,
        tableName: (order as any).table?.name,
        reason: underpayReason,
      });
      await this.notificationEngine
        ?.publishEvent?.({
          eventType: 'PAYMENT_FAILED',
          category: 'PAYMENT',
          priority: mapPriorityToNumeric(builtFail.priority),
          icon: builtFail.icon,
          branchId: order.branchId,
          entityId: order.id,
          subId: `fail-${referenceCode || Date.now()}`,
          title: builtFail.title,
          message: builtFail.message,
          actor: { name: 'SePay VietQR' },
          reference: {
            type: 'ORDER',
            id: order.id,
            url: `/admin/orders/${order.id}`,
          },
          metadata: {
            orderId: order.id,
            orderCode: displayCode,
            expectedAmount,
            receivedAmount: transferAmount,
            transactionCode: referenceCode,
            paymentMethod: 'SEPAY',
          },
          requiredPermissions: ['orders.view', 'pos.payment.view', 'pos.payment.collect', 'waiter.access'],
          appScopes: ['ADMIN', 'POS', 'WAITER'],
          legacyType: 'ORDER',
        })
        ?.catch?.(() => {});

      return {
        success: false,
        message: `Số tiền chuyển không đủ. Cần: ${expectedAmount}đ, Thực nhận: ${transferAmount}đ.`,
      };
    }

    // 1.5 Cập nhật trạng thái đơn hàng sang PAID
    this.logger.log(`✅ Giao dịch hợp lệ! Gạch nợ thành công cho đơn hàng: ${displayCode}`);
    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        status: order.status === OrderStatus.PENDING ? OrderStatus.CONFIRMED : order.status,
        confirmedAt: order.confirmedAt || new Date(),
        transactionId: referenceCode,
        paymentMethod: 'SEPAY',
      },
      include: {
        table: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: { include: { optionItem: true } },
          },
        },
      },
    });

    if (this.orderAuditService) {
      this.orderAuditService
        .log({
          orderId: order.id,
          orderCode: displayCode,
          action: 'PAYMENT_CONFIRMED',
          category: 'PAYMENT',
          actorName: 'SePay VietQR',
          branchId: order.branchId,
          oldValue: { paymentStatus: order.paymentStatus, status: order.status },
          newValue: {
            paymentStatus: 'PAID',
            status: updatedOrder.status,
            paymentMethod: 'SEPAY',
            amount: transferAmount,
            transactionCode: referenceCode,
          },
        })
        .catch(() => {});
    }

    if (this.posGateway) {
      this.posGateway.emitPaymentCompleted(
        updatedOrder,
        { paymentMethod: 'SEPAY', amount: transferAmount, transactionId: referenceCode },
      );
      this.posGateway.emitOrderUpdated(updatedOrder, undefined, updatedOrder.table?.name);
    }

    // 1.6 Bắn thông báo realtime cho User
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
      const builtSuccess = buildOrderNotificationPayload({
        eventType: 'PAYMENT_SUCCESS',
        orderCode: displayCode,
        orderType: updatedOrder.orderType,
        tableName: updatedOrder.table?.name,
        totalAmount: transferAmount,
        paymentMethod: 'SEPAY',
        gateway: 'SEPAY',
      });
      await this.notificationEngine?.publishEvent?.({
        eventType: 'PAYMENT_SUCCESS',
        category: 'PAYMENT',
        priority: mapPriorityToNumeric(builtSuccess.priority),
        icon: builtSuccess.icon,
        branchId: order.branchId,
        entityId: order.id,
        subId: referenceCode,
        title: builtSuccess.title,
        message: builtSuccess.message,
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
        requiredPermissions: ['orders.view', 'pos.payment.view', 'pos.access', 'waiter.access'],
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
    let order = await this.prisma.order.findUnique({
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

    if (!order && typeof (this.prisma.order as any).findFirst === 'function') {
      order = await this.prisma.order.findFirst({
        where: {
          OR: [{ temporaryOrderCode: orderCode }, { id: orderCode }],
        },
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
    }

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ${orderCode}`);
    }

    // Kiểm tra quyền sở hữu đơn hàng nếu đã đăng nhập
    if (userId && order.userId && order.userId !== userId) {
      throw new UnauthorizedException('Bạn không có quyền truy cập vào trang thanh toán của đơn hàng này.');
    }

    // Tìm cấu hình chuyển khoản đang bật (TRANSFER / SEPAY / BANK_TRANSFER / VIETQR) trong DB
    const sepayMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        isActive: true,
        gatewayType: { in: ['TRANSFER', 'SEPAY', 'BANK_TRANSFER', 'VIETQR'] },
        bankCode: { not: null },
        accountNumber: { not: null },
      },
      orderBy: { displayOrder: 'asc' },
    });

    const bankCode = sepayMethod?.bankCode?.trim() || '';
    const accountNumber = sepayMethod?.accountNumber?.trim() || '';
    const accountName = (sepayMethod?.accountName?.trim() || 'AVORA RESTAURANT').toUpperCase();
    const hasValidBankConfig = Boolean(sepayMethod && bankCode && accountNumber);
    const amount = Math.round(order.totalAmount);
    if (amount <= 0 && (!order.orderItems || order.orderItems.length === 0)) {
      throw new BadRequestException('Không thể phát sinh mã thanh toán cho đơn hàng rỗng (0 món, 0đ)');
    }
    const isPaid = order.paymentStatus === 'PAID' || order.status === OrderStatus.COMPLETED;
    if (!isPaid && !order.paymentIntentCode) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentIntentCode: order.orderCode || order.temporaryOrderCode || order.id,
          paymentIntentAmount: amount,
          paymentIntentMethod: 'TRANSFER',
          paymentIntentCreatedAt: new Date(),
        },
      });
    }
    const encodedAccountName = encodeURIComponent(accountName);
    const displayOrderCode = order.orderCode || order.temporaryOrderCode || order.id;
    const encodedAddInfo = encodeURIComponent(displayOrderCode);

    const qrUrl = hasValidBankConfig
      ? `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodedAddInfo}&accountName=${encodedAccountName}`
      : '';

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
      orderCode: displayOrderCode,
      transferContent: displayOrderCode,
      amount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      isPaid: order.paymentStatus === 'PAID' || order.status === OrderStatus.COMPLETED,
      qrUrl,
      bankCode,
      accountNumber,
      accountName,
      hasConfig: hasValidBankConfig,
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
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { orderCode },
          { temporaryOrderCode: orderCode },
          { id: orderCode },
        ],
      },
      select: {
        id: true,
        orderCode: true,
        temporaryOrderCode: true,
        status: true,
        paymentStatus: true,
        transactionId: true,
        totalAmount: true,
        payments: {
          select: {
            id: true,
            paymentMethod: true,
            amount: true,
            status: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ${orderCode}`);
    }

    const completedPayments = (order.payments || []).filter(
      (p) => p.status === 'COMPLETED' || (p.status as any) === 'PAID',
    );
    const totalPaid = completedPayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );
    const orderTotal = Number(order.totalAmount || 0);

    const isPaid =
      order.paymentStatus === 'PAID' ||
      order.status === OrderStatus.COMPLETED ||
      (orderTotal > 0 && totalPaid >= orderTotal);

    const hasTransferPayment = completedPayments.some((p) =>
      ['BANK_TRANSFER', 'QR_CODE', 'SEPAY', 'VIETQR', 'VCB', 'TRANSFER'].includes(p.paymentMethod),
    );

    return {
      orderCode: order.orderCode || order.temporaryOrderCode || order.id,
      realOrderCode: order.orderCode,
      temporaryOrderCode: order.temporaryOrderCode,
      status: isPaid ? 'PAID' : order.status,
      rawStatus: order.status,
      paymentStatus: order.paymentStatus,
      isPaid,
      hasTransferPayment,
      totalPaid,
      totalAmount: orderTotal,
      transactionCode: order.transactionId,
    };
  }

  /**
   * Helper tìm đơn hàng phù hợp với cơ chế đa tầng (hỗ trợ trường hợp ngân hàng lọc bỏ dấu '-')
   */
  async cancelPayment(orderCode: string, reason = 'Khách hàng hủy thanh toán') {
    const order = await this.prisma.order.findFirst({ where: { OR: [{ orderCode }, { temporaryOrderCode: orderCode }, { id: orderCode }] } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    const updated = await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED, cancelReason: reason, canceledAt: new Date(), paymentStatus: 'CANCELLED', paymentIntentStatus: 'CANCELLED' } });
    return { success: true, message: 'Đã hủy thanh toán thành công', orderCode: updated.orderCode || orderCode, status: 'CANCELLED' };
  }

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

