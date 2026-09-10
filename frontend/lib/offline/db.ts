import Dexie, { type Table } from 'dexie';

// Define custom types based on what we need locally
export interface LocalCategory {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
}

export interface LocalProduct {
  id: string;
  itemCode: string;
  name: string;
  price: number;
  oldPrice: number | null;
  discountedPrice: number | null;
  flashSalePrice: number | null;
  imageUrl: string | null;
  available: boolean;
  categoryId: string;
  badge: string | null;
  isBestSeller: boolean;
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

export interface LocalTable {
  id: string;
  tableCode: string;
  name: string;
  areaId: string | null;
  capacity: number;
  status: string; 
  isActive: boolean;
}

export interface LocalArea {
  id: string;
  name: string;
  sortOrder: number;
}

export interface LocalActiveOrder {
  id: string;
  tableId: string;
  orderCode: string;
  temporaryOrderCode: string | null;
  guestCount: number;
  totalAmount: number;
  kitchenStatus: string;
  cashierId: string | null;
}

export interface OfflineCommand {
  id?: number; // Auto-increment PK
  idempotencyKey: string;
  commandType: string;
  orderId?: string;
  tableId?: string;
  payload: any;
  baseVersion?: number;
  createdAt: string;
  syncState: 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT' | 'COMPLETED';
  retryCount: number;
  errorReason?: string;
}

export class WaiterDatabase extends Dexie {
  categories!: Table<LocalCategory, string>;
  products!: Table<LocalProduct, string>;
  productOptions!: Table<LocalProductOption, string>;
  areas!: Table<LocalArea, string>;
  posTables!: Table<LocalTable, string>;
  activeOrders!: Table<LocalActiveOrder, string>;
  offlineCommands!: Table<OfflineCommand, number>;

  constructor() {
    super('AVORA_WaiterDB');
    this.version(2).stores({
      categories: 'id, sortOrder',
      products: 'id, categoryId, itemCode, name',
      productOptions: 'id, productId',
      areas: 'id, sortOrder',
      posTables: 'id, areaId, tableCode',
      activeOrders: 'id, tableId',
      offlineCommands: '++id, idempotencyKey, syncState, createdAt'
    });
  }
}

export const db = new WaiterDatabase();
