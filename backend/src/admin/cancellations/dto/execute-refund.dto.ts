import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsIn } from 'class-validator';

export class ExecuteRefundDto {
  @IsNumber()
  @Min(1, { message: 'Số tiền hoàn tối thiểu là 1 VNĐ' })
  amount: number;

  @IsString()
  @IsIn(['CASH', 'BANK_TRANSFER', 'CARD', 'EWALLET'], {
    message: 'Phương thức hoàn tiền phải là CASH, BANK_TRANSFER, CARD, hoặc EWALLET',
  })
  refundMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'EWALLET';

  @IsString()
  @IsOptional()
  orderPaymentId?: string;

  @IsString()
  @IsOptional()
  shiftId?: string;

  @IsString()
  @IsOptional()
  bankReference?: string;

  @IsString()
  @IsOptional()
  bankDestination?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

