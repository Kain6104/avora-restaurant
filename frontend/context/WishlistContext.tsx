'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

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
  toggleFavorite: (product: WishlistItem) => void;
  addToFavorites: (product: WishlistItem, showToast?: boolean) => void;
  removeFromFavorites: (productId: string, showToast?: boolean) => void;
  removeMultipleFromFavorites: (productIds: string[]) => void;
  restoreFavorites: (items: WishlistItem[]) => void;
  clearFavorites: () => void;
  favoritesCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const STORAGE_KEY = 'avora_favorites_items';

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<WishlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load favorites from localStorage', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.error('Failed to save favorites to localStorage', e);
    }
  }, [favorites, isLoaded]);

  const isFavorite = (productId: string) => {
    return favorites.some((item) => item.id === productId);
  };

  const addToFavorites = (product: WishlistItem, showToast = true) => {
    if (!product?.id) return;
    setFavorites((prev) => {
      if (prev.some((item) => item.id === product.id)) return prev;
      return [product, ...prev];
    });
    if (showToast) {
      toast.success(`Đã thêm "${product.name}" vào mục Yêu thích`, {
        id: `fav-${product.id}`,
      });
    }
  };

  const removeFromFavorites = (productId: string, showToast = true) => {
    const item = favorites.find((i) => i.id === productId);
    setFavorites((prev) => prev.filter((i) => i.id !== productId));
    if (showToast && item) {
      toast(`Đã bỏ "${item.name}" khỏi mục Yêu thích`, {
        id: `fav-rm-${productId}`,
      });
    }
  };

  const removeMultipleFromFavorites = (productIds: string[]) => {
    if (!productIds || productIds.length === 0) return;
    setFavorites((prev) => prev.filter((i) => !productIds.includes(i.id)));
    toast.success(`Đã xóa ${productIds.length} món khỏi danh sách yêu thích`);
  };

  const restoreFavorites = (itemsToRestore: WishlistItem[]) => {
    if (!itemsToRestore || itemsToRestore.length === 0) return;
    setFavorites((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const newItems = itemsToRestore.filter((i) => !existingIds.has(i.id));
      return [...newItems, ...prev];
    });
  };

  const toggleFavorite = (product: WishlistItem) => {
    if (!product?.id) return;
    if (isFavorite(product.id)) {
      removeFromFavorites(product.id);
    } else {
      addToFavorites(product);
    }
  };

  const clearFavorites = () => {
    setFavorites([]);
    toast.success('Đã xóa toàn bộ danh sách yêu thích');
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

