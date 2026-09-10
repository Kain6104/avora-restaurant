import { IsOptional, IsString, IsInt, Min, Max, Matches, IsEnum, IsArray } from 'class-validator';
import { ReservationStatus } from '@prisma/client';

export class UpdateReservationCustomerDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Định dạng ngày phải là YYYY-MM-DD' })
  reservationDate?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Định dạng giờ phải là HH:mm' })
  reservationTime?: string;

  @IsOptional()
  @IsInt({ message: 'Số lượng khách phải là số nguyên' })
  @Min(1, { message: 'Số lượng khách tối thiểu là 1' })
  @Max(50, { message: 'Số lượng khách tối đa là 50' })
  partySize?: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsString()
  seatingPreference?: string;
}

export class CancelReservationDto {
  @IsOptional()
  @IsString()
  cancelReason?: string;
}

export class AdminUpdateReservationDto {
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tableIds?: string[];

  @IsOptional()
  @IsString()
  internalNote?: string;

  @IsOptional()
  @IsString()
  cancelReason?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Định dạng ngày phải là YYYY-MM-DD' })
  reservationDate?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Định dạng giờ phải là HH:mm' })
  reservationTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  partySize?: number;
}
