import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAreaDto,
  UpdateAreaDto,
  CreateTableDto,
  UpdateTableDto,
  CreateReservationBlockDto,
  CreateSpecialHoursDto,
} from './dto/table.dto';

@Injectable()
export class TableService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= Areas =================
  async getAreasByBranch(branchId: string) {
    return this.prisma.restaurantArea.findMany({
      where: { branchId },
      orderBy: { sortOrder: 'asc' },
      include: {
        tables: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async createArea(dto: CreateAreaDto) {
    return this.prisma.restaurantArea.create({
      data: {
        branchId: dto.branchId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateArea(id: string, dto: UpdateAreaDto) {
    const area = await this.prisma.restaurantArea.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Khu vực không tồn tại');

    return this.prisma.restaurantArea.update({
      where: { id },
      data: dto,
    });
  }

  async deleteArea(id: string) {
    const area = await this.prisma.restaurantArea.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Khu vực không tồn tại');

    return this.prisma.restaurantArea.delete({ where: { id } });
  }

  // ================= Tables =================
  async getTablesByBranch(branchId: string) {
    return this.prisma.restaurantTable.findMany({
      where: { branchId },
      orderBy: [{ sortOrder: 'asc' }, { tableCode: 'asc' }],
      include: {
        area: true,
      },
    });
  }

  async createTable(dto: CreateTableDto) {
    const table = await this.prisma.restaurantTable.create({
      data: {
        branchId: dto.branchId,
        areaId: dto.areaId,
        tableCode: dto.tableCode,
        name: dto.name,
        capacity: dto.capacity,
        minCapacity: dto.minCapacity ?? 1,
        status: dto.status,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { area: true },
    });

    // Cập nhật tổng capacity của chi nhánh
    await this.recalculateBranchCapacity(dto.branchId);

    return table;
  }

  async updateTable(id: string, dto: UpdateTableDto) {
    const table = await this.prisma.restaurantTable.findUnique({ where: { id } });
    if (!table) throw new NotFoundException('Bàn không tồn tại');

    const updated = await this.prisma.restaurantTable.update({
      where: { id },
      data: dto,
      include: { area: true },
    });

    await this.recalculateBranchCapacity(table.branchId);
    return updated;
  }

  async deleteTable(id: string) {
    const table = await this.prisma.restaurantTable.findUnique({ where: { id } });
    if (!table) throw new NotFoundException('Bàn không tồn tại');

    await this.prisma.restaurantTable.delete({ where: { id } });
    await this.recalculateBranchCapacity(table.branchId);
    return { success: true, message: 'Đã xóa bàn thành công' };
  }

  private async recalculateBranchCapacity(branchId: string) {
    const tables = await this.prisma.restaurantTable.findMany({
      where: { branchId, isActive: true },
    });
    const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
    await this.prisma.branch.update({
      where: { id: branchId },
      data: { capacity: totalCapacity > 0 ? totalCapacity : 80 },
    });
  }

  // ================= Reservation Blocks =================
  async getBlocksByBranch(branchId: string) {
    return this.prisma.reservationBlock.findMany({
      where: { branchId },
      orderBy: { startAt: 'asc' },
    });
  }

  async createBlock(dto: CreateReservationBlockDto, createdBy: string) {
    return this.prisma.reservationBlock.create({
      data: {
        branchId: dto.branchId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        blockType: dto.blockType ?? 'FULL_BLOCK',
        blockedCapacity: dto.blockedCapacity,
        areaId: dto.areaId,
        reason: dto.reason,
        createdBy,
      },
    });
  }

  async deleteBlock(id: string) {
    return this.prisma.reservationBlock.delete({ where: { id } });
  }

  // ================= Special Hours =================
  async getSpecialHoursByBranch(branchId: string) {
    return this.prisma.branchSpecialHours.findMany({
      where: { branchId },
      orderBy: { date: 'asc' },
    });
  }

  async createSpecialHours(dto: CreateSpecialHoursDto) {
    const dateObj = new Date(dto.date);
    return this.prisma.branchSpecialHours.upsert({
      where: {
        branchId_date: {
          branchId: dto.branchId,
          date: dateObj,
        },
      },
      create: {
        branchId: dto.branchId,
        date: dateObj,
        openTime: dto.openTime,
        closeTime: dto.closeTime,
        isClosed: dto.isClosed ?? false,
        note: dto.note,
      },
      update: {
        openTime: dto.openTime,
        closeTime: dto.closeTime,
        isClosed: dto.isClosed ?? false,
        note: dto.note,
      },
    });
  }

  async deleteSpecialHours(id: string) {
    return this.prisma.branchSpecialHours.delete({ where: { id } });
  }
}
