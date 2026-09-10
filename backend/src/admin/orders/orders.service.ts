import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';
import { OrderService as CoreOrderService } from '../../order/order.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private coreOrderService: CoreOrderService
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

    // 2. Phân loại Tab & Loại bỏ các đơn POS chưa thanh toán
    if (tab === 'POS') {
      where.orderSource = 'POS';
      // Đơn POS phải đã thanh toán (loại bỏ đơn còn trong bàn/mang đi/giao hàng mà chưa thanh toán)
      where.OR = [
        { paymentStatus: 'PAID' },
        { status: OrderStatus.COMPLETED },
      ];
    } else if (tab === 'ONLINE') {
      // Đơn online: WEB, QR_ORDER, CHATBOT, VOICE, ADMIN...
      where.orderSource = { not: 'POS' };
    } else {
      // Tab ALL: hiển thị tất cả nhưng loại bỏ các đơn POS còn chưa thanh toán
      where.NOT = [
        {
          AND: [
            { orderSource: 'POS' },
            { paymentStatus: { not: 'PAID' } },
            { status: { not: OrderStatus.COMPLETED } },
          ],
        },
      ];
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
      const w: Prisma.OrderWhereInput = { ...baseWhere };
      if (t === 'POS') {
        w.orderSource = 'POS';
        w.OR = [{ paymentStatus: 'PAID' }, { status: OrderStatus.COMPLETED }];
      } else if (t === 'ONLINE') {
        w.orderSource = { not: 'POS' };
      } else {
        w.NOT = [
          {
            AND: [
              { orderSource: 'POS' },
              { paymentStatus: { not: 'PAID' } },
              { status: { not: OrderStatus.COMPLETED } },
            ],
          },
        ];
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
    const branchWhere: any = { isActive: true };
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
            product: { select: { name: true, price: true, imageUrl: true } },
          },
        },
        branch: { select: { name: true, street: true, ward: true, district: true, province: true, pointRedeemRate: true } },
        table: { select: { id: true, name: true, area: { select: { name: true } } } },
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        voucher: { select: { code: true, title: true, discountType: true, discountValue: true } },
        shippingVoucher: { select: { code: true, title: true, discountType: true, discountValue: true } },
        serviceCharges: true,
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

    return order;
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
      return this.coreOrderService.cancelOrder(order.userId, order.orderCode || order.temporaryOrderCode || '', 'Hủy bởi Admin', true);
    }

    return this.coreOrderService.updateOrderStatus(order.id, status, 'ADMIN');
  }

  async updatePaymentStatus(id: string, paymentStatus: string, branchIdScope?: string) {
    const order = await this.findOne(id, branchIdScope);

    // Chống gian lận: Nếu đơn hàng đã được SePay tự động xác nhận tiền về tài khoản ngân hàng, KHÔNG CHO PHÉP SỬA THỦ CÔNG!
    if (order.paymentMethod === 'SEPAY' && order.paymentStatus === 'PAID' && paymentStatus !== 'PAID') {
      throw new ForbiddenException(
        'Đơn hàng này đã được hệ thống SePay tự động xác nhận tiền về tài khoản ngân hàng. Nghiêm cấm nhân viên sửa đổi thủ công trạng thái thanh toán để tránh gian lận, thất thoát!',
      );
    }

    return this.prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus },
    });
  }
}
