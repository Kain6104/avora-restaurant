import { BadRequestException } from '@nestjs/common';
import { OrderItemPricingMode } from '@prisma/client';
import { PosService } from './pos.service';

describe('PosService - Point Redemption Guard', () => {
  let service: PosService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        findUnique: jest.fn(),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        const tx = {
          orderItem: {
            deleteMany: jest.fn(),
            create: jest.fn(),
          },
        };
        return cb(tx);
      }),
    };

    service = new PosService(
      mockPrisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('rejects deleting a point-redeemed item via updateOrder', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      version: 1,
      subTotal: 0,
      discountAmount: 0,
      orderItems: [
        {
          id: 'oi-redeem-1',
          productId: 'prod-redeem',
          quantity: 1,
          priceAtSale: 0,
          isPointRedemption: true,
          pricingMode: OrderItemPricingMode.POINT_REDEMPTION,
          discountReason: 'Đổi điểm thưởng',
          selectedOptions: [],
        },
      ],
    });

    await expect(
      service.updateOrder(
        'order-1',
        { items: [] } as any,
        { id: 'staff-1', fullName: 'NV A' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects changing quantity of a point-redeemed item via updateOrder', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      version: 1,
      subTotal: 0,
      discountAmount: 0,
      orderItems: [
        {
          id: 'oi-redeem-1',
          productId: 'prod-redeem',
          quantity: 1,
          priceAtSale: 0,
          isPointRedemption: true,
          pricingMode: OrderItemPricingMode.POINT_REDEMPTION,
          discountReason: 'Đổi điểm thưởng',
          selectedOptions: [],
        },
      ],
    });
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 'prod-redeem',
        name: 'Trà Sữa Matcha',
        price: 45000,
        discountedPrice: null,
        category: { slug: 'drink' },
        optionGroups: [],
        FlashSaleItem: [],
      },
    ]);

    await expect(
      service.updateOrder(
        'order-1',
        {
          items: [
            {
              id: 'oi-redeem-1',
              productId: 'prod-redeem',
              quantity: 2,
            },
          ],
        } as any,
        { id: 'staff-1', fullName: 'NV A' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects splitting a point-redeemed item via splitOrder', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderItems: [
        {
          id: 'oi-redeem-1',
          productId: 'prod-redeem',
          quantity: 1,
          priceAtSale: 0,
          isPointRedemption: true,
          pricingMode: OrderItemPricingMode.POINT_REDEMPTION,
          product: { name: 'Trà Sữa Matcha' },
          selectedOptions: [],
        },
      ],
    });

    await expect(
      service.splitOrder(
        {
          sourceOrderId: 'order-1',
          items: [{ orderItemId: 'oi-redeem-1', quantity: 1 }],
        } as any,
        { id: 'staff-1', fullName: 'NV A' },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

