"use client";

import React from 'react';
import { Plus, SlidersHorizontal, Ban, Zap } from 'lucide-react';
import { PosProduct } from './pos-types';

interface ProductFastButtonProps {
  product: PosProduct;
  cartQuantity?: number;
  onSelectProduct: (product: PosProduct) => void;
}

export const ProductFastButton: React.FC<ProductFastButtonProps> = ({
  product,
  cartQuantity = 0,
  onSelectProduct,
}) => {
  const hasOptions = product.optionGroups && product.optionGroups.length > 0;
  const isOutOfStock = !product.available;
  const isInCart = cartQuantity > 0;

  return (
    <button
      type="button"
      disabled={isOutOfStock}
      onClick={() => !isOutOfStock && onSelectProduct(product)}
      className={`group relative w-full text-left p-2.5 sm:p-3 rounded-xl border transition-all select-none flex flex-col justify-between min-h-[64px] sm:min-h-[72px] cursor-pointer active:scale-[0.97] ${
        isOutOfStock
          ? 'bg-slate-50 border-slate-200 opacity-55 cursor-not-allowed text-slate-400'
          : isInCart
          ? 'bg-red-50/50 border-[#da251d] shadow-2xs hover:border-[#da251d] hover:bg-red-50/70'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs hover:bg-slate-50/50'
      }`}
    >
      {/* Cart Quantity Badge (Top-Right) */}
      {isInCart && (
        <span className="absolute -top-2 -right-2 z-10 bg-[#da251d] text-white font-extrabold text-[11px] h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-sm border-2 border-white animate-in zoom-in duration-100">
          {cartQuantity}
        </span>
      )}

      {/* Out of Stock Overlay Ribbon */}
      {isOutOfStock && (
        <span className="absolute top-1.5 right-1.5 z-10 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
          <Ban className="w-2.5 h-2.5" />
          <span>Hết món</span>
        </span>
      )}

      {/* Top row: Item Code & Badges */}
      <div className="flex items-center justify-between gap-1 w-full text-[10px] text-slate-400 font-mono mb-1">
        <span className="truncate">{product.itemCode}</span>
        <div className="flex items-center gap-1 shrink-0">
          {product.isFlashSale && !isOutOfStock && (
            <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 py-0.2 rounded border border-red-200 flex items-center gap-0.5">
              <Zap className="w-2 h-2 fill-current" />
              <span>Flash</span>
            </span>
          )}
          {hasOptions && !isOutOfStock && (
            <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-1 py-0.2 rounded flex items-center gap-0.5" title="Món có tùy chọn topping/size">
              <SlidersHorizontal className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      </div>

      {/* Middle: Dish Name (Bold, High Contrast, 2 lines max) */}
      <h4
        className={`text-xs sm:text-sm font-bold leading-tight line-clamp-2 mb-1.5 transition-colors ${
          isInCart ? 'text-[#da251d]' : 'text-slate-900 group-hover:text-[#da251d]'
        }`}
      >
        {product.name}
      </h4>

      {/* Bottom row: Effective Price & Touch Indicator */}
      <div className="flex items-baseline justify-between w-full pt-1 border-t border-slate-100">
        <div className="flex items-baseline gap-1">
          {product.discountedPrice && product.discountedPrice < product.price && (
            <span className="text-[10px] text-slate-400 line-through">
              {product.price.toLocaleString('vi-VN')}đ
            </span>
          )}
          <span className="text-xs sm:text-sm font-black text-[#da251d]">
            {(product.effectivePrice ?? product.price ?? 0).toLocaleString('vi-VN')}đ
          </span>
        </div>

        {!isOutOfStock && (
          <span className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-[#da251d] group-hover:text-white text-slate-600 flex items-center justify-center transition-colors shrink-0">
            <Plus className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </button>
  );
};
