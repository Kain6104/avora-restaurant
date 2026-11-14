"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  MapPin, Phone, Clock, Navigation, Utensils,
  Calendar, Check, Copy, ChevronRight,
  Building2, Users, ShieldCheck, Sparkles,
  Ticket, Loader2, Share2, ExternalLink
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import type { Branch } from '@/src/components/RestaurantsMap';

const RestaurantsMap = dynamic(
  () => import('@/src/components/RestaurantsMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[360px] flex items-center justify-center bg-slate-100 rounded-2xl">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-red-600" />
          <span className="text-xs text-slate-500 font-medium">Đang tải bản đồ chi nhánh...</span>
        </div>
      </div>
    ),
  }
);

interface MenuItem {
  id: string;
  name: string;
  slug?: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  description?: string;
  category?: {
    id?: string;
    name: string;
    slug?: string;
  };
  discountPercent?: number;
}

interface VoucherItem {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderValue?: number;
  maxDiscount?: number;
  startDate?: string;
  endDate?: string;
  description?: string;
}

interface BranchDetailData {
  id: string;
  name: string;
  branchCode?: string;
  phone?: string;
  email?: string;
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
  fullAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  openTime?: string;
  closeTime?: string;
  capacity?: number;
  reservationEnabled?: boolean;
  onlineOrderingEnabled?: boolean;
  imageUrl?: string;
  slug?: string;
  menuItems?: MenuItem[];
  vouchers?: VoucherItem[];
}

function isOpenNow(openTime?: string, closeTime?: string): boolean {
  if (!openTime || !closeTime) return true;
  const now = new Date();
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= oh * 60 + om && nowMin <= ch * 60 + cm;
}

function formatVnd(val?: number): string {
  if (!val && val !== 0) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(val) + ' ₫';
}

export default function BranchDetailClient({ branch }: { branch: BranchDetailData }) {
  const router = useRouter();
  const { changeBranch, addToCart } = useCart();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'vouchers' | 'info'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState<string>('');

  const openStatus = useMemo(() => isOpenNow(branch.openTime, branch.closeTime), [branch.openTime, branch.closeTime]);
  const address = branch.fullAddress || [branch.street, branch.ward, branch.district, branch.province].filter(Boolean).join(', ');

  const categories = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; count: number }>();
    for (const it of branch.menuItems || []) {
      const catSlug = it.category?.slug || 'other';
      const catName = it.category?.name || 'Khác';
      if (!map.has(catSlug)) {
        map.set(catSlug, { slug: catSlug, name: catName, count: 0 });
      }
      map.get(catSlug)!.count++;
    }
    return Array.from(map.values());
  }, [branch.menuItems]);

  const filteredMenuItems = useMemo(() => {
    let items = branch.menuItems || [];
    if (selectedCategory !== 'all') {
      items = items.filter(it => (it.category?.slug || 'other') === selectedCategory);
    }
    if (menuSearch.trim()) {
      const q = menuSearch.trim().toLowerCase();
      items = items.filter(it => it.name.toLowerCase().includes(q));
    }
    return items;
  }, [branch.menuItems, selectedCategory, menuSearch]);

  const branchForMap: Branch = useMemo(() => ({
    id: branch.id,
    name: branch.name,
    street: branch.street,
    ward: branch.ward,
    district: branch.district,
    province: branch.province,
    phone: branch.phone,
    openTime: branch.openTime,
    closeTime: branch.closeTime,
    latitude: branch.latitude,
    longitude: branch.longitude,
  }), [branch]);

  const handleCopyVoucher = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleOrderOnline = () => {
    changeBranch(branch.id);
    localStorage.setItem('selectedBranchId', branch.id);
    router.push('/menu');
  };

  const handleAddDishToCart = (item: MenuItem) => {
    changeBranch(branch.id);
    localStorage.setItem('selectedBranchId', branch.id);
    addToCart(
      {
        id: `${item.id}-${Date.now()}`,
        productId: item.id,
        name: item.name,
        priceAtSale: item.price,
        originalPriceAtSale: item.originalPrice || item.price,
        quantity: 1,
        imageUrl: item.imageUrl,
      },
      branch.id
    );
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${branch.name} ${address}`)}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* ── Breadcrumb Bar ────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-red-600 transition-colors">
              Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link href="/restaurants" className="hover:text-red-600 transition-colors">
              Hệ thống chi nhánh
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-800 truncate">
              {branch.name}
            </span>
          </nav>
        </div>
      </div>

      {/* ── Hero Restaurant Header ───────────────────────────────── */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white relative overflow-hidden">
        {/* Subtle patterned overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-600/90 text-white shadow-sm">
                  <Building2 className="w-3.5 h-3.5" />
                  Hệ thống AVORA
                </span>

                {openStatus ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Đang mở cửa ({branch.openTime || '09:00'} - {branch.closeTime || '22:00'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Clock className="w-3.5 h-3.5" />
                    Tạm nghỉ ({branch.openTime || '09:00'} - {branch.closeTime || '22:00'})
                  </span>
                )}

                {branch.capacity && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-slate-200 border border-white/10">
                    <Users className="w-3.5 h-3.5" />
                    Sức chứa ~{branch.capacity} khách
                  </span>
                )}
              </div>

              {/* Branch Title */}
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {branch.name}
              </h1>

              {/* Address & Contact items */}
              <div className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                <p className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{address}</span>
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm pt-1">
                  {branch.phone && (
                    <a
                      href={`tel:${branch.phone}`}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-red-400" />
                      <span>{branch.phone}</span>
                    </a>
                  )}
                  {branch.openTime && branch.closeTime && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-red-400" />
                      <span>Phục vụ hàng ngày: {branch.openTime} – {branch.closeTime}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action CTAs */}
            <div className="flex flex-wrap sm:flex-nowrap lg:flex-col gap-2.5 shrink-0 pt-2 lg:pt-0">
              {branch.reservationEnabled !== false && (
                <Link
                  href={`/reservation?branchId=${branch.id}`}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-md transition-all active:scale-[0.98]"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Đặt bàn tại chi nhánh</span>
                </Link>
              )}

              {branch.onlineOrderingEnabled !== false && (
                <button
                  onClick={handleOrderOnline}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm shadow-md transition-all active:scale-[0.98]"
                >
                  <Utensils className="w-4 h-4 text-red-600" />
                  <span>Đặt món trực tuyến</span>
                </button>
              )}

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium border border-white/20 transition-all"
              >
                <Navigation className="w-3.5 h-3.5 text-red-400" />
                <span>Chỉ đường Google Maps</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content Navigation Tabs ──────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4 sm:gap-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('menu')}
              className={`py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'menu'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Thực đơn phục vụ ({branch.menuItems?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('vouchers')}
              className={`py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'vouchers'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>Ưu đãi chi nhánh ({branch.vouchers?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('info')}
              className={`py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'info'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Vị trí & Thông tin liên hệ</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Body Container ───────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ── Tab: MENU ── */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-red-600" />
                  Các món đang phục vụ tại {branch.name} ({branch.menuItems?.length || 0} món)
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Món ăn chế biến nóng sốt từ đầu bếp chuyên nghiệp AVORA, sẵn sàng phục vụ tại chỗ hoặc giao tận nơi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Tìm món tại chi nhánh..."
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 outline-none focus:border-red-500 bg-white w-48 sm:w-56 shadow-2xs"
                />
                <button
                  onClick={handleOrderOnline}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors shrink-0"
                >
                  <span>Xem menu tổng hợp</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Tất cả ({branch.menuItems?.length || 0})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      selectedCategory === cat.slug
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat.name} ({cat.count})
                  </button>
                ))}
              </div>
            )}

            {filteredMenuItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                <Utensils className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-600">
                  {menuSearch ? `Không tìm thấy món nào khớp với "${menuSearch}".` : 'Thực đơn tại danh mục này đang được cập nhật món mới theo mùa.'}
                </p>
                {menuSearch && (
                  <button
                    onClick={() => { setMenuSearch(''); setSelectedCategory('all'); }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                  >
                    Xóa bộ lọc tìm kiếm
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {filteredMenuItems.map((item) => {
                  const dishDetailUrl = `/${item.category?.slug || 'menu'}/${item.slug || item.id}`;
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col group"
                    >
                      {/* Image */}
                      <Link href={dishDetailUrl} className="relative aspect-square w-full bg-slate-100 overflow-hidden block">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Utensils className="w-8 h-8" />
                          </div>
                        )}

                        {/* Discount badge */}
                        {item.discountPercent && item.discountPercent > 0 ? (
                          <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                            -{item.discountPercent}%
                          </span>
                        ) : null}

                        {/* Category tag */}
                        {item.category?.name && (
                          <span className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white text-[9px] font-medium px-1.5 py-0.5 rounded">
                            {item.category.name}
                          </span>
                        )}
                      </Link>

                      {/* Content */}
                      <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <Link href={dishDetailUrl}>
                            <h3 className="font-semibold text-xs sm:text-sm text-slate-800 line-clamp-2 leading-snug hover:text-red-600 transition-colors">
                              {item.name}
                            </h3>
                          </Link>
                          <div className="flex items-baseline gap-1.5 mt-1.5">
                            <span className="text-red-600 font-bold text-xs sm:text-sm">
                              {formatVnd(item.price)}
                            </span>
                            {item.originalPrice && item.originalPrice > item.price && (
                              <span className="text-slate-400 text-[10px] sm:text-xs line-through">
                                {formatVnd(item.originalPrice)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Add button */}
                        <button
                          onClick={() => handleAddDishToCart(item)}
                          className="mt-2.5 w-full py-1.5 px-2 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer"
                        >
                          <Utensils className="w-3.5 h-3.5" />
                          <span>Thêm món</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: VOUCHERS ── */}
        {activeTab === 'vouchers' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-red-600" />
                Mã ưu đãi áp dụng cho {branch.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Các mã giảm giá hợp lệ đang có hiệu lực tại chi nhánh. Sao chép mã và nhập tại bước thanh toán để nhận ưu đãi.
              </p>
            </div>

            {(!branch.vouchers || branch.vouchers.length === 0) ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                <Ticket className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-600">
                  Hiện chi nhánh chưa có voucher độc quyền riêng. Hãy theo dõi trang khuyến mãi AVORA để cập nhật ưu đãi mới nhất!
                </p>
                <Link
                  href="/vouchers"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                >
                  Xem voucher toàn hệ thống
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {branch.vouchers.map((v) => {
                  const isCopied = copiedCode === v.code;
                  return (
                    <div
                      key={v.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-red-300 transition-colors flex flex-col justify-between gap-3 relative overflow-hidden"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono font-bold text-sm text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                            {v.code}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {v.discountType === 'PERCENT' ? `Giảm ${v.discountValue}%` : `Giảm ${formatVnd(v.discountValue)}`}
                          </span>
                        </div>

                        {v.description && (
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {v.description}
                          </p>
                        )}

                        <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                          {v.minOrderValue && v.minOrderValue > 0 && (
                            <p>• Đơn tối thiểu: {formatVnd(v.minOrderValue)}</p>
                          )}
                          {v.endDate && (
                            <p>• Hạn sử dụng: {new Date(v.endDate).toLocaleDateString('vi-VN')}</p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopyVoucher(v.code)}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Đã sao chép mã!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Sao chép mã voucher</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: INFO & MAP ── */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Details */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-red-600" />
                  Thông tin liên hệ & Giờ mở cửa
                </h3>

                <div className="space-y-3 text-xs sm:text-sm text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900">Địa chỉ chi nhánh</p>
                      <p className="text-slate-600 mt-0.5">{address}</p>
                    </div>
                  </div>

                  {branch.phone && (
                    <div className="flex items-start gap-2.5">
                      <Phone className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-900">Số điện thoại bàn / Hotline</p>
                        <a
                          href={`tel:${branch.phone}`}
                          className="text-red-600 font-semibold hover:underline mt-0.5 block"
                        >
                          {branch.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {branch.openTime && branch.closeTime && (
                    <div className="flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-900">Thời gian hoạt động</p>
                        <p className="text-slate-600 mt-0.5">
                          {branch.openTime} – {branch.closeTime} (Tất cả các ngày trong tuần)
                        </p>
                      </div>
                    </div>
                  )}

                  {branch.capacity && (
                    <div className="flex items-start gap-2.5">
                      <Users className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-900">Sức chứa tối đa</p>
                        <p className="text-slate-600 mt-0.5">Khoảng {branch.capacity} khách ngồi đồng thời</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Google Maps</span>
                  </a>

                  {branch.reservationEnabled !== false && (
                    <Link
                      href={`/reservation?branchId=${branch.id}`}
                      className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Đặt bàn ngay</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Restaurant Amenities */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-red-600" />
                  Tiện ích tại chi nhánh
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Wifi tốc độ cao</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Chỗ đậu ô tô & xe máy</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Phòng riêng VIP</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Thanh toán thẻ & QR</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Leaflet Map */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm h-[380px] sm:h-[460px] relative">
                <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm px-3 py-1.5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-800">
                    Vị trí thực tế {branch.name}
                  </span>
                </div>

                <RestaurantsMap
                  branches={[branchForMap]}
                  selectedBranch={branchForMap}
                  onSelectBranch={() => {}}
                  userLocation={null}
                  onUserLocation={() => {}}
                  routeInfo={null}
                  onRouteInfo={() => {}}
                  onRequestRoute={() => {}}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
