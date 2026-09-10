"use client";

import React, { forwardRef } from 'react';
import { Flame, Zap, Search, X, LayoutGrid, Sliders } from 'lucide-react';
import { PosCategory } from './pos-types';

interface CategoryBarProps {
  categories: PosCategory[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalProductsCount: number;
  viewMode?: 'grid' | 'fast';
  onToggleViewMode?: (mode: 'grid' | 'fast') => void;
}

export const CategoryBar = forwardRef<HTMLInputElement, CategoryBarProps>(
  (
    {
      categories,
      selectedCategoryId,
      onSelectCategory,
      searchQuery,
      onSearchChange,
      totalProductsCount,
      viewMode = 'grid',
      onToggleViewMode,
    },
    ref,
  ) => {
    return (
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col gap-2 shrink-0 select-none shadow-2xs">
        {/* ROW 1: Search Bar & View Mode Switcher */}
        <div className="flex items-center gap-2 w-full">
          {/* Fast Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={ref}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm món, mã món (#PB01), gõ không dấu... (/)"
              className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-[#da251d] text-xs sm:text-sm rounded-xl pl-9 pr-8 py-2 outline-none transition-all placeholder:text-slate-400 font-medium h-10 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                title="Xóa tìm kiếm (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Mode Toggle Switcher (Visual Grid vs Fast POS) */}
          {onToggleViewMode && (
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0 h-10">
              <button
                type="button"
                onClick={() => onToggleViewMode('grid')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 h-8 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Chế độ lưới ảnh trực quan"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-slate-700" />
                <span className="hidden sm:inline">Lưới ảnh</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleViewMode('fast')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 h-8 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'fast'
                    ? 'bg-white text-[#da251d] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Chế độ nút bấm POS nhanh giờ cao điểm"
              >
                <Zap className="w-3.5 h-3.5 text-[#da251d] fill-[#da251d]" />
                <span className="hidden sm:inline">Bấm nhanh</span>
              </button>
            </div>
          )}
        </div>

        {/* ROW 2: Horizontal Scrollable Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full py-0.5">
          {/* All Items Pill */}
          <button
            type="button"
            onClick={() => onSelectCategory('ALL')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
              selectedCategoryId === 'ALL'
                ? 'bg-[#da251d] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Tất cả</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                selectedCategoryId === 'ALL' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {totalProductsCount}
            </span>
          </button>

          {/* Best Seller Filter */}
          <button
            type="button"
            onClick={() => onSelectCategory('BEST_SELLER')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
              selectedCategoryId === 'BEST_SELLER'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>Bán chạy</span>
          </button>

          {/* Flash Sale Filter */}
          <button
            type="button"
            onClick={() => onSelectCategory('FLASH_SALE')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] ${
              selectedCategoryId === 'FLASH_SALE'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Flash Sale</span>
          </button>

          {/* Dynamic Categories */}
          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-h-[38px] ${
                  isSelected
                    ? 'bg-[#da251d] text-white font-bold shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {cat.productCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

CategoryBar.displayName = 'CategoryBar';
