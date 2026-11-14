import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import {
  CreateSupplierDto,
  CreatePurchaseRequestDto,
  CreatePurchaseOrderDto,
  CreateGoodsReceiptDto,
} from './dto/procurement.dto';
import {
  PurchaseRequestStatus,
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  InventoryTransactionType,
  StorageCondition,
} from '@prisma/client';

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: InventoryLedgerService,
  ) {}

  // 1. SUPPLIERS
  async getSuppliers(includeBankDetails = false) {
    const suppliers = await this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { purchaseOrders: true, batches: true, defaultIngredients: true } },
      },
    });
    if (includeBankDetails) return suppliers;
    return suppliers.map((s) => ({
      ...s,
      bankAccountNumber: s.bankAccountNumber ? `****${s.bankAccountNumber.slice(-4)}` : null,
      bankAccountHolder: s.bankAccountHolder ? '[RESTRICTED_FINANCE_ONLY]' : null,
    }));
  }

  async createSupplier(dto: CreateSupplierDto) {
    const existing = await this.prisma.supplier.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã nhà cung cấp '${dto.code}' đã tồn tại`);
    }
    return this.prisma.supplier.create({ data: dto });
  }

  // 2. PURCHASE REQUESTS (PR)
  async getPurchaseRequests(branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    return this.prisma.purchaseRequest.findMany({
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

  async createPurchaseRequest(dto: CreatePurchaseRequestDto, actor?: { id: string; fullName?: string }) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const requestCode = `PR-${y}${m}${d}-${rnd}`;

    return this.prisma.purchaseRequest.create({
      data: {
        requestCode,
        branchId: dto.branchId,
        warehouseId: dto.warehouseId,
        status: PurchaseRequestStatus.PENDING,
        requiredDate: new Date(dto.requiredDate),
        reason: dto.reason,
        notes: dto.notes,
        requestedById: actor?.id,
        requestedByName: actor?.fullName,
        items: {
          create: dto.items.map((i) => ({
            ingredientId: i.ingredientId,
            requestedQuantity: i.requestedQuantity,
            unitSymbol: i.unitSymbol,
            estimatedCost: i.estimatedCost || 0,
          })),
        },
      },
      include: { items: true },
    });
  }

  async reviewPurchaseRequest(id: string, approved: boolean, actor?: { id: string; fullName?: string }) {
    const pr = await this.prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException(`Không tìm thấy đề xuất mua hàng '${id}'`);

    if (pr.requestedById && actor?.id && pr.requestedById === actor.id) {
      throw new ForbiddenException(
        'Vi phạm kiểm soát chéo (Segregation of Duties): Người tạo đề xuất mua hàng không được tự phê duyệt',
      );
    }

    return this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: approved ? PurchaseRequestStatus.APPROVED : PurchaseRequestStatus.REJECTED,
        approvedById: actor?.id,
        approvedByName: actor?.fullName,
        approvedAt: new Date(),
      },
    });
  }

  // 3. PURCHASE ORDERS (PO)
  async getPurchaseOrders(branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    return this.prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        branch: { select: { id: true, name: true, branchCode: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: { ingredient: { include: { primaryUnit: true } } },
        },
        receipts: true,
      },
    });
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, actor?: { id: string; fullName?: string }) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const orderCode = `PO-${y}${m}${d}-${rnd}`;

    let subtotal = 0;
    let taxAmount = 0;
    const itemsData = dto.items.map((i) => {
      const lineTotal = i.orderQuantity * i.unitPrice;
      const lineTax = lineTotal * ((i.taxPercent || 0) / 100);
      subtotal += lineTotal;
      taxAmount += lineTax;
      return {
        ingredientId: i.ingredientId,
        orderQuantity: i.orderQuantity,
        unitSymbol: i.unitSymbol,
        unitPrice: i.unitPrice,
        taxPercent: i.taxPercent || 0,
        totalAmount: lineTotal + lineTax,
      };
    });

    const shippingFee = dto.shippingFee || 0;
    const totalAmount = subtotal + taxAmount + shippingFee;

    return this.prisma.purchaseOrder.create({
      data: {
        orderCode,
        supplierId: dto.supplierId,
        branchId: dto.branchId,
        warehouseId: dto.warehouseId,
        purchaseRequestId: dto.purchaseRequestId,
        status: PurchaseOrderStatus.PENDING_APPROVAL,
        orderDate: new Date(),
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
        subtotal,
        taxAmount,
        shippingFee,
        totalAmount,
        notes: dto.notes,
        createdById: actor?.id,
        createdByName: actor?.fullName,
        items: {
          create: itemsData,
        },
      },
      include: { items: true },
    });
  }

  async approvePurchaseOrder(id: string, actor?: { id: string; fullName?: string }) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException(`Không tìm thấy đơn đặt hàng '${id}'`);

    if (po.createdById && actor?.id && po.createdById === actor.id) {
      throw new ForbiddenException(
        'Vi phạm kiểm soát chéo (Segregation of Duties): Người lập đơn đặt hàng (PO) không được tự phê duyệt',
      );
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedById: actor?.id,
        approvedByName: actor?.fullName,
        approvedAt: new Date(),
      },
    });
  }

  // 4. GOODS RECEIPT NOTES (GRN)
  async getGoodsReceipts(branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    return this.prisma.goodsReceipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        purchaseOrder: { include: { supplier: true } },
        branch: { select: { id: true, name: true, branchCode: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: { ingredient: { include: { primaryUnit: true } } },
        },
      },
    });
  }

  async createAndConfirmGoodsReceipt(dto: CreateGoodsReceiptDto, actor?: { id: string; fullName?: string }) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const receiptCode = `GRN-${y}${m}${d}-${rnd}`;

    // Kiểm tra PO nếu nhập theo PO: không cho phép nhập hàng trên PO đã hủy hoặc chưa được duyệt
    if (dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: dto.purchaseOrderId },
        select: { id: true, status: true, orderCode: true },
      });
      if (!po) {
        throw new NotFoundException(`Không tìm thấy đơn đặt hàng '${dto.purchaseOrderId}'`);
      }
      if (po.status === PurchaseOrderStatus.CANCELLED) {
        throw new BadRequestException(`Đơn đặt hàng '${po.orderCode}' đã bị HỦY, không thể lập phiếu nhập kho`);
      }
      if (po.status === PurchaseOrderStatus.DRAFT || po.status === PurchaseOrderStatus.PENDING_APPROVAL) {
        throw new BadRequestException(`Đơn đặt hàng '${po.orderCode}' chưa được phê duyệt, không thể nhập kho`);
      }
    }

    // Chặn trùng lặp phiếu nhập theo số hóa đơn nhà cung cấp
    if (dto.supplierInvoiceNumber) {
      const dupGrn = await this.prisma.goodsReceipt.findFirst({
        where: {
          branchId: dto.branchId,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          status: GoodsReceiptStatus.CONFIRMED,
        },
      });
      if (dupGrn) {
        throw new BadRequestException(
          `Số hóa đơn NCC '${dto.supplierInvoiceNumber}' đã được nhập kho tại phiếu ${dupGrn.receiptCode} (Idempotent block)`,
        );
      }
    }

    let totalAmount = 0;
    for (const item of dto.items) {
      totalAmount += item.receivedQuantity * item.unitCost;
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo Goods Receipt
      const receipt = await tx.goodsReceipt.create({
        data: {
          receiptCode,
          purchaseOrderId: dto.purchaseOrderId || null,
          branchId: dto.branchId,
          warehouseId: dto.warehouseId,
          status: GoodsReceiptStatus.CONFIRMED,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          deliveryNoteNumber: dto.deliveryNoteNumber,
          totalAmount,
          receivedById: actor?.id,
          receivedByName: actor?.fullName,
          confirmedById: actor?.id,
          confirmedByName: actor?.fullName,
          confirmedAt: new Date(),
          notes: dto.notes,
        },
      });

      // 2. Xử lý từng dòng hàng với quy đổi đơn vị chính xác & tính bình quân gia quyền (WAC)
      for (const item of dto.items) {
        if (item.receivedQuantity <= 0) continue;

        const ing = await tx.ingredient.findUnique({
          where: { id: item.ingredientId },
          include: {
            primaryUnit: true,
            purchaseUnit: true,
            unitConversionsFrom: {
              include: { fromUnit: true, toUnit: true },
            },
          },
        });
        if (!ing) {
          throw new NotFoundException(`Không tìm thấy nguyên liệu '${item.ingredientId}'`);
        }

        // Xác định hệ số quy đổi về đơn vị cơ sở (Primary Unit)
        let conversionFactor = 1;
        const reqSymbol = (item.unitSymbol || ing.primaryUnit.symbol).trim().toLowerCase();
        const primarySymbol = ing.primaryUnit.symbol.trim().toLowerCase();
        const purchaseSymbol = ing.purchaseUnit?.symbol?.trim().toLowerCase();

        if (reqSymbol === primarySymbol) {
          conversionFactor = 1;
        } else if (purchaseSymbol && reqSymbol === purchaseSymbol) {
          conversionFactor = Number(ing.purchaseToPrimaryFactor || 1);
        } else {
          const matchedConv = ing.unitConversionsFrom?.find(
            (c) =>
              c.fromUnit.symbol.trim().toLowerCase() === reqSymbol &&
              c.toUnit.symbol.trim().toLowerCase() === primarySymbol,
          );
          if (!matchedConv) {
            throw new BadRequestException(
              `Đơn vị '${item.unitSymbol}' chưa được cấu hình quy đổi về đơn vị chuẩn '${ing.primaryUnit.symbol}' cho '${ing.name}'`,
            );
          }
          conversionFactor = Number(matchedConv.conversionFactor);
        }

        const baseQtyReceived = Math.round(item.receivedQuantity * conversionFactor * 10000) / 10000;
        const baseUnitCost = Math.round((item.unitCost / conversionFactor) * 10000) / 10000;

        // Tạo GoodsReceiptItem
        await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: receipt.id,
            purchaseOrderItemId: item.purchaseOrderItemId || null,
            ingredientId: item.ingredientId,
            batchNumber: item.batchNumber,
            expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
            receivedQuantity: item.receivedQuantity,
            rejectedQuantity: item.rejectedQuantity || 0,
            rejectionReason: item.rejectionReason,
            unitSymbol: item.unitSymbol,
            unitCost: item.unitCost,
            totalAmount: Math.round(item.receivedQuantity * item.unitCost * 100) / 100,
            storageLocation: item.storageLocation,
          },
        });

        // Tạo Lô hàng (IngredientBatch) theo đơn vị chuẩn để FEFO trừ chính xác
        let batchId: string | undefined = undefined;
        if (item.expirationDate || item.batchNumber) {
          const batchNumber = item.batchNumber || `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const expDate = item.expirationDate
            ? new Date(item.expirationDate)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          const batch = await tx.ingredientBatch.create({
            data: {
              batchNumber,
              ingredientId: item.ingredientId,
              warehouseId: dto.warehouseId,
              receivedDate: new Date(),
              expirationDate: expDate,
              initialQuantity: baseQtyReceived,
              remainingQuantity: baseQtyReceived,
              unitCost: baseUnitCost,
              status: 'ACTIVE',
              storageCondition: ing.storageCondition || StorageCondition.AMBIENT,
            },
          });
          batchId = batch.id;
        }

        // Lấy tổng tồn hiện tại trên toàn hệ thống trước khi nhập để tính Weighted Average Cost (WAC)
        const existingBalances = await tx.inventoryBalance.aggregate({
          where: { ingredientId: ing.id },
          _sum: { currentStock: true },
        });
        const existingTotalPrimaryQty = Math.max(0, Number(existingBalances._sum.currentStock || 0));
        const oldPrimaryCost = Number(ing.costPerPrimaryUnit || 0);
        const newTotalQty = existingTotalPrimaryQty + baseQtyReceived;
        const newWeightedPrimaryCost =
          newTotalQty > 0
            ? Math.round(
                ((existingTotalPrimaryQty * oldPrimaryCost + baseQtyReceived * baseUnitCost) / newTotalQty) *
                  10000,
              ) / 10000
            : baseUnitCost;
        const purchaseFactor = Number(ing.purchaseToPrimaryFactor || 1);
        const newAveragePurchaseCost = Math.round(newWeightedPrimaryCost * purchaseFactor * 100) / 100;
        const newLatestPurchaseCost = Math.round(baseUnitCost * purchaseFactor * 100) / 100;

        await tx.ingredient.update({
          where: { id: ing.id },
          data: {
            latestPurchaseCost: newLatestPurchaseCost,
            averagePurchaseCost: newAveragePurchaseCost,
            costPerPrimaryUnit: newWeightedPrimaryCost,
          },
        });

        // Ghi Sổ cái nhập kho (PURCHASE_RECEIPT) bằng đơn vị chuẩn
        await this.ledgerService.recordTransaction(
          {
            ingredientId: item.ingredientId,
            branchId: dto.branchId,
            warehouseId: dto.warehouseId,
            batchId,
            type: InventoryTransactionType.PURCHASE_RECEIPT,
            quantityIn: baseQtyReceived,
            unitSymbol: ing.primaryUnit.symbol,
            unitCost: baseUnitCost,
            goodsReceiptId: receipt.id,
            purchaseOrderId: dto.purchaseOrderId,
            sourceReference: `Nhập kho từ ${receipt.receiptCode} (${item.receivedQuantity} ${item.unitSymbol})`,
            actorId: actor?.id,
            actorName: actor?.fullName,
            idempotencyKey: `GRN-${receipt.id}-${item.ingredientId}-${item.batchNumber || 'NOBATCH'}`,
          },
          tx,
        );

        // Cập nhật số lượng đã nhận trên PurchaseOrderItem nếu có
        if (item.purchaseOrderItemId) {
          await tx.purchaseOrderItem.update({
            where: { id: item.purchaseOrderItemId },
            data: { receivedQuantity: { increment: item.receivedQuantity } },
          });
        }
      }

      // 3. Nếu là nhận hàng theo PO, kiểm tra cập nhật trạng thái PO
      if (dto.purchaseOrderId) {
        const po = await tx.purchaseOrder.findUnique({
          where: { id: dto.purchaseOrderId },
          include: { items: true },
        });
        if (po) {
          const allReceived = po.items.every((i) => Number(i.receivedQuantity) >= Number(i.orderQuantity));
          await tx.purchaseOrder.update({
            where: { id: po.id },
            data: {
              status: allReceived ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED,
            },
          });
        }
      }

      return receipt;
    });
  }
}

