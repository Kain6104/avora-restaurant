import { Controller, Get, Param, Patch, Post, Delete, Body, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { RoleType } from '@prisma/client';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles(RoleType.ADMIN, RoleType.MANAGER, RoleType.CHEF)
  @Permissions(PERMISSIONS.PRODUCTS_VIEW)
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    return this.productsService.findAll({
      skip,
      take: limitNumber,
      search,
      categoryId,
      branchIdScope,
      status,
    });
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.MANAGER, RoleType.CHEF)
  @Permissions(PERMISSIONS.PRODUCTS_VIEW)
  async findOne(@Param('id') id: string) {
    const data = await this.productsService.findOne(id);
    return { data, message: 'Success' };
  }

  @Patch(':id/toggle')
  @Roles(RoleType.ADMIN, RoleType.MANAGER, RoleType.CHEF)
  @Permissions(PERMISSIONS.PRODUCTS_UPDATE)
  async toggleAvailability(
    @Param('id') id: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.productsService.toggleAvailability(id, branchIdScope);
    return { data, message: 'Updated product availability successfully' };
  }

  @Post()
  @Roles(RoleType.ADMIN)
  @Permissions(PERMISSIONS.PRODUCTS_CREATE)
  async create(@Body() data: any) {
    const result = await this.productsService.create(data);
    return { data: result, message: 'Created product successfully' };
  }

  @Patch(':id')
  @Roles(RoleType.ADMIN)
  @Permissions(PERMISSIONS.PRODUCTS_UPDATE)
  async update(@Param('id') id: string, @Body() data: any) {
    const result = await this.productsService.update(id, data);
    return { data: result, message: 'Updated product successfully' };
  }

  @Delete(':id')
  @Roles(RoleType.ADMIN)
  @Permissions(PERMISSIONS.PRODUCTS_DELETE)
  async remove(@Param('id') id: string) {
    const result = await this.productsService.remove(id);
    return { data: result, message: 'Deleted product successfully' };
  }
}
