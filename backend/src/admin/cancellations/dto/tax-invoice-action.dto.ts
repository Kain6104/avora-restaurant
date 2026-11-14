import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class TaxInvoiceActionDto {
  @IsString()
  @IsIn(['CANCEL', 'ADJUST', 'REPLACE'], {
    message: 'Hành động hóa đơn điện tử phải là CANCEL, ADJUST, hoặc REPLACE',
  })
  action: 'CANCEL' | 'ADJUST' | 'REPLACE';

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsString()
  @IsOptional()
  invoiceSeries?: string;

  @IsString()
  @IsOptional()
  taxCode?: string;

  @IsString()
  @IsOptional()
  providerRef?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

