import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, Matches } from 'class-validator';
import { ScopeType } from '@prisma/client';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã vai trò không được để trống' })
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Mã vai trò chỉ được chứa ký tự in hoa, số, gạch nối và gạch dưới' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên vai trò không được để trống' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ScopeType)
  @IsOptional()
  scopeType?: ScopeType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionKeys?: string[];
}
