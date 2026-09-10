import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrintTemplateType } from '@prisma/client';

export class PreviewPrintTemplateDto {
  @IsNotEmpty({ message: 'Nội dung mẫu in không được để trống' })
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  paperSize?: string;

  @IsOptional()
  settings?: Record<string, any>;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  realOrderId?: string;

  @IsOptional()
  @IsEnum(PrintTemplateType)
  type?: PrintTemplateType;
}
