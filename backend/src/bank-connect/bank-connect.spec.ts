import { describe, beforeAll, it, expect } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BankCryptoService } from './services/bank-crypto.service';
import { BankParserService } from './services/bank-parser.service';
import { BankConnectService } from './services/bank-connect.service';
import { BankConnectController } from './bank-connect.controller';
import * as crypto from 'crypto';

describe('BankConnect Core Security & Logic Integration', () => {
  let bankCrypto: BankCryptoService;
  let bankParser: BankParserService;

  // Cặp khóa EC P-256 dùng để test ký số
  let keyPair: crypto.KeyPairSyncResult<string, string>;

  beforeAll(() => {
    bankCrypto = new BankCryptoService();
    bankParser = new BankParserService();

    keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1', // NIST P-256
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  });

  it('1. Tạo và xác minh chữ ký số ECDSA (SHA256withECDSA) hợp lệ', () => {
    const deviceId = 'test-android-device-001';
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
    const payload = JSON.stringify({
      eventId: 'evt-001',
      amount: 110000,
      bank: 'VIETCOMBANK',
    });

    const canonicalString = bankCrypto.createCanonicalString(deviceId, timestamp, nonce, payload);

    // Ký bằng private key EC P-256
    const sign = crypto.createSign('SHA256');
    sign.update(canonicalString, 'utf8');
    sign.end();
    const signatureBase64 = sign.sign(keyPair.privateKey, 'base64');

    // Xác thực chữ ký bằng public key
    const isValid = bankCrypto.verifySignature(canonicalString, signatureBase64, keyPair.publicKey);
    expect(isValid).toBe(true);
  });

  it('2. Từ chối chữ ký số khi payload hoặc canonical message bị thay đổi (Tampering attack)', () => {
    const deviceId = 'test-android-device-001';
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
    const originalPayload = JSON.stringify({ eventId: 'evt-001', amount: 110000 });
    const tamperedPayload = JSON.stringify({ eventId: 'evt-001', amount: 999999999 });

    const originalCanonical = bankCrypto.createCanonicalString(deviceId, timestamp, nonce, originalPayload);
    const tamperedCanonical = bankCrypto.createCanonicalString(deviceId, timestamp, nonce, tamperedPayload);

    const sign = crypto.createSign('SHA256');
    sign.update(originalCanonical, 'utf8');
    sign.end();
    const signatureBase64 = sign.sign(keyPair.privateKey, 'base64');

    // Kiểm tra chữ ký với nội dung đã bị thay đổi
    const isValid = bankCrypto.verifySignature(tamperedCanonical, signatureBase64, keyPair.publicKey);
    expect(isValid).toBe(false);
  });

  it('3. Từ chối Nonce đã sử dụng (Chống Replay Attack)', () => {
    const timestamp = Date.now().toString();
    const nonce = 'unique-nonce-12345';

    // Lần 1: Hợp lệ
    expect(() => bankCrypto.validateTimestampAndNonce(timestamp, nonce)).not.toThrow();

    // Lần 2 với cùng Nonce: Phải ném UnauthorizedException
    expect(() => bankCrypto.validateTimestampAndNonce(timestamp, nonce)).toThrow(
      'Replay attack detected: Nonce đã được sử dụng',
    );
  });

  it('4. Từ chối Request có Timestamp quá cũ hoặc trong tương lai (> 300s)', () => {
    const expiredTimestamp = (Date.now() - 350 * 1000).toString(); // Quá khứ 350s
    const nonce = crypto.randomUUID();

    expect(() => bankCrypto.validateTimestampAndNonce(expiredTimestamp, nonce)).toThrow(
      'Request đã hết hạn hoặc lệch thời gian so với máy chủ',
    );
  });

  it('5. Tạo Fingerprint duy nhất và phát hiện giao dịch trùng lặp', () => {
    const bank = 'VIETCOMBANK';
    const account = '1019224767';
    const direction = 'CREDIT';
    const amount = 110000n;
    const occurredAt = '2026-11-03T12:54:11+07:00';
    const ref = '254102026GWRL685139.5388.32602.125400';

    const fp1 = bankCrypto.createTransactionFingerprint(bank, account, direction, amount, occurredAt, ref);
    const fp2 = bankCrypto.createTransactionFingerprint(bank, account, direction, amount, occurredAt, ref);
    const fp3 = bankCrypto.createTransactionFingerprint(bank, account, direction, amount, occurredAt, 'DIFFERENT_REF');

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });

  describe('Safe Unmatched Transaction Cleanup & OTA Single-Source Verification', () => {
    let service: BankConnectService;
    let controller: BankConnectController;
    let mockTransactions: any[];
    let mockLogs: any[];
    let mockOrderMatches: any[];
    let mockOrderPayments: any[];
    let mockPrisma: any;
    let mockPosGateway: any;

    beforeEach(() => {
      mockTransactions = [];
      mockLogs = [];
      mockOrderMatches = [
        { id: 'match-1', transactionId: 'tx-matched-1', orderId: 'order-1', matchedAmount: 150000n },
      ];
      mockOrderPayments = [
        { id: 'pay-1', orderId: 'order-1', amount: 150000, method: 'BANK_TRANSFER' },
      ];

      mockPrisma = {
        bankTransaction: {
          findMany: jest.fn(async ({ where }: any) => {
            return mockTransactions.filter((t) => {
              if (where?.isArchived !== undefined && t.isArchived !== where.isArchived) {
                return false;
              }
              if (where?.orderId === null && t.orderId !== null) {
                return false;
              }
              if (where?.matchingStatus?.in && !where.matchingStatus.in.includes(t.matchingStatus)) {
                return false;
              }
              if (where?.matchingStatus && typeof where.matchingStatus === 'string' && t.matchingStatus !== where.matchingStatus) {
                return false;
              }
              if (where?.orderMatches?.none) {
                const hasMatch = mockOrderMatches.some((m) => m.transactionId === t.id);
                if (hasMatch) return false;
              }
              return true;
            });
          }),
          count: jest.fn(async ({ where }: any) => {
            const list = await mockPrisma.bankTransaction.findMany({ where });
            return list.length;
          }),
          findUnique: jest.fn(async ({ where }: any) => {
            const found = mockTransactions.find(
              (t) => (where.id && t.id === where.id) || (where.eventId && t.eventId === where.eventId),
            );
            if (!found) return null;
            return {
              ...found,
              orderMatches: mockOrderMatches.filter((m) => m.transactionId === found.id),
            };
          }),
          update: jest.fn(async ({ where, data }: any) => {
            const idx = mockTransactions.findIndex((t) => t.id === where.id);
            if (idx >= 0) {
              mockTransactions[idx] = { ...mockTransactions[idx], ...data };
              return mockTransactions[idx];
            }
            return null;
          }),
          updateMany: jest.fn(async ({ where, data }: any) => {
            let count = 0;
            mockTransactions = mockTransactions.map((t) => {
              const idMatch = !where.id?.in || where.id.in.includes(t.id);
              const archiveMatch = where.isArchived === undefined || t.isArchived === where.isArchived;
              const orderMatch = where.orderId === undefined || t.orderId === where.orderId;
              const statusMatch = !where.matchingStatus?.in || where.matchingStatus.in.includes(t.matchingStatus);
              if (idMatch && archiveMatch && orderMatch && statusMatch) {
                count++;
                return { ...t, ...data };
              }
              return t;
            });
            return { count };
          }),
          delete: jest.fn(),
          deleteMany: jest.fn(),
        },
        bankConnectionLog: {
          create: jest.fn(async ({ data }: any) => {
            const entry = { id: `log-${mockLogs.length + 1}`, ...data };
            mockLogs.push(entry);
            return entry;
          }),
        },
        $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      };

      mockPosGateway = {
        server: {
          to: jest.fn().mockReturnThis(),
          emit: jest.fn(),
        },
      };

      service = new BankConnectService(
        mockPrisma as any,
        bankCrypto,
        bankParser,
        {} as any,
        mockPosGateway as any,
      );
      controller = new BankConnectController(service, {} as any);
    });

    it('Scenario 1: Không có giao dịch chưa khớp -> trả về count = 0 và thông báo rõ ràng', async () => {
      const res = await service.deleteAllUnmatchedTransactions('admin-1');
      expect(res.success).toBe(true);
      expect(res.count).toBe(0);
      expect(res.archivedIds).toEqual([]);
      expect(res.message).toContain('Không có giao dịch chưa khớp nào đủ điều kiện dọn dẹp');
      expect(mockPrisma.bankTransaction.deleteMany).not.toHaveBeenCalled();
    });

    it('Scenario 2: Có 1 giao dịch chưa khớp -> dọn dẹp (archive) đúng 1 giao dịch và ghi audit log', async () => {
      mockTransactions.push({
        id: 'tx-unmatched-1',
        eventId: 'evt-unmatched-1',
        amount: 50000n,
        matchingStatus: 'UNMATCHED',
        orderId: null,
        isArchived: false,
      });

      const res = await service.deleteAllUnmatchedTransactions('admin-user-99', 'Dọn dẹp cuối ca');
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
      expect(res.archivedEventIds).toEqual(['evt-unmatched-1']);
      expect(mockTransactions[0].isArchived).toBe(true);
      expect(mockTransactions[0].archivedByUserId).toBe('admin-user-99');
      expect(mockTransactions[0].archiveReason).toBe('Dọn dẹp cuối ca');
      expect(mockTransactions[0].archivedAt).toBeInstanceOf(Date);
      expect(mockLogs.length).toBe(1);
      expect(mockLogs[0].action).toBe('CLEANUP_UNMATCHED_TX');
      expect(mockPrisma.bankTransaction.deleteMany).not.toHaveBeenCalled();
    });

    it('Scenario 3: Có nhiều giao dịch chưa khớp (UNMATCHED, IGNORED, DUPLICATE) -> dọn dẹp toàn bộ các mục đủ điều kiện', async () => {
      mockTransactions.push(
        { id: 'tx-1', eventId: 'evt-1', amount: 10000n, matchingStatus: 'UNMATCHED', orderId: null, isArchived: false },
        { id: 'tx-2', eventId: 'evt-2', amount: 20000n, matchingStatus: 'IGNORED', orderId: null, isArchived: false },
        { id: 'tx-3', eventId: 'evt-3', amount: 30000n, matchingStatus: 'DUPLICATE', orderId: null, isArchived: false },
      );

      const res = await service.deleteAllUnmatchedTransactions('admin-1');
      expect(res.count).toBe(3);
      expect(mockTransactions.every((t) => t.isArchived === true)).toBe(true);
    });

    it('Scenario 4 & 5: Có đồng thời giao dịch MATCHED, REVIEW_REQUIRED và UNMATCHED -> chỉ archive UNMATCHED, giữ nguyên MATCHED và REVIEW_REQUIRED', async () => {
      mockTransactions.push(
        { id: 'tx-matched-1', eventId: 'evt-m1', amount: 150000n, matchingStatus: 'MATCHED', orderId: 'order-1', isArchived: false },
        { id: 'tx-review-1', eventId: 'evt-r1', amount: 250000n, matchingStatus: 'REVIEW_REQUIRED', orderId: null, isArchived: false },
        { id: 'tx-review-order', eventId: 'evt-r2', amount: 320000n, matchingStatus: 'REVIEW_REQUIRED', orderId: 'order-2', isArchived: false },
        { id: 'tx-unmatched-1', eventId: 'evt-u1', amount: 45000n, matchingStatus: 'UNMATCHED', orderId: null, isArchived: false },
      );

      const res = await service.deleteAllUnmatchedTransactions('admin-1');
      expect(res.count).toBe(1);
      expect(res.archivedIds).toEqual(['tx-unmatched-1']);

      const matched = mockTransactions.find((t) => t.id === 'tx-matched-1');
      const review1 = mockTransactions.find((t) => t.id === 'tx-review-1');
      const review2 = mockTransactions.find((t) => t.id === 'tx-review-order');
      const unmatched = mockTransactions.find((t) => t.id === 'tx-unmatched-1');

      expect(matched.isArchived).toBe(false);
      expect(review1.isArchived).toBe(false);
      expect(review2.isArchived).toBe(false);
      expect(unmatched.isArchived).toBe(true);

      // Chặn xóa đơn lẻ nếu giao dịch là MATCHED hoặc REVIEW_REQUIRED
      await expect(service.deleteUnmatchedTransaction('tx-matched-1', 'admin-1')).rejects.toThrow(BadRequestException);
      await expect(service.deleteUnmatchedTransaction('tx-review-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('Scenario 6: Chưa đăng nhập Admin hoặc sai role -> từ chối thực hiện với ForbiddenException', async () => {
      await expect(controller.deleteAllUnmatchedTransactions({ user: null })).rejects.toThrow(ForbiddenException);
      await expect(
        controller.deleteAllUnmatchedTransactions({ user: { id: 'u-2', role: 'STAFF' } }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Scenario 7 & 8: Bấm lặp lại nhiều lần liên tiếp (Idempotency) -> lần 2 trả về count = 0 và không tạo lỗi', async () => {
      mockTransactions.push({
        id: 'tx-u1',
        eventId: 'evt-u1',
        amount: 60000n,
        matchingStatus: 'UNMATCHED',
        orderId: null,
        isArchived: false,
      });

      const firstRun = await service.deleteAllUnmatchedTransactions('admin-1');
      expect(firstRun.count).toBe(1);

      const secondRun = await service.deleteAllUnmatchedTransactions('admin-1');
      expect(secondRun.count).toBe(0);
      expect(secondRun.success).toBe(true);
    });

    it('Scenario 9 & 10: Đồng bộ lại sau khi dọn dẹp -> giao dịch đã dọn dẹp không xuất hiện lại, nhưng bản ghi gốc BankTransaction, BankTransactionOrderMatch, OrderPayment vẫn còn nguyên vẹn', async () => {
      mockTransactions.push(
        { id: 'tx-matched-1', eventId: 'evt-m1', amount: 150000n, matchingStatus: 'MATCHED', orderId: 'order-1', isArchived: false },
        { id: 'tx-unmatched-1', eventId: 'evt-u1', amount: 50000n, matchingStatus: 'UNMATCHED', orderId: null, isArchived: false },
      );

      await service.deleteAllUnmatchedTransactions('admin-1');

      // Khi Android gọi getTransactions() để đồng bộ lại: chỉ trả về giao dịch chưa bị archive
      const syncResult = await service.getTransactions({ page: 1, limit: 50 });
      expect(syncResult.items.length).toBe(1);
      expect(syncResult.items[0].id).toBe('tx-matched-1');

      // Kiểm tra dữ liệu tài chính gốc trong DB vẫn còn nguyên 100% (không bị hard-delete)
      expect(mockTransactions.length).toBe(2);
      expect(mockOrderMatches.length).toBe(1);
      expect(mockOrderPayments.length).toBe(1);
      expect(mockPrisma.bankTransaction.delete).not.toHaveBeenCalled();
      expect(mockPrisma.bankTransaction.deleteMany).not.toHaveBeenCalled();
    });

    it('Scenario 11: OTA Metadata trả về đầy đủ packageName, versionName 1.0.5, versionCode 6, fileSize và sha256', () => {
      const meta = service.getLatestApkMetadata();
      expect(meta.packageName).toBe('vn.avora.bankconnect');
      expect(meta.versionName).toBe('1.0.5');
      expect(meta.versionCode).toBe(6);
      expect(meta.downloadUrl).toBe('https://avorafnb.com/api/bank-connect/v1/app/download-latest');
      expect(typeof meta.sha256).toBe('string');
      expect(typeof meta.fileSize).toBe('number');
    });
  });
});

