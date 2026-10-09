import { IsString, IsNotEmpty, IsOptional, IsInt, IsNumber, Min, Max, IsBoolean, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { FarmRarity } from '@prisma/client';

export class OpenLuckyEnvelopeDto {
  @IsOptional()
  @IsString()
  clientRequestId?: string;
}

export class UpdateLuckyEnvelopeConfigDto {
  @IsOptional()
  @IsBoolean()
  isEventActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxVisibleEnvelopes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  ticketsPerMission?: number;

  @IsOptional()
  @IsBoolean()
  allowExistingTicketsToOpen?: boolean;
}

export class CreateLuckyEnvelopeRewardDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  rewardType: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsInt()
  @Min(1)
  minAmount: number;

  @IsInt()
  @Min(1)
  maxAmount: number;

  @IsEnum(FarmRarity)
  rarity: FarmRarity;

  @IsNumber()
  @Min(0.00001)
  @Max(100000)
  weight: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  globalStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  perUserLimit?: number;

  @IsOptional()
  startDate?: Date;

  @IsOptional()
  endDate?: Date;
}

export class UpdateLuckyEnvelopeRewardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  rewardType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  minAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAmount?: number;

  @IsOptional()
  @IsEnum(FarmRarity)
  rarity?: FarmRarity;

  @IsOptional()
  @IsNumber()
  @Min(0.00001)
  @Max(100000)
  weight?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  globalStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  perUserLimit?: number;

  @IsOptional()
  startDate?: Date;

  @IsOptional()
  endDate?: Date;
}

export class LuckyEnvelopeHistoryQueryDto {
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
  limit?: number = 20;

  @IsOptional()
  @IsString()
  rarity?: FarmRarity;

  @IsOptional()
  @IsString()
  rewardType?: string;
}
