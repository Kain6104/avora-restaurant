import { IsInt, IsNotEmpty, IsOptional, IsString, Min, Max, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { FarmCropCategory, FarmRarity, FarmMutationType, FarmRewardCategory } from '@prisma/client';

export class PlantCropDto {
  @IsInt()
  @Min(0)
  @Max(24)
  plotIndex: number;

  @IsString()
  @IsNotEmpty()
  cropCode: string;
}

export class WaterPlotDto {
  @IsInt()
  @Min(0)
  @Max(24)
  plotIndex: number;
}

export class PlantMysteryPackDto {
  @IsInt()
  @Min(0)
  @Max(24)
  plotIndex: number;

  @IsOptional()
  @IsString()
  packCode?: string;
}

export class WaterBatchDto {
  @IsNotEmpty()
  plotIndexes: number[];
}

export class FertilizePlotDto {
  @IsInt()
  @Min(0)
  @Max(24)
  plotIndex: number;

  @IsOptional()
  @IsString()
  fertilizerCode?: string;

  @IsOptional()
  @IsString()
  fertilizerType?: string;
}

export class UnlockPlotDto {
  @IsInt()
  @Min(0)
  @Max(24)
  plotIndex: number;
}

export class HarvestPlotDto {
  @IsInt()
  @Min(0)
  @Max(24)
  plotIndex: number;
}

export class UprootPlotDto {
  @IsInt()
  @Min(0)
  @Max(24)
  plotIndex: number;
}

export class ShopPurchaseDto {
  @IsString()
  @IsNotEmpty()
  itemCode: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number = 1;
}

export class RedeemRewardDto {
  @IsOptional()
  @IsString()
  rewardCode?: string;

  @IsOptional()
  @IsString()
  rewardId?: string;
}

export class FriendActionDto {
  @IsString()
  @IsNotEmpty()
  friendUserId: string;

  @IsInt()
  @Min(0)
  @Max(24)
  plotIndex: number;
}

export class CreateAdminCropDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(FarmCropCategory)
  category: FarmCropCategory;

  @IsEnum(FarmRarity)
  rarity: FarmRarity;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsString()
  spriteAtlasKey?: string;

  @IsInt()
  @Min(10)
  growDuration: number; // in seconds

  @IsInt()
  @Min(0)
  seedPrice: number;

  @IsInt()
  @Min(0)
  sellPrice: number;

  @IsInt()
  @Min(1)
  baseYield: number = 4;

  @IsInt()
  @Min(0)
  rewardExp: number = 20;

  @IsInt()
  @Min(0)
  rewardFarmCoin: number = 15;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardLoyaltyPoints: number = 0;

  @IsNumber()
  @Min(0)
  @Max(1)
  baseMutationRate: number = 0.05;

  @IsInt()
  @Min(1)
  minFarmLevel: number = 1;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean = true;
}

export class CreateAdminMutationDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  sourceCropId: string;

  @IsEnum(FarmMutationType)
  mutationType: FarmMutationType;

  @IsEnum(FarmRarity)
  rarity: FarmRarity;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  spriteKey?: string;

  @IsOptional()
  @IsString()
  colorHex?: string;

  @IsOptional()
  @IsString()
  glowEffect?: string;

  @IsOptional()
  @IsString()
  particleEffect?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  mutationChance: number = 0.1;

  @IsNumber()
  @Min(1)
  yieldMultiplier: number = 1.5;

  @IsInt()
  @Min(0)
  rewardExp: number = 60;

  @IsInt()
  @Min(0)
  rewardFarmCoin: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardLoyaltyPoints: number = 1;
}

export class CreateAdminRewardDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsEnum(FarmRewardCategory)
  category: FarmRewardCategory;

  @IsOptional()
  @IsString()
  voucherId?: string;

  @IsInt()
  @Min(0)
  costFarmCoin: number = 0;

  @IsInt()
  @Min(0)
  costLoyaltyPoints: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  stock?: number;

  @IsInt()
  @Min(1)
  limitPerUser: number = 1;

  @IsInt()
  @Min(1)
  minFarmLevel: number = 1;

  @IsOptional()
  @IsString()
  requiredTierId?: string;
}

export class ManualLevelUpDto {}

export class AddFriendDto {
  @IsString()
  @IsNotEmpty()
  friendUserId: string;
}

export class OpenMysteryPackDto {
  @IsString()
  @IsNotEmpty()
  packCode: string;
}

export class ExchangeCropRewardDto {
  @IsString()
  @IsNotEmpty()
  exchangeCode: string;
}

export class FriendRespondDto {
  @IsString()
  @IsNotEmpty()
  requesterUserId: string;
}

export class ExchangePointsDto {
  @IsInt()
  @Min(1)
  coinsAmount: number;
}

export class CreateAdminMissionDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  type: string; // DAILY, LIFETIME

  @IsString()
  @IsNotEmpty()
  actionType: string; // PLANT, WATER, HARVEST, DISCOVER_MUTATION, HELP_FRIEND, ORDER_COMPLETED

  @IsInt()
  @Min(1)
  targetCount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardExp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardFarmCoin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardLoyaltyPoints?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FarmConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  strangerDailyStealLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  friendDailyStealLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  protectionWindowMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  coinsToPointsRatio?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxEnergy?: number;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;
}

export class GetPlantDetailQueryDto {
  @IsNotEmpty()
  @IsString()
  cropCode: string;

  @IsOptional()
  @IsString()
  mutationCode?: string;
}

export class PlantDetailResponseDto {
  cropId: string;
  cropCode: string;
  cropName: string;
  mutationId?: string | null;
  mutationCode?: string | null;
  mutationName?: string | null;
  isMutation: boolean;
  rarity: string;
  description: string;
  imageUrl?: string | null;
  growDurationSeconds: number;
  growDurationLabel: string;
  effectiveSellPrice: number;
  harvestCount: number;
  inventoryQuantity: number;
  isUnlocked: boolean;
  mutationChance?: number | null;
  unlockLevel: number;
}

