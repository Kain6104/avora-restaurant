import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PromotionService {
  constructor(private prisma: PrismaService) {}

  async getCurrentFlashSale() {
    const now = new Date();
    const flashSale = await this.prisma.flashSale.findFirst({
      where: {
        isActive: true,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              }
            }
          }
        }
      }
    });

    if (!flashSale) return null;

    // Tính thời gian còn lại (số giây)
    const countdown = Math.max(0, Math.floor((flashSale.endTime.getTime() - now.getTime()) / 1000));
    
    // Đếm số lượng đã bán thực tế từ các OrderItem không bị Hủy (CANCELLED)
    const itemsWithActualSold = await Promise.all(flashSale.items.map(async (item) => {
      const soldAggregate = await this.prisma.orderItem.aggregate({
        where: {
          productId: item.productId,
          flashSaleId: flashSale.id,
          order: {
            status: { not: 'CANCELLED' }
          }
        },
        _sum: { quantity: true }
      });
      const actualSold = soldAggregate._sum.quantity || 0;
      return {
        ...item,
        sold: actualSold // Ghi đè trường sold từ DB bằng giá trị tính toán thực tế
      };
    }));

    return {
      ...flashSale,
      items: itemsWithActualSold,
      countdown
    };
  }

  async enrichProductsWithFlashSale(products: any[]) {
    if (!products || products.length === 0) return products;
    
    const activeFlashSale = await this.getCurrentFlashSale();
    if (!activeFlashSale) return products;

    const flashSaleMap = new Map();
    for (const item of activeFlashSale.items) {
      flashSaleMap.set(item.productId, item);
    }

    return products.map(p => {
      const fsItem = flashSaleMap.get(p.id);
      if (fsItem) {
        return {
          ...p,
          flashSalePrice: fsItem.flashSalePrice,
          flashSaleId: activeFlashSale.id,
          flashSaleStock: fsItem.stock,
          flashSaleSold: fsItem.sold,
          maxQuantityPerUser: fsItem.maxQuantityPerUser
        };
      }
      return p;
    });
  }

  async getFlashSaleQuota(userId: string) {
    const activeFlashSale = await this.getCurrentFlashSale();
    if (!activeFlashSale) return {};

    const quotaMap: Record<string, number> = {};

    for (const item of activeFlashSale.items) {
      const overallAvailable = Math.max(0, item.stock - item.sold);
      let userAvailable = overallAvailable;

      if (item.maxQuantityPerUser) {
        const pastOrders = await this.prisma.orderItem.aggregate({
          where: {
            productId: item.productId,
            flashSaleId: activeFlashSale.id,
            order: { userId, status: { not: 'CANCELLED' } }
          },
          _sum: { quantity: true }
        });
        const bought = pastOrders._sum.quantity || 0;
        const remainingQuota = Math.max(0, item.maxQuantityPerUser - bought);
        userAvailable = Math.min(overallAvailable, remainingQuota);
      }
      
      quotaMap[item.productId] = userAvailable;
    }

    return quotaMap;
  }

  async getVouchers(userId?: string) {
    const now = new Date();
    let userTierId: string | null = null;

    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        userTierId = user.membershipTierId;
      }
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        isActive: true,
        isPublic: true,
        startDate: { lte: now },
        endDate: { gte: now },
        // Chỉ lấy những voucher không yêu cầu hạng thẻ HOẶC yêu cầu đúng hạng thẻ của user này
        OR: [
          { membershipTierId: null },
          ...(userTierId ? [{ membershipTierId: userTierId }] : [])
        ]
      }
    });

    return vouchers;
  }

  async applyVoucher(code: string, orderValue: number, userId?: string, shippingFee: number = 0) {
    const now = new Date();
    const voucher = await this.prisma.voucher.findUnique({
      where: { code }
    });

    if (!voucher) {
      throw new NotFoundException('Mã khuyến mãi không tồn tại');
    }

    if (!voucher.isActive || voucher.startDate > now || voucher.endDate < now) {
      throw new BadRequestException('Mã khuyến mãi đã hết hạn hoặc chưa khả dụng');
    }

    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
      throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
    }

    if (userId && voucher.usageLimitPerUser !== null) {
      const usedByThisUser = await this.prisma.order.count({
        where: { userId: userId, voucherId: voucher.id, status: { not: 'CANCELLED' } }
      });
      if (usedByThisUser >= voucher.usageLimitPerUser) {
        throw new BadRequestException('Bạn đã hết lượt sử dụng mã khuyến mãi này');
      }
    }

    if (orderValue < voucher.minOrderValue) {
      throw new BadRequestException(`Đơn hàng tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ để áp dụng mã này`);
    }

    // Check membership tier if required
    if (voucher.membershipTierId && userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.membershipTierId !== voucher.membershipTierId) {
        throw new BadRequestException('Bạn không đủ điều kiện hạng thẻ để sử dụng mã này');
      }
    } else if (voucher.membershipTierId && !userId) {
        throw new BadRequestException('Vui lòng đăng nhập để sử dụng mã khuyến mãi này');
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (voucher.discountType === 'PERCENTAGE') {
      discountAmount = (orderValue * voucher.discountValue) / 100;
      if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
        discountAmount = voucher.maxDiscount;
      }
    } else if (voucher.discountType === 'FIXED_AMOUNT') {
      discountAmount = voucher.discountValue;
    } else if (voucher.discountType === 'FREE_SHIP') {
      discountAmount = Math.min(voucher.discountValue, shippingFee);
    }

    return {
      success: true,
      voucher,
      discountAmount
    };
  }
}
