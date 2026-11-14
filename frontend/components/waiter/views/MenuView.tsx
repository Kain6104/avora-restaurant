'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useWaiterStore, UnsentItem } from '@/store/useWaiterStore';
import { db } from '@/lib/offline/db';
import { useInstantProducts } from '@/lib/offline/useOfflineData';
import { useIsIPhone } from '@/lib/utils/device';
import Image from 'next/image';
import { 
  ArrowLeft, 
  Search, 
  X, 
  Plus, 
  Utensils, 
  Gift, 
  Tag, 
  ShoppingCart, 
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import ProductOptionSheet from '../menu/ProductOptionSheet';
import { BuffetSelectionModal } from '@/components/pos/BuffetSelectionModal';
import { BuffetRibbonTag } from '@/components/ui/BuffetRibbonTag';
import PullToRefresh from '../common/PullToRefresh';
import { syncEngine } from '@/lib/offline/syncEngine';

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store', credentials: 'include' }).then(r => r.json());
const EMPTY_ITEMS: UnsentItem[] = [];

function LazyDishImage({
  src,
  alt,
  sizes,
  className = '',
  fallbackIconSize = 20,
}: {
  src?: string | null;
  alt: string;
  sizes: string;
  className?: string;
  fallbackIconSize?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
        <Utensils size={fallbackIconSize} />
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
}

export default function MenuView() {
  const isOffline = useWaiterStore(s => s.isOffline);
  const isIPhone = useIsIPhone();
  const activeBranchId = useWaiterStore(s => s.activeBranchId);
  const selectedTableId = useWaiterStore(s => s.selectedTableId);
  const selectedOrderId = useWaiterStore(s => s.selectedOrderId);
  const addUnsentItem = useWaiterStore(s => s.addUnsentItem);
  const setActiveTab = useWaiterStore(s => s.setActiveTab);
  const sourceTab = useWaiterStore(s => s.sourceTab);
  const registerModalHandler = useWaiterStore(s => s.registerModalHandler);
  const setShouldScrollToUnsent = useWaiterStore(s => s.setShouldScrollToUnsent);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const handleInputSelectAll = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    if (target && target.value) {
      target.select();
      try {
        target.setSelectionRange(0, target.value.length);
      } catch {}
    }
  };

  // Stable selector avoiding re-render loops - works for both table and takeaway/delivery orders
  const cartKey = selectedTableId || selectedOrderId;
  const unsentMap = useWaiterStore(s => s.unsentItems);
  const unsentItems = (cartKey && unsentMap[cartKey]) || EMPTY_ITEMS;

  const { products: localProducts, categories: localCategories, hasLocalData } = useInstantProducts(activeBranchId);

  const { data: response, isLoading: isSwrLoading, mutate: mutateProducts } = useSWR(
    isOffline || !activeBranchId ? null : `/api/pos/products?branchId=${activeBranchId}`,
    fetcher
  );

  const { data: tableSessionRes } = useSWR(
    isOffline || !selectedTableId || !activeBranchId
      ? null
      : `/api/pos/tables/${selectedTableId}/session?branchId=${activeBranchId}`,
    fetcher
  );

  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('ALL');
  const [selectedProductForOptions, setSelectedProductForOptions] = useState<any | null>(null);
  const [buffetSelectionProduct, setBuffetSelectionProduct] = useState<any | null>(null);
  const [pendingPricingMode, setPendingPricingMode] = useState<'REGULAR' | 'BUFFET_INCLUDED'>('REGULAR');

  // Instant load: prefer persistent IndexedDB, fallback to SWR response
  const products = hasLocalData
    ? localProducts
    : (response?.data?.products || []);

  const dbCategories = (localCategories.length > 0)
    ? localCategories
    : (response?.data?.categories || []);

  const isInitialLoading = !hasLocalData && isSwrLoading;

  // Active buffet check (supports both buffetSessions array and singular buffetSession)
  const activeBuffet =
    tableSessionRes?.data?.order?.buffetSessions?.find((s: any) => s.status === 'ACTIVE') ||
    tableSessionRes?.data?.order?.buffetSessions?.[0] ||
    tableSessionRes?.data?.order?.buffetSession;
  const isBuffetActive = activeBuffet && activeBuffet.status === 'ACTIVE';

  // Structured categories matching Image 3 + special Buffet category if active
  const categories = [
    ...(isBuffetActive
      ? [{ id: 'BUFFET_INCLUDED', name: 'Món Buffet (0đ)', icon: Sparkles, isSpecial: true }]
      : []),
    { id: 'ALL', name: 'Tất cả', icon: Utensils },
    { id: 'COMBO', name: 'Menu Combo', icon: Gift, isSpecial: true },
    ...dbCategories.map((c: any) => ({
      id: c.id,
      name: c.name,
      icon: Tag,
    })),
  ];

  // Filtering products
  const filteredProducts = products.filter((p: any) => {
    if (isSearchMode && searchQuery) {
      return p.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    if (activeCategoryId === 'BUFFET_INCLUDED' && isBuffetActive) {
      return activeBuffet.buffetPackage?.items?.some((it: any) => it.productId === p.id);
    }
    if (activeCategoryId === 'BUFFET') {
      return p.isBuffetTicket || p.isBuffetItem;
    }
    if (activeCategoryId === 'COMBO') {
      return p.isCombo || p.name.toLowerCase().includes('combo') || p.name.toLowerCase().includes('set');
    }
    if (activeCategoryId !== 'ALL' && p.categoryId !== activeCategoryId) {
      return false;
    }
    return true;
  });

  // Register modal handlers for Android back navigation
  useEffect(() => {
    return registerModalHandler('menu-view', () => {
      if (selectedProductForOptions) {
        setSelectedProductForOptions(null);
        return true;
      }
      if (isSearchMode) {
        setIsSearchMode(false);
        setSearchQuery('');
        return true;
      }
      return false;
    });
  }, [selectedProductForOptions, isSearchMode, registerModalHandler]);

  const handleBack = () => {
    if (isSearchMode) {
      setIsSearchMode(false);
      setSearchQuery('');
      return;
    }
    // Return to OrderDetailView with preserved origin tab
    setActiveTab(sourceTab || 'TABLES');
  };

  const handleProductClick = (product: any) => {
    if (!product.available) {
      toast.error('Món này hiện đang tạm hết.');
      return;
    }

    if (!cartKey) {
      toast('Vui lòng chọn bàn hoặc đơn hàng trước khi thêm món.', {
        icon: <Info className="w-4 h-4 text-sky-500" />,
      });
      return;
    }

    // 1. Check if product is a Buffet Ticket
    if (product.isBuffetTicket) {
      if (product.optionGroups && product.optionGroups.length > 0) {
        setPendingPricingMode('BUFFET_TICKET' as any);
        setSelectedProductForOptions(product);
        return;
      }
      const ticketPrice = product.flashSalePrice || product.discountedPrice || product.price;
      addUnsentItem(cartKey, {
        productId: product.id,
        productName: product.name,
        priceAtSale: ticketPrice,
        originalPriceAtSale: product.price,
        quantity: 1,
        note: '',
        selectedOptions: [],
        imageUrl: product.imageUrl,
        pricingMode: 'BUFFET_TICKET',
        source: 'WAITER',
      });
      toast.success(`Đã thêm vé: ${product.name}`);
      if (navigator.vibrate) navigator.vibrate(40);
      return;
    }

    // 2. Check if current table has an active buffet session
    const isItemInBuffet =
      isBuffetActive &&
      activeBuffet.buffetPackage?.items?.some((it: any) => it.productId === product.id);

    if (isItemInBuffet) {
      setBuffetSelectionProduct(product);
      return;
    }

    if (product.optionGroups && product.optionGroups.length > 0) {
      setPendingPricingMode('REGULAR');
      setSelectedProductForOptions(product);
      return;
    }

    const priceAtSale = product.flashSalePrice || product.discountedPrice || product.price;

    addUnsentItem(cartKey, {
      productId: product.id,
      productName: product.name,
      priceAtSale,
      originalPriceAtSale: product.price,
      quantity: 1,
      note: '',
      selectedOptions: [],
      imageUrl: product.imageUrl,
      pricingMode: 'REGULAR',
      source: 'WAITER',
    });

    toast.success(`Đã thêm ${product.name}`);
    if (navigator.vibrate) navigator.vibrate(40);
  };

  const handleBuffetSelect = (mode: 'BUFFET_INCLUDED' | 'REGULAR') => {
    if (!buffetSelectionProduct || !cartKey) return;
    const product = buffetSelectionProduct;
    setBuffetSelectionProduct(null);

    if (product.optionGroups && product.optionGroups.length > 0) {
      setPendingPricingMode(mode);
      setSelectedProductForOptions(product);
      return;
    }

    const isBuffet = mode === 'BUFFET_INCLUDED';
    const basePrice = isBuffet ? 0 : (product.flashSalePrice || product.discountedPrice || product.price);

    addUnsentItem(cartKey, {
      productId: product.id,
      productName: product.name,
      priceAtSale: basePrice,
      originalPriceAtSale: product.price,
      quantity: 1,
      note: '',
      selectedOptions: [],
      imageUrl: product.imageUrl,
      pricingMode: mode,
      buffetSessionId: isBuffet ? activeBuffet?.id : null,
      buffetPackageId: isBuffet ? activeBuffet?.buffetPackageId : null,
      source: 'WAITER',
    });

    toast.success(`Đã thêm ${product.name} (${isBuffet ? 'Buffet 0đ' : 'Món lẻ'})`);
    if (navigator.vibrate) navigator.vibrate(40);
  };

  const handleConfirmOptions = (selectedOptions: any[], note: string, quantity: number) => {
    if (!selectedProductForOptions || !cartKey) return;
    const activeBuffet = tableSessionRes?.data?.order?.buffetSession;
    const isBuffet = pendingPricingMode === 'BUFFET_INCLUDED' && activeBuffet?.status === 'ACTIVE';

    const extraPrice = selectedOptions.reduce((sum, o) => sum + (o.priceAdjustment || 0), 0);
    const basePrice = isBuffet ? 0 : (selectedProductForOptions.flashSalePrice || selectedProductForOptions.discountedPrice || selectedProductForOptions.price);
    const finalPrice = basePrice + extraPrice;

    addUnsentItem(cartKey, {
      productId: selectedProductForOptions.id,
      productName: selectedProductForOptions.name,
      priceAtSale: finalPrice,
      originalPriceAtSale: selectedProductForOptions.price + extraPrice,
      quantity,
      note,
      selectedOptions,
      imageUrl: selectedProductForOptions.imageUrl,
      pricingMode: isBuffet ? 'BUFFET_INCLUDED' : 'REGULAR',
      buffetSessionId: isBuffet ? activeBuffet?.id : null,
      buffetPackageId: isBuffet ? activeBuffet?.buffetPackageId : null,
      source: 'WAITER',
    });
    toast.success(`Đã thêm ${quantity}x ${selectedProductForOptions.name}${isBuffet ? ' (Buffet 0đ)' : ''}`);
    setSelectedProductForOptions(null);
    setPendingPricingMode('REGULAR');
    if (navigator.vibrate) navigator.vibrate(40);
  };

  const unsentCount = unsentItems.reduce((sum, it) => sum + it.quantity, 0);
  const unsentTotal = unsentItems.reduce((sum, it) => sum + (it.priceAtSale * it.quantity), 0);

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-white relative select-none">
      {/* 1. HEADER (Image 3 or Image 4) */}
      {!isSearchMode ? (
        <header className="flex items-center justify-between px-4 h-14 bg-white border-b border-slate-100 shrink-0 z-20 pt-[env(safe-area-inset-top)] box-content">
          <button 
            onClick={handleBack} 
            className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <h1 className="text-lg font-bold text-slate-900 leading-tight">
            Thực đơn
          </h1>

          <button 
            onClick={() => setIsSearchMode(true)}
            className="p-2 -mr-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors"
          >
            <Search size={22} />
          </button>
        </header>
      ) : (
        /* SEARCH HEADER (Image 4) */
        <header className="flex items-center gap-2 px-3 h-14 bg-white border-b border-slate-200 shrink-0 z-20 pt-[env(safe-area-inset-top)] box-content">
          <button 
            onClick={() => { setIsSearchMode(false); setSearchQuery(''); }}
            className="p-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleInputSelectAll}
              onClick={handleInputSelectAll}
              placeholder="Tìm kiếm món ăn..."
              className="w-full pl-4 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-full text-sm outline-none focus:bg-white focus:border-[#DA251D] focus:ring-1 focus:ring-[#DA251D]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-slate-300 text-slate-700"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </header>
      )}

      {/* 2. BODY CONTENT */}
      {isSearchMode ? (
        /* SEARCH RESULTS LIST (Image 4) */
        <PullToRefresh
          onRefresh={async () => {
            if (activeBranchId) {
              const res = await fetch(`/api/pos/products?branchId=${activeBranchId}`, {
                cache: 'no-store',
                credentials: 'include',
              });
              if (res.ok) {
                const json = await res.json();
                await mutateProducts(json, { revalidate: false });
              } else {
                await mutateProducts();
              }
              await syncEngine.performDeltaSync(activeBranchId, false);
            }
          }}
          isOffline={isOffline}
          className="divide-y divide-slate-100 p-2 pb-24"
        >
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Search size={36} className="mb-2 opacity-50" />
              <p className="text-sm">Không tìm thấy món "{searchQuery}"</p>
            </div>
          ) : (
            filteredProducts.map((product: any) => {
              const isItemInBuffet = isBuffetActive && activeBuffet.buffetPackage?.items?.some((it: any) => it.productId === product.id);
              const isBuffet = product.isBuffetTicket || product.isBuffetItem || product.categorySlug === 'buffet' || product.categoryName?.toLowerCase().includes('buffet') || isItemInBuffet;
              const currentPrice = isItemInBuffet ? 0 : (product.flashSalePrice || product.discountedPrice || product.price);

              return (
                <div 
                  key={product.id}
                  className="flex items-center justify-between p-3 gap-3 hover:bg-slate-50 transition-colors relative"
                >
                  {/* Left: Thumbnail */}
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 shrink-0 relative overflow-hidden flex items-center justify-center">
                    {isBuffet && <BuffetRibbonTag size="sm" className="!left-0" />}
                    <LazyDishImage
                      src={product.imageUrl}
                      alt={product.name}
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>

                  {/* Middle: Dish Name & Price */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-900 text-sm truncate">
                      {product.name}
                    </h4>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                      {currentPrice.toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  {/* Right: Round Red Plus Button (Avora Red) */}
                  <button
                    type="button"
                    onClick={() => handleProductClick(product)}
                    disabled={!product.available}
                    className="w-9 h-9 rounded-full bg-[#DA251D] hover:bg-[#b81d16] active:scale-90 text-white flex items-center justify-center shrink-0 shadow-sm transition-all disabled:opacity-40"
                  >
                    <Plus size={20} strokeWidth={2.5} />
                  </button>
                </div>
              );
            })
          )}
        </PullToRefresh>
      ) : (
        /* TWO-COLUMN MENU LAYOUT (Image 3) */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Vertical Category Tabs */}
          <aside className="w-28 sm:w-32 bg-slate-50/70 border-r border-slate-200 overflow-y-auto shrink-0 divide-y divide-slate-100">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategoryId === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`w-full py-3 px-2 flex flex-col items-center justify-center text-center gap-1.5 transition-all relative ${
                    isActive
                      ? 'bg-white text-[#DA251D] font-bold border-l-4 border-[#DA251D]'
                      : 'text-slate-600 hover:bg-slate-100/60 font-medium'
                  }`}
                >
                  <Icon 
                    size={22} 
                    className={isActive ? 'text-[#DA251D]' : cat.isSpecial ? 'text-amber-500' : 'text-slate-400'} 
                  />
                  <span className="text-[11px] leading-tight line-clamp-2 px-1">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Right Column: 2-Column Dish Grid (Image 3, Pull-to-refresh supported) */}
          <PullToRefresh
            onRefresh={async () => {
              if (activeBranchId) {
                const res = await fetch(`/api/pos/products?branchId=${activeBranchId}`, {
                  cache: 'no-store',
                  credentials: 'include',
                });
                if (res.ok) {
                  const json = await res.json();
                  await mutateProducts(json, { revalidate: false });
                } else {
                  await mutateProducts();
                }
                await syncEngine.performDeltaSync(activeBranchId, false);
              }
            }}
            isOffline={isOffline}
            className="p-3 pb-28"
          >
            {isInitialLoading ? (
              <div className="grid grid-cols-2 gap-3 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((slot) => (
                  <div
                    key={slot}
                    className="flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200/80"
                  >
                    <div className="w-full aspect-square bg-slate-200" />
                    <div className="p-2.5 flex items-center justify-center">
                      <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Utensils size={36} className="mb-2 opacity-50" />
                <p className="text-sm">Chưa có món trong danh mục này</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((p: any) => {
                  const isItemInBuffet = isBuffetActive && activeBuffet.buffetPackage?.items?.some((it: any) => it.productId === p.id);
                  const isBuffet = p.isBuffetTicket || p.isBuffetItem || p.categorySlug === 'buffet' || p.categoryName?.toLowerCase().includes('buffet') || isItemInBuffet;
                  const currentPrice = isItemInBuffet ? 0 : (p.flashSalePrice || p.discountedPrice || p.price);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProductClick(p)}
                      disabled={!p.available}
                      className={`flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs active:scale-97 transition-all text-left relative group ${
                        !p.available ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Ribbon Tag BUFFET */}
                      {isBuffet && <BuffetRibbonTag size="md" className="!left-2" />}

                      {/* Dish Image Container */}
                      <div className="w-full aspect-square bg-slate-100 relative overflow-hidden flex items-center justify-center">
                        <LazyDishImage
                          src={p.imageUrl}
                          alt={p.name}
                          sizes="(max-width: 640px) 42vw, 200px"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          fallbackIconSize={24}
                        />

                        {/* Price Badge (Moved to top-right if buffet ribbon is present at top-left) */}
                        <div className={`absolute top-0 ${isBuffet ? 'right-0 rounded-bl-lg' : 'left-0 rounded-br-lg'} bg-neutral-800/85 text-white text-[11px] font-bold px-2 py-1 shadow-sm backdrop-blur-xs z-10`}>
                          {currentPrice.toLocaleString('vi-VN')} đ
                        </div>

                        {/* Out of Stock Overlay */}
                        {!p.available && (
                          <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-xs z-20">
                            <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded">
                              Hết hàng
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Bottom White Card Footer: Dish Title (Image 3) */}
                      <div className="p-2.5 bg-white text-center flex items-center justify-center min-h-[44px]">
                        <h3 className="font-bold text-slate-800 text-xs leading-snug line-clamp-2">
                          {p.name}
                        </h3>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </PullToRefresh>
        </div>
      )}

      {/* FLOATING BOTTOM BAR: If unsent items exist, allow quick return to OrderDetailView */}
      {unsentCount > 0 && (
        <div className={`fixed bottom-0 left-0 w-full p-3 bg-white border-t border-slate-200 shadow-xl z-30 touch-none overscroll-none ${
          isIPhone ? 'pb-[max(18px,calc(env(safe-area-inset-bottom)+10px))]' : 'pb-2.5'
        }`}>
          <button
            type="button"
            onClick={() => {
              setShouldScrollToUnsent(true);
              setActiveTab(sourceTab || 'TABLES');
            }}
            className="w-full py-3 px-4 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-98 text-white font-bold text-sm shadow-md flex items-center justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white text-[#DA251D] w-6 h-6 rounded-full text-xs font-black flex items-center justify-center">
                {unsentCount}
              </span>
              <span>Xem món đã chọn</span>
            </div>

            <div className="flex items-center gap-1">
              <span>{unsentTotal.toLocaleString('vi-VN')} đ</span>
              <ChevronRight size={18} />
            </div>
          </button>
        </div>
      )}

      {/* PRODUCT OPTIONS MODAL */}
      {selectedProductForOptions && (
        <ProductOptionSheet
          product={selectedProductForOptions}
          isOpen={!!selectedProductForOptions}
          onClose={() => setSelectedProductForOptions(null)}
          onConfirm={handleConfirmOptions}
        />
      )}

      {/* BUFFET SELECTION MODAL */}
      {buffetSelectionProduct && (
        <BuffetSelectionModal
          product={buffetSelectionProduct}
          packageName={activeBuffet?.packageNameSnapshot || activeBuffet?.buffetPackage?.name || 'Gói Buffet'}
          onClose={() => setBuffetSelectionProduct(null)}
          onSelectMode={handleBuffetSelect}
        />
      )}
    </div>
  );
}
