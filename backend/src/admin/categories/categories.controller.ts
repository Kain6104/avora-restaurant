import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermission('categories.view')
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    return this.categoriesService.findAll({
      skip,
      take: limitNumber,
      search,
      branchIdScope,
    });
  }

  @Post()
  @RequirePermission('categories.create')
  async create(@Body() data: any) {
    const result = await this.categoriesService.create(data);
    return { data: result, message: 'Created category successfully' };
  }

  @Patch(':id')
  @RequirePermission('categories.update')
  async update(@Param('id') id: string, @Body() data: any) {
    const result = await this.categoriesService.update(id, data);
    return { data: result, message: 'Updated category successfully' };
  }

  @Delete(':id')
  @RequirePermission('categories.delete')
  async remove(@Param('id') id: string) {
    const result = await this.categoriesService.remove(id);
    return { data: result, message: 'Deleted category successfully' };
  }
}
