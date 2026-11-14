import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateIngredientDto,
  UpdateIngredientDto,
  CreateIngredientCategoryDto,
  CreateIngredientUnitDto,
  CreateUnitConversionDto,
} from './dto/ingredient.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';

@Injectable()
export class IngredientService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. CATEGORIES
  async getCategories() {
    return this.prisma.ingredientCategory.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { ingredients: true } },
      },
    });
  }

  async createCategory(dto: CreateIngredientCategoryDto) {
    const existing = await this.prisma.ingredientCategory.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã danh mục '${dto.code}' đã tồn tại`);
    }
    return this.prisma.ingredientCategory.create({ data: dto });
  }

  // 2. UNITS
  async getUnits() {
    return this.prisma.ingredientUnit.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { primaryIngredients: true } },
      },
    });
  }

  async createUnit(dto: CreateIngredientUnitDto) {
    const existing = await this.prisma.ingredientUnit.findUnique({
      where: { symbol: dto.symbol },
    });
    if (existing) {
      throw new BadRequestException(`Ký hiệu đơn vị '${dto.symbol}' đã tồn tại`);
    }
    return this.prisma.ingredientUnit.create({ data: dto });
  }

  // 3. INGREDIENTS
  async getIngredients(query: QueryInventoryDto) {
    const { search, categoryId, status, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ];
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (status === 'ACTIVE') where.isActive = true;
    if (status === 'INACTIVE') where.isActive = false;

    const [items, total] = await Promise.all([
      this.prisma.ingredient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          category: true,
          primaryUnit: true,
          purchaseUnit: true,
          storageUnit: true,
          defaultSupplier: true,
          balances: {
            include: { warehouse: true },
          },
        },
      }),
      this.prisma.ingredient.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getIngredientById(id: string) {
    const item = await this.prisma.ingredient.findUnique({
      where: { id },
      include: {
        category: true,
        primaryUnit: true,
        purchaseUnit: true,
        storageUnit: true,
        defaultSupplier: true,
        balances: {
          include: { warehouse: true },
        },
        batches: {
          where: { status: 'ACTIVE' },
          orderBy: { expirationDate: 'asc' },
        },
        unitConversionsFrom: {
          include: { fromUnit: true, toUnit: true },
        },
      },
    });
    if (!item) {
      throw new NotFoundException(`Không tìm thấy nguyên liệu có ID '${id}'`);
    }
    return item;
  }

  async createIngredient(dto: CreateIngredientDto) {
    const existing = await this.prisma.ingredient.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã nguyên liệu '${dto.code}' đã tồn tại`);
    }

    // Tính toán costPerPrimaryUnit nếu có averagePurchaseCost và purchaseToPrimaryFactor
    const factor = dto.purchaseToPrimaryFactor || 1;
    const avgCost = dto.averagePurchaseCost || 0;
    const costPerPrimary = dto.costPerPrimaryUnit || (factor > 0 ? avgCost / factor : 0);

    return this.prisma.ingredient.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        categoryId: dto.categoryId,
        primaryUnitId: dto.primaryUnitId,
        purchaseUnitId: dto.purchaseUnitId,
        storageUnitId: dto.storageUnitId,
        purchaseToPrimaryFactor: factor,
        storageToPrimaryFactor: dto.storageToPrimaryFactor || 1,
        minimumStock: dto.minimumStock || 0,
        maximumStock: dto.maximumStock || 0,
        reorderThreshold: dto.reorderThreshold || 0,
        averagePurchaseCost: avgCost,
        latestPurchaseCost: dto.latestPurchaseCost || avgCost,
        costPerPrimaryUnit: costPerPrimary,
        defaultSupplierId: dto.defaultSupplierId,
        storageCondition: dto.storageCondition || 'AMBIENT',
        shelfLifeDays: dto.shelfLifeDays,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: {
        category: true,
        primaryUnit: true,
      },
    });
  }

  async updateIngredient(id: string, dto: UpdateIngredientDto) {
    await this.getIngredientById(id);

    const data: any = { ...dto };
    if (dto.averagePurchaseCost !== undefined && dto.purchaseToPrimaryFactor !== undefined) {
      data.costPerPrimaryUnit = dto.averagePurchaseCost / dto.purchaseToPrimaryFactor;
    }

    return this.prisma.ingredient.update({
      where: { id },
      data,
      include: {
        category: true,
        primaryUnit: true,
        purchaseUnit: true,
      },
    });
  }

  // 4. UNIT CONVERSIONS
  async addUnitConversion(dto: CreateUnitConversionDto) {
    return this.prisma.ingredientUnitConversion.upsert({
      where: {
        ingredientId_fromUnitId_toUnitId: {
          ingredientId: dto.ingredientId,
          fromUnitId: dto.fromUnitId,
          toUnitId: dto.toUnitId,
        },
      },
      update: {
        conversionFactor: dto.conversionFactor,
        notes: dto.notes,
      },
      create: {
        ingredientId: dto.ingredientId,
        fromUnitId: dto.fromUnitId,
        toUnitId: dto.toUnitId,
        conversionFactor: dto.conversionFactor,
        notes: dto.notes,
      },
      include: {
        fromUnit: true,
        toUnit: true,
      },
    });
  }
}

