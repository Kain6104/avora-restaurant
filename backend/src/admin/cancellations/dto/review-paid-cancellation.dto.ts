import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReviewPaidCancellationDto {
  @IsBoolean()
  @IsNotEmpty({ message: 'Trạng thái xét duyệt (approved) là bắt buộc' })
  approved: boolean;

  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

