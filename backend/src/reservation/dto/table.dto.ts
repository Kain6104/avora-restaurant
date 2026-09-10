import { IsNotEmpty, IsString, IsInt, Min, Max, IsOptional, IsBoolean, IsEnum, Matches } from 'class-validator';
import { TableOperationalStatus } from '@prisma/client';

export class CreateAreaDto {
  @IsNotEmpty()
  @IsString()
  branchId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateTableDto {
  @IsNotEmpty()
  @IsString()
  branchId: string;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsNotEmpty()
  @IsString()
  tableCode: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minCapacity?: number;

  @IsOptional()
  @IsEnum(TableOperationalStatus)
  status?: TableOperationalStatus;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsString()
  tableCode?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minCapacity?: number;

  @IsOptional()
  @IsEnum(TableOperationalStatus)
  status?: TableOperationalStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateReservationBlockDto {
  @IsNotEmpty()
  @IsString()
  branchId: string;

  @IsNotEmpty()
  @IsString()
  startAt: string; // ISO string

  @IsNotEmpty()
  @IsString()
  endAt: string; // ISO string

  @IsOptional()
  @IsString()
  blockType?: 'FULL_BLOCK' | 'CAPACITY_BLOCK';

  @IsOptional()
  @IsInt()
  blockedCapacity?: number;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class CreateSpecialHoursDto {
  @IsNotEmpty()
  @IsString()
  branchId: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  openTime?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  closeTime?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
