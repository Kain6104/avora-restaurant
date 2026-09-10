import { ArticleType, ArticleStatus, ArticleVisibility } from '@prisma/client';

export class QueryArticleDto {
  page?: number;
  limit?: number;
  search?: string;
  type?: ArticleType;
  status?: ArticleStatus;
  visibility?: ArticleVisibility;
  branchId?: string;
  tierId?: string;
  isFeatured?: boolean;
  promotionStatus?: 'UPCOMING' | 'ONGOING' | 'ENDED';
  sort?: string;
}
