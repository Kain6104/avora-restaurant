import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { RoleType } from '@prisma/client';
import { PERMISSIONS } from '../../common/constants/permissions';

@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  // --- VOUCHERS ---
  @Get('vouchers')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_VIEW)
  async findAllVouchers(
    @Query('page') page: string = '1', 
    @Query('limit') limit: string = '10', 
    @Query('search') search?: string,
    @Query('membershipTierId') tierId?: string,
    @BranchScope() branchIdScope?: string
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    return this.promotionsService.findAllVouchers({ skip: (pageNumber - 1) * limitNumber, take: limitNumber, search, tierId, branchIdScope });
  }

  @Post('vouchers')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_CREATE)
  async createVoucher(@Body() data: any, @BranchScope() branchIdScope?: string) {
    if (branchIdScope) {
      data.branchIds = [branchIdScope];
      delete data.branchId;
    }
    const result = await this.promotionsService.createVoucher(data);
    return { data: result, message: 'Created voucher successfully' };
  }

  @Patch('vouchers/:id')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_UPDATE)
  async updateVoucher(@Param('id') id: string, @Body() data: any, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.updateVoucher(id, data, branchIdScope);
    return { data: result, message: 'Updated voucher successfully' };
  }

  @Delete('vouchers/:id')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_DELETE)
  async deleteVoucher(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.deleteVoucher(id, branchIdScope);
    return { data: result, message: 'Deleted voucher successfully' };
  }

  // --- FLASH SALES ---
  @Get('flash-sales')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_VIEW)
  async findAllFlashSales(
    @Query('page') page: string = '1', 
    @Query('limit') limit: string = '10', 
    @Query('search') search?: string,
    @Query('membershipTierId') tierId?: string,
    @BranchScope() branchIdScope?: string
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    return this.promotionsService.findAllFlashSales({ skip: (pageNumber - 1) * limitNumber, take: limitNumber, search, tierId, branchIdScope });
  }

  @Post('flash-sales')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_CREATE)
  async createFlashSale(@Body() data: any, @BranchScope() branchIdScope?: string) {
    if (branchIdScope) {
      data.branchIds = [branchIdScope];
      delete data.branchId;
    }
    const result = await this.promotionsService.createFlashSale(data);
    return { data: result, message: 'Created flash sale successfully' };
  }

  @Patch('flash-sales/:id')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_UPDATE)
  async updateFlashSale(@Param('id') id: string, @Body() data: any, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.updateFlashSale(id, data, branchIdScope);
    return { data: result, message: 'Updated flash sale successfully' };
  }

  @Delete('flash-sales/:id')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_DELETE)
  async deleteFlashSale(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.deleteFlashSale(id, branchIdScope);
    return { data: result, message: 'Deleted flash sale successfully' };
  }

  // --- COMBOS ---
  @Get('combos')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_VIEW)
  async findAllCombos(
    @Query('page') page: string = '1', 
    @Query('limit') limit: string = '10', 
    @Query('search') search?: string,
    @Query('membershipTierId') tierId?: string,
    @BranchScope() branchIdScope?: string
  ) {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    return this.promotionsService.findAllCombos({ skip: (pageNumber - 1) * limitNumber, take: limitNumber, search, tierId, branchIdScope });
  }

  @Post('combos')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_CREATE)
  async createCombo(@Body() data: any, @BranchScope() branchIdScope?: string) {
    if (branchIdScope) {
      data.branchIds = [branchIdScope];
      delete data.branchId;
    }
    const result = await this.promotionsService.createCombo(data);
    return { data: result, message: 'Created combo successfully' };
  }

  @Patch('combos/:id')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_UPDATE)
  async updateCombo(@Param('id') id: string, @Body() data: any, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.updateCombo(id, data, branchIdScope);
    return { data: result, message: 'Updated combo successfully' };
  }

  @Delete('combos/:id')
  @Roles(RoleType.ADMIN, RoleType.MANAGER)
  @Permissions(PERMISSIONS.PROMOTIONS_DELETE)
  async deleteCombo(@Param('id') id: string, @BranchScope() branchIdScope?: string) {
    const result = await this.promotionsService.deleteCombo(id, branchIdScope);
    return { data: result, message: 'Deleted combo successfully' };
  }
}
