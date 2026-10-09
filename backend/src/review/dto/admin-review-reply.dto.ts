import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class AdminReviewReplyDto {
  @IsString({ message: 'Nội dung phản hồi phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung phản hồi từ AVORA' })
  @MinLength(2, { message: 'Nội dung phản hồi tối thiểu 2 ký tự' })
  @MaxLength(2000, { message: 'Nội dung phản hồi tối đa 2000 ký tự' })
  content: string;
}
