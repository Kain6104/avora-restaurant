import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class HeartbeatDto {
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @IsOptional()
  @IsNumber()
  batteryLevel?: number;

  @IsOptional()
  @IsBoolean()
  isCharging?: boolean;

  @IsOptional()
  @IsNumber()
  pendingQueueCount?: number;

  @IsOptional()
  @IsBoolean()
  listenerActive?: boolean;

  @IsOptional()
  @IsString()
  networkType?: string;

  @IsOptional()
  @IsBoolean()
  isNotificationAccessGranted?: boolean;

  @IsOptional()
  @IsBoolean()
  isPowerSaveMode?: boolean;

  @IsOptional()
  @IsBoolean()
  isIgnoringBatteryOptimizations?: boolean;

  @IsOptional()
  @IsString()
  appVersion?: string;
}

export class RevokeDeviceDto {
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ManualMatchDto {
  @IsNotEmpty({ message: 'Order ID không được để trống' })
  @IsString()
  orderId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateScanRequestDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;
}

export class ScanReportDto {
  @IsNotEmpty()
  @IsString()
  scanJobId: string;

  @IsNotEmpty()
  @IsString()
  status: string;

  @IsOptional()
  @IsNumber()
  activeNotificationsCount?: number;

  @IsOptional()
  @IsNumber()
  newTransactionsCount?: number;

  @IsOptional()
  @IsString()
  resultMessage?: string;
}

export class ConfirmRefundDto {
  @IsNotEmpty({ message: 'Mã tham chiếu chuyển khoản hoàn tiền không được để trống' })
  @IsString()
  refundBankReference: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

