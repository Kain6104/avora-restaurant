import { IsNotEmpty, IsString } from 'class-validator';

export class DuplicatePrintTemplateDto {
  @IsNotEmpty({ message: 'Chi nhánh đích không được để trống' })
  @IsString()
  targetBranchId: string;

  @IsNotEmpty({ message: 'Tên mẫu in mới không được để trống' })
  @IsString()
  newName: string;
}
