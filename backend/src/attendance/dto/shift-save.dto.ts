import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ShiftSaveDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsNotEmpty({ message: 'Ngày làm việc không được để trống' })
  @IsString()
  shiftDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsNotEmpty({ message: 'Tên ca không được để trống' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Giờ bắt đầu không được để trống' })
  @IsString()
  startTime: string; // HH:mm

  @IsNotEmpty({ message: 'Giờ kết thúc không được để trống' })
  @IsString()
  endTime: string; // HH:mm

  @IsOptional()
  @IsNumber()
  gracePeriodMins?: number;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isSplitShift?: boolean;

  @IsOptional()
  @IsString()
  startTime2?: string;

  @IsOptional()
  @IsString()
  endTime2?: string;

  @IsOptional()
  @IsArray()
  assignedUserIds?: string[];
}

