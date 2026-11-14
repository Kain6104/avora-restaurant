import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OrderStatus,
  CancellationType,
  CancellationStatus,
  PointTransactionSource,
  TableSessionStatus,
  KitchenStatus,
  Prisma,
} from '@prisma/client';
import { CancelUnpaidOrderDto, CANCELLATION_REASONS } from './dto/cancel-unpaid-order.dto';
import { RequestPaidCancellationDto } from './dto/request-paid-cancellation.dto';
import { ReviewPaidCancellationDto } from './dto/review-paid-cancellation.dto';
import { ExecuteRefundDto } from './dto/execute-refund.dto';
import { TaxInvoiceActionDto } from './dto/tax-invoice-action.dto';
import { QueryCancellationsDto } from './dto/query-cancellations.dto';
import { PrintRoutingService } from '../../print-routing/print-routing.service';
import { PosGateway } from '../../pos/pos.gateway';
import { NotificationService } from '../../notification/notification.service';
import { NotificationEngineService } from '../../notification/notification-engine.service';
import {
  buildOrderNotificationPayload,
  mapPriorityToNumeric,
} from '../../notification/order-notification.helper';
import { InventoryReservationService } from '../inventory/inventory-reservation.service';
import {
  parseVietnamDateRange,
  formatVietnamDate,
  getVietnamDateString,
} from '../../common/utils/vietnam-time.util';

@Injectable()
export class OrderCancellationService {
  private readonly logger = new Logger(OrderCancellationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly printRoutingService?: PrintRoutingService,
    @Optional() private readonly posGateway?: PosGateway,
    @Optional() private readonly notificationService?: NotificationService,
    @Optional() private readonly inventoryReservationService?: InventoryReservationService,
    @Optional() private readonly notificationEngine?: NotificationEngineService,
  ) {}

  /**
   * Sinh mã hủy chuẩn: CAN-YYYYMMDD-XXXX
   */
  private generateCancellationCode(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `CAN-${y}${m}${d}-${rnd}`;
  }

  /**
   * Phân giải Branch Scope cho Actor
   */
  private async resolveBranchScope(userId: string, branchIdParam?: string): Promise<{ allowedBranchIds: string[]; isAll: boolean }> {
    const userAssignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, isActive: true },
      include: {
        role: true,
        branches: { select: { branchId: true } },
      },
    });

    const isGlobal = userAssignments.some((a) => a.role.scopeType === 'GLOBAL');
    const assignedBranchIds = new Set<string>();
    for (const a of userAssignments) {
      if (a.branches && a.branches.length > 0) {
        a.branches.forEach((b) => assignedBranchIds.add(b.branchId));
      }
    }

    if (isGlobal || userAssignments.length === 0) {
      if (branchIdParam && branchIdParam !== 'ALL') {
        return { allowedBranchIds: [branchIdParam], isAll: false };
      }
      return { allowedBranchIds: [], isAll: true };
    }

    const branchList = Array.from(assignedBranchIds);
    if (branchIdParam && branchIdParam !== 'ALL') {
      if (!assignedBranchIds.has(branchIdParam)) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu của chi nhánh này');
      }
      return { allowedBranchIds: [branchIdParam], isAll: false };
    }

    return { allowedBranchIds: branchList, isAll: false };
  }

  // =========================================================================
  // 1. UNPAID ORDER CANCELLATION (HỦY ĐƠN CHƯA THANH TOÁN)
  // =========================================================================

  async cancelUnpaidOrder(
    orderId: string,
    dto: CancelUnpaidOrderDto,
    actor: { id: string; fullName?: string; email?: string; role?: string },
    branchIdScope?: string,
  ) {
    // 1. Kiểm tra lý do hủy
    const validReason = CANCELLATION_REASONS.find((r) => r.code === dto.reasonCode);
    if (!validReason && dto.reasonCode !== 'OTHER') {
      throw new BadRequestException(`Mã lý do hủy '${dto.reasonCode}' không hợp lệ`);
    }
    if (dto.reasonCode === 'OTHER' && (!dto.explanation || dto.explanation.trim().length < 5)) {
      throw new BadRequestException('Lý do "Khác" bắt buộc nhập giải thích chi tiết từ 5 ký tự trở lên');
    }

    // 2. Lấy thông tin đơn hàng hiện tại
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        orderItems: { include: { product: true } },
        table: true,
        user: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ID: ${orderId}`);
    }

    if (branchIdScope && order.branchId !== branchIdScope) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng của chi nhánh khác');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Đơn hàng này đã ở trạng thái hủy trước đó');
    }

    // 3. Kiểm tra tính hợp lệ về thanh toán (CRITICAL PAYMENT ELIGIBILITY)
    const completedPayments = (order.payments || []).filter(
      (p) => p.status === 'COMPLETED' && p.amount > 0,
    );
    const totalCompletedAmount = completedPayments.reduce((sum, p) => sum + p.amount, 0);

    const isPaidStatus =
      order.paymentStatus === 'PAID' ||
      order.paymentStatus === 'PARTIALLY_PAID' ||
      order.paymentStatus === 'PARTIALLY_REFUNDED' ||
      order.paymentStatus === 'REFUNDED';

    if (totalCompletedAmount > 0 || isPaidStatus) {
      throw new BadRequestException(
        `Đơn hàng này đã có giao dịch thanh toán thành công (${totalCompletedAmount.toLocaleString(
          'vi-VN',
        )}đ). Nghiêm cấm hủy theo quy trình chưa thanh toán! Vui lòng sử dụng tính năng "HỦY HÓA ĐƠN ĐÃ THANH TOÁN" để thực hiện quy trình hoàn tiền có đối soát.`,
      );
    }

    // 4. Thực thi Database Transaction với Row Locking & Concurrency Protection
    const cancellationCode = this.generateCancellationCode();
    const correlationId = `UNPAID-CANCEL-${order.id}-${Date.now()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // 4.1 Lock row & re-check bên trong transaction để chống Race Condition với Cashier / Webhook
      const lockedOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: {
          id: true,
          version: true,
          status: true,
          paymentStatus: true,
          paymentIntentStatus: true,
        },
      });

      if (!lockedOrder) {
        throw new NotFoundException('Đơn hàng không tồn tại trong phiên khóa');
      }

      if (lockedOrder.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Đơn hàng đã bị hủy bởi một tiến trình khác');
      }

      if (lockedOrder.paymentStatus === 'PAID' || lockedOrder.paymentStatus === 'PARTIALLY_PAID') {
        throw new BadRequestException(
          'Thanh toán vừa được xác nhận thành công trước khi tiến trình hủy kịp thực hiện. Đã từ chối hủy chưa thanh toán!',
        );
      }

      // Kiểm tra xem có payment nào vừa được insert thành công không
      const freshCompletedPayments = await tx.orderPayment.findMany({
        where: { orderId: order.id, status: 'COMPLETED', amount: { gt: 0 } },
      });
      if (freshCompletedPayments.length > 0) {
        throw new BadRequestException(
          'Phát hiện giao dịch thanh toán vừa được ghi nhận. Không thể tiếp tục hủy đơn chưa thanh toán!',
        );
      }

      // 4.2 Cập nhật trạng thái đơn hàng sang CANCELLED, hủy PaymentIntent
      const fullReasonText = dto.explanation
        ? `[${validReason?.label || dto.reasonCode}] ${dto.explanation.trim()}`
        : validReason?.label || dto.reasonCode;

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: fullReasonText,
          canceledBy: actor.id,
          canceledByName: actor.fullName || actor.email || 'Admin',
          canceledByRole: actor.role || 'MANAGER',
          canceledAt: new Date(),
          paymentStatusBeforeCancel: order.paymentStatus,
          paymentIntentStatus:
            lockedOrder.paymentIntentStatus === 'ACTIVE'
              ? 'CANCELLED'
              : lockedOrder.paymentIntentStatus,
          pointsRefunded: true,
          version: (lockedOrder.version || 1) + 1,
        },
      });

      // 4.3 Hoàn lại lượt sử dụng voucher (Idempotent)
      if (order.voucherId && !order.isVoucherRefunded) {
        await tx.voucher.updateMany({
          where: { id: order.voucherId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
      if (order.shippingVoucherId && !order.isVoucherRefunded) {
        await tx.voucher.updateMany({
          where: { id: order.shippingVoucherId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: { isVoucherRefunded: true },
      });

      // 4.4 Hoàn lại điểm tích lũy / điểm đổi món nếu có
      if (order.pointsUsed && order.pointsUsed > 0 && order.userId && !order.pointsRefunded) {
        const u = await tx.user.findUnique({ where: { id: order.userId } });
        if (u) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              points: { increment: order.pointsUsed },
              currentPoints: { increment: order.pointsUsed },
            },
          });
          const code = order.orderCode || order.temporaryOrderCode || order.id;
          await tx.pointTransaction.create({
            data: {
              userId: order.userId,
              membershipTierId: u.membershipTierId || null,
              balanceBefore: u.points,
              amount: order.pointsUsed,
              balanceAfter: u.points + order.pointsUsed,
              source: PointTransactionSource.REFUND,
              orderId: order.id,
              orderCode: code,
              referenceCode: code,
              description: `Hoàn ${order.pointsUsed} điểm do hủy đơn chưa thanh toán ${code}`,
            },
          });
        }
      }

      // 4.5 Hoàn lại Quota Flash Sale nếu có
      for (const item of order.orderItems) {
        if (item.isFlashSaleItem && item.flashSaleId) {
          await tx.flashSaleItem.updateMany({
            where: { flashSaleId: item.flashSaleId, productId: item.productId },
            data: { sold: { decrement: item.quantity } },
          });
        }
      }

      // 4.6 Giải phóng bàn ăn nếu không còn đơn nào khác đang phục vụ tại bàn
      let tableReleased = false;
      if (order.tableId) {
        const activeOrdersOnTable = await tx.order.count({
          where: {
            tableId: order.tableId,
            id: { not: order.id },
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                OrderStatus.HELD,
                OrderStatus.DRAFT,
              ],
            },
          },
        });
        if (activeOrdersOnTable === 0) {
          tableReleased = true;
          if (order.tableSessionId) {
            await tx.tableSession.update({
              where: { id: order.tableSessionId },
              data: { status: TableSessionStatus.CLOSED, closedAt: new Date() },
            });
          }
        }
      }

      // 4.7 Đóng các phiên session Buffet / QR Order nếu có
      await tx.buffetSession.updateMany({
        where: { orderId: order.id, status: 'ACTIVE' },
        data: { status: 'CLOSED', deactivatedAt: new Date() },
      });
      await tx.qrOrderSession.updateMany({
        where: { orderId: order.id, status: 'ACTIVE' },
        data: { status: 'CLOSED', closedAt: new Date() },
      });

      // 4.8 Cập nhật trạng thái món ăn trong bếp sang CANCELLED
      await tx.orderItem.updateMany({
        where: { orderId: order.id },
        data: { kitchenStatus: KitchenStatus.CANCELLED },
      });

      // 4.9 Dispatch Cancel Ticket đến các máy in bếp nếu đơn đã từng gửi bếp
      const wasSentToKitchen =
        order.kitchenStatus !== KitchenStatus.PENDING || Boolean(order.sentToKitchenAt);

      if (wasSentToKitchen && this.printRoutingService) {
        try {
          await this.printRoutingService.dispatchCancelOrderItems(tx, {
            orderId: order.id,
            branchId: order.branchId,
            items: order.orderItems.map((i) => ({
              id: i.id,
              name: i.product?.name || 'Món ăn',
              quantity: i.quantity,
              note: i.note || undefined,
            })),
            reason: fullReasonText,
            canceledById: actor.id,
          });
        } catch (e: any) {
          this.logger.warn(`Lỗi khi dispatch cancel kitchen ticket: ${e?.message}`);
        }
      }

      // 4.10 Tạo bản ghi OrderCancellation (Bản ghi quản trị vòng đời hủy)
      const cancellationRecord = await tx.orderCancellation.create({
        data: {
          cancellationCode,
          orderId: order.id,
          orderCode: order.orderCode || order.temporaryOrderCode,
          branchId: order.branchId,
          cancellationType: CancellationType.UNPAID_ORDER_CANCELLATION,
          status: CancellationStatus.CANCELLED,

          originalTotal: order.totalAmount,
          subtotal: order.subTotal,
          discountAmount: order.discountAmount,
          taxAmount: order.taxAmount,
          serviceChargeTotal: order.serviceChargeTotal,
          shippingFee: order.shippingFee,

          totalCollected: 0,
          totalRefunded: 0,
          requestedRefundAmount: 0,
          retainedAmount: 0,

          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerSnapshot: {
            name: order.customerName,
            phone: order.customerPhone,
            address: order.deliveryAddress,
            userId: order.userId,
          },
          cashierId: order.cashierId,
          cashierName: order.cashierName,

          reasonCode: dto.reasonCode,
          explanation: dto.explanation || null,
          notes: dto.notes || null,

          requestedById: actor.id,
          requestedByName: actor.fullName || actor.email,
          requestedByRole: actor.role || 'MANAGER',
          requestedAt: new Date(),

          cancelledById: actor.id,
          cancelledByName: actor.fullName || actor.email,
          cancelledByRole: actor.role || 'MANAGER',
          cancelledAt: new Date(),
          completedAt: new Date(),

          kitchenStatusSnapshot: order.kitchenStatus,
          paymentStatusSnapshot: order.paymentStatus,
          paymentIntentStatusSnapshot: lockedOrder.paymentIntentStatus,
          paymentIntentCodeSnapshot: order.paymentIntentCode,

          kitchenTicketDispatched: wasSentToKitchen,
          wasteRecorded: Boolean(dto.wasteRecorded),
          wasteNotes: dto.wasteNotes || null,

          correlationId,
        },
      });

      // 4.11 Ghi nhận OrderAuditLog
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          orderCode: order.orderCode || order.temporaryOrderCode,
          action: 'UNPAID_ORDER_CANCELLED',
          category: 'CANCEL',
          actorId: actor.id,
          actorName: actor.fullName || actor.email,
          actorRole: actor.role || 'MANAGER',
          branchId: order.branchId,
          reason: fullReasonText,
          correlationId,
          oldValue: {
            status: order.status,
            paymentStatus: order.paymentStatus,
            totalAmount: order.totalAmount,
            kitchenStatus: order.kitchenStatus,
          },
          newValue: {
            status: OrderStatus.CANCELLED,
            cancellationCode,
            cancellationType: 'UNPAID_ORDER_CANCELLATION',
            tableReleased,
            wasteRecorded: dto.wasteRecorded,
          },
          metadata: {
            reasonCode: dto.reasonCode,
            explanation: dto.explanation,
            notes: dto.notes,
          },
        },
      });

      return {
        cancellation: cancellationRecord,
        updatedOrder,
        tableReleased,
      };
    });

    // 4.12 Giải phóng giữ chỗ nguyên liệu kho chưa tiêu hao
    if (this.inventoryReservationService) {
      try {
        await this.inventoryReservationService.releaseOrderReservations(order.id);
      } catch (e: any) {
        this.logger.warn(`Lỗi giải phóng giữ chỗ kho khi hủy đơn: ${e?.message}`);
      }
    }

    // 5. Broadcast Realtime
    if (this.posGateway) {
      this.posGateway.emitOrderUpdated(result.updatedOrder, actor.id);
      if (result.tableReleased && order.tableId) {
        this.posGateway.emitTableStatusChanged(
          order.branchId,
          order.tableId,
          'EMPTY',
          null,
          null,
          actor.id,
        );
      }
    }

    if (this.notificationEngine) {
      const displayCode = order.orderCode || order.temporaryOrderCode || order.id;
      const actorName = actor.fullName || actor.email || 'Quản lý';
      const itemsSummary = (order.orderItems || [])
        .slice(0, 6)
        .map((i: any) => `${i.quantity}x ${i.product?.name || 'Món'}`)
        .join(', ');
      const reasonText =
        dto.explanation?.trim() ||
        result.cancellation?.reasonCode ||
        dto.reasonCode ||
        null;
      const builtCancel = buildOrderNotificationPayload({
        eventType: 'ORDER_CANCELED',
        orderCode: displayCode,
        orderType: order.orderType,
        tableName: (order as any).table?.name,
        totalAmount: order.totalAmount,
        actorName,
        reason: reasonText,
        itemsSummary,
      });
      this.notificationEngine
        .publishEvent({
          eventType: 'ORDER_CANCELED',
          category: 'ORDER',
          priority: mapPriorityToNumeric(builtCancel.priority),
          icon: builtCancel.icon,
          branchId: order.branchId,
          entityId: order.id,
          subId: `can-${Date.now()}`,
          title: builtCancel.title,
          message: builtCancel.message,
          actor: { id: actor.id, name: actorName },
          reference: {
            type: 'ORDER',
            id: order.id,
            url: `/admin/orders/${order.id}`,
          },
          metadata: {
            orderId: order.id,
            orderCode: displayCode,
            reason: reasonText,
          },
          requiredPermissions: ['orders.view', 'pos.order.view', 'waiter.access'],
          appScopes: ['ADMIN', 'POS', 'WAITER'],
          excludeActor: true,
          legacyType: 'ORDER',
        })
        .catch(() => {});
    }

    return {
      success: true,
      message: 'Đã hủy đơn hàng chưa thanh toán thành công',
      data: result.cancellation,
    };
  }

  // =========================================================================
  // 2. PAID INVOICE CANCELLATION (HỦY HÓA ĐƠN ĐÃ THANH TOÁN)
  // =========================================================================

  /**
   * Bước 1: Nhân sự tạo đề xuất hủy hóa đơn đã thanh toán
   */
  async requestPaidCancellation(
    orderId: string,
    dto: RequestPaidCancellationDto,
    actor: { id: string; fullName?: string; email?: string; role?: string },
    branchIdScope?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          include: { refunds: true },
        },
        cancellation: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ID: ${orderId}`);
    }

    if (branchIdScope && order.branchId !== branchIdScope) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng của chi nhánh khác');
    }

    // Tính toán tổng tiền thực thu và tổng tiền đã hoàn
    const completedPayments = (order.payments || []).filter((p) => p.status === 'COMPLETED');
    const totalCollected = completedPayments.reduce((sum, p) => sum + p.amount, 0);

    let totalAlreadyRefunded = 0;
    for (const p of completedPayments) {
      for (const ref of p.refunds || []) {
        if (ref.status === 'COMPLETED') {
          totalAlreadyRefunded += ref.amount;
        }
      }
    }

    const remainingRefundable = Math.max(0, totalCollected - totalAlreadyRefunded);

    if (totalCollected <= 0 && order.paymentStatus !== 'PAID') {
      throw new BadRequestException(
        'Đơn hàng chưa có khoản thanh toán nào được xác nhận thành công. Vui lòng sử dụng tính năng "HỦY ĐƠN CHƯA THANH TOÁN"!',
      );
    }

    if (order.cancellation) {
      const currentStatus = order.cancellation.status;
      if (currentStatus === 'REQUESTED' || currentStatus === 'PENDING_APPROVAL') {
        throw new BadRequestException('Đã có yêu cầu hủy hóa đơn đang chờ xét duyệt cho đơn hàng này');
      }
      if (currentStatus === 'REFUNDED' || currentStatus === 'COMPLETED') {
        throw new BadRequestException('Hóa đơn này đã được hủy và hoàn tiền hoàn tất trước đó');
      }
    }

    if (dto.requestedRefundAmount > remainingRefundable) {
      throw new BadRequestException(
        `Số tiền đề xuất hoàn (${dto.requestedRefundAmount.toLocaleString(
          'vi-VN',
        )}đ) vượt quá số tiền có thể hoàn còn lại (${remainingRefundable.toLocaleString('vi-VN')}đ)`,
      );
    }

    const cancellationCode = order.cancellation?.cancellationCode || this.generateCancellationCode();
    const correlationId = `PAID-CANCEL-REQ-${order.id}-${Date.now()}`;

    const cancellation = await this.prisma.$transaction(async (tx) => {
      // Upsert OrderCancellation record
      const record = await tx.orderCancellation.upsert({
        where: { orderId: order.id },
        create: {
          cancellationCode,
          orderId: order.id,
          orderCode: order.orderCode || order.temporaryOrderCode,
          branchId: order.branchId,
          cancellationType: CancellationType.PAID_INVOICE_CANCELLATION,
          status: CancellationStatus.PENDING_APPROVAL,

          originalTotal: order.totalAmount,
          subtotal: order.subTotal,
          discountAmount: order.discountAmount,
          taxAmount: order.taxAmount,
          serviceChargeTotal: order.serviceChargeTotal,
          shippingFee: order.shippingFee,

          totalCollected,
          totalRefunded: totalAlreadyRefunded,
          requestedRefundAmount: dto.requestedRefundAmount,
          retainedAmount: dto.retainedAmount || 0,

          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerSnapshot: {
            name: order.customerName,
            phone: order.customerPhone,
            address: order.deliveryAddress,
            userId: order.userId,
          },
          cashierId: order.cashierId,
          cashierName: order.cashierName,

          reasonCode: dto.reasonCode,
          explanation: dto.explanation.trim(),
          notes: dto.notes || null,

          requestedById: actor.id,
          requestedByName: actor.fullName || actor.email,
          requestedByRole: actor.role || 'STAFF',
          requestedAt: new Date(),

          isTaxInvoiceIssued: order.isInvoiceExported,
          taxInvoiceNotes: dto.taxInvoiceNotes || null,

          kitchenStatusSnapshot: order.kitchenStatus,
          paymentStatusSnapshot: order.paymentStatus,
          paymentIntentStatusSnapshot: order.paymentIntentStatus,
          paymentIntentCodeSnapshot: order.paymentIntentCode,

          correlationId,
        },
        update: {
          status: CancellationStatus.PENDING_APPROVAL,
          requestedRefundAmount: dto.requestedRefundAmount,
          retainedAmount: dto.retainedAmount || 0,
          reasonCode: dto.reasonCode,
          explanation: dto.explanation.trim(),
          notes: dto.notes || null,
          requestedById: actor.id,
          requestedByName: actor.fullName || actor.email,
          requestedByRole: actor.role || 'STAFF',
          requestedAt: new Date(),
          approvedById: null,
          approvedByName: null,
          approvedAt: null,
          rejectedById: null,
          rejectedByName: null,
          rejectedAt: null,
          rejectionReason: null,
        },
      });

      // Audit Log
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          orderCode: order.orderCode || order.temporaryOrderCode,
          action: 'PAID_CANCELLATION_REQUESTED',
          category: 'CANCEL',
          actorId: actor.id,
          actorName: actor.fullName || actor.email,
          actorRole: actor.role || 'STAFF',
          branchId: order.branchId,
          reason: `[${dto.reasonCode}] ${dto.explanation.trim()}`,
          correlationId,
          oldValue: {
            status: order.status,
            paymentStatus: order.paymentStatus,
            totalCollected,
            totalAlreadyRefunded,
          },
          newValue: {
            cancellationCode,
            status: 'PENDING_APPROVAL',
            requestedRefundAmount: dto.requestedRefundAmount,
            retainedAmount: dto.retainedAmount || 0,
          },
          metadata: {
            reasonCode: dto.reasonCode,
            explanation: dto.explanation,
            notes: dto.notes,
            remainingRefundable,
          },
        },
      });

      return record;
    });

    return {
      success: true,
      message: 'Đã gửi yêu cầu hủy hóa đơn đã thanh toán. Đang chờ quản lý/kế toán xét duyệt.',
      data: cancellation,
    };
  }

  /**
   * Bước 2: Phê duyệt hoặc từ chối đề xuất hủy hóa đơn (DUAL APPROVAL ENFORCEMENT)
   */
  async reviewPaidCancellation(
    orderId: string,
    dto: ReviewPaidCancellationDto,
    actor: { id: string; fullName?: string; email?: string; role?: string },
    branchIdScope?: string,
  ) {
    const cancellation = await this.prisma.orderCancellation.findUnique({
      where: { orderId },
      include: { order: true },
    });

    if (!cancellation) {
      throw new NotFoundException('Không tìm thấy yêu cầu hủy hóa đơn cho đơn hàng này');
    }

    if (branchIdScope && cancellation.branchId !== branchIdScope) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng của chi nhánh khác');
    }

    if (cancellation.status !== CancellationStatus.PENDING_APPROVAL && cancellation.status !== CancellationStatus.REQUESTED) {
      throw new BadRequestException(
        `Yêu cầu hủy không ở trạng thái chờ xét duyệt (Trạng thái hiện tại: ${cancellation.status})`,
      );
    }

    // DUAL APPROVAL RULE: Người tạo đề xuất KHÔNG được tự phê duyệt
    if (cancellation.requestedById && cancellation.requestedById === actor.id) {
      throw new ForbiddenException(
        'Quy định bảo mật tài chính (Dual Approval): Người khởi tạo yêu cầu hủy không được phép tự phê duyệt yêu cầu của chính mình. Phải do Quản lý khác hoặc Kế toán/Admin phê duyệt!',
      );
    }

    if (!dto.approved && (!dto.rejectionReason || dto.rejectionReason.trim().length < 5)) {
      throw new BadRequestException('Khi từ chối yêu cầu hủy hóa đơn, bắt buộc nhập lý do từ chối từ 5 ký tự trở lên');
    }

    const correlationId = `PAID-CANCEL-REVIEW-${orderId}-${Date.now()}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.approved) {
        // Phê duyệt -> Chuyển sang REFUND_PENDING (hoặc APPROVED nếu không cần hoàn tiền)
        const nextStatus =
          cancellation.requestedRefundAmount > 0
            ? CancellationStatus.REFUND_PENDING
            : CancellationStatus.APPROVED;

        const res = await tx.orderCancellation.update({
          where: { id: cancellation.id },
          data: {
            status: nextStatus,
            approvedById: actor.id,
            approvedByName: actor.fullName || actor.email,
            approvedByRole: actor.role || 'MANAGER',
            approvedAt: new Date(),
            notes: dto.notes ? `${cancellation.notes || ''}\n[Duyệt]: ${dto.notes}` : cancellation.notes,
          },
        });

        // Audit Log
        await tx.orderAuditLog.create({
          data: {
            orderId,
            orderCode: cancellation.orderCode,
            action: 'PAID_CANCELLATION_APPROVED',
            category: 'CANCEL',
            actorId: actor.id,
            actorName: actor.fullName || actor.email,
            actorRole: actor.role || 'MANAGER',
            branchId: cancellation.branchId,
            reason: dto.notes || 'Phê duyệt yêu cầu hủy hóa đơn',
            correlationId,
            oldValue: { status: cancellation.status },
            newValue: { status: nextStatus, approvedById: actor.id },
          },
        });

        return res;
      } else {
        // Từ chối đề xuất hủy
        const res = await tx.orderCancellation.update({
          where: { id: cancellation.id },
          data: {
            status: CancellationStatus.REJECTED,
            rejectedById: actor.id,
            rejectedByName: actor.fullName || actor.email,
            rejectedByRole: actor.role || 'MANAGER',
            rejectedAt: new Date(),
            rejectionReason: dto.rejectionReason!.trim(),
            notes: dto.notes ? `${cancellation.notes || ''}\n[Từ chối]: ${dto.notes}` : cancellation.notes,
          },
        });

        // Audit Log
        await tx.orderAuditLog.create({
          data: {
            orderId,
            orderCode: cancellation.orderCode,
            action: 'PAID_CANCELLATION_REJECTED',
            category: 'CANCEL',
            actorId: actor.id,
            actorName: actor.fullName || actor.email,
            actorRole: actor.role || 'MANAGER',
            branchId: cancellation.branchId,
            reason: dto.rejectionReason,
            correlationId,
            oldValue: { status: cancellation.status },
            newValue: { status: CancellationStatus.REJECTED, rejectedById: actor.id },
          },
        });

        return res;
      }
    });

    return {
      success: true,
      message: dto.approved ? 'Đã phê duyệt yêu cầu hủy hóa đơn' : 'Đã từ chối yêu cầu hủy hóa đơn',
      data: updated,
    };
  }

  /**
   * Bước 3: Thực thi chi hoàn tiền (REFUND EXECUTION)
   */
  async executeRefund(
    orderId: string,
    dto: ExecuteRefundDto,
    actor: { id: string; fullName?: string; email?: string; role?: string },
    branchIdScope?: string,
  ) {
    const cancellation = await this.prisma.orderCancellation.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            payments: { include: { refunds: true } },
          },
        },
      },
    });

    if (!cancellation) {
      throw new NotFoundException('Không tìm thấy yêu cầu hủy hóa đơn cho đơn hàng này');
    }

    if (branchIdScope && cancellation.branchId !== branchIdScope) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng của chi nhánh khác');
    }

    const allowableStatuses: CancellationStatus[] = [
      CancellationStatus.APPROVED,
      CancellationStatus.REFUND_PENDING,
      CancellationStatus.REFUND_PROCESSING,
      CancellationStatus.PARTIALLY_REFUNDED,
    ];

    if (!allowableStatuses.includes(cancellation.status)) {
      throw new BadRequestException(
        `Không thể thực hiện hoàn tiền khi yêu cầu đang ở trạng thái "${cancellation.status}". Yêu cầu phải được phê duyệt trước!`,
      );
    }

    // Tính toán số tiền đã hoàn & số tiền tối đa có thể hoàn
    const payments = cancellation.order.payments || [];
    const completedPayments = payments.filter((p) => p.status === 'COMPLETED');
    const totalCollected = completedPayments.reduce((s, p) => s + p.amount, 0);

    let currentTotalRefunded = 0;
    for (const p of completedPayments) {
      for (const ref of p.refunds || []) {
        if (ref.status === 'COMPLETED') {
          currentTotalRefunded += ref.amount;
        }
      }
    }

    const remainingRefundable = Math.max(0, totalCollected - currentTotalRefunded);

    if (dto.amount > remainingRefundable) {
      throw new BadRequestException(
        `Số tiền hoàn (${dto.amount.toLocaleString(
          'vi-VN',
        )}đ) vượt quá số tiền có thể hoàn còn lại (${remainingRefundable.toLocaleString('vi-VN')}đ)`,
      );
    }

    // Chọn PaymentRecord để liên kết
    let targetPayment = completedPayments[0];
    if (dto.orderPaymentId) {
      const found = completedPayments.find((p) => p.id === dto.orderPaymentId);
      if (found) targetPayment = found;
    }
    if (!targetPayment) {
      throw new BadRequestException('Không tìm thấy bản ghi thanh toán gốc hợp lệ để hoàn tiền');
    }

    // Xử lý ca làm việc (CashShift) nếu hoàn bằng TIỀN MẶT (CASH)
    let shiftId = dto.shiftId;
    if (dto.refundMethod === 'CASH' && !shiftId) {
      const openShift = await this.prisma.cashShift.findFirst({
        where: {
          branchId: cancellation.branchId,
          cashierId: actor.id,
          status: 'OPEN',
        },
      });
      if (openShift) {
        shiftId = openShift.id;
      }
    }

    const correlationId = `REFUND-EXEC-${orderId}-${Date.now()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Tạo bản ghi PaymentRefund liên kết chặt chẽ
      const refundRecord = await tx.paymentRefund.create({
        data: {
          orderPaymentId: targetPayment.id,
          amount: dto.amount,
          refundMethod: dto.refundMethod,
          status: 'COMPLETED',
          shiftId: shiftId || null,
          bankReference: dto.bankReference || null,
          bankDestination: dto.bankDestination || null,
          approvedById: cancellation.approvedById,
          approvedByName: cancellation.approvedByName,
          executedById: actor.id,
          executedByName: actor.fullName || actor.email,
          cancellationId: cancellation.id,
          reason: cancellation.reasonCode,
        },
      });

      // 2. Cập nhật lại số tiền trong ca làm việc nếu là tiền mặt
      if (dto.refundMethod === 'CASH' && shiftId) {
        await tx.cashShift.update({
          where: { id: shiftId },
          data: {
            totalCash: { decrement: dto.amount },
            expectedBalance: { decrement: dto.amount },
          },
        });
      }

      // 3. Tính toán trạng thái mới của Cancellation
      const newTotalRefunded = currentTotalRefunded + dto.amount;
      const isFullyRefunded =
        newTotalRefunded >= cancellation.requestedRefundAmount ||
        newTotalRefunded >= totalCollected;

      const newCancellationStatus = isFullyRefunded
        ? CancellationStatus.REFUNDED
        : CancellationStatus.PARTIALLY_REFUNDED;

      const updatedCancellation = await tx.orderCancellation.update({
        where: { id: cancellation.id },
        data: {
          totalRefunded: newTotalRefunded,
          status: newCancellationStatus,
          completedAt: isFullyRefunded ? new Date() : null,
          cancelledById: actor.id,
          cancelledByName: actor.fullName || actor.email,
          cancelledByRole: actor.role || 'STAFF',
          cancelledAt: new Date(),
        },
      });

      // 4. Cập nhật Order status và refundStatus
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          refundStatus: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          paymentStatus: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          canceledAt: new Date(),
          canceledBy: actor.id,
          canceledByName: actor.fullName || actor.email,
          canceledByRole: actor.role || 'STAFF',
        },
      });

      // 5. Ghi Audit Log hoàn tiền
      await tx.orderAuditLog.create({
        data: {
          orderId,
          orderCode: cancellation.orderCode,
          action: isFullyRefunded ? 'REFUND_COMPLETED' : 'REFUND_PROCESSING',
          category: 'PAYMENT',
          actorId: actor.id,
          actorName: actor.fullName || actor.email,
          actorRole: actor.role || 'STAFF',
          branchId: cancellation.branchId,
          reason: `Chi hoàn ${dto.amount.toLocaleString('vi-VN')}đ qua ${dto.refundMethod}`,
          correlationId,
          oldValue: {
            totalRefunded: currentTotalRefunded,
            status: cancellation.status,
          },
          newValue: {
            refundId: refundRecord.id,
            amount: dto.amount,
            totalRefunded: newTotalRefunded,
            refundMethod: dto.refundMethod,
            status: newCancellationStatus,
            shiftId: shiftId || null,
          },
          metadata: {
            bankReference: dto.bankReference,
            bankDestination: dto.bankDestination,
            notes: dto.notes,
          },
        },
      });

      return { refundRecord, updatedCancellation };
    });

    return {
      success: true,
      message: `Đã thực hiện hoàn tiền thành công: ${dto.amount.toLocaleString('vi-VN')} VNĐ`,
      data: result,
    };
  }

  /**
   * Bước 4: Xử lý hóa đơn điện tử / chứng từ thuế (TAX INVOICE ADJUSTMENT)
   */
  async handleTaxInvoice(
    orderId: string,
    dto: TaxInvoiceActionDto,
    actor: { id: string; fullName?: string; email?: string; role?: string },
    branchIdScope?: string,
  ) {
    const cancellation = await this.prisma.orderCancellation.findUnique({
      where: { orderId },
      include: { order: true },
    });

    if (!cancellation) {
      throw new NotFoundException('Không tìm thấy hồ sơ hủy của đơn hàng này');
    }

    if (branchIdScope && cancellation.branchId !== branchIdScope) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đơn hàng của chi nhánh khác');
    }

    const correlationId = `TAX-INVOICE-${orderId}-${Date.now()}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.orderCancellation.update({
        where: { id: cancellation.id },
        data: {
          taxInvoiceAction: dto.action,
          taxInvoiceStatus: 'COMPLETED',
          taxInvoiceNumber: dto.invoiceNumber || cancellation.order.invoiceTaxCode || null,
          taxInvoiceSeries: dto.invoiceSeries || null,
          taxInvoiceTaxCode: dto.taxCode || cancellation.order.invoiceTaxCode || null,
          taxInvoiceNotes: dto.notes || null,
          taxInvoiceHandledById: actor.id,
          taxInvoiceHandledAt: new Date(),
          status:
            cancellation.status === CancellationStatus.REFUNDED
              ? CancellationStatus.COMPLETED
              : cancellation.status,
        },
      });

      // Audit Log
      await tx.orderAuditLog.create({
        data: {
          orderId,
          orderCode: cancellation.orderCode,
          action: 'TAX_INVOICE_ADJUSTMENT_COMPLETED',
          category: 'ADMIN',
          actorId: actor.id,
          actorName: actor.fullName || actor.email,
          actorRole: actor.role || 'ACCOUNTANT',
          branchId: cancellation.branchId,
          reason: `Xử lý chứng từ thuế: ${dto.action}`,
          correlationId,
          oldValue: {
            taxInvoiceAction: cancellation.taxInvoiceAction,
            taxInvoiceStatus: cancellation.taxInvoiceStatus,
          },
          newValue: {
            action: dto.action,
            invoiceNumber: dto.invoiceNumber,
            status: 'COMPLETED',
          },
        },
      });

      return record;
    });

    return {
      success: true,
      message: 'Đã cập nhật xử lý chứng từ hóa đơn thuế thành công',
      data: updated,
    };
  }

  // =========================================================================
  // 3. REPORTS & QUERIES (BÁO CÁO HỦY ĐƠN & HỦY HÓA ĐƠN)
  // =========================================================================

  /**
   * Báo cáo 1: HỦY ĐƠN CHƯA THANH TOÁN (UNPAID ORDER CANCELLATION REPORT)
   */
  /**
   * Chuẩn hóa 1 bản ghi Order đã hủy thành object tương thích OrderCancellation cho báo cáo & drill-down.
   */
  private mapUnrecordedCancelledOrder(o: any) {
    const completedPayments = (o.payments || []).filter(
      (p: any) => p.status === 'COMPLETED',
    );
    const isPaidOrder =
      o.paymentStatus === 'PAID' ||
      o.paymentStatusBeforeCancel === 'PAID' ||
      completedPayments.length > 0;
    const reasonCode = o.orderSource === 'POS' ? 'POS_CANCELLED' : 'ONLINE_CANCELLED';
    const paidStatus =
      o.refundStatus === 'REFUNDED'
        ? CancellationStatus.REFUNDED
        : CancellationStatus.APPROVED;
    const itemStatus = isPaidOrder ? paidStatus : CancellationStatus.CANCELLED;
    const collectedAmount = isPaidOrder
      ? completedPayments.length > 0
        ? completedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
        : Number(o.totalAmount || 0)
      : 0;
    const refundedAmount = o.refundStatus === 'REFUNDED' ? collectedAmount : 0;
    const displayCode =
      o.orderCode ||
      o.temporaryOrderCode ||
      `POS-${o.id.slice(0, 8).toUpperCase()}`;
    const effectiveTime = o.canceledAt || o.updatedAt || o.createdAt;

    return {
      id: `ord-cancel-${o.id}`,
      cancellationCode: displayCode,
      orderId: o.id,
      orderCode: displayCode,
      branchId: o.branchId,
      cancellationType: isPaidOrder
        ? CancellationType.PAID_INVOICE_CANCELLATION
        : CancellationType.UNPAID_ORDER_CANCELLATION,
      status: itemStatus,
      originalTotal: Number(o.totalAmount || 0),
      subtotal: Number(o.subTotal || 0),
      discountAmount: Number(o.discountAmount || 0),
      taxAmount: Number(o.taxAmount || 0),
      serviceChargeTotal: Number(o.serviceChargeTotal || 0),
      shippingFee: Number(o.shippingFee || 0),
      totalCollected: collectedAmount,
      totalRefunded: refundedAmount,
      requestedRefundAmount: isPaidOrder ? collectedAmount : 0,
      retainedAmount: Math.max(0, collectedAmount - refundedAmount),
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      cashierId: o.cashierId,
      cashierName: o.cashierName,
      reasonCode,
      explanation: o.cancelReason || (o.orderSource === 'POS' ? 'Hủy đơn tại POS' : 'Hủy đơn trực tuyến'),
      cancelledById: o.canceledBy,
      cancelledByName: o.canceledByName || o.cashierName || o.createdByName || 'Hệ thống',
      cancelledByRole: o.canceledByRole || (o.orderSource === 'POS' ? 'POS_STAFF' : null),
      cancelledAt: effectiveTime,
      kitchenStatusSnapshot: o.kitchenStatus || 'PENDING',
      paymentStatusSnapshot: o.paymentStatusBeforeCancel || o.paymentStatus || 'PENDING',
      kitchenTicketDispatched:
        Boolean(o.sentToKitchenAt) || (Boolean(o.kitchenStatus) && o.kitchenStatus !== 'PENDING'),
      isTaxInvoiceIssued: Boolean(o.isInvoiceExported),
      taxInvoiceTaxCode: o.invoiceTaxCode,
      createdAt: effectiveTime,
      updatedAt: o.updatedAt,
      order: o,
      branch: o.branch,
      refunds: [],
      isSyntheticFromOrder: true,
    };
  }

  /**
   * Tổng hợp các đơn hàng đã hủy (POS / Online) chưa có bản ghi OrderCancellation
   * để đảm bảo báo cáo Hủy đơn chưa thanh toán / Hủy hóa đơn đã thanh toán luôn đầy đủ dữ liệu lịch sử & POS.
   */
  private async fetchUnrecordedCancelledOrders(
    reportType: 'UNPAID' | 'PAID',
    query: QueryCancellationsDto,
    allowedBranchIds: string[],
  ): Promise<any[]> {
    if (typeof (this.prisma.order as any)?.findMany !== 'function') {
      return [];
    }

    const where: Prisma.OrderWhereInput = {
      isDeleted: false,
      status: OrderStatus.CANCELLED,
      cancellation: { is: null },
    };

    if (allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }

    const andConditions: Prisma.OrderWhereInput[] = [];

    if (query.dateFrom && query.dateTo) {
      const range = parseVietnamDateRange(query.dateFrom, query.dateTo);
      andConditions.push({
        OR: [
          { canceledAt: { gte: range.startUtc, lte: range.endUtc } },
          {
            AND: [
              { canceledAt: null },
              { createdAt: { gte: range.startUtc, lte: range.endUtc } },
            ],
          },
        ],
      });
    }

    if (query.cashierId && query.cashierId !== 'ALL') {
      where.cashierId = query.cashierId;
    }

    if (query.cancelledById && query.cancelledById !== 'ALL') {
      where.canceledBy = query.cancelledById;
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      andConditions.push({
        OR: [
          { orderCode: { contains: q } },
          { temporaryOrderCode: { contains: q } },
          { customerName: { contains: q } },
          { customerPhone: { contains: q } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        table: { select: { id: true, name: true } },
        orderItems: {
          select: {
            id: true,
            quantity: true,
            priceAtSale: true,
            product: { select: { name: true } },
          },
        },
        payments: {
          select: {
            id: true,
            paymentMethod: true,
            amount: true,
            status: true,
            transactionRef: true,
            createdAt: true,
          },
        },
        bankTransactions: {
          select: { id: true, amount: true, bankReference: true, createdAt: true },
        },
      },
      orderBy: [{ canceledAt: 'desc' }, { createdAt: 'desc' }],
    });

    const mapped: any[] = [];
    for (const o of orders) {
      const item = this.mapUnrecordedCancelledOrder(o);
      const isPaidOrder =
        item.cancellationType === CancellationType.PAID_INVOICE_CANCELLATION;

      if (reportType === 'UNPAID' && isPaidOrder) continue;
      if (reportType === 'PAID' && !isPaidOrder) continue;

      if (
        query.reasonCode &&
        query.reasonCode !== 'ALL' &&
        query.reasonCode !== item.reasonCode
      ) {
        continue;
      }

      if (
        reportType === 'PAID' &&
        query.status &&
        query.status !== 'ALL' &&
        item.status !== query.status
      ) {
        continue;
      }

      mapped.push(item);
    }

    return mapped;
  }

  async getUnpaidCancellationReport(
    query: QueryCancellationsDto,
    user: { id: string },
    branchIdScope?: string,
  ) {
    const { allowedBranchIds } = await this.resolveBranchScope(user.id, branchIdScope || query.branchId);

    const where: Prisma.OrderCancellationWhereInput = {
      cancellationType: CancellationType.UNPAID_ORDER_CANCELLATION,
    };

    if (allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }

    if (query.dateFrom && query.dateTo) {
      const range = parseVietnamDateRange(query.dateFrom, query.dateTo);
      where.createdAt = {
        gte: range.startUtc,
        lte: range.endUtc,
      };
    }

    if (query.reasonCode && query.reasonCode !== 'ALL') {
      where.reasonCode = query.reasonCode;
    }

    if (query.cashierId && query.cashierId !== 'ALL') {
      where.cashierId = query.cashierId;
    }

    if (query.cancelledById && query.cancelledById !== 'ALL') {
      where.cancelledById = query.cancelledById;
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { cancellationCode: { contains: q } },
        { orderCode: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
      ];
    }

    const recordedItems = await this.prisma.orderCancellation.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderCode: true,
            temporaryOrderCode: true,
            orderSource: true,
            orderType: true,
            kitchenStatus: true,
            sentToKitchenAt: true,
            totalAmount: true,
            subTotal: true,
            discountAmount: true,
            taxAmount: true,
            serviceChargeTotal: true,
            shippingFee: true,
            createdAt: true,
            cashierName: true,
            customerName: true,
            customerPhone: true,
            deliveryAddress: true,
            table: { select: { id: true, name: true } },
            orderItems: {
              select: {
                id: true,
                quantity: true,
                priceAtSale: true,
                product: { select: { name: true } },
              },
            },
            bankTransactions: { select: { id: true, amount: true, bankReference: true, createdAt: true } },
          },
        },
        branch: { select: { id: true, name: true, branchCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const unrecordedOrders = await this.fetchUnrecordedCancelledOrders(
      'UNPAID',
      query,
      allowedBranchIds,
    );

    const existingOrderIds = new Set(recordedItems.map((c) => c.orderId));
    const items = [
      ...recordedItems,
      ...unrecordedOrders.filter((u) => !existingOrderIds.has(u.orderId)),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Tính toán KPI Tổng hợp
    let totalCancelledOrders = 0;
    let totalCancelledOrderValue = 0; // GIÁ TRỊ ĐƠN HỦY CHƯA THU
    let cancelledAfterKitchenDispatch = 0;
    let ordersWithLateBankNotifications = 0;

    // Nhóm theo ngày (Asia/Ho_Chi_Minh)
    const dateMap = new Map<
      string,
      {
        date: string;
        orderCount: number;
        totalValue: number;
        items: any[];
      }
    >();

    for (const c of items) {
      totalCancelledOrders++;
      totalCancelledOrderValue += c.originalTotal;

      if (c.kitchenTicketDispatched || c.kitchenStatusSnapshot !== 'PENDING') {
        cancelledAfterKitchenDispatch++;
      }

      const hasBankTrans = (c.order?.bankTransactions || []).length > 0;
      if (hasBankTrans) {
        ordersWithLateBankNotifications++;
      }

      const vnDateStr = getVietnamDateString(c.createdAt);
      if (!dateMap.has(vnDateStr)) {
        dateMap.set(vnDateStr, {
          date: vnDateStr,
          orderCount: 0,
          totalValue: 0,
          items: [],
        });
      }
      const g = dateMap.get(vnDateStr)!;
      g.orderCount++;
      g.totalValue += c.originalTotal;
      g.items.push(c);
    }

    const groupedByDate = Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    return {
      kpis: {
        totalCancelledOrders,
        totalCancelledOrderValue, // KHÔNG PHẢI DOANH THU THỰC THU
        cancelledAfterKitchenDispatch,
        ordersWithLateBankNotifications,
        totalRequests: totalCancelledOrders,
      },
      groupedByDate,
      totalCount: items.length,
    };
  }

  /**
   * Báo cáo 2: HỦY HÓA ĐƠN ĐÃ THANH TOÁN (PAID INVOICE CANCELLATION REPORT)
   */
  async getPaidCancellationReport(
    query: QueryCancellationsDto,
    user: { id: string },
    branchIdScope?: string,
  ) {
    const { allowedBranchIds } = await this.resolveBranchScope(user.id, branchIdScope || query.branchId);

    const where: Prisma.OrderCancellationWhereInput = {
      cancellationType: CancellationType.PAID_INVOICE_CANCELLATION,
    };

    if (allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }

    if (query.dateFrom && query.dateTo) {
      const range = parseVietnamDateRange(query.dateFrom, query.dateTo);
      where.createdAt = {
        gte: range.startUtc,
        lte: range.endUtc,
      };
    }

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as CancellationStatus;
    }

    if (query.reasonCode && query.reasonCode !== 'ALL') {
      where.reasonCode = query.reasonCode;
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { cancellationCode: { contains: q } },
        { orderCode: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
      ];
    }

    const recordedPaidItems = await this.prisma.orderCancellation.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderCode: true,
            temporaryOrderCode: true,
            paymentMethod: true,
            paymentStatus: true,
            isInvoiceExported: true,
            invoiceTaxCode: true,
            invoiceCompanyName: true,
            totalAmount: true,
            subTotal: true,
            createdAt: true,
            payments: {
              select: {
                id: true,
                paymentMethod: true,
                amount: true,
                status: true,
                transactionRef: true,
                createdAt: true,
              },
            },
          },
        },
        refunds: {
          select: {
            id: true,
            amount: true,
            refundMethod: true,
            status: true,
            bankReference: true,
            bankDestination: true,
            createdAt: true,
            executedByName: true,
          },
        },
        branch: { select: { id: true, name: true, branchCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const unrecordedPaidOrders = await this.fetchUnrecordedCancelledOrders(
      'PAID',
      query,
      allowedBranchIds,
    );

    const existingPaidOrderIds = new Set(recordedPaidItems.map((c) => c.orderId));
    const items = [
      ...recordedPaidItems,
      ...unrecordedPaidOrders.filter((u) => !existingPaidOrderIds.has(u.orderId)),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // KPI Metrics tách bạch
    let countPaidInvoicesCancelled = 0;
    let originalInvoiceValue = 0;
    let totalPaymentCollected = 0;
    let refundRequested = 0;
    let refundApproved = 0;
    let refundCompleted = 0;
    let refundPending = 0;
    let refundFailed = 0;
    let amountRetained = 0;

    const dateMap = new Map<
      string,
      {
        date: string;
        count: number;
        originalTotal: number;
        totalCollected: number;
        refundAmount: number;
        completedRefund: number;
        pendingRefund: number;
        items: any[];
      }
    >();

    for (const c of items) {
      countPaidInvoicesCancelled++;
      originalInvoiceValue += c.originalTotal;
      totalPaymentCollected += c.totalCollected;
      refundRequested += c.requestedRefundAmount;
      amountRetained += c.retainedAmount;

      if (c.status === 'APPROVED' || c.status === 'REFUND_PENDING' || c.status === 'REFUND_PROCESSING' || c.status === 'REFUNDED') {
        refundApproved += c.requestedRefundAmount;
      }

      refundCompleted += c.totalRefunded;

      if (c.status === 'REFUND_PENDING' || c.status === 'REFUND_PROCESSING' || c.status === 'PENDING_APPROVAL') {
        refundPending += Math.max(0, c.requestedRefundAmount - c.totalRefunded);
      }

      if (c.status === 'FAILED') {
        refundFailed += c.requestedRefundAmount;
      }

      const vnDateStr = getVietnamDateString(c.createdAt);
      if (!dateMap.has(vnDateStr)) {
        dateMap.set(vnDateStr, {
          date: vnDateStr,
          count: 0,
          originalTotal: 0,
          totalCollected: 0,
          refundAmount: 0,
          completedRefund: 0,
          pendingRefund: 0,
          items: [],
        });
      }
      const g = dateMap.get(vnDateStr)!;
      g.count++;
      g.originalTotal += c.originalTotal;
      g.totalCollected += c.totalCollected;
      g.refundAmount += c.requestedRefundAmount;
      g.completedRefund += c.totalRefunded;
      g.pendingRefund += Math.max(0, c.requestedRefundAmount - c.totalRefunded);
      g.items.push(c);
    }

    const netFinancialImpact = totalPaymentCollected - refundCompleted;

    const groupedByDate = Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    return {
      kpis: {
        countPaidInvoicesCancelled,
        originalInvoiceValue,
        totalPaymentCollected,
        refundRequested,
        refundApproved,
        refundCompleted,
        refundPending,
        refundFailed,
        amountRetained,
        netFinancialImpact,
      },
      groupedByDate,
      totalCount: items.length,
    };
  }

  /**
   * Lấy chi tiết hồ sơ hủy của 1 đơn hàng (Drill-down Detail)
   */
  async getCancellationDetail(
    orderIdOrCode: string,
    user: { id: string },
    branchIdScope?: string,
  ) {
    const cleanLookup = orderIdOrCode.startsWith('ord-cancel-')
      ? orderIdOrCode.slice('ord-cancel-'.length)
      : orderIdOrCode;

    const cancellation = await this.prisma.orderCancellation.findFirst({
      where: {
        OR: [
          { orderId: cleanLookup },
          { cancellationCode: orderIdOrCode },
          { orderCode: cleanLookup },
        ],
      },
      include: {
        order: {
          include: {
            table: true,
            orderItems: { include: { product: true } },
            payments: { include: { refunds: true } },
            bankTransactions: true,
            auditLogs: { orderBy: { createdAt: 'asc' } },
          },
        },
        refunds: true,
        branch: true,
      },
    });

    if (cancellation) {
      if (branchIdScope && cancellation.branchId !== branchIdScope) {
        throw new ForbiddenException('Bạn không có quyền truy cập hồ sơ của chi nhánh khác');
      }
      return { success: true, data: cancellation };
    }

    if (typeof (this.prisma.order as any)?.findFirst === 'function') {
      const order = await this.prisma.order.findFirst({
        where: {
          status: OrderStatus.CANCELLED,
          isDeleted: false,
          OR: [
            { id: cleanLookup },
            { orderCode: cleanLookup },
            { temporaryOrderCode: cleanLookup },
          ],
        },
        include: {
          branch: true,
          table: true,
          orderItems: { include: { product: true } },
          payments: { include: { refunds: true } },
          bankTransactions: true,
          auditLogs: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (order) {
        if (branchIdScope && order.branchId !== branchIdScope) {
          throw new ForbiddenException('Bạn không có quyền truy cập hồ sơ của chi nhánh khác');
        }

        return {
          success: true,
          data: this.mapUnrecordedCancelledOrder(order),
        };
      }
    }

    throw new NotFoundException(`Không tìm thấy hồ sơ hủy cho: ${orderIdOrCode}`);
  }
}
