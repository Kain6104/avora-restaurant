import { IsNotEmpty, IsString, IsInt, Min, Max, IsOptional, IsArray } from 'class-validator';

export class CreateWalkInDto {
  @IsNotEmpty({ message: 'Vui lòng chọn chi nhánh' })
  @IsString()
  branchId: string;

  @IsNotEmpty({ message: 'Vui lòng nhập tên khách hàng' })
  @IsString()
  customerName: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsNotEmpty({ message: 'Vui lòng nhập số lượng khách' })
  @IsInt()
  @Min(1)
  @Max(50)
  partySize: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tableIds?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  initialStatus?: 'CHECKED_IN' | 'SEATED';
}
