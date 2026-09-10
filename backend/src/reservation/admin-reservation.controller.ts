import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ReservationStatus } from '@prisma/client';
import { BranchScope } from '../common/decorators/branch-scope.decorator';
import { CreateWalkInDto } from './dto/walk-in.dto';

@Controller('admin/reservations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  /**
   * Danh sách đặt bàn (Phân trang, lọc theo chi nhánh, ngày, trạng thái, tìm kiếm)
   */
  @Get()
  @RequirePermission('reservations.view')
  async getReservations(
    @BranchScope() branchId: string | undefined,
    @Query('branchId') qBranchId?: string,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: ReservationStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveBranchId = branchId || qBranchId;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const data = await this.reservationService.getAdminReservations({
      branchId: effectiveBranchId,
      date,
      startDate,
      endDate,
      status,
      search,
      page: pageNum,
      limit: limitNum,
    });

    return {
      success: true,
      data,
    };
  }

  /**
   * Xem lịch biểu / Sơ đồ theo giờ trong ngày (Day Timeline View)
   */
  @Get('timeline')
  @RequirePermission('reservations.view')
  async getTimeline(
    @BranchScope() branchId: string | undefined,
    @Query('branchId') qBranchId?: string,
    @Query('date') date?: string,
  ) {
    const effectiveBranchId = branchId || qBranchId;
    if (!effectiveBranchId) {
      throw new ForbiddenException('Vui lòng chọn chi nhánh để xem timeline');
    }

    const todayStr = date || new Date().toISOString().split('T')[0];
    const data = await this.reservationService.getAdminDayTimeline(effectiveBranchId, todayStr);

    return {
      success: true,
      data,
    };
  }

  /**
   * Báo cáo phân tích số liệu đặt bàn thật (Analytics)
   */
  @Get('analytics')
  @RequirePermission('reservations.view')
  async getAnalytics(
    @BranchScope() branchId: string | undefined,
    @Query('branchId') qBranchId?: string,
    @Query('days') days?: string,
  ) {
    const effectiveBranchId = branchId || qBranchId;
    const rangeDays = days ? parseInt(days, 10) : 30;

    const data = await this.reservationService.getAnalytics(effectiveBranchId, rangeDays);

    return {
      success: true,
      data,
    };
  }

  /**
   * Tiếp nhận khách vãng lai tại quầy (Walk-in Instant Seating)
   */
  @Post('walk-in')
  @RequirePermission('reservations.create', { branchBody: 'branchId' })
  async createWalkIn(
    @Request() req,
    @BranchScope() branchId: string | undefined,
    @Body() dto: CreateWalkInDto,
  ) {
    if (branchId && dto.branchId !== branchId) {
      throw new ForbiddenException('Bạn chỉ có thể tạo khách vãng lai cho chi nhánh được phân công');
    }

    const data = await this.reservationService.createWalkIn(dto, req.user.id);
    return {
      success: true,
      message: 'Tiếp nhận khách vãng lai thành công',
      data,
    };
  }

  /**
   * Chi tiết đặt bàn cho quản trị viên (Xem đủ SĐT và internalNote)
   */
  @Get(':id')
  @RequirePermission('reservations.view', {
    resourceResolver: async (req, prisma) => {
      const res = await prisma.reservation.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return res?.branchId;
    },
  })
  async getReservationDetail(
    @Param('id') id: string,
    @BranchScope() branchId: string | undefined,
  ) {
    const data = await this.reservationService.getReservationByCode(
      id,
      undefined,
      undefined,
      true, // isStaff = true
    );

    if (branchId && data.branchId !== branchId) {
      throw new ForbiddenException('Bạn không có quyền xem đặt bàn của chi nhánh khác');
    }

    return {
      success: true,
      data,
    };
  }

  /**
   * Chuyển trạng thái đặt bàn (Confirm, Reject, Check-in, Seat, Complete, No-show)
   */
  @Patch(':id/status')
  @RequirePermission('reservations.update', {
    resourceResolver: async (req, prisma) => {
      const res = await prisma.reservation.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return res?.branchId;
    },
  })
  async updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { status: ReservationStatus; reason?: string },
  ) {
    const data = await this.reservationService.transitionStatus(
      id,
      body.status,
      {
        userId: req.user.id,
        role: req.user.role,
        name: req.user.fullName,
      },
      body.reason,
    );

    return {
      success: true,
      message: `Đã chuyển trạng thái sang ${body.status}`,
      data,
    };
  }

  /**
   * Gán hoặc đổi bàn phục vụ
   */
  @Patch(':id/tables')
  @RequirePermission('reservations.update', {
    resourceResolver: async (req, prisma) => {
      const res = await prisma.reservation.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return res?.branchId;
    },
  })
  async assignTables(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { tableIds: string[] },
  ) {
    const data = await this.reservationService.assignTables(
      id,
      body.tableIds || [],
      {
        userId: req.user.id,
        role: req.user.role,
      },
    );

    return data;
  }
}
