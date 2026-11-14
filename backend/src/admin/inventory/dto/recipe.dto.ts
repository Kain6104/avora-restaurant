import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecipeIngredientDto {
  @IsString()
  @IsNotEmpty({ message: 'Nguyên liệu là bắt buộc' })
  ingredientId: string;

  @IsNumber()
  @Min(0.0001, { message: 'Định lượng nguyên liệu phải lớn hơn 0' })
  quantity: number;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị tính là bắt buộc' })
  unitSymbol: string;

  @IsNumber()
  @IsOptional()
  preparationLossPercent?: number;

  @IsBoolean()
  @IsOptional()
  isSubstitutable?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecipeOptionModifierDto {
  @IsString()
  @IsNotEmpty({ message: 'Tùy chọn món (OptionItem) là bắt buộc' })
  optionItemId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nguyên liệu thay đổi là bắt buộc' })
  ingredientId: string;

  @IsNumber()
  quantityDelta: number;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị tính là bắt buộc' })
  unitSymbol: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateRecipeDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã công thức là bắt buộc' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên công thức là bắt buộc' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsBoolean()
  @IsOptional()
  isSemiFinished?: boolean;

  @IsNumber()
  @IsOptional()
  servingSize?: number;

  @IsNumber()
  @IsOptional()
  yieldQuantity?: number;

  @IsString()
  @IsOptional()
  yieldUnit?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RecipeOptionModifierDto)
  optionModifiers?: RecipeOptionModifierDto[];

  @IsNumber()
  @IsOptional()
  preparationLossPercent?: number;

  @IsString()
  @IsOptional()
  effectiveDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateRecipeVersionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RecipeOptionModifierDto)
  optionModifiers?: RecipeOptionModifierDto[];

  @IsNumber()
  @IsOptional()
  preparationLossPercent?: number;

  @IsString()
  @IsOptional()
  effectiveDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecipeWorkflowDecisionDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ClassifyNonInventoryModifiersDto {
  @IsArray()
  @IsString({ each: true })
  optionItemIds: string[];

  @IsBoolean()
  isNonInventory: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}

export type ModifierClassificationType =
  | 'PHYSICAL_INGREDIENT_DELTA'
  | 'NON_INVENTORY_MODIFIER'
  | 'REQUIRES_CHEF_REVIEW'
  | 'INVALID_CATALOG_ASSIGNMENT';

export class BulkClassifyModifiersDto {
  @IsArray()
  @IsString({ each: true })
  optionItemIds: string[];

  @IsString()
  @IsNotEmpty()
  classification: ModifierClassificationType;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  ingredientId?: string;

  @IsNumber()
  @IsOptional()
  quantityDelta?: number;

  @IsString()
  @IsOptional()
  unitSymbol?: string;
}

export class ImportRecipeRowDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  productCode?: string;

  @IsString()
  @IsOptional()
  productName?: string;

  @IsString()
  @IsOptional()
  ingredientId?: string;

  @IsString()
  @IsOptional()
  ingredientCode?: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  unitSymbol?: string;

  @IsNumber()
  @IsOptional()
  preparationLossPercent?: number;

  @IsNumber()
  @IsOptional()
  yieldQuantity?: number;

  @IsString()
  @IsOptional()
  preparationNotes?: string;

  @IsString()
  @IsOptional()
  chefName?: string;
}

export class RecipeImportRequestDto {
  @IsString()
  @IsOptional()
  csvContent?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ImportRecipeRowDto)
  rows?: ImportRecipeRowDto[];

  @IsBoolean()
  @IsOptional()
  createDraftRevisionIfApproved?: boolean;
}

