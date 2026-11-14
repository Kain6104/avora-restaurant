import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { InventoryWasteReason } from '@prisma/client';

export class CreateInventoryWasteDto {
  @IsString()
  @IsNotEmpty({ message: 'Chi nhánh là bắt buộc' })
  branchId: string;

  @IsString()
  @IsNotEmpty({ message: 'Kho là bắt buộc' })
  warehouseId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nguyên liệu là bắt buộc' })
  ingredientId: string;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  orderItemId?: string;

  @IsNumber()
  @Min(0.0001, { message: 'Số lượng hao hụt phải lớn hơn 0' })
  quantity: number;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị tính là bắt buộc' })
  unitSymbol: string;

  @IsEnum(InventoryWasteReason, { message: 'Lý do hao hụt không hợp lệ' })
  reason: InventoryWasteReason;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString()
  @IsOptional()
  evidenceImageUrl?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReviewInventoryWasteDto {
  @IsNotEmpty()
  approved: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

