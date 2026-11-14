import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import {
  InventoryTransactionType,
  InventoryTrackingPolicy,
  InventoryExceptionType,
} from '@prisma/client';

const BAR_STORAGE_CATEGORIES = new Set([
  'NƯỚC ÉP TRÁI CÂY',
  'TRÀ',
  'BIA LON',
  'SOFT DRINK',
  'SOCHU HÀN QUỐC',
  'RƯỢU',
]);

@Injectable()
export class InventoryReservationService {
  private readonly logger = new Logger(InventoryReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: InventoryLedgerService,
  ) {}

  private resolveWarehouseForProduct(
    explicitWarehouseId: string | undefined,
    branchWarehouses: Array<{ id: string; storageZone?: string | null }> | undefined,
    categoryName?: string | null,
  ): string | undefined {
    if (explicitWarehouseId) return explicitWarehouseId;
    if (!branchWarehouses || branchWarehouses.length === 0) return undefined;
    const isBarProduct = Boolean(categoryName && BAR_STORAGE_CATEGORIES.has(categoryName));
    if (isBarProduct) {
      const barWh = branchWarehouses.find((w) => w.storageZone === 'BAR_STORAGE');
      if (barWh) return barWh.id;
    }
    const kitchenWh = branchWarehouses.find((w) => w.storageZone === 'KITCHEN_STORAGE');
    return kitchenWh?.id || branchWarehouses[0]?.id;
  }

  private async logExceptionSafe(data: {
    branchId: string;
    warehouseId?: string;
    orderId?: string;
    orderCode?: string;
    orderItemId?: string;
    productId?: string;
    productName?: string;
    recipeVersionId?: string;
    ingredientId?: string;
    ingredientName?: string;
    exceptionType: InventoryExceptionType;
    policyApplied: InventoryTrackingPolicy;
    severity?: string;
    failureReason: string;
    recommendedAction?: string;
    correlationId: string;
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
            orderCode: data.orderCode,
            orderItemId: data.orderItemId,
            productId: data.productId,
            productName: data.productName,
            recipeVersionId: data.recipeVersionId,
            ingredientId: data.ingredientId,
            ingredientName: data.ingredientName,
            exceptionType: data.exceptionType,
            policyApplied: data.policyApplied,
            severity: data.severity || 'WARNING',
            failureReason: data.failureReason,
            recommendedAction: data.recommendedAction,
            correlationId: data.correlationId,
            actorId: data.actorId,
            actorName: data.actorName,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed logging inventory exception: ${err?.message}`);
    }
  }

  private resolveEffectivePolicy(
    branchPolicy?: InventoryTrackingPolicy | null,
    productPolicy?: InventoryTrackingPolicy | null,
  ): InventoryTrackingPolicy {
    return productPolicy || branchPolicy || InventoryTrackingPolicy.WARN_AND_ALLOW;
  }

  /**
   * STAGE A: Giữ chỗ nguyên vật liệu (INVENTORY RESERVATION)
   * Kích hoạt khi Order gửi tới Bếp. Áp dụng khóa hàng FOR UPDATE & chính sách STRICT/WARN/MANUAL
   */
  async reserveOrderIngredients(
    orderId: string,
    warehouseId?: string,
    actor?: { id: string; fullName?: string },
  ) {
    const correlationId = `RSV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: {
              include: {
                category: { select: { name: true } },
                recipes: {
                  include: {
                    versions: {
                      where: { status: 'PUBLISHED' },
                      orderBy: { versionNumber: 'desc' },
                      take: 1,
                      include: {
                        ingredients: true,
                        optionModifiers: true,
                      },
                    },
                  },
                },
              },
            },
            selectedOptions: true,
            inventoryReservations: { where: { status: 'ACTIVE' } },
          },
        },
        branch: {
          include: {
            warehouses: {
              where: { storageZone: { in: ['KITCHEN_STORAGE', 'BAR_STORAGE'] }, isActive: true },
            },
          },
        },
      },
    });

    if (!order) return;

    const branchActivated = Boolean((order.branch as any)?.inventoryActivated);
    const branchPolicy = (order.branch as any)?.inventoryPolicy as InventoryTrackingPolicy | undefined;
    const defaultWarehouseId = this.resolveWarehouseForProduct(
      warehouseId,
      order.branch?.warehouses as any,
      null,
    );

    if (!defaultWarehouseId) {
      await this.logExceptionSafe({
        branchId: order.branchId,
        orderId: order.id,
        orderCode: (order as any).orderCode,
        exceptionType: InventoryExceptionType.RESERVATION_FAILED,
        policyApplied: this.resolveEffectivePolicy(branchPolicy),
        severity: 'CRITICAL',
        failureReason: `Không tìm thấy kho bếp mặc định (KITCHEN_STORAGE) cho chi nhánh ${order.branchId}`,
        recommendedAction: 'Tạo hoặc kích hoạt kho bếp tại /admin/inventory/warehouses.',
        correlationId,
        actorId: actor?.id,
        actorName: actor?.fullName,
      });
      return;
    }

    for (const item of order.orderItems) {
      if (item.inventoryReservations && item.inventoryReservations.length > 0) {
        continue;
      }

      const product: any = item.product;
      if (product && product.inventoryTracked === false) {
        continue;
      }

      const targetWarehouseId =
        this.resolveWarehouseForProduct(
          warehouseId,
          order.branch?.warehouses as any,
          product?.category?.name,
        ) || defaultWarehouseId;

      const effectivePolicy = this.resolveEffectivePolicy(branchPolicy, product?.inventoryPolicyOverride);

      // Chính sách MANUAL_CONSUMPTION: ghi nhận tác vụ chờ trừ thủ công
      if (effectivePolicy === InventoryTrackingPolicy.MANUAL_CONSUMPTION) {
        await this.logExceptionSafe({
          branchId: order.branchId,
          warehouseId: targetWarehouseId,
          orderId: order.id,
          orderCode: (order as any).orderCode,
          orderItemId: item.id,
          productId: item.productId,
          productName: product?.name,
          exceptionType: InventoryExceptionType.MANUAL_CONSUMPTION_PENDING,
          policyApplied: effectivePolicy,
          severity: 'INFO',
          failureReason: `Món '${product?.name || item.productId}' thuộc chính sách MANUAL_CONSUMPTION, cần xuất kho thủ công qua sổ cái.`,
          recommendedAction: 'Nhân viên kho kiểm tra và ghi nhận xuất kho thủ công nếu có sử dụng nguyên liệu.',
          correlationId,
          actorId: actor?.id,
          actorName: actor?.fullName,
        });
        continue;
      }

      const activeRecipe = product?.recipes?.[0];
      const activeVersion = activeRecipe?.versions?.[0];

      if (!activeVersion) {
        const msg = `Món '${product?.name || item.productId}' chưa có phiên bản công thức (PUBLISHED) để giữ chỗ kho.`;
        await this.logExceptionSafe({
          branchId: order.branchId,
          warehouseId: targetWarehouseId,
          orderId: order.id,
          orderCode: (order as any).orderCode,
          orderItemId: item.id,
          productId: item.productId,
          productName: product?.name,
          exceptionType: InventoryExceptionType.MISSING_RECIPE,
          policyApplied: effectivePolicy,
          severity: effectivePolicy === InventoryTrackingPolicy.STRICT_TRACKING ? 'CRITICAL' : 'WARNING',
          failureReason: msg,
          recommendedAction: 'Thiết lập & ban hành công thức tại /admin/inventory/recipes hoặc chuyển sang NOT_INVENTORY_TRACKED.',
          correlationId,
          actorId: actor?.id,
          actorName: actor?.fullName,
        });

        if (branchActivated && effectivePolicy === InventoryTrackingPolicy.STRICT_TRACKING) {
          throw new BadRequestException(msg);
        }
        continue;
      }

      // Lưu snapshot giá vốn và công thức vào OrderItem
      const costSnapshot = Math.round(Number(activeVersion.costPerServing) * item.quantity * 100) / 100;
      await this.prisma.orderItem.update({
        where: { id: item.id },
        data: {
          costPriceSnapshot: costSnapshot,
          recipeSnapshot: {
            recipeId: activeRecipe.id,
            recipeCode: activeRecipe.code,
            versionId: activeVersion.id,
            versionNumber: activeVersion.versionNumber,
            costPerServing: Number(activeVersion.costPerServing),
            ingredients: activeVersion.ingredients.map((i: any) => ({
              ingredientId: i.ingredientId,
              quantity: Number(i.quantity),
              unitSymbol: i.unitSymbol,
            })),
          },
        },
      });

      const requiredIngredients = new Map<string, { quantity: number; unitSymbol: string }>();

      for (const ing of activeVersion.ingredients) {
        const totalQty = Number(ing.quantity) * item.quantity;
        requiredIngredients.set(ing.ingredientId, {
          quantity: totalQty,
          unitSymbol: ing.unitSymbol,
        });
      }

      if (item.selectedOptions && activeVersion.optionModifiers) {
        for (const opt of item.selectedOptions) {
          const modifier = activeVersion.optionModifiers.find((m: any) => m.optionItemId === opt.optionItemId);
          if (modifier) {
            const current = requiredIngredients.get(modifier.ingredientId);
            const delta = Number(modifier.quantityDelta) * item.quantity;
            if (current) {
              current.quantity += delta;
            } else {
              requiredIngredients.set(modifier.ingredientId, {
                quantity: delta,
                unitSymbol: modifier.unitSymbol,
              });
            }
          }
        }
      }

      // Thực hiện Reservation với khóa hàng FOR UPDATE
      for (const [ingredientId, details] of requiredIngredients.entries()) {
        if (details.quantity <= 0) continue;

        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              'SELECT * FROM `InventoryBalance` WHERE `ingredientId` = ? AND `warehouseId` = ? FOR UPDATE',
              ingredientId,
              targetWarehouseId,
            );

            const bal = await tx.inventoryBalance.findUnique({
              where: {
                ingredientId_warehouseId: {
                  ingredientId,
                  warehouseId: targetWarehouseId,
                },
              },
            });

            const currentAvail = bal ? Number(bal.availableStock) : 0;

            if (currentAvail < details.quantity) {
              const reason = `Không đủ tồn khả dụng giữ chỗ cho món '${product?.name}'. Cần: ${details.quantity} ${details.unitSymbol}, Khả dụng: ${currentAvail}`;
              await this.logExceptionSafe({
                branchId: order.branchId,
                warehouseId: targetWarehouseId,
                orderId: order.id,
                orderCode: (order as any).orderCode,
                orderItemId: item.id,
                productId: item.productId,
                productName: product?.name,
                recipeVersionId: activeVersion.id,
                ingredientId,
                exceptionType: InventoryExceptionType.INSUFFICIENT_STOCK,
                policyApplied: effectivePolicy,
                severity: branchActivated && effectivePolicy === InventoryTrackingPolicy.STRICT_TRACKING ? 'CRITICAL' : 'WARNING',
                failureReason: reason,
                recommendedAction: 'Kiểm tra tồn kho thực tế, nhập thêm nguyên liệu (GRN) hoặc điều chuyển từ kho khác.',
                correlationId,
                actorId: actor?.id,
                actorName: actor?.fullName,
              });

              if (branchActivated && effectivePolicy === InventoryTrackingPolicy.STRICT_TRACKING) {
                throw new BadRequestException(reason);
              }
            }

            await tx.inventoryReservation.create({
              data: {
                orderId: order.id,
                orderItemId: item.id,
                ingredientId,
                warehouseId: targetWarehouseId,
                reservedQuantity: details.quantity,
                unitSymbol: details.unitSymbol,
                status: 'ACTIVE',
              },
            });

            if (bal) {
              const newReserved = Math.round((Number(bal.reservedStock) + details.quantity) * 10000) / 10000;
              const current = Number(bal.currentStock);
              const newAvailable = Math.max(0, Math.round((current - newReserved) * 10000) / 10000);

              await tx.inventoryBalance.update({
                where: { id: bal.id },
                data: {
                  reservedStock: newReserved,
                  availableStock: newAvailable,
                },
              });
            }
          });
        } catch (err) {
          if (err instanceof BadRequestException) throw err;
          await this.logExceptionSafe({
            branchId: order.branchId,
            warehouseId: targetWarehouseId,
            orderId: order.id,
            orderCode: (order as any).orderCode,
            orderItemId: item.id,
            productId: item.productId,
            productName: product?.name,
            ingredientId,
            exceptionType: InventoryExceptionType.RESERVATION_FAILED,
            policyApplied: effectivePolicy,
            severity: 'CRITICAL',
            failureReason: err?.message || 'Lỗi giữ chỗ nguyên liệu',
            correlationId,
            actorId: actor?.id,
            actorName: actor?.fullName,
          });
          if (branchActivated && effectivePolicy === InventoryTrackingPolicy.STRICT_TRACKING) {
            throw err;
          }
        }
      }
    }
  }

  /**
   * STAGE B: Thực trừ tồn kho thực tế (ACTUAL RECIPE CONSUMPTION)
   * Kích hoạt khi KDS chuyển PREPARING / READY / SERVED. Áp dụng cho cả Buffet (0đ) & Loyalty (0đ).
   */
  async consumeOrderItemIngredients(
    orderItemId: string,
    warehouseId?: string,
    actor?: { id: string; fullName?: string },
  ) {
    const correlationId = `CSM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        product: {
          include: { category: { select: { name: true } } },
        },
        order: {
          include: {
            branch: {
              include: {
                warehouses: {
                  where: { storageZone: { in: ['KITCHEN_STORAGE', 'BAR_STORAGE'] }, isActive: true },
                },
              },
            },
          },
        },
        inventoryReservations: {
          where: { status: 'ACTIVE' },
        },
        inventoryTransactions: {
          where: { type: InventoryTransactionType.RECIPE_CONSUMPTION },
        },
      },
    });

    if (!item) return;

    if (item.inventoryTransactions && item.inventoryTransactions.length > 0) {
      this.logger.log(`OrderItem ${orderItemId} đã được trừ nguyên liệu trước đó (Idempotent). Bỏ qua.`);
      return;
    }

    const branchActivated = Boolean((item.order.branch as any)?.inventoryActivated);
    const branchPolicy = (item.order.branch as any)?.inventoryPolicy as InventoryTrackingPolicy | undefined;
    const effectivePolicy = this.resolveEffectivePolicy(branchPolicy, (item as any).product?.inventoryPolicyOverride);

    if ((item as any).product?.inventoryTracked === false) {
      return;
    }

    const targetWarehouseId =
      warehouseId ||
      item.inventoryReservations?.[0]?.warehouseId ||
      this.resolveWarehouseForProduct(
        undefined,
        item.order.branch?.warehouses as any,
        (item as any).product?.category?.name,
      );

    if (!targetWarehouseId) {
      await this.logExceptionSafe({
        branchId: item.order.branchId,
        orderId: item.orderId,
        orderItemId: item.id,
        productId: item.productId,
        exceptionType: InventoryExceptionType.CONSUMPTION_FAILED,
        policyApplied: effectivePolicy,
        severity: 'CRITICAL',
        failureReason: `Không tìm thấy kho bếp để trừ tiêu hao cho OrderItem ${orderItemId}`,
        correlationId,
        actorId: actor?.id,
        actorName: actor?.fullName,
      });
      return;
    }

    const branchId = item.order.branchId;

    if (item.inventoryReservations && item.inventoryReservations.length > 0) {
      for (const res of item.inventoryReservations) {
        const qty = Number(res.reservedQuantity);
        const allowNegative = !(branchActivated && effectivePolicy === InventoryTrackingPolicy.STRICT_TRACKING);

        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              'SELECT * FROM `InventoryBalance` WHERE `ingredientId` = ? AND `warehouseId` = ? FOR UPDATE',
              res.ingredientId,
              targetWarehouseId,
            );

            await tx.inventoryReservation.update({
              where: { id: res.id },
              data: { status: 'CONSUMED', consumedAt: new Date() },
            });

            const bal = await tx.inventoryBalance.findUnique({
              where: {
                ingredientId_warehouseId: {
                  ingredientId: res.ingredientId,
                  warehouseId: targetWarehouseId,
                },
              },
            });

            if (bal) {
              const newReserved = Math.max(0, Math.round((Number(bal.reservedStock) - qty) * 10000) / 10000);
              await tx.inventoryBalance.update({
                where: { id: bal.id },
                data: { reservedStock: newReserved },
              });
            }

            await this.ledgerService.recordTransaction(
              {
                ingredientId: res.ingredientId,
                branchId,
                warehouseId: targetWarehouseId,
                type: InventoryTransactionType.RECIPE_CONSUMPTION,
                quantityOut: qty,
                unitSymbol: res.unitSymbol,
                orderId: item.orderId,
                orderItemId: item.id,
                sourceReference: `Món: ${item.id} - ${item.pricingMode}`,
                actorId: actor?.id,
                actorName: actor?.fullName,
                idempotencyKey: `CONSUME-${item.id}-${res.ingredientId}`,
                allowNegativeStock: allowNegative,
                correlationId,
              },
              tx,
            );
          });
        } catch (err) {
          await this.logExceptionSafe({
            branchId,
            warehouseId: targetWarehouseId,
            orderId: item.orderId,
            orderItemId: item.id,
            productId: item.productId,
            ingredientId: res.ingredientId,
            exceptionType: InventoryExceptionType.CONSUMPTION_FAILED,
            policyApplied: effectivePolicy,
            severity: 'CRITICAL',
            failureReason: err?.message || 'Lỗi trừ kho khi KDS chế biến',
            correlationId,
            actorId: actor?.id,
            actorName: actor?.fullName,
          });
          if (branchActivated && effectivePolicy === InventoryTrackingPolicy.STRICT_TRACKING) {
            throw err;
          }
        }
      }
    } else {
      await this.reserveOrderIngredients(item.orderId, targetWarehouseId, actor);
      const refreshed = await this.prisma.inventoryReservation.findMany({
        where: { orderItemId: item.id, status: 'ACTIVE' },
      });
      if (refreshed.length > 0) {
        return this.consumeOrderItemIngredients(orderItemId, targetWarehouseId, actor);
      }
    }
  }

  /**
   * Giải phóng giữ chỗ khi Hủy đơn hàng chưa thanh toán (Release Reservations)
   */
  async releaseOrderReservations(orderId: string) {
    const reservations = await this.prisma.inventoryReservation.findMany({
      where: { orderId, status: 'ACTIVE' },
    });

    for (const res of reservations) {
      const qty = Number(res.reservedQuantity);

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'SELECT * FROM `InventoryBalance` WHERE `ingredientId` = ? AND `warehouseId` = ? FOR UPDATE',
          res.ingredientId,
          res.warehouseId,
        );

        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });

        const bal = await tx.inventoryBalance.findUnique({
          where: {
            ingredientId_warehouseId: {
              ingredientId: res.ingredientId,
              warehouseId: res.warehouseId,
            },
          },
        });

        if (bal) {
          const newReserved = Math.max(0, Math.round((Number(bal.reservedStock) - qty) * 10000) / 10000);
          const current = Number(bal.currentStock);
          const newAvailable = Math.max(0, Math.round((current - newReserved) * 10000) / 10000);

          await tx.inventoryBalance.update({
            where: { id: bal.id },
            data: {
              reservedStock: newReserved,
              availableStock: newAvailable,
            },
          });
        }
      });
    }
  }
}
