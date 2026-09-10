'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import AddToCartButton from '@/components/AddToCartButton';
import { useFlashSaleRealtime } from '@/hooks/useFlashSaleRealtime';
import { toast } from 'react-hot-toast';
import {
  Zap,
  Flame,
  Clock,
  ChevronRight,
  Search,
  X,
  ArrowUpDown,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  Truck,
  Crown,
  Share2,
  Heart,
  Tag,
  Check,
  UtensilsCrossed,
  ChefHat,
  Bell,
  Calendar,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

type SortOption = 'POPULAR' | 'DISCOUNT' | 'PRICE_ASC' | 'PRICE_DESC';

export default function FlashSaleClient() {
  const { cartItems, flashSaleQuotas } = useCart();
  const { isFavorite, toggleFavorite } = useWishlist();

  const [flashSale, setFlashSale] = useState<any>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('POPULAR');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [subscribingRemind, setSubscribingRemind] = useState(false);
  const [remindedSlots, setRemindedSlots] = useState<Record<string, boolean>>({});
  const [isStickyBarVisible, setIsStickyBarVisible] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);

  // Fetch active flash sale
  const fetchFlashSale = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/promotions/flash-sale/current', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (data && (data.id || data.hasFlashSale)) {
          setFlashSale(data);

          // Select default slot (Active or first slot)
          const defaultSlot =
            data.activeSlot || (data.slots && data.slots.length > 0 ? data.slots[0] : null);
          if (defaultSlot && !selectedSlotId) {
            setSelectedSlotId(defaultSlot.id);
            setCountdown(defaultSlot.countdown || data.countdown || 0);
          } else if (defaultSlot && selectedSlotId) {
            // Check if current selected slot still exists
            const existing = data.slots?.find((s: any) => s.id === selectedSlotId);
            if (existing) {
              setCountdown(existing.countdown || 0);
            }
          }
        } else {
          setFlashSale(null);
        }
      }
    } catch (err) {
      console.error('Error fetching flash sale:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSlotId]);

  useEffect(() => {
    fetchFlashSale();
  }, [fetchFlashSale]);

  // Hook into WebSocket for realtime flash sale updates
  useFlashSaleRealtime({
    onCampaignChanged: () => {
      fetchFlashSale();
    },
    onStockUpdated: (data) => {
      setFlashSale((prev: any) => {
        if (!prev) return prev;
        const updateSlotItems = (items: any[]) =>
          items.map((it: any) =>
            it.id === data.flashSaleItemId
              ? { ...it, sold: data.sold, remaining: data.remaining }
              : it,
          );

        return {
          ...prev,
          items: prev.items ? updateSlotItems(prev.items) : prev.items,
          slots: prev.slots
            ? prev.slots.map((s: any) => ({
                ...s,
                items: s.items ? updateSlotItems(s.items) : s.items,
              }))
            : prev.slots,
        };
      });
    },
    onSlotChanged: () => {
      fetchFlashSale();
    },
  });

  // Track scroll position for mobile sticky header
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setIsStickyBarVisible(rect.bottom < 60);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Live countdown timer ticking down
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            fetchFlashSale();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown, fetchFlashSale]);

  // Format countdown time
  const timeUnits = useMemo(() => {
    const hours = Math.floor(countdown / 3600);
    const minutes = Math.floor((countdown % 3600) / 60);
    const seconds = countdown % 60;
    return {
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: seconds.toString().padStart(2, '0'),
    };
  }, [countdown]);

  // Current active slot object
  const currentSlot = useMemo(() => {
    if (!flashSale?.slots || flashSale.slots.length === 0) return null;
    if (selectedSlotId) {
      const found = flashSale.slots.find((s: any) => s.id === selectedSlotId);
      if (found) return found;
    }
    return flashSale.activeSlot || flashSale.slots[0];
  }, [flashSale, selectedSlotId]);

  // When slot changes, update countdown
  useEffect(() => {
    if (currentSlot?.countdown !== undefined) {
      setCountdown(currentSlot.countdown);
    }
  }, [currentSlot]);

  // Extract unique categories from items of current slot
  const categories = useMemo(() => {
    const items = currentSlot?.items || flashSale?.items || [];
    const catMap = new Map<string, { id: string; name: string }>();
    items.forEach((item: any) => {
      const cat =
        item.product?.category ||
        (item.categoryName ? { id: item.categoryName, name: item.categoryName } : null);
      if (cat?.id && cat?.name) {
        catMap.set(cat.id, { id: cat.id, name: cat.name });
      }
    });
    return Array.from(catMap.values());
  }, [currentSlot, flashSale]);

  // Filtered & sorted items
  const displayItems = useMemo(() => {
    const rawItems = currentSlot?.items || flashSale?.items || [];

    let list = rawItems.filter((item: any) => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        const catId = item.product?.category?.id || item.categoryName;
        if (catId !== selectedCategory) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const pName = (item.product?.name || item.productName || '').toLowerCase();
        const cName = (item.product?.category?.name || item.categoryName || '').toLowerCase();
        if (!pName.includes(query) && !cName.includes(query)) return false;
      }

      return true;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      const pA = Number(a.product?.price || a.originalPrice || 1);
      const pB = Number(b.product?.price || b.originalPrice || 1);
      const fsA = Number(a.flashSalePrice || 0);
      const fsB = Number(b.flashSalePrice || 0);
      const discA = a.discountPercent || (pA > 0 ? Math.round((1 - fsA / pA) * 100) : 0);
      const discB = b.discountPercent || (pB > 0 ? Math.round((1 - fsB / pB) * 100) : 0);
      const progA = a.progress !== undefined ? a.progress : (a.sold || 0) / (a.stock || 1);
      const progB = b.progress !== undefined ? b.progress : (b.sold || 0) / (b.stock || 1);

      if (sortBy === 'POPULAR') return progB - progA;
      if (sortBy === 'DISCOUNT') return discB - discA;
      if (sortBy === 'PRICE_ASC') return fsA - fsB;
      if (sortBy === 'PRICE_DESC') return fsB - fsA;
      return 0;
    });

    return list;
  }, [currentSlot, flashSale, selectedCategory, searchQuery, sortBy]);

  // Total available stock in slot
  const totalAvailableInSlot = useMemo(() => {
    return displayItems.reduce(
      (acc: number, curr: any) =>
        acc + (curr.remaining !== undefined ? curr.remaining : Math.max(0, (curr.stock || 0) - (curr.sold || 0))),
      0,
    );
  }, [displayItems]);

  // Handle share
  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Đã sao chép liên kết Flash Sale!');
    }
  };

  // Subscribe "Nhắc tôi khi bắt đầu"
  const handleSubscribeReminder = async (slotId?: string, productId?: string) => {
    try {
      setSubscribingRemind(true);
      const res = await fetch('/api/promotions/flash-sale/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          flashSaleId: flashSale?.campaign?.id || flashSale?.id,
          slotId: slotId || currentSlot?.id,
          productId,
        }),
      });

      if (res.ok) {
        toast.success('Đã đăng ký nhận thông báo khi Flash Sale bắt đầu!');
        if (slotId || currentSlot?.id) {
          const key = slotId || currentSlot?.id;
          setRemindedSlots((prev) => ({ ...prev, [key]: true }));
        }
      } else {
        toast.error('Không thể đăng ký nhận tin. Vui lòng đăng nhập.');
      }
    } catch (e) {
      console.error('Reminder error:', e);
      toast.error('Lỗi kết nối máy chủ.');
    } finally {
      setSubscribingRemind(false);
    }
  };

  // Format time display
  const formatTimeSlotLabel = (slot: any) => {
    const sDate = new Date(slot.startTime);
    const eDate = new Date(slot.endTime);
    const startStr = sDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const endStr = eDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${startStr} - ${endStr}`;
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-800 font-sans pb-28">
      {/* ── BREADCRUMB / TOP NAVBAR ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <Link href="/" className="text-slate-500 hover:text-slate-900 transition-colors font-medium">
              Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[#da251d] font-black flex items-center gap-1 uppercase tracking-wider text-[11px] sm:text-xs">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse" />
              Flash Sale Giờ Vàng
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              title="Chia sẻ Flash Sale"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Chia sẻ</span>
            </button>
            <Link
              href="/favorites"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-xs font-bold text-red-600 transition-colors"
            >
              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
              <span className="hidden sm:inline">Yêu thích</span>
            </Link>
            <Link
              href="/cart"
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-[#da251d] hover:bg-red-700 text-xs font-bold text-white transition-colors shadow-sm shadow-red-600/25"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Giỏ hàng</span>
              {cartItems && cartItems.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-yellow-400 text-yellow-950 font-black text-[10px] flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* ── STICKY TOP COUNTDOWN BAR (Appears on Mobile when scrolled) ── */}
      {isStickyBarVisible && (
        <div className="fixed top-12 left-0 right-0 z-25 bg-[#da251d] text-white shadow-lg border-b border-red-700/50 py-1.5 px-3 sm:hidden animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-yellow-300 fill-yellow-300 animate-bounce" />
              <span className="text-[11px] font-black uppercase tracking-wider text-yellow-300">
                {currentSlot?.status === 'UPCOMING' ? 'SẮP MỞ' : 'FLASH SALE'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs font-mono font-black">
              <span className="bg-black/30 px-1.5 py-0.5 rounded text-yellow-300">{timeUnits.hours}</span>
              <span>:</span>
              <span className="bg-black/30 px-1.5 py-0.5 rounded text-white">{timeUnits.minutes}</span>
              <span>:</span>
              <span className="bg-black/30 px-1.5 py-0.5 rounded text-yellow-300">{timeUnits.seconds}</span>
            </div>
            <span className="text-[10px] font-bold text-red-100 bg-white/10 px-2 py-0.5 rounded-full">
              Còn {totalAvailableInSlot} suất
            </span>
          </div>
        </div>
      )}

      {/* ── HERO BANNER SECTION (MOBILE-OPTIMIZED LUXURY GRADIENT) ── */}
      <div
        ref={heroRef}
        className="relative overflow-hidden bg-gradient-to-br from-[#b91c1c] via-[#dc2626] to-[#991b1b] text-white pt-6 sm:pt-10 pb-8 sm:pb-12 px-3.5 sm:px-6 shadow-md"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.22),transparent_70%)] pointer-events-none" />
        <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-52 h-52 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-5 sm:gap-8">
            {/* Left info */}
            <div className="text-center lg:text-left space-y-2.5 sm:space-y-3.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-yellow-300 text-[10px] sm:text-xs font-black tracking-wider uppercase shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-ping" />
                <Flame className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300 animate-bounce" />
                <span>GIỜ VÀNG GIÁ SỐC • GIẢM ĐẾN 50%</span>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                FLASH SALE <span className="text-yellow-300 drop-shadow-sm">GIỜ VÀNG</span>
              </h1>

              <p className="text-red-100 text-[11px] sm:text-xs md:text-sm font-medium leading-relaxed max-w-xl line-clamp-2 sm:line-clamp-none">
                {flashSale?.campaign?.description ||
                  'Thưởng thức ẩm thực Nhật Bản thượng hạng tại Avora Restaurant với mức giá ưu đãi bùng nổ theo từng khung giờ vàng độc quyền!'}
              </p>

              {/* Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 sm:gap-2 pt-0.5 text-[10px] sm:text-[11px] font-bold text-white/95">
                <span className="flex items-center gap-1 bg-black/20 backdrop-blur-xs border border-white/15 px-2.5 py-1 rounded-xl">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Chuẩn vị bếp trưởng
                </span>
                <span className="flex items-center gap-1 bg-black/20 backdrop-blur-xs border border-white/15 px-2.5 py-1 rounded-xl">
                  <Truck className="w-3 h-3 text-amber-300" />
                  Giao nhanh giữ vị
                </span>
                <span className="flex items-center gap-1 bg-black/20 backdrop-blur-xs border border-white/15 px-2.5 py-1 rounded-xl">
                  <Crown className="w-3 h-3 text-yellow-300" />
                  Tồn kho Flash riêng
                </span>
              </div>
            </div>

            {/* Right Countdown Box */}
            <div className="w-full sm:w-auto shrink-0">
              <div className="bg-black/30 backdrop-blur-md border border-white/25 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl text-center min-w-[280px] sm:min-w-[320px]">
                <div className="flex items-center justify-center gap-1.5 text-yellow-300 text-[11px] sm:text-xs font-black uppercase tracking-wider mb-2.5">
                  <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>
                    {currentSlot?.status === 'UPCOMING'
                      ? 'BẮT ĐẦU TRONG'
                      : 'KẾT THÚC TRONG'}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <div className="flex flex-col items-center">
                    <div className="w-12 sm:w-16 h-12 sm:h-16 bg-white/15 rounded-xl sm:rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                      <span className="font-mono text-xl sm:text-3xl font-black text-white">
                        {timeUnits.hours}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-red-100 uppercase mt-0.5 sm:mt-1">Giờ</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-yellow-300 mb-3 sm:mb-4">:</span>
                  <div className="flex flex-col items-center">
                    <div className="w-12 sm:w-16 h-12 sm:h-16 bg-white/15 rounded-xl sm:rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                      <span className="font-mono text-xl sm:text-3xl font-black text-white">
                        {timeUnits.minutes}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-red-100 uppercase mt-0.5 sm:mt-1">Phút</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-yellow-300 mb-3 sm:mb-4">:</span>
                  <div className="flex flex-col items-center">
                    <div className="w-12 sm:w-16 h-12 sm:h-16 bg-white/15 rounded-xl sm:rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                      <span className="font-mono text-xl sm:text-3xl font-black text-yellow-300">
                        {timeUnits.seconds}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-red-100 uppercase mt-0.5 sm:mt-1">Giây</span>
                  </div>
                </div>

                {/* Reminder CTA if Upcoming */}
                {currentSlot?.status === 'UPCOMING' && (
                  <button
                    onClick={() => handleSubscribeReminder(currentSlot.id)}
                    disabled={subscribingRemind || remindedSlots[currentSlot.id]}
                    className={`mt-3 w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      remindedSlots[currentSlot.id]
                        ? 'bg-emerald-500 text-white'
                        : 'bg-yellow-400 hover:bg-yellow-300 text-yellow-950 shadow-md font-black'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>
                      {remindedSlots[currentSlot.id]
                        ? '✓ Đã đăng ký nhận tin'
                        : 'Nhắc tôi khi bắt đầu'}
                    </span>
                  </button>
                )}

                <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] sm:text-xs text-red-100 font-medium">
                  <span>Suất ưu đãi còn lại:</span>
                  <span className="font-black text-yellow-300 font-mono">
                    {totalAvailableInSlot} suất
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── TIMELINE SLOTS BAR (SHOPEE STYLE HORIZONTAL SCROLL) ── */}
          {flashSale?.slots && flashSale.slots.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/20">
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none snap-x snap-mandatory">
                {flashSale.slots.map((slot: any) => {
                  const isSelected = slot.id === currentSlot?.id;
                  const isActiveStatus = slot.status === 'ACTIVE';
                  const isUpcomingStatus = slot.status === 'UPCOMING';

                  return (
                    <button
                      key={slot.id}
                      onClick={() => {
                        setSelectedSlotId(slot.id);
                        if (slot.countdown !== undefined) {
                          setCountdown(slot.countdown);
                        }
                      }}
                      className={`p-2.5 sm:p-3 rounded-2xl border transition-all text-left relative overflow-hidden shrink-0 w-36 sm:w-44 snap-start cursor-pointer ${
                        isSelected
                          ? 'bg-white text-slate-900 border-white shadow-xl scale-[1.02]'
                          : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-950 font-black text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                          Đang xem
                        </div>
                      )}
                      <p className={`font-black text-xs sm:text-sm ${isSelected ? 'text-[#da251d]' : 'text-white'}`}>
                        {formatTimeSlotLabel(slot)}
                      </p>
                      <p className={`text-[10px] font-bold mt-0.5 flex items-center gap-1 ${isSelected ? 'text-slate-600' : 'text-red-100'}`}>
                        {isActiveStatus && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        )}
                        <span>
                          {isActiveStatus
                            ? 'Đang diễn ra'
                            : isUpcomingStatus
                            ? 'Sắp diễn ra'
                            : 'Đã kết thúc'}
                        </span>
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER (LIGHT THEME) ── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-7 space-y-4 sm:space-y-6">
        {/* ── FILTER & SEARCH TOOLBAR ── */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm món Flash Sale theo tên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="text-xs text-slate-400 font-bold hidden sm:inline flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sắp xếp:
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto w-full sm:w-auto">
              {[
                { key: 'POPULAR', label: 'Bán chạy', icon: Flame },
                { key: 'DISCOUNT', label: 'Giảm sâu', icon: Zap },
                { key: 'PRICE_ASC', label: 'Giá ↑' },
                { key: 'PRICE_DESC', label: 'Giá ↓' },
              ].map(({ key, label, icon: Icon }: any) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key as SortOption)}
                  className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 ${
                    sortBy === key
                      ? 'bg-[#da251d] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {Icon && (
                    <Icon
                      className={`w-3 h-3 ${
                        sortBy === key ? 'text-yellow-300 fill-yellow-300' : 'text-slate-400'
                      }`}
                    />
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── CATEGORY PILLS ── */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'ALL'
                  ? 'bg-[#da251d] text-white shadow-md shadow-red-600/20'
                  : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Tất cả ({displayItems.length})</span>
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-[#da251d] text-white shadow-md shadow-red-600/20'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

        {/* ── UPCOMING BANNER NOTICE IF SLOT IS UPCOMING ── */}
        {currentSlot?.status === 'UPCOMING' && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <strong className="block font-bold sm:inline sm:mr-1">
                  Khung giờ sắp diễn ra:
                </strong>
                <span>
                  Giá Flash Sale sẽ được kích hoạt lúc {formatTimeSlotLabel(currentSlot)}. Món đặt trước giờ này được tính theo giá bán gốc.
                </span>
              </div>
            </div>

            <button
              onClick={() => handleSubscribeReminder(currentSlot.id)}
              disabled={subscribingRemind || remindedSlots[currentSlot.id]}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                remindedSlots[currentSlot.id]
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
              }`}
            >
              {remindedSlots[currentSlot.id] ? '✓ Đã nhận nhắc' : 'Nhắc tôi'}
            </button>
          </div>
        )}

        {/* ── DISH GRID SECTION (2 COLS ON MOBILE, 3-4 ON DESKTOP) ── */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-[#da251d] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-bold text-slate-500">Đang chuẩn bị thực đơn Flash Sale...</p>
          </div>
        ) : displayItems.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-6 space-y-3 shadow-2xs">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto text-[#da251d]">
              <Zap className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Chưa có món Flash Sale phù hợp</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? 'Không tìm thấy món ăn khớp với từ khóa. Thử tìm kiếm với tên khác nhé!'
                : 'Khung giờ này đang được cập nhật món mới. Bạn có thể xem thêm các món ngon tại Thực đơn!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {displayItems.map((item: any) => {
              const originalPrice = Number(item.originalPrice || item.product?.price || item.productPrice || 0);
              const salePrice = Number(item.flashSalePrice || 0);
              const discountPercent =
                item.discountPercent || (originalPrice > 0 ? Math.round((1 - salePrice / originalPrice) * 100) : 0);
              const savingsAmount = Math.max(0, originalPrice - salePrice);
              const stock = Number(item.stock || 0);
              const sold = Number(item.sold || 0);
              const remaining = item.remaining !== undefined ? Number(item.remaining) : Math.max(0, stock - sold);
              const progress = stock > 0 ? Math.min(100, Math.round((sold / stock) * 100)) : 0;
              const isLowStock = remaining <= 5 && remaining > 0;
              const isSoldOut = item.isSoldOut || remaining <= 0;
              const isSlotUpcoming = currentSlot?.status === 'UPCOMING';

              // Canonical URL resolution
              const catSlug =
                item.categorySlug ||
                item.product?.category?.slug ||
                (typeof item.product?.category === 'string' ? item.product.category : null) ||
                'thuc-don';

              const prodSlug =
                item.productSlug ||
                item.product?.slug ||
                item.slug ||
                item.productId ||
                item.product?.id ||
                item.id;

              const productUrl = `/${catSlug}/${prodSlug}`;

              const product = {
                id: item.productId || item.product?.id || item.id,
                name: item.productName || item.product?.name || 'Món ăn',
                price: originalPrice,
                imageUrl: item.productImage || item.product?.imageUrl,
                slug: prodSlug,
                category: item.product?.category || { slug: catSlug, name: item.categoryName || 'Món ăn' },
                flashSalePrice: salePrice,
                flashSaleId: item.flashSaleId || flashSale?.id,
                flashSaleSlotId: currentSlot?.id,
                flashSaleStock: stock,
                flashSaleSold: sold,
                maxQuantityPerUser: item.maxQuantityPerUser,
              };

              const isFav = isFavorite(product.id);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-red-300 transition-all duration-300 overflow-hidden flex flex-col justify-between group relative"
                >
                  <div>
                    {/* Image Container with 1:1 Aspect Ratio */}
                    <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                      <Link href={productUrl} className="block w-full h-full">
                        <img
                          src={product.imageUrl || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400'}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15 pointer-events-none" />
                      </Link>

                      {/* Discount ribbon */}
                      {discountPercent > 0 && (
                        <div className="absolute top-2 left-2 bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-[10px] sm:text-xs px-2 py-0.5 rounded-lg sm:rounded-xl shadow-md border border-white/20 flex items-center gap-0.5 sm:gap-1 z-10 pointer-events-none">
                          <Flame className="w-3 h-3 text-yellow-300 fill-yellow-300" />
                          <span>-{discountPercent}%</span>
                        </div>
                      )}

                      {/* Wishlist Heart Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(product);
                        }}
                        className={`absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all z-20 cursor-pointer shadow-md ${
                          isFav
                            ? 'bg-white text-red-600 scale-110'
                            : 'bg-white/85 backdrop-blur-md text-slate-400 hover:text-red-600 hover:bg-white'
                        }`}
                        title={isFav ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                      >
                        <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFav ? 'fill-red-600 text-red-600' : ''}`} />
                      </button>

                      {/* Low Stock / Sold Out Badge */}
                      {isSoldOut ? (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-10 pointer-events-none">
                          <span className="bg-red-600 text-white font-black text-[11px] sm:text-xs px-3 py-1 rounded-xl uppercase tracking-wider shadow-lg">
                            ĐÃ HẾT HÀNG
                          </span>
                        </div>
                      ) : isLowStock ? (
                        <div className="absolute bottom-2 right-2 bg-amber-500 text-amber-950 font-black text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg uppercase tracking-wider animate-pulse shadow-md z-10 pointer-events-none">
                          Còn {remaining}
                        </div>
                      ) : null}

                      {/* Upcoming Teaser Tag */}
                      {isSlotUpcoming && (
                        <div className="absolute bottom-2 left-2 bg-amber-500 text-amber-950 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-md border border-amber-300 z-10 uppercase pointer-events-none">
                          Sắp mở
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-2.5 sm:p-4 space-y-1.5 sm:space-y-2">
                      <Link href={productUrl} className="block group/title">
                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] group-hover/title:text-[#da251d] transition-colors">
                          {product.name}
                        </h3>
                      </Link>

                      {/* Price row */}
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-sm sm:text-base md:text-lg font-black text-[#da251d] font-mono leading-tight">
                            {new Intl.NumberFormat('vi-VN').format(salePrice)}đ
                          </span>
                          {originalPrice > 0 && (
                            <span className="text-[10px] sm:text-xs text-slate-400 line-through font-mono">
                              {new Intl.NumberFormat('vi-VN').format(originalPrice)}đ
                            </span>
                          )}
                        </div>
                        {savingsAmount > 0 && (
                          <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded self-start mt-0.5">
                            Tiết kiệm {new Intl.NumberFormat('vi-VN').format(savingsAmount)}đ
                          </span>
                        )}
                      </div>

                      {/* Quota limit notice */}
                      {item.maxQuantityPerUser && (
                        <div className="text-[9px] sm:text-[10px] text-amber-800 bg-amber-50/80 border border-amber-200/60 px-1.5 py-0.5 rounded font-medium">
                          Tối đa {item.maxQuantityPerUser} phần/khách
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stock Progress & Add to Cart Footer */}
                  <div className="p-2.5 sm:p-4 pt-0 space-y-2 sm:space-y-3">
                    {/* ── SHOPEE-STYLE FLAME PROGRESS CAPSULE ── */}
                    <div className="w-full bg-red-100/90 rounded-full h-4 sm:h-4.5 overflow-hidden relative flex items-center shadow-inner">
                      {/* Gradient Fill */}
                      <div
                        className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />

                      {/* Flame Label Text Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)] uppercase tracking-wider pointer-events-none px-1">
                        {isSoldOut ? (
                          'ĐÃ HẾT HÀNG'
                        ) : sold === 0 ? (
                          'VỪA MỞ BÁN'
                        ) : remaining <= 3 || progress >= 85 ? (
                          <span className="flex items-center gap-0.5 text-yellow-200">
                            <Flame className="w-2.5 h-2.5 fill-yellow-200" /> SẮP CHÁY HÀNG
                          </span>
                        ) : (
                          `ĐÃ BÁN ${sold}`
                        )}
                      </div>
                    </div>

                    {/* Quick Add Button / Upcoming Button */}
                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                      <Link
                        href={productUrl}
                        className="text-[11px] sm:text-xs text-slate-500 hover:text-slate-900 font-bold flex items-center transition-colors"
                      >
                        Chi tiết <ChevronRight className="w-3 h-3 text-slate-400" />
                      </Link>

                      {isSlotUpcoming ? (
                        <button
                          onClick={() => handleSubscribeReminder(currentSlot?.id, product.id)}
                          className="px-2.5 sm:px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-bold text-[11px] sm:text-xs border border-amber-200 flex items-center gap-1 cursor-pointer transition"
                        >
                          <Bell className="w-3 h-3 text-amber-600" />
                          <span>Nhắc tôi</span>
                        </button>
                      ) : !isSoldOut ? (
                        <div className="scale-95 sm:scale-100 origin-right">
                          <AddToCartButton
                            item={product}
                            className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-[#da251d] hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-xl">
                          Hết suất
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── BENEFIT HIGHLIGHTS FOOTER ── */}
        <div className="mt-8 sm:mt-12 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Chất Lượng Thượng Hạng</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Món ăn Flash Sale được chế biến từ nguyên liệu tươi nhập khẩu 100%, giữ trọn định lượng và hương vị bếp trưởng.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Giao Hỏa Tốc Giữ Vị</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Đóng gói bảo nhiệt chuyên dụng, cam kết giao món nóng hổi trong 30-45 phút tại các chi nhánh gần bạn.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Giờ Vàng Mỗi Ngày</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Khung giờ vàng Flash Sale được mở liên tục trong ngày. Theo dõi và săn deal để không bỏ lỡ món yêu thích!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
