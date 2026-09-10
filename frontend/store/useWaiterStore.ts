import { create } from 'zustand';

export type WaiterTab = 'TABLES' | 'ORDERS' | 'QR' | 'SETTINGS' | 'MENU';
export type PaymentMethodCode = 'CASH' | 'TRANSFER' | 'PAYOS' | 'MOMO' | 'VNPAY';

export interface UnsentItem {
  localId: string; // uuid
  productId: string;
  quantity: number;
  note: string;
  selectedOptions: {
    optionItemId: string;
    priceAdjustment: number;
    nameAtSale: string;
  }[];
  priceAtSale: number; 
  productName: string;
  imageUrl?: string | null;
  discountAmount?: number;
  discountReason?: string;
  originalPriceAtSale?: number;
  pricingMode?: 'REGULAR' | 'BUFFET_TICKET' | 'BUFFET_INCLUDED';
  buffetSessionId?: string | null;
  buffetPackageId?: string | null;
  source?: 'WAITER';
}

interface WaiterState {
  // Navigation
  activeTab: WaiterTab;
  setActiveTab: (tab: WaiterTab) => void;
  
  // Table / Order Context
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;

  // Branch & User Context
  activeBranchId: string | null;
  setActiveBranchId: (id: string) => void;
  currentBranch: { id: string; name: string; branchCode?: string } | null;
  setCurrentBranch: (branch: { id: string; name: string; branchCode?: string } | null) => void;

  currentUser: { id: string; fullName: string; role: string; email?: string } | null;
  setCurrentUser: (user: { id: string; fullName: string; role: string; email?: string } | null) => void;

  // Cart / Temp Order Items
  unsentItems: Record<string, UnsentItem[]>; // Keyed by orderId (or tableId for draft)
  addUnsentItem: (orderId: string, item: Omit<UnsentItem, 'localId'>) => void;
  updateUnsentItem: (orderId: string, localId: string, updates: Partial<UnsentItem>) => void;
  removeUnsentItem: (orderId: string, localId: string) => void;
  clearUnsentItems: (orderId: string) => void;
  
  // Connection / Offline state (updated by hook)
  isOffline: boolean;
  setOffline: (status: boolean) => void;
  
  // Cart Tray UI
  isCartTrayExpanded: boolean;
  setCartTrayExpanded: (expanded: boolean) => void;
}

export const useWaiterStore = create<WaiterState>((set) => ({
  activeTab: 'TABLES',
  setActiveTab: (tab) => set({ activeTab: tab }),

  selectedTableId: null,
  setSelectedTableId: (id) => set({ selectedTableId: id }),

  selectedOrderId: null,
  setSelectedOrderId: (id) => set({ selectedOrderId: id }),

  activeBranchId: null,
  setActiveBranchId: (id) => set({ activeBranchId: id }),

  currentBranch: null,
  setCurrentBranch: (branch) => set({ currentBranch: branch, activeBranchId: branch?.id || null }),

  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  unsentItems: {},
  addUnsentItem: (orderId, item) => set((state) => {
    const current = state.unsentItems[orderId] || [];
    return {
      unsentItems: {
        ...state.unsentItems,
        [orderId]: [...current, { ...item, localId: crypto.randomUUID() }]
      }
    };
  }),
  updateUnsentItem: (orderId, localId, updates) => set((state) => {
    const current = state.unsentItems[orderId] || [];
    return {
      unsentItems: {
        ...state.unsentItems,
        [orderId]: current.map(item => item.localId === localId ? { ...item, ...updates } : item)
      }
    };
  }),
  removeUnsentItem: (orderId, localId) => set((state) => {
    const current = state.unsentItems[orderId] || [];
    return {
      unsentItems: {
        ...state.unsentItems,
        [orderId]: current.filter(item => item.localId !== localId)
      }
    };
  }),
  clearUnsentItems: (orderId) => set((state) => {
    const newItems = { ...state.unsentItems };
    delete newItems[orderId];
    return { unsentItems: newItems };
  }),

  isOffline: false,
  setOffline: (status) => set({ isOffline: status }),

  isCartTrayExpanded: false,
  setCartTrayExpanded: (expanded) => set({ isCartTrayExpanded: expanded }),
}));
