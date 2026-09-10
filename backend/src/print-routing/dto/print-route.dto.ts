import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsEnum, Min } from 'class-validator';
import { PrintRouteRole, PrintTemplateType } from '@prisma/client';

export class CreateProductPrintRouteDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  stationId: string;

  @IsEnum(PrintRouteRole)
  @IsOptional()
  routeRole?: PrintRouteRole;

  @IsEnum(PrintTemplateType)
  @IsOptional()
  printType?: PrintTemplateType;

  @IsInt()
  @Min(1)
  @IsOptional()
  copies?: number;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProductPrintRouteDto {
  @IsString()
  @IsOptional()
  stationId?: string;

  @IsEnum(PrintRouteRole)
  @IsOptional()
  routeRole?: PrintRouteRole;

  @IsEnum(PrintTemplateType)
  @IsOptional()
  printType?: PrintTemplateType;

  @IsInt()
  @Min(1)
  @IsOptional()
  copies?: number;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class BulkSetProductPrintRoutesDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;

  routes: Array<{
    stationId: string;
    routeRole: PrintRouteRole;
    printType?: PrintTemplateType;
    copies?: number;
    priority?: number;
  }>;
}
