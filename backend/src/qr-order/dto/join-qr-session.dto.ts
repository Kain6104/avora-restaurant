import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class JoinQrSessionDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên của bạn là bắt buộc' })
  guestName: string;

  @IsString()
  @IsNotEmpty({ message: 'deviceSessionId là bắt buộc' })
  deviceSessionId: string;

  @IsOptional()
  @IsString()
  memberIdentifier?: string;
}
