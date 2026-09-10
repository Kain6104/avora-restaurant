import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class MemberLookupDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập thông tin thành viên (SĐT, Email, Username, hoặc Mã)' })
  identifier: string;
}

export class MemberVerifyDto {
  @IsString()
  @IsNotEmpty({ message: 'deviceSessionId là bắt buộc' })
  deviceSessionId: string;

  @IsString()
  @IsNotEmpty({ message: 'Thông tin thành viên là bắt buộc' })
  identifier: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  otp?: string;
}

export class RedeemRewardDto {
  @IsString()
  @IsNotEmpty({ message: 'deviceSessionId là bắt buộc' })
  deviceSessionId: string;

  @IsString()
  @IsNotEmpty({ message: 'Mã món đổi điểm là bắt buộc' })
  productId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
