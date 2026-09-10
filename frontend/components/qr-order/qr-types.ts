export interface QrSessionTable {
  id: string;
  name: string;
  tableCode: string;
}

export interface QrSessionBranch {
  id: string;
  name: string;
  branchCode?: string;
}

export interface QrSessionBuffetPackage {
  id: string;
  name: string;
  description?: string;
  items: Array<{
    id: string;
    productId: string;
    displayOrder: number;
    availableForQr: boolean;
    allowRetailPurchase: boolean;
  }>;
  tickets: Array<{
    id: string;
    productId: string;
  }>;
}

export interface QrBuffetSession {
  id: string;
  buffetPackageId: string;
  packageNameSnapshot: string;
  status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  activatedAt: string;
  buffetPackage?: QrSessionBuffetPackage;
}

export interface QrSessionOrder {
  id: string;
  orderCode: string;
  totalAmount: number;
  subTotal: number;
  guestCount: number;
  customerName?: string;
  customerPhone?: string;
  userId?: string | null;
  hasRedeemedPoints?: boolean;
  user?: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    memberCode?: string;
    points: number;
    currentPoints?: number;
    membershipTier?: {
      id?: string;
      name: string;
      discountPercent?: number;
    };
  } | null;
}

export interface QrSessionData {
  table: QrSessionTable;
  branch: QrSessionBranch;
  order: QrSessionOrder;
  buffetSession: QrBuffetSession | null;
}

export interface QrGuest {
  id: string;
  guestName: string;
  userId?: string | null;
  deviceSessionId: string;
  memberVerified: boolean;
  user?: {
    id?: string;
    fullName: string;
    phone?: string;
    email?: string;
    points: number;
    memberCode?: string;
    membershipTier?: {
      name: string;
      discountPercent?: number;
    };
    tierName?: string;
  } | null;
}

export interface QrProductOptionItem {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
}

export interface QrProductOptionGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  items: QrProductOptionItem[];
}

export interface QrProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  effectivePrice: number;
  imageUrl?: string;
  unit?: string;
  available: boolean;
  categoryId?: string;
  categoryName?: string;
  optionGroups?: QrProductOptionGroup[];
  isBuffetIncluded?: boolean;
}

export interface QrCategory {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
}

export interface QrCartOption {
  optionItemId: string;
  nameAtSale: string;
  priceAdjustmentAtSale: number;
}

export interface QrCartItem {
  localId: string;
  productId: string;
  productName: string;
  imageUrl?: string;
  unit?: string;
  quantity: number;
  pricingMode: 'REGULAR' | 'BUFFET_INCLUDED';
  basePrice: number;
  priceAtSale: number; // basePrice + sum(options)
  originalPrice: number;
  selectedOptions: QrCartOption[];
  note?: string;
}

export interface QrPaymentMethod {
  id: string;
  methodCode: string;
  gatewayType: string;
  name: string;
  iconUrl?: string;
  description?: string;
  displayOrder: number;
}

export interface QrOrderItemDisplay {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  priceAtSale: number;
  pricingMode: 'REGULAR' | 'BUFFET_TICKET' | 'BUFFET_INCLUDED';
  kitchenStatus: 'PENDING' | 'SENT' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  source: 'POS' | 'WAITER' | 'QR_ORDER' | 'ADMIN' | 'CHATBOT' | 'VOICE';
  orderedByName?: string;
  note?: string;
  optionsTextSnapshot?: string;
  selectedOptions?: Array<{
    nameAtSale: string;
    priceAdjustmentAtSale: number;
  }>;
}

export interface QrTableOrderHistory {
  orderId: string;
  orderCode: string;
  totalAmount: number;
  subTotal: number;
  guestCount: number;
  items: QrOrderItemDisplay[];
}
