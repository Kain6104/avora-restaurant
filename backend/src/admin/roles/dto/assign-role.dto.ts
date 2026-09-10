import { IsString, IsNotEmpty, IsEnum, IsArray, IsOptional, IsBoolean } from 'class-validator';
import { BranchScopeType } from '@prisma/client';

export class AssignRoleDto {
  @IsString()
  @IsNotEmpty({ message: 'User ID không được để trống' })
  userId: string;

  @IsString()
  @IsNotEmpty({ message: 'Role ID không được để trống' })
  roleId: string;

  @IsEnum(BranchScopeType)
  branchScope: BranchScopeType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
