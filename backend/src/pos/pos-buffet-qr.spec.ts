import { BadRequestException } from '@nestjs/common';
import { OrderItemPricingMode, OrderStatus } from '@prisma/client';
import { PosService } from './pos.service';

describe('PosService Buffet M07, QR Audit/Notify & M08 Unlock', () => {
  let service: PosService;
  let prisma: any;
  let posGateway: any;
  let notificationEngine: any;
  let orderAuditService: any;

  beforeEach(() => {
    prisma = {
      restaurantTable: { findUnique: jest.fn() },
      order: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      buffetPackageTicket: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      buffetSession: {
        create: jest.fn(),
      },
      orderItem: {
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      qrOrderRound: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };

    posGateway = {
      emitOrderUpdated: jest.fn(),
      emitEvent: jest.fn(),
      emitTableStatusChanged: jest.fn(),
      server: {
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      },
    };

    notificationEngine = {
      publishEvent: jest.fn().mockResolvedValue(true),
    };

    orderAuditService = {
      log: jest.fn().mockResolvedValue(true),
    };

    const orderPricingService: any = {
      calculatePricing: jest.fn().mockResolvedValue({ subTotal: 0, taxAmount: 0, totalAmount: 0 }),
    };

    service = new PosService(
      prisma,
      posGateway,
      {} as any,
      {} as any,
      {} as any,
      orderPricingService,
      notificationEngine,
      {} as any,
      orderAuditService,
    );
  });

  it('auto-heals open table M07 when Buffet 599 ticket exists with REGULAR pricingMode and missing BuffetSession', async () => {
    const order = {
      id: '3b4974e4-3d49-4e6c-94c5-0e04f91a9847',
      orderCode: 'TMP-4C4948',
      temporaryOrderCode: 'TMP-4C4948',
      branchId: 'branch-1',
      status: OrderStatus.PREPARING,
      buffetSessions: [],
      qrOrderSessions: [],
      orderItems: [
        {
          id: 'oi-ticket',
          productId: 'ticket-599-adult',
          quantity: 4,
          priceAtSale: 599000,
          pricingMode: OrderItemPricingMode.REGULAR,
          product: { id: 'ticket-599-adult', name: 'BUFFET 599 (NGƯỜI LỚN)', unit: 'Vé', price: 599000 },
          selectedOptions: [],
        },
      ],
    };

    prisma.restaurantTable.findUnique.mockResolvedValue({
      id: 'table-m07',
      tableCode: 'M07',
      name: 'Bàn M07',
      area: { name: 'Tầng 1' },
      sessions: [{ id: 'ts-1', guestCount: 4, note: null, order }],
    });

    prisma.buffetPackageTicket.findFirst.mockResolvedValue({
      productId: 'ticket-599-adult',
      buffetPackage: { id: 'bp-599', name: 'Buffet 599' },
    });
    prisma.buffetPackageTicket.findMany.mockResolvedValue([{ productId: 'ticket-599-adult' }]);
    prisma.buffetSession.create.mockResolvedValue({
      id: 'bs-healed',
      status: 'ACTIVE',
      packageNameSnapshot: 'Buffet 599',
      buffetPackage: { id: 'bp-599', name: 'Buffet 599', items: [], tickets: [] },
    });

    const detail = await service.getTableSessionDetail('table-m07', 'branch-1');

    expect(prisma.orderItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pricingMode: OrderItemPricingMode.BUFFET_TICKET }),
      }),
    );
    expect(detail.order?.buffetSession).toBeTruthy();
    expect(detail.order?.orderItems[0].pricingMode).toBe(OrderItemPricingMode.BUFFET_TICKET);
  });

  it('records QR_ORDER_CONFIRMED audit & notification using authenticated JWT actor (excludeActor: true)', async () => {
    const round = {
      id: 'round-1',
      orderId: 'ord-1',
      roundNumber: 2,
      status: 'PENDING_APPROVAL',
      qrOrderSession: { branchId: 'branch-1', table: { name: 'Bàn M07' } },
      orderItems: [
        { quantity: 2, product: { name: 'Sushi Cá Hồi Phô Mai' } },
      ],
    };
    const updatedOrder = {
      id: 'ord-1',
      orderCode: 'TMP-4C4948',
      branchId: 'branch-1',
      orderType: 'DINE_IN',
      totalAmount: 500000,
      table: { name: 'Bàn M07' },
      orderItems: [],
    };

    prisma.qrOrderRound.findUnique.mockResolvedValue(round);
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        qrOrderRound: { update: jest.fn().mockResolvedValue({}) },
        orderItem: { updateMany: jest.fn().mockResolvedValue({}) },
        order: { update: jest.fn().mockResolvedValue({}) },
      }),
    );
    prisma.order.findUnique.mockResolvedValue(updatedOrder);

    const jwtUser = { id: 'staff-htp', fullName: 'HTP Official', role: 'CASHIER' };
    await service.confirmQrOrder('round-1', jwtUser);

    expect(orderAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QR_ORDER_CONFIRMED',
        actorId: 'staff-htp',
        actorName: 'HTP Official',
      }),
    );
    expect(notificationEngine.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'QR_ORDER_CONFIRMED',
        excludeActor: true,
        actor: expect.objectContaining({ id: 'staff-htp', name: 'HTP Official' }),
      }),
    );
  });

  it('unlockPaymentLock releases unpaid lock and rejects unlocking paid orders', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'ord-m08',
      orderCode: 'TMP-Y3U7J9',
      branchId: 'branch-1',
      status: OrderStatus.HELD,
      paymentStatus: 'AWAITING_PAYMENT',
      paymentIntentStatus: 'ACTIVE',
      totalAmount: 431000,
      payments: [],
      table: { name: 'Bàn M08' },
    });
    prisma.order.update.mockResolvedValueOnce({
      id: 'ord-m08',
      orderCode: 'TMP-Y3U7J9',
      branchId: 'branch-1',
      status: OrderStatus.PREPARING,
      paymentStatus: 'PENDING',
      paymentIntentStatus: 'NONE',
      table: { name: 'Bàn M08' },
      orderItems: [],
    });

    const unlocked = await service.unlockPaymentLock('ord-m08', 'Khách gọi thêm món', {
      id: 'cashier-1',
      fullName: 'Thu Ngân',
    });

    expect(unlocked.paymentStatus).toBe('PENDING');
    expect((unlocked as any).paymentIntentStatus).toBe('NONE');

    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'ord-paid',
      branchId: 'branch-1',
      status: OrderStatus.COMPLETED,
      paymentStatus: 'PAID',
      totalAmount: 100000,
      payments: [{ status: 'COMPLETED', amount: 100000 }],
      table: null,
    });

    await expect(service.unlockPaymentLock('ord-paid', 'test', { id: 'u1' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

