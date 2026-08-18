import React from 'react';
import {
  ChevronLeft, ChevronRight, ArrowRight,
  Truck, Leaf, ShieldCheck, CreditCard, Grid, Flame, Zap, Gift, Star, Heart, Package, User
} from 'lucide-react';
import Link from 'next/link';
import HeroBanner from '../../components/HeroBanner';
import AddToCartButton from '../../components/AddToCartButton';

export default async function Home() {
  const data = await fetch('http://localhost:3001/api/home', { cache: 'no-store' })
    .then((res) => res.json())
    .catch((err) => {
      console.error('Failed to fetch home data:', err);
      return { banners: [], categories: [], bestSellers: [], aiRecommended: [] };
    });

  const { banners, categories, bestSellers, aiRecommended } = data;

  return (
    <div className="bg-slate-50 font-sans pb-20 md:pb-0">
      {/* ─── HERO BANNER ─── */}
      <HeroBanner slides={banners} />

      {/* ─── CATEGORIES ROW ─── */}
      <section className="relative z-40 max-w-[1400px] mx-auto px-3 md:px-8 -mt-4 md:-mt-12 mb-8 md:mb-16">
        <div className="bg-white rounded-2xl md:rounded-[50px] shadow-[0_8px_40px_rgb(0,0,0,0.06)] py-3 md:py-4 px-4 md:px-12 overflow-x-auto hide-scrollbar flex justify-between items-center gap-4 md:gap-6">
          <Link href="/menu" className="flex flex-col items-center gap-1.5 md:gap-2 shrink-0 group">
            <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-600/30 group-hover:-translate-y-1 transition-all">
              <Grid className="w-4 h-4 md:w-6 md:h-6" />
            </div>
            <span className="text-[10px] md:text-xs font-bold text-red-600 border-b-2 border-red-600 pb-0.5 whitespace-nowrap">Tất cả</span>
          </Link>

          {categories?.map((cat: any) => (
            <Link key={cat.id} href={`/${cat.slug}`} className="flex flex-col items-center gap-1.5 md:gap-2 shrink-0 group">
              <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-white flex items-center justify-center p-0.5 md:p-1.5 group-hover:-translate-y-1 transition-all shadow-sm border border-slate-100 group-hover:border-red-200">
                <img src={cat.image} alt={cat.name} className="w-full h-full object-cover rounded-full" />
              </div>
              <span className="text-[10px] md:text-xs font-medium text-slate-600 group-hover:text-red-600 transition-colors whitespace-nowrap">{cat.name}</span>
            </Link>
          ))}

          <Link href="/menu" className="flex flex-col items-center gap-1.5 md:gap-2 shrink-0 group">
            <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:-translate-y-1 transition-all border border-slate-100 hover:border-red-200">
              <div className="grid grid-cols-3 gap-0.5">
                {[...Array(9)].map((_, i) => <div key={i} className="w-1 h-1 bg-slate-300 rounded-full" />)}
              </div>
            </div>
            <span className="text-[10px] md:text-xs font-medium text-slate-500 group-hover:text-red-600 transition-colors whitespace-nowrap">Xem tất cả</span>
          </Link>
        </div>
      </section>

      {/* ─── AVORA CLUB BANNER — hidden on mobile (shown once via sidebar card) ─── */}
      <section className="hidden md:block max-w-[1400px] mx-auto px-8 mb-16">
        <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-[40px] overflow-hidden flex md:flex-row items-center border border-pink-100 relative shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/40 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-red-100/30 blur-3xl rounded-full pointer-events-none" />
          <div className="w-1/2 p-16 z-10">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm mb-4">
              <Gift className="w-5 h-5" /> THÀNH VIÊN AVORA CLUB
            </div>
            <h2 className="text-5xl font-black text-slate-900 leading-tight mb-8">
              Ăn ngon tích điểm<br />Nhận nhiều ưu đãi
            </h2>
            <div className="space-y-4 mb-8">
              {['Tích 1 điểm cho mỗi 10.000đ', 'Đổi điểm lấy voucher hấp dẫn', 'Ưu đãi sinh nhật đặc biệt'].map(t => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <span className="text-red-600 text-xs font-bold">✓</span>
                  </div>
                  <span className="text-slate-700 font-medium">{t}</span>
                </div>
              ))}
            </div>
            <button className="border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors font-bold px-8 py-3 rounded-full">
              Tham gia ngay
            </button>
          </div>
          <div className="w-1/2 relative h-auto min-h-[400px]">
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="w-full max-w-md relative">
                <div className="w-[280px] h-[170px] bg-red-600 rounded-2xl absolute top-0 right-0 shadow-2xl rotate-12 flex items-center justify-center border-2 border-white/20 z-20">
                  <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] rounded-2xl" />
                  <span className="text-white font-black text-2xl z-10 italic">AVORA CLUB</span>
                </div>
                <img src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400" className="w-48 h-48 object-cover rounded-full absolute bottom-0 left-0 shadow-xl border-4 border-white z-30" />
                <img src="https://images.unsplash.com/photo-1553621042-f6e147245754?w=400" className="w-36 h-36 object-cover rounded-full absolute top-10 left-10 shadow-lg border-4 border-white z-10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MOBILE CLUB BANNER — compact horizontal card ─── */}
      <section className="md:hidden px-3 mb-6">
        <div className="bg-gradient-to-r from-red-600 to-rose-700 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden shadow-lg">
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full pointer-events-none" />
          <img src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200" className="w-16 h-16 rounded-xl object-cover shrink-0 border-2 border-white/30 shadow-md" />
          <div className="flex-1 min-w-0 relative z-10">
            <p className="text-white font-black text-base leading-tight mb-0.5">AVORA CLUB</p>
            <p className="text-red-100 text-xs mb-2">Ăn ngon tích điểm, nhận ưu đãi</p>
            <button className="bg-white text-red-600 text-xs font-bold px-4 py-1.5 rounded-full shadow">
              Tham gia ngay
            </button>
          </div>
          <div className="shrink-0 relative z-10 text-center">
            <p className="text-yellow-300 text-xl font-black leading-none">+500</p>
            <p className="text-white/70 text-[10px] font-bold">ĐIỂM THƯỞNG</p>
          </div>
        </div>
      </section>

      {/* ─── MAIN CONTENT: Rewards sidebar + Best sellers ─── */}
      <section className="max-w-[1400px] mx-auto px-3 md:px-8 mb-8 md:mb-16 flex flex-col lg:flex-row gap-6 md:gap-8">

        {/* Rewards sidebar — desktop only */}
        <div className="hidden lg:block w-[300px] shrink-0">
          <div className="bg-gradient-to-b from-rose-50 to-pink-50 rounded-3xl p-6 h-full border border-pink-100 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 blur-2xl rounded-full" />
            <div className="relative z-10 flex flex-col items-start h-full">
              <div className="flex items-center gap-2 text-pink-500 font-bold text-xs uppercase mb-4 tracking-wider">
                <Gift className="w-4 h-4" /> AVORA REWARDS
              </div>
              <h2 className="text-3xl font-black text-slate-900 leading-tight mb-6">
                TÍCH ĐIỂM<br />ĐỔI QUÀ<br /><span className="text-red-600">SIÊU HẤP DẪN</span>
              </h2>
              <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all hover:-translate-y-1 mb-10">
                Khám phá ngay <ArrowRight className="w-4 h-4 bg-white text-red-600 rounded-full p-0.5" />
              </button>
              <div className="mt-auto relative w-full aspect-square flex items-end justify-center">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-white rounded-full shadow-2xl p-2 border-4 border-white">
                  <img src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400" className="w-full h-full object-cover rounded-full" />
                </div>
                <div className="absolute top-1/4 right-0 bg-white px-3 py-1.5 rounded-full shadow-xl text-xs font-bold text-red-600 z-20">+500 Pt</div>
                <div className="w-full h-32 bg-red-600 rounded-2xl shadow-xl transform rotate-3 flex items-center justify-center border-2 border-white relative z-10 overflow-hidden">
                  <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                  <div className="text-white font-black text-xl tracking-widest opacity-80">AVORA REWARDS</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Best Sellers */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2 uppercase">
              MÓN BÁN CHẠY <Flame className="w-5 h-5 md:w-6 md:h-6 text-red-600 fill-red-600" />
            </h2>
            <Link href="/menu" className="text-red-600 font-bold hover:underline flex items-center text-xs md:text-sm">
              Xem tất cả <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {bestSellers?.map((item: any) => (
              <div key={item.id} className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-red-100 transition-all duration-300 group flex flex-col relative overflow-hidden">
                <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`} className="block relative aspect-[4/3] overflow-hidden bg-slate-50">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {item.badge && <span className="bg-red-700 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm uppercase">{item.badge}</span>}
                    {item.oldPrice && <span className="bg-red-600 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm">-{(100 - (item.price / item.oldPrice) * 100).toFixed(0)}%</span>}
                  </div>
                </Link>
                <div className="p-2.5 md:p-4 flex flex-col flex-1">
                  <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`}>
                    <h3 className="font-bold text-slate-900 text-[13px] md:text-[15px] leading-tight mb-1 md:mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">{item.name}</h3>
                  </Link>
                  <div className="flex items-center gap-1 mb-2 md:mb-4 text-[10px] text-slate-500">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-slate-700 font-semibold">4.9</span>
                    <span className="text-slate-300">•</span>
                    <span>{Math.floor(Math.random() * 50) + 10} đã bán</span>
                  </div>
                  <div className="mt-auto flex items-end justify-between">
                    <div>
                      <p className="text-red-600 font-bold text-sm md:text-base">{item.price.toLocaleString('vi-VN')}đ</p>
                      {item.oldPrice && <p className="text-slate-400 text-[10px] line-through">{item.oldPrice.toLocaleString('vi-VN')}đ</p>}
                    </div>
                    <AddToCartButton item={item} className="w-7 h-7 md:w-8 md:h-8 bg-white border border-slate-200 hover:border-red-600 hover:bg-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center transition-all shadow-sm shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FLASH SALE ─── */}
      <section className="mb-8 md:mb-16 relative overflow-hidden">
        {/* Desktop: full-width red bg */}
        <div className="hidden md:block">
          <div className="bg-red-600 py-12 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/20 blur-3xl rounded-full" />
            <div className="max-w-[1400px] mx-auto px-8 relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Zap className="w-8 h-8 text-yellow-300 fill-yellow-300 animate-pulse" />
                  <h2 className="text-3xl font-black text-white italic tracking-wide">FLASH SALE</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/80 font-medium text-sm">Kết thúc trong:</span>
                  <div className="flex gap-1 items-center">
                    {['02', '45', '10'].map((t, i) => (
                      <React.Fragment key={i}>
                        <span className="bg-slate-900 text-white font-black text-base w-9 h-9 flex items-center justify-center rounded-lg">{t}</span>
                        {i < 2 && <span className="text-white font-black text-lg">:</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {bestSellers?.slice(0, 4).map((item: any, idx: number) => (
                  <Link key={idx} href={`/${item.category?.slug || item.categoryId}/${item.slug}`} className="bg-white rounded-2xl p-3 flex gap-3 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="w-20 h-20 shrink-0 relative rounded-xl overflow-hidden">
                      <img src={item.imageUrl} alt="sale" className="w-full h-full object-cover" />
                      <div className="absolute top-0 left-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-1.5 py-0.5 rounded-br-lg">-50%</div>
                    </div>
                    <div className="flex flex-col flex-1 justify-center">
                      <h3 className="font-bold text-slate-900 text-sm mb-1 leading-tight line-clamp-2 group-hover:text-red-600 transition-colors">{item.name}</h3>
                      <span className="text-red-600 font-bold">{item.price.toLocaleString('vi-VN')}đ</span>
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-2 overflow-hidden">
                        <div className="bg-red-500 h-1 rounded-full w-[75%]" />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1">Đã bán 75%</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: premium compact design */}
        <div className="md:hidden px-3">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center shadow-md shadow-red-600/40">
                <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
              </div>
              <h2 className="text-lg font-black text-slate-900 italic">FLASH SALE</h2>
            </div>
            {/* Countdown */}
            <div className="flex items-center gap-1">
              {['02', '45', '10'].map((t, i) => (
                <React.Fragment key={i}>
                  <span className="bg-slate-900 text-white text-[11px] font-black w-7 h-7 flex items-center justify-center rounded-md">{t}</span>
                  {i < 2 && <span className="text-slate-700 font-black text-xs">:</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Horizontal scroll cards */}
          <div className="flex gap-2.5 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-1 -mx-3 px-3">
            {bestSellers?.slice(0, 6).map((item: any, idx: number) => (
              <Link
                key={idx}
                href={`/${item.category?.slug || item.categoryId}/${item.slug}`}
                className="snap-start shrink-0 w-[140px] bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 active:scale-95 transition-transform"
              >
                {/* Image */}
                <div className="relative aspect-square overflow-hidden bg-slate-100">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  {/* Discount badge */}
                  <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-br-xl">
                    -50%
                  </div>
                  {/* Sold progress overlay at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                    <div className="w-full bg-white/30 rounded-full h-1 overflow-hidden">
                      <div className="bg-yellow-400 h-1 rounded-full" style={{ width: `${60 + idx * 7}%` }} />
                    </div>
                    <span className="text-white text-[9px] font-bold">Đã bán {60 + idx * 7}%</span>
                  </div>
                </div>
                {/* Info */}
                <div className="px-2.5 py-2">
                  <p className="font-bold text-slate-900 text-[12px] line-clamp-2 leading-tight mb-1.5">{item.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-red-600 font-black text-sm">{item.price.toLocaleString('vi-VN')}đ</span>
                  </div>
                  {item.oldPrice && (
                    <span className="text-slate-400 text-[10px] line-through">{item.oldPrice.toLocaleString('vi-VN')}đ</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AI RECOMMENDED ─── */}
      <section className="max-w-[1400px] mx-auto px-3 md:px-8 mb-8 md:mb-16">
        <div className="flex items-center justify-between mb-4 md:mb-8">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2 uppercase">
            DÀNH RIÊNG CHO BẠN <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-400 fill-yellow-400" />
          </h2>
          <Link href="/menu" className="text-red-600 font-bold text-xs md:text-sm hover:underline flex items-center">
            Xem tất cả <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
          {aiRecommended?.map((item: any) => (
            <div key={item.id} className="bg-white rounded-xl md:rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-red-100 transition-all border border-slate-100 group flex flex-col">
              <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`} className="relative aspect-square overflow-hidden bg-slate-100 block">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {item.badge && <span className="absolute top-2 left-2 bg-green-600 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase">{item.badge}</span>}
              </Link>
              <div className="p-2.5 md:p-4 flex-1 flex flex-col">
                <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`}>
                  <h3 className="font-bold text-slate-900 text-[12px] md:text-[15px] leading-tight mb-1 md:mb-2 group-hover:text-red-600 transition-colors line-clamp-2">{item.name}</h3>
                </Link>
                <div className="mt-auto flex items-end justify-between">
                  <p className="text-red-600 font-bold text-sm md:text-base">{item.price.toLocaleString('vi-VN')}đ</p>
                  <AddToCartButton item={item} className="w-7 h-7 md:w-8 md:h-8 bg-white border border-slate-200 hover:border-red-600 hover:bg-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center transition-all shadow-sm shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CÓ THỂ BẠN SẼ THÍCH ─── */}
      <section className="max-w-[1400px] mx-auto px-3 md:px-8 mb-8 md:mb-16">
        <div className="flex items-center gap-2 mb-4 md:mb-8">
          <Heart className="w-5 h-5 md:w-6 md:h-6 text-red-600 fill-red-600" />
          <h2 className="text-lg md:text-xl font-bold text-slate-800 uppercase">CÓ THỂ BẠN SẼ THÍCH</h2>
        </div>
        <div className="relative group/slider">
          <button className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-600 hover:text-red-600 opacity-0 group-hover/slider:opacity-100 transition-opacity">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex gap-3 md:gap-6 overflow-x-auto hide-scrollbar snap-x snap-mandatory py-2 md:py-4 px-2 -mx-2">
            {[...bestSellers, ...aiRecommended].slice(0, 8).map((item: any, index: number) => (
              <div key={`like-${index}`} className="w-[160px] md:w-[240px] shrink-0 snap-start bg-white rounded-xl md:rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:border-red-100 transition-colors flex flex-col">
                <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`} className="relative aspect-[4/3] block bg-slate-50">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </Link>
                <div className="p-2.5 md:p-4 flex flex-col flex-1">
                  <Link href={`/${item.category?.slug || item.categoryId}/${item.slug}`}>
                    <h3 className="font-bold text-slate-900 text-xs md:text-sm leading-tight mb-1.5 line-clamp-1 hover:text-red-600">{item.name}</h3>
                  </Link>
                  <div className="flex items-center text-[10px] text-yellow-400 mb-2 font-medium">
                    <Star className="w-3 h-3 fill-yellow-400 mr-1" /> 4.{Math.floor(Math.random() * 5) + 5}
                  </div>
                  <div className="mt-auto flex items-end justify-between">
                    <p className="text-red-600 font-bold text-sm">{item.price.toLocaleString('vi-VN')}đ</p>
                    <AddToCartButton item={item} className="w-6 h-6 md:w-7 md:h-7 bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-600 hover:text-red-600 opacity-0 group-hover/slider:opacity-100 transition-opacity">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </section>

      {/* ─── QUALITY FEATURES ─── */}
      <section className="max-w-[1400px] mx-auto px-3 md:px-8 mb-8 md:mb-16">
        <div className="bg-white md:bg-slate-50 rounded-2xl md:rounded-3xl p-4 md:p-12 shadow-sm md:shadow-none border border-slate-100 md:border-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {[
              { Icon: Leaf, title: 'Nguyên liệu tươi ngon', desc: 'Chọn lọc nguyên liệu tươi mỗi ngày' },
              { Icon: User, title: 'Đầu bếp chuyên nghiệp', desc: 'Đội ngũ giàu kinh nghiệm' },
              { Icon: Truck, title: 'Giao hàng siêu tốc', desc: 'Giao nhanh 30-45 phút nội thành' },
              { Icon: Package, title: 'Đóng gói cẩn thận', desc: 'Đóng gói đẹp, giữ trọn hương vị' },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center group">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-50 flex items-center justify-center mb-2 md:mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm md:text-base mb-1">{title}</h3>
                <p className="text-xs text-slate-500 hidden md:block">{desc}</p>
              </div>
            ))}
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