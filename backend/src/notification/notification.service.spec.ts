import { NotificationService } from './notification.service';

describe('NotificationService - Realtime WebSocket Notifications', () => {
  let service: NotificationService;
  let mockPrisma: any;
  let mockGateway: any;

  beforeEach(() => {
    mockPrisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'notif-1', userId: 'user-1', title: 'Đơn hàng mới', isRead: false },
        ]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'notif-new', ...data, isRead: false, createdAt: new Date() })
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockGateway = {
      sendNotificationToUser: jest.fn(),
      sendUnreadCountToUser: jest.fn(),
    };

    service = new NotificationService(mockPrisma, mockGateway);
  });

  it('1. should create notification in DB and emit realtime event to user room', async () => {
    const result = await service.createNotification({
      userId: 'user-1',
      title: 'Đặt hàng thành công!',
      content: 'Đơn hàng ORD-12345 đã được tiếp nhận.',
      type: 'ORDER',
      referenceId: 'ORD-12345',
      url: '/orders/ORD-12345',
    });

    expect(result).toBeDefined();
    expect(result.id).toBe('notif-new');
    expect(mockPrisma.notification.create).toHaveBeenCalled();
    expect(mockGateway.sendNotificationToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ title: 'Đặt hàng thành công!' }),
      1
    );
  });

  it('2. should mark single notification as read and emit updated unread count', async () => {
    mockPrisma.notification.count.mockResolvedValue(0);

    await service.markAsRead('user-1', 'notif-1');

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-1', userId: 'user-1' },
      data: { isRead: true },
    });
    expect(mockGateway.sendUnreadCountToUser).toHaveBeenCalledWith('user-1', 0);
  });

  it('3. should mark all notifications as read and emit 0 unread count', async () => {
    await service.markAllAsRead('user-1');

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
      data: { isRead: true },
    });
    expect(mockGateway.sendUnreadCountToUser).toHaveBeenCalledWith('user-1', 0);
  });

  it('4. should retrieve user notifications and unread count', async () => {
    const res = await service.getUserNotifications('user-1');

    expect(res.data).toHaveLength(1);
    expect(res.unreadCount).toBe(1);
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
