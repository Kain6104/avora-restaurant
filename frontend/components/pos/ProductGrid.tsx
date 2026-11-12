"use client";

import React from 'react';
import { Utensils, RotateCcw } from 'lucide-react';
import { PosProduct } from './pos-types';
import { ProductCard } from './ProductCard';
import { ProductFastButton } from './ProductFastButton';

interface ProductGridProps {
  products: PosProduct[];
  cartItemCounts?: Record<string, number>;
  buffetProductIds?: Set<string>;
  viewMode?: 'grid' | 'fast';
  onSelectProduct: (product: PosProduct) => void;
  onToggleAvailability?: (product: PosProduct) => void;
  isLoading?: boolean;
  isDarkMode?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  cartItemCounts = {},
  buffetProductIds,
  viewMode = 'grid',
  onSelectProduct,
  onToggleAvailability,
  isLoading = false,
  isDarkMode = false,
}) => {
  if (isLoading) {
    return (
      <div className="p-3 sm:p-4 overflow-y-auto flex-1 h-full min-h-0">
        <div
          className={
            viewMode === 'fast'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2'
              : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3'
          }
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-xl border animate-pulse p-3 flex flex-col justify-between ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              } ${
                viewMode === 'fast' ? 'min-h-[64px]' : 'aspect-4/5'
              }`}
            >
              {viewMode === 'grid' && (
                <div className={`w-full aspect-4/3 rounded-lg mb-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
              )}
              <div className="space-y-2">
                <div className={`h-3.5 rounded w-3/4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`h-4 rounded w-1/2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 select-none">
        <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mb-3 shadow-2xs ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-600' : 'bg-slate-100 border-slate-200 text-slate-400'
        }`}>
          <Utensils className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h3 className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Không tìm thấy món phù hợp</h3>
        <p className={`text-xs max-w-xs leading-relaxed ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Thử tìm theo từ khóa không dấu, mã món hoặc chọn danh mục khác.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2.5 sm:p-3 md:p-4 overflow-y-auto flex-1 h-full min-h-0">
      <div
        className={
          viewMode === 'fast'
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 pb-8'
            : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 pb-8'
        }
      >
        {products.map((product) =>
          viewMode === 'fast' ? (
            <ProductFastButton
              key={product.id}
              product={product}
              cartQuantity={cartItemCounts[product.id] || 0}
              onSelectProduct={onSelectProduct}
              isDarkMode={isDarkMode}
            />
          ) : (
            <ProductCard
              key={product.id}
              product={product}
              cartQuantity={cartItemCounts[product.id] || 0}
              isBuffetEligible={buffetProductIds ? buffetProductIds.has(product.id) : undefined}
              onSelectProduct={onSelectProduct}
              onToggleAvailability={onToggleAvailability}
              isDarkMode={isDarkMode}
            />
          ),
        )}
      </div>
    </div>
  );
};
