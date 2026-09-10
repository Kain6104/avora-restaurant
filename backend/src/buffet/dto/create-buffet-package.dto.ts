import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BuffetPackageItemInputDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsInt()
  maxQuantityPerRound?: number;

  @IsOptional()
  @IsBoolean()
  availableForQr?: boolean;

  @IsOptional()
  @IsBoolean()
  allowRetailPurchase?: boolean;
}

export class CreateBuffetPackageDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Gói Buffet bắt buộc phải có ít nhất 1 món đại diện/vé tính tiền' })
  @IsString({ each: true })
  ticketProductIds: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuffetPackageItemInputDto)
  items?: BuffetPackageItemInputDto[];
}
