import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InventoryTransactionType,
  InventoryExceptionType,
  InventoryTrackingPolicy,
  Prisma,
} from '@prisma/client';

export interface RecordTransactionParams {
  ingredientId: string;
  branchId: string;
  warehouseId: string;
  type: InventoryTransactionType;
  quantityIn?: number;
  quantityOut?: number;
  unitSymbol: string;
  unitCost?: number;
  batchId?: string;
  sourceReference?: string;
  orderId?: string;
  orderItemId?: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  stockTransferId?: string;
  stocktakeId?: string;
  wasteId?: string;
  actorId?: string;
  actorName?: string;
  notes?: string;
  idempotencyKey?: string;
  allowNegativeStock?: boolean;
  allowExpiredBatch?: boolean;
  allowQuarantinedBatch?: boolean;
  correlationId?: string;
}

@Injectable()
export class InventoryLedgerService {
  private readonly logger = new Logger(InventoryLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateTransactionCode(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `ITX-${y}${m}${d}-${rnd}`;
  }

  private async logExceptionSafe(data: {
    branchId: string;
    warehouseId?: string;
    orderId?: string;
    orderItemId?: string;
    ingredientId?: string;
    ingredientName?: string;
    exceptionType: InventoryExceptionType;
    policyApplied?: InventoryTrackingPolicy;
    severity?: string;
    failureReason: string;
    recommendedAction?: string;
    correlationId?: string;
    actorId?: string;
    actorName?: string;
  }) {
    try {
      if ((this.prisma as any).inventoryOperationalException?.create) {
        await this.prisma.inventoryOperationalException.create({
          data: {
            branchId: data.branchId,
            warehouseId: data.warehouseId,
            orderId: data.orderId,
            orderItemId: data.orderItemId,
            ingredientId: data.ingredientId,
            ingredientName: data.ingredientName,
            exceptionType: data.exceptionType,
            policyApplied: data.policyApplied || InventoryTrackingPolicy.STRICT_TRACKING,
            severity: data.severity || 'CRITICAL',
            failureReason: data.failureReason,
            recommendedAction: data.recommendedAction,
            correlationId: data.correlationId,
            actorId: data.actorId,
            actorName: data.actorName,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed persisting inventory exception: ${err?.message}`);
    }
  }

  /**
   * Ghi nhận giao dịch sổ cái kho (IMMUTABLE INVENTORY LEDGER)
   * Sử dụng database transaction, khóa hàng InnoDB (FOR UPDATE), idempotency key và FEFO đa lô
   */
  async recordTransaction(
    params: RecordTransactionParams,
    externalTx?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      // 1. Kiểm tra idempotency key nhanh (fast-path trước khi khóa hàng)
      if (params.idempotencyKey) {
        const fastExisting = await tx.inventoryTransaction.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (fastExisting) {
          this.logger.warn(`Idempotent retry detected for transaction: ${params.idempotencyKey}`);
          return fastExisting;
        }
      }

      // 2. Lấy thông tin nguyên liệu
      const ingredient = await tx.ingredient.findUnique({
        where: { id: params.ingredientId },
        select: { id: true, name: true, costPerPrimaryUnit: true, averagePurchaseCost: true },
      });
      if (!ingredient) {
        throw new BadRequestException(`Không tìm thấy nguyên liệu có ID '${params.ingredientId}'`);
      }

      // 3. Khóa hàng số dư kho hiện tại (Row Lock: SELECT FOR UPDATE)
      await tx.$executeRawUnsafe(
        'SELECT * FROM `InventoryBalance` WHERE `ingredientId` = ? AND `warehouseId` = ? FOR UPDATE',
        params.ingredientId,
        params.warehouseId,
      );

      // 3b. Re-check idempotency key sau khi giữ khóa hàng (bắt race condition giữa các retry song song)
      if (params.idempotencyKey) {
        const lockedExisting = await tx.inventoryTransaction.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (lockedExisting) {
          this.logger.warn(`Idempotent concurrent retry serialized cleanly: ${params.idempotencyKey}`);
          return lockedExisting;
        }
      }

      let balance = await tx.inventoryBalance.findUnique({
        where: {
          ingredientId_warehouseId: {
            ingredientId: params.ingredientId,
            warehouseId: params.warehouseId,
          },
        },
      });

      if (!balance) {
        balance = await tx.inventoryBalance.create({
          data: {
            ingredientId: params.ingredientId,
            warehouseId: params.warehouseId,
            currentStock: 0,
            reservedStock: 0,
            availableStock: 0,
            valuation: 0,
          },
        });
      }

      const qtyIn = Number(params.quantityIn || 0);
      const qtyOut = Number(params.quantityOut || 0);
      const netChange = qtyIn - qtyOut;

      const beforeQty = Number(balance.currentStock);
      const afterQty = Math.round((beforeQty + netChange) * 10000) / 10000;

      // 4. Kiểm tra âm kho & log ngoại lệ nếu bị chặn
      if (afterQty < 0 && !params.allowNegativeStock) {
        const msg = `Kho không đủ tồn cho nguyên liệu '${ingredient.name}'. Tồn hiện tại: ${beforeQty}, Yêu cầu xuất: ${qtyOut}`;
        await this.logExceptionSafe({
          branchId: params.branchId,
          warehouseId: params.warehouseId,
          orderId: params.orderId,
          orderItemId: params.orderItemId,
          ingredientId: params.ingredientId,
          ingredientName: ingredient.name,
          exceptionType: InventoryExceptionType.NEGATIVE_STOCK_ATTEMPT,
          severity: 'CRITICAL',
          failureReason: msg,
          recommendedAction: 'Kiểm tra tồn kho thực tế, lập phiếu nhập hàng (GRN) hoặc kiểm kê cân chỉnh kho.',
          correlationId: params.correlationId,
          actorId: params.actorId,
          actorName: params.actorName,
        });
        throw new BadRequestException(msg);
      }

      const unitCost =
        params.unitCost !== undefined ? Number(params.unitCost) : Number(ingredient.costPerPrimaryUnit);
      const totalCost = Math.round((qtyIn > 0 ? qtyIn : qtyOut) * unitCost * 100) / 100;

      // 5. Cập nhật số dư kho
      const reserved = Number(balance.reservedStock);
      const newAvailable = Math.max(0, Math.round((afterQty - reserved) * 10000) / 10000);
      const newValuation = Math.max(0, Math.round(afterQty * Number(ingredient.costPerPrimaryUnit) * 100) / 100);

      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          currentStock: afterQty,
          availableStock: newAvailable,
          valuation: newValuation,
          lastReceivedAt: qtyIn > 0 ? new Date() : balance.lastReceivedAt,
          lastConsumedAt: qtyOut > 0 ? new Date() : balance.lastConsumedAt,
        },
      });

      // 6. Xử lý trừ Lô hàng đa lô chuẩn FEFO (First Expired, First Out) & chặn lô hết hạn / cách ly
      const now = new Date();
      const batchAllocations: Array<{ batchId: string; batchNumber: string; qty: number }> = [];
      let effectiveBatchId = params.batchId;

      if (qtyOut > 0 && !effectiveBatchId) {
        const batchWhere: any = {
          ingredientId: params.ingredientId,
          warehouseId: params.warehouseId,
          status: 'ACTIVE',
          remainingQuantity: { gt: 0 },
        };
        if (!params.allowExpiredBatch) {
          batchWhere.expirationDate = { gte: now };
        }

        // Hỗ trợ ngược với unit test mock `findFirst` nếu `findMany` trả undefined
        const activeBatches =
          (typeof (tx.ingredientBatch as any).findMany === 'function'
            ? await tx.ingredientBatch.findMany({
                where: batchWhere,
                orderBy: { expirationDate: 'asc' },
              })
            : undefined) || [];

        let candidateBatches = activeBatches;
        if (candidateBatches.length === 0) {
          const single = await tx.ingredientBatch.findFirst({
            where: batchWhere,
            orderBy: { expirationDate: 'asc' },
          });
          if (single) candidateBatches = [single];
        }

        let remToDeduct = qtyOut;
        for (const batch of candidateBatches) {
          if (remToDeduct <= 0) break;
          const remaining = Number(batch.remainingQuantity);
          if (remaining <= 0) continue;

          const deduct = Math.min(remaining, remToDeduct);
          const newRemaining = Math.max(0, Math.round((remaining - deduct) * 10000) / 10000);

          await tx.ingredientBatch.update({
            where: { id: batch.id },
            data: {
              remainingQuantity: newRemaining,
              status: newRemaining <= 0 ? 'DEPLETED' : 'ACTIVE',
            },
          });

          batchAllocations.push({
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            qty: deduct,
          });
          remToDeduct = Math.round((remToDeduct - deduct) * 10000) / 10000;
        }
      } else if (qtyOut > 0 && effectiveBatchId) {
        const b = await tx.ingredientBatch.findUnique({ where: { id: effectiveBatchId } });
        if (b) {
          if (b.status === 'QUARANTINED' && !params.allowQuarantinedBatch) {
            const msg = `Lô hàng '${b.batchNumber}' đang bị cách ly kiểm định (QUARANTINED), không thể xuất kho`;
            await this.logExceptionSafe({
              branchId: params.branchId,
              warehouseId: params.warehouseId,
              ingredientId: params.ingredientId,
              ingredientName: ingredient.name,
              exceptionType: InventoryExceptionType.QUARANTINED_BATCH_BLOCKED,
              failureReason: msg,
              actorId: params.actorId,
              actorName: params.actorName,
            });
            throw new BadRequestException(msg);
          }

          if (b.expirationDate && b.expirationDate < now && !params.allowExpiredBatch) {
            const msg = `Lô hàng '${b.batchNumber}' đã hết hạn sử dụng (${b.expirationDate.toISOString().split('T')[0]}), không thể xuất chế biến`;
            await this.logExceptionSafe({
              branchId: params.branchId,
              warehouseId: params.warehouseId,
              ingredientId: params.ingredientId,
              ingredientName: ingredient.name,
              exceptionType: InventoryExceptionType.EXPIRED_BATCH_BLOCKED,
              failureReason: msg,
              recommendedAction: 'Chuyển lô hết hạn sang phiếu Hủy / Hao hụt (EXPIRED).',
              actorId: params.actorId,
              actorName: params.actorName,
            });
            throw new BadRequestException(msg);
          }

          const newRem = Math.max(0, Math.round((Number(b.remainingQuantity) - qtyOut) * 10000) / 10000);
          await tx.ingredientBatch.update({
            where: { id: b.id },
            data: {
              remainingQuantity: newRem,
              status: newRem <= 0 ? 'DEPLETED' : 'ACTIVE',
            },
          });
        }
      }

      // 7. Tạo bản ghi Sổ cái (InventoryTransaction) — nếu tách đa lô FEFO thì ghi liên tiếp từng lô để truy xuất nguồn gốc 100%
      if (batchAllocations.length > 1) {
        let runningBefore = beforeQty;
        let firstRecord: any = null;
        let allocatedSum = 0;

        for (let idx = 0; idx < batchAllocations.length; idx++) {
          const alloc = batchAllocations[idx];
          allocatedSum += alloc.qty;
          const runningAfter = Math.round((runningBefore - alloc.qty) * 10000) / 10000;
          const allocCost = Math.round(alloc.qty * unitCost * 100) / 100;
          const subKey =
            params.idempotencyKey && idx === 0
              ? params.idempotencyKey
              : params.idempotencyKey
              ? `${params.idempotencyKey}__split_${idx}`
              : undefined;

          const rec = await tx.inventoryTransaction.create({
            data: {
              transactionCode: this.generateTransactionCode(),
              ingredientId: params.ingredientId,
              ingredientNameSnapshot: ingredient.name,
              branchId: params.branchId,
              warehouseId: params.warehouseId,
              batchId: alloc.batchId,
              type: params.type,
              quantityIn: 0,
              quantityOut: alloc.qty,
              unitSymbol: params.unitSymbol,
              unitCost,
              totalCost: allocCost,
              beforeQuantity: runningBefore,
              afterQuantity: runningAfter,
              sourceReference: params.sourceReference,
              orderId: params.orderId,
              orderItemId: params.orderItemId,
              purchaseOrderId: params.purchaseOrderId,
              goodsReceiptId: params.goodsReceiptId,
              stockTransferId: params.stockTransferId,
              stocktakeId: params.stocktakeId,
              wasteId: params.wasteId,
              actorId: params.actorId,
              actorName: params.actorName,
              notes: `${params.notes ? `${params.notes} | ` : ''}FEFO Lot: ${alloc.batchNumber}`,
              idempotencyKey: subKey,
            },
          });

          if (!firstRecord) firstRecord = rec;
          runningBefore = runningAfter;
        }

        // Phần dư không gắn lô nếu tồn tổng lớn hơn tổng các lô
        const unbatchedRemainder = Math.round((qtyOut - allocatedSum) * 10000) / 10000;
        if (unbatchedRemainder > 0) {
          await tx.inventoryTransaction.create({
            data: {
              transactionCode: this.generateTransactionCode(),
              ingredientId: params.ingredientId,
              ingredientNameSnapshot: ingredient.name,
              branchId: params.branchId,
              warehouseId: params.warehouseId,
              batchId: null,
              type: params.type,
              quantityIn: 0,
              quantityOut: unbatchedRemainder,
              unitSymbol: params.unitSymbol,
              unitCost,
              totalCost: Math.round(unbatchedRemainder * unitCost * 100) / 100,
              beforeQuantity: runningBefore,
              afterQuantity: afterQty,
              sourceReference: params.sourceReference,
              orderId: params.orderId,
              orderItemId: params.orderItemId,
              actorId: params.actorId,
              actorName: params.actorName,
              notes: `${params.notes ? `${params.notes} | ` : ''}Unbatched remainder`,
              idempotencyKey: params.idempotencyKey ? `${params.idempotencyKey}__rem` : undefined,
            },
          });
        }

        return firstRecord;
      }

      // Giao dịch đơn lô hoặc nhập kho
      const finalBatchId = batchAllocations[0]?.batchId || effectiveBatchId || null;
      const txRecord = await tx.inventoryTransaction.create({
        data: {
          transactionCode: this.generateTransactionCode(),
          ingredientId: params.ingredientId,
          ingredientNameSnapshot: ingredient.name,
          branchId: params.branchId,
          warehouseId: params.warehouseId,
          batchId: finalBatchId,
          type: params.type,
          quantityIn: qtyIn,
          quantityOut: qtyOut,
          unitSymbol: params.unitSymbol,
          unitCost,
          totalCost,
          beforeQuantity: beforeQty,
          afterQuantity: afterQty,
          sourceReference: params.sourceReference,
          orderId: params.orderId,
          orderItemId: params.orderItemId,
          purchaseOrderId: params.purchaseOrderId,
          goodsReceiptId: params.goodsReceiptId,
          stockTransferId: params.stockTransferId,
          stocktakeId: params.stocktakeId,
          wasteId: params.wasteId,
          actorId: params.actorId,
          actorName: params.actorName,
          notes: params.notes,
          idempotencyKey: params.idempotencyKey,
        },
      });

      return txRecord;
    };

    if (externalTx) {
      return run(externalTx);
    } else {
      return this.prisma.$transaction(run);
    }
  }

  /**
   * Lấy lịch sử giao dịch sổ cái (Inventory Ledger History)
   */
  async getTransactions(query: {
    branchId?: string;
    warehouseId?: string;
    ingredientId?: string;
    type?: InventoryTransactionType;
    startDate?: string;
    endDate?: string;
    page?: number | string;
    limit?: number | string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const { branchId, warehouseId, ingredientId, type, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (ingredientId) where.ingredientId = ingredientId;
    if (type) where.type = type;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ingredient: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          branch: { select: { id: true, name: true, branchCode: true } },
          batch: { select: { id: true, batchNumber: true, expirationDate: true } },
        },
      }),
      this.prisma.inventoryTransaction.count({ where }),
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
}
