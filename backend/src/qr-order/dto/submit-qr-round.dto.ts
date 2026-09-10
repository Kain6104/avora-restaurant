import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QrSelectedOptionDto {
  @IsString()
  @IsNotEmpty()
  optionItemId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class QrRoundItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QrSelectedOptionDto)
  selectedOptions?: QrSelectedOptionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsIn(['REGULAR', 'BUFFET_INCLUDED'])
  requestedPricingMode?: 'REGULAR' | 'BUFFET_INCLUDED';

  @IsOptional()
  @IsIn(['REGULAR', 'BUFFET_INCLUDED'])
  pricingMode?: 'REGULAR' | 'BUFFET_INCLUDED';
}

export class SubmitQrRoundDto {
  @IsString()
  @IsNotEmpty({ message: 'deviceSessionId là bắt buộc' })
  deviceSessionId: string;

  @IsString()
  @IsNotEmpty({ message: 'idempotencyKey là bắt buộc để chống gửi trùng' })
  idempotencyKey: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất 1 món để gửi' })
  @ValidateNested({ each: true })
  @Type(() => QrRoundItemDto)
  items: QrRoundItemDto[];
}
