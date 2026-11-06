import { BankParserService } from './bank-parser.service';

describe('BankParserService (Vietcombank Transaction Parser)', () => {
  let parser: BankParserService;

  beforeEach(() => {
    parser = new BankParserService();
  });

  const TEST_FIXTURE = `Số dư TK VCB 1019224767 +110,000 VND lúc 03-11-2026 12:54:11.
Số dư 599,511 VND.
Ref LE MINH DAT chuyen tien#SP#020097042211031 254102026GWRL685139.5388.32602.125400`;

  it('1. Phân tích chính xác 100% TEST FIXTURE từ Vietcombank', () => {
    const res = parser.parseVietcombankNotification(TEST_FIXTURE);

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    const data = res.data!;

    expect(data.bank).toBe('VIETCOMBANK');
    expect(data.accountNumber).toBe('1019224767');
    expect(data.direction).toBe('CREDIT');
    expect(data.amount).toBe(110000n);
    expect(data.currency).toBe('VND');
    expect(data.balanceAfter).toBeNull();
    expect(data.occurredAt).toBe('2026-11-03T12:54:11+07:00');
    expect(data.counterparty).toBe('LE MINH DAT');
    expect(data.transferContent).toBe('chuyen tien#SP#020097042211031');
    expect(data.bankReference).toBe('254102026GWRL685139.5388.32602.125400');
  });

  it('2. Phân tích giao dịch TIỀN RA (DEBIT / Chi tiền)', () => {
    const rawDebit = `Số dư TK VCB 1019224767 -45,000 VND lúc 04-11-2026 09:15:00.
Số dư 554,511 VND.
Ref NGUYEN VAN B thanh toan hoa don tien ich MBVCB.123456789`;

    const res = parser.parseVietcombankNotification(rawDebit);

    expect(res.success).toBe(true);
    const data = res.data!;
    expect(data.direction).toBe('DEBIT');
    expect(data.amount).toBe(45000n);
    expect(data.balanceAfter).toBeNull();
    expect(data.counterparty).toBe('NGUYEN VAN B');
    expect(data.bankReference).toBe('MBVCB.123456789');
  });

  it('3. Xử lý số tiền có dấu chấm phân cách hàng nghìn kiểu Việt Nam', () => {
    const rawDot = `Số dư TK VCB 1019224767 +1.250.000 VND lúc 05-11-2026 10:00:00.
Số dư 1.849.511 VND.
Ref TRAN THI C chuyen tien mua hang FT261105001234`;

    const res = parser.parseVietcombankNotification(rawDot);

    expect(res.success).toBe(true);
    const data = res.data!;
    expect(data.amount).toBe(1250000n);
    expect(data.balanceAfter).toBeNull();
  });

  it('4. Phân tích thông báo bị THIẾU SỐ DƯ sau giao dịch', () => {
    const rawNoBalance = `Số dư TK VCB 1019224767 +200,000 VND lúc 05-11-2026 11:20:00.
Ref HOANG VAN D ung ho quy tu thien 254102026GWRL999999.1111`;

    const res = parser.parseVietcombankNotification(rawNoBalance);

    expect(res.success).toBe(true);
    const data = res.data!;
    expect(data.amount).toBe(200000n);
    expect(data.balanceAfter).toBeNull();
  });

  it('5. Phân tích thông báo KHÔNG CÓ MÃ THAM CHIẾU ngân hàng rõ ràng', () => {
    const rawNoRef = `Số dư TK VCB 1019224767 +50,000 VND lúc 05-11-2026 08:30:00.
Ref chuyen khoan noi bo`;

    const res = parser.parseVietcombankNotification(rawNoRef);

    expect(res.success).toBe(true);
    const data = res.data!;
    expect(data.amount).toBe(50000n);
    expect(data.bankReference).toBeNull();
    expect(data.transferContent).toBe('chuyen khoan noi bo');
  });

  it('6. Từ chối thông báo KHÔNG PHẢI BIẾN ĐỘNG SỐ DƯ (Quảng cáo, cảnh báo bảo mật VCB)', () => {
    const marketingText = `VCB Digibank: Chuong trinh uu dai hoan tien 10% khi mo the tin dung quoc te Vietcombank. Chi tiet xem tai website vietcombank.com.vn`;
    const res = parser.parseVietcombankNotification(marketingText);

    expect(res.success).toBe(false);
    expect(res.isFinancialNotification).toBe(false);
  });

  it('7. Từ chối thông báo TỪ NGÂN HÀNG KHÁC (Không phải Vietcombank)', () => {
    const otherBank = `Số dư TK Techcombank 1903333333 +500,000 VND lúc 05-11-2026 10:00:00. Ref ABC`;
    const res = parser.parseVietcombankNotification(otherBank);

    expect(res.success).toBe(false);
    expect(res.error).toContain('không phải từ Vietcombank');
  });

  it('8. Xử lý thông báo rỗng hoặc không hợp lệ', () => {
    expect(parser.parseVietcombankNotification('').success).toBe(false);
    expect(parser.parseVietcombankNotification('   ').success).toBe(false);
  });

  it('9. Phân tích chính xác thông báo biến động OCB OMNI thực tế', () => {
    const ocbNotification = `Thông báo biến động số dư
05/11 15:57
Tài khoản: 0839654952
Số tiền: +10,000 VND
Số dư: 10,563 VND
Nội dung: HUYNH THANH PHAT chuyen tien qua MoMo`;

    const res = parser.parseNotification(ocbNotification, 'OCB');
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    const data = res.data!;
    expect(data.bank).toBe('OCB');
    expect(data.accountNumber).toBe('0839654952');
    expect(data.direction).toBe('CREDIT');
    expect(data.amount).toBe(10000n);
    expect(data.balanceAfter).toBeNull();
    expect(data.transferContent).toBe('HUYNH THANH PHAT chuyen tien qua MoMo');
  });
});

