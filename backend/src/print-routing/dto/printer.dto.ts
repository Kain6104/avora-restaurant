import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsEnum, Min } from 'class-validator';
import { PrinterConnectionType, PrinterPayloadType, PrinterStatus } from '@prisma/client';

export class CreatePrinterDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(PrinterConnectionType)
  @IsOptional()
  connectionType?: PrinterConnectionType;

  @IsEnum(PrinterPayloadType)
  @IsOptional()
  payloadType?: PrinterPayloadType;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  port?: number;

  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  paperSize?: string;

  @IsInt()
  @IsOptional()
  labelWidthMm?: number;

  @IsInt()
  @IsOptional()
  labelHeightMm?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePrinterDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(PrinterConnectionType)
  @IsOptional()
  connectionType?: PrinterConnectionType;

  @IsEnum(PrinterPayloadType)
  @IsOptional()
  payloadType?: PrinterPayloadType;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  port?: number;

  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  paperSize?: string;

  @IsInt()
  @IsOptional()
  labelWidthMm?: number;

  @IsInt()
  @IsOptional()
  labelHeightMm?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(PrinterStatus)
  @IsOptional()
  status?: PrinterStatus;
}

export class AssignStationPrinterDto {
  @IsString()
  @IsNotEmpty()
  stationId: string;

  @IsString()
  @IsNotEmpty()
  printerId: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsString()
  @IsOptional()
  printPurpose?: string;
}
