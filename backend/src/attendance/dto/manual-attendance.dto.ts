import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ManualActionDto {
  @IsNotEmpty({ message: 'attendanceId không được để trống' })
  @IsString()
  attendanceId: string;

  @IsNotEmpty({ message: 'actionType không được để trống (UPDATE hoặc DELETE)' })
  @IsString()
  actionType: 'UPDATE' | 'DELETE';

  @IsOptional()
  @IsString()
  checkIn?: string; // HH:mm

  @IsOptional()
  @IsString()
  checkOut?: string; // HH:mm

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsNotEmpty({ message: 'Lý do thao tác bắt buộc phải ghi rõ' })
  @IsString()
  reason: string;
}

export class ManualAddDto {
  @IsNotEmpty({ message: 'userId không được để trống' })
  @IsString()
  userId: string;

  @IsNotEmpty({ message: 'branchId không được để trống' })
  @IsString()
  branchId: string;

  @IsNotEmpty({ message: 'workDate không được để trống (YYYY-MM-DD)' })
  @IsString()
  workDate: string;

  @IsOptional()
  @IsString()
  checkIn?: string;

  @IsOptional()
  @IsString()
  checkOut?: string;

  @IsOptional()
  @IsBoolean()
  isSplit?: boolean;

  @IsOptional()
  @IsString()
  checkIn2?: string;

  @IsOptional()
  @IsString()
  checkOut2?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsNotEmpty({ message: 'Lý do thêm công bắt buộc phải ghi rõ' })
  @IsString()
  reason: string;
}

