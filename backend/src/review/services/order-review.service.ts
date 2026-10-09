import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  GoneException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { CreateOrderReviewDto } from '../dto/create-order-review.dto';
import { CreateOrderFollowUpDto } from '../dto/create-order-follow-up.dto';
import { OrderStatus, OrderReviewStatus, PointTransactionSource, Prisma } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class OrderReviewService {
  private readonly logger = new Logger(OrderReviewService.name);
  private readonly FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Lấy cấu hình điểm thưởng từ SystemSetting (hoặc fallback 999)
   */
  private async getOrderReviewRewardPoints(): Promise<number> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'ORDER_REVIEW_REWARD_POINTS' },
      });
      if (setting && setting.value) {
        const parsed = parseInt(setting.value, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch (err: any) {
      this.logger.warn(`Error reading ORDER_REVIEW_REWARD_POINTS setting: ${err?.message}`);
    }
    return 999;
  }

  /**
   * Lấy thời hạn đánh giá từ SystemSetting (mặc định 14 ngày)
   */
  private async getOrderReviewWindowDays(): Promise<number> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'ORDER_REVIEW_WINDOW_DAYS' },
      });
      if (setting && setting.value) {
        const parsed = parseInt(setting.value, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (err: any) {
      this.logger.warn(`Error reading ORDER_REVIEW_WINDOW_DAYS setting: ${err?.message}`);
    }
    return 14;
  }

  /**
   * Kiểm tra tính đủ điều kiện đánh giá đơn hàng (Review Eligibility API)
   */
  async checkEligibility(userId: string, orderIdOrCode: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: orderIdOrCode }, { orderCode: orderIdOrCode }, { temporaryOrderCode: orderIdOrCode }],
      },
      include: {
        review: true,
      },
    });

    if (!order) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng' },
      });
    }

    if (order.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: { code: 'ORDER_ACCESS_DENIED', message: 'Bạn không có quyền xem thông tin đơn hàng này' },
      });
    }

    const rewardPoints = await this.getOrderReviewRewardPoints();
    const windowDays = await this.getOrderReviewWindowDays();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    const alreadyReviewed = Boolean(order.review);
    const isCompleted = order.status === OrderStatus.COMPLETED;

    const completedAt = order.completedAt || order.deliveredAt || order.createdAt;
    const expiresAt = new Date(completedAt.getTime() + windowMs);
    const now = new Date();
    const expired = now.getTime() > expiresAt.getTime();

    const diffMs = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

    const canReview = isCompleted && !alreadyReviewed && !expired;
    const canFollowUp = isCompleted && alreadyReviewed && !expired;

    return {
      success: true,
      data: {
        orderId: order.id,
        orderCode: order.orderCode || order.temporaryOrderCode,
        status: order.status,
        canReview,
        canFollowUp,
        alreadyReviewed,
        expired,
        completedAt,
        expiresAt,
        daysRemaining,
        rewardPoints,
        windowDays,
      },
    };
  }

  /**
   * Khách hàng gửi Đánh giá Đơn hàng LẦN ĐẦU & DUY NHẤT (Chỉ 1 lần, bất biến, nhận thưởng)
   */
  async createOrderReview(userId: string, orderIdOrCode: string, dto: CreateOrderReviewDto) {
    // 1. Tìm Order
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: orderIdOrCode }, { orderCode: orderIdOrCode }, { temporaryOrderCode: orderIdOrCode }],
      },
      include: {
        review: true,
      },
    });

    if (!order) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng' },
      });
    }

    // 2. Kiểm tra quyền sở hữu
    if (order.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: { code: 'ORDER_ACCESS_DENIED', message: 'Bạn chỉ được đánh giá đơn hàng của chính mình' },
      });
    }

    // 3. Kiểm tra trạng thái đơn hàng: BẮT BUỘC COMPLETED
    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: {
          code: 'ORDER_NOT_COMPLETED',
          message: 'Chỉ có thể đánh giá đơn hàng đã hoàn thành (COMPLETED).',
          currentStatus: order.status,
        },
      });
    }

    // 4. Kiểm tra xem đơn đã có review chưa (Immutable - Mỗi Order chỉ có 1 review duy nhất)
    if (order.review) {
      throw new ConflictException({
        success: false,
        statusCode: 409,
        error: {
          code: 'ORDER_ALREADY_REVIEWED',
          message: 'Đơn hàng này đã được đánh giá. Đánh giá đơn hàng là bản ghi bất biến và không thể tạo lại hay chỉnh sửa.',
        },
      });
    }

    // 5. Kiểm tra thời hạn 14 ngày (tính từ completedAt)
    const windowDays = await this.getOrderReviewWindowDays();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const completedAt = order.completedAt || order.deliveredAt || order.createdAt;
    const expiresAt = new Date(completedAt.getTime() + windowMs);
    const now = new Date();

    if (now.getTime() > expiresAt.getTime()) {
      throw new GoneException({
        success: false,
        statusCode: 410,
        error: {
          code: 'REVIEW_WINDOW_EXPIRED',
          message: `Thời hạn đánh giá ${windowDays} ngày cho đơn hàng này đã kết thúc.`,
          completedAt,
          expiresAt,
        },
      });
    }

    // 6. Làm sạch nội dung đánh giá
    const cleanContent = sanitizeHtml(dto.content.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    });

    if (cleanContent.length < 2) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: { code: 'CONTENT_TOO_SHORT', message: 'Nội dung nhận xét tối thiểu 2 ký tự' },
      });
    }

    const rewardPoints = await this.getOrderReviewRewardPoints();
    const displayCode = order.orderCode || order.temporaryOrderCode || order.id;

    // 7. PRISMA TRANSACTION ATOMIC: Chống double reward, tạo review + thưởng điểm + point transaction
    const txResult = await this.prisma.$transaction(async (tx) => {
      // 7.1 Kiểm tra User và số dư điểm
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { membershipTier: true },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 7.2 Tạo bản ghi PointTransaction (Idempotent theo referenceCode ORDER_REVIEW:orderId)
      const balanceBefore = user.points;
      const balanceAfter = balanceBefore + rewardPoints;

      let pointTx: any = null;
      if (rewardPoints > 0) {
        // Tăng điểm cho User
        await tx.user.update({
          where: { id: userId },
          data: {
            points: { increment: rewardPoints },
            currentPoints: { increment: rewardPoints },
          },
        });

        pointTx = await tx.pointTransaction.create({
          data: {
            userId,
            membershipTierId: user.membershipTierId,
            membershipTierName: user.membershipTier?.name || null,
            balanceBefore,
            amount: rewardPoints,
            balanceAfter,
            source: PointTransactionSource.REWARD,
            orderId: order.id,
            orderCode: displayCode,
            referenceCode: `ORDER_REVIEW:${order.id}`,
            description: `Thưởng đánh giá trải nghiệm đơn hàng #${displayCode}`,
          },
        });
      }

      // 7.3 Tạo bản ghi OrderReview với ràng buộc @@unique([orderId])
      const createdReview = await tx.orderReview.create({
        data: {
          orderId: order.id,
          userId,
          overallRating: Math.floor(dto.overallRating),
          foodRating: dto.foodRating ? Math.floor(dto.foodRating) : null,
          serviceRating: dto.serviceRating ? Math.floor(dto.serviceRating) : null,
          deliveryRating: dto.deliveryRating ? Math.floor(dto.deliveryRating) : null,
          content: cleanContent,
          rewardPointsSnapshot: rewardPoints,
          rewardGranted: rewardPoints > 0,
          rewardGrantedAt: rewardPoints > 0 ? new Date() : null,
          pointTransactionId: pointTx?.id || null,
          reviewExpiresAt: expiresAt,
          status: OrderReviewStatus.ACTIVE,
        },
      });

      // 7.4 Gắn hình ảnh đính kèm (nếu có, tối đa 5 ảnh)
      if (dto.mediaIds && dto.mediaIds.length > 0) {
        await tx.reviewMedia.updateMany({
          where: { id: { in: dto.mediaIds } },
          data: { orderReviewId: createdReview.id },
        });
      }

      return {
        review: createdReview,
        pointsAwarded: rewardPoints,
      };
    });

    // 8. Sau transaction: Gửi Notification nhận thưởng (Idempotent theo eventId)
    if (rewardPoints > 0) {
      try {
        await this.notificationService.createNotification({
          userId,
          title: `Bạn đã nhận +${rewardPoints} điểm AVORA`,
          content: `Cảm ơn bạn đã chia sẻ trải nghiệm đơn hàng #${displayCode}. Chúc bạn luôn có những bữa ăn ngon miệng tại AVORA!`,
          type: 'REWARD',
          referenceId: displayCode,
          url: `/orders/${displayCode}`,
          eventId: `ORDER_REVIEW_REWARD:${order.id}:${userId}`,
          category: 'REWARD',
          priority: 2,
          metadata: {
            orderId: order.id,
            orderCode: displayCode,
            rewardPoints,
          },
        });
      } catch (notiErr: any) {
        this.logger.error(`Error sending reward notification: ${notiErr?.message}`);
      }
    }

    const fullReview = await this.getOrderReview(userId, order.id);

    return {
      success: true,
      data: fullReview,
      message: `Gửi đánh giá thành công! Bạn được cộng +${rewardPoints} điểm AVORA.`,
    };
  }

  /**
   * Gửi phản hồi bổ sung cho Đơn hàng (Append-Only Follow-Up)
   * Chỉ cho phép trong vòng 14 ngày tính từ completedAt, KHÔNG thưởng thêm điểm
   */
  async createFollowUp(userId: string, orderReviewId: string, dto: CreateOrderFollowUpDto) {
    const review = await this.prisma.orderReview.findUnique({
      where: { id: orderReviewId },
      include: {
        order: true,
        followUps: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!review) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'ORDER_REVIEW_NOT_FOUND', message: 'Không tìm thấy đánh giá đơn hàng' },
      });
    }

    if (review.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: { code: 'NOT_REVIEW_OWNER', message: 'Bạn không có quyền gửi phản hồi trên đánh giá của người khác' },
      });
    }

    // 1. Kiểm tra thời hạn 14 ngày
    const now = new Date();
    if (now.getTime() > review.reviewExpiresAt.getTime()) {
      throw new GoneException({
        success: false,
        statusCode: 410,
        error: {
          code: 'FOLLOW_UP_EXPIRED',
          message: 'Thời hạn gửi phản hồi bổ sung cho đơn hàng này đã kết thúc.',
          expiresAt: review.reviewExpiresAt,
        },
      });
    }

    // 2. Anti-spam: Kiểm tra khoảng cách giữa 2 lần gửi (tối thiểu 10 giây)
    const lastFollowUp = review.followUps[0];
    if (lastFollowUp) {
      const timeSinceLast = now.getTime() - lastFollowUp.createdAt.getTime();
      if (timeSinceLast < 10000) {
        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: {
            code: 'COOLDOWN_ACTIVE',
            message: 'Vui lòng đợi vài giây trước khi gửi thêm phản hồi tiếp theo.',
          },
        });
      }
    }

    // 3. Làm sạch nội dung
    const cleanContent = sanitizeHtml(dto.content.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    });

    if (cleanContent.length < 2) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: { code: 'CONTENT_TOO_SHORT', message: 'Nội dung phản hồi tối thiểu 2 ký tự' },
      });
    }

    const followUp = await this.prisma.$transaction(async (tx) => {
      const created = await tx.orderReviewFollowUp.create({
        data: {
          orderReviewId,
          userId,
          content: cleanContent,
        },
      });

      if (dto.mediaIds && dto.mediaIds.length > 0) {
        await tx.reviewMedia.updateMany({
          where: { id: { in: dto.mediaIds } },
          data: { followUpId: created.id },
        });
      }

      return tx.orderReviewFollowUp.findUnique({
        where: { id: created.id },
        include: { media: true },
      });
    });

    return {
      success: true,
      data: followUp,
      message: 'Gửi phản hồi bổ sung thành công!',
    };
  }

  /**
   * Lấy chi tiết đánh giá đơn hàng (Readonly, kèm timeline follow-ups và phản hồi của AVORA)
   */
  async getOrderReview(userId: string, orderIdOrCode: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: orderIdOrCode }, { orderCode: orderIdOrCode }, { temporaryOrderCode: orderIdOrCode }],
      },
    });

    if (!order) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng' },
      });
    }

    if (order.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: { code: 'ORDER_ACCESS_DENIED', message: 'Bạn không có quyền xem thông tin đánh giá này' },
      });
    }

    const review = await this.prisma.orderReview.findUnique({
      where: { orderId: order.id },
      include: {
        media: { orderBy: { displayOrder: 'asc' } },
        followUps: {
          orderBy: { createdAt: 'asc' },
          include: { media: true },
        },
        reply: {
          include: { admin: { select: { fullName: true } } },
        },
        pointTransaction: {
          select: {
            id: true,
            amount: true,
            createdAt: true,
            referenceCode: true,
          },
        },
      },
    });

    return review;
  }
}
