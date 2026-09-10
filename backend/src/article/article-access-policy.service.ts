import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Article, ArticleStatus, ArticleVisibility, RoleType } from '@prisma/client';

export interface UserContext {
  id?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: RoleType;
  membershipTierId?: string | null;
  branchId?: string | null;
}

@Injectable()
export class ArticleAccessPolicyService {
  /**
   * Kiểm tra xem User/Guest có quyền đọc hoặc tương tác với bài viết này không
   * @throws NotFoundException hoặc ForbiddenException nếu không đủ quyền
   */
  validateAccess(
    article: Article & {
      branches?: { id: string }[];
      membershipTiers?: { id: string }[];
    },
    user?: UserContext | null,
    requestBranchId?: string
  ): boolean {
    if (!article || article.deletedAt) {
      throw new NotFoundException('Bài viết không tồn tại hoặc đã bị gỡ');
    }

    // 1. ADMIN có toàn quyền
    if (user?.role === RoleType.ADMIN) {
      return true;
    }

    // 2. MANAGER quản lý trong phạm vi chi nhánh của mình
    if (user?.role === RoleType.MANAGER) {
      if (article.status === ArticleStatus.PUBLISHED) {
        return true;
      }
      // Xem trước bản nháp / scheduled
      if (!user.branchId) return true;
      if (!article.branches || article.branches.length === 0) return true;
      const isManagerBranch = article.branches.some((b) => b.id === user.branchId);
      if (isManagerBranch || article.authorId === user.id) return true;
      throw new ForbiddenException('Bạn không có quyền xem bài viết của chi nhánh khác');
    }

    // 3. Khách hàng thông thường hoặc Khách vãng lai (Guest)
    const now = new Date();

    // Bài viết phải ở trạng thái PUBLISHED và thời gian publishedAt đã đến
    if (article.status !== ArticleStatus.PUBLISHED) {
      throw new NotFoundException('Bài viết không tồn tại hoặc chưa được xuất bản');
    }
    if (article.publishedAt && new Date(article.publishedAt) > now) {
      throw new NotFoundException('Bài viết chưa đến thời gian xuất bản');
    }

    // Kiểm tra Visibility
    switch (article.visibility) {
      case ArticleVisibility.PUBLIC:
        // Ai cũng xem được
        break;

      case ArticleVisibility.AUTHENTICATED:
        if (!user || !user.id) {
          throw new ForbiddenException('Vui lòng đăng nhập để đọc bài viết này');
        }
        break;

      case ArticleVisibility.MEMBERS_ONLY:
        if (!user || !user.id) {
          throw new ForbiddenException('Bài viết chỉ dành riêng cho thành viên AVORA. Vui lòng đăng nhập.');
        }
        if (article.membershipTiers && article.membershipTiers.length > 0) {
          const hasTier = article.membershipTiers.some((t) => t.id === user.membershipTierId);
          if (!hasTier) {
            throw new ForbiddenException('Hạng thành viên của bạn chưa đủ điều kiện để xem bài viết đặc quyền này');
          }
        }
        break;

      case ArticleVisibility.PRIVATE:
      default:
        throw new NotFoundException('Bài viết không tồn tại');
    }

    // Kiểm tra Branch Targeting (nếu có yêu cầu lọc theo chi nhánh)
    if (article.branches && article.branches.length > 0) {
      const activeBranch = requestBranchId || user?.branchId;
      if (activeBranch) {
        const isBranchMatch = article.branches.some((b) => b.id === activeBranch);
        if (!isBranchMatch) {
          throw new NotFoundException('Bài viết không áp dụng cho chi nhánh này');
        }
      }
    }

    return true;
  }

  /**
   * Build Prisma WHERE filter cho danh sách bài viết theo quyền của User
   */
  buildPublicFeedWhere(user?: UserContext | null, branchId?: string): any {
    const now = new Date();
    const isSpecialUser = user?.role === RoleType.ADMIN || user?.role === RoleType.MANAGER;

    if (isSpecialUser && user?.role === RoleType.ADMIN) {
      return { deletedAt: null };
    }

    // Điều kiện chung cho Client: PUBLISHED, publishedAt <= now, deletedAt: null
    const baseWhere: any = {
      status: ArticleStatus.PUBLISHED,
      publishedAt: { lte: now },
      deletedAt: null,
    };

    // Điều kiện Visibility
    const visibilityConditions: any[] = [{ visibility: ArticleVisibility.PUBLIC }];

    if (user && user.id) {
      visibilityConditions.push({ visibility: ArticleVisibility.AUTHENTICATED });

      if (user.membershipTierId) {
        visibilityConditions.push({
          visibility: ArticleVisibility.MEMBERS_ONLY,
          OR: [
            { membershipTiers: { none: {} } },
            { membershipTiers: { some: { id: user.membershipTierId } } },
          ],
        });
      }
    }

    baseWhere.AND = [{ OR: visibilityConditions }];

    // Điều kiện Branch Targeting
    const targetBranch = branchId || user?.branchId;
    if (targetBranch) {
      baseWhere.AND.push({
        OR: [
          { branches: { none: {} } },
          { branches: { some: { id: targetBranch } } },
        ],
      });
    }

    return baseWhere;
  }
}
