'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  Search,
  ArrowLeft,
  UtensilsCrossed,
  Sparkles,
  Plus,
  Minus,
  ShoppingCart,
  Check,
  Flame,
  Tag,
  SlidersHorizontal,
} from 'lucide-react';
import { QrProduct, QrCategory, QrCartItem, QrCartOption, QrSessionData } from './qr-types';
import { QrOptionSheet } from './QrOptionSheet';
import toast from 'react-hot-toast';

interface QrMenuViewProps {
  token: string;
  sessionData: QrSessionData;
  menuData: {
    isBuffetActive: boolean;
    buffetPackageName?: string;
    buffetItems: QrProduct[];
    retailProducts: QrProduct[];
    categories: QrCategory[];
  };
  cartItems: QrCartItem[];
  onAddToCart: (
    product: QrProduct,
    quantity: number,
    selectedOptions: QrCartOption[],
    note?: string,
    pricingMode?: 'REGULAR' | 'BUFFET_INCLUDED'
  ) => void;
  onOpenCart: () => void;
  onBack: () => void;
}

export const QrMenuView: React.FC<QrMenuViewProps> = ({
  token,
  sessionData,
  menuData,
  cartItems,
  onAddToCart,
  onOpenCart,
  onBack,
}) => {
  const isBuffetActive = menuData.isBuffetActive;
  const [activeTab, setActiveTab] = useState<'BUFFET' | 'RETAIL'>(
    isBuffetActive ? 'BUFFET' : 'RETAIL'
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [optionProduct, setOptionProduct] = useState<QrProduct | null>(null);
  const [optionPricingMode, setOptionPricingMode] = useState<'REGULAR' | 'BUFFET_INCLUDED'>('REGULAR');

  // Products to display based on active tab
  const baseProductList = activeTab === 'BUFFET' ? menuData.buffetItems : menuData.retailProducts;

  // Filtered products by category and search
  const displayedProducts = useMemo(() => {
    return baseProductList.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.categoryName?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (selectedCategoryId !== 'ALL' && p.categoryId !== selectedCategoryId) {
        return false;
      }
      return true;
    });
  }, [baseProductList, searchQuery, selectedCategoryId]);

  const handleProductAdd = (product: QrProduct, mode: 'REGULAR' | 'BUFFET_INCLUDED') => {
    if (!product.available) {
      toast.error('Món ăn hiện đang tạm hết');
      return;
    }

    if (product.optionGroups && product.optionGroups.length > 0) {
      setOptionPricingMode(mode);
      setOptionProduct(product);
    } else {
      onAddToCart(product, 1, [], undefined, mode);
      toast.success(`Đã thêm: ${product.name}${mode === 'BUFFET_INCLUDED' ? ' (Buffet 0đ)' : ''}`);
    }
  };

  const totalCartCount = cartItems.reduce((sum, it) => sum + it.quantity, 0);
  const totalCartPrice = cartItems.reduce((sum, it) => sum + it.priceAtSale * it.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans select-none pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Sticky Top Header */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 z-30 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-sm font-black text-slate-900 leading-tight">Thực đơn</h2>
              <span className="text-[10px] text-slate-400 font-semibold">{sessionData.table.name}</span>
            </div>
          </div>

          <div className="relative flex-1 max-w-[200px] sm:max-w-[260px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm món..."
              className="w-full h-9 pl-8 pr-3 rounded-full bg-slate-100 border-none focus:bg-white focus:ring-1 focus:ring-red-200 text-xs outline-none transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* BUFFET BANNER & TABS IF BUFFET ACTIVE */}
        {isBuffetActive && (
          <div className="mt-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-red-50 to-amber-50 border border-red-200/80 flex items-center justify-between mb-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#da251d] animate-pulse" />
                  <span className="text-xs font-black text-[#da251d] tracking-wide">
                    {menuData.buffetPackageName || 'BUFFET PREMIUM'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Quý khách đang sử dụng gói Buffet của bàn.
                </p>
              </div>
              <span className="text-[10px] bg-[#da251d] text-white px-2 py-0.5 rounded-full font-black">
                ACTIVE
              </span>
            </div>

            {/* 2 Tabs: [TRONG GÓI BUFFET] & [GỌI THÊM / MANG VỀ] */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('BUFFET');
                  setSelectedCategoryId('ALL');
                }}
                className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'BUFFET'
                    ? 'bg-white text-[#da251d] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                TRONG GÓI BUFFET (0đ)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('RETAIL');
                  setSelectedCategoryId('ALL');
                }}
                className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'RETAIL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                GỌI THÊM / MANG VỀ
              </button>
            </div>
          </div>
        )}

        {/* Category Horizontal Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2.5 pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategoryId === 'ALL'
                ? 'bg-[#da251d] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({baseProductList.length})
          </button>
          {menuData.categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategoryId === cat.id
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* Main Products Grid */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {displayedProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <UtensilsCrossed className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-bold">Không tìm thấy món ăn nào phù hợp</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {displayedProducts.map((product) => {
              const isBuffetItem = activeTab === 'BUFFET';
              return (
                <div
                  key={`${product.id}-${activeTab}`}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  {/* Product Image */}
                  <div className="w-full aspect-4/3 relative bg-slate-100">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 200px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <UtensilsCrossed className="w-8 h-8" />
                      </div>
                    )}

                    {/* Badge */}
                    {isBuffetItem ? (
                      <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                        Trong Buffet
                      </span>
                    ) : (product.originalPrice ?? product.price ?? 0) > (product.effectivePrice ?? product.price ?? 0) ? (
                      <span className="absolute top-2 left-2 bg-[#da251d] text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                        Ưu đãi
                      </span>
                    ) : null}
                  </div>

                  {/* Product Info */}
                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 leading-snug line-clamp-2">
                        {product.name}
                      </h3>
                      {product.unit && (
                        <span className="text-[10px] text-slate-400">ĐVT: {product.unit}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
                      <div>
                        {isBuffetItem ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-emerald-600 font-mono">0đ</span>
                            {(product.effectivePrice ?? product.price) !== undefined && (
                              <span className="text-[10px] text-slate-400 line-through font-mono">
                                {(product.effectivePrice ?? product.price ?? 0).toLocaleString('vi-VN')}đ
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-[#da251d] font-mono">
                              {(product.effectivePrice ?? product.price ?? 0).toLocaleString('vi-VN')}đ
                            </span>
                            {product.originalPrice && product.originalPrice > (product.effectivePrice ?? product.price ?? 0) && (
                              <span className="text-[10px] text-slate-400 line-through font-mono">
                                {(product.originalPrice ?? 0).toLocaleString('vi-VN')}đ
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={() =>
                          handleProductAdd(product, isBuffetItem ? 'BUFFET_INCLUDED' : 'REGULAR')
                        }
                        className={`h-8 px-2.5 rounded-xl font-black text-xs flex items-center gap-1 active:scale-95 transition-all shadow-xs cursor-pointer ${
                          isBuffetItem
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-red-50 hover:bg-red-100 text-[#da251d] border border-red-200'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span className="text-[11px]">{isBuffetItem ? '0đ' : 'Thêm'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Option Sheet Modal */}
      <QrOptionSheet
        product={optionProduct}
        pricingMode={optionPricingMode}
        isOpen={Boolean(optionProduct)}
        onClose={() => setOptionProduct(null)}
        onConfirm={onAddToCart}
      />

      {/* STICKY BOTTOM CART TRIGGER BAR */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-2xl z-40 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              onClick={onOpenCart}
              className="w-full h-13 rounded-2xl bg-[#da251d] hover:bg-[#ba1b14] active:scale-[0.99] text-white font-black px-4 flex items-center justify-between shadow-lg shadow-red-500/25 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-white text-[#da251d] text-xs font-black flex items-center justify-center shadow-xs">
                  {totalCartCount}
                </span>
                <span className="text-xs font-black uppercase tracking-wide">
                  Xem giỏ & Gửi món
                </span>
              </div>

              <div className="flex items-center gap-1 font-mono text-sm">
                <span>{totalCartPrice.toLocaleString('vi-VN')}đ</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
