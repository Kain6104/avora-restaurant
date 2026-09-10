import { IsNotEmpty, IsString, IsInt, Min, Max, IsOptional, IsEmail, Matches, IsEnum } from 'class-validator';
import { ReservationSource } from '@prisma/client';

export class CreateReservationDto {
  @IsNotEmpty({ message: 'Vui lòng chọn chi nhánh' })
  @IsString()
  branchId: string;

  @IsNotEmpty({ message: 'Vui lòng chọn ngày đặt bàn' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Định dạng ngày phải là YYYY-MM-DD' })
  reservationDate: string;

  @IsNotEmpty({ message: 'Vui lòng chọn giờ đặt bàn' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'Định dạng giờ phải là HH:mm' })
  reservationTime: string;

  @IsNotEmpty({ message: 'Vui lòng nhập số lượng khách' })
  @IsInt({ message: 'Số lượng khách phải là số nguyên' })
  @Min(1, { message: 'Số lượng khách tối thiểu là 1' })
  @Max(50, { message: 'Số lượng khách tối đa là 50' })
  partySize: number;

  @IsNotEmpty({ message: 'Vui lòng nhập tên người đặt' })
  @IsString()
  customerName: string;

  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại liên hệ' })
  @IsString()
  customerPhone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  customerEmail?: string;

  @IsOptional()
  @IsString()
  occasion?: string;

  @IsOptional()
  @IsString()
  seatingPreference?: string;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsEnum(ReservationSource)
  source?: ReservationSource;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
