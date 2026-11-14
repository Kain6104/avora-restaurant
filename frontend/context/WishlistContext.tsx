'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { isAuthenticated, getAuthHeaders, getApiBaseUrl, getAuthToken } from '@/lib/auth';

export interface WishlistItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  category?: { id?: string; name?: string; slug?: string };
  categoryId?: string;
  slug?: string;
  description?: string;
  flashSalePrice?: number;
  discountedPrice?: number;
  rating?: number;
  soldCount?: number;
  branches?: any[];
  [key: string]: any;
}

interface WishlistContextType {
  favorites: WishlistItem[];
  isLoaded: boolean;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: WishlistItem) => Promise<void>;
  addToFavorites: (product: WishlistItem, showToast?: boolean) => Promise<void>;
  removeFromFavorites: (productId: string, showToast?: boolean) => Promise<void>;
  removeMultipleFromFavorites: (productIds: string[]) => Promise<void>;
  restoreFavorites: (items: WishlistItem[]) => Promise<void>;
  clearFavorites: () => Promise<void>;
  favoritesCount: number;
  refreshFavorites: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const STORAGE_KEY = 'avora_favorites_items';

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<WishlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Tải danh sách món ăn yêu thích từ cơ sở dữ liệu nếu đã đăng nhập
  const refreshFavorites = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (!isAuthenticated()) {
      // Người dùng chưa đăng nhập: danh sách yêu thích trống, xóa dữ liệu local cũ
      setFavorites([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      setIsLoaded(true);
      return;
    }

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/products/user/favorites`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.data || []);
        setFavorites(list);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      } else if (res.status === 401 || res.status === 403) {
        setFavorites([]);
      }
    } catch (e) {
      console.error('Failed to load user favorites from backend', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshFavorites();

    const handleAuthChange = () => {
      refreshFavorites();
    };

    window.addEventListener('user-updated', handleAuthChange);
    return () => window.removeEventListener('user-updated', handleAuthChange);
  }, [refreshFavorites]);

  const isFavorite = (productId: string) => {
    return favorites.some((item) => item.id === productId);
  };

  const requireLoginNotice = () => {
    toast.error('Vui lòng đăng nhập để lưu món ăn vào danh sách yêu thích!', {
      id: 'fav-require-login',
      duration: 3500,
    });
  };

  const addToFavorites = async (product: WishlistItem, showToast = true) => {
    if (!product?.id) return;
    if (!isAuthenticated()) {
      requireLoginNotice();
      return;
    }

    // Optimistic update
    setFavorites((prev) => {
      if (prev.some((item) => item.id === product.id)) return prev;
      return [product, ...prev];
    });

    if (showToast) {
      toast.success(`Đã lưu "${product.name}" vào mục Yêu thích`, {
        id: `fav-${product.id}`,
      });
    }

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/products/${product.id}/favorite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) {
        // Rollback
        setFavorites((prev) => prev.filter((i) => i.id !== product.id));
        if (res.status === 401) {
          requireLoginNotice();
        } else {
          toast.error('Không thể lưu món ăn, vui lòng thử lại sau.');
        }
      }
    } catch (e) {
      setFavorites((prev) => prev.filter((i) => i.id !== product.id));
      toast.error('Lỗi kết nối khi lưu món ăn');
    }
  };

  const removeFromFavorites = async (productId: string, showToast = true) => {
    if (!isAuthenticated()) {
      requireLoginNotice();
      return;
    }

    const item = favorites.find((i) => i.id === productId);
    // Optimistic remove
    setFavorites((prev) => prev.filter((i) => i.id !== productId));
    if (showToast && item) {
      toast(`Đã bỏ "${item.name}" khỏi mục Yêu thích`, {
        id: `fav-rm-${productId}`,
      });
    }

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/products/${productId}/favorite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) {
        if (item) setFavorites((prev) => [item, ...prev]);
      }
    } catch (e) {
      if (item) setFavorites((prev) => [item, ...prev]);
    }
  };

  const removeMultipleFromFavorites = async (productIds: string[]) => {
    if (!productIds || productIds.length === 0) return;
    if (!isAuthenticated()) {
      requireLoginNotice();
      return;
    }

    const itemsToRemove = favorites.filter((i) => productIds.includes(i.id));
    setFavorites((prev) => prev.filter((i) => !productIds.includes(i.id)));
    toast.success(`Đã xóa ${productIds.length} món khỏi danh sách yêu thích`);

    const baseUrl = getApiBaseUrl();
    for (const id of productIds) {
      await fetch(`${baseUrl}/api/products/${id}/favorite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      }).catch(() => {});
    }
  };

  const restoreFavorites = async (itemsToRestore: WishlistItem[]) => {
    if (!itemsToRestore || itemsToRestore.length === 0) return;
    if (!isAuthenticated()) {
      requireLoginNotice();
      return;
    }

    setFavorites((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const newItems = itemsToRestore.filter((i) => !existingIds.has(i.id));
      return [...newItems, ...prev];
    });

    const baseUrl = getApiBaseUrl();
    for (const item of itemsToRestore) {
      await fetch(`${baseUrl}/api/products/${item.id}/favorite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      }).catch(() => {});
    }
  };

  const toggleFavorite = async (product: WishlistItem) => {
    if (!product?.id) return;
    if (isFavorite(product.id)) {
      await removeFromFavorites(product.id);
    } else {
      await addToFavorites(product);
    }
  };

  const clearFavorites = async () => {
    if (!isAuthenticated()) {
      requireLoginNotice();
      return;
    }
    const current = [...favorites];
    setFavorites([]);
    toast.success('Đã xóa toàn bộ danh sách yêu thích');

    const baseUrl = getApiBaseUrl();
    for (const item of current) {
      await fetch(`${baseUrl}/api/products/${item.id}/favorite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      }).catch(() => {});
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        favorites,
        isLoaded,
        isFavorite,
        toggleFavorite,
        addToFavorites,
        removeFromFavorites,
        removeMultipleFromFavorites,
        restoreFavorites,
        clearFavorites,
        favoritesCount: favorites.length,
        refreshFavorites,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}

