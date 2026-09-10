import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt } from 'class-validator';
import { PrintJobStatus } from '@prisma/client';

export class ReprintJobDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class QueryPrintJobsDto {
  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  printerId?: string;

  @IsString()
  @IsOptional()
  stationId?: string;

  @IsEnum(PrintJobStatus)
  @IsOptional()
  status?: PrintJobStatus;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
