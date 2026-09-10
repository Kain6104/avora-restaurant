import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminBannerService } from './admin-banner.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { CreateBannerDto, UpdateBannerDto, ReorderBannersDto } from './dto/banner.dto';

@Controller('admin/banners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminBannerController {
  constructor(private readonly bannerService: AdminBannerService) {}

  /**
   * Lấy danh sách toàn bộ Banner (có phân trang & bộ lọc)
   */
  @Get()
  @RequirePermission('vouchers.view')
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('position') position?: string,
    @Query('status') status?: string,
    @BranchScope() branchIdScope?: string
  ) {
    return this.bannerService.findAllBanners({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      search,
      position,
      status,
      branchIdScope,
    });
  }

  /**
   * Lấy danh sách Banner ĐANG HOẠT ĐỘNG (Phục vụ kéo thả sắp xếp)
   */
  @Get('active')
  @RequirePermission('vouchers.view')
  async findActive(
    @Query('position') position: string = 'HERO',
    @BranchScope() branchIdScope?: string
  ) {
    return this.bannerService.findActiveBanners({
      position,
      branchIdScope,
    });
  }

  /**
   * Báo cáo Thống kê Tổng quan (KPIs, Impressions, Clicks, Unique Members)
   */
  @Get('analytics')
  @RequirePermission('vouchers.view')
  async getAnalytics(@BranchScope() branchIdScope?: string) {
    return this.bannerService.getBannerAnalytics(branchIdScope);
  }

  /**
   * Lấy chi tiết Banner theo ID
   */
  @Get(':id')
  @RequirePermission('vouchers.view')
  async findOne(@Param('id') id: string) {
    return this.bannerService.findOne(id);
  }

  /**
   * Tạo mới Banner / Popup
   */
  @Post()
  @RequirePermission('vouchers.create')
  async create(@Body() dto: CreateBannerDto, @BranchScope() branchIdScope?: string) {
    if (branchIdScope && branchIdScope !== 'ALL') {
      dto.branchIds = [branchIdScope];
    }
    return this.bannerService.createBanner(dto);
  }

  /**
   * Kéo thả sắp xếp thứ tự hiển thị (Transactional Reorder)
   */
  @Patch('reorder')
  @RequirePermission('vouchers.update')
  async reorder(@Body() dto: ReorderBannersDto) {
    return this.bannerService.reorderBanners(dto);
  }

  /**
   * Bật / Tắt trạng thái nhanh
   */
  @Patch(':id/status')
  @RequirePermission('vouchers.update')
  async toggleStatus(@Param('id') id: string) {
    return this.bannerService.toggleStatus(id);
  }

  /**
   * Cập nhật thông tin Banner
   */
  @Patch(':id')
  @RequirePermission('vouchers.update')
  async update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannerService.updateBanner(id, dto);
  }

  /**
   * Xóa Banner
   */
  @Delete(':id')
  @RequirePermission('vouchers.delete')
  async delete(@Param('id') id: string) {
    return this.bannerService.deleteBanner(id);
  }
}
