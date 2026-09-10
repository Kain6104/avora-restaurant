import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { TableService } from './table.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { BranchScope } from '../common/decorators/branch-scope.decorator';
import {
  CreateAreaDto,
  UpdateAreaDto,
  CreateTableDto,
  UpdateTableDto,
  CreateReservationBlockDto,
  CreateSpecialHoursDto,
} from './dto/table.dto';

@Controller('admin/tables')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TableController {
  constructor(private readonly tableService: TableService) {}

  // ================= Areas =================
  @Get('areas')
  @RequirePermission('areas.view')
  async getAreas(@BranchScope() branchId: string | undefined, @Query('branchId') qBranchId?: string) {
    const effectiveBranchId = branchId || qBranchId;
    if (!effectiveBranchId) throw new ForbiddenException('Vui lòng chọn chi nhánh');
    const data = await this.tableService.getAreasByBranch(effectiveBranchId);
    return { success: true, data };
  }

  @Post('areas')
  @RequirePermission('areas.create', { branchBody: 'branchId' })
  async createArea(
    @BranchScope() branchId: string | undefined,
    @Body() dto: CreateAreaDto,
  ) {
    if (branchId && dto.branchId !== branchId) {
      throw new ForbiddenException('Bạn chỉ có thể tạo khu vực cho chi nhánh của mình');
    }
    const data = await this.tableService.createArea(dto);
    return { success: true, data };
  }

  @Put('areas/:id')
  @RequirePermission('areas.update', {
    resourceResolver: async (req, prisma) => {
      const area = await prisma.restaurantArea.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return area?.branchId;
    },
  })
  async updateArea(@Param('id') id: string, @Body() dto: UpdateAreaDto) {
    const data = await this.tableService.updateArea(id, dto);
    return { success: true, data };
  }

  @Delete('areas/:id')
  @RequirePermission('areas.delete', {
    resourceResolver: async (req, prisma) => {
      const area = await prisma.restaurantArea.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return area?.branchId;
    },
  })
  async deleteArea(@Param('id') id: string) {
    const data = await this.tableService.deleteArea(id);
    return { success: true, data };
  }

  // ================= Tables =================
  @Get()
  @RequirePermission('tables.view')
  async getTables(@BranchScope() branchId: string | undefined, @Query('branchId') qBranchId?: string) {
    const effectiveBranchId = branchId || qBranchId;
    if (!effectiveBranchId) throw new ForbiddenException('Vui lòng chọn chi nhánh');
    const data = await this.tableService.getTablesByBranch(effectiveBranchId);
    return { success: true, data };
  }

  @Post()
  @RequirePermission('tables.create', { branchBody: 'branchId' })
  async createTable(
    @BranchScope() branchId: string | undefined,
    @Body() dto: CreateTableDto,
  ) {
    if (branchId && dto.branchId !== branchId) {
      throw new ForbiddenException('Bạn chỉ có thể tạo bàn cho chi nhánh của mình');
    }
    const data = await this.tableService.createTable(dto);
    return { success: true, data };
  }

  @Put(':id')
  @RequirePermission('tables.update', {
    resourceResolver: async (req, prisma) => {
      const table = await prisma.restaurantTable.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return table?.branchId;
    },
  })
  async updateTable(@Param('id') id: string, @Body() dto: UpdateTableDto) {
    const data = await this.tableService.updateTable(id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermission('tables.delete', {
    resourceResolver: async (req, prisma) => {
      const table = await prisma.restaurantTable.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return table?.branchId;
    },
  })
  async deleteTable(@Param('id') id: string) {
    const data = await this.tableService.deleteTable(id);
    return { success: true, data };
  }

  // ================= Reservation Blocks =================
  @Get('blocks')
  @RequirePermission('reservations.blocks.view')
  async getBlocks(@BranchScope() branchId: string | undefined, @Query('branchId') qBranchId?: string) {
    const effectiveBranchId = branchId || qBranchId;
    if (!effectiveBranchId) throw new ForbiddenException('Vui lòng chọn chi nhánh');
    const data = await this.tableService.getBlocksByBranch(effectiveBranchId);
    return { success: true, data };
  }

  @Post('blocks')
  @RequirePermission('reservations.blocks.manage', { branchBody: 'branchId' })
  async createBlock(
    @Request() req,
    @BranchScope() branchId: string | undefined,
    @Body() dto: CreateReservationBlockDto,
  ) {
    if (branchId && dto.branchId !== branchId) {
      throw new ForbiddenException('Bạn chỉ có thể block bàn cho chi nhánh của mình');
    }
    const data = await this.tableService.createBlock(dto, req.user?.id || 'ADMIN');
    return { success: true, data };
  }

  @Delete('blocks/:id')
  @RequirePermission('reservations.blocks.manage', {
    resourceResolver: async (req, prisma) => {
      const block = await prisma.reservationBlock.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return block?.branchId;
    },
  })
  async deleteBlock(@Param('id') id: string) {
    const data = await this.tableService.deleteBlock(id);
    return { success: true, data };
  }

  // ================= Special Hours =================
  @Get('special-hours')
  @RequirePermission('branch_special_hours.view')
  async getSpecialHours(@BranchScope() branchId: string | undefined, @Query('branchId') qBranchId?: string) {
    const effectiveBranchId = branchId || qBranchId;
    if (!effectiveBranchId) throw new ForbiddenException('Vui lòng chọn chi nhánh');
    const data = await this.tableService.getSpecialHoursByBranch(effectiveBranchId);
    return { success: true, data };
  }

  @Post('special-hours')
  @RequirePermission('branch_special_hours.manage', { branchBody: 'branchId' })
  async createSpecialHours(
    @BranchScope() branchId: string | undefined,
    @Body() dto: CreateSpecialHoursDto,
  ) {
    if (branchId && dto.branchId !== branchId) {
      throw new ForbiddenException('Bạn chỉ có thể cấu hình giờ đặc biệt cho chi nhánh của mình');
    }
    const data = await this.tableService.createSpecialHours(dto);
    return { success: true, data };
  }

  @Delete('special-hours/:id')
  @RequirePermission('branch_special_hours.manage', {
    resourceResolver: async (req, prisma) => {
      const hours = await prisma.branchSpecialHours.findUnique({
        where: { id: req.params.id },
        select: { branchId: true },
      });
      return hours?.branchId;
    },
  })
  async deleteSpecialHours(@Param('id') id: string) {
    const data = await this.tableService.deleteSpecialHours(id);
    return { success: true, data };
  }
}
