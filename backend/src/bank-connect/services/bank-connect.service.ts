import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BankCryptoService } from './bank-crypto.service';
import { BankParserService } from './bank-parser.service';
import { OrderMatchingService } from './order-matching.service';
import { PosGateway } from '../../pos/pos.gateway';
import { PairDeviceDto } from '../dto/pair-device.dto';
import { TransactionEventDto } from '../dto/transaction-event.dto';
import {
  HeartbeatDto,
  CreateScanRequestDto,
  ScanReportDto,
  ConfirmRefundDto,
} from '../dto/heartbeat.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class BankConnectService {
  private readonly logger = new Logger(BankConnectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankCrypto: BankCryptoService,
    private readonly bankParser: BankParserService,
    private readonly orderMatching: OrderMatchingService,
    private readonly posGateway: PosGateway,
  ) {}

  /**
   * Ghép nối thiết bị Android mới bằng pairing code
   */
  async pairDevice(dto: PairDeviceDto, clientIp?: string): Promise<{ success: boolean; deviceId: string; pairedAt: string }> {
    const { pairingCode, deviceId, deviceName, appVersion, publicKeyPem } = dto;

    if (!pairingCode || typeof pairingCode !== 'string' || !pairingCode.trim()) {
      throw new BadRequestException('Mã pairing không được để trống');
    }
    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      throw new BadRequestException('Device ID không được để trống');
    }
    if (!publicKeyPem || typeof publicKeyPem !== 'string' || !publicKeyPem.trim()) {
      throw new BadRequestException('Public Key PEM không được để trống');
    }

    // 1. Tìm và kiểm tra mã pairing
    const codeRecord = await this.prisma.bankPairingCode.findUnique({
      where: { code: pairingCode.trim() },
    });

    if (!codeRecord) {
      throw new BadRequestException('Mã pairing không hợp lệ');
    }

    if (codeRecord.isUsed) {
      throw new BadRequestException('Mã pairing này đã được sử dụng');
    }

    if (new Date() > codeRecord.expiresAt) {
      throw new BadRequestException('Mã pairing đã hết hạn (tối đa 5 phút)');
    }

    // 2. Thực hiện transaction lưu thiết bị và vô hiệu hóa mã pairing
    const result = await this.prisma.$transaction(async (tx) => {
      // Đánh dấu mã đã sử dụng
      await tx.bankPairingCode.update({
        where: { id: codeRecord.id },
        data: {
          isUsed: true,
          usedByDeviceId: deviceId,
        },
      });

      // Tạo hoặc cập nhật thông tin thiết bị
      const existing = await tx.bankConnectedDevice.findUnique({
        where: { deviceId },
      });

      let savedDevice;
      if (existing) {
        savedDevice = await tx.bankConnectedDevice.update({
          where: { deviceId },
          data: {
            deviceName,
            appVersion: appVersion || '1.0.0',
            publicKeyPem,
            status: 'ACTIVE',
            lastIp: clientIp || null,
            lastHeartbeatAt: new Date(),
            pairedAt: new Date(),
            pairedByUserId: codeRecord.createdByUserId,
            revokedAt: null,
            revokedByUserId: null,
          },
        });
      } else {
        savedDevice = await tx.bankConnectedDevice.create({
          data: {
            deviceId,
            deviceName,
            appVersion: appVersion || '1.0.0',
            publicKeyPem,
            status: 'ACTIVE',
            lastIp: clientIp || null,
            lastHeartbeatAt: new Date(),
            pairedAt: new Date(),
            pairedByUserId: codeRecord.createdByUserId,
          },
        });
      }

      // Ghi nhật ký kết nối
      await tx.bankConnectionLog.create({
        data: {
          deviceId,
          action: 'PAIR_SUCCESS',
          ip: clientIp || null,
          details: `Thiết bị ${deviceName} (${deviceId}) ghép nối thành công bằng mã ${pairingCode}`,
        },
      });

      return savedDevice;
    });

    this.logger.log(`[✓] Đã ghép nối thiết bị Android thành công: ${deviceId} (${deviceName})`);

    // Thông báo realtime cho Admin Web
    if (this.posGateway.server) {
      this.posGateway.server.to('admin:global').emit('bank.device.online', {
        deviceId: result.deviceId,
        deviceName: result.deviceName,
        pairedAt: result.pairedAt.toISOString(),
      });
    }

    return {
      success: true,
      deviceId: result.deviceId,
      pairedAt: result.pairedAt.toISOString(),
    };
  }

  /**
   * Tiếp nhận và xử lý sự kiện biến động số dư từ Android
   */
  async processTransactionEvent(
    dto: TransactionEventDto,
    device: any,
    clientIp?: string,
  ): Promise<{ success: boolean; eventId: string; status: string; orderId?: string; acknowledged: boolean }> {
    const {
      eventId,
      bank,
      accountNumber,
      direction,
      amount,
      balanceAfter,
      currency = 'VND',
      occurredAt,
      counterparty,
      transferContent,
      bankReference,
      rawNotification,
      parserVersion = '1.0.0',
    } = dto;

    const amountBigInt = typeof amount === 'bigint' ? amount : BigInt(Math.round(Number(amount)));
    const balanceAfterBigInt = balanceAfter !== undefined && balanceAfter !== null ? BigInt(Math.round(Number(balanceAfter))) : null;

    // Mask số tài khoản: ví dụ 1019224767 -> ******4767
    const last4 = accountNumber.slice(-4);
    const maskedAccount = accountNumber.length > 4 ? `******${last4}` : accountNumber;

    // Tạo Fingerprint chống trùng lặp tuyệt đối
    const fingerprint = this.bankCrypto.createTransactionFingerprint(
      bank,
      accountNumber,
      direction,
      amountBigInt,
      occurredAt,
      bankReference,
    );

    // 1. Kiểm tra Idempotency theo eventId
    const existingByEvent = await this.prisma.bankTransaction.findUnique({
      where: { eventId },
    });
    if (existingByEvent) {
      this.logger.warn(`Event ${eventId} đã tồn tại trong hệ thống. Trả về ACK xác nhận idempotent.`);
      return {
        success: true,
        eventId,
        status: existingByEvent.matchingStatus,
        orderId: existingByEvent.orderId || undefined,
        acknowledged: true,
      };
    }

    // 2. Kiểm tra Idempotency theo fingerprint
    const existingByFingerprint = await this.prisma.bankTransaction.findUnique({
      where: { fingerprint },
    });
    if (existingByFingerprint) {
      this.logger.warn(`Giao dịch trùng lặp theo fingerprint: ${fingerprint}. Đánh dấu DUPLICATE.`);
      return {
        success: true,
        eventId,
        status: 'DUPLICATE',
        orderId: existingByFingerprint.orderId || undefined,
        acknowledged: true,
      };
    }

    // 3. Lưu bản ghi BankTransaction
    let occurredAtDate: Date;
    try {
      occurredAtDate = new Date(occurredAt);
      if (isNaN(occurredAtDate.getTime())) occurredAtDate = new Date();
    } catch {
      occurredAtDate = new Date();
    }

    let savedTx: any;
    try {
      savedTx = await this.prisma.bankTransaction.create({
        data: {
          eventId,
          deviceId: device.deviceId,
          bank: bank.toUpperCase(),
          accountNumberMasked: maskedAccount,
          accountNumber,
          direction,
          amount: amountBigInt,
          balanceAfter: balanceAfterBigInt,
          currency,
          occurredAt: occurredAtDate,
          counterparty: counterparty || null,
          transferContent: transferContent || null,
          bankReference: bankReference || null,
          fingerprint,
          rawText: rawNotification || null,
          parserVersion,
          matchingStatus: 'UNMATCHED',
        },
      });
    } catch (createErr: any) {
      if (createErr?.code === 'P2002') {
        this.logger.warn(`Race condition duplicate caught by DB unique constraint: ${fingerprint}`);
        return {
          success: true,
          eventId,
          status: 'DUPLICATE',
          acknowledged: true,
        };
      }
      throw createErr;
    }

    // 4. Phát tín hiệu realtime: Bank Transaction Detected
    const detectedPayload = {
      transactionId: savedTx.id,
      eventId: savedTx.eventId,
      bank: savedTx.bank,
      accountNumberMasked: maskedAccount,
      direction: savedTx.direction,
      amount: Number(savedTx.amount),
      balanceAfter: savedTx.balanceAfter ? Number(savedTx.balanceAfter) : null,
      currency: savedTx.currency,
      occurredAt: savedTx.occurredAt.toISOString(),
      counterparty: savedTx.counterparty,
      transferContent: savedTx.transferContent,
      bankReference: savedTx.bankReference,
    };

    if (this.posGateway.server) {
      this.posGateway.server.to('admin:global').emit('bank.transaction.detected', detectedPayload);
    }

    // 5. Kích hoạt Order Matching & Reconciliation
    const matchResult = await this.orderMatching.matchAndReconcile(savedTx);

    // Ghi nhật ký
    await this.prisma.bankConnectionLog.create({
      data: {
        deviceId: device.deviceId,
        action: 'TRANSACTION_RECEIVED',
        ip: clientIp || null,
        details: `Nhận GD ${direction} ${Number(amountBigInt)}đ từ VCB. Trạng thái: ${matchResult.status}`,
      },
    }).catch(() => {});

    return {
      success: true,
      eventId,
      status: matchResult.status,
      orderId: matchResult.orderId,
      acknowledged: true,
    };
  }

  /**
   * Cập nhật Heartbeat & Telemetry từ Android Gateway
   */
  async recordHeartbeat(dto: HeartbeatDto, clientIp?: string): Promise<{ success: boolean; status: string; serverTime: string }> {
    const {
      deviceId,
      batteryLevel,
      isCharging,
      pendingQueueCount,
      listenerActive,
      networkType,
      isNotificationAccessGranted,
      isPowerSaveMode,
      isIgnoringBatteryOptimizations,
      appVersion,
    } = dto;

    await this.prisma.bankConnectedDevice.update({
      where: { deviceId },
      data: {
        lastHeartbeatAt: new Date(),
        lastIp: clientIp || null,
        batteryLevel: typeof batteryLevel === 'number' ? batteryLevel : undefined,
        isCharging: typeof isCharging === 'boolean' ? isCharging : undefined,
        networkType: networkType || undefined,
        isNotificationAccessGranted: typeof isNotificationAccessGranted === 'boolean' ? isNotificationAccessGranted : undefined,
        isPowerSaveMode: typeof isPowerSaveMode === 'boolean' ? isPowerSaveMode : undefined,
        isIgnoringBatteryOptimizations: typeof isIgnoringBatteryOptimizations === 'boolean' ? isIgnoringBatteryOptimizations : undefined,
        appVersion: appVersion || undefined,
      },
    });

    const isLowBattery = typeof batteryLevel === 'number' && batteryLevel <= 20 && !isCharging;
    const isAccessMissing = isNotificationAccessGranted === false;

    if (this.posGateway.server) {
      const telemetryPayload = {
        deviceId,
        batteryLevel,
        isCharging,
        pendingQueueCount,
        listenerActive,
        networkType: networkType || 'UNKNOWN',
        isNotificationAccessGranted: isNotificationAccessGranted ?? true,
        isPowerSaveMode: isPowerSaveMode ?? false,
        isIgnoringBatteryOptimizations: isIgnoringBatteryOptimizations ?? true,
        appVersion: appVersion || '1.0.0',
        lastHeartbeatAt: new Date().toISOString(),
        isLowBattery,
        isAccessMissing,
      };

      this.posGateway.server.to('admin:global').emit('bank.device.heartbeat', telemetryPayload);
      this.posGateway.server.emit('BANK_DEVICE_HEALTH_UPDATE', telemetryPayload);
    }

    return {
      success: true,
      status: 'ACTIVE',
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Lấy trạng thái thiết bị
   */
  async getDeviceStatus(deviceId: string): Promise<any> {
    const device = await this.prisma.bankConnectedDevice.findUnique({
      where: { deviceId },
      select: {
        deviceId: true,
        deviceName: true,
        status: true,
        lastHeartbeatAt: true,
        pairedAt: true,
      },
    });

    if (!device) {
      throw new NotFoundException('Thiết bị không tồn tại');
    }

    return {
      ...device,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Thu hồi thiết bị từ Android hoặc Admin
   */
  async revokeDevice(deviceId: string, reason?: string, userId?: string): Promise<{ success: boolean; message: string }> {
    const device = await this.prisma.bankConnectedDevice.findUnique({
      where: { deviceId },
    });

    if (!device) {
      throw new NotFoundException('Thiết bị không tồn tại');
    }

    await this.prisma.bankConnectedDevice.update({
      where: { deviceId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedByUserId: userId || null,
      },
    });

    await this.prisma.bankConnectionLog.create({
      data: {
        deviceId,
        action: 'REVOKE',
        details: `Thiết bị bị thu hồi. Lý do: ${reason || 'Yêu cầu từ người dùng/Admin'}`,
      },
    });

    if (this.posGateway.server) {
      this.posGateway.server.to('admin:global').emit('bank.device.revoked', {
        deviceId,
        reason,
        revokedAt: new Date().toISOString(),
      });
    }

    this.logger.warn(`[!] Thiết bị ${deviceId} đã bị thu hồi quyền truy cập.`);
    return { success: true, message: 'Đã thu hồi thiết bị thành công' };
  }

  /**
   * Admin tạo mã pairing ngẫu nhiên có hiệu lực 5 phút
   */
  async generatePairingCode(userId?: string): Promise<{ code: string; expiresAt: string; serverUrl: string }> {
    // Tạo mã ngẫu nhiên 6 ký tự dễ đọc (tránh nhầm lẫn 0/O, 1/I)
    const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    const bytes = randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += charset[bytes[i] % charset.length];
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    await this.prisma.bankPairingCode.create({
      data: {
        code,
        expiresAt,
        isUsed: false,
        createdByUserId: userId || null,
      },
    });

    this.logger.log(`Tạo mã pairing mới: ${code} (hết hạn lúc ${expiresAt.toISOString()})`);

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      serverUrl: 'https://avorafnb.com',
    };
  }

  /**
   * Admin lấy danh sách thiết bị đã kết nối
   */
  async listDevices(): Promise<any[]> {
    return this.prisma.bankConnectedDevice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });
  }

  /**
   * Admin lấy danh sách giao dịch ngân hàng
   */
  async getTransactions(params: {
    page?: number;
    limit?: number;
    matchingStatus?: string;
    direction?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.matchingStatus && params.matchingStatus !== 'ALL') {
      where.matchingStatus = params.matchingStatus;
    }
    if (params.direction && params.direction !== 'ALL') {
      where.direction = params.direction;
    }
    if (params.fromDate || params.toDate) {
      where.occurredAt = {};
      if (params.fromDate) where.occurredAt.gte = new Date(params.fromDate);
      if (params.toDate) where.occurredAt.lte = new Date(params.toDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.bankTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderCode: true,
              temporaryOrderCode: true,
              totalAmount: true,
              paymentStatus: true,
              customerName: true,
            },
          },
        },
      }),
      this.prisma.bankTransaction.count({ where }),
    ]);

    // Chuyển đổi BigInt sang string / number để serialize JSON an toàn
    const safeItems = items.map((t) => ({
      ...t,
      amount: Number(t.amount),
      balanceAfter: t.balanceAfter ? Number(t.balanceAfter) : null,
      accountNumber: undefined, // Ẩn hoàn toàn số tài khoản thực, chỉ giữ accountNumberMasked
    }));

    return { items: safeItems, total, page, limit };
  }

  /**
   * Xem chi tiết giao dịch ngân hàng & thông tin đơn hàng gắn kèm
   */
  async getTransactionDetail(id: string): Promise<any> {
    const tx = await this.prisma.bankTransaction.findUnique({
      where: { id },
      include: {
        device: {
          select: {
            deviceId: true,
            deviceName: true,
            appVersion: true,
            lastHeartbeatAt: true,
          },
        },
        order: {
          include: {
            table: true,
            branch: true,
            orderItems: {
              include: {
                product: {
                  select: { id: true, name: true, itemCode: true, imageUrl: true },
                },
              },
            },
            payments: true,
          },
        },
        orderMatches: true,
      },
    });

    if (!tx) {
      throw new NotFoundException(`Không tìm thấy giao dịch ID: ${id}`);
    }

    return {
      ...tx,
      amount: Number(tx.amount),
      balanceAfter: tx.balanceAfter ? Number(tx.balanceAfter) : null,
      accountNumber: undefined,
    };
  }

  /**
   * Xem chi tiết đơn hàng cho Android App / Web Admin
   */
  async getOrderDetail(idOrCode: string): Promise<any> {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id: idOrCode },
          { orderCode: idOrCode },
          { temporaryOrderCode: idOrCode },
        ],
      },
      include: {
        table: true,
        branch: true,
        orderItems: {
          include: {
            product: {
              select: { id: true, name: true, itemCode: true, imageUrl: true },
            },
          },
        },
        payments: true,
        bankTransactions: {
          select: {
            id: true,
            eventId: true,
            bank: true,
            accountNumberMasked: true,
            direction: true,
            amount: true,
            occurredAt: true,
            transferContent: true,
            matchingStatus: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${idOrCode}`);
    }

    const safeBankTransactions = ((order as any).bankTransactions || []).map((bt: any) => ({
      ...bt,
      amount: Number(bt.amount),
    }));

    const mappedOrderItems = (order.orderItems || []).map((item: any) => {
      const unitPrice = item.priceAtSale ?? item.originalPriceAtSale ?? 0;
      const quantity = item.quantity ?? 1;
      return {
        ...item,
        price: unitPrice,
        priceAtSale: unitPrice,
        subtotal: unitPrice * quantity,
      };
    });

    return {
      ...order,
      orderItems: mappedOrderItems,
      bankTransactions: safeBankTransactions,
    };
  }

  /**
   * Xóa một giao dịch rác không thuộc về đơn hàng nào
   */
  async deleteUnmatchedTransaction(idOrEventId: string): Promise<any> {
    let tx = await this.prisma.bankTransaction.findUnique({
      where: { id: idOrEventId },
    });
    if (!tx) {
      tx = await this.prisma.bankTransaction.findUnique({
        where: { eventId: idOrEventId },
      });
    }

    if (!tx) {
      throw new NotFoundException(`Không tìm thấy giao dịch với ID hoặc EventId: ${idOrEventId}`);
    }

    if (tx.orderId || tx.matchingStatus === 'MATCHED') {
      throw new BadRequestException('Không thể xóa giao dịch đã được đối soát với đơn hàng!');
    }

    await this.prisma.bankTransaction.delete({
      where: { id: tx.id },
    });

    this.logger.log(`Đã xóa giao dịch không gắn đơn: ${tx.id} (${tx.eventId})`);

    // Đồng bộ tức thì tới Web Admin / POS qua WebSocket
    if (this.posGateway.server) {
      this.posGateway.server.to('admin:global').emit('bank.transaction.deleted', {
        id: tx.id,
        eventId: tx.eventId,
      });
    }

    return {
      success: true,
      message: 'Đã xóa giao dịch thành công',
      deletedId: tx.id,
      eventId: tx.eventId,
    };
  }

  /**
   * Xóa toàn bộ các giao dịch chưa gắn đơn hàng (UNMATCHED, REVIEW_REQUIRED, IGNORED, DUPLICATE)
   */
  async deleteAllUnmatchedTransactions(): Promise<{ success: boolean; count: number; message: string }> {
    const result = await this.prisma.bankTransaction.deleteMany({
      where: {
        orderId: null,
        matchingStatus: { in: ['UNMATCHED', 'REVIEW_REQUIRED', 'IGNORED', 'DUPLICATE'] },
      },
    });

    this.logger.log(`Đã dọn dẹp toàn bộ ${result.count} giao dịch không gắn đơn hàng.`);

    if (this.posGateway.server) {
      this.posGateway.server.to('admin:global').emit('bank.transactions.all_unmatched_deleted', {
        count: result.count,
      });
    }

    return {
      success: true,
      count: result.count,
      message: `Đã dọn dẹp ${result.count} giao dịch thành công`,
    };
  }

  /**
   * Danh sách chi nhánh cho Android App
   */
  async getBranches(): Promise<any> {
    const branches = await this.prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        branchCode: true,
        street: true,
        district: true,
        province: true,
      },
      orderBy: { name: 'asc' },
    });
    return {
      success: true,
      data: branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.branchCode,
        address: [b.street, b.district, b.province].filter(Boolean).join(', '),
      })),
    };
  }

  /**
   * Danh sách toàn bộ đơn hàng đã hoàn thành (kèm lọc theo chi nhánh, tìm kiếm)
   */
  async getCompletedOrders(params: {
    branchId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<any> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'COMPLETED',
    };

    if (params.branchId && params.branchId !== 'ALL') {
      where.branchId = params.branchId;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { orderCode: { contains: q } },
        { temporaryOrderCode: { contains: q } },
        { customerPhone: { contains: q } },
        { customerName: { contains: q } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: {
            select: { id: true, name: true, branchCode: true },
          },
          table: {
            select: { id: true, name: true, tableCode: true },
          },
        },
      }),
    ]);

    const mappedOrders = orders.map((o: any) => ({
      id: o.id,
      orderCode: o.orderCode || o.temporaryOrderCode || o.id.slice(0, 8),
      temporaryOrderCode: o.temporaryOrderCode,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      totalAmount: o.totalAmount,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      branchName: o.branch?.name || 'Chưa rõ',
      branchId: o.branchId,
      tableName: o.table?.name,
      createdAt: o.createdAt,
      completedAt: o.updatedAt,
      isBankMatched: o.paymentMethod === 'TRANSFER',
    }));

    return {
      success: true,
      data: mappedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // FEATURE 1: CASH SHIFT AUTO-AUDIT (ĐỐI SOÁT CHỐT CA)
  // ==========================================

  /**
   * Lấy danh sách ca làm việc gần đây để quản lý chọn đối soát
   */
  async getRecentShifts(branchId?: string, limit = 20) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    const shifts = await this.prisma.cashShift.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take: limit,
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        cashier: { select: { id: true, fullName: true, email: true } },
      },
    });

    return {
      success: true,
      data: shifts.map((s) => ({
        id: s.id,
        branchId: s.branchId,
        branchName: s.branch?.name || 'Chi nhánh',
        cashierId: s.cashierId,
        cashierName: s.cashier?.fullName || 'Thu ngân',
        status: s.status,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        totalRevenue: s.totalRevenue,
        totalTransfer: s.totalTransfer,
        orderCount: s.orderCount,
        note: s.note,
      })),
    };
  }

  /**
   * Thực hiện đối soát chi tiết ca làm việc giữa POS và biến động số dư Ngân hàng
   */
  async auditShift(shiftId: string) {
    const shift = await this.prisma.cashShift.findUnique({
      where: { id: shiftId },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        cashier: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!shift) {
      throw new NotFoundException(`Ca làm việc ${shiftId} không tồn tại.`);
    }

    const shiftStart = shift.openedAt;
    const shiftEnd = shift.closedAt || new Date();

    // 1. Khoản thanh toán ghi nhận trên POS thuộc ca này (Phương thức TRANSFER)
    const posPayments = await this.prisma.orderPayment.findMany({
      where: {
        shiftId: shift.id,
        paymentMethod: 'TRANSFER',
        status: 'COMPLETED',
        order: {
          status: { not: 'CANCELLED' },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderCode: true,
            temporaryOrderCode: true,
            totalAmount: true,
            paymentStatus: true,
            status: true,
            table: { select: { name: true } },
          },
        },
        refunds: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalPosTransfer = posPayments.reduce((acc, p) => acc + Number(p.amount), 0);
    const posTransferCount = posPayments.length;

    // 2. Giao dịch ngân hàng thực tế nhận được (CREDIT) trong khung giờ ca
    const bankTxs = await this.prisma.bankTransaction.findMany({
      where: {
        direction: 'CREDIT',
        occurredAt: {
          gte: shiftStart,
          lte: shiftEnd,
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderCode: true,
            temporaryOrderCode: true,
            totalAmount: true,
          },
        },
        orderMatches: true,
      },
      orderBy: { occurredAt: 'asc' },
    });

    const totalBankCredit = bankTxs.reduce((acc, t) => acc + Number(t.amount), 0);
    const bankCreditCount = bankTxs.length;

    // 3. Phân loại giao dịch: Khớp, Chưa khớp, Cần kiểm tra, Chuyển trùng
    const matchedTransactions: any[] = [];
    const unmatchedBankTransactions: any[] = [];
    const missingBankTransactions: any[] = [];
    const overpaidDuplicates: any[] = [];

    let totalMatched = 0;
    let totalUnmatched = 0;

    // Duyệt qua các giao dịch ngân hàng
    for (const tx of bankTxs) {
      const amt = Number(tx.amount);
      const isMatched = tx.matchingStatus === 'MATCHED' || tx.matchingStatus === 'MANUALLY_MATCHED';
      const isOverpaid = tx.matchingStatus === 'OVERPAID_DUPLICATE';

      if (isMatched) {
        totalMatched += amt;
        matchedTransactions.push({
          id: tx.id,
          bank: tx.bank,
          amount: amt,
          direction: tx.direction,
          transferContent: tx.transferContent,
          bankReference: tx.bankReference,
          occurredAt: tx.occurredAt,
          orderId: tx.orderId,
          orderCode: tx.order?.orderCode || tx.order?.temporaryOrderCode || tx.orderId,
          matchingStatus: tx.matchingStatus,
        });
      } else if (isOverpaid) {
        overpaidDuplicates.push({
          id: tx.id,
          bank: tx.bank,
          amount: amt,
          transferContent: tx.transferContent,
          bankReference: tx.bankReference,
          occurredAt: tx.occurredAt,
          orderId: tx.orderId,
          orderCode: tx.order?.orderCode || tx.order?.temporaryOrderCode || tx.orderId,
          reason: 'Khách hàng chuyển thừa/chuyển 2 lần cho đơn đã thanh toán',
        });
      } else {
        totalUnmatched += amt;
        unmatchedBankTransactions.push({
          id: tx.id,
          bank: tx.bank,
          amount: amt,
          transferContent: tx.transferContent,
          bankReference: tx.bankReference,
          occurredAt: tx.occurredAt,
          matchingStatus: tx.matchingStatus,
          reason: tx.matchingStatus === 'REVIEW_REQUIRED' ? 'Cần kiểm tra đối soát thủ công' : 'Chưa được gắn vào đơn hàng',
        });
      }
    }

    // Kiểm tra các khoản POS transfer xem có khoản nào thiếu giao dịch ngân hàng không
    const matchedTxOrderIds = new Set(matchedTransactions.map((m) => m.orderId).filter(Boolean));
    for (const p of posPayments) {
      if (!matchedTxOrderIds.has(p.orderId)) {
        missingBankTransactions.push({
          paymentId: p.id,
          orderId: p.orderId,
          orderCode: p.order.orderCode || p.order.temporaryOrderCode || p.orderId,
          tableName: p.order.table?.name || 'Mang đi',
          amount: p.amount,
          createdAt: p.createdAt,
          note: p.note,
          reason: 'POS đã ghi nhận thanh toán chuyển khoản nhưng chưa tìm thấy biến động số dư ngân hàng tương ứng.',
        });
      }
    }

    // Tính chênh lệch đối soát
    const variance = totalBankCredit - totalPosTransfer;
    let reconciliationStatus: 'MATCHED' | 'NEEDS_REVIEW' | 'DISCREPANCY' = 'MATCHED';
    if (Math.abs(variance) >= 1) {
      reconciliationStatus = 'DISCREPANCY';
    } else if (unmatchedBankTransactions.length > 0 || missingBankTransactions.length > 0) {
      reconciliationStatus = 'NEEDS_REVIEW';
    }

    return {
      success: true,
      shift: {
        id: shift.id,
        branchId: shift.branchId,
        branchName: shift.branch?.name || 'Chi nhánh',
        cashierId: shift.cashierId,
        cashierName: shift.cashier?.fullName || 'Thu ngân',
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        openingBalance: shift.openingBalance,
        closingBalance: shift.closingBalance,
        totalRevenue: shift.totalRevenue,
        totalCash: shift.totalCash,
        totalTransfer: shift.totalTransfer,
        note: shift.note,
      },
      metrics: {
        totalPosTransfer,
        posTransferCount,
        totalBankCredit,
        bankCreditCount,
        totalMatched,
        matchedCount: matchedTransactions.length,
        totalUnmatched,
        unmatchedCount: unmatchedBankTransactions.length,
        variance,
        reconciliationStatus,
      },
      discrepancies: {
        missingBankTransactions,
        unmatchedBankTransactions,
        overpaidDuplicates,
      },
      matchedTransactions,
    };
  }

  // ==========================================
  // FEATURE 2: ANTI-FAKE BILL VERIFIER (KIỂM TRA THANH TOÁN KHẨN CẤP TỪ POS)
  // ==========================================

  /**
   * POS kích hoạt lệnh kiểm tra thanh toán ngay lập tức tới Android Gateway
   */
  async createScanRequest(dto: CreateScanRequestDto, userId?: string) {
    const scanJobId = `SCAN-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    // Lưu phiên quét vào DB
    const scanJob = await this.prisma.bankScanJob.create({
      data: {
        scanJobId,
        branchId: dto.branchId || null,
        orderId: dto.orderId || null,
        requestedByUserId: userId || null,
        status: 'SCAN_REQUESTED',
      },
    });

    // Phát lệnh quét khẩn cấp qua WebSocket tới Gateway Android
    if (this.posGateway.server) {
      const scanPayload = {
        scanJobId,
        branchId: dto.branchId,
        orderId: dto.orderId,
        requestedAt: new Date().toISOString(),
      };

      // Gửi sự kiện cho Gateway Android và POS terminal
      this.posGateway.server.emit('TRIGGER_NOTIFICATION_SCAN', scanPayload);
      if (dto.branchId) {
        this.posGateway.server.to(`branch:${dto.branchId}`).emit('SCAN_STATUS_UPDATE', {
          scanJobId,
          status: 'SCAN_REQUESTED',
          message: 'Đã gửi yêu cầu quét thông báo ngân hàng tới Gateway',
        });
      }
    }

    return {
      success: true,
      scanJobId,
      status: 'SCAN_REQUESTED',
      createdAt: scanJob.createdAt,
    };
  }

  /**
   * Android Gateway báo cáo kết quả quét active notifications
   */
  async reportScanResult(dto: ScanReportDto) {
    const { scanJobId, status, activeNotificationsCount, newTransactionsCount, resultMessage } = dto;

    const job = await this.prisma.bankScanJob.findUnique({
      where: { scanJobId },
    });

    if (!job) {
      throw new NotFoundException(`Phiên quét ${scanJobId} không tồn tại.`);
    }

    const updated = await this.prisma.bankScanJob.update({
      where: { scanJobId },
      data: {
        status,
        activeNotificationsCount: activeNotificationsCount ?? 0,
        newTransactionsCount: newTransactionsCount ?? 0,
        resultMessage: resultMessage || null,
        completedAt: new Date(),
      },
    });

    // Phát kết quả Realtime về cho màn hình POS
    if (this.posGateway.server) {
      const eventPayload = {
        scanJobId,
        status,
        activeNotificationsCount: activeNotificationsCount ?? 0,
        newTransactionsCount: newTransactionsCount ?? 0,
        resultMessage,
        completedAt: updated.completedAt,
      };

      if (job.branchId) {
        this.posGateway.server.to(`branch:${job.branchId}`).emit('SCAN_STATUS_UPDATE', eventPayload);
      }
      this.posGateway.server.to('admin:global').emit('SCAN_STATUS_UPDATE', eventPayload);
    }

    return { success: true, status: updated.status };
  }

  /**
   * POS lấy trạng thái phiên quét khẩn cấp kèm thông tin sức khỏe thiết bị Gateway
   */
  async getScanJobStatus(scanJobId: string) {
    const job = await this.prisma.bankScanJob.findUnique({
      where: { scanJobId },
    });

    if (!job) {
      throw new NotFoundException(`Phiên quét ${scanJobId} không tồn tại.`);
    }

    // Lấy thông tin thiết bị Gateway đang kích hoạt
    const activeDevice = await this.prisma.bankConnectedDevice.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { lastHeartbeatAt: 'desc' },
      select: {
        deviceId: true,
        deviceName: true,
        batteryLevel: true,
        isCharging: true,
        networkType: true,
        isNotificationAccessGranted: true,
        lastHeartbeatAt: true,
        appVersion: true,
      },
    });

    const isDeviceOnline = activeDevice?.lastHeartbeatAt
      ? Date.now() - new Date(activeDevice.lastHeartbeatAt).getTime() < 3 * 60 * 1000 // Trong vòng 3 phút
      : false;

    return {
      success: true,
      job: {
        scanJobId: job.scanJobId,
        status: job.status,
        activeNotificationsCount: job.activeNotificationsCount,
        newTransactionsCount: job.newTransactionsCount,
        resultMessage: job.resultMessage,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      },
      deviceTelemetry: {
        isOnline: isDeviceOnline,
        deviceName: activeDevice?.deviceName || 'Chưa ghép nối',
        batteryLevel: activeDevice?.batteryLevel ?? null,
        isCharging: activeDevice?.isCharging ?? null,
        networkType: activeDevice?.networkType || 'UNKNOWN',
        isNotificationAccessGranted: activeDevice?.isNotificationAccessGranted ?? true,
        lastHeartbeatAt: activeDevice?.lastHeartbeatAt || null,
        appVersion: activeDevice?.appVersion || '1.0.0',
      },
    };
  }

  // ==========================================
  // FEATURE 3: OVERPAID DUPLICATE & REFUND MANAGEMENT
  // ==========================================

  /**
   * Xem danh sách các khoản chuyển trùng cần hoàn tiền
   */
  async listOverpaidDuplicates(params: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) {
      where.status = params.status;
    }

    const [total, items] = await Promise.all([
      this.prisma.overpaidRefund.count({ where }),
      this.prisma.overpaidRefund.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          transaction: true,
          order: {
            include: {
              table: { select: { name: true } },
              branch: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: items.map((item) => ({
        id: item.id,
        transactionId: item.transactionId,
        orderId: item.orderId,
        orderCode: item.order.orderCode || item.order.temporaryOrderCode || item.orderId,
        tableName: item.order.table?.name || 'Mang đi',
        branchName: item.order.branch?.name || 'Chi nhánh',
        orderTotalAmount: item.order.totalAmount,
        overpaidAmount: Number(item.overpaidAmount),
        status: item.status,
        refundBankReference: item.refundBankReference,
        refundedAmount: item.refundedAmount ? Number(item.refundedAmount) : null,
        refundedAt: item.refundedAt,
        notes: item.notes,
        createdAt: item.createdAt,
        bankTransaction: {
          bank: item.transaction.bank,
          accountNumberMasked: item.transaction.accountNumberMasked,
          transferContent: item.transaction.transferContent,
          bankReference: item.transaction.bankReference,
          occurredAt: item.transaction.occurredAt,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Tạo yêu cầu hoàn tiền cho giao dịch chuyển trùng
   */
  async requestOverpaidRefund(id: string, notes?: string) {
    const refund = await this.prisma.overpaidRefund.findUnique({
      where: { id },
    });

    if (!refund) {
      throw new NotFoundException(`Bản ghi hoàn tiền ${id} không tồn tại.`);
    }

    const updated = await this.prisma.overpaidRefund.update({
      where: { id },
      data: {
        status: 'REFUND_PROCESSING',
        notes: notes || refund.notes,
      },
    });

    return { success: true, message: 'Đã tạo yêu cầu hoàn tiền.', data: updated };
  }

  /**
   * Xác nhận đã hoàn tiền qua tài khoản ngân hàng (Hỗ trợ 1-chạm từ Android / Web Admin)
   */
  async confirmOverpaidRefund(id: string, dto: ConfirmRefundDto, userId?: string) {
    let refund = await this.prisma.overpaidRefund.findUnique({
      where: { id },
      include: { order: true, transaction: true },
    });

    if (!refund) {
      refund = await this.prisma.overpaidRefund.findFirst({
        where: {
          OR: [
            { transactionId: id },
            { transaction: { eventId: id } },
          ],
        },
        include: { order: true, transaction: true },
      });
    }

    if (!refund) {
      throw new NotFoundException(`Bản ghi hoàn tiền ${id} không tồn tại.`);
    }

    const refCode = dto.refundBankReference?.trim() || `REFUND-${Date.now()}`;
    const refundedAmount = dto.amount ? BigInt(dto.amount) : refund.overpaidAmount;

    const updated = await this.prisma.overpaidRefund.update({
      where: { id: refund.id },
      data: {
        status: 'REFUNDED',
        refundBankReference: refCode,
        refundedAmount,
        refundedAt: new Date(),
        refundedByUserId: userId || null,
        notes: dto.notes ? `${refund.notes || ''}\n[Hoàn tiền]: ${dto.notes}` : refund.notes,
      },
    });

    // Cập nhật trạng thái giao dịch ngân hàng thành MATCHED / REFUNDED để hoàn tất sổ sách
    await this.prisma.bankTransaction.update({
      where: { id: refund.transactionId },
      data: {
        matchingStatus: 'MATCHED',
      },
    }).catch(() => {});

    // Broadcast tới POS & Admin
    if (this.posGateway.server) {
      this.posGateway.server.to('admin:global').emit('bank.transaction.matched', {
        transactionId: refund.transactionId,
        orderId: refund.orderId,
        status: 'REFUNDED',
      });
    }

    return {
      success: true,
      message: 'Xác nhận hoàn tiền thành công.',
      data: {
        id: updated.id,
        status: updated.status,
        refundBankReference: updated.refundBankReference,
        refundedAmount: Number(updated.refundedAmount),
        refundedAt: updated.refundedAt,
      },
    };
  }

  // ==========================================
  // FEATURE 4: 1-TAP QUICK MATCH (GÁN ĐƠN THỦ CÔNG)
  // ==========================================

  /**
   * Lấy danh sách các đơn hàng ứng viên phù hợp nhất để gán giao dịch ngân hàng
   */
  async getPendingOrderCandidates(params: {
    branchId?: string;
    amount?: number;
    search?: string;
    transactionId?: string;
  }) {
    let targetAmount = params.amount;
    let extractedCodes: string[] = [];

    if (params.transactionId) {
      let tx = await this.prisma.bankTransaction.findUnique({
        where: { id: params.transactionId },
      });
      if (!tx) {
        tx = await this.prisma.bankTransaction.findUnique({
          where: { eventId: params.transactionId },
        });
      }
      if (tx) {
        targetAmount = Number(tx.amount);
        extractedCodes = this.orderMatching.extractPotentialOrderCodes(tx.transferContent || '');
      }
    }

    const where: any = {
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
      paymentStatus: { not: 'PAID' },
    };

    if (params.branchId) {
      where.branchId = params.branchId;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { orderCode: { contains: q } },
        { temporaryOrderCode: { contains: q } },
        { customerPhone: { contains: q } },
        { customerName: { contains: q } },
      ];
    }

    const orders = await this.prisma.order.findMany({
      where,
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: { select: { name: true } },
        table: { select: { name: true } },
        payments: {
          where: { status: 'COMPLETED' },
          select: { amount: true },
        },
      },
    });

    // Tính số tiền còn phải thanh toán & xếp hạng ưu tiên
    const scoredCandidates = orders.map((o) => {
      const alreadyPaid = o.payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const remainingAmount = Math.max(0, o.totalAmount - alreadyPaid);

      let score = 0;
      // 1. Khớp chính xác số tiền còn nợ
      if (targetAmount && Math.abs(remainingAmount - targetAmount) < 1) {
        score += 50;
      }
      // 2. Mã đơn xuất hiện trong nội dung chuyển tiền
      const normOrderCode = (o.orderCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const normTempCode = (o.temporaryOrderCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (extractedCodes.some((code) => normOrderCode.includes(code) || normTempCode.includes(code))) {
        score += 100;
      }

      return {
        id: o.id,
        orderCode: o.orderCode || o.temporaryOrderCode || o.id.slice(0, 8),
        temporaryOrderCode: o.temporaryOrderCode,
        tableName: o.table?.name || 'Mang đi/Giao hàng',
        branchName: o.branch?.name || 'Chi nhánh',
        totalAmount: o.totalAmount,
        alreadyPaid,
        remainingAmount,
        createdAt: o.createdAt,
        paymentStatus: o.paymentStatus,
        status: o.status,
        matchScore: score,
      };
    });

    // Lọc bỏ đơn đã trả đủ và sắp xếp ưu tiên điểm khớp cao nhất lên trước
    const candidates = scoredCandidates
      .filter((c) => c.remainingAmount > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    return {
      success: true,
      data: candidates,
    };
  }

  /**
   * Bắn sự kiện cập nhật OTA từ xa xuống thiết bị Gateway
   */
  async pushOtaUpdate(deviceId?: string) {
    if (this.posGateway.server) {
      const payload = {
        versionName: '1.0.1',
        versionCode: 2,
        downloadUrl: 'https://avorafnb.com/api/bank-connect/v1/app/download-latest',
        releaseNotes: 'Bản siêu nâng cấp: Đối soát ca 1-chạm, chống Fake Bill, cảnh báo chuyển trùng, sửa lỗi nhận diện Zalo, xác thực vân tay bảo vệ Admin.',
        pushedAt: new Date().toISOString(),
      };

      this.posGateway.server.emit('PUSH_APP_UPDATE', payload);
      this.logger.log(`[OTA] Đã phát sự kiện PUSH_APP_UPDATE xuống Gateway Android (Target: ${deviceId || 'ALL'})`);
    }

    return {
      success: true,
      message: 'Đã bắn lệnh cập nhật ứng dụng tự động xuống thiết bị Android',
    };
  }
}
