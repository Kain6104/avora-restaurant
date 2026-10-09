import {
  IsInt,
  Min,
  Max,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderReviewDto {
  @IsInt({ message: 'Điểm đánh giá chung phải là số nguyên (1 đến 5 sao)' })
  @Min(1, { message: 'Đánh giá tối thiểu là 1 sao' })
  @Max(5, { message: 'Đánh giá tối đa là 5 sao' })
  @Type(() => Number)
  overallRating: number;

  @IsOptional()
  @IsInt({ message: 'Đánh giá chất lượng món ăn phải từ 1 đến 5' })
  @Min(1)
  @Max(5)
  @Type(() => Number)
  foodRating?: number;

  @IsOptional()
  @IsInt({ message: 'Đánh giá dịch vụ phục vụ phải từ 1 đến 5' })
  @Min(1)
  @Max(5)
  @Type(() => Number)
  serviceRating?: number;

  @IsOptional()
  @IsInt({ message: 'Đánh giá giao hàng phải từ 1 đến 5' })
  @Min(1)
  @Max(5)
  @Type(() => Number)
  deliveryRating?: number;

  @IsString({ message: 'Nội dung nhận xét phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng chia sẻ cảm nhận trải nghiệm của bạn' })
  @MinLength(2, { message: 'Nội dung đánh giá quá ngắn (tối thiểu 2 ký tự)' })
  @MaxLength(3000, { message: 'Nội dung đánh giá tối đa 3000 ký tự' })
  content: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách hình ảnh không hợp lệ' })
  @ArrayMaxSize(5, { message: 'Đánh giá đơn hàng chỉ cho phép đính kèm tối đa 5 hình ảnh' })
  @IsString({ each: true, message: 'ID hình ảnh đính kèm không hợp lệ' })
  mediaIds?: string[];
}
