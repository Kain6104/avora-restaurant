import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StockTransferItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Nguyên liệu là bắt buộc' })
  ingredientId: string;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsNumber()
  @Min(0.0001, { message: 'Số lượng yêu cầu chuyển phải lớn hơn 0' })
  requestedQuantity: number;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị tính là bắt buộc' })
  unitSymbol: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateStockTransferDto {
  @IsString()
  @IsNotEmpty({ message: 'Chi nhánh xuất là bắt buộc' })
  fromBranchId: string;

  @IsString()
  @IsNotEmpty({ message: 'Kho xuất là bắt buộc' })
  fromWarehouseId: string;

  @IsString()
  @IsNotEmpty({ message: 'Chi nhánh nhận là bắt buộc' })
  toBranchId: string;

  @IsString()
  @IsNotEmpty({ message: 'Kho nhận là bắt buộc' })
  toWarehouseId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferItemDto)
  items: StockTransferItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class DispatchStockTransferDto {
  @IsArray()
  @IsOptional()
  dispatchedItems?: {
    transferItemId: string;
    dispatchedQuantity: number;
    batchId?: string;
  }[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReceiveStockTransferDto {
  @IsArray()
  receivedItems: {
    transferItemId: string;
    receivedQuantity: number;
    notes?: string;
  }[];

  @IsString()
  @IsOptional()
  notes?: string;
}

