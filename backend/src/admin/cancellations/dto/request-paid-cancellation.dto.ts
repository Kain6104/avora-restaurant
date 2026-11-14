import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class RequestPaidCancellationDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã lý do hủy là bắt buộc' })
  reasonCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Giải thích chi tiết là bắt buộc đối với hủy hóa đơn đã thanh toán' })
  explanation: string;

  @IsNumber()
  @Min(0, { message: 'Số tiền đề xuất hoàn không được âm' })
  requestedRefundAmount: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  retainedAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  taxInvoiceNotes?: string;
}

