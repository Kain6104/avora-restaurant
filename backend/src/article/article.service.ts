import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleAccessPolicyService, UserContext } from './article-access-policy.service';
import {
  ArticleStatus,
  ArticleType,
  ArticleInteractionType,
  ReactionType,
  CommentStatus,
  RoleType,
} from '@prisma/client';
import { QueryArticleDto } from './dto/query-article.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationEngineService } from '../notification/notification-engine.service';
import { checkProfanity } from '../common/utils/profanity.util';

// In-memory LRU-style cache to throttle duplicate view count spam within 10 minutes per IP/User
const viewThrottleMap = new Map<string, number>();

@Injectable()
export class ArticleService {
  constructor(
    private prisma: PrismaService,
    private accessPolicy: ArticleAccessPolicyService,
    private notificationService: NotificationService,
    private notificationEngine: NotificationEngineService,
  ) {}

  /**
   * Tính toán trạng thái chương trình khuyến mãi chuẩn xác từ Server Time
   */
  public computePromotionStatus(
    startAt?: Date | string | null,
    endAt?: Date | string | null
  ): 'UPCOMING' | 'ONGOING' | 'ENDED' | null {
    if (!startAt || !endAt) return null;
    const now = new Date();
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (now < start) return 'UPCOMING';
    if (now >= start && now <= end) return 'ONGOING';
    return 'ENDED';
  }

  /**
   * Lấy danh sách bài viết công khai theo quyền truy cập của User & Chi nhánh
   */
  async getFeed(query: QueryArticleDto, userContext?: UserContext | null, branchId?: string) {
    const { page = 1, limit = 10, search, type, isFeatured, promotionStatus, sort } = query;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.min(50, Math.max(1, limit));

    const where = this.accessPolicy.buildPublicFeedWhere(userContext, branchId);

    if (type) {
      where.articleType = type;
    }
    if (isFeatured !== undefined) {
      where.isFeatured = Boolean(isFeatured);
    }
    if (search && search.trim()) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { title: { contains: search.trim() } },
          { excerpt: { contains: search.trim() } },
          { seoTitle: { contains: search.trim() } },
        ],
      });
    }

    // Lọc theo trạng thái khuyến mãi (server-time computed)
    const now = new Date();
    if (promotionStatus === 'UPCOMING') {
      where.promotionStartAt = { gt: now };
    } else if (promotionStatus === 'ONGOING') {
      where.promotionStartAt = { lte: now };
      where.promotionEndAt = { gte: now };
    } else if (promotionStatus === 'ENDED') {
      where.promotionEndAt = { lt: now };
    }

    let orderBy: any = [{ isFeatured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }];
    if (sort === 'views') {
      orderBy = [{ viewCount: 'desc' }, { publishedAt: 'desc' }];
    } else if (sort === 'oldest') {
      orderBy = [{ publishedAt: 'asc' }, { createdAt: 'asc' }];
    } else if (sort === 'newest') {
      orderBy = [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
    }

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          author: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
          branches: { select: { id: true, name: true, branchCode: true } },
          membershipTiers: { select: { id: true, name: true } },
          _count: {
            select: {
              reactions: true,
              comments: { where: { status: CommentStatus.ACTIVE } },
              favorites: true,
            },
          },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    const data = articles.map((art) => {
      const pStatus = art.articleType === ArticleType.PROMOTION
        ? this.computePromotionStatus(art.promotionStartAt, art.promotionEndAt)
        : null;

      return {
        ...art,
        promotionStatus: pStatus,
        reactionCount: art._count.reactions,
        commentCount: art._count.comments,
        favoriteCount: art._count.favorites,
      };
    });

    return {
      data,
      meta: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Lấy chi tiết bài viết theo Slug kèm tính toán quyền và tương tác
   */
  async getArticleBySlug(
    slug: string,
    userContext?: UserContext | null,
    branchId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
        branches: { select: { id: true, name: true, branchCode: true } },
        membershipTiers: { select: { id: true, name: true } },
        products: {
          orderBy: { displayOrder: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                oldPrice: true,
                discountedPrice: true,
                flashSalePrice: true,
                imageUrl: true,
                badge: true,
                available: true,
                unit: true,
                category: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
        vouchers: {
          include: {
            voucher: {
              select: {
                id: true,
                code: true,
                title: true,
                description: true,
                discountType: true,
                discountValue: true,
                maxDiscount: true,
                minOrderValue: true,
                startDate: true,
                endDate: true,
                isActive: true,
              },
            },
          },
        },
        reactions: {
          select: { type: true, userId: true },
        },
      },
    });

    if (!article) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    // Validate Access Policy
    let isLocked = false;
    let lockMessage: string | null = null;
    try {
      this.accessPolicy.validateAccess(article, userContext, branchId);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        isLocked = true;
        lockMessage = error.message;
      } else {
        throw error;
      }
    }

    // Tính toán Breakdown Reactions
    const breakdown: Record<ReactionType, number> = {
      LIKE: 0,
      LOVE: 0,
      HAHA: 0,
      WOW: 0,
      SAD: 0,
      ANGRY: 0,
    };
    let userReaction: ReactionType | null = null;

    article.reactions.forEach((r) => {
      if (breakdown[r.type] !== undefined) {
        breakdown[r.type] += 1;
      }
      if (userContext?.id && r.userId === userContext.id) {
        userReaction = r.type;
      }
    });

    // Check if favorited
    let isFavorite = false;
    if (userContext?.id) {
      const fav = await this.prisma.articleFavorite.findUnique({
        where: {
          articleId_userId: { articleId: article.id, userId: userContext.id },
        },
      });
      isFavorite = !!fav;
    }

    // Ghi nhận view (throttle 10 phút per IP / User)
    const throttleKey = `view:${article.id}:${userContext?.id || ipAddress || 'guest'}`;
    const nowMs = Date.now();
    const lastViewTime = viewThrottleMap.get(throttleKey);

    if (!lastViewTime || nowMs - lastViewTime > 10 * 60 * 1000) {
      viewThrottleMap.set(throttleKey, nowMs);
      // Clean up old map entries
      if (viewThrottleMap.size > 50000) {
        viewThrottleMap.clear();
      }

      // Increment view atomically
      await this.prisma.article.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      });

      // Log Interaction Event
      await this.prisma.articleInteractionEvent.create({
        data: {
          articleId: article.id,
          userId: userContext?.id || null,
          type: ArticleInteractionType.ARTICLE_VIEW,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    }

    const promotionStatus = article.articleType === ArticleType.PROMOTION
      ? this.computePromotionStatus(article.promotionStartAt, article.promotionEndAt)
      : null;

    // Lấy 3 bài viết liên quan (Related articles)
    const relatedArticles = await this.prisma.article.findMany({
      where: {
        id: { not: article.id },
        articleType: article.articleType,
        status: ArticleStatus.PUBLISHED,
        publishedAt: { lte: new Date() },
        deletedAt: null,
      },
      take: 4,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        thumbnailUrl: true,
        articleType: true,
        publishedAt: true,
        viewCount: true,
        promotionStartAt: true,
        promotionEndAt: true,
      },
    });

    const result = {
      ...article,
      content: isLocked ? '' : article.content,
      isLocked,
      lockMessage,
      products: isLocked ? [] : article.products,
      vouchers: isLocked ? [] : article.vouchers,
      promotionStatus,
      isFavorite,
      userReaction,
      reactionCount: article.reactions.length,
      reactionBreakdown: breakdown,
      relatedArticles: relatedArticles.map((r) => ({
        ...r,
        promotionStatus: r.articleType === ArticleType.PROMOTION
          ? this.computePromotionStatus(r.promotionStartAt, r.promotionEndAt)
          : null,
      })),
    };

    return {
      success: true,
      data: result,
      ...result,
    };
  }

  /**
   * Thả / Đổi / Bỏ Cảm Xúc (Facebook-style Reaction)
   */
  async toggleReaction(articleId: string, userId: string, type: ReactionType, userContext?: UserContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { branches: true, membershipTiers: true },
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    if (!article.allowReaction) {
      throw new BadRequestException('Bài viết này đã tắt tính năng bày tỏ cảm xúc');
    }

    this.accessPolicy.validateAccess(article, userContext);

    const existing = await this.prisma.articleReaction.findUnique({
      where: { articleId_userId: { articleId, userId } },
    });

    let currentReaction: ReactionType | null = null;

    if (existing) {
      if (existing.type === type) {
        // Nhấn lại reaction cũ => Bỏ cảm xúc
        await this.prisma.articleReaction.delete({
          where: { id: existing.id },
        });
        currentReaction = null;
      } else {
        // Đổi sang cảm xúc mới
        await this.prisma.articleReaction.update({
          where: { id: existing.id },
          data: { type },
        });
        currentReaction = type;
      }
    } else {
      // Thả cảm xúc mới
      await this.prisma.articleReaction.create({
        data: { articleId, userId, type },
      });
      currentReaction = type;
    }

    // Lấy lại thống kê mới
    const allReactions = await this.prisma.articleReaction.findMany({
      where: { articleId },
      select: { type: true },
    });

    const breakdown: Record<ReactionType, number> = {
      LIKE: 0,
      LOVE: 0,
      HAHA: 0,
      WOW: 0,
      SAD: 0,
      ANGRY: 0,
    };
    allReactions.forEach((r) => {
      if (breakdown[r.type] !== undefined) breakdown[r.type] += 1;
    });

    return {
      success: true,
      userReaction: currentReaction,
      totalReactions: allReactions.length,
      reactionBreakdown: breakdown,
    };
  }

  /**
   * Lấy bình luận bài viết (2 cấp: top-level và replies)
   */
  async getComments(articleId: string, userContext?: UserContext, page = 1, limit = 15) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { branches: true, membershipTiers: true },
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    this.accessPolicy.validateAccess(article, userContext);

    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.min(50, Math.max(1, limit));

    // Lấy các bình luận cấp 1 (parentId: null)
    const [comments, total] = await Promise.all([
      this.prisma.articleComment.findMany({
        where: {
          articleId,
          parentId: null,
          status: { in: [CommentStatus.ACTIVE, CommentStatus.DELETED] },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
          replies: {
            where: { status: { in: [CommentStatus.ACTIVE, CommentStatus.DELETED] } },
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
            },
          },
        },
      }),
      this.prisma.articleComment.count({
        where: { articleId, parentId: null, status: { not: CommentStatus.HIDDEN } },
      }),
    ]);

    return {
      data: comments,
      meta: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Thêm bình luận hoặc trả lời (tối đa 2 cấp)
   */
  async addComment(
    articleId: string,
    userId: string,
    content: string,
    parentId?: string,
    userContext?: UserContext
  ) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { branches: true, membershipTiers: true },
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    if (!article.allowComment) {
      throw new BadRequestException('Bài viết này đã tạm tắt tính năng bình luận');
    }

    this.accessPolicy.validateAccess(article, userContext);

    const sanitized = content.trim();
    if (!sanitized) throw new BadRequestException('Nội dung bình luận không được để trống');
    if (sanitized.length > 2000) {
      throw new BadRequestException('Nội dung bình luận không được vượt quá 2000 ký tự');
    }

    // 1. Kiểm duyệt ngôn từ vi phạm chuẩn mực văn minh
    const profanityResult = checkProfanity(sanitized);
    if (profanityResult.isProfane) {
      throw new BadRequestException(
        'Bình luận của bạn chứa từ ngữ không phù hợp với chuẩn mực văn minh của AVORA. Vui lòng sử dụng ngôn từ lịch sự và tôn trọng cộng đồng!'
      );
    }

    // Nếu có parentId (Reply) => Kiểm tra cấu trúc 2 tầng
    let parentComment: any = null;
    if (parentId) {
      parentComment = await this.prisma.articleComment.findUnique({
        where: { id: parentId },
      });
      if (!parentComment || parentComment.articleId !== articleId) {
        throw new BadRequestException('Bình luận gốc không tồn tại hoặc không thuộc bài viết này');
      }
      if (parentComment.parentId) {
        throw new BadRequestException('Hệ thống chỉ hỗ trợ trả lời tối đa 2 cấp');
      }
      if (parentComment.status !== CommentStatus.ACTIVE) {
        throw new BadRequestException('Không thể trả lời bình luận đã bị xóa hoặc ẩn');
      }
    }

    const newComment = await this.prisma.articleComment.create({
      data: {
        articleId,
        userId,
        content: sanitized,
        parentId: parentId || null,
        status: CommentStatus.ACTIVE,
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
      },
    });

    // 2. Gửi thông báo khi có người phản hồi bình luận
    if (parentId && parentComment && parentComment.userId !== userId) {
      try {
        const senderName = userContext?.fullName || 'Một khách hàng';
        const snippet = sanitized.length > 80 ? `${sanitized.slice(0, 80)}...` : sanitized;
        await this.notificationService.createNotification({
          userId: parentComment.userId,
          title: `${senderName} đã phản hồi bình luận của bạn`,
          content: `${senderName} đã trả lời bình luận của bạn trong bài viết "${article.title}": "${snippet}"`,
          type: 'ARTICLE' as any,
          referenceId: newComment.id,
          url: `/news/${article.slug}`,
        });
      } catch (notifErr) {
        console.error('Lỗi gửi thông báo phản hồi bình luận:', notifErr);
      }
    } else if (article.authorId && article.authorId !== userId) {
      // Thông báo cho tác giả bài viết khi có bình luận mới
      try {
        const senderName = userContext?.fullName || 'Một khách hàng';
        const snippet = sanitized.length > 80 ? `${sanitized.slice(0, 80)}...` : sanitized;
        await this.notificationService.createNotification({
          userId: article.authorId,
          title: `Bình luận mới trên bài viết "${article.title}"`,
          content: `${senderName} đã để lại bình luận: "${snippet}"`,
          type: 'ARTICLE' as any,
          referenceId: newComment.id,
          url: `/news/${article.slug}`,
        });
      } catch (notifErr) {
        console.error('Lỗi gửi thông báo tác giả bài viết:', notifErr);
      }
    }

    // 3. Gửi thông báo tới đội ngũ kiểm duyệt / marketing có quyền comments.view / comments.moderate
    try {
      const senderName = userContext?.fullName || 'Khách hàng';
      await this.notificationEngine.publishEvent({
        eventType: 'ARTICLE_COMMENT_CREATED',
        category: 'MARKETING',
        priority: 1, // NORMAL
        branchId: null, // Global event
        entityId: newComment.id,
        title: 'Bình luận mới',
        message: `${senderName} vừa bình luận bài viết "${article.title}".`,
        actor: {
          id: userId,
          name: senderName,
          avatarUrl: undefined,
        },
        reference: {
          type: 'ARTICLE_COMMENT',
          id: newComment.id,
          url: `/admin/articles/comments`,
        },
        metadata: {
          commentId: newComment.id,
          articleId: article.id,
          articleTitle: article.title,
          articleSlug: article.slug,
        },
        requiredPermissions: ['comments.view', 'comments.moderate'],
        appScopes: ['ADMIN'],
        excludeActor: true,
        legacyType: 'ARTICLE' as any,
      });
    } catch (engineErr) {
      console.error('Lỗi phát sinh sự kiện ARTICLE_COMMENT_CREATED:', engineErr);
    }

    return newComment;
  }

  /**
   * Sửa bình luận của chính mình
   */
  async updateComment(commentId: string, userId: string, content: string) {
    const comment = await this.prisma.articleComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận');

    if (comment.userId !== userId) {
      throw new ForbiddenException('Bạn chỉ có quyền sửa bình luận của chính mình');
    }
    if (comment.status !== CommentStatus.ACTIVE) {
      throw new BadRequestException('Không thể sửa bình luận đã xóa hoặc ẩn');
    }

    const sanitized = content.trim();
    if (!sanitized) throw new BadRequestException('Nội dung bình luận không được để trống');
    if (sanitized.length > 2000) {
      throw new BadRequestException('Nội dung bình luận không được vượt quá 2000 ký tự');
    }

    // Kiểm duyệt từ ngữ
    const profanityResult = checkProfanity(sanitized);
    if (profanityResult.isProfane) {
      throw new BadRequestException(
        'Nội dung chỉnh sửa chứa từ ngữ không phù hợp với chuẩn mực văn minh của AVORA. Vui lòng kiểm tra lại!'
      );
    }

    return this.prisma.articleComment.update({
      where: { id: commentId },
      data: {
        content: sanitized,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
      },
    });
  }

  /**
   * Xóa bình luận (Soft delete bảo toàn luồng reply)
   */
  async deleteComment(commentId: string, userId: string, role?: RoleType) {
    const comment = await this.prisma.articleComment.findUnique({
      where: { id: commentId },
      include: { replies: true },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận');

    const isOwner = comment.userId === userId;
    const isAdminOrManager = role === RoleType.ADMIN || role === RoleType.MANAGER;

    if (!isOwner && !isAdminOrManager) {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
    }

    if (comment.replies && comment.replies.length > 0) {
      // Có replies => Giữ record, đánh dấu status DELETED
      return this.prisma.articleComment.update({
        where: { id: commentId },
        data: {
          status: CommentStatus.DELETED,
          content: 'Bình luận này đã bị xóa.',
          deletedAt: new Date(),
        },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
        },
      });
    } else {
      // Không có replies => Xóa hoàn toàn
      await this.prisma.articleComment.delete({
        where: { id: commentId },
      });
      return {
        id: commentId,
        status: CommentStatus.DELETED,
        message: 'Đã xóa bình luận',
      };
    }
  }

  /**
   * Lưu / Bỏ lưu bài viết (Bookmark/Favorite)
   */
  async toggleFavorite(articleId: string, userId: string, userContext?: UserContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { branches: true, membershipTiers: true },
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    this.accessPolicy.validateAccess(article, userContext);

    const existing = await this.prisma.articleFavorite.findUnique({
      where: {
        articleId_userId: { articleId, userId },
      },
    });

    if (existing) {
      await this.prisma.articleFavorite.delete({
        where: { id: existing.id },
      });
      return { isFavorite: false, message: 'Đã bỏ lưu bài viết' };
    } else {
      await this.prisma.articleFavorite.create({
        data: { articleId, userId },
      });

      // Log SAVE interaction event
      await this.prisma.articleInteractionEvent.create({
        data: {
          articleId,
          userId,
          type: ArticleInteractionType.SAVE,
        },
      });

      return { isFavorite: true, message: 'Đã lưu bài viết vào hồ sơ' };
    }
  }

  /**
   * Danh sách bài viết đã lưu của User
   */
  async getUserSavedArticles(userId: string, page = 1, limit = 10) {
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.min(50, Math.max(1, limit));

    const [favorites, total] = await Promise.all([
      this.prisma.articleFavorite.findMany({
        where: {
          userId,
          article: { deletedAt: null, status: ArticleStatus.PUBLISHED },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
              excerpt: true,
              thumbnailUrl: true,
              articleType: true,
              publishedAt: true,
              viewCount: true,
              shareCount: true,
              promotionStartAt: true,
              promotionEndAt: true,
              author: { select: { fullName: true, avatarUrl: true } },
            },
          },
        },
      }),
      this.prisma.articleFavorite.count({
        where: {
          userId,
          article: { deletedAt: null, status: ArticleStatus.PUBLISHED },
        },
      }),
    ]);

    return {
      data: favorites.map((f) => ({
        ...f.article,
        savedAt: f.createdAt,
        promotionStatus: f.article.articleType === ArticleType.PROMOTION
          ? this.computePromotionStatus(f.article.promotionStartAt, f.article.promotionEndAt)
          : null,
      })),
      meta: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Ghi nhận lượt Share Intent
   */
  async trackShare(articleId: string, userId?: string, ipAddress?: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    await this.prisma.article.update({
      where: { id: articleId },
      data: { shareCount: { increment: 1 } },
    });

    await this.prisma.articleInteractionEvent.create({
      data: {
        articleId,
        userId: userId || null,
        type: ArticleInteractionType.SHARE,
        ipAddress: ipAddress || null,
      },
    });

    return { success: true };
  }

  /**
   * Ghi nhận click chuyển đổi sang Món Ăn (Product Click)
   */
  async trackProductClick(articleId: string, productId: string, userId?: string) {
    await this.prisma.articleInteractionEvent.create({
      data: {
        articleId,
        productId,
        userId: userId || null,
        type: ArticleInteractionType.PRODUCT_CLICK,
      },
    });
    return { success: true };
  }

  /**
   * Ghi nhận click chuyển đổi sang Voucher
   */
  async trackVoucherClick(articleId: string, voucherId: string, userId?: string) {
    await this.prisma.articleInteractionEvent.create({
      data: {
        articleId,
        voucherId,
        userId: userId || null,
        type: ArticleInteractionType.VOUCHER_CLICK,
      },
    });
    return { success: true };
  }
}
