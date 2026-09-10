import { Injectable, Optional, Logger } from '@nestjs/common';
import { CheckoutGateway } from './checkout.gateway';
import { PosGateway } from '../pos/pos.gateway';

@Injectable()
export class RealtimeBroadcastService {
  private readonly logger = new Logger(RealtimeBroadcastService.name);

  constructor(
    @Optional() private readonly checkoutGateway?: CheckoutGateway,
    @Optional() private readonly posGateway?: PosGateway,
  ) {}

  /**
   * Phát tín hiệu khi Sản phẩm có biến động (Giá, Thuế, Tồn kho/Khả dụng)
   */
  broadcastProductUpdate(data: {
    productId: string;
    productName?: string;
    changeType: 'PRICE' | 'TAX' | 'AVAILABILITY' | 'GENERAL';
    oldPrice?: number;
    newPrice?: number;
    taxPercentage?: number;
    available?: boolean;
    branchId?: string;
  }) {
    const eventType =
      data.changeType === 'PRICE'
        ? 'PRODUCT_PRICE_CHANGED'
        : data.changeType === 'TAX'
        ? 'PRODUCT_TAX_UPDATED'
        : data.changeType === 'AVAILABILITY'
        ? 'PRODUCT_AVAILABILITY_CHANGED'
        : 'PRODUCT_UPDATED';

    this.checkoutGateway?.emitSignal(eventType, data, data.branchId);
    this.posGateway?.emitEvent({
      eventType,
      entityType: 'PRODUCT',
      entityId: data.productId,
      branchId: data.branchId || 'ALL',
      payload: data,
    });
    this.logger.log(`Broadcasted ${eventType} for product ${data.productId}`);
  }

  /**
   * Phát tín hiệu khi Flash Sale thay đổi (Bắt đầu, Hết hạn, Đổi giá, Hết stock)
   */
  broadcastFlashSaleUpdate(data: { flashSaleId: string; branchId?: string; status?: string }) {
    this.checkoutGateway?.emitSignal('FLASH_SALE_UPDATED', data, data.branchId);
    this.posGateway?.emitEvent({
      eventType: 'FLASH_SALE_UPDATED',
      entityType: 'PRODUCT',
      entityId: data.flashSaleId,
      branchId: data.branchId || 'ALL',
      payload: data,
    });
  }

  /**
   * Phát tín hiệu khi Voucher thay đổi điều kiện / hết lượt
   */
  broadcastVoucherUpdate(data: { voucherCode: string; branchId?: string; reason?: string }) {
    this.checkoutGateway?.emitSignal('VOUCHER_UPDATED', data, data.branchId);
  }

  /**
   * Phát tín hiệu khi Khung giờ giao hàng thay đổi trạng thái / Hết chỗ
   */
  broadcastSlotUpdate(data: { branchId: string; slotId: string; isFull: boolean }) {
    this.checkoutGateway?.emitSignal('OPERATING_SLOT_UPDATED', data, data.branchId);
  }

  /**
   * Phát tín hiệu khi Phương thức thanh toán được Bật/Tắt
   */
  broadcastPaymentMethodUpdate(data: { methodCode: string; isActive: boolean }) {
    this.checkoutGateway?.emitSignal('PAYMENT_METHOD_UPDATED', data);
    this.posGateway?.emitEvent({
      eventType: 'PAYMENT_METHOD_UPDATED',
      entityType: 'PAYMENT',
      entityId: data.methodCode,
      branchId: 'ALL',
      payload: data,
    });
  }

  /**
   * Phát tín hiệu khi Cấu hình giao hàng / Ngưỡng Freeship thay đổi
   */
  broadcastShippingSettingsUpdate(data: { threshold?: number; enabled?: boolean } = {}) {
    this.checkoutGateway?.emitSignal('SHIPPING_SETTING_UPDATED', data);
    this.checkoutGateway?.emitSignal('FREE_SHIPPING_THRESHOLD_UPDATED', data);
  }

  /**
   * Phát tín hiệu khi Cấu hình Thuế VAT toàn hệ thống thay đổi
   */
  broadcastVatSettingsUpdate(data: { vatPriceMode: string; vatEnabled?: boolean }) {
    this.checkoutGateway?.emitSignal('VAT_SETTING_UPDATED', data);
    this.posGateway?.emitEvent({
      eventType: 'VAT_SETTING_UPDATED',
      entityType: 'ORDER',
      entityId: 'SYSTEM',
      branchId: 'ALL',
      payload: data,
    });
    this.logger.log(`Broadcasted VAT_SETTING_UPDATED: ${data.vatPriceMode}`);
  }

  /**
   * Phát tín hiệu khi Chi nhánh đóng/mở nhận đơn Online
   */
  broadcastBranchUpdate(data: { branchId: string; onlineOrderingEnabled?: boolean }) {
    this.checkoutGateway?.emitSignal('BRANCH_UPDATED', data, data.branchId);
  }
}
