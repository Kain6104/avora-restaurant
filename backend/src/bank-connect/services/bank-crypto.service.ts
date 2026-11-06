import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class BankCryptoService {
  private readonly logger = new Logger(BankCryptoService.name);

  // Bộ nhớ đệm lưu nonce chống replay attack (TTL 10 phút)
  private readonly usedNonces = new Map<string, number>();
  private readonly NONCE_TTL_MS = 10 * 60 * 1000;
  private readonly MAX_TIME_SKEW_SEC = 300; // +- 5 phút

  constructor() {
    // Dọn dẹp nonce cũ định kỳ mỗi 5 phút (unref để không block event loop khi test)
    const timer = setInterval(() => this.cleanupExpiredNonces(), 5 * 60 * 1000);
    if (timer.unref) timer.unref();
  }

  /**
   * Tạo chuỗi thông điệp chuẩn hóa để kiểm tra chữ ký
   */
  createCanonicalString(deviceId: string, timestamp: string, nonce: string, bodyJson: string): string {
    const bodyHash = crypto.createHash('sha256').update(bodyJson, 'utf8').digest('hex');
    return `${deviceId}:${timestamp}:${nonce}:${bodyHash}`;
  }

  /**
   * Tạo fingerprint duy nhất cho giao dịch ngân hàng nhằm chống trùng lặp tuyệt đối
   */
  createTransactionFingerprint(
    bank: string,
    accountNumber: string,
    direction: string,
    amount: bigint | string | number,
    occurredAt: string | Date,
    bankReference?: string,
  ): string {
    const occurredAtStr = occurredAt instanceof Date ? occurredAt.toISOString() : new Date(occurredAt).toISOString();
    const ref = (bankReference || '').trim();
    const raw = `${bank.toUpperCase().trim()}|${accountNumber.trim()}|${direction.toUpperCase().trim()}|${amount.toString()}|${occurredAtStr}|${ref}`;
    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  /**
   * Kiểm tra tính hợp lệ của timestamp và nonce
   */
  validateTimestampAndNonce(timestampStr: string, nonce: string): void {
    const nowMs = Date.now();
    let reqTimeMs: number;

    // Hỗ trợ cả ISO 8601 string và Unix timestamp ms
    if (/^\d+$/.test(timestampStr)) {
      reqTimeMs = parseInt(timestampStr, 10);
      if (reqTimeMs < 100000000000) reqTimeMs *= 1000; // Giây -> Mili-giây
    } else {
      reqTimeMs = new Date(timestampStr).getTime();
    }

    if (isNaN(reqTimeMs)) {
      throw new BadRequestException('Header X-Timestamp không đúng định dạng');
    }

    const diffSec = Math.abs((nowMs - reqTimeMs) / 1000);
    if (diffSec > this.MAX_TIME_SKEW_SEC) {
      this.logger.warn(`Timestamp skew quá lớn: ${diffSec}s so với server time (cho phép tối đa ${this.MAX_TIME_SKEW_SEC}s)`);
      throw new UnauthorizedException('Request đã hết hạn hoặc lệch thời gian so với máy chủ');
    }

    // Kiểm tra nonce chống Replay Attack
    if (this.usedNonces.has(nonce)) {
      this.logger.warn(`Phát hiện Replay Attack với Nonce: ${nonce}`);
      throw new UnauthorizedException('Replay attack detected: Nonce đã được sử dụng');
    }

    this.usedNonces.set(nonce, nowMs + this.NONCE_TTL_MS);
  }

  /**
   * Xác thực chữ ký số ECDSA (NIST P-256 / SHA256withECDSA) bằng Public Key của thiết bị
   */
  verifySignature(
    canonicalMessage: string,
    signatureBase64: string,
    publicKeyPem: string,
  ): boolean {
    try {
      // Chuẩn hóa định dạng PEM nếu thiết bị gửi raw base64
      let formattedPem = publicKeyPem.trim();
      if (!formattedPem.includes('BEGIN PUBLIC KEY')) {
        formattedPem = `-----BEGIN PUBLIC KEY-----\n${formattedPem}\n-----END PUBLIC KEY-----`;
      }

      const verify = crypto.createVerify('SHA256');
      verify.update(canonicalMessage, 'utf8');
      verify.end();

      const signatureBuffer = Buffer.from(signatureBase64, 'base64');
      const isValid = verify.verify(formattedPem, signatureBuffer);

      return isValid;
    } catch (error: any) {
      this.logger.error(`Lỗi khi xác minh chữ ký ECDSA: ${error.message}`);
      return false;
    }
  }

  private cleanupExpiredNonces(): void {
    const now = Date.now();
    for (const [nonce, expiresAt] of this.usedNonces.entries()) {
      if (now > expiresAt) {
        this.usedNonces.delete(nonce);
      }
    }
  }
}
