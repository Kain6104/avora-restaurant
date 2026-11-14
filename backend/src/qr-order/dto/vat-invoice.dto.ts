import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class RequestQrVatInvoiceDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã số thuế (MST)' })
  taxCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên công ty / đơn vị' })
  companyName: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ xuất hóa đơn' })
  address: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email nhận hóa đơn không hợp lệ' })
  email?: string;

  @IsOptional()
  @IsString()
  deviceSessionId?: string;
}

