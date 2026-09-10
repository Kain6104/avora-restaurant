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
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  cartItemCounts = {},
  buffetProductIds,
  viewMode = 'grid',
  onSelectProduct,
  onToggleAvailability,
  isLoading = false,
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
              className={`bg-white rounded-xl border border-slate-200 animate-pulse p-3 flex flex-col justify-between ${
                viewMode === 'fast' ? 'min-h-[64px]' : 'aspect-4/5'
              }`}
            >
              {viewMode === 'grid' && (
                <div className="w-full aspect-4/3 bg-slate-200 rounded-lg mb-2" />
              )}
              <div className="space-y-2">
                <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
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
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
          <Utensils className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-bold text-slate-700 mb-1">Không tìm thấy món phù hợp</h3>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
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
            />
          ) : (
            <ProductCard
              key={product.id}
              product={product}
              cartQuantity={cartItemCounts[product.id] || 0}
              isBuffetEligible={buffetProductIds ? buffetProductIds.has(product.id) : undefined}
              onSelectProduct={onSelectProduct}
              onToggleAvailability={onToggleAvailability}
            />
          ),
        )}
      </div>
    </div>
  );
};
