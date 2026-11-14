import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Order, OrderStatus } from '@prisma/client';

export type OrderLockCategory =
  | 'DRAFT_UNPAID'
  | 'PAYMENT_ACTIVE'
  | 'PAID_PROCESSING'
  | 'CANCELLED'
  | 'DELETED';

export interface OrderEditabilityAssessment {
  category: OrderLockCategory;
  canEditItems: boolean;
  canEditSurcharges: boolean;
  canEditDiscounts: boolean;
  canChangePaymentMethod: boolean;
  canEditVatInvoice: boolean;
  canCancel: boolean;
  canDeletePermanently: boolean;
  canSaveEmpty: boolean;
  lockReason?: string;
}

export class OrderEditabilityPolicy {
  /**
   * Determine exact editability category and allowed mutations for an order
   */
  static evaluate(order: Partial<Order> & { paymentStatus?: string }): OrderEditabilityAssessment {
    if (order.isDeleted) {
      return {
        category: 'DELETED',
        canEditItems: false,
        canEditSurcharges: false,
        canEditDiscounts: false,
        canChangePaymentMethod: false,
        canEditVatInvoice: false,
        canCancel: false,
        canDeletePermanently: false,
        canSaveEmpty: false,
        lockReason: 'Đơn hàng đã bị xóa / lưu trữ kiểm toán',
      };
    }

    if (order.status === OrderStatus.CANCELLED) {
      return {
        category: 'CANCELLED',
        canEditItems: false,
        canEditSurcharges: false,
        canEditDiscounts: false,
        canChangePaymentMethod: false,
        canEditVatInvoice: false,
        canCancel: false,
        canDeletePermanently: true,
        canSaveEmpty: false,
        lockReason: 'Đơn hàng đã bị hủy, không thể chỉnh sửa dữ liệu tài chính hoặc món ăn',
      };
    }

    if (
      order.status === OrderStatus.COMPLETED ||
      order.paymentStatus === 'PAID' ||
      order.paymentStatus === 'COMPLETED'
    ) {
      return {
        category: 'PAID_PROCESSING',
        canEditItems: false,
        canEditSurcharges: false,
        canEditDiscounts: false,
        canChangePaymentMethod: false,
        canEditVatInvoice: true,
        canCancel: true,
        canDeletePermanently: true,
        canSaveEmpty: false,
        lockReason: 'Đơn hàng đã thanh toán thành công. Dữ liệu tài chính và món ăn đã được khóa bất biến',
      };
    }

    // Category B: Real Active Transfer Payment Intent (Lock financial and items)
    // PAYMENT_REQUESTED (nhân viên bấm yêu cầu thu ngân thanh toán) hoặc HELD KHÔNG tự khóa chuyển khoản.
    const hasActivePaymentIntent =
      order.paymentIntentStatus === 'ACTIVE' ||
      order.paymentStatus === 'AWAITING_PAYMENT';

    if (hasActivePaymentIntent) {
      return {
        category: 'PAYMENT_ACTIVE',
        canEditItems: false,
        canEditSurcharges: false,
        canEditDiscounts: false,
        canChangePaymentMethod: true, // Only if previous intent is superseded/invalidated
        canEditVatInvoice: true,
        canCancel: true,
        canDeletePermanently: true,
        canSaveEmpty: false,
        lockReason:
          'Đã phát hành mã chuyển khoản chờ xác nhận. Đơn hàng tạm khóa chỉnh sửa món, phụ phí và chiết khấu để bảo đảm tính toàn vẹn giao dịch',
      };
    }

    // Category A: Draft Unpaid (New order, saved draft, not awaiting payment)
    return {
      category: 'DRAFT_UNPAID',
      canEditItems: true,
      canEditSurcharges: true,
      canEditDiscounts: true,
      canChangePaymentMethod: true,
      canEditVatInvoice: true,
      canCancel: true,
      canDeletePermanently: true,
      canSaveEmpty: true,
    };
  }

  /**
   * Enforce that items can be added, updated, or removed
   */
  static assertCanModifyItems(order: Partial<Order> & { paymentStatus?: string }, actionName = 'chỉnh sửa món') {
    const assessment = this.evaluate(order);
    if (!assessment.canEditItems) {
      throw new BadRequestException(
        `Không thể ${actionName}: ${assessment.lockReason || 'Đơn hàng đang chờ thanh toán hoặc đã hoàn tất'}`
      );
    }
  }

  /**
   * Enforce that items, surcharges, or discounts can be modified
   */
  static assertCanModifyFinancials(order: Partial<Order> & { paymentStatus?: string }, actionName = 'chỉnh sửa đơn hàng') {
    const assessment = this.evaluate(order);
    if (!assessment.canEditItems || !assessment.canEditSurcharges) {
      throw new BadRequestException(
        `Không thể ${actionName}: ${assessment.lockReason || 'Đơn hàng đang trong trạng thái khóa tài chính'}`
      );
    }
  }

  /**
   * Enforce that payment method change is allowed
   */
  static assertCanChangePaymentMethod(order: Partial<Order> & { paymentStatus?: string }) {
    const assessment = this.evaluate(order);
    if (!assessment.canChangePaymentMethod) {
      throw new BadRequestException(
        `Không thể đổi phương thức thanh toán: ${assessment.lockReason || 'Đơn hàng đã hoàn tất hoặc đã bị hủy'}`
      );
    }
  }

  /**
   * Enforce that VAT invoice details can be modified
   */
  static assertCanModifyInvoice(order: Partial<Order> & { paymentStatus?: string }) {
    const assessment = this.evaluate(order);
    if (!assessment.canEditVatInvoice) {
      throw new BadRequestException(
        `Không thể cập nhật hóa đơn VAT: ${assessment.lockReason || 'Đơn hàng đã bị hủy hoặc đã bị xóa'}`
      );
    }
  }
}

