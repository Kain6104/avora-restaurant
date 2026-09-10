import { BadRequestException } from '@nestjs/common';
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
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'ord-123' },
      data: expect.objectContaining({ paymentStatus: 'PAID' }),
    });
    expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        title: expect.stringContaining('Thanh toán thành công'),
      }),
    );
  });
});
