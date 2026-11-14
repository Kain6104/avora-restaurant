import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Optional,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationEngineService } from '../notification/notification-engine.service';
import {
  buildOrderNotificationPayload,
  mapPriorityToNumeric,
} from '../notification/order-notification.helper';
import { OrderAuditService } from '../common/services/order-audit.service';
import { PosGateway } from '../pos/pos.gateway';

@Injectable()
export class PaymentMethodService {
  private readonly logger = new Logger(PaymentMethodService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    @Optional() private notificationEngine?: NotificationEngineService,
    @Optional() private posGateway?: PosGateway,
    @Optional() private orderAuditService?: OrderAuditService,
  ) {}

  /**
   * Lấy danh sách tất cả phương thức thanh toán cho Admin (kèm danh sách chi nhánh áp dụng)
   */
  async findAll() {
    return this.prisma.paymentMethod.findMany({
      include: {
        branches: {
          select: { id: true, name: true, branchCode: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Lấy danh sách phương thức thanh toán đang mở cho Client (Checkout)
   * Trả về tất cả phương thức áp dụng theo chi nhánh kèm điều kiện minOrderValue
   */
  async getActiveMethods(totalAmount?: number, branchId?: string) {
    const where: any = { isActive: true };

    if (branchId) {
      where.OR = [
        { isAllBranches: true },
        { branches: { some: { id: branchId } } },
      ];
    }

    const methods = await this.prisma.paymentMethod.findMany({
      where,
      include: {
        branches: {
          select: { id: true, name: true, branchCode: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return methods.map((m) => {
      const isEligible = typeof totalAmount === 'number' ? totalAmount >= m.minOrderValue : true;
      const remainingToMin = typeof totalAmount === 'number' ? Math.max(0, m.minOrderValue - totalAmount) : 0;
      return {
        id: m.id,
        code: m.methodCode,
        methodCode: m.methodCode,
        name: m.name,
        type: m.gatewayType,
        gatewayType: m.gatewayType,
        description: m.description,
        iconUrl: m.iconUrl,
        bankCode: m.bankCode,
        accountNumber: m.accountNumber,
        accountName: m.accountName,
        displayOrder: m.displayOrder,
        minOrderValue: m.minOrderValue,
        isAllBranches: m.isAllBranches,
        branches: m.branches,
        isEligible,
        remainingToMin,
      };
    });
  }

  /**
   * Tạo phương thức thanh toán mới với cấu hình chi nhánh và validate linh hoạt
   */
  async create(data: {
    methodCode: string;
    gatewayType: string;
    name: string;
    description?: string;
    iconUrl?: string;
    configId?: string;
    configKey1?: string;
    configKey2?: string;
    configKey3?: string;
    bankCode?: string;
    accountNumber?: string;
    accountName?: string;
    minOrderValue?: number;
    isAllBranches?: boolean;
    branchIds?: string[];
    isActive?: boolean;
    isActiveForPos?: boolean;
    isActiveForQr?: boolean;
    displayOrder?: number;
  }) {
    const { methodCode, gatewayType, name } = data;

    if (!methodCode || !gatewayType || !name) {
      throw new BadRequestException('Mã phương thức, loại cổng và tên hiển thị là bắt buộc.');
    }

    const existing = await this.prisma.paymentMethod.findUnique({
      where: { methodCode },
    });
    if (existing) {
      throw new BadRequestException(`Mã phương thức ${methodCode} đã tồn tại trong hệ thống.`);
    }

    // Validate theo loại cổng
    if (gatewayType === 'TRANSFER') {
      if (!data.bankCode || !data.accountNumber || !data.accountName) {
        throw new BadRequestException(
          'Với hình thức chuyển khoản ngân hàng, vui lòng nhập đầy đủ Mã ngân hàng, Số tài khoản và Tên chủ tài khoản.',
        );
      }
    }

    const isAllBranches = data.isAllBranches !== undefined ? Boolean(data.isAllBranches) : true;
    const branchConnect =
      !isAllBranches && data.branchIds && data.branchIds.length > 0
        ? { connect: data.branchIds.map((id) => ({ id })) }
        : undefined;

    return this.prisma.paymentMethod.create({
      data: {
        methodCode: methodCode.toUpperCase().trim(),
        gatewayType: gatewayType.toUpperCase().trim(),
        name: name.trim(),
        description: data.description || null,
        iconUrl: data.iconUrl || null,
        configId: data.configId || null,
        configKey1: data.configKey1 || null,
        configKey2: data.configKey2 || null,
        configKey3: data.configKey3 || null,
        bankCode: data.bankCode || null,
        accountNumber: data.accountNumber || null,
        accountName: data.accountName ? data.accountName.toUpperCase().trim() : null,
        minOrderValue: Number(data.minOrderValue || 0),
        isAllBranches,
        branches: branchConnect,
        isActive: Boolean(data.isActive),
        isActiveForPos: Boolean(data.isActiveForPos),
        isActiveForQr: Boolean(data.isActiveForQr),
        displayOrder: Number(data.displayOrder || 0),
      },
      include: {
        branches: { select: { id: true, name: true, branchCode: true } },
      },
    });
  }

  /**
   * Cập nhật phương thức thanh toán kèm danh sách chi nhánh
   */
  async update(id: string, data: any) {
    const method = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!method) {
      throw new NotFoundException('Không tìm thấy phương thức thanh toán');
    }

    const gatewayType = data.gatewayType || method.gatewayType;
    if (gatewayType === 'TRANSFER') {
      const bankCode = data.bankCode !== undefined ? data.bankCode : method.bankCode;
      const accountNumber = data.accountNumber !== undefined ? data.accountNumber : method.accountNumber;
      const accountName = data.accountName !== undefined ? data.accountName : method.accountName;

      if (!bankCode || !accountNumber || !accountName) {
        throw new BadRequestException(
          'Với hình thức chuyển khoản, Mã ngân hàng, Số tài khoản và Tên chủ tài khoản là bắt buộc.',
        );
      }
    }

    const {
      methodCode,
      gatewayType: gType,
      name,
      description,
      iconUrl,
      configId,
      configKey1,
      configKey2,
      configKey3,
      bankCode,
      accountNumber,
      accountName,
      minOrderValue,
      isActive,
      isActiveForPos,
      isActiveForQr,
      displayOrder,
    } = data;

    const isAllBranches = data.isAllBranches !== undefined ? Boolean(data.isAllBranches) : method.isAllBranches;
    let branchUpdate: any = undefined;
    if (data.branchIds !== undefined) {
      branchUpdate = {
        set: isAllBranches ? [] : data.branchIds.map((bid: string) => ({ id: bid })),
      };
    }

    return this.prisma.paymentMethod.update({
      where: { id },
      data: {
        methodCode: methodCode !== undefined ? methodCode.toUpperCase().trim() : undefined,
        gatewayType: gType !== undefined ? gType.toUpperCase().trim() : undefined,
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description : undefined,
        iconUrl: iconUrl !== undefined ? iconUrl : undefined,
        configId: configId !== undefined ? configId : undefined,
        configKey1: configKey1 !== undefined ? configKey1 : undefined,
        configKey2: configKey2 !== undefined ? configKey2 : undefined,
        configKey3: configKey3 !== undefined ? configKey3 : undefined,
        bankCode: bankCode !== undefined ? bankCode : undefined,
        accountNumber: accountNumber !== undefined ? accountNumber : undefined,
        accountName: accountName !== undefined ? accountName.toUpperCase().trim() : undefined,
        minOrderValue: minOrderValue !== undefined ? Number(minOrderValue) : undefined,
        isAllBranches,
        branches: branchUpdate,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        isActiveForPos: isActiveForPos !== undefined ? Boolean(isActiveForPos) : undefined,
        isActiveForQr: isActiveForQr !== undefined ? Boolean(isActiveForQr) : undefined,
        displayOrder: displayOrder !== undefined ? Number(displayOrder) : undefined,
      },
      include: {
        branches: { select: { id: true, name: true, branchCode: true } },
      },
    });
  }

  /**
   * Bật / tắt nhanh trạng thái isActive, isActiveForPos hoặc isActiveForQr
   */
  async toggleStatus(id: string, field: 'isActive' | 'isActiveForPos' | 'isActiveForQr') {
    if (!['isActive', 'isActiveForPos', 'isActiveForQr'].includes(field)) {
      throw new BadRequestException('Trường trạng thái không hợp lệ');
    }
    const method = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!method) {
      throw new NotFoundException('Không tìm thấy phương thức thanh toán');
    }

    const currentVal = method[field];
    return this.prisma.paymentMethod.update({
      where: { id },
      data: { [field]: !currentVal },
    });
  }

  /**
   * Xóa phương thức thanh toán
   */
  async delete(id: string) {
    const method = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!method) {
      throw new NotFoundException('Không tìm thấy phương thức thanh toán');
    }
    return this.prisma.paymentMethod.delete({ where: { id } });
  }

  private verifyPayosSignature(dataObj: Record<string, any>, signatureStr: string, checksumKey: string): boolean {
    try {
      const sortedKeys = Object.keys(dataObj || {}).sort();
      const dataQueryStr = sortedKeys
        .map((key) => {
          let val = dataObj[key];
          if (val === null || val === undefined || val === 'undefined' || val === 'null') {
            val = '';
          } else if (Array.isArray(val)) {
            val = JSON.stringify(val);
          }
          return `${key}=${val}`;
        })
        .join('&');
      const expected = createHmac('sha256', checksumKey).update(dataQueryStr).digest('hex');
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(String(signatureStr || '').trim(), 'utf8');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Webhook tiếp nhận thanh toán tự động từ PayOS / MoMo / SePay
   */
  async handleWebhook(payload: any, signature?: string) {
    this.logger.log('[PAYMENT WEBHOOK] Received callback');

    // 1. Xác thực chữ ký bảo mật nếu cổng PayOS / Gateway có cấu hình checksum key
    const incomingSignature = String(signature || payload?.signature || '').trim();
    const configuredPayos = await this.prisma.paymentMethod.findFirst?.({
      where: {
        methodCode: { in: ['PAYOS', 'PAY_OS'] },
        isActive: true,
      },
      select: { configKey2: true, configKey3: true, configKey1: true },
    });
    const checksumKey =
      configuredPayos?.configKey2 ||
      configuredPayos?.configKey3 ||
      process.env.PAYOS_CHECKSUM_KEY ||
      '';

    if (checksumKey) {
      if (!incomingSignature) {
        this.logger.warn('[PAYMENT WEBHOOK] Missing signature while checksumKey is configured');
        throw new UnauthorizedException('Thiếu chữ ký xác thực thanh toán');
      }
      const dataForSign = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
      const isValidPayos = this.verifyPayosSignature(dataForSign, incomingSignature, checksumKey);
      const rawHmac = createHmac('sha256', checksumKey)
        .update(JSON.stringify(payload || {}))
        .digest('hex');
      const isValidRaw =
        rawHmac.length === incomingSignature.length &&
        timingSafeEqual(Buffer.from(rawHmac, 'utf8'), Buffer.from(incomingSignature, 'utf8'));
      if (!isValidPayos && !isValidRaw) {
        this.logger.error('[PAYMENT WEBHOOK] Invalid webhook signature');
        throw new UnauthorizedException('Chữ ký webhook thanh toán không hợp lệ');
      }
    }

    let orderCode =
      payload?.data?.orderCode?.toString() ||
      payload?.orderCode?.toString() ||
      payload?.content?.toString() ||
      '';

    if (!orderCode && payload?.content) {
      const match = payload.content.match(/(ORD-[A-Z0-9]+|DH-[A-Z0-9]+|AVO-[A-Z0-9-]+|TMP-[A-Z0-9]+|[A-Z0-9]{8,})/i);
      if (match) orderCode = match[0];
    }

    if (!orderCode) {
      return { success: false, message: 'Missing orderCode in webhook payload' };
    }

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { orderCode: { contains: orderCode } },
          { temporaryOrderCode: orderCode },
          { id: orderCode },
        ],
      },
      include: { user: true, table: true },
    });

    if (!order) {
      this.logger.warn(`[PAYMENT WEBHOOK] Order not found for orderCode: ${orderCode}`);
      return { success: false, message: `Order not found for code ${orderCode}` };
    }

    const displayCode = order.orderCode || order.temporaryOrderCode || order.id;
    const isPayosPayload = Boolean(payload?.data?.paymentLinkId || payload?.signature || String(order.paymentMethod || '').toUpperCase() === 'PAYOS');
    const gatewayLabel = isPayosPayload ? 'PAYOS' : (order.paymentMethod || 'GATEWAY');

    // 2. Kiểm tra trạng thái thất bại / hủy từ cổng thanh toán
    const statusText = String(payload?.data?.status || payload?.status || '').toUpperCase();
    const isExplicitFail =
      payload?.success === false ||
      (payload?.code !== undefined && String(payload.code) !== '00') ||
      (payload?.data?.code !== undefined && String(payload.data.code) !== '00') ||
      ['CANCELLED', 'FAILED', 'EXPIRED', 'ERROR'].includes(statusText);

    if (isExplicitFail) {
      const failReason = payload?.desc || payload?.data?.desc || statusText || 'Giao dịch thất bại hoặc bị hủy';
      await this.recordFailedPayment(order, displayCode, gatewayLabel, failReason, payload);
      return { success: false, message: `Thanh toán thất bại: ${failReason}` };
    }

    if (order.paymentStatus === 'PAID') {
      return { success: true, message: 'Order already marked as PAID' };
    }

    // 3. Kiểm tra số tiền thực nhận chống thanh toán thiếu
    const paidAmountRaw = payload?.data?.amount ?? payload?.amount;
    const paidAmount = paidAmountRaw !== undefined && paidAmountRaw !== null ? Number(paidAmountRaw) : 0;
    const expectedAmount = Math.round(Number(order.totalAmount) || 0);
    if (expectedAmount > 0 && Number.isFinite(paidAmount) && paidAmount > 0 && paidAmount < expectedAmount) {
      const underpayReason = `Số tiền không đủ (Cần ${expectedAmount.toLocaleString('vi-VN')}₫, nhận ${paidAmount.toLocaleString('vi-VN')}₫)`;
      await this.recordFailedPayment(order, displayCode, gatewayLabel, underpayReason, payload);
      return { success: false, message: underpayReason };
    }

    const txRef = payload?.data?.paymentLinkId || payload?.data?.reference || payload?.transactionId || `WEBHOOK-${Date.now()}`;

    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        ...(order.status === OrderStatus.PENDING ? { status: OrderStatus.CONFIRMED, confirmedAt: new Date() } : {}),
        transactionId: txRef,
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
          actorName: gatewayLabel === 'PAYOS' ? 'PayOS' : gatewayLabel,
          branchId: order.branchId,
          oldValue: { paymentStatus: order.paymentStatus, status: order.status },
          newValue: {
            paymentStatus: 'PAID',
            status: updatedOrder.status,
            amount: paidAmount || expectedAmount,
            transactionId: txRef,
            gateway: gatewayLabel,
          },
        })
        .catch(() => {});
    }

    if (this.posGateway) {
      this.posGateway.emitPaymentCompleted(updatedOrder, {
        paymentMethod: gatewayLabel,
        amount: paidAmount || expectedAmount,
        transactionId: txRef,
      });
      this.posGateway.emitOrderUpdated(updatedOrder, undefined, updatedOrder.table?.name);
    }

    if (order.userId) {
      await this.notificationService.createNotification({
        userId: order.userId,
        title: 'Thanh toán thành công!',
        content: `Đơn hàng ${displayCode} của bạn đã được thanh toán thành công. Nhà hàng đang chuẩn bị món ăn cho bạn!`,
        type: 'ORDER',
        referenceId: displayCode,
        url: `/orders/${displayCode}`,
      });
    }

    if (this.notificationEngine) {
      const builtSuccess = buildOrderNotificationPayload({
        eventType: 'PAYMENT_SUCCESS',
        orderCode: displayCode,
        orderType: order.orderType,
        tableName: (order as any).table?.name,
        totalAmount: paidAmount || order.totalAmount || 0,
        paymentMethod: gatewayLabel,
        gateway: gatewayLabel,
      });
      this.notificationEngine
        .publishEvent({
          eventType: 'PAYMENT_SUCCESS',
          category: 'PAYMENT',
          priority: mapPriorityToNumeric(builtSuccess.priority),
          icon: builtSuccess.icon,
          branchId: order.branchId,
          entityId: order.id,
          subId: String(txRef),
          title: builtSuccess.title,
          message: builtSuccess.message,
          actor: { name: gatewayLabel === 'PAYOS' ? 'PayOS' : 'Cổng thanh toán' },
          reference: {
            type: 'ORDER',
            id: order.id,
            url: `/admin/orders/${order.id}`,
          },
          metadata: {
            orderId: order.id,
            orderCode: displayCode,
            amount: paidAmount || order.totalAmount || 0,
            transactionId: txRef,
            gateway: gatewayLabel,
          },
          requiredPermissions: ['orders.view', 'pos.payment.view', 'pos.access', 'waiter.access'],
          appScopes: ['ADMIN', 'POS', 'WAITER'],
          legacyType: 'ORDER',
        })
        .catch(() => {});
    }

    return {
      success: true,
      message: `Updated order ${displayCode} to PAID`,
      orderId: updatedOrder.id,
    };
  }

  private async recordFailedPayment(
    order: any,
    displayCode: string,
    gatewayLabel: string,
    reason: string,
    payload: any,
  ) {
    if (this.orderAuditService) {
      this.orderAuditService
        .log({
          orderId: order.id,
          orderCode: displayCode,
          action: 'PAYMENT_FAILED',
          category: 'PAYMENT',
          actorName: gatewayLabel === 'PAYOS' ? 'PayOS' : gatewayLabel,
          branchId: order.branchId,
          reason,
          newValue: {
            gateway: gatewayLabel,
            code: payload?.code || payload?.data?.code || null,
            status: payload?.data?.status || payload?.status || null,
          },
        })
        .catch(() => {});
    }

    if (this.notificationEngine) {
      const builtFail = buildOrderNotificationPayload({
        eventType: 'PAYMENT_FAILED',
        orderCode: displayCode,
        orderType: order.orderType,
        tableName: order?.table?.name,
        reason,
      });
      this.notificationEngine
        .publishEvent({
          eventType: 'PAYMENT_FAILED',
          category: 'PAYMENT',
          priority: mapPriorityToNumeric(builtFail.priority),
          icon: builtFail.icon,
          branchId: order.branchId,
          entityId: order.id,
          subId: `fail-${Date.now()}`,
          title: builtFail.title,
          message: builtFail.message,
          actor: { name: gatewayLabel === 'PAYOS' ? 'PayOS' : 'Cổng thanh toán' },
          reference: {
            type: 'ORDER',
            id: order.id,
            url: `/admin/orders/${order.id}`,
          },
          metadata: {
            orderId: order.id,
            orderCode: displayCode,
            gateway: gatewayLabel,
            reason,
          },
          requiredPermissions: ['orders.view', 'pos.payment.view', 'pos.payment.collect', 'waiter.access'],
          appScopes: ['ADMIN', 'POS', 'WAITER'],
          legacyType: 'ORDER',
        })
        .catch(() => {});
    }
  }
}
