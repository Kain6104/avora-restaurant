import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AttendanceService } from './attendance.service';
import { AttendanceQrService } from './attendance-qr.service';
import { AttendanceExcelService } from './attendance-excel.service';
import { AttendanceImportService } from './attendance-import.service';
import { AttendanceScanDto } from './dto/attendance-scan.dto';
import { ShiftSaveDto } from './dto/shift-save.dto';
import { ManualActionDto, ManualAddDto } from './dto/manual-attendance.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

@Controller('api/attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly qrService: AttendanceQrService,
    private readonly excelService: AttendanceExcelService,
    private readonly importService: AttendanceImportService,
  ) {}

  // ==========================================
  // 1. DÀNH CHO NHÂN VIÊN (MOBILE / WAITER)
  // ==========================================

  @Post('employee/scan')
  async scanAttendance(@Req() req: any, @Body() body: AttendanceScanDto) {
    const userId = req.user?.id;
    const result = await this.attendanceService.processQRScan(userId, body);
    return {
      success: true,
      data: result,
      message: result.message,
    };
  }

  @Get('employee/status')
  async getEmployeeStatus(@Req() req: any) {
    const userId = req.user?.id;
    const status = await this.attendanceService.getEmployeeAttendanceStatus(userId);
    return {
      success: true,
      data: status,
    };
  }

  @Get('employee/history')
  async getMyHistory(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userId = req.user?.id;
    const history = await this.attendanceService.getMyAttendanceHistory(userId, startDate, endDate);
    return {
      success: true,
      data: history,
    };
  }

  // ==========================================
  // 2. MÃ QR CHI NHÁNH
  // ==========================================

  @Get('qr/dynamic')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.qr.manage', { branchQuery: 'branchId' })
  async getDynamicQr(@Query('branchId') branchId: string) {
    if (!branchId) throw new BadRequestException('Vui lòng truyền branchId.');
    const data = await this.qrService.generateDynamicQr(branchId);
    return { success: true, data };
  }

  @Get('qr/static')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.qr.manage', { branchQuery: 'branchId' })
  async getStaticQr(@Query('branchId') branchId: string) {
    if (!branchId) throw new BadRequestException('Vui lòng truyền branchId.');
    const data = await this.qrService.generateStaticQr(branchId);
    return { success: true, data };
  }

  @Get('qr/branch-today')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.qr.manage', { branchQuery: 'branchId' })
  async getBranchToday(@Query('branchId') branchId: string) {
    if (!branchId) throw new BadRequestException('Vui lòng truyền branchId.');
    const data = await this.attendanceService.getBranchTodayAttendance(branchId);
    return { success: true, data };
  }

  // ==========================================
  // 3. ADMIN DASHBOARD & CRUD
  // ==========================================

  @Get('admin/dashboard')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.view', { branchQuery: 'branchId' })
  async getDashboardData(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
    @Query('roleId') roleId?: string,
  ) {
    const data = await this.attendanceService.getAdminDashboardData(startDate, endDate, branchId, roleId);
    return { success: true, data };
  }

  @Post('admin/shifts')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.edit', { branchBody: 'branchId' })
  async saveShift(@Body() dto: ShiftSaveDto) {
    const data = await this.attendanceService.saveShift(dto);
    return { success: true, data, message: 'Lưu ca làm việc và đồng bộ thành công!' };
  }

  @Delete('admin/shifts/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.edit')
  async deleteShift(@Param('id') id: string) {
    const data = await this.attendanceService.deleteShift(id);
    return { success: true, data, message: 'Xóa ca làm việc thành công!' };
  }

  @Post('admin/shifts/bulk-delete')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.edit')
  async bulkDeleteShifts(@Body('shiftIds') shiftIds: string[]) {
    const data = await this.attendanceService.bulkDeleteShifts(shiftIds);
    return { success: true, data, message: data.message };
  }

  @Post('admin/manual-action')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.edit')
  async manualAction(@Body() dto: ManualActionDto) {
    const data = await this.attendanceService.processManualAction(dto);
    return { success: true, data, message: data?.message };
  }

  @Post('admin/manual-add')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.edit', { branchBody: 'branchId' })
  async manualAdd(@Body() dto: ManualAddDto) {
    const data = await this.attendanceService.addManualAttendance(dto);
    return { success: true, data, message: data?.message };
  }

  @Post('admin/reset-device')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.device.manage')
  async resetDevice(@Body('userId') userId: string) {
    if (!userId) throw new BadRequestException('Vui lòng truyền userId.');
    const data = await this.attendanceService.resetEmployeeDevice(userId);
    return { success: true, data, message: data?.message };
  }

  // ==========================================
  // 4. XUẤT EXCEL TƯƠNG THÍCH SUSHI WA
  // ==========================================

  @Get('admin/export')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.export', { branchQuery: 'branchId' })
  async exportExcel(@Query() query: AttendanceFilterDto, @Res() res: Response) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Vui lòng chọn ngày bắt đầu và kết thúc.');
    }
    const calcOt = query.calculateOvertime !== false && String(query.calculateOvertime) !== 'false';
    await this.excelService.exportToExcel(
      query.startDate,
      query.endDate,
      calcOt,
      query.branchId,
      query.roleId,
      query.userId,
      res,
    );
  }

  // ==========================================
  // 5. IMPORT LỊCH CA & BẢNG CÔNG LỊCH SỬ
  // ==========================================

  @Post('admin/shifts/import')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.import', { branchBody: 'branchId' })
  @UseInterceptors(FileInterceptor('file'))
  async importWeeklyShifts(
    @UploadedFile() file: Express.Multer.File,
    @Body('roleId') roleId: string,
    @Body('branchId') branchId: string,
  ) {
    if (!file) throw new BadRequestException('Vui lòng tải lên file Excel (.xlsx).');
    if (!roleId || !branchId) throw new BadRequestException('Vui lòng chọn vai trò và chi nhánh áp dụng.');
    const result = await this.importService.importWeeklySchedule(file.buffer, roleId, branchId);
    return { success: true, data: result, message: result.message };
  }

  @Post('admin/import-historical')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.import', { branchBody: 'branchId' })
  @UseInterceptors(FileInterceptor('file'))
  async importHistoricalAttendance(
    @UploadedFile() file: Express.Multer.File,
    @Body('branchId') branchId: string,
    @Body('updateExisting') updateExisting?: string,
  ) {
    if (!file) throw new BadRequestException('Vui lòng tải lên file Excel (.xlsx).');
    if (!branchId) throw new BadRequestException('Vui lòng chọn chi nhánh đích.');
    const result = await this.importService.importHistoricalAttendance(file.buffer, branchId, {
      updateExisting: updateExisting === 'true',
    });
    return result;
  }

  @Post('admin/import-historical-preview')
  @UseGuards(PermissionsGuard)
  @RequirePermission('attendance.import', { branchBody: 'branchId' })
  @UseInterceptors(FileInterceptor('file'))
  async previewHistoricalAttendance(
    @UploadedFile() file: Express.Multer.File,
    @Body('branchId') branchId: string,
  ) {
    if (!file) throw new BadRequestException('Vui lòng tải lên file Excel (.xlsx).');
    if (!branchId) throw new BadRequestException('Vui lòng chọn chi nhánh đích.');
    const result = await this.importService.previewHistoricalAttendance(file.buffer, branchId);
    return result;
  }
}

