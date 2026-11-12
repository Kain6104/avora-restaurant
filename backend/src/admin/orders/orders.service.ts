import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';
import { OrderService as CoreOrderService } from '../../order/order.service';
import { OrderAuditService } from '../../common/services/order-audit.service';
import { OrderEditabilityPolicy } from '../../common/policies/order-editability.policy';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private coreOrderService: CoreOrderService,
    private orderAuditService: OrderAuditService,
  ) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    tab?: 'ALL' | 'POS' | 'ONLINE';
    branchId?: string;
    branchIdScope?: string;
    search?: string;
    status?: OrderStatus;
    paymentStatus?: string;
    paymentMethod?: string;
    isInvoiceRequested?: boolean;
    cashierName?: string;
    sortBy?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const {
      skip = 0,
      take = 10,
      tab = 'ALL',
      branchId,
      branchIdScope,
      search,
      status,
      paymentStatus,
      paymentMethod,
      isInvoiceRequested,
      cashierName,
      sortBy = 'date_desc',
      dateFrom,
      dateTo,
    } = params;

    const where: Prisma.OrderWhereInput = {};

    // 1. Phân quyền chi nhánh
    if (branchIdScope) {
      where.branchId = branchIdScope;
    } else if (branchId && branchId !== 'ALL') {
      where.branchId = branchId;
    }

    // 2. Phân loại Tab (Hiển thị đầy đủ cả đơn POS đang phục vụ, đã thanh toán và đã hủy)
    where.isDeleted = false;
    if (tab === 'POS') {
      where.orderSource = 'POS';
    } else if (tab === 'ONLINE') {
      // Đơn online: WEB, QR_ORDER, CHATBOT, VOICE, ADMIN...
      where.orderSource = { not: 'POS' };
    }

    // 3. Trạng thái đơn hàng
    if (status) {
      where.status = status;
    }

    // 4. Trạng thái thanh toán
    if (paymentStatus && paymentStatus !== 'ALL') {
      where.paymentStatus = paymentStatus;
    }

    // 5. Phương thức thanh toán
    if (paymentMethod && paymentMethod !== 'ALL') {
      where.paymentMethod = paymentMethod;
    }

    // 6. Trạng thái yêu cầu xuất HĐĐT (YCXHĐCT)
    if (isInvoiceRequested !== undefined) {
      where.isInvoiceRequested = isInvoiceRequested;
    }

    // 7. Thu ngân
    if (cashierName && cashierName !== 'ALL') {
      where.cashierName = { contains: cashierName };
    }

    // 8. Khoảng thời gian
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        const fromD = new Date(dateFrom);
        fromD.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromD;
      }
      if (dateTo) {
        const toD = new Date(dateTo);
        toD.setHours(23, 59, 59, 999);
        where.createdAt.lte = toD;
      }
    }

    // 9. Tìm kiếm từ khóa
    if (search && search.trim()) {
      const q = search.trim();
      where.AND = where.AND || [];
      const andList = Array.isArray(where.AND) ? where.AND : [where.AND];
      andList.push({
        OR: [
          { orderCode: { contains: q } },
          { temporaryOrderCode: { contains: q } },
          { customerName: { contains: q } },
          { customerPhone: { contains: q } },
          { cashierName: { contains: q } },
          { user: { email: { contains: q } } },
          { user: { fullName: { contains: q } } },
          { user: { phone: { contains: q } } },
        ],
      });
      where.AND = andList;
    }

    // 10. Sắp xếp
    let orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy === 'amount_desc') {
      orderBy = { totalAmount: 'desc' };
    } else if (sortBy === 'amount_asc') {
      orderBy = { totalAmount: 'asc' };
    } else if (sortBy === 'date_asc') {
      orderBy = { createdAt: 'asc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        skip,
        take,
        where,
        include: {
          branch: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          table: { select: { id: true, name: true } },
        },
        orderBy,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: Math.floor(skip / take) + 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  async getStatusCounts(params: {
    tab?: 'ALL' | 'POS' | 'ONLINE';
    branchId?: string;
    branchIdScope?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { tab = 'ALL', branchId, branchIdScope, dateFrom, dateTo } = params;
    const baseWhere: Prisma.OrderWhereInput = {};

    if (branchIdScope) {
      baseWhere.branchId = branchIdScope;
    } else if (branchId && branchId !== 'ALL') {
      baseWhere.branchId = branchId;
    }

    if (dateFrom || dateTo) {
      baseWhere.createdAt = {};
      if (dateFrom) {
        const fromD = new Date(dateFrom);
        fromD.setHours(0, 0, 0, 0);
        baseWhere.createdAt.gte = fromD;
      }
      if (dateTo) {
        const toD = new Date(dateTo);
        toD.setHours(23, 59, 59, 999);
        baseWhere.createdAt.lte = toD;
      }
    }

    // Helper build tab condition
    const buildTabWhere = (t: string): Prisma.OrderWhereInput => {
      const w: Prisma.OrderWhereInput = { ...baseWhere, isDeleted: false };
      if (t === 'POS') {
        w.orderSource = 'POS';
      } else if (t === 'ONLINE') {
        w.orderSource = { not: 'POS' };
      }
      return w;
    };

    const currentTabWhere = buildTabWhere(tab);

    const [
      pending,
      confirmed,
      preparing,
      delivering,
      completed,
      cancelled,
      totalAll,
      totalPos,
      totalOnline,
    ] = await Promise.all([
      this.prisma.order.count({ where: { ...currentTabWhere, status: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { ...currentTabWhere, status: OrderStatus.CONFIRMED } }),
      this.prisma.order.count({ where: { ...currentTabWhere, status: OrderStatus.PREPARING } }),
      this.prisma.order.count({ where: { ...currentTabWhere, status: OrderStatus.DELIVERING } }),
      this.prisma.order.count({ where: { ...currentTabWhere, status: OrderStatus.COMPLETED } }),
      this.prisma.order.count({ where: { ...currentTabWhere, status: OrderStatus.CANCELLED } }),
      this.prisma.order.count({ where: buildTabWhere('ALL') }),
      this.prisma.order.count({ where: buildTabWhere('POS') }),
      this.prisma.order.count({ where: buildTabWhere('ONLINE') }),
    ]);

    return {
      PENDING: pending,
      CONFIRMED: confirmed,
      PREPARING: preparing,
      DELIVERING: delivering,
      COMPLETED: completed,
      CANCELLED: cancelled,
      tabCounts: {
        ALL: totalAll,
        POS: totalPos,
        ONLINE: totalOnline,
      },
    };
  }

  async getFilterOptions(branchIdScope?: string) {
    const branchWhere: any = {};
    if (branchIdScope) branchWhere.id = branchIdScope;

    const [branches, cashiersRaw, paymentMethods] = await Promise.all([
      this.prisma.branch.findMany({
        where: branchWhere,
        select: { id: true, name: true, branchCode: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.order.findMany({
        where: {
          cashierName: { not: null },
          ...(branchIdScope ? { branchId: branchIdScope } : {}),
        },
        select: { cashierName: true },
        distinct: ['cashierName'],
      }),
      this.prisma.paymentMethod.findMany({
        select: { id: true, name: true, methodCode: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    const cashiers = cashiersRaw
      .map((c) => c.cashierName?.trim())
      .filter((name): name is string => Boolean(name && name.length > 0));

    return {
      branches,
      cashiers: Array.from(new Set(cashiers)),
      paymentMethods,
    };
  }

  async findOne(id: string, branchIdScope?: string) {
    const where: any = { id };
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        orderItems: {
          include: {
            product: { select: { id: true, name: true, price: true, imageUrl: true, slug: true } },
          },
        },
        branch: { select: { name: true, street: true, ward: true, district: true, province: true, pointRedeemRate: true } },
        table: { select: { id: true, name: true, area: { select: { name: true } } } },
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        voucher: { select: { code: true, title: true, discountType: true, discountValue: true } },
        shippingVoucher: { select: { code: true, title: true, discountType: true, discountValue: true } },
        serviceCharges: true,
        payments: {
          include: { refunds: true },
          orderBy: { createdAt: 'desc' },
        },
        cancellation: {
          include: { refunds: true },
        },
        bankTransactions: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found or access denied');
    }

    if (!order.isViewedByAdmin) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { isViewedByAdmin: true },
      });
      order.isViewedByAdmin = true;
    }

    // Resolve actor snapshots from User table if missing
    let creatorInfo: any = null;
    let cancellerInfo: any = null;
    let modifierInfo: any = null;
    let cashierInfo: any = null;

    const userIdsToLookup = [
      order.userId,
      order.createdById,
      order.canceledBy,
      order.updatedById,
      order.cashierId,
    ].filter((uid): uid is string => Boolean(uid && uid.length > 10 && uid !== 'POS_STAFF' && uid !== 'CUSTOMER'));

    if (userIdsToLookup.length > 0) {
      const resolvedUsers = await this.prisma.user.findMany({
        where: { id: { in: Array.from(new Set(userIdsToLookup)) } },
        select: { id: true, fullName: true, email: true, role: true, avatarUrl: true, branchId: true },
      });
      const uMap = new Map(resolvedUsers.map((u) => [u.id, u]));

      const cId = order.createdById || order.userId;
      if (cId && uMap.has(cId)) creatorInfo = uMap.get(cId);

      if (order.canceledBy && uMap.has(order.canceledBy)) cancellerInfo = uMap.get(order.canceledBy);
      if (order.updatedById && uMap.has(order.updatedById)) modifierInfo = uMap.get(order.updatedById);
      if (order.cashierId && uMap.has(order.cashierId)) cashierInfo = uMap.get(order.cashierId);
    }

    const editability = OrderEditabilityPolicy.evaluate(order);

    return {
      ...order,
      creatorInfo: creatorInfo || (order.createdByName ? { fullName: order.createdByName, role: order.createdByRole } : null),
      cancellerInfo: cancellerInfo || (order.canceledByName ? { fullName: order.canceledByName, role: order.canceledByRole } : null),
      modifierInfo: modifierInfo || (order.updatedByName ? { fullName: order.updatedByName } : null),
      cashierInfo: cashierInfo || (order.cashierName ? { fullName: order.cashierName } : null),
      editability,
    };
  }

  async getTimeline(id: string, branchIdScope?: string, category?: string) {
    const order = await this.findOne(id, branchIdScope);
    return this.orderAuditService.getTimeline(order.id, { category, includeSensitive: true });
  }

  async cancelOrder(
    id: string,
    reason: string,
    actor: { id: string; fullName?: string; email?: string; role?: string },
    branchIdScope?: string,
  ) {
    const order = await this.findOne(id, branchIdScope);
    return this.coreOrderService.cancelOrder(
      order.orderCode || order.temporaryOrderCode || order.id,
      reason,
      { kind: 'ADMIN', user: actor },
    );
  }

  async deletePermanently(
    id: string,
    reason: string,
    confirmOrderCode: string,
    actor: { id: string; fullName?: string; email?: string; role?: string },
    branchIdScope?: string,
  ) {
    throw new BadRequestException(
      'Thao tác xóa vĩnh viễn đã bị vô hiệu hóa khỏi quy trình vận hành hệ thống AVORA để đảm bảo tính toàn vẹn dữ liệu tài chính và kiểm toán. ' +
      'Vui lòng sử dụng tính năng "HỦY ĐƠN CHƯA THANH TOÁN" đối với đơn chưa thu tiền, hoặc "HỦY HÓA ĐƠN ĐÃ THANH TOÁN" đối với đơn đã thu tiền.',
    );
  }

  async restoreOrder(
    id: string,
    actor: { id: string; fullName?: string; email?: string; role?: string },
    branchIdScope?: string,
  ) {
    const order = await this.findOne(id, branchIdScope);
    if (!order.isDeleted) {
      throw new BadRequestException('Đơn hàng không ở trạng thái bị xóa');
    }

    const actualCode = order.orderCode || order.temporaryOrderCode;

    return await this.prisma.$transaction(async (tx) => {
      const res = await tx.order.update({
        where: { id: order.id },
        data: {
          isDeleted: false,
          restoredAt: new Date(),
          restoredBy: actor.id,
          restoredByName: actor.fullName || actor.email,
        },
      });

      await this.orderAuditService.log(
        {
          orderId: order.id,
          orderCode: actualCode,
          action: 'ORDER_RESTORED',
          category: 'ADMIN',
          actorId: actor.id,
          actorName: actor.fullName || actor.email,
          actorRole: actor.role || 'ADMIN',
          branchId: order.branchId,
          reason: 'Khôi phục đơn hàng từ trạng thái lưu trữ',
          oldValue: { isDeleted: true },
          newValue: { isDeleted: false },
        },
        tx,
      );

      return res;
    });
  }

  async getUnreadCount(branchIdScope?: string) {
    const where: any = {
      isViewedByAdmin: false,
    };
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }
    return this.prisma.order.count({ where });
  }

  async updateStatus(id: string, status: OrderStatus, branchIdScope?: string) {
    const order = await this.findOne(id, branchIdScope);

    if (status === 'CANCELLED') {
      return this.coreOrderService.cancelOrder(
        order.orderCode || order.temporaryOrderCode || '',
        'Hủy bởi Admin',
        { kind: 'ADMIN' },
      );
    }

    return this.coreOrderService.updateOrderStatus(order.id, status, 'ADMIN');
  }

  async updatePaymentStatus(id: string, paymentStatus: string, branchIdScope?: string) {
    const order = await this.findOne(id, branchIdScope);

    // Chống gian lận: Nếu đơn hàng đã được SePay tự động xác nhận tiền về tài khoản ngân hàng, KHÔNG CHO PHÉP SỬA THỦ CÔNG!
    const isGatewayPaid = order.paymentStatus === 'PAID' && (['SEPAY', 'TRANSFER', 'BANK_TRANSFER', 'VNPAY', 'MOMO', 'PAYOS'].includes((order.paymentMethod || '').toUpperCase()) || Boolean(order.transactionId));
    if (isGatewayPaid && paymentStatus !== 'PAID') {
      throw new ForbiddenException(
        'Đơn hàng này đã được hệ thống Bank Gateway / Ngân hàng tự động xác nhận tiền về tài khoản. Đã khóa bảo mật nghiêm ngặt để bảo vệ dữ liệu doanh thu và chống gian lận!',
      );
    }

    return this.prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus },
    });
  }
}
