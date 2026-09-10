import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AuditLogsService } from '../admin/audit-logs/audit-logs.service';
import { UserContext } from './article-access-policy.service';
import {
  ArticleStatus,
  ArticleType,
  ArticleVisibility,
  ArticleInteractionType,
  CampaignStatus,
  CommentStatus,
  RoleType,
  ReactionType,
} from '@prisma/client';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import { SendNotificationCampaignDto, PreviewAudienceDto } from './dto/campaign.dto';

// Helper tạo slug chuẩn SEO không dấu
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Basic HTML sanitizer for rich text content
export function sanitizeContent(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:[^"']*/gi, '');
}

@Injectable()
export class ArticleAdminService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private auditLogsService: AuditLogsService
  ) {}

  /**
   * Tạo bài viết mới
   */
  async create(dto: CreateArticleDto, userContext: UserContext, ipAddress?: string) {
    if (!dto.title || !dto.content) {
      throw new BadRequestException('Tiêu đề và nội dung bài viết là bắt buộc');
    }

    // Manager validation: Chỉ được tạo bài thuộc branch của mình
    let branchIds = dto.branchIds || [];
    if (userContext.role === RoleType.MANAGER) {
      if (userContext.branchId) {
        branchIds = [userContext.branchId];
      }
    }

    // Validate Promotion Dates
    if (dto.articleType === ArticleType.PROMOTION) {
      if (!dto.promotionStartAt || !dto.promotionEndAt) {
        throw new BadRequestException('Bài viết khuyến mãi bắt buộc nhập Ngày bắt đầu và Ngày kết thúc');
      }
      const start = new Date(dto.promotionStartAt);
      const end = new Date(dto.promotionEndAt);
      if (start >= end) {
        throw new BadRequestException('Thời gian bắt đầu khuyến mãi phải nhỏ hơn thời gian kết thúc');
      }
    }

    // Tạo unique slug
    let baseSlug = dto.slug ? slugify(dto.slug) : slugify(dto.title);
    if (!baseSlug) baseSlug = `bai-viet-${Date.now()}`;
    let slug = baseSlug;
    let count = 1;
    while (await this.prisma.article.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${count++}`;
    }

    // Clean HTML content
    const cleanContent = sanitizeContent(dto.content);

    const now = new Date();
    let publishedAt: Date | null = null;
    let status = dto.status || ArticleStatus.DRAFT;

    if (status === ArticleStatus.PUBLISHED) {
      publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : now;
    } else if (status === ArticleStatus.SCHEDULED) {
      if (!dto.scheduledAt) {
        throw new BadRequestException('Bài viết lên lịch bắt buộc chọn thời gian scheduledAt');
      }
    }

    const anyDto = dto as any;
    const articleType = dto.articleType || anyDto.type || ArticleType.NEWS;
    const coverImageUrl = dto.coverImageUrl || anyDto.coverImage || null;
    const seoTitle = dto.seoTitle || anyDto.metaTitle || null;
    const seoDescription = dto.seoDescription || anyDto.metaDescription || null;

    // Extract product IDs
    let productIds = dto.productIds;
    if ((!productIds || productIds.length === 0) && anyDto.products && Array.isArray(anyDto.products)) {
      productIds = anyDto.products
        .map((p: any) => (typeof p === 'string' ? p : p.productId || p.id))
        .filter(Boolean);
    }

    // Extract voucher IDs
    let voucherIds = dto.voucherIds;
    if ((!voucherIds || voucherIds.length === 0) && anyDto.vouchers && Array.isArray(anyDto.vouchers)) {
      voucherIds = anyDto.vouchers
        .map((v: any) => (typeof v === 'string' ? v : v.voucherId || v.id))
        .filter(Boolean);
    }

    const created = await this.prisma.article.create({
      data: {
        title: dto.title.trim(),
        slug,
        excerpt: dto.excerpt?.trim() || null,
        content: cleanContent,
        thumbnailUrl: dto.thumbnailUrl || null,
        coverImageUrl,
        authorId: userContext.id!,
        articleType,
        status,
        visibility: dto.visibility || ArticleVisibility.PUBLIC,
        publishedAt,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        isFeatured: Boolean(dto.isFeatured),
        allowComment: dto.allowComment !== undefined ? Boolean(dto.allowComment) : true,
        allowReaction: dto.allowReaction !== undefined ? Boolean(dto.allowReaction) : true,
        allowShare: dto.allowShare !== undefined ? Boolean(dto.allowShare) : true,
        seoTitle: seoTitle?.trim() || null,
        seoDescription: seoDescription?.trim() || null,
        canonicalUrl: dto.canonicalUrl?.trim() || null,
        promotionStartAt: dto.promotionStartAt ? new Date(dto.promotionStartAt) : null,
        promotionEndAt: dto.promotionEndAt ? new Date(dto.promotionEndAt) : null,
        promotionLabel: dto.promotionLabel?.trim() || null,
        promotionTerms: dto.promotionTerms?.trim() || null,

        // Relations
        branches: branchIds.length > 0 ? { connect: branchIds.map((id) => ({ id })) } : undefined,
        membershipTiers:
          dto.membershipTierIds && dto.membershipTierIds.length > 0
            ? { connect: dto.membershipTierIds.map((id) => ({ id })) }
            : undefined,
        products:
          productIds && productIds.length > 0
            ? {
                create: productIds.map((pid, idx) => ({
                  productId: pid,
                  displayOrder: idx,
                })),
              }
            : undefined,
        vouchers:
          voucherIds && voucherIds.length > 0
            ? {
                create: voucherIds.map((vid) => ({
                  voucherId: vid,
                })),
              }
            : undefined,
      },
      include: {
        branches: true,
        membershipTiers: true,
        products: { include: { product: true } },
        vouchers: { include: { voucher: true } },
      },
    });

    // Ghi AuditLog
    await this.auditLogsService.logAction({
      userId: userContext.id!,
      action: 'ARTICLE_CREATE',
      target: `Article:${created.id}`,
      newValue: JSON.stringify({ title: created.title, slug: created.slug, status: created.status }),
      ipAddress,
    });

    return created;
  }

  /**
   * Cập nhật bài viết
   */
  async update(id: string, dto: UpdateArticleDto, userContext: UserContext, ipAddress?: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: { branches: true },
    });
    if (!article || article.deletedAt) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    // Manager authorization
    if (userContext.role === RoleType.MANAGER && userContext.branchId) {
      const isAllowed = article.branches.length === 0 || article.branches.some((b) => b.id === userContext.branchId);
      if (!isAllowed && article.authorId !== userContext.id) {
        throw new ForbiddenException('Bạn chỉ có quyền cập nhật bài viết của chi nhánh mình');
      }
    }

    const anyDto = dto as any;
    const resolvedArticleType = dto.articleType || anyDto.type || article.articleType;
    if (resolvedArticleType === ArticleType.PROMOTION) {
      const startAt = dto.promotionStartAt !== undefined ? dto.promotionStartAt : article.promotionStartAt;
      const endAt = dto.promotionEndAt !== undefined ? dto.promotionEndAt : article.promotionEndAt;
      if (startAt && endAt) {
        if (new Date(startAt) >= new Date(endAt)) {
          throw new BadRequestException('Thời gian bắt đầu khuyến mãi phải nhỏ hơn thời gian kết thúc');
        }
      }
    }

    // Xử lý slug: Chỉ đổi nếu admin chủ động truyền slug mới
    let slug = article.slug;
    if (dto.slug && dto.slug !== article.slug) {
      slug = slugify(dto.slug);
      const existing = await this.prisma.article.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }
    }

    const cleanContent = dto.content !== undefined ? sanitizeContent(dto.content) : undefined;

    let publishedAt = article.publishedAt;
    if (dto.status === ArticleStatus.PUBLISHED && !article.publishedAt) {
      publishedAt = new Date();
    }

    // Relations update
    const branchUpdate =
      dto.branchIds !== undefined
        ? { set: dto.branchIds.map((bid) => ({ id: bid })) }
        : undefined;

    const tierUpdate =
      dto.membershipTierIds !== undefined
        ? { set: dto.membershipTierIds.map((tid) => ({ id: tid })) }
        : undefined;

    // Cập nhật Product list nếu có
    let resolvedProductIds = dto.productIds;
    if (resolvedProductIds === undefined && anyDto.products !== undefined && Array.isArray(anyDto.products)) {
      resolvedProductIds = anyDto.products
        .map((p: any) => (typeof p === 'string' ? p : p.productId || p.id))
        .filter(Boolean);
    }

    if (resolvedProductIds !== undefined) {
      await this.prisma.articleProduct.deleteMany({ where: { articleId: id } });
      if (resolvedProductIds.length > 0) {
        await this.prisma.articleProduct.createMany({
          data: resolvedProductIds.map((pid, idx) => ({
            articleId: id,
            productId: pid,
            displayOrder: idx,
          })),
        });
      }
    }

    // Cập nhật Voucher list nếu có
    let resolvedVoucherIds = dto.voucherIds;
    if (resolvedVoucherIds === undefined && anyDto.vouchers !== undefined && Array.isArray(anyDto.vouchers)) {
      resolvedVoucherIds = anyDto.vouchers
        .map((v: any) => (typeof v === 'string' ? v : v.voucherId || v.id))
        .filter(Boolean);
    }

    if (resolvedVoucherIds !== undefined) {
      await this.prisma.articleVoucher.deleteMany({ where: { articleId: id } });
      if (resolvedVoucherIds.length > 0) {
        await this.prisma.articleVoucher.createMany({
          data: resolvedVoucherIds.map((vid) => ({
            articleId: id,
            voucherId: vid,
          })),
        });
      }
    }

    const coverImageUrl = dto.coverImageUrl !== undefined ? dto.coverImageUrl : anyDto.coverImage;
    const seoTitle = dto.seoTitle !== undefined ? dto.seoTitle : anyDto.metaTitle;
    const seoDescription = dto.seoDescription !== undefined ? dto.seoDescription : anyDto.metaDescription;

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        slug,
        excerpt: dto.excerpt !== undefined ? (dto.excerpt ? dto.excerpt.trim() : null) : undefined,
        content: cleanContent,
        thumbnailUrl: dto.thumbnailUrl !== undefined ? dto.thumbnailUrl : undefined,
        coverImageUrl: coverImageUrl !== undefined ? coverImageUrl : undefined,
        articleType: resolvedArticleType,
        status: dto.status,
        visibility: dto.visibility,
        publishedAt: dto.publishedAt !== undefined ? (dto.publishedAt ? new Date(dto.publishedAt) : null) : publishedAt,
        scheduledAt: dto.scheduledAt !== undefined ? (dto.scheduledAt ? new Date(dto.scheduledAt) : null) : undefined,
        isFeatured: dto.isFeatured,
        allowComment: dto.allowComment,
        allowReaction: dto.allowReaction,
        allowShare: dto.allowShare,
        seoTitle: seoTitle !== undefined ? (seoTitle ? seoTitle.trim() : null) : undefined,
        seoDescription: seoDescription !== undefined ? (seoDescription ? seoDescription.trim() : null) : undefined,
        canonicalUrl: dto.canonicalUrl !== undefined ? dto.canonicalUrl : undefined,
        promotionStartAt: dto.promotionStartAt !== undefined ? (dto.promotionStartAt ? new Date(dto.promotionStartAt) : null) : undefined,
        promotionEndAt: dto.promotionEndAt !== undefined ? (dto.promotionEndAt ? new Date(dto.promotionEndAt) : null) : undefined,
        promotionLabel: dto.promotionLabel !== undefined ? dto.promotionLabel : undefined,
        promotionTerms: dto.promotionTerms !== undefined ? dto.promotionTerms : undefined,
        branches: branchUpdate,
        membershipTiers: tierUpdate,
      },
      include: {
        branches: true,
        membershipTiers: true,
        products: { include: { product: true } },
        vouchers: { include: { voucher: true } },
      },
    });

    await this.auditLogsService.logAction({
      userId: userContext.id!,
      action: 'ARTICLE_UPDATE',
      target: `Article:${id}`,
      oldValue: JSON.stringify({ title: article.title, status: article.status }),
      newValue: JSON.stringify({ title: updated.title, status: updated.status }),
      ipAddress,
    });

    return updated;
  }

  /**
   * Xóa bài viết (Soft delete / Archive để bảo toàn analytics và bình luận)
   */
  async delete(id: string, userContext: UserContext, ipAddress?: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article || article.deletedAt) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: ArticleStatus.ARCHIVED,
      },
    });

    await this.auditLogsService.logAction({
      userId: userContext.id!,
      action: 'ARTICLE_DELETE',
      target: `Article:${id}`,
      oldValue: JSON.stringify({ title: article.title, status: article.status }),
      ipAddress,
    });

    return { success: true, message: 'Đã lưu trữ và gỡ bài viết thành công' };
  }

  /**
   * Xuất bản nhanh
   */
  async publish(id: string, userContext: UserContext, ipAddress?: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: article.publishedAt || new Date(),
      },
    });

    await this.auditLogsService.logAction({
      userId: userContext.id!,
      action: 'ARTICLE_PUBLISH',
      target: `Article:${id}`,
      newValue: 'PUBLISHED',
      ipAddress,
    });

    return updated;
  }

  /**
   * Gỡ xuất bản về bản nháp
   */
  async unpublish(id: string, userContext: UserContext, ipAddress?: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    const updated = await this.prisma.article.update({
      where: { id },
      data: { status: ArticleStatus.DRAFT },
    });

    await this.auditLogsService.logAction({
      userId: userContext.id!,
      action: 'ARTICLE_UNPUBLISH',
      target: `Article:${id}`,
      newValue: 'DRAFT',
      ipAddress,
    });

    return updated;
  }

  /**
   * Danh sách bài viết trong Quản trị (Admin / Manager)
   */
  async findAll(query: QueryArticleDto, userContext: UserContext) {
    const { page = 1, limit = 15, search, type, status, visibility, branchId, tierId, promotionStatus } = query;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.min(100, Math.max(1, limit));

    const where: any = { deletedAt: null };

    // Manager filter
    if (userContext.role === RoleType.MANAGER && userContext.branchId) {
      where.OR = [
        { branches: { none: {} } },
        { branches: { some: { id: userContext.branchId } } },
        { authorId: userContext.id },
      ];
    }

    if (type) where.articleType = type;
    if (status) where.status = status;
    if (visibility) where.visibility = visibility;
    if (branchId) where.branches = { some: { id: branchId } };
    if (tierId) where.membershipTiers = { some: { id: tierId } };

    if (search && search.trim()) {
      where.AND = [
        {
          OR: [
            { title: { contains: search.trim() } },
            { slug: { contains: search.trim() } },
            { excerpt: { contains: search.trim() } },
          ],
        },
      ];
    }

    const now = new Date();
    if (promotionStatus === 'UPCOMING') {
      where.promotionStartAt = { gt: now };
    } else if (promotionStatus === 'ONGOING') {
      where.promotionStartAt = { lte: now };
      where.promotionEndAt = { gte: now };
    } else if (promotionStatus === 'ENDED') {
      where.promotionEndAt = { lt: now };
    }

    const [articles, total, stats] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
          branches: { select: { id: true, name: true, branchCode: true } },
          membershipTiers: { select: { id: true, name: true } },
          _count: {
            select: {
              reactions: true,
              comments: true,
              favorites: true,
              interactionEvents: true,
              campaigns: true,
            },
          },
        },
      }),
      this.prisma.article.count({ where }),
      this.prisma.article.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    // Compute summary stats
    const totalPublished = stats.find((s) => s.status === ArticleStatus.PUBLISHED)?._count._all || 0;
    const totalDraft = stats.find((s) => s.status === ArticleStatus.DRAFT)?._count._all || 0;
    const totalScheduled = stats.find((s) => s.status === ArticleStatus.SCHEDULED)?._count._all || 0;

    const activePromotions = await this.prisma.article.count({
      where: {
        deletedAt: null,
        status: ArticleStatus.PUBLISHED,
        articleType: ArticleType.PROMOTION,
        promotionStartAt: { lte: now },
        promotionEndAt: { gte: now },
      },
    });

    return {
      data: articles.map((a) => {
        let pStatus: 'UPCOMING' | 'ONGOING' | 'ENDED' | null = null;
        if (a.articleType === ArticleType.PROMOTION && a.promotionStartAt && a.promotionEndAt) {
          if (now < a.promotionStartAt) pStatus = 'UPCOMING';
          else if (now <= a.promotionEndAt) pStatus = 'ONGOING';
          else pStatus = 'ENDED';
        }

        return {
          ...a,
          promotionStatus: pStatus,
          reactionCount: a._count.reactions,
          commentCount: a._count.comments,
          favoriteCount: a._count.favorites,
          campaignCount: a._count.campaigns,
        };
      }),
      summary: {
        totalArticles: total,
        totalPublished,
        totalDraft,
        totalScheduled,
        activePromotions,
      },
      meta: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Chi tiết bài viết cho Admin
   */
  async findOne(id: string, userContext: UserContext) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
        branches: { select: { id: true, name: true, branchCode: true } },
        membershipTiers: { select: { id: true, name: true } },
        products: {
          orderBy: { displayOrder: 'asc' },
          include: { product: true },
        },
        vouchers: {
          include: { voucher: true },
        },
        campaigns: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { fullName: true, email: true } } },
        },
        _count: {
          select: {
            reactions: true,
            comments: true,
            favorites: true,
            interactionEvents: true,
          },
        },
      },
    });

    if (!article || article.deletedAt) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    return {
      success: true,
      data: article,
      ...article,
    };
  }

  /**
   * Dự toán số lượng người nhận thông báo (Audience Preview)
   */
  async previewAudience(articleId: string, dto: PreviewAudienceDto, userContext: UserContext) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { branches: true, membershipTiers: true },
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    const userWhere: any = { isAccountLocked: false };

    // Manager constraint
    if (userContext.role === RoleType.MANAGER && userContext.branchId) {
      userWhere.branchId = userContext.branchId;
    }

    const targetType = (dto.targetType || (dto as any).targetAudience || 'ALL') as string;

    const resolvedBranchIds =
      dto.targetBranchIds !== undefined
        ? dto.targetBranchIds
        : article.branches.map((b) => b.id);

    const resolvedTierIds =
      dto.targetTierIds !== undefined
        ? dto.targetTierIds
        : article.membershipTiers.map((t) => t.id);

    switch (targetType) {
      case 'ALL':
        // All active users
        break;

      case 'BRANCH':
        if (resolvedBranchIds.length > 0) {
          userWhere.branchId = { in: resolvedBranchIds };
        } else {
          userWhere.branchId = '__NONE__';
        }
        break;

      case 'MEMBERSHIP_TIER':
        if (resolvedTierIds.length > 0) {
          userWhere.membershipTierId = { in: resolvedTierIds };
        } else {
          userWhere.membershipTierId = '__NONE__';
        }
        break;

      case 'TIER_AND_BRANCH':
      case 'BRANCH_AND_TIER':
        if (resolvedBranchIds.length > 0) {
          userWhere.branchId = { in: resolvedBranchIds };
        } else {
          userWhere.branchId = '__NONE__';
        }
        if (resolvedTierIds.length > 0) {
          userWhere.membershipTierId = { in: resolvedTierIds };
        } else {
          userWhere.membershipTierId = '__NONE__';
        }
        break;

      case 'SPECIFIC_USERS':
        if (dto.targetUserIds && dto.targetUserIds.length > 0) {
          userWhere.id = { in: dto.targetUserIds };
        } else {
          userWhere.id = '__NONE__';
        }
        break;
    }

    const estimatedRecipients = await this.prisma.user.count({ where: userWhere });

    const [selectedBranchList, selectedTierList, selectedUserList] = await Promise.all([
      resolvedBranchIds.length > 0
        ? this.prisma.branch.findMany({
            where: { id: { in: resolvedBranchIds } },
            select: { id: true, name: true, branchCode: true },
          })
        : [],
      resolvedTierIds.length > 0
        ? this.prisma.membershipTier.findMany({
            where: { id: { in: resolvedTierIds } },
            select: { id: true, name: true },
          })
        : [],
      dto.targetUserIds && dto.targetUserIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: dto.targetUserIds } },
            select: { id: true, fullName: true, email: true, phone: true },
          })
        : [],
    ]);

    const previewData = {
      estimatedRecipients,
      targetType,
      selectedBranches: selectedBranchList,
      selectedMembershipTiers: selectedTierList,
      selectedUsers: selectedUserList,
      targetBranchIds: resolvedBranchIds,
      targetTierIds: resolvedTierIds,
      targetUserIds: dto.targetUserIds || [],
    };

    return {
      success: true,
      data: previewData,
      ...previewData,
    };
  }

  /**
   * Gửi thông báo chiến dịch (Notification Campaign) từ bài viết
   */
  async sendNotificationCampaign(
    articleId: string,
    dto: SendNotificationCampaignDto,
    userContext: UserContext,
    ipAddress?: string
  ) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { branches: true, membershipTiers: true },
    });
    if (!article || article.deletedAt) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.articleNotificationCampaign.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return {
          success: true,
          message: 'Chiến dịch này đã được gửi trước đó',
          campaign: existing,
          data: {
            recipientCount: existing.sentCount,
            campaign: existing,
          },
        };
      }
    }

    const targetType = (dto.targetType || (dto as any).targetAudience || 'ALL') as string;

    const resolvedBranchIds =
      dto.targetBranchIds !== undefined
        ? dto.targetBranchIds
        : article.branches.map((b) => b.id);

    const resolvedTierIds =
      dto.targetTierIds !== undefined
        ? dto.targetTierIds
        : article.membershipTiers.map((t) => t.id);

    // Resolve audience
    const userWhere: any = { isAccountLocked: false };
    if (userContext.role === RoleType.MANAGER && userContext.branchId) {
      userWhere.branchId = userContext.branchId;
    }

    if (targetType === 'BRANCH') {
      if (resolvedBranchIds.length > 0) {
        userWhere.branchId = { in: resolvedBranchIds };
      } else {
        throw new BadRequestException('Vui lòng chọn ít nhất 1 chi nhánh để gửi thông báo');
      }
    } else if (targetType === 'MEMBERSHIP_TIER') {
      if (resolvedTierIds.length > 0) {
        userWhere.membershipTierId = { in: resolvedTierIds };
      } else {
        throw new BadRequestException('Vui lòng chọn ít nhất 1 hạng thẻ thành viên để gửi thông báo');
      }
    } else if (targetType === 'TIER_AND_BRANCH' || targetType === 'BRANCH_AND_TIER') {
      if (resolvedBranchIds.length > 0) userWhere.branchId = { in: resolvedBranchIds };
      if (resolvedTierIds.length > 0) userWhere.membershipTierId = { in: resolvedTierIds };
      if (resolvedBranchIds.length === 0 && resolvedTierIds.length === 0) {
        throw new BadRequestException('Vui lòng chọn chi nhánh hoặc hạng thẻ để gửi thông báo');
      }
    } else if (targetType === 'SPECIFIC_USERS') {
      if (dto.targetUserIds && dto.targetUserIds.length > 0) {
        userWhere.id = { in: dto.targetUserIds };
      } else {
        throw new BadRequestException('Vui lòng chọn ít nhất 1 khách hàng cụ thể để gửi thông báo');
      }
    }

    const recipients = await this.prisma.user.findMany({
      where: userWhere,
      select: { id: true },
    });

    if (recipients.length === 0) {
      throw new BadRequestException('Không tìm thấy khách hàng nào phù hợp với nhóm đối tượng đã chọn');
    }

    const notifContent = (dto.content || (dto as any).body || '').trim();
    if (!notifContent) {
      throw new BadRequestException('Nội dung thông báo không được để trống');
    }

    // Tạo Campaign Record
    const campaign = await this.prisma.articleNotificationCampaign.create({
      data: {
        articleId,
        createdById: userContext.id!,
        title: dto.title.trim(),
        content: notifContent,
        targetType: targetType === 'BRANCH_AND_TIER' ? 'TIER_AND_BRANCH' : (targetType as any),
        targetBranchIds: resolvedBranchIds.length > 0 ? JSON.stringify(resolvedBranchIds) : null,
        targetTierIds: resolvedTierIds.length > 0 ? JSON.stringify(resolvedTierIds) : null,
        targetUserIds: dto.targetUserIds ? JSON.stringify(dto.targetUserIds) : null,
        totalRecipients: recipients.length,
        status: CampaignStatus.PROCESSING,
        idempotencyKey: dto.idempotencyKey || `camp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
    });

    // Gửi thông báo theo Batch 100 người
    let sentCount = 0;
    let failedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (u) => {
          try {
            await this.notificationService.createNotification({
              userId: u.id,
              title: dto.title.trim(),
              content: notifContent,
              type: 'PROMOTION',
              referenceId: article.id,
              url: `/news/${article.slug}`,
            });
            sentCount++;
          } catch (e) {
            failedCount++;
          }
        })
      );
    }

    // Cập nhật kết quả chiến dịch
    const finalCampaign = await this.prisma.articleNotificationCampaign.update({
      where: { id: campaign.id },
      data: {
        sentCount,
        failedCount,
        status: failedCount === 0 ? CampaignStatus.COMPLETED : CampaignStatus.PARTIALLY_FAILED,
        sentAt: new Date(),
      },
    });

    await this.auditLogsService.logAction({
      userId: userContext.id!,
      action: 'ARTICLE_NOTIFICATION_SENT',
      target: `Campaign:${campaign.id}`,
      newValue: JSON.stringify({ articleId, totalRecipients: recipients.length, sentCount, failedCount }),
      ipAddress,
    });

    return {
      success: true,
      message: `Đã gửi thông báo thành công cho ${sentCount}/${recipients.length} khách hàng`,
      data: {
        recipientCount: sentCount,
        failedCount,
        campaign: finalCampaign,
      },
      campaign: finalCampaign,
      recipientCount: sentCount,
    };
  }

  /**
   * Thống kê Analytics chuyên sâu (100% dữ liệu thực tế)
   */
  async getAnalytics(articleId: string, userContext: UserContext, days = 30) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: {
        products: { include: { product: true } },
        vouchers: { include: { voucher: true } },
      },
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Lấy tất cả interaction events
    const [events, reactions, commentsCount, favoritesCount] = await Promise.all([
      this.prisma.articleInteractionEvent.findMany({
        where: {
          articleId,
          createdAt: { gte: since },
        },
      }),
      this.prisma.articleReaction.findMany({
        where: { articleId },
        select: { type: true },
      }),
      this.prisma.articleComment.count({
        where: { articleId, status: CommentStatus.ACTIVE },
      }),
      this.prisma.articleFavorite.count({
        where: { articleId },
      }),
    ]);

    // Breakdown reactions
    const reactionBreakdown: Record<ReactionType, number> = {
      LIKE: 0,
      LOVE: 0,
      HAHA: 0,
      WOW: 0,
      SAD: 0,
      ANGRY: 0,
    };
    reactions.forEach((r) => {
      if (reactionBreakdown[r.type] !== undefined) reactionBreakdown[r.type] += 1;
    });

    // Breakdown events
    let viewsCount = 0;
    let sharesCount = 0;
    let totalProductClicks = 0;
    let totalVoucherClicks = 0;
    const productClickMap: Record<string, number> = {};

    events.forEach((ev) => {
      if (ev.type === ArticleInteractionType.ARTICLE_VIEW) viewsCount++;
      if (ev.type === ArticleInteractionType.SHARE) sharesCount++;
      if (ev.type === ArticleInteractionType.PRODUCT_CLICK) {
        totalProductClicks++;
        if (ev.productId) {
          productClickMap[ev.productId] = (productClickMap[ev.productId] || 0) + 1;
        }
      }
      if (ev.type === ArticleInteractionType.VOUCHER_CLICK) totalVoucherClicks++;
    });

    // CTR Product Click
    const qualifiedViews = Math.max(viewsCount, article.viewCount);
    const productCTR = qualifiedViews > 0 ? Number(((totalProductClicks / qualifiedViews) * 100).toFixed(2)) : 0;

    // Daily Trend Timeline
    const dailyMap: Record<string, { date: string; views: number; clicks: number; reactions: number }> = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - i));
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { date: key, views: 0, clicks: 0, reactions: 0 };
    }

    events.forEach((ev) => {
      const key = ev.createdAt.toISOString().split('T')[0];
      if (dailyMap[key]) {
        if (ev.type === ArticleInteractionType.ARTICLE_VIEW) dailyMap[key].views++;
        if (ev.type === ArticleInteractionType.PRODUCT_CLICK) dailyMap[key].clicks++;
      }
    });

    // Product Click Performance list
    const productPerformance = article.products.map((ap) => {
      const clicks = productClickMap[ap.productId] || 0;
      const ctr = qualifiedViews > 0 ? Number(((clicks / qualifiedViews) * 100).toFixed(2)) : 0;
      return {
        productId: ap.productId,
        productName: ap.product.name,
        price: ap.product.price,
        imageUrl: ap.product.imageUrl,
        clicks,
        ctr,
      };
    });

    const reactionsBreakdownArray = Object.entries(reactionBreakdown).map(([type, count]) => ({
      type,
      count,
    }));

    const productClicksList = (productPerformance || []).map((p) => ({
      productId: p.productId,
      productName: p.productName,
      name: p.productName,
      clickCount: p.clicks,
      clicks: p.clicks,
      ctr: p.ctr,
    }));

    const responseData = {
      articleId: article.id,
      title: article.title,
      publishedAt: article.publishedAt,
      totalViews: qualifiedViews,
      totalReactions: reactions.length,
      reactionBreakdown,
      reactionsBreakdown: reactionsBreakdownArray,
      totalComments: commentsCount,
      totalFavorites: favoritesCount,
      totalShares: Math.max(sharesCount, article.shareCount),
      totalProductClicks,
      totalVoucherClicks,
      productCTR,
      ctrPercentage: productCTR,
      productPerformance,
      productClicks: productClicksList,
      dailyTrend: Object.values(dailyMap),
      article: {
        id: article.id,
        title: article.title,
        viewCount: qualifiedViews,
        reactionCount: reactions.length,
        commentCount: commentsCount,
        shareCount: Math.max(sharesCount, article.shareCount),
        _count: {
          favorites: favoritesCount,
          reactions: reactions.length,
          comments: commentsCount,
        },
      },
    };

    return {
      success: true,
      data: responseData,
      ...responseData,
    };
  }

  /**
   * Danh sách bình luận cho Quản trị viên (Moderation)
   */
  async getAdminComments(query: { page?: number; limit?: number; search?: string; status?: CommentStatus; articleId?: string }) {
    const { page = 1, limit = 20, search, status, articleId } = query;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.min(100, Math.max(1, limit));

    const where: any = {};
    if (status) where.status = status;
    if (articleId) where.articleId = articleId;

    if (search && search.trim()) {
      where.OR = [
        { content: { contains: search.trim() } },
        { user: { fullName: { contains: search.trim() } } },
        { article: { title: { contains: search.trim() } } },
      ];
    }

    const [comments, total] = await Promise.all([
      this.prisma.articleComment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
          article: { select: { id: true, title: true, slug: true } },
        },
      }),
      this.prisma.articleComment.count({ where }),
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
   * Thay đổi trạng thái bình luận (Ẩn / Khôi phục)
   */
  async toggleCommentStatus(commentId: string, status: CommentStatus, userContext: UserContext, ipAddress?: string) {
    const comment = await this.prisma.articleComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận');

    const updated = await this.prisma.articleComment.update({
      where: { id: commentId },
      data: { status },
    });

    await this.auditLogsService.logAction({
      userId: userContext.id!,
      action: 'ARTICLE_COMMENT_STATUS_CHANGE',
      target: `Comment:${commentId}`,
      oldValue: comment.status,
      newValue: status,
      ipAddress,
    });

    return updated;
  }
}
