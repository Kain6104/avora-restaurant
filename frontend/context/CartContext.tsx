"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  currentBranchId: string;
  addToCart: (item: CartItem, branchId: string) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  changeBranch: (newBranchId: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("cartItems");
      if (savedCart) setCartItems(JSON.parse(savedCart));

      const savedBranchId = localStorage.getItem("currentBranchId");
      if (savedBranchId) setCurrentBranchId(savedBranchId);
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

  const addToCart = (item: CartItem, branchId: string) => {
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
      return;
    }
    
    // If cart is empty, set current branch
    if (cartItems.length === 0) {
      setCurrentBranchId(branchId);
    }

    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i));
      }
      return [...prev, item];
    });

    showToast(`Đã thêm ${item.name} vào giỏ hàng`);
  };

  const removeFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCartItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
  };

  const clearCart = () => {
    setCartItems([]);
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

  return (
    <CartContext.Provider value={{ cartItems, currentBranchId, addToCart, removeFromCart, updateQuantity, clearCart, changeBranch }}>
      {children}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300 font-medium">
          {toastMessage}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
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
