import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateServiceRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'deviceSessionId là bắt buộc' })
  deviceSessionId: string;

  @IsString()
  @IsIn(['CALL_STAFF', 'PAYMENT', 'OTHER'], { message: 'Loại yêu cầu không hợp lệ' })
  requestType: 'CALL_STAFF' | 'PAYMENT' | 'OTHER';

  @IsOptional()
  @IsString()
  paymentMethodCode?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
