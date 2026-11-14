import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService - /admin/orders POS COMPLETED Visibility Filter', () => {
  let service: OrdersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new OrdersService(mockPrisma, {} as any, {} as any);
  });

  it('enforces orderSource=POS and status=COMPLETED when tab is POS', async () => {
    await service.findAll({ tab: 'POS', status: OrderStatus.PENDING });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              orderSource: 'POS',
              status: OrderStatus.COMPLETED,
            }),
          ]),
        }),
      }),
    );
  });

  it('enforces non-POS OR COMPLETED POS in ALL tab', async () => {
    await service.findAll({ tab: 'ALL' });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: [
                { orderSource: { not: 'POS' } },
                { orderSource: 'POS', status: OrderStatus.COMPLETED },
              ],
            }),
          ]),
        }),
      }),
    );
  });

  it('restricts ONLINE tab to non-POS orders', async () => {
    await service.findAll({ tab: 'ONLINE' });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              orderSource: { not: 'POS' },
            }),
          ]),
        }),
      }),
    );
  });

  it('keeps POS COMPLETED visibility constraint across getStatusCounts & getUnreadCount', async () => {
    await service.getStatusCounts({ tab: 'POS' });

    const posCountCalls = mockPrisma.order.count.mock.calls
      .slice(0, 6)
      .map((c: any[]) => c[0].where);
    for (const whereArg of posCountCalls) {
      expect(whereArg.AND).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            orderSource: 'POS',
            status: OrderStatus.COMPLETED,
          }),
        ]),
      );
    }

    mockPrisma.order.count.mockClear();
    await service.getUnreadCount();
    const unreadWhere = mockPrisma.order.count.mock.calls[0][0].where;
    expect(unreadWhere.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: [
            { orderSource: { not: 'POS' } },
            { orderSource: 'POS', status: OrderStatus.COMPLETED },
          ],
        }),
      ]),
    );
  });
});
