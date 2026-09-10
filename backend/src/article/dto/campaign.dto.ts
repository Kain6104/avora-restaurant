import { IsString, IsNotEmpty, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class SendNotificationCampaignDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsNotEmpty()
  targetType: 'ALL' | 'BRANCH' | 'MEMBERSHIP_TIER' | 'SPECIFIC_USERS' | 'TIER_AND_BRANCH' | 'BRANCH_AND_TIER';

  @IsArray()
  @IsOptional()
  targetBranchIds?: string[];

  @IsArray()
  @IsOptional()
  targetTierIds?: string[];

  @IsArray()
  @IsOptional()
  targetUserIds?: string[];

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  sendPush?: boolean;

  @IsBoolean()
  @IsOptional()
  sendInApp?: boolean;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class PreviewAudienceDto {
  @IsString()
  @IsNotEmpty()
  targetType: 'ALL' | 'BRANCH' | 'MEMBERSHIP_TIER' | 'SPECIFIC_USERS' | 'TIER_AND_BRANCH' | 'BRANCH_AND_TIER';

  @IsArray()
  @IsOptional()
  targetBranchIds?: string[];

  @IsArray()
  @IsOptional()
  targetTierIds?: string[];

  @IsArray()
  @IsOptional()
  targetUserIds?: string[];
}

