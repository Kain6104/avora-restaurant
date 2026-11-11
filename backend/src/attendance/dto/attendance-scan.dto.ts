import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AttendanceScanDto {
  @IsNotEmpty({ message: 'Dữ liệu mã QR không được để trống' })
  @IsString()
  qrCodeData: string;

  @IsNumber({}, { message: 'Tọa độ vĩ độ (latitude) không hợp lệ' })
  latitude: number;

  @IsNumber({}, { message: 'Tọa độ kinh độ (longitude) không hợp lệ' })
  longitude: number;

  @IsNumber({}, { message: 'Độ chính xác GPS (accuracy) không hợp lệ' })
  accuracy: number;

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

