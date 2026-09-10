import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PrintTemplateType } from '@prisma/client';

export class UpdatePrintTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(PrintTemplateType, { message: 'Loại mẫu in không hợp lệ' })
  type?: PrintTemplateType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  paperSize?: string;

  @IsOptional()
  settings?: Record<string, any>;

  @IsNotEmpty({ message: 'Version hiện tại là bắt buộc để kiểm soát xung đột' })
  @IsInt({ message: 'Version phải là số nguyên' })
  @Min(1)
  version: number;
}
