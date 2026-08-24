"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
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
}

interface CartContextType {
  cartItems: CartItem[];
  currentBranchId: string;
  isLoaded: boolean;
  appliedVoucher: any | null;
  discountAmount: number;
  addToCart: (item: CartItem, branchId: string) => boolean;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateCartItem: (id: string, updatedItem: CartItem) => void;
  clearCart: () => void;
  changeBranch: (newBranchId: string) => void;
  setVoucher: (voucher: any, discount: number) => void;
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
  const [currentBranchId, setCurrentBranchId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<any | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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
          if (url && !url.includes('/api/auth/login') && !url.includes('/api/auth/logout')) {
            const hadUser = localStorage.getItem('user');
            
            // Mọi trường hợp bị 401 đều phải clear cookie HttpOnly ở backend để middleware không bị kẹt
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            originalFetch(`${baseUrl}/api/auth/logout`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'ngrok-skip-browser-warning': 'true' }
            }).catch(() => {});

            if (hadUser) {
              localStorage.removeItem('user');
              setShowInvalidTokenModal(true);
            }
          }
        }
        return response;
      } catch (error) {
        throw error;
      }
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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
        console.error('Failed to fetch user in CartContext', e);
      }

      if (user?.id) {
        const res = await fetch(`${baseUrl}/api/promotions/flash-sale/quota`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
      console.error('Failed to sync cart', err);
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

      const savedBranchId = localStorage.getItem("currentBranchId");
      if (savedBranchId) setCurrentBranchId(savedBranchId);
      
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
    }
  }, [cartItems, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("currentBranchId", currentBranchId);
    }
  }, [currentBranchId, isLoaded]);

  const addToCart = (item: CartItem, branchId: string): boolean => {
    if (item.rawProduct?.optionGroups && item.rawProduct.optionGroups.length > 0 && !item.selectedOptions) {
      setOptionsModalProduct(item.rawProduct);
      return false;
    }

    // If cart has items but from a different branch, warn the user
    if (cartItems.length > 0 && currentBranchId && branchId !== currentBranchId) {
      setConfirmDialog({
        message: "Món ăn này thuộc chi nhánh khác. Nếu tiếp tục, giỏ hàng hiện tại sẽ bị xóa. Bạn có đồng ý?",
        onConfirm: () => {
          setCartItems([{...item}]);
          setCurrentBranchId(branchId);
          setConfirmDialog(null);
          showToast(`Đã thêm ${item.name} vào giỏ hàng`);
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
        return newItems;
      });
      showToast(`Đã thêm ${item.name} vào giỏ hàng`);
      return true;
    }

    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i));
      }
      return [...prev, item];
    });

    showToast(`Đã thêm ${item.name} vào giỏ hàng`);
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
        message: "Việc đổi chi nhánh sẽ làm mới giỏ hàng hiện tại. Bạn có chắc chắn muốn đổi không?",
        onConfirm: () => {
          clearCart();
          setCurrentBranchId(newBranchId);
          setConfirmDialog(null);
        }
      });
    } else {
      setCurrentBranchId(newBranchId);
    }
  };

  const setVoucher = (voucher: any, discount: number) => {
    setAppliedVoucher(voucher);
    setDiscountAmount(discount);
    showToast(`Đã áp dụng mã ${voucher.code}`);
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setDiscountAmount(0);
    showToast("Đã hủy áp dụng mã giảm giá");
  };

  const getCartItemTotal = (item: CartItem) => {
    if (item.isFlashSaleItem && item.flashSaleStock !== undefined && item.maxQuantityPerUser !== undefined && item.maxQuantityPerUser !== null) {
      const flashSaleQty = Math.min(item.quantity, item.maxQuantityPerUser);
      const normalQty = item.quantity - flashSaleQty;
      return (flashSaleQty * item.priceAtSale) + (normalQty * item.originalPriceAtSale);
    }
    return item.quantity * item.priceAtSale;
  };

  const handleOptionsConfirm = (quantity: number, selectedOptions: Record<string, string[]>, addonsTotal: number) => {
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
      rawProduct: item
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
      cartItems, currentBranchId, isLoaded, 
      appliedVoucher, discountAmount, 
      addToCart, removeFromCart, updateQuantity, updateCartItem, clearCart, changeBranch,
      setVoucher, removeVoucher, getCartItemTotal, flashSaleQuotas, refreshQuotas,
      isBranchModalOpen, setIsBranchModalOpen, branchModalProduct, setBranchModalProduct,
      setConfirmDialog, optionsModalProduct, setOptionsModalProduct
    }}>
      {children}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300 font-medium whitespace-nowrap">
          {toastMessage}
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
          <div className="relative z-10 w-full sm:w-[500px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden h-[80vh] sm:h-auto sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-start justify-between shrink-0">
              <div className="flex gap-4">
                <img src={optionsModalProduct.imageUrl || optionsModalProduct.image || optionsModalProduct.images?.[0]?.url || 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=400'} className="w-20 h-20 rounded-xl object-cover shadow-sm" />
                <div>
                  <h2 className="font-bold text-lg text-slate-900 leading-tight mb-1">{optionsModalProduct.name}</h2>
                  <div className="text-red-600 font-bold">{(optionsModalProduct.flashSalePrice || optionsModalProduct.discountedPrice || optionsModalProduct.price || optionsModalProduct.salePrice || 0).toLocaleString('vi-VN')}đ</div>
                </div>
              </div>
              <button onClick={() => setOptionsModalProduct(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              <AddToCartForm 
                basePrice={optionsModalProduct.flashSalePrice || optionsModalProduct.discountedPrice || optionsModalProduct.price || optionsModalProduct.salePrice || 0} 
                optionGroups={optionsModalProduct.optionGroups || []} 
                onAddToCart={(qty, selectedOpts, totalAddons) => {
                  handleOptionsConfirm(qty, selectedOpts, totalAddons);
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
