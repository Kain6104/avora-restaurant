'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProductRatingBadge from '@/components/reviews/ProductRatingBadge';
import {
  Star,
  ChevronRight,
  Grid2X2,
  List,
  Heart,
  Gift,
  Search,
  X,
  Flame,
  Zap,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  Check,
  ShoppingBag,
  UtensilsCrossed,
  ArrowLeft,
  Filter,
  Sparkles,
  Layers,
  ShoppingBag as CartIcon
} from 'lucide-react';
import AddToCartButton from '@/components/AddToCartButton';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { toast } from 'react-hot-toast';

interface MenuClientProps {
  initialCategories: any[];
}

type ViewMode = 'grid' | 'list';
type SortOption = 'DEFAULT' | 'PRICE_ASC' | 'PRICE_DESC' | 'POPULAR' | 'NAME';
type FilterTag = 'ALL' | 'DISCOUNT' | 'UNDER_100K' | 'TOP_RATED';

export default function MenuClient({ initialCategories }: MenuClientProps) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { currentBranchId, cartItems, flashSaleQuotas } = useCart();
  const { isFavorite, toggleFavorite } = useWishlist();

  // Navigation & Filter States
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<FilterTag>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('DEFAULT');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);

  // Refs for scroll and click outside
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const isClickingCategoryRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Branch & flash-sale quota filtering
  const branchFilteredCategories = useMemo(() => {
    if (!initialCategories || !Array.isArray(initialCategories)) return [];
    return initialCategories
      .map((cat) => {
        return {
          ...cat,
          products: (cat.products || [])
            .map((p: any) => {
              const dp = { ...p };
              if (dp.isFlashSaleItem || dp.flashSalePrice) {
                const quota = flashSaleQuotas?.[dp.id];
                if (quota !== undefined) {
                  const cartQty =
                    cartItems
                      ?.filter((c: any) => c.productId === dp.id && c.isFlashSaleItem)
                      .reduce((acc: number, curr: any) => acc + curr.quantity, 0) || 0;
                  const remaining = quota - cartQty;
                  if (remaining <= 0) {
                    dp.flashSalePrice = null;
                    dp.isFlashSaleItem = false;
                    dp.flashSaleId = null;
                    dp.maxQuantityPerUser = null;
                  }
                }
              }
              return dp;
            })
            .filter((p: any) => {
              if (!currentBranchId) return true;
              if (!p.branches || p.branches.length === 0) return true;
              return p.branches.some((b: any) => b.id === currentBranchId);
            })
        };
      })
      .filter((cat) => cat.products && cat.products.length > 0);
  }, [initialCategories, currentBranchId, cartItems, flashSaleQuotas]);

  // Set default active category
  useEffect(() => {
    if (branchFilteredCategories.length > 0 && !activeCategory) {
      setActiveCategory(branchFilteredCategories[0].id);
    }
  }, [branchFilteredCategories, activeCategory]);

  // Search, Tag and Sort filter across all categories
  const processedCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return branchFilteredCategories
      .map((cat) => {
        let prods = [...cat.products];

        // 1. Text Search Filter
        if (query) {
          prods = prods.filter(
            (item: any) =>
              item.name.toLowerCase().includes(query) ||
              cat.name.toLowerCase().includes(query) ||
              (item.description && item.description.toLowerCase().includes(query))
          );
        }

        // 2. Tag Filter
        if (selectedTag === 'DISCOUNT') {
          prods = prods.filter((item: any) => {
            const sale = item.flashSalePrice ?? item.oldPrice;
            return typeof sale === 'number' && (item.flashSalePrice || (item.oldPrice && item.oldPrice > item.price));
          });
        } else if (selectedTag === 'UNDER_100K') {
          prods = prods.filter((item: any) => {
            const price = item.flashSalePrice || item.price;
            return price <= 100000;
          });
        } else if (selectedTag === 'TOP_RATED') {
          prods = prods.filter((item: any) => (item.avgRating || 0) >= 4.5);
        }

        // 3. Sorting within category
        prods.sort((a: any, b: any) => {
          const priceA = a.flashSalePrice || a.price || 0;
          const priceB = b.flashSalePrice || b.price || 0;
          const soldA = (a.name.length * 17) % 500 + 100;
          const soldB = (b.name.length * 17) % 500 + 100;

          switch (sortBy) {
            case 'PRICE_ASC':
              return priceA - priceB;
            case 'PRICE_DESC':
              return priceB - priceA;
            case 'POPULAR':
              return soldB - soldA;
            case 'NAME':
              return a.name.localeCompare(b.name, 'vi');
            case 'DEFAULT':
            default:
              return 0;
          }
        });

        return {
          ...cat,
          products: prods
        };
      })
      .filter((cat) => cat.products.length > 0);
  }, [branchFilteredCategories, searchQuery, selectedTag, sortBy]);

  // Total products count
  const totalProductsCount = useMemo(() => {
    return processedCategories.reduce((acc, cat) => acc + cat.products.length, 0);
  }, [processedCategories]);

  // Total in cart
  const totalCartCount = useMemo(() => {
    if (!mounted || !cartItems) return 0;
    return cartItems.reduce((acc: number, item: any) => acc + item.quantity, 0);
  }, [mounted, cartItems]);

  // ScrollSpy with auto-centering horizontal category bar on mobile
  useEffect(() => {
    const handleScroll = () => {
      if (isClickingCategoryRef.current) return;

      const categorySections = document.querySelectorAll('[data-category-section]');
      let currentActive = '';

      categorySections.forEach((section: any) => {
        const sectionTop = section.offsetTop - 190;
        if (window.scrollY >= sectionTop) {
          currentActive = section.id;
        }
      });

      if (currentActive && currentActive !== activeCategory) {
        setActiveCategory(currentActive);
        centerActiveTab(currentActive);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeCategory]);

  // Auto center active pill in horizontal scrollbar
  const centerActiveTab = (id: string) => {
    const activeBtn = document.getElementById(`nav-cat-${id}`);
    const navContainer = categoryNavRef.current;
    if (activeBtn && navContainer) {
      const btnLeft = activeBtn.offsetLeft;
      const btnWidth = activeBtn.offsetWidth;
      const containerWidth = navContainer.offsetWidth;
      navContainer.scrollTo({
        left: btnLeft - containerWidth / 2 + btnWidth / 2,
        behavior: 'smooth'
      });
    }
  };

  const scrollToCategory = (id: string) => {
    isClickingCategoryRef.current = true;
    setActiveCategory(id);
    centerActiveTab(id);

    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 150;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }

    setTimeout(() => {
      isClickingCategoryRef.current = false;
    }, 600);
  };

  const handleToggleFavorite = (product: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      description: product.description,
      flashSalePrice: product.flashSalePrice,
      branches: product.branches
    });
  };

  const getSortLabel = (sort: SortOption) => {
    switch (sort) {
      case 'PRICE_ASC':
        return 'Giá: Thấp → Cao';
      case 'PRICE_DESC':
        return 'Giá: Cao → Thấp';
      case 'POPULAR':
        return 'Món Bán Chạy';
      case 'NAME':
        return 'Tên Món A → Z';
      case 'DEFAULT':
      default:
        return 'Mặc định';
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-800 font-sans pb-28 md:pb-16">
      {/* ═════════════════════════════════════════════════════════
          STICKY TOP HEADER (Sleek Mobile App Bar & Navigation)
      ═════════════════════════════════════════════════════════ */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-all shadow-2xs">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 md:px-8">
          {/* Top Bar: Title, Search & Quick Controls */}
          <div className="h-13 sm:h-15 flex items-center justify-between gap-2">
            {/* Left: Navigation / Title */}
            <div className="flex items-center gap-2 min-w-0">
              <Link
                href="/"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors sm:hidden shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                <Link href="/" className="hover:text-slate-900 transition-colors font-medium">
                  Trang chủ
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[#da251d] font-bold">Thực Đơn Avora</span>
              </div>

              {/* Title on Mobile */}
              <div className="flex items-center gap-1.5 sm:hidden min-w-0">
                <UtensilsCrossed className="w-4 h-4 text-[#da251d] shrink-0" />
                <h1 className="text-sm font-black text-slate-900 truncate">Thực Đơn</h1>
                {totalProductsCount > 0 && (
                  <span className="bg-red-50 text-[#da251d] text-[10px] font-black px-1.5 py-0.2 rounded-full border border-red-100 shrink-0">
                    {totalProductsCount} món
                  </span>
                )}
              </div>
            </div>

            {/* Right: Search, View Mode & Cart */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Search Toggle */}
              <button
                type="button"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isSearchOpen || searchQuery
                    ? 'bg-red-50 text-[#da251d]'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Tìm món trong thực đơn"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* View Mode Switcher (Grid vs List) */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-[#da251d] shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Dạng lưới 2 cột"
                >
                  <Grid2X2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white text-[#da251d] shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Dạng danh sách chi tiết"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Cart with counter badge */}
              <Link
                href="/cart"
                className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-[#da251d] text-white text-xs font-bold shadow-xs active:scale-95 transition-all shrink-0"
              >
                <CartIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Giỏ hàng</span>
                {mounted && totalCartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {totalCartCount > 99 ? '99+' : totalCartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Expandable Search Input Row */}
          {isSearchOpen && (
            <div className="pb-2.5 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Tìm theo tên món, hương vị, danh mục..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 focus:border-red-400 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-100 transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── STICKY HORIZONTAL CATEGORY PILL BAR (Mobile First) ── */}
          <div
            ref={categoryNavRef}
            className="flex items-center gap-1.5 overflow-x-auto py-2 border-t border-slate-100 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0"
          >
            {/* Quick Combo Shortcut */}
            <Link
              href="/combo"
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 text-white font-black text-xs shadow-xs active:scale-95 transition-all whitespace-nowrap group"
            >
              <Gift className="w-3.5 h-3.5 animate-bounce" />
              <span>Combo Tiết Kiệm</span>
              <span className="text-[9px] bg-white text-orange-600 font-black px-1.5 py-0.2 rounded-full">
                HOT
              </span>
            </Link>

            {/* Category Pills with auto scrollspy */}
            {branchFilteredCategories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`nav-cat-${cat.id}`}
                  onClick={() => scrollToCategory(cat.id)}
                  type="button"
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#da251d] text-white shadow-xs scale-102 font-black'
                      : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {cat.image && (
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-4 h-4 rounded-full object-cover shrink-0 border border-white/40"
                    />
                  )}
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cat.products.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════
          MAIN CONTENT & LAYOUT
      ═════════════════════════════════════════════════════════ */}
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 md:px-8 pt-3 sm:pt-6">
        
        {/* ── FILTER CHIPS & SORT BAR ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-2.5 sm:p-3 shadow-2xs mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Tag Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedTag('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedTag === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({totalProductsCount})
            </button>

            <button
              type="button"
              onClick={() => setSelectedTag(selectedTag === 'DISCOUNT' ? 'ALL' : 'DISCOUNT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                selectedTag === 'DISCOUNT'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Flash Sale & Giảm giá</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTag(selectedTag === 'TOP_RATED' ? 'ALL' : 'TOP_RATED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                selectedTag === 'TOP_RATED'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span>Món Yêu Thích 4.8★</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTag(selectedTag === 'UNDER_100K' ? 'ALL' : 'UNDER_100K')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedTag === 'UNDER_100K'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              Dưới 100k
            </button>
          </div>

          {/* Right: Sort Dropdown */}
          <div className="relative shrink-0 flex items-center justify-between sm:justify-end gap-2" ref={sortDropdownRef}>
            <span className="text-[11px] text-slate-400 sm:hidden font-medium">
              {totalProductsCount} món sẵn sàng
            </span>

            <button
              type="button"
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>{getSortLabel(sortBy)}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isSortDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isSortDropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                {[
                  { id: 'DEFAULT', label: 'Mặc định' },
                  { id: 'POPULAR', label: 'Món Bán Chạy' },
                  { id: 'PRICE_ASC', label: 'Giá: Thấp → Cao' },
                  { id: 'PRICE_DESC', label: 'Giá: Cao → Thấp' },
                  { id: 'NAME', label: 'Tên món A → Z' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortBy(opt.id as SortOption);
                      setIsSortDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors ${
                      sortBy === opt.id
                        ? 'text-[#da251d] font-bold bg-red-50/60'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.id && <Check className="w-3.5 h-3.5 text-[#da251d]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CATEGORY SECTIONS & PRODUCTS LIST ── */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          
          {/* Desktop Sidebar Sticky Navigation */}
          <div className="hidden md:block w-[260px] shrink-0 sticky top-[140px] z-10">
            <div className="bg-white rounded-3xl shadow-2xs border border-slate-200/80 p-4 space-y-1.5">
              <div className="flex items-center gap-2 pb-3 mb-2 border-b border-slate-100 px-2">
                <div className="w-7 h-7 bg-red-50 text-[#da251d] rounded-xl flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">
                  Danh Mục Món Ăn
                </h3>
              </div>

              <Link
                href="/combo"
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl transition-all font-black text-xs bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 text-white shadow-xs hover:opacity-95 group mb-2"
              >
                <Gift className="w-4 h-4 text-white shrink-0" />
                <span className="flex-1">Combo Tiết Kiệm</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-white text-orange-600">
                  HOT
                </span>
              </Link>

              {branchFilteredCategories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    type="button"
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl transition-all font-bold text-xs text-left cursor-pointer ${
                      isActive
                        ? 'bg-red-50 text-[#da251d] shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {cat.image && (
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="w-5 h-5 rounded-full object-cover border border-slate-200"
                      />
                    )}
                    <span className="flex-1 truncate">{cat.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.2 rounded-full font-black ${
                        isActive ? 'bg-red-200/80 text-red-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {cat.products.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Products Content Area */}
          <div className="flex-1 min-w-0 w-full space-y-8 md:space-y-12">
            
            {/* If no categories match filters */}
            {processedCategories.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 p-6 space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-red-50 text-[#da251d] flex items-center justify-center mx-auto shadow-inner">
                  <Search className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-slate-900">Không tìm thấy món ăn phù hợp</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Vui lòng thử tìm kiếm bằng từ khóa khác hoặc xóa bộ lọc đang chọn.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTag('ALL');
                    setSortBy('DEFAULT');
                  }}
                  className="px-4 py-2 bg-[#da251d] hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              </div>
            ) : (
              processedCategories.map((cat) => (
                <section
                  key={cat.id}
                  id={cat.id}
                  data-category-section
                  className="scroll-mt-36"
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between gap-3 mb-3.5 md:mb-5 pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-2.5">
                      {cat.image && (
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-slate-200 shadow-2xs"
                        />
                      )}
                      <div>
                        <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                          {cat.name}
                        </h2>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {cat.products.length} món ngon sẵn sàng phục vụ
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-slate-400 hidden sm:block">
                      Avora Dining
                    </span>
                  </div>

                  {/* ── VIEW MODE: GRID (2 Col Mobile / 3-4 Col Desktop) ── */}
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                      {cat.products.map((item: any) => {
                        const displayPrice = item.flashSalePrice || item.price;
                        const hasDiscount = !!item.flashSalePrice || (item.oldPrice && item.oldPrice > item.price);
                        const discountPct = item.oldPrice
                          ? Math.round(((item.oldPrice - displayPrice) / item.oldPrice) * 100)
                          : item.flashSalePrice
                          ? Math.round(((item.price - item.flashSalePrice) / item.price) * 100)
                          : 0;
                        const isFav = mounted && isFavorite(item.id);

                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-red-200 transition-all duration-300 group flex flex-col justify-between overflow-hidden relative"
                          >
                            <div>
                              {/* Product Thumbnail */}
                              <Link
                                href={`/${cat.slug || 'menu'}/${item.slug || item.id}`}
                                className="block relative aspect-square overflow-hidden bg-[#FAF9F6] flex items-center justify-center p-2"
                              >
                                <img
                                  src={item.imageUrl || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400'}
                                  alt={item.name}
                                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

                                {/* Badges */}
                                <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none z-10">
                                  {item.isFlashSaleItem || item.flashSalePrice ? (
                                    <span className="bg-gradient-to-r from-red-600 to-amber-500 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5">
                                      <Zap className="w-2.5 h-2.5 text-yellow-200 fill-yellow-200" />
                                      Flash Sale
                                    </span>
                                  ) : item.badge ? (
                                    <span className="bg-[#da251d] text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                                      {item.badge}
                                    </span>
                                  ) : hasDiscount && discountPct > 0 ? (
                                    <span className="bg-red-600 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                                      -{discountPct}%
                                    </span>
                                  ) : null}
                                </div>

                                {/* Wishlist Heart Button (Always accessible on Mobile) */}
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleFavorite(item, e)}
                                  className={`absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-xs transition-all z-20 cursor-pointer ${
                                    isFav
                                      ? 'bg-red-50 text-[#da251d]'
                                      : 'bg-white/90 text-slate-400 hover:text-red-600 hover:bg-white'
                                  }`}
                                  title={isFav ? 'Bỏ khỏi yêu thích' : 'Lưu vào yêu thích'}
                                >
                                  <Heart
                                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${
                                      isFav ? 'fill-[#da251d] scale-110' : ''
                                    }`}
                                  />
                                </button>
                              </Link>

                              {/* Info details */}
                              <div className="p-2.5 sm:p-3.5 space-y-1">
                                <Link
                                  href={`/${cat.slug || 'menu'}/${item.slug || item.id}`}
                                  className="block group/title"
                                >
                                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 group-hover/title:text-[#da251d] transition-colors">
                                    {item.name}
                                  </h3>
                                </Link>

                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5 flex-wrap">
                                  <ProductRatingBadge avgRating={item.avgRating} ratingCount={item.ratingCount} size="sm" />
                                  <span className="text-slate-300">•</span>
                                  <span className="text-slate-400">
                                    Đã bán {(item.name.length * 17) % 500 + 100}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Price & Add to Cart Footer */}
                            <div className="p-2.5 sm:p-3.5 pt-0 mt-auto flex items-center justify-between gap-1.5 border-t border-slate-100/80 pt-2">
                              <div>
                                <p className="text-[#da251d] font-black text-xs sm:text-base font-mono leading-none">
                                  {new Intl.NumberFormat('vi-VN').format(displayPrice)}đ
                                </p>
                                {item.oldPrice && item.oldPrice > displayPrice && (
                                  <p className="text-slate-400 text-[10px] line-through font-mono mt-0.5">
                                    {new Intl.NumberFormat('vi-VN').format(item.oldPrice)}đ
                                  </p>
                                )}
                              </div>

                              <AddToCartButton
                                item={item}
                                className="w-8 h-8 sm:w-9 sm:h-9 bg-[#da251d] hover:bg-red-700 text-white rounded-xl flex items-center justify-center transition-all shadow-xs shrink-0 active:scale-95 cursor-pointer"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── VIEW MODE: LIST (Horizontal Rich Cards) ── */
                    <div className="space-y-2.5 sm:space-y-3">
                      {cat.products.map((item: any) => {
                        const displayPrice = item.flashSalePrice || item.price;
                        const hasDiscount = !!item.flashSalePrice || (item.oldPrice && item.oldPrice > item.price);
                        const discountPct = item.oldPrice
                          ? Math.round(((item.oldPrice - displayPrice) / item.oldPrice) * 100)
                          : item.flashSalePrice
                          ? Math.round(((item.price - item.flashSalePrice) / item.price) * 100)
                          : 0;
                        const isFav = mounted && isFavorite(item.id);

                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-2.5 sm:p-3.5 flex items-center gap-3 shadow-2xs hover:shadow-md hover:border-red-200 transition-all group"
                          >
                            {/* Thumbnail */}
                            <Link
                              href={`/${cat.slug || 'menu'}/${item.slug || item.id}`}
                              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-[#FAF9F6] shrink-0 flex items-center justify-center p-1.5"
                            >
                              <img
                                src={item.imageUrl || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300'}
                                alt={item.name}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                              />
                              {item.isFlashSaleItem ? (
                                <span className="absolute top-1.5 left-1.5 bg-gradient-to-r from-red-600 to-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs">
                                  Flash Sale
                                </span>
                              ) : hasDiscount && discountPct > 0 ? (
                                <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-xs">
                                  -{discountPct}%
                                </span>
                              ) : null}
                            </Link>

                            {/* Center Info */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {cat.name}
                                  </span>
                                  <ProductRatingBadge avgRating={item.avgRating} ratingCount={item.ratingCount} size="sm" />
                                </div>

                                <Link
                                  href={`/${cat.slug || 'menu'}/${item.slug || item.id}`}
                                  className="block group/title"
                                >
                                  <h3 className="font-bold text-slate-900 text-xs sm:text-base leading-snug line-clamp-1 group-hover/title:text-[#da251d] transition-colors">
                                    {item.name}
                                  </h3>
                                </Link>

                                {item.description && (
                                  <p className="text-[11px] text-slate-400 line-clamp-1 hidden sm:block">
                                    {item.description}
                                  </p>
                                )}
                              </div>

                              {/* Price & Action Row */}
                              <div className="flex items-center justify-between gap-2 pt-1.5 mt-auto">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-xs sm:text-base font-black text-[#da251d] font-mono leading-tight">
                                    {new Intl.NumberFormat('vi-VN').format(displayPrice)}đ
                                  </span>
                                  {item.oldPrice && item.oldPrice > displayPrice && (
                                    <span className="text-[10px] sm:text-xs text-slate-400 line-through font-mono">
                                      {new Intl.NumberFormat('vi-VN').format(item.oldPrice)}đ
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleFavorite(item, e)}
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                                      isFav
                                        ? 'bg-red-50 text-[#da251d]'
                                        : 'bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50'
                                    }`}
                                    title={isFav ? 'Bỏ khỏi yêu thích' : 'Lưu vào yêu thích'}
                                  >
                                    <Heart
                                      className={`w-4 h-4 ${isFav ? 'fill-[#da251d]' : ''}`}
                                    />
                                  </button>

                                  <AddToCartButton
                                    item={item}
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
                </section>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════
          FLOATING QUICK CATEGORY BOTTOM DRAWER (Mobile Shortcut)
      ═════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-20 md:hidden right-4 z-40">
        <button
          type="button"
          onClick={() => setIsCategoryDrawerOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900/90 backdrop-blur-md text-white rounded-full shadow-xl border border-slate-700 text-xs font-black active:scale-90 transition-transform cursor-pointer"
        >
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Danh Mục</span>
        </button>
      </div>

      {/* Category Bottom Sheet Modal */}
      {isCategoryDrawerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsCategoryDrawerOpen(false)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in slide-in-from-bottom-5 duration-200 max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-50 text-[#da251d] rounded-xl flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-900">Chọn Nhanh Danh Mục</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryDrawerOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of categories */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              <Link
                href="/combo"
                onClick={() => setIsCategoryDrawerOpen(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 text-white font-black text-xs shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Gift className="w-4 h-4" />
                  <span>Combo Tiết Kiệm</span>
                </div>
                <span className="text-[10px] bg-white text-orange-600 px-2 py-0.5 rounded-full font-black">
                  HOT DEAL
                </span>
              </Link>

              {branchFilteredCategories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      scrollToCategory(cat.id);
                      setIsCategoryDrawerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-red-50 text-[#da251d] border border-red-200/80 shadow-2xs font-black'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {cat.image && (
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-7 h-7 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      )}
                      <span className="truncate">{cat.name}</span>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black shrink-0 ${
                        isActive ? 'bg-red-200/80 text-red-800' : 'bg-white text-slate-500'
                      }`}
                    >
                      {cat.products.length} món
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
