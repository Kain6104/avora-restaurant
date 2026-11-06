import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PosGateway } from '../../pos/pos.gateway';
import { CheckoutGateway } from '../../order/checkout.gateway';
import {
  PaymentRecordStatus,
  OrderStatus,
  OrderSource,
  SlotOrderType,
  TableSessionStatus,
  ShiftStatus,
} from '@prisma/client';

export interface MatchingResult {
  matched: boolean;
  status: 'MATCHED' | 'UNMATCHED' | 'REVIEW_REQUIRED' | 'DUPLICATE' | 'IGNORED';
  orderId?: string;
  orderCode?: string;
  reason?: string;
}

function normalizeCode(str: string): string {
  if (!str) return '';
  return str.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

@Injectable()
export class OrderMatchingService {
  private readonly logger = new Logger(OrderMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posGateway: PosGateway,
    private readonly checkoutGateway: CheckoutGateway,
  ) { }

  /**
   * Đối soát tự động giao dịch ngân hàng với các đơn hàng AVORA
   * Tuân thủ kiến trúc: Tận dụng cấu hình PaymentMethod TRANSFER hiện có trong DB
   */
  async matchAndReconcile(bankTx: any): Promise<MatchingResult> {
    const txId = bankTx.id;
    const amountNum = Number(bankTx.amount);
    const direction = bankTx.direction;
    const transferContent = (bankTx.transferContent || '').normalize('NFC');
    const bankRef = bankTx.bankReference || '';
    const rawAccount = bankTx.accountNumber || '';

    // 1. Chỉ xem xét giao dịch tiền vào (CREDIT)
    if (direction !== 'CREDIT') {
      this.logger.log(`Giao dịch ${txId} là DEBIT (-${amountNum}đ), bỏ qua đối soát đơn hàng`);
      await this.prisma.bankTransaction.update({
        where: { id: txId },
        data: { matchingStatus: 'IGNORED' },
      });
      return { matched: false, status: 'IGNORED', reason: 'Giao dịch DEBIT (tiền ra)' };
    }

    // 2. Account Validation động từ cấu hình PaymentMethod đang hoạt động
    // Tuyệt đối không hardcode số tài khoản trong source code
    const activeTransferMethods = await this.prisma.paymentMethod.findMany({
      where: {
        isActive: true,
        OR: [
          { methodCode: 'TRANSFER' },
          { gatewayType: 'TRANSFER' },
        ],
      },
    });

    if (activeTransferMethods.length === 0) {
      this.logger.warn(`Không tìm thấy phương thức thanh toán TRANSFER nào đang kích hoạt trong DB.`);
      await this.prisma.bankTransaction.update({
        where: { id: txId },
        data: { matchingStatus: 'REVIEW_REQUIRED' },
      });
      return { matched: false, status: 'REVIEW_REQUIRED', reason: 'Chưa kích hoạt cấu hình chuyển khoản trong PaymentMethod' };
    }

    // Xác thực tài khoản nhận tiền khớp với tài khoản trong cấu hình PaymentMethod
    const matchedPaymentMethod = activeTransferMethods.find((m) => {
      if (!m.accountNumber) return false;
      const cleanMethodAcc = m.accountNumber.trim().replace(/\s+/g, '');
      const cleanRawAcc = (rawAccount || '').trim().replace(/\s+/g, '');
      const cleanMasked = (bankTx.accountNumberMasked || '').trim().replace(/\s+/g, '');

      // So sánh theo số tài khoản đầy đủ hoặc số đuôi
      const matchesAcc = cleanRawAcc && (cleanRawAcc.includes(cleanMethodAcc) || cleanMethodAcc.includes(cleanRawAcc));
      const matchesMasked = cleanMasked && (cleanMethodAcc.endsWith(cleanMasked.replace(/\*/g, '')) || cleanMasked.endsWith(cleanMethodAcc.slice(-4)));

      // So sánh mã ngân hàng (VD: VCB, VIETCOMBANK)
      const mBank = (m.bankCode || '').toUpperCase().trim();
      const txBank = (bankTx.bank || '').toUpperCase().trim();
      const matchesBank = !mBank || txBank.includes(mBank) || (mBank === 'VCB' && txBank.includes('VIETCOM'));

      return (matchesAcc || matchesMasked) && matchesBank;
    });

    if (!matchedPaymentMethod) {
      this.logger.warn(
        `Giao dịch ${txId} không thuộc tài khoản nhận tiền nào trong cấu hình PaymentMethod (Nhận vào: ${rawAccount}, Masked: ${bankTx.accountNumberMasked}). Đánh dấu IGNORED.`,
      );
      await this.prisma.bankTransaction.update({
        where: { id: txId },
        data: { matchingStatus: 'IGNORED' },
      });
      return { matched: false, status: 'IGNORED', reason: 'Không phải tài khoản nhận tiền đã cấu hình trong PaymentMethod' };
    }

    // 3. Kiểm tra xem giao dịch này đã được sử dụng đối soát cho đơn hàng nào khác chưa
    const existingMatch = await this.prisma.bankTransactionOrderMatch.findFirst({
      where: { transactionId: txId },
    });
    if (existingMatch || bankTx.orderId) {
      this.logger.warn(`Giao dịch ${txId} đã được đối soát trước đó (OrderId: ${existingMatch?.orderId || bankTx.orderId})`);
      return { matched: false, status: 'DUPLICATE', reason: 'Giao dịch đã được sử dụng đối soát trước đó' };
    }

    // 4. Trích xuất các mã tham chiếu / mã đơn hàng tiềm năng từ transferContent
    const extractedCodes = this.extractPotentialOrderCodes(transferContent);

    if (extractedCodes.length === 0) {
      this.logger.warn(`Không tìm thấy mã tham chiếu nào trong nội dung: "${transferContent}". Chuyển REVIEW_REQUIRED`);
      await this.prisma.bankTransaction.update({
        where: { id: txId },
        data: { matchingStatus: 'REVIEW_REQUIRED' },
      });
      this.broadcastReviewRequired(bankTx, 'Không trích xuất được mã đơn hàng từ nội dung chuyển khoản');
      return { matched: false, status: 'REVIEW_REQUIRED', reason: 'Thiếu mã đơn hàng trong nội dung chuyển khoản' };
    }

    // 5. Tìm kiếm đơn hàng phù hợp trong database
    const matchedOrder = await this.findOrderCandidates(extractedCodes, amountNum);

    if (!matchedOrder) {
      this.logger.warn(`Không tìm thấy đơn hàng tương ứng cho các mã: [${extractedCodes.join(', ')}]. Chuyển REVIEW_REQUIRED`);
      await this.prisma.bankTransaction.update({
        where: { id: txId },
        data: { matchingStatus: 'REVIEW_REQUIRED' },
      });
      this.broadcastReviewRequired(bankTx, `Không tìm thấy đơn hàng tương ứng mã: ${extractedCodes.join(', ')}`);
      return { matched: false, status: 'REVIEW_REQUIRED', reason: `Không tìm thấy đơn hàng tương ứng mã: ${extractedCodes.join(', ')}` };
    }

    // 6. Kiểm tra trạng thái đơn hàng và tính số tiền còn phải thanh toán
    const existingPayments = await this.prisma.orderPayment.findMany({
      where: {
        orderId: matchedOrder.id,
        status: PaymentRecordStatus.COMPLETED,
      },
    });
    const alreadyPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remainingAmount = Math.max(0, matchedOrder.totalAmount - alreadyPaid);

    if (remainingAmount <= 0 || matchedOrder.paymentStatus === 'PAID') {
      this.logger.warn(
        `[OVERPAID_DUPLICATE] Đơn hàng ${matchedOrder.orderCode || matchedOrder.temporaryOrderCode || matchedOrder.id} đã thanh toán đủ trước đó (${alreadyPaid.toLocaleString('vi-VN')}đ / ${matchedOrder.totalAmount.toLocaleString('vi-VN')}đ). Giao dịch mới ${txId} (${amountNum.toLocaleString('vi-VN')}đ) là chuyển trùng.`,
      );

      // Cập nhật trạng thái OVERPAID_DUPLICATE
      await this.prisma.bankTransaction.update({
        where: { id: txId },
        data: { matchingStatus: 'OVERPAID_DUPLICATE', orderId: matchedOrder.id },
      });

      // Tạo bản ghi OverpaidRefund để theo dõi quy trình hoàn tiền
      await this.prisma.overpaidRefund.upsert({
        where: { transactionId: txId },
        create: {
          transactionId: txId,
          orderId: matchedOrder.id,
          overpaidAmount: BigInt(amountNum),
          status: 'REFUND_PENDING',
          notes: `Khách hàng chuyển trùng cho đơn ${matchedOrder.orderCode || matchedOrder.temporaryOrderCode || matchedOrder.id}`,
        },
        update: {
          status: 'REFUND_PENDING',
        },
      });

      // Phát cảnh báo Realtime tới POS và Web Admin
      if (this.posGateway?.server) {
        const alertData = {
          orderId: matchedOrder.id,
          orderCode: matchedOrder.orderCode || matchedOrder.temporaryOrderCode,
          tableName: (matchedOrder as any).table?.name || 'Mang đi',
          branchId: matchedOrder.branchId,
          orderTotalAmount: matchedOrder.totalAmount,
          overpaidAmount: amountNum,
          transactionId: txId,
          bankReference: bankRef,
          occurredAt: bankTx.occurredAt,
          message: `PHÁT HIỆN KHÁCH CHUYỂN KHOẢN TRÙNG! Đơn ${matchedOrder.orderCode || matchedOrder.temporaryOrderCode} đã thanh toán đủ, nhận thêm ${amountNum.toLocaleString('vi-VN')}đ.`,
        };
        this.posGateway.server.to(`branch:${matchedOrder.branchId}`).emit('OVERPAID_DUPLICATE_ALERT', alertData);
        this.posGateway.server.to('admin:global').emit('OVERPAID_DUPLICATE_ALERT', alertData);
      }

      return {
        matched: false,
        status: 'OVERPAID_DUPLICATE' as any,
        orderId: matchedOrder.id,
        reason: 'Đơn hàng đã được thanh toán đủ trước đó - Phát hiện chuyển khoản trùng',
      };
    }

    // 7. Kiểm tra số tiền: phải khớp số tiền còn phải thanh toán
    if (Math.abs(amountNum - remainingAmount) > 0.01) {
      this.logger.warn(
        `Số tiền chuyển (${amountNum.toLocaleString('vi-VN')}đ) không khớp số tiền còn phải thanh toán (${remainingAmount.toLocaleString('vi-VN')}đ) của đơn ${matchedOrder.orderCode || matchedOrder.temporaryOrderCode || matchedOrder.id}. Chuyển REVIEW_REQUIRED`,
      );
      await this.prisma.bankTransaction.update({
        where: { id: txId },
        data: { matchingStatus: 'REVIEW_REQUIRED', orderId: matchedOrder.id },
      });
      this.broadcastReviewRequired(
        bankTx,
        `Số tiền (${amountNum.toLocaleString('vi-VN')}đ) khác số tiền cần trả (${remainingAmount.toLocaleString('vi-VN')}đ) cho đơn ${matchedOrder.orderCode || matchedOrder.temporaryOrderCode || matchedOrder.id}`,
      );
      return {
        matched: false,
        status: 'REVIEW_REQUIRED',
        orderId: matchedOrder.id,
        reason: `Lệch số tiền: nhận ${amountNum}đ, cần ${remainingAmount}đ`,
      };
    }

    // 8. Thực hiện cập nhật Database Transaction Atomic & Concurrency Safe
    try {
      const matchResult = await this.prisma.$transaction(async (tx) => {
        // Double check trạng thái giao dịch trong transaction để tránh race condition
        const currentTx = await tx.bankTransaction.findUnique({
          where: { id: txId },
        });
        if (currentTx?.matchingStatus === 'MATCHED') {
          throw new Error('Giao dịch đã được đối soát bởi một tiến trình khác');
        }

        // Xác định loại đơn hàng POS / Tại bàn
        const isPosOrder =
          matchedOrder.orderSource === OrderSource.POS ||
          matchedOrder.orderType === SlotOrderType.DINE_IN ||
          Boolean(matchedOrder.tableId) ||
          Boolean(matchedOrder.temporaryOrderCode);

        let officialOrderCode = matchedOrder.orderCode;
        if (isPosOrder && (!officialOrderCode || officialOrderCode.startsWith('POS-') || officialOrderCode.startsWith('TMP-'))) {
          try {
            if (matchedOrder.branchId) {
              const branch = await tx.branch.findUnique({
                where: { id: matchedOrder.branchId },
                select: { branchCode: true },
              });
              const branchCode = (branch?.branchCode || 'AVO1').trim().toUpperCase();
              const d = new Date();
              const dateStr = `${d.getDate().toString().padStart(2, '0')}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getFullYear().toString().slice(-2)}`;
              const seq = await tx.orderSequence.upsert({
                where: { branchId_date_type: { branchId: matchedOrder.branchId, date: dateStr, type: 'POS' } },
                create: { branchId: matchedOrder.branchId, date: dateStr, type: 'POS', lastNumber: 1 },
                update: { lastNumber: { increment: 1 } },
              });
              officialOrderCode = `${branchCode}-${dateStr}-${seq.lastNumber.toString().padStart(4, '0')}`;
            }
          } catch (codeErr: any) {
            this.logger.warn('Lỗi sinh mã hóa đơn POS chính thức:', codeErr);
            officialOrderCode = matchedOrder.temporaryOrderCode || matchedOrder.orderCode;
          }
        }

        // a. Cập nhật BankTransaction -> MATCHED
        const updatedBankTx = await tx.bankTransaction.update({
          where: { id: txId },
          data: {
            matchingStatus: 'MATCHED',
            orderId: matchedOrder.id,
            matchedAt: new Date(),
          },
        });

        // b. Tạo bản ghi OrderPayment với paymentMethod = 'TRANSFER'
        const orderPayment = await tx.orderPayment.create({
          data: {
            orderId: matchedOrder.id,
            paymentMethod: 'TRANSFER',
            amount: remainingAmount,
            status: PaymentRecordStatus.COMPLETED,
            transactionRef: bankRef || `VCB-${bankTx.eventId}`,
            note: `Tự động đối soát từ VCB Gateway (Ref: ${bankRef || 'N/A'}, Người gửi: ${bankTx.counterparty || 'N/A'})`,
          },
        });

        // c. Cập nhật Order: chuyển paymentStatus -> PAID, cấp mã HĐ chính thức, chuyển COMPLETED cho đơn POS
        const updatedOrder = await tx.order.update({
          where: { id: matchedOrder.id },
          data: {
            orderCode: officialOrderCode || matchedOrder.orderCode,
            paymentStatus: 'PAID',
            paymentMethod: 'TRANSFER',
            transactionId: bankRef || bankTx.eventId,
            status: isPosOrder ? OrderStatus.COMPLETED : (matchedOrder.status === OrderStatus.PENDING ? OrderStatus.CONFIRMED : matchedOrder.status),
            completedAt: isPosOrder ? (matchedOrder.completedAt || new Date()) : matchedOrder.completedAt,
            deliveredAt: isPosOrder ? (matchedOrder.deliveredAt || new Date()) : matchedOrder.deliveredAt,
            confirmedAt: matchedOrder.confirmedAt || new Date(),
            version: { increment: 1 },
          },
          include: {
            branch: true,
            table: true,
            tableSession: true,
            orderItems: { include: { product: true } },
          },
        });

        // d. Đóng TableSession nếu có
        if (matchedOrder.tableSessionId) {
          await tx.tableSession.update({
            where: { id: matchedOrder.tableSessionId },
            data: { status: TableSessionStatus.CLOSED, closedAt: new Date() },
          }).catch((err: any) => this.logger.warn('Lỗi đóng TableSession:', err));
        }

        // e. Giải phóng bàn ăn trên POS và Waiter (chuyển sang VACANT)
        if (matchedOrder.tableId) {
          this.posGateway?.emitTableStatusChanged(
            matchedOrder.branchId,
            matchedOrder.tableId,
            'VACANT',
            null,
            null,
          );
        }

        // f. Tìm ca thu ngân đang mở và cập nhật doanh thu
        if (matchedOrder.branchId) {
          const activeShift = await tx.cashShift.findFirst({
            where: {
              branchId: matchedOrder.branchId,
              status: ShiftStatus.OPEN,
              ...(matchedOrder.cashierId ? { cashierId: matchedOrder.cashierId } : {}),
            },
          });

          if (activeShift) {
            await tx.cashShift.update({
              where: { id: activeShift.id },
              data: {
                totalRevenue: { increment: remainingAmount },
                totalTransfer: { increment: remainingAmount },
                orderCount: { increment: 1 },
              },
            }).catch(() => { });

            const refreshedShift = await tx.cashShift.findUnique({ where: { id: activeShift.id } });
            if (refreshedShift) {
              this.posGateway?.emitShiftUpdated(matchedOrder.branchId, refreshedShift);
            }
          }
        }

        // g. Ghi nhận BankTransactionOrderMatch
        await tx.bankTransactionOrderMatch.create({
          data: {
            transactionId: txId,
            orderId: matchedOrder.id,
            matchedAmount: BigInt(amountNum),
            matchedBy: 'AUTO_GATEWAY',
            notes: `Khớp tự động: ${transferContent}`,
          },
        });

        return { updatedBankTx, orderPayment, updatedOrder };
      });

      // 9. Phát tín hiệu WebSocket Realtime tới POS và Admin
      this.broadcastOrderMatched(matchResult.updatedOrder, matchResult.orderPayment, matchResult.updatedBankTx);

      this.logger.log(
        `[✓] ĐÃ ĐỐI SOÁT THÀNH CÔNG đơn hàng ${matchedOrder.orderCode || matchedOrder.temporaryOrderCode || matchedOrder.id} với số tiền ${amountNum.toLocaleString('vi-VN')}đ`,
      );

      return {
        matched: true,
        status: 'MATCHED',
        orderId: matchedOrder.id,
        orderCode: matchedOrder.orderCode || matchedOrder.temporaryOrderCode || matchedOrder.id,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi thực hiện database transaction đối soát đơn hàng: ${error.message}`, error.stack);
      await this.prisma.bankTransaction.update({
        where: { id: txId },
        data: { matchingStatus: 'REVIEW_REQUIRED' },
      }).catch(() => { });
      return { matched: false, status: 'REVIEW_REQUIRED', orderId: matchedOrder.id, reason: error.message };
    }
  }

  /**
   * Re-match một giao dịch cụ thể đang ở trạng thái REVIEW_REQUIRED hoặc UNMATCHED
   */
  async reMatchTransaction(txId: string): Promise<MatchingResult> {
    let bankTx = await this.prisma.bankTransaction.findUnique({
      where: { id: txId },
    });

    if (!bankTx) {
      bankTx = await this.prisma.bankTransaction.findUnique({
        where: { eventId: txId },
      });
    }

    if (!bankTx) {
      this.logger.warn(`Không tìm thấy giao dịch ID hoặc eventId: ${txId}`);
      throw new NotFoundException(`Không tìm thấy giao dịch ID hoặc Event ID: ${txId}`);
    }

    if (bankTx.matchingStatus === 'MATCHED') {
      return {
        matched: true,
        status: 'MATCHED',
        orderId: bankTx.orderId || undefined,
        reason: 'Giao dịch đã được khớp lệnh trước đó',
      };
    }

    return this.matchAndReconcile(bankTx);
  }

  /**
   * Khớp đơn hàng thủ công do Admin thực hiện từ giao diện Quản trị / Android App
   */
  async manualMatch(txId: string, orderId: string, userId: string, notes?: string): Promise<any> {
    let bankTx = await this.prisma.bankTransaction.findUnique({
      where: { id: txId },
    });
    if (!bankTx) {
      bankTx = await this.prisma.bankTransaction.findUnique({
        where: { eventId: txId },
      });
    }

    if (!bankTx) {
      throw new NotFoundException(`Giao dịch không tồn tại (ID/EventId: ${txId})`);
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { branch: true, table: true },
    });

    if (!order) {
      throw new NotFoundException(`Đơn hàng không tồn tại (ID: ${orderId})`);
    }

    const amountNum = Number(bankTx.amount);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedBankTx = await tx.bankTransaction.update({
        where: { id: bankTx.id },
        data: {
          matchingStatus: 'MANUALLY_MATCHED',
          orderId: order.id,
          matchedAt: new Date(),
        },
      });

      const orderPayment = await tx.orderPayment.create({
        data: {
          orderId: order.id,
          paymentMethod: 'TRANSFER',
          amount: amountNum,
          status: PaymentRecordStatus.COMPLETED,
          transactionRef: bankTx.bankReference || `MANUAL-${txId}`,
          note: `Khớp thủ công bởi Admin (User: ${userId}). Ghi chú: ${notes || 'Không'}`,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          paymentMethod: 'TRANSFER',
          transactionId: bankTx.bankReference || bankTx.eventId,
          status: order.status === OrderStatus.PENDING ? OrderStatus.CONFIRMED : order.status,
          confirmedAt: order.confirmedAt || new Date(),
          version: { increment: 1 },
        },
      });

      await tx.bankTransactionOrderMatch.create({
        data: {
          transactionId: bankTx.id,
          orderId: order.id,
          matchedAmount: BigInt(amountNum),
          matchedBy: userId,
          notes: notes || 'Admin đối soát thủ công',
        },
      });

      return { updatedBankTx, orderPayment, updatedOrder };
    });

    this.broadcastOrderMatched(result.updatedOrder, result.orderPayment, result.updatedBankTx);
    return result;
  }

  /**
   * Trích xuất các chuỗi có khả năng là mã đơn hàng từ transfer content
   * Hỗ trợ chuẩn hóa đa dạng: TMP, ORD, AV, HD, POS, DH, SP, phân cách bởi _, ., -, space
   */
  public extractPotentialOrderCodes(content: string): string[] {
    if (!content) return [];
    const normalized = content.normalize('NFC');
    const results = new Set<string>();

    // 1. Mã đơn hàng AVORA chuẩn bao gồm cả TMP (ví dụ: TMP-S2PS5H, TMPS2PS5H, ORD-12345, AV1234)
    const patternPrefix = /(?:ORD|AV|HD|POS|DH|TMP)[-_]?[A-Z0-9]{3,16}/gi;
    const matchesPrefix = normalized.match(patternPrefix);
    if (matchesPrefix) {
      matchesPrefix.forEach((m) => {
        const raw = m.toUpperCase().trim();
        results.add(raw);
        const clean = normalizeCode(raw);
        results.add(clean);

        // Sinh các biến thể có dấu gạch ngang (TMP-xxxx, ORD-xxxx, POS-xxxx)
        for (const pre of ['TMP', 'ORD', 'AV', 'HD', 'POS', 'DH']) {
          if (clean.startsWith(pre) && clean.length > pre.length) {
            results.add(`${pre}-${clean.slice(pre.length)}`);
            results.add(clean.slice(pre.length));
          }
        }
      });
    }

    // 2. Định dạng #SP#xxxx hoặc SP#xxxx hoặc SPxxxx
    const patternSp = /#?SP#?([A-Za-z0-9]{5,20})/gi;
    let spMatch;
    while ((spMatch = patternSp.exec(normalized)) !== null) {
      if (spMatch[1]) {
        const spCode = spMatch[1].toUpperCase().trim();
        results.add(spCode);
        results.add(`SP#${spCode}`);
        results.add(`#SP#${spCode}`);
        results.add(`SP${spCode}`);
      }
    }

    // 3. Tách các token phân cách bởi dấu _, ., -, #, /, không gian trắng
    // Đặc biệt xử lý các chuỗi như: PARTNER.DIRECT_DEBITS_VCB.MSE.155243618142.20261105.155243618142-0839654952_TMPS2PS5H
    const delimiterTokens = normalized.split(/[_.\-#\s/:]+/);
    for (const token of delimiterTokens) {
      const cleanToken = token.toUpperCase().trim();
      if (!cleanToken) continue;

      // Nếu token bắt đầu bằng các tiền tố quen thuộc
      for (const pre of ['AVO', 'TMP', 'ORD', 'AV', 'HD', 'POS', 'DH', 'SP', 'SUB']) {
        if (cleanToken.startsWith(pre) && cleanToken.length >= pre.length + 3) {
          results.add(cleanToken);
          results.add(`${pre}-${cleanToken.slice(pre.length)}`);
          results.add(cleanToken.slice(pre.length));
        }
      }

      // Các chuỗi alphanumeric có độ dài 4-30 không thuộc từ khóa thông dụng
      if (/^[A-Z0-9]{4,30}$/.test(cleanToken)) {
        if (!/^(CHUYEN|TIEN|THANH|TOAN|KHOAN|NGAN|HANG|PARTNER|DIRECT|DEBITS|VCB|MSE|VIETCOMBANK)$/.test(cleanToken)) {
          results.add(cleanToken);
        }
      }
    }

    return Array.from(results);
  }

  /**
   * Tìm kiếm đơn hàng theo danh sách mã trích xuất và số tiền
   */
  private async findOrderCandidates(codes: string[], expectedAmount?: number): Promise<any | null> {
    // A1. Tìm kiếm trực tiếp theo mã chính xác
    for (const code of codes) {
      const cleanCode = normalizeCode(code);
      const hyphenVariants = [
        code,
        cleanCode,
        cleanCode.startsWith('TMP') ? `TMP-${cleanCode.slice(3)}` : null,
        cleanCode.startsWith('ORD') ? `ORD-${cleanCode.slice(3)}` : null,
        cleanCode.startsWith('POS') ? `POS-${cleanCode.slice(3)}` : null,
        cleanCode.startsWith('AVO') ? `AVO-${cleanCode.slice(3)}` : null,
      ].filter(Boolean) as string[];

      const order = await this.prisma.order.findFirst({
        where: {
          OR: [
            ...hyphenVariants.map((c) => ({ orderCode: c })),
            ...hyphenVariants.map((c) => ({ temporaryOrderCode: c })),
            { id: code.toLowerCase() },
          ],
        },
        include: {
          branch: true,
          table: true,
        },
      });

      if (order) return order;
    }

    // A2. Tìm kiếm đối sánh mã chuẩn hóa không phân biệt gạch nối (Ví dụ AVOQ1ONL051126WB6 khớp AVO-Q1-ONL051126WB6)
    for (const code of codes) {
      const cleanCode = normalizeCode(code);
      if (!cleanCode || cleanCode.length < 5) continue;

      const recentOrders = await this.prisma.order.findMany({
        where: {
          OR: [
            { paymentStatus: 'PENDING' },
            { createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
          ],
        },
        include: { branch: true, table: true },
        orderBy: { createdAt: 'desc' },
        take: 40,
      });

      for (const ro of recentOrders) {
        const roNormCode = normalizeCode(ro.orderCode || '');
        const roNormTemp = normalizeCode(ro.temporaryOrderCode || '');
        if (
          (roNormCode && (roNormCode === cleanCode || roNormCode.includes(cleanCode) || cleanCode.includes(roNormCode))) ||
          (roNormTemp && (roNormTemp === cleanCode || roNormTemp.includes(cleanCode) || cleanCode.includes(roNormTemp)))
        ) {
          this.logger.log(`[Normalized Match] Khớp đơn hàng ${ro.orderCode || ro.temporaryOrderCode} qua mã chuẩn hóa: ${cleanCode}`);
          return ro;
        }
      }
    }

    // B. Nếu chưa tìm thấy và có expectedAmount: tìm trong các đơn hàng PENDING có cùng số tiền
    if (expectedAmount && expectedAmount > 0) {
      const pendingOrders = await this.prisma.order.findMany({
        where: {
          paymentStatus: 'PENDING',
          totalAmount: expectedAmount,
        },
        include: {
          branch: true,
          table: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      for (const po of pendingOrders) {
        const poCleanOrderCode = normalizeCode(po.orderCode || '');
        const poCleanTempCode = normalizeCode(po.temporaryOrderCode || '');

        for (const code of codes) {
          const cleanCode = normalizeCode(code);
          if (
            (poCleanOrderCode && (poCleanOrderCode === cleanCode || poCleanOrderCode.includes(cleanCode) || cleanCode.includes(poCleanOrderCode))) ||
            (poCleanTempCode && (poCleanTempCode === cleanCode || poCleanTempCode.includes(cleanCode) || cleanCode.includes(poCleanTempCode)))
          ) {
            this.logger.log(`[Reconciliation Match] Khớp đơn hàng ${po.temporaryOrderCode || po.orderCode} qua so khớp chuẩn hóa: ${cleanCode}`);
            return po;
          }
        }
      }
    }

    return null;
  }

  private broadcastOrderMatched(order: any, payment: any, bankTx: any): void {
    const payload = {
      orderId: order.id,
      orderCode: order.orderCode || order.temporaryOrderCode,
      temporaryOrderCode: order.temporaryOrderCode,
      branchId: order.branchId,
      tableName: order.table?.name || null,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      transactionRef: payment.transactionRef,
      bank: bankTx.bank,
      counterparty: bankTx.counterparty,
      matchedAt: new Date().toISOString(),
    };

    // POS Terminal Realtime
    this.posGateway.emitPaymentCompleted(order, payment);
    this.posGateway.emitOrderUpdated(order);
    this.posGateway.emitEvent({
      eventType: 'bank.transaction.matched',
      entityType: 'PAYMENT',
      entityId: payment.id,
      branchId: order.branchId || 'ALL',
      payload,
    });

    // Checkout Gateway (Customer / Web screen)
    this.checkoutGateway.emitSignal('ORDER_PAYMENT_CONFIRMED', payload, order.branchId);

    // Global Admin WebSocket Broadcast
    if (this.posGateway.server) {
      this.posGateway.server.to('admin:global').emit('bank.transaction.matched', payload);
      this.posGateway.server.to('admin:global').emit('order.payment.confirmed', payload);
    }
  }

  private broadcastReviewRequired(bankTx: any, reason: string): void {
    const payload = {
      transactionId: bankTx.id,
      eventId: bankTx.eventId,
      bank: bankTx.bank,
      accountNumberMasked: bankTx.accountNumberMasked,
      amount: Number(bankTx.amount),
      occurredAt: bankTx.occurredAt,
      transferContent: bankTx.transferContent,
      counterparty: bankTx.counterparty,
      reason,
    };

    if (this.posGateway.server) {
      this.posGateway.server.to('admin:global').emit('bank.transaction.review_required', payload);
    }
  }
}
