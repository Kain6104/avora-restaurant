import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SelectedIngredientDto } from './calculate-recipe.dto';

export class SaveRecipeDto {
  @IsString()
  @IsNotEmpty()
  recipeName: string;

  @IsString()
  @IsOptional()
  creatorName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedIngredientDto)
  items: SelectedIngredientDto[];
}

