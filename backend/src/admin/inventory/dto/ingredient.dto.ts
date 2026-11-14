import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  IsEnum,
} from 'class-validator';
import { StorageCondition } from '@prisma/client';

export class CreateIngredientCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã danh mục nguyên liệu là bắt buộc' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục nguyên liệu là bắt buộc' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsNumber()
  @IsOptional()
  displayOrder?: number;
}

export class CreateIngredientUnitDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên đơn vị là bắt buộc' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Ký hiệu đơn vị là bắt buộc' })
  symbol: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isBaseUnit?: boolean;
}

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã nguyên liệu là bắt buộc' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên nguyên liệu là bắt buộc' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsNotEmpty({ message: 'Danh mục nguyên liệu là bắt buộc' })
  categoryId: string;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị cơ sở (Primary Unit) là bắt buộc' })
  primaryUnitId: string;

  @IsString()
  @IsOptional()
  purchaseUnitId?: string;

  @IsString()
  @IsOptional()
  storageUnitId?: string;

  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  purchaseToPrimaryFactor?: number;

  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  storageToPrimaryFactor?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minimumStock?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  maximumStock?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  reorderThreshold?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  averagePurchaseCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  latestPurchaseCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  costPerPrimaryUnit?: number;

  @IsString()
  @IsOptional()
  defaultSupplierId?: string;

  @IsEnum(StorageCondition)
  @IsOptional()
  storageCondition?: StorageCondition;

  @IsNumber()
  @IsOptional()
  shelfLifeDays?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateIngredientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  purchaseUnitId?: string;

  @IsString()
  @IsOptional()
  storageUnitId?: string;

  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  purchaseToPrimaryFactor?: number;

  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  storageToPrimaryFactor?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minimumStock?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  maximumStock?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  reorderThreshold?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  averagePurchaseCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  latestPurchaseCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  costPerPrimaryUnit?: number;

  @IsString()
  @IsOptional()
  defaultSupplierId?: string;

  @IsEnum(StorageCondition)
  @IsOptional()
  storageCondition?: StorageCondition;

  @IsNumber()
  @IsOptional()
  shelfLifeDays?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateUnitConversionDto {
  @IsString()
  @IsNotEmpty({ message: 'Nguyên liệu là bắt buộc' })
  ingredientId: string;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị gốc là bắt buộc' })
  fromUnitId: string;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị đích là bắt buộc' })
  toUnitId: string;

  @IsNumber()
  @Min(0.000001, { message: 'Tỷ lệ quy đổi phải lớn hơn 0' })
  conversionFactor: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

