import Dexie, { type Table } from 'dexie';

export interface LocalCategory {
  id: string;
  branchId?: string;
  name: string;
  slug: string;
  displayOrder: number;
  productCount?: number;
  updatedAt?: string;
}

export interface LocalProduct {
  id: string;
  branchId?: string;
  itemCode: string;
  name: string;
  slug?: string;
  description?: string | null;
  price: number;
  effectivePrice?: number;
  oldPrice: number | null;
  discountedPrice: number | null;
  flashSalePrice: number | null;
  imageUrl: string | null;
  available: boolean;
  categoryId: string;
  categoryName?: string;
  badge: string | null;
  isBestSeller: boolean;
  isRedeemable?: boolean;
  redemptionPoints?: number | null;
  optionGroups?: any[];
  isBuffetTicket?: boolean;
  buffetPackageId?: string | null;
  buffetPackageName?: string | null;
  isBuffetItem?: boolean;
  buffetItemAvailable?: boolean;
  buffetAllowRetail?: boolean;
  updatedAt?: string;
}

export interface LocalProductOption {
  id: string;
  productId: string;
  name: string;
  isRequired: boolean;
  multipleChoice: boolean;
  minSelect: number;
  maxSelect: number;
  optionItems: {
    id: string;
    name: string;
    priceAdjustment: number;
    available: boolean;
    maxQuantity: number;
  }[];
}

export interface LocalCustomer {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  memberCode?: string | null;
  points?: number;
  currentPoints?: number;
  membershipTier?: any;
  totalSpending?: number;
  updatedAt?: string;
}

export interface LocalTable {
  id: string;
  branchId?: string;
  tableCode: string;
  name: string;
  areaId: string | null;
  capacity: number;
  status: string;
  isActive: boolean;
  sortOrder?: number;
  activeSession?: any;
  currentOrder?: any;
  visualStatus?: string;
  updatedAt?: string;
}

export interface LocalArea {
  id: string;
  branchId?: string;
  name: string;
  sortOrder: number;
}

export interface LocalActiveOrder {
  id: string;
  branchId?: string;
  tableId: string | null;
  orderCode: string;
  temporaryOrderCode?: string | null;
  guestCount?: number;
  totalAmount: number;
  subTotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  serviceChargeTotal?: number;
  status?: string;
  kitchenStatus: string;
  cashierId?: string | null;
  orderItems?: any[];
  user?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfflineCommand {
  id?: number; // Auto-increment PK
  idempotencyKey: string;
  commandType: 'SEND_ITEMS' | 'OPEN_TABLE' | 'UPDATE_ORDER_NOTE' | 'REDEEM_POINTS' | string;
  branchId: string;
  tableId?: string;
  orderId?: string;
  payload: any;
  baseVersion?: number;
  createdAt: string;
  updatedAt?: string;
  syncState: 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT' | 'COMPLETED';
  retryCount: number;
  errorReason?: string;
}

export interface SyncMetadata {
  key: string; // e.g. "delta_branch1", "customers"
  branchId?: string;
  lastSyncAt: string;
  serverTimestamp?: string;
  count?: number;
}

export class WaiterDatabase extends Dexie {
  categories!: Table<LocalCategory, string>;
  products!: Table<LocalProduct, string>;
  productOptions!: Table<LocalProductOption, string>;
  areas!: Table<LocalArea, string>;
  posTables!: Table<LocalTable, string>;
  activeOrders!: Table<LocalActiveOrder, string>;
  customers!: Table<LocalCustomer, string>;
  offlineCommands!: Table<OfflineCommand, number>;
  syncMetadata!: Table<SyncMetadata, string>;

  constructor() {
    super('AVORA_WaiterDB');

    this.version(2).stores({
      categories: 'id, sortOrder',
      products: 'id, categoryId, itemCode, name',
      productOptions: 'id, productId',
      areas: 'id, sortOrder',
      posTables: 'id, areaId, tableCode',
      activeOrders: 'id, tableId',
      offlineCommands: '++id, idempotencyKey, syncState, createdAt',
    });

    this.version(3).stores({
      categories: 'id, branchId, displayOrder, updatedAt',
      products: 'id, branchId, categoryId, itemCode, name, updatedAt',
      productOptions: 'id, productId',
      areas: 'id, branchId, sortOrder',
      posTables: 'id, branchId, areaId, tableCode',
      activeOrders: 'id, branchId, tableId, orderCode',
      customers: 'id, phone, memberCode, fullName, updatedAt',
      offlineCommands: '++id, idempotencyKey, branchId, commandType, syncState, createdAt',
      syncMetadata: 'key, branchId, lastSyncAt',
    });

    this.version(4).stores({
      categories: 'id, branchId, displayOrder, updatedAt',
      products: 'id, branchId, categoryId, itemCode, name, updatedAt',
      productOptions: 'id, productId',
      areas: 'id, branchId, sortOrder',
      posTables: 'id, branchId, areaId, tableCode, [branchId+id]',
      activeOrders: 'id, branchId, tableId, orderCode',
      customers: 'id, phone, memberCode, fullName, updatedAt',
      offlineCommands: '++id, idempotencyKey, branchId, commandType, syncState, createdAt',
      syncMetadata: 'key, branchId, lastSyncAt',
    }).upgrade(async (tx) => {
      // V4 Migration: purge invalid or legacy unindexed table cache rows
      try {
        const tables = await tx.table('posTables').toArray();
        const staleIds = tables.filter((t: any) => !t.branchId).map((t: any) => t.id);
        if (staleIds.length > 0) {
          await tx.table('posTables').bulkDelete(staleIds);
        }
      } catch (e) {
        console.warn('[WaiterDB] v4 migration warning:', e);
      }
    });
  }
}

export const db = new WaiterDatabase();

/**
 * Utility: Storage & Cache Quota Manager
 */
export async function getStorageEstimate(): Promise<{ usageMB: number; quotaMB: number; percent: number }> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usageMB = Math.round(((estimate.usage || 0) / (1024 * 1024)) * 10) / 10;
      const quotaMB = Math.round(((estimate.quota || 0) / (1024 * 1024)) * 10) / 10;
      const percent = quotaMB > 0 ? Math.round((usageMB / quotaMB) * 100) : 0;
      return { usageMB, quotaMB, percent };
    } catch (e) {
      console.warn('Storage estimate error:', e);
    }
  }
  return { usageMB: 0, quotaMB: 0, percent: 0 };
}

/**
 * Utility: Clean up stale offline completed records older than days.
 * Tuyệt đối KHÔNG xóa đơn hàng đang hoạt động, dữ liệu chưa đồng bộ
 * hoặc offlineCommands ở trạng thái PENDING, SYNCING, CONFLICT, FAILED.
 */
export async function purgeOldOfflineData(maxAgeDays: number = 7): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 3600 * 1000).toISOString();
    let deletedCount = 0;

    // 1. Chỉ xóa các command đã hoàn tất (COMPLETED) và cũ hơn cutoffDate
    const oldCommands = await db.offlineCommands
      .where('syncState')
      .equals('COMPLETED')
      .filter((cmd) => cmd.createdAt < cutoffDate)
      .toArray();

    if (oldCommands.length > 0) {
      const idsToDelete = oldCommands.map((c) => c.id!).filter(Boolean);
      await db.offlineCommands.bulkDelete(idsToDelete);
      deletedCount += idsToDelete.length;
    }

    // 2. Dọn các bản ghi bàn cũ bị thiếu branchId (legacy cache rác)
    const orphanTables = await db.posTables.filter((t) => !t.branchId).toArray();
    if (orphanTables.length > 0) {
      const tableIds = orphanTables.map((t) => t.id);
      await db.posTables.bulkDelete(tableIds);
      deletedCount += tableIds.length;
    }

    // 3. Dọn các khu vực rác bị thiếu branchId
    const orphanAreas = await db.areas.filter((a) => !a.branchId).toArray();
    if (orphanAreas.length > 0) {
      const areaIds = orphanAreas.map((a) => a.id);
      await db.areas.bulkDelete(areaIds);
      deletedCount += areaIds.length;
    }

    return deletedCount;
  } catch (err) {
    console.error('Error purging old offline data:', err);
  }
  return 0;
}
