import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RequiredCropItemDto {
  @IsString()
  cropCode: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateLevelConfigDto {
  @IsInt()
  @Min(1)
  level: number;

  @IsInt()
  @Min(0)
  expRequired: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  coinCost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  pointCost?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RequiredCropItemDto)
  requiredCrops?: RequiredCropItemDto[];

  @IsNumber()
  @IsOptional()
  speedBoost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  energyBonus?: number;

  @IsNumber()
  @IsOptional()
  sellPriceBoost?: number;

  @IsString()
  @IsOptional()
  unlockTitle?: string;
}

export class UpdateLevelConfigDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  expRequired?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  coinCost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  pointCost?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RequiredCropItemDto)
  requiredCrops?: RequiredCropItemDto[];

  @IsNumber()
  @IsOptional()
  speedBoost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  energyBonus?: number;

  @IsNumber()
  @IsOptional()
  sellPriceBoost?: number;

  @IsString()
  @IsOptional()
  unlockTitle?: string;
}

export class PlotUnlockConditionsDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  requiredLevel?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  requiredCoins?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  requiredPoints?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RequiredCropItemDto)
  requiredCrops?: RequiredCropItemDto[];
}
