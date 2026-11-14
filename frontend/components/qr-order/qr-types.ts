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
  maxItemsPerSubmission?: number | null;
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
  paymentStatus?: string;
  isInvoiceRequested?: boolean;
  invoiceTaxCode?: string | null;
  invoiceCompanyName?: string | null;
  invoiceAddress?: string | null;
  invoiceEmail?: string | null;
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
    avatarUrl?: string | null;
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
  available?: boolean;
  maxQuantity?: number;
  displayOrder?: number;
}

export interface QrProductOptionGroup {
  id: string;
  name: string;
  isRequired?: boolean;
  multipleChoice?: boolean;
  minSelect?: number;
  maxSelect?: number;
  minSelections?: number;
  maxSelections?: number;
  displayOrder?: number;
  items?: QrProductOptionItem[];
  optionItems?: QrProductOptionItem[];
}

export interface QrProduct {
  id: string;
  itemCode?: string;
  name: string;
  description?: string;
  price: number;
  oldPrice?: number;
  originalPrice?: number;
  effectivePrice: number;
  imageUrl?: string;
  unit?: string;
  badge?: string | null;
  isBestSeller?: boolean;
  isNew?: boolean;
  available: boolean;
  categoryId?: string;
  categoryName?: string;
  categoryDisplayOrder?: number;
  optionGroups?: QrProductOptionGroup[];
  isBuffetIncluded?: boolean;
  maxQuantityPerRound?: number | null;
  maxTotalQuantity?: number | null;
  usedTotalQuantity?: number;
  remainingTotalQuantity?: number | null;
}

export interface QrCategory {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  displayOrder?: number;
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
  minOrderValue?: number;
  bankCode?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
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

export interface QrGoogleAuthConfig {
  enabled: boolean;
  clientId: string | null;
  oauthRedirectPath: string;
}

export type QrActivityType =
  | 'ROUND'
  | 'CALL_STAFF'
  | 'PAYMENT_REQUEST'
  | 'OTHER_REQUEST'
  | 'REWARD_REDEEM'
  | 'PAYMENT_COMPLETED';

export interface QrActivityRoundItem {
  id: string;
  productId: string;
  productName: string;
  imageUrl?: string | null;
  quantity: number;
  pricingMode?: 'REGULAR' | 'BUFFET_TICKET' | 'BUFFET_INCLUDED' | string;
  priceAtSale?: number;
  kitchenStatus?: string;
  optionsTextSnapshot?: string | null;
  note?: string | null;
}

export interface QrActivityItem {
  id: string;
  type: QrActivityType;
  title: string;
  description?: string;
  status: string;
  timestamp: string;
  actorName?: string | null;
  metadata?: {
    roundId?: string;
    roundNumber?: number;
    itemCount?: number;
    items?: QrActivityRoundItem[];
    staffName?: string | null;
    approvedAt?: string | null;
    rejectReason?: string | null;
    statusMessage?: string | null;
    pointsDelta?: number;
    points?: number;
    pointsRedeemed?: number;
    [key: string]: unknown;
  } | null;
}

export interface QrActivityResponse {
  success: boolean;
  orderPaymentStatus?: string;
  summary: {
    totalEvents: number;
    pendingRequests: number;
  };
  activities: QrActivityItem[];
}
