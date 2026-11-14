import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WEB_PUSH_PLATFORM, WebPushPlatform } from '../web-push.constants';

export class WebPushKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class CategoryPreferencesDto {
  @IsOptional()
  orders?: boolean;

  @IsOptional()
  qrOrders?: boolean;

  @IsOptional()
  serviceRequests?: boolean;

  @IsOptional()
  payments?: boolean;

  @IsOptional()
  tables?: boolean;

  @IsOptional()
  buffet?: boolean;
}

export class SubscribeWebPushDto {
  @IsUrl({ require_tld: false, protocols: ['https'] }, { message: 'Push endpoint must be a valid secure HTTPS URL' })
  @IsNotEmpty()
  endpoint: string;

  @ValidateNested()
  @Type(() => WebPushKeysDto)
  @IsNotEmpty()
  keys: WebPushKeysDto;

  @IsString()
  @IsNotEmpty()
  deviceInstallationId: string;

  @IsEnum(WEB_PUSH_PLATFORM)
  platform: WebPushPlatform;

  @IsOptional()
  @IsString()
  browser?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsObject()
  categoryPreferences?: CategoryPreferencesDto;
}

export class UpdatePreferencesDto {
  @IsString()
  @IsNotEmpty()
  deviceInstallationId: string;

  @IsObject()
  @IsNotEmpty()
  categoryPreferences: CategoryPreferencesDto;
}

export class RevokeSubscriptionDto {
  @IsOptional()
  @IsString()
  deviceInstallationId?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SendTestPushDto {
  @IsOptional()
  @IsString()
  deviceInstallationId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;
}

