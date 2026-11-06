import { IsNotEmpty, IsString, IsIn, IsNumber, IsOptional, IsISO8601 } from 'class-validator';

export class TransactionEventDto {
  @IsNotEmpty({ message: 'Event ID không được để trống' })
  @IsString()
  eventId: string;

  @IsNotEmpty({ message: 'Ngân hàng không được để trống' })
  @IsString()
  bank: string;

  @IsNotEmpty({ message: 'Số tài khoản không được để trống' })
  @IsString()
  accountNumber: string;

  @IsNotEmpty({ message: 'Chiều giao dịch không được để trống' })
  @IsIn(['CREDIT', 'DEBIT'], { message: 'Chiều giao dịch phải là CREDIT hoặc DEBIT' })
  direction: 'CREDIT' | 'DEBIT';

  @IsNotEmpty({ message: 'Số tiền không được để trống' })
  amount: number | string;

  @IsOptional()
  balanceAfter?: number | string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNotEmpty({ message: 'Thời gian giao dịch không được để trống' })
  occurredAt: string;

  @IsOptional()
  @IsString()
  counterparty?: string;

  @IsOptional()
  @IsString()
  transferContent?: string;

  @IsOptional()
  @IsString()
  bankReference?: string;

  @IsOptional()
  @IsString()
  rawNotification?: string;

  @IsOptional()
  @IsString()
  parserVersion?: string;
}

