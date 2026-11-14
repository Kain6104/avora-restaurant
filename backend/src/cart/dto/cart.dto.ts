import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsArray, Min } from 'class-validator';

export class SelectedOptionDto {
  @IsString()
  @IsNotEmpty()
  optionItemId: string;

  @IsOptional()
  @IsString()
  nameAtSale?: string;

  @IsOptional()
  @IsNumber()
  priceAdjustmentAtSale?: number;
}

export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  priceAtSale?: number;

  @IsOptional()
  @IsNumber()
  originalPriceAtSale?: number;

  @IsOptional()
  @IsArray()
  selectedOptions?: SelectedOptionDto[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isFlashSaleItem?: boolean;

  @IsOptional()
  @IsString()
  flashSaleId?: string;

  @IsOptional()
  @IsBoolean()
  isCombo?: boolean;

  @IsOptional()
  @IsString()
  comboId?: string;

  @IsOptional()
  @IsBoolean()
  isCustomRecipe?: boolean;

  @IsOptional()
  customRecipeData?: any;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class UpdateCartItemDto {
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsArray()
  selectedOptions?: SelectedOptionDto[];

  @IsOptional()
  @IsString()
  note?: string;
}

export class SwitchBranchDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;
}

export class ReplaceCartItemDto {
  @IsString()
  @IsNotEmpty()
  oldItemId: string;

  @IsString()
  @IsNotEmpty()
  newProductId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsArray()
  selectedOptions?: SelectedOptionDto[];

  @IsOptional()
  @IsString()
  note?: string;
}

export class MergeGuestCartDto {
  @IsString()
  @IsNotEmpty()
  guestToken: string;
}

export class SyncCartItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  priceAtSale?: number;

  @IsOptional()
  @IsNumber()
  originalPriceAtSale?: number;

  @IsOptional()
  @IsArray()
  selectedOptions?: SelectedOptionDto[];

  @IsOptional()
  @IsString()
  optionsTextSnapshot?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isFlashSaleItem?: boolean;

  @IsOptional()
  @IsString()
  flashSaleId?: string;

  @IsOptional()
  @IsBoolean()
  isCombo?: boolean;

  @IsOptional()
  @IsString()
  comboId?: string;

  @IsOptional()
  @IsBoolean()
  isCustomRecipe?: boolean;

  @IsOptional()
  customRecipeData?: any;
}

export class SyncCartDto {
  @IsArray()
  items: SyncCartItemDto[];

  @IsOptional()
  @IsString()
  branchId?: string;
}


