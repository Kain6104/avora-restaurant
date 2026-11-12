"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  PosBranch,
  PosCategory,
  PosProduct,
  PosCartItem,
  PosTable,
  PosArea,
  PosOrder,
  PosCashShift,
  PosActiveTab,
} from './pos-types';
import { usePosSocket } from './usePosSocket';
import { usePosShortcuts } from './usePosShortcuts';
import { removeVietnameseTones, getCartLineIdentity, isOnlineOrder, isWeightUnit, normalizePosQty } from './pos-utils';
import { PosSettingsDrawer } from './PosSettingsDrawer';
import { EndOfDayReportModal } from './EndOfDayReportModal';
import { PosUpdateModal } from './PosUpdateModal';
import { platformBridge, UpdateManifestInfo } from '@/lib/platform/platform-bridge';
import { clearAuthSession } from '@/lib/auth';
import { NumericKeypadModal } from './NumericKeypadModal';
import { GuestCountModal } from './GuestCountModal';
import { ItemDetailModal } from './ItemDetailModal';
import { PosHeader, PosUserData } from './PosHeader';
import { CategoryBar } from './CategoryBar';
import { ProductGrid } from './ProductGrid';
import { ProductOptionModal } from './ProductOptionModal';
import { OrderCart } from './OrderCart';
import { PaymentModal } from './PaymentModal';
import { SepaySuccessModal, SepaySuccessModalData } from './SepaySuccessModal';
import { TableMap } from './TableMap';
import { OrdersListPanel } from './OrdersListPanel';
import { ReservationPanel } from './ReservationPanel';
import { QrOrderPanel } from './QrOrderPanel';
import { ShiftModal } from './ShiftModal';
import { SplitOrderModal } from './SplitOrderModal';
import { MergeOrderModal } from './MergeOrderModal';
import { MoveTableModal } from './MoveTableModal';
import { CommandPalette } from './CommandPalette';
import { CancelOrderModal } from './CancelOrderModal';
import { DeliveryAddressModal, PosDeliveryInfo } from './DeliveryAddressModal';
import { ItemDiscountModal } from './ItemDiscountModal';
import { OrderDiscountModal } from './OrderDiscountModal';
import { CustomerSelectModal } from './CustomerSelectModal';
import { PosRedeemPointsModal } from './PosRedeemPointsModal';
import { EditCustomerVatModal } from './EditCustomerVatModal';
import { OrderDetailFeesModal } from './OrderDetailFeesModal';
import { TouchCategorySidebar } from './TouchCategorySidebar';
import { BuffetSelectionModal } from './BuffetSelectionModal';
import { PosBuffetApplyModal } from './PosBuffetApplyModal';
import { QrManagementModal } from './QrManagementModal';
import {
  Bell,
  ChefHat,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Save,
  PauseCircle,
  Scissors,
  RefreshCw,
  Lock,
  Unlock,
  Ban,
  ShieldAlert,
  LogOut,
  User,
  Users,
  Home,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Printer,
  Edit3,
  ShoppingBag,
  UserCheck,
  ListCollapse,
  Tag,
  Clock,
} from 'lucide-react';
import { printAgent } from '@/lib/print-agent';
import { ReprintLabelsModal } from './ReprintLabelsModal';
import { PosConcurrencyLockModal } from './PosConcurrencyLockModal';
import { PosMobileNoticeModal } from './PosMobileNoticeModal';
import { PosDesktopLaunchModal } from './PosDesktopLaunchModal';
import { PosWebBlocker } from './PosWebBlocker';
import { useDesktopUx } from './useDesktopUx';

/**
 * Ánh xạ và cố định thứ tự món trong giỏ hàng POS:
 * 1. Giữ nguyên 100% vị trí các món đã có từ previousCart (món 1 luôn ở vị trí 1, món 2 ở vị trí 2...)
 * 2. Đối với món mới thêm hoặc đơn hàng tải lần đầu từ CSDL, sắp xếp ổn định tăng dần theo createdAt
 */
function mapAndSortOrderItemsToCart(rawOrderItems: any[], previousCart: PosCartItem[] = []): PosCartItem[] {
  if (!rawOrderItems || !Array.isArray(rawOrderItems) || rawOrderItems.length === 0) {
    return [];
  }

  const mapped: PosCartItem[] = rawOrderItems.map((oi: any) => {
    const isSent =
      oi.kitchenStatus === 'SENT' ||
      oi.kitchenStatus === 'ACKNOWLEDGED' ||
      oi.kitchenStatus === 'PREPARING' ||
      oi.kitchenStatus === 'READY' ||
      oi.kitchenStatus === 'SERVED';
    const sentQty = oi.sentQuantity !== undefined ? Number(oi.sentQuantity) : isSent ? Number(oi.quantity) : 0;
    const printedQty = oi.printedQuantity !== undefined ? Number(oi.printedQuantity) : sentQty;

    const optionsAdj = (oi.selectedOptions || []).reduce(
      (s: number, so: any) => s + Number(so.priceAdjustmentAtSale || 0),
      0,
    );
    const derivedCustomPrice = oi.product?.allowOpenPriceOnPos
      ? Math.max(0, Number(oi.priceAtSale) - optionsAdj)
      : undefined;

    return {
      id: oi.id,
      productId: oi.productId,
      product: oi.product,
      quantity: normalizePosQty(Number(oi.quantity)) || Number(oi.quantity),
      priceAtSale: oi.priceAtSale,
      originalPriceAtSale: oi.originalPriceAtSale,
      customPrice: derivedCustomPrice,
      discountAmount: oi.discountAmount || 0,
      discountReason: oi.discountReason || undefined,
      note: oi.note || undefined,
      optionsTextSnapshot: oi.optionsTextSnapshot || undefined,
      selectedOptions: (oi.selectedOptions || []).map((so: any) => ({
        optionItemId: so.optionItemId,
        nameAtSale: so.nameAtSale,
        priceAdjustmentAtSale: so.priceAdjustmentAtSale,
      })),
      stationId: oi.stationId || undefined,
      kitchenStatus: oi.kitchenStatus as any,
      sentToKitchenAt: oi.sentToKitchenAt,
      sentQuantity: sentQty,
      savedQuantity: Number(oi.quantity),
      printedQuantity: printedQty,
      orderedById: (oi as any).orderedById || undefined,
      orderedByName: (oi as any).orderedByName || undefined,
      createdAt: (oi as any).createdAt ? new Date((oi as any).createdAt).toISOString() : undefined,
      pricingMode: oi.pricingMode || 'REGULAR',
      buffetSessionId: oi.buffetSessionId || null,
      buffetPackageId: oi.buffetPackageId || null,
      buffetPackageNameSnapshot: oi.buffetPackageNameSnapshot || null,
      buffetReferencePriceSnapshot: oi.buffetReferencePriceSnapshot || undefined,
      source: oi.source || 'POS',
    };
  });

  // Bảo toàn thứ tự danh sách món:
  if (previousCart && previousCart.length > 0) {
    const prevOrderMap = new Map<string, number>();
    previousCart.forEach((item, idx) => {
      if (item.id) {
        prevOrderMap.set(item.id, idx);
      }
      const lineKey = `${item.productId}::${(item.selectedOptions || []).map((o) => o.optionItemId).sort().join('|')}::${(item.note || '').trim().toLowerCase()}`;
      if (!prevOrderMap.has(lineKey)) {
        prevOrderMap.set(lineKey, idx);
      }
    });

    mapped.sort((a, b) => {
      const aKey = `${a.productId}::${(a.selectedOptions || []).map((o) => o.optionItemId).sort().join('|')}::${(a.note || '').trim().toLowerCase()}`;
      const bKey = `${b.productId}::${(b.selectedOptions || []).map((o) => o.optionItemId).sort().join('|')}::${(b.note || '').trim().toLowerCase()}`;

      const aPos = (a.id && prevOrderMap.has(a.id)) ? prevOrderMap.get(a.id)! : (prevOrderMap.has(aKey) ? prevOrderMap.get(aKey)! : -1);
      const bPos = (b.id && prevOrderMap.has(b.id)) ? prevOrderMap.get(b.id)! : (prevOrderMap.has(bKey) ? prevOrderMap.get(bKey)! : -1);

      if (aPos >= 0 && bPos >= 0) {
        return aPos - bPos;
      }
      if (aPos >= 0) return -1;
      if (bPos >= 0) return 1;

      // Món mới phát sinh chưa có trong previousCart sẽ xếp theo thời gian tạo createdAt
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (a.id || '').localeCompare(b.id || '');
    });

    return mapped;
  }

  // Tải lần đầu từ database: Xếp tăng dần theo createdAt (món thêm trước ở trên đầu #1)
  mapped.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;
    return (a.id || '').localeCompare(b.id || '');
  });

  return mapped;
}

export const PosShell: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { isDesktop } = useDesktopUx();

  // Authentication State
  const [currentUser, setCurrentUser] = useState<PosUserData | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Core Data State (100% Real from Database)
  const [branches, setBranches] = useState<PosBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<PosBranch | null>(null);
  const [branchPrintSettings, setBranchPrintSettings] = useState<any[]>([]);
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [areas, setAreas] = useState<PosArea[]>([]);
  const [branchOrders, setBranchOrders] = useState<PosOrder[]>([]);
  const [activeShift, setActiveShift] = useState<PosCashShift | null>(null);
  const [kitchenTickets, setKitchenTickets] = useState<any[]>([]);
  const [reservationsCount, setReservationsCount] = useState<number>(0);
  const [vatPriceMode, setVatPriceMode] = useState<'VAT_INCLUDED' | 'VAT_EXCLUDED'>('VAT_EXCLUDED');

  // Navigation & Search State
  const [activeTab, setActiveTab] = useState<PosActiveTab>('TABLES');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Tab memory: return to the originating tab when exiting an order
  const originTabRef = useRef<PosActiveTab>('TABLES');
  const loadOrderIntoPosRef = useRef<(order: PosOrder | null, tableFallback?: PosTable | null) => void>(() => {});

  useEffect(() => {
    if (activeTab !== 'SALE') {
      originTabRef.current = activeTab;
    }
  }, [activeTab]);

  const returnToOriginTab = useCallback(() => {
    loadOrderIntoPosRef.current(null);
    const dest = originTabRef.current || 'TABLES';
    setActiveTab(dest === 'SALE' ? 'TABLES' : dest);
  }, []);

  // View Mode: 'grid' (Visual Grid) | 'fast' (Fast POS Buttons)
  const [viewMode, setViewMode] = useState<'grid' | 'fast'>('grid');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Dark Mode State with local storage persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDark = localStorage.getItem('avora_pos_dark_mode');
      if (savedDark === 'true') {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('avora_pos_dark_mode', String(next));
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('avora_pos_view_mode');
      if (saved === 'grid' || saved === 'fast') setViewMode(saved);
    }
  }, []);

  const handleToggleViewMode = (mode: 'grid' | 'fast') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('avora_pos_view_mode', mode);
    }
  };

  // Active Cart / Order State (In-Memory Draft until explicitly Saved or Paid)
  const [cartItems, setCartItems] = useState<PosCartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);
  const [currentOrder, setCurrentOrder] = useState<PosOrder | null>(null);
  const [guestCount, setGuestCount] = useState<number>(1);
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('TAKEAWAY');
  const [customerName, setCustomerName] = useState<string>('Khách mang đi');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Cart quantity counts by productId for instant card badges
  const cartItemCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cartItems) {
      map[item.productId] = (map[item.productId] || 0) + item.quantity;
    }
    return map;
  }, [cartItems]);

  // Client-side unaccented Vietnamese search filter
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const cleanQ = removeVietnameseTones(searchQuery);
    return products.filter((p) => {
      const cleanName = removeVietnameseTones(p.name);
      const cleanCode = (p.itemCode || '').toLowerCase();
      const cleanCat = removeVietnameseTones(p.categoryName || '');
      return cleanName.includes(cleanQ) || cleanCode.includes(cleanQ) || cleanCat.includes(cleanQ);
    });
  }, [products, searchQuery]);

  // Active buffet items set for ribbon tags
  const activeBuffetSession =
    (currentOrder as any)?.buffetSessions?.find((s: any) => s.status === 'ACTIVE') ||
    (currentOrder as any)?.buffetSessions?.[0] ||
    (currentOrder as any)?.buffetSession;
  const isBuffetSessionActive = activeBuffetSession && activeBuffetSession.status === 'ACTIVE';

  const buffetProductIds = useMemo(() => {
    if (!isBuffetSessionActive || !activeBuffetSession?.buffetPackage?.items) {
      return new Set<string>();
    }
    return new Set<string>(activeBuffetSession.buffetPackage.items.map((it: any) => it.productId));
  }, [isBuffetSessionActive, activeBuffetSession]);

  // Delivery info
  const [deliveryInfo, setDeliveryInfo] = useState<PosDeliveryInfo | null>(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

  // Discounts (Order & Item level with mandatory reason)
  const [orderDiscount, setOrderDiscount] = useState<{
    discountAmount: number;
    discountReason: string;
    discountType?: 'PERCENT' | 'FIXED' | 'VOUCHER' | 'POINTS';
    discountPercent?: number;
  } | null>(null);
  const [isOrderDiscountModalOpen, setIsOrderDiscountModalOpen] = useState(false);
  const [selectedDiscountItem, setSelectedDiscountItem] = useState<PosCartItem | null>(null);
  const [isItemDiscountModalOpen, setIsItemDiscountModalOpen] = useState(false);
  const [isDesktopLaunchModalOpen, setIsDesktopLaunchModalOpen] = useState(false);

  // Dynamic percentage discount recalculation on cart items subtotal change
  useEffect(() => {
    if (orderDiscount?.discountType === 'PERCENT' && typeof orderDiscount.discountPercent === 'number') {
      const curSubTotal = cartItems.reduce(
        (sum, it) => sum + Math.max(0, it.priceAtSale - (it.discountAmount || 0)) * it.quantity,
        0,
      );
      const expected = Math.round((curSubTotal * orderDiscount.discountPercent) / 100);
      if (orderDiscount.discountAmount !== expected) {
        setOrderDiscount((prev) => (prev ? { ...prev, discountAmount: expected } : prev));
        if (currentOrder) {
          setCurrentOrder((prev: any) => (prev ? { ...prev, discountAmount: expected } : prev));
        }
      }
    }
  }, [cartItems, orderDiscount?.discountType, orderDiscount?.discountPercent]);

  // Modals
  const [selectedOptionProduct, setSelectedOptionProduct] = useState<PosProduct | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [sepaySuccessData, setSepaySuccessData] = useState<SepaySuccessModalData | null>(null);
  const [isSepaySuccessModalOpen, setIsSepaySuccessModalOpen] = useState(false);
  const [isCancelOrderModalOpen, setIsCancelOrderModalOpen] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isEndOfDayReportModalOpen, setIsEndOfDayReportModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMoveTableModalOpen, setIsMoveTableModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSendingKitchen, setIsSendingKitchen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isReprintLabelsModalOpen, setIsReprintLabelsModalOpen] = useState(false);
  const [isQrManagementModalOpen, setIsQrManagementModalOpen] = useState(false);
  const [buffetSelectionProduct, setBuffetSelectionProduct] = useState<PosProduct | null>(null);
  const [pendingPricingMode, setPendingPricingMode] = useState<'REGULAR' | 'BUFFET_INCLUDED' | 'BUFFET_TICKET'>('REGULAR');
  const [isBuffetApplyModalOpen, setIsBuffetApplyModalOpen] = useState(false);

  // Customer selection & VAT edit modals
  const [isCustomerSelectModalOpen, setIsCustomerSelectModalOpen] = useState(false);
  const [isEditVatModalOpen, setIsEditVatOpen] = useState(false);
  const [editingVatCustomer, setEditingVatCustomer] = useState<any | null>(null);
  const [isGuestCountModalOpen, setIsGuestCountModalOpen] = useState(false);

  // Redeem points modal & rewards count
  const [isRedeemPointsModalOpen, setIsRedeemPointsModalOpen] = useState(false);
  const [redeemableRewardsCount, setRedeemableRewardsCount] = useState<number>(0);

  // Order Detail / Tax / Shipping Fees & Status Modal
  const [isOrderDetailFeesModalOpen, setIsOrderDetailFeesModalOpen] = useState(false);
  const [feesModalOrder, setFeesModalOrder] = useState<PosOrder | null>(null);

  // POS System Menu Drawer & Keypad & Item Detail & Detail Mode
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [canSwitchBranch, setCanSwitchBranch] = useState(true);

  // Auto-open printer settings if requested via query parameter (?view=printer-settings)
  useEffect(() => {
    if (searchParams?.get('view') === 'printer-settings') {
      setIsSettingsDrawerOpen(true);
    }
  }, [searchParams]);

  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [keypadItem, setKeypadItem] = useState<PosCartItem | null>(null);
  const [keypadAddContext, setKeypadAddContext] = useState<{
    product: PosProduct;
    pricingMode: 'REGULAR' | 'BUFFET_TICKET' | 'BUFFET_INCLUDED';
    buffetSessionId?: string | null;
    buffetPackageId?: string | null;
  } | null>(null);

  // Key Guard: Block F12 & DevTools (Ctrl + Zoom is explicitly allowed per user request)
  useEffect(() => {
    const handleGlobalKeyGuard = (e: KeyboardEvent) => {
      // Block F12 & DevTools
      if (
        e.key === 'F12' ||
        e.keyCode === 123 ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && ['u', 'U'].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyGuard, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyGuard, { capture: true } as any);
    };
  }, []);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [detailModalItem, setDetailModalItem] = useState<PosCartItem | null>(null);
  const [isItemDetailOpen, setIsItemDetailOpen] = useState(false);
  const [isDetailMode, setIsDetailMode] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const seenEventIds = useRef<Set<string>>(new Set());

  // Realtime clock for bottom touch bar
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const clockString = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const day = String(currentTime.getDate()).padStart(2, '0');
    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
    const year = currentTime.getFullYear();
    return `${formattedHours}:${minutes} ${ampm}  ${day}/${month}/${year}`;
  }, [currentTime]);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Fetch count of redeemable rewards for active branch
  useEffect(() => {
    if (currentBranch?.id) {
      fetch(`${baseUrl}/api/pos/rewards?branchId=${currentBranch.id}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            setRedeemableRewardsCount(res.data.length);
          }
        })
        .catch(() => {});
    }
  }, [currentBranch?.id, baseUrl]);

  // Check if current order already has redeemed points (locking member account)
  const hasRedeemedPoints = Boolean(
    (currentOrder?.pointsUsed && currentOrder.pointsUsed > 0) ||
      (currentOrder as any)?.orderItems?.some(
        (it: any) =>
          it.priceAtSale === 0 &&
          (it.discountReason?.includes('đổi điểm') || it.discountReason?.includes('Đổi điểm')),
      ),
  );

  // BANK GATEWAY TELEMETRY & OVERPAID ALERTS (Feature 3 & 5)
  const [bankGatewayBatteryAlert, setBankGatewayBatteryAlert] = useState<{
    batteryLevel: number;
    message: string;
  } | null>(null);
  const [overpaidDuplicateAlert, setOverpaidDuplicateAlert] = useState<{
    orderCode: string;
    tableName?: string;
    overpaidAmount: number;
    message: string;
  } | null>(null);

  // -------------------------------------------------------------------------
  // CONCURRENCY & MULTI-TAB LOCK (Chỉ 1 tab POS hoạt động)
  // -------------------------------------------------------------------------
  const [isTabLocked, setIsTabLocked] = useState(false);
  const myTabId = useRef<string>(
    typeof window !== 'undefined'
      ? `pos-tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      : 'pos-tab-init',
  );

  const claimLeadership = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('avora_active_pos_tab', myTabId.current);
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('avora_pos_tab_channel');
        bc.postMessage({ type: 'CLAIM_POS_TAB', tabId: myTabId.current, time: Date.now() });
        bc.close();
      }
    } catch (e) {
      console.warn('Tab lock broadcast error:', e);
    }
    setIsTabLocked(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Kích hoạt quyền điều khiển ngay khi mở tab này
    claimLeadership();

    // Lắng nghe BroadcastChannel từ các tab POS khác
    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('avora_pos_tab_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'CLAIM_POS_TAB' && event.data?.tabId !== myTabId.current) {
          setIsTabLocked(true);
        }
      };
    }

    // Lắng nghe qua storage event (dự phòng tương thích mọi trình duyệt)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'avora_active_pos_tab' && e.newValue && e.newValue !== myTabId.current) {
        setIsTabLocked(true);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, [claimLeadership]);

  // Bộ nhớ lọc trùng lệnh in trong vòng 30 giây (Idempotency Guard)
  const processedPrintKeysRef = useRef<Map<string, number>>(new Map());

  const shouldProcessPrintKey = (key?: string): boolean => {
    if (!key) return true;
    const now = Date.now();
    const last = processedPrintKeysRef.current.get(key);
    if (last && now - last < 30000) {
      return false; // Đã in trong vòng 30 giây, bỏ qua
    }
    processedPrintKeysRef.current.set(key, now);
    // Dọn dẹp key cũ quá 60 giây
    for (const [k, t] of processedPrintKeysRef.current.entries()) {
      if (now - t > 60000) processedPrintKeysRef.current.delete(k);
    }
    return true;
  };

  // -------------------------------------------------------------------------
  // MOBILE DEVICE CHECK (< 600px)
  // Chỉ hiển thị yêu cầu màn hình lớn khi chiều rộng < 600px
  // -------------------------------------------------------------------------
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => {
      const isSmall = window.innerWidth < 600;
      setIsMobileDevice(isSmall);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // =========================================================================
  // 0. AUTHENTICATION & POS PERMISSION CHECK (Directives 35-46)
  // =========================================================================
  const [accessDeniedModal, setAccessDeniedModal] = useState<{
    title: string;
    message: string;
    countdown: number;
  } | null>(null);

  const [updateManifest, setUpdateManifest] = useState<UpdateManifestInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const isLoggingOutRef = useRef(false);

  const handleLogout = useCallback(async () => {
    isLoggingOutRef.current = true;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('avora_pos_selected_branch');
    }
    // 1. Nếu ở trên Desktop, lập tức kích hoạt chuyển về màn hình đăng nhập native không để trễ
    if (platformBridge.isDesktop) {
      platformBridge.logout?.();
    }
    try {
      await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore network errors on logout
    }
    clearAuthSession();
    setCurrentUser(null);
    if (!platformBridge.isDesktop) {
      toast.success('Đã kết thúc phiên làm việc POS');
      router.push('/login?redirectURL=/admin/pos');
    }
  }, [baseUrl, router]);

  // Bổ sung: Khi bấm các liên kết khác ngoài POS, tự động mở trong trình duyệt mặc định của máy tính
  useEffect(() => {
    if (!platformBridge.isDesktop) return;

    const handleGlobalAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target || !target.href) return;

      try {
        const url = new URL(target.href, window.location.href);
        const path = url.pathname.toLowerCase();
        // Chỉ cho phép các route nội bộ thuộc /admin/pos
        if (!path.startsWith('/admin/pos')) {
          e.preventDefault();
          e.stopPropagation();
          platformBridge.openExternalBrowser(url.href);
        }
      } catch { }
    };

    document.addEventListener('click', handleGlobalAnchorClick, true);
    return () => document.removeEventListener('click', handleGlobalAnchorClick, true);
  }, []);

  const handleGoToAdmin = useCallback(() => {
    // Directive 6: /admin/dashboard must open in Windows default browser on Desktop
    if (platformBridge.isDesktop) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      platformBridge.openExternalBrowser(`${origin}/admin/dashboard`);
    } else {
      router.push('/admin/dashboard');
    }
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    const verifyAuth = async () => {
      if (isLoggingOutRef.current) return;
      try {
        const res = await fetch(`${baseUrl}/api/auth/me`, { credentials: 'include' });
        if (!res.ok) {
          if (isLoggingOutRef.current) return;
          if (platformBridge.isDesktop) {
            await platformBridge.logout?.();
            return;
          }
          toast.error('Vui lòng đăng nhập để truy cập POS', { id: 'auth-login' });
          router.push('/login?redirectURL=/admin/pos');
          return;
        }
        const data = await res.json();

        // 1. Account status check (Directive 39)
        if (data.status === 'INACTIVE' || data.isLocked) {
          if (isMounted) {
            setAccessDeniedModal({
              title: 'Tài khoản đã bị khóa',
              message: 'Tài khoản của bạn hiện đang bị tạm ngưng hoặc khóa quyền truy cập. Vui lòng liên hệ quản trị viên.',
              countdown: 5,
            });
          }
          return;
        }

        // 2. POS Access permission check (Directives 35, 36, 37, 38)
        const permissions: string[] = Array.isArray(data.permissions) ? data.permissions : [];
        const hasPosAccess =
          data.role === 'ADMIN' ||
          data.role === 'MANAGER' ||
          permissions.includes('pos.access') ||
          Boolean(data.effectivePermissions?.['pos.access']);

        if (!hasPosAccess) {
          if (isMounted) {
            setAccessDeniedModal({
              title: 'Không có quyền truy cập POS',
              message: 'Tài khoản của bạn không được cấp quyền truy cập hệ thống bán hàng AVORA POS. Vui lòng liên hệ quản trị viên hoặc quản lý chi nhánh.',
              countdown: 5,
            });
          }
          return;
        }

        // 3. Branch assignment check (Directives 40, 41)
        const hasBranch = Boolean(
          data.branch ||
          data.branchId ||
          (data.assignments && data.assignments.length > 0) ||
          data.allBranches
        );

        if (!hasBranch) {
          if (isMounted) {
            setAccessDeniedModal({
              title: 'Chưa được phân quyền chi nhánh',
              message: 'Bạn chưa được phân quyền tại bất kỳ chi nhánh nào để vận hành POS. Vui lòng liên hệ quản trị viên.',
              countdown: 5,
            });
          }
          return;
        }

        if (isMounted) {
          setCurrentUser({
            id: data.id,
            fullName: data.fullName,
            email: data.email,
            avatarUrl: data.avatarUrl,
            role: data.role,
          });
          setIsAuthChecking(false);
        }
      } catch (err) {
        console.error('Auth check error in POS:', err);
        if (isMounted) {
          if (platformBridge.isDesktop) {
            await platformBridge.logout?.();
            return;
          }
          router.push('/login?redirectURL=/admin/pos');
        }
      }
    };
    verifyAuth();
    return () => {
      isMounted = false;
    };
  }, [baseUrl, router]);

  // Auto-logout countdown if access denied
  useEffect(() => {
    if (!accessDeniedModal) return;
    if (accessDeniedModal.countdown <= 0) {
      handleLogout();
      return;
    }
    const timer = setInterval(() => {
      setAccessDeniedModal((prev) => (prev ? { ...prev, countdown: prev.countdown - 1 } : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [accessDeniedModal, handleLogout]);

  // Auto-Update startup check (Directives 65, 70)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (platformBridge.isDesktop || Boolean((window as any).IS_AVORA_DESKTOP)) {
        sessionStorage.setItem('avora_pos_active', 'true');
      } else {
        sessionStorage.removeItem('avora_pos_active');
      }
    }
    if (!platformBridge.isDesktop) return;
    const checkTimer = setTimeout(async () => {
      try {
        const res = await platformBridge.checkUpdate?.();
        if (res?.updateAvailable && res.manifest) {
          setUpdateManifest(res.manifest);
          setIsUpdateModalOpen(true);
        }
      } catch (err) {
        console.warn('Auto-update check failed:', err);
      }
    }, 3000);
    return () => clearTimeout(checkTimer);
  }, []);

  // =========================================================================
  // CUSTOMER SELECTION & ATTACHMENT TO ACTIVE ORDER
  // =========================================================================
  const handleSelectCustomer = async (member: any | null) => {
    if (currentOrder && hasRedeemedPoints && member?.id !== currentOrder.userId) {
      toast.error('Đơn hàng này đã đổi điểm thưởng, không thể thay đổi hoặc gỡ tài khoản hội viên!');
      return;
    }
    setSelectedMember(member);
    if (member) {
      setCustomerName(member.fullName);
      setCustomerPhone(member.phone || '');
      toast.success(`Đã gắn khách hàng: ${member.fullName}`, {
        icon: <UserCheck className="w-4 h-4 text-emerald-500" />,
      });
      if (currentOrder) {
        try {
          const res = await fetch(`${baseUrl}/api/pos/orders/${currentOrder.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              userId: member.id,
              customerName: member.fullName,
              customerPhone: member.phone || undefined,
            }),
          });
          const json = await res.json();
          if (json.success && json.data) {
            const updated = { ...json.data, user: member };
            setCurrentOrder(updated);
            setBranchOrders((prev) =>
              prev.map((o) => (o.id === updated.id ? updated : o)),
            );
          }
        } catch (e) {
          console.error('Failed to auto-save customer to order:', e);
        }
      }
    } else {
      const defaultName =
        orderType === 'TAKEAWAY'
          ? 'Khách mang đi'
          : orderType === 'DELIVERY'
          ? 'Khách giao hàng'
          : 'Khách tại bàn';
      setCustomerName(defaultName);
      setCustomerPhone('');
      if (currentOrder) {
        try {
          await fetch(`${baseUrl}/api/pos/orders/${currentOrder.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              userId: null,
              customerName: defaultName,
              customerPhone: undefined,
            }),
          });
        } catch (e) {
          console.error('Failed to reset customer on order:', e);
        }
      }
    }
  };

  // =========================================================================
  // 1. DATA FETCHING (100% Real from Database)
  // =========================================================================

  const fetchInit = useCallback(async () => {
    try {
      const savedBranch = typeof window !== 'undefined' ? localStorage.getItem('avora_pos_selected_branch') : null;
      const branchParam = savedBranch ? `?branchId=${savedBranch}` : '';
      let res = await fetch(`${baseUrl}/api/pos/init${branchParam}`, { credentials: 'include' });
      
      // Self-healing: Nếu gọi với branchId lưu trong localStorage thất bại (403/lỗi), xóa cache và thử lại không có branchId
      if (!res.ok && savedBranch) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('avora_pos_selected_branch');
        }
        res = await fetch(`${baseUrl}/api/pos/init`, { credentials: 'include' });
      }

      if (!res.ok) {
        console.error('Failed to fetch POS init data, HTTP status:', res.status);
        return;
      }

      const json = await res.json();
      if (json.success && json.data) {
        setBranches(json.data.branches || []);
        if (json.data.canSwitchBranch !== undefined) {
          setCanSwitchBranch(!!json.data.canSwitchBranch);
        }
        if (json.data.currentBranch) {
          setCurrentBranch(json.data.currentBranch);
          if (typeof window !== 'undefined') {
            localStorage.setItem('avora_pos_selected_branch', json.data.currentBranch.id);
          }
        }
        if (json.data.activeShift) {
          setActiveShift(json.data.activeShift);
        }
        if (json.data.vatPriceMode) {
          setVatPriceMode(json.data.vatPriceMode);
        }
        setLastSyncedAt(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch POS init data:', e);
    }
  }, [baseUrl]);

  const fetchProducts = useCallback(
    async (branchId: string, categoryId?: string, query?: string) => {
      setIsLoadingProducts(true);
      try {
        const params = new URLSearchParams({ branchId });
        if (categoryId && categoryId !== 'ALL' && categoryId !== 'BEST_SELLER' && categoryId !== 'FLASH_SALE' && categoryId !== 'BUFFET') {
          params.append('categoryId', categoryId);
        }
        if (query) {
          params.append('search', query);
        }
        const res = await fetch(`${baseUrl}/api/pos/products?${params.toString()}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && json.data) {
          setCategories(json.data.categories || []);
          let prodList: PosProduct[] = json.data.products || [];

          // Quick client filter for badges
          if (categoryId === 'BEST_SELLER') {
            prodList = prodList.filter((p) => p.isBestSeller);
          } else if (categoryId === 'FLASH_SALE') {
            prodList = prodList.filter((p) => p.isFlashSale);
          } else if (categoryId === 'BUFFET') {
            prodList = prodList.filter((p) => p.isBuffetTicket || p.isBuffetItem);
          }

          setProducts(prodList);
        }
      } catch (e) {
        console.error('Failed to fetch products:', e);
      } finally {
        setIsLoadingProducts(false);
      }
    },
    [baseUrl],
  );

  const fetchTables = useCallback(
    async (branchId: string) => {
      setIsLoadingTables(true);
      try {
        const res = await fetch(`${baseUrl}/api/pos/tables?branchId=${branchId}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && json.data) {
          setTables(json.data.tables || []);
          setAreas(json.data.areas || []);
        }
      } catch (e) {
        console.error('Failed to fetch tables:', e);
      } finally {
        setIsLoadingTables(false);
      }
    },
    [baseUrl],
  );

  const fetchKitchenTickets = useCallback(
    async (branchId: string) => {
      try {
        const res = await fetch(`${baseUrl}/api/pos/kitchen/tickets?branchId=${branchId}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && json.data) {
          setKitchenTickets(json.data);
        }
      } catch (e) {
        console.error('Failed to fetch kitchen tickets:', e);
      }
    },
    [baseUrl],
  );

  const fetchOrdersSnapshot = useCallback(
    async (branchId: string) => {
      try {
        const res = await fetch(`${baseUrl}/api/pos/sync/snapshot?branchId=${branchId}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && json.data) {
          setBranchOrders(json.data.activeOrders || []);
          if (json.data.vatPriceMode) {
            setVatPriceMode(json.data.vatPriceMode);
          }
        }
      } catch (e) {
        console.error('Failed to fetch orders snapshot:', e);
      }
    },
    [baseUrl],
  );

  const fetchReservationsCount = useCallback(
    async (branchId: string) => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await fetch(`${baseUrl}/api/pos/reservations?branchId=${branchId}&date=${todayStr}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const now = new Date();
          const currentHours = now.getHours();
          const currentMinutes = now.getMinutes();
          const currentMinutesTotal = currentHours * 60 + currentMinutes;

          const upcomingReservations = json.data.filter((r: any) => {
            // Không tính các đặt bàn đã huỷ, đã ngồi bàn, đã hoàn thành hoặc khách không đến
            if (['CANCELLED', 'SEATED', 'COMPLETED', 'NO_SHOW'].includes(r.status)) return false;

            const rDate = new Date(r.reservationDate);
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            const rDateMidnight = new Date(rDate);
            rDateMidnight.setHours(0, 0, 0, 0);

            if (rDateMidnight.getTime() > todayMidnight.getTime()) return true;
            if (rDateMidnight.getTime() < todayMidnight.getTime()) return false;

            // Cùng ngày hôm nay: chỉ đếm các đặt bàn từ giờ hiện tại trở về sau
            const timeParts = String(r.reservationTime || '').split(':');
            const resMinutes = (parseInt(timeParts[0], 10) || 0) * 60 + (parseInt(timeParts[1], 10) || 0);
            return resMinutes >= currentMinutesTotal;
          });

          setReservationsCount(upcomingReservations.length);
        }
      } catch (e) {
        console.error('Failed to fetch reservations count:', e);
      }
    },
    [baseUrl],
  );

  const fetchPrintSettings = useCallback(
    async (branchId: string) => {
      try {
        const res = await fetch(`${baseUrl}/api/pos/branches/${branchId}/print-settings`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.settings)) {
          setBranchPrintSettings(json.data.settings);
        }
      } catch (e) {
        console.error('Failed to fetch branch print settings:', e);
      }
    },
    [baseUrl],
  );

  useEffect(() => {
    fetchInit();
  }, [fetchInit]);

  useEffect(() => {
    if (currentBranch) {
      fetchProducts(currentBranch.id, selectedCategoryId, searchQuery);
      fetchTables(currentBranch.id);
      fetchKitchenTickets(currentBranch.id);
      fetchOrdersSnapshot(currentBranch.id);
      fetchReservationsCount(currentBranch.id);
      fetchPrintSettings(currentBranch.id);
    }
  }, [
    currentBranch,
    selectedCategoryId,
    searchQuery,
    fetchProducts,
    fetchTables,
    fetchKitchenTickets,
    fetchOrdersSnapshot,
    fetchReservationsCount,
    fetchPrintSettings,
  ]);

  // =========================================================================
  // 2. REALTIME WEBSOCKET SYNC
  // =========================================================================

  const handleSocketOrderCreated = useCallback(
    (newOrder: any, envelope?: any) => {
      if (envelope?.eventId) {
        if (seenEventIds.current.has(envelope.eventId)) return;
        seenEventIds.current.add(envelope.eventId);
        if (seenEventIds.current.size > 100) {
          const first = seenEventIds.current.values().next().value;
          if (first) seenEventIds.current.delete(first);
        }
      }

      if (envelope?.actorId && currentUser?.id && envelope.actorId === currentUser.id) {
        return;
      }

      toast.success(`Đơn mới [${newOrder.orderCode}] vừa tạo!`, {
        icon: <Bell className="w-4 h-4 text-amber-500" />,
        duration: 2500,
      });
      if (currentBranch) {
        fetchOrdersSnapshot(currentBranch.id);
        fetchTables(currentBranch.id);
      }
    },
    [currentBranch, currentUser, fetchOrdersSnapshot, fetchTables],
  );

  const handleSocketOrderUpdated = useCallback(
    (updatedOrder: any, envelope?: any) => {
      if (envelope?.eventId) {
        if (seenEventIds.current.has(envelope.eventId)) return;
        seenEventIds.current.add(envelope.eventId);
        if (seenEventIds.current.size > 100) {
          const first = seenEventIds.current.values().next().value;
          if (first) seenEventIds.current.delete(first);
        }
      }

      if (envelope?.actorId && currentUser?.id && envelope.actorId === currentUser.id) {
        if (currentOrder && currentOrder.id === updatedOrder.id) {
          setCurrentOrder(updatedOrder);
        }
        return;
      }

      if (currentOrder && currentOrder.id === updatedOrder.id) {
        setCurrentOrder(updatedOrder);
      }

      const tableName = updatedOrder.table?.name || updatedOrder.tableName;
      const msg = updatedOrder.notificationMessage || (tableName ? `Có thay đổi ở bàn ${tableName}` : `Đơn [${updatedOrder.orderCode || updatedOrder.temporaryOrderCode}] có cập nhật`);
      toast.success(msg, {
        icon: <Bell className="w-4 h-4 text-amber-500" />,
        duration: 3000,
      });

      if (currentBranch) {
        fetchOrdersSnapshot(currentBranch.id);
        fetchTables(currentBranch.id);
      }
    },
    [currentOrder, currentBranch, currentUser, fetchOrdersSnapshot, fetchTables],
  );

  const handleSocketTableStatusChanged = useCallback((data: any) => {
    if (data?.notificationMessage || data?.tableName) {
      toast.success(data.notificationMessage || `Có thay đổi ở bàn ${data.tableName}`, {
        icon: <Bell className="w-4 h-4 text-amber-500" />,
        duration: 3000,
      });
    }

    setTables((prevTables) =>
      prevTables.map((t) => {
        if (t.id === data.tableId) {
          return {
            ...t,
            visualStatus: data.status,
            activeSession: data.session || null,
            currentOrder: data.order || null,
          };
        }
        return t;
      }),
    );

    if (currentBranch) {
      fetchOrdersSnapshot(currentBranch.id);
      fetchTables(currentBranch.id);
    }
  }, [currentBranch, fetchOrdersSnapshot, fetchTables]);

  const handleSocketKitchenTicket = useCallback(
    (ticket: any) => {
      toast.success(`Bếp nhận món cho ${ticket.tableName}`, {
        icon: <ChefHat className="w-4 h-4 text-orange-500" />,
        duration: 2500,
      });
      if (currentBranch) {
        fetchKitchenTickets(currentBranch.id);
      }
    },
    [currentBranch, fetchKitchenTickets],
  );

  const handleSocketProductAvailability = useCallback((data: any) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === data.productId ? { ...p, available: data.available } : p)),
    );
    if (data.available) {
      toast.success('Món đã mở bán lại', {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
    } else {
      toast.error('Món đã đánh dấu hết hàng', {
        icon: <Ban className="w-4 h-4 text-rose-500" />,
      });
    }
  }, []);

  // =========================================================================
  // REMOTE PRINT DISPATCH (Nhận lệnh in tự động từ Waiter về POS)
  // =========================================================================
  const handleRemotePrintDispatch = useCallback(
    async (payload: any) => {
      if (isTabLocked) {
        console.warn('POS tab đang bị khóa do đa luồng, từ chối in để tránh trùng lặp');
        return;
      }

      if (!payload?.printPayloads || !Array.isArray(payload.printPayloads) || payload.printPayloads.length === 0) {
        return;
      }

      const { orderId, tableName, printPayloads, sender } = payload;

      // Không in lặp nếu chính client POS này đã gửi lệnh qua HTTP
      if (sender?.userId && currentUser?.id && sender.userId === currentUser.id) {
        return;
      }

      let printedSuccess = 0;
      const seenVirtualPrinters = new Set<string>();

      for (const p of printPayloads) {
        if (!p.printerName || !p.htmlContent) continue;

        // Chống spam mở đồng thời nhiều hộp thoại Save As trên máy in ảo
        const isVirtual = /(pdf|onenote|xps|fax|print to)/i.test(p.printerName);
        if (isVirtual) {
          const lowerName = p.printerName.toLowerCase();
          if (seenVirtualPrinters.has(lowerName)) continue;
          seenVirtualPrinters.add(lowerName);
        }
        const jobIds = p.printJobIds || (p.printJobId ? [p.printJobId] : []);
        const printKey = p.idempotencyKey || (jobIds.length > 0 ? jobIds.join('_') : `${p.printerName}_${p.purpose}_${p.htmlContent?.substring(0, 50)}`);
        if (!shouldProcessPrintKey(printKey)) {
          console.log('⚠️ [DEDUPLICATE] Bỏ qua lệnh in remote do đã xử lý gần đây:', printKey);
          continue;
        }

        try {
          if (p.purpose === 'ITEM_LABEL') {
            const res = await printAgent.printLabel({
              printerName: p.printerName,
              htmlContent: p.htmlContent,
              labelSize: p.labelSize || { width: '50mm', height: '30mm' },
              copies: p.copies || 1,
              idempotencyKey: p.idempotencyKey,
            });

            if (res.success) {
              printedSuccess++;
              for (const jid of jobIds) {
                await fetch(`${baseUrl}/api/pos/orders/${orderId}/confirm-print`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ printJobId: jid, status: 'SUCCESS' }),
                }).catch(console.error);
              }
            } else {
              for (const jid of jobIds) {
                await fetch(`${baseUrl}/api/pos/orders/${orderId}/confirm-print`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ printJobId: jid, status: 'FAILED', errorMessage: res.message }),
                }).catch(console.error);
              }
            }
          } else {
            const res = await printAgent.printHtml({
              printerName: p.printerName,
              htmlContent: p.htmlContent,
              paperSize: p.paperSize || '80mm',
              copies: p.copies || 1,
              idempotencyKey: p.idempotencyKey,
            });

            if (res.success) {
              printedSuccess++;
              for (const jid of jobIds) {
                await fetch(`${baseUrl}/api/pos/orders/${orderId}/confirm-print`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ printJobId: jid, status: 'SUCCESS' }),
                }).catch(console.error);
              }
            } else {
              for (const jid of jobIds) {
                await fetch(`${baseUrl}/api/pos/orders/${orderId}/confirm-print`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ printJobId: jid, status: 'FAILED', errorMessage: res.message }),
                }).catch(console.error);
              }
            }
          }
        } catch (err) {
          console.error('Lỗi in tự động từ remote print dispatch:', err);
        }
      }

      if (printedSuccess > 0) {
        toast.success(
          `[In tự động] Đã in ${printedSuccess} phiếu Bếp/Bar cho bàn ${tableName || 'Đơn hàng'} (Gửi bởi ${sender || 'Nhân viên Waiter'})`,
          {
            icon: <Printer className="w-4 h-4 text-emerald-500" />,
            duration: 6000,
          },
        );
        if (currentBranch) fetchKitchenTickets(currentBranch.id);
      }
    },
    [baseUrl, currentBranch, fetchKitchenTickets, isTabLocked],
  );

  const handleOrderPaymentSucceededRef = useRef<(payload: any) => void>(() => {});

  const { connectionStatus, emitHealthStatus } = usePosSocket({
    branchId: currentBranch?.id,
    cashierId: currentUser?.id,
    isPosTerminal: !isTabLocked,
    onPrintDispatch: handleRemotePrintDispatch,
    onOrderCreated: handleSocketOrderCreated,
    onOrderUpdated: handleSocketOrderUpdated,
    onTableStatusChanged: handleSocketTableStatusChanged,
    onKitchenTicketNew: handleSocketKitchenTicket,
    onProductAvailabilityChanged: handleSocketProductAvailability,
    onPaymentCompleted: (payload) => {
      handleOrderPaymentSucceededRef.current(payload);
    },
    onOrderPaid: (payload) => {
      handleOrderPaymentSucceededRef.current(payload);
    },
    onAccessRevoked: (payload) => {
      if (!payload?.userId || payload.userId === currentUser?.id) {
        setAccessDeniedModal({
          title: 'Quyền truy cập vừa bị thu hồi',
          message: 'Quyền truy cập POS của bạn vừa bị quản trị viên thu hồi. Phiên làm việc sẽ tự động đóng để bảo vệ dữ liệu.',
          countdown: 5,
        });
      }
    },
    onForceLogout: (payload) => {
      if (!payload?.userId || payload.userId === currentUser?.id) {
        setAccessDeniedModal({
          title: 'Buộc đăng xuất từ xa',
          message: payload?.reason || 'Phiên làm việc POS của bạn đã bị ngắt kết nối từ xa bởi quản trị viên.',
          countdown: 5,
        });
      }
    },
    onBankDeviceHealthUpdate: (payload) => {
      if (payload && typeof payload.batteryLevel === 'number') {
        if (payload.batteryLevel <= 20 && !payload.isCharging) {
          setBankGatewayBatteryAlert({
            batteryLevel: payload.batteryLevel,
            message: `🔌 Điện thoại trạm thu Ngân hàng đang yếu pin (${payload.batteryLevel}%), vui lòng cắm sạc ngay để không gián đoạn quét QR!`,
          });
        } else {
          setBankGatewayBatteryAlert(null);
        }
      }
    },
    onOverpaidDuplicateAlert: (payload) => {
      if (payload) {
        setOverpaidDuplicateAlert(payload);
        toast.error(`⚠️ ${payload.message || `Khách chuyển trùng tiền đơn #${payload.orderCode}!`}`, {
          duration: 10000,
        });
      }
    },
    onSyncSnapshot: () => {
      if (currentBranch) {
        fetchOrdersSnapshot(currentBranch.id);
        fetchTables(currentBranch.id);
        fetchKitchenTickets(currentBranch.id);
        fetchReservationsCount(currentBranch.id);
      }
    },
  });

  // Báo cáo trạng thái Print Agent định kỳ về server để các máy Waiter biết POS sẵn sàng in
  useEffect(() => {
    if (!currentBranch?.id || isTabLocked) return;
    const checkAndEmit = async () => {
      try {
        const res = await printAgent.checkHealth().catch(() => null);
        const isOnline = Boolean(res && (res.ok || res.status === 'ONLINE'));
        emitHealthStatus(isOnline);
      } catch {
        emitHealthStatus(false);
      }
    };
    checkAndEmit();
    const interval = setInterval(checkAndEmit, 20000);
    return () => clearInterval(interval);
  }, [currentBranch?.id, isTabLocked, emitHealthStatus]);

  // =========================================================================
  // 3. CART ACTIONS & OPERATIONS (Pure Local State - No Auto Saving)
  // =========================================================================

  // Pure Immutable Cart Item Addition with Strict cartLineIdentity
  const addItemToCart = (
    product: PosProduct,
    quantity: number = 1,
    selectedOptions: {
      optionItemId: string;
      nameAtSale: string;
      priceAdjustmentAtSale: number;
    }[] = [],
    note?: string,
    pricingMode: 'REGULAR' | 'BUFFET_TICKET' | 'BUFFET_INCLUDED' = 'REGULAR',
    buffetSessionId?: string | null,
    buffetPackageId?: string | null,
    source: 'POS' | 'WAITER' | 'QR_ORDER' = 'POS',
    customUnitPrice?: number,
  ) => {
    if (isOnlineOrder(currentOrder)) {
      toast.error('Đơn hàng Online chỉ được phép xem, không được thêm món!');
      return;
    }
    if (currentOrder?.paymentStatus === 'AWAITING_PAYMENT') {
      toast.error('Đơn hàng đang chờ xác nhận chuyển khoản (đã giải phóng bàn), không thể thêm món mới!');
      return;
    }
    const safeQty = normalizePosQty(quantity) || 1;
    const extraPrice = selectedOptions.reduce((sum, o) => sum + o.priceAdjustmentAtSale, 0);
    // Base product is 0đ for BUFFET_INCLUDED, or customUnitPrice if open-price enabled on POS
    const hasCustomBasePrice =
      pricingMode !== 'BUFFET_INCLUDED' &&
      Boolean(product.allowOpenPriceOnPos) &&
      customUnitPrice !== undefined &&
      Number.isFinite(customUnitPrice) &&
      customUnitPrice >= 0;
    const basePrice =
      pricingMode === 'BUFFET_INCLUDED'
        ? 0
        : hasCustomBasePrice
          ? Math.round(customUnitPrice!)
          : product.effectivePrice;
    const finalPrice = basePrice + extraPrice;
    const cleanNote = note?.trim() || undefined;

    const candidateItem = {
      productId: product.id,
      selectedOptions: selectedOptions || [],
      note: cleanNote || null,
      priceAtSale: finalPrice,
      discountAmount: 0,
      discountReason: null,
      kitchenStatus: 'PENDING' as const,
      pricingMode,
      buffetSessionId: buffetSessionId || null,
    };
    const candidateLineId = getCartLineIdentity(candidateItem);

    setCartItems((prevItems) => {
      // Find matching item by strict cartLineIdentity:
      // Only merge if identical options, note, price, discount, kitchenStatus AND identical pricingMode + buffetSessionId
      const targetIdx = prevItems.findIndex(
        (it) =>
          getCartLineIdentity(it) === candidateLineId &&
          (!it.kitchenStatus || it.kitchenStatus === 'PENDING'),
      );

      if (targetIdx >= 0) {
        return prevItems.map((it, idx) =>
          idx === targetIdx ? { ...it, quantity: normalizePosQty(it.quantity + safeQty) } : it,
        );
      }

      // Otherwise, SPLIT into a new line
      const newItem: PosCartItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId: product.id,
        product,
        quantity: safeQty,
        priceAtSale: finalPrice,
        originalPriceAtSale: product.price + extraPrice,
        customPrice: hasCustomBasePrice ? Math.round(customUnitPrice!) : undefined,
        taxPercentageAtSale:
          (product as any).taxPercentage !== undefined && (product as any).taxPercentage !== null
            ? Number((product as any).taxPercentage)
            : 8,
        selectedOptions: selectedOptions || [],
        note: cleanNote,
        kitchenStatus: 'PENDING',
        sentQuantity: 0,
        savedQuantity: 0,
        printedQuantity: 0,
        optionsTextSnapshot:
          selectedOptions.length > 0
            ? selectedOptions.map((o) => o.nameAtSale).join(', ')
            : undefined,
        orderedById: currentUser?.id,
        orderedByName: currentUser?.fullName || 'Thu ngân POS',
        pricingMode,
        buffetSessionId: buffetSessionId || null,
        buffetPackageId: buffetPackageId || null,
        buffetReferencePriceSnapshot: pricingMode === 'BUFFET_INCLUDED' ? product.price : undefined,
        source,
        createdAt: new Date().toISOString(),
      };
      return [...prevItems, newItem];
    });

    const badgeText = pricingMode === 'BUFFET_INCLUDED' ? ' (Buffet 0đ)' : '';
    toast.success(`Đã thêm: ${product.name}${badgeText}${quantity > 1 ? ` (x${quantity})` : ''}`, {
      duration: 1200,
      id: `add-${product.id}-${pricingMode}`,
    });
  };

  const focusAndSelectSearch = useCallback(() => {
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    }, 40);
  }, []);

  const handleSelectProduct = (product: PosProduct) => {
    if (isOnlineOrder(currentOrder)) {
      toast.error('Đơn hàng Online chỉ được phép xem, không được thêm món!');
      return;
    }
    if (currentOrder?.paymentStatus === 'AWAITING_PAYMENT') {
      toast.error('Đơn hàng đang chờ xác nhận chuyển khoản (đã giải phóng bàn), không thể thêm món mới!');
      return;
    }

    // 1. Check if selected product is a Buffet Ticket
    if (product.isBuffetTicket) {
      if (product.optionGroups && product.optionGroups.length > 0) {
        setPendingPricingMode('BUFFET_TICKET');
        setSelectedOptionProduct(product);
      } else {
        addItemToCart(product, 1, [], undefined, 'BUFFET_TICKET');
        focusAndSelectSearch();
      }
      return;
    }

    // 2. Check if current table has an active buffet session
    const activeBuffet =
      (currentOrder as any)?.buffetSessions?.find((s: any) => s.status === 'ACTIVE') ||
      (currentOrder as any)?.buffetSessions?.[0] ||
      (currentOrder as any)?.buffetSession;
    const isBuffetActive = activeBuffet && activeBuffet.status === 'ACTIVE';
    const isItemInBuffet =
      isBuffetActive &&
      activeBuffet.buffetPackage?.items?.some((it: any) => it.productId === product.id);

    if (isItemInBuffet) {
      // Must prompt staff: "Trong gói Buffet (0đ)" vs "Món lẻ (Xđ)"
      setBuffetSelectionProduct(product);
      return;
    }

    if (product.optionGroups && product.optionGroups.length > 0) {
      setPendingPricingMode('REGULAR');
      setSelectedOptionProduct(product);
    } else if (isWeightUnit(product.unit) || product.allowOpenPriceOnPos) {
      setKeypadItem(null);
      setKeypadAddContext({ product, pricingMode: 'REGULAR' });
      setIsKeypadOpen(true);
    } else {
      addItemToCart(product, 1, [], undefined, 'REGULAR');
      focusAndSelectSearch();
    }
  };

  const handleBuffetSelect = (mode: 'BUFFET_INCLUDED' | 'REGULAR') => {
    if (!buffetSelectionProduct) return;
    const product = buffetSelectionProduct;
    const activeBuffet =
      (currentOrder as any)?.buffetSessions?.find((s: any) => s.status === 'ACTIVE') ||
      (currentOrder as any)?.buffetSessions?.[0] ||
      (currentOrder as any)?.buffetSession;
    setBuffetSelectionProduct(null);

    if (product.optionGroups && product.optionGroups.length > 0) {
      setPendingPricingMode(mode);
      setSelectedOptionProduct(product);
    } else if (mode !== 'BUFFET_INCLUDED' && (isWeightUnit(product.unit) || product.allowOpenPriceOnPos)) {
      setKeypadItem(null);
      setKeypadAddContext({
        product,
        pricingMode: mode,
        buffetSessionId: null,
        buffetPackageId: null,
      });
      setIsKeypadOpen(true);
    } else {
      addItemToCart(
        product,
        1,
        [],
        undefined,
        mode,
        mode === 'BUFFET_INCLUDED' ? activeBuffet?.id : null,
        mode === 'BUFFET_INCLUDED' ? activeBuffet?.buffetPackageId : null,
        'POS',
      );
      focusAndSelectSearch();
    }
  };

  const handleConfirmProductOptions = (
    product: PosProduct,
    quantity: number,
    selectedOptions: {
      optionItemId: string;
      nameAtSale: string;
      priceAdjustmentAtSale: number;
    }[],
    note?: string,
    customUnitPrice?: number,
  ) => {
    if (isOnlineOrder(currentOrder)) {
      toast.error('Đơn hàng Online chỉ được phép xem, không được thêm món!');
      return;
    }
    if (currentOrder?.paymentStatus === 'AWAITING_PAYMENT') {
      toast.error('Đơn hàng đang chờ xác nhận chuyển khoản (đã giải phóng bàn), không thể thêm món mới!');
      return;
    }
    const activeBuffet =
      (currentOrder as any)?.buffetSessions?.find((s: any) => s.status === 'ACTIVE') ||
      (currentOrder as any)?.buffetSessions?.[0] ||
      (currentOrder as any)?.buffetSession;
    const isBuffet = pendingPricingMode === 'BUFFET_INCLUDED' && activeBuffet?.status === 'ACTIVE';

    addItemToCart(
      product,
      quantity,
      selectedOptions,
      note,
      pendingPricingMode,
      isBuffet ? activeBuffet?.id : null,
      isBuffet ? activeBuffet?.buffetPackageId : null,
      'POS',
      customUnitPrice,
    );
    setSelectedOptionProduct(null);
    setPendingPricingMode('REGULAR');
    focusAndSelectSearch();
  };

  const handleConfirmApplyBuffet = (
    tickets: Array<{ product: PosProduct; quantity: number }>,
    packageName: string,
  ) => {
    for (const t of tickets) {
      addItemToCart(t.product, t.quantity, [], undefined, 'BUFFET_TICKET');
    }
    toast.success(`Đã thêm vé gói: ${packageName} (${tickets.reduce((s, i) => s + i.quantity, 0)} vé)`);
  };

  // Luôn mặc định active vào ô tìm kiếm khi vào chi tiết đơn hàng (SALE) và khi không mở modal nào khác
  useEffect(() => {
    if (
      activeTab === 'SALE' &&
      !isPaymentModalOpen &&
      !selectedOptionProduct &&
      !isCustomerSelectModalOpen &&
      !isDeliveryModalOpen &&
      !isItemDiscountModalOpen &&
      !isOrderDiscountModalOpen &&
      !isSplitModalOpen &&
      !isMergeModalOpen &&
      !isMoveTableModalOpen &&
      !isCancelOrderModalOpen &&
      !isGuestCountModalOpen &&
      !isReprintLabelsModalOpen &&
      !isSettingsDrawerOpen &&
      !isKeypadOpen
    ) {
      const timer = setTimeout(() => {
        const active = document.activeElement;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
          searchInputRef.current?.focus();
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [
    activeTab,
    isPaymentModalOpen,
    selectedOptionProduct,
    isCustomerSelectModalOpen,
    isDeliveryModalOpen,
    isItemDiscountModalOpen,
    isOrderDiscountModalOpen,
    isSplitModalOpen,
    isMergeModalOpen,
    isMoveTableModalOpen,
    isCancelOrderModalOpen,
    isGuestCountModalOpen,
    isReprintLabelsModalOpen,
    isSettingsDrawerOpen,
    isKeypadOpen,
  ]);

  // Khi chuyển vào tab SALE (vào bất kỳ đơn hàng nào) hoặc đổi đơn hàng / đổi bàn, tự động làm mới & xóa sạch ô tìm kiếm
  const prevTabRef = useRef<string>(activeTab);
  const prevOrderIdRef = useRef<string | null | undefined>(undefined);
  const prevTableIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (activeTab === 'SALE' && prevTabRef.current !== 'SALE') {
      setSearchQuery('');
    }
    prevTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (prevOrderIdRef.current !== undefined || prevTableIdRef.current !== undefined) {
      if (
        prevOrderIdRef.current !== (currentOrder?.id || null) ||
        prevTableIdRef.current !== (selectedTable?.id || null)
      ) {
        setSearchQuery('');
      }
    }
    prevOrderIdRef.current = currentOrder?.id || null;
    prevTableIdRef.current = selectedTable?.id || null;
  }, [currentOrder?.id, selectedTable?.id]);

  const handleUpdateItemQuantity = (id: string, qty: number, customUnitPrice?: number) => {
    if (isOnlineOrder(currentOrder)) {
      toast.error('Đơn hàng Online chỉ được phép xem, không được sửa món!');
      return;
    }
    const item = cartItems.find((it) => it.id === id);
    if (!item) return;

    const cleanQty = normalizePosQty(qty);
    if (cleanQty <= 0) {
      handleRemoveCartItem(id);
      return;
    }

    setCartItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const newSent = it.sentQuantity !== undefined ? Math.min(it.sentQuantity, cleanQty) : undefined;
        const newPrinted = it.printedQuantity !== undefined ? Math.min(it.printedQuantity, cleanQty) : undefined;
        const optAdj = (it.selectedOptions || []).reduce(
          (s, o) => s + Number(o.priceAdjustmentAtSale || 0),
          0,
        );
        const canOverridePrice =
          Boolean(it.product?.allowOpenPriceOnPos) &&
          it.pricingMode !== 'BUFFET_INCLUDED' &&
          customUnitPrice !== undefined &&
          Number.isFinite(customUnitPrice) &&
          customUnitPrice >= 0;
        const nextCustomPrice = canOverridePrice ? Math.round(customUnitPrice!) : it.customPrice;
        const nextPriceAtSale = canOverridePrice ? nextCustomPrice! + optAdj : it.priceAtSale;
        return {
          ...it,
          quantity: cleanQty,
          customPrice: nextCustomPrice,
          priceAtSale: nextPriceAtSale,
          sentQuantity: newSent,
          printedQuantity: newPrinted,
        };
      }),
    );
  };

  const handleRemoveCartItem = (id: string) => {
    if (isOnlineOrder(currentOrder)) {
      toast.error('Đơn hàng Online không thể xóa món!');
      return;
    }
    setCartItems((prev) => prev.filter((it) => it.id !== id));
    toast('Đã xóa món khỏi đơn', {
      icon: <Trash2 className="w-4 h-4 text-slate-500" />,
      duration: 1500,
    });
  };

  const handleUpdateItemNote = (id: string, note: string) => {
    setCartItems((prev) => prev.map((it) => (it.id === id ? { ...it, note } : it)));
  };

  // =========================================================================
  // UNIFIED ORDER LOADER - GUARANTEES 100% CLEAN ISOLATION BETWEEN ORDERS
  // =========================================================================
  const loadOrderIntoPos = useCallback((order: PosOrder | null, tableFallback?: PosTable | null) => {
    if (!order) {
      setCurrentOrder(null);
      setCartItems([]);
      setSelectedTable(tableFallback || null);
      setOrderType(tableFallback ? 'DINE_IN' : 'TAKEAWAY');
      setGuestCount(tableFallback && tableFallback.capacity > 0 ? tableFallback.capacity : (tableFallback ? 2 : 1));
      setDeliveryInfo(null);
      setOrderDiscount(null);
      setOrderNote('');
      setCustomerName(tableFallback ? 'Khách tại bàn' : 'Khách mang đi');
      setCustomerPhone('');
      setSelectedMember(null);
      setIsDetailMode(false);
      setSearchQuery('');
      return;
    }

    setCurrentOrder(order);
    setSelectedTable(order.table || tableFallback || null);
    const resolvedType =
      order.table || order.tableId
        ? 'DINE_IN'
        : order.orderType === 'DELIVERY' &&
          order.deliveryAddress &&
          !/mang\s*về|take\s*away|tại\s*bàn/i.test(order.deliveryAddress)
        ? 'DELIVERY'
        : 'TAKEAWAY';
    setOrderType(resolvedType);
    setGuestCount(order.guestCount || (order.table?.capacity ? order.table.capacity : 1));
    setCustomerName(order.customerName || (order.table ? 'Khách tại bàn' : 'Khách mang đi'));
    setCustomerPhone(order.customerPhone || '');
    setOrderNote(order.note || '');

    if ((order as any).user) {
      setSelectedMember((order as any).user);
    } else {
      setSelectedMember(null);
      if (order.userId) {
        fetch(
          `${baseUrl}/api/pos/members?search=${encodeURIComponent(order.customerPhone || order.customerName)}`,
          { credentials: 'include' },
        )
          .then((r) => r.json())
          .then((j) => {
            if (j.success && Array.isArray(j.data) && j.data.length > 0) {
              const found = j.data.find((m: any) => m.id === order.userId) || j.data[0];
              setSelectedMember(found);
            }
          })
          .catch(console.error);
      }
    }

    if (resolvedType === 'DELIVERY' && order.deliveryAddress) {
      setDeliveryInfo({
        customerName: order.customerName || 'Khách giao hàng',
        customerPhone: order.customerPhone || '',
        deliveryAddress: order.deliveryAddress,
        notes: order.note || '',
        member: (order as any).user || null,
      });
    } else {
      setDeliveryInfo(null);
    }

    if (order.discountAmount && order.discountAmount > 0) {
      let discType: 'PERCENT' | 'FIXED' | 'VOUCHER' = (order as any).discountType || 'FIXED';
      let discPercent: number | undefined = (order as any).discountPercent || undefined;
      if (!discPercent && order.subTotal > 0) {
        const pct = Math.round((order.discountAmount / order.subTotal) * 100);
        if ([100, 50, 30, 20, 15, 10, 5].includes(pct)) {
          discType = 'PERCENT';
          discPercent = pct;
        }
      }
      setOrderDiscount({
        discountAmount: order.discountAmount,
        discountReason: order.discountReason || '',
        discountType: discType,
        discountPercent: discPercent,
      });
    } else {
      setOrderDiscount(null);
    }

    setCartItems(mapAndSortOrderItemsToCart(order.orderItems || []));

    setIsDetailMode(false);
    setSearchQuery('');
  }, []);
  loadOrderIntoPosRef.current = loadOrderIntoPos;

  const handleClearCart = () => {
    loadOrderIntoPos(null);
    toast('Đã làm mới đơn hàng (F1)', {
      icon: <Trash2 className="w-4 h-4 text-gray-500" />,
      duration: 1200,
    });
  };

  // Switch to Takeaway (F1 Default - Luôn mở đơn mang đi mới tinh)
  const handleSelectTakeaway = useCallback(() => {
    loadOrderIntoPos(null);
    setActiveTab('SALE');
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
    toast.success('Đã mở đơn mang đi mới (F1)', {
      icon: <ShoppingBag className="w-4 h-4 text-emerald-500" />,
      duration: 1500,
    });
  }, [loadOrderIntoPos]);

  // Switch to Delivery (F2)
  const handleSelectDelivery = useCallback(() => {
    setOrderType('DELIVERY');
    setSelectedTable(null);
    setCustomerName('Khách giao hàng');
    setActiveTab('SALE');
    setSearchQuery('');
    setIsDeliveryModalOpen(true);
  }, []);

  // Save confirmed delivery address
  const handleConfirmDelivery = (info: PosDeliveryInfo) => {
    setDeliveryInfo(info);
    setCustomerName(info.customerName || 'Khách giao hàng');
    setCustomerPhone(info.customerPhone || '');
    if (info.member) {
      setSelectedMember(info.member);
      if (currentOrder?.id) {
        fetch(`${baseUrl}/api/pos/orders/${currentOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            expectedVersion: currentOrder.version,
            userId: info.member.id,
            customerName: info.customerName,
            customerPhone: info.customerPhone,
          }),
        }).catch(console.error);
      }
    }
    setIsDeliveryModalOpen(false);
    toast.success(`Đã lưu địa chỉ giao hàng: ${info.customerName} (${info.customerPhone})`);
  };

  // Item discount handlers
  const handleOpenItemDiscount = (item: PosCartItem) => {
    setSelectedDiscountItem(item);
    setIsItemDiscountModalOpen(true);
  };

  const handleApplyItemDiscount = async (itemId: string, discountAmount: number, discountReason: string) => {
    setCartItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, discountAmount, discountReason }
          : it
      )
    );
    setIsItemDiscountModalOpen(false);
    setSelectedDiscountItem(null);
    toast.success(
      discountAmount > 0
        ? `Đã giảm giá món: -${discountAmount.toLocaleString('vi-VN')}đ`
        : 'Đã bỏ giảm giá món'
    );

    // Save immediately if order exists in DB and item exists in DB
    if (currentOrder?.id) {
      const isExistingItem = currentOrder.orderItems?.some((oi) => oi.id === itemId);
      if (isExistingItem) {
        try {
          const res = await fetch(`${baseUrl}/api/pos/orders/${currentOrder.id}/items/${itemId}/discount`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              discountAmount,
              discountReason,
            }),
          });
          const json = await res.json();
          if (json.success && json.data) {
            setCurrentOrder(json.data);
          }
        } catch (e) {
          console.error('Lỗi cập nhật giảm giá món:', e);
        }
      }
    }
  };

  // Order discount handler - persists immediately and maintains percentage scaling
  const handleApplyOrderDiscount = async (
    amount: number,
    reason: string,
    discountType?: 'PERCENT' | 'FIXED' | 'VOUCHER' | 'POINTS',
    discountPercent?: number,
  ) => {
    if (amount > 0) {
      const discountObj = {
        discountAmount: amount,
        discountReason: reason,
        discountType: discountType || (discountPercent ? 'PERCENT' : 'FIXED'),
        discountPercent: discountPercent,
      };
      setOrderDiscount(discountObj);
      if (currentOrder) {
        setCurrentOrder((prev: any) =>
          prev
            ? {
                ...prev,
                discountAmount: amount,
                discountReason: reason,
                discountType: discountObj.discountType,
                discountPercent: discountObj.discountPercent,
              }
            : prev,
        );
        if (currentOrder.id) {
          try {
            const res = await fetch(`${baseUrl}/api/pos/orders/${currentOrder.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                expectedVersion: currentOrder.version,
                discountAmount: amount,
                discountReason: reason,
                discountType: discountObj.discountType,
                discountPercent: discountObj.discountPercent,
              }),
            });
            const data = await res.json();
            if (data.success && data.data) {
              setCurrentOrder(data.data);
            }
          } catch (err) {
            console.error('Lỗi lưu giảm giá đơn hàng:', err);
          }
        }
      }
      toast.success(
        discountType === 'PERCENT' && discountPercent
          ? `Đã giảm giá toàn đơn ${discountPercent}%: -${amount.toLocaleString('vi-VN')}đ`
          : `Đã giảm giá đơn: -${amount.toLocaleString('vi-VN')}đ`,
      );
    } else {
      setOrderDiscount(null);
      if (currentOrder) {
        setCurrentOrder((prev: any) =>
          prev
            ? {
                ...prev,
                discountAmount: 0,
                discountReason: null,
                discountType: null,
                discountPercent: null,
              }
            : prev,
        );
        if (currentOrder.id) {
          try {
            const res = await fetch(`${baseUrl}/api/pos/orders/${currentOrder.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                expectedVersion: currentOrder.version,
                discountAmount: 0,
                discountReason: '',
                discountType: null,
                discountPercent: null,
              }),
            });
            const data = await res.json();
            if (data.success && data.data) {
              setCurrentOrder(data.data);
            }
          } catch (err) {
            console.error('Lỗi xóa giảm giá đơn hàng:', err);
          }
        }
      }
      toast.success('Đã xóa giảm giá đơn');
    }
    setIsOrderDiscountModalOpen(false);
  };

  // Handle points reward redemption in POS
  const handleRedeemRewardInPos = async (reward: any, member: any) => {
    const requiredPoints = reward.redemptionPoints || 0;
    if (currentOrder?.id) {
      try {
        const res = await fetch(`${baseUrl}/api/pos/orders/${currentOrder.id}/redeem-reward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            productId: reward.id,
            userId: member.id,
            quantity: 1,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`Đã đổi món "${reward.name}" vào đơn hàng!`);
          if (data.data) {
            loadOrderIntoPos(data.data);
          }
          if (currentBranch?.id) {
            fetchOrdersSnapshot(currentBranch.id);
          }
        } else {
          toast.error(data.message || 'Đổi điểm thất bại');
        }
      } catch (err: any) {
        toast.error(err.message || 'Lỗi khi đổi món');
      }
    } else {
      // Draft cart
      addItemToCart(
        {
          ...reward,
          effectivePrice: 0,
          price: reward.price || 0,
        },
        1,
        [],
        `Đổi điểm thưởng (${requiredPoints.toLocaleString('vi-VN')} điểm)`,
        'REGULAR',
      );
      toast.success(`Đã thêm món "${reward.name}" đổi điểm vào giỏ!`);
    }

    // Deduct member points locally
    setSelectedMember((prev: any) =>
      prev
        ? {
            ...prev,
            points: Math.max(0, (prev.points ?? prev.currentPoints ?? 0) - requiredPoints),
            currentPoints: Math.max(0, (prev.currentPoints ?? prev.points ?? 0) - requiredPoints),
          }
        : null,
    );
  };

  // Select Table from Map
  const handleSelectTableFromMap = (table: PosTable) => {
    originTabRef.current = 'TABLES';
    const existing = table.currentOrder ? branchOrders.find((o) => o.id === table.currentOrder?.id) : null;
    loadOrderIntoPos(existing || null, table);
    toast.success(`Đã chọn bàn: ${table.name}`, { duration: 1200, id: `tbl-${table.id}` });
    setActiveTab('SALE');
  };

  // =========================================================================
  // 4. EXPLICIT SAVE ORDER ("LƯU ĐƠN") - NOT AUTO SAVED ON CLICK
  // =========================================================================
  const handleSaveOrder = async (silent: boolean = false): Promise<any> => {
    if (!currentBranch) {
      toast.error('Vui lòng chọn chi nhánh');
      return null;
    }
    if (isOnlineOrder(currentOrder)) {
      return currentOrder;
    }

    setIsSavingOrder(true);
    try {
      const deliveryAddressStr =
        orderType === 'DELIVERY' && deliveryInfo
          ? `${deliveryInfo.customerName} (${deliveryInfo.customerPhone}) - ${deliveryInfo.deliveryAddress}${deliveryInfo.notes ? ` [Ghi chú: ${deliveryInfo.notes}]` : ''}`
          : undefined;

      // Case 1: Create New Order
      if (!currentOrder?.id) {
        const res = await fetch(`${baseUrl}/api/pos/orders/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            branchId: currentBranch.id,
            tableId: selectedTable?.id,
            guestCount,
            customerName,
            customerPhone,
            userId: selectedMember?.id,
            orderType: selectedTable ? 'DINE_IN' : orderType,
            deliveryAddress: deliveryAddressStr,
            note: orderNote?.trim() || undefined,
            discountAmount: orderDiscount?.discountAmount || 0,
            discountReason: orderDiscount?.discountReason || undefined,
            discountType: orderDiscount?.discountType,
            discountPercent: orderDiscount?.discountPercent,
            items: cartItems.map((it, idx) => ({
              id: it.id && !it.id.startsWith('item-') ? it.id : undefined,
              productId: it.productId,
              quantity: normalizePosQty(it.quantity) || it.quantity,
              customPrice: it.customPrice,
              note: it.note,
              selectedOptionIds: it.selectedOptions.map((so) => so.optionItemId),
              discountAmount: it.discountAmount || 0,
              discountReason: it.discountReason || undefined,
              pricingMode: it.pricingMode || 'REGULAR',
              buffetSessionId: it.buffetSessionId || undefined,
              buffetPackageId: it.buffetPackageId || undefined,
              buffetPackageNameSnapshot: (it as any).buffetPackageNameSnapshot || undefined,
              source: it.source || 'POS',
              orderedById: it.orderedById,
              orderedByName: it.orderedByName,
              createdAt: it.createdAt || new Date(Date.now() + idx * 50).toISOString(),
            })),
          }),
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.message || 'Không thể tạo đơn hàng');
        }

        setCurrentOrder(json.data);
        if (json.data.orderItems) {
          setCartItems(mapAndSortOrderItemsToCart(json.data.orderItems, cartItems));
        }

        if (!silent) {
          const savedCode = json.data.orderCode || json.data.temporaryOrderCode || 'Nháp';
          toast.success(`Đã lưu đơn mới [${savedCode}]!`, {
            icon: <Save className="w-4 h-4 text-emerald-500" />,
          });
          fetchOrdersSnapshot(currentBranch.id);
          fetchTables(currentBranch.id);
        } else {
          setTimeout(() => {
            fetchOrdersSnapshot(currentBranch.id);
            fetchTables(currentBranch.id);
          }, 30);
        }
        return json.data;
      } else {
        // Case 2: Update Existing Order with Concurrency Lock
        const res = await fetch(`${baseUrl}/api/pos/orders/${currentOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            items: cartItems.map((it, idx) => ({
              id: it.id && !it.id.startsWith('item-') ? it.id : undefined,
              productId: it.productId,
              quantity: normalizePosQty(it.quantity) || it.quantity,
              customPrice: it.customPrice,
              note: it.note,
              selectedOptionIds: it.selectedOptions.map((so) => so.optionItemId),
              discountAmount: it.discountAmount || 0,
              discountReason: it.discountReason || undefined,
              pricingMode: it.pricingMode || 'REGULAR',
              buffetSessionId: it.buffetSessionId || undefined,
              buffetPackageId: it.buffetPackageId || undefined,
              buffetPackageNameSnapshot: (it as any).buffetPackageNameSnapshot || undefined,
              source: it.source || 'POS',
              orderedById: it.orderedById,
              orderedByName: it.orderedByName,
              createdAt: it.createdAt || new Date(Date.now() + idx * 50).toISOString(),
            })),
            guestCount,
            customerName,
            customerPhone,
            userId: selectedMember?.id,
            expectedVersion: currentOrder.version,
            deliveryAddress: deliveryAddressStr,
            note: orderNote?.trim() || null,
            discountAmount: orderDiscount?.discountAmount || 0,
            discountReason: orderDiscount?.discountReason || undefined,
            discountType: orderDiscount?.discountType,
            discountPercent: orderDiscount?.discountPercent,
          }),
        });

        if (res.status === 409) {
          toast.error('Đơn hàng đã được thiết bị khác cập nhật! Đang tải dữ liệu mới...', {
            duration: 4000,
            icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
          });
          fetchOrdersSnapshot(currentBranch.id);
          fetchTables(currentBranch.id);
          return null;
        }

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.message || 'Không thể cập nhật đơn hàng');
        }

        setCurrentOrder(json.data);
        if (json.data.orderItems && json.data.orderItems.length > 0) {
          setCartItems(mapAndSortOrderItemsToCart(json.data.orderItems, cartItems));
        } else {
          setCartItems([]);
        }

        if (!silent) {
          toast.success(
            cartItems.length === 0
              ? `Đã cập nhật đơn [${json.data.orderCode}] (đã xóa hết món)!`
              : `Đã lưu cập nhật đơn [${json.data.orderCode}]!`,
            {
              icon: <Save className="w-4 h-4 text-emerald-500" />,
            },
          );
          fetchOrdersSnapshot(currentBranch.id);
          fetchTables(currentBranch.id);
        } else {
          setTimeout(() => {
            fetchOrdersSnapshot(currentBranch.id);
            fetchTables(currentBranch.id);
          }, 30);
        }
        return json.data;
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu đơn hàng');
      return null;
    } finally {
      setIsSavingOrder(false);
    }
  };

  // =========================================================================
  // 5. OTHER MUTATIONS (Send Kitchen, Hold, Pay, Split, Merge, Move)
  // =========================================================================

  // Quy trình F2: TIẾN HÀNH LƯU ĐƠN -> RỒI MỚI GỬI BẾP
  const handleSendToKitchen = async () => {
    if (!currentBranch || cartItems.length === 0) return;
    if (isOnlineOrder(currentOrder)) {
      toast.error('Đơn hàng Online đã được đặt trực tuyến, không gửi bếp từ POS!');
      return;
    }
    setIsSendingKitchen(true);

    try {
      // BƯỚC 1: TIẾN HÀNH LƯU ĐƠN TRƯỚC (Bắt buộc để CSDL có đầy đủ món mới nhất)
      const savedOrder = await handleSaveOrder(true);
      const targetOrderId = savedOrder?.id || currentOrder?.id;
      if (!targetOrderId) {
        throw new Error('Không thể lưu đơn trước khi gửi bếp');
      }

      // BƯỚC 2: GỬI LỆNH BẾP TỚI BACKEND
      const sendRes = await fetch(`${baseUrl}/api/pos/orders/${targetOrderId}/send-kitchen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const sendJson = await sendRes.json();

      if (sendJson.success) {
        toast.success('Đã lưu đơn và gửi bếp thành công! (F2)', {
          icon: <ChefHat className="w-4 h-4 text-orange-500" />,
        });
        const updatedOrder = sendJson.data?.order || sendJson.data?.updatedOrder || sendJson.data;
        setCurrentOrder(updatedOrder);
        setCartItems((prev) =>
          prev.map((it) => ({
            ...it,
            sentQuantity: it.quantity,
            printedQuantity: it.quantity,
            kitchenStatus: 'SENT',
          })),
        );
        fetchKitchenTickets(currentBranch.id);

        // Phát lệnh in âm thầm tới máy in Bếp/Bar và Tem nhãn qua Print Agent Local
        const payloads = sendJson.data?.printPayloads || [];
        if (Array.isArray(payloads) && payloads.length > 0) {
          const seenVirtualPrinters = new Set<string>();
          for (const p of payloads) {
            if (p.printerName && p.htmlContent) {
              // Chống spam mở đồng thời nhiều hộp thoại Save As trên máy in ảo
              const isVirtual = /(pdf|onenote|xps|fax|print to)/i.test(p.printerName);
              if (isVirtual) {
                const lowerName = p.printerName.toLowerCase();
                if (seenVirtualPrinters.has(lowerName)) continue;
                seenVirtualPrinters.add(lowerName);
              }

              const jobIds: string[] = p.printJobIds || (p.printJobId ? [p.printJobId] : []);
              const printKey = p.idempotencyKey || (jobIds.length > 0 ? jobIds.join('_') : `${p.printerName}_${p.purpose}_${p.htmlContent?.substring(0, 50)}`);
              if (!shouldProcessPrintKey(printKey)) {
                console.log('⚠️ [DEDUPLICATE] Bỏ qua lệnh in local do đã xử lý gần đây:', printKey);
                continue;
              }
              if (p.purpose === 'ITEM_LABEL') {
                printAgent
                  .printLabel({
                    printerName: p.printerName,
                    htmlContent: p.htmlContent,
                    labelSize: p.labelSize || { width: '50mm', height: '30mm' },
                    copies: p.copies || 1,
                    idempotencyKey: p.idempotencyKey,
                  })
                  .then(async (res) => {
                    if (res.success) {
                      toast.success(`Đã in tem nhãn qua máy in [${p.printerName}]`);
                      for (const jid of jobIds) {
                        await fetch(`${baseUrl}/api/pos/orders/${targetOrderId}/confirm-print`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ printJobId: jid, status: 'SUCCESS' }),
                        }).catch(console.error);
                      }
                    } else {
                      toast.error(`In tem nhãn thất bại: ${res.message || 'Lỗi máy in'}`, {
                        duration: 4000,
                      });
                      for (const jid of jobIds) {
                        await fetch(`${baseUrl}/api/pos/orders/${targetOrderId}/confirm-print`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ printJobId: jid, status: 'FAILED', errorMessage: res.message }),
                        }).catch(console.error);
                      }
                    }
                  })
                  .catch(async () => {
                    toast.error(`Print Agent ngoại tuyến: Không thể in tem nhãn qua [${p.printerName}]`, {
                      duration: 4000,
                    });
                    for (const jid of jobIds) {
                      await fetch(`${baseUrl}/api/pos/orders/${targetOrderId}/confirm-print`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ printJobId: jid, status: 'FAILED', errorMessage: 'Agent offline' }),
                      }).catch(console.error);
                    }
                  });
              } else {
                printAgent
                  .printHtml({
                    printerName: p.printerName,
                    htmlContent: p.htmlContent,
                    paperSize: p.paperSize || '80mm',
                    copies: p.copies || 1,
                    idempotencyKey: p.idempotencyKey,
                  })
                  .then(async (res) => {
                    if (res.success) {
                      toast.success(
                        `Đã in phiếu ${p.purpose === 'BAR' ? 'Quầy Bar' : 'Bếp'} qua [${p.printerName}]`,
                      );
                      for (const jid of jobIds) {
                        await fetch(`${baseUrl}/api/pos/orders/${targetOrderId}/confirm-print`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ printJobId: jid, status: 'SUCCESS' }),
                        }).catch(console.error);
                      }
                    } else {
                      toast.error(`In phiếu bếp thất bại: ${res.message || 'Lỗi máy in'}`, {
                        duration: 4000,
                      });
                      for (const jid of jobIds) {
                        await fetch(`${baseUrl}/api/pos/orders/${targetOrderId}/confirm-print`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ printJobId: jid, status: 'FAILED', errorMessage: res.message }),
                        }).catch(console.error);
                      }
                    }
                  })
                  .catch(async () => {
                    toast.error(
                      `Print Agent ngoại tuyến: Không thể in phiếu bếp qua [${p.printerName}]`,
                      { duration: 4000 },
                    );
                    for (const jid of jobIds) {
                      await fetch(`${baseUrl}/api/pos/orders/${targetOrderId}/confirm-print`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ printJobId: jid, status: 'FAILED', errorMessage: 'Agent offline' }),
                      }).catch(console.error);
                    }
                  });
              }
            }
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi gửi bếp');
    } finally {
      setIsSendingKitchen(false);
    }
  };

  // In lại Tem Nhãn (Reprint Labels) - Xác thực Product từ DB
  const handleConfirmReprintLabels = async (
    selectedItems: { item: PosCartItem; quantity: number }[],
  ) => {
    if (selectedItems.length === 0) return;
    const targetOrderId = currentOrder?.id;
    if (!targetOrderId) {
      toast.error('Vui lòng lưu đơn hàng trước khi in lại tem');
      return;
    }

    try {
      const res = await fetch(`${baseUrl}/api/pos/orders/${targetOrderId}/reprint-labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: selectedItems.map((s) => ({
            orderItemId: s.item.id,
            quantity: s.quantity,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || 'Không thể in lại tem');
        return;
      }

      const payloads = json.data?.printPayloads || [];
      let totalPrinted = 0;
      for (const p of payloads) {
        if (p.printerName && p.htmlContent) {
          await printAgent.printLabel({
            printerName: p.printerName,
            htmlContent: p.htmlContent,
            labelSize: p.labelSize || { width: '50mm', height: '30mm' },
            copies: p.copies || 1,
            idempotencyKey: p.idempotencyKey,
          });
          totalPrinted += p.copies || 1;
        }
      }

      toast.success(`Đã gửi lệnh in lại ${totalPrinted} tem nhãn!`, {
        icon: <Tag className="w-4 h-4 text-sky-500" />,
      });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối in lại tem');
    }
  };

  // Gửi lại Bếp (Resend Kitchen)
  const handleResendKitchen = async () => {
    if (!currentBranch || cartItems.length === 0) {
      toast.error('Đơn hàng chưa có món nào');
      return;
    }
    setIsSendingKitchen(true);
    try {
      // Lưu đơn trước
      const saved = await handleSaveOrder(true);
      const targetOrderId = saved?.id || currentOrder?.id;
      if (!targetOrderId) throw new Error('Không thể lưu đơn');

      // Gửi lại toàn bộ món tới bếp (Reprint)
      const sendRes = await fetch(`${baseUrl}/api/pos/orders/${targetOrderId}/reprint-kitchen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderItemIds: cartItems.map((it) => it.id) }),
      });
      const sendJson = await sendRes.json();
      if (sendJson.success) {
        toast.success('Đã gửi lại toàn bộ món tới Bếp & Bar!', {
          icon: <ChefHat className="w-4 h-4 text-orange-500" />,
        });
        fetchKitchenTickets(currentBranch.id);

        const payloads = sendJson.data?.printPayloads || [];
        for (const p of payloads) {
          if (p.printerName && p.htmlContent) {
            printAgent
              .printHtml({
                printerName: p.printerName,
                htmlContent: p.htmlContent,
                paperSize: p.paperSize || '80mm',
                copies: p.copies || 1,
              })
              .catch(console.error);
          }
        }
      } else {
        toast.error(sendJson.message || 'Lỗi gửi lại bếp');
      }
    } finally {
      setIsSendingKitchen(false);
    }
  };

  // Ref chống spam click lệnh in hóa đơn / tạm tính
  const isPrintingBillRef = useRef(false);

  // In Tạm Tính (Pro-forma Bill / Temp Bill) - Tự động lưu đơn trước, gửi thẳng lệnh in tới máy in hóa đơn/tạm tính, BỎ HOÀN TOÀN modal xem trước
  const handlePrintTempBill = async (
    customQrUrl?: string,
    specificOrderId?: string,
    overridePrintType?: 'RECEIPT' | 'TEMP_BILL' | 'ONLINE_ORDER',
  ) => {
    let orderId = specificOrderId || currentOrder?.id;

    if (!orderId && cartItems.length === 0) {
      toast.error('Đơn hàng đang trống!');
      return;
    }

    const targetOrder = specificOrderId
      ? branchOrders.find((o) => o.id === specificOrderId) || (currentOrder?.id === specificOrderId ? currentOrder : null)
      : currentOrder;

    const isOnline = isOnlineOrder(targetOrder);
    const printType = overridePrintType || (isOnline ? 'ONLINE_ORDER' : 'TEMP_BILL');
    const typeLabel =
      printType === 'RECEIPT'
        ? 'hóa đơn thanh toán'
        : isOnline
        ? 'đơn hàng online'
        : 'phiếu tạm tính';

    // 1. Chống duplicate và spam click trong vòng 3 giây
    const printKey = `bill-${orderId || 'new'}-${printType}`;
    if (!shouldProcessPrintKey(printKey)) {
      toast('Lệnh in đang được máy in xử lý, vui lòng chờ trong giây lát!', {
        icon: <Clock className="w-4 h-4 text-amber-500" />,
      });
      return;
    }

    if (isPrintingBillRef.current) {
      return;
    }
    isPrintingBillRef.current = true;

    // 2. Tôn trọng cấu hình số liên in (copies) theo đúng mục đích - Phiếu tạm tính cố định 1 bản
    const targetCopies = Math.max(
      1,
      Number(
        printType === 'RECEIPT'
          ? (branchPrintSettings.find((s) => s.purpose === 'RECEIPT')?.copies || currentBranch?.receiptCopies || 1)
          : (branchPrintSettings.find((s) => s.purpose === 'TEMP_BILL')?.copies || 1)
      ) || 1
    );

    const targetPrinter =
      (printType === 'RECEIPT' ? branchPrintSettings.find((s) => s.purpose === 'RECEIPT')?.printerName : undefined) ||
      (isOnline ? branchPrintSettings.find((s) => s.purpose === 'ONLINE_ORDER')?.printerName : undefined) ||
      branchPrintSettings.find((s) => s.purpose === 'TEMP_BILL')?.printerName ||
      branchPrintSettings.find((s) => s.purpose === 'RECEIPT')?.printerName ||
      currentBranch?.defaultReceiptPrinterId ||
      'Xprinter XP-350B';

    const targetPaperSize = (
      (printType === 'RECEIPT' ? branchPrintSettings.find((s) => s.purpose === 'RECEIPT')?.paperSize : undefined) ||
      (isOnline ? branchPrintSettings.find((s) => s.purpose === 'ONLINE_ORDER')?.paperSize : undefined) ||
      branchPrintSettings.find((s) => s.purpose === 'TEMP_BILL')?.paperSize ||
      currentBranch?.defaultPaperSize ||
      '80mm'
    ) as '80mm' | '58mm';

    try {
      // Chỉ lưu đơn trước khi in nếu chưa hoàn tất thanh toán (RECEIPT hoặc đơn COMPLETED không cần lưu lại)
      const isAlreadyCompleted =
        targetOrder?.status === 'COMPLETED' ||
        targetOrder?.paymentStatus === 'PAID' ||
        overridePrintType === 'RECEIPT';

      if (!isOnline && !isAlreadyCompleted) {
        const saved = await handleSaveOrder(true);
        if (saved?.id) {
          setCurrentOrder(saved);
          orderId = saved.id;
        }
      } else if (!orderId && !isOnline) {
        const saved = await handleSaveOrder(true);
        if (saved?.id) {
          setCurrentOrder(saved);
          orderId = saved.id;
        }
      }

      if (!orderId) {
        toast.error(`Không thể tạo đơn hàng để in ${typeLabel}`);
        return;
      }

      // Tự động chèn mã QR chuyển khoản VietQR nếu in tạm tính và chưa có customQrUrl (Directive 6)
      let resolvedQrUrl = customQrUrl;
      if (!resolvedQrUrl && (printType === 'TEMP_BILL' || !overridePrintType)) {
        const orderCodeForQr = targetOrder?.orderCode || targetOrder?.temporaryOrderCode || (orderId ? orderId.slice(0, 10) : 'AVORA');
        const calculatedTotal =
          cartItems.reduce(
            (sum, it) => sum + Math.max(0, it.priceAtSale - (it.discountAmount || 0)) * it.quantity,
            0,
          ) - (orderDiscount?.discountAmount || currentOrder?.discountAmount || 0);
        const amountForQr = targetOrder?.totalAmount || currentOrder?.totalAmount || Math.max(0, calculatedTotal);
        resolvedQrUrl = `https://qr.sepay.vn/img?acc=1019224767&bank=VCB&amount=${amountForQr}&des=${encodeURIComponent(orderCodeForQr)}`;
      }

      const qrParam = resolvedQrUrl ? `&qrPayload=${encodeURIComponent(resolvedQrUrl)}` : '';
      const paperSizeParam = targetPaperSize ? `&paperSize=${encodeURIComponent(targetPaperSize)}` : '';
      const res = await fetch(`${baseUrl}/api/print-templates/render/order/${orderId}?type=${printType}${qrParam}${paperSizeParam}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success || !data.data?.html) {
        throw new Error(data.message || `Lỗi render ${typeLabel}`);
      }

      const html = data.data.html;
      const agentRes = await printAgent.printHtml({
        printerName: targetPrinter,
        htmlContent: html,
        paperSize: targetPaperSize || data.data?.paperSize || '80mm',
        copies: targetCopies,
        idempotencyKey: `print-${orderId}-${printType}-${Math.floor(Date.now() / 4000)}`,
        receiptPayload: data.data?.receiptPayload,
      });

      if (agentRes.success) {
        toast.success(
          customQrUrl
            ? `Đã in ${typeLabel} & mã QR (${targetCopies} bản)!`
            : `Đã in ${typeLabel} (${targetCopies} bản)!`,
          { icon: <Printer className="w-4 h-4 text-emerald-500" /> }
        );
      } else {
        toast.error(`Máy in [${targetPrinter}] lỗi: ${agentRes.message || 'Không thể in'}`);
      }
    } catch (err: any) {
      toast.error(err.message || `Không thể in ${typeLabel}`);
    } finally {
      setTimeout(() => {
        isPrintingBillRef.current = false;
      }, 1500);
    }
  };

  const handleHoldOrder = async () => {
    if (!currentBranch || cartItems.length === 0) return;
    try {
      let orderId = currentOrder?.id;
      if (!orderId) {
        const createRes = await fetch(`${baseUrl}/api/pos/orders/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            branchId: currentBranch.id,
            tableId: selectedTable?.id,
            orderType: selectedTable ? 'DINE_IN' : orderType,
            guestCount,
            customerName,
            customerPhone,
            items: cartItems.map((it) => ({
              productId: it.productId,
              quantity: normalizePosQty(it.quantity) || it.quantity,
              customPrice: it.customPrice,
              note: it.note,
              selectedOptionIds: it.selectedOptions.map((so) => so.optionItemId),
              pricingMode: it.pricingMode || 'REGULAR',
              buffetSessionId: it.buffetSessionId || undefined,
              buffetPackageId: it.buffetPackageId || undefined,
              buffetPackageNameSnapshot: (it as any).buffetPackageNameSnapshot || undefined,
              source: it.source || 'POS',
            })),
          }),
        });
        const json = await createRes.json();
        orderId = json.data?.id;
      }

      if (orderId) {
        await fetch(`${baseUrl}/api/pos/orders/${orderId}/hold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ note: 'Giữ đơn tạm' }),
        });
        toast.success('Đã lưu và giữ đơn thành công!', {
          icon: <PauseCircle className="w-4 h-4 text-amber-500" />,
        });
        handleClearCart();
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi giữ đơn');
    }
  };

  // =========================================================================
  // ORDER TAX/FEES & QUICK STATUS HANDLERS
  // =========================================================================
  const handleOpenOrderFeesModal = (order?: PosOrder) => {
    const targetOrder = order || currentOrder;
    if (!targetOrder) {
      toast.error('Vui lòng chọn một đơn hàng để quản lý thuế / phí & trạng thái');
      return;
    }
    setFeesModalOrder(targetOrder);
    setIsOrderDetailFeesModalOpen(true);
  };

  const handleQuickUpdateStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/pos/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Cập nhật trạng thái thành công');
        if (currentBranch) fetchOrdersSnapshot(currentBranch.id);
        if (currentOrder && currentOrder.id === orderId) {
          setCurrentOrder(data.data);
        }
        if (feesModalOrder && feesModalOrder.id === orderId) {
          setFeesModalOrder(data.data);
        }
      } else {
        toast.error(data.message || data.error?.message || 'Không thể cập nhật trạng thái đơn');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi mạng khi cập nhật trạng thái');
    }
  };

  const handleSaveOrderFees = async (data: {
    shippingFee?: number;
    isInvoiceRequested?: boolean;
    invoiceTaxCode?: string;
    invoiceCompanyName?: string;
    invoiceAddress?: string;
    invoiceEmail?: string;
  }) => {
    if (!feesModalOrder) return;
    const res = await fetch(`${baseUrl}/api/pos/orders/${feesModalOrder.id}/fees`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || result.error?.message || 'Không thể cập nhật phí vận chuyển/thuế');
    }
    toast.success('Cập nhật thuế & phí vận chuyển thành công');
    if (currentBranch) fetchOrdersSnapshot(currentBranch.id);
    if (currentOrder && currentOrder.id === feesModalOrder.id) {
      setCurrentOrder(result.data);
    }
    setFeesModalOrder(result.data);
  };

  const handleProcessPayment = async (payload: any) => {
    if (!currentBranch || cartItems.length === 0) return;
    setIsProcessingPayment(true);

    try {
      let orderId = currentOrder?.id;

      // If order not yet created, create it now!
      if (!orderId) {
        const deliveryAddressStr =
          orderType === 'DELIVERY' && deliveryInfo
            ? `${deliveryInfo.customerName} (${deliveryInfo.customerPhone}) - ${deliveryInfo.deliveryAddress}${deliveryInfo.notes ? ` [Ghi chú: ${deliveryInfo.notes}]` : ''}`
            : undefined;

        const createRes = await fetch(`${baseUrl}/api/pos/orders/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            branchId: currentBranch.id,
            tableId: selectedTable?.id,
            guestCount,
            customerName,
            customerPhone,
            userId: selectedMember?.id,
            orderType: selectedTable ? 'DINE_IN' : orderType,
            deliveryAddress: deliveryAddressStr,
            discountAmount: orderDiscount?.discountAmount || 0,
            discountReason: orderDiscount?.discountReason || undefined,
            items: cartItems.map((it) => ({
              productId: it.productId,
              quantity: normalizePosQty(it.quantity) || it.quantity,
              customPrice: it.customPrice,
              note: it.note,
              selectedOptionIds: it.selectedOptions.map((so) => so.optionItemId),
              discountAmount: it.discountAmount || 0,
              discountReason: it.discountReason || undefined,
            })),
          }),
        });
        const createJson = await createRes.json();
        if (!createJson.success) {
          throw new Error(createJson.message || 'Không thể tạo đơn hàng');
        }
        orderId = createJson.data.id;
      }

      const payRes = await fetch(`${baseUrl}/api/pos/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...payload,
          cashShiftId: activeShift?.id,
        }),
      });

      const payJson = await payRes.json();
      if (!payJson.success) {
        throw new Error(payJson.message || 'Thanh toán không thành công');
      }

      const finalCode =
        payJson.data?.updatedOrder?.orderCode ||
        payJson.data?.orderCode ||
        currentOrder?.orderCode ||
        '';
      toast.success(`Thanh toán hoàn tất đơn [${finalCode}]!`, {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        duration: 4000,
      });

      // Tự động in âm thầm hóa đơn thanh toán qua Print Agent Local nếu cấu hình bật
      const rSetting = branchPrintSettings.find((s) => s.purpose === 'RECEIPT');
      const shouldAutoPrint =
        rSetting?.autoPrint !== undefined ? rSetting.autoPrint : currentBranch?.autoPrintReceipt !== false;

      const printKey = `bill-${orderId}-RECEIPT`;
      if (shouldAutoPrint && orderId && shouldProcessPrintKey(printKey)) {
        const targetPrinter =
          rSetting?.printerName ||
          currentBranch?.defaultReceiptPrinterId ||
          'Xprinter XP-350B';
        const paperSize = (rSetting?.paperSize || currentBranch?.defaultPaperSize || '80mm') as any;
        const copies = Math.max(1, Number(rSetting?.copies || currentBranch?.receiptCopies || 1));

        fetch(`${baseUrl}/api/print-templates/render/order/${orderId}?type=RECEIPT&paperSize=${encodeURIComponent(paperSize)}`, {
          credentials: 'include',
        })
          .then((r) => r.json())
          .then(async (tplJson) => {
            if (tplJson.success && tplJson.data?.html) {
              const printRes = await printAgent.printHtml({
                printerName: targetPrinter,
                htmlContent: tplJson.data.html,
                paperSize,
                copies,
                idempotencyKey: `receipt-${orderId}-RECEIPT-${Math.floor(Date.now() / 4000)}`,
                receiptPayload: tplJson.data?.receiptPayload,
              });

              if (printRes.success) {
                toast.success(`Đã in hóa đơn thanh toán qua máy in [${targetPrinter}] (${copies} bản)!`, {
                  icon: <Printer className="w-4 h-4 text-emerald-500" />,
                });
              } else {
                toast(
                  (t) => (
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Không thể in hóa đơn tự động ({printRes.message || 'Máy in ngoại tuyến'})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          toast.dismiss(t.id);
                          printAgent.printHtml({
                            printerName: targetPrinter,
                            htmlContent: tplJson.data.html,
                            paperSize,
                            copies,
                            receiptPayload: tplJson.data?.receiptPayload,
                          });
                        }}
                        className="px-2 py-1 bg-[#da251d] hover:bg-[#b81d16] text-white text-[11px] font-bold rounded cursor-pointer"
                      >
                        In lại
                      </button>
                    </div>
                  ),
                  { duration: 8000 },
                );
              }
            }
          })
          .catch((err) => {
            console.warn('Lỗi kết nối render template hóa đơn:', err);
          });
      }

      setIsPaymentModalOpen(false);
      handleClearCart();
      returnToOriginTab();
      fetchOrdersSnapshot(currentBranch.id);
      fetchTables(currentBranch.id);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi thanh toán');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Handler khi đơn hàng được thanh toán thành công (qua SePay Webhook / Socket / Polling)
  const handleOrderPaymentSucceeded = useCallback(
    async (payload: any) => {
      const paidOrderId = payload?.orderId || payload?.order?.id || payload?.id;
      const paidOrderCode = payload?.orderCode || payload?.order?.orderCode;
      const paidTmpCode = payload?.temporaryOrderCode || payload?.order?.temporaryOrderCode;

      // Check if this payment matches currently open order
      const isCurrent =
        (paidOrderId && currentOrder?.id && paidOrderId === currentOrder.id) ||
        (paidOrderCode && currentOrder?.orderCode && paidOrderCode === currentOrder.orderCode) ||
        (paidTmpCode && (currentOrder as any)?.temporaryOrderCode && paidTmpCode === (currentOrder as any).temporaryOrderCode);

      if (isCurrent) {
        setIsPaymentModalOpen(false);

        // Chuẩn bị dữ liệu hiển thị Modal Thanh toán SePay Thành Công
        const targetTableName =
          selectedTable?.name ||
          (currentOrder as any)?.table?.name ||
          (currentOrder?.orderType === 'TAKEAWAY' ? 'Khách mang về' : 'Khách tại bàn');

        const successData: SepaySuccessModalData = {
          orderId: paidOrderId || currentOrder?.id || '',
          orderCode: paidOrderCode || currentOrder?.orderCode || '',
          temporaryOrderCode: paidTmpCode || (currentOrder as any)?.temporaryOrderCode,
          tableName: targetTableName,
          amount: Number(payload?.amount || currentOrder?.totalAmount || 0),
          paidAt: new Date(),
          transactionCode: payload?.transactionCode || (currentOrder as any)?.transactionId || '',
          cashierName: currentUser?.fullName,
        };

        setSepaySuccessData(successData);
        setIsSepaySuccessModalOpen(true);

        handleClearCart();
        returnToOriginTab();
        toast.success(
          `Đã xác nhận thanh toán SePay thành công cho đơn [${paidOrderCode || paidTmpCode || currentOrder?.orderCode || ''}]!`,
          {
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            duration: 4000,
          },
        );
      }

      if (currentBranch) {
        fetchOrdersSnapshot(currentBranch.id);
        fetchTables(currentBranch.id);
      }
    },
    [currentOrder, currentBranch, branchPrintSettings, handleClearCart, handlePrintTempBill, fetchOrdersSnapshot, fetchTables],
  );

  useEffect(() => {
    handleOrderPaymentSucceededRef.current = handleOrderPaymentSucceeded;
  }, [handleOrderPaymentSucceeded]);

  // Tự động lưu đơn ngay lập tức khi bấm "Thanh toán" để đồng bộ CSDL, tính thuế/giảm giá và cấp mã TMP/OrderCode cho SePay
  const handleOpenPaymentModal = async () => {
    if (isOnlineOrder(currentOrder)) {
      toast.error('Đơn hàng Online không được phép mở thanh toán tại POS!');
      return;
    }
    if (cartItems.length === 0 && !currentOrder?.id) {
      toast.error('Giỏ hàng đang trống!');
      return;
    }
    setIsSavingOrder(true);
    try {
      const saved = await handleSaveOrder(true);
      if (saved) {
        setCurrentOrder(saved);
        setIsPaymentModalOpen(true);
      } else if (currentOrder?.id) {
        setIsPaymentModalOpen(true);
      }
    } catch (e: any) {
      console.warn('Lỗi tự động lưu đơn trước khi thanh toán:', e);
      if (currentOrder?.id) {
        setIsPaymentModalOpen(true);
      }
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleConfirmSplit = async (items: any[], targetTableId?: string, reason?: string) => {
    if (!currentOrder) return;
    try {
      const res = await fetch(`${baseUrl}/api/pos/orders/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceOrderId: currentOrder.id,
          targetTableId,
          items,
          reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Tách đơn thành công!', {
          icon: <Scissors className="w-4 h-4 text-indigo-500" />,
        });
        setCurrentOrder(json.data.sourceOrder);
        if (currentBranch) fetchOrdersSnapshot(currentBranch.id);
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi tách đơn');
    }
  };

  const handleConfirmMerge = async (sourceOrderId: string, targetOrderId: string, reason?: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/pos/orders/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceOrderId, targetOrderId, reason }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Gộp đơn thành công!', {
          icon: <RefreshCw className="w-4 h-4 text-cyan-500" />,
        });
        setCurrentOrder(json.data.targetOrder);
        if (currentBranch) fetchOrdersSnapshot(currentBranch.id);
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi gộp đơn');
    }
  };

  const handleConfirmMoveTable = async (targetTableId: string) => {
    if (!currentOrder) return;
    try {
      const res = await fetch(`${baseUrl}/api/pos/orders/move-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: currentOrder.id, targetTableId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Chuyển bàn thành công!', {
          icon: <RefreshCw className="w-4 h-4 text-emerald-500" />,
        });
        const newTable = tables.find((t) => t.id === targetTableId) || null;
        setSelectedTable(newTable);
        setCurrentOrder(json.data);
        if (currentBranch) fetchTables(currentBranch.id);
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi chuyển bàn');
    }
  };

  const handleOpenShift = async (openingBalance: number, note?: string) => {
    if (!currentBranch) return;
    try {
      const res = await fetch(`${baseUrl}/api/pos/shifts/open?branchId=${currentBranch.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ openingBalance, note }),
      });
      const json = await res.json();
      if (json.success) {
        setActiveShift(json.data);
        toast.success('Mở ca làm việc thành công!', {
          icon: <Unlock className="w-4 h-4 text-emerald-500" />,
        });
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi mở ca');
    }
  };

  const handleCloseShift = async (closingBalance: number, note?: string) => {
    if (!activeShift) return;
    try {
      const res = await fetch(`${baseUrl}/api/pos/shifts/${activeShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ closingBalance, note }),
      });
      const json = await res.json();
      if (json.success) {
        setActiveShift(null);
        toast.success('Đã kết thúc ca làm việc thành công!', {
          icon: <Lock className="w-4 h-4 text-gray-700" />,
        });
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi kết ca');
    }
  };

  const handleCancelOrder = async (orderId: string, reason: string) => {
    if (!currentBranch) return;
    setIsCancellingOrder(true);
    try {
      const res = await fetch(`${baseUrl}/api/pos/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Không thể hủy đơn hàng');
      }
      toast.success(`Đã hủy đơn hàng [${currentOrder?.orderCode || orderId}]!`, {
        icon: <Ban className="w-4 h-4 text-rose-500" />,
        duration: 3000,
      });
      setIsCancelOrderModalOpen(false);
      handleClearCart();
      fetchOrdersSnapshot(currentBranch.id);
      fetchTables(currentBranch.id);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi hủy đơn hàng');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const handleUpdateKitchenItemStatus = async (itemId: string, status: string) => {
    try {
      await fetch(`${baseUrl}/api/pos/kitchen/items/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (currentBranch) fetchKitchenTickets(currentBranch.id);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi cập nhật KDS');
    }
  };

  // Centralized Unified POS Shortcuts - Smart F1 (New Takeaway outside SALE, Payment inside SALE)
  const isAnyModalOpen =
    isPaymentModalOpen ||
    !!selectedOptionProduct ||
    isCustomerSelectModalOpen ||
    isDeliveryModalOpen ||
    isItemDiscountModalOpen ||
    isOrderDiscountModalOpen ||
    isSplitModalOpen ||
    isMergeModalOpen ||
    isMoveTableModalOpen ||
    isCancelOrderModalOpen ||
    isGuestCountModalOpen;

  usePosShortcuts(
    {
      onPayment: () => {
        if (cartItems.length > 0) handleOpenPaymentModal();
      },
      onNewTakeaway: handleSelectTakeaway,
      onSendToKitchen: handleSendToKitchen,
      onSaveOrder: handleSaveOrder,
      onFocusSearch: () => {
        if (activeTab !== 'SALE') setActiveTab('SALE');
        setTimeout(() => searchInputRef.current?.focus(), 50);
      },
      onOpenTableMap: () => setActiveTab('TABLES'),
      onPrintBill: () => handlePrintTempBill(),
      onOpenOrdersList: () => setActiveTab('ORDERS'),
      onOpenCustomer: () => {
        if (isOnlineOrder(currentOrder)) {
          toast.error('Đơn hàng Online không cho phép đổi thông tin khách hàng!');
          return;
        }
        setIsCustomerSelectModalOpen(true);
      },
      onEscape: () => {
        if (isSepaySuccessModalOpen) {
          setIsSepaySuccessModalOpen(false);
          setSepaySuccessData(null);
        } else if (isPaymentModalOpen) setIsPaymentModalOpen(false);
        else if (selectedOptionProduct) setSelectedOptionProduct(null);
        else if (isCustomerSelectModalOpen) setIsCustomerSelectModalOpen(false);
        else if (isDeliveryModalOpen) setIsDeliveryModalOpen(false);
        else if (isItemDiscountModalOpen) setIsItemDiscountModalOpen(false);
        else if (isOrderDiscountModalOpen) setIsOrderDiscountModalOpen(false);
        else if (isSplitModalOpen) setIsSplitModalOpen(false);
        else if (isMergeModalOpen) setIsMergeModalOpen(false);
        else if (isMoveTableModalOpen) setIsMoveTableModalOpen(false);
        else if (isCancelOrderModalOpen) setIsCancelOrderModalOpen(false);
        else if (isGuestCountModalOpen) setIsGuestCountModalOpen(false);
        else if (searchQuery) setSearchQuery('');
        else if (activeTab === 'SALE') returnToOriginTab();
      },
    },
    activeTab === 'SALE',
    true,
  );

  // If verifying authentication
  if (isAuthChecking) {
    return (
      <div className="h-screen w-full max-w-[100vw] flex flex-col items-center justify-center bg-gray-50 text-gray-700 select-none">
        <div className="w-10 h-10 border-3 border-[#da251d] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-gray-500">Đang kiểm tra quyền truy cập POS AVORA...</p>
      </div>
    );
  }

  // Bổ sung: Không cho dùng POS trên web, hiển thị thông báo tải app / mở app giao diện sáng đẹp
  if (!platformBridge.isDesktop) {
    return <PosWebBlocker />;
  }

  const qrPendingCount = branchOrders.filter(
    (o) => o.orderSource === 'QR_ORDER' && o.status === 'PENDING',
  ).length;

  return (
    <div className={`flex flex-col h-screen w-full max-w-[100vw] overflow-hidden font-sans select-none transition-colors ${
      isDarkMode ? 'dark bg-[#141b27] text-slate-100' : 'bg-gray-100 text-gray-900'
    }`}>
      {/* Cảnh báo pin yếu Android Gateway (Feature 5) */}
      {bankGatewayBatteryAlert && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2 font-black text-xs sm:text-sm flex items-center justify-between shadow-md z-40 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-base">🔌</span>
            <span>{bankGatewayBatteryAlert.message}</span>
          </div>
          <button
            onClick={() => setBankGatewayBatteryAlert(null)}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded font-bold transition"
          >
            Đã rõ
          </button>
        </div>
      )}

      {/* Cảnh báo khách chuyển khoản trùng 2 lần (Feature 3) */}
      {overpaidDuplicateAlert && (
        <div className="bg-rose-600 text-white px-4 py-2 font-black text-xs sm:text-sm flex items-center justify-between shadow-md z-40">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              Bàn {overpaidDuplicateAlert.tableName || 'Khách'} chuyển trùng 2 lần đơn #{overpaidDuplicateAlert.orderCode} (+{overpaidDuplicateAlert.overpaidAmount?.toLocaleString('vi-VN')}đ)!
            </span>
          </div>
          <button
            onClick={() => setOverpaidDuplicateAlert(null)}
            className="text-xs bg-rose-700 hover:bg-rose-800 text-white px-2.5 py-1 rounded font-bold transition"
          >
            Đã xem
          </button>
        </div>
      )}

      {/* POS Top Navigation Bar: Shown only on TABLES, ORDERS, RESERVATIONS, QR_ORDERS, KDS tabs. Hidden completely in SALE / Table Detail mode */}
      {activeTab !== 'SALE' && (
        <PosHeader
          currentBranch={currentBranch}
          branches={branches}
          onSelectBranch={(b) => {
            setCurrentBranch(b);
            if (typeof window !== 'undefined') {
              localStorage.setItem('avora_pos_selected_branch', b.id);
            }
            handleClearCart();
          }}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          orderType={orderType}
          onSelectTakeaway={handleSelectTakeaway}
          onSelectDelivery={handleSelectDelivery}
          connectionStatus={connectionStatus}
          user={currentUser}
          orderCounts={{
            allOrders: branchOrders.length,
            qrOrders: qrPendingCount,
            reservations: reservationsCount,
          }}
          onLogout={handleLogout}
          onGoToAdmin={handleGoToAdmin}
          onOpenSettingsDrawer={() => setIsSettingsDrawerOpen(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          currentOrder={currentOrder}
          selectedTable={selectedTable}
          grandTotal={
            cartItems.reduce(
              (sum, it) => sum + Math.max(0, it.priceAtSale - (it.discountAmount || 0)) * it.quantity,
              0,
            ) - (orderDiscount?.discountAmount || currentOrder?.discountAmount || 0)
          }
          guestCount={guestCount}
          customerName={selectedMember?.fullName || customerName}
          onOpenPrintBill={() => handlePrintTempBill()}
          onOpenSplitModal={() => setIsSplitModalOpen(true)}
          onOpenMergeModal={() => setIsMergeModalOpen(true)}
          onOpenMoveTableModal={() => setIsMoveTableModalOpen(true)}
          onOpenCancelModal={() => setIsCancelOrderModalOpen(true)}
          onClearCart={handleClearCart}
          onOpenQrManagement={() => setIsQrManagementModalOpen(true)}
          onOpenDesktopLaunch={() => setIsDesktopLaunchModalOpen(true)}
          onOpenEndOfDayReport={() => setIsEndOfDayReportModalOpen(true)}
        />
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'SALE' && (
          <div className="flex-1 flex overflow-hidden w-full h-full">
            {/* 1. Left: Vertical Touch Category Bar (Scroll ▲/▼ + Categories) */}
            <TouchCategorySidebar
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
              isDarkMode={isDarkMode}
            />

            {/* 2. Middle: Top Bar + Products + Quick Number Keys + Dark Status Bar */}
            <div className={`flex-1 flex flex-col overflow-hidden min-w-0 ${
              isDarkMode ? 'bg-[#141b27] text-slate-100' : 'bg-slate-100 text-slate-900'
            }`}>
              {/* Top Bar: Customer | Guests | Search */}
              <div className={`h-11 sm:h-12 border-b flex items-center shrink-0 ${
                isDarkMode ? 'bg-[#1c2434] border-[#2c374c] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                {/* Customer Selector */}
                <button
                  type="button"
                  disabled={isOnlineOrder(currentOrder) || hasRedeemedPoints}
                  onClick={() => {
                    if (isOnlineOrder(currentOrder)) {
                      toast.error('Đơn hàng Online không cho phép đổi thông tin khách hàng!');
                      return;
                    }
                    if (hasRedeemedPoints) {
                      toast.error('Đơn hàng này đã đổi điểm thưởng, không thể đổi hoặc gỡ tài khoản hội viên!');
                      return;
                    }
                    setIsCustomerSelectModalOpen(true);
                  }}
                  className={`h-full px-3 flex items-center gap-1.5 border-r transition-colors text-xs font-bold shrink-0 ${
                    isDarkMode
                      ? isOnlineOrder(currentOrder) || hasRedeemedPoints
                        ? 'bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed'
                        : 'hover:bg-slate-800 active:bg-slate-700 text-slate-200 border-slate-800 cursor-pointer'
                      : isOnlineOrder(currentOrder) || hasRedeemedPoints
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'hover:bg-slate-50 active:bg-slate-100 text-slate-800 border-slate-200 cursor-pointer'
                  }`}
                  title={
                    isOnlineOrder(currentOrder)
                      ? 'Đơn online cố định thông tin khách'
                      : hasRedeemedPoints
                      ? 'Đơn hàng đã đổi điểm, cố định hội viên'
                      : 'Chọn khách hàng / hội viên'
                  }
                >
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate max-w-[120px] sm:max-w-[150px]">
                    {selectedMember?.fullName || customerName || 'Khách lẻ'}
                  </span>
                  {isOnlineOrder(currentOrder) || hasRedeemedPoints ? (
                    <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-0.5" />
                  ) : (
                    <Edit3 className="w-3.5 h-3.5 text-sky-500 shrink-0 ml-0.5" />
                  )}
                </button>

                {/* Guest Count Selector */}
                <button
                  type="button"
                  disabled={isOnlineOrder(currentOrder)}
                  onClick={() => {
                    if (isOnlineOrder(currentOrder)) {
                      toast.error('Đơn hàng Online không cho phép sửa số lượng khách!');
                      return;
                    }
                    setIsGuestCountModalOpen(true);
                  }}
                  className={`h-full px-3 flex items-center gap-1.5 border-r transition-colors text-xs font-bold shrink-0 ${
                    isDarkMode
                      ? isOnlineOrder(currentOrder)
                        ? 'bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed'
                        : 'hover:bg-slate-800 active:bg-slate-700 text-slate-200 border-slate-800 cursor-pointer'
                      : isOnlineOrder(currentOrder)
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'hover:bg-slate-50 active:bg-slate-100 text-slate-800 border-slate-200 cursor-pointer'
                  }`}
                  title={
                    isOnlineOrder(currentOrder)
                      ? 'Đơn online không đổi số khách'
                      : 'Số lượng khách (chạm để mở bàn phím số)'
                  }
                >
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{guestCount} Khách</span>
                  {isOnlineOrder(currentOrder) ? (
                    <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-0.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </button>

                {/* Search Input */}
                <div className="flex-1 relative h-full flex items-center px-3">
                  <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nhập tên mặt hàng (F4)"
                    className={`w-full bg-transparent border-none outline-none text-xs sm:text-sm font-medium ${
                      isDarkMode ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Quick Toggle Menu Compact Mode (Bỏ ảnh / Hiện ảnh) */}
                <button
                  type="button"
                  onClick={() => handleToggleViewMode(viewMode === 'grid' ? 'fast' : 'grid')}
                  className={`h-full px-3 flex items-center gap-1.5 border-l transition-colors text-xs font-bold shrink-0 cursor-pointer select-none ${
                    isDarkMode
                      ? viewMode === 'fast'
                        ? 'bg-red-950/60 text-red-400 border-slate-800'
                        : 'bg-slate-900 text-slate-200 hover:bg-slate-800 border-slate-800'
                      : viewMode === 'fast'
                        ? 'bg-red-50 text-[#da251d] hover:bg-red-100/80 border-slate-200'
                        : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-[#da251d] border-slate-200'
                  }`}
                  title={
                    viewMode === 'fast'
                      ? 'Chuyển sang chế độ xem ảnh thực đơn'
                      : 'Rút gọn thực đơn (không kèm ảnh để hiển thị nhiều món hơn)'
                  }
                >
                  <ListCollapse className="w-4 h-4 text-[#da251d]" />
                  <span className="hidden sm:inline">{viewMode === 'fast' ? 'Rút gọn' : 'Xem ảnh'}</span>
                </button>
              </div>

              {/* Products Area (flex-1 flex flex-col min-h-0 for proper scrolling) */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <ProductGrid
                  products={filteredProducts}
                  cartItemCounts={cartItemCounts}
                  buffetProductIds={buffetProductIds}
                  viewMode={viewMode}
                  onSelectProduct={handleSelectProduct}
                  isLoading={isLoadingProducts}
                  isDarkMode={isDarkMode}
                />
              </div>

              {/* Status Bar at Bottom (AVORA Bright White-Red Tone) */}
              <div className={`h-8 sm:h-9 border-t px-3 flex items-center justify-between text-xs shrink-0 select-none font-medium shadow-2xs ${
                isDarkMode ? 'bg-[#18202f] border-[#2c374c] text-slate-300' : 'bg-white border-slate-200 text-slate-700'
              }`}>
                {/* Left: User / Cashier */}
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-[#da251d] text-[10px] font-bold">
                    <User className="w-3 h-3 text-[#da251d]" />
                  </div>
                  <span className={`font-bold truncate max-w-[120px] ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {currentUser?.fullName || 'HTP Official'}
                  </span>
                </div>

                {/* Center: Branch Name */}
                <div
                  className={`flex items-center gap-1.5 select-none cursor-default font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}
                  title="Chi nhánh hiện tại"
                >
                  <Home className="w-3.5 h-3.5 text-[#da251d]" />
                  <span className="font-extrabold text-[#da251d] tracking-wide uppercase">
                    {currentBranch?.name || 'AVORA HOÀN KIẾM'}
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                </div>

                {/* Right: Realtime Clock */}
                <div className={`text-[11px] font-mono font-semibold tracking-tight ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {clockString}
                </div>
              </div>
            </div>

            {/* 3. Right: Order Cart */}
            <OrderCart
              currentUser={currentUser}
              currentOrder={currentOrder}
              selectedTable={selectedTable}
              cartItems={cartItems}
              guestCount={guestCount}
              onUpdateGuestCount={setGuestCount}
              onUpdateQuantity={handleUpdateItemQuantity}
              onRemoveItem={handleRemoveCartItem}
              onUpdateNote={handleUpdateItemNote}
              onClearCart={handleClearCart}
              onSaveOrder={handleSaveOrder}
              isSavingOrder={isSavingOrder}
              onSendToKitchen={handleSendToKitchen}
              onHoldOrder={handleHoldOrder}
              onOpenPaymentModal={handleOpenPaymentModal}
              onOpenPrintBill={() => handlePrintTempBill()}
              onOpenSplitModal={() => setIsSplitModalOpen(true)}
              onOpenMergeModal={() => setIsMergeModalOpen(true)}
              onOpenMoveTableModal={() => setIsMoveTableModalOpen(true)}
              onOpenCancelModal={() => setIsCancelOrderModalOpen(true)}
              onSelectTableTab={returnToOriginTab}
              isMenuCompactMode={viewMode === 'fast'}
              onToggleMenuCompact={() => handleToggleViewMode(viewMode === 'grid' ? 'fast' : 'grid')}
              onOpenReprintLabels={() => setIsReprintLabelsModalOpen(true)}
              onResendKitchen={handleResendKitchen}
              vatPriceMode={(currentOrder as any)?.vatPriceModeSnapshot || vatPriceMode || 'VAT_EXCLUDED'}
              orderType={orderType}
              onToggleOrderType={() => {
                if (orderType === 'DINE_IN') handleSelectTakeaway();
                else if (orderType === 'TAKEAWAY') handleSelectDelivery();
                else returnToOriginTab();
              }}
              onSelectOrderType={(type) => {
                if (type === 'DINE_IN') {
                  setOrderType('DINE_IN');
                  if (!selectedTable) returnToOriginTab();
                } else if (type === 'TAKEAWAY') {
                  handleSelectTakeaway();
                } else if (type === 'DELIVERY') {
                  handleSelectDelivery();
                }
              }}
              deliveryAddress={
                deliveryInfo
                  ? `${deliveryInfo.customerName} (${deliveryInfo.customerPhone}) - ${deliveryInfo.deliveryAddress}`
                  : undefined
              }
              onOpenDeliveryAddressModal={() => setIsDeliveryModalOpen(true)}
              orderDiscountAmount={orderDiscount?.discountAmount || 0}
              orderDiscountReason={orderDiscount?.discountReason || undefined}
              onOpenOrderDiscountModal={() => {
                const isCodeAlreadyCreated = Boolean(
                  currentOrder &&
                    (currentOrder.paymentStatus === 'AWAITING_PAYMENT' ||
                      currentOrder.paymentStatus === 'PAYMENT_REQUESTED' ||
                      currentOrder.paymentStatus === 'PAID' ||
                      currentOrder.status === 'COMPLETED' ||
                      (currentOrder as any).paymentIntentStatus === 'ACTIVE' ||
                      Boolean((currentOrder as any).paymentLockedAt))
                );
                if (isCodeAlreadyCreated) {
                  toast.error('Đơn hàng đã tạo mã thanh toán, giá trị đơn hàng không được phép thay đổi!');
                  return;
                }
                setIsOrderDiscountModalOpen(true);
              }}
              onOpenItemDiscountModal={handleOpenItemDiscount}
              onOpenKeypad={(item) => {
                setKeypadItem(item);
                setIsKeypadOpen(true);
              }}
              onOpenItemDetail={(item) => {
                setDetailModalItem(item);
                setIsItemDetailOpen(true);
              }}
              customerName={customerName}
              customerPhone={customerPhone}
              selectedMember={selectedMember}
              onOpenCustomerModal={() => setIsCustomerSelectModalOpen(true)}
              onOpenEditVatModal={(cust) => {
                setEditingVatCustomer(cust);
                setIsEditVatOpen(true);
              }}
              onOpenOrderFeesModal={() => handleOpenOrderFeesModal(currentOrder || undefined)}
              onRemoveCustomer={() => handleSelectCustomer(null)}
              isSendingKitchen={isSendingKitchen}
              orderNote={orderNote}
              onUpdateOrderNote={setOrderNote}
              onOpenBuffetModal={() => setIsBuffetApplyModalOpen(true)}
              onOpenRedeemPointsModal={() => {
                const isCodeAlreadyCreated = Boolean(
                  currentOrder &&
                    (currentOrder.paymentStatus === 'AWAITING_PAYMENT' ||
                      currentOrder.paymentStatus === 'PAYMENT_REQUESTED' ||
                      currentOrder.paymentStatus === 'PAID' ||
                      currentOrder.status === 'COMPLETED' ||
                      (currentOrder as any).paymentIntentStatus === 'ACTIVE' ||
                      Boolean((currentOrder as any).paymentLockedAt))
                );
                if (isCodeAlreadyCreated) {
                  toast.error('Đơn hàng đã tạo mã thanh toán, giá trị đơn hàng không được phép thay đổi!');
                  return;
                }
                if (!currentOrder) {
                  if (cartItems.length > 0) {
                    toast.error('Vui lòng lưu đơn hàng trước khi đổi điểm thưởng');
                  } else {
                    toast.error('Vui lòng chọn bàn hoặc tạo đơn trước khi đổi điểm thưởng');
                  }
                  return;
                }
                setIsRedeemPointsModalOpen(true);
              }}
              redeemableRewardsCount={redeemableRewardsCount}
              isDarkMode={isDarkMode}
              onOpenQrManagement={() => {
                if (selectedTable || currentOrder?.table) {
                  setIsQrManagementModalOpen(true);
                } else {
                  toast.error('Vui lòng chọn bàn để xem mã QR gọi món');
                }
              }}
              onOpenSettingsDrawer={() => setIsSettingsDrawerOpen(true)}
              onExitOrder={() => {
                if (isOnlineOrder(currentOrder)) {
                  handleClearCart();
                }
                returnToOriginTab();
              }}
            />
          </div>
        )}

        {activeTab === 'TABLES' && (
          <TableMap
            tables={tables}
            areas={areas}
            onSelectTable={handleSelectTableFromMap}
            onRefresh={() => currentBranch && fetchTables(currentBranch.id)}
            isLoading={isLoadingTables}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === 'ORDERS' && (
          <OrdersListPanel
            orders={branchOrders}
            isDarkMode={isDarkMode}
            onSelectOrder={(order) => {
              originTabRef.current = 'ORDERS';
              loadOrderIntoPos(order);
              setActiveTab('SALE');
            }}
            onPayOrder={(order) => {
              if (isOnlineOrder(order)) {
                toast.error('Đơn hàng Online không được phép mở thanh toán tại POS!');
                return;
              }
              originTabRef.current = 'ORDERS';
              loadOrderIntoPos(order);
              setIsPaymentModalOpen(true);
            }}
            onPrintTempBill={(order) => {
              setCurrentOrder(order);
              handlePrintTempBill(undefined, order.id);
            }}
            onOpenOrderFeesModal={(order) => handleOpenOrderFeesModal(order)}
            onQuickUpdateStatus={handleQuickUpdateStatus}
            onCreateOrder={(type) => {
              originTabRef.current = 'ORDERS';
              handleClearCart();
              if (type === 'TAKEAWAY') {
                setSelectedTable(null);
                setOrderType('TAKEAWAY');
                setCustomerName('Khách mang đi');
                setActiveTab('SALE');
                toast.success('Bắt đầu tạo đơn Mang về (Takeaway)');
              } else if (type === 'DELIVERY') {
                setSelectedTable(null);
                setOrderType('DELIVERY');
                setCustomerName('Khách giao hàng');
                setActiveTab('SALE');
                setIsDeliveryModalOpen(true);
                toast.success('Bắt đầu tạo đơn Giao hàng (Delivery)');
              } else if (type === 'DINE_IN') {
                setOrderType('DINE_IN');
                setActiveTab('TABLES');
                toast('Vui lòng chọn bàn trên sơ đồ để tạo đơn Tại bàn');
              } else {
                setSelectedTable(null);
                setOrderType('TAKEAWAY');
                setActiveTab('SALE');
              }
            }}
            onRefresh={() => currentBranch && fetchOrdersSnapshot(currentBranch.id)}
          />
        )}

        {activeTab === 'RESERVATIONS' && (
          <ReservationPanel
            branchId={currentBranch?.id || ''}
            tables={tables}
            isDarkMode={isDarkMode}
            onSeatReservation={async (resv, tableId) => {
              originTabRef.current = 'RESERVATIONS';
              setSearchQuery('');
              const tbl = tables.find((t) => t.id === tableId) || null;
              setSelectedTable(tbl);
              setCustomerName(resv.customerName);
              setCustomerPhone(resv.customerPhone);
              setGuestCount(resv.partySize);

              // Tự động tải món đặt trước vào giỏ hàng POS
              if (Array.isArray(resv.preOrderedItems) && resv.preOrderedItems.length > 0) {
                const loadedItems: PosCartItem[] = resv.preOrderedItems.map((it: any, idx: number) => {
                  const prod = products.find((p) => p.id === it.productId) || {
                    id: it.productId,
                    name: it.name || 'Món ăn',
                    price: it.price || 0,
                    imageUrl: it.imageUrl || it.image,
                  };
                  return {
                    id: `preorder-${it.productId}-${idx}-${Date.now()}`,
                    productId: it.productId,
                    product: prod as any,
                    quantity: Number(it.quantity || 1),
                    priceAtSale: Number(it.price || prod.price || 0),
                    originalPriceAtSale: Number(it.price || prod.price || 0),
                    discountAmount: 0,
                    note: it.note || 'Món đặt trước',
                    selectedOptions: [],
                    pricingMode: 'REGULAR',
                    source: 'POS',
                  };
                });
                setCartItems(loadedItems);
              }

              if (currentBranch) {
                fetchTables(currentBranch.id);
                fetchOrdersSnapshot(currentBranch.id);
              }

              setActiveTab('SALE');
              toast.success(`Đã xếp chỗ cho khách ${resv.customerName} tại ${tbl?.name}!`);
            }}
          />
        )}

        {activeTab === 'QR_ORDERS' && (
          <QrOrderPanel
            branchId={currentBranch?.id || ''}
            isDarkMode={isDarkMode}
            onAcceptQrOrder={(qrOrder) => {
              originTabRef.current = 'QR_ORDERS';
              setSearchQuery('');
              toast.success(`Đã chấp nhận đơn món từ ${qrOrder.tableName}`);
              setActiveTab('SALE');
            }}
          />
        )}
      </div>

      {/* Product Option Customizer Modal */}
      <ProductOptionModal
        product={selectedOptionProduct}
        isDarkMode={isDarkMode}
        onClose={() => setSelectedOptionProduct(null)}
        onConfirm={handleConfirmProductOptions}
      />

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <PaymentModal
          order={currentOrder}
          branch={currentBranch}
          table={selectedTable}
          cartItems={cartItems}
          guestCount={guestCount}
          orderDiscount={orderDiscount}
          deliveryAddress={deliveryInfo}
          orderType={orderType}
          initialMember={selectedMember}
          customerName={customerName}
          customerPhone={customerPhone}
          onClose={() => setIsPaymentModalOpen(false)}
          onCustomerUpdated={(member) => {
            setSelectedMember(member);
            setCustomerName(member.fullName);
            setCustomerPhone(member.phone || '');
          }}
          onProcessPayment={handleProcessPayment}
          isProcessing={isProcessingPayment}
          onPaymentSuccess={handleOrderPaymentSucceeded}
          onPrintTempBill={(qrUrl) => handlePrintTempBill(qrUrl)}
          onMoveToAwaiting={async () => {
            setIsPaymentModalOpen(false);
            handleClearCart();
            returnToOriginTab();
            if (currentBranch) {
              await fetchOrdersSnapshot(currentBranch.id);
              await fetchTables(currentBranch.id);
            }
          }}
          receiptPrinterName={
            branchPrintSettings.find((s) => s.purpose === 'TEMP_BILL')?.printerName ||
            branchPrintSettings.find((s) => s.purpose === 'RECEIPT')?.printerName ||
            currentBranch?.defaultReceiptPrinterId ||
            'Xprinter XP-350B'
          }
          paperSize={
            (branchPrintSettings.find((s) => s.purpose === 'TEMP_BILL')?.paperSize ||
              currentBranch?.defaultPaperSize ||
              '80mm') as any
          }
          vatPriceMode={(currentOrder as any)?.vatPriceModeSnapshot || vatPriceMode || 'VAT_EXCLUDED'}
          isDarkMode={isDarkMode}
        />
      )}

      {/* SePay Payment Success Modal */}
      <SepaySuccessModal
        isOpen={isSepaySuccessModalOpen}
        data={sepaySuccessData}
        isDarkMode={isDarkMode}
        onClose={() => {
          setIsSepaySuccessModalOpen(false);
          setSepaySuccessData(null);
        }}
        onPrintReceipt={async (orderId) => {
          await handlePrintTempBill(undefined, orderId, 'RECEIPT');
        }}
      />

      {/* Delivery Address Modal (F2) */}
      {isDeliveryModalOpen && (
        <DeliveryAddressModal
          initialInfo={deliveryInfo || undefined}
          isDarkMode={isDarkMode}
          onClose={() => setIsDeliveryModalOpen(false)}
          onConfirm={handleConfirmDelivery}
        />
      )}

      {/* Item Discount Modal */}
      {isItemDiscountModalOpen && selectedDiscountItem && (
        <ItemDiscountModal
          item={selectedDiscountItem}
          isDarkMode={isDarkMode}
          onClose={() => {
            setIsItemDiscountModalOpen(false);
            setSelectedDiscountItem(null);
          }}
          onApplyDiscount={handleApplyItemDiscount}
          onRemoveDiscount={(itemId) => handleApplyItemDiscount(itemId, 0, '')}
        />
      )}

      {/* Order Discount Modal */}
      {isOrderDiscountModalOpen && (
        <OrderDiscountModal
          subTotal={cartItems.reduce(
            (sum, it) => sum + Math.max(0, it.priceAtSale - (it.discountAmount || 0)) * it.quantity,
            0,
          )}
          currentDiscount={orderDiscount?.discountAmount || currentOrder?.discountAmount || 0}
          currentReason={orderDiscount?.discountReason || currentOrder?.discountReason || ''}
          currentDiscountType={orderDiscount?.discountType || (currentOrder as any)?.discountType}
          currentPercent={orderDiscount?.discountPercent || (currentOrder as any)?.discountPercent}
          orderId={currentOrder?.id}
          branchId={currentBranch?.id}
          initialMember={selectedMember}
          isDarkMode={isDarkMode}
          onRedeemReward={handleRedeemRewardInPos}
          onClose={() => setIsOrderDiscountModalOpen(false)}
          onApplyDiscount={handleApplyOrderDiscount}
          onRemoveDiscount={() => handleApplyOrderDiscount(0, '')}
        />
      )}

      {/* Shift Drawer Modal (if opened programmatically) */}
      {isShiftModalOpen && (
        <ShiftModal
          branchId={currentBranch?.id || ''}
          activeShift={activeShift}
          isDarkMode={isDarkMode}
          onClose={() => setIsShiftModalOpen(false)}
          onOpenShift={handleOpenShift}
          onCloseShift={handleCloseShift}
          onOpenEndOfDayReport={() => setIsEndOfDayReportModalOpen(true)}
        />
      )}

      {/* Split Order Modal */}
      {isSplitModalOpen && (
        <SplitOrderModal
          cartItems={cartItems}
          availableTables={tables}
          isDarkMode={isDarkMode}
          onClose={() => setIsSplitModalOpen(false)}
          onConfirmSplit={handleConfirmSplit}
        />
      )}

      {/* Merge Order Modal */}
      {isMergeModalOpen && (
        <MergeOrderModal
          currentOrder={currentOrder}
          occupiedTables={tables.filter((t) => t.visualStatus === 'OCCUPIED')}
          isDarkMode={isDarkMode}
          onClose={() => setIsMergeModalOpen(false)}
          onConfirmMerge={handleConfirmMerge}
        />
      )}

      {/* Move Table Modal */}
      {isMoveTableModalOpen && (
        <MoveTableModal
          currentTable={selectedTable}
          tables={tables}
          isDarkMode={isDarkMode}
          onClose={() => setIsMoveTableModalOpen(false)}
          onConfirmMove={handleConfirmMoveTable}
        />
      )}

      {/* Cancel Order with Mandatory Reason Modal */}
      {isCancelOrderModalOpen && currentOrder && (
        <CancelOrderModal
          order={currentOrder}
          isDarkMode={isDarkMode}
          onClose={() => setIsCancelOrderModalOpen(false)}
          onConfirmCancel={handleCancelOrder}
          isProcessing={isCancellingOrder}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        products={products}
        isDarkMode={isDarkMode}
        onSelectProduct={handleSelectProduct}
        onSelectTab={setActiveTab}
      />

      {/* Customer Select & Search Modal */}
      {isCustomerSelectModalOpen && !isOnlineOrder(currentOrder) && (
        <CustomerSelectModal
          currentCustomer={selectedMember}
          isDarkMode={isDarkMode}
          onClose={() => setIsCustomerSelectModalOpen(false)}
          onSelectCustomer={handleSelectCustomer}
          hasRedeemedPoints={hasRedeemedPoints}
          onCustomerUpdated={(updated) => {
            setSelectedMember(updated);
            setCustomerName(updated.fullName);
            setCustomerPhone(updated.phone || '');
          }}
        />
      )}

      {/* Modal Đổi Điểm Thưởng Lấy Món */}
      {isRedeemPointsModalOpen && currentOrder && (
        <PosRedeemPointsModal
          isOpen={isRedeemPointsModalOpen}
          isDarkMode={isDarkMode}
          onClose={() => setIsRedeemPointsModalOpen(false)}
          order={currentOrder}
          currentBranch={currentBranch}
          selectedMember={selectedMember || currentOrder.user}
          onAppliedSuccess={async () => {
            if (currentBranch?.id) {
              await fetchOrdersSnapshot(currentBranch.id);
              await fetchTables(currentBranch.id);
            }
            try {
              const res = await fetch(`${baseUrl}/api/pos/orders/${currentOrder.id}`, {
                credentials: 'include',
              });
              const json = await res.json();
              if (json.success && json.data) {
                setCurrentOrder(json.data);
                if (json.data.user) setSelectedMember(json.data.user);
                // Đồng bộ giỏ hàng liền ngay lập tức mà không cần thoát đơn vào lại
                setCartItems(mapAndSortOrderItemsToCart(json.data.orderItems || [], cartItems));
              }
            } catch {}
          }}
        />
      )}

      {/* Edit Customer VAT Info Modal (Only VAT fields editable) */}
      {isEditVatModalOpen && editingVatCustomer && (
        <EditCustomerVatModal
          customer={editingVatCustomer}
          isDarkMode={isDarkMode}
          onClose={() => {
            setIsEditVatOpen(false);
            setEditingVatCustomer(null);
          }}
          onSuccess={(updated) => {
            setIsEditVatOpen(false);
            setEditingVatCustomer(null);
            setSelectedMember(updated);
          }}
        />
      )}

      {/* POS Settings Drawer */}
      <PosSettingsDrawer
        isOpen={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
        currentBranch={currentBranch}
        branches={branches}
        canSwitchBranch={canSwitchBranch}
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        onSelectBranch={(b) => {
          setCurrentBranch(b);
          if (typeof window !== 'undefined') {
            localStorage.setItem('avora_pos_selected_branch', b.id);
          }
          fetchProducts(b.id);
          fetchTables(b.id);
          fetchOrdersSnapshot(b.id);
          fetchKitchenTickets(b.id);
          fetchReservationsCount(b.id);
          fetchPrintSettings(b.id);
        }}
        onSyncData={async () => {
          if (currentBranch) {
            await fetchInit();
            await fetchProducts(currentBranch.id);
            await fetchTables(currentBranch.id);
            await fetchOrdersSnapshot(currentBranch.id);
            await fetchKitchenTickets(currentBranch.id);
            await fetchReservationsCount(currentBranch.id);
            await fetchPrintSettings(currentBranch.id);
            setLastSyncedAt(new Date());
          }
        }}
        lastSyncedAt={lastSyncedAt}
        completedOrders={branchOrders.filter((o) => o.status === 'COMPLETED')}
        allOrders={branchOrders}
        onReprintReceipt={(order) => {
          setCurrentOrder(order);
          const type =
            order.status === 'COMPLETED' || order.paymentStatus === 'PAID'
              ? 'RECEIPT'
              : 'TEMP_BILL';
          handlePrintTempBill(undefined, order.id, type);
        }}
        activePosTab={activeTab}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
        onGoToAdmin={handleGoToAdmin}
        orderCounts={{
          allOrders: branchOrders.length,
          reservations: reservationsCount,
          qrOrders: qrPendingCount,
        }}
        onUpdateBranchSettings={(updatedBranch) => {
          setCurrentBranch((prev) => (prev ? { ...prev, ...updatedBranch } : updatedBranch));
          setBranches((prev) =>
            prev.map((b) => (b.id === updatedBranch.id ? { ...b, ...updatedBranch } : b)),
          );
          if (updatedBranch.id) fetchPrintSettings(updatedBranch.id);
        }}
        onOpenDesktopLaunch={() => setIsDesktopLaunchModalOpen(true)}
        onOpenEndOfDayReport={() => setIsEndOfDayReportModalOpen(true)}
      />

      {/* Numeric Keypad Touch Modal */}
      <NumericKeypadModal
        isOpen={isKeypadOpen}
        item={keypadItem}
        productToAdd={keypadAddContext?.product || null}
        isDarkMode={isDarkMode}
        onClose={() => {
          setIsKeypadOpen(false);
          setKeypadItem(null);
          setKeypadAddContext(null);
        }}
        onConfirm={(newQty, customUnitPrice) => {
          if (keypadItem) {
            handleUpdateItemQuantity(keypadItem.id, newQty, customUnitPrice);
          } else if (keypadAddContext) {
            addItemToCart(
              keypadAddContext.product,
              newQty,
              [],
              undefined,
              keypadAddContext.pricingMode,
              keypadAddContext.buffetSessionId,
              keypadAddContext.buffetPackageId,
              'POS',
              customUnitPrice,
            );
            focusAndSelectSearch();
          }
        }}
      />

      {/* Item Detail Audit Modal */}
      <ItemDetailModal
        isOpen={isItemDetailOpen}
        item={detailModalItem}
        isDarkMode={isDarkMode}
        orderCode={currentOrder?.orderCode || currentOrder?.temporaryOrderCode || undefined}
        tableName={selectedTable?.name}
        onClose={() => {
          setIsItemDetailOpen(false);
          setDetailModalItem(null);
        }}
      />

      {/* Guest Count Keypad Modal (Image 4) */}
      <GuestCountModal
        isOpen={isGuestCountModalOpen && !isOnlineOrder(currentOrder)}
        currentCount={guestCount}
        isDarkMode={isDarkMode}
        onClose={() => setIsGuestCountModalOpen(false)}
        onConfirm={(cnt) => {
          if (isOnlineOrder(currentOrder)) {
            toast.error('Đơn hàng Online không cho phép sửa số lượng khách!');
            return;
          }
          setGuestCount(cnt);
          if (currentOrder?.id) {
            fetch(`${baseUrl}/api/pos/orders/${currentOrder.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                expectedVersion: currentOrder.version,
                guestCount: cnt,
              }),
            })
              .then((r) => r.json())
              .then((res) => {
                if (res.success && res.data) {
                  setCurrentOrder(res.data);
                }
              })
              .catch(console.error);
          }
          toast.success(`Đã cập nhật: ${cnt} khách`, {
            icon: <Users className="w-4 h-4 text-blue-500" />,
          });
        }}
      />

      {/* Reprint Labels Modal (Image 3) */}
      <ReprintLabelsModal
        isOpen={isReprintLabelsModalOpen}
        isDarkMode={isDarkMode}
        onClose={() => setIsReprintLabelsModalOpen(false)}
        items={cartItems}
        orderCode={currentOrder?.orderCode || currentOrder?.temporaryOrderCode || undefined}
        tableName={selectedTable?.name || (orderType === 'TAKEAWAY' ? 'Mang đi' : 'Tại bàn')}
        branchName={currentBranch?.name}
        onConfirmPrint={handleConfirmReprintLabels}
      />

      {/* Order Detail / Taxes / Shipping Fees & Quick Status Modal */}
      {isOrderDetailFeesModalOpen && feesModalOrder && (
        <OrderDetailFeesModal
          order={feesModalOrder}
          isDarkMode={isDarkMode}
          onClose={() => {
            setIsOrderDetailFeesModalOpen(false);
            setFeesModalOrder(null);
          }}
          onOrderUpdated={(updated) => {
            if (currentBranch) fetchOrdersSnapshot(currentBranch.id);
            if (currentOrder && currentOrder.id === updated.id) {
              setCurrentOrder(updated);
            }
            setFeesModalOrder(updated);
          }}
          onPayOrder={() => {
            setIsOrderDetailFeesModalOpen(false);
            setFeesModalOrder(null);
            handleOpenPaymentModal();
          }}
        />
      )}

      {/* Buffet Selection Modal (Trong Buffet 0đ vs Món lẻ Xđ) */}
      {buffetSelectionProduct && (
        <BuffetSelectionModal
          product={buffetSelectionProduct}
          isDarkMode={isDarkMode}
          packageName={
            (currentOrder as any)?.buffetSessions?.find((s: any) => s.status === 'ACTIVE')?.packageNameSnapshot ||
            (currentOrder as any)?.buffetSessions?.[0]?.packageNameSnapshot ||
            (currentOrder as any)?.buffetSession?.packageNameSnapshot ||
            (currentOrder as any)?.buffetSession?.buffetPackage?.name ||
            'Gói Buffet'
          }
          onClose={() => setBuffetSelectionProduct(null)}
          onSelectMode={handleBuffetSelect}
        />
      )}

      {/* PosBuffetApplyModal (Kích hoạt Buffet trực tiếp tại POS) */}
      {isBuffetApplyModalOpen && currentBranch && (
        <PosBuffetApplyModal
          isOpen={isBuffetApplyModalOpen}
          isDarkMode={isDarkMode}
          branchId={currentBranch.id}
          tableName={selectedTable ? `Bàn ${selectedTable.tableCode || selectedTable.name}` : 'Đơn hàng'}
          currentGuestCount={guestCount}
          onClose={() => setIsBuffetApplyModalOpen(false)}
          onConfirmApply={handleConfirmApplyBuffet}
        />
      )}

      {/* QR Management Modal */}
      {isQrManagementModalOpen && (selectedTable || currentOrder?.table) && (
        <QrManagementModal
          table={selectedTable || (currentOrder?.table as any)}
          branch={currentBranch}
          order={currentOrder}
          isDarkMode={isDarkMode}
          onClose={() => setIsQrManagementModalOpen(false)}
        />
      )}

      {/* Cảnh báo đa luồng (Single-instance POS concurrency guard) */}
      <PosConcurrencyLockModal
        isOpen={isTabLocked}
        onResumeHere={claimLeadership}
      />

      {/* Thông báo thiết bị di động (Mobile screen guard) */}
      <PosMobileNoticeModal
        isOpen={isMobileDevice}
      />

      {/* Cảnh báo từ chối truy cập POS & Phiên hết hạn / Thu hồi quyền (Directives 37, 43, 44) */}
      {accessDeniedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-red-100 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-50 text-[#da251d] flex items-center justify-center shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900">{accessDeniedModal.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
              {accessDeniedModal.message}
            </p>
            <div className="w-full p-3 bg-red-50/70 border border-red-200 rounded-xl text-xs text-red-800 font-bold">
              Tự động đăng xuất sau {accessDeniedModal.countdown}s...
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-3 rounded-xl bg-[#da251d] hover:bg-red-700 text-white font-black text-xs transition-colors shadow-md shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất ngay
            </button>
          </div>
        </div>
      )}

      {/* Auto-Update Modal (Directives 65, 66, 73, 75, 76) */}
      <PosUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        manifest={updateManifest}
        currentVersion={platformBridge.getVersion()}
        isMandatory={updateManifest?.updateType === 'MANDATORY'}
        hasUnsavedChanges={Boolean(cartItems && cartItems.length > 0)}
      />

      {/* One-time SSO Desktop Launch Modal */}
      <PosDesktopLaunchModal
        isOpen={isDesktopLaunchModalOpen}
        onClose={() => setIsDesktopLaunchModalOpen(false)}
      />

      {/* End-of-Day / Shift Close Summary Modal */}
      <EndOfDayReportModal
        isOpen={isEndOfDayReportModalOpen}
        onClose={() => setIsEndOfDayReportModalOpen(false)}
        currentBranch={currentBranch}
        branches={branches}
        canSwitchBranch={canSwitchBranch}
        activeShiftOpenedAt={activeShift?.openedAt}
        activeShiftId={activeShift?.id}
        currentCashierId={currentUser?.id}
        currentCashierName={currentUser?.fullName || currentUser?.email}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
