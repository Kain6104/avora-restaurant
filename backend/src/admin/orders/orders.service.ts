import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
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
    search?: string;
    status?: OrderStatus;
    paymentStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    branchIdScope?: string;
  }) {
    const { skip = 0, take = 10, search, status, paymentStatus, dateFrom, dateTo, branchIdScope } = params;
    
    const where: any = {};
    
    if (branchIdScope) {
      where.branchId = branchIdScope;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }
    
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { orderCode: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { user: { email: { contains: search } } },
        { user: { fullName: { contains: search } } },
        { user: { phone: { contains: search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        skip,
        take,
        where,
        include: {
          branch: { select: { name: true } },
          user: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: Math.floor(skip / take) + 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      }
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
            product: { select: { name: true, price: true, imageUrl: true } }
          }
        },
        branch: { select: { name: true, street: true, ward: true, district: true, province: true } },
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        voucher: { select: { code: true, discountType: true, discountValue: true } }
      }
    });
    
    if (!order) {
      throw new NotFoundException('Order not found or access denied');
    }
    
    if (!order.isViewedByAdmin) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { isViewedByAdmin: true }
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
      return this.coreOrderService.cancelOrder(order.userId, order.orderCode, 'Hủy bởi Admin', true);
    }

    return this.coreOrderService.updateOrderStatus(order.id, status, 'ADMIN');
  }

  async updatePaymentStatus(id: string, paymentStatus: string, branchIdScope?: string) {
    const order = await this.findOne(id, branchIdScope);
    
    return this.prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus }
    });
  }
}
