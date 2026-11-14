import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  ValidateIf,
  Min,
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
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsInt({ message: 'Giới hạn số lượng món mỗi lần gọi phải là số nguyên dương' })
  @Min(1, { message: 'Giới hạn số lượng món mỗi lần gọi tối thiểu phải từ 1' })
  maxQuantityPerRound?: number | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsInt({ message: 'Tổng giới hạn số lượng món trong cả bữa phải là số nguyên dương' })
  @Min(1, { message: 'Tổng giới hạn số lượng món trong cả bữa tối thiểu phải từ 1' })
  maxTotalQuantity?: number | null;

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

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsInt({ message: 'Giới hạn số lượng món mỗi lần gửi phải là số nguyên dương' })
  @Min(1, { message: 'Giới hạn số lượng món mỗi lần gửi tối thiểu phải từ 1 món trở lên' })
  maxItemsPerSubmission?: number | null;

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
