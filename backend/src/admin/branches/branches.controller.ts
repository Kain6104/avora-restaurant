import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, BadRequestException, ForbiddenException, Req } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';

@Controller('admin/branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN, RoleType.MANAGER)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) { }

  @Get()
  async findAll(@BranchScope() branchId?: string) {
    const data = await this.branchesService.findAll(branchId);
    return { data, meta: { total: data.length } };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @BranchScope() branchId?: string) {
    if (branchId && branchId !== id) throw new ForbiddenException('Cannot access this branch');
    const data = await this.branchesService.findOne(id);
    return { data };
  }

  @Post()
  @Roles(RoleType.ADMIN)
  async create(@Body() data: any) {
    if (data.latitude < -90 || data.latitude > 90) throw new BadRequestException('Invalid latitude');
    if (data.longitude < -180 || data.longitude > 180) throw new BadRequestException('Invalid longitude');

    const result = await this.branchesService.create(data);
    return { data: result };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any, @BranchScope() branchId?: string, @Req() req?: any) {
    if (branchId && branchId !== id) throw new ForbiddenException('Cannot edit this branch');
    
    if (req?.user?.role === 'MANAGER') {
       delete data.name;
       delete data.branchCode;
    }

    if (data.latitude !== undefined && (data.latitude < -90 || data.latitude > 90)) throw new BadRequestException('Invalid latitude');
    if (data.longitude !== undefined && (data.longitude < -180 || data.longitude > 180)) throw new BadRequestException('Invalid longitude');

    const result = await this.branchesService.update(id, data);
    return { data: result };
  }

  @Delete(':id')
  @Roles(RoleType.ADMIN)
  async remove(@Param('id') id: string) {
    try {
      await this.branchesService.delete(id);
      return { success: true, message: 'Branch deleted' };
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }
}
