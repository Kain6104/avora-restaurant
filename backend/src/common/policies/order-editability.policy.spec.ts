import { OrderStatus } from '@prisma/client';
import { OrderEditabilityPolicy } from './order-editability.policy';

describe('OrderEditabilityPolicy (M08 Payment Lock Regression)', () => {
  it('allows editing items and financials when Waiter only requests payment (PAYMENT_REQUESTED / HELD)', () => {
    const assessment = OrderEditabilityPolicy.evaluate({
      status: OrderStatus.HELD,
      paymentStatus: 'PAYMENT_REQUESTED',
      paymentIntentStatus: 'NONE',
      paymentLockedAt: null,
      isDeleted: false,
    });

    expect(assessment.category).toBe('DRAFT_UNPAID');
    expect(assessment.canEditItems).toBe(true);
    expect(assessment.canEditSurcharges).toBe(true);
    expect(assessment.canEditDiscounts).toBe(true);
  });

  it('locks order as PAYMENT_ACTIVE only when paymentIntentStatus is ACTIVE or paymentStatus is AWAITING_PAYMENT', () => {
    const intentActive = OrderEditabilityPolicy.evaluate({
      status: OrderStatus.PREPARING,
      paymentStatus: 'AWAITING_PAYMENT',
      paymentIntentStatus: 'ACTIVE',
      isDeleted: false,
    });

    expect(intentActive.category).toBe('PAYMENT_ACTIVE');
    expect(intentActive.canEditItems).toBe(false);
    expect(intentActive.canEditSurcharges).toBe(false);
    expect(intentActive.canEditDiscounts).toBe(false);
  });
});
