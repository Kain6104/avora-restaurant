"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { X, AlertCircle, Check, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import AddToCartForm from "../components/AddToCartForm";

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
  replaceFromServerCart: (snapshot: ServerCartSnapshot) => boolean;
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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartVersion, setCartVersion] = useState(0);
  const cartVersionRef = useRef(0);
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

  const [flashSaleQuotas, setFlashSaleQuotas] = useState<Record<string, number>>({});

  const [showInvalidTokenModal, setShowInvalidTokenModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (response.status === 401) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof URL ? args[0].href : (args[0] as Request).url);

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
              url.includes('/api/auth/reset-password'));

          if (url && !isPublicAuthRoute) {
            const hadUser = localStorage.getItem('user');
            
            if (hadUser) {
              localStorage.removeItem('user');
              setShowInvalidTokenModal(true);

              // Chỉ khi user đã từng đăng nhập nhưng token bị hết hạn/thu hồi thì mới gọi logout dọn cookie
              const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
              originalFetch(`${baseUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'ngrok-skip-browser-warning': 'true' }
              }).catch(() => {});
            }
          }
        }
        return response;
      } catch (error: any) {
        // Tự động phục hồi nếu môi trường còn sót URL ngrok đã hết hạn (Tunnel not found / Failed to fetch)
        const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof URL ? args[0].href : (args[0] as Request)?.url);
        if (
          url &&
          url.includes('.ngrok-free.app') &&
          (error?.message?.includes('Failed to fetch') || error?.name === 'TypeError')
        ) {
          try {
            const fallbackBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
            const localFallbackUrl = url.replace(/^https?:\/\/[^/]+/, fallbackBase);
            const fallbackArgs = [...args];
            if (typeof fallbackArgs[0] === 'string') {
              fallbackArgs[0] = localFallbackUrl;
            } else if (fallbackArgs[0] instanceof URL) {
              fallbackArgs[0] = new URL(localFallbackUrl);
            }
            return await originalFetch(...(fallbackArgs as [any, any]));
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
    try {
      let quotas: Record<string, number> = {};
      let quotaExceededMessage = "";
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      let user = null;
      try {
        const meRes = await fetch(`${baseUrl}/api/auth/me`, {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (meRes.ok) {
          user = await meRes.json();
          // Đồng bộ lại vào localStorage để các màn hình khác sử dụng (Checkout, v.v.)
          localStorage.setItem('user', JSON.stringify(user));
        } else {
          localStorage.removeItem('user');
        }
      } catch (e) {
        // Fallback gracefully if backend is temporarily starting or offline
        console.warn('Backend auth check skipped (offline or connecting):', e);
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
        const baseId = item.id.replace('-normal', '');
        if (!baseItemsMap.has(baseId)) {
          baseItemsMap.set(baseId, { baseItem: { ...item, id: baseId, quantity: 0 }, existingFlashQty: 0 });
        }
        const data = baseItemsMap.get(baseId)!;
        data.baseItem.quantity += item.quantity;
        if (item.isFlashSaleItem) {
          data.existingFlashQty += item.quantity;
          data.baseItem.isFlashSaleItem = true;
        }
      }

      let newCartItems: CartItem[] = [];
      for (const data of baseItemsMap.values()) {
        const baseItem = data.baseItem;
        const existingFlashQty = data.existingFlashQty;
        const product = latestProducts.find((p: any) => p.id === baseItem.productId);
        if (!product) {
          newCartItems.push(baseItem); // Product not found, keep as is
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
      
      setCartItems(newCartItems);

      if (quotaExceededMessage) {
        showToast(quotaExceededMessage);
      }

    } catch (err) {
      console.warn('Cart sync paused (backend offline or reconnecting):', err);
    }
  };

  const refreshQuotas = () => {
    refreshQuotasAndSyncCart(cartItems);
  };

  // Load from localStorage on mount
  useEffect(() => {
    try {
      let loadedCart = [];
      const savedCart = localStorage.getItem("cartItems");
      if (savedCart) {
        loadedCart = JSON.parse(savedCart);
        setCartItems(loadedCart);
      }

      const savedBranchId = localStorage.getItem("currentBranchId") || localStorage.getItem("selectedBranchId");
      if (savedBranchId) setCurrentBranchId(savedBranchId);
      const savedCartVersion = Number(localStorage.getItem("chatbotCartVersion") || 0);
      if (Number.isSafeInteger(savedCartVersion) && savedCartVersion >= 0) {
        cartVersionRef.current = savedCartVersion;
        setCartVersion(savedCartVersion);
      }
      
      refreshQuotasAndSyncCart(loadedCart);
    } catch (e) {
      console.error("Failed to load cart from localStorage", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("cartItems", JSON.stringify(cartItems));
      localStorage.setItem("chatbotCartVersion", String(cartVersion));
    }
  }, [cartItems, cartVersion, isLoaded]);

  useEffect(() => {
    if (isLoaded && currentBranchId) {
      localStorage.setItem("currentBranchId", currentBranchId);
      localStorage.setItem("selectedBranchId", currentBranchId);
    }
  }, [currentBranchId, isLoaded]);

  const replaceFromServerCart = (snapshot: ServerCartSnapshot): boolean => {
    if (!Number.isSafeInteger(snapshot.cartVersion) || snapshot.cartVersion < cartVersionRef.current) {
      return false;
    }

    const nextItems: CartItem[] = snapshot.items.map((item) => ({
      id: item.lineId,
      productId: item.productId,
      name: item.productName,
      originalPriceAtSale: item.basePrice,
      priceAtSale: item.priceAtSale,
      quantity: item.quantity,
      imageUrl: item.imageUrl,
      optionsTextSnapshot: item.selectedOptions.map((option) => option.optionItemName).join(', '),
      selectedOptions: item.selectedOptions.map((option) => ({
        optionItemId: option.optionItemId,
        nameAtSale: option.optionItemName,
        priceAdjustmentAtSale: option.priceAdjustment,
      })),
      isFlashSaleItem: item.isFlashSale,
      flashSaleId: item.flashSaleId,
      note: item.note,
    }));

    cartVersionRef.current = snapshot.cartVersion;
    setCartVersion(snapshot.cartVersion);
    setCartItems(nextItems);
    setCurrentBranchId(snapshot.currentBranchId || '');
    return true;
  };

  const addToCart = (item: CartItem, branchId: string, silent?: boolean): boolean => {
    if (item.rawProduct?.optionGroups && item.rawProduct.optionGroups.length > 0 && !item.selectedOptions) {
      setOptionsModalProduct(item.rawProduct);
      return false;
    }

    // If cart has items but from a different branch, warn the user
    if (cartItems.length > 0 && currentBranchId && branchId !== currentBranchId) {
      setConfirmDialog({
        message: "Món ăn này thuộc chi nhánh khác. Nếu tiếp tục, giỏ hàng hiện tại sẽ bị xóa. Bạn có đồng ý?",
        onConfirm: () => {
          const newItems = [{...item}];
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

    if (item.isFlashSaleItem && item.flashSaleStock !== undefined && item.flashSaleSold !== undefined) {
      const availableStock = Math.max(0, item.flashSaleStock - item.flashSaleSold);
      
      const existingFlashQuantity = cartItems.find(i => i.id === item.id)?.quantity || 0;
      const existingNormalQuantity = cartItems.find(i => i.id === `${item.id}-normal`)?.quantity || 0;
      
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
          const existingIndex = newItems.findIndex((i) => i.id === item.id);
          if (existingIndex >= 0) {
            newItems[existingIndex] = { ...newItems[existingIndex], quantity: newItems[existingIndex].quantity + flashQtyToAdd };
          } else {
            newItems.push({ ...item, quantity: flashQtyToAdd, name: `${item.name} (Giá khuyến mãi)` });
          }
        }
        if (normalQtyToAdd > 0) {
          const normalId = `${item.id}-normal`;
          const existingIndex = newItems.findIndex((i) => i.id === normalId);
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
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        nextCart = prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i));
      } else {
        nextCart = [...prev, item];
      }
      return nextCart;
    });

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
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
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
    setCartItems((prev) => prev.map((i) => (i.id === id ? updatedItem : i)));
  };

  const clearCart = () => {
    setCartItems([]);
    refreshQuotasAndSyncCart([]);
  };

  const changeBranch = (newBranchId: string) => {
    if (newBranchId !== currentBranchId && cartItems.length > 0) {
      setConfirmDialog({
        message: "Việc đổi chi nhánh sẽ làm mới giỏ hàng hiện tại để đảm bảo tính sẵn có của món ăn. Bạn có chắc chắn muốn đổi không?",
        onConfirm: () => {
          clearCart();
          setCurrentBranchId(newBranchId);
          localStorage.setItem("currentBranchId", newBranchId);
          localStorage.setItem("selectedBranchId", newBranchId);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent("branch-changed", { detail: { branchId: newBranchId } }));
          }
          setConfirmDialog(null);
          showToast("Đã đổi chi nhánh thành công!");
        }
      });
    } else {
      setCurrentBranchId(newBranchId);
      localStorage.setItem("currentBranchId", newBranchId);
      localStorage.setItem("selectedBranchId", newBranchId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent("branch-changed", { detail: { branchId: newBranchId } }));
      }
      showToast("Đã đổi chi nhánh thành công!");
    }
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
    if (item.isFlashSaleItem && item.flashSaleStock !== undefined && item.maxQuantityPerUser !== undefined && item.maxQuantityPerUser !== null) {
      const flashSaleQty = Math.min(item.quantity, item.maxQuantityPerUser);
      const normalQty = item.quantity - flashSaleQty;
      return (flashSaleQty * item.priceAtSale) + (normalQty * item.originalPriceAtSale);
    }
    return item.quantity * item.priceAtSale;
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
      setConfirmDialog, optionsModalProduct, setOptionsModalProduct
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setOptionsModalProduct(null); }}></div>
          <div className="relative z-10 w-full sm:w-[500px] bg-white rounded-t-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] sm:max-h-[90vh] h-auto flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-3 sm:p-4 border-b border-slate-100 flex items-start justify-between shrink-0">
              <div className="flex gap-3 sm:gap-4">
                <img src={optionsModalProduct.imageUrl || optionsModalProduct.image || optionsModalProduct.images?.[0]?.url || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400'} className="w-12 h-12 sm:w-20 sm:h-20 rounded-xl object-cover shadow-sm" />
                <div>
                  <h2 className="font-bold text-sm sm:text-lg text-slate-900 leading-tight mb-0.5 sm:mb-1">{optionsModalProduct.name}</h2>
                  <div className="text-red-600 font-bold text-sm sm:text-base">{(optionsModalProduct.flashSalePrice || optionsModalProduct.discountedPrice || optionsModalProduct.price || optionsModalProduct.salePrice || 0).toLocaleString('vi-VN')}đ</div>
                </div>
              </div>
              <button onClick={() => setOptionsModalProduct(null)} className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors mt-1 sm:mt-0">
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4">
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
