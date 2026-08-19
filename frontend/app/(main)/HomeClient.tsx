"use client";

import React, { useMemo } from 'react';
import {
  ArrowRight, Truck, Leaf, ShieldCheck, Zap, Gift, Star, Package, User, Flame, ChevronRight, ChevronLeft, Heart
} from 'lucide-react';
import Link from 'next/link';
import HeroBanner from '../../components/HeroBanner';
import AddToCartButton from '../../components/AddToCartButton';
import { useCart } from '../../context/CartContext';

interface HomeClientProps {
  banners: any[];
  categories: any[];
  bestSellers: any[];
  aiRecommended: any[];
}

export default function HomeClient({ banners, categories, bestSellers, aiRecommended }: HomeClientProps) {
  const { currentBranchId } = useCart();

  // Filter products by branch
  const filteredBestSellers = useMemo(() => {
    return bestSellers.filter(p => {
      if (!currentBranchId) return true;
      if (!p.branches || p.branches.length === 0) return true;
      return p.branches.some((b: any) => b.id === currentBranchId);
    });
  }, [bestSellers, currentBranchId]);

  const filteredAiRecommended = useMemo(() => {
    return aiRecommended.filter(p => {
      if (!currentBranchId) return true;
      if (!p.branches || p.branches.length === 0) return true;
      return p.branches.some((b: any) => b.id === currentBranchId);
    });
  }, [aiRecommended, currentBranchId]);

  return (
    <div className="bg-[#f8f7f5] font-sans pb-20 md:pb-0 overflow-x-hidden">

      {/* ─── HERO BANNER ─── */}
      <HeroBanner slides={banners} />

      {/* ─── CATEGORIES ─── */}
      <section className="relative z-40 max-w-[1400px] mx-auto px-3 md:px-8 -mt-4 md:-mt-14 mb-8 md:mb-14">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl md:rounded-3xl shadow-[0_8px_48px_rgba(0,0,0,0.08)] py-3 md:py-5 px-4 md:px-10 overflow-x-auto hide-scrollbar flex items-center gap-3 md:gap-5 border border-white/80">
          {/* All */}
          <Link href="/menu" className="flex flex-col items-center gap-1.5 shrink-0 group">
            <div className="w-11 h-11 md:w-[64px] md:h-[64px] rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-red-600/30 group-hover:-translate-y-1.5 transition-all duration-300 ring-2 ring-red-100">
              <svg className="w-5 h-5 md:w-7 md:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            </div>
            <span className="text-[10px] md:text-[11px] font-extrabold text-red-600 whitespace-nowrap uppercase tracking-wide">Tất cả</span>
          </Link>

          {categories?.map((cat: any) => (
            <Link key={cat.id} href={`/${cat.slug}`} className="flex flex-col items-center gap-1.5 shrink-0 group">
              <div className="w-11 h-11 md:w-[64px] md:h-[64px] rounded-full bg-white flex items-center justify-center p-0.5 group-hover:-translate-y-1.5 transition-all duration-300 shadow-sm border border-slate-100 group-hover:border-red-300 group-hover:shadow-md group-hover:shadow-red-100 ring-2 ring-transparent group-hover:ring-red-100">
                <img src={cat.image} alt={cat.name} className="w-full h-full object-cover rounded-full" />
              </div>
              <span className="text-[10px] md:text-[11px] font-semibold text-slate-600 group-hover:text-red-600 transition-colors whitespace-nowrap">{cat.name}</span>
            </Link>
          ))}

          <Link href="/menu" className="flex flex-col items-center gap-1.5 shrink-0 group ml-auto">
            <div className="w-11 h-11 md:w-[64px] md:h-[64px] rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:-translate-y-1.5 transition-all duration-300 border border-slate-200 group-hover:border-red-200 group-hover:bg-red-50">
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-red-600 transition-colors" />
            </div>
            <span className="text-[10px] md:text-[11px] font-semibold text-slate-400 group-hover:text-red-600 transition-colors whitespace-nowrap">Xem tất cả</span>
          </Link>
        </div>
      </section>

      {/* ─── FLASH SALE — Desktop ─── */}
      {filteredBestSellers.length > 0 && (
      <section className="mb-10 md:mb-16 relative">
        {/* Desktop */}
        <div className="hidden md:block max-w-[1400px] mx-auto px-8">
          <div className="bg-gradient-to-r from-[#1a0a00] via-[#c41e3a] to-[#1a0a00] rounded-[32px] p-8 relative overflow-hidden shadow-2xl">
            {/* Decorative layers */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.04]" />
            <div className="absolute -top-16 -right-16 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 left-20 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="bg-yellow-400 rounded-xl w-12 h-12 flex items-center justify-center shadow-lg shadow-yellow-400/40">
                    <Zap className="w-7 h-7 text-yellow-900 fill-yellow-900" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white italic tracking-widest leading-none">FLASH SALE</h2>
                    <p className="text-white/60 text-xs font-medium tracking-widest uppercase mt-0.5">Ưu đãi có hạn, số lượng ít!</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/70 font-medium text-sm">Kết thúc trong:</span>
                  <div className="flex gap-1.5 items-center">
                    {['02', '45', '10'].map((t, i) => (
                      <React.Fragment key={i}>
                        <div className="bg-black/50 backdrop-blur-sm text-white font-black text-base w-10 h-10 flex items-center justify-center rounded-xl border border-white/10">
                          {t}
                        </div>
                        {i < 2 && <span className="text-yellow-400 font-black text-xl leading-none">:</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {filteredBestSellers.slice(0, 4).map((item: any, idx: number) => (
                  <Link key={idx} href={`/${item.category?.slug || item.categoryId}/${item.slug}`}
                    className="bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 rounded-2xl p-3 flex gap-3 transition-all duration-300 hover:-translate-y-1 group">
                    <div className="w-20 h-20 shrink-0 relative rounded-xl overflow-hidden">
                      <img src={item.imageUrl} alt="sale" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute top-0 left-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-1.5 py-0.5 rounded-br-xl">-50%</div>
                    </div>
                    <div className="flex flex-col flex-1 justify-center">
                      <h3 className="font-bold text-white text-sm mb-1 leading-tight line-clamp-2">{item.name}</h3>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-yellow-400 font-black text-base">{item.price.toLocaleString('vi-VN')}đ</span>
                      </div>
                      <div className="w-full bg-black/30 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 h-1.5 rounded-full animate-pulse" style={{ width: `${65 + idx * 8}%` }} />
                      </div>
                      <span className="text-white/60 text-[10px] mt-1">Đã bán {65 + idx * 8}%</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Flash Sale */}
        <div className="md:hidden px-3">
          <div className="bg-gradient-to-br from-[#1a0a00] via-red-700 to-[#c41e3a] rounded-2xl p-4 relative overflow-hidden shadow-xl">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05]" />
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-yellow-900 fill-yellow-900" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white italic tracking-wider leading-none">FLASH SALE</h2>
                  <p className="text-white/50 text-[9px] uppercase tracking-widest">Ưu đãi có hạn</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {['02', '45', '10'].map((t, i) => (
                  <React.Fragment key={i}>
                    <span className="bg-black/40 text-white text-[11px] font-black w-7 h-7 flex items-center justify-center rounded-lg border border-white/10">{t}</span>
                    {i < 2 && <span className="text-yellow-400 font-black text-sm">:</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="relative z-10 flex gap-2.5 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-1 -mx-1 px-1">
              {filteredBestSellers.slice(0, 6).map((item: any, idx: number) => (
                <Link key={idx} href={`/${item.category?.slug || item.categoryId}/${item.slug}`}
                  className="snap-start shrink-0 w-[130px] bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden active:scale-95 transition-transform">
                  <div className="relative aspect-square overflow-hidden">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    <div className="absolute top-0 left-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-1.5 py-0.5 rounded-br-lg">-50%</div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                      <div className="w-full bg-white/30 rounded-full h-1 overflow-hidden">
                        <div className="bg-yellow-400 h-1 rounded-full" style={{ width: `${60 + idx * 7}%` }} />
                      </div>
                      <span className="text-white/80 text-[9px] font-semibold">Đã bán {60 + idx * 7}%</span>
                    </div>
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="font-bold text-white text-[11px] line-clamp-2 leading-tight mb-1">{item.name}</p>
                    <span className="text-yellow-400 font-black text-sm">{item.price.toLocaleString('vi-VN')}đ</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ─── MAIN CONTENT GRID: Rewards sidebar + Best Sellers ─── */}
      <section className="max-w-[1400px] mx-auto px-3 md:px-8 mb-10 md:mb-16 flex flex-col lg:flex-row gap-6 md:gap-8">

        {/* Rewards Sidebar — desktop only */}
        <div className="hidden lg:block w-[280px] shrink-0">
          <div className="sticky top-[90px] bg-gradient-to-b from-[#1a0a00] to-[#2d0f00] rounded-3xl p-6 h-auto border border-white/10 relative overflow-hidden flex flex-col shadow-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-red-600/20 blur-3xl rounded-full" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-400/10 blur-2xl rounded-full" />

            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-yellow-400/20 rounded-lg flex items-center justify-center">
                  <Gift className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-yellow-400 font-black text-xs uppercase tracking-wider">Avora Rewards</span>
              </div>

              <h2 className="text-2xl font-black text-white leading-tight mb-2">
                TÍCH ĐIỂM<br /><span className="text-red-400">ĐỔI QUÀ</span><br />HẤP DẪN
              </h2>
              <p className="text-white/50 text-xs mb-5 leading-relaxed">Mỗi 10.000đ = 1 điểm. Đổi điểm lấy voucher, quà tặng siêu hấp dẫn!</p>

              <div className="space-y-2.5 mb-5">
                {[
                  { pts: '500 PT', desc: 'Giảm 50.000đ' },
                  { pts: '1000 PT', desc: 'Miễn phí ship' },
                  { pts: '2000 PT', desc: '1 món miễn phí' },
                ].map(r => (
                  <div key={r.pts} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                    <span className="text-yellow-400 font-black text-sm">{r.pts}</span>
                    <span className="text-white/70 text-xs font-medium">{r.desc}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                  </div>
                ))}
              </div>

              <Link href="/profile" className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold py-3 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 transition-all hover:-translate-y-0.5">
                Khám phá ngay <ArrowRight className="w-4 h-4" />
              </Link>

              {/* Card visual */}
              <div className="mt-5 relative h-24">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-rose-700 rounded-2xl flex items-center justify-center border border-white/10 shadow-xl overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                  <p className="text-white font-black text-xl tracking-[0.3em] opacity-80 relative z-10">AVORA</p>
                  <div className="absolute bottom-2 right-3 text-white/30 text-[10px] font-mono tracking-widest">•••• 8421</div>
                  <div className="absolute top-2 left-3">
                    <div className="w-6 h-4 bg-yellow-400/80 rounded-sm" />
                  </div>
                </div>
                <div className="absolute -top-3 -right-2 bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-0.5 rounded-full shadow-lg">+500 Pt</div>
              </div>
            </div>
          </div>
        </div>

        {/* Best Sellers */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5 md:mb-7">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                <Flame className="w-5 h-5 text-red-600 fill-red-600" />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Bán Chạy Nhất</h2>
            </div>
            <Link href="/menu" className="flex items-center gap-1 text-red-600 font-bold text-xs md:text-sm hover:gap-2 transition-all">
              Xem tất cả <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {filteredBestSellers.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {filteredBestSellers.map((item: any) => (
                <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-100/80 hover:shadow-xl hover:-translate-y-1 hover:border-red-100 transition-all duration-300 group flex flex-col overflow-hidden">
                  <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`} className="block relative aspect-[4/3] overflow-hidden bg-slate-50">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {item.badge && <span className="bg-red-600 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase">{item.badge}</span>}
                      {item.oldPrice && <span className="bg-gradient-to-r from-orange-500 to-red-600 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">-{(100 - (item.price / item.oldPrice) * 100).toFixed(0)}%</span>}
                    </div>
                    {/* Quick view on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-white/90 backdrop-blur-sm text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">Xem nhanh</span>
                    </div>
                  </Link>

                  <div className="p-3 md:p-4 flex flex-col flex-1">
                    <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`}>
                      <h3 className="font-bold text-slate-900 text-[12px] md:text-[14px] leading-tight mb-1.5 line-clamp-2 group-hover:text-red-600 transition-colors">{item.name}</h3>
                    </Link>
                    <div className="flex items-center gap-1 mb-2 text-[10px] text-slate-500">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-slate-700 font-semibold">4.9</span>
                      <span className="text-slate-300">•</span>
                      <span>{(item.name.length * 5) % 50 + 10} đã bán</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div>
                        <p className="text-red-600 font-black text-sm md:text-base leading-none">{item.price.toLocaleString('vi-VN')}đ</p>
                        {item.oldPrice && <p className="text-slate-400 text-[10px] line-through mt-0.5">{item.oldPrice.toLocaleString('vi-VN')}đ</p>}
                      </div>
                      <AddToCartButton item={item} className="w-8 h-8 md:w-9 md:h-9 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 hover:shadow-md hover:shadow-red-600/30" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-2xl border border-slate-100">
              <p className="text-slate-500">Chưa có món bán chạy tại chi nhánh này.</p>
            </div>
          )}
        </div>
      </section>

      {/* ─── AVORA CLUB BANNER ─── */}
      <section className="max-w-[1400px] mx-auto px-3 md:px-8 mb-10 md:mb-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 shadow-2xl">
          {/* Background */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.04]" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-900/30 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row items-center p-6 md:p-12 gap-6 md:gap-12">
            {/* Left */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-600/40 text-red-400 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">
                <Gift className="w-3.5 h-3.5" /> Avora Club
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4 tracking-tight">
                Ăn ngon,<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-400">Tích điểm,</span><br />Nhận quà!
              </h2>
              <p className="text-white/50 text-sm md:text-base mb-6 leading-relaxed max-w-md">
                Tham gia Avora Club để tận hưởng ưu đãi độc quyền, tích lũy điểm thưởng và nhận những phần quà hấp dẫn từ Avora.
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                {['Tích 1 điểm / 10.000đ', 'Voucher giảm giá', 'Ưu đãi sinh nhật'].map(t => (
                  <div key={t} className="flex items-center gap-2 text-white/70 text-sm">
                    <div className="w-5 h-5 rounded-full bg-red-600/40 flex items-center justify-center shrink-0">
                      <span className="text-red-400 text-[10px] font-black">✓</span>
                    </div>
                    {t}
                  </div>
                ))}
              </div>
              <Link href="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold px-7 py-3.5 rounded-full shadow-xl shadow-red-900/50 transition-all hover:-translate-y-0.5">
                Tham gia miễn phí <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Right — Stacked cards */}
            <div className="shrink-0 hidden md:flex items-center justify-center w-[320px] h-[260px] relative">
              {/* Card back */}
              <div className="absolute w-[240px] h-[150px] bg-gradient-to-br from-red-700 to-rose-800 rounded-2xl rotate-[10deg] top-6 right-4 shadow-2xl border border-white/10" />
              {/* Card front */}
              <div className="absolute w-[240px] h-[150px] bg-gradient-to-br from-red-600 to-rose-600 rounded-2xl -rotate-[3deg] shadow-2xl border border-white/20 flex flex-col justify-between p-5 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                <div className="flex items-center justify-between">
                  <div className="w-8 h-6 bg-yellow-400/80 rounded-sm" />
                  <span className="text-white/60 text-[10px] font-mono">AVORA CLUB</span>
                </div>
                <div>
                  <p className="text-white/40 text-[10px] font-mono mb-1">•••• •••• •••• 8421</p>
                  <p className="text-white font-black text-lg tracking-widest">MEMBER</p>
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -top-2 right-10 bg-yellow-400 text-yellow-900 font-black text-sm px-3 py-1 rounded-full shadow-lg rotate-3">
                +500 PT
              </div>
              {/* Avatar circle */}
              <div className="absolute -bottom-2 left-6 w-16 h-16 rounded-full overflow-hidden border-4 border-slate-900 shadow-xl">
                <img src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI RECOMMENDED ─── */}
      {filteredAiRecommended.length > 0 && (
      <section className="max-w-[1400px] mx-auto px-3 md:px-8 mb-10 md:mb-16">
        <div className="flex items-center justify-between mb-5 md:mb-7">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Gợi Ý Cho Bạn</h2>
          </div>
          <Link href="/menu" className="flex items-center gap-1 text-red-600 font-bold text-xs md:text-sm hover:gap-2 transition-all">
            Xem tất cả <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {filteredAiRecommended.map((item: any) => (
            <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-red-100 transition-all duration-300 border border-slate-100/80 group flex flex-col">
              <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`} className="relative aspect-square overflow-hidden bg-slate-50 block">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                {item.badge && <span className="absolute top-2 left-2 bg-green-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">{item.badge}</span>}
                <button className="absolute top-2 right-2 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50">
                  <Heart className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                </button>
              </Link>
              <div className="p-3 md:p-4 flex-1 flex flex-col">
                <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`}>
                  <h3 className="font-bold text-slate-900 text-[12px] md:text-[13px] leading-tight mb-1.5 group-hover:text-red-600 transition-colors line-clamp-2">{item.name}</h3>
                </Link>
                <div className="flex items-center gap-1 mb-2 text-[10px]">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-slate-700 font-semibold">4.9</span>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <p className="text-red-600 font-black text-sm md:text-base leading-none">{item.price.toLocaleString('vi-VN')}đ</p>
                  <AddToCartButton item={item} className="w-8 h-8 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 hover:shadow-md hover:shadow-red-600/30" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ─── CÓ THỂ BẠN THÍCH ─── */}
      {filteredBestSellers.length > 0 && (
      <section className="max-w-[1400px] mx-auto px-3 md:px-8 mb-10 md:mb-16">
        <div className="flex items-center justify-between mb-5 md:mb-7">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Có Thể Bạn Thích</h2>
          </div>
        </div>

        <div className="relative group/slider">
          <button className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-600 hover:text-red-600 opacity-0 group-hover/slider:opacity-100 transition-all hover:shadow-xl border border-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory py-3 -mx-2 px-2">
            {[...filteredBestSellers, ...filteredAiRecommended].slice(0, 10).map((item: any, index: number) => (
              <div key={`like-${index}`} className="w-[148px] md:w-[220px] shrink-0 snap-start bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100/80 hover:border-red-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
                <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`} className="relative aspect-[4/3] block bg-slate-50 overflow-hidden">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                </Link>
                <div className="p-2.5 md:p-4 flex flex-col flex-1">
                  <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`}>
                    <h3 className="font-bold text-slate-900 text-xs md:text-sm leading-tight mb-1.5 line-clamp-1 hover:text-red-600 transition-colors">{item.name}</h3>
                  </Link>
                  <div className="flex items-center text-[10px] text-yellow-400 mb-2 font-medium gap-0.5">
                    <Star className="w-3 h-3 fill-yellow-400" /> <span className="text-slate-600">4.{(item.name.length % 5) + 5}</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-1">
                    <p className="text-red-600 font-black text-sm">{item.price.toLocaleString('vi-VN')}đ</p>
                    <AddToCartButton item={item} className="w-7 h-7 md:w-8 md:h-8 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-sm shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-600 hover:text-red-600 opacity-0 group-hover/slider:opacity-100 transition-all hover:shadow-xl border border-slate-100">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>
      )}

      {/* ─── FEATURES BAR ─── */}
      <section className="max-w-[1400px] mx-auto px-3 md:px-8 mb-10 md:mb-16">
        <div className="bg-white rounded-3xl p-5 md:p-10 shadow-sm border border-slate-100/80">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8">
            {[
              { Icon: Leaf, title: 'Nguyên liệu tươi', desc: 'Nhập khẩu & chọn lọc mỗi ngày', color: 'bg-green-50 text-green-600' },
              { Icon: User, title: 'Đầu bếp 5 sao', desc: 'Đội ngũ giàu kinh nghiệm Nhật Bản', color: 'bg-blue-50 text-blue-600' },
              { Icon: Truck, title: 'Giao hàng siêu tốc', desc: '30–45 phút đến tay bạn', color: 'bg-orange-50 text-orange-600' },
              { Icon: Package, title: 'Đóng gói kỹ lưỡng', desc: 'Đẹp, an toàn, giữ trọn hương vị', color: 'bg-purple-50 text-purple-600' },
            ].map(({ Icon, title, desc, color }) => (
              <div key={title} className="flex items-center gap-3 md:flex-col md:items-center md:text-center md:gap-4 group">
                <div className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl ${color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-5 h-5 md:w-7 md:h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base leading-tight">{title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 hidden md:block">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MOBILE CLUB CARD ─── */}
      <section className="md:hidden px-3 mb-8">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-xl border border-white/5">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-600/30 rounded-full blur-2xl" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-lg shrink-0">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-yellow-400 font-black text-xs uppercase tracking-wider mb-0.5">Avora Club</p>
              <p className="text-white font-bold text-sm leading-tight">Ăn ngon tích điểm, nhận ưu đãi</p>
              <p className="text-white/50 text-[11px] mt-0.5">Mỗi 10.000đ = 1 điểm</p>
            </div>
            <Link href="/register" className="shrink-0 bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-xl shadow whitespace-nowrap">
              Tham gia
            </Link>
          </div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
