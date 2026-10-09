import { OrderStatus, Prisma } from '@prisma/client';

/**
 * Danh sách trạng thái đơn hàng hoàn thành duy nhất toàn hệ sinh thái AVORA.
 * Tuyệt đối không đưa PENDING, PREPARING, DELIVERING, DRAFT, HELD hay CANCELLED vào.
 */
export const COMPLETED_ORDER_STATUSES: OrderStatus[] = [OrderStatus.COMPLETED];

/**
 * Helper sinh mệnh đề where cho Prisma để chỉ lấy đơn hoàn thành
 */
export function getCompletedOrderWhereClause(): Prisma.OrderWhereInput {
  return {
    status: { in: COMPLETED_ORDER_STATUSES },
  };
}

/**
 * Kiểm tra xem một trạng thái đơn hàng có phải là đơn hoàn tất hay không
 */
export function isOrderCompleted(status?: OrderStatus | string | null): boolean {
  if (!status) return false;
  return status === OrderStatus.COMPLETED;
}
