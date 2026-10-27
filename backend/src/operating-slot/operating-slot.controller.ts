import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { OperatingSlotService } from './operating-slot.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { BranchScope } from '../common/decorators/branch-scope.decorator';
import { DayOfWeek, SlotOrderType } from '@prisma/client';

@Controller('operating-slots')
export class OperatingSlotController {
  constructor(private readonly slotService: OperatingSlotService) {}

  /**
   * Public / Client endpoint: Lấy danh sách khung giờ theo ngày cụ thể (Checkout)
   */
  @Get('for-date')
  async getSlotsForDate(
    @Query('branchId') branchId: string,
    @Query('date') dateQuery?: string,
    @Query('dateStr') dateStrQuery?: string,
    @Query('orderType') orderType?: SlotOrderType,
  ) {
    const dateStr = dateQuery || dateStrQuery;
    if (!dateStr) {
      throw new BadRequestException('Ngày không hợp lệ (định dạng chuẩn YYYY-MM-DD)');
    }
    const data = await this.slotService.getSlotsForDate({
      branchId,
      dateStr,
      orderType,
    });
    return { data };
  }

  /**
   * Public / Client endpoint: Khóa giữ chỗ 10 phút tại Checkout
   */
  @Post('lock')
  async lockSlot(
    @Body('slotId') slotId: string,
    @Body('date') dateStr: string,
    @Body('sessionId') sessionId: string,
  ) {
    return this.slotService.lockSlot({ slotId, dateStr, sessionId });
  }

  /**
   * Admin / Manager: Lấy tất cả khung giờ theo cấu hình
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('operating_slots.view')
  async findAll(
    @Query('branchId') branchId?: string,
    @Query('dayOfWeek') dayOfWeek?: DayOfWeek,
    @Query('orderType') orderType?: SlotOrderType,
    @Query('isActive') isActive?: string,
    @BranchScope() branchIdScope?: string,
  ) {
    const data = await this.slotService.findAll({
      branchId,
      dayOfWeek,
      orderType,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      branchIdScope,
    });
    return { data };
  }

  /**
   * Admin / Manager: Lưu hàng loạt cấu hình khung giờ (Hỗ trợ sinh tự động)
   */
  @Post('bulk-save')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('operating_slots.create')
  async bulkSave(@Body() body: any) {
    const result = await this.slotService.bulkSave(body);
    return result;
  }

  /**
   * Admin / Manager: Tạo mới khung giờ
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('operating_slots.create')
  async create(@Body() body: any) {
    const data = await this.slotService.create(body);
    return { data, message: 'Tạo khung giờ hoạt động thành công' };
  }

  /**
   * Admin / Manager: Cập nhật khung giờ
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('operating_slots.update')
  async update(@Param('id') id: string, @Body() body: any) {
    const data = await this.slotService.update(id, body);
    return { data, message: 'Cập nhật khung giờ thành công' };
  }

  /**
   * Admin / Manager: Xóa toàn bộ khung giờ của một nhóm
   */
  @Delete('group')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('operating_slots.delete')
  async deleteGroup(
    @Query('branchId') branchId: string,
    @Query('dayOfWeek') dayOfWeek: DayOfWeek,
    @Query('orderType') orderType: SlotOrderType,
  ) {
    await this.slotService.deleteGroup(branchId, dayOfWeek, orderType);
    return { success: true, message: 'Đã xóa toàn bộ khung giờ của nhóm thành công' };
  }

  /**
   * Admin / Manager: Bật/tắt trạng thái toàn bộ khung giờ của một nhóm
   */
  @Patch('group/toggle')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('operating_slots.update')
  async toggleGroup(
    @Body('branchId') branchId: string,
    @Body('dayOfWeek') dayOfWeek: DayOfWeek,
    @Body('orderType') orderType: SlotOrderType,
    @Body('isActive') isActive: boolean,
  ) {
    await this.slotService.toggleGroup(branchId, dayOfWeek, orderType, isActive);
    return { success: true, message: 'Đã cập nhật trạng thái nhóm thành công' };
  }

  /**
   * Admin / Manager: Xóa khung giờ
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('operating_slots.delete')
  async delete(@Param('id') id: string) {
    await this.slotService.delete(id);
    return { success: true, message: 'Đã xóa khung giờ thành công' };
  }
}
