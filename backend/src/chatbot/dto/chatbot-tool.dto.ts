import { ChatActionType } from '@prisma/client';

export interface ChatSessionCartOption {
  optionGroupId: string;
  optionGroupName: string;
  optionItemId: string;
  optionItemName: string;
  priceAdjustment: number;
}

export interface ChatSessionCartItem {
  id?: string;
  lineId: string;
  productId: string;
  productName: string;
  quantity: number;
  basePrice: number;
  priceAtSale: number; // basePrice + sum(options.priceAdjustment)
  selectedOptions: ChatSessionCartOption[];
  note?: string;
  isFlashSale?: boolean;
  flashSaleId?: string;
  imageUrl?: string;
}

export interface ChatReservationDraft {
  branchId?: string;
  branchName?: string;
  reservationDate?: string; // YYYY-MM-DD
  reservationTime?: string; // HH:mm
  partySize?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  seatingPreference?: string;
  specialRequests?: string;
  slotLockId?: string;
  summaryConfirmed?: boolean;
}

export type ChatConfirmationStatus = 'PREVIEWED' | 'CONFIRMED' | 'COMMITTED';

export interface ChatConfirmationState {
  previewTokenHash: string;
  payloadHash: string;
  expiresAt: string;
  status: ChatConfirmationStatus;
}

export interface ChatSessionContext {
  channel?: 'TEXT' | 'VOICE';
  cartVersion?: number;
  currentBranchId?: string;
  fulfillmentType?: 'DELIVERY' | 'TAKE_AWAY' | 'TAKEAWAY' | 'DINE_IN';
  cart: ChatSessionCartItem[];
  deliveryAddressId?: string;
  deliveryAddressSummary?: string;
  operatingSlotId?: string;
  deliveryDate?: string;
  deliverySlotTime?: string;
  scheduledTime?: string;
  customerName?: string;
  customerPhone?: string;
  discountVoucherCode?: string;
  shippingVoucherCode?: string;
  pointsToUse?: number;
  expectedTotalAmount?: number;
  paymentMethod?: string;
  tableNumberOrCode?: string;
  reservationDraft?: ChatReservationDraft;
  orderConfirmation?: ChatConfirmationState;
  reservationConfirmation?: ChatConfirmationState;
  lastIdempotencyKey?: string;
  lastSuggestedProducts?: { id: string; name: string }[];
}

export interface ChatCartSnapshot {
  cartVersion: number;
  currentBranchId: string | null;
  items: ChatSessionCartItem[];
  subTotal: number;
  totalItems: number;
}

export interface ChatbotSuggestion {
  label: string;
  action?: 'SEND_MESSAGE' | 'SHOW_PRODUCT' | 'ADD_TO_CART' | 'VIEW_CATEGORY' | 'APPLY_VOUCHER' | string;
  payload?: any;
  entityId?: string;
}

export interface ChatbotToolResult<T = unknown> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  actionType?: ChatActionType | string;
  actionPayload?: string;
  content?: string;
  suggestedReplies?: (string | ChatbotSuggestion)[];
  requiresConfirmation?: boolean;
  recoverable?: boolean;
}

