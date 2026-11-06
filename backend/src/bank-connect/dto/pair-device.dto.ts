import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class PairDeviceDto {
  @IsNotEmpty({ message: 'Mã pairing không được để trống' })
  @IsString()
  @MaxLength(32)
  pairingCode: string;

  @IsNotEmpty({ message: 'Device ID không được để trống' })
  @IsString()
  @MaxLength(128)
  deviceId: string;

  @IsNotEmpty({ message: 'Tên thiết bị không được để trống' })
  @IsString()
  @MaxLength(128)
  deviceName: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @IsNotEmpty({ message: 'Public Key PEM không được để trống' })
  @IsString()
  publicKeyPem: string;
}

