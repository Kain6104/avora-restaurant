import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto, CreateWarehouseLocationDto } from './dto/warehouse.dto';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async getWarehouses(branchId?: string) {
    const where: any = {};
    if (branchId) {
      where.OR = [
        { branchId },
        { isCentral: true },
      ];
    }

    return this.prisma.warehouse.findMany({
      where,
      orderBy: [{ isCentral: 'desc' }, { code: 'asc' }],
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        _count: {
          select: { balances: true, batches: true, locations: true },
        },
      },
    });
  }

  async getWarehouseById(id: string) {
    const wh = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        branch: true,
        locations: true,
        balances: {
          include: {
            ingredient: {
              include: { primaryUnit: true, category: true },
            },
          },
          orderBy: { ingredient: { code: 'asc' } },
        },
        batches: {
          where: { status: 'ACTIVE' },
          include: { ingredient: true, supplier: true },
          orderBy: { expirationDate: 'asc' },
        },
      },
    });
    if (!wh) {
      throw new NotFoundException(`Không tìm thấy kho có ID '${id}'`);
    }
    return wh;
  }

  async createWarehouse(dto: CreateWarehouseDto) {
    const existing = await this.prisma.warehouse.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã kho '${dto.code}' đã tồn tại`);
    }

    return this.prisma.warehouse.create({
      data: dto,
      include: { branch: true },
    });
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto) {
    await this.getWarehouseById(id);
    return this.prisma.warehouse.update({
      where: { id },
      data: dto,
      include: { branch: true },
    });
  }

  async createLocation(dto: CreateWarehouseLocationDto) {
    return this.prisma.warehouseLocation.create({
      data: dto,
    });
  }

  async getWarehouseBalances(warehouseId: string) {
    return this.prisma.inventoryBalance.findMany({
      where: { warehouseId },
      include: {
        ingredient: {
          include: { primaryUnit: true, category: true },
        },
      },
      orderBy: { ingredient: { code: 'asc' } },
    });
  }
}

