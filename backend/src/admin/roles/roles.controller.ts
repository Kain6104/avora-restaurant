import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions-catalog')
  @RequirePermission('roles.view')
  async getPermissionsCatalog() {
    const data = await this.rolesService.getPermissionsCatalog();
    return { success: true, data };
  }

  @Get('assignments/user/:userId')
  @RequirePermission('staff.view')
  async getUserAssignments(@Param('userId') userId: string) {
    const data = await this.rolesService.getUserAssignments(userId);
    return { success: true, data };
  }

  @Post('assignments')
  @RequirePermission('staff.roles.assign')
  async assignRole(@Body() dto: AssignRoleDto, @Req() req: any) {
    const data = await this.rolesService.assignRole(dto, req.user.id);
    return { success: true, data, message: 'Phân quyền cho nhân viên thành công' };
  }

  @Delete('assignments/:userId/:roleId')
  @RequirePermission('staff.roles.assign')
  async removeAssignment(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @Req() req: any,
  ) {
    const data = await this.rolesService.removeAssignment(userId, roleId, req.user.id);
    return { success: true, data, message: 'Hủy phân quyền thành công' };
  }

  @Get()
  @RequirePermission('roles.view')
  async findAll() {
    const data = await this.rolesService.findAll();
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermission('roles.view')
  async findOne(@Param('id') id: string) {
    const data = await this.rolesService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermission('roles.create')
  async create(@Body() dto: CreateRoleDto, @Req() req: any) {
    const data = await this.rolesService.create(dto, req.user.id);
    return { success: true, data, message: 'Tạo vai trò thành công' };
  }

  @Patch(':id')
  @RequirePermission('roles.update')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @Req() req: any) {
    const data = await this.rolesService.update(id, dto, req.user.id);
    return { success: true, data, message: 'Cập nhật vai trò thành công' };
  }

  @Post(':id/duplicate')
  @RequirePermission('roles.create')
  async duplicate(@Param('id') id: string, @Req() req: any) {
    const data = await this.rolesService.duplicate(id, req.user.id);
    return { success: true, data, message: 'Nhân bản vai trò thành công' };
  }

  @Delete(':id')
  @RequirePermission('roles.delete')
  async delete(@Param('id') id: string, @Req() req: any) {
    const data = await this.rolesService.delete(id, req.user.id);
    return { success: true, data, message: 'Xóa vai trò thành công' };
  }
}
