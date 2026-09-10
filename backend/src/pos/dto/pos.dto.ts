import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
  IsBoolean,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { KitchenStatus, SlotOrderType } from '@prisma/client';

export class PosOrderItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsString()
  discountReason?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  @IsOptional()
  @IsString()
  pricingMode?: 'REGULAR' | 'BUFFET_TICKET' | 'BUFFET_INCLUDED';

  @IsOptional()
  @IsString()
  buffetSessionId?: string;

  @IsOptional()
  @IsString()
  buffetPackageId?: string;

  @IsOptional()
  @IsString()
  buffetPackageNameSnapshot?: string;

  @IsOptional()
  @IsString()
  source?: 'POS' | 'WAITER' | 'QR_ORDER' | 'ADMIN' | 'CHATBOT' | 'VOICE';
}

export class CreatePosOrderDto {
  @IsString()
  branchId: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  guestCount?: number = 1;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsString()
  discountReason?: string;

  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  @IsString()
  discountType?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsEnum(SlotOrderType)
  orderType?: SlotOrderType = SlotOrderType.DINE_IN;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  items: PosOrderItemDto[];
}

export class UpdatePosOrderDto {
  @IsOptional()
  @IsNumber()
  expectedVersion?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  guestCount?: number;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsString()
  discountReason?: string;

  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  @IsString()
  discountType?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsEnum(SlotOrderType)
  orderType?: SlotOrderType;

  @IsOptional()
  @IsBoolean()
  isInvoiceRequested?: boolean;

  @IsOptional()
  @IsString()
  invoiceTaxCode?: string;

  @IsOptional()
  @IsString()
  invoiceCompanyName?: string;

  @IsOptional()
  @IsString()
  invoiceAddress?: string;

  @IsOptional()
  @IsString()
  invoiceEmail?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  items?: PosOrderItemDto[];
}

export class SendKitchenDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}

export class HoldOrderDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class SplitOrderItemDto {
  @IsString()
  orderItemId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class SplitOrderDto {
  @IsString()
  sourceOrderId: string;

  @IsOptional()
  @IsString()
  targetTableId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitOrderItemDto)
  items: SplitOrderItemDto[];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class MergeOrderDto {
  @IsString()
  sourceOrderId: string;

  @IsString()
  targetOrderId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class MoveTableDto {
  @IsString()
  orderId: string;

  @IsString()
  targetTableId: string;
}

export class PosPaymentItemDto {
  @IsString()
  paymentMethod: string; // CASH, CARD, TRANSFER, PAYOS, MOMO, VNPAY, POINT

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsNumber()
  cashReceived?: number;

  @IsOptional()
  @IsNumber()
  cashChange?: number;

  @IsOptional()
  @IsString()
  cardType?: string;

  @IsOptional()
  @IsString()
  cardLast4?: string;

  @IsOptional()
  @IsString()
  transactionRef?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ProcessPaymentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosPaymentItemDto)
  payments: PosPaymentItemDto[];

  @IsOptional()
  @IsString()
  discountVoucherCode?: string;

  @IsOptional()
  @IsString()
  shippingVoucherCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsUsed?: number;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  cashShiftId?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsString()
  discountReason?: string;

  @IsOptional()
  @IsBoolean()
  isInvoiceRequested?: boolean;

  @IsOptional()
  @IsString()
  invoiceCompanyName?: string;

  @IsOptional()
  @IsString()
  invoiceTaxCode?: string;

  @IsOptional()
  @IsString()
  invoiceAddress?: string;

  @IsOptional()
  @IsString()
  invoiceEmail?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class CreateMemberDto {
  @IsString()
  fullName: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsOptional()
  @IsString()
  taxAddress?: string;

  @IsOptional()
  @IsString()
  invoiceEmail?: string;
}

export class RefundPaymentDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class OpenShiftDto {
  @IsNumber()
  @Min(0)
  openingBalance: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CloseShiftDto {
  @IsNumber()
  @Min(0)
  closingBalance: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateKitchenItemStatusDto {
  @IsEnum(KitchenStatus)
  status: KitchenStatus;
}

export class ToggleProductAvailabilityDto {
  @IsBoolean()
  available: boolean;

  @IsString()
  branchId: string;
}

export class TablePositionDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsString()
  shape?: string;
}

export class UpdateTableLayoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TablePositionDto)
  tables: TablePositionDto[];
}

export class CancelOrderDto {
  @IsString()
  reason: string;
}

export class ValidateVoucherDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(0)
  subTotal: number;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class CheckInReservationDto {
  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  guestCount?: number;
}

export class ConfirmPrintDto {
  @IsString()
  printJobId: string;

  @IsEnum(['SUCCESS', 'FAILED'])
  status: 'SUCCESS' | 'FAILED';

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class ReprintLabelItemDto {
  @IsString()
  orderItemId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class ReprintLabelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReprintLabelItemDto)
  items: ReprintLabelItemDto[];
}

export class ReprintKitchenDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orderItemIds?: string[];

  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AddServiceChargeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercentage?: number;
}

export class SendTableItemsDto {
  @IsString()
  branchId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  guestCount?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  items: PosOrderItemDto[];
}
