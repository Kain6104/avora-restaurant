import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PosGateway } from '../pos/pos.gateway';
import { OrderPricingService } from '../pricing/order-pricing.service';
import { BuffetService } from '../buffet/buffet.service';
import { NotificationEngineService } from '../notification/notification-engine.service';
import { JoinQrSessionDto } from './dto/join-qr-session.dto';
import { SubmitQrRoundDto } from './dto/submit-qr-round.dto';
import { CreateServiceRequestDto } from './dto/service-request.dto';
import { MemberLookupDto, MemberVerifyDto, RedeemRewardDto } from './dto/member-actions.dto';
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
   * Lấy Thực đơn hiển thị trên Web QR (Tách rõ Tab Buffet nếu có Buffet Session ACTIVE)
   */
  async getMenu(rawToken: string) {
    const session = await this.resolveSessionByToken(rawToken);
    const activeBuffetSession = session.order.buffetSessions?.[0] || null;

    // Lấy toàn bộ danh mục và sản phẩm của chi nhánh
    const categories = await this.prisma.category.findMany({
      where: {
        branches: { some: { id: session.branchId } },
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
        };
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

        buffetItems = validItems.map((it) => ({
          ...it.product,
          baseBuffetPrice: 0,
          allowRetailPurchase: it.allowRetailPurchase,
          maxQuantityPerRound: it.maxQuantityPerRound,
        }));
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
                optionGroups: p.optionGroups,
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

    // 6. Ghi Database trong Prisma Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Đếm số round hiện tại
      const roundCount = await tx.qrOrderRound.count({
        where: { qrOrderSessionId: session.id },
      });

      const round = await tx.qrOrderRound.create({
        data: {
          qrOrderSessionId: session.id,
          qrGuestId: guest?.id || null,
          orderId: session.order.id,
          roundNumber: roundCount + 1,
          idempotencyKey: dto.idempotencyKey,
          status: initialRoundStatus,
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
        message: 'Yêu cầu của Quý khách đã được gửi tới nhân viên. Nhân viên đang đến bàn ngay!',
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

    // Bắn socket event và notification audio tới POS / Waiter
    await this.notificationEngine.publishEvent({
      eventType: isPayment ? 'PAYMENT_REQUESTED' : 'CUSTOMER_HELP_REQUESTED',
      category: isPayment ? 'PAYMENT' : 'SERVICE',
      priority: 2, // HIGH
      branchId: session.branchId,
      entityId: session.table.id,
      subId: serviceRequest.id,
      title: isPayment ? 'Yêu cầu thanh toán tại bàn' : 'Khách gọi nhân viên',
      message: isPayment
        ? `${guestTitle} tại ${tableName} yêu cầu thanh toán${dto.paymentMethodCode ? ` bằng [${dto.paymentMethodCode}]` : ''}.`
        : `${guestTitle} tại ${tableName} đang cần hỗ trợ${dto.note ? `: "${dto.note}"` : '.'}`,
      actor: { name: `${guestTitle} (${tableName})` },
      reference: {
        type: 'TABLE',
        id: session.table.id,
        url: `/admin/pos?tableId=${session.table.id}`,
      },
      metadata: {
        requestId: serviceRequest.id,
        tableId: session.table.id,
        tableName,
        branchId: session.branchId,
        requestType: dto.requestType,
        paymentMethodCode: dto.paymentMethodCode,
        note: dto.note,
      },
      requiredPermissions: isPayment ? ['pos.payment.collect', 'pos.access'] : ['waiter.access', 'pos.access'],
      appScopes: isPayment ? ['POS', 'WAITER'] : ['WAITER', 'POS'],
      legacyType: isPayment ? 'ORDER' : 'SYSTEM',
    });

    this.posGateway.emitEvent({
      eventType: isPayment ? 'PAYMENT_REQUESTED' : 'CUSTOMER_HELP_REQUESTED',
      entityType: 'TABLE',
      entityId: session.tableId,
      branchId: session.branchId,
      payload: {
        requestId: serviceRequest.id,
        tableId: session.tableId,
        tableName,
        guestName: guest?.guestName || 'Khách',
        requestType: dto.requestType,
        paymentMethodCode: dto.paymentMethodCode,
        note: dto.note,
      },
    });

    return {
      success: true,
      message: isPayment
        ? 'Đã gửi yêu cầu thanh toán. Nhân viên sẽ đến bàn hỗ trợ Quý khách ngay!'
        : 'Đã gọi nhân viên. Nhân viên đang đến hỗ trợ Quý khách!',
      request: serviceRequest,
    };
  }

  /**
   * Lấy danh sách phương thức thanh toán THẬT từ database cho modal thanh toán
   */
  async getPaymentMethods(rawToken: string) {
    const session = await this.resolveSessionByToken(rawToken);

    const methods = await this.prisma.paymentMethod.findMany({
      where: {
        isActive: true,
        isActiveForPos: true,
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
        displayOrder: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

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

      // 3. Thêm OrderItem đổi điểm (Giá bán = 0đ, discountAmount = giá gốc)
      await tx.orderItem.create({
        data: {
          orderId: session.order.id,
          productId: product.id,
          quantity,
          priceAtSale: 0,
          originalPriceAtSale: product.price,
          discountAmount: product.price,
          discountReason: `Đổi điểm thưởng (${requiredPoints} điểm)`,
          stationId: this.determineStationId(product.category?.slug, product.name),
          kitchenStatus: KitchenStatus.PENDING,
          pricingMode: OrderItemPricingMode.REGULAR,
          source: OrderItemSource.QR_ORDER,
          orderedById: user.id,
          orderedByName: `${user.fullName} (Đổi điểm)`,
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
  async approveQrRound(roundId: string, actorId?: string) {
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

    await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái lượt gọi món
      await tx.qrOrderRound.update({
        where: { id: roundId },
        data: { status: 'APPROVED' },
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
  async rejectQrRound(roundId: string, reason?: string, actorId?: string) {
    const round = await this.prisma.qrOrderRound.findUnique({
      where: { id: roundId },
      include: {
        qrOrderSession: { include: { table: true } },
        orderItems: true,
      },
    });
    if (!round) throw new NotFoundException('Lượt gọi món không tồn tại');

    await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật status round
      await tx.qrOrderRound.update({
        where: { id: roundId },
        data: { status: 'REJECTED' },
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
}
