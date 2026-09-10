import { IsString, IsNotEmpty, IsOptional, IsArray, IsBoolean, IsIn } from 'class-validator';

export class PreviewVoucherAudienceDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ALL', 'MEMBERSHIP_TIER', 'SPECIFIC_USERS'])
  targetType: 'ALL' | 'MEMBERSHIP_TIER' | 'SPECIFIC_USERS';

  @IsArray()
  @IsOptional()
  targetTierIds?: string[];

  @IsArray()
  @IsOptional()
  targetUserIds?: string[];
}

export class SendVoucherCampaignDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsBoolean()
  @IsOptional()
  sendInApp?: boolean;

  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;

  @IsString()
  @IsNotEmpty()
  @IsIn(['ALL', 'MEMBERSHIP_TIER', 'SPECIFIC_USERS'])
  targetType: 'ALL' | 'MEMBERSHIP_TIER' | 'SPECIFIC_USERS';

  @IsArray()
  @IsOptional()
  targetTierIds?: string[];

  @IsArray()
  @IsOptional()
  targetUserIds?: string[];

  @IsString()
  @IsOptional()
  customEmailSubject?: string;

  @IsString()
  @IsOptional()
  customEmailNote?: string;
}
