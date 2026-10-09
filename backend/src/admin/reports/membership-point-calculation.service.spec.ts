import {
  MembershipPointCalculationService,
  MembershipTierInput,
  UserPointSnapshotInput,
  MembershipOrderInput,
  PointTransactionInput,
} from './membership-point-calculation.service';
import { PointTransactionSource } from '@prisma/client';

describe('MembershipPointCalculationService', () => {
  let service: MembershipPointCalculationService;

  beforeEach(() => {
    service = new MembershipPointCalculationService();
  });

  const mockTiers: MembershipTierInput[] = [
    {
      id: 't1',
      name: 'Standard',
      minSpending: 0,
      pointMultiplier: 1,
      discountPercent: 0,
      isActive: true,
    },
    {
      id: 't2',
      name: 'VIP Gold',
      minSpending: 5000000,
      pointMultiplier: 1.5,
      discountPercent: 10,
      isActive: true,
    },
  ];

  const mockUsers: UserPointSnapshotInput[] = [
    {
      id: 'u1',
      fullName: 'Khách A',
      phone: '0901111111',
      memberCode: 'AV001',
      membershipTierId: 't1',
      membershipTierName: 'Standard',
      points: 150,
      currentPoints: 150,
      totalSpending: 1500000,
    },
    {
      id: 'u2',
      fullName: 'Khách B (Bị lệch sổ cái)',
      phone: '0902222222',
      memberCode: 'AV002',
      membershipTierId: 't2',
      membershipTierName: 'VIP Gold',
      points: 500,
      currentPoints: 500, // In DB says 500
      totalSpending: 6000000,
    },
  ];

  const mockTransactions: PointTransactionInput[] = [
    // User 1: Earned 200, redeemed 50 -> Balance = 150 (Matches DB 150)
    {
      id: 'pt1',
      userId: 'u1',
      membershipTierId: 't1',
      membershipTierName: 'Standard',
      balanceBefore: 0,
      amount: 200,
      balanceAfter: 200,
      source: PointTransactionSource.ORDER_EARN,
      orderId: 'ord1',
      orderCode: 'AV-001',
      referenceCode: null,
      description: 'Tích điểm đơn hoàn thành',
      expiresAt: new Date('2026-12-31T23:59:59Z'),
      createdBy: 'SYSTEM',
      createdAt: new Date('2026-09-01T12:00:00Z'),
    },
    {
      id: 'pt2',
      userId: 'u1',
      membershipTierId: 't1',
      membershipTierName: 'Standard',
      balanceBefore: 200,
      amount: -50,
      balanceAfter: 150,
      source: PointTransactionSource.ORDER_PAYMENT,
      orderId: 'ord2',
      orderCode: 'AV-002',
      referenceCode: null,
      description: 'Tiêu điểm cho đơn hàng',
      expiresAt: null,
      createdBy: 'SYSTEM',
      createdAt: new Date('2026-09-02T12:00:00Z'),
    },
    // User 2: Only 1 transaction of 400 points earned -> Ledger balance = 400, but DB currentPoints = 500!
    {
      id: 'pt3',
      userId: 'u2',
      membershipTierId: 't2',
      membershipTierName: 'VIP Gold',
      balanceBefore: 0,
      amount: 400,
      balanceAfter: 400,
      source: PointTransactionSource.ORDER_EARN,
      orderId: 'ord3',
      orderCode: 'AV-003',
      referenceCode: null,
      description: 'Tích điểm',
      expiresAt: new Date('2026-09-18T23:59:59Z'), // Expiring soon
      createdBy: 'SYSTEM',
      createdAt: new Date('2026-09-03T12:00:00Z'),
    },
  ];

  it('should reconcile point ledgers and detect discrepancy', () => {
    const reconciliations = service.reconcilePointLedgers(mockUsers, mockTransactions);
    expect(reconciliations.length).toBe(2);

    const r1 = reconciliations.find((r) => r.userId === 'u1');
    expect(r1).toBeDefined();
    expect(r1?.calculatedClosingBalance).toBe(150);
    expect(r1?.databaseCurrentPoints).toBe(150);
    expect(r1?.isReconciled).toBe(true);
    expect(r1?.reconciliationStatus).toBe('MATCHED');

    const r2 = reconciliations.find((r) => r.userId === 'u2');
    expect(r2).toBeDefined();
    expect(r2?.calculatedClosingBalance).toBe(400);
    expect(r2?.databaseCurrentPoints).toBe(500);
    expect(r2?.isReconciled).toBe(false);
    expect(r2?.discrepancy).toBe(-100);
    expect(r2?.reconciliationStatus).toBe('DISCREPANCY_DETECTED');
  });

  it('should calculate Point Liability based on outstanding points', () => {
    const liabilities = service.calculatePointLiability(mockTiers, mockUsers, mockTransactions, new Date(), 1000);
    expect(liabilities.length).toBe(2);

    const goldTier = liabilities.find((l) => l.tierName === 'VIP Gold');
    expect(goldTier).toBeDefined();
    expect(goldTier?.outstandingPoints).toBe(500);
    // 500 points * 1000 VND = 500,000 VND
    expect(goldTier?.estimatedLiabilityVnd).toBe(500000);
  });
});
