import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
  ValidateIf,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BuffetPackageItemInputDto } from './create-buffet-package.dto';

export class UpdateBuffetPackageDto {
  @IsOptional()
  @IsString()
  name?: string;

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ticketProductIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuffetPackageItemInputDto)
  items?: BuffetPackageItemInputDto[];
}
