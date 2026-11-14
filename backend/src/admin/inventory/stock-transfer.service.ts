import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import {
  CreateStockTransferDto,
  DispatchStockTransferDto,
  ReceiveStockTransferDto,
} from './dto/stock-transfer.dto';
import { StockTransferStatus, InventoryTransactionType } from '@prisma/client';

@Injectable()
export class StockTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: InventoryLedgerService,
  ) {}

  async getTransfers(branchId?: string) {
    const where: any = {};
    if (branchId) {
      where.OR = [
        { fromBranchId: branchId },
        { toBranchId: branchId },
      ];
    }

    return this.prisma.stockTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        fromBranch: { select: { id: true, name: true, branchCode: true } },
        toBranch: { select: { id: true, name: true, branchCode: true } },
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: { ingredient: { include: { primaryUnit: true } } },
        },
      },
    });
  }

  async createTransfer(dto: CreateStockTransferDto, actor?: { id: string; fullName?: string }) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Kho xuất và kho nhận không được trùng nhau');
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const transferCode = `TRF-${y}${m}${d}-${rnd}`;

    return this.prisma.stockTransfer.create({
      data: {
        transferCode,
        fromBranchId: dto.fromBranchId,
        fromWarehouseId: dto.fromWarehouseId,
        toBranchId: dto.toBranchId,
        toWarehouseId: dto.toWarehouseId,
        status: StockTransferStatus.REQUESTED,
        requestedById: actor?.id,
        requestedByName: actor?.fullName,
        notes: dto.notes,
        items: {
          create: dto.items.map((i) => ({
            ingredientId: i.ingredientId,
            batchId: i.batchId || null,
            requestedQuantity: i.requestedQuantity,
            unitSymbol: i.unitSymbol,
            notes: i.notes,
          })),
        },
      },
      include: { items: true },
    });
  }

  async approveTransfer(id: string, actor?: { id: string; fullName?: string }) {
    const transfer = await this.prisma.stockTransfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException(`Không tìm thấy phiếu chuyển kho '${id}'`);

    if (transfer.requestedById && actor?.id && transfer.requestedById === actor.id) {
      throw new ForbiddenException(
        'Vi phạm kiểm soát chéo (Segregation of Duties): Người yêu cầu chuyển kho không được tự phê duyệt',
      );
    }

    return this.prisma.stockTransfer.update({
      where: { id },
      data: {
        status: StockTransferStatus.APPROVED,
        approvedById: actor?.id,
        approvedByName: actor?.fullName,
      },
    });
  }

  async dispatchTransfer(id: string, dto: DispatchStockTransferDto, actor?: { id: string; fullName?: string }) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) throw new NotFoundException(`Không tìm thấy phiếu chuyển kho '${id}'`);

    return this.prisma.$transaction(async (tx) => {
      // 1. Xuất kho tại kho nguồn (STOCK_TRANSFER_OUT)
      for (const item of transfer.items) {
        const dispatchQty = Number(item.requestedQuantity);

        // Xuất sổ cái
        await this.ledgerService.recordTransaction(
          {
            ingredientId: item.ingredientId,
            branchId: transfer.fromBranchId,
            warehouseId: transfer.fromWarehouseId,
            batchId: item.batchId || undefined,
            type: InventoryTransactionType.STOCK_TRANSFER_OUT,
            quantityOut: dispatchQty,
            unitSymbol: item.unitSymbol,
            stockTransferId: transfer.id,
            sourceReference: `Xuất chuyển kho ${transfer.transferCode}`,
            actorId: actor?.id,
            actorName: actor?.fullName,
          },
          tx,
        );

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { dispatchedQuantity: dispatchQty },
        });
      }

      // 2. Chuyển trạng thái sang IN_TRANSIT
      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.IN_TRANSIT,
          dispatchedById: actor?.id,
          dispatchedByName: actor?.fullName,
          dispatchedAt: new Date(),
          notes: dto.notes ? `${transfer.notes || ''}\n[Xuất kho]: ${dto.notes}` : transfer.notes,
        },
      });
    });
  }

  async receiveTransfer(id: string, dto: ReceiveStockTransferDto, actor?: { id: string; fullName?: string }) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) throw new NotFoundException(`Không tìm thấy phiếu chuyển kho '${id}'`);

    return this.prisma.$transaction(async (tx) => {
      // 1. Nhập kho tại kho đích (STOCK_TRANSFER_IN)
      for (const recItem of dto.receivedItems) {
        const transferItem = transfer.items.find((i) => i.id === recItem.transferItemId);
        if (!transferItem || recItem.receivedQuantity <= 0) continue;

        const recQty = recItem.receivedQuantity;

        await this.ledgerService.recordTransaction(
          {
            ingredientId: transferItem.ingredientId,
            branchId: transfer.toBranchId,
            warehouseId: transfer.toWarehouseId,
            batchId: transferItem.batchId || undefined,
            type: InventoryTransactionType.STOCK_TRANSFER_IN,
            quantityIn: recQty,
            unitSymbol: transferItem.unitSymbol,
            stockTransferId: transfer.id,
            sourceReference: `Nhập chuyển kho ${transfer.transferCode}`,
            actorId: actor?.id,
            actorName: actor?.fullName,
          },
          tx,
        );

        await tx.stockTransferItem.update({
          where: { id: transferItem.id },
          data: { receivedQuantity: recQty },
        });
      }

      // 2. Cập nhật trạng thái phiếu chuyển kho
      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.RECEIVED,
          receivedById: actor?.id,
          receivedByName: actor?.fullName,
          receivedAt: new Date(),
          notes: dto.notes ? `${transfer.notes || ''}\n[Nhận kho]: ${dto.notes}` : transfer.notes,
        },
      });
    });
  }
}

