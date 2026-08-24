"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Heart, Star, SlidersHorizontal, Check, Leaf, Ban, ChefHat, LayoutGrid, List, X } from 'lucide-react';
import AddToCartButton from '../../../components/AddToCartButton';
import { useCart } from '../../../context/CartContext';

interface CategoryClientProps {
  category: any;
  categorySlug: string;
}

export default function CategoryClient({ category, categorySlug }: CategoryClientProps) {
  const { currentBranchId, cartItems, flashSaleQuotas } = useCart();
  const { name, image, products } = category;

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortOption, setSortOption] = useState('default');
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [isPromoted, setIsPromoted] = useState(false);

  const filteredProducts = useMemo(() => {
    let result = (products || []).map((p: any) => {
      let dp = { ...p };
      if (dp.isFlashSaleItem || dp.flashSalePrice) {
        const quota = flashSaleQuotas?.[dp.id];
        if (quota !== undefined) {
          const cartQty = cartItems?.filter((c: any) => c.productId === dp.id && c.isFlashSaleItem).reduce((acc: number, curr: any) => acc + curr.quantity, 0) || 0;
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
    }).filter((p: any) => {
      // Branch filter
      if (currentBranchId && p.branches && p.branches.length > 0) {
        if (!p.branches.some((b: any) => b.id === currentBranchId)) return false;
      }

      // Promotion filter
      if (isPromoted && !p.discountedPrice && !p.flashSalePrice && !p.badge) return false;

      // Price range filter
      const activePrice = p.discountedPrice || p.price;
      if (priceRange === 'under_50' && activePrice >= 50000) return false;
      if (priceRange === '50_100' && (activePrice < 50000 || activePrice > 100000)) return false;
      if (priceRange === '100_200' && (activePrice < 100000 || activePrice > 200000)) return false;
      if (priceRange === 'over_200' && activePrice <= 200000) return false;

      return true;
    });

    // Sorting
    if (sortOption === 'price_asc') {
      result.sort((a: any, b: any) => (a.discountedPrice || a.price) - (b.discountedPrice || b.price));
    } else if (sortOption === 'price_desc') {
      result.sort((a: any, b: any) => (b.discountedPrice || b.price) - (a.discountedPrice || a.price));
    } else if (sortOption === 'rating') {
      result.sort((a: any, b: any) => (b.avgRating || 4.9) - (a.avgRating || 4.9)); // Mocking 4.9 as default rating
    }

    return result;
  }, [products, currentBranchId, priceRange, isPromoted, sortOption, flashSaleQuotas, cartItems]);

  const FilterContent = () => (
    <>
      {/* Sort Options */}
      <div className="mb-8">
        <h4 className="font-bold text-slate-800 text-[13px] mb-3">Sắp xếp theo</h4>
        <div className="flex flex-col gap-1.5">
          {[
            { id: 'default', label: 'Phổ biến nhất' },
            { id: 'price_asc', label: 'Mới nhất' }, // Mock label to match image
            { id: 'price_asc2', label: 'Giá: Thấp đến Cao' },
            { id: 'price_desc', label: 'Giá: Cao đến Thấp' },
            { id: 'rating', label: 'Đánh giá cao' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setSortOption(opt.id === 'price_asc2' ? 'price_asc' : opt.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors ${sortOption === (opt.id === 'price_asc2' ? 'price_asc' : opt.id) ? 'bg-[#FFF4ED] text-[#E55B32] font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${sortOption === (opt.id === 'price_asc2' ? 'price_asc' : opt.id) ? 'border-[#E55B32]' : 'border-slate-300'}`}>
                {sortOption === (opt.id === 'price_asc2' ? 'price_asc' : opt.id) && <div className="w-2 h-2 rounded-full bg-[#E55B32]" />}
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-slate-100 mb-8" />

      {/* Price Range */}
      <div className="mb-6">
        <h4 className="font-bold text-slate-800 text-[13px] mb-3">Khoảng giá</h4>
        <div className="flex flex-col gap-1.5">
          {[
            { id: null, label: 'Tất cả mức giá' },
            { id: 'under_50', label: 'Dưới 50.000đ' },
            { id: '50_100', label: '50.000đ - 100.000đ' },
            { id: '100_200', label: '100.000đ - 200.000đ' },
            { id: 'over_200', label: 'Trên 200.000đ' },
          ].map(opt => (
            <button
              key={opt.id || 'all'}
              onClick={() => setPriceRange(opt.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors ${priceRange === opt.id ? 'text-[#E55B32] font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${priceRange === opt.id ? 'border-[#E55B32] bg-[#E55B32]' : 'border-slate-300 bg-white'}`}>
                {priceRange === opt.id && <Check className="w-3 h-3 text-white" />}
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="bg-[#FAF9F5] min-h-screen relative font-sans">

      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 md:py-8">

        {/* 1. HERO BANNER */}
        <div
          className="relative w-full bg-[#FEFDFB] rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.02)] overflow-hidden mb-10 flex flex-col md:flex-row items-center border border-slate-100"
          style={{ backgroundImage: "url('/background_1.png')", backgroundPosition: 'right center', backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }}
        >
          {/* Fallback gradient if image fails/loads slow */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#FEFDFB] via-[#FEFDFB]/90 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 p-8 md:p-12 w-full">
            <div className="w-32 h-32 md:w-[160px] md:h-[160px] rounded-full mx-auto md:mx-0 shrink-0 border-[6px] border-white shadow-lg overflow-hidden">
              <img src={image || 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400'} alt={name} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col text-center md:text-left mt-2 md:mt-4 w-full">
              <h1 className="text-[22px] sm:text-3xl md:text-4xl font-black text-[#3E2723] mb-2 md:mb-3 uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">{name}</h1>
              <p className="text-slate-500 text-[13px] md:text-[15px] leading-relaxed max-w-xl mx-auto md:mx-0 mb-4 md:mb-6 line-clamp-2 md:line-clamp-none">
                Khám phá hương vị tinh khiết từ đại dương với các loại {name.toLowerCase()} tươi ngon, được chọn lọc kỹ lưỡng mỗi ngày bởi các đầu bếp của Avora.
              </p>
              <div className="flex flex-row items-center justify-start md:justify-start gap-4 md:gap-6 overflow-x-auto hide-scrollbar w-full whitespace-nowrap pb-1">
                <div className="flex items-center gap-1.5 md:gap-2 text-[#5D4037] text-xs md:text-sm font-medium shrink-0">
                  <Leaf className="w-3.5 h-3.5 md:w-4 md:h-4" /> Tươi mới mỗi ngày
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 text-[#5D4037] text-xs md:text-sm font-medium shrink-0">
                  <Ban className="w-3.5 h-3.5 md:w-4 md:h-4" /> Không chất bảo quản
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 text-[#5D4037] text-xs md:text-sm font-medium shrink-0">
                  <ChefHat className="w-3.5 h-3.5 md:w-4 md:h-4" /> Chuẩn vị Nhật Bản
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Filter Bar (Moved outside to fix layout/sticky issues) */}
        <div className="lg:hidden sticky top-[60px] md:top-[80px] z-[40] bg-[#FAF9F5] py-3 mb-6 -mx-4 px-4 flex items-center gap-3 overflow-x-auto hide-scrollbar shadow-sm">
          <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-100 text-sm font-bold text-[#3E2723] shrink-0 hover:bg-slate-50">
            <SlidersHorizontal className="w-4 h-4 text-[#E55B32]" />
            Bộ Lọc
          </button>
          <button onClick={() => { setSortOption(sortOption === 'price_asc' ? 'default' : 'price_asc') }} className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-colors border shadow-sm ${sortOption === 'price_asc' ? 'bg-[#FFF4ED] border-[#E55B32]/30 text-[#E55B32]' : 'bg-white border-slate-100 text-[#E55B32] hover:bg-slate-50'}`}>
            Giá thấp nhất
          </button>
        </div>

        {/* 2-Column Layout */}
        <div className="flex flex-col lg:flex-row gap-8">

          {/* 2. SIDEBAR FILTER */}
          <div className="hidden lg:block w-[260px] shrink-0">
            <div className="bg-white rounded-3xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.02)] sticky top-[100px]">
              <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
                <SlidersHorizontal className="w-5 h-5 text-[#E55B32]" />
                <h3 className="font-bold text-base text-[#3E2723] tracking-wide uppercase">
                  Bộ Lọc
                </h3>
              </div>

              <FilterContent />
            </div>
          </div>

          {/* Product Grid Area */}
          <div className="flex-1 min-w-0">

            {/* Top Bar */}
            <div className="hidden lg:flex mb-6 items-center justify-between">
              <span className="text-[13px] md:text-sm text-slate-500">
                Hiển thị <strong className="text-[#E55B32]">{filteredProducts.length}</strong> kết quả
              </span>
              <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-100 p-1 shadow-sm">
                <button className="w-8 h-8 rounded flex items-center justify-center bg-[#FFF4ED] text-[#E55B32]">
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-slate-600">
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3. PRODUCT GRID */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredProducts.map((item: any) => (
                <div key={item.id} className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group flex flex-col relative overflow-hidden">

                  <Link href={`/${categorySlug}/${item.slug}`} className="block relative aspect-[4/3] bg-[#F8F7F5] w-full overflow-hidden">
                    <img src={item.imageUrl || item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />

                    {/* Badges */}
                    {item.isBestSeller && (
                      <div className="absolute top-3 left-3 bg-[#E55B32] text-white text-[9px] md:text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                        Best Seller
                      </div>
                    )}

                    {/* Heart */}
                    <button className="absolute top-3 right-3 w-7 h-7 bg-white/90 hover:bg-white text-slate-400 hover:text-red-500 rounded-full flex items-center justify-center transition-colors shadow-sm">
                      <Heart className="w-3.5 h-3.5" />
                    </button>
                  </Link>

                  <div className="p-3 md:p-4 flex flex-col flex-1">
                    <Link href={`/${categorySlug}/${item.slug}`}>
                      <h3 className="font-bold text-[#3E2723] text-[13px] md:text-[14px] leading-tight mb-1 line-clamp-2 group-hover:text-[#E55B32] transition-colors">{item.name}</h3>
                    </Link>

                    <div className="flex items-center gap-1 mb-3 text-[10px] md:text-[11px] text-slate-500">
                      <Star className="w-3 h-3 fill-[#FFD12A] text-[#FFD12A]" />
                      <span className="font-bold text-[#3E2723]">{item.avgRating > 0 ? item.avgRating.toFixed(1) : "4.9"}</span>
                      <span>({item.soldQuantity > 0 ? item.soldQuantity : 60} đánh giá)</span>
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[#E55B32] font-bold text-sm md:text-base leading-none">{(item.flashSalePrice || item.discountedPrice || item.price).toLocaleString('vi-VN')}đ</span>
                      </div>

                      <AddToCartButton
                        item={item}
                        className="w-7 h-7 md:w-8 md:h-8 bg-white border border-[#E55B32] text-[#E55B32] hover:bg-[#E55B32] hover:text-white rounded-full flex items-center justify-center transition-all duration-300 shrink-0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] mt-4">
                <img src="https://illustrations.popsy.co/amber/falling.svg" className="w-48 h-48 mx-auto mb-4 opacity-50" alt="Empty" />
                <p className="text-slate-500 font-medium text-lg">Không tìm thấy món ăn nào phù hợp với bộ lọc.</p>
                <button onClick={() => { setSortOption('default'); setPriceRange(null); setIsPromoted(false); }} className="mt-4 px-6 py-2 bg-[#FFF4ED] text-[#E55B32] font-bold rounded-full hover:bg-[#ffe4d6] transition-colors">Xóa bộ lọc</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-[9999] lg:hidden flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)} />
          <div className="relative w-[280px] bg-white h-[100dvh] shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-lg text-[#3E2723]">Bộ Lọc</h3>
              <button onClick={() => setIsFilterOpen(false)} className="p-2 -mr-2 text-slate-400 hover:bg-slate-50 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <FilterContent />
            </div>
            <div className="p-4 border-t border-slate-100 shrink-0 bg-white">
              <button onClick={() => setIsFilterOpen(false)} className="w-full bg-[#E55B32] text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-red-600 active:scale-95 transition-all">
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
