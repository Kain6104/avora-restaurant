import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SelectedIngredientDto {
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  gram?: number;
}

export class CalculateRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedIngredientDto)
  items: SelectedIngredientDto[];
}

