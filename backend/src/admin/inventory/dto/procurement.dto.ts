import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã nhà cung cấp là bắt buộc' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên nhà cung cấp là bắt buộc' })
  name: string;

  @IsString()
  @IsOptional()
  contactPerson?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  taxCode?: string;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @IsString()
  @IsOptional()
  bankAccountHolder?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class PurchaseRequestItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Nguyên liệu là bắt buộc' })
  ingredientId: string;

  @IsNumber()
  @Min(0.0001, { message: 'Số lượng yêu cầu phải lớn hơn 0' })
  requestedQuantity: number;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị tính là bắt buộc' })
  unitSymbol: string;

  @IsNumber()
  @IsOptional()
  estimatedCost?: number;
}

export class CreatePurchaseRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Chi nhánh là bắt buộc' })
  branchId: string;

  @IsString()
  @IsNotEmpty({ message: 'Kho nhận hàng là bắt buộc' })
  warehouseId: string;

  @IsDateString()
  @IsNotEmpty({ message: 'Ngày cần hàng là bắt buộc' })
  requiredDate: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestItemDto)
  items: PurchaseRequestItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class PurchaseOrderItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Nguyên liệu là bắt buộc' })
  ingredientId: string;

  @IsNumber()
  @Min(0.0001, { message: 'Số lượng đặt phải lớn hơn 0' })
  orderQuantity: number;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị tính là bắt buộc' })
  unitSymbol: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @IsOptional()
  taxPercent?: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Nhà cung cấp là bắt buộc' })
  supplierId: string;

  @IsString()
  @IsNotEmpty({ message: 'Chi nhánh là bắt buộc' })
  branchId: string;

  @IsString()
  @IsNotEmpty({ message: 'Kho nhận hàng là bắt buộc' })
  warehouseId: string;

  @IsString()
  @IsOptional()
  purchaseRequestId?: string;

  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class GoodsReceiptItemDto {
  @IsString()
  @IsOptional()
  purchaseOrderItemId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Nguyên liệu là bắt buộc' })
  ingredientId: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @IsNumber()
  @Min(0)
  receivedQuantity: number;

  @IsNumber()
  @IsOptional()
  rejectedQuantity?: number;

  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị tính là bắt buộc' })
  unitSymbol: string;

  @IsNumber()
  @Min(0)
  unitCost: number;

  @IsString()
  @IsOptional()
  storageLocation?: string;
}

export class CreateGoodsReceiptDto {
  @IsString()
  @IsOptional()
  purchaseOrderId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Chi nhánh là bắt buộc' })
  branchId: string;

  @IsString()
  @IsNotEmpty({ message: 'Kho nhận hàng là bắt buộc' })
  warehouseId: string;

  @IsString()
  @IsOptional()
  supplierInvoiceNumber?: string;

  @IsString()
  @IsOptional()
  deliveryNoteNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptItemDto)
  items: GoodsReceiptItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

