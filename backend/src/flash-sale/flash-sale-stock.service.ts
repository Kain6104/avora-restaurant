import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FlashSaleStockService {
  private readonly logger = new Logger(FlashSaleStockService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Atomic Reserve Stock:
   * Giữ suất mua Flash Sale an toàn tuyệt đối trong Transaction bằng điều kiện nguyên tử:
   * UPDATE FlashSaleItem SET sold = sold + qty WHERE id = ... AND sold + qty <= stock
   */
  async atomicReserveStock(
    tx: Prisma.TransactionClient,
    flashSaleItemId: string,
    quantity: number,
    productName: string = 'Sản phẩm',
  ): Promise<{ flashSaleItemId: string; quantity: number }> {
    if (quantity <= 0) {
      throw new BadRequestException('Số lượng đặt mua phải lớn hơn 0.');
    }

    // Lấy thông tin hiện tại của FlashSaleItem
    const item = await tx.flashSaleItem.findUnique({
      where: { id: flashSaleItemId },
      include: { product: { select: { name: true } } },
    });

    if (!item) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'FLASH_SALE_ITEM_NOT_FOUND',
          message: `Không tìm thấy mục Flash Sale của món "${productName}".`,
        },
      });
    }

    if (!item.isActive) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'FLASH_SALE_ITEM_INACTIVE',
          message: `Món Flash Sale "${item.product?.name || productName}" hiện đang tạm ngừng áp dụng.`,
        },
      });
    }

    const availableStock = item.stock - item.sold;
    if (availableStock < quantity) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'FLASH_SALE_SOLD_OUT',
          message: `Món Flash Sale "${item.product?.name || productName}" chỉ còn ${Math.max(0, availableStock)} suất, không đủ cho số lượng bạn yêu cầu (${quantity}).`,
          details: {
            availableStock: Math.max(0, availableStock),
            requestedQuantity: quantity,
          },
        },
      });
    }

    // Thực thi UPDATE với điều kiện nguyên tử để chống Race Condition khi 2 khách mua cùng lúc
    const updateResult = await tx.flashSaleItem.updateMany({
      where: {
        id: flashSaleItemId,
        stock: { gte: item.sold + quantity },
        isActive: true,
      },
      data: {
        sold: { increment: quantity },
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'FLASH_SALE_SOLD_OUT',
          message: `Rất tiếc! Suất Flash Sale của "${item.product?.name || productName}" vừa được người khác mua hết.`,
        },
      });
    }

    return { flashSaleItemId, quantity };
  }

  /**
   * 2. Atomic Refund Stock:
   * Hoàn trả lại suất bán khi đơn hàng bị hủy bỏ
   */
  async atomicRefundStock(
    tx: Prisma.TransactionClient,
    flashSaleItemId: string,
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) return;

    try {
      const item = await tx.flashSaleItem.findUnique({
        where: { id: flashSaleItemId },
      });

      if (!item) return;

      const newSold = Math.max(0, item.sold - quantity);

      await tx.flashSaleItem.update({
        where: { id: flashSaleItemId },
        data: { sold: newSold },
      });
      this.logger.log(`Refunded ${quantity} flash stock for item ${flashSaleItemId}. New sold: ${newSold}`);
    } catch (err) {
      this.logger.error(`Error refunding flash stock for item ${flashSaleItemId}:`, err);
    }
  }

  /**
   * 3. Lấy số lượng món khách đã mua trong slot/chương trình này
   */
  async getUserPurchasedQuantity(
    userId: string,
    productId: string,
    flashSaleId: string,
    flashSaleSlotId?: string | null,
  ): Promise<number> {
    if (!userId) return 0;

    const whereClause: any = {
      productId,
      flashSaleId,
      order: {
        userId,
        status: { not: 'CANCELLED' },
      },
    };

    if (flashSaleSlotId) {
      whereClause.flashSaleSlotId = flashSaleSlotId;
    }

    const agg = await this.prisma.orderItem.aggregate({
      where: whereClause,
      _sum: { quantity: true },
    });

    return agg._sum.quantity || 0;
  }

  /**
   * 4. Kiểm tra giới hạn mua (Purchase Limits):
   * - maxQuantityPerOrder
   * - maxQuantityPerUser
   */
  async validatePurchaseLimits(params: {
    userId?: string | null;
    flashSaleItem: {
      id: string;
      productId: string;
      flashSaleId: string;
      flashSaleSlotId?: string | null;
      maxQuantityPerOrder?: number | null;
      maxQuantityPerUser?: number | null;
    };
    requestedQuantity: number;
    productName?: string;
  }): Promise<void> {
    const { userId, flashSaleItem, requestedQuantity, productName = 'Sản phẩm' } = params;

    // Giới hạn trên mỗi đơn
    if (flashSaleItem.maxQuantityPerOrder && requestedQuantity > flashSaleItem.maxQuantityPerOrder) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'FLASH_SALE_LIMIT_EXCEEDED',
          message: `Món "${productName}" chỉ cho phép mua tối đa ${flashSaleItem.maxQuantityPerOrder} suất trên một đơn hàng.`,
          details: {
            limitType: 'PER_ORDER',
            maxAllowed: flashSaleItem.maxQuantityPerOrder,
            requested: requestedQuantity,
          },
        },
      });
    }

    // Giới hạn trên mỗi tài khoản khách hàng
    if (userId && flashSaleItem.maxQuantityPerUser) {
      const purchasedSoFar = await this.getUserPurchasedQuantity(
        userId,
        flashSaleItem.productId,
        flashSaleItem.flashSaleId,
        flashSaleItem.flashSaleSlotId,
      );

      const totalWillBuy = purchasedSoFar + requestedQuantity;
      if (totalWillBuy > flashSaleItem.maxQuantityPerUser) {
        const remainingQuota = Math.max(0, flashSaleItem.maxQuantityPerUser - purchasedSoFar);
        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: {
            code: 'FLASH_SALE_LIMIT_EXCEEDED',
            message: `Bạn đã mua ${purchasedSoFar}/${flashSaleItem.maxQuantityPerUser} suất Flash Sale của món "${productName}". Bạn chỉ có thể mua thêm tối đa ${remainingQuota} suất trong khung giờ này.`,
            details: {
              limitType: 'PER_USER',
              maxAllowed: flashSaleItem.maxQuantityPerUser,
              purchasedSoFar,
              remainingQuota,
              requested: requestedQuantity,
            },
          },
        });
      }
    }
  }
}
