import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrintTemplateType } from '@prisma/client';

export class CreatePrintTemplateDto {
  @IsNotEmpty({ message: 'Tên mẫu in không được để trống' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Loại mẫu in không được để trống' })
  @IsEnum(PrintTemplateType, { message: 'Loại mẫu in không hợp lệ' })
  type: PrintTemplateType;

  @IsNotEmpty({ message: 'Nội dung mẫu in không được để trống' })
  @IsString()
  content: string;

  @IsNotEmpty({ message: 'Mã chi nhánh không được để trống' })
  @IsString()
  branchId: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  paperSize?: string; // '80mm' | '58mm' | '30x50mm' | '50x70mm' | 'A5' | 'A4' | 'CUSTOM'

  @IsOptional()
  settings?: Record<string, any>;
}
