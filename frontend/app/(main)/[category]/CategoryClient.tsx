"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Heart, Star, SlidersHorizontal, Check, X } from 'lucide-react';
import AddToCartButton from '../../../components/AddToCartButton';
import { useCart } from '../../../context/CartContext';

interface CategoryClientProps {
  category: any;
  categorySlug: string;
}

export default function CategoryClient({ category, categorySlug }: CategoryClientProps) {
  const { currentBranchId } = useCart();
  const { name, image, products } = category;

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortOption, setSortOption] = useState('default');
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [isPromoted, setIsPromoted] = useState(false);

  const filteredProducts = useMemo(() => {
    let result = (products || []).filter((p: any) => {
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
  }, [products, currentBranchId, priceRange, isPromoted, sortOption]);

  const FilterContent = () => (
    <>
      {/* Sort Options */}
      <div className="mb-6">
        <h4 className="font-bold text-slate-800 text-sm mb-3">Sắp xếp theo</h4>
        <div className="flex flex-col gap-2">
          {[
            { id: 'default', label: 'Phổ biến nhất' },
            { id: 'price_asc', label: 'Giá: Thấp đến Cao' },
            { id: 'price_desc', label: 'Giá: Cao đến Thấp' },
            { id: 'rating', label: 'Đánh giá cao' },
          ].map(opt => (
            <button key={opt.id} onClick={() => setSortOption(opt.id)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${sortOption === opt.id ? 'bg-red-50 text-red-600' : 'hover:bg-slate-50 text-slate-600'}`}>
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${sortOption === opt.id ? 'border-red-600' : 'border-slate-300'}`}>
                {sortOption === opt.id && <div className="w-2 h-2 rounded-full bg-red-600" />}
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-slate-100 mb-6" />

      {/* Price Range */}
      <div className="mb-6">
        <h4 className="font-bold text-slate-800 text-sm mb-3">Khoảng giá</h4>
        <div className="flex flex-col gap-2">
          {[
            { id: null, label: 'Tất cả mức giá' },
            { id: 'under_50', label: 'Dưới 50.000đ' },
            { id: '50_100', label: '50.000đ - 100.000đ' },
            { id: '100_200', label: '100.000đ - 200.000đ' },
            { id: 'over_200', label: 'Trên 200.000đ' },
          ].map(opt => (
            <button key={opt.id || 'all'} onClick={() => setPriceRange(opt.id)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${priceRange === opt.id ? 'bg-red-50 text-red-600' : 'hover:bg-slate-50 text-slate-600'}`}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${priceRange === opt.id ? 'border-red-600 bg-red-600' : 'border-slate-300 bg-white'}`}>
                {priceRange === opt.id && <Check className="w-3 h-3 text-white" />}
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-slate-100 mb-6" />

      {/* Promoted Only */}
      <div>
        <button onClick={() => setIsPromoted(!isPromoted)} className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
          <span className="font-bold text-slate-800 text-sm">Đang khuyến mãi</span>
          <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isPromoted ? 'bg-red-600' : 'bg-slate-200'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isPromoted ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
        </button>
      </div>
    </>
  );

  return (
    <div className="bg-[#f8f7f5] min-h-screen pb-20 relative">

      {/* Breadcrumb */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm transition-all">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-3.5 flex items-center gap-2 text-[13px] text-slate-500 overflow-x-auto whitespace-nowrap hide-scrollbar">
          <Link href="/" className="hover:text-red-600 transition-colors font-medium">Trang chủ</Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="text-slate-900 font-bold">{name}</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 md:py-10">
        {/* Category Header */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-8 bg-white p-6 md:p-8 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-slate-100">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-50 p-2 border border-slate-100 shrink-0 shadow-inner">
            <img src={image || 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400'} alt={name} className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight">{name}</h1>
            <p className="text-slate-500 text-sm md:text-base">Khám phá hương vị đặc trưng của {name}</p>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar Filter (Desktop) */}
          <div className="hidden lg:block w-[280px] shrink-0">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 sticky top-[130px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-red-600" />
                  BỘ LỌC
                </h3>
                {(priceRange || isPromoted || sortOption !== 'default') && (
                  <button onClick={() => { setSortOption('default'); setPriceRange(null); setIsPromoted(false); }} className="text-xs font-bold text-red-600 hover:underline">Xóa lọc</button>
                )}
              </div>
              
              <FilterContent />
            </div>
          </div>

          {/* Product Grid Area */}
          <div className="flex-1 min-w-0">
            
            {/* Mobile Filter Bar */}
            <div className="lg:hidden sticky top-[95px] md:top-[115px] z-[40] bg-[#f8f7f5] py-2 mb-4 -mx-4 px-4 flex items-center gap-2 overflow-x-auto hide-scrollbar">
              <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 text-sm font-bold text-slate-700 shrink-0 hover:bg-slate-50">
                <SlidersHorizontal className="w-4 h-4 text-red-600" />
                Lọc & Sắp xếp
                {(priceRange || isPromoted || sortOption !== 'default') && (
                  <span className="w-2 h-2 rounded-full bg-red-600 ml-0.5" />
                )}
              </button>
              <button onClick={() => setIsPromoted(!isPromoted)} className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border shadow-sm ${isPromoted ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Đang khuyến mãi</button>
              <button onClick={() => { setSortOption(sortOption === 'price_asc' ? 'default' : 'price_asc') }} className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border shadow-sm ${sortOption === 'price_asc' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Giá thấp nhất</button>
            </div>

            <div className="mb-4 flex items-center justify-between text-sm text-slate-500 px-1">
              <span>Hiển thị <strong>{filteredProducts.length}</strong> kết quả</span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
              {filteredProducts.map((item: any) => (
                <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 hover:border-red-100 transition-all duration-300 group flex flex-col overflow-hidden">
                  <Link href={`/${categorySlug}/${item.slug}`} className="block relative aspect-[4/3] md:aspect-square overflow-hidden bg-slate-50">
                    <img src={item.imageUrl || item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1.5 align-start">
                      {item.badge && (
                        <span className="bg-gradient-to-r from-red-600 to-rose-600 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase w-fit">{item.badge}</span>
                      )}
                      {(item.discountedPrice || item.flashSalePrice) && (
                        <span className="bg-yellow-400 text-yellow-900 text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase w-fit">Giảm giá</span>
                      )}
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-white/90 backdrop-blur-sm text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">Xem chi tiết</span>
                    </div>
                  </Link>

                  <div className="p-3 md:p-4 flex flex-col flex-1">
                    <Link href={`/${categorySlug}/${item.slug}`}>
                      <h3 className="font-bold text-slate-900 text-[13px] md:text-[15px] leading-tight mb-1.5 line-clamp-2 group-hover:text-red-600 transition-colors">{item.name}</h3>
                    </Link>
                    <div className="flex items-center gap-1 mb-2 md:mb-3 text-[10px] text-slate-500">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-slate-700 font-semibold">{item.avgRating || 4.9}</span>
                      <span className="text-slate-300">•</span>
                      <span>Đã bán {item.soldQuantity || (item.name.length * 7) % 100 + 20}</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        {(item.discountedPrice || item.flashSalePrice) && (
                          <span className="text-[10px] md:text-xs text-slate-400 line-through mb-0.5">{item.price.toLocaleString('vi-VN')}đ</span>
                        )}
                        <span className="text-red-600 font-black text-sm md:text-base leading-none">{(item.discountedPrice || item.flashSalePrice || item.price).toLocaleString('vi-VN')}đ</span>
                      </div>
                      <AddToCartButton item={item} className="w-8 h-8 md:w-9 md:h-9 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 hover:shadow-md hover:shadow-red-600/30" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm mt-4">
                <img src="https://illustrations.popsy.co/amber/falling.svg" className="w-48 h-48 mx-auto mb-4 opacity-50" alt="Empty" />
                <p className="text-slate-500 font-medium text-lg">Không tìm thấy món ăn nào phù hợp với bộ lọc.</p>
                <button onClick={() => { setSortOption('default'); setPriceRange(null); setIsPromoted(false); }} className="mt-4 px-6 py-2 bg-red-50 text-red-600 font-bold rounded-full hover:bg-red-100 transition-colors">Xóa bộ lọc</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Bottom Sheet) */}
      <div className={`fixed inset-0 z-[100] lg:hidden transition-opacity duration-300 ${isFilterOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)} />
        <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl transition-transform duration-300 ease-out shadow-2xl ${isFilterOpen ? 'translate-y-0' : 'translate-y-full'}`} style={{ maxHeight: '85vh' }}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
            <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-red-600" />
              Bộ lọc
            </h3>
            <button onClick={() => setIsFilterOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
            <FilterContent />
          </div>
          
          <div className="p-4 border-t border-slate-100 flex items-center gap-3 bg-white sticky bottom-0">
            <button onClick={() => { setSortOption('default'); setPriceRange(null); setIsPromoted(false); }} className="px-6 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex-1">Thiết lập lại</button>
            <button onClick={() => setIsFilterOpen(false)} className="px-6 py-3.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex-1">Xem {filteredProducts.length} kết quả</button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
