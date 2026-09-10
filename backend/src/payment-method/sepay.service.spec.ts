import { Test, TestingModule } from '@nestjs/testing';
import { SepayService } from './sepay.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

describe('SepayService', () => {
  let service: SepayService;
  let prisma: any;
  let notificationService: any;

  const mockPrismaService = {
    paymentMethod: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockNotificationService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SepayService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<SepayService>(SepayService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationService = module.get<NotificationService>(NotificationService);

    jest.clearAllMocks();
  });

  describe('handleSepayWebhook - Bảo mật & Xác thực', () => {
    it('Nên ném lỗi UnauthorizedException nếu thiếu Authorization Header', async () => {
      await expect(service.handleSepayWebhook({ content: 'SW123' }, '')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('Nên ném lỗi UnauthorizedException nếu API Key không khớp với cấu hình SePay', async () => {
      prisma.paymentMethod.findMany.mockResolvedValue([
        { id: '1', gatewayType: 'SEPAY', configKey1: 'VALID_API_TOKEN', isActive: true },
      ]);

      await expect(
        service.handleSepayWebhook({ content: 'SW123' }, 'Bearer INVALID_TOKEN'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleSepayWebhook - Trích xuất & Regex Fix MBBank', () => {
    beforeEach(() => {
      prisma.paymentMethod.findMany.mockResolvedValue([
        { id: '1', gatewayType: 'SEPAY', configKey1: 'MY_SECRET_KEY', isActive: true },
      ]);
    });

    it('Nên bỏ qua nếu transferType không phải là in', async () => {
      const res = await service.handleSepayWebhook(
        { transferType: 'out', content: 'SW123' },
        'ApiKey MY_SECRET_KEY',
      );
      expect(res.success).toBe(true);
      expect(res.message).toContain('Chỉ xử lý giao dịch nhận tiền');
    });

    it('Nên tự động fix mã TMP12345 thành TMP-12345 khi MBBank/VCB bỏ mất dấu gạch ngang', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        orderCode: 'TMP-12345',
        totalAmount: 150000,
        paymentStatus: 'PENDING',
        status: OrderStatus.PENDING,
      });
      prisma.order.update.mockResolvedValue({
        id: 'order-1',
        orderCode: 'TMP-12345',
        paymentStatus: 'PAID',
      });

      const res = await service.handleSepayWebhook(
        {
          transferType: 'in',
          content: 'CHUYEN TIEN TMP12345 QUA MBBANK.',
          transferAmount: 150000,
          referenceCode: 'TX999888',
        },
        'ApiKey MY_SECRET_KEY',
      );

      expect(res.success).toBe(true);
      expect(res.orderCode).toBe('TMP-12345');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({
            paymentStatus: 'PAID',
            transactionId: 'TX999888',
          }),
        }),
      );
    });

    it('Nên gạch nợ thành công cho đơn hàng Online chuẩn SW12345', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-2',
        orderCode: 'SW12345',
        totalAmount: 290000,
        paymentStatus: 'PENDING',
        status: OrderStatus.PENDING,
        userId: 'user-1',
      });
      prisma.order.update.mockResolvedValue({
        id: 'order-2',
        orderCode: 'SW12345',
        paymentStatus: 'PAID',
      });

      const res = await service.handleSepayWebhook(
        {
          transferType: 'in',
          content: 'TTDH SW12345',
          transferAmount: 290000,
          referenceCode: 'SEPAY-TX-001',
        },
        'Bearer MY_SECRET_KEY',
      );

      expect(res.success).toBe(true);
      expect(prisma.order.update).toHaveBeenCalled();
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          referenceId: 'SW12345',
        }),
      );
    });

    it('Nên báo lỗi nếu số tiền chuyển không đủ (transferAmount < totalAmount)', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-3',
        orderCode: 'ORD-999',
        totalAmount: 500000,
        paymentStatus: 'PENDING',
        status: OrderStatus.PENDING,
      });

      const res = await service.handleSepayWebhook(
        {
          transferType: 'in',
          content: 'ORD-999',
          transferAmount: 200000, // Thiếu tiền
        },
        'ApiKey MY_SECRET_KEY',
      );

      expect(res.success).toBe(false);
      expect(res.message).toContain('Số tiền chuyển không đủ');
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('getSepayPaymentConfig & checkOrderStatus', () => {
    it('Nên tạo URL VietQR chính xác kèm mã đơn hàng và số tiền', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderCode: 'SW8888',
        totalAmount: 180000,
        status: OrderStatus.PENDING,
        paymentStatus: 'PENDING',
        orderItems: [],
        subTotal: 180000,
        shippingFee: 0,
        discountAmount: 0,
        shippingDiscount: 0,
        pointsUsed: 0,
      });

      prisma.paymentMethod.findFirst.mockResolvedValue({
        bankCode: '970422',
        accountNumber: 'SEPSUSHIWA',
        accountName: 'AVORA RESTAURANT',
        gatewayType: 'SEPAY',
        isActive: true,
      });

      const config = await service.getSepayPaymentConfig('SW8888');
      expect(config.orderCode).toBe('SW8888');
      expect(config.amount).toBe(180000);
      expect(config.qrUrl).toContain('970422-SEPSUSHIWA-compact2.png');
      expect(config.qrUrl).toContain('amount=180000');
      expect(config.qrUrl).toContain('addInfo=SW8888');
    });

    it('checkOrderStatus nên trả về trạng thái PAID khi paymentStatus là PAID', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderCode: 'SW8888',
        status: OrderStatus.CONFIRMED,
        paymentStatus: 'PAID',
        transactionId: 'TX12345',
        totalAmount: 180000,
      });

      const res = await service.checkOrderStatus('SW8888');
      expect(res.isPaid).toBe(true);
      expect(res.status).toBe('PAID');
    });
  });
});
