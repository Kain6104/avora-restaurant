"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, ChevronRight, Grid, Heart } from 'lucide-react';
import AddToCartButton from '../../../components/AddToCartButton';
import { useCart } from '../../../context/CartContext';

interface MenuClientProps {
  initialCategories: any[];
}

export default function MenuClient({ initialCategories }: MenuClientProps) {
  const { currentBranchId, cartItems, flashSaleQuotas } = useCart();
  const [activeCategory, setActiveCategory] = useState<string>('');
  
  // Filter products by branch
  const filteredCategories = React.useMemo(() => {
    return initialCategories.map(cat => {
      return {
        ...cat,
        products: cat.products.map((p: any) => {
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
          if (!currentBranchId) return true; // Show all if no branch selected
          if (!p.branches || p.branches.length === 0) return true; // Show if product has no branch restriction
          return p.branches.some((b: any) => b.id === currentBranchId);
        })
      };
    }).filter(cat => cat.products.length > 0); // Only keep categories with products
  }, [initialCategories, currentBranchId, cartItems, flashSaleQuotas]);

  useEffect(() => {
    if (filteredCategories.length > 0 && !activeCategory) {
      setActiveCategory(filteredCategories[0].id);
    }
  }, [filteredCategories]);

  // Scrollspy logic
  useEffect(() => {
    const handleScroll = () => {
      const categorySections = document.querySelectorAll('[data-category-section]');
      let currentActive = '';
      
      categorySections.forEach((section: any) => {
        const sectionTop = section.offsetTop - 150; // offset for sticky header
        if (window.scrollY >= sectionTop) {
          currentActive = section.id;
        }
      });
      
      if (currentActive) setActiveCategory(currentActive);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToCategory = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
      setActiveCategory(id);
    }
  };

  return (
    <div className="bg-[#f8f7f5] min-h-screen pb-24 md:pb-12">
      {/* Premium Breadcrumb */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm transition-all">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-3.5 flex items-center gap-2 text-[13px] text-slate-500 overflow-x-auto whitespace-nowrap hide-scrollbar">
          <Link href="/" className="hover:text-red-600 transition-colors font-medium">Trang chủ</Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="text-slate-900 font-bold">Thực đơn</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-3 md:px-8 py-6 md:py-10 flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        
        {/* Sidebar / Top Nav for mobile */}
        <div className="w-full md:w-[280px] shrink-0 md:sticky md:top-[160px] z-30">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-slate-100 p-2 md:p-5 flex gap-2 md:flex-col overflow-x-auto md:overflow-visible hide-scrollbar snap-x">
            <div className="hidden md:flex items-center gap-2 mb-4 px-3">
              <div className="w-8 h-8 bg-gradient-to-br from-red-100 to-rose-100 rounded-xl flex items-center justify-center border border-red-200/50">
                <Grid className="w-4 h-4 text-red-600" />
              </div>
              <h2 className="font-black text-slate-900 text-lg uppercase tracking-tight">Danh mục</h2>
            </div>
            
            {filteredCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`snap-start shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm md:text-base border border-transparent whitespace-nowrap md:whitespace-normal text-left ${
                  activeCategory === cat.id 
                    ? 'bg-gradient-to-r from-red-50 to-rose-50 text-red-600 border-red-100 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-red-500'
                }`}
              >
                {cat.image && (
                  <img src={cat.image} className="w-8 h-8 rounded-full object-cover hidden md:block border border-slate-200" alt={cat.name} />
                )}
                <span className="flex-1">{cat.name}</span>
                <span className={`hidden md:flex text-[10px] px-2.5 py-0.5 rounded-full font-black ${activeCategory === cat.id ? 'bg-red-200 text-red-800' : 'bg-slate-100 text-slate-500'}`}>
                  {cat.products.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Products List */}
        <div className="flex-1 min-w-0 flex flex-col gap-10 md:gap-14 w-full">
          {filteredCategories.map(cat => (
            <div key={cat.id} id={cat.id} data-category-section className="scroll-mt-32">
              <div className="flex items-center gap-4 mb-5 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">{cat.name}</h2>
                <div className="h-px bg-gradient-to-r from-slate-200 to-transparent flex-1 hidden sm:block"></div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
                {cat.products.map((item: any) => (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-100/80 hover:shadow-xl hover:-translate-y-1 hover:border-red-100 transition-all duration-300 group flex flex-col overflow-hidden">
                    <Link href={`/${cat.slug}/${item.slug}`} className="block relative aspect-[4/3] md:aspect-square overflow-hidden bg-slate-50">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {item.badge && (
                        <span className="absolute top-2 left-2 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[9px] md:text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wide">
                          {item.badge}
                        </span>
                      )}
                      
                      <button className="absolute top-2 right-2 w-7 h-7 md:w-8 md:h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500 z-10">
                        <Heart className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400 hover:text-red-500" />
                      </button>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="bg-white/95 backdrop-blur-sm text-slate-900 text-xs font-bold px-4 py-2 rounded-full shadow-lg">Xem chi tiết</span>
                      </div>
                    </Link>

                    <div className="p-3 md:p-4 flex flex-col flex-1">
                      <Link href={`/${cat.slug}/${item.slug}`}>
                        <h3 className="font-bold text-slate-900 text-[13px] md:text-[15px] leading-tight mb-1.5 line-clamp-2 group-hover:text-red-600 transition-colors">{item.name}</h3>
                      </Link>
                      
                      <div className="flex items-center gap-1 mb-2.5 text-[10px] text-slate-500">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-slate-700 font-semibold">4.9</span>
                        <span className="text-slate-300">•</span>
                        <span>Đã bán {(item.name.length * 17) % 500 + 100}</span>
                      </div>
                      
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <div>
                          <p className="text-red-600 font-black text-sm md:text-base leading-none">{item.price.toLocaleString('vi-VN')}đ</p>
                          {item.oldPrice && (
                            <p className="text-slate-400 text-[10px] line-through mt-0.5">{item.oldPrice.toLocaleString('vi-VN')}đ</p>
                          )}
                        </div>
                        <AddToCartButton item={item} className="w-8 h-8 md:w-10 md:h-10 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 hover:shadow-md hover:shadow-red-600/30" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4 border border-slate-200">
                <Grid className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Chi nhánh này chưa có món ăn</h3>
              <p className="text-slate-500">Vui lòng chọn chi nhánh khác hoặc quay lại sau.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
