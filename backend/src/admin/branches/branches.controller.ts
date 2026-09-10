import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, BadRequestException, ForbiddenException, Req } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';

@Controller('admin/branches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @RequirePermission('branches.view')
  async findAll(@BranchScope() branchId?: string) {
    const data = await this.branchesService.findAll(branchId);
    return { data, meta: { total: data.length } };
  }

  @Get(':id')
  @RequirePermission('branches.view', { branchParam: 'id' })
  async findOne(@Param('id') id: string, @BranchScope() branchId?: string) {
    if (branchId && branchId !== id) throw new ForbiddenException('Cannot access this branch');
    const data = await this.branchesService.findOne(id);
    return { data };
  }

  @Post()
  @RequirePermission('branches.create')
  async create(@Body() data: any) {
    if (data.latitude < -90 || data.latitude > 90) throw new BadRequestException('Invalid latitude');
    if (data.longitude < -180 || data.longitude > 180) throw new BadRequestException('Invalid longitude');

    const result = await this.branchesService.create(data);
    return { data: result };
  }

  @Patch(':id')
  @RequirePermission('branches.update', { branchParam: 'id' })
  async update(@Param('id') id: string, @Body() data: any, @BranchScope() branchId?: string, @Req() req?: any) {
    if (branchId && branchId !== id) throw new ForbiddenException('Cannot edit this branch');

    if (data.latitude !== undefined && (data.latitude < -90 || data.latitude > 90)) throw new BadRequestException('Invalid latitude');
    if (data.longitude !== undefined && (data.longitude < -180 || data.longitude > 180)) throw new BadRequestException('Invalid longitude');

    const result = await this.branchesService.update(id, data);
    return { data: result };
  }

  @Delete(':id')
  @RequirePermission('branches.delete')
  async remove(@Param('id') id: string) {
    try {
      await this.branchesService.delete(id);
      return { success: true, message: 'Branch deleted' };
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }
}
