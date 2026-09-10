export interface PosBranch {
  id: string;
  name: string;
  branchCode: string;
  phone?: string | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  street?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  capacity?: number;
  splitKitchenTickets?: boolean;
  printCancelTicket?: boolean;
  autoPrintReceipt?: boolean;
  autoPrintTempBill?: boolean;
  receiptCopies?: number;
  kitchenCopies?: number;
  defaultPaperSize?: string | null;
  defaultReceiptPrinterId?: string | null;
  excludeBuffetItemsFromTempBill?: boolean;
  removeBuffetItemsOnCheckout?: boolean;
}

export interface PosCategory {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  productCount: number;
}

export interface PosOptionItem {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
  available: boolean;
}

export interface PosOptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  multipleChoice: boolean;
  minSelect: number;
  maxSelect: number;
  optionItems: PosOptionItem[];
}

export interface PosProduct {
  id: string;
  itemCode: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  discountedPrice?: number | null;
  effectivePrice: number;
  isFlashSale: boolean;
  flashSalePrice?: number | null;
  unit: string;
  imageUrl?: string | null;
  available: boolean;
  isBestSeller: boolean;
  soldQuantity: number;
  spiciness: number;
  categoryId: string;
  categoryName?: string;
  categorySlug?: string;
  taxPercentage?: number;
  optionGroups: PosOptionGroup[];
  isBuffetTicket?: boolean;
  buffetTicketPackageId?: string;
  buffetTicketPackageName?: string;
  isBuffetItem?: boolean;
  buffetItemPackageId?: string;
}

export interface PosCartItemOption {
  optionItemId: string;
  nameAtSale: string;
  priceAdjustmentAtSale: number;
}

export interface PosCartItem {
  id: string; // client uuid or server orderItemId
  productId: string;
  product: PosProduct;
  quantity: number;
  priceAtSale: number; // base + options - discount
  originalPriceAtSale: number;
  discountAmount?: number;
  discountReason?: string;
  taxPercentageAtSale?: number;
  note?: string;
  optionsTextSnapshot?: string;
  selectedOptions: PosCartItemOption[];
  stationId?: string;
  stationName?: string;
  kitchenStatus?: 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  sentToKitchenAt?: string | null;
  sentQuantity?: number;
  savedQuantity?: number;
  printedQuantity?: number;
  orderSource?: string;
  orderedBy?: string;
  orderedById?: string;
  orderedByName?: string;
  printJobRef?: string;
  pricingMode?: 'REGULAR' | 'BUFFET_TICKET' | 'BUFFET_INCLUDED';
  buffetSessionId?: string | null;
  buffetPackageId?: string | null;
  buffetPackageNameSnapshot?: string | null;
  buffetReferencePriceSnapshot?: number | null;
  source?: 'POS' | 'WAITER' | 'QR_ORDER' | 'ADMIN' | 'CHATBOT' | 'VOICE';
  createdAt?: string;
}

export interface PosTable {
  id: string;
  tableCode: string;
  name: string;
  capacity: number;
  minCapacity: number;
  areaId: string | null;
  areaName: string;
  sortOrder: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: string;
  visualStatus: 'VACANT' | 'OCCUPIED' | 'BILL_PRINTED' | 'RESERVED';
  elapsedMinutes: number;
  activeSession?: {
    id: string;
    openedAt: string;
    guestCount: number;
    cashierId?: string | null;
  } | null;
  currentOrder?: {
    id: string;
    orderCode: string;
    guestCount: number;
    subTotal: number;
    totalAmount: number;
    status: string;
    kitchenStatus: string;
    itemCount: number;
    createdAt: string;
  } | null;
  reservation?: {
    id: string;
    reservationCode?: string;
    customerName?: string;
    customerPhone?: string;
    partySize: number;
    startAt?: string;
  } | null;
}

export interface PosArea {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PosServiceCharge {
  id: string;
  orderId: string;
  name: string;
  amount: number;
  note?: string | null;
  isTaxable?: boolean;
  taxPercentage?: number | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PosOrder {
  id: string;
  orderCode?: string | null;
  temporaryOrderCode?: string | null;
  branchId: string;
  tableId?: string | null;
  table?: PosTable | null;
  tableSessionId?: string | null;
  guestCount: number;
  customerName: string;
  customerPhone?: string | null;
  userId?: string | null;
  user?: any | null;
  deliveryAddress?: string | null;
  note?: string | null;
  orderType: string;
  orderSource: string;
  status: string; // DRAFT, HELD, PENDING, CONFIRMED, PREPARING, DELIVERING, COMPLETED, CANCELLED
  kitchenStatus: string; // PENDING, SENT, ACKNOWLEDGED, PREPARING, READY, SERVED, CANCELLED
  paymentStatus: string; // PENDING, PAID, FAILED
  paymentMethod: string;
  subTotal: number;
  serviceChargeTotal?: number;
  taxAmount?: number;
  vatPriceModeSnapshot?: string;
  serviceCharges?: PosServiceCharge[];
  totalAmount: number;
  shippingFee?: number;
  transactionId?: string | null;
  discountAmount: number;
  discountReason?: string | null;
  shippingDiscount: number;
  shippingDiscountReason?: string | null;
  pointsUsed: number;
  voucherId?: string | null;
  discountVoucherCodeSnapshot?: string | null;
  isInvoiceRequested?: boolean;
  invoiceTaxCode?: string | null;
  invoiceCompanyName?: string | null;
  invoiceAddress?: string | null;
  invoiceEmail?: string | null;
  isInvoiceExported?: boolean;
  invoiceExportedAt?: string | null;
  invoiceExportedBy?: string | null;
  confirmedAt?: string | null;
  deliveringAt?: string | null;
  deliveredAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  sentToKitchenAt?: string | null;
  cashierName?: string | null;
  cancelReason?: string | null;
  orderItems: Array<{
    id: string;
    orderId: string;
    productId: string;
    product: PosProduct;
    quantity: number;
    priceAtSale: number;
    originalPriceAtSale: number;
    taxPercentageAtSale?: number;
    taxableAmountAtSale?: number;
    taxAmountAtSale?: number;
    note?: string | null;
    optionsTextSnapshot?: string | null;
    stationId?: string | null;
    kitchenStatus: string;
    sentToKitchenAt?: string | null;
    acknowledgedAt?: string | null;
    readyAt?: string | null;
    servedAt?: string | null;
    orderedById?: string | null;
    orderedByName?: string | null;
    pricingMode?: 'REGULAR' | 'BUFFET_TICKET' | 'BUFFET_INCLUDED';
    buffetSessionId?: string | null;
    buffetPackageId?: string | null;
    buffetPackageNameSnapshot?: string | null;
    buffetReferencePriceSnapshot?: number | null;
    selectedOptions: Array<{
      id: string;
      optionItemId: string;
      nameAtSale: string;
      priceAdjustmentAtSale: number;
    }>;
  }>;
  buffetSessions?: Array<{
    id: string;
    orderId: string;
    buffetPackageId: string;
    packageNameSnapshot: string;
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
    activatedAt?: string;
    buffetPackage?: {
      id: string;
      name: string;
      items?: Array<{ id: string; productId: string }>;
      tickets?: Array<{ id: string; productId: string }>;
    };
  }>;
  buffetSession?: {
    id: string;
    orderId: string;
    buffetPackageId: string;
    packageNameSnapshot: string;
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
    activatedAt?: string;
    buffetPackage?: {
      id: string;
      name: string;
      items?: Array<{ id: string; productId: string }>;
      tickets?: Array<{ id: string; productId: string }>;
    };
  } | null;
}

export interface PosCashShift {
  id: string;
  branchId: string;
  cashierId: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string | null;
  openingBalance: number;
  closingBalance?: number | null;
  expectedBalance?: number | null;
  cashDifference?: number | null;
  totalRevenue: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  orderCount: number;
  note?: string | null;
  cashier?: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface PosEventEnvelope<T = any> {
  eventId: string;
  eventType: string;
  entityType: 'ORDER' | 'TABLE' | 'KITCHEN' | 'PAYMENT' | 'SHIFT' | 'PRODUCT';
  entityId: string;
  branchId: string;
  version?: number;
  timestamp: string;
  actorId?: string;
  payload: T;
}

export type PosActiveTab =
  | 'SALE'
  | 'ORDERS'
  | 'TABLES'
  | 'RESERVATIONS'
  | 'QR_ORDERS'
  | 'KDS';

export interface PosUserData {
  id?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string | null;
  role?: string;
}
