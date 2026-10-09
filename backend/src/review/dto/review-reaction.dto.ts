import { IsEnum, IsNotEmpty } from 'class-validator';
import { ReviewReactionType } from '@prisma/client';

export class ReviewReactionDto {
  @IsNotEmpty({ message: 'Vui lòng chọn loại reaction' })
  @IsEnum(ReviewReactionType, { message: 'Reaction chỉ có thể là LIKE hoặc DISLIKE' })
  type: ReviewReactionType;
}
