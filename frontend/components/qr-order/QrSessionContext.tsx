'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  QrSessionData,
  QrGuest,
  QrCartItem,
  QrProduct,
  QrTableOrderHistory,
} from './qr-types';
import { QrMenuPayload } from './QrMenuView';
import { useQrSocket } from './useQrSocket';
import toast from 'react-hot-toast';

export type ScreenType = 'DASHBOARD' | 'MENU' | 'ORDERS' | 'REWARDS' | 'ACTIVITY';
export type ModalType =
  | 'NONE'
  | 'PRODUCT'
  | 'CART'
  | 'CALL_STAFF'
  | 'PAYMENT'
  | 'VAT_INVOICE'
  | 'CHANGE_GUEST'
  | 'REGISTER';

export const VALID_VIEWS: Record<string, ScreenType> = {
  home: 'DASHBOARD',
  menu: 'MENU',
  orders: 'ORDERS',
  rewards: 'REWARDS',
  activity: 'ACTIVITY',
};

export const SCREEN_TO_PARAM: Record<ScreenType, string> = {
  DASHBOARD: 'home',
  MENU: 'menu',
  ORDERS: 'orders',
  REWARDS: 'rewards',
  ACTIVITY: 'activity',
};

export const VALID_MODALS: Record<string, ModalType> = {
  cart: 'CART',
  product: 'PRODUCT',
  call_staff: 'CALL_STAFF',
  payment: 'PAYMENT',
  vat_invoice: 'VAT_INVOICE',
  change_guest: 'CHANGE_GUEST',
  register: 'REGISTER',
};

export const MODAL_TO_PARAM: Partial<Record<ModalType, string>> = {
  CART: 'cart',
  PRODUCT: 'product',
  CALL_STAFF: 'call_staff',
  PAYMENT: 'payment',
  VAT_INVOICE: 'vat_invoice',
  CHANGE_GUEST: 'change_guest',
  REGISTER: 'register',
};

export const getOrCreateDeviceId = (): string => {
  if (typeof window === 'undefined') return `qr_${Date.now()}`;
  const saved = localStorage.getItem('avora_qr_device_id');
  if (saved) return saved;
  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `qr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem('avora_qr_device_id', generated);
  return generated;
};

interface ApiOrderItemResponse {
  id: string;
  productId: string;
  product?: { name?: string };
  productName?: string;
  quantity: number;
  priceAtSale: number;
  pricingMode?: 'REGULAR' | 'BUFFET_TICKET' | 'BUFFET_INCLUDED';
  kitchenStatus?: 'PENDING' | 'SENT' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  source?: 'POS' | 'WAITER' | 'QR_ORDER' | 'ADMIN' | 'CHATBOT' | 'VOICE';
  orderedByGuestName?: string;
  note?: string;
  optionsTextSnapshot?: string;
  selectedOptions?: Array<{ nameAtSale: string; priceAdjustmentAtSale: number }>;
}

interface ApiMenuCategoryResponse {
  products?: QrProduct[];
}

interface RoundStatusEvent {
  status?: string;
  rejectReason?: string;
}

export interface QrSessionContextValue {
  token: string;
  sessionData: QrSessionData | null;
  isLoadingSession: boolean;
  sessionError: string | null;
  guest: QrGuest | null;
  setGuest: React.Dispatch<React.SetStateAction<QrGuest | null>>;
  handleJoinSuccess: (newGuest: QrGuest) => void;
  fetchSession: (force?: boolean) => Promise<void>;

  cartItems: QrCartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<QrCartItem[]>>;
  totalCartCount: number;
  handleAddCartItem: (newItem: QrCartItem) => void;
  handleQuickAddProduct: (product: QrProduct, pricingMode: 'REGULAR' | 'BUFFET_INCLUDED') => void;
  handleUpdateSimpleQuantity: (
    productId: string,
    pricingMode: 'REGULAR' | 'BUFFET_INCLUDED',
    delta: number
  ) => void;
  handleUpdateCartQuantity: (localId: string, quantity: number) => void;
  handleEditCartItem: (item: QrCartItem) => void;
  handleSaveEditedCartItem: (localId: string, updatedItem: QrCartItem) => void;
  handleRemoveCartItem: (localId: string) => void;
  checkBuffetDishQuotaBeforeAdd: (
    productId: string,
    addQty: number,
    currentCart: QrCartItem[],
    pricingMode?: 'REGULAR' | 'BUFFET_INCLUDED',
    excludeLocalId?: string
  ) => string | null;

  orderHistory: QrTableOrderHistory | null;
  isLoadingHistory: boolean;
  fetchOrderHistory: () => Promise<void>;

  availableProductIds: Set<string> | null;
  setAvailableProductIds: React.Dispatch<React.SetStateAction<Set<string> | null>>;
  productCatalog: Record<string, QrProduct>;
  productCatalogRef: React.MutableRefObject<Record<string, QrProduct>>;
  setProductCatalog: React.Dispatch<React.SetStateAction<Record<string, QrProduct>>>;
  menuCache: QrMenuPayload | null;
  setMenuCache: React.Dispatch<React.SetStateAction<QrMenuPayload | null>>;
  refreshAvailableMenu: () => Promise<void>;

  menuRefreshTrigger: number;
  setMenuRefreshTrigger: React.Dispatch<React.SetStateAction<number>>;
  activityRefreshTrigger: number;
  setActivityRefreshTrigger: React.Dispatch<React.SetStateAction<number>>;

  isSocketConnected: boolean;

  selectedProductState: { product: QrProduct; pricingMode: 'REGULAR' | 'BUFFET_INCLUDED' } | null;
  setSelectedProductState: React.Dispatch<
    React.SetStateAction<{ product: QrProduct; pricingMode: 'REGULAR' | 'BUFFET_INCLUDED' } | null>
  >;
  editingCartItem: QrCartItem | null;
  setEditingCartItem: React.Dispatch<React.SetStateAction<QrCartItem | null>>;

  visitedViews: Record<ScreenType, boolean>;
  markViewVisited: (screen: ScreenType) => void;

  activeView: ScreenType;
  activeModal: ModalType;
  navigateScreen: (nextScreen: ScreenType) => void;
  goBackToDashboard: () => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
}

const QrSessionContext = createContext<QrSessionContextValue | null>(null);

export const QrSessionProvider: React.FC<{
  token: string;
  children: React.ReactNode;
}> = ({ token, children }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation state derived from Next.js searchParams (100% Next.js client routing)
  const viewParam = searchParams.get('view')?.toLowerCase() || 'home';
  const activeView: ScreenType = VALID_VIEWS[viewParam] || 'DASHBOARD';

  const modalParam = searchParams.get('modal')?.toLowerCase() || '';
  const activeModal: ModalType = VALID_MODALS[modalParam] || 'NONE';

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<QrSessionData | null>(null);
  const [guest, setGuest] = useState<QrGuest | null>(null);

  const [selectedProductState, setSelectedProductState] = useState<{
    product: QrProduct;
    pricingMode: 'REGULAR' | 'BUFFET_INCLUDED';
  } | null>(null);
  const [editingCartItem, setEditingCartItem] = useState<QrCartItem | null>(null);
  const [menuRefreshTrigger, setMenuRefreshTrigger] = useState(0);
  const [activityRefreshTrigger, setActivityRefreshTrigger] = useState(0);

  // Cart state persisted to localStorage
  const [cartItems, setCartItems] = useState<QrCartItem[]>(() => {
    if (typeof window === 'undefined' || !token) return [];
    try {
      const savedCart = localStorage.getItem(`avora_qr_cart_${token}`);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [availableProductIds, setAvailableProductIds] = useState<Set<string> | null>(null);
  const [menuCache, setMenuCache] = useState<QrMenuPayload | null>(null);
  const [productCatalog, setProductCatalog] = useState<Record<string, QrProduct>>({});
  const productCatalogRef = useRef<Record<string, QrProduct>>({});

  const [visitedViews, setVisitedViews] = useState<Record<ScreenType, boolean>>(() => ({
    DASHBOARD: true,
    MENU: activeView === 'MENU',
    ORDERS: activeView === 'ORDERS',
    REWARDS: activeView === 'REWARDS',
    ACTIVITY: activeView === 'ACTIVITY',
  }));

  const markViewVisited = useCallback((screen: ScreenType) => {
    setVisitedViews((prev) => (prev[screen] ? prev : { ...prev, [screen]: true }));
  }, []);

  // Update visited views whenever activeView changes
  useEffect(() => {
    markViewVisited(activeView);
  }, [activeView, markViewVisited]);

  const [orderHistory, setOrderHistory] = useState<QrTableOrderHistory | null>(null);
  const orderHistoryRef = useRef<QrTableOrderHistory | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Guard refs to prevent duplicate fetches
  const isInitializedRef = useRef(false);
  const isFetchingRef = useRef(false);

  // Persist cart to localStorage
  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    try {
      localStorage.setItem(`avora_qr_cart_${token}`, JSON.stringify(cartItems));
    } catch {
      // ignore
    }
  }, [token, cartItems]);

  // Client-Side Navigation helpers using Next.js router
  const navigateScreen = useCallback(
    (nextScreen: ScreenType) => {
      markViewVisited(nextScreen);
      const currentParams = new URLSearchParams(searchParams.toString());
      currentParams.delete('modal');
      currentParams.delete('googleAuth');
      currentParams.delete('auth_token');

      if (nextScreen === 'DASHBOARD') {
        currentParams.delete('view');
      } else {
        currentParams.set('view', SCREEN_TO_PARAM[nextScreen]);
      }

      const qs = currentParams.toString();
      const nextUrl = qs ? `/qr/${token}?${qs}` : `/qr/${token}`;
      router.push(nextUrl, { scroll: false });
    },
    [token, router, searchParams, markViewVisited]
  );

  const goBackToDashboard = useCallback(() => {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.delete('view');
    currentParams.delete('modal');
    currentParams.delete('googleAuth');
    currentParams.delete('auth_token');

    const qs = currentParams.toString();
    const nextUrl = qs ? `/qr/${token}?${qs}` : `/qr/${token}`;
    router.push(nextUrl, { scroll: false });
  }, [token, router, searchParams]);

  const openModal = useCallback(
    (modal: ModalType) => {
      if (modal === 'NONE') return;
      const currentParams = new URLSearchParams(searchParams.toString());
      const modalParamVal = MODAL_TO_PARAM[modal];
      if (modalParamVal) {
        currentParams.set('modal', modalParamVal);
        const qs = currentParams.toString();
        router.push(`/qr/${token}?${qs}`, { scroll: false });
      }
    },
    [token, router, searchParams]
  );

  const closeModal = useCallback(() => {
    setSelectedProductState(null);
    setEditingCartItem(null);
    const currentParams = new URLSearchParams(searchParams.toString());
    if (currentParams.has('modal')) {
      currentParams.delete('modal');
      const qs = currentParams.toString();
      const nextUrl = qs ? `/qr/${token}?${qs}` : `/qr/${token}`;
      router.replace(nextUrl, { scroll: false });
    }
  }, [token, router, searchParams]);

  // 1. Fetch QR Session Data - ONLY once on mount or explicitly forced (Requirement 8)
  const fetchSession = useCallback(
    async (force = false) => {
      if (!token) return;
      // Do not re-fetch if already initialized and session is valid unless force requested
      if (isInitializedRef.current && sessionData && !force) {
        return;
      }
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        const res = await fetch(`/api/qr-order/${token}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Mã QR không hợp lệ hoặc phiên gọi món đã kết thúc');
        }
        setSessionData(data.data);
        setSessionError(null);
        isInitializedRef.current = true;

        const deviceId = getOrCreateDeviceId();
        let currentGuest: QrGuest | null = null;
        const savedGuestStr = localStorage.getItem(`avora_guest_${token}`);
        if (savedGuestStr) {
          try {
            currentGuest = JSON.parse(savedGuestStr);
          } catch {
            // ignore
          }
        }

        const orderUser = data.data?.order?.user;
        if (orderUser) {
          const memberGuest: QrGuest = {
            id: currentGuest?.id || `guest-${orderUser.id}`,
            guestName:
              currentGuest?.guestName ||
              orderUser.fullName ||
              data.data.order?.customerName ||
              'Khách hàng',
            userId: orderUser.id,
            deviceSessionId: currentGuest?.deviceSessionId || deviceId,
            memberVerified: true,
            user: {
              id: orderUser.id,
              fullName: orderUser.fullName,
              phone: orderUser.phone,
              email: orderUser.email,
              avatarUrl: orderUser.avatarUrl ?? currentGuest?.user?.avatarUrl ?? null,
              points: orderUser.currentPoints ?? orderUser.points ?? 0,
              memberCode: orderUser.memberCode,
              tierName: orderUser.membershipTier?.name,
              membershipTier: orderUser.membershipTier,
            },
          };
          setGuest(memberGuest);
          localStorage.setItem(`avora_guest_${token}`, JSON.stringify(memberGuest));
        } else if (currentGuest) {
          setGuest(currentGuest);
        } else if (
          data.data?.order?.customerName &&
          data.data.order.customerName !== 'Khách vãng lai' &&
          data.data.order.customerName !== 'Khách tại bàn'
        ) {
          const guestFromOrder: QrGuest = {
            id: `guest-${Date.now()}`,
            guestName: data.data.order.customerName,
            deviceSessionId: deviceId,
            memberVerified: false,
            user: null,
          };
          setGuest(guestFromOrder);
          localStorage.setItem(`avora_guest_${token}`, JSON.stringify(guestFromOrder));
        }
      } catch (err: unknown) {
        setSessionError(err instanceof Error ? err.message : 'Lỗi tải phiên QR');
      } finally {
        setIsLoadingSession(false);
        isFetchingRef.current = false;
      }
    },
    [token, sessionData]
  );

  useEffect(() => {
    if (!isInitializedRef.current) {
      void fetchSession(false);
    }
  }, [fetchSession]);

  // Handle Google OAuth redirect return (?googleAuth=1 or ?auth_token=...) using Next.js router.replace
  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    const hasGoogleAuth = searchParams.get('googleAuth') === '1';
    const authToken = searchParams.get('auth_token');
    if (!hasGoogleAuth && !authToken) return;

    // Clean URL query params cleanly via Next.js router (preserving internal router state)
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.delete('googleAuth');
    currentParams.delete('auth_token');
    const qs = currentParams.toString();
    router.replace(qs ? `/qr/${token}?${qs}` : `/qr/${token}`, { scroll: false });

    const completeGoogleSession = async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }
        const res = await fetch(`/api/qr-order/${token}/auth/session`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ deviceSessionId: getOrCreateDeviceId() }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.guest) {
          const guestData: QrGuest = {
            id: data.guest.id,
            guestName: data.guest.guestName,
            userId: data.guest.userId ?? data.guest.user?.id ?? null,
            deviceSessionId: data.guest.deviceSessionId,
            memberVerified: true,
            user: data.guest.user ?? null,
          };
          setGuest(guestData);
          localStorage.setItem(`avora_guest_${token}`, JSON.stringify(guestData));
          toast.success(data.message || 'Đăng nhập Google thành công');
          void fetchSession(true);
        }
      } catch {
        toast.error('Không thể hoàn tất phiên đăng nhập Google');
      }
    };

    void completeGoogleSession();
  }, [token, router, searchParams, fetchSession]);

  // 2. Fetch available product IDs silently for stale cart validation & catalog lookup
  const refreshAvailableMenu = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/qr-order/${token}/menu`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success) {
        const validSet = new Set<string>();
        const catalogMap: Record<string, QrProduct> = {};
        ((data.buffetItems || []) as QrProduct[]).forEach((p) => {
          validSet.add(p.id);
          catalogMap[p.id] = p;
        });
        ((data.retailCategories || []) as ApiMenuCategoryResponse[]).forEach((cat) => {
          (cat.products || []).forEach((p) => {
            validSet.add(p.id);
            catalogMap[p.id] = p;
          });
        });
        const mergedCatalog = { ...productCatalogRef.current, ...catalogMap };
        productCatalogRef.current = mergedCatalog;
        setProductCatalog(mergedCatalog);
        setMenuCache(data);
        setAvailableProductIds(validSet);
        setCartItems((prev) => {
          if (prev.length === 0) return prev;
          const filtered = prev.filter((it) => validSet.has(it.productId));
          if (filtered.length < prev.length) {
            toast.error('Đã loại bỏ món không còn khả dụng tại chi nhánh khỏi giỏ hàng', {
              id: 'cart-sanitized',
            });
          }
          return filtered;
        });
      }
    } catch {
      // ignore
    }
  }, [token]);

  // 3. Fetch Table Order History
  const fetchOrderHistory = useCallback(async () => {
    if (!token) return;
    if (!orderHistoryRef.current) {
      setIsLoadingHistory(true);
    }
    try {
      const res = await fetch(`/api/qr-order/${token}/order`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.order) {
        const items =
          ((data.order.orderItems || []) as ApiOrderItemResponse[]).map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.product?.name ?? item.productName ?? '',
            quantity: item.quantity,
            priceAtSale: item.priceAtSale,
            pricingMode: item.pricingMode ?? 'REGULAR',
            kitchenStatus: item.kitchenStatus ?? 'SENT',
            source: item.source ?? 'QR_ORDER',
            orderedByName: item.orderedByGuestName,
            note: item.note,
            optionsTextSnapshot: item.optionsTextSnapshot,
            selectedOptions: item.selectedOptions,
          }));

        const nextHistory: QrTableOrderHistory = {
          orderId: data.order.id,
          orderCode: data.order.orderCode ?? data.order.temporaryOrderCode ?? '',
          totalAmount: data.order.totalAmount ?? 0,
          subTotal: data.order.subTotal ?? 0,
          guestCount: data.order.guestCount ?? 1,
          items,
        };
        orderHistoryRef.current = nextHistory;
        setOrderHistory(nextHistory);
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử đơn bàn', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token]);

  useEffect(() => {
    if (guest && token) {
      const timer = window.setTimeout(() => {
        void refreshAvailableMenu();
        void fetchOrderHistory();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [guest, token, refreshAvailableMenu, fetchOrderHistory]);

  // Socket connection maintained at layout/provider level
  const { isConnected: isSocketConnected } = useQrSocket({
    token,
    orderId: sessionData?.order?.id,
    onOrderUpdated: () => {
      void fetchOrderHistory();
      void fetchSession(true);
      setActivityRefreshTrigger((n) => n + 1);
    },
    onKitchenItemUpdated: () => {
      void fetchOrderHistory();
      setActivityRefreshTrigger((n) => n + 1);
    },
    onRoundStatusChanged: (data?: unknown) => {
      const eventData = (data || {}) as RoundStatusEvent;
      void fetchOrderHistory();
      void fetchSession(true);
      setActivityRefreshTrigger((n) => n + 1);
      if (eventData.status === 'APPROVED') {
        toast.success('Nhân viên đã duyệt món và gửi vào bếp');
      } else if (eventData.status === 'REJECTED') {
        toast.error(`Món đã bị từ chối: ${eventData.rejectReason || 'Vui lòng liên hệ nhân viên'}`);
      }
    },
    onPaymentCompleted: () => {
      toast.success('Đơn hàng đã thanh toán hoàn tất');
      void fetchSession(true);
      void fetchOrderHistory();
      setActivityRefreshTrigger((n) => n + 1);
    },
    onServiceRequestUpdated: () => {
      void fetchOrderHistory();
      setActivityRefreshTrigger((n) => n + 1);
    },
    onMenuUpdated: () => {
      void refreshAvailableMenu();
      setMenuRefreshTrigger((n) => n + 1);
    },
  });

  // Sync silently when customer switches back to browser tab / mobile screen wakes
  useEffect(() => {
    if (typeof document === 'undefined' || !token) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchSession(true);
        void fetchOrderHistory();
        void refreshAvailableMenu();
        setActivityRefreshTrigger((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [token, fetchSession, fetchOrderHistory, refreshAvailableMenu]);

  const handleJoinSuccess = (newGuest: QrGuest) => {
    setGuest(newGuest);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`avora_guest_${token}`, JSON.stringify(newGuest));
      if (newGuest.deviceSessionId) {
        localStorage.setItem('avora_qr_device_id', newGuest.deviceSessionId);
      }
    }
  };

  const handleAddCartItem = (newItem: QrCartItem) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) =>
          it.productId === newItem.productId &&
          it.pricingMode === newItem.pricingMode &&
          (it.note || '') === (newItem.note || '') &&
          JSON.stringify(it.selectedOptions) === JSON.stringify(newItem.selectedOptions)
      );
      if (existingIdx >= 0) {
        return prev.map((it, idx) =>
          idx === existingIdx ? { ...it, quantity: it.quantity + newItem.quantity } : it
        );
      }
      return [...prev, newItem];
    });
    toast.success(`Đã thêm ${newItem.quantity}x ${newItem.productName}`);
  };

  const checkBuffetDishQuotaBeforeAdd = useCallback(
    (
      productId: string,
      addQty: number,
      currentCart: QrCartItem[],
      pricingMode: 'REGULAR' | 'BUFFET_INCLUDED' = 'BUFFET_INCLUDED',
      excludeLocalId?: string
    ): string | null => {
      const maxPerSubmission =
        sessionData?.buffetSession?.status === 'ACTIVE'
          ? sessionData.buffetSession.buffetPackage?.maxItemsPerSubmission
          : null;
      if (typeof maxPerSubmission === 'number' && maxPerSubmission > 0) {
        const currentTotalCount = currentCart
          .filter((it) => it.localId !== excludeLocalId)
          .reduce((sum, it) => sum + it.quantity, 0);
        if (currentTotalCount + addQty > maxPerSubmission) {
          return `Bạn đang chọn ${currentTotalCount + addQty} món, vượt quá giới hạn ${maxPerSubmission} món cho mỗi lần gọi.`;
        }
      }

      if (pricingMode !== 'BUFFET_INCLUDED') return null;
      const prod = productCatalogRef.current[productId];
      if (!prod) return null;
      const inCartSameProd = currentCart
        .filter(
          (it) =>
            it.pricingMode === 'BUFFET_INCLUDED' &&
            it.productId === productId &&
            it.localId !== excludeLocalId
        )
        .reduce((s, it) => s + it.quantity, 0);

      if (
        typeof prod.maxQuantityPerRound === 'number' &&
        prod.maxQuantityPerRound > 0 &&
        inCartSameProd + addQty > prod.maxQuantityPerRound
      ) {
        return `Món "${prod.name}" chỉ được gọi tối đa ${prod.maxQuantityPerRound} phần mỗi lần gửi.`;
      }

      if (typeof prod.maxTotalQuantity === 'number' && prod.maxTotalQuantity > 0) {
        const used = prod.usedTotalQuantity || 0;
        const remaining = Math.max(0, prod.maxTotalQuantity - used);
        if (inCartSameProd + addQty > remaining) {
          return remaining === 0
            ? `Món "${prod.name}" đã đạt tối đa ${prod.maxTotalQuantity} phần trong bữa Buffet này.`
            : `Món "${prod.name}" chỉ còn được gọi thêm ${remaining}/${prod.maxTotalQuantity} phần trong bữa Buffet này.`;
        }
      }
      return null;
    },
    [sessionData?.buffetSession]
  );

  const handleQuickAddProduct = (
    product: QrProduct,
    pricingMode: 'REGULAR' | 'BUFFET_INCLUDED'
  ) => {
    const limitErr = checkBuffetDishQuotaBeforeAdd(product.id, 1, cartItems, pricingMode);
    if (limitErr) {
      toast.error(limitErr);
      return;
    }
    const basePrice = pricingMode === 'BUFFET_INCLUDED' ? 0 : product.effectivePrice;
    handleAddCartItem({
      localId: `${product.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      unit: product.unit,
      quantity: 1,
      pricingMode,
      basePrice,
      priceAtSale: basePrice,
      originalPrice: product.price,
      selectedOptions: [],
    });
  };

  const handleUpdateSimpleQuantity = (
    productId: string,
    pricingMode: 'REGULAR' | 'BUFFET_INCLUDED',
    delta: number
  ) => {
    if (delta > 0) {
      const limitErr = checkBuffetDishQuotaBeforeAdd(productId, delta, cartItems, pricingMode);
      if (limitErr) {
        toast.error(limitErr);
        return;
      }
    }
    setCartItems((prev) => {
      const idx = prev.findIndex(
        (it) =>
          it.productId === productId &&
          it.pricingMode === pricingMode &&
          it.selectedOptions.length === 0 &&
          !it.note
      );
      if (idx < 0) return prev;
      const nextQty = prev[idx].quantity + delta;
      if (nextQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      return prev.map((it, i) => (i === idx ? { ...it, quantity: nextQty } : it));
    });
  };

  const handleUpdateCartQuantity = (localId: string, quantity: number) => {
    setCartItems((prev) => {
      const target = prev.find((it) => it.localId === localId);
      if (target && quantity > target.quantity) {
        const limitErr = checkBuffetDishQuotaBeforeAdd(
          target.productId,
          quantity - target.quantity,
          prev,
          target.pricingMode
        );
        if (limitErr) {
          toast.error(limitErr);
          return prev;
        }
      }
      return prev
        .map((it) => (it.localId === localId ? { ...it, quantity } : it))
        .filter((it) => it.quantity > 0);
    });
  };

  const handleEditCartItem = (item: QrCartItem) => {
    const catalogProduct = productCatalogRef.current[item.productId];
    const fallbackProduct: QrProduct = catalogProduct || {
      id: item.productId,
      name: item.productName,
      price: item.originalPrice ?? item.basePrice,
      effectivePrice: item.basePrice,
      imageUrl: item.imageUrl,
      unit: item.unit,
      optionGroups: [],
    };
    setEditingCartItem(item);
    setSelectedProductState({
      product: fallbackProduct,
      pricingMode: item.pricingMode === 'BUFFET_INCLUDED' ? 'BUFFET_INCLUDED' : 'REGULAR',
    });
    openModal('PRODUCT');
  };

  const handleSaveEditedCartItem = (localId: string, updatedItem: QrCartItem) => {
    setCartItems((prev) => prev.map((it) => (it.localId === localId ? updatedItem : it)));
    setEditingCartItem(null);
    setSelectedProductState(null);
    openModal('CART');
    toast.success(`Đã cập nhật ${updatedItem.productName}`);
  };

  const handleRemoveCartItem = (localId: string) => {
    setCartItems((prev) => prev.filter((it) => it.localId !== localId));
  };

  const totalCartCount = useMemo(
    () => cartItems.reduce((sum, i) => sum + i.quantity, 0),
    [cartItems]
  );

  const value: QrSessionContextValue = {
    token,
    sessionData,
    isLoadingSession,
    sessionError,
    guest,
    setGuest,
    handleJoinSuccess,
    fetchSession,

    cartItems,
    setCartItems,
    totalCartCount,
    handleAddCartItem,
    handleQuickAddProduct,
    handleUpdateSimpleQuantity,
    handleUpdateCartQuantity,
    handleEditCartItem,
    handleSaveEditedCartItem,
    handleRemoveCartItem,
    checkBuffetDishQuotaBeforeAdd,

    orderHistory,
    isLoadingHistory,
    fetchOrderHistory,

    availableProductIds,
    setAvailableProductIds,
    productCatalog,
    productCatalogRef,
    setProductCatalog,
    menuCache,
    setMenuCache,
    refreshAvailableMenu,

    menuRefreshTrigger,
    setMenuRefreshTrigger,
    activityRefreshTrigger,
    setActivityRefreshTrigger,

    isSocketConnected,

    selectedProductState,
    setSelectedProductState,
    editingCartItem,
    setEditingCartItem,

    visitedViews,
    markViewVisited,

    activeView,
    activeModal,
    navigateScreen,
    goBackToDashboard,
    openModal,
    closeModal,
  };

  return <QrSessionContext.Provider value={value}>{children}</QrSessionContext.Provider>;
};

export const useQrSession = (): QrSessionContextValue => {
  const ctx = useContext(QrSessionContext);
  if (!ctx) {
    throw new Error('useQrSession must be used within a QrSessionProvider');
  }
  return ctx;
};

