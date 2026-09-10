import { IsNotEmpty, IsString, Matches, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AvailabilityQueryDto {
  @IsNotEmpty({ message: 'Vui lòng cung cấp branchId' })
  @IsString()
  branchId: string;

  @IsNotEmpty({ message: 'Vui lòng cung cấp ngày cần kiểm tra (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Định dạng ngày phải là YYYY-MM-DD' })
  date: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  partySize?: number = 2;
}

export class GuestLookupDto {
  @IsNotEmpty({ message: 'Vui lòng nhập mã đặt bàn' })
  @IsString()
  reservationCode: string;

  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại đặt bàn' })
  @IsString()
  phone: string;
}

export class CheckInTokenDto {
  @IsNotEmpty({ message: 'Vui lòng cung cấp mã checkInToken' })
  @IsString()
  token: string;
}
