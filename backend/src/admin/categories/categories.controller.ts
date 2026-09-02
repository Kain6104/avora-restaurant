import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { RoleType } from '@prisma/client';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Roles(RoleType.ADMIN, RoleType.MANAGER, RoleType.CHEF)
  @Permissions(PERMISSIONS.CATEGORIES_VIEW)
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
  @Roles(RoleType.ADMIN)
  @Permissions(PERMISSIONS.CATEGORIES_CREATE)
  async create(@Body() data: any) {
    const result = await this.categoriesService.create(data);
    return { data: result, message: 'Created category successfully' };
  }

  @Patch(':id')
  @Roles(RoleType.ADMIN)
  @Permissions(PERMISSIONS.CATEGORIES_UPDATE)
  async update(@Param('id') id: string, @Body() data: any) {
    const result = await this.categoriesService.update(id, data);
    return { data: result, message: 'Updated category successfully' };
  }

  @Delete(':id')
  @Roles(RoleType.ADMIN)
  @Permissions(PERMISSIONS.CATEGORIES_DELETE)
  async remove(@Param('id') id: string) {
    const result = await this.categoriesService.remove(id);
    return { data: result, message: 'Deleted category successfully' };
  }
}
