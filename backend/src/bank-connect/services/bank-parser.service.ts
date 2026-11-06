import { Injectable, Logger } from '@nestjs/common';

export interface ParsedBankTransaction {
  bank: string;
  accountNumber: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: bigint;
  currency: string;
  balanceAfter: bigint | null;
  occurredAt: string; // ISO 8601 with +07:00
  counterparty: string | null;
  transferContent: string | null;
  bankReference: string | null;
  rawText: string;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedBankTransaction;
  error?: string;
  isFinancialNotification: boolean;
}

@Injectable()
export class BankParserService {
  private readonly logger = new Logger(BankParserService.name);

  /**
   * Phân tích thông báo ngân hàng đa nền tảng (VCB, BIDV, VietinBank, MB, Techcombank, ACB, Generic)
   */
  parseNotification(rawText: string, bankHint?: string): ParseResult {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return { success: false, error: 'Thông báo trống', isFinancialNotification: false };
    }

    const normalized = rawText.normalize('NFC').replace(/\r\n/g, '\n').trim();

    // 1. Nhận diện ngân hàng
    if (bankHint === 'VIETCOMBANK' || /VCB|Vietcombank/i.test(normalized)) {
      return this.parseVietcombankNotification(normalized);
    }
    if (bankHint === 'BIDV' || /BIDV/i.test(normalized)) {
      return this.parseBidvNotification(normalized);
    }
    if (bankHint === 'VIETINBANK' || /VietinBank|iPay/i.test(normalized)) {
      return this.parseVietinbankNotification(normalized);
    }
    if (bankHint === 'MB' || /MBBank|MB Bank/i.test(normalized)) {
      return this.parseMbNotification(normalized);
    }
    if (bankHint === 'TECHCOMBANK' || /Techcombank|TCB/i.test(normalized)) {
      return this.parseTechcombankNotification(normalized);
    }
    if (bankHint === 'ACB' || /ACB/i.test(normalized)) {
      return this.parseAcbNotification(normalized);
    }
    if (bankHint === 'OCB' || /OCB|Phương Đông|Phuong Dong/i.test(normalized)) {
      return this.parseOcbNotification(normalized);
    }

    // Fallback: Generic Bank Parser
    return this.parseGenericNotification(normalized);
  }

  /**
   * Phân tích nội dung thông báo Vietcombank (App Notification hoặc SMS)
   */
  parseVietcombankNotification(rawText: string): ParseResult {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return { success: false, error: 'Thông báo trống', isFinancialNotification: false };
    }

    const cleaned = rawText.normalize('NFC').replace(/\r\n/g, '\n').trim();

    // 1. Kiểm tra nhận dạng Vietcombank
    const isVcb = /VCB|Vietcombank/i.test(cleaned);
    if (!isVcb) {
      return {
        success: false,
        error: 'Thông báo không phải từ Vietcombank',
        isFinancialNotification: false,
      };
    }

    // 2. Kiểm tra có phải thông báo biến động số dư tài khoản
    const isBalanceChange =
      /(?:Số dư|Số dư|SD|TK|Tài khoản).*(?:[+-]|\btang\b|\bgiam\b).*VND/i.test(cleaned) ||
      /Ref[\s\S]+/i.test(cleaned);

    if (!isBalanceChange) {
      return {
        success: false,
        error: 'Nội dung không phải là biến động số dư',
        isFinancialNotification: false,
      };
    }

    try {
      // 3. Bóc tách số tài khoản
      const accountMatch = cleaned.match(/(?:TK(?:\s+VCB)?|Tài khoản)\s*([0-9]{8,15})/i);
      const accountNumber = accountMatch ? accountMatch[1].trim() : null;

      if (!accountNumber) {
        return {
          success: false,
          error: 'Không tìm thấy số tài khoản hợp lệ trong thông báo',
          isFinancialNotification: true,
        };
      }

      // 4. Bóc tách chiều giao dịch & số tiền
      const amountRegex = /([+-])\s*([\d,.]+)\s*(?:VND|đ|d)/i;
      const amountMatch = cleaned.match(amountRegex);

      let direction: 'CREDIT' | 'DEBIT' | null = null;
      let amountBigInt: bigint | null = null;

      if (amountMatch) {
        direction = amountMatch[1] === '+' ? 'CREDIT' : 'DEBIT';
        const numClean = amountMatch[2].replace(/[,.]/g, '');
        amountBigInt = BigInt(numClean);
      } else {
        const altMatch = cleaned.match(/(tang|giam|nhan|thanh toan)\s+([\d,.]+)\s*(?:VND|đ|d)/i);
        if (altMatch) {
          direction = /tang|nhan/i.test(altMatch[1]) ? 'CREDIT' : 'DEBIT';
          const numClean = altMatch[2].replace(/[,.]/g, '');
          amountBigInt = BigInt(numClean);
        }
      }

      if (!direction || amountBigInt === null || amountBigInt <= 0n) {
        return {
          success: false,
          error: 'Không xác định được số tiền hoặc chiều giao dịch',
          isFinancialNotification: true,
        };
      }

      // 5. Bóc tách thời gian giao dịch (hỗ trợ cả lúc, lúc, và dấu chấm kết thúc câu)
      const timeRegex = /(?:lúc|lúc)\s+(\d{2})[-/](\d{2})[-/](\d{4}|\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/i;
      const timeMatch = cleaned.match(timeRegex);

      let occurredAtIso: string;
      if (timeMatch) {
        const day = timeMatch[1];
        const month = timeMatch[2];
        let year = timeMatch[3];
        if (year.length === 2) year = `20${year}`;
        const hour = timeMatch[4];
        const min = timeMatch[5];
        const sec = timeMatch[6] || '00';
        occurredAtIso = `${year}-${month}-${day}T${hour}:${min}:${sec}+07:00`;
      } else {
        occurredAtIso = this.getCurrentVietnamTimeIso();
      }

      // 6. Số dư sau giao dịch: Quyền riêng tư AVORA, không lưu trữ balanceAfter
      const balanceAfter: bigint | null = null;

      // 7. Bóc tách khối Ref (Counterparty, Transfer Content, Bank Reference)
      let counterparty: string | null = null;
      let transferContent: string | null = null;
      let bankReference: string | null = null;

      const refLineMatch = cleaned.match(/Ref\s*[\n\r]?\s*([^\n\r]+)/i);
      if (refLineMatch && refLineMatch[1]) {
        const fullRef = refLineMatch[1].trim();
        const tokens = fullRef.split(/\s+/);

        if (tokens.length >= 2) {
          const lastToken = tokens[tokens.length - 1];
          // Token cuối có đặc điểm của bank ref
          if (/[0-9]/.test(lastToken) && (lastToken.length >= 8 || lastToken.includes('.') || /GWRL|VCB|FT/i.test(lastToken))) {
            bankReference = lastToken;
            const remainingTokens = tokens.slice(0, -1);

            let nameTokensCount = 0;
            for (let i = 0; i < remainingTokens.length; i++) {
              const t = remainingTokens[i];
              if (/^[A-ZÀ-Ỹ]+$/.test(t) && !t.includes('#')) {
                nameTokensCount++;
              } else {
                break;
              }
            }

            if (nameTokensCount > 0 && nameTokensCount <= 5) {
              counterparty = remainingTokens.slice(0, nameTokensCount).join(' ');
              transferContent = remainingTokens.slice(nameTokensCount).join(' ');
            } else {
              transferContent = remainingTokens.join(' ');
            }
          } else {
            transferContent = fullRef;
          }
        } else {
          // Chuỗi đơn liền nhau (ví dụ: PARTNER.DIRECT_DEBITS_VCB.MSE.155243618142.20261105.155243618142-0839654952_TMPS2PS5H)
          transferContent = fullRef;
          if (/[0-9]/.test(fullRef) && (fullRef.length >= 10 || fullRef.includes('.'))) {
            bankReference = fullRef;
          }
        }
      }

      const parsed: ParsedBankTransaction = {
        bank: 'VIETCOMBANK',
        accountNumber,
        direction,
        amount: amountBigInt,
        currency: 'VND',
        balanceAfter,
        occurredAt: occurredAtIso,
        counterparty: counterparty?.trim() || null,
        transferContent: transferContent?.trim() || null,
        bankReference: bankReference?.trim() || null,
        rawText: cleaned,
      };

      return {
        success: true,
        data: parsed,
        isFinancialNotification: true,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi phân tích thông báo Vietcombank: ${error.message}`);
      return {
        success: false,
        error: `Lỗi phân tích cú pháp: ${error.message}`,
        isFinancialNotification: true,
      };
    }
  }

  /**
   * Phân tích thông báo BIDV SmartBanking
   */
  parseBidvNotification(rawText: string): ParseResult {
    const cleaned = rawText.normalize('NFC').trim();
    const accountMatch = cleaned.match(/(?:TK|Tai khoan)\s*([0-9]{8,16})/i);
    const amountMatch = cleaned.match(/([+-])\s*([\d,.]+)\s*(?:VND|đ)/i);
    if (!accountMatch || !amountMatch) {
      return { success: false, error: 'Không khớp định dạng BIDV', isFinancialNotification: false };
    }
    const direction = amountMatch[1] === '+' ? 'CREDIT' : 'DEBIT';
    const amount = BigInt(amountMatch[2].replace(/[,.]/g, ''));
    return {
      success: true,
      data: {
        bank: 'BIDV',
        accountNumber: accountMatch[1],
        direction,
        amount,
        currency: 'VND',
        balanceAfter: null,
        occurredAt: this.getCurrentVietnamTimeIso(),
        counterparty: null,
        transferContent: cleaned,
        bankReference: null,
        rawText: cleaned,
      },
      isFinancialNotification: true,
    };
  }

  /**
   * Phân tích thông báo VietinBank iPay
   */
  parseVietinbankNotification(rawText: string): ParseResult {
    const cleaned = rawText.normalize('NFC').trim();
    const accountMatch = cleaned.match(/(?:TK|Tai khoan)\s*([0-9]{8,16})/i);
    const amountMatch = cleaned.match(/([+-])\s*([\d,.]+)\s*(?:VND|đ)/i);
    if (!accountMatch || !amountMatch) {
      return { success: false, error: 'Không khớp định dạng VietinBank', isFinancialNotification: false };
    }
    const direction = amountMatch[1] === '+' ? 'CREDIT' : 'DEBIT';
    const amount = BigInt(amountMatch[2].replace(/[,.]/g, ''));
    return {
      success: true,
      data: {
        bank: 'VIETINBANK',
        accountNumber: accountMatch[1],
        direction,
        amount,
        currency: 'VND',
        balanceAfter: null,
        occurredAt: this.getCurrentVietnamTimeIso(),
        counterparty: null,
        transferContent: cleaned,
        bankReference: null,
        rawText: cleaned,
      },
      isFinancialNotification: true,
    };
  }

  /**
   * Phân tích thông báo MB Bank
   */
  parseMbNotification(rawText: string): ParseResult {
    const cleaned = rawText.normalize('NFC').trim();
    const accountMatch = cleaned.match(/(?:TK|Tai khoan)\s*([0-9]{8,16})/i);
    const amountMatch = cleaned.match(/([+-])\s*([\d,.]+)\s*(?:VND|đ)/i);
    if (!accountMatch || !amountMatch) {
      return { success: false, error: 'Không khớp định dạng MB Bank', isFinancialNotification: false };
    }
    const direction = amountMatch[1] === '+' ? 'CREDIT' : 'DEBIT';
    const amount = BigInt(amountMatch[2].replace(/[,.]/g, ''));
    return {
      success: true,
      data: {
        bank: 'MBBANK',
        accountNumber: accountMatch[1],
        direction,
        amount,
        currency: 'VND',
        balanceAfter: null,
        occurredAt: this.getCurrentVietnamTimeIso(),
        counterparty: null,
        transferContent: cleaned,
        bankReference: null,
        rawText: cleaned,
      },
      isFinancialNotification: true,
    };
  }

  /**
   * Phân tích thông báo Techcombank
   */
  parseTechcombankNotification(rawText: string): ParseResult {
    const cleaned = rawText.normalize('NFC').trim();
    const accountMatch = cleaned.match(/(?:TK|Tai khoan)\s*([0-9]{8,16})/i);
    const amountMatch = cleaned.match(/([+-])\s*([\d,.]+)\s*(?:VND|đ)/i);
    if (!accountMatch || !amountMatch) {
      return { success: false, error: 'Không khớp định dạng Techcombank', isFinancialNotification: false };
    }
    const direction = amountMatch[1] === '+' ? 'CREDIT' : 'DEBIT';
    const amount = BigInt(amountMatch[2].replace(/[,.]/g, ''));
    return {
      success: true,
      data: {
        bank: 'TECHCOMBANK',
        accountNumber: accountMatch[1],
        direction,
        amount,
        currency: 'VND',
        balanceAfter: null,
        occurredAt: this.getCurrentVietnamTimeIso(),
        counterparty: null,
        transferContent: cleaned,
        bankReference: null,
        rawText: cleaned,
      },
      isFinancialNotification: true,
    };
  }

  /**
   * Phân tích thông báo ACB
   */
  parseAcbNotification(rawText: string): ParseResult {
    const cleaned = rawText.normalize('NFC').trim();
    const accountMatch = cleaned.match(/(?:TK|Tai khoan)\s*([0-9]{8,16})/i);
    const amountMatch = cleaned.match(/([+-])\s*([\d,.]+)\s*(?:VND|đ)/i);
    if (!accountMatch || !amountMatch) {
      return { success: false, error: 'Không khớp định dạng ACB', isFinancialNotification: false };
    }
    const direction = amountMatch[1] === '+' ? 'CREDIT' : 'DEBIT';
    const amount = BigInt(amountMatch[2].replace(/[,.]/g, ''));
    return {
      success: true,
      data: {
        bank: 'ACB',
        accountNumber: accountMatch[1],
        direction,
        amount,
        currency: 'VND',
        balanceAfter: null,
        occurredAt: this.getCurrentVietnamTimeIso(),
        counterparty: null,
        transferContent: cleaned,
        bankReference: null,
        rawText: cleaned,
      },
      isFinancialNotification: true,
    };
  }

  /**
   * Phân tích thông báo OCB (Ngân hàng TMCP Phương Đông / OCB OMNI)
   */
  parseOcbNotification(rawText: string): ParseResult {
    const cleaned = rawText.normalize('NFC').trim();
    const accountMatch = cleaned.match(/(?:Tài khoản|Tai khoan|TK|STK)\s*[:\s]\s*([0-9]{6,16})/i);
    const amountMatch = cleaned.match(/(?:Số tiền|So tien)?\s*[:\s]?\s*([+-])\s*([\d,.]+)\s*(?:VND|đ|d)?/i);
    if (!accountMatch || !amountMatch) {
      return { success: false, error: 'Không khớp định dạng OCB', isFinancialNotification: false };
    }
    const direction = amountMatch[1] === '+' ? 'CREDIT' : 'DEBIT';
    const amount = BigInt(amountMatch[2].replace(/[,.]/g, ''));

    let transferContent: string | null = null;
    const contentMatch = cleaned.match(/(?:^|\n)\s*(?:Nội dung|Noi dung|\bND\b|Lý do)\s*[:\s]\s*([^\r\n]+)/i);
    if (contentMatch) {
      transferContent = contentMatch[1].trim();
    }

    return {
      success: true,
      data: {
        bank: 'OCB',
        accountNumber: accountMatch[1],
        direction,
        amount,
        currency: 'VND',
        balanceAfter: null,
        occurredAt: this.getCurrentVietnamTimeIso(),
        counterparty: null,
        transferContent: transferContent || cleaned,
        bankReference: null,
        rawText: cleaned,
      },
      isFinancialNotification: true,
    };
  }

  /**
   * Generic Bank Parser dự phòng (Chỉ bóc tách khi có dấu hiệu biến động số dư ngân hàng rõ ràng)
   */
  parseGenericNotification(rawText: string): ParseResult {
    const cleaned = rawText.normalize('NFC').trim();

    // 1. Chặn tuyệt đối tin nhắn chat OTT / mạng xã hội / không phải tài chính
    const isSocialOrChat = /(?:nhóm:|nhom:|phê duyệt thành viên|tin nhắn từ|gui tin nhan|zalo|viber|telegram|facebook|messenger)/i.test(cleaned);
    if (isSocialOrChat) {
      return { success: false, error: 'Thông báo tin nhắn mạng xã hội / OTT không phải biến động ngân hàng', isFinancialNotification: false };
    }

    // 2. Phải có từ khóa tài chính / ngân hàng xác thực
    const hasFinancialKeywords = /(?:biến động số dư|bien dong so du|số dư|so du|giao dịch thành công|giao dich thanh cong|thanh toán thành công|nhận được tiền|tài khoản|tai khoan|số TK|so TK|\bTK\b|\bSTK\b)/i.test(cleaned);
    if (!hasFinancialKeywords) {
      return { success: false, error: 'Không chứa từ khóa biến động tài chính', isFinancialNotification: false };
    }

    // 3. Khớp số tiền có định dạng chuẩn kèm đơn vị tiền tệ VND/VNĐ/đồng (tránh bắt nhầm năm học 2026/2027)
    const amountMatch = cleaned.match(/(?:Số tiền|So tien)?\s*[:\s]?\s*([+-])\s*([\d,.]+)\s*(?:VND|VNĐ|đ\b|đồng\b)/i) ||
      cleaned.match(/(?:Số tiền|So tien)\s*[:\s]\s*([+-]?)\s*([\d,.]+)/i);

    if (!amountMatch) {
      return { success: false, error: 'Không nhận diện được số tiền hợp lệ', isFinancialNotification: false };
    }

    const direction = amountMatch[1] === '-' ? 'DEBIT' : 'CREDIT';
    const cleanAmountStr = (amountMatch[2] || amountMatch[1]).replace(/[,.]/g, '');
    const amount = BigInt(cleanAmountStr);
    if (amount <= 0n) {
      return { success: false, error: 'Số tiền không hợp lệ', isFinancialNotification: false };
    }

    const accountMatch = cleaned.match(/(?:TK|Tai khoan|Tài khoản|STK)\s*[:\s]\s*([0-9*]{4,16})/i);
    return {
      success: true,
      data: {
        bank: 'GENERIC',
        accountNumber: accountMatch ? accountMatch[1] : 'UNKNOWN',
        direction,
        amount,
        currency: 'VND',
        balanceAfter: null,
        occurredAt: this.getCurrentVietnamTimeIso(),
        counterparty: null,
        transferContent: cleaned,
        bankReference: null,
        rawText: cleaned,
      },
      isFinancialNotification: true,
    };
  }

  private getCurrentVietnamTimeIso(): string {
    const now = new Date();
    const offsetMs = 7 * 60 * 60 * 1000;
    const vnDate = new Date(now.getTime() + offsetMs);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = vnDate.getUTCFullYear();
    const mm = pad(vnDate.getUTCMonth() + 1);
    const dd = pad(vnDate.getUTCDate());
    const hh = pad(vnDate.getUTCHours());
    const min = pad(vnDate.getUTCMinutes());
    const ss = pad(vnDate.getUTCSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+07:00`;
  }
}
