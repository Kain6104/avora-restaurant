import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateReviewSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Điểm thưởng phải là số nguyên' })
  @Min(0, { message: 'Điểm thưởng không được âm' })
  @Max(100000, { message: 'Điểm thưởng không vượt quá 100.000' })
  orderReviewRewardPoints?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Thời hạn đánh giá phải là số nguyên ngày' })
  @Min(1, { message: 'Thời hạn đánh giá tối thiểu là 1 ngày' })
  @Max(90, { message: 'Thời hạn đánh giá tối đa là 90 ngày' })
  orderReviewWindowDays?: number;

  @IsOptional()
  @IsBoolean()
  reviewRewardEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  orderReviewRequestEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  productReviewMediaEnabled?: boolean;
}
