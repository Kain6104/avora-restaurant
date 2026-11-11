import { create } from 'zustand';

export type WaiterTab = 'TABLES' | 'ORDERS' | 'QR' | 'SETTINGS' | 'MENU' | 'ATTENDANCE' | 'CSKH';
export type PaymentMethodCode = 'CASH' | 'TRANSFER' | 'PAYOS' | 'MOMO' | 'VNPAY';
export type TableGridCols = '1' | '2' | '3' | 'auto';
export type WaiterTheme = 'light' | 'dark' | 'luxury';
export type WaiterOrderFilterType = 'ALL' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';

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
  // Navigation & Origin Tracking
  activeTab: WaiterTab;
  setActiveTab: (tab: WaiterTab) => void;
  sourceTab: WaiterTab;
  setSourceTab: (tab: WaiterTab) => void;

  // Table / Order Context
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;

  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;

  // Filter & Search Persistence
  tableActiveArea: string;
  setTableActiveArea: (area: string) => void;
  ordersFilter: WaiterOrderFilterType;
  setOrdersFilter: (filter: WaiterOrderFilterType) => void;
  ordersSearchQuery: string;
  setOrdersSearchQuery: (query: string) => void;

  // Modal Stack & Native Back Synchronization
  modalCloseHandlers: Array<{ id: string; close: () => boolean }>;
  registerModalHandler: (id: string, close: () => boolean) => () => void;
  closeTopModal: () => boolean;

  // Scroll Positions Preservation
  scrollPositions: Record<string, number>;
  setScrollPosition: (key: string, pos: number) => void;
  getScrollPosition: (key: string) => number;

  // Branch & User Context
  activeBranchId: string | null;
  setActiveBranchId: (id: string) => void;
  currentBranch: { id: string; name: string; branchCode?: string } | null;
  setCurrentBranch: (branch: { id: string; name: string; branchCode?: string } | null) => void;

  currentUser: { id: string; fullName: string; role: string; email?: string } | null;
  setCurrentUser: (user: { id: string; fullName: string; role: string; email?: string } | null) => void;

  // Table Grid View Config (Matching Web_Sushi)
  gridCols: TableGridCols;
  setGridCols: (cols: TableGridCols) => void;

  // Theme Switcher (Light / Dark / Luxury Black)
  theme: WaiterTheme;
  setTheme: (theme: WaiterTheme) => void;

  // Attendance (Chấm công) modal & scanner
  isAttendanceModalOpen: boolean;
  setAttendanceModalOpen: (open: boolean) => void;
  isAttendanceScannerOpen: boolean;
  setAttendanceScannerOpen: (open: boolean) => void;

  // Audio / Sound & Haptic
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  hapticEnabled: boolean;
  setHapticEnabled: (enabled: boolean) => void;

  // Cart / Temp Order Items
  unsentItems: Record<string, UnsentItem[]>; // Keyed by orderId (or tableId for draft)
  addUnsentItem: (orderId: string, item: Omit<UnsentItem, 'localId'>) => void;
  updateUnsentItem: (orderId: string, localId: string, updates: Partial<UnsentItem>) => void;
  removeUnsentItem: (orderId: string, localId: string) => void;
  clearUnsentItems: (orderId: string) => void;

  // Connection / Offline state (updated by hook)
  isOffline: boolean;
  setOffline: (status: boolean) => void;
  networkState: 'ONLINE' | 'SERVER_UNAVAILABLE' | 'OFFLINE';
  setNetworkState: (state: 'ONLINE' | 'SERVER_UNAVAILABLE' | 'OFFLINE') => void;
  lastSyncAt: string | null;
  setLastSyncAt: (time: string | null) => void;

  // Cart Tray UI
  isCartTrayExpanded: boolean;
  setCartTrayExpanded: (expanded: boolean) => void;

  // Auto-scroll to newly added items trigger
  shouldScrollToUnsent: boolean;
  setShouldScrollToUnsent: (val: boolean) => void;
}

const getInitialGridCols = (): TableGridCols => {
  if (typeof window === 'undefined') return 'auto';
  return (localStorage.getItem('avora_waiter_grid_cols') as TableGridCols) || 'auto';
};

const getInitialTheme = (): WaiterTheme => {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem('avora_waiter_theme') as WaiterTheme) || 'light';
};

function getOptionSignature(options: { optionItemId: string }[] = []): string {
  return options
    .map(o => o.optionItemId)
    .filter(Boolean)
    .sort()
    .join('|');
}

export function areUnsentItemsEqual(
  a: Omit<UnsentItem, 'localId'>,
  b: Omit<UnsentItem, 'localId'>
): boolean {
  if (a.productId !== b.productId) return false;
  if (a.priceAtSale !== b.priceAtSale) return false;
  if ((a.pricingMode || 'REGULAR') !== (b.pricingMode || 'REGULAR')) return false;
  if ((a.buffetSessionId || null) !== (b.buffetSessionId || null)) return false;
  if ((a.discountReason || '') !== (b.discountReason || '')) return false;
  if ((a.note || '').trim() !== (b.note || '').trim()) return false;
  if ((a.discountAmount || 0) !== (b.discountAmount || 0)) return false;
  return getOptionSignature(a.selectedOptions) === getOptionSignature(b.selectedOptions);
}

export const useWaiterStore = create<WaiterState>((set, get) => ({
  activeTab: 'TABLES',
  setActiveTab: (tab) => set({ activeTab: tab }),

  sourceTab: 'TABLES',
  setSourceTab: (tab) => set({ sourceTab: tab }),

  selectedTableId: null,
  setSelectedTableId: (id) => set({ selectedTableId: id }),

  selectedOrderId: null,
  setSelectedOrderId: (id) => set({ selectedOrderId: id }),

  tableActiveArea: 'ALL',
  setTableActiveArea: (area) => set({ tableActiveArea: area }),

  ordersFilter: 'ALL',
  setOrdersFilter: (filter) => set({ ordersFilter: filter }),

  ordersSearchQuery: '',
  setOrdersSearchQuery: (query) => set({ ordersSearchQuery: query }),

  modalCloseHandlers: [],
  registerModalHandler: (id, close) => {
    set((state) => ({
      modalCloseHandlers: [...state.modalCloseHandlers.filter(h => h.id !== id), { id, close }],
    }));
    return () => {
      set((state) => ({
        modalCloseHandlers: state.modalCloseHandlers.filter(h => h.id !== id),
      }));
    };
  },
  closeTopModal: () => {
    const handlers = get().modalCloseHandlers;
    // Iterate from topmost (last registered) to bottom
    for (let i = handlers.length - 1; i >= 0; i--) {
      try {
        const closed = handlers[i].close();
        if (closed) {
          return true;
        }
      } catch (err) {
        console.error('Error closing modal in waiter handler:', err);
      }
    }
    return false;
  },

  scrollPositions: {},
  setScrollPosition: (key, pos) => set((state) => ({
    scrollPositions: { ...state.scrollPositions, [key]: pos },
  })),
  getScrollPosition: (key) => get().scrollPositions[key] || 0,

  activeBranchId: null,
  setActiveBranchId: (id) => set({ activeBranchId: id }),

  currentBranch: null,
  setCurrentBranch: (branch) => set({ currentBranch: branch, activeBranchId: branch?.id || null }),

  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  gridCols: getInitialGridCols(),
  setGridCols: (cols) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('avora_waiter_grid_cols', cols);
    }
    set({ gridCols: cols });
  },

  theme: getInitialTheme(),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('avora_waiter_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ theme });
  },

  isAttendanceModalOpen: false,
  setAttendanceModalOpen: (open) => set({ isAttendanceModalOpen: open }),

  isAttendanceScannerOpen: false,
  setAttendanceScannerOpen: (open) => set({ isAttendanceScannerOpen: open }),

  soundEnabled: true,
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

  hapticEnabled: true,
  setHapticEnabled: (enabled) => set({ hapticEnabled: enabled }),

  shouldScrollToUnsent: false,
  setShouldScrollToUnsent: (val) => set({ shouldScrollToUnsent: val }),

  unsentItems: {},
  addUnsentItem: (orderId, item) => set((state) => {
    const current = state.unsentItems[orderId] || [];
    const existingIndex = current.findIndex(existing => areUnsentItemsEqual(existing, item));
    if (existingIndex > -1) {
      const updated = [...current];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + item.quantity,
      };
      return {
        unsentItems: {
          ...state.unsentItems,
          [orderId]: updated,
        },
      };
    }
    return {
      unsentItems: {
        ...state.unsentItems,
        [orderId]: [...current, { ...item, localId: crypto.randomUUID() }],
      },
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
  setOffline: (status) => set({ isOffline: status, networkState: status ? 'OFFLINE' : 'ONLINE' }),
  networkState: 'ONLINE',
  setNetworkState: (state) => set({ networkState: state, isOffline: state !== 'ONLINE' }),
  lastSyncAt: null,
  setLastSyncAt: (time) => set({ lastSyncAt: time }),

  isCartTrayExpanded: false,
  setCartTrayExpanded: (expanded) => set({ isCartTrayExpanded: expanded }),
}));
