import { Controller, Get, Param, Patch, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { RoleType } from '@prisma/client';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('staff.view')
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
  @RequirePermission('staff.view')
  async findOne(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const data = await this.usersService.findOne(id, branchIdScope);
    return { data };
  }

  @Patch(':id/role')
  @RequirePermission('staff.roles.assign')
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
  @RequirePermission('staff.create')
  async create(@Body() data: any) {
    const result = await this.usersService.create(data);
    return { data: result, message: 'Created user successfully' };
  }

  @Patch(':id')
  @RequirePermission('staff.update')
  async update(@Param('id') id: string, @Body() data: any, @Req() req?: any) {
    const adminId = req?.user?.id;
    const result = await this.usersService.update(id, data, adminId);
    return { data: result, message: 'Updated user successfully' };
  }

  /**
   * Khởi tạo quy trình đổi email sang email mới và gửi mã OTP
   */
  @Post(':id/request-email-change')
  @RequirePermission('customers.update')
  async requestEmailChange(
    @Param('id') id: string,
    @Body('newEmail') newEmail: string,
    @Req() req?: any,
  ) {
    const adminId = req?.user?.id;
    return this.usersService.requestEmailChange(id, newEmail, adminId);
  }

  /**
   * Xác thực mã OTP và cập nhật email mới cho User
   */
  @Post(':id/verify-email-change')
  @RequirePermission('customers.update')
  async verifyEmailChange(
    @Param('id') id: string,
    @Body('newEmail') newEmail: string,
    @Body('otp') otp: string,
    @Req() req?: any,
  ) {
    const adminId = req?.user?.id;
    return this.usersService.verifyEmailChange(id, newEmail, otp, adminId);
  }
}
