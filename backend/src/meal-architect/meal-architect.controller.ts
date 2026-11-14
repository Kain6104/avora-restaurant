import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { MealArchitectService } from './meal-architect.service';
import { CalculateRecipeDto } from './dto/calculate-recipe.dto';
import { SaveRecipeDto } from './dto/save-recipe.dto';

@Controller('meal-architect')
export class MealArchitectController {
  constructor(private readonly mealArchitectService: MealArchitectService) {}

  @Get('ingredients')
  async getIngredients() {
    return this.mealArchitectService.getIngredients();
  }

  @Get('admin/ingredients')
  async getAdminIngredients() {
    return this.mealArchitectService.getAdminIngredients();
  }

  @Post('admin/ingredients')
  async createAdminIngredient(@Body() data: any) {
    return this.mealArchitectService.createAdminIngredient(data);
  }

  @Put('admin/ingredients/:id')
  async updateAdminIngredient(@Param('id') id: string, @Body() data: any) {
    return this.mealArchitectService.updateAdminIngredient(id, data);
  }

  @Delete('admin/ingredients/:id')
  async deleteAdminIngredient(@Param('id') id: string) {
    return this.mealArchitectService.deleteAdminIngredient(id);
  }

  @Get('admin/recipes')
  async getAdminRecipes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.mealArchitectService.getAdminRecipes({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 12,
      search,
    });
  }

  @Post('calculate')
  async calculate(@Body() dto: CalculateRecipeDto, @Req() req: any) {
    const user = req.user || null;
    return this.mealArchitectService.calculateRecipe(dto, user);
  }

  @Post('save-recipe')
  async saveRecipe(@Body() dto: SaveRecipeDto, @Req() req: any) {
    const user = req.user || null;
    return this.mealArchitectService.saveRecipe(dto, user);
  }

  @Get('recipe/:code')
  async getRecipe(@Param('code') code: string) {
    return this.mealArchitectService.getRecipeByCode(code);
  }

  @Get('community-gallery')
  async getCommunityGallery(@Query('limit') limit?: string) {
    const lim = limit ? parseInt(limit, 10) : 12;
    return this.mealArchitectService.getCommunityGallery(lim);
  }

  @Post('recipe/:id/like')
  async likeRecipe(@Param('id') id: string) {
    return this.mealArchitectService.likeRecipe(id);
  }

  @Post('recipe/:code/fork')
  async forkRecipe(@Param('code') code: string) {
    return this.mealArchitectService.forkRecipe(code);
  }
}

