import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AttendanceScanDto {
  @IsOptional()
  @IsString()
  qrCodeData?: string;

  @IsOptional()
  @IsString()
  qrData?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Tọa độ vĩ độ (latitude) không hợp lệ' })
  latitude?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Tọa độ kinh độ (longitude) không hợp lệ' })
  longitude?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Độ chính xác GPS (accuracy) không hợp lệ' })
  accuracy?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Độ chính xác GPS (gpsAccuracy) không hợp lệ' })
  gpsAccuracy?: number;

  @IsOptional()
  @IsString()
  scanType?: 'AUTO' | 'CHECK_IN' | 'CHECK_OUT';

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

