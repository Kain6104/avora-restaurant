import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentMethodService } from './payment-method.service';

describe('PaymentMethodService - Flexible Validation, Active Filter & Webhooks', () => {
  let service: PaymentMethodService;
  let mockPrisma: any;
  let mockNotificationService: any;

  beforeEach(() => {
    mockPrisma = {
      paymentMethod: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'pm-1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'pm-1', ...data })),
        delete: jest.fn().mockResolvedValue({ id: 'pm-1' }),
      },
      order: {
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ord-1', ...data })),
      },
    };

    mockNotificationService = {
      createNotification: jest.fn().mockResolvedValue(true),
    };

    service = new PaymentMethodService(mockPrisma, mockNotificationService);
  });

  it('1. should reject TRANSFER gateway if bankCode, accountNumber, or accountName are missing', async () => {
    mockPrisma.paymentMethod.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        methodCode: 'TRANSFER_BIDV',
        gatewayType: 'TRANSFER',
        name: 'Chuyển khoản BIDV',
        bankCode: 'BIDV',
        // thiếu accountNumber & accountName
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('2. should create TRANSFER gateway successfully when full bank info provided', async () => {
    mockPrisma.paymentMethod.findUnique.mockResolvedValue(null);

    const res = await service.create({
      methodCode: 'TRANSFER_MB',
      gatewayType: 'TRANSFER',
      name: 'Chuyển khoản MBBank',
      bankCode: 'MB',
      accountNumber: '0988888888',
      accountName: 'AVORA RESTAURANT',
      minOrderValue: 50000,
    });

    expect(res).toBeDefined();
    expect(mockPrisma.paymentMethod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          methodCode: 'TRANSFER_MB',
          bankCode: 'MB',
          accountNumber: '0988888888',
        }),
      }),
    );
  });

  it('3. getActiveMethods should filter out methods with minOrderValue > totalAmount', async () => {
    mockPrisma.paymentMethod.findMany.mockResolvedValue([
      { id: '1', methodCode: 'COD', minOrderValue: 0, isActive: true },
      { id: '2', methodCode: 'VNPAY', minOrderValue: 200000, isActive: true },
      { id: '3', methodCode: 'TRANSFER', minOrderValue: 50000, isActive: true },
    ]);

    // Tổng tiền giỏ hàng = 100,000đ -> Chỉ COD và TRANSFER thỏa mãn, VNPAY bị ẩn
    const availableMethods = await service.getActiveMethods(100000);
    const eligibleMethods = availableMethods.filter((m) => m.isEligible);

    expect(eligibleMethods).toHaveLength(2);
    expect(eligibleMethods.map((m) => m.methodCode)).toEqual(['COD', 'TRANSFER']);
  });

  it('4. handleWebhook should mark order PAID and dispatch real-time customer notification', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'ord-123',
      orderCode: 'ORD-999999',
      userId: 'user-1',
      paymentStatus: 'PENDING',
    });

    const result = await service.handleWebhook({
      orderCode: 'ORD-999999',
      amount: 150000,
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-123' },
        data: expect.objectContaining({ paymentStatus: 'PAID' }),
      }),
    );
    expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        title: expect.stringContaining('Thanh toán thành công'),
      }),
    );
  });

  it('5. handleWebhook should reject invalid PayOS HMAC signature with UnauthorizedException', async () => {
    mockPrisma.paymentMethod.findFirst = jest.fn().mockResolvedValue({
      methodCode: 'PAYOS',
      isActive: true,
      configKey2: 'test-checksum-secret',
    });

    await expect(
      service.handleWebhook(
        {
          code: '00',
          data: { orderCode: 'ORD-999999', amount: 150000 },
          signature: 'invalid-signature',
        },
        undefined,
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('6. handleWebhook should accept valid PayOS HMAC signature and confirm payment', async () => {
    const checksumKey = 'test-checksum-secret';
    mockPrisma.paymentMethod.findFirst = jest.fn().mockResolvedValue({
      methodCode: 'PAYOS',
      isActive: true,
      configKey2: checksumKey,
    });
    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'ord-payos-1',
      orderCode: 'AVO-PAYOS-01',
      branchId: 'branch-1',
      totalAmount: 150000,
      paymentStatus: 'PENDING',
      paymentMethod: 'PAYOS',
    });

    const dataObj: Record<string, any> = {
      amount: 150000,
      orderCode: 'AVO-PAYOS-01',
      paymentLinkId: 'pl-123',
    };
    const sortedQuery = Object.keys(dataObj)
      .sort()
      .map((k) => `${k}=${dataObj[k]}`)
      .join('&');
    const validSig = createHmac('sha256', checksumKey).update(sortedQuery).digest('hex');

    const res = await service.handleWebhook({
      code: '00',
      success: true,
      data: dataObj,
      signature: validSig,
    });

    expect(res.success).toBe(true);
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-payos-1' },
        data: expect.objectContaining({ paymentStatus: 'PAID' }),
      }),
    );
  });

  it('7. handleWebhook should record PAYMENT_FAILED and NOT mark PAID on underpayment or failure status', async () => {
    const mockNotificationEngine = { publishEvent: jest.fn().mockResolvedValue(true) };
    const mockAuditService = { log: jest.fn().mockResolvedValue(true) };
    const svc = new PaymentMethodService(
      mockPrisma,
      mockNotificationService,
      mockNotificationEngine as any,
      undefined,
      mockAuditService as any,
    );

    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'ord-fail-1',
      orderCode: 'AVO-FAIL-01',
      branchId: 'branch-1',
      totalAmount: 200000,
      paymentStatus: 'PENDING',
      paymentMethod: 'PAYOS',
    });

    const underpayRes = await svc.handleWebhook({
      orderCode: 'AVO-FAIL-01',
      amount: 100000,
    });

    expect(underpayRes.success).toBe(false);
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAYMENT_FAILED' }),
    );
    expect(mockNotificationEngine.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'PAYMENT_FAILED' }),
    );

    const explicitFailRes = await svc.handleWebhook({
      code: '01',
      desc: 'Cancelled by user',
      data: { orderCode: 'AVO-FAIL-01', status: 'CANCELLED', amount: 200000 },
    });

    expect(explicitFailRes.success).toBe(false);
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });
});
