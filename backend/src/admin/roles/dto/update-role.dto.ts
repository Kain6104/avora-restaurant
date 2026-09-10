import { IsString, IsOptional, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { ScopeType } from '@prisma/client';

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ScopeType)
  @IsOptional()
  scopeType?: ScopeType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionKeys?: string[];
}
