import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class PaymentMethodService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
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
        ...m,
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
        displayOrder: displayOrder !== undefined ? Number(displayOrder) : undefined,
      },
      include: {
        branches: { select: { id: true, name: true, branchCode: true } },
      },
    });
  }

  /**
   * Bật / tắt nhanh trạng thái isActive hoặc isActiveForPos
   */
  async toggleStatus(id: string, field: 'isActive' | 'isActiveForPos') {
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

  /**
   * Webhook tiếp nhận thanh toán tự động từ PayOS / MoMo / SePay
   */
  async handleWebhook(payload: any, signature?: string) {
    console.log('\n=== [PAYMENT WEBHOOK] Received callback ===', JSON.stringify(payload));

    let orderCode =
      payload?.data?.orderCode?.toString() ||
      payload?.orderCode?.toString() ||
      payload?.content?.toString() ||
      '';

    if (!orderCode && payload?.content) {
      const match = payload.content.match(/(ORD-[A-Z0-9]+|DH-[A-Z0-9]+|[A-Z0-9]{8,})/i);
      if (match) orderCode = match[0];
    }

    if (!orderCode) {
      return { success: false, message: 'Missing orderCode in webhook payload' };
    }

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { orderCode: { contains: orderCode } },
          { id: orderCode },
        ],
      },
      include: { user: true },
    });

    if (!order) {
      console.warn(`[PAYMENT WEBHOOK] Order not found for orderCode: ${orderCode}`);
      return { success: false, message: `Order not found for code ${orderCode}` };
    }

    if (order.paymentStatus === 'PAID') {
      return { success: true, message: 'Order already marked as PAID' };
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        transactionId: payload?.data?.paymentLinkId || payload?.transactionId || `WEBHOOK-${Date.now()}`,
      },
    });

    const displayCode = order.orderCode || order.temporaryOrderCode || order.id;
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

    return {
      success: true,
      message: `Updated order ${displayCode} to PAID`,
      orderId: updatedOrder.id,
    };
  }
}
