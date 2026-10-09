import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';

export class CreateOrderFollowUpDto {
  @IsString({ message: 'Nội dung phản hồi bổ sung phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung phản hồi bổ sung' })
  @MinLength(2, { message: 'Nội dung phản hồi quá ngắn (tối thiểu 2 ký tự)' })
  @MaxLength(2000, { message: 'Nội dung phản hồi tối đa 2000 ký tự' })
  content: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách hình ảnh không hợp lệ' })
  @ArrayMaxSize(5, { message: 'Tối đa 5 hình ảnh bổ sung' })
  @IsString({ each: true, message: 'ID hình ảnh đính kèm không hợp lệ' })
  mediaIds?: string[];
}
