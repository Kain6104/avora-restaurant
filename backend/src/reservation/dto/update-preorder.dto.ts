import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdatePreOrderedItemsDto {
  @IsArray()
  items: any[];

  @IsOptional()
  @IsString()
  phone?: string;
}

