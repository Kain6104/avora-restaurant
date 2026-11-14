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

export class StocktakeItemCountDto {
  @IsString()
  @IsNotEmpty({ message: 'Nguyên liệu là bắt buộc' })
  ingredientId: string;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsNumber()
  @Min(0, { message: 'Số lượng đếm thực tế không được âm' })
  actualQuantity: number;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsString()
  @IsOptional()
  expirationDate?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  unitCost?: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateStocktakeDto {
  @IsString()
  @IsNotEmpty({ message: 'Kho kiểm kê là bắt buộc' })
  warehouseId: string;

  @IsString()
  @IsNotEmpty({ message: 'Chi nhánh là bắt buộc' })
  branchId: string;

  @IsBoolean()
  @IsOptional()
  isBlindCount?: boolean;

  @IsString()
  @IsOptional()
  stocktakeType?: 'CYCLE_COUNT' | 'OPENING_BALANCE';

  @IsBoolean()
  @IsOptional()
  includeAllIngredients?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SubmitStocktakeCountsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StocktakeItemCountDto)
  counts: StocktakeItemCountDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReviewStocktakeDto {
  @IsBoolean()
  approved: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

