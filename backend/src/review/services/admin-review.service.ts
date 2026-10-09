import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { AuditLogsService } from '../../admin/audit-logs/audit-logs.service';
import { ProductReviewService } from './product-review.service';
import { AdminProductReviewQueryDto, AdminOrderReviewQueryDto } from '../dto/admin-review-query.dto';
import { AdminReviewReplyDto } from '../dto/admin-review-reply.dto';
import { UpdateReviewSettingsDto } from '../dto/update-review-settings.dto';
import { ProductReviewStatus, OrderReviewStatus, Prisma } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class AdminReviewService {
  private readonly logger = new Logger(AdminReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogsService: AuditLogsService,
    private readonly productReviewService: ProductReviewService,
  ) {}

  /**
   * Lấy danh sách Product Reviews cho Admin (Có phân quyền Manager theo chi nhánh)
   */
  async getProductReviews(query: AdminProductReviewQueryDto, branchIdScope?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductReviewWhereInput = {};

    // 1. Trạng thái
    if (query.status) {
      where.status = query.status;
    } else {
      where.status = { not: ProductReviewStatus.DELETED };
    }

    // 2. Số sao
    if (query.rating) {
      where.rating = Number(query.rating);
    }

    // 3. Món ăn cụ thể
    if (query.productId) {
      where.productId = query.productId;
    }

    // 4. Lọc theo chi nhánh (Phân quyền Manager Branch Scope)
    const effectiveBranchId = branchIdScope || (query.branchId && query.branchId !== 'ALL' ? query.branchId : undefined);
    if (effectiveBranchId) {
      where.product = {
        branches: {
          some: { id: effectiveBranchId },
        },
      };
    }

    // 5. Đã xác minh mua hàng
    if (query.isVerified !== undefined && query.isVerified !== '') {
      where.isVerifiedPurchase = query.isVerified === 'true';
    }

    // 6. Có hình ảnh/video
    if (query.hasMedia !== undefined && query.hasMedia !== '') {
      if (query.hasMedia === 'true') {
        where.media = { some: {} };
      } else {
        where.media = { none: {} };
      }
    }

    // 7. Tìm kiếm theo tên khách, nội dung, tên món
    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { content: { contains: q } },
        { user: { fullName: { contains: q } } },
        { user: { email: { contains: q } } },
        { user: { phone: { contains: q } } },
        { product: { name: { contains: q } } },
      ];
    }

    // 8. Khoảng ngày
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    let orderBy: Prisma.ProductReviewOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sortBy === 'oldest') orderBy = { createdAt: 'asc' };
    else if (query.sortBy === 'rating_desc') orderBy = { rating: 'desc' };
    else if (query.sortBy === 'rating_asc') orderBy = { rating: 'asc' };
    else if (query.sortBy === 'most_liked') orderBy = { reactions: { _count: 'desc' } };

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          product: { select: { id: true, name: true, slug: true, imageUrl: true, price: true } },
          user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, membershipTier: { select: { name: true } } } },
          media: { orderBy: { displayOrder: 'asc' } },
          reply: { include: { admin: { select: { id: true, fullName: true, email: true } } } },
          verifiedOrder: { select: { id: true, orderCode: true, completedAt: true, branch: { select: { name: true } } } },
          _count: { select: { reactions: true } },
        },
      }),
      this.prisma.productReview.count({ where }),
    ]);

    return {
      success: true,
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy danh sách Order Reviews cho Admin (Có phân quyền Manager theo chi nhánh)
   */
  async getOrderReviews(query: AdminOrderReviewQueryDto, branchIdScope?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.OrderReviewWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.rating) {
      where.overallRating = Number(query.rating);
    }

    // Phân quyền chi nhánh
    const effectiveBranchId = branchIdScope || (query.branchId && query.branchId !== 'ALL' ? query.branchId : undefined);
    if (effectiveBranchId) {
      where.order = { branchId: effectiveBranchId };
    }

    if (query.hasMedia !== undefined && query.hasMedia !== '') {
      if (query.hasMedia === 'true') where.media = { some: {} };
      else where.media = { none: {} };
    }

    if (query.hasFollowUps !== undefined && query.hasFollowUps !== '') {
      if (query.hasFollowUps === 'true') where.followUps = { some: {} };
      else where.followUps = { none: {} };
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { content: { contains: q } },
        { user: { fullName: { contains: q } } },
        { user: { email: { contains: q } } },
        { user: { phone: { contains: q } } },
        { order: { orderCode: { contains: q } } },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    let orderBy: Prisma.OrderReviewOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sortBy === 'oldest') orderBy = { createdAt: 'asc' };
    else if (query.sortBy === 'rating_desc') orderBy = { overallRating: 'desc' };
    else if (query.sortBy === 'rating_asc') orderBy = { overallRating: 'asc' };

    const [reviews, total] = await Promise.all([
      this.prisma.orderReview.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          order: {
            select: {
              id: true,
              orderCode: true,
              completedAt: true,
              totalAmount: true,
              branch: { select: { id: true, name: true } },
            },
          },
          user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true } },
          media: { orderBy: { displayOrder: 'asc' } },
          followUps: {
            orderBy: { createdAt: 'asc' },
            include: { media: true },
          },
          reply: { include: { admin: { select: { id: true, fullName: true, email: true } } } },
          pointTransaction: { select: { id: true, amount: true, referenceCode: true } },
        },
      }),
      this.prisma.orderReview.count({ where }),
    ]);

    return {
      success: true,
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Thống kê tổng quan Đánh giá & Phản hồi cho Admin
   */
  async getReviewStats(branchIdScope?: string) {
    const productWhere: Prisma.ProductReviewWhereInput = {
      status: ProductReviewStatus.ACTIVE,
    };
    const orderWhere: Prisma.OrderReviewWhereInput = {
      status: OrderReviewStatus.ACTIVE,
    };

    if (branchIdScope) {
      productWhere.product = { branches: { some: { id: branchIdScope } } };
      orderWhere.order = { branchId: branchIdScope };
    }

    const [
      totalProductReviews,
      productAggregate,
      verifiedCount,
      mediaCount,
      totalOrderReviews,
      orderAggregate,
      rewardPointsAggregate,
      hiddenProductCount,
      hiddenOrderCount,
    ] = await Promise.all([
      this.prisma.productReview.count({ where: productWhere }),
      this.prisma.productReview.aggregate({
        where: productWhere,
        _avg: { rating: true },
      }),
      this.prisma.productReview.count({
        where: { ...productWhere, isVerifiedPurchase: true },
      }),
      this.prisma.productReview.count({
        where: { ...productWhere, media: { some: {} } },
      }),
      this.prisma.orderReview.count({ where: orderWhere }),
      this.prisma.orderReview.aggregate({
        where: orderWhere,
        _avg: { overallRating: true },
      }),
      this.prisma.orderReview.aggregate({
        where: orderWhere,
        _sum: { rewardPointsSnapshot: true },
      }),
      this.prisma.productReview.count({
        where: {
          status: ProductReviewStatus.HIDDEN,
          ...(branchIdScope ? { product: { branches: { some: { id: branchIdScope } } } } : {}),
        },
      }),
      this.prisma.orderReview.count({
        where: {
          status: OrderReviewStatus.HIDDEN,
          ...(branchIdScope ? { order: { branchId: branchIdScope } } : {}),
        },
      }),
    ]);

    const avgProductRating = totalProductReviews > 0 ? Number((productAggregate._avg.rating || 0).toFixed(1)) : 0;
    const avgOrderRating = totalOrderReviews > 0 ? Number((orderAggregate._avg.overallRating || 0).toFixed(1)) : 0;
    const verifiedPercentage = totalProductReviews > 0 ? Math.round((verifiedCount / totalProductReviews) * 100) : 0;
    const totalRewardPoints = rewardPointsAggregate._sum.rewardPointsSnapshot || 0;
    const totalHiddenReviews = hiddenProductCount + hiddenOrderCount;

    return {
      success: true,
      data: {
        productReviews: {
          total: totalProductReviews,
          avgRating: avgProductRating,
          verifiedCount,
          verifiedPercentage,
          mediaCount,
        },
        orderReviews: {
          total: totalOrderReviews,
          avgRating: avgOrderRating,
          totalRewardPoints,
        },
        hiddenReviews: {
          total: totalHiddenReviews,
          productCount: hiddenProductCount,
          orderCount: hiddenOrderCount,
        },
      },
    };
  }

  /**
   * Admin tạo / sửa phản hồi cho Product Review
   */
  async upsertProductReviewReply(adminId: string, reviewId: string, dto: AdminReviewReplyDto) {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
      include: {
        product: { include: { category: true } },
        reply: true,
      },
    });

    if (!review) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'REVIEW_NOT_FOUND', message: 'Không tìm thấy đánh giá món ăn' },
      });
    }

    const cleanContent = sanitizeHtml(dto.content.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    });

    const isUpdate = Boolean(review.reply);
    let reply: any;

    if (isUpdate && review.reply) {
      reply = await this.prisma.reviewReply.update({
        where: { id: review.reply.id },
        data: {
          content: cleanContent,
          adminId,
        },
      });

      await this.auditLogsService.logAction({
        userId: adminId,
        action: 'UPDATE_PRODUCT_REVIEW_REPLY',
        target: `ProductReview:${reviewId}`,
        oldValue: review.reply.content,
        newValue: cleanContent,
      });
    } else {
      reply = await this.prisma.reviewReply.create({
        data: {
          productReviewId: reviewId,
          adminId,
          content: cleanContent,
        },
      });

      await this.auditLogsService.logAction({
        userId: adminId,
        action: 'CREATE_PRODUCT_REVIEW_REPLY',
        target: `ProductReview:${reviewId}`,
        newValue: cleanContent,
      });

      // Chỉ gửi Notification khi Admin tạo phản hồi mới (tránh spam khi sửa typo)
      try {
        const prodName = review.product.name;
        const catSlug = review.product.category?.slug || 'menu';
        const prodSlug = review.product.slug;

        await this.notificationService.createNotification({
          userId: review.userId,
          title: 'AVORA đã phản hồi đánh giá của bạn',
          content: `AVORA vừa phản hồi đánh giá của bạn về món "${prodName}".`,
          type: 'SYSTEM',
          referenceId: reviewId,
          url: `/${catSlug}/${prodSlug}`,
          eventId: `PRODUCT_REVIEW_REPLY:${reviewId}`,
          category: 'REVIEW',
          priority: 1,
          metadata: {
            reviewId,
            productId: review.productId,
            replyId: reply.id,
          },
        });
      } catch (err: any) {
        this.logger.error(`Error sending reply notification: ${err?.message}`);
      }
    }

    return {
      success: true,
      data: reply,
      message: isUpdate ? 'Cập nhật phản hồi thành công' : 'Đã gửi phản hồi tới khách hàng',
    };
  }

  /**
   * Admin xóa phản hồi trên Product Review
   */
  async deleteProductReviewReply(adminId: string, reviewId: string) {
    const reply = await this.prisma.reviewReply.findUnique({
      where: { productReviewId: reviewId },
    });

    if (!reply) {
      throw new NotFoundException('Không tìm thấy phản hồi');
    }

    await this.prisma.reviewReply.delete({
      where: { id: reply.id },
    });

    await this.auditLogsService.logAction({
      userId: adminId,
      action: 'DELETE_PRODUCT_REVIEW_REPLY',
      target: `ProductReview:${reviewId}`,
      oldValue: reply.content,
    });

    return {
      success: true,
      message: 'Đã xóa phản hồi',
    };
  }

  /**
   * Admin tạo / sửa phản hồi cho Order Review
   */
  async upsertOrderReviewReply(adminId: string, orderReviewId: string, dto: AdminReviewReplyDto) {
    const review = await this.prisma.orderReview.findUnique({
      where: { id: orderReviewId },
      include: {
        order: true,
        reply: true,
      },
    });

    if (!review) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'ORDER_REVIEW_NOT_FOUND', message: 'Không tìm thấy đánh giá đơn hàng' },
      });
    }

    const cleanContent = sanitizeHtml(dto.content.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    });

    const isUpdate = Boolean(review.reply);
    let reply: any;

    if (isUpdate && review.reply) {
      reply = await this.prisma.reviewReply.update({
        where: { id: review.reply.id },
        data: {
          content: cleanContent,
          adminId,
        },
      });

      await this.auditLogsService.logAction({
        userId: adminId,
        action: 'UPDATE_ORDER_REVIEW_REPLY',
        target: `OrderReview:${orderReviewId}`,
        oldValue: review.reply.content,
        newValue: cleanContent,
      });
    } else {
      reply = await this.prisma.reviewReply.create({
        data: {
          orderReviewId,
          adminId,
          content: cleanContent,
        },
      });

      await this.auditLogsService.logAction({
        userId: adminId,
        action: 'CREATE_ORDER_REVIEW_REPLY',
        target: `OrderReview:${orderReviewId}`,
        newValue: cleanContent,
      });

      try {
        const displayCode = review.order.orderCode || review.order.temporaryOrderCode || review.order.id;
        await this.notificationService.createNotification({
          userId: review.userId,
          title: 'AVORA đã phản hồi đánh giá trải nghiệm của bạn',
          content: `AVORA vừa phản hồi đánh giá trải nghiệm của bạn về đơn hàng #${displayCode}.`,
          type: 'ORDER',
          referenceId: displayCode,
          url: `/orders/${displayCode}`,
          eventId: `ORDER_REVIEW_REPLY:${orderReviewId}`,
          category: 'REVIEW',
          priority: 1,
          metadata: {
            orderReviewId,
            orderId: review.orderId,
            replyId: reply.id,
          },
        });
      } catch (err: any) {
        this.logger.error(`Error sending reply notification: ${err?.message}`);
      }
    }

    return {
      success: true,
      data: reply,
      message: isUpdate ? 'Cập nhật phản hồi thành công' : 'Đã gửi phản hồi tới khách hàng',
    };
  }

  /**
   * Admin xóa phản hồi trên Order Review
   */
  async deleteOrderReviewReply(adminId: string, orderReviewId: string) {
    const reply = await this.prisma.reviewReply.findUnique({
      where: { orderReviewId },
    });

    if (!reply) {
      throw new NotFoundException('Không tìm thấy phản hồi');
    }

    await this.prisma.reviewReply.delete({
      where: { id: reply.id },
    });

    await this.auditLogsService.logAction({
      userId: adminId,
      action: 'DELETE_ORDER_REVIEW_REPLY',
      target: `OrderReview:${orderReviewId}`,
      oldValue: reply.content,
    });

    return {
      success: true,
      message: 'Đã xóa phản hồi',
    };
  }

  /**
   * Admin kiểm duyệt Product Review (Ẩn / Khôi phục)
   */
  async moderateProductReview(adminId: string, reviewId: string, status: ProductReviewStatus) {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productReview.update({
        where: { id: reviewId },
        data: { status },
      });

      // Tự động tính toán lại avgRating của món ăn
      const aggregate = await tx.productReview.aggregate({
        where: { productId: review.productId, status: ProductReviewStatus.ACTIVE },
        _avg: { rating: true },
        _count: { id: true },
      });
      const count = aggregate._count.id || 0;
      const rawAvg = aggregate._avg.rating || 0;
      const avgRating = count > 0 ? Number(rawAvg.toFixed(1)) : 0;

      await tx.product.update({
        where: { id: review.productId },
        data: { avgRating, ratingCount: count },
      });
    });

    await this.auditLogsService.logAction({
      userId: adminId,
      action: status === ProductReviewStatus.HIDDEN ? 'HIDE_PRODUCT_REVIEW' : 'RESTORE_PRODUCT_REVIEW',
      target: `ProductReview:${reviewId}`,
      oldValue: review.status,
      newValue: status,
    });

    return {
      success: true,
      message: status === ProductReviewStatus.HIDDEN ? 'Đã ẩn đánh giá' : 'Đã khôi phục đánh giá',
    };
  }

  /**
   * Admin kiểm duyệt Order Review (Ẩn / Khôi phục)
   */
  async moderateOrderReview(adminId: string, orderReviewId: string, status: OrderReviewStatus) {
    const review = await this.prisma.orderReview.findUnique({
      where: { id: orderReviewId },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    await this.prisma.orderReview.update({
      where: { id: orderReviewId },
      data: { status },
    });

    await this.auditLogsService.logAction({
      userId: adminId,
      action: status === OrderReviewStatus.HIDDEN ? 'HIDE_ORDER_REVIEW' : 'RESTORE_ORDER_REVIEW',
      target: `OrderReview:${orderReviewId}`,
      oldValue: review.status,
      newValue: status,
    });

    return {
      success: true,
      message: status === OrderReviewStatus.HIDDEN ? 'Đã ẩn đánh giá đơn hàng' : 'Đã khôi phục đánh giá đơn hàng',
    };
  }

  /**
   * Lấy cấu hình hệ thống Đánh giá & Trải nghiệm
   */
  async getReviewSettings() {
    const keys = [
      'ORDER_REVIEW_REWARD_POINTS',
      'ORDER_REVIEW_WINDOW_DAYS',
      'REVIEW_REWARD_ENABLED',
      'ORDER_REVIEW_REQUEST_ENABLED',
      'PRODUCT_REVIEW_MEDIA_ENABLED',
    ];

    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    return {
      success: true,
      data: {
        orderReviewRewardPoints: parseInt(settingsMap.get('ORDER_REVIEW_REWARD_POINTS') || '999', 10),
        orderReviewWindowDays: parseInt(settingsMap.get('ORDER_REVIEW_WINDOW_DAYS') || '14', 10),
        reviewRewardEnabled: settingsMap.get('REVIEW_REWARD_ENABLED') !== 'false',
        orderReviewRequestEnabled: settingsMap.get('ORDER_REVIEW_REQUEST_ENABLED') !== 'false',
        productReviewMediaEnabled: settingsMap.get('PRODUCT_REVIEW_MEDIA_ENABLED') !== 'false',
      },
    };
  }

  /**
   * Cập nhật cấu hình Đánh giá & Trải nghiệm (Ghi AuditLog đầy đủ)
   */
  async updateReviewSettings(adminId: string, dto: UpdateReviewSettingsDto) {
    const updates: { key: string; value: string; label: string }[] = [];

    if (dto.orderReviewRewardPoints !== undefined) {
      updates.push({
        key: 'ORDER_REVIEW_REWARD_POINTS',
        value: String(dto.orderReviewRewardPoints),
        label: 'Điểm thưởng đánh giá đơn hàng',
      });
    }

    if (dto.orderReviewWindowDays !== undefined) {
      updates.push({
        key: 'ORDER_REVIEW_WINDOW_DAYS',
        value: String(dto.orderReviewWindowDays),
        label: 'Thời hạn đánh giá (ngày)',
      });
    }

    if (dto.reviewRewardEnabled !== undefined) {
      updates.push({
        key: 'REVIEW_REWARD_ENABLED',
        value: String(dto.reviewRewardEnabled),
        label: 'Kích hoạt tặng điểm đánh giá',
      });
    }

    if (dto.orderReviewRequestEnabled !== undefined) {
      updates.push({
        key: 'ORDER_REVIEW_REQUEST_ENABLED',
        value: String(dto.orderReviewRequestEnabled),
        label: 'Kích hoạt gửi thông báo xin đánh giá',
      });
    }

    if (dto.productReviewMediaEnabled !== undefined) {
      updates.push({
        key: 'PRODUCT_REVIEW_MEDIA_ENABLED',
        value: String(dto.productReviewMediaEnabled),
        label: 'Kích hoạt tải hình ảnh/video đánh giá',
      });
    }

    for (const item of updates) {
      const existing = await this.prisma.systemSetting.findUnique({
        where: { key: item.key },
      });

      await this.prisma.systemSetting.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          value: item.value,
        },
        update: {
          value: item.value,
        },
      });

      await this.auditLogsService.logAction({
        userId: adminId,
        action: item.key === 'ORDER_REVIEW_REWARD_POINTS' ? 'UPDATE_REVIEW_REWARD_SETTING' : 'UPDATE_REVIEW_WINDOW_SETTING',
        target: `SystemSetting:${item.key}`,
        oldValue: existing?.value || 'null',
        newValue: item.value,
      });
    }

    return this.getReviewSettings();
  }
}

