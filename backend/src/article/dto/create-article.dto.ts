import { ArticleType, ArticleStatus, ArticleVisibility } from '@prisma/client';

export class CreateArticleDto {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  articleType?: ArticleType;
  status?: ArticleStatus;
  visibility?: ArticleVisibility;
  publishedAt?: string | Date;
  scheduledAt?: string | Date;
  isFeatured?: boolean;
  allowComment?: boolean;
  allowReaction?: boolean;
  allowShare?: boolean;

  // SEO
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;

  // Promotion
  promotionStartAt?: string | Date;
  promotionEndAt?: string | Date;
  promotionLabel?: string;
  promotionTerms?: string;

  // Targeting & Relations
  branchIds?: string[];
  membershipTierIds?: string[];
  productIds?: string[];
  voucherIds?: string[];
}
