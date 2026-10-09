import {
  IsInt,
  Min,
  Max,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductReviewDto {
  @IsOptional()
  @IsInt({ message: 'Số sao đánh giá phải là số nguyên (1 đến 5)' })
  @Min(1, { message: 'Đánh giá tối thiểu là 1 sao' })
  @Max(5, { message: 'Đánh giá tối đa là 5 sao' })
  @Type(() => Number)
  rating?: number;

  @IsOptional()
  @IsString({ message: 'Nội dung nhận xét phải là chuỗi ký tự' })
  @MinLength(2, { message: 'Nội dung đánh giá quá ngắn (tối thiểu 2 ký tự)' })
  @MaxLength(3000, { message: 'Nội dung đánh giá tối đa 3000 ký tự' })
  content?: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách tệp đính kèm không hợp lệ' })
  @ArrayMaxSize(5, { message: 'Mỗi đánh giá chỉ được đính kèm tối đa 5 hình ảnh/video' })
  @IsString({ each: true, message: 'ID tệp đính kèm không hợp lệ' })
  mediaIds?: string[];
}
