import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderCancellationService } from './order-cancellation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PrintRoutingService } from '../../print-routing/print-routing.service';
import { PosGateway } from '../../pos/pos.gateway';
import { NotificationService } from '../../notification/notification.service';
import { CancellationStatus } from '@prisma/client';

describe('OrderCancellationService', () => {
  let service: OrderCancellationService;
  let mockPrisma: any;
  let mockPrintRouting: any;
  let mockPosGateway: any;
  let mockNotification: any;

  const mockActor = {
    id: 'user-001',
    fullName: 'Nguyễn Văn Quản Lý',
    email: 'quanly@avora.vn',
    role: 'BRANCH_MANAGER',
  };

  const mockApprover = {
    id: 'user-002',
    fullName: 'Trần Thị Kế Toán',
    email: 'ketoan@avora.vn',
    role: 'ACCOUNTANT',
  };

  beforeEach(async () => {
    mockPrisma = {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      orderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderPayment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      paymentIntent: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      orderCancellation: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      paymentRefund: {
        create: jest.fn(),
        aggregate: jest.fn(),
      },
      cashShift: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      orderAuditLog: {
        create: jest.fn(),
      },
      diningSession: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      buffetSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      qrOrderSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      flashSaleItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      table: {
        update: jest.fn(),
      },
      voucher: {
        updateMany: jest.fn(),
      },
      customer: {
        update: jest.fn(),
      },
      pointTransaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };

    mockPrintRouting = {
      printCancellationTicket: jest.fn().mockResolvedValue(true),
    };

    mockPosGateway = {
      emitOrderCancelled: jest.fn(),
      emitTableStatusChanged: jest.fn(),
      emitOrderUpdated: jest.fn(),
    };

    mockNotification = {
      notifyRole: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCancellationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PrintRoutingService, useValue: mockPrintRouting },
        { provide: PosGateway, useValue: mockPosGateway },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<OrderCancellationService>(OrderCancellationService);
  });

  describe('cancelUnpaidOrder', () => {
    const validUnpaidOrder = {
      id: 'order-123',
      orderNumber: 'ORD-20261110-001',
      branchId: 'branch-001',
      branch: { id: 'branch-001', name: 'Chi nhánh Quận 1' },
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      finalAmount: 350000,
      subtotal: 320000,
      discountAmount: 0,
      taxAmount: 30000,
      serviceChargeAmount: 0,
      shippingFee: 0,
      paidAmount: 0,
      cancellation: null,
      payments: [],
      bankTransactions: [],
      orderItems: [],
      items: [
        { id: 'item-1', name: 'Phở Đặc Biệt', quantity: 2, price: 95000, status: 'PENDING' },
      ],
    };

    it('should throw NotFoundException if order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelUnpaidOrder(
          'non-existent',
          { reasonCode: 'CUSTOMER_CHANGED_MIND' },
          mockActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if order is already cancelled', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...validUnpaidOrder,
        status: 'CANCELLED',
      });

      await expect(
        service.cancelUnpaidOrder(
          'order-123',
          { reasonCode: 'CUSTOMER_CHANGED_MIND' },
          mockActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if order already has confirmed payment', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...validUnpaidOrder,
        paymentStatus: 'PAID',
        paidAmount: 350000,
        payments: [{ id: 'pay-1', status: 'COMPLETED', amount: 350000 }],
      });

      await expect(
        service.cancelUnpaidOrder(
          'order-123',
          { reasonCode: 'CUSTOMER_CHANGED_MIND' },
          mockActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require explanation when reasonCode is OTHER', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(validUnpaidOrder);

      await expect(
        service.cancelUnpaidOrder(
          'order-123',
          { reasonCode: 'OTHER', explanation: '' },
          mockActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully cancel unpaid order, record cancellation snapshot and log audit', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(validUnpaidOrder);
      mockPrisma.orderCancellation.create.mockResolvedValue({
        id: 'cancel-001',
        cancellationCode: 'CAN-20261110-0001',
        cancellationType: 'UNPAID_ORDER_CANCELLATION',
        status: 'CANCELLED',
        orderId: 'order-123',
      });
      mockPrisma.order.update.mockResolvedValue({
        ...validUnpaidOrder,
        status: 'CANCELLED',
      });

      const result = await service.cancelUnpaidOrder(
        'order-123',
        {
          reasonCode: 'CUSTOMER_CHANGED_MIND',
          explanation: 'Khách có việc bận gấp xin hủy bàn',
        },
        mockActor,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.cancellationType).toBe('UNPAID_ORDER_CANCELLATION');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-123' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      expect(mockPrisma.orderAuditLog.create).toHaveBeenCalled();
      expect(mockPosGateway.emitOrderUpdated).toHaveBeenCalled();
    });
  });

  describe('requestPaidCancellation', () => {
    const paidOrder = {
      id: 'order-456',
      orderNumber: 'ORD-20261110-002',
      branchId: 'branch-001',
      branch: { id: 'branch-001', name: 'Chi nhánh Quận 1' },
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      finalAmount: 500000,
      subtotal: 500000,
      paidAmount: 500000,
      cancellation: null,
      payments: [
        {
          id: 'pay-001',
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          amount: 500000,
          refunds: [],
        },
      ],
      refunds: [],
      bankTransactions: [],
      items: [],
    };

    it('should throw BadRequestException if order has no confirmed payment', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...paidOrder,
        paymentStatus: 'UNPAID',
        payments: [],
      });

      await expect(
        service.requestPaidCancellation(
          'order-456',
          {
            requestedRefundAmount: 500000,
            reasonCode: 'FOOD_QUALITY_ISSUE',
            explanation: 'Khách phản ánh chất lượng',
          },
          mockActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if refundAmount exceeds remaining refundable amount', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(paidOrder);

      await expect(
        service.requestPaidCancellation(
          'order-456',
          {
            requestedRefundAmount: 600000, // exceeds 500,000
            reasonCode: 'BILLING_ERROR',
            explanation: 'Thu nhầm tiền',
          },
          mockActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create paid cancellation request in PENDING_APPROVAL status', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(paidOrder);
      mockPrisma.orderCancellation.upsert.mockResolvedValue({
        id: 'cancel-paid-001',
        cancellationCode: 'CAN-20261110-0002',
        cancellationType: 'PAID_INVOICE_CANCELLATION',
        status: 'PENDING_APPROVAL',
        requestedRefundAmount: 500000,
        requestedById: mockActor.id,
      });

      const result = await service.requestPaidCancellation(
        'order-456',
        {
          requestedRefundAmount: 500000,
          reasonCode: 'BILLING_ERROR',
          explanation: 'Tính nhầm bàn',
        },
        mockActor,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('PENDING_APPROVAL');
      expect(mockPrisma.orderCancellation.upsert).toHaveBeenCalled();
    });
  });

  describe('reviewPaidCancellation - Dual Approval Enforcement', () => {
    const pendingCancellation = {
      id: 'cancel-paid-001',
      cancellationCode: 'CAN-20261110-0002',
      cancellationType: 'PAID_INVOICE_CANCELLATION',
      status: 'PENDING_APPROVAL',
      orderId: 'order-456',
      requestedById: 'user-001', // Created by mockActor (user-001)
      requestedByName: 'Nguyễn Văn Quản Lý',
      requestedRefundAmount: 500000,
      order: {
        id: 'order-456',
        orderNumber: 'ORD-20261110-002',
        branchId: 'branch-001',
      },
    };

    it('DUAL APPROVAL VIOLATION: Requester MUST NOT be allowed to approve their own request', async () => {
      mockPrisma.orderCancellation.findUnique.mockResolvedValue(pendingCancellation);

      await expect(
        service.reviewPaidCancellation(
          'cancel-paid-001',
          { approved: true, notes: 'Tôi tự duyệt đơn của tôi' },
          mockActor, // same user who requested (user-001)
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully approve request when reviewed by an independent approver', async () => {
      mockPrisma.orderCancellation.findUnique.mockResolvedValue(pendingCancellation);
      mockPrisma.orderCancellation.update.mockResolvedValue({
        ...pendingCancellation,
        status: CancellationStatus.REFUND_PENDING,
        approvedById: mockApprover.id,
        approvedByName: mockApprover.fullName,
      });

      const result = await service.reviewPaidCancellation(
        'cancel-paid-001',
        { approved: true, notes: 'Kế toán đã kiểm tra và phê duyệt' },
        mockApprover, // different user (user-002)
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.status).toBe(CancellationStatus.REFUND_PENDING);
      expect(mockPrisma.orderCancellation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CancellationStatus.REFUND_PENDING,
            approvedById: mockApprover.id,
          }),
        }),
      );
    });

    it('should successfully reject request with reason and update status to REJECTED', async () => {
      mockPrisma.orderCancellation.findUnique.mockResolvedValue(pendingCancellation);
      mockPrisma.orderCancellation.update.mockResolvedValue({
        ...pendingCancellation,
        status: CancellationStatus.REJECTED,
        rejectionReason: 'Không đủ hóa đơn chứng từ hợp lệ',
      });

      const result = await service.reviewPaidCancellation(
        'cancel-paid-001',
        { approved: false, rejectionReason: 'Không đủ hóa đơn chứng từ hợp lệ' },
        mockApprover,
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(CancellationStatus.REJECTED);
    });
  });

  describe('executeRefund', () => {
    const approvedCancellation = {
      id: 'cancel-paid-001',
      cancellationCode: 'CAN-20261110-0002',
      cancellationType: 'PAID_INVOICE_CANCELLATION',
      status: 'APPROVED',
      orderId: 'order-456',
      requestedRefundAmount: 500000,
      totalRefunded: 0,
      order: {
        id: 'order-456',
        branchId: 'branch-001',
        finalAmount: 500000,
        paidAmount: 500000,
        payments: [
          {
            id: 'pay-001',
            paymentMethod: 'CASH',
            amount: 500000,
            status: 'COMPLETED',
            refunds: [],
          },
        ],
      },
    };

    it('should successfully execute CASH refund and deduct balance from active CashShift', async () => {
      mockPrisma.orderCancellation.findUnique.mockResolvedValue(approvedCancellation);
      mockPrisma.cashShift.findFirst.mockResolvedValue({
        id: 'shift-001',
        status: 'OPEN',
        expectedBalance: 2000000,
        totalCash: 2000000,
      });
      mockPrisma.paymentRefund.create.mockResolvedValue({
        id: 'refund-001',
        amount: 500000,
        status: 'COMPLETED',
        refundMethod: 'CASH',
      });
      mockPrisma.paymentRefund.aggregate.mockResolvedValue({
        _sum: { amount: 500000 },
      });
      mockPrisma.orderCancellation.update.mockResolvedValue({
        ...approvedCancellation,
        status: 'REFUNDED',
        totalRefunded: 500000,
      });

      const result = await service.executeRefund(
        'cancel-paid-001',
        {
          refundMethod: 'CASH',
          amount: 500000,
          reason: 'Hoàn tiền mặt cho khách',
        },
        mockApprover,
      );

      expect(result).toBeDefined();
      expect(mockPrisma.paymentRefund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            refundMethod: 'CASH',
            amount: 500000,
            shiftId: 'shift-001',
          }),
        }),
      );
      expect(mockPrisma.cashShift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shift-001' },
          data: {
            expectedBalance: { decrement: 500000 },
            totalCash: { decrement: 500000 },
          },
        }),
      );
    });

    it('should execute BANK_TRANSFER refund with destination and bank reference', async () => {
      mockPrisma.orderCancellation.findUnique.mockResolvedValue(approvedCancellation);
      mockPrisma.paymentRefund.create.mockResolvedValue({
        id: 'refund-002',
        amount: 500000,
        status: 'COMPLETED',
        refundMethod: 'BANK_TRANSFER',
        bankReference: 'REF-VIETIN-998822',
        bankDestination: 'VietinBank - 1029384756',
      });
      mockPrisma.paymentRefund.aggregate.mockResolvedValue({
        _sum: { amount: 500000 },
      });
      mockPrisma.orderCancellation.update.mockResolvedValue({
        ...approvedCancellation,
        status: 'REFUNDED',
        totalRefunded: 500000,
      });

      const result = await service.executeRefund(
        'cancel-paid-001',
        {
          refundMethod: 'BANK_TRANSFER',
          amount: 500000,
          bankReference: 'REF-VIETIN-998822',
          bankDestination: 'VietinBank - 1029384756',
          reason: 'Hoàn chuyển khoản',
        },
        mockApprover,
      );

      expect(result).toBeDefined();
      expect(mockPrisma.paymentRefund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            refundMethod: 'BANK_TRANSFER',
            bankReference: 'REF-VIETIN-998822',
            bankDestination: 'VietinBank - 1029384756',
          }),
        }),
      );
    });
  });

  describe('handleTaxInvoice', () => {
    it('should update tax invoice action and audit trail', async () => {
      const cancellation = {
        id: 'cancel-paid-001',
        status: 'REFUNDED',
        order: { id: 'order-456' },
      };
      mockPrisma.orderCancellation.findUnique.mockResolvedValue(cancellation);
      mockPrisma.orderCancellation.update.mockResolvedValue({
        ...cancellation,
        taxInvoiceAction: 'CANCEL',
        taxInvoiceStatus: 'COMPLETED',
        taxInvoiceNotes: 'Đã hủy hóa đơn điện tử HD-2026-0098',
      });

      const result = await service.handleTaxInvoice(
        'cancel-paid-001',
        {
          action: 'CANCEL',
          status: 'COMPLETED',
          invoiceNumber: 'HD-2026-0098',
          notes: 'Đã hủy hóa đơn điện tử HD-2026-0098',
        },
        mockApprover,
      );

      expect(result).toBeDefined();
      expect(mockPrisma.orderCancellation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taxInvoiceAction: 'CANCEL',
            taxInvoiceStatus: 'COMPLETED',
          }),
        }),
      );
    });
  });
});
