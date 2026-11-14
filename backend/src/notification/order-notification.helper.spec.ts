import {
  buildOrderNotificationPayload,
  cleanTableName,
  formatVndCurrency,
  mapPriorityToNumeric,
} from './order-notification.helper';

describe('order-notification.helper - Enterprise Order Events', () => {
  it('formats currency and cleans redundant Bàn prefix', () => {
    expect(formatVndCurrency(150000)).toBe('150.000₫');
    expect(cleanTableName('Bàn M08')).toBe('M08');
    expect(cleanTableName('Bàn Bàn M01')).toBe('M01');
    expect(cleanTableName(null)).toBe('');
  });

  it('maps HIGH / NORMAL / URGENT priorities to numeric levels', () => {
    expect(mapPriorityToNumeric('NORMAL')).toBe(1);
    expect(mapPriorityToNumeric('HIGH')).toBe(2);
    expect(mapPriorityToNumeric('URGENT')).toBe(3);
  });

  it('generates standardized Vietnamese payloads for all operational order events', () => {
    const events = [
      // Core Order
      'ORDER_CREATED',
      'ORDER_UPDATED',
      'ORDER_CANCELED',
      'ORDER_CANCELLED',
      'ORDER_TABLE_CHANGED',
      'ORDER_TYPE_CHANGED',
      'ORDER_SPLIT',
      'ORDER_MERGED',
      'ORDER_STATUS_CHANGED',
      'GUEST_COUNT_CHANGED',
      'SERVER_ASSIGNED',
      // Items
      'ITEM_ADDED',
      'ITEM_REMOVED',
      'ITEM_QUANTITY_CHANGED',
      'ITEM_OPTIONS_CHANGED',
      'ITEM_NOTE_CHANGED',
      'ITEM_PRICE_CHANGED',
      'ITEM_RESTORED',
      // Kitchen
      'KITCHEN_SENT',
      'KITCHEN_ITEM_READY',
      // Payment
      'PAYMENT_REQUESTED',
      'PAYMENT_REQUEST_ACCEPTED',
      'PAYMENT_REQUEST_REJECTED',
      'PAYMENT_REQUEST_CANCELLED',
      'PAYMENT_DEFERRED',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILED',
      // QR Order
      'QR_ROUND_SUBMITTED',
      'QR_BUFFET_ROUND_SUBMITTED',
      'QR_ORDER_CONFIRMED',
      'QR_ORDER_REJECTED',
      'CUSTOMER_ORDER_ADDED',
      'HELP_REQUESTED',
      'STAFF_CALLED',
      // Buffet & Table
      'BUFFET_ACTIVATED',
      'BUFFET_CANCELLED',
      'BUFFET_PACKAGE_CHANGED',
      'BUFFET_GUEST_COUNT_CHANGED',
      'TABLE_STATUS_CHANGED',
      'TABLE_SESSION_OPENED',
      'TABLE_SESSION_CLOSED',
      'CUSTOMER_REDEEMED_ITEM',
    ];

    for (const eventType of events) {
      const payload = buildOrderNotificationPayload({
        eventType,
        orderCode: 'AVO-L81-0001',
        orderType: 'DINE_IN',
        tableName: 'Bàn M08',
        oldTableName: 'Bàn M01',
        newTableName: 'Bàn M08',
        oldOrderType: 'DINE_IN',
        newOrderType: 'TAKEAWAY',
        totalAmount: 250000,
        customerName: 'Nguyễn Văn A',
        actorName: 'Nhân viên B',
        pointsUsed: 500,
        itemName: 'Set Sashimi',
        quantity: 2,
        paymentMethod: 'BANK_TRANSFER',
        gateway: 'PAYOS',
        reason: 'Khách đổi ý',
        note: 'Không hành',
        optionsText: 'Ít đường, Không đá',
        changeDetails: { addedItems: ['2x Gà nướng'] },
        itemsSummary: '2x Gà nướng',
        buffetPackageName: 'Buffet Nướng Lẩu 299K',
      });

      expect(payload.title).toBeTruthy();
      expect(payload.message).toBeTruthy();
      expect(payload.icon).toBeTruthy();
      expect(payload.priority).toBeTruthy();
      expect(payload.message).not.toContain('Bàn Bàn');
    }
  });

  it('correctly constructs ITEM_ADDED and ITEM_REMOVED messages', () => {
    const addPayload = buildOrderNotificationPayload({
      eventType: 'ITEM_ADDED',
      orderCode: 'AVO-001',
      tableName: 'M07',
      actorName: 'HTP Official',
      itemsSummary: '3x Sushi Cá Hồi',
    });
    expect(addPayload.title).toBe('Thêm món vào đơn');
    expect(addPayload.message).toContain('HTP Official đã thêm 3x Sushi Cá Hồi vào đơn #AVO-001 tại bàn M07.');

    const remPayload = buildOrderNotificationPayload({
      eventType: 'ITEM_REMOVED',
      orderCode: 'AVO-002',
      tableName: 'M08',
      actorName: 'Nguyễn Văn A',
      itemsSummary: '2x Mỳ Trứng',
    });
    expect(remPayload.title).toBe('Xóa món khỏi đơn');
    expect(remPayload.message).toContain('Nguyễn Văn A đã xóa 2x Mỳ Trứng khỏi đơn #AVO-002 tại bàn M08.');
  });
});
