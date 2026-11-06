import { BankCryptoService } from './services/bank-crypto.service';
import { BankParserService } from './services/bank-parser.service';
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
});

