import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { CreateInventoryWasteDto, ReviewInventoryWasteDto } from './dto/waste.dto';
import { InventoryTransactionType, InventoryWasteReason } from '@prisma/client';

@Injectable()
export class WasteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: InventoryLedgerService,
  ) {}

  async getWasteRecords(branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    return this.prisma.inventoryWaste.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        ingredient: { include: { primaryUnit: true, category: true } },
        batch: true,
      },
    });
  }

  async createWasteRecord(dto: CreateInventoryWasteDto, actor?: { id: string; fullName?: string }) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const wasteCode = `WST-${y}${m}${d}-${rnd}`;

    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: dto.ingredientId },
      select: { id: true, name: true, costPerPrimaryUnit: true },
    });
    if (!ingredient) throw new NotFoundException('Không tìm thấy nguyên liệu');

    const unitCost = Number(ingredient.costPerPrimaryUnit);
    const totalLossValue = dto.quantity * unitCost;

    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo phiếu hao hụt
      const waste = await tx.inventoryWaste.create({
        data: {
          wasteCode,
          branchId: dto.branchId,
          warehouseId: dto.warehouseId,
          ingredientId: dto.ingredientId,
          batchId: dto.batchId || null,
          orderId: dto.orderId || null,
          orderItemId: dto.orderItemId || null,
          quantity: dto.quantity,
          unitSymbol: dto.unitSymbol,
          unitCost,
          totalLossValue,
          reason: dto.reason,
          explanation: dto.explanation,
          evidenceImageUrl: dto.evidenceImageUrl,
          notes: dto.notes,
          reportedById: actor?.id,
          reportedByName: actor?.fullName,
        },
      });

      // 2. Xuất kho qua Ledger (Loại giao dịch: WASTE)
      await this.ledgerService.recordTransaction(
        {
          ingredientId: dto.ingredientId,
          branchId: dto.branchId,
          warehouseId: dto.warehouseId,
          batchId: dto.batchId,
          type: InventoryTransactionType.WASTE,
          quantityOut: dto.quantity,
          unitSymbol: dto.unitSymbol,
          unitCost,
          wasteId: waste.id,
          orderId: dto.orderId,
          orderItemId: dto.orderItemId,
          sourceReference: `Phiếu hao hụt ${wasteCode} (${dto.reason})`,
          actorId: actor?.id,
          actorName: actor?.fullName,
          notes: dto.explanation || dto.notes,
          allowExpiredBatch:
            dto.reason === InventoryWasteReason.EXPIRED || dto.reason === InventoryWasteReason.KITCHEN_SPOILAGE,
          allowQuarantinedBatch: true,
        },
        tx,
      );

      return waste;
    });
  }

  async reviewWaste(id: string, dto: ReviewInventoryWasteDto, actor?: { id: string; fullName?: string }) {
    const waste = await this.prisma.inventoryWaste.findUnique({ where: { id } });
    if (!waste) throw new NotFoundException(`Không tìm thấy phiếu hao hụt '${id}'`);

    if (waste.reportedById && actor?.id && waste.reportedById === actor.id) {
      throw new ForbiddenException(
        'Vi phạm nguyên tắc kiểm soát chéo (Segregation of Duties): Người lập phiếu hao hụt không được tự phê duyệt',
      );
    }

    return this.prisma.inventoryWaste.update({
      where: { id },
      data: {
        approvedById: actor?.id,
        approvedByName: actor?.fullName,
        approvedAt: new Date(),
        notes: dto.notes ? `${waste.notes || ''}\n[Duyệt]: ${dto.notes}` : waste.notes,
      },
    });
  }
}

