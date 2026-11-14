import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PosGateway } from '../pos/pos.gateway';
import { OrderPricingService } from '../pricing/order-pricing.service';
import { BuffetService } from '../buffet/buffet.service';
import { NotificationEngineService } from '../notification/notification-engine.service';
import {
  buildOrderNotificationPayload,
  mapPriorityToNumeric,
} from '../notification/order-notification.helper';
import { OrderAuditService } from '../common/services/order-audit.service';
import { JoinQrSessionDto } from './dto/join-qr-session.dto';
import { SubmitQrRoundDto } from './dto/submit-qr-round.dto';
import { CreateServiceRequestDto } from './dto/service-request.dto';
import { RequestQrVatInvoiceDto } from './dto/vat-invoice.dto';
import {
  MemberLookupDto,
  MemberVerifyDto,
  RedeemRewardDto,
  GoogleQrAuthDto,
} from './dto/member-actions.dto';
import { AuthService } from '../auth/auth.service';
import {
  QrSessionStatus,
  TableSessionStatus,
  OrderStatus,
  KitchenStatus,
  OrderItemPricingMode,
  OrderItemSource,
  TableServiceRequestType,
  TableServiceRequestStatus,
  BuffetSessionStatus,
  PointTransactionSource,
} from '@prisma/client';
import { randomBytes, createHash, createHmac, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { getRequiredEnv } from '../common/utils/env.util';

@Injectable()
export class QrOrderService {
  private readonly logger = new Logger(QrOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posGateway: PosGateway,
    private readonly orderPricingService: OrderPricingService,
    private readonly buffetService: BuffetService,
    private readonly notificationEngine: NotificationEngineService,
    @Optional() private readonly orderAuditService?: OrderAuditService,
    @Optional()
    @Inject(forwardRef(() => AuthService))
    private readonly authService?: AuthService,
  ) {}

  /**
   * Sinh rawToken bảo mật dựa trên sessionId bằng HMAC-SHA256
   */
  private deriveRawToken(sessionId: string): string {
    const secret = getRequiredEnv('QR_ORDER_TOKEN_SECRET');
    return createHmac('sha256', secret).update(sessionId).digest('hex');
  }

  /**
   * Băm token để lưu trữ an toàn trong DB
   */
  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken.trim()).digest('hex');
  }

  /**
   * Tạo hoặc lấy mã QR phiên đang hoạt động cho một bàn tại POS
   */
  async getOrCreateQrSessionForTable(tableId: string, branchId: string, user?: any) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
      include: {
        branch: true,
        sessions: {
          where: { status: TableSessionStatus.ACTIVE },
          include: { order: true },
        },
      },
    });

    if (!table) throw new NotFoundException('Bàn không tồn tại');

    const activeSession = table.sessions?.[0] || null;
    let order = activeSession?.order || null;

    if (!order) {
      order = await this.prisma.order.findFirst({
        where: {
          tableId,
          branchId,
          status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.HELD, OrderStatus.DRAFT] },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!order) {
      throw new BadRequestException('Bàn chưa mở đơn hàng. Vui lòng mở bàn tại POS trước khi tạo QR gọi món.');
    }

    // Kiểm tra xem đã có QrOrderSession ACTIVE chưa
    const existingQrSession = await this.prisma.qrOrderSession.findFirst({
      where: {
        orderId: order.id,
        status: QrSessionStatus.ACTIVE,
      },
    });

    if (existingQrSession) {
      const rawToken = this.deriveRawToken(existingQrSession.id);
      const expectedHash = this.hashToken(rawToken);

      if (existingQrSession.tokenHash !== expectedHash) {
        await this.prisma.qrOrderSession.update({
          where: { id: existingQrSession.id },
          data: { tokenHash: expectedHash },
        });
        existingQrSession.tokenHash = expectedHash;
      }

      return {
        rawToken,
        qrSession: existingQrSession,
        qrUrl: `/qr/${rawToken}`,
        message: 'Đã có phiên QR đang hoạt động cho bàn này',
        order,
        table,
      };
    }

    // Tạo phiên QR mới
    const sessionId = randomUUID();
    const rawToken = this.deriveRawToken(sessionId);
    const tokenHash = this.hashToken(rawToken);

    // Đảm bảo có TableSession hợp lệ trong database
    let tableSessionId = activeSession?.id || (order as any).tableSessionId;
    if (!tableSessionId) {
      const existingSession = await this.prisma.tableSession.findFirst({
        where: { tableId, branchId, status: TableSessionStatus.ACTIVE },
      });
      if (existingSession) {
        tableSessionId = existingSession.id;
      } else {
        const newSession = await this.prisma.tableSession.create({
          data: {
            tableId,
            branchId,
            status: TableSessionStatus.ACTIVE,
            guestCount: order.guestCount || 1,
          },
        });
        tableSessionId = newSession.id;
      }
      await this.prisma.order.update({
        where: { id: order.id },
        data: { tableSessionId },
      });
    }

    const qrSession = await this.prisma.qrOrderSession.create({
      data: {
        id: sessionId,
        orderId: order.id,
        tableSessionId,
        branchId,
        tableId,
        tokenHash,
        status: QrSessionStatus.ACTIVE,
        createdById: user?.id || null,
      },
      include: {
        order: true,
        table: true,
        branch: true,
      },
    });

    return {
      rawToken,
      qrSession,
      qrUrl: `/qr/${rawToken}`,
      order,
      table,
    };
  }

  /**
   * Tạo lại mã QR cho bàn (vô hiệu hóa tức thì toàn bộ token cũ)
   */
  async regenerateQrSession(orderId: string, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, branch: true },
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    // Vô hiệu hóa toàn bộ session cũ
    await this.prisma.qrOrderSession.updateMany({
      where: { orderId, status: QrSessionStatus.ACTIVE },
      data: { status: QrSessionStatus.CLOSED, closedAt: new Date() },
    });

    // Tạo token mới với UUID và HMAC
    const sessionId = randomUUID();
    const rawToken = this.deriveRawToken(sessionId);
    const tokenHash = this.hashToken(rawToken);

    let tableSessionId = (order as any).tableSessionId;
    if (!tableSessionId && order.tableId) {
      const existingSession = await this.prisma.tableSession.findFirst({
        where: { tableId: order.tableId, branchId: order.branchId, status: TableSessionStatus.ACTIVE },
      });
      if (existingSession) {
        tableSessionId = existingSession.id;
      } else {
        const newSession = await this.prisma.tableSession.create({
          data: {
            tableId: order.tableId,
            branchId: order.branchId,
            status: TableSessionStatus.ACTIVE,
            guestCount: order.guestCount || 1,
          },
        });
        tableSessionId = newSession.id;
      }
      await this.prisma.order.update({
        where: { id: order.id },
        data: { tableSessionId },
      });
    }

    const newSession = await this.prisma.qrOrderSession.create({
      data: {
        id: sessionId,
        orderId: order.id,
        tableSessionId: tableSessionId || order.id,
        branchId: order.branchId,
        tableId: order.tableId!,
        tokenHash,
        status: QrSessionStatus.ACTIVE,
        createdById: user?.id || null,
      },
    });

    if (user?.id) {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'REGENERATE_QR_ORDER_SESSION',
          target: `QrOrderSession:${newSession.id}`,
          newValue: JSON.stringify({ orderId, tableId: order.tableId }),
        },
      });
    }

    return {
      rawToken,
      qrSession: newSession,
      qrUrl: `/qr/${rawToken}`,
      order,
    };
  }

  /**
   * Vô hiệu hóa mã QR của bàn
   */
  async disableQrSession(orderId: string, user?: any) {
    await this.prisma.qrOrderSession.updateMany({
      where: { orderId, status: QrSessionStatus.ACTIVE },
      data: { status: QrSessionStatus.DISABLED, closedAt: new Date() },
    });

    if (user?.id) {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'DISABLE_QR_ORDER_SESSION',
          target: `Order:${orderId}`,
          newValue: JSON.stringify({ orderId, status: 'DISABLED' }),
        },
      });
    }

    return { success: true, message: 'Đã vô hiệu hóa mã QR thành công' };
  }

  /**
   * Xác thực và giải quyết phiên gọi món QR từ rawToken bảo mật của khách
   */
  async resolveSessionByToken(rawToken: string) {
    if (!rawToken || rawToken.trim().length === 0) {
      throw new BadRequestException('Mã QR không hợp lệ');
    }

    const tokenHash = createHash('sha256').update(rawToken.trim()).digest('hex');

    const qrSession = await this.prisma.qrOrderSession.findUnique({
      where: { tokenHash },
      include: {
        table: true,
        branch: true,
        order: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                memberCode: true,
                points: true,
                currentPoints: true,
                membershipTier: {
                  select: { id: true, name: true, discountPercent: true },
                },
              },
            },
            buffetSessions: {
              where: { status: BuffetSessionStatus.ACTIVE },
              include: { buffetPackage: true },
            },
            orderItems: {
              include: {
                product: { select: { id: true, name: true, price: true, imageUrl: true } },
                selectedOptions: true,
              },
            },
          },
        },
      },
    });

    if (!qrSession) {
      throw new NotFoundException('Mã QR không tồn tại hoặc đã hết hạn');
    }

    if (qrSession.status === QrSessionStatus.DISABLED) {
      throw new ForbiddenException('Mã QR này đã bị nhân viên tạm khóa');
    }

    if (qrSession.status === QrSessionStatus.EXPIRED || qrSession.status === QrSessionStatus.CLOSED) {
      throw new ForbiddenException('Phiên gọi món đã kết thúc');
    }

    if (!qrSession.branch.onlineOrderingEnabled) {
      throw new ForbiddenException('Chi nhánh hiện đang tạm ngưng nhận gọi món trực tuyến / QR');
    }

    if (
      qrSession.order.status === OrderStatus.COMPLETED ||
      qrSession.order.status === OrderStatus.CANCELLED
    ) {
      await this.prisma.qrOrderSession.update({
        where: { id: qrSession.id },
        data: { status: QrSessionStatus.CLOSED, closedAt: new Date() },
      });
      throw new ForbiddenException('Đơn hàng của bàn đã hoàn tất hoặc bị hủy');
    }

    // Cập nhật thời gian hoạt động
    await this.prisma.qrOrderSession.update({
      where: { id: qrSession.id },
      data: { lastActivityAt: new Date() },
    });

    // Check if points have been redeemed for this order
    const pointTxCount = await this.prisma.pointTransaction.count({
      where: {
        orderId: qrSession.order.id,
        source: PointTransactionSource.REWARD,
      },
    });
    const hasRedeemedPoints = pointTxCount > 0 || ((qrSession.order as any).pointsUsed && (qrSession.order as any).pointsUsed > 0);
    (qrSession.order as any).hasRedeemedPoints = hasRedeemedPoints;

    // Auto-heal Buffet session if open order has Buffet ticket items but session was missing/deactivated
    if (
      (!qrSession.order.buffetSessions || qrSession.order.buffetSessions.length === 0) &&
      qrSession.order.orderItems &&
      qrSession.order.orderItems.length > 0
    ) {
      const candidateProductIds = qrSession.order.orderItems
        .filter((oi) => oi.quantity > 0)
        .map((oi) => oi.productId);
      if (candidateProductIds.length > 0) {
        const matchedTicket = await this.prisma.buffetPackageTicket.findFirst({
          where: {
            productId: { in: candidateProductIds },
            buffetPackage: { branchId: qrSession.branchId, active: true },
          },
          include: {
            buffetPackage: true,
          },
        });
        if (matchedTicket?.buffetPackage) {
          const allPackageTicketIds = (
            await this.prisma.buffetPackageTicket.findMany({
              where: { buffetPackageId: matchedTicket.buffetPackage.id },
              select: { productId: true },
            })
          ).map((t) => t.productId);
          await this.prisma.orderItem.updateMany({
            where: {
              orderId: qrSession.order.id,
              productId: { in: allPackageTicketIds },
              pricingMode: { not: OrderItemPricingMode.BUFFET_TICKET },
            },
            data: {
              pricingMode: OrderItemPricingMode.BUFFET_TICKET,
              buffetPackageId: matchedTicket.buffetPackage.id,
              buffetPackageNameSnapshot: matchedTicket.buffetPackage.name,
            },
          });
          const healedSession = await this.prisma.buffetSession.create({
            data: {
              orderId: qrSession.order.id,
              buffetPackageId: matchedTicket.buffetPackage.id,
              packageNameSnapshot: matchedTicket.buffetPackage.name,
              status: BuffetSessionStatus.ACTIVE,
            },
            include: { buffetPackage: true },
          });
          (qrSession.order as any).buffetSessions = [healedSession];
        }
      }
    }

    return qrSession;
  }

  /**
   * Khách quét QR nhập tên & thông tin thành viên (Join Session)
   */
  async joinGuest(rawToken: string, dto: JoinQrSessionDto) {
    const session = await this.resolveSessionByToken(rawToken);

    let matchedUser: any = null;
    if (dto.memberIdentifier && dto.memberIdentifier.trim().length > 0) {
      const q = dto.memberIdentifier.trim();
      matchedUser = await this.prisma.user.findFirst({
        where: {
          OR: [{ phone: q }, { email: q }, { username: q }, { memberCode: q }],
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          memberCode: true,
          points: true,
          currentPoints: true,
          membershipTier: {
            select: { id: true, name: true, discountPercent: true },
          },
        },
      });
    }

    // Check if points have already been redeemed on this order
    const pointTxCount = await this.prisma.pointTransaction.count({
      where: {
        orderId: session.order.id,
        source: PointTransactionSource.REWARD,
      },
    });
    const orderHasRedeemedPoints = pointTxCount > 0 || ((session.order as any).pointsUsed && (session.order as any).pointsUsed > 0);

    if (orderHasRedeemedPoints && session.order.userId) {
      if (matchedUser && matchedUser.id !== session.order.userId) {
        throw new BadRequestException('Đơn hàng đã áp dụng đổi điểm thưởng, không thể đổi sang tài khoản thành viên khác!');
      }
      if (!matchedUser && dto.memberIdentifier) {
        throw new BadRequestException('Đơn hàng đã áp dụng đổi điểm thưởng, không thể thay đổi tài khoản thành viên!');
      }
    }

    // If no member identifier was provided, but order already has a member from POS/Waiter, inherit that member
    if (!matchedUser && (session.order as any).user) {
      matchedUser = (session.order as any).user;
    }

    // Tìm hoặc tạo khách QrOrderGuest
    let guest = await this.prisma.qrOrderGuest.findFirst({
      where: {
        qrOrderSessionId: session.id,
        deviceSessionId: dto.deviceSessionId,
      },
    });

    if (guest) {
      guest = await this.prisma.qrOrderGuest.update({
        where: { id: guest.id },
        data: {
          guestName: dto.guestName.trim(),
          userId: matchedUser ? matchedUser.id : guest.userId,
          lastSeenAt: new Date(),
        },
      });
    } else {
      guest = await this.prisma.qrOrderGuest.create({
        data: {
          qrOrderSessionId: session.id,
          guestName: dto.guestName.trim(),
          deviceSessionId: dto.deviceSessionId,
          userId: matchedUser?.id || null,
        },
      });
    }

    // Nếu đơn hàng chưa gắn userId thành viên và tìm thấy thành viên hợp lệ
    if (matchedUser && !session.order.userId) {
      await this.prisma.order.update({
        where: { id: session.order.id },
        data: {
          userId: matchedUser.id,
          customerName: matchedUser.fullName,
          customerPhone: matchedUser.phone || session.order.customerPhone,
        },
      });
    }

    return {
      success: true,
      guest: {
        id: guest.id,
        guestName: guest.guestName,
        deviceSessionId: guest.deviceSessionId,
        memberVerified: guest.memberVerified,
        user: matchedUser
          ? {
              fullName: matchedUser.fullName,
              memberCode: matchedUser.memberCode,
              points: matchedUser.points ?? matchedUser.currentPoints,
              tierName: matchedUser.membershipTier?.name,
            }
          : null,
      },
      table: {
        id: session.table.id,
        name: session.table.name,
        tableCode: session.table.tableCode,
      },
      branch: {
        id: session.branch.id,
        name: session.branch.name,
        branchCode: session.branch.branchCode,
      },
      order: {
        id: session.order.id,
        orderCode: session.order.orderCode || (session.order as any).temporaryOrderCode,
        totalAmount: session.order.totalAmount,
        guestCount: session.order.guestCount,
      },
      buffetSession: session.order.buffetSessions?.[0] || null,
    };
  }

  /**
   * Tra cứu thành viên EXACT MATCH theo email/phone/username/memberCode
   */
  async lookupMember(dto: MemberLookupDto) {
    const q = dto.identifier.trim();
    if (!q) return { found: false, message: 'Vui lòng nhập thông tin thành viên' };

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: q }, { email: q }, { username: q }, { memberCode: q }],
      },
      select: {
        id: true,
        fullName: true,
        memberCode: true,
        points: true,
        currentPoints: true,
        membershipTier: {
          select: { id: true, name: true, discountPercent: true },
        },
      },
    });

    if (!user) {
      return { found: false, message: 'Không tìm thấy tài khoản thành viên.' };
    }

    return {
      found: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        memberCode: user.memberCode,
        points: user.points ?? user.currentPoints,
        tierName: user.membershipTier?.name || 'Thành viên',
        discountPercent: user.membershipTier?.discountPercent || 0,
      },
    };
  }

  /**
   * Xác thực tài khoản thành viên để cho phép đổi điểm
   */
  async verifyMember(rawToken: string, dto: MemberVerifyDto) {
    const session = await this.resolveSessionByToken(rawToken);
    const q = dto.identifier.trim();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: q }, { email: q }, { username: q }, { memberCode: q }],
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản thành viên');
    }

    // Kiểm tra mật khẩu nếu có nhập
    if (dto.password && user.passwordHash) {
      const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
      if (!isMatch) {
        throw new BadRequestException('Mật khẩu không chính xác');
      }
    } else if (dto.otp && user.verificationOtp) {
      if (user.verificationOtp !== dto.otp) {
        throw new BadRequestException('Mã xác thực OTP không chính xác');
      }
    } else if (!dto.password && !dto.otp) {
      throw new BadRequestException('Vui lòng nhập mật khẩu hoặc OTP để xác minh');
    }

    // Đánh dấu guest là verified
    await this.prisma.qrOrderGuest.updateMany({
      where: {
        qrOrderSessionId: session.id,
        deviceSessionId: dto.deviceSessionId,
      },
      data: {
        memberVerified: true,
        userId: user.id,
      },
    });

    return {
      success: true,
      message: 'Xác minh thành viên thành công',
      user: {
        id: user.id,
        fullName: user.fullName,
        points: user.points ?? user.currentPoints,
      },
    };
  }

  /**
   * Trả về cấu hình công khai cho Google Sign-In trên trang QR
   */
  async getGoogleAuthConfig(rawToken: string) {
    await this.resolveSessionByToken(rawToken);
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || null;
    return {
      success: true,
      enabled: Boolean(clientId),
      clientId,
      oauthRedirectPath: '/api/auth/google',
    };
  }

  /**
   * Đăng nhập / Đăng ký nhanh khách hàng bằng Google ID Token
   */
  async authenticateWithGoogle(rawToken: string, dto: GoogleQrAuthDto) {
    const session = await this.resolveSessionByToken(rawToken);
    if (!this.authService) {
      throw new BadRequestException('Dịch vụ xác thực Google hiện chưa sẵn sàng.');
    }

    const user = await this.authService.verifyCustomerGoogleIdToken(dto.idToken);
    const linked = await this.linkVerifiedUserToQrSession(session, dto.deviceSessionId, user);
    const jwtToken = this.authService.generateToken(user);

    return {
      ...linked,
      jwtToken,
    };
  }

  /**
   * Liên kết tài khoản khách hàng từ JWT Cookie / Authorization sau OAuth Redirect callback
   */
  async linkAuthenticatedSessionUser(
    rawToken: string,
    userId: string | undefined,
    deviceSessionId: string,
  ) {
    const session = await this.resolveSessionByToken(rawToken);
    if (!userId) {
      throw new UnauthorizedException('Phiên đăng nhập chưa được xác thực.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { membershipTier: true },
    });

    if (!user || user.isAccountLocked) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
    }

    return this.linkVerifiedUserToQrSession(session, deviceSessionId, user);
  }

  /**
   * Helper dùng chung: Gắn User đã xác thực vào QrOrderGuest & Order hiện tại (bảo toàn khóa đổi điểm)
   */
  private async linkVerifiedUserToQrSession(session: any, deviceSessionId: string, user: any) {
    const pointTxCount = await this.prisma.pointTransaction.count({
      where: { orderId: session.order.id, amount: { lt: 0 } },
    });
    const orderHasRedeemedPoints =
      pointTxCount > 0 || (Number((session.order as any).pointsUsed || 0) > 0);

    if (orderHasRedeemedPoints && session.order.userId && session.order.userId !== user.id) {
      throw new BadRequestException(
        'Đơn hàng đã áp dụng đổi điểm thưởng, không thể đổi sang tài khoản thành viên khác!',
      );
    }

    let guest = await this.prisma.qrOrderGuest.findFirst({
      where: {
        qrOrderSessionId: session.id,
        deviceSessionId,
        status: 'ACTIVE',
      },
    });

    const effectiveName = user.fullName?.trim() || guest?.guestName || 'Thành viên AVORA';

    if (guest) {
      guest = await this.prisma.qrOrderGuest.update({
        where: { id: guest.id },
        data: {
          guestName: effectiveName,
          userId: user.id,
          memberVerified: true,
          lastSeenAt: new Date(),
        },
      });
    } else {
      guest = await this.prisma.qrOrderGuest.create({
        data: {
          qrOrderSessionId: session.id,
          guestName: effectiveName,
          deviceSessionId,
          userId: user.id,
          memberVerified: true,
        },
      });
    }

    if (!session.order.userId) {
      await this.prisma.order.update({
        where: { id: session.order.id },
        data: {
          userId: user.id,
          customerName: user.fullName || session.order.customerName,
          customerPhone: user.phone || session.order.customerPhone,
        },
      });
    }

    this.posGateway.emitEvent({
      eventType: 'QR_MEMBER_VERIFIED',
      entityType: 'ORDER',
      entityId: session.order.id,
      branchId: session.branchId,
      payload: {
        orderId: session.order.id,
        guestId: guest.id,
        userId: user.id,
        fullName: user.fullName,
      },
    });

    const resolvedPoints = user.points ?? user.currentPoints ?? 0;

    return {
      success: true,
      message: `Xin chào ${user.fullName || 'thành viên'}! Đã liên kết tài khoản thành viên thành công.`,
      guest: {
        id: guest.id,
        guestName: guest.guestName,
        userId: guest.userId,
        deviceSessionId: guest.deviceSessionId,
        memberVerified: true,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl || null,
          memberCode: user.memberCode,
          points: resolvedPoints,
          tierName: user.membershipTier?.name || null,
          membershipTier: user.membershipTier
            ? {
                name: user.membershipTier.name,
                discountPercent: user.membershipTier.discountPercent,
              }
            : null,
        },
      },
    };
  }

  /**
   * Lấy Lịch sử hoạt động thực tế của bàn/khách theo phiên QR hiện tại (strictly scoped by session & order)
   */
  async getActivityHistory(rawToken: string) {
    const session = await this.resolveSessionByToken(rawToken);

    const [rounds, serviceRequests, pointTransactions, payments] = await Promise.all([
      this.prisma.qrOrderRound.findMany({
        where: {
          qrOrderSessionId: session.id,
          orderId: session.order.id,
        },
        include: {
          guest: { select: { id: true, guestName: true } },
          orderItems: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              priceAtSale: true,
              pricingMode: true,
              kitchenStatus: true,
              optionsTextSnapshot: true,
              note: true,
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.tableServiceRequest.findMany({
        where: {
          orderId: session.order.id,
          tableId: session.tableId,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.pointTransaction.findMany({
        where: {
          orderId: session.order.id,
          amount: { lt: 0 },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.orderPayment.findMany({
        where: {
          orderId: session.order.id,
          status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const staffIds = Array.from(
      new Set(
        [
          ...rounds.map((r: any) => r.approvedById).filter(Boolean),
          ...serviceRequests.map((req) => req.acknowledgedById).filter(Boolean),
        ] as string[],
      ),
    );
    const staffUsers = staffIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const staffNameMap = new Map(staffUsers.map((u) => [u.id, u.fullName]));

    const activities: Array<{
      id: string;
      type: 'ROUND' | 'CALL_STAFF' | 'PAYMENT_REQUEST' | 'OTHER_REQUEST' | 'REWARD_REDEEM' | 'PAYMENT_COMPLETED';
      title: string;
      description: string;
      status: string;
      timestamp: string;
      actorName: string;
      metadata?: Record<string, any>;
    }> = [];

    for (const r of rounds as any[]) {
      const liveItems = Array.isArray(r.orderItems) && r.orderItems.length > 0
        ? r.orderItems.map((it: any) => ({
            id: it.id,
            productId: it.productId,
            productName: it.product?.name || 'Món',
            imageUrl: it.product?.imageUrl || null,
            quantity: it.quantity || 1,
            pricingMode: it.pricingMode || 'REGULAR',
            priceAtSale: Number(it.priceAtSale || 0),
            kitchenStatus: it.kitchenStatus || 'PENDING',
            optionsTextSnapshot: it.optionsTextSnapshot || null,
            note: it.note || null,
          }))
        : Array.isArray(r.itemsSnapshot)
        ? (r.itemsSnapshot as any[]).map((snap: any, idx: number) => ({
            id: `${r.id}-snap-${idx}`,
            productId: snap.productId || '',
            productName: snap.productName || 'Món',
            imageUrl: snap.imageUrl || null,
            quantity: Number(snap.quantity || 1),
            pricingMode: snap.pricingMode || 'REGULAR',
            priceAtSale: Number(snap.priceAtSale || 0),
            kitchenStatus: r.status === 'REJECTED' ? 'CANCELLED' : 'PENDING',
            optionsTextSnapshot: snap.optionsTextSnapshot || null,
            note: snap.note || null,
          }))
        : [];

      const totalQty = liveItems.reduce((s: number, it: any) => s + (it.quantity || 1), 0);
      const previewNames = liveItems
        .slice(0, 3)
        .map((it: any) => `${it.quantity}x ${it.productName}`)
        .join(', ');
      const suffix = liveItems.length > 3 ? ` (+${liveItems.length - 3} món)` : '';

      const staffName =
        r.approvedByName ||
        (r.approvedById ? staffNameMap.get(r.approvedById) : null) ||
        null;
      const normalizedStatus = (r.status || 'SUBMITTED').toUpperCase();
      let statusMessage = 'Đang chờ nhân viên xác nhận gửi bếp';
      if (normalizedStatus === 'APPROVED' || normalizedStatus === 'SUBMITTED') {
        statusMessage =
          staffName && staffName !== 'Hệ thống (Tự gửi bếp)'
            ? `Nhân viên ${staffName} đã xác nhận món và gửi đến bếp chế biến`
            : 'Đã gửi trực tiếp đến bếp chế biến';
      } else if (normalizedStatus === 'REJECTED') {
        const baseMsg = staffName
          ? `Nhân viên ${staffName} đã từ chối nhận món`
          : 'Lượt gọi món đã bị từ chối';
        statusMessage = r.rejectReason ? `${baseMsg}: ${r.rejectReason}` : baseMsg;
      }

      activities.push({
        id: `round-${r.id}`,
        type: 'ROUND',
        title: `Gửi lượt gọi món #${r.roundNumber}`,
        description: previewNames ? `${previewNames}${suffix}` : `${totalQty} món đã gửi`,
        status: r.status || 'SUBMITTED',
        timestamp: (r.submittedAt || r.createdAt).toISOString(),
        actorName: r.guest?.guestName || 'Khách tại bàn',
        metadata: {
          roundId: r.id,
          roundNumber: r.roundNumber,
          itemCount: totalQty,
          items: liveItems,
          staffName,
          approvedAt: r.approvedAt ? new Date(r.approvedAt).toISOString() : null,
          rejectReason: r.rejectReason || null,
          statusMessage,
        },
      });
    }

    for (const req of serviceRequests) {
      const isPayment = req.requestType === 'PAYMENT';
      const isCallStaff = req.requestType === 'CALL_STAFF';
      const isVatRequest = Boolean(req.note?.includes('[Yêu cầu xuất hóa đơn VAT]'));
      const staffName = req.acknowledgedById ? staffNameMap.get(req.acknowledgedById) || null : null;
      const statusLabelMap: Record<string, string> = {
        OPEN: 'Đang chờ tiếp nhận',
        ACKNOWLEDGED: staffName ? `Nhân viên ${staffName} đã tiếp nhận` : 'Nhân viên đã tiếp nhận',
        COMPLETED: staffName ? `Nhân viên ${staffName} đã hoàn tất xử lý` : 'Đã hoàn tất xử lý',
        CANCELLED: 'Đã hủy',
      };

      activities.push({
        id: `req-${req.id}`,
        type: isPayment ? 'PAYMENT_REQUEST' : isCallStaff ? 'CALL_STAFF' : 'OTHER_REQUEST',
        title: isVatRequest
          ? 'Yêu cầu xuất hóa đơn VAT'
          : isPayment
          ? 'Yêu cầu thanh toán'
          : isCallStaff
          ? 'Gọi nhân viên hỗ trợ'
          : 'Yêu cầu phục vụ',
        description:
          req.note ||
          (req.paymentMethodCode ? `Phương thức: ${req.paymentMethodCode}` : statusLabelMap[req.status] || req.status),
        status: req.status,
        timestamp: req.createdAt.toISOString(),
        actorName: 'Khách tại bàn',
        metadata: {
          requestId: req.id,
          requestType: req.requestType,
          paymentMethodCode: req.paymentMethodCode,
          staffName,
          statusMessage: statusLabelMap[req.status] || req.status,
          acknowledgedAt: req.acknowledgedAt ? req.acknowledgedAt.toISOString() : null,
          completedAt: req.completedAt ? req.completedAt.toISOString() : null,
        },
      });
    }

    for (const pt of pointTransactions) {
      activities.push({
        id: `pt-${pt.id}`,
        type: 'REWARD_REDEEM',
        title: 'Đổi điểm thưởng lấy món',
        description: pt.description || `Sử dụng ${Math.abs(pt.amount).toLocaleString('vi-VN')} AVORA Coin`,
        status: 'COMPLETED',
        timestamp: pt.createdAt.toISOString(),
        actorName: 'Thành viên AVORA',
        metadata: {
          pointsDelta: pt.amount,
          balanceAfter: pt.balanceAfter,
        },
      });
    }

    for (const p of payments) {
      activities.push({
        id: `pay-${p.id}`,
        type: 'PAYMENT_COMPLETED',
        title: 'Thanh toán hoàn tất',
        description: `${Math.round(p.amount).toLocaleString('vi-VN')}đ qua ${p.paymentMethod}`,
        status: 'PAID',
        timestamp: p.createdAt.toISOString(),
        actorName: 'Thu ngân',
        metadata: {
          amount: p.amount,
          paymentMethod: p.paymentMethod,
        },
      });
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      success: true,
      orderPaymentStatus: (session.order as any).paymentStatus || 'UNPAID',
      summary: {
        totalEvents: activities.length,
        pendingRequests: serviceRequests.filter((r) => r.status === 'OPEN' || r.status === 'ACKNOWLEDGED').length,
      },
      activities,
    };
  }

  /**
   * Lấy Thực đơn hiển thị trên Web QR (Tách rõ Tab Buffet nếu có Buffet Session ACTIVE)
   */
  async getMenu(rawToken: string) {
    const session = await this.resolveSessionByToken(rawToken);
    const activeBuffetSession = session.order.buffetSessions?.[0] || null;

    const formatOptionGroup = (og: any) => {
      const isRequired = Boolean(og.isRequired ?? ((og.minSelect ?? og.minSelections ?? 0) > 0));
      const multipleChoice = Boolean(og.multipleChoice ?? ((og.maxSelect ?? og.maxSelections ?? 1) > 1));
      const minSelect =
        typeof og.minSelect === 'number'
          ? og.minSelect
          : typeof og.minSelections === 'number'
          ? og.minSelections
          : isRequired
          ? 1
          : 0;
      const maxSelect =
        typeof og.maxSelect === 'number'
          ? og.maxSelect
          : typeof og.maxSelections === 'number'
          ? og.maxSelections
          : multipleChoice
          ? (og.optionItems?.length || 99)
          : 1;

      const rawItems = og.optionItems || og.items || [];
      const items = rawItems.map((item: any) => ({
        ...item,
        priceAdjustment: Number(item.priceAdjustment || 0),
        isDefault: Boolean(item.isDefault),
        available: item.available ?? true,
      }));

      return {
        ...og,
        isRequired,
        multipleChoice,
        minSelect,
        maxSelect,
        minSelections: minSelect,
        maxSelections: maxSelect,
        items,
        optionItems: items,
      };
    };

    // Lấy danh mục áp dụng cho chi nhánh (bao gồm danh mục dùng chung chưa gắn chi nhánh cụ thể, loại trừ system-hidden)
    const categories = await this.prisma.category.findMany({
      where: {
        slug: { not: 'system-hidden' },
        OR: [
          { branches: { none: {} } },
          { branches: { some: { id: session.branchId } } },
        ],
      },
      include: {
        products: {
          where: {
            available: true,
            branches: { some: { id: session.branchId } },
          },
          include: {
            optionGroups: {
              where: { optionItems: { some: { available: true } } },
              include: {
                optionItems: { where: { available: true }, orderBy: { displayOrder: 'asc' } },
              },
              orderBy: { displayOrder: 'asc' },
            },
            FlashSaleItem: {
              where: {
                flashSale: {
                  isActive: true,
                  startTime: { lte: new Date() },
                  endTime: { gte: new Date() },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Nếu bàn có Buffet Session: Lấy danh sách món con trong gói Buffet
    let buffetPackageData: any = null;
    let buffetItems: any[] = [];

    if (activeBuffetSession) {
      const buffetPkg = await this.prisma.buffetPackage.findUnique({
        where: { id: activeBuffetSession.buffetPackageId },
        include: {
          items: {
            where: { availableForQr: true },
            include: {
              product: {
                include: {
                  category: true,
                  branches: { select: { id: true } },
                  optionGroups: {
                    include: { optionItems: { where: { available: true } } },
                  },
                },
              },
            },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      if (buffetPkg) {
        buffetPackageData = {
          id: buffetPkg.id,
          name: buffetPkg.name,
          description: buffetPkg.description,
          maxItemsPerSubmission: buffetPkg.maxItemsPerSubmission ?? null,
        };
        // Đếm số lượng từng món Buffet đã gọi trong bữa (trừ món đã hủy) để hiển thị quota còn lại
        const orderedBuffetRows = await this.prisma.orderItem.findMany({
          where: {
            orderId: session.order.id,
            pricingMode: OrderItemPricingMode.BUFFET_INCLUDED,
            kitchenStatus: { not: KitchenStatus.CANCELLED },
          },
          select: { productId: true, quantity: true },
        });
        const usedTotalByProduct = new Map<string, number>();
        for (const row of orderedBuffetRows) {
          usedTotalByProduct.set(
            row.productId,
            (usedTotalByProduct.get(row.productId) || 0) + (Number(row.quantity) || 0),
          );
        }

        // CHỈ LẤY MÓN CỦA GÓI BUFFET THỰC SỰ KHẢ DỤNG TẠI CHI NHÁNH VÀ CÓ KÊNH QR_ORDER
        const validItems = buffetPkg.items.filter((it) => {
          const prod = it.product;
          if (!prod || !prod.available) return false;
          // Phải thuộc chi nhánh của bàn
          const isAtBranch = prod.branches?.some((b: any) => b.id === session.branchId);
          if (!isAtBranch) return false;
          // Phải hỗ trợ kênh QR_ORDER
          const channels = Array.isArray(prod.salesChannels) ? (prod.salesChannels as string[]) : [];
          if (!channels.includes('QR_ORDER')) return false;
          return true;
        });

        buffetItems = validItems.map((it) => {
          const usedTotalQuantity = usedTotalByProduct.get(it.productId) || 0;
          const maxTotalQuantity = it.maxTotalQuantity ?? null;
          const remainingTotalQuantity =
            typeof maxTotalQuantity === 'number' && maxTotalQuantity > 0
              ? Math.max(0, maxTotalQuantity - usedTotalQuantity)
              : null;

          return {
            ...it.product,
            categoryName: it.product?.category?.name,
            categoryDisplayOrder: it.product?.category?.displayOrder ?? 0,
            optionGroups: ((it.product as any)?.optionGroups || []).map(formatOptionGroup),
            baseBuffetPrice: 0,
            allowRetailPurchase: it.allowRetailPurchase,
            maxQuantityPerRound: it.maxQuantityPerRound ?? null,
            maxTotalQuantity,
            usedTotalQuantity,
            remainingTotalQuantity,
          };
        });
      }
    }

    return {
      success: true,
      hasActiveBuffet: Boolean(activeBuffetSession),
      buffetPackage: buffetPackageData,
      buffetItems,
      retailCategories: categories
        .map((cat) => {
          const validProducts = cat.products.filter((p) => {
            if (!p.available) return false;
            // Phải hỗ trợ kênh bán QR_ORDER
            const channels = Array.isArray(p.salesChannels) ? (p.salesChannels as string[]) : [];
            if (!channels.includes('QR_ORDER')) return false;
            return true;
          });

          return {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            displayOrder: cat.displayOrder,
            products: validProducts.map((p) => {
              const activeFlashSale = p.FlashSaleItem?.[0];
              const effectivePrice = activeFlashSale
                ? activeFlashSale.flashSalePrice
                : p.discountedPrice || p.price;
              return {
                id: p.id,
                itemCode: p.itemCode,
                name: p.name,
                price: p.price,
                oldPrice: p.oldPrice,
                effectivePrice,
                unit: p.unit,
                badge: p.badge,
                imageUrl: p.imageUrl,
                description: p.description,
                isBestSeller: p.isBestSeller,
                available: p.available ?? true,
                optionGroups: (p.optionGroups || []).map(formatOptionGroup),
              };
            }),
          };
        })
        .filter((cat) => cat.products.length > 0),
    };
  }

  /**
   * Lấy chi tiết đơn hàng của bàn cho giao diện "Đơn của bàn"
   */
  async getOrder(rawToken: string) {
    const session = await this.resolveSessionByToken(rawToken);

    const [order, rounds] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id: session.order.id },
        include: {
          table: true,
          orderItems: {
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
              selectedOptions: true,
            },
            orderBy: { id: 'desc' },
          },
        },
      }),
      this.prisma.qrOrderRound.findMany({
        where: { qrOrderSessionId: session.id },
        include: {
          guest: { select: { id: true, guestName: true } },
          orderItems: {
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
              selectedOptions: true,
            },
          },
        },
        orderBy: { roundNumber: 'desc' },
      }),
    ]);

    return {
      success: true,
      order,
      rounds,
    };
  }

  /**
   * Gửi đợt gọi món mới (QR Order Round)
   * Kiểm tra nghiêm ngặt Idempotency, Quyền Buffet, Tách Món Lẻ vs Buffet, và Cập nhật Realtime
   */
  async submitRound(rawToken: string, dto: SubmitQrRoundDto) {
    const session = await this.resolveSessionByToken(rawToken);

    // 1. Chống duplicate đúp đơn bằng Idempotency Key
    const existingRound = await this.prisma.qrOrderRound.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: {
        orderItems: { include: { product: true, selectedOptions: true } },
      },
    });
    if (existingRound) {
      this.logger.warn(`Idempotency key hit: ${dto.idempotencyKey}. Returning existing round result.`);
      return { success: true, round: existingRound, message: 'Đơn hàng đã được tiếp nhận trước đó' };
    }

    // 2. Định danh khách gửi món
    const guest = await this.prisma.qrOrderGuest.findFirst({
      where: {
        qrOrderSessionId: session.id,
        deviceSessionId: dto.deviceSessionId,
      },
    });

    const actorDisplayName = guest ? `${guest.guestName} (QR)` : 'Khách QR';

    // 3. Kiểm tra Buffet Session đang hoạt động & Cấu hình chi nhánh
    const activeBuffetSession = session.order.buffetSessions?.[0] || null;
    const branchInfo = await this.prisma.branch.findUnique({
      where: { id: session.branchId },
      select: { qrAutoSendToKitchen: true },
    });
    const autoSendToKitchen = branchInfo?.qrAutoSendToKitchen ?? false;
    const initialRoundStatus = autoSendToKitchen ? 'APPROVED' : 'PENDING_APPROVAL';

    // 4. Lấy danh sách sản phẩm được chọn
    const productIds = dto.items.map((it) => it.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        branches: { some: { id: session.branchId } },
        available: true,
      },
      include: {
        category: true,
        optionGroups: { include: { optionItems: true } },
        buffetPackageItems: activeBuffetSession
          ? { where: { buffetPackageId: activeBuffetSession.buffetPackageId } }
          : false,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 5. Chuẩn bị dữ liệu OrderItem
    const validatedItemsData: any[] = [];

    for (const item of dto.items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        // Tìm thông tin món để trả về thông báo lỗi thân thiện kèm tên món
        const fallbackItem = await this.prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true, available: true, branches: { select: { id: true } } },
        });
        const dishName = fallbackItem?.name || item.productId;
        if (!fallbackItem || !fallbackItem.available) {
          throw new BadRequestException(`Món "${dishName}" hiện đang tạm hết.`);
        }
        throw new BadRequestException(`Món "${dishName}" không khả dụng tại chi nhánh này.`);
      }

      // Kiểm tra món có kênh QR_ORDER không
      const channels = Array.isArray(prod.salesChannels) ? (prod.salesChannels as string[]) : [];
      if (!channels.includes('QR_ORDER')) {
        throw new BadRequestException(`Món "${prod.name}" không áp dụng đặt món qua kênh QR Order.`);
      }

      const isBuffetRequested =
        item.requestedPricingMode === 'BUFFET_INCLUDED' ||
        (item as any).pricingMode === 'BUFFET_INCLUDED';
      let finalPricingMode: OrderItemPricingMode = OrderItemPricingMode.REGULAR;
      let baseUnitPrice = prod.discountedPrice || prod.price;

      if (isBuffetRequested) {
        if (!activeBuffetSession) {
          throw new BadRequestException(
            `Bàn chưa kích hoạt gói Buffet. Không thể gọi món [${prod.name}] theo hình thức Buffet 0đ.`,
          );
        }

        const buffetItemConfig = prod.buffetPackageItems?.[0];
        if (!buffetItemConfig || !buffetItemConfig.availableForQr) {
          throw new BadRequestException(
            `Món [${prod.name}] không thuộc gói Buffet [${activeBuffetSession.packageNameSnapshot}] hoặc không cho phép gọi qua QR.`,
          );
        }

        finalPricingMode = OrderItemPricingMode.BUFFET_INCLUDED;
        baseUnitPrice = 0; // Giá gốc món Buffet = 0đ
      }

      // Xử lý Option và phụ thu (Option phụ thu vẫn tính bình thường dù món chính là Buffet 0đ!)
      let optionsAdjustment = 0;
      const selectedOptionsData: any[] = [];
      const optionsTextParts: string[] = [];

      const rawOptions = item.selectedOptions || [];
      const legacyOptionIds = item.selectedOptionIds || [];

      for (const og of prod.optionGroups) {
        for (const oi of og.optionItems) {
          const matchedDtoOpt = rawOptions.find((o) => o.optionItemId === oi.id);
          const isLegacySelected = legacyOptionIds.includes(oi.id);

          if (matchedDtoOpt || isLegacySelected) {
            const optQty = matchedDtoOpt?.quantity || 1;
            const singleAdj = oi.priceAdjustment;
            optionsAdjustment += singleAdj * optQty;

            selectedOptionsData.push({
              optionItemId: oi.id,
              nameAtSale: oi.name,
              priceAdjustmentAtSale: singleAdj,
              quantity: optQty,
            });

            optionsTextParts.push(
              singleAdj > 0
                ? `${oi.name}${optQty > 1 ? ` x${optQty}` : ''} (+${(singleAdj * optQty).toLocaleString('vi-VN')}đ)`
                : `${oi.name}${optQty > 1 ? ` x${optQty}` : ''}`,
            );
          }
        }
      }

      const finalItemUnitPrice = baseUnitPrice + optionsAdjustment;

      validatedItemsData.push({
        orderId: session.order.id,
        productId: prod.id,
        quantity: item.quantity,
        priceAtSale: finalItemUnitPrice,
        originalPriceAtSale: prod.price,
        discountAmount: 0,
        discountReason: isBuffetRequested ? `Thuộc gói Buffet [${activeBuffetSession.packageNameSnapshot}]` : null,
        note: item.note?.trim() || null,
        optionsTextSnapshot: optionsTextParts.join(', ') || null,
        stationId: this.determineStationId(prod.category?.slug, prod.name),
        kitchenStatus: KitchenStatus.PENDING,
        pricingMode: finalPricingMode,
        buffetSessionId: isBuffetRequested ? activeBuffetSession.id : null,
        buffetPackageId: isBuffetRequested ? activeBuffetSession.buffetPackageId : null,
        buffetPackageNameSnapshot: isBuffetRequested ? activeBuffetSession.packageNameSnapshot : null,
        buffetReferencePriceSnapshot: isBuffetRequested ? prod.price : null,
        source: OrderItemSource.QR_ORDER,
        orderedById: guest?.userId || null,
        orderedByName: actorDisplayName,
        selectedOptions: {
          create: selectedOptionsData,
        },
      });
    }

    // 6. Ghi Database trong Prisma Transaction (kèm kiểm tra giới hạn số lượng mỗi lần gửi & giới hạn từng món)
    const requestedQuantity = dto.items.reduce(
      (sum, it) => sum + Math.max(0, Number(it.quantity) || 0),
      0,
    );

    // Gom tổng số lượng món BUFFET_INCLUDED theo từng productId trong lượt gửi này
    const requestedBuffetByProduct = new Map<
      string,
      {
        productName: string;
        quantity: number;
        maxQuantityPerRound: number | null;
        maxTotalQuantity: number | null;
      }
    >();
    if (activeBuffetSession) {
      for (const itemData of validatedItemsData) {
        if (itemData.pricingMode !== OrderItemPricingMode.BUFFET_INCLUDED) continue;
        const prod = productMap.get(itemData.productId);
        const cfg = prod?.buffetPackageItems?.[0];
        const prev = requestedBuffetByProduct.get(itemData.productId);
        const addQty = Math.max(0, Number(itemData.quantity) || 0);
        requestedBuffetByProduct.set(itemData.productId, {
          productName: prod?.name || 'Món Buffet',
          quantity: (prev?.quantity || 0) + addQty,
          maxQuantityPerRound: cfg?.maxQuantityPerRound ?? null,
          maxTotalQuantity: cfg?.maxTotalQuantity ?? null,
        });
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Kiểm tra giới hạn số lượng món trong MỘT LẦN GỬI (không cộng dồn các lượt trước)
      if (activeBuffetSession) {
        const freshPackage = await tx.buffetPackage.findUnique({
          where: { id: activeBuffetSession.buffetPackageId },
          select: { maxItemsPerSubmission: true },
        });
        const maxLimit = freshPackage?.maxItemsPerSubmission;
        if (typeof maxLimit === 'number' && maxLimit > 0 && requestedQuantity > maxLimit) {
          throw new BadRequestException({
            code: 'BUFFET_SUBMISSION_LIMIT_EXCEEDED',
            message: `Bạn đang chọn ${requestedQuantity} món, vượt quá giới hạn ${maxLimit} món cho mỗi lần gọi. Vui lòng điều chỉnh số lượng trước khi gửi.`,
            maxItemsPerSubmission: maxLimit,
            requestedQuantity,
            remainingQuantity: Math.max(0, maxLimit - requestedQuantity),
          });
        }

        // Kiểm tra giới hạn theo từng món cụ thể (tối đa mỗi lần gọi & tổng tối đa cả bữa)
        const cappedProductIds = Array.from(requestedBuffetByProduct.keys()).filter((pid) => {
          const entry = requestedBuffetByProduct.get(pid);
          return (
            (entry?.maxQuantityPerRound && entry.maxQuantityPerRound > 0) ||
            (entry?.maxTotalQuantity && entry.maxTotalQuantity > 0)
          );
        });

        if (cappedProductIds.length > 0) {
          // Bước 1: Kiểm tra giới hạn tối đa mỗi lần gọi của từng món
          for (const [productId, entry] of requestedBuffetByProduct.entries()) {
            if (
              typeof entry.maxQuantityPerRound === 'number' &&
              entry.maxQuantityPerRound > 0 &&
              entry.quantity > entry.maxQuantityPerRound
            ) {
              throw new BadRequestException({
                code: 'BUFFET_ITEM_ROUND_LIMIT_EXCEEDED',
                message: `Món "${entry.productName}" chỉ được gọi tối đa ${entry.maxQuantityPerRound} phần mỗi lần gửi (bạn đang chọn ${entry.quantity} phần).`,
                productId,
                productName: entry.productName,
                maxQuantityPerRound: entry.maxQuantityPerRound,
                requestedQuantity: entry.quantity,
              });
            }
          }

          // Bước 2: Kiểm tra giới hạn tổng số lượng trong suốt bữa Buffet (cộng dồn cả lượt trước)
          const totalCappedIds = cappedProductIds.filter((pid) => {
            const entry = requestedBuffetByProduct.get(pid);
            return typeof entry?.maxTotalQuantity === 'number' && entry.maxTotalQuantity > 0;
          });

          if (totalCappedIds.length > 0) {
            const existingOrderItems = await tx.orderItem.findMany({
              where: {
                orderId: session.order.id,
                productId: { in: totalCappedIds },
                pricingMode: OrderItemPricingMode.BUFFET_INCLUDED,
                kitchenStatus: { not: KitchenStatus.CANCELLED },
              },
              select: { productId: true, quantity: true },
            });

            const usedMap = new Map<string, number>();
            for (const row of existingOrderItems) {
              usedMap.set(
                row.productId,
                (usedMap.get(row.productId) || 0) + (Number(row.quantity) || 0),
              );
            }

            for (const productId of totalCappedIds) {
              const entry = requestedBuffetByProduct.get(productId)!;
              const maxTotal = entry.maxTotalQuantity!;
              const usedTotal = usedMap.get(productId) || 0;
              const remaining = Math.max(0, maxTotal - usedTotal);

              if (usedTotal + entry.quantity > maxTotal) {
                throw new BadRequestException({
                  code: 'BUFFET_ITEM_TOTAL_LIMIT_EXCEEDED',
                  message:
                    remaining === 0
                      ? `Món "${entry.productName}" đã đạt giới hạn tối đa ${maxTotal} phần trong bữa Buffet này.`
                      : `Món "${entry.productName}" chỉ còn được gọi thêm ${remaining}/${maxTotal} phần trong bữa Buffet này (đã gọi ${usedTotal}, đang chọn ${entry.quantity}).`,
                  productId,
                  productName: entry.productName,
                  maxTotalQuantity: maxTotal,
                  usedTotalQuantity: usedTotal,
                  remainingTotalQuantity: remaining,
                  requestedQuantity: entry.quantity,
                });
              }
            }
          }
        }
      }

      // Đếm số round hiện tại
      const roundCount = await tx.qrOrderRound.count({
        where: { qrOrderSessionId: session.id },
      });

      const itemsSnapshot = validatedItemsData.map((vi) => {
        const prod = productMap.get(vi.productId);
        return {
          productId: vi.productId,
          productName: prod?.name || 'Món',
          imageUrl: prod?.imageUrl || null,
          quantity: vi.quantity,
          pricingMode: vi.pricingMode,
          priceAtSale: vi.priceAtSale,
          optionsTextSnapshot: vi.optionsTextSnapshot || null,
          note: vi.note || null,
        };
      });

      const round = await tx.qrOrderRound.create({
        data: {
          qrOrderSessionId: session.id,
          qrGuestId: guest?.id || null,
          orderId: session.order.id,
          roundNumber: roundCount + 1,
          idempotencyKey: dto.idempotencyKey,
          status: initialRoundStatus,
          approvedByName: autoSendToKitchen ? 'Hệ thống (Tự gửi bếp)' : null,
          approvedAt: autoSendToKitchen ? new Date() : null,
          itemsSnapshot,
        },
      });

      // Tạo OrderItems
      for (const itemData of validatedItemsData) {
        itemData.qrOrderRoundId = round.id;
        itemData.sentToKitchenAt = autoSendToKitchen ? new Date() : null;
        await tx.orderItem.create({ data: itemData });
      }

      // Tính toán lại tổng tiền đơn hàng
      const allItems = await tx.orderItem.findMany({
        where: { orderId: session.order.id },
        include: { product: true },
      });

      const pricing = await this.orderPricingService.calculatePricing({
        items: allItems.map((oi) => ({
          productId: oi.productId,
          priceAtSale: oi.priceAtSale,
          quantity: oi.quantity,
          taxPercentage: oi.product?.taxPercentage || 0,
          pricingMode: oi.pricingMode as any,
          buffetSessionId: oi.buffetSessionId,
        })),
        orderDiscountAmount: session.order.discountAmount,
      });

      const updatedOrder = await tx.order.update({
        where: { id: session.order.id },
        data: {
          subTotal: pricing.subTotal,
          taxAmount: pricing.taxAmount,
          totalAmount: pricing.totalAmount,
          version: { increment: 1 },
          kitchenStatus: KitchenStatus.PENDING,
        },
        include: {
          table: true,
          orderItems: {
            include: {
              product: { select: { id: true, name: true, price: true, imageUrl: true } },
              selectedOptions: true,
            },
          },
        },
      });

      return { round, updatedOrder };
    });

    // 7. Đồng bộ Realtime tới POS và Waiter
    this.posGateway.emitOrderUpdated(result.updatedOrder, guest?.userId || undefined, session.table.name);
    if (this.posGateway?.server) {
      this.posGateway.server.to(`branch:${session.branchId}`).emit('QR_ORDER_CREATED', {
        branchId: session.branchId,
        orderId: session.order.id,
        roundId: result.round.id,
        tableName: session.table.name,
      });
    }
    this.posGateway.emitEvent({
      eventType: 'QR_ORDER_ROUND_SUBMITTED',
      entityType: 'ORDER',
      entityId: session.order.id,
      branchId: session.branchId,
      payload: {
        roundId: result.round.id,
        roundNumber: result.round.roundNumber,
        tableId: session.tableId,
        tableName: session.table.name,
        guestName: guest?.guestName || 'Khách',
        itemCount: dto.items.length,
        status: initialRoundStatus,
        autoSendToKitchen,
        order: result.updatedOrder,
      },
    });

    const displayCode = result.updatedOrder.orderCode || result.updatedOrder.temporaryOrderCode || result.updatedOrder.id;
    const roundItemsSummary =
      validatedItemsData.length > 0
        ? validatedItemsData
            .map((vi) => {
              const prod = productMap.get(vi.productId);
              const extras: string[] = [];
              if (vi.optionsTextSnapshot) extras.push(vi.optionsTextSnapshot);
              if (vi.note) extras.push(`Ghi chú: ${vi.note}`);
              return `${vi.quantity}x ${prod?.name || 'Món'}${extras.length > 0 ? ` (${extras.join(' • ')})` : ''}`;
            })
            .join(', ')
        : `${dto.items.length} món mới`;

    if (this.orderAuditService) {
      this.orderAuditService
        .log({
          orderId: result.updatedOrder.id,
          orderCode: displayCode,
          action: 'CUSTOMER_ORDER_ADDED',
          category: 'ITEM',
          actorName: guest?.guestName ? `${guest.guestName} (QR)` : `Khách bàn ${session.table.name || ''}`,
          branchId: session.branchId,
          newValue: {
            roundNumber: result.round.roundNumber,
            itemsSummary: roundItemsSummary,
            totalAmount: result.updatedOrder.totalAmount,
          },
          metadata: { source: 'QR_ORDER', roundId: result.round.id },
        })
        .catch(() => {});
    }

    const builtAdd = buildOrderNotificationPayload({
      eventType: 'CUSTOMER_ORDER_ADDED',
      orderCode: displayCode,
      orderType: result.updatedOrder.orderType || 'DINE_IN',
      tableName: session.table.name || session.table.tableCode,
      itemsSummary: roundItemsSummary,
    });
    this.notificationEngine
      .publishEvent({
        eventType: 'CUSTOMER_ORDER_ADDED',
        category: 'ORDER',
        priority: mapPriorityToNumeric(builtAdd.priority),
        icon: builtAdd.icon,
        branchId: session.branchId,
        entityId: result.updatedOrder.id,
        subId: result.round.id,
        title: builtAdd.title,
        message: builtAdd.message,
        actor: {
          name: guest?.guestName || `Khách bàn ${session.table.name || ''}`,
        },
        reference: {
          type: 'ORDER',
          id: result.updatedOrder.id,
          url: `/admin/orders/${result.updatedOrder.id}`,
        },
        metadata: {
          orderId: result.updatedOrder.id,
          orderCode: displayCode,
          roundId: result.round.id,
          roundNumber: result.round.roundNumber,
          tableId: session.tableId,
          tableName: session.table.name || session.table.tableCode,
        },
        requiredPermissions: ['pos.order.view', 'pos.access', 'waiter.access', 'orders.view'],
        appScopes: ['POS', 'WAITER', 'ADMIN'],
        legacyType: 'ORDER',
      })
      .catch((err) => this.logger.error('Error publishing CUSTOMER_ORDER_ADDED:', err));

    const responseMessage = autoSendToKitchen
      ? `Đã gửi lượt gọi món #${result.round.roundNumber} thành công! Bếp đang chuẩn bị món cho bàn.`
      : `Đã gửi lượt gọi món #${result.round.roundNumber} thành công! Vui lòng đợi nhân viên xác nhận món.`;

    return {
      success: true,
      message: responseMessage,
      round: result.round,
      order: result.updatedOrder,
      autoSendToKitchen,
    };
  }

  /**
   * Tạo yêu cầu hỗ trợ (Gọi nhân viên / Yêu cầu thanh toán)
   */
  async createServiceRequest(rawToken: string, dto: CreateServiceRequestDto) {
    const session = await this.resolveSessionByToken(rawToken);

    const guest = await this.prisma.qrOrderGuest.findFirst({
      where: {
        qrOrderSessionId: session.id,
        deviceSessionId: dto.deviceSessionId,
      },
    });

    // Nếu yêu cầu thanh toán có chỉ định phương thức, xác thực phương thức đó hợp lệ cho QR & chi nhánh
    if (dto.requestType === 'PAYMENT' && dto.paymentMethodCode) {
      const { methods } = await this.getPaymentMethods(rawToken);
      const isAllowed = methods.some(
        (m) => m.methodCode.toUpperCase() === dto.paymentMethodCode?.toUpperCase(),
      );
      if (!isAllowed) {
        throw new BadRequestException(
          'Phương thức thanh toán hiện không khả dụng cho bàn hoặc giá trị đơn hàng này.',
        );
      }
    }

    // Chống spam: Kiểm tra xem đã có request cùng loại đang OPEN trong vòng 45s qua không
    const recentRequest = await this.prisma.tableServiceRequest.findFirst({
      where: {
        tableId: session.tableId,
        requestType: dto.requestType as TableServiceRequestType,
        status: TableServiceRequestStatus.OPEN,
        createdAt: { gte: new Date(Date.now() - 45000) },
      },
    });

    if (recentRequest) {
      return {
        success: true,
        isDuplicate: true,
        message: 'Đang có yêu cầu chờ phục vụ tiếp nhận, vui lòng đợi trong giây lát',
        request: recentRequest,
      };
    }

    const serviceRequest = await this.prisma.tableServiceRequest.create({
      data: {
        orderId: session.order.id,
        tableId: session.tableId,
        tableSessionId: session.tableSessionId,
        branchId: session.branchId,
        qrOrderSessionId: session.id,
        qrGuestId: guest?.id || null,
        requestType: dto.requestType as TableServiceRequestType,
        paymentMethodCode: dto.paymentMethodCode || null,
        status: TableServiceRequestStatus.OPEN,
        note: dto.note?.trim() || null,
      },
    });

    const isPayment = dto.requestType === 'PAYMENT';
    const tableName = session.table.name || session.table.tableCode;
    const guestTitle = guest ? `Khách ${guest.guestName}` : 'Khách';
    const displayCode = session.order.orderCode || session.order.temporaryOrderCode || session.order.id;

    const canonicalEvent = isPayment ? 'PAYMENT_REQUESTED' : 'HELP_REQUESTED';
    const builtReq = buildOrderNotificationPayload({
      eventType: canonicalEvent,
      orderCode: displayCode,
      orderType: session.order.orderType || 'DINE_IN',
      tableName,
      customerName: guest?.guestName || session.order.customerName || 'Khách hàng',
      totalAmount: session.order.totalAmount,
      reason: dto.note?.trim() || (dto.paymentMethodCode ? `Phương thức: ${dto.paymentMethodCode}` : null),
    });

    if (this.orderAuditService) {
      this.orderAuditService
        .log({
          orderId: session.order.id,
          orderCode: displayCode,
          action: canonicalEvent,
          category: isPayment ? 'PAYMENT' : 'ORDER',
          actorName: `${guestTitle} (${tableName})`,
          branchId: session.branchId,
          reason: dto.note?.trim() || null,
          newValue: {
            requestType: dto.requestType,
            paymentMethodCode: dto.paymentMethodCode || null,
            tableName,
          },
          metadata: { source: 'QR_ORDER', requestId: serviceRequest.id },
        })
        .catch(() => {});
    }

    // Bắn socket event và notification audio tới POS / Waiter
    await this.notificationEngine.publishEvent({
      eventType: canonicalEvent,
      category: isPayment ? 'PAYMENT' : 'SERVICE',
      priority: mapPriorityToNumeric(builtReq.priority),
      icon: builtReq.icon,
      branchId: session.branchId,
      entityId: isPayment ? session.order.id : session.table.id,
      subId: serviceRequest.id,
      title: builtReq.title,
      message: builtReq.message,
      actor: { name: `${guestTitle} (${tableName})` },
      reference: {
        type: isPayment ? 'ORDER' : 'TABLE',
        id: isPayment ? session.order.id : session.table.id,
        url: isPayment ? `/admin/orders/${session.order.id}` : `/admin/pos?tableId=${session.table.id}`,
      },
      metadata: {
        requestId: serviceRequest.id,
        orderId: session.order.id,
        tableId: session.table.id,
        tableName,
        branchId: session.branchId,
        requestType: dto.requestType,
        paymentMethodCode: dto.paymentMethodCode,
        note: dto.note,
      },
      requiredPermissions: isPayment
        ? ['pos.payment.collect', 'pos.access', 'waiter.access']
        : ['waiter.access', 'pos.access'],
      appScopes: isPayment ? ['POS', 'WAITER', 'ADMIN'] : ['WAITER', 'POS'],
      legacyType: isPayment ? 'ORDER' : 'SYSTEM',
    });

    this.posGateway.emitEvent({
      eventType: canonicalEvent,
      entityType: 'TABLE',
      entityId: session.tableId,
      branchId: session.branchId,
      payload: {
        requestId: serviceRequest.id,
        orderId: session.order.id,
        tableId: session.tableId,
        tableName,
        guestName: guest?.guestName || 'Khách',
        requestType: dto.requestType,
        paymentMethodCode: dto.paymentMethodCode,
        note: dto.note,
      },
    });

    if (this.posGateway?.server) {
      this.posGateway.server.to(`branch:${session.branchId}`).emit('QR_ORDER_CREATED', {
        branchId: session.branchId,
        orderId: session.order.id,
        requestId: serviceRequest.id,
        requestType: dto.requestType,
        tableName,
      });
      this.posGateway.server.to(`order:${session.order.id}`).emit('SERVICE_REQUEST_UPDATED', {
        payload: {
          requestId: serviceRequest.id,
          requestType: dto.requestType,
          status: serviceRequest.status,
        },
      });
    }

    return {
      success: true,
      message: isPayment
        ? 'Đã gửi yêu cầu thanh toán. Nhân viên sẽ đến bàn hỗ trợ Quý khách ngay!'
        : 'Đã gọi nhân viên. Nhân viên đang đến hỗ trợ Quý khách!',
      request: serviceRequest,
    };
  }

  /**
   * Kiểm tra phương thức thanh toán đã đủ cấu hình vận hành trên kênh QR Ordering hay chưa
   */
  private isPaymentMethodConfiguredForQr(method: {
    gatewayType: string;
    bankCode?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
    configId?: string | null;
    configKey1?: string | null;
  }): boolean {
    const gateway = (method.gatewayType || '').toUpperCase().trim();
    if (gateway === 'CASH' || gateway === 'CARD') {
      return true;
    }
    if (gateway === 'TRANSFER' || gateway === 'SEPAY' || gateway === 'SEPAY_QR') {
      return Boolean(method.bankCode && method.accountNumber && method.accountName);
    }
    if (gateway === 'PAYOS' || gateway === 'VNPAY' || gateway === 'MOMO') {
      return Boolean(method.configId && method.configKey1);
    }
    return false;
  }

  /**
   * Lấy danh sách phương thức thanh toán THẬT từ database cho modal thanh toán QR
   * Dựa trên cờ isActiveForQr riêng biệt, phạm vi chi nhánh, minOrderValue và cấu hình cổng hợp lệ.
   */
  async getPaymentMethods(rawToken: string) {
    const session = await this.resolveSessionByToken(rawToken);

    const rawMethods = await this.prisma.paymentMethod.findMany({
      where: {
        isActiveForQr: true,
        minOrderValue: { lte: session.order.totalAmount },
        OR: [
          { isAllBranches: true },
          { branches: { some: { id: session.branchId } } },
        ],
      },
      select: {
        id: true,
        methodCode: true,
        name: true,
        description: true,
        iconUrl: true,
        gatewayType: true,
        minOrderValue: true,
        bankCode: true,
        accountNumber: true,
        accountName: true,
        configId: true,
        configKey1: true,
        displayOrder: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    const methods = rawMethods
      .filter((m) => this.isPaymentMethodConfiguredForQr(m))
      .map(({ configId: _cid, configKey1: _ck1, ...safeMethod }) => safeMethod);

    return { success: true, methods };
  }

  /**
   * Khách chọn phương thức thanh toán -> Tạo yêu cầu thanh toán (TUYỆT ĐỐI KHÔNG TỰ SET PAID)
   */
  async requestPayment(rawToken: string, paymentMethodCode: string, note?: string, deviceSessionId?: string) {
    return this.createServiceRequest(rawToken, {
      deviceSessionId: deviceSessionId || 'unknown',
      requestType: 'PAYMENT',
      paymentMethodCode,
      note,
    });
  }

  /**
   * Lấy danh sách món có thể đổi điểm thưởng theo chi nhánh
   */
  async getRedeemableRewards(rawToken: string) {
    const session = await this.resolveSessionByToken(rawToken);

    if (!session.branch.allowRedeemItemPos) {
      return { success: true, allowed: false, message: 'Chi nhánh hiện không mở đổi điểm sang món', items: [] };
    }

    const items = await this.prisma.product.findMany({
      where: {
        available: true,
        isRedeemable: true,
        redemptionPoints: { gt: 0 },
        OR: [
          { redeemAllBranches: true },
          { redeemableBranches: { some: { id: session.branchId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        price: true,
        unit: true,
        redemptionPoints: true,
      },
      orderBy: { redemptionPoints: 'asc' },
    });

    return { success: true, allowed: true, items };
  }

  /**
   * Đổi điểm thưởng lấy món (Yêu cầu khách đã xác minh thành viên an toàn)
   */
  async redeemReward(rawToken: string, dto: RedeemRewardDto) {
    const session = await this.resolveSessionByToken(rawToken);

    const guest = await this.prisma.qrOrderGuest.findFirst({
      where: {
        qrOrderSessionId: session.id,
        deviceSessionId: dto.deviceSessionId,
      },
    });

    if (!guest || !guest.userId || !guest.memberVerified) {
      throw new ForbiddenException(
        'Vui lòng xác minh tài khoản thành viên (nhập mật khẩu hoặc OTP) trước khi sử dụng điểm thưởng.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: guest.userId } });
    if (!user) throw new NotFoundException('Tài khoản thành viên không tồn tại');

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { category: true },
    });
    if (!product || !product.isRedeemable || !product.redemptionPoints) {
      throw new BadRequestException('Món này không hỗ trợ đổi điểm');
    }

    const quantity = dto.quantity || 1;
    const requiredPoints = product.redemptionPoints * quantity;
    const currentPoints = user.points ?? user.currentPoints;

    if (currentPoints < requiredPoints) {
      throw new BadRequestException(
        `Bạn hiện có ${currentPoints.toLocaleString()} điểm, không đủ ${requiredPoints.toLocaleString()} điểm để đổi món này.`,
      );
    }

    // Trừ điểm và thêm món 0đ vào đơn hàng
    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Trừ điểm User
      await tx.user.update({
        where: { id: user.id },
        data: {
          points: { decrement: requiredPoints },
          currentPoints: { decrement: requiredPoints },
        },
      });

      // 2. Ghi lịch sử giao dịch điểm
      await tx.pointTransaction.create({
        data: {
          userId: user.id,
          orderId: session.order.id,
          balanceBefore: currentPoints,
          amount: -requiredPoints,
          balanceAfter: currentPoints - requiredPoints,
          source: PointTransactionSource.REWARD,
          description: `Đổi điểm lấy ${quantity}x ${product.name} qua QR`,
        },
      });

      // 3. Thêm OrderItem đổi điểm (Giá bán = 0đ, gắn đầy đủ cờ đổi điểm thưởng)
      await tx.orderItem.create({
        data: {
          orderId: session.order.id,
          productId: product.id,
          quantity,
          priceAtSale: 0,
          originalPriceAtSale: 0,
          discountAmount: 0,
          discountReason: `Đổi điểm thưởng (${requiredPoints} điểm)`,
          note: `[ĐỔI ĐIỂM THƯỞNG] KH đổi: ${user.fullName}${user.phone ? ` (${user.phone})` : ''}`,
          stationId: this.determineStationId(product.category?.slug, product.name),
          kitchenStatus: KitchenStatus.PENDING,
          pricingMode: OrderItemPricingMode.POINT_REDEMPTION,
          isPointRedemption: true,
          pointsUsed: requiredPoints,
          redemptionSource: 'QR_ORDER',
          redemptionCustomerId: user.id,
          redemptionCustomerName: user.fullName,
          redeemedAt: new Date(),
          redemptionStatus: 'ACTIVE',
          source: OrderItemSource.QR_ORDER,
          orderedById: user.id,
          orderedByName: `${user.fullName} (Đổi điểm)`,
        },
      });

      await tx.order.update({
        where: { id: session.order.id },
        data: {
          pointsUsed: { increment: requiredPoints },
          version: { increment: 1 },
        },
      });

      // 4. Tính lại đơn
      return tx.order.findUnique({
        where: { id: session.order.id },
        include: {
          table: true,
          orderItems: { include: { product: true, selectedOptions: true } },
        },
      });
    });

    this.posGateway.emitOrderUpdated(updated);

    const displayCode = updated?.orderCode || updated?.temporaryOrderCode || session.order.id;
    const tableName = updated?.table?.name || session.table?.name;
    if (this.orderAuditService) {
      this.orderAuditService
        .log({
          orderId: session.order.id,
          orderCode: displayCode,
          action: 'POINTS_REDEEMED',
          category: 'POINTS',
          actorId: user.id,
          actorName: user.fullName,
          branchId: session.branchId,
          oldValue: { customerPoints: currentPoints },
          newValue: {
            productId: product.id,
            productName: product.name,
            quantity,
            pointsUsed: requiredPoints,
            remainingPoints: currentPoints - requiredPoints,
          },
          metadata: { source: 'QR_ORDER' },
        })
        .catch(() => {});
    }

    const builtRedeem = buildOrderNotificationPayload({
      eventType: 'CUSTOMER_REDEEMED_ITEM',
      orderCode: displayCode,
      orderType: updated?.orderType || 'DINE_IN',
      tableName,
      customerName: user.fullName,
      pointsUsed: requiredPoints,
      quantity,
      itemName: product.name,
    });
    this.notificationEngine
      .publishEvent({
        eventType: 'CUSTOMER_REDEEMED_ITEM',
        category: 'ORDER',
        priority: mapPriorityToNumeric(builtRedeem.priority),
        icon: builtRedeem.icon,
        branchId: session.branchId,
        entityId: session.order.id,
        subId: `qr-redeem-${product.id}-${Date.now()}`,
        title: builtRedeem.title,
        message: builtRedeem.message,
        actor: { id: user.id, name: user.fullName },
        reference: {
          type: 'ORDER',
          id: session.order.id,
          url: `/admin/orders/${session.order.id}`,
        },
        metadata: {
          orderId: session.order.id,
          orderCode: displayCode,
          tableName,
          pointsUsed: requiredPoints,
          productId: product.id,
          productName: product.name,
        },
        requiredPermissions: ['pos.order.view', 'waiter.access', 'orders.view'],
        appScopes: ['POS', 'WAITER', 'ADMIN'],
        legacyType: 'ORDER',
      })
      .catch((err) => this.logger.error('Error publishing CUSTOMER_REDEEMED_ITEM:', err));

    return {
      success: true,
      message: `Đổi thành công ${quantity}x ${product.name}!`,
      remainingPoints: currentPoints - requiredPoints,
    };
  }

  private determineStationId(categorySlug?: string, productName?: string): string {
    const slug = (categorySlug || '').toLowerCase();
    const name = (productName || '').toLowerCase();
    if (slug.includes('drink') || slug.includes('beverage') || name.includes('trà') || name.includes('nước') || name.includes('cà phê')) {
      return 'station-bar';
    }
    if (slug.includes('sashimi') || slug.includes('sushi') || name.includes('sashimi') || name.includes('sushi')) {
      return 'station-sushi';
    }
    return 'station-kitchen';
  }

  /**
   * Lấy danh sách các lượt gọi món QR đang chờ nhân viên duyệt (tab QR Order tại POS)
   */
  async getPendingQrRounds(branchId: string) {
    if (!branchId) return [];
    const rounds = await this.prisma.qrOrderRound.findMany({
      where: {
        qrOrderSession: { branchId },
        status: 'PENDING_APPROVAL',
      },
      include: {
        qrOrderSession: {
          include: {
            table: true,
            order: {
              select: { id: true, orderCode: true, totalAmount: true, customerName: true },
            },
          },
        },
        guest: true,
        orderItems: {
          include: {
            product: { select: { id: true, name: true, price: true, imageUrl: true } },
            selectedOptions: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return rounds.map((r) => ({
      id: r.id,
      roundNumber: r.roundNumber,
      submittedAt: r.submittedAt,
      tableId: r.qrOrderSession?.tableId,
      tableCode: r.qrOrderSession?.table?.tableCode || r.qrOrderSession?.table?.name,
      tableName: r.qrOrderSession?.table?.name || 'Bàn',
      guestName: r.guest?.guestName || 'Khách tại bàn',
      orderId: r.orderId,
      orderCode: r.qrOrderSession?.order?.orderCode,
      totalAmount: r.orderItems.reduce((sum, it) => sum + it.priceAtSale * it.quantity, 0),
      items: r.orderItems.map((it) => ({
        id: it.id,
        name: it.product?.name || 'Món',
        quantity: it.quantity,
        price: it.priceAtSale,
        originalPrice: it.originalPriceAtSale,
        pricingMode: it.pricingMode,
        note: it.note,
        optionsText: it.optionsTextSnapshot,
      })),
    }));
  }

  /**
   * Xác nhận lượt gọi món QR (duyệt & gửi vào bếp)
   */
  async approveQrRound(roundId: string, actorId?: string, actorUser?: any) {
    const round = await this.prisma.qrOrderRound.findUnique({
      where: { id: roundId },
      include: {
        qrOrderSession: { include: { table: true } },
        orderItems: true,
      },
    });
    if (!round) throw new NotFoundException('Lượt gọi món không tồn tại');
    if (round.status === 'APPROVED') {
      return { success: true, message: 'Lượt gọi món đã được duyệt trước đó' };
    }

    let actorName = actorUser?.fullName || actorUser?.name || actorUser?.email || null;
    if (!actorName && actorId) {
      const actorRecord = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { fullName: true },
      });
      actorName = actorRecord?.fullName || null;
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái lượt gọi món
      await tx.qrOrderRound.update({
        where: { id: roundId },
        data: {
          status: 'APPROVED',
          approvedById: actorId || null,
          approvedByName: actorName || 'Nhân viên',
          approvedAt: new Date(),
        },
      });

      // 2. Đánh dấu các món đã gửi bếp
      await tx.orderItem.updateMany({
        where: { qrOrderRoundId: roundId },
        data: {
          sentToKitchenAt: new Date(),
          kitchenStatus: KitchenStatus.PENDING,
        },
      });

      // 3. Cập nhật order
      await tx.order.update({
        where: { id: round.orderId },
        data: {
          kitchenStatus: KitchenStatus.PENDING,
          version: { increment: 1 },
        },
      });
    });

    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: round.orderId },
      include: {
        table: true,
        orderItems: {
          include: {
            product: true,
            selectedOptions: true,
          },
        },
      },
    });

    const tableName = round.qrOrderSession?.table?.name || 'Bàn';

    // Phát sự kiện Realtime tới POS, Waiter, KDS và khách
    this.posGateway.emitOrderUpdated(updatedOrder, actorId, tableName);
    this.posGateway.emitEvent({
      eventType: 'QR_ROUND_STATUS_CHANGED',
      entityType: 'ORDER',
      entityId: round.orderId,
      branchId: round.qrOrderSession.branchId,
      payload: {
        roundId: round.id,
        roundNumber: round.roundNumber,
        status: 'APPROVED',
        tableName,
        message: `Nhân viên đã xác nhận lượt gọi món #${round.roundNumber} và gửi vào bếp!`,
      },
    });

    return {
      success: true,
      message: `Đã xác nhận lượt gọi món #${round.roundNumber} của ${tableName}`,
      order: updatedOrder,
    };
  }

  /**
   * Từ chối lượt gọi món QR
   */
  async rejectQrRound(roundId: string, reason?: string, actorId?: string, actorUser?: any) {
    const round = await this.prisma.qrOrderRound.findUnique({
      where: { id: roundId },
      include: {
        qrOrderSession: { include: { table: true } },
        orderItems: true,
      },
    });
    if (!round) throw new NotFoundException('Lượt gọi món không tồn tại');

    let actorName = actorUser?.fullName || actorUser?.name || actorUser?.email || null;
    if (!actorName && actorId) {
      const actorRecord = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { fullName: true },
      });
      actorName = actorRecord?.fullName || null;
    }
    const finalReason = reason?.trim() || 'Món tạm hết hoặc bàn cần điều chỉnh';

    await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật status round
      await tx.qrOrderRound.update({
        where: { id: roundId },
        data: {
          status: 'REJECTED',
          approvedById: actorId || null,
          approvedByName: actorName || 'Nhân viên',
          approvedAt: new Date(),
          rejectReason: finalReason,
        },
      });

      // 2. Xóa các món trong round bị từ chối
      await tx.orderItem.deleteMany({
        where: { qrOrderRoundId: roundId },
      });

      // 3. Tính toán lại tổng tiền đơn hàng
      const remainingItems = await tx.orderItem.findMany({
        where: { orderId: round.orderId },
        include: { product: true },
      });

      const pricing = await this.orderPricingService.calculatePricing({
        items: remainingItems.map((oi) => ({
          productId: oi.productId,
          priceAtSale: oi.priceAtSale,
          quantity: oi.quantity,
          taxPercentage: oi.product?.taxPercentage || 0,
          pricingMode: oi.pricingMode as any,
          buffetSessionId: oi.buffetSessionId,
        })),
        orderDiscountAmount: 0,
      });

      await tx.order.update({
        where: { id: round.orderId },
        data: {
          subTotal: pricing.subTotal,
          taxAmount: pricing.taxAmount,
          totalAmount: pricing.totalAmount,
          version: { increment: 1 },
        },
      });
    });

    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: round.orderId },
      include: {
        table: true,
        orderItems: { include: { product: true, selectedOptions: true } },
      },
    });

    const tableName = round.qrOrderSession?.table?.name || 'Bàn';

    // Realtime notification
    this.posGateway.emitOrderUpdated(updatedOrder, actorId, tableName);
    this.posGateway.emitEvent({
      eventType: 'QR_ROUND_STATUS_CHANGED',
      entityType: 'ORDER',
      entityId: round.orderId,
      branchId: round.qrOrderSession.branchId,
      payload: {
        roundId: round.id,
        roundNumber: round.roundNumber,
        status: 'REJECTED',
        reason: reason || 'Món tạm hết hoặc bàn cần điều chỉnh',
        tableName,
        message: `Lượt gọi món #${round.roundNumber} không được xác nhận: ${reason || 'Món tạm hết'}`,
      },
    });

    return {
      success: true,
      message: `Đã từ chối lượt gọi món #${round.roundNumber}`,
      order: updatedOrder,
    };
  }

  /**
   * Lấy cấu hình QR tự động gửi bếp của chi nhánh
   */
  async getBranchQrSettings(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, qrAutoSendToKitchen: true },
    });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');
    return {
      success: true,
      data: {
        qrAutoSendToKitchen: !!branch.qrAutoSendToKitchen,
      },
    };
  }

  /**
   * Cập nhật cấu hình QR tự động gửi bếp của chi nhánh
   */
  async updateBranchQrSettings(branchId: string, qrAutoSendToKitchen: boolean) {
    const branch = await this.prisma.branch.update({
      where: { id: branchId },
      data: { qrAutoSendToKitchen },
      select: { id: true, name: true, qrAutoSendToKitchen: true },
    });
    return {
      success: true,
      message: `Đã cập nhật cài đặt QR gọi món: ${qrAutoSendToKitchen ? 'Tự động gửi bếp' : 'Cần nhân viên duyệt'}`,
      data: {
        qrAutoSendToKitchen: !!branch.qrAutoSendToKitchen,
      },
    };
  }

  /**
   * Chuẩn hóa địa chỉ hành chính Việt Nam (ví dụ: TP. Hồ Chí Minh -> Thành phố Hồ Chí Minh, Việt Nam)
   */
  private normalizeVietnameseAddress(rawAddress?: string | null): string {
    if (!rawAddress || !rawAddress.trim()) return '';
    let addr = rawAddress.replace(/\s+/g, ' ').trim();
    addr = addr
      .replace(/\bTP\.?\s*Hồ Chí Minh\b/gi, 'Thành phố Hồ Chí Minh')
      .replace(/\bTP\.?\s*HCM\b/gi, 'Thành phố Hồ Chí Minh')
      .replace(/\bTPHCM\b/gi, 'Thành phố Hồ Chí Minh')
      .replace(/\bThành phố\s*HCM\b/gi, 'Thành phố Hồ Chí Minh')
      .replace(/\bTP\.?\s+/gi, 'Thành phố ')
      .replace(/\bTp\.?\s+/gi, 'Thành phố ')
      .replace(/\bQ\.?\s*(\d+)/gi, 'Quận $1')
      .replace(/\bP\.?\s*(\d+)/gi, 'Phường $1')
      .replace(/\bP\.\s+/gi, 'Phường ')
      .replace(/\bQ\.\s+/gi, 'Quận ')
      .replace(/\bH\.\s+/gi, 'Huyện ')
      .replace(/\bTX\.\s+/gi, 'Thị xã ')
      .replace(/\bTT\.\s+/gi, 'Thị trấn ')
      .replace(/,\s*HCM\b/gi, ', Thành phố Hồ Chí Minh')
      .replace(/\s+,/g, ',')
      .replace(/,+/g, ',')
      .replace(/,\s*$/, '')
      .trim();

    if (addr && !/việt nam$/i.test(addr) && !/vietnam$/i.test(addr)) {
      addr = `${addr}, Việt Nam`;
    }
    return addr;
  }

  /**
   * Tra cứu doanh nghiệp theo Mã số thuế qua hệ thống VietQR cho khách tại bàn
   */
  async lookupVatByTaxCode(rawToken: string, mst: string) {
    await this.resolveSessionByToken(rawToken);
    const cleanMst = (mst || '').trim().replace(/\s+/g, '');
    if (!cleanMst || cleanMst.length < 10) {
      throw new BadRequestException('Mã số thuế không hợp lệ (tối thiểu 10 ký tự)');
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`https://api.vietqr.io/v2/business/${encodeURIComponent(cleanMst)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return {
          success: true,
          found: false,
          message: 'Không tìm thấy dữ liệu trên hệ thống thuế. Quý khách vui lòng điền tay thông tin bên dưới.',
        };
      }

      const json = await res.json();
      if (json?.code !== '00' || !json?.data) {
        return {
          success: true,
          found: false,
          message: 'Không tìm thấy dữ liệu trên hệ thống thuế. Quý khách vui lòng điền tay thông tin bên dưới.',
        };
      }

      const companyName = String(json.data.name || '').trim();
      const normalizedAddress = this.normalizeVietnameseAddress(json.data.address || '');

      return {
        success: true,
        found: Boolean(companyName || normalizedAddress),
        data: {
          taxCode: String(json.data.id || cleanMst).trim(),
          companyName,
          address: normalizedAddress,
        },
      };
    } catch {
      return {
        success: true,
        found: false,
        message: 'Không thể kết nối hệ thống tra cứu thuế. Quý khách vui lòng điền tay thông tin bên dưới.',
      };
    }
  }

  /**
   * Khách hàng gửi yêu cầu xuất hóa đơn VAT từ QR tại bàn
   */
  async requestVatInvoice(rawToken: string, dto: RequestQrVatInvoiceDto) {
    const session = await this.resolveSessionByToken(rawToken);
    const cleanTaxCode = dto.taxCode.trim();
    const cleanCompanyName = dto.companyName.trim();
    const normalizedAddress = this.normalizeVietnameseAddress(dto.address);
    const cleanEmail = dto.email?.trim() || null;

    if (!cleanTaxCode || !cleanCompanyName || !normalizedAddress) {
      throw new BadRequestException('Vui lòng điền đầy đủ MST, Tên đơn vị và Địa chỉ');
    }

    const guest = dto.deviceSessionId
      ? await this.prisma.qrOrderGuest.findFirst({
          where: {
            qrOrderSessionId: session.id,
            deviceSessionId: dto.deviceSessionId,
          },
        })
      : null;

    const updatedOrder = await this.prisma.order.update({
      where: { id: session.order.id },
      data: {
        isInvoiceRequested: true,
        invoiceTaxCode: cleanTaxCode,
        invoiceCompanyName: cleanCompanyName,
        invoiceAddress: normalizedAddress,
        invoiceEmail: cleanEmail,
        version: { increment: 1 },
      },
      include: {
        table: true,
        orderItems: {
          include: {
            product: { select: { id: true, name: true, price: true, imageUrl: true } },
            selectedOptions: true,
          },
        },
      },
    });

    const vatNote = `[Yêu cầu xuất hóa đơn VAT] MST: ${cleanTaxCode} • ${cleanCompanyName} • Đ/c: ${normalizedAddress}${cleanEmail ? ` • Email: ${cleanEmail}` : ''}`;

    const serviceRequest = await this.prisma.tableServiceRequest.create({
      data: {
        orderId: session.order.id,
        tableId: session.tableId,
        tableSessionId: session.tableSessionId,
        branchId: session.branchId,
        qrOrderSessionId: session.id,
        qrGuestId: guest?.id || null,
        requestType: TableServiceRequestType.OTHER,
        status: TableServiceRequestStatus.OPEN,
        note: vatNote,
      },
    });

    const tableName = session.table.name || session.table.tableCode;
    const displayCode = updatedOrder.orderCode || (updatedOrder as any).temporaryOrderCode || updatedOrder.id;
    const actorLabel = guest?.guestName ? `Khách ${guest.guestName} (${tableName})` : `Khách bàn ${tableName}`;

    await this.notificationEngine.publishEvent({
      eventType: 'VAT_INVOICE_REQUESTED',
      category: 'ORDER',
      priority: 2,
      icon: 'receipt',
      branchId: session.branchId,
      entityId: session.order.id,
      subId: serviceRequest.id,
      title: `${tableName} yêu cầu xuất hóa đơn VAT`,
      message: `${cleanCompanyName} (MST: ${cleanTaxCode}) — Đơn #${displayCode}`,
      actor: { name: actorLabel },
      reference: {
        type: 'ORDER',
        id: session.order.id,
        url: `/admin/pos?tableId=${session.table.id}`,
      },
      metadata: {
        requestId: serviceRequest.id,
        orderId: session.order.id,
        tableId: session.table.id,
        tableName,
        taxCode: cleanTaxCode,
        companyName: cleanCompanyName,
        address: normalizedAddress,
        email: cleanEmail,
      },
      requiredPermissions: ['pos.payment.collect', 'pos.access', 'waiter.access'],
      appScopes: ['POS', 'WAITER', 'ADMIN'],
      legacyType: 'ORDER',
    });

    this.posGateway.emitOrderUpdated(updatedOrder, guest?.userId || undefined, tableName);
    this.posGateway.emitEvent({
      eventType: 'HELP_REQUESTED',
      entityType: 'TABLE',
      entityId: session.tableId,
      branchId: session.branchId,
      payload: {
        requestId: serviceRequest.id,
        orderId: session.order.id,
        tableId: session.tableId,
        tableName,
        guestName: guest?.guestName || 'Khách tại bàn',
        requestType: TableServiceRequestType.OTHER,
        note: vatNote,
      },
    });
    if (this.posGateway?.server) {
      this.posGateway.server.to(`branch:${session.branchId}`).emit('QR_ORDER_CREATED', {
        branchId: session.branchId,
        orderId: session.order.id,
        requestId: serviceRequest.id,
        requestType: TableServiceRequestType.OTHER,
        tableName,
      });
    }

    return {
      success: true,
      message: 'Đã ghi nhận thông tin xuất hóa đơn VAT cho bàn!',
      data: {
        isInvoiceRequested: true,
        invoiceTaxCode: cleanTaxCode,
        invoiceCompanyName: cleanCompanyName,
        invoiceAddress: normalizedAddress,
        invoiceEmail: cleanEmail,
      },
    };
  }
}
