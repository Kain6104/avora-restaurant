import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductReviewStatus, OrderReviewStatus } from '@prisma/client';

export class AdminProductReviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  isVerified?: string;

  @IsOptional()
  @IsString()
  hasMedia?: string;

  @IsOptional()
  @IsEnum(ProductReviewStatus)
  status?: ProductReviewStatus;

  @IsOptional()
  @IsString()
  sortBy?: 'newest' | 'oldest' | 'rating_desc' | 'rating_asc' | 'most_liked' = 'newest';

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class AdminOrderReviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  hasMedia?: string;

  @IsOptional()
  @IsString()
  hasFollowUps?: string;

  @IsOptional()
  @IsEnum(OrderReviewStatus)
  status?: OrderReviewStatus;

  @IsOptional()
  @IsString()
  sortBy?: 'newest' | 'oldest' | 'rating_desc' | 'rating_asc' = 'newest';

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
