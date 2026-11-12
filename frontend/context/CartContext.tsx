"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { X, AlertCircle, Check, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import AddToCartForm from "../components/AddToCartForm";
import BranchSwitchModal from "../components/cart/BranchSwitchModal";
import { getAuthToken, clearAuthSession, getAuthHeaders, getApiBaseUrl } from "@/lib/auth";

export interface CartItemOption {
  optionItemId: string;
  nameAtSale: string;
  priceAdjustmentAtSale: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  originalPriceAtSale: number;
  priceAtSale: number;
  quantity: number;
  imageUrl?: string;
  optionsTextSnapshot?: string;
  selectedOptions?: CartItemOption[];
  isFlashSaleItem?: boolean;
  flashSaleId?: string;
  flashSaleStock?: number;
  flashSaleSold?: number;
  maxQuantityPerUser?: number | null;
  rawProduct?: any;
  isCombo?: boolean;
  comboId?: string;
  comboItemsSnapshot?: any[];
  note?: string;
  isCustomRecipe?: boolean;
  customRecipeData?: any;
  isAvailableAtBranch?: boolean;
  unavailabilityMessage?: string;
}

export interface ServerCartItem {
  lineId: string;
  productId: string;
  productName: string;
  quantity: number;
  basePrice: number;
  priceAtSale: number;
  selectedOptions: Array<{
    optionGroupId: string;
    optionGroupName: string;
    optionItemId: string;
    optionItemName: string;
    priceAdjustment: number;
  }>;
  note?: string;
  isFlashSale?: boolean;
  flashSaleId?: string;
  imageUrl?: string;
}

export interface ServerCartSnapshot {
  cartVersion: number;
  currentBranchId: string | null;
  items: ServerCartItem[];
  subTotal: number;
  totalItems: number;
}

export interface CartToastState {
  type: 'cart-add' | 'warning' | 'success' | 'info';
  itemName?: string;
  message?: string;
  totalPrice?: number;
}

interface CartContextType {
  cartItems: CartItem[];
  cartVersion: number;
  currentBranchId: string;
  isLoaded: boolean;
  appliedVoucher: any | null;
  appliedDiscountVoucher: any | null;
  appliedShippingVoucher: any | null;
  discountAmount: number;
  shippingDiscountAmount: number;
  isRevalidatingVouchers: boolean;
  addToCart: (item: CartItem, branchId: string, silent?: boolean) => boolean;
  addComboToCart: (combo: any, branchId?: string, quantity?: number, note?: string, silent?: boolean) => boolean;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateCartItem: (id: string, updatedItem: CartItem) => void;
  clearCart: () => void;
  replaceFromServerCart: (snapshot: ServerCartSnapshot, force?: boolean) => boolean;
  changeBranch: (newBranchId: string) => void;
  setVouchers: (discountVoucher: any | null, shippingVoucher: any | null) => void;
  setDiscountVoucher: (voucher: any | null) => void;
  setShippingVoucher: (voucher: any | null) => void;
  removeDiscountVoucher: () => void;
  removeShippingVoucher: () => void;
  setVoucher: (voucher: any, discount?: number) => void;
  removeVoucher: () => void;
  getCartItemTotal: (item: CartItem) => number;
  flashSaleQuotas: Record<string, number>;
  refreshQuotas: () => void;
  isBranchModalOpen: boolean;
  setIsBranchModalOpen: (isOpen: boolean) => void;
  branchModalProduct: any | null;
  setBranchModalProduct: (product: any | null) => void;
  setConfirmDialog: (dialog: { message: string; onConfirm: () => void } | null) => void;
  optionsModalProduct: any | null;
  setOptionsModalProduct: (product: any | null) => void;
  selectedItemIds: string[];
  toggleSelectItem: (id: string) => void;
  selectAllItems: (select: boolean) => void;
  syncCartWithServer: (overrideBranchId?: string) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Helper làm sạch Product ID để luôn đồng nhất định danh
export const extractCleanProductId = (rawId?: string): string => {
  if (!rawId) return '';
  let s = String(rawId).trim();
  if (s.includes('|')) {
    s = s.split('|')[0];
  }
  s = s.replace(/^(cart|line|combo|prod)[-_]/gi, '');
  s = s.replace(/[-_](base|normal|fs|default)$/gi, '');
  s = s.replace(/-\d{10,}$/, '');
  return s.trim();
};

// Helper tính khóa định danh duy nhất của dòng sản phẩm trong giỏ hàng (Line Identity Key)
export const getCartItemKey = (item: {
  productId?: string;
  name?: string;
  id?: string;
  comboId?: string;
  isCombo?: boolean;
  selectedOptions?: Array<{ optionItemId?: string; id?: string; priceAdjustmentAtSale?: number; priceAdjustment?: number; nameAtSale?: string; name?: string }>;
  note?: string;
  isFlashSaleItem?: boolean;
}): string => {
  const cleanProdId = extractCleanProductId(item.productId || item.id);
  const cleanName = String(item.name || '')
    .replace(/\s*\(Giá khuyến mãi\)/gi, '')
    .replace(/\s*\(Giá thường\)/gi, '')
    .trim()
    .toLowerCase();

  // Khóa định danh: ưu tiên cleanName để gộp triệt để cùng 1 món bất kể nguồn thêm
  const baseIdentity = item.isCombo
    ? `combo_${item.comboId || cleanProdId || cleanName}`
    : (cleanName ? `prod_${cleanName}` : `id_${cleanProdId || 'unknown'}`);

  // Chỉ tính các option thực sự có phụ thu tiền hoặc có id rõ ràng khác biệt
  const opts = (item.selectedOptions || [])
    .filter((o: any) => {
      const extra = Number(o.priceAdjustmentAtSale ?? o.priceAdjustment ?? o.extraPrice ?? 0);
      const optName = String(o.nameAtSale || o.name || '').toLowerCase();
      // Bỏ qua các option mặc định không tính tiền như 'cơm vừa', 'bình thường'
      if (extra === 0 && (optName.includes('vừa') || optName.includes('bình thường') || optName.includes('tiêu chuẩn'))) {
        return false;
      }
      return true;
    })
    .map((o) => (o as any).optionItemId || (o as any).id || (o as any).nameAtSale || (o as any).name)
    .filter(Boolean)
    .sort()
    .join('_');

  const note = (item.note || '').trim().toLowerCase();
  const fs = item.isFlashSaleItem ? 'fs' : 'normal';
  return `${baseIdentity}|${opts}|${note}|${fs}`;
};

// Helper gộp các dòng trùng lặp trong danh sách giỏ hàng
export const consolidateCartList = (items: CartItem[]): CartItem[] => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const map = new Map<string, CartItem>();
  for (const it of items) {
    if (!it) continue;
    const key = getCartItemKey(it);
    const existing = map.get(key);
    const qty = Math.max(1, Number(it.quantity) || 1);
    if (existing) {
      existing.quantity += qty;
    } else {
      const cleanProdId = extractCleanProductId(it.productId || it.id);
      map.set(key, {
        ...it,
        id: it.id || `cart-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        productId: cleanProdId || it.productId || it.id,
        quantity: qty,
      });
    }
  }
  return Array.from(map.values());
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const cartItemsRef = useRef<CartItem[]>([]);
  cartItemsRef.current = cartItems;
  const [cartVersion, setCartVersion] = useState(0);
  const cartVersionRef = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitializedFromServerRef = useRef(false);

  const applyCartState = (nextItems: CartItem[]) => {
    cartItemsRef.current = nextItems;
    setCartItems(nextItems);
    if (typeof window !== 'undefined' && hasInitializedFromServerRef.current) {
      localStorage.setItem("cartItems", JSON.stringify(nextItems));
    }
  };
  const [currentBranchId, setCurrentBranchId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [appliedDiscountVoucher, setAppliedDiscountVoucher] = useState<any | null>(null);
  const [appliedShippingVoucher, setAppliedShippingVoucher] = useState<any | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [shippingDiscountAmount, setShippingDiscountAmount] = useState<number>(0);
  const [isRevalidatingVouchers, setIsRevalidatingVouchers] = useState<boolean>(false);

  // Legacy alias for backward compatibility
  const appliedVoucher = appliedDiscountVoucher || appliedShippingVoucher;

  // Backend Preview Auto-Revalidation
  useEffect(() => {
    if (!appliedDiscountVoucher && !appliedShippingVoucher) {
      setDiscountAmount(0);
      setShippingDiscountAmount(0);
      return;
    }

    if (cartItems.length === 0) {
      setDiscountAmount(0);
      setShippingDiscountAmount(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsRevalidatingVouchers(true);
        const res = await fetch('/api/orders/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            cartItems: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              optionItemIds: item.selectedOptions?.map((opt) => opt.optionItemId) || [],
              isFlashSaleItem: item.isFlashSaleItem,
              flashSaleId: item.flashSaleId,
            })),
            branchId: currentBranchId || undefined,
            voucherCode: appliedDiscountVoucher?.code || undefined,
            shippingVoucherCode: appliedShippingVoucher?.code || undefined,
          }),
        });

        if (res.ok) {
          const previewData = await res.json();
          const data = previewData?.data || previewData;

          // Check Discount Voucher Validity
          if (appliedDiscountVoucher) {
            if (data?.voucher?.applied) {
              setDiscountAmount(data.discountAmount || 0);
            } else {
              setAppliedDiscountVoucher(null);
              setDiscountAmount(0);
              const reason = data?.voucher?.reason || 'Mã giảm giá không còn đủ điều kiện';
              showToast(`⚠️ ${reason}`);
            }
          }

          // Check Shipping Voucher Validity
          if (appliedShippingVoucher) {
            if (data?.shippingVoucher?.applied) {
              setShippingDiscountAmount(data.shippingDiscount || 0);
            } else {
              setAppliedShippingVoucher(null);
              setShippingDiscountAmount(0);
              const reason = data?.shippingVoucher?.reason || 'Mã freeship không còn đủ điều kiện';
              showToast(`⚠️ ${reason}`);
            }
          }
        }
      } catch (e) {
        console.error('Failed to auto-revalidate vouchers:', e);
      } finally {
        setIsRevalidatingVouchers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [cartItems, currentBranchId, appliedDiscountVoucher?.code, appliedShippingVoucher?.code]);

  const [cartToast, setCartToast] = useState<CartToastState | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchModalProduct, setBranchModalProduct] = useState<any | null>(null);
  const [optionsModalProduct, setOptionsModalProduct] = useState<any | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isBranchSwitchModalOpen, setIsBranchSwitchModalOpen] = useState(false);
  const [branchSwitchTarget, setBranchSwitchTarget] = useState<any>(null);
  const [branchSwitchUnavailable, setBranchSwitchUnavailable] = useState<any[]>([]);

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllItems = (select: boolean) => {
    if (select) {
      const avail = cartItems.filter((i) => i.isAvailableAtBranch !== false).map((i) => i.id);
      setSelectedItemIds(avail);
    } else {
      setSelectedItemIds([]);
    }
  };

  const pushCartToServer = async (items: CartItem[], branchId?: string) => {
    // Ngăn chặn tuyệt đối việc xóa sạch giỏ hàng khi client chưa nạp xong Persistent Cart từ Database
    if (!hasInitializedFromServerRef.current) {
      return;
    }

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch('/api/cart/sync', {
        method: 'POST',
        headers,
        credentials: 'include',
        keepalive: items.length <= 20,
        body: JSON.stringify({
          branchId: (branchId || currentBranchId) || undefined,
          items: items.map((i) => ({
            id: i.id,
            productId: extractCleanProductId(i.productId || i.id),
            quantity: i.quantity,
            priceAtSale: i.priceAtSale,
            originalPriceAtSale: i.originalPriceAtSale,
            selectedOptions: i.selectedOptions?.map((so) => ({
              optionItemId: so.optionItemId,
              nameAtSale: so.nameAtSale,
              priceAdjustmentAtSale: so.priceAdjustmentAtSale,
            })),
            optionsTextSnapshot: i.optionsTextSnapshot,
            note: i.note,
            isFlashSaleItem: i.isFlashSaleItem,
            flashSaleId: i.flashSaleId,
            isCombo: i.isCombo,
            comboId: i.comboId,
            isCustomRecipe: i.isCustomRecipe,
            customRecipeData: i.customRecipeData,
          })),
        }),
      });
    } catch (err) {
      console.warn('Failed to push cart to server database:', err);
    }
  };

  const syncCartWithServer = async (overrideBranchId?: string) => {
    const branchToUse = overrideBranchId || currentBranchId;
    const versionAtStart = cartVersionRef.current;
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/cart${branchToUse ? `?branchId=${branchToUse}` : ''}`, {
        credentials: 'include',
        headers,
      });
      const data = await res.json();
      if (cartVersionRef.current !== versionAtStart) {
        return;
      }
      if (res.ok && data.success && data.data) {
        const serverItems = (data.data.items || []).map((si: any) => ({
          id: si.id,
          productId: si.productId,
          name: si.name,
          priceAtSale: Number(si.priceAtSale ?? 0),
          originalPriceAtSale: Number(si.originalPriceAtSale ?? si.priceAtSale ?? 0),
          quantity: Math.max(1, Number(si.quantity) || 1),
          imageUrl: si.image || si.imageUrl || '',
          optionsTextSnapshot: si.optionsTextSnapshot || '',
          selectedOptions: si.selectedOptions || [],
          note: si.note || '',
          isFlashSaleItem: Boolean(si.isFlashSaleItem),
          flashSaleId: si.flashSaleId || undefined,
          isCombo: Boolean(si.isCombo),
          comboId: si.comboId || undefined,
          isCustomRecipe: Boolean(si.isCustomRecipe),
          customRecipeData: si.customRecipeData || undefined,
          isAvailableAtBranch: si.isAvailableAtBranch !== false,
          unavailabilityReason: si.unavailabilityReason,
          unavailabilityMessage: si.unavailabilityMessage,
        }));

        if (serverItems.length > 0) {
          const consolidated = consolidateCartList(serverItems);
          applyCartState(consolidated);
          localStorage.setItem("cartItems", JSON.stringify(consolidated));
          if (data.data.branchId) {
            setCurrentBranchId(data.data.branchId);
            localStorage.setItem("currentBranchId", data.data.branchId);
            localStorage.setItem("selectedBranchId", data.data.branchId);
          }
          // Mặc định chọn hết tất cả món khả dụng khi đồng bộ từ database
          const availIds = consolidated.filter((i: any) => i.isAvailableAtBranch !== false).map((i: any) => i.id);
          setSelectedItemIds(availIds);
        } else if (cartItemsRef.current.length > 0 && hasInitializedFromServerRef.current) {
          pushCartToServer(cartItemsRef.current, branchToUse);
        }
      }
    } catch (e) {
      console.warn('Sync cart with server paused:', e);
    }
  };


  const [flashSaleQuotas, setFlashSaleQuotas] = useState<Record<string, number>>({});

  const [showInvalidTokenModal, setShowInvalidTokenModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      // 1. Chuẩn hóa URL
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request)?.url || '';

      const isInternalApi =
        url.startsWith('/api/') ||
        url.includes('/api/') ||
        (typeof window !== 'undefined' && url.startsWith(window.location.origin) && url.includes('/api/'));

      // 2. Tự động đính kèm token và credentials cho request API nội bộ nếu chưa có
      const token = getAuthToken();
      let modifiedInit = init ? { ...init } : {};

      if (isInternalApi) {
        const headers = new Headers(modifiedInit.headers || (input instanceof Request ? input.headers : {}));
        if (token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        if (!headers.has('ngrok-skip-browser-warning')) {
          headers.set('ngrok-skip-browser-warning', 'true');
        }
        modifiedInit.headers = headers;
        if (!modifiedInit.credentials) {
          modifiedInit.credentials = 'include';
        }
      }

      try {
        const response = await originalFetch(input, modifiedInit);
        if (response.status === 401) {
          // Bỏ qua tuyệt đối nếu đang ở màn hình POS hoặc request liên quan đến Print Agent / POS / settings / printers
          const isPosScreen = typeof window !== 'undefined' && (
            window.location.pathname.startsWith('/pos') ||
            window.location.pathname.startsWith('/orders')
          );

          if (
            isPosScreen ||
            (url &&
              (url.includes(':9101') ||
                url.includes('localhost:9101') ||
                url.includes('127.0.0.1:9101') ||
                url.includes('/api/print-routing') ||
                url.includes('/api/pos') ||
                url.includes('/api/orders') ||
                url.includes('/printers') ||
                url.includes('/health')))
          ) {
            return response;
          }

          const isPublicAuthRoute =
            url &&
            (url.includes('/api/auth/login') ||
              url.includes('/api/auth/logout') ||
              url.includes('/api/auth/register') ||
              url.includes('/api/auth/verify-email') ||
              url.includes('/api/auth/forgot-password') ||
              url.includes('/api/auth/reset-password') ||
              url.includes('/api/auth/google'));

          // Tuyệt đối không coi request công khai là phiên hết hạn
          if (isPublicAuthRoute) {
            return response;
          }

          // CHỈ kích hoạt "Phiên đăng nhập hết hạn" khi client ĐANG CÓ token xác thực
          // Khách vãng lai gọi API thăm dò nhận 401 là trạng thái bình thường, không bao giờ bật modal
          const currentToken = getAuthToken();
          if (currentToken) {
            clearAuthSession();
            setShowInvalidTokenModal(true);

            const baseUrl = getApiBaseUrl();
            originalFetch(`${baseUrl}/api/auth/logout`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'ngrok-skip-browser-warning': 'true' }
            }).catch(() => { });
          }
        }
        return response;
      } catch (error: any) {
        // Tự động phục hồi nếu môi trường còn sót URL ngrok đã hết hạn (Tunnel not found / Failed to fetch)
        if (
          url &&
          url.includes('.ngrok-free.app') &&
          (error?.message?.includes('Failed to fetch') || error?.name === 'TypeError')
        ) {
          try {
            const fallbackBase = getApiBaseUrl();
            const localFallbackUrl = url.replace(/^https?:\/\/[^/]+/, fallbackBase);
            return await originalFetch(localFallbackUrl, modifiedInit);
          } catch (fallbackError) {
            throw error;
          }
        }
        throw error;
      }
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const showCartAddToast = (itemName: string, updatedCartItems?: CartItem[]) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    const cleanName = itemName
      .replace(' (Giá khuyến mãi)', '')
      .replace(' (Giá thường)', '')
      .trim();

    const items = updatedCartItems || cartItems;
    const total = items.reduce((acc, it) => acc + getCartItemTotal(it), 0);

    setCartToast({
      type: 'cart-add',
      itemName: cleanName,
      totalPrice: total,
    });

    toastTimeoutRef.current = setTimeout(() => {
      setCartToast(null);
    }, 4000);
  };

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    if (msg.startsWith('Đã thêm ') && msg.includes('vào giỏ hàng')) {
      const extractedName = msg
        .replace(/^Đã thêm\s+/, '')
        .replace(/\s+vào giỏ hàng.*$/, '')
        .trim();
      showCartAddToast(extractedName);
      return;
    }

    const isWarning = msg.includes('⚠️') || msg.includes('giới hạn') || msg.includes('chỉ còn') || msg.includes('kho') || msg.includes('hết');
    const isSuccess = msg.includes('áp dụng') || msg.includes('thành công');

    setCartToast({
      type: isWarning ? 'warning' : isSuccess ? 'success' : 'info',
      message: msg.replace(/^[⚠️\s]+/, ''),
    });

    toastTimeoutRef.current = setTimeout(() => {
      setCartToast(null);
    }, 4000);
  };

  const refreshQuotasAndSyncCart = async (currentCart: CartItem[]) => {
    const versionAtStart = cartVersionRef.current;
    try {
      let quotas: Record<string, number> = {};
      let quotaExceededMessage = "";
      const baseUrl = getApiBaseUrl();
      let user = null;
      const token = getAuthToken();
      if (token) {
        try {
          const meRes = await fetch(`${baseUrl}/api/auth/me`, {
            credentials: 'include',
            headers: getAuthHeaders(),
          });
          if (meRes.ok) {
            user = await meRes.json();
            localStorage.setItem('user', JSON.stringify(user));
          }
        } catch (e) {
          console.warn('Backend auth check skipped:', e);
        }
      }

      if (user?.id) {
        const res = await fetch(`${baseUrl}/api/promotions/flash-sale/quota`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ userId: user.id })
        });
        if (res.ok) {
          const quotaData = await res.json();
          quotas = quotaData.quotas || {};
          setFlashSaleQuotas(quotas);
        }
      }

      if (currentCart.length === 0) return;

      const productIds = Array.from(new Set(currentCart.map(i => i.productId)));
      const prodRes = await fetch(`${baseUrl}/api/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ ids: productIds })
      });

      if (!prodRes.ok) return;
      const latestProducts = await prodRes.json();

      const baseItemsMap = new Map<string, { baseItem: CartItem, existingFlashQty: number }>();
      for (const item of currentCart) {
        const groupKey = getCartItemKey({ ...item, isFlashSaleItem: false });
        if (!baseItemsMap.has(groupKey)) {
          baseItemsMap.set(groupKey, { baseItem: { ...item, quantity: 0 }, existingFlashQty: 0 });
        }
        const data = baseItemsMap.get(groupKey)!;
        data.baseItem.quantity += item.quantity;
        if (item.isFlashSaleItem) {
          data.existingFlashQty += item.quantity;
          data.baseItem.isFlashSaleItem = true;
        }
      }

      let newCartItems: CartItem[] = [];
      let hasRemovedDeadItems = false;
      for (const data of baseItemsMap.values()) {
        const baseItem = data.baseItem;
        const existingFlashQty = data.existingFlashQty;
        const product = latestProducts.find((p: any) => p.id === baseItem.productId);

        // Tự động loại bỏ hoàn toàn các món ma không còn tồn tại trong DB để tránh crash Checkout
        if (!product) {
          hasRemovedDeadItems = true;
          continue;
        }

        const optionsPrice = baseItem.selectedOptions?.reduce((sum, opt) => sum + opt.priceAdjustmentAtSale, 0) || 0;
        const newOriginalPrice = product.price + optionsPrice;
        const newFlashPrice = product.flashSalePrice ? product.flashSalePrice + optionsPrice : null;

        const isFlash = !!product.flashSalePrice;
        const quota = quotas[product.id] ?? product.maxQuantityPerUser ?? Infinity;
        const availableStock = isFlash ? Math.max(0, product.flashSaleStock - product.flashSaleSold) : 0;

        if (isFlash && quota > 0 && availableStock > 0) {
          const availableQuota = Math.min(quota, availableStock);
          const flashQty = Math.min(baseItem.quantity, availableQuota);
          const normalQty = baseItem.quantity - flashQty;

          if (flashQty > 0) {
            newCartItems.push({
              ...baseItem,
              isFlashSaleItem: true,
              priceAtSale: newFlashPrice!,
              originalPriceAtSale: newOriginalPrice,
              name: `${product.name} (Giá khuyến mãi)`,
              quantity: flashQty,
              flashSaleId: product.flashSaleId,
              flashSaleStock: product.flashSaleStock,
              flashSaleSold: product.flashSaleSold,
              maxQuantityPerUser: product.maxQuantityPerUser
            });
          }
          if (normalQty > 0) {
            if (existingFlashQty > flashQty) {
              quotaExceededMessage = "Một số sản phẩm đã tự động chuyển về giá gốc do bạn đã thêm vượt quá lượt mua Flash Sale.";
            }
            newCartItems.push({
              ...baseItem,
              id: `${baseItem.id}-normal`,
              isFlashSaleItem: false,
              priceAtSale: newOriginalPrice,
              originalPriceAtSale: newOriginalPrice,
              name: `${product.name} (Giá thường)`,
              quantity: normalQty
            });
          }
        } else {
          if (existingFlashQty > 0) {
            if (!isFlash) {
              quotaExceededMessage = "Một số sản phẩm đã chuyển về giá gốc do chương trình Flash Sale đã kết thúc.";
            } else if (availableStock <= 0) {
              quotaExceededMessage = "Một số sản phẩm đã chuyển về giá gốc do Flash Sale đã hết số lượng.";
            } else {
              quotaExceededMessage = "Một số sản phẩm đã chuyển về giá gốc do bạn đã dùng hết lượt mua Flash Sale.";
            }
          }
          newCartItems.push({
            ...baseItem,
            isFlashSaleItem: false,
            priceAtSale: newOriginalPrice,
            originalPriceAtSale: newOriginalPrice,
            name: product.name,
            quantity: baseItem.quantity
          });
        }
      }

      if (cartVersionRef.current !== versionAtStart) {
        return;
      }

      applyCartState(newCartItems);

      if (quotaExceededMessage) {
        showToast(quotaExceededMessage);
      }
      if (hasRemovedDeadItems) {
        showToast('Một số món không còn kinh doanh đã được tự động bỏ khỏi giỏ hàng.');
      }

    } catch (err) {
      console.warn('Cart sync paused (backend offline or reconnecting):', err);
    }
  };

  const refreshQuotas = () => {
    refreshQuotasAndSyncCart(cartItemsRef.current);
  };

  // Load persistent cart from Database / localStorage on mount
  useEffect(() => {
    let isCancelled = false;

    const initializeCart = async () => {
      try {
        let loadedCart: CartItem[] = [];
        const savedCart = localStorage.getItem("cartItems");
        if (savedCart) {
          try {
            const parsed = JSON.parse(savedCart);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const consolidatedMap = new Map<string, CartItem>();
              for (const it of parsed) {
                let cleanProdId = String(it.productId || it.id || '');
                if (cleanProdId.startsWith('cart-')) {
                  cleanProdId = cleanProdId.replace(/^cart-/, '').replace(/-\d{10,}$/, '');
                }
                const normalized: CartItem = {
                  ...it,
                  id: it.id || (it.isCombo ? `combo-${it.comboId || cleanProdId}` : `cart-${cleanProdId}`),
                  productId: cleanProdId,
                  priceAtSale: Number(it.priceAtSale ?? it.price ?? 0),
                  originalPriceAtSale: Number(it.originalPriceAtSale ?? it.priceAtSale ?? it.price ?? 0),
                  imageUrl: it.imageUrl || it.image || '',
                  quantity: Math.max(1, Number(it.quantity) || 1),
                };
                const key = getCartItemKey(normalized);
                const existing = consolidatedMap.get(key);
                if (existing) {
                  existing.quantity += normalized.quantity;
                } else {
                  consolidatedMap.set(key, normalized);
                }
              }
              loadedCart = consolidateCartList(Array.from(consolidatedMap.values()));
              if (!isCancelled) {
                applyCartState(loadedCart);
                const initialAvail = loadedCart.filter((i) => i.isAvailableAtBranch !== false).map((i) => i.id);
                setSelectedItemIds(initialAvail);
              }
            }
          } catch {}
        }

        const savedBranchId = localStorage.getItem("currentBranchId") || localStorage.getItem("selectedBranchId");
        if (savedBranchId && !isCancelled) setCurrentBranchId(savedBranchId);
        const savedCartVersion = Number(localStorage.getItem("chatbotCartVersion") || 0);
        if (Number.isSafeInteger(savedCartVersion) && savedCartVersion >= 0 && !isCancelled) {
          cartVersionRef.current = savedCartVersion;
          setCartVersion(savedCartVersion);
        }
        const versionAtServerFetch = cartVersionRef.current;

        // Tải Persistent Cart từ Database MySQL (xác thực bằng Bearer token hoặc Guest Cookie)
        const token = getAuthToken();
        const headers: Record<string, string> = {
          'ngrok-skip-browser-warning': 'true',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const branchQuery = savedBranchId ? `?branchId=${savedBranchId}` : '';
        const res = await fetch(`/api/cart${branchQuery}`, {
          credentials: 'include',
          headers,
        });

        if (res.ok) {
          const data = await res.json();
          const serverItems = data?.data?.items;
          const serverBranchId = data?.data?.branchId;

          if (Array.isArray(serverItems) && serverItems.length > 0) {
            const mappedServerItems: CartItem[] = serverItems.map((si: any) => ({
              id: si.id,
              productId: si.productId,
              name: si.name,
              priceAtSale: Number(si.priceAtSale ?? 0),
              originalPriceAtSale: Number(si.originalPriceAtSale ?? si.priceAtSale ?? 0),
              quantity: Math.max(1, Number(si.quantity) || 1),
              imageUrl: si.image || si.imageUrl || '',
              optionsTextSnapshot: si.optionsTextSnapshot || '',
              selectedOptions: si.selectedOptions || [],
              note: si.note || '',
              isFlashSaleItem: Boolean(si.isFlashSaleItem),
              flashSaleId: si.flashSaleId || undefined,
              isCombo: Boolean(si.isCombo),
              comboId: si.comboId || undefined,
              isCustomRecipe: Boolean(si.isCustomRecipe),
              customRecipeData: si.customRecipeData || undefined,
              isAvailableAtBranch: si.isAvailableAtBranch !== false,
              unavailabilityReason: si.unavailabilityReason,
              unavailabilityMessage: si.unavailabilityMessage,
            }));

            const consolidatedServerCart = consolidateCartList(mappedServerItems);
            if (!isCancelled && cartVersionRef.current === versionAtServerFetch) {
              applyCartState(consolidatedServerCart);
              localStorage.setItem("cartItems", JSON.stringify(consolidatedServerCart));
              if (serverBranchId) {
                setCurrentBranchId(serverBranchId);
                localStorage.setItem("currentBranchId", serverBranchId);
                localStorage.setItem("selectedBranchId", serverBranchId);
              }
              // Mặc định chọn hết tất cả món khả dụng khi nạp từ Database
              const availIds = consolidatedServerCart.filter((i) => i.isAvailableAtBranch !== false).map((i) => i.id);
              setSelectedItemIds(availIds);
            }
          } else if (loadedCart.length > 0 && cartVersionRef.current === versionAtServerFetch) {
            // LocalStorage có nhưng Server trống -> Lưu LocalStorage vào Database
            hasInitializedFromServerRef.current = true;
            await pushCartToServer(loadedCart, savedBranchId || undefined);
          }
        }
      } catch (e) {
        console.error("Failed to load cart from database / localStorage", e);
      } finally {
        if (!isCancelled) {
          hasInitializedFromServerRef.current = true;
          setIsLoaded(true);
        }
      }
    };

    initializeCart();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Lắng nghe sự kiện đăng nhập hoặc thay đổi session để đồng bộ ngay lập tức
  useEffect(() => {
    const handleAuthEvent = () => {
      syncCartWithServer();
    };
    window.addEventListener('storage', handleAuthEvent);
    window.addEventListener('user-updated', handleAuthEvent);
    return () => {
      window.removeEventListener('storage', handleAuthEvent);
      window.removeEventListener('user-updated', handleAuthEvent);
    };
  }, [currentBranchId]);

    // Save to localStorage and auto-sync to server Database when changed
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("cartItems", JSON.stringify(cartItems));
      localStorage.setItem("chatbotCartVersion", String(cartVersion));

      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }

      // Debounce sync to MySQL database
      syncTimerRef.current = setTimeout(() => {
        pushCartToServer(cartItemsRef.current, currentBranchId);
      }, 350);
      return () => {
        if (syncTimerRef.current) {
          clearTimeout(syncTimerRef.current);
          syncTimerRef.current = null;
        }
      };
    }
  }, [cartItems, cartVersion, currentBranchId, isLoaded]);

  useEffect(() => {
    if (isLoaded && currentBranchId) {
      localStorage.setItem("currentBranchId", currentBranchId);
      localStorage.setItem("selectedBranchId", currentBranchId);
    }
  }, [currentBranchId, isLoaded]);

  const replaceFromServerCart = (snapshot: ServerCartSnapshot, force = false): boolean => {
    if (!snapshot || !Array.isArray(snapshot.items)) {
      return false;
    }

    if (!force && Number.isSafeInteger(snapshot.cartVersion) && Number.isSafeInteger(cartVersionRef.current) && snapshot.cartVersion > 0 && snapshot.cartVersion < cartVersionRef.current && cartItems.length > 0) {
      return false;
    }

    // Tự động gom nhóm các món ăn trùng lặp cùng options và ghi chú (Deduplicate / Merge quantities)
    const groupedItemsMap = new Map<string, CartItem>();
    for (const rawItem of snapshot.items) {
      const itemAny = rawItem as any;
      const cleanProdId = String(itemAny.productId || itemAny.id || '').replace(/^cart-/, '').replace(/^line-/, '').replace(/-\d{10,}$/, '').trim();
      const selectedOpts = (itemAny.selectedOptions || []).map((option: any) => ({
        optionItemId: option.optionItemId || option.id || '',
        nameAtSale: option.optionItemName || option.name || option.nameAtSale || '',
        priceAdjustmentAtSale: Number(option.priceAdjustment ?? option.priceAdjustmentAtSale ?? option.extraPrice ?? 0),
      }));

      const key = getCartItemKey({
        productId: cleanProdId,
        isCombo: Boolean(itemAny.isCombo),
        comboId: itemAny.comboId,
        selectedOptions: selectedOpts,
        note: itemAny.note || '',
        isFlashSaleItem: Boolean(itemAny.isFlashSale ?? itemAny.isFlashSaleItem),
      });

      const qty = Math.max(1, Number(itemAny.quantity) || 1);
      const existing = groupedItemsMap.get(key);
      if (existing) {
        existing.quantity += qty;
      } else {
        const canonicalId = `cart-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        groupedItemsMap.set(key, {
          id: canonicalId,
          productId: cleanProdId,
          name: itemAny.productName || itemAny.name || 'Món ăn',
          originalPriceAtSale: Number(itemAny.basePrice ?? itemAny.originalPriceAtSale ?? itemAny.priceAtSale ?? itemAny.price ?? 0),
          priceAtSale: Number(itemAny.priceAtSale ?? itemAny.price ?? 0),
          quantity: qty,
          imageUrl: itemAny.imageUrl || itemAny.image || itemAny.images?.[0]?.url || '',
          optionsTextSnapshot: selectedOpts.map((o: any) => o.nameAtSale).filter(Boolean).join(', '),
          selectedOptions: selectedOpts,
          isFlashSaleItem: Boolean(itemAny.isFlashSale ?? itemAny.isFlashSaleItem),
          flashSaleId: itemAny.flashSaleId,
          note: itemAny.note || '',
        });
      }
    }

    const nextItems: CartItem[] = consolidateCartList(Array.from(groupedItemsMap.values()));

    const newVersion = Number.isSafeInteger(snapshot.cartVersion) && snapshot.cartVersion > 0 ? snapshot.cartVersion : (cartVersionRef.current + 1);
    cartVersionRef.current = newVersion;
    setCartVersion(newVersion);
    setCartItems(nextItems);
    if (snapshot.currentBranchId) {
      setCurrentBranchId(snapshot.currentBranchId);
      if (typeof window !== 'undefined') {
        localStorage.setItem("currentBranchId", snapshot.currentBranchId);
        localStorage.setItem("selectedBranchId", snapshot.currentBranchId);
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem("cartItems", JSON.stringify(nextItems));
      localStorage.setItem("chatbotCartVersion", String(newVersion));
    }
    return true;
  };

  const addToCart = (item: CartItem, branchId: string, silent?: boolean): boolean => {
    if (!item) return false;
    let cleanProdId = String(item.productId || item.id || '');
    if (cleanProdId.startsWith('cart-')) {
      cleanProdId = cleanProdId.replace(/^cart-/, '').replace(/-\d{10,}$/, '');
    }
    const price = Number(item.priceAtSale ?? (item as any).price ?? 0);
    const origPrice = Number(item.originalPriceAtSale ?? price);
    const canonicalId = item.isCombo
      ? (item.id || `combo-${item.comboId || cleanProdId}`)
      : (item.id && !item.id.match(/-\d{10,}$/) ? item.id : `cart-${cleanProdId}`);

    const normalizedItem: CartItem = {
      ...item,
      id: canonicalId,
      productId: cleanProdId,
      name: item.name || 'Món ăn',
      priceAtSale: price,
      originalPriceAtSale: origPrice,
      quantity: Math.max(1, Number(item.quantity) || 1),
      imageUrl: item.imageUrl || (item as any).image || '',
    };
    item = normalizedItem;

    if (item.rawProduct?.optionGroups && item.rawProduct.optionGroups.length > 0 && (!item.selectedOptions || item.selectedOptions.length === 0)) {
      setOptionsModalProduct(item.rawProduct);
      return false;
    }

    // If cart has items but from a different branch, warn the user
    if (cartItems.length > 0 && currentBranchId && branchId !== currentBranchId) {
      setConfirmDialog({
        message: "Món ăn này thuộc chi nhánh khác. Nếu tiếp tục, giỏ hàng hiện tại sẽ bị xóa. Bạn có đồng ý?",
        onConfirm: () => {
          const newItems = [{ ...item }];
          setCartItems(newItems);
          setCurrentBranchId(branchId);
          setConfirmDialog(null);
          if (!silent) {
            showCartAddToast(item.name, newItems);
          }
        }
      });
      return false;
    }

    // If cart is empty, set current branch
    if (cartItems.length === 0) {
      setCurrentBranchId(branchId);
    }

    const targetKey = getCartItemKey(item);

    if (item.isFlashSaleItem && item.flashSaleStock !== undefined && item.flashSaleSold !== undefined) {
      const availableStock = Math.max(0, item.flashSaleStock - item.flashSaleSold);

      const existingFlashItem = cartItems.find(i => i.id === item.id || getCartItemKey(i) === targetKey);
      const existingFlashQuantity = existingFlashItem?.quantity || 0;
      const existingNormalItem = cartItems.find(i => i.id === `${item.id}-normal` || getCartItemKey({ ...i, isFlashSaleItem: false }) === targetKey);
      const existingNormalQuantity = existingNormalItem?.quantity || 0;

      if (existingFlashQuantity + existingNormalQuantity + item.quantity > availableStock) {
        showToast(`Sản phẩm này chỉ còn ${availableStock} phần trong kho!`);
        return false; // Do not add
      }

      const userQuota = flashSaleQuotas[item.productId] ?? item.maxQuantityPerUser ?? Infinity;
      const availableQuota = Math.max(0, userQuota - existingFlashQuantity);

      let flashQtyToAdd = 0;
      let normalQtyToAdd = 0;

      if (availableQuota > 0) {
        flashQtyToAdd = Math.min(item.quantity, availableQuota);
        normalQtyToAdd = item.quantity - flashQtyToAdd;
      } else {
        normalQtyToAdd = item.quantity;
      }

      let nextCart: CartItem[] = [];
      setCartItems((prev) => {
        let newItems = [...prev];
        if (flashQtyToAdd > 0) {
          const existingIndex = newItems.findIndex((i) => i.id === item.id || (i.isFlashSaleItem && getCartItemKey(i) === targetKey));
          if (existingIndex >= 0) {
            newItems[existingIndex] = { ...newItems[existingIndex], quantity: newItems[existingIndex].quantity + flashQtyToAdd };
          } else {
            newItems.push({ ...item, quantity: flashQtyToAdd, name: `${item.name} (Giá khuyến mãi)` });
          }
        }
        if (normalQtyToAdd > 0) {
          const normalId = `${item.id}-normal`;
          const normalTargetKey = getCartItemKey({ ...item, isFlashSaleItem: false });
          const existingIndex = newItems.findIndex((i) => i.id === normalId || (!i.isFlashSaleItem && getCartItemKey(i) === normalTargetKey));
          if (existingIndex >= 0) {
            newItems[existingIndex] = { ...newItems[existingIndex], quantity: newItems[existingIndex].quantity + normalQtyToAdd };
          } else {
            newItems.push({
              ...item,
              id: normalId,
              quantity: normalQtyToAdd,
              isFlashSaleItem: false,
              priceAtSale: item.originalPriceAtSale,
              name: `${item.name} (Giá thường)`
            });
          }
        }
        nextCart = newItems;
        return newItems;
      });
      if (!silent) {
        showCartAddToast(item.name, nextCart);
      }
      return true;
    }

    let nextCart: CartItem[] = [];
    setCartItems((prev) => {
      const targetCleanName = String(item.name || '').replace(/\s*\(Giá khuyến mãi\)/gi, '').replace(/\s*\(Giá thường\)/gi, '').trim().toLowerCase();
      const existingIndex = prev.findIndex((i) => {
        if (i.id === item.id) return true;
        const iKey = getCartItemKey(i);
        if (iKey === targetKey) return true;
        const iCleanId = extractCleanProductId(i.productId || i.id);
        if (cleanProdId && iCleanId === cleanProdId) return true;
        const iCleanName = String(i.name || '').replace(/\s*\(Giá khuyến mãi\)/gi, '').replace(/\s*\(Giá thường\)/gi, '').trim().toLowerCase();
        return Boolean(targetCleanName && iCleanName === targetCleanName);
      });
      let updated: CartItem[];
      if (existingIndex >= 0) {
        updated = prev.map((i, idx) => (idx === existingIndex ? { ...i, quantity: i.quantity + item.quantity } : i));
      } else {
        updated = [...prev, item];
      }
      nextCart = consolidateCartList(updated);
      return nextCart;
    });

    setSelectedItemIds((prev) => Array.from(new Set([...prev, canonicalId])));

    if (!silent) {
      showCartAddToast(item.name, nextCart);
    }
    return true;
  };

  const addComboToCart = (combo: any, branchId?: string, quantity: number = 1, note?: string, silent?: boolean): boolean => {
    const targetBranchId = branchId || (combo.branches && combo.branches.length > 0 ? combo.branches[0].id : currentBranchId);

    if (cartItems.length > 0 && currentBranchId && targetBranchId && targetBranchId !== currentBranchId) {
      setConfirmDialog({
        message: "Combo này thuộc chi nhánh khác. Nếu tiếp tục, giỏ hàng hiện tại sẽ bị xóa. Bạn có đồng ý?",
        onConfirm: () => {
          const comboItem: CartItem = {
            id: `combo-${combo.id}`,
            productId: combo.items?.[0]?.productId || combo.id,
            name: combo.name,
            priceAtSale: combo.price,
            originalPriceAtSale: combo.effectiveOriginalPrice || combo.originalPrice || combo.price,
            quantity,
            imageUrl: combo.imageUrl || combo.items?.[0]?.product?.imageUrl,
            isCombo: true,
            comboId: combo.id,
            optionsTextSnapshot: combo.items?.map((i: any) => `${i.quantity}x ${i.product?.name}`).join(', '),
            comboItemsSnapshot: combo.items?.map((i: any) => ({
              productId: i.productId,
              name: i.product?.name,
              quantity: i.quantity,
              price: i.product?.price,
              imageUrl: i.product?.imageUrl
            })),
            note: note || ''
          };
          const newItems = [comboItem];
          setCartItems(newItems);
          if (targetBranchId) setCurrentBranchId(targetBranchId);
          setConfirmDialog(null);
          if (!silent) {
            showCartAddToast(combo.name, newItems);
          }
        }
      });
      return false;
    }

    if (cartItems.length === 0 && targetBranchId) {
      setCurrentBranchId(targetBranchId);
    }

    const comboItemId = `combo-${combo.id}`;
    let nextCart: CartItem[] = [];
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === comboItemId || (i.isCombo && i.comboId === combo.id));
      if (existingIndex >= 0) {
        const newItems = [...prev];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + quantity,
          note: note || newItems[existingIndex].note
        };
        nextCart = newItems;
        return newItems;
      }

      const comboItem: CartItem = {
        id: comboItemId,
        productId: combo.items?.[0]?.productId || combo.id,
        name: combo.name,
        priceAtSale: combo.price,
        originalPriceAtSale: combo.effectiveOriginalPrice || combo.originalPrice || combo.price,
        quantity,
        imageUrl: combo.imageUrl || combo.items?.[0]?.product?.imageUrl,
        isCombo: true,
        comboId: combo.id,
        optionsTextSnapshot: combo.items?.map((i: any) => `${i.quantity}x ${i.product?.name}`).join(', '),
        comboItemsSnapshot: combo.items?.map((i: any) => ({
          productId: i.productId,
          name: i.product?.name,
          quantity: i.quantity,
          price: i.product?.price,
          imageUrl: i.product?.imageUrl
        })),
        note: note || ''
      };
      nextCart = [...prev, comboItem];
      return nextCart;
    });

    if (!silent) {
      showCartAddToast(combo.name, nextCart);
    }
    return true;
  };

  const removeFromCart = (id: string) => {
    cartVersionRef.current += 1;
    setCartVersion(cartVersionRef.current);
    hasInitializedFromServerRef.current = true;
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const prev = cartItemsRef.current;
    const targetItem = prev.find((i) => i.id === id);
    const targetKey = targetItem ? getCartItemKey(targetItem) : null;
    const removedIds = new Set(
      prev
        .filter((i) => i.id === id || (Boolean(targetKey) && getCartItemKey(i) === targetKey))
        .map((i) => i.id),
    );
    removedIds.add(id);

    const nextItems = prev.filter((i) => !removedIds.has(i.id));
    applyCartState(nextItems);
    setSelectedItemIds((curr) => curr.filter((sid) => !removedIds.has(sid)));
    void pushCartToServer(nextItems, currentBranchId);
  };

  const updateQuantity = (id: string, quantity: number) => {
    cartVersionRef.current += 1;
    setCartVersion(cartVersionRef.current);
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }

    const existing = cartItems.find((i) => i.id === id);
    if (existing && existing.isFlashSaleItem && existing.flashSaleStock !== undefined && existing.flashSaleSold !== undefined) {
      const availableStock = Math.max(0, existing.flashSaleStock - existing.flashSaleSold);
      const userQuota = flashSaleQuotas[existing.productId] ?? existing.maxQuantityPerUser ?? Infinity;

      const maxAllowed = Math.min(availableStock, userQuota);

      if (quantity > maxAllowed) {
        const excess = quantity - maxAllowed;
        const normalId = `${id}-normal`;

        setCartItems((prev) => {
          let newItems = [...prev];
          const flashIndex = newItems.findIndex(i => i.id === id);
          if (flashIndex >= 0) {
            newItems[flashIndex] = { ...newItems[flashIndex], quantity: maxAllowed };
          }

          const normalIndex = newItems.findIndex(i => i.id === normalId);
          if (normalIndex >= 0) {
            newItems[normalIndex] = { ...newItems[normalIndex], quantity: newItems[normalIndex].quantity + excess };
          } else {
            newItems.push({
              ...existing,
              id: normalId,
              quantity: excess,
              isFlashSaleItem: false,
              priceAtSale: existing.originalPriceAtSale,
              name: `${existing.name.replace(' (Giá khuyến mãi)', '')} (Giá thường)`
            });
          }
          return newItems;
        });
        showToast(`Đã thêm ${excess} phần vào nhóm Giá thường do giới hạn khuyến mãi.`);
        return;
      }
    }

    setCartItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
  };

  const updateCartItem = (id: string, updatedItem: CartItem) => {
    cartVersionRef.current += 1;
    setCartVersion(cartVersionRef.current);
    setCartItems((prev) => prev.map((i) => (i.id === id ? updatedItem : i)));
  };

  const clearCart = () => {
    cartVersionRef.current += 1;
    setCartVersion(cartVersionRef.current);
    hasInitializedFromServerRef.current = true;
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    applyCartState([]);
    setSelectedItemIds([]);
    void pushCartToServer([], currentBranchId);
  };

  const changeBranch = async (newBranchId: string) => {
    if (newBranchId === currentBranchId) return;

    if (cartItems.length === 0) {
      setCurrentBranchId(newBranchId);
      localStorage.setItem("currentBranchId", newBranchId);
      localStorage.setItem("selectedBranchId", newBranchId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent("branch-changed", { detail: { branchId: newBranchId } }));
      }
      showToast("Đã đổi chi nhánh thành công!");
      return;
    }

    try {
      const res = await fetch(`/api/cart/validate-switch?targetBranchId=${newBranchId}`, {
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        if (!data.data.canSwitchDirectly && data.data.unavailableItems.length > 0) {
          setBranchSwitchTarget(data.data.targetBranch);
          setBranchSwitchUnavailable(data.data.unavailableItems);
          setIsBranchSwitchModalOpen(true);
          return;
        }
      }
    } catch (e) {
      console.warn('Validate branch switch check fallback:', e);
    }

    await executeBranchSwitch(newBranchId, true);
  };

  const handleConfirmBranchSwitch = async (keepUnavailable: boolean) => {
    if (!branchSwitchTarget) return;
    await executeBranchSwitch(branchSwitchTarget.id, keepUnavailable);
    setIsBranchSwitchModalOpen(false);
    setBranchSwitchTarget(null);
    setBranchSwitchUnavailable([]);
  };

  const cancelBranchSwitch = () => {
    setIsBranchSwitchModalOpen(false);
    setBranchSwitchTarget(null);
    setBranchSwitchUnavailable([]);
  };

  const executeBranchSwitch = async (newBranchId: string, keepUnavailable: boolean) => {
    try {
      await fetch('/api/cart/confirm-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ branchId: newBranchId, keepUnavailable }),
      });
    } catch (e) {}

    setCurrentBranchId(newBranchId);
    localStorage.setItem("currentBranchId", newBranchId);
    localStorage.setItem("selectedBranchId", newBranchId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent("branch-changed", { detail: { branchId: newBranchId } }));
    }
    await syncCartWithServer(newBranchId);
    showToast("Đã chuyển đổi chi nhánh thành công!");
  };

  const setVouchers = (discountVoucher: any | null, shippingVoucher: any | null) => {
    setAppliedDiscountVoucher(discountVoucher);
    setAppliedShippingVoucher(shippingVoucher);
    const names = [discountVoucher?.code, shippingVoucher?.code].filter(Boolean).join(', ');
    if (names) {
      showToast(`Đã áp dụng mã: ${names}`);
    }
  };

  const setDiscountVoucher = (voucher: any | null) => {
    setAppliedDiscountVoucher(voucher);
    if (voucher) showToast(`Đã áp dụng mã giảm giá: ${voucher.code}`);
  };

  const setShippingVoucher = (voucher: any | null) => {
    setAppliedShippingVoucher(voucher);
    if (voucher) showToast(`Đã áp dụng mã freeship: ${voucher.code}`);
  };

  const removeDiscountVoucher = () => {
    setAppliedDiscountVoucher(null);
    setDiscountAmount(0);
    showToast('Đã hủy mã giảm giá');
  };

  const removeShippingVoucher = () => {
    setAppliedShippingVoucher(null);
    setShippingDiscountAmount(0);
    showToast('Đã hủy mã freeship');
  };

  // Legacy setVoucher for backward compatibility
  const setVoucher = (voucher: any, discount?: number) => {
    if (!voucher) {
      removeVoucher();
      return;
    }
    if (voucher.discountType === 'FREE_SHIP') {
      setAppliedShippingVoucher(voucher);
      showToast(`Đã áp dụng mã freeship ${voucher.code}`);
    } else {
      setAppliedDiscountVoucher(voucher);
      showToast(`Đã áp dụng mã ${voucher.code}`);
    }
  };

  const removeVoucher = () => {
    setAppliedDiscountVoucher(null);
    setAppliedShippingVoucher(null);
    setDiscountAmount(0);
    setShippingDiscountAmount(0);
    showToast('Đã hủy áp dụng toàn bộ mã ưu đãi');
  };

  const getCartItemTotal = (item: CartItem) => {
    if (!item) return 0;
    const priceAtSale = Number(item.priceAtSale ?? (item as any).price ?? 0);
    const origPrice = Number(item.originalPriceAtSale ?? priceAtSale);
    const qty = Math.max(1, Number(item.quantity) || 1);
    if (item.isFlashSaleItem && item.flashSaleStock !== undefined && item.maxQuantityPerUser !== undefined && item.maxQuantityPerUser !== null) {
      const flashSaleQty = Math.min(qty, item.maxQuantityPerUser);
      const normalQty = qty - flashSaleQty;
      return (flashSaleQty * priceAtSale) + (normalQty * origPrice);
    }
    return qty * priceAtSale;
  };

  const handleOptionsConfirm = (quantity: number, selectedOptions: Record<string, string[]>, addonsTotal: number, note?: string) => {
    if (!optionsModalProduct) return;
    const item = optionsModalProduct;
    let optionNames: string[] = [];
    let selectedCartItemOptions: { optionItemId: string, nameAtSale: string, priceAdjustmentAtSale: number }[] = [];

    if (item.optionGroups && selectedOptions) {
      item.optionGroups.forEach((group: any) => {
        const selectedIds = selectedOptions[group.id] || [];
        selectedIds.forEach((id: string) => {
          const opt = group.optionItems.find((o: any) => o.id === id);
          if (opt) {
            optionNames.push(opt.name);
            selectedCartItemOptions.push({
              optionItemId: opt.id,
              nameAtSale: opt.name,
              priceAdjustmentAtSale: opt.priceAdjustment || 0
            });
          }
        });
      });
    }

    const priceAtSale = (item.flashSalePrice || item.discountedPrice || item.price || item.salePrice) + addonsTotal;
    const originalPriceAtSale = item.price + addonsTotal;
    const optionsTextSnapshot = optionNames.length > 0 ? optionNames.join(', ') : undefined;

    // Sort option item IDs to generate a deterministic hash, so same options get grouped together
    const optionsHash = selectedCartItemOptions.map(o => o.optionItemId).sort().join('-');

    const cartItem: CartItem = {
      id: item.id + (optionsHash ? '-' + optionsHash : ''),
      productId: item.id,
      name: item.name,
      originalPriceAtSale,
      priceAtSale,
      quantity,
      imageUrl: item.imageUrl || item.image || item.images?.[0]?.url,
      optionsTextSnapshot,
      selectedOptions: selectedCartItemOptions,
      isFlashSaleItem: !!(item.flashSalePrice || item.flashSale),
      flashSaleId: item.flashSaleId || item.flashSale?.id,
      flashSaleStock: item.flashSaleStock || item.flashSale?.stock,
      flashSaleSold: item.flashSaleSold || item.flashSale?.sold,
      maxQuantityPerUser: item.maxQuantityPerUser || item.flashSale?.maxQuantityPerUser,
      rawProduct: item,
      note
    };

    let branch = currentBranchId;
    if (!branch && typeof window !== 'undefined') {
      branch = localStorage.getItem('selectedBranchId') || 'AVO-Q1';
    }

    addToCart(cartItem, branch || 'AVO-Q1');
    setOptionsModalProduct(null);
  };

  return (
    <CartContext.Provider value={{
      cartItems, cartVersion, currentBranchId, isLoaded,
      appliedVoucher, appliedDiscountVoucher, appliedShippingVoucher,
      discountAmount, shippingDiscountAmount, isRevalidatingVouchers,
      addToCart, addComboToCart, removeFromCart, updateQuantity, updateCartItem, clearCart,
      replaceFromServerCart, changeBranch,
      setVouchers, setDiscountVoucher, setShippingVoucher, removeDiscountVoucher, removeShippingVoucher,
      setVoucher, removeVoucher, getCartItemTotal, flashSaleQuotas, refreshQuotas,
      isBranchModalOpen, setIsBranchModalOpen, branchModalProduct, setBranchModalProduct,
      setConfirmDialog, optionsModalProduct, setOptionsModalProduct,
      selectedItemIds, toggleSelectItem, selectAllItems, syncCartWithServer
    }}>
      {children}

      {/* Toast Notification (Sleek, professional floating card matching reference) */}
      {cartToast && (
        <div
          className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-[390px] sm:max-w-[420px] animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
          role="status"
          aria-live="polite"
        >
          <div className="relative overflow-hidden bg-[#222226]/95 backdrop-blur-md text-white rounded-2xl p-3 sm:p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.55)] border border-white/10 flex items-start sm:items-center gap-3 transition-all">

            {/* Left Icon Badge */}
            {cartToast.type === 'cart-add' || cartToast.type === 'success' ? (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#10b981] text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/30 mt-0.5 sm:mt-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            ) : cartToast.type === 'warning' ? (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
              </div>
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <AlertCircle className="w-4 h-4 stroke-[2.5]" />
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 min-w-0">
              {cartToast.type === 'cart-add' ? (
                <>
                  <p className="text-white text-[12px] sm:text-[13px] font-medium leading-snug break-words">
                    Thêm <span className="font-bold uppercase text-white tracking-tight">{cartToast.itemName}</span> vào giỏ hàng thành công!
                  </p>
                  <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-300 mt-1 font-medium flex-wrap">
                    <span className="text-slate-400">Tổng tiền giỏ hàng:</span>
                    <span className="font-bold text-[#f59e0b] sm:text-[#fbbf24]">
                      {(cartToast.totalPrice || 0).toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-slate-500 mx-0.5">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCartToast(null);
                        router.push('/cart');
                      }}
                      className="font-semibold text-[#f59e0b] sm:text-[#fbbf24] hover:text-amber-300 hover:underline transition-colors cursor-pointer"
                    >
                      Xem ngay
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-white text-xs sm:text-[13px] font-medium leading-snug break-words">
                  {cartToast.message}
                </p>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setCartToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 -mr-1 -mt-1 sm:mt-0"
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>

          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[10003] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDialog(null)}></div>
          <div className="relative bg-white w-[90%] max-w-[400px] rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-3">Xác nhận</h3>
            <p className="text-slate-600 mb-6 font-medium">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/30 transition-colors"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Options Modal */}
      {optionsModalProduct && (
        <div className="fixed inset-0 z-[10005] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={(e) => { e.stopPropagation(); setOptionsModalProduct(null); }}></div>
          <div className="relative z-10 w-full sm:max-w-[440px] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] sm:max-h-[88vh] h-auto flex flex-col animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={optionsModalProduct.imageUrl || optionsModalProduct.image || optionsModalProduct.images?.[0]?.url || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200'}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover shadow-2xs border border-slate-200/60 shrink-0"
                  alt={optionsModalProduct.name}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug truncate">{optionsModalProduct.name}</h2>
                  <div className="text-red-600 font-black text-xs sm:text-sm font-mono mt-0.5">{(optionsModalProduct.flashSalePrice || optionsModalProduct.discountedPrice || optionsModalProduct.price || optionsModalProduct.salePrice || 0).toLocaleString('vi-VN')}đ</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOptionsModalProduct(null)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 rounded-full transition-colors border border-slate-200/60 shadow-2xs shrink-0 ml-2"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5">
              <AddToCartForm
                basePrice={optionsModalProduct.flashSalePrice || optionsModalProduct.discountedPrice || optionsModalProduct.price || optionsModalProduct.salePrice || 0}
                optionGroups={optionsModalProduct.optionGroups || []}
                onAddToCart={(qty, selectedOpts, totalAddons, note) => {
                  handleOptionsConfirm(qty, selectedOpts, totalAddons, note);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Invalid Token Modal */}
      {showInvalidTokenModal && (
        <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowInvalidTokenModal(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3">Phiên đăng nhập hết hạn</h3>
            <p className="text-slate-500 mb-8 font-medium leading-relaxed">
              Phiên đăng nhập của bạn không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.
            </p>
            <button
              onClick={() => {
                setShowInvalidTokenModal(false);
                router.push('/login');
              }}
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-600/30 transition-all hover:-translate-y-1"
            >
              Đăng Nhập Lại
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setConfirmDialog(null)}
          />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-4 border border-amber-200">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Xác nhận đổi chi nhánh</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20 transition cursor-pointer"
              >
                Đồng ý đổi
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Branch Switch Warning Modal */}
      <BranchSwitchModal
        isOpen={isBranchSwitchModalOpen}
        onClose={cancelBranchSwitch}
        targetBranch={branchSwitchTarget}
        unavailableItems={branchSwitchUnavailable}
        onConfirmKeep={() => handleConfirmBranchSwitch(true)}
        onConfirmRemove={() => handleConfirmBranchSwitch(false)}
      />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
