import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBannerDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  imageUrl: string;

  @IsOptional()
  @IsString()
  mobileImageUrl?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  position?: 'HERO' | 'POPUP' | 'PROMO';

  @IsOptional()
  @IsString()
  targetAudience?: 'ALL' | 'MEMBERS_ONLY' | 'VIP_ONLY';

  @IsOptional()
  @IsString()
  popupFrequency?: 'ONCE_PER_SESSION' | 'EVERY_PAGE_LOAD';

  @IsOptional()
  startDate?: string | null;

  @IsOptional()
  endDate?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  popup?: boolean;

  @IsOptional()
  @IsNumber()
  bannerOrder?: number;

  @IsOptional()
  @IsArray()
  branchIds?: string[];
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  mobileImageUrl?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  position?: 'HERO' | 'POPUP' | 'PROMO';

  @IsOptional()
  @IsString()
  targetAudience?: 'ALL' | 'MEMBERS_ONLY' | 'VIP_ONLY';

  @IsOptional()
  @IsString()
  popupFrequency?: 'ONCE_PER_SESSION' | 'EVERY_PAGE_LOAD';

  @IsOptional()
  startDate?: string | null;

  @IsOptional()
  endDate?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  popup?: boolean;

  @IsOptional()
  @IsNumber()
  bannerOrder?: number;

  @IsOptional()
  @IsArray()
  branchIds?: string[];
}

export class ReorderItemDto {
  @IsString()
  id: string;

  @IsNumber()
  bannerOrder: number;
}

export class ReorderBannersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];

  @IsOptional()
  @IsString()
  position?: string;
}
