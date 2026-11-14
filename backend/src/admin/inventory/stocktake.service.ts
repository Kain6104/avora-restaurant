import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import {
  CreateStocktakeDto,
  SubmitStocktakeCountsDto,
  ReviewStocktakeDto,
} from './dto/stocktake.dto';
import { StocktakeStatus, InventoryTransactionType } from '@prisma/client';

const OPENING_TYPE_TAG = '[TYPE:OPENING_BALANCE]';

@Injectable()
export class StocktakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: InventoryLedgerService,
  ) {}

  private isOpeningStocktake(stocktake: { stocktakeCode?: string; notes?: string | null }): boolean {
    return (
      Boolean(stocktake.stocktakeCode?.startsWith('STK-OPEN-')) ||
      Boolean(stocktake.notes?.includes(OPENING_TYPE_TAG))
    );
  }

  private encodeCountBatchNotes(
    notes: string | undefined,
    batchNumber?: string,
    expirationDate?: string,
    unitCost?: number,
  ): string | undefined {
    const meta: Record<string, unknown> = {};
    if (batchNumber) meta.batchNumber = batchNumber;
    if (expirationDate) meta.expirationDate = expirationDate;
    if (unitCost !== undefined) meta.unitCost = unitCost;
    if (Object.keys(meta).length === 0) return notes;
    const prefix = `[BATCH_META:${JSON.stringify(meta)}]`;
    return notes ? `${prefix} ${notes}` : prefix;
  }

  private parseCountBatchMeta(notes?: string | null): {
    batchNumber?: string;
    expirationDate?: string;
    unitCost?: number;
  } {
    if (!notes) return {};
    const m = notes.match(/\[BATCH_META:(\{.*?\})\]/);
    if (!m) return {};
    try {
      return JSON.parse(m[1]);
    } catch {
      return {};
    }
  }

  async getStocktakes(branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    return this.prisma.stocktake.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: { ingredient: { include: { primaryUnit: true } } },
        },
      },
    });
  }

  async getStocktakeById(id: string) {
    const s = await this.prisma.stocktake.findUnique({
      where: { id },
      include: {
        branch: true,
        warehouse: true,
        items: {
          include: {
            ingredient: { include: { primaryUnit: true, category: true } },
            batch: true,
          },
        },
      },
    });
    if (!s) throw new NotFoundException(`Không tìm thấy phiên kiểm kê '${id}'`);
    return s;
  }

  async createStocktake(dto: CreateStocktakeDto, actor?: { id: string; fullName?: string }) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const isOpening = dto.stocktakeType === 'OPENING_BALANCE';
    const stocktakeCode = isOpening ? `STK-OPEN-${y}${m}${d}-${rnd}` : `STK-${y}${m}${d}-${rnd}`;
    const taggedNotes = isOpening
      ? `${OPENING_TYPE_TAG}${dto.notes ? ` ${dto.notes}` : ''}`
      : dto.notes;

    const balances = await this.prisma.inventoryBalance.findMany({
      where: { warehouseId: dto.warehouseId },
      include: { ingredient: { include: { primaryUnit: true } } },
    });

    const snapshotItems: Array<{
      ingredientId: string;
      systemQuantity: number;
      unitSymbol: string;
      unitCost: number;
    }> = balances.map((b) => ({
      ingredientId: b.ingredientId,
      systemQuantity: Number(b.currentStock),
      unitSymbol: b.ingredient.primaryUnit.symbol,
      unitCost: Number(b.ingredient.costPerPrimaryUnit),
    }));

    // For OPENING_BALANCE or empty warehouses (e.g. BAR_STORAGE), allow snapshotting all active ingredients
    if ((dto.includeAllIngredients || isOpening) && typeof (this.prisma as any).ingredient?.findMany === 'function') {
      const existingIds = new Set(snapshotItems.map((x) => x.ingredientId));
      const allIngs = await this.prisma.ingredient.findMany({
        where: { isActive: true },
        include: { primaryUnit: true },
      });
      for (const ing of allIngs) {
        if (!existingIds.has(ing.id)) {
          snapshotItems.push({
            ingredientId: ing.id,
            systemQuantity: 0,
            unitSymbol: ing.primaryUnit.symbol,
            unitCost: Number(ing.costPerPrimaryUnit),
          });
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const stocktake = await tx.stocktake.create({
        data: {
          stocktakeCode,
          warehouseId: dto.warehouseId,
          branchId: dto.branchId,
          status: StocktakeStatus.IN_PROGRESS,
          isBlindCount: isOpening ? true : Boolean(dto.isBlindCount),
          notes: taggedNotes,
          conductedById: actor?.id,
          conductedByName: actor?.fullName,
        },
      });

      for (const item of snapshotItems) {
        await tx.stocktakeItem.create({
          data: {
            stocktakeId: stocktake.id,
            ingredientId: item.ingredientId,
            systemQuantity: item.systemQuantity,
            actualQuantity: isOpening ? 0 : item.systemQuantity,
            varianceQuantity: isOpening ? -item.systemQuantity : 0,
            unitSymbol: item.unitSymbol,
            unitCost: item.unitCost,
            varianceValue: isOpening ? -item.systemQuantity * item.unitCost : 0,
          },
        });
      }

      return stocktake;
    });
  }

  async submitCounts(id: string, dto: SubmitStocktakeCountsDto, _actor?: { id: string; fullName?: string }) {
    const stocktake = await this.getStocktakeById(id);
    if (stocktake.status !== StocktakeStatus.IN_PROGRESS && stocktake.status !== StocktakeStatus.DRAFT) {
      throw new BadRequestException('Phiên kiểm kê không ở trạng thái có thể nhập số liệu đếm');
    }

    return this.prisma.$transaction(async (tx) => {
      let totalSys = 0;
      let totalAct = 0;
      let totalVarQty = 0;
      let totalVarVal = 0;

      for (const count of dto.counts) {
        let item = stocktake.items.find((i) => i.ingredientId === count.ingredientId);
        if (!item && this.isOpeningStocktake(stocktake) && typeof (tx as any).ingredient?.findUnique === 'function') {
          const ing = await tx.ingredient.findUnique({
            where: { id: count.ingredientId },
            include: { primaryUnit: true },
          });
          if (ing) {
            item = (await tx.stocktakeItem.create({
              data: {
                stocktakeId: stocktake.id,
                ingredientId: ing.id,
                systemQuantity: 0,
                actualQuantity: count.actualQuantity,
                varianceQuantity: count.actualQuantity,
                unitSymbol: ing.primaryUnit.symbol,
                unitCost: count.unitCost ?? Number(ing.costPerPrimaryUnit),
                varianceValue: count.actualQuantity * (count.unitCost ?? Number(ing.costPerPrimaryUnit)),
              },
            })) as any;
          }
        }
        if (!item) continue;

        const sysQty = Number(item.systemQuantity);
        const actQty = count.actualQuantity;
        const effectiveCost = count.unitCost !== undefined ? count.unitCost : Number(item.unitCost);
        const varQty = actQty - sysQty;
        const varVal = varQty * effectiveCost;

        totalSys += sysQty;
        totalAct += actQty;
        totalVarQty += varQty;
        totalVarVal += varVal;

        const encodedNotes = this.encodeCountBatchNotes(
          count.notes,
          count.batchNumber,
          count.expirationDate,
          count.unitCost,
        );

        await tx.stocktakeItem.update({
          where: { id: item.id },
          data: {
            actualQuantity: actQty,
            unitCost: effectiveCost,
            varianceQuantity: varQty,
            varianceValue: varVal,
            reason: count.reason,
            notes: encodedNotes,
          },
        });
      }

      return tx.stocktake.update({
        where: { id },
        data: {
          status: StocktakeStatus.SUBMITTED,
          totalSystemQuantity: totalSys,
          totalActualQuantity: totalAct,
          totalVarianceQuantity: totalVarQty,
          totalVarianceValue: totalVarVal,
          conductedAt: new Date(),
          notes: dto.notes ? `${stocktake.notes || ''}\n[Gửi duyệt]: ${dto.notes}` : stocktake.notes,
        },
      });
    });
  }

  async reviewStocktake(id: string, dto: ReviewStocktakeDto, actor?: { id: string; fullName?: string }) {
    const stocktake = await this.getStocktakeById(id);
    if (stocktake.status !== StocktakeStatus.SUBMITTED) {
      throw new BadRequestException('Phiên kiểm kê chưa được gửi số liệu đếm để duyệt');
    }

    if (stocktake.conductedById && actor?.id && stocktake.conductedById === actor.id) {
      throw new ForbiddenException(
        'Vi phạm kiểm soát chéo (Segregation of Duties): Nhân viên thực hiện kiểm đếm không được tự phê duyệt chênh lệch kho',
      );
    }

    if (!dto.approved) {
      return this.prisma.stocktake.update({
        where: { id },
        data: {
          status: StocktakeStatus.REJECTED,
          approvedById: actor?.id,
          approvedByName: actor?.fullName,
          approvedAt: new Date(),
          notes: dto.notes ? `${stocktake.notes || ''}\n[Từ chối]: ${dto.notes}` : stocktake.notes,
        },
      });
    }

    const isOpening = this.isOpeningStocktake(stocktake);

    return this.prisma.$transaction(async (tx) => {
      for (const item of stocktake.items) {
        const actQty = Number(item.actualQuantity);
        const varQty = Number(item.varianceQuantity);

        if (isOpening) {
          if (actQty <= 0) continue;

          const batchMeta = this.parseCountBatchMeta(item.notes);
          let batchId = item.batchId || undefined;
          const unitCost = batchMeta.unitCost ?? Number(item.unitCost);

          if (!batchId && batchMeta.batchNumber && typeof (tx as any).ingredientBatch?.create === 'function') {
            const expDate = batchMeta.expirationDate
              ? new Date(batchMeta.expirationDate)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const batch = await tx.ingredientBatch.create({
              data: {
                batchNumber: batchMeta.batchNumber,
                ingredientId: item.ingredientId,
                warehouseId: stocktake.warehouseId,
                expirationDate: expDate,
                initialQuantity: actQty,
                remainingQuantity: actQty,
                unitCost,
                status: 'ACTIVE',
                notes: `Opening stocktake ${stocktake.stocktakeCode}`,
              },
            });
            batchId = batch.id;
            await tx.stocktakeItem.update({
              where: { id: item.id },
              data: { batchId },
            });
          }

          await this.ledgerService.recordTransaction(
            {
              ingredientId: item.ingredientId,
              branchId: stocktake.branchId,
              warehouseId: stocktake.warehouseId,
              type: InventoryTransactionType.OPENING_BALANCE,
              quantityIn: actQty,
              unitSymbol: item.unitSymbol,
              unitCost,
              batchId,
              stocktakeId: stocktake.id,
              sourceReference: `Mở kỳ ${stocktake.stocktakeCode}`,
              actorId: actor?.id,
              actorName: actor?.fullName,
              idempotencyKey: `OPENING-${stocktake.id}-${item.id}`,
              notes: item.reason || 'Ghi nhận tồn đầu kỳ chính thức (Physical Opening Stocktake)',
            },
            tx,
          );
          continue;
        }

        if (varQty === 0) continue;

        if (varQty > 0) {
          await this.ledgerService.recordTransaction(
            {
              ingredientId: item.ingredientId,
              branchId: stocktake.branchId,
              warehouseId: stocktake.warehouseId,
              type: InventoryTransactionType.STOCK_COUNT_GAIN,
              quantityIn: varQty,
              unitSymbol: item.unitSymbol,
              unitCost: Number(item.unitCost),
              stocktakeId: stocktake.id,
              sourceReference: `Kiểm kê thừa ${stocktake.stocktakeCode}`,
              actorId: actor?.id,
              actorName: actor?.fullName,
              notes: item.reason || 'Điều chỉnh thừa sau kiểm kê',
            },
            tx,
          );
        } else {
          await this.ledgerService.recordTransaction(
            {
              ingredientId: item.ingredientId,
              branchId: stocktake.branchId,
              warehouseId: stocktake.warehouseId,
              type: InventoryTransactionType.STOCK_COUNT_LOSS,
              quantityOut: Math.abs(varQty),
              unitSymbol: item.unitSymbol,
              unitCost: Number(item.unitCost),
              stocktakeId: stocktake.id,
              sourceReference: `Kiểm kê thiếu ${stocktake.stocktakeCode}`,
              actorId: actor?.id,
              actorName: actor?.fullName,
              notes: item.reason || 'Điều chỉnh thiếu sau kiểm kê',
            },
            tx,
          );
        }
      }

      return tx.stocktake.update({
        where: { id },
        data: {
          status: StocktakeStatus.COMPLETED,
          approvedById: actor?.id,
          approvedByName: actor?.fullName,
          approvedAt: new Date(),
          notes: dto.notes ? `${stocktake.notes || ''}\n[Duyệt]: ${dto.notes}` : stocktake.notes,
        },
      });
    });
  }

  async exportBlindStocktakeSheet(branchId?: string) {
    const [warehouses, ingredients] = await Promise.all([
      this.prisma.warehouse.findMany({
        where: { isActive: true, ...(branchId ? { branchId } : {}) },
        include: { branch: { select: { branchCode: true, name: true } } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.ingredient.findMany({
        where: { isActive: true },
        include: { primaryUnit: true, purchaseUnit: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    const rows: Record<string, any>[] = [];
    for (const wh of warehouses) {
      for (const ing of ingredients) {
        rows.push({
          'Warehouse Code': wh.code,
          'Branch Code': wh.branch?.branchCode || 'CENTRAL',
          'Storage Zone': wh.storageZone || '',
          'Ingredient Code': ing.code,
          'Ingredient Name': ing.name,
          'Primary Unit': ing.primaryUnit?.symbol || '',
          'Purchase Unit': ing.purchaseUnit?.symbol || '',
          'Purchase-to-Primary Factor': ing.purchaseToPrimaryFactor,
          'Physical Available Count (Blank - Blind)': '',
          'Physical Reserved Count': '',
          'Damaged Qty': '',
          'Expired Qty': '',
          'Quarantined Qty': '',
          'Batch Number (Lot)': '',
          'Expiration Date (YYYY-MM-DD)': '',
          'Verified Unit Cost VND': '',
          'Counted By (Staff)': '',
          'Approved By (Manager != Counter)': '',
          'Evidence Ref': '',
        });
      }
    }

    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv =
      rows.length === 0
        ? ''
        : [
            Object.keys(rows[0]).map(esc).join(','),
            ...rows.map((r) => Object.keys(rows[0]).map((h) => esc(r[h])).join(',')),
          ].join('\n');

    return {
      warehouseCount: warehouses.length,
      ingredientCount: ingredients.length,
      totalRows: rows.length,
      csv,
      rows,
    };
  }
}
