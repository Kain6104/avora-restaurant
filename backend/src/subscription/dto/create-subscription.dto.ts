import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsArray, IsEnum, IsNumber } from 'class-validator';
import { SubscriptionMealSlot } from '@prisma/client';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsEnum(SubscriptionMealSlot)
  @IsOptional()
  mealSlot?: SubscriptionMealSlot;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsNotEmpty()
  recipientName: string;

  @IsString()
  @IsNotEmpty()
  recipientPhone: string;

  @IsString()
  @IsNotEmpty()
  deliveryAddress: string;

  @IsNumber()
  @IsOptional()
  deliveryLatitude?: number;

  @IsNumber()
  @IsOptional()
  deliveryLongitude?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  deliveryTimeSlot?: string; // e.g. "11:30"

  @IsString()
  @IsOptional()
  deliveryNote?: string;

  @IsBoolean()
  @IsOptional()
  isAutoSurprise?: boolean;

  @IsArray()
  @IsOptional()
  dietaryPreferences?: string[]; // e.g. ["EAT_CLEAN", "NO_PORK"]

  @IsArray()
  @IsOptional()
  dislikedIngredientIds?: string[];

  @IsString()
  @IsOptional()
  startDate?: string; // ISO date string, defaults to tomorrow
}

export class PauseSkipScheduleDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ChooseScheduleDishDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  customRecipeId?: string;
}

