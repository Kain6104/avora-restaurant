import { Controller, Get, Param, Patch, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { RoleType } from '@prisma/client';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.USERS_VIEW)
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
    @Query('role') role?: RoleType,
    @BranchScope() branchIdScope?: string,
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    return this.usersService.findAll({
      skip,
      take: limitNumber,
      search,
      role,
      branchIdScope,
    });
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.USERS_VIEW)
  async findOne(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const data = await this.usersService.findOne(id, branchIdScope);
    return { data };
  }

  @Patch(':id/role')
  @Roles(RoleType.ADMIN) // ONLY Admin can change roles/branches
  @Permissions(PERMISSIONS.USERS_UPDATE)
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: RoleType,
    @Body('branchId') branchId?: string,
    @Req() req?: any,
  ) {
    const adminId = req?.user?.id;
    const data = await this.usersService.updateUserRole(id, role, branchId || null, adminId);
    return { data, message: 'Updated user role successfully' };
  }

  @Post()
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.USERS_CREATE)
  async create(@Body() data: any) {
    const result = await this.usersService.create(data);
    return { data: result, message: 'Created user successfully' };
  }

  @Patch(':id')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.USERS_UPDATE)
  async update(@Param('id') id: string, @Body() data: any) {
    const result = await this.usersService.update(id, data);
    return { data: result, message: 'Updated user successfully' };
  }
}
