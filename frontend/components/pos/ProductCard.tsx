"use client";

import React from 'react';
import Image from 'next/image';
import { Plus, Zap, Flame, Utensils, SlidersHorizontal, Ban } from 'lucide-react';
import { PosProduct } from './pos-types';
import { BuffetRibbonTag } from '../ui/BuffetRibbonTag';

interface ProductCardProps {
  product: PosProduct;
  cartQuantity?: number;
  isBuffetEligible?: boolean;
  onSelectProduct: (product: PosProduct) => void;
  onToggleAvailability?: (product: PosProduct) => void;
  isDarkMode?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  cartQuantity = 0,
  isBuffetEligible = false,
  onSelectProduct,
  onToggleAvailability,
  isDarkMode = false,
}) => {
  const hasOptions = product.optionGroups && product.optionGroups.length > 0;
  const isOutOfStock = !product.available;
  const isInCart = cartQuantity > 0;
  const isBuffet =
    isBuffetEligible ||
    product.isBuffetTicket ||
    product.isBuffetItem ||
    product.categorySlug === 'buffet' ||
    product.categoryName?.toLowerCase().includes('buffet');

  return (
    <div
      onClick={() => !isOutOfStock && onSelectProduct(product)}
      className={`group relative rounded-xl border transition-all select-none flex flex-col justify-between overflow-hidden cursor-pointer active:scale-[0.98] ${
        isOutOfStock
          ? isDarkMode
            ? 'border-slate-800 opacity-60 bg-slate-950/70 cursor-not-allowed'
            : 'border-slate-200 opacity-60 bg-slate-50/70 cursor-not-allowed'
          : isInCart
          ? 'border-[#da251d] shadow-2xs ring-1 ring-[#da251d]/30 ' + (isDarkMode ? 'bg-[#1e2738]' : 'bg-white')
          : isDarkMode
          ? 'bg-[#1e2738] border-[#2c374c] hover:border-slate-500 hover:bg-[#253046] hover:shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* Ribbon Tag BUFFET */}
      {isBuffet && <BuffetRibbonTag />}

      {/* Cart Quantity Badge (Prominent Top Right) */}
      {isInCart && (
        <span className="absolute top-2 right-2 z-20 bg-[#da251d] text-white font-extrabold text-xs h-6 min-w-[24px] px-1.5 rounded-full flex items-center justify-center shadow-md border-2 border-white animate-in zoom-in duration-100">
          {cartQuantity}
        </span>
      )}

      {/* Badges Top Left: Flash Sale / Best Seller */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {isOutOfStock ? (
          <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
            <Ban className="w-3 h-3" />
            <span>Hết món</span>
          </span>
        ) : product.isFlashSale ? (
          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
            <Zap className="w-3 h-3 fill-current" />
            <span>Flash Sale</span>
          </span>
        ) : product.isBestSeller ? (
          <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
            <Flame className="w-3 h-3 fill-current" />
            <span>Bán chạy</span>
          </span>
        ) : null}
      </div>

      {/* Options Count Pill Top Right (only shown if not in cart or placed next to badge) */}
      {hasOptions && !isOutOfStock && !isInCart && (
        <span className={`absolute top-2 right-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-xs flex items-center gap-1 ${
          isDarkMode
            ? 'bg-slate-800/95 text-slate-200 border-slate-600'
            : 'bg-white/95 backdrop-blur-xs text-slate-700 border-slate-200'
        }`}>
          <SlidersHorizontal className={`w-2.5 h-2.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
          <span>Tùy chọn</span>
        </span>
      )}

      {/* Product Image Area */}
      <div className={`relative w-full aspect-4/3 overflow-hidden ${isDarkMode ? 'bg-[#151c29]' : 'bg-slate-100'}`}>
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
              isOutOfStock ? 'grayscale' : ''
            }`}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>
            <Utensils className="w-8 h-8 stroke-[1.5]" />
          </div>
        )}
      </div>

      {/* Product Details Body */}
      <div className="p-2.5 sm:p-3 flex flex-col justify-between flex-1">
        <div>
          <div className={`flex items-center justify-between text-[10px] font-mono mb-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-400'}`}>
            <span className="truncate pr-1">{product.itemCode}</span>
            <span className="shrink-0 font-bold">{product.unit || 'Phần'}</span>
          </div>
          <h4 className={`text-xs sm:text-sm font-bold line-clamp-2 leading-snug transition-colors ${
            isDarkMode
              ? 'text-white group-hover:text-red-400'
              : 'text-slate-900 group-hover:text-[#da251d]'
          }`}>
            {product.name}
          </h4>
        </div>

        {/* Price and Add Touch Target (>= 40px) */}
        <div className={`mt-2 pt-2 border-t flex items-center justify-between gap-1 ${
          isDarkMode ? 'border-[#2c374c]' : 'border-slate-100'
        }`}>
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              {(product.isFlashSale || (product.discountedPrice && product.discountedPrice < product.price)) && (
                <span className={`text-[11px] line-through ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                  {product.price.toLocaleString('vi-VN')}đ
                </span>
              )}
              <span className={`text-xs sm:text-sm font-black ${isDarkMode ? 'text-red-400' : 'text-[#da251d]'}`}>
                {(product.effectivePrice ?? product.price ?? 0).toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>

          {/* Touch-first Add Button (min 36x36px to 40x40px) */}
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={(e) => {
              e.stopPropagation();
              if (!isOutOfStock) onSelectProduct(product);
            }}
            aria-label={`Thêm ${product.name}`}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer ${
              isOutOfStock
                ? isDarkMode ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : isInCart
                ? 'bg-[#da251d] text-white shadow-xs hover:bg-[#b81d16]'
                : isDarkMode
                ? 'bg-red-950/60 border border-red-800/60 text-red-400 group-hover:bg-[#da251d] group-hover:text-white shadow-2xs'
                : 'bg-red-50 text-[#da251d] group-hover:bg-[#da251d] group-hover:text-white shadow-2xs'
            }`}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
