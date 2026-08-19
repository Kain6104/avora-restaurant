"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, Star, Heart, Share2, Flame, ArrowRight } from 'lucide-react';
import AddToCartButton from '../../../../components/AddToCartButton';
import { useCart } from '../../../../context/CartContext';

interface ItemDetailClientProps {
  product: any;
  relatedDishes: any[];
}

const getSoldCount = (id: string) => {
  if (!id) return 150;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 500) + 100;
};

export default function ItemDetailClient({ product, relatedDishes }: ItemDetailClientProps) {
  const { currentBranchId } = useCart();
  const { category, optionGroups } = product;

  // Filter related dishes by branch
  const filteredRelatedDishes = useMemo(() => {
    return relatedDishes.filter(p => {
      if (!currentBranchId) return true;
      if (!p.branches || p.branches.length === 0) return true;
      return p.branches.some((b: any) => b.id === currentBranchId);
    }).slice(0, 4); // Keep top 4
  }, [relatedDishes, currentBranchId]);

  return (
    <div className="bg-[#f8f7f5] min-h-screen pb-20 flex flex-col">
      
      {/* Premium Sticky Breadcrumb */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm transition-all">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-3.5 flex items-center gap-2 text-[13px] text-slate-500 overflow-x-auto whitespace-nowrap hide-scrollbar">
          <Link href="/" className="hover:text-red-600 transition-colors font-medium">Trang chủ</Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <Link href={`/${category.slug}`} className="hover:text-red-600 transition-colors font-medium">{category.name}</Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="text-slate-900 font-bold">{product.name}</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-3 md:px-8 py-6 md:py-10 flex-1 flex flex-col w-full">
        
        {/* ─── MAIN PRODUCT AREA ─── */}
        <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-slate-100 p-3 md:p-4 mb-10 md:mb-16 flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-12 relative overflow-hidden">
          
          {/* Decorative blur */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-50 rounded-full blur-3xl opacity-50 pointer-events-none" />

          {/* Left: Image Gallery */}
          <div className="w-full lg:w-[45%] xl:w-[42%] bg-slate-50/50 rounded-[20px] md:rounded-3xl relative p-6 md:p-10 flex items-center justify-center min-h-[300px] md:min-h-[500px] shrink-0 border border-slate-100/80 group overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
            
            {product.badge && (
              <span className="absolute top-4 left-4 md:top-6 md:left-6 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] md:text-[11px] font-black px-3 py-1.5 rounded-full shadow-lg shadow-red-600/20 z-10 uppercase tracking-wide">
                {product.badge}
              </span>
            )}
            
            <div className="absolute top-4 right-4 md:top-6 md:right-6 flex flex-col gap-2 md:gap-3 z-10">
              <button className="w-9 h-9 md:w-11 md:h-11 bg-white rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:scale-110 hover:shadow-lg transition-all border border-slate-100">
                <Heart className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button className="w-9 h-9 md:w-11 md:h-11 bg-white rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-blue-500 hover:scale-110 hover:shadow-lg transition-all border border-slate-100">
                <Share2 className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
            
            <img src={product.imageUrl} alt={product.name} className="w-full h-full max-w-[320px] md:max-w-[400px] object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-700 relative z-10" />
          </div>

          {/* Right: Info & Form */}
          <div className="w-full lg:flex-1 py-2 md:py-6 lg:py-8 pr-2 md:pr-6 lg:pr-8 flex flex-col relative z-10">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Link href={`/${category.slug}`} className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors text-[10px] md:text-xs font-bold rounded-lg uppercase tracking-wider">
                {category.name}
              </Link>
              <div className="flex items-center text-yellow-500 text-xs md:text-sm font-bold bg-yellow-50 px-2.5 py-1.5 rounded-lg border border-yellow-100/50">
                <Star className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current mr-1" />
                <span className="text-yellow-700">4.9 <span className="text-yellow-600/50 font-medium ml-0.5">(128 đánh giá)</span></span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-xs font-medium ml-auto bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                Đã bán <strong className="text-slate-700">{getSoldCount(product.id)}</strong>
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 mb-3 md:mb-5 leading-[1.1] tracking-tight">{product.name}</h1>
            <p className="text-slate-500 text-sm md:text-base mb-6 leading-relaxed max-w-2xl">{product.description}</p>
            
            <div className="h-px w-full bg-slate-100 mb-2 md:mb-4"></div>
            
            <div className="mt-8 flex items-center justify-between p-4 md:p-6 bg-slate-50 border border-slate-100 rounded-3xl">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Giá bán</p>
                <div className="flex items-end gap-3">
                  <p className="text-2xl md:text-3xl font-black text-red-600">{product.price.toLocaleString('vi-VN')}đ</p>
                  {product.oldPrice && (
                    <p className="text-base md:text-lg font-medium text-slate-400 line-through pb-0.5">{product.oldPrice.toLocaleString('vi-VN')}đ</p>
                  )}
                </div>
              </div>
              
              <div className="scale-[1.3] md:scale-[1.5] origin-right">
                <AddToCartButton item={product} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── RELATED DISHES ─── */}
        {filteredRelatedDishes && filteredRelatedDishes.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 md:mb-8 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-rose-100 rounded-xl flex items-center justify-center shadow-inner border border-red-200/50">
                  <Flame className="w-5 h-5 text-red-600 fill-red-600" />
                </div>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 uppercase tracking-tight">Món Tương Tự</h2>
              </div>
              <Link href={`/${category.slug}`} className="flex items-center gap-2 text-slate-500 hover:text-red-600 font-bold text-sm transition-all group self-start md:self-auto">
                Khám phá thêm <div className="w-8 h-8 rounded-full bg-slate-200 group-hover:bg-red-100 flex items-center justify-center transition-colors"><ArrowRight className="w-4 h-4" /></div>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
              {filteredRelatedDishes.map((item: any) => (
                <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 hover:border-red-100 transition-all duration-300 group flex flex-col overflow-hidden">
                  <Link href={`/${category.slug}/${item.slug}`} className="block relative aspect-[4/3] md:aspect-square overflow-hidden bg-slate-50">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {item.badge && (
                      <span className="absolute top-2 left-2 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase">{item.badge}</span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-white/90 backdrop-blur-sm text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">Xem chi tiết</span>
                    </div>
                  </Link>

                  <div className="p-3 md:p-4 flex flex-col flex-1">
                    <Link href={`/${category.slug}/${item.slug}`}>
                      <h3 className="font-bold text-slate-900 text-[13px] md:text-[15px] leading-tight mb-1.5 line-clamp-2 group-hover:text-red-600 transition-colors">{item.name}</h3>
                    </Link>
                    <div className="flex items-center gap-1 mb-2 md:mb-3 text-[10px] text-slate-500">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-slate-700 font-semibold">4.9</span>
                      <span className="text-slate-300">•</span>
                      <span>Đã bán {(item.name.length * 7) % 100 + 20}</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <p className="text-red-600 font-black text-sm md:text-base leading-none">{item.price.toLocaleString('vi-VN')}đ</p>
                      <AddToCartButton item={item} className="w-8 h-8 md:w-9 md:h-9 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 hover:shadow-md hover:shadow-red-600/30" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
