import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã kho là bắt buộc' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên kho là bắt buộc' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  storageZone?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsBoolean()
  @IsOptional()
  isCentral?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateWarehouseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  storageZone?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsBoolean()
  @IsOptional()
  isCentral?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateWarehouseLocationDto {
  @IsString()
  @IsNotEmpty({ message: 'Kho hàng là bắt buộc' })
  warehouseId: string;

  @IsString()
  @IsNotEmpty({ message: 'Khu vực (Zone) là bắt buộc' })
  zone: string;

  @IsString()
  @IsOptional()
  aisle?: string;

  @IsString()
  @IsOptional()
  shelf?: string;

  @IsString()
  @IsOptional()
  bin?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

