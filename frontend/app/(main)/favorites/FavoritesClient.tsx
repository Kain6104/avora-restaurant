'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWishlist, WishlistItem } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import AddToCartButton from '@/components/AddToCartButton';
import ProductRatingBadge from '@/components/reviews/ProductRatingBadge';
import { toast } from 'react-hot-toast';
import {
  Heart,
  Bookmark,
  ChevronRight,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  Zap,
  Search,
  X,
  Grid2X2,
  List,
  CheckSquare,
  Square,
  Flame,
  Tag,
  Check,
  Star,
  Sparkles,
  ArrowUpDown,
  ChevronDown,
  ShoppingCart,
  RotateCcw,
  ArrowLeft,
  Calendar,
  Eye,
  MessageSquare,
  Share2,
  Newspaper,
  ArrowRight,
  ExternalLink,
  Lock,
  UserCheck,
  Clock,
  BookOpen
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type ActiveTab = 'dishes' | 'articles';
type ViewMode = 'grid' | 'list';
type DishSortOption = 'RECENT' | 'PRICE_ASC' | 'PRICE_DESC' | 'DISCOUNT_DESC' | 'NAME';
type ArticleSortOption = 'RECENT' | 'NEWEST_PUB' | 'MOST_VIEWED' | 'TITLE';
type DishFilterTag = 'ALL' | 'DISCOUNT' | 'FLASH_SALE';

export interface SavedArticleItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  thumbnailUrl?: string | null;
  coverImageUrl?: string | null;
  coverImage?: string | null;
  articleType?: string;
  type?: string;
  publishedAt?: string | null;
  savedAt?: string | null;
  viewCount?: number;
  reactionCount?: number;
  commentCount?: number;
  promotionStatus?: 'UPCOMING' | 'ONGOING' | 'ENDED' | null;
  author?: {
    fullName?: string;
    avatarUrl?: string;
  } | null;
}

const ARTICLE_TYPE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  ALL: { label: 'Tất cả bài viết', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' },
  PROMOTION: { label: 'Khuyến mãi', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  NEWS: { label: 'Tin tức', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  GUIDE: { label: 'Cẩm nang ẩm thực', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  EVENT: { label: 'Sự kiện', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  BRAND_STORY: { label: 'Câu chuyện thương hiệu', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  MENU_UPDATE: { label: 'Món mới', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
};

export default function FavoritesClient() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Tab: 'dishes' | 'articles'
  const initialTab = searchParams.get('tab') === 'articles' ? 'articles' : 'dishes';
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  // ═════════════════════════════════════════════════════════
  // DISHES (WISHLIST) CONTEXT & STATES
  // ═════════════════════════════════════════════════════════
  const {
    favorites,
    isLoaded: isWishlistLoaded,
    removeFromFavorites,
    removeMultipleFromFavorites,
    restoreFavorites,
    clearFavorites,
    favoritesCount,
    addToFavorites
  } = useWishlist();

  const { addToCart, currentBranchId } = useCart();

  // Dishes UI States
  const [dishViewMode, setDishViewMode] = useState<ViewMode>('grid');
  const [isDishSearchOpen, setIsDishSearchOpen] = useState(false);
  const [dishSearchQuery, setDishSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDishFilter, setSelectedDishFilter] = useState<DishFilterTag>('ALL');
  const [dishSortBy, setDishSortBy] = useState<DishSortOption>('RECENT');
  const [isDishSortDropdownOpen, setIsDishSortDropdownOpen] = useState(false);

  // Dishes Selection States
  const [isDishSelectMode, setIsDishSelectMode] = useState(false);
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([]);
  const [isClearDishesModalOpen, setIsClearDishesModalOpen] = useState(false);
  const [isAddingAllDishes, setIsAddingAllDishes] = useState(false);
  const [isAddingSelectedDishes, setIsAddingSelectedDishes] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);

  // ═════════════════════════════════════════════════════════
  // SAVED ARTICLES STATES
  // ═════════════════════════════════════════════════════════
  const [savedArticles, setSavedArticles] = useState<SavedArticleItem[]>([]);
  const [isArticlesLoaded, setIsArticlesLoaded] = useState(false);
  const [isArticlesLoading, setIsArticlesLoading] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);
  const [recommendedArticles, setRecommendedArticles] = useState<SavedArticleItem[]>([]);

  // Articles UI States
  const [articleViewMode, setArticleViewMode] = useState<ViewMode>('grid');
  const [isArticleSearchOpen, setIsArticleSearchOpen] = useState(false);
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [selectedArticleType, setSelectedArticleType] = useState<string>('ALL');
  const [articleSortBy, setArticleSortBy] = useState<ArticleSortOption>('RECENT');
  const [isArticleSortDropdownOpen, setIsArticleSortDropdownOpen] = useState(false);

  // Articles Selection States
  const [isArticleSelectMode, setIsArticleSelectMode] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [isClearArticlesModalOpen, setIsClearArticlesModalOpen] = useState(false);

  // Refs for outside clicks
  const dishSearchInputRef = useRef<HTMLInputElement>(null);
  const articleSearchInputRef = useRef<HTMLInputElement>(null);
  const dishSortDropdownRef = useRef<HTMLDivElement>(null);
  const articleSortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen to searchParams change
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'articles') {
      setActiveTab('articles');
    } else if (tabParam === 'dishes') {
      setActiveTab('dishes');
    }
  }, [searchParams]);

  // Tab switcher handler with smooth URL update
  const handleTabChange = (newTab: ActiveTab) => {
    setActiveTab(newTab);
    setIsDishSelectMode(false);
    setSelectedDishIds([]);
    setIsArticleSelectMode(false);
    setSelectedArticleIds([]);
    setIsDishSearchOpen(false);
    setIsArticleSearchOpen(false);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.replaceState(null, '', url.toString());
    }
  };

  // ═════════════════════════════════════════════════════════
  // DATA FETCHING: SAVED ARTICLES & RECOMMENDATIONS
  // ═════════════════════════════════════════════════════════
  const fetchSavedArticles = async () => {
    setIsArticlesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/articles/user/saved?limit=50`, {
        credentials: 'include',
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (res.status === 401 || res.status === 403) {
        setIsAuthError(true);
        setSavedArticles([]);
      } else if (res.ok) {
        setIsAuthError(false);
        const json = await res.json();
        const list = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.favorites)
          ? json.data.favorites
          : Array.isArray(json.favorites)
          ? json.favorites
          : Array.isArray(json)
          ? json
          : [];
        setSavedArticles(list);
      } else {
        setSavedArticles([]);
      }
    } catch (err) {
      console.error('Failed to fetch saved articles:', err);
    } finally {
      setIsArticlesLoaded(true);
      setIsArticlesLoading(false);
    }
  };

  // Fetch articles on mount
  useEffect(() => {
    fetchSavedArticles();
  }, []);

  // Fetch recommended products & articles for empty states
  useEffect(() => {
    const fetchRecs = async () => {
      try {
        const [dishesRes, articlesRes] = await Promise.allSettled([
          fetch(`${API_URL}/api/products/search/suggestions`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          }),
          fetch(`${API_URL}/api/articles?limit=4`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          })
        ]);

        if (dishesRes.status === 'fulfilled' && dishesRes.value.ok) {
          const dishData = await dishesRes.value.json();
          if (dishData?.hotDeals?.length > 0) {
            setRecommendedProducts(dishData.hotDeals);
          }
        }

        if (articlesRes.status === 'fulfilled' && articlesRes.value.ok) {
          const artData = await articlesRes.value.json();
          const artList = Array.isArray(artData.data) ? artData.data : Array.isArray(artData) ? artData : [];
          if (artList.length > 0) {
            setRecommendedArticles(artList.slice(0, 3));
          }
        }
      } catch {
        // Silent fallback
      }
    };
    fetchRecs();
  }, []);

  // Focus search inputs when toggled
  useEffect(() => {
    if (isDishSearchOpen && dishSearchInputRef.current) {
      dishSearchInputRef.current.focus();
    }
  }, [isDishSearchOpen]);

  useEffect(() => {
    if (isArticleSearchOpen && articleSearchInputRef.current) {
      articleSearchInputRef.current.focus();
    }
  }, [isArticleSearchOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dishSortDropdownRef.current && !dishSortDropdownRef.current.contains(e.target as Node)) {
        setIsDishSortDropdownOpen(false);
      }
      if (articleSortDropdownRef.current && !articleSortDropdownRef.current.contains(e.target as Node)) {
        setIsArticleSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ═════════════════════════════════════════════════════════
  // DISHES MEMOIZED LOGIC (Filters, Sorting, Stats)
  // ═════════════════════════════════════════════════════════
  const categoriesList = useMemo(() => {
    if (!mounted || favorites.length === 0) return [];
    const catMap = new Map<string, { name: string; count: number }>();
    favorites.forEach((item) => {
      const catName = item.category?.name || item.categoryName || 'Khác';
      const existing = catMap.get(catName);
      if (existing) {
        existing.count += 1;
      } else {
        catMap.set(catName, { name: catName, count: 1 });
      }
    });
    return Array.from(catMap.entries()).map(([name, val]) => ({
      name,
      count: val.count
    }));
  }, [favorites, mounted]);

  const { totalOriginalPrice, totalCurrentPrice, totalSavings } = useMemo(() => {
    if (!mounted || favorites.length === 0) {
      return { totalOriginalPrice: 0, totalCurrentPrice: 0, totalSavings: 0 };
    }
    let orig = 0;
    let curr = 0;
    favorites.forEach((item) => {
      const p = item.price || 0;
      const sale = item.flashSalePrice || item.discountedPrice || p;
      orig += p;
      curr += sale;
    });
    return {
      totalOriginalPrice: orig,
      totalCurrentPrice: curr,
      totalSavings: Math.max(0, orig - curr)
    };
  }, [favorites, mounted]);

  const filteredFavorites = useMemo(() => {
    if (!mounted) return [];
    let list = [...favorites];

    if (dishSearchQuery.trim()) {
      const q = dishSearchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.category?.name?.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'ALL') {
      list = list.filter(
        (item) => (item.category?.name || item.categoryName || 'Khác') === selectedCategory
      );
    }

    if (selectedDishFilter === 'DISCOUNT') {
      list = list.filter((item) => {
        const sale = item.flashSalePrice ?? item.discountedPrice;
        return typeof sale === 'number' && sale < item.price;
      });
    } else if (selectedDishFilter === 'FLASH_SALE') {
      list = list.filter((item) => !!item.flashSalePrice);
    }

    list.sort((a, b) => {
      const priceA = a.flashSalePrice || a.discountedPrice || a.price || 0;
      const priceB = b.flashSalePrice || b.discountedPrice || b.price || 0;
      const discountA = Math.max(0, (a.price || 0) - priceA);
      const discountB = Math.max(0, (b.price || 0) - priceB);

      switch (dishSortBy) {
        case 'PRICE_ASC':
          return priceA - priceB;
        case 'PRICE_DESC':
          return priceB - priceA;
        case 'DISCOUNT_DESC':
          return discountB - discountA;
        case 'NAME':
          return a.name.localeCompare(b.name, 'vi');
        case 'RECENT':
        default:
          return 0;
      }
    });

    return list;
  }, [favorites, dishSearchQuery, selectedCategory, selectedDishFilter, dishSortBy, mounted]);

  // ═════════════════════════════════════════════════════════
  // ARTICLES MEMOIZED LOGIC (Filters, Sorting, Stats)
  // ═════════════════════════════════════════════════════════
  const articleTypesList = useMemo(() => {
    if (!mounted || savedArticles.length === 0) return [];
    const typeMap = new Map<string, number>();
    savedArticles.forEach((item) => {
      const t = item.articleType || item.type || 'NEWS';
      typeMap.set(t, (typeMap.get(t) || 0) + 1);
    });

    return Array.from(typeMap.entries()).map(([typeKey, count]) => ({
      typeKey,
      config: ARTICLE_TYPE_CONFIG[typeKey] || { label: typeKey, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
      count
    }));
  }, [savedArticles, mounted]);

  const filteredArticles = useMemo(() => {
    if (!mounted) return [];
    let list = [...savedArticles];

    if (articleSearchQuery.trim()) {
      const q = articleSearchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.excerpt && item.excerpt.toLowerCase().includes(q)) ||
          (item.author?.fullName && item.author.fullName.toLowerCase().includes(q))
      );
    }

    if (selectedArticleType !== 'ALL') {
      list = list.filter(
        (item) => (item.articleType || item.type || 'NEWS') === selectedArticleType
      );
    }

    list.sort((a, b) => {
      switch (articleSortBy) {
        case 'NEWEST_PUB': {
          const dateA = new Date(a.publishedAt || 0).getTime();
          const dateB = new Date(b.publishedAt || 0).getTime();
          return dateB - dateA;
        }
        case 'MOST_VIEWED':
          return (b.viewCount || 0) - (a.viewCount || 0);
        case 'TITLE':
          return a.title.localeCompare(b.title, 'vi');
        case 'RECENT':
        default: {
          const dateA = new Date(a.savedAt || a.publishedAt || 0).getTime();
          const dateB = new Date(b.savedAt || b.publishedAt || 0).getTime();
          return dateB - dateA;
        }
      }
    });

    return list;
  }, [savedArticles, articleSearchQuery, selectedArticleType, articleSortBy, mounted]);

  // ═════════════════════════════════════════════════════════
  // DISH ACTION HANDLERS
  // ═════════════════════════════════════════════════════════
  const handleRemoveDish = (product: WishlistItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    removeFromFavorites(product.id, false);

    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-in fade-in slide-in-from-top-2' : 'animate-out fade-out slide-out-to-top-2'
          } max-w-sm w-full bg-slate-900 text-white shadow-2xl rounded-2xl p-3 flex items-center justify-between gap-3 border border-slate-700 pointer-events-auto`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-xs font-medium text-slate-200 truncate">
              Đã bỏ <strong className="text-white font-bold">{product.name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              restoreFavorites([product]);
              toast.success(`Đã khôi phục "${product.name}"`, { id: `restored-${product.id}` });
            }}
            className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Hoàn tác
          </button>
        </div>
      ),
      { duration: 4500, position: 'bottom-center' }
    );
  };

  const handleToggleSelectDish = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDishIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllDishes = () => {
    if (selectedDishIds.length === filteredFavorites.length) {
      setSelectedDishIds([]);
    } else {
      setSelectedDishIds(filteredFavorites.map((i) => i.id));
    }
  };

  const handleDeleteSelectedDishes = () => {
    if (selectedDishIds.length === 0) return;
    const itemsToUndo = favorites.filter((i) => selectedDishIds.includes(i.id));
    removeMultipleFromFavorites(selectedDishIds);
    setSelectedDishIds([]);
    setIsDishSelectMode(false);

    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-in fade-in slide-in-from-top-2' : 'animate-out fade-out slide-out-to-top-2'
          } max-w-sm w-full bg-slate-900 text-white shadow-2xl rounded-2xl p-3 flex items-center justify-between gap-3 border border-slate-700 pointer-events-auto`}
        >
          <p className="text-xs font-medium text-slate-200">
            Đã xóa <strong className="text-white font-bold">{itemsToUndo.length} món</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              restoreFavorites(itemsToUndo);
              toast.success(`Đã khôi phục ${itemsToUndo.length} món`, { id: 'restored-batch' });
            }}
            className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Hoàn tác
          </button>
        </div>
      ),
      { duration: 5000, position: 'bottom-center' }
    );
  };

  const convertWishlistToCartItem = (item: WishlistItem) => {
    const priceAtSale = item.flashSalePrice || item.discountedPrice || item.price;
    const originalPriceAtSale = item.price;
    return {
      id: item.id,
      productId: item.id,
      name: item.name,
      originalPriceAtSale,
      priceAtSale,
      quantity: 1,
      imageUrl: item.imageUrl || item.image,
      isFlashSaleItem: !!item.flashSalePrice,
      flashSaleId: item.flashSaleId,
      flashSaleStock: item.flashSaleStock,
      flashSaleSold: item.flashSaleSold,
      maxQuantityPerUser: item.maxQuantityPerUser,
      rawProduct: item
    };
  };

  const handleAddAllDishesToCart = () => {
    if (filteredFavorites.length === 0) return;
    setIsAddingAllDishes(true);
    let branch = currentBranchId;
    if (!branch && typeof window !== 'undefined') {
      branch = localStorage.getItem('selectedBranchId') || 'AVO-Q1';
    }

    filteredFavorites.forEach((item) => {
      const cartItem = convertWishlistToCartItem(item);
      addToCart(cartItem, branch || 'AVO-Q1', true);
    });

    setTimeout(() => {
      setIsAddingAllDishes(false);
      toast.success(`Đã thêm ${filteredFavorites.length} món vào giỏ hàng!`, {
        icon: '🛒',
        duration: 3500
      });
    }, 400);
  };

  const handleAddSelectedDishesToCart = () => {
    if (selectedDishIds.length === 0) return;
    setIsAddingSelectedDishes(true);
    let branch = currentBranchId;
    if (!branch && typeof window !== 'undefined') {
      branch = localStorage.getItem('selectedBranchId') || 'AVO-Q1';
    }

    const itemsToAdd = favorites.filter((i) => selectedDishIds.includes(i.id));
    itemsToAdd.forEach((item) => {
      const cartItem = convertWishlistToCartItem(item);
      addToCart(cartItem, branch || 'AVO-Q1', true);
    });

    setTimeout(() => {
      setIsAddingSelectedDishes(false);
      toast.success(`Đã thêm ${itemsToAdd.length} món đã chọn vào giỏ hàng!`, {
        icon: '🛒',
        duration: 3500
      });
      setIsDishSelectMode(false);
      setSelectedDishIds([]);
    }, 400);
  };

  // ═════════════════════════════════════════════════════════
  // ARTICLE ACTION HANDLERS
  // ═════════════════════════════════════════════════════════
  const handleRemoveArticle = async (article: SavedArticleItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Optimistic removal
    setSavedArticles((prev) => prev.filter((item) => item.id !== article.id));

    // Interactive Undo Toast
    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-in fade-in slide-in-from-top-2' : 'animate-out fade-out slide-out-to-top-2'
          } max-w-sm w-full bg-slate-900 text-white shadow-2xl rounded-2xl p-3 flex items-center justify-between gap-3 border border-slate-700 pointer-events-auto`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0">
              <Bookmark className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xs font-medium text-slate-200 truncate">
              Đã bỏ lưu <strong className="text-white font-bold">{article.title}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(t.id);
              // Restore in state
              setSavedArticles((prev) => [article, ...prev]);
              // Re-save on backend
              try {
                await fetch(`${API_URL}/api/articles/${article.id}/favorite`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                toast.success(`Đã khôi phục bài viết "${article.title}"`, { id: `restored-${article.id}` });
              } catch {
                fetchSavedArticles();
              }
            }}
            className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Hoàn tác
          </button>
        </div>
      ),
      { duration: 4500, position: 'bottom-center' }
    );

    // Call API in background
    try {
      const res = await fetch(`${API_URL}/api/articles/${article.id}/favorite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) {
        fetchSavedArticles();
      }
    } catch {
      fetchSavedArticles();
    }
  };

  const handleToggleSelectArticle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedArticleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllArticles = () => {
    if (selectedArticleIds.length === filteredArticles.length) {
      setSelectedArticleIds([]);
    } else {
      setSelectedArticleIds(filteredArticles.map((i) => i.id));
    }
  };

  const handleDeleteSelectedArticles = async () => {
    if (selectedArticleIds.length === 0) return;
    const itemsToUndo = savedArticles.filter((i) => selectedArticleIds.includes(i.id));

    // Optimistic removal
    setSavedArticles((prev) => prev.filter((i) => !selectedArticleIds.includes(i.id)));
    const count = selectedArticleIds.length;
    const idsToDelete = [...selectedArticleIds];
    setSelectedArticleIds([]);
    setIsArticleSelectMode(false);

    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-in fade-in slide-in-from-top-2' : 'animate-out fade-out slide-out-to-top-2'
          } max-w-sm w-full bg-slate-900 text-white shadow-2xl rounded-2xl p-3 flex items-center justify-between gap-3 border border-slate-700 pointer-events-auto`}
        >
          <p className="text-xs font-medium text-slate-200">
            Đã xóa <strong className="text-white font-bold">{count} bài viết</strong>
          </p>
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(t.id);
              setSavedArticles((prev) => [...itemsToUndo, ...prev]);
              // Restore each on backend
              for (const item of itemsToUndo) {
                await fetch(`${API_URL}/api/articles/${item.id}/favorite`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'ngrok-skip-browser-warning': 'true' }
                }).catch(() => {});
              }
              toast.success(`Đã khôi phục ${count} bài viết`, { id: 'restored-batch-art' });
            }}
            className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Hoàn tác
          </button>
        </div>
      ),
      { duration: 5000, position: 'bottom-center' }
    );

    // Call API for each in background
    for (const id of idsToDelete) {
      await fetch(`${API_URL}/api/articles/${id}/favorite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      }).catch(() => {});
    }
  };

  const handleShareArticle = (article: SavedArticleItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}/news/${article.slug}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
        toast.success('Đã sao chép liên kết bài viết!', {
          icon: '🔗',
          duration: 3000
        });
      } else {
        toast.success(shareUrl);
      }
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Mới đây';
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const getDishSortLabel = (sort: DishSortOption) => {
    switch (sort) {
      case 'PRICE_ASC':
        return 'Giá: Thấp → Cao';
      case 'PRICE_DESC':
        return 'Giá: Cao → Thấp';
      case 'DISCOUNT_DESC':
        return 'Tiết kiệm nhiều nhất';
      case 'NAME':
        return 'Tên món A → Z';
      case 'RECENT':
      default:
        return 'Mới lưu gần đây';
    }
  };

  const getArticleSortLabel = (sort: ArticleSortOption) => {
    switch (sort) {
      case 'NEWEST_PUB':
        return 'Ngày đăng mới nhất';
      case 'MOST_VIEWED':
        return 'Lượt xem nhiều nhất';
      case 'TITLE':
        return 'Tiêu đề A → Z';
      case 'RECENT':
      default:
        return 'Mới lưu gần đây';
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-800 font-sans pb-28">
      {/* ═════════════════════════════════════════════════════════
          STICKY TOP APP BAR (Dual-Tab Navigation + Quick Actions)
      ═════════════════════════════════════════════════════════ */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs sticky top-0 z-40 transition-all">
        <div className="max-w-6xl mx-auto px-3 sm:px-6">
          {/* Top Row: Navigation, Breadcrumb & Quick Controls */}
          <div className="h-12 sm:h-14 flex items-center justify-between gap-2">
            {/* Left: Back / Breadcrumb */}
            <div className="flex items-center gap-2 min-w-0">
              <Link
                href="/"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors sm:hidden shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                <Link href="/" className="hover:text-slate-900 transition-colors">
                  Trang chủ
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[#da251d] font-bold">
                  {activeTab === 'dishes' ? 'Món Ăn Yêu Thích' : 'Bài Viết Đã Lưu'}
                </span>
              </div>

              {/* Title on Mobile */}
              <div className="flex items-center gap-1.5 sm:hidden min-w-0">
                {activeTab === 'dishes' ? (
                  <Heart className="w-4 h-4 text-[#da251d] fill-[#da251d] shrink-0" />
                ) : (
                  <Bookmark className="w-4 h-4 text-rose-600 fill-rose-600 shrink-0" />
                )}
                <h1 className="text-sm font-black text-slate-900 truncate">
                  {activeTab === 'dishes' ? 'Món Yêu Thích' : 'Bài Viết Đã Lưu'}
                </h1>
              </div>
            </div>

            {/* Right: Quick Action Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Search Toggle */}
              {activeTab === 'dishes' ? (
                <button
                  type="button"
                  onClick={() => setIsDishSearchOpen(!isDishSearchOpen)}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    isDishSearchOpen || dishSearchQuery
                      ? 'bg-red-50 text-[#da251d]'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Tìm kiếm món ăn yêu thích"
                >
                  <Search className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsArticleSearchOpen(!isArticleSearchOpen)}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    isArticleSearchOpen || articleSearchQuery
                      ? 'bg-rose-50 text-rose-600'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Tìm kiếm bài viết đã lưu"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}

              {/* View Mode Switcher (Grid vs List) */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() =>
                    activeTab === 'dishes' ? setDishViewMode('grid') : setArticleViewMode('grid')
                  }
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    (activeTab === 'dishes' ? dishViewMode : articleViewMode) === 'grid'
                      ? 'bg-white text-[#da251d] shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Dạng lưới thẻ (Grid)"
                >
                  <Grid2X2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    activeTab === 'dishes' ? setDishViewMode('list') : setArticleViewMode('list')
                  }
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    (activeTab === 'dishes' ? dishViewMode : articleViewMode) === 'list'
                      ? 'bg-white text-[#da251d] shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Dạng danh sách chi tiết (List)"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Select Mode Toggle */}
              {activeTab === 'dishes' && mounted && favoritesCount > 1 && (
                <button
                  type="button"
                  onClick={() => setIsDishSelectMode(!isDishSelectMode)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isDishSelectMode
                      ? 'bg-[#da251d] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{isDishSelectMode ? 'Hủy chọn' : 'Chọn'}</span>
                </button>
              )}

              {activeTab === 'articles' && mounted && savedArticles.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsArticleSelectMode(!isArticleSelectMode)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isArticleSelectMode
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{isArticleSelectMode ? 'Hủy chọn' : 'Chọn'}</span>
                </button>
              )}

              {/* Quick Cart Button */}
              <Link
                href="/cart"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-[#da251d] text-xs font-bold transition-all shrink-0 border border-red-100"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Giỏ hàng</span>
              </Link>
            </div>
          </div>

          {/* ── LUXURY DUAL-TAB SWITCHER (SEGMENTED CONTROL) ── */}
          <div className="pb-3 pt-1">
            <div className="bg-slate-100/90 p-1 rounded-2xl flex items-center max-w-md mx-auto border border-slate-200/70 shadow-inner">
              {/* Tab 1: Món ăn yêu thích */}
              <button
                type="button"
                onClick={() => handleTabChange('dishes')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
                  activeTab === 'dishes'
                    ? 'bg-white text-[#da251d] shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Heart
                  className={`w-4 h-4 transition-colors ${
                    activeTab === 'dishes' ? 'text-[#da251d] fill-[#da251d]' : 'text-slate-400'
                  }`}
                />
                <span>Món ăn</span>
                {mounted && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black transition-all ${
                      activeTab === 'dishes'
                        ? 'bg-red-100 text-[#da251d]'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {favoritesCount}
                  </span>
                )}
              </button>

              {/* Tab 2: Bài viết đã lưu */}
              <button
                type="button"
                onClick={() => handleTabChange('articles')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
                  activeTab === 'articles'
                    ? 'bg-white text-rose-600 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 transition-colors ${
                    activeTab === 'articles' ? 'text-rose-600 fill-rose-600' : 'text-slate-400'
                  }`}
                />
                <span>Bài viết</span>
                {mounted && isArticlesLoaded && !isAuthError && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black transition-all ${
                      activeTab === 'articles'
                        ? 'bg-rose-100 text-rose-600'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {savedArticles.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Expandable Search Input Row */}
          {activeTab === 'dishes' && isDishSearchOpen && (
            <div className="pb-2.5 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  ref={dishSearchInputRef}
                  type="text"
                  placeholder="Tìm món theo tên, danh mục, nguyên liệu..."
                  value={dishSearchQuery}
                  onChange={(e) => setDishSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 focus:border-red-400 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-100 transition-all font-medium"
                />
                {dishSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDishSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'articles' && isArticleSearchOpen && (
            <div className="pb-2.5 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  ref={articleSearchInputRef}
                  type="text"
                  placeholder="Tìm bài viết theo tiêu đề, tác giả, nội dung..."
                  value={articleSearchQuery}
                  onChange={(e) => setArticleSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-100 transition-all font-medium"
                />
                {articleSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setArticleSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════
          MAIN CONTENT CONTAINER
      ═════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-3 sm:pt-6 space-y-4">
        {/* ═════════════════════════════════════════════════════════
            TAB 1: MÓN ĂN YÊU THÍCH (DISHES)
        ═════════════════════════════════════════════════════════ */}
        {activeTab === 'dishes' && (
          <>
            {!mounted || !isWishlistLoaded ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 border-3 border-[#da251d] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-500">Đang đồng bộ thực đơn yêu thích của bạn...</p>
              </div>
            ) : favorites.length === 0 ? (
              /* EMPTY STATE: DISHES */
              <div className="space-y-8 py-4 sm:py-8">
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 text-center shadow-2xs relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-red-100/50 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative z-10 space-y-4 max-w-md mx-auto">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-red-500/25 ring-8 ring-red-50">
                      <Heart className="w-10 h-10 fill-current animate-pulse" />
                    </div>

                    <div className="space-y-1.5">
                      <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                        Danh Sách Món Yêu Thích Trống
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                        Bạn chưa lưu món ăn nào. Khi khám phá Thực đơn hoặc Giờ Vàng Flash Sale, hãy nhấn biểu tượng{' '}
                        <Heart className="w-3.5 h-3.5 text-red-600 fill-red-600 inline-block align-middle mx-0.5" />{' '}
                        để lưu lại và đặt nhanh bất cứ lúc nào!
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-2">
                      <Link
                        href="/flash-sale"
                        className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-[#da251d] hover:from-red-700 hover:to-red-800 text-white text-xs font-black shadow-md shadow-red-600/20 active:scale-95 transition-all"
                      >
                        <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                        <span>Săn Flash Sale</span>
                      </Link>

                      <Link
                        href="/menu"
                        className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold active:scale-95 transition-all"
                      >
                        <UtensilsCrossed className="w-4 h-4 text-[#da251d]" />
                        <span>Xem Thực Đơn</span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Gợi ý món ngon */}
                {recommendedProducts.length > 0 && (
                  <div className="space-y-3.5 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900">Gợi Ý Món Ăn Bán Chạy</h3>
                          <p className="text-[11px] text-slate-400">Được thực khách Avora yêu thích nhất</p>
                        </div>
                      </div>
                      <Link href="/menu" className="text-xs font-bold text-[#da251d] hover:underline flex items-center gap-0.5">
                        Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {recommendedProducts.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="bg-white rounded-2xl border border-slate-200/80 p-2.5 flex flex-col justify-between shadow-2xs hover:shadow-md transition-all group relative overflow-hidden"
                        >
                          <div>
                            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 mb-2">
                              <img
                                src={item.imageUrl || item.image || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300'}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <button
                                type="button"
                                onClick={() => addToFavorites(item)}
                                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs text-slate-400 hover:text-red-600 flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                                title="Lưu vào yêu thích"
                              >
                                <Heart className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight group-hover:text-[#da251d] transition-colors">
                              {item.name}
                            </h4>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                            <span className="font-mono font-black text-xs text-[#da251d]">
                              {new Intl.NumberFormat('vi-VN').format(item.flashSalePrice || item.price)}đ
                            </span>
                            <AddToCartButton item={item} className="w-7 h-7 rounded-lg bg-[#da251d] text-white flex items-center justify-center hover:bg-red-700 shadow-xs cursor-pointer" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ACTIVE WISHLIST VIEW */
              <>
                {/* Top Summary Bar */}
                <div className="bg-gradient-to-br from-white via-white to-red-50/40 rounded-3xl border border-slate-200/90 p-3.5 sm:p-5 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <div className="bg-red-50 border border-red-100/80 rounded-2xl px-3 py-1.5 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-[#da251d] fill-[#da251d]" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block leading-none">Đã lưu</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                            {favorites.length} món
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-1.5 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block leading-none">Tổng giá trị</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 font-mono leading-tight">
                            {new Intl.NumberFormat('vi-VN').format(totalCurrentPrice)}đ
                          </span>
                        </div>
                      </div>

                      {totalSavings > 0 && (
                        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl px-3 py-1.5 flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
                          <div>
                            <span className="text-[10px] text-amber-700 font-bold block leading-none">Tiết kiệm</span>
                            <span className="text-xs sm:text-sm font-black text-amber-700 font-mono leading-tight">
                              -{new Intl.NumberFormat('vi-VN').format(totalSavings)}đ
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsClearDishesModalOpen(true)}
                        className="p-2.5 rounded-2xl bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-all text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                        title="Xóa tất cả danh sách món"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Xóa tất cả</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddAllDishesToCart}
                        disabled={isAddingAllDishes || filteredFavorites.length === 0}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-[#da251d] hover:bg-red-700 text-white text-xs sm:text-sm font-black shadow-md shadow-red-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isAddingAllDishes ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ShoppingCart className="w-4 h-4" />
                        )}
                        <span>Thêm tất cả vào Giỏ</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter Chips & Sort Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('ALL');
                        setSelectedDishFilter('ALL');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedCategory === 'ALL' && selectedDishFilter === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>Tất cả ({favorites.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedDishFilter(selectedDishFilter === 'DISCOUNT' ? 'ALL' : 'DISCOUNT')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                        selectedDishFilter === 'DISCOUNT'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-red-50 hover:text-red-600'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span>Giảm giá</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedDishFilter(selectedDishFilter === 'FLASH_SALE' ? 'ALL' : 'FLASH_SALE')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                        selectedDishFilter === 'FLASH_SALE'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span>Flash Sale</span>
                    </button>

                    {categoriesList.map((cat) => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setSelectedCategory(selectedCategory === cat.name ? 'ALL' : cat.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                          selectedCategory === cat.name
                            ? 'bg-[#da251d] text-white shadow-xs'
                            : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span className="text-[10px] opacity-70">({cat.count})</span>
                      </button>
                    ))}
                  </div>

                  {/* Sort Selector Dropdown */}
                  <div className="relative shrink-0 flex items-center justify-between sm:justify-end gap-2" ref={dishSortDropdownRef}>
                    <span className="text-[11px] text-slate-400 sm:hidden font-medium">
                      Hiển thị: {filteredFavorites.length}/{favorites.length} món
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsDishSortDropdownOpen(!isDishSortDropdownOpen)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      <span>{getDishSortLabel(dishSortBy)}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                          isDishSortDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isDishSortDropdownOpen && (
                      <div className="absolute top-full right-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        {[
                          { id: 'RECENT', label: 'Mới lưu gần đây' },
                          { id: 'PRICE_ASC', label: 'Giá: Thấp → Cao' },
                          { id: 'PRICE_DESC', label: 'Giá: Cao → Thấp' },
                          { id: 'DISCOUNT_DESC', label: 'Tiết kiệm nhiều nhất' },
                          { id: 'NAME', label: 'Tên món A → Z' }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setDishSortBy(opt.id as DishSortOption);
                              setIsDishSortDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                              dishSortBy === opt.id ? 'text-[#da251d] font-bold bg-red-50/60' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {dishSortBy === opt.id && <Check className="w-3.5 h-3.5 text-[#da251d]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selection Mode Info Bar */}
                {isDishSelectMode && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-2.5 px-3.5 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleSelectAllDishes}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        {selectedDishIds.length === filteredFavorites.length ? (
                          <CheckSquare className="w-4 h-4 text-[#da251d]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <span>{selectedDishIds.length === filteredFavorites.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
                      </button>
                      <span className="text-slate-300">|</span>
                      <span className="text-xs font-bold text-[#da251d]">
                        Đã chọn {selectedDishIds.length} món
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDishSelectMode(false)}
                      className="text-xs text-slate-500 font-bold hover:text-slate-800 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                )}

                {/* Empty filter results */}
                {filteredFavorites.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-6 space-y-3">
                    <Search className="w-10 h-10 text-slate-300 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-800">Không tìm thấy món nào phù hợp</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Hãy thử tìm kiếm với từ khóa khác hoặc bỏ các bộ lọc danh mục đang chọn.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDishSearchQuery('');
                        setSelectedCategory('ALL');
                        setSelectedDishFilter('ALL');
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                ) : dishViewMode === 'grid' ? (
                  /* DISHES GRID VIEW */
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    {filteredFavorites.map((product) => {
                      const displayPrice = product.flashSalePrice || product.discountedPrice || product.price;
                      const salePrice = product.flashSalePrice ?? product.discountedPrice;
                      const hasDiscount = typeof salePrice === 'number' && salePrice < product.price;
                      const discountPct = hasDiscount ? Math.round(((product.price - displayPrice) / product.price) * 100) : 0;
                      const isSelected = selectedDishIds.includes(product.id);
                      const linkUrl = product.category?.slug
                        ? `/${product.category.slug}/${product.slug || product.id}`
                        : `/menu`;

                      return (
                        <div
                          key={product.id}
                          onClick={(e) => {
                            if (isDishSelectMode) {
                              handleToggleSelectDish(product.id, e);
                            }
                          }}
                          className={`bg-white rounded-2xl sm:rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between group relative ${
                            isSelected
                              ? 'border-[#da251d] ring-2 ring-red-100 shadow-md'
                              : 'border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-red-200'
                          }`}
                        >
                          <div>
                            <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                              <img
                                src={product.imageUrl || product.image || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400'}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />

                              {isDishSelectMode ? (
                                <div className="absolute top-2 left-2 z-20">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-md transition-all ${
                                      isSelected
                                        ? 'bg-[#da251d] text-white'
                                        : 'bg-white/90 text-slate-400 border border-slate-300'
                                    }`}
                                  >
                                    {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleRemoveDish(product, e)}
                                  className="absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 text-red-600 shadow-md flex items-center justify-center hover:scale-110 active:scale-90 transition-all z-20 cursor-pointer group/btn"
                                  title="Bỏ khỏi yêu thích"
                                >
                                  <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-red-600 text-red-600 group-hover/btn:scale-110 transition-transform" />
                                </button>
                              )}

                              <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none z-10">
                                {product.flashSalePrice ? (
                                  <span className="bg-gradient-to-r from-red-600 to-amber-500 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5">
                                    <Zap className="w-2.5 h-2.5 text-yellow-200 fill-yellow-200" />
                                    -{discountPct}%
                                  </span>
                                ) : hasDiscount ? (
                                  <span className="bg-red-600 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                                    -{discountPct}%
                                  </span>
                                ) : null}
                              </div>

                              {product.category?.name && (
                                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-white/10 truncate max-w-[80%] z-10">
                                  {product.category.name}
                                </div>
                              )}
                            </div>

                            <div className="p-2.5 sm:p-3.5 space-y-1">
                              <Link href={linkUrl} className="block group/title">
                                <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 group-hover/title:text-[#da251d] transition-colors">
                                  {product.name}
                                </h3>
                              </Link>

                              <div className="flex items-baseline gap-1.5 pt-0.5">
                                <span className="text-xs sm:text-base font-black text-[#da251d] font-mono leading-tight">
                                  {new Intl.NumberFormat('vi-VN').format(displayPrice)}đ
                                </span>
                                {hasDiscount && (
                                  <span className="text-[10px] sm:text-xs text-slate-400 line-through font-mono">
                                    {new Intl.NumberFormat('vi-VN').format(product.price)}đ
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="p-2.5 sm:p-3.5 pt-0 border-t border-slate-100/80 mt-1 flex items-center justify-between gap-1">
                            <Link
                              href={linkUrl}
                              className="text-[11px] text-slate-400 hover:text-slate-700 font-bold hidden sm:flex items-center gap-0.5 transition-colors"
                            >
                              Chi tiết <ChevronRight className="w-3 h-3" />
                            </Link>

                            <div className="w-full sm:w-auto flex justify-end">
                              <AddToCartButton
                                item={product}
                                className="w-full sm:w-auto px-3 py-1.5 sm:py-2 bg-[#da251d] hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* DISHES LIST VIEW */
                  <div className="space-y-2.5 sm:space-y-3">
                    {filteredFavorites.map((product) => {
                      const displayPrice = product.flashSalePrice || product.discountedPrice || product.price;
                      const salePrice = product.flashSalePrice ?? product.discountedPrice;
                      const hasDiscount = typeof salePrice === 'number' && salePrice < product.price;
                      const discountPct = hasDiscount ? Math.round(((product.price - displayPrice) / product.price) * 100) : 0;
                      const isSelected = selectedDishIds.includes(product.id);
                      const linkUrl = product.category?.slug
                        ? `/${product.category.slug}/${product.slug || product.id}`
                        : `/menu`;

                      return (
                        <div
                          key={product.id}
                          onClick={(e) => {
                            if (isDishSelectMode) {
                              handleToggleSelectDish(product.id, e);
                            }
                          }}
                          className={`bg-white rounded-2xl sm:rounded-3xl border p-2.5 sm:p-3.5 flex items-center gap-3 transition-all duration-200 group ${
                            isSelected
                              ? 'border-[#da251d] ring-2 ring-red-100 shadow-md'
                              : 'border-slate-200/90 shadow-2xs hover:shadow-md hover:border-red-200'
                          }`}
                        >
                          {isDishSelectMode && (
                            <div className="shrink-0 pl-1">
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-xs transition-all ${
                                  isSelected
                                    ? 'bg-[#da251d] text-white'
                                    : 'bg-slate-100 text-slate-400 border border-slate-300'
                                }`}
                              >
                                {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                              </div>
                            </div>
                          )}

                          <Link href={linkUrl} className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                            <img
                              src={product.imageUrl || product.image || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300'}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {product.flashSalePrice ? (
                              <span className="absolute top-1.5 left-1.5 bg-gradient-to-r from-red-600 to-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs">
                                -{discountPct}%
                              </span>
                            ) : hasDiscount ? (
                              <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs">
                                -{discountPct}%
                              </span>
                            ) : null}
                          </Link>

                          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                {product.category?.name && (
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {product.category.name}
                                  </span>
                                )}
                                <ProductRatingBadge avgRating={product.avgRating} ratingCount={product.ratingCount} size="sm" />
                              </div>

                              <Link href={linkUrl} className="block group/title">
                                <h3 className="font-bold text-slate-900 text-xs sm:text-base leading-snug line-clamp-1 group-hover/title:text-[#da251d] transition-colors">
                                  {product.name}
                                </h3>
                              </Link>

                              {product.description && (
                                <p className="text-[11px] text-slate-400 line-clamp-1 hidden sm:block">
                                  {product.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1.5 mt-auto">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xs sm:text-base font-black text-[#da251d] font-mono leading-tight">
                                  {new Intl.NumberFormat('vi-VN').format(displayPrice)}đ
                                </span>
                                {hasDiscount && (
                                  <span className="text-[10px] sm:text-xs text-slate-400 line-through font-mono">
                                    {new Intl.NumberFormat('vi-VN').format(product.price)}đ
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {!isDishSelectMode && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleRemoveDish(product, e)}
                                    className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Bỏ khỏi yêu thích"
                                  >
                                    <Heart className="w-4 h-4 fill-red-600 text-red-600" />
                                  </button>
                                )}

                                <AddToCartButton
                                  item={product}
                                  className="px-3 py-1.5 bg-[#da251d] hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ═════════════════════════════════════════════════════════
            TAB 2: BÀI VIẾT ĐÃ LƯU (SAVED ARTICLES)
        ═════════════════════════════════════════════════════════ */}
        {activeTab === 'articles' && (
          <>
            {isArticlesLoading && !isArticlesLoaded ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-500">Đang tải các bài viết bạn đã lưu...</p>
              </div>
            ) : isAuthError ? (
              /* AUTH REQUIRED STATE */
              <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 text-center shadow-2xs relative overflow-hidden my-4">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-rose-100/40 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 max-w-md mx-auto space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-slate-900 to-slate-800 text-rose-400 flex items-center justify-center mx-auto shadow-xl ring-8 ring-slate-100">
                    <UserCheck className="w-10 h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      Đăng Nhập Để Xem Bài Viết Đã Lưu
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                      Các cẩm nang ẩm thực, câu chuyện và chương trình ưu đãi được đồng bộ theo tài khoản của bạn để dễ dàng tra cứu trên mọi thiết bị.
                    </p>
                  </div>
                  <div className="pt-3">
                    <Link
                      href="/login?redirect=/favorites?tab=articles"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-sm shadow-md shadow-red-600/25 active:scale-95 transition-all"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Đăng nhập tài khoản ngay</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : savedArticles.length === 0 ? (
              /* EMPTY STATE: SAVED ARTICLES */
              <div className="space-y-8 py-4 sm:py-8">
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 text-center shadow-2xs relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-rose-100/50 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative z-10 space-y-4 max-w-md mx-auto">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-rose-500/25 ring-8 ring-rose-50">
                      <Bookmark className="w-10 h-10 fill-current animate-pulse" />
                    </div>

                    <div className="space-y-1.5">
                      <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                        Chưa Có Bài Viết Nào Được Lưu
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                        Khi đọc các tin tức, ưu đãi hoặc cẩm nang ẩm thực tại AVORA, hãy bấm biểu tượng{' '}
                        <Bookmark className="w-3.5 h-3.5 text-rose-600 fill-rose-600 inline-block align-middle mx-0.5" />{' '}
                        để lưu lại vào hồ sơ và đọc lại bất kỳ lúc nào!
                      </p>
                    </div>

                    <div className="pt-2">
                      <Link
                        href="/news"
                        className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-red-600/25 active:scale-95 transition-all"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>Khám Phá Tin Tức & Cẩm Nang</span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Gợi ý bài viết hay */}
                {recommendedArticles.length > 0 && (
                  <div className="space-y-3.5 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900">Bài Viết Nổi Bật Dành Cho Bạn</h3>
                          <p className="text-[11px] text-slate-400">Được đọc nhiều nhất trong tuần</p>
                        </div>
                      </div>
                      <Link href="/news" className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-0.5">
                        Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {recommendedArticles.map((art) => (
                        <Link
                          key={art.id}
                          href={`/news/${art.slug}`}
                          className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col justify-between shadow-2xs hover:shadow-md hover:border-rose-300 transition-all group"
                        >
                          <div>
                            <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-100 mb-2.5">
                              <img
                                src={art.coverImageUrl || art.coverImage || art.thumbnailUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500'}
                                alt={art.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                            <h4 className="font-bold text-xs sm:text-sm text-slate-800 line-clamp-2 leading-snug group-hover:text-rose-600 transition-colors">
                              {art.title}
                            </h4>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(art.publishedAt)}
                            </span>
                            <span className="text-rose-600 font-bold flex items-center gap-0.5">
                              Đọc ngay <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ACTIVE SAVED ARTICLES VIEW */
              <>
                {/* Top Summary Banner */}
                <div className="bg-gradient-to-br from-white via-white to-rose-50/40 rounded-3xl border border-slate-200/90 p-3.5 sm:p-5 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <div className="bg-rose-50 border border-rose-100/80 rounded-2xl px-3 py-1.5 flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-rose-600 fill-rose-600" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block leading-none">Đã đánh dấu</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                            {savedArticles.length} bài viết
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-1.5 flex items-center gap-2">
                        <Newspaper className="w-4 h-4 text-blue-600" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block leading-none">Chuyên mục</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                            {articleTypesList.length} chủ đề
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href="/news"
                        className="px-3.5 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                        <span>Khám phá thêm</span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Filter Chips & Sort Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
                    <button
                      type="button"
                      onClick={() => setSelectedArticleType('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedArticleType === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>Tất cả ({savedArticles.length})</span>
                    </button>

                    {articleTypesList.map(({ typeKey, config, count }) => (
                      <button
                        key={typeKey}
                        type="button"
                        onClick={() => setSelectedArticleType(selectedArticleType === typeKey ? 'ALL' : typeKey)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedArticleType === typeKey
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                        }`}
                      >
                        <span>{config.label}</span>
                        <span className="text-[10px] opacity-70">({count})</span>
                      </button>
                    ))}
                  </div>

                  {/* Sort Selector Dropdown */}
                  <div className="relative shrink-0 flex items-center justify-between sm:justify-end gap-2" ref={articleSortDropdownRef}>
                    <span className="text-[11px] text-slate-400 sm:hidden font-medium">
                      Hiển thị: {filteredArticles.length}/{savedArticles.length} bài
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsArticleSortDropdownOpen(!isArticleSortDropdownOpen)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      <span>{getArticleSortLabel(articleSortBy)}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                          isArticleSortDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isArticleSortDropdownOpen && (
                      <div className="absolute top-full right-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        {[
                          { id: 'RECENT', label: 'Mới lưu gần đây' },
                          { id: 'NEWEST_PUB', label: 'Ngày đăng mới nhất' },
                          { id: 'MOST_VIEWED', label: 'Lượt xem nhiều nhất' },
                          { id: 'TITLE', label: 'Tiêu đề A → Z' }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setArticleSortBy(opt.id as ArticleSortOption);
                              setIsArticleSortDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                              articleSortBy === opt.id ? 'text-rose-600 font-bold bg-rose-50/60' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {articleSortBy === opt.id && <Check className="w-3.5 h-3.5 text-rose-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selection Mode Info Bar for Articles */}
                {isArticleSelectMode && (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-2.5 px-3.5 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleSelectAllArticles}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        {selectedArticleIds.length === filteredArticles.length ? (
                          <CheckSquare className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <span>{selectedArticleIds.length === filteredArticles.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
                      </button>
                      <span className="text-slate-300">|</span>
                      <span className="text-xs font-bold text-rose-600">
                        Đã chọn {selectedArticleIds.length} bài viết
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsArticleSelectMode(false)}
                      className="text-xs text-slate-500 font-bold hover:text-slate-800 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                )}

                {/* Empty filter results */}
                {filteredArticles.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-6 space-y-3">
                    <Search className="w-10 h-10 text-slate-300 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-800">Không tìm thấy bài viết nào phù hợp</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang chủ đề bài viết khác.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setArticleSearchQuery('');
                        setSelectedArticleType('ALL');
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                ) : articleViewMode === 'grid' ? (
                  /* ARTICLES MAGAZINE GRID VIEW */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {filteredArticles.map((article) => {
                      const type = article.articleType || article.type || 'NEWS';
                      const typeConfig = ARTICLE_TYPE_CONFIG[type] || ARTICLE_TYPE_CONFIG.NEWS;
                      const isSelected = selectedArticleIds.includes(article.id);
                      const imgUrl =
                        article.coverImageUrl ||
                        article.coverImage ||
                        article.thumbnailUrl ||
                        'https://images.unsplash.com/photo-1544025162-d76694265947?w=500';

                      return (
                        <div
                          key={article.id}
                          onClick={(e) => {
                            if (isArticleSelectMode) {
                              handleToggleSelectArticle(article.id, e);
                            }
                          }}
                          className={`bg-white rounded-2xl sm:rounded-3xl border overflow-hidden flex flex-col justify-between transition-all duration-200 group relative ${
                            isSelected
                              ? 'border-rose-500 ring-2 ring-rose-100 shadow-md'
                              : 'border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-rose-300'
                          }`}
                        >
                          <div>
                            {/* Thumbnail & Badges */}
                            <div className="relative aspect-16/10 w-full bg-slate-100 overflow-hidden">
                              <img
                                src={imgUrl}
                                alt={article.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

                              {/* Multi-select checkbox or Unsave heart */}
                              {isArticleSelectMode ? (
                                <div className="absolute top-2 left-2 z-20">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-md transition-all ${
                                      isSelected
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-white/90 text-slate-400 border border-slate-300'
                                    }`}
                                  >
                                    {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                                  </div>
                                </div>
                              ) : (
                                <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20">
                                  <button
                                    type="button"
                                    onClick={(e) => handleShareArticle(article, e)}
                                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 text-slate-600 hover:text-slate-900 shadow-md flex items-center justify-center hover:scale-110 active:scale-90 transition-all cursor-pointer"
                                    title="Chia sẻ bài viết"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => handleRemoveArticle(article, e)}
                                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 text-rose-600 shadow-md flex items-center justify-center hover:scale-110 active:scale-90 transition-all cursor-pointer group/bm"
                                    title="Bỏ lưu bài viết"
                                  >
                                    <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-rose-600 text-rose-600 group-hover/bm:scale-110 transition-transform" />
                                  </button>
                                </div>
                              )}

                              {/* Type badge on image */}
                              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs ${typeConfig.bg} ${typeConfig.text} border ${typeConfig.border}`}>
                                  {typeConfig.label}
                                </span>

                                {article.promotionStatus === 'ONGOING' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-white shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                    Đang diễn ra
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Card Content */}
                            <div className="p-3.5 sm:p-4 space-y-1.5">
                              <Link href={`/news/${article.slug}`} className="block group/title">
                                <h3 className="font-black text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 group-hover/title:text-rose-600 transition-colors">
                                  {article.title}
                                </h3>
                              </Link>

                              {article.excerpt && (
                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                  {article.excerpt}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Footer Info */}
                          <div className="p-3.5 sm:p-4 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center gap-1 font-medium text-[11px]">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatDate(article.publishedAt || article.savedAt)}
                            </span>

                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {(article.viewCount || 0).toLocaleString()}
                              </span>
                              <Link
                                href={`/news/${article.slug}`}
                                className="text-rose-600 font-bold hover:underline flex items-center gap-0.5 ml-1"
                              >
                                Đọc <ChevronRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ARTICLES LIST VIEW */
                  <div className="space-y-3">
                    {filteredArticles.map((article) => {
                      const type = article.articleType || article.type || 'NEWS';
                      const typeConfig = ARTICLE_TYPE_CONFIG[type] || ARTICLE_TYPE_CONFIG.NEWS;
                      const isSelected = selectedArticleIds.includes(article.id);
                      const imgUrl =
                        article.coverImageUrl ||
                        article.coverImage ||
                        article.thumbnailUrl ||
                        'https://images.unsplash.com/photo-1544025162-d76694265947?w=500';

                      return (
                        <div
                          key={article.id}
                          onClick={(e) => {
                            if (isArticleSelectMode) {
                              handleToggleSelectArticle(article.id, e);
                            }
                          }}
                          className={`bg-white rounded-2xl sm:rounded-3xl border p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between transition-all duration-200 group ${
                            isSelected
                              ? 'border-rose-500 ring-2 ring-rose-100 shadow-md'
                              : 'border-slate-200/90 shadow-2xs hover:shadow-md hover:border-rose-300'
                          }`}
                        >
                          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                            {isArticleSelectMode && (
                              <div className="shrink-0 pt-2">
                                <div
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-xs transition-all ${
                                    isSelected
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-slate-100 text-slate-400 border border-slate-300'
                                  }`}
                                >
                                  {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                                </div>
                              </div>
                            )}

                            {/* Thumbnail */}
                            <Link
                              href={`/news/${article.slug}`}
                              className="sm:w-44 aspect-16/10 sm:aspect-4/3 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative"
                            >
                              <img
                                src={imgUrl}
                                alt={article.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            </Link>

                            {/* Details */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${typeConfig.bg} ${typeConfig.text} border ${typeConfig.border}`}>
                                    {typeConfig.label}
                                  </span>
                                  {article.promotionStatus === 'ONGOING' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      Đang diễn ra
                                    </span>
                                  )}
                                </div>

                                <Link href={`/news/${article.slug}`} className="block group/title">
                                  <h3 className="font-black text-xs sm:text-sm text-slate-900 group-hover/title:text-rose-600 transition-colors line-clamp-2 leading-snug">
                                    {article.title}
                                  </h3>
                                </Link>

                                {article.excerpt && (
                                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed hidden sm:block">
                                    {article.excerpt}
                                  </p>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(article.publishedAt || article.savedAt)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {(article.viewCount || 0).toLocaleString()}
                                </span>
                                {article.author?.fullName && (
                                  <span className="font-medium text-slate-600 hidden sm:inline">
                                    Bởi {article.author.fullName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          {!isArticleSelectMode && (
                            <div className="flex sm:flex-col justify-end items-center gap-1 sm:border-l sm:border-slate-100 sm:pl-3 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => handleShareArticle(article, e)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Chia sẻ liên kết"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveArticle(article, e)}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Bỏ lưu bài viết"
                              >
                                <Bookmark className="w-4 h-4 fill-rose-500 text-rose-500" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════
          FLOATING BOTTOM ACTION BAR: DISH MULTI-SELECT
      ═════════════════════════════════════════════════════════ */}
      {activeTab === 'dishes' && isDishSelectMode && selectedDishIds.length > 0 && (
        <div className="fixed bottom-16 md:bottom-6 left-0 right-0 z-50 px-3 max-w-lg mx-auto animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-3xl p-3.5 shadow-2xl border border-slate-700 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Đang chọn {selectedDishIds.length} món</span>
              <span className="text-sm font-black text-amber-400 font-mono">
                {new Intl.NumberFormat('vi-VN').format(
                  favorites
                    .filter((i) => selectedDishIds.includes(i.id))
                    .reduce((acc, curr) => acc + (curr.flashSalePrice || curr.discountedPrice || curr.price || 0), 0)
                )}
                đ
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteSelectedDishes}
                className="px-3 py-2 bg-white/10 hover:bg-red-600/30 text-red-300 hover:text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>

              <button
                type="button"
                onClick={handleAddSelectedDishesToCart}
                disabled={isAddingSelectedDishes}
                className="px-4 py-2 bg-[#da251d] hover:bg-red-700 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-red-600/30 flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isAddingSelectedDishes ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ShoppingCart className="w-3.5 h-3.5" />
                )}
                <span>Thêm vào Giỏ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
          FLOATING BOTTOM ACTION BAR: ARTICLE MULTI-SELECT
      ═════════════════════════════════════════════════════════ */}
      {activeTab === 'articles' && isArticleSelectMode && selectedArticleIds.length > 0 && (
        <div className="fixed bottom-16 md:bottom-6 left-0 right-0 z-50 px-3 max-w-lg mx-auto animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-3xl p-3.5 shadow-2xl border border-slate-700 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Đang chọn</span>
              <span className="text-sm font-black text-rose-400">
                {selectedArticleIds.length} bài viết
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteSelectedArticles}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bỏ lưu đã chọn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
          CLEAR ALL DISHES CONFIRMATION MODAL
      ═════════════════════════════════════════════════════════ */}
      {isClearDishesModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsClearDishesModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-[#da251d] flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">Xóa toàn bộ món yêu thích?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tất cả <strong className="text-slate-800">{favorites.length} món ăn</strong> bạn đã lưu sẽ được gỡ khỏi danh sách yêu thích.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearDishesModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Giữ lại
              </button>
              <button
                type="button"
                onClick={() => {
                  clearFavorites();
                  setIsClearDishesModalOpen(false);
                }}
                className="py-2.5 px-4 rounded-xl bg-[#da251d] hover:bg-red-700 text-white text-xs font-black transition-all shadow-md shadow-red-600/20 cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
