'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  Search,
  ShoppingBag,
  Sparkles,
  Plus,
  Minus,
  UtensilsCrossed,
  Flame,
  X,
  RefreshCw,
  AlertCircle,
  ZoomIn,
  LayoutGrid,
  List,
  Gauge,
} from 'lucide-react';
import { QrImageViewer } from './QrImageViewer';
import { stripHtmlTags } from './qr-html-util';
import {
  QrCartItem,
  QrCategory,
  QrProduct,
  QrSessionData,
} from './qr-types';

export interface QrMenuPayload {
  hasActiveBuffet?: boolean;
  buffetPackage?: {
    id: string;
    name: string;
    description?: string | null;
    maxItemsPerSubmission?: number | null;
  } | null;
  buffetItems?: QrProduct[];
  retailCategories?: ApiRetailCategory[];
}

interface QrMenuViewProps {
  token: string;
  sessionData: QrSessionData;
  cartItems: QrCartItem[];
  initialMenuData?: QrMenuPayload | null;
  menuRefreshTrigger?: number;
  onBack: () => void;
  onSelectProduct: (product: QrProduct, pricingMode: 'REGULAR' | 'BUFFET_INCLUDED') => void;
  onQuickAddProduct: (product: QrProduct, pricingMode: 'REGULAR' | 'BUFFET_INCLUDED') => void;
  onUpdateSimpleQuantity: (
    productId: string,
    pricingMode: 'REGULAR' | 'BUFFET_INCLUDED',
    delta: number
  ) => void;
  onOpenCart: () => void;
  onCategoriesLoaded?: (availableProductIds: Set<string>, catalogProducts?: QrProduct[]) => void;
  onMenuDataSynced?: (data: QrMenuPayload) => void;
}

interface ApiRetailCategory {
  id: string;
  name: string;
  slug?: string;
  displayOrder?: number;
  products?: QrProduct[];
}

const MENU_VIEW_STORAGE_KEY = 'avora_qr_menu_view';

export const QrMenuView: React.FC<QrMenuViewProps> = ({
  token,
  sessionData,
  cartItems,
  initialMenuData = null,
  menuRefreshTrigger = 0,
  onBack,
  onSelectProduct,
  onQuickAddProduct,
  onUpdateSimpleQuantity,
  onOpenCart,
  onCategoriesLoaded,
  onMenuDataSynced,
}) => {
  const [categories, setCategories] = useState<QrCategory[]>([]);
  const [productsByCat, setProductsByCat] = useState<Record<string, QrProduct[]>>({});
  const [viewerImage, setViewerImage] = useState<{ src: string; alt: string } | null>(null);
  const [buffetProducts, setBuffetProducts] = useState<QrProduct[]>([]);
  const [buffetPackageInfo, setBuffetPackageInfo] = useState<QrMenuPayload['buffetPackage']>(null);
  const [hasActiveBuffet, setHasActiveBuffet] = useState(false);

  const [activeTab, setActiveTab] = useState<'BUFFET' | 'RETAIL'>(() =>
    sessionData.buffetSession?.status === 'ACTIVE' ? 'BUFFET' : 'RETAIL'
  );
  const [selectedCatId, setSelectedCatId] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>(() => {
    if (typeof window === 'undefined') return 'LIST';
    try {
      const saved = window.localStorage.getItem(MENU_VIEW_STORAGE_KEY);
      return saved === 'GRID' || saved === 'LIST' ? saved : 'LIST';
    } catch {
      return 'LIST';
    }
  });
  const hasLoadedOnceRef = useRef(Boolean(initialMenuData));
  const hasInitializedDefaultTabRef = useRef(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(Boolean(initialMenuData));
  const [isLoading, setIsLoading] = useState(!initialMenuData);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === 'LIST' ? 'GRID' : 'LIST';
      try {
        window.localStorage.setItem(MENU_VIEW_STORAGE_KEY, next);
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim().toLowerCase());
    }, 150);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const applyMenuResponse = useCallback(
    (data: QrMenuPayload, preserveActiveTab = false) => {
      const activeBuffet = Boolean(data.hasActiveBuffet && data.buffetItems?.length);
      setHasActiveBuffet(activeBuffet);
      setBuffetPackageInfo(data.buffetPackage || null);
      setBuffetProducts(data.buffetItems || []);
      if (activeBuffet && (!hasInitializedDefaultTabRef.current || !preserveActiveTab)) {
        setActiveTab('BUFFET');
        hasInitializedDefaultTabRef.current = true;
      } else if (!hasInitializedDefaultTabRef.current) {
        hasInitializedDefaultTabRef.current = true;
      }

      const cats: QrCategory[] = [];
      const prodMap: Record<string, QrProduct[]> = {};

      (data.retailCategories || []).forEach((cat, idx) => {
        if (!cat.products || cat.products.length === 0) return;
        cats.push({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          displayOrder: cat.displayOrder ?? idx,
        });
        prodMap[cat.id] = cat.products;
      });

      cats.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

      setCategories(cats);
      setProductsByCat(prodMap);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
      setIsLoading(false);

      if (onCategoriesLoaded) {
        const availableSet = new Set<string>();
        const catalogProducts: QrProduct[] = [];
        (data.buffetItems || []).forEach((p) => {
          availableSet.add(p.id);
          catalogProducts.push(p);
        });
        Object.values(prodMap)
          .flat()
          .forEach((p) => {
            availableSet.add(p.id);
            catalogProducts.push(p);
          });
        onCategoriesLoaded(availableSet, catalogProducts);
      }

      if (onMenuDataSynced) {
        onMenuDataSynced(data);
      }
    },
    [onCategoriesLoaded, onMenuDataSynced]
  );

  // Sync immediately if initialMenuData arrives from parent cache without triggering Skeleton
  useEffect(() => {
    if (initialMenuData) {
      applyMenuResponse(initialMenuData, hasLoadedOnceRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMenuData]);

  const fetchMenu = async () => {
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/qr-order/${token}/menu`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể tải thực đơn');
      }
      applyMenuResponse(data, hasLoadedOnceRef.current);
    } catch (err: unknown) {
      if (!hasLoadedOnceRef.current) {
        setErrorMsg(err instanceof Error ? err.message : 'Lỗi kết nối thực đơn nhà hàng');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadMenu = async () => {
      try {
        const res = await fetch(`/api/qr-order/${token}/menu`, { cache: 'no-store' });
        const data = await res.json();
        if (!active) return;
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Không thể tải thực đơn');
        }
        applyMenuResponse(data, hasLoadedOnceRef.current);
        setErrorMsg(null);
      } catch (err: unknown) {
        if (active && !hasLoadedOnceRef.current) {
          setErrorMsg(err instanceof Error ? err.message : 'Lỗi kết nối thực đơn nhà hàng');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadMenu();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, menuRefreshTrigger]);

  const totalCartItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const totalCartAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.priceAtSale * item.quantity, 0),
    [cartItems]
  );

  // Sum cart quantities per productId + pricingMode for compact inline controls
  const simpleQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      if (item.selectedOptions.length === 0 && !item.note) {
        const key = `${item.productId}::${item.pricingMode}`;
        map.set(key, (map.get(key) || 0) + item.quantity);
      }
    }
    return map;
  }, [cartItems]);

  const buffetSections = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; displayOrder: number; items: QrProduct[] }>();
    for (const p of buffetProducts) {
      if (
        searchQuery &&
        !p.name.toLowerCase().includes(searchQuery) &&
        !(p.description && p.description.toLowerCase().includes(searchQuery))
      ) {
        continue;
      }
      const catId = p.categoryId || 'BUFFET_GENERAL';
      const catName = p.categoryName || 'Món Buffet';
      const catOrder = p.categoryDisplayOrder ?? 9999;
      if (!groups.has(catId)) {
        groups.set(catId, { id: catId, name: catName, displayOrder: catOrder, items: [] });
      }
      groups.get(catId)!.items.push(p);
    }
    return Array.from(groups.values()).sort(
      (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'vi')
    );
  }, [buffetProducts, searchQuery]);

  const activeCategoryChips = useMemo(() => {
    if (activeTab === 'BUFFET') {
      return buffetSections.map((s) => ({ id: s.id, name: s.name }));
    }
    return categories.map((c) => ({ id: c.id, name: c.name }));
  }, [activeTab, buffetSections, categories]);

  const groupedSections = useMemo(() => {
    if (activeTab === 'BUFFET') {
      return selectedCatId === 'ALL'
        ? buffetSections
        : buffetSections.filter((s) => s.id === selectedCatId);
    }

    const targetCats =
      selectedCatId === 'ALL' ? categories : categories.filter((c) => c.id === selectedCatId);

    const sections: Array<{ id: string; name: string; displayOrder: number; items: QrProduct[] }> = [];
    for (const cat of targetCats) {
      const baseItems = productsByCat[cat.id] || [];
      const filtered = !searchQuery
        ? baseItems
        : baseItems.filter(
            (p) =>
              p.name.toLowerCase().includes(searchQuery) ||
              (p.description && p.description.toLowerCase().includes(searchQuery))
          );
      if (filtered.length > 0) {
        sections.push({
          id: cat.id,
          name: cat.name,
          displayOrder: cat.displayOrder ?? 0,
          items: filtered,
        });
      }
    }
    return sections;
  }, [activeTab, buffetSections, selectedCatId, categories, productsByCat, searchQuery]);

  const displayedProducts = useMemo(
    () => groupedSections.flatMap((s) => s.items),
    [groupedSections]
  );

  return (
    <div
      className="min-h-screen flex flex-col text-slate-800 font-sans select-none bg-transparent"
    >
      {/* Sticky App Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-red-100/60 pt-[env(safe-area-inset-top)] shadow-2xs">
        <div className="max-w-lg mx-auto px-3 pt-2.5 pb-2 space-y-2">
          {/* Top Navigation Bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onBack}
                aria-label="Quay lại trang chủ"
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-bold text-slate-900 leading-tight truncate">
                    Thực đơn
                  </h1>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-[#DA251D] border border-red-100 shrink-0">
                    {sessionData.table.name}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate">{sessionData.branch.name}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenCart}
              aria-label="Mở giỏ hàng"
              className="relative h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              <ShoppingBag className="w-4 h-4 text-[#DA251D]" />
              <span>Giỏ hàng</span>
              {totalCartItems > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#DA251D] text-white text-[10px] font-bold flex items-center justify-center">
                  {totalCartItems}
                </span>
              )}
            </button>
          </div>

          {/* Search Bar + View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm tên món ăn, đồ uống..."
                className="w-full h-9 pl-9 pr-8 rounded-lg bg-slate-100/80 border border-slate-200 focus:border-[#DA251D] focus:bg-white outline-none text-xs font-medium transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setSearchQuery('');
                  }}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={toggleViewMode}
              title={viewMode === 'LIST' ? 'Chuyển sang dạng lưới 2 cột' : 'Chuyển sang dạng danh sách'}
              aria-label={viewMode === 'LIST' ? 'Chuyển sang dạng lưới 2 cột' : 'Chuyển sang dạng danh sách'}
              className="w-9 h-9 rounded-lg bg-slate-100/90 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 transition-colors cursor-pointer"
            >
              {viewMode === 'LIST' ? (
                <LayoutGrid className="w-4 h-4" />
              ) : (
                <List className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Buffet / Retail Switcher (if active Buffet) */}
          {hasActiveBuffet && (
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('BUFFET');
                  setSelectedCatId('ALL');
                }}
                className={`h-8 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'BUFFET'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Buffet 0đ ({buffetProducts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('RETAIL');
                  setSelectedCatId('ALL');
                }}
                className={`h-8 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'RETAIL'
                    ? 'bg-[#DA251D] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gọi thêm / Đồ uống
              </button>
            </div>
          )}

          {/* Horizontal Scrollable Category Strip */}
          {activeCategoryChips.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3">
              <button
                type="button"
                onClick={() => setSelectedCatId('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer border ${
                  selectedCatId === 'ALL'
                    ? 'bg-[#DA251D] border-[#DA251D] text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tất cả
              </button>
              {activeCategoryChips.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer border ${
                    selectedCatId === cat.id
                      ? 'bg-[#DA251D] border-[#DA251D] text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content with guaranteed clearance above bottom cart tray */}
      <main className="flex-1 px-3 py-3 pb-28 max-w-lg mx-auto w-full">
        {/* Buffet Package Summary Strip (active BUFFET tab) */}
        {!isLoading && hasActiveBuffet && activeTab === 'BUFFET' && buffetPackageInfo && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50/90 border border-emerald-200/90 flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-emerald-900 text-xs font-extrabold truncate">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{buffetPackageInfo.name}</span>
              </div>
              {typeof buffetPackageInfo.maxItemsPerSubmission === 'number' &&
                buffetPackageInfo.maxItemsPerSubmission > 0 && (
                  <p className="text-[11px] text-emerald-800 mt-0.5 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>
                      Tối đa {buffetPackageInfo.maxItemsPerSubmission} món / lần gửi · Đang chọn{' '}
                      <strong
                        className={
                          totalCartItems > buffetPackageInfo.maxItemsPerSubmission
                            ? 'text-[#DA251D]'
                            : ''
                        }
                      >
                        {totalCartItems}
                      </strong>
                    </span>
                  </p>
                )}
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-700 shrink-0">
              Buffet 0đ
            </span>
          </div>
        )}

        {isLoading && !hasLoadedOnce && displayedProducts.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 p-2.5 flex items-center gap-3 animate-pulse"
              >
                <div className="w-16 h-16 rounded-lg bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-3.5 bg-slate-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : errorMsg ? (
          <div className="bg-white rounded-xl border border-rose-200 p-6 text-center space-y-2.5">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-xs font-bold text-slate-800">{errorMsg}</p>
            <button
              type="button"
              onClick={fetchMenu}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#DA251D] text-white text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tải lại thực đơn</span>
            </button>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-14 px-6 text-center text-slate-500 space-y-2">
            <UtensilsCrossed className="w-9 h-9 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-700">Không tìm thấy món ăn nào phù hợp</p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-[#DA251D] hover:underline cursor-pointer"
              >
                Xóa bộ lọc tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedSections.map((section) => (
              <section key={section.id} className="space-y-2.5">
                {/* Category Section Header */}
                <div className="bg-slate-100/90 border border-slate-200/70 rounded-xl px-3 py-2 flex items-center gap-2">
                  <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-800 truncate">
                    {section.name}
                  </h2>
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0 font-mono">
                    {section.items.length}
                  </span>
                </div>

                <div
                  className={
                    viewMode === 'GRID' ? 'grid grid-cols-2 gap-2.5' : 'space-y-2'
                  }
                >
                  {section.items.map((product) => {
                    const mode: 'REGULAR' | 'BUFFET_INCLUDED' =
                      activeTab === 'BUFFET' ? 'BUFFET_INCLUDED' : 'REGULAR';
                    const hasModifiers = Boolean(
                      product.optionGroups &&
                        product.optionGroups.some(
                          (g) => (g.items?.length ?? g.optionItems?.length ?? 0) > 0
                        )
                    );
                    const simpleQty = simpleQtyMap.get(`${product.id}::${mode}`) || 0;
                    const oldPrice = product.oldPrice ?? product.originalPrice ?? 0;
                    const hasPromo =
                      mode === 'REGULAR' &&
                      oldPrice > product.effectivePrice &&
                      product.effectivePrice > 0;
                    const isHot = Boolean(product.isBestSeller || product.badge);

                    const priceNode = (
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        {mode === 'BUFFET_INCLUDED' ? (
                          <>
                            <span className="text-xs font-bold text-emerald-600 font-mono">0đ</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Buffet
                            </span>
                            {(typeof product.maxQuantityPerRound === 'number' ||
                              typeof product.maxTotalQuantity === 'number') && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                {typeof product.maxQuantityPerRound === 'number' && product.maxQuantityPerRound > 0
                                  ? `Tối đa ${product.maxQuantityPerRound}/lần`
                                  : ''}
                                {typeof product.maxQuantityPerRound === 'number' &&
                                product.maxQuantityPerRound > 0 &&
                                typeof product.maxTotalQuantity === 'number' &&
                                product.maxTotalQuantity > 0
                                  ? ' · '
                                  : ''}
                                {typeof product.maxTotalQuantity === 'number' && product.maxTotalQuantity > 0
                                  ? `Còn ${Math.max(0, product.maxTotalQuantity - (product.usedTotalQuantity || 0))}/${product.maxTotalQuantity}`
                                  : ''}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-[#DA251D] font-mono">
                              {product.effectivePrice.toLocaleString('vi-VN')}đ
                            </span>
                            {hasPromo && (
                              <span className="text-[10px] text-slate-400 line-through font-mono">
                                {oldPrice.toLocaleString('vi-VN')}đ
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );

                    const actionControl =
                      !hasModifiers && simpleQty > 0 ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5 shrink-0"
                        >
                          <button
                            type="button"
                            onClick={() => onUpdateSimpleQuantity(product.id, mode, -1)}
                            aria-label={`Giảm số lượng ${product.name}`}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-700 hover:bg-white cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold font-mono text-slate-900">
                            {simpleQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateSimpleQuantity(product.id, mode, 1)}
                            aria-label={`Tăng số lượng ${product.name}`}
                            className="w-6 h-6 rounded flex items-center justify-center text-[#DA251D] hover:bg-white cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasModifiers) {
                              onSelectProduct(product, mode);
                            } else {
                              onQuickAddProduct(product, mode);
                            }
                          }}
                          aria-label={`Thêm ${product.name}`}
                          className={`h-7 px-2.5 rounded-lg flex items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                            mode === 'BUFFET_INCLUDED'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-red-50 hover:bg-[#DA251D] text-[#DA251D] hover:text-white border border-red-200'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{hasModifiers ? 'Chọn' : 'Thêm'}</span>
                        </button>
                      );

                    if (viewMode === 'GRID') {
                      return (
                        <div
                          key={product.id}
                          onClick={() => onSelectProduct(product, mode)}
                          className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 overflow-hidden flex flex-col transition-colors cursor-pointer shadow-2xs"
                        >
                          <div
                            onClick={(e) => {
                              if (product.imageUrl) {
                                e.stopPropagation();
                                setViewerImage({ src: product.imageUrl, alt: product.name });
                              }
                            }}
                            className={`w-full aspect-square bg-[#FAFBFD] relative overflow-hidden border-b border-slate-100 flex items-center justify-center ${
                              product.imageUrl ? 'cursor-zoom-in' : ''
                            }`}
                          >
                            {product.imageUrl ? (
                              <>
                                <Image
                                  src={product.imageUrl}
                                  alt={product.name}
                                  fill
                                  sizes="(max-width: 512px) 45vw, 220px"
                                  className="object-contain object-center p-1.5"
                                />
                                <span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md bg-slate-900/55 text-white flex items-center justify-center">
                                  <ZoomIn className="w-3.5 h-3.5" />
                                </span>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <UtensilsCrossed className="w-8 h-8" />
                              </div>
                            )}
                            {isHot && (
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#DA251D] text-white text-[9px] font-bold flex items-center gap-0.5 leading-none">
                                <Flame className="w-2.5 h-2.5" />
                                <span>{product.badge || 'Nổi bật'}</span>
                              </span>
                            )}
                          </div>

                          <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                            <div>
                              <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                                {product.name}
                              </h3>
                              {stripHtmlTags(product.description) && (
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  {stripHtmlTags(product.description)}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100">
                              {priceNode}
                              {actionControl}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={product.id}
                        onClick={() => onSelectProduct(product, mode)}
                        className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 p-2.5 flex items-center gap-3 transition-colors cursor-pointer"
                      >
                        <div
                          onClick={(e) => {
                            if (product.imageUrl) {
                              e.stopPropagation();
                              setViewerImage({ src: product.imageUrl, alt: product.name });
                            }
                          }}
                          className={`w-[68px] h-[68px] rounded-lg bg-[#FAFBFD] overflow-hidden relative shrink-0 border border-slate-200/70 group flex items-center justify-center ${
                            product.imageUrl ? 'cursor-zoom-in' : ''
                          }`}
                        >
                          {product.imageUrl ? (
                            <>
                              <Image
                                src={product.imageUrl}
                                alt={product.name}
                                fill
                                sizes="68px"
                                className="object-contain object-center p-1"
                              />
                              <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded bg-slate-900/55 text-white flex items-center justify-center">
                                <ZoomIn className="w-2.5 h-2.5" />
                              </span>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <UtensilsCrossed className="w-6 h-6" />
                            </div>
                          )}
                          {isHot && (
                            <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-[#DA251D] text-white text-[9px] font-bold flex items-center gap-0.5 leading-none">
                              <Flame className="w-2.5 h-2.5" />
                              <span>{product.badge || 'Nổi bật'}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[68px] py-0.5">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                                {product.name}
                              </h3>
                            </div>
                            {stripHtmlTags(product.description) && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {stripHtmlTags(product.description)}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            {priceNode}
                            {actionControl}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Sticky Cart Tray */}
      {totalCartItems > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-sm border-t border-slate-200">
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              onClick={onOpenCart}
              className="w-full h-11 px-4 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded bg-white/20 font-mono font-bold">
                  {totalCartItems}
                </div>
                <span>Xem giỏ hàng</span>
              </div>
              <span className="font-mono text-sm">
                {totalCartAmount.toLocaleString('vi-VN')}đ
              </span>
            </button>
          </div>
        </div>
      )}
      {viewerImage && (
        <QrImageViewer
          src={viewerImage.src}
          alt={viewerImage.alt}
          onClose={() => setViewerImage(null)}
        />
      )}
    </div>
  );
};
