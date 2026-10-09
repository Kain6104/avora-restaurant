import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewMediaService } from './review-media.service';
import { CreateProductReviewDto } from '../dto/create-product-review.dto';
import { UpdateProductReviewDto } from '../dto/update-product-review.dto';
import { ProductReviewStatus, ReviewReactionType, OrderStatus, Prisma } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class ProductReviewService {
  private readonly logger = new Logger(ProductReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewMediaService: ReviewMediaService,
  ) {}

  /**
   * Tạo Đánh giá Món ăn mới
   */
  async createProductReview(userId: string, productId: string, dto: CreateProductReviewDto) {
    // 0. Validate rating 1-5 integer
    if (dto.rating === undefined || dto.rating === null || !Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: { code: 'INVALID_RATING', message: 'Số sao đánh giá phải là số nguyên từ 1 đến 5' },
      });
    }

    // 1. Kiểm tra User tồn tại và không bị khóa
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { membershipTier: true },
    });
    if (!user) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'USER_NOT_FOUND', message: 'Tài khoản người dùng không tồn tại' },
      });
    }
    if (user.isAccountLocked) {
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: { code: 'ACCOUNT_LOCKED', message: 'Tài khoản đã bị tạm khóa, không thể gửi đánh giá' },
      });
    }

    // 2. Kiểm tra Product tồn tại
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Món ăn không tồn tại' },
      });
    }

    // 3. Kiểm tra User đã có review nào cho món này chưa (Chống duplicate review)
    const existingReview = await this.prisma.productReview.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });
    if (existingReview && existingReview.status !== ProductReviewStatus.DELETED) {
      throw new ConflictException({
        success: false,
        statusCode: 409,
        error: {
          code: 'REVIEW_ALREADY_EXISTS',
          message: 'Bạn đã đánh giá món ăn này rồi. Vui lòng chỉnh sửa đánh giá hiện tại.',
          reviewId: existingReview.id,
        },
      });
    }

    // 4. Backend tự động xác minh Verified Purchase từ Order COMPLETED thực tế
    const verifiedOrderItem = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: OrderStatus.COMPLETED,
        },
      },
      include: { order: true },
      orderBy: { order: { completedAt: 'desc' } },
    });

    const isVerifiedPurchase = Boolean(verifiedOrderItem);
    const verifiedOrderId = verifiedOrderItem ? verifiedOrderItem.orderId : null;
    const verifiedOrderItemId = verifiedOrderItem ? verifiedOrderItem.id : null;
    const purchasedAt = verifiedOrderItem
      ? verifiedOrderItem.order.completedAt || verifiedOrderItem.order.deliveredAt || verifiedOrderItem.order.createdAt
      : null;

    // 5. Làm sạch nội dung chống script injection (Sanitization)
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

    // 6. Prisma Transaction: Tạo Review, liên kết Media và cập nhật Product avgRating & ratingCount
    const review = await this.prisma.$transaction(async (tx) => {
      let created: any;
      if (existingReview && existingReview.status === ProductReviewStatus.DELETED) {
        // Tái sử dụng record đã soft-delete nếu có
        created = await tx.productReview.update({
          where: { id: existingReview.id },
          data: {
            rating: Math.floor(dto.rating),
            content: cleanContent,
            isVerifiedPurchase,
            verifiedOrderId,
            verifiedOrderItemId,
            purchasedAt,
            status: ProductReviewStatus.ACTIVE,
            createdAt: new Date(),
          },
        });
      } else {
        created = await tx.productReview.create({
          data: {
            userId,
            productId,
            rating: Math.floor(dto.rating),
            content: cleanContent,
            isVerifiedPurchase,
            verifiedOrderId,
            verifiedOrderItemId,
            purchasedAt,
            status: ProductReviewStatus.ACTIVE,
          },
        });
      }

      // Gắn tệp media (nếu có)
      if (dto.mediaIds && dto.mediaIds.length > 0) {
        await tx.reviewMedia.updateMany({
          where: { id: { in: dto.mediaIds } },
          data: { productReviewId: created.id },
        });
      }

      // Tính lại Rating trung bình và số lượng review ACTIVE
      await this.recalculateProductRatingInTx(productId, tx);

      return tx.productReview.findUnique({
        where: { id: created.id },
        include: {
          media: true,
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              membershipTier: { select: { name: true, pointMultiplier: true } },
            },
          },
        },
      });
    });

    return {
      success: true,
      data: review,
      message: 'Đánh giá món ăn thành công!',
    };
  }

  /**
   * Chỉnh sửa Đánh giá Món ăn của chính mình
   */
  async updateProductReview(userId: string, reviewId: string, dto: UpdateProductReviewDto) {
    const existing = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!existing || existing.status === ProductReviewStatus.DELETED) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'REVIEW_NOT_FOUND', message: 'Không tìm thấy đánh giá' },
      });
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: { code: 'NOT_REVIEW_OWNER', message: 'Bạn không có quyền chỉnh sửa đánh giá của người khác' },
      });
    }

    const updateData: Prisma.ProductReviewUpdateInput = {};

    if (dto.rating !== undefined) {
      if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
        throw new BadRequestException({
          success: false,
          statusCode: 400,
          error: { code: 'INVALID_RATING', message: 'Số sao đánh giá phải là số nguyên từ 1 đến 5' },
        });
      }
      updateData.rating = dto.rating;
    }

    if (dto.content !== undefined) {
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
      updateData.content = cleanContent;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Cập nhật thông tin review
      const res = await tx.productReview.update({
        where: { id: reviewId },
        data: updateData,
      });

      // Cập nhật media đính kèm nếu client gửi lại
      if (dto.mediaIds !== undefined) {
        // Bỏ liên kết các media cũ không còn trong danh sách
        await tx.reviewMedia.updateMany({
          where: { productReviewId: reviewId, id: { notIn: dto.mediaIds } },
          data: { productReviewId: null },
        });
        // Gán các media mới
        if (dto.mediaIds.length > 0) {
          await tx.reviewMedia.updateMany({
            where: { id: { in: dto.mediaIds } },
            data: { productReviewId: reviewId },
          });
        }
      }

      // Tính lại Rating trung bình nếu rating thay đổi
      if (dto.rating !== undefined) {
        await this.recalculateProductRatingInTx(existing.productId, tx);
      }

      return tx.productReview.findUnique({
        where: { id: reviewId },
        include: {
          media: true,
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              membershipTier: { select: { name: true } },
            },
          },
        },
      });
    });

    return {
      success: true,
      data: updated,
      message: 'Cập nhật đánh giá thành công!',
    };
  }

  /**
   * Xóa Đánh giá Món ăn của chính mình (Soft delete)
   */
  async deleteProductReview(userId: string, reviewId: string) {
    const existing = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!existing || existing.status === ProductReviewStatus.DELETED) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'REVIEW_NOT_FOUND', message: 'Không tìm thấy đánh giá' },
      });
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException({
        success: false,
        statusCode: 403,
        error: { code: 'NOT_REVIEW_OWNER', message: 'Bạn không có quyền xóa đánh giá của người khác' },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productReview.update({
        where: { id: reviewId },
        data: { status: ProductReviewStatus.DELETED },
      });

      // Tính lại Rating sau khi xóa
      await this.recalculateProductRatingInTx(existing.productId, tx);
    });

    return {
      success: true,
      message: 'Đã xóa đánh giá thành công',
    };
  }

  /**
   * Like / Dislike Đánh giá Món ăn (Optimistic toggle & race-condition safe)
   */
  async reactToReview(userId: string, reviewId: string, type: ReviewReactionType) {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!review || review.status !== ProductReviewStatus.ACTIVE) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        error: { code: 'REVIEW_NOT_FOUND', message: 'Đánh giá không tồn tại hoặc đã bị ẩn' },
      });
    }

    // Chặn người dùng tự like/dislike đánh giá của chính mình
    if (review.userId === userId) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        error: { code: 'SELF_REACTION_FORBIDDEN', message: 'Bạn không thể tương tác đánh giá của chính mình.' },
      });
    }

    const existingReaction = await this.prisma.reviewReaction.findUnique({
      where: {
        reviewId_userId: { reviewId, userId },
      },
    });

    let currentAction: 'ADDED' | 'REMOVED' | 'SWITCHED';
    let userReaction: ReviewReactionType | null = null;

    if (!existingReaction) {
      // Chưa reaction -> Thêm mới
      await this.prisma.reviewReaction.create({
        data: { reviewId, userId, type },
      });
      currentAction = 'ADDED';
      userReaction = type;
    } else if (existingReaction.type === type) {
      // Reaction trùng loại -> Bỏ reaction
      await this.prisma.reviewReaction.delete({
        where: { id: existingReaction.id },
      });
      currentAction = 'REMOVED';
      userReaction = null;
    } else {
      // Khác loại (LIKE -> DISLIKE hoặc ngược lại) -> Đổi loại
      await this.prisma.reviewReaction.update({
        where: { id: existingReaction.id },
        data: { type },
      });
      currentAction = 'SWITCHED';
      userReaction = type;
    }

    // Đếm số lượng like và dislike mới nhất
    const [likeCount, dislikeCount] = await Promise.all([
      this.prisma.reviewReaction.count({
        where: { reviewId, type: ReviewReactionType.LIKE },
      }),
      this.prisma.reviewReaction.count({
        where: { reviewId, type: ReviewReactionType.DISLIKE },
      }),
    ]);

    return {
      success: true,
      data: {
        reviewId,
        userReaction,
        action: currentAction,
        likeCount,
        dislikeCount,
      },
    };
  }

  /**
   * Lấy danh sách đánh giá của món ăn (Phân trang, lọc, sắp xếp)
   */
  async getProductReviews(
    productId: string,
    query: {
      page?: number;
      limit?: number;
      rating?: number;
      verifiedOnly?: boolean;
      hasMedia?: boolean;
      sort?: 'newest' | 'helpful' | 'highest' | 'lowest';
    },
    currentUserId?: string,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductReviewWhereInput = {
      productId,
      status: ProductReviewStatus.ACTIVE,
    };

    if (query.rating && query.rating >= 1 && query.rating <= 5) {
      where.rating = Number(query.rating);
    }

    if (query.verifiedOnly === true || String(query.verifiedOnly) === 'true') {
      where.isVerifiedPurchase = true;
    }

    if (query.hasMedia === true || String(query.hasMedia) === 'true') {
      where.media = { some: {} };
    }

    let orderBy: Prisma.ProductReviewOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sort === 'highest') {
      orderBy = { rating: 'desc' };
    } else if (query.sort === 'lowest') {
      orderBy = { rating: 'asc' };
    } else if (query.sort === 'helpful') {
      orderBy = { reactions: { _count: 'desc' } };
    }

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          media: {
            orderBy: { displayOrder: 'asc' },
          },
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              membershipTier: { select: { name: true } },
            },
          },
          reply: {
            include: {
              admin: { select: { fullName: true } },
            },
          },
          reactions: {
            select: { type: true, userId: true },
          },
        },
      }),
      this.prisma.productReview.count({ where }),
    ]);

    // Chuẩn hóa dữ liệu trả về kèm số like, dislike và trạng thái của user hiện tại
    const formattedReviews = reviews.map((r) => {
      const likeCount = r.reactions.filter((rx) => rx.type === ReviewReactionType.LIKE).length;
      const dislikeCount = r.reactions.filter((rx) => rx.type === ReviewReactionType.DISLIKE).length;
      const userReaction = currentUserId
        ? r.reactions.find((rx) => rx.userId === currentUserId)?.type || null
        : null;

      const isMyReview = Boolean(currentUserId && r.userId === currentUserId);

      // Bỏ mảng reactions thô để tối ưu payload
      const { reactions, ...rest } = r;

      return {
        ...rest,
        likeCount,
        dislikeCount,
        userReaction,
        isMyReview,
      };
    });

    return {
      success: true,
      data: formattedReviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy tóm tắt phân bố Rating của món ăn (Rating Summary & Distribution)
   */
  async getProductReviewSummary(productId: string) {
    const activeReviews = await this.prisma.productReview.findMany({
      where: { productId, status: ProductReviewStatus.ACTIVE },
      select: {
        rating: true,
        isVerifiedPurchase: true,
        media: { select: { id: true }, take: 1 },
      },
    });

    const ratingCount = activeReviews.length;
    let sum = 0;
    let fiveStarCount = 0;
    let fourStarCount = 0;
    let threeStarCount = 0;
    let twoStarCount = 0;
    let oneStarCount = 0;
    let verifiedReviewCount = 0;
    let mediaReviewCount = 0;

    for (const r of activeReviews) {
      sum += r.rating;
      if (r.rating === 5) fiveStarCount++;
      else if (r.rating === 4) fourStarCount++;
      else if (r.rating === 3) threeStarCount++;
      else if (r.rating === 2) twoStarCount++;
      else if (r.rating === 1) oneStarCount++;

      if (r.isVerifiedPurchase) verifiedReviewCount++;
      if (r.media && r.media.length > 0) mediaReviewCount++;
    }

    const avgRating = ratingCount > 0 ? Number((sum / ratingCount).toFixed(1)) : 0;

    return {
      success: true,
      data: {
        productId,
        avgRating,
        ratingCount,
        fiveStarCount,
        fourStarCount,
        threeStarCount,
        twoStarCount,
        oneStarCount,
        verifiedReviewCount,
        mediaReviewCount,
      },
    };
  }

  /**
   * Tính toán và cập nhật lại Rating trung bình trong Transaction
   */
  private async recalculateProductRatingInTx(productId: string, tx: Prisma.TransactionClient): Promise<void> {
    const aggregate = await tx.productReview.aggregate({
      where: { productId, status: ProductReviewStatus.ACTIVE },
      _avg: { rating: true },
      _count: { id: true },
    });

    const count = aggregate._count.id || 0;
    const rawAvg = aggregate._avg.rating || 0;
    // Làm tròn 1 chữ số thập phân, ví dụ 4.866 -> 4.9
    const avgRating = count > 0 ? Number(rawAvg.toFixed(1)) : 0;

    await tx.product.update({
      where: { id: productId },
      data: {
        avgRating,
        ratingCount: count,
      },
    });
  }

  /**
   * Tính toán lại Rating của món ăn (Công khai độc lập)
   */
  async recalculateProductRating(productId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.recalculateProductRatingInTx(productId, tx);
    });
  }
}
