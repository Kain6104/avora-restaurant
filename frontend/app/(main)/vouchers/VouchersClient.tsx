'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Ticket, 
  Truck, 
  Gift, 
  Wallet, 
  Search, 
  Sparkles, 
  Check, 
  Copy, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  Bookmark, 
  Trash2, 
  Flame, 
  ChevronRight,
  ShoppingBag,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

import VoucherConditionModal from '@/components/voucher/VoucherConditionModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface VouchersClientProps {
  initialVouchers?: any[];
}

export default function VouchersClient({ initialVouchers = [] }: VouchersClientProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'FOOD' | 'FREE_SHIP' | 'MEMBER' | 'WALLET' | 'EXPIRED_USED'>('ALL');
  
  const [allVouchers, setAllVouchers] = useState<any[]>(initialVouchers);
  const [walletVouchers, setWalletVouchers] = useState<any[]>([]);
  // Only show full loading if we have zero initial vouchers
  const [loading, setLoading] = useState<boolean>(initialVouchers.length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Claim code input
  const [inputCode, setInputCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Condition modal state
  const [conditionVoucher, setConditionVoucher] = useState<any | null>(null);

  // Core data fetcher using Promise.allSettled to prevent hanging
  const fetchAllData = useCallback(async (targetUserId?: string, isSilent = false) => {
    if (!isSilent && allVouchers.length === 0) setLoading(true);
    
    try {
      const voucherPromise = fetch(`${API_URL}/api/promotions/vouchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ userId: targetUserId }),
      })
        .then(async (res) => {
          if (res.ok) {
            const json = await res.json();
            const vData = Array.isArray(json) ? json : (json?.data || []);
            setAllVouchers(vData);
            setLoading(false);
          }
        })
        .catch(() => {
          // Fallback to relative URL
          return fetch('/api/promotions/vouchers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: targetUserId }),
          })
            .then(async (res) => {
              if (res.ok) {
                const json = await res.json();
                const vData = Array.isArray(json) ? json : (json?.data || []);
                setAllVouchers(vData);
              }
            })
            .catch(() => {});
        });

      const walletPromise = targetUserId
        ? fetch(`${API_URL}/api/promotions/vouchers/wallet?userId=${targetUserId}`, {
            credentials: 'include',
            headers: { 'ngrok-skip-browser-warning': 'true' },
          })
            .then(async (res) => {
              if (res.ok) {
                const wJson = await res.json();
                const wData = Array.isArray(wJson) ? wJson : (wJson?.data || []);
                setWalletVouchers(wData);
              }
            })
            .catch(() => {
              return fetch(`/api/promotions/vouchers/wallet?userId=${targetUserId}`, { credentials: 'include' })
                .then(async (res) => {
                  if (res.ok) {
                    const wJson = await res.json();
                    const wData = Array.isArray(wJson) ? wJson : (wJson?.data || []);
                    setWalletVouchers(wData);
                  }
                })
                .catch(() => {});
            })
        : Promise.resolve();

      await Promise.allSettled([voucherPromise, walletPromise]);
    } catch (err) {
      console.error('Error in fetchAllData:', err);
    } finally {
      setLoading(false);
    }
  }, [allVouchers.length]);

  // Mount initialization: Resolve user once and sync vouchers
  useEffect(() => {
    let active = true;

    const resolveUserAndData = async () => {
      let resolvedUser: any = null;

      // 1. Check current logged-in user
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        }).catch(() => fetch('/api/auth/me', { credentials: 'include' }));

        if (res && res.ok) {
          const data = await res.json();
          resolvedUser = data?.user || data?.data || (data?.id ? data : null);
        }
      } catch (_) {}

      // 2. Fallback to localStorage
      if (!resolvedUser && typeof window !== 'undefined') {
        const stored = localStorage.getItem('user');
        if (stored) {
          try {
            resolvedUser = JSON.parse(stored);
          } catch (_) {}
        }
      }

      if (active) {
        if (resolvedUser) setCurrentUser(resolvedUser);
        // Refresh with user id to compute user-specific remaining quotas
        await fetchAllData(resolvedUser?.id, true);
        setLoading(false);
      }
    };

    resolveUserAndData();

    // Failsafe: Force loading false after 2.5s maximum
    const timer = setTimeout(() => {
      if (active) setLoading(false);
    }, 2500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  // Refresh helper for mutations (silent update)
  const refreshData = useCallback(() => {
    fetchAllData(currentUser?.id, true);
  }, [currentUser, fetchAllData]);

  // Handle claim voucher by manual code input
  const handleClaimManualCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inputCode.trim().toUpperCase();
    if (!code) {
      toast.error('Vui lòng nhập mã ưu đãi');
      return;
    }

    if (!currentUser) {
      toast.error('Vui lòng đăng nhập để lưu voucher vào ví');
      router.push('/login?redirectURL=/vouchers');
      return;
    }

    setClaiming(true);
    try {
      const res = await fetch(`${API_URL}/api/promotions/vouchers/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ code, userId: currentUser.id }),
      }).catch(() => fetch('/api/promotions/vouchers/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId: currentUser.id }),
      }));

      if (!res) throw new Error('Network error');
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Đã thêm mã [${code}] vào ví voucher của bạn!`, {
          duration: 3500,
        });
        setInputCode('');
        refreshData();
        setActiveTab('WALLET');
      } else {
        toast.error(data.message || 'Mã ưu đãi không hợp lệ hoặc đã hết lượt');
      }
    } catch (err) {
      toast.error('Không thể kết nối đến máy chủ');
    } finally {
      setClaiming(false);
    }
  };

  // Handle saving a voucher from the list to wallet
  const handleSaveToWallet = async (voucher: any) => {
    if (!currentUser) {
      toast.error('Vui lòng đăng nhập để lưu voucher vào ví');
      router.push('/login?redirectURL=/vouchers');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/promotions/vouchers/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ voucherId: voucher.id, userId: currentUser.id }),
      }).catch(() => fetch('/api/promotions/vouchers/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherId: voucher.id, userId: currentUser.id }),
      }));

      if (!res) throw new Error('Network error');
      const data = await res.json();
      if (res.ok) {
        toast.success(`Đã lưu [${voucher.code}] vào ví của bạn!`, { icon: '🔖' });
        refreshData();
      } else {
        toast.error(data.message || 'Không thể lưu voucher này');
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  // Handle remove from wallet
  const handleRemoveFromWallet = async (voucherId: string, code: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_URL}/api/promotions/vouchers/wallet/${voucherId}?userId=${currentUser.id}`, {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      }).catch(() => fetch(`/api/promotions/vouchers/wallet/${voucherId}?userId=${currentUser.id}`, {
        method: 'DELETE',
      }));

      if (res && res.ok) {
        toast.success(`Đã gỡ mã [${code}] khỏi ví`);
        setWalletVouchers((prev) => prev.filter((item) => item.voucher?.id !== voucherId && item.voucherId !== voucherId));
        refreshData();
      }
    } catch (err) {
      toast.error('Không thể xóa voucher khỏi ví');
    }
  };

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Đã sao chép mã: ${code}`, { duration: 2000 });
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  // Direct use
  const handleUseNow = (code: string) => {
    handleCopyCode(code);
    router.push('/menu');
  };

  // Compute expired and used vouchers across wallet and system
  const getExpiredUsedVouchers = useCallback(() => {
    const now = new Date();
    const result: any[] = [];
    const seenIds = new Set<string>();

    // Vouchers from user wallet that are used, expired, or exhausted
    walletVouchers.forEach((item) => {
      const v = item.voucher;
      if (!v) return;
      const isExp = (v.endDate && new Date(v.endDate) < now) || v.isExpired;
      const isUsed = item.isUsed || v.isUserExhausted || v.isSystemExhausted;
      if (isExp || isUsed || !v.isActive) {
        if (!seenIds.has(v.id)) {
          seenIds.add(v.id);
          result.push({
            ...v,
            isUsed: item.isUsed,
            isExpired: isExp,
            isSavedInWallet: true,
          });
        }
      }
    });

    // Vouchers from allVouchers that are expired or exhausted
    allVouchers.forEach((v) => {
      if (!v) return;
      const isExp = (v.endDate && new Date(v.endDate) < now) || v.isExpired;
      const isUsed = v.isUserExhausted || v.isSystemExhausted;
      if (isExp || isUsed || !v.isActive) {
        if (!seenIds.has(v.id)) {
          seenIds.add(v.id);
          result.push({
            ...v,
            isExpired: isExp,
          });
        }
      }
    });

    return result;
  }, [walletVouchers, allVouchers]);

  const expiredUsedVouchers = getExpiredUsedVouchers();
  const expiredUsedCount = expiredUsedVouchers.length;

  // Filter vouchers based on search & tab
  const getFilteredVouchers = () => {
    if (activeTab === 'WALLET') {
      return walletVouchers
        .map((item) => item.voucher)
        .filter((v) => {
          if (!v) return false;
          if (!searchTerm.trim()) return true;
          const query = searchTerm.toLowerCase();
          return v.code?.toLowerCase().includes(query) || v.title?.toLowerCase().includes(query);
        });
    }

    if (activeTab === 'EXPIRED_USED') {
      return expiredUsedVouchers.filter((v) => {
        if (!searchTerm.trim()) return true;
        const query = searchTerm.toLowerCase();
        return v.code?.toLowerCase().includes(query) || v.title?.toLowerCase().includes(query);
      });
    }

    return allVouchers.filter((v) => {
      // Tab filter
      if (activeTab === 'FOOD' && v.discountType === 'FREE_SHIP') return false;
      if (activeTab === 'FREE_SHIP' && v.discountType !== 'FREE_SHIP') return false;
      if (activeTab === 'MEMBER' && (!v.membershipTiers || v.membershipTiers.length === 0)) return false;

      // Search filter
      if (!searchTerm.trim()) return true;
      const query = searchTerm.toLowerCase();
      return v.code?.toLowerCase().includes(query) || v.title?.toLowerCase().includes(query);
    });
  };

  const displayedList = getFilteredVouchers();
  const walletCount = walletVouchers.length;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      {/* 1. HERO BANNER & SEARCH */}
      <div className="relative bg-gradient-to-br from-red-600 via-rose-700 to-amber-600 text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden shadow-lg">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="max-w-5xl mx-auto relative z-10">
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold mb-3 border border-white/20">
                <Sparkles size={14} className="text-amber-300 animate-pulse" />
                <span>Kho Ưu Đãi Độc Quyền AVORA</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                Săn Voucher & Ví Quà Tặng
              </h1>
              <p className="mt-2 text-sm sm:text-base text-red-100 max-w-xl">
                Thu thập mã giảm giá món ăn, miễn phí giao hàng 100% và ưu đãi hạng thành viên ngay trong ví của bạn.
              </p>
            </div>

            {/* Quick Wallet CTA Pill */}
            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveTab('WALLET')}
                className="flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur-md px-4 py-3 rounded-2xl transition-all self-start md:self-auto cursor-pointer shadow-sm group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-black shadow-md group-hover:scale-105 transition-transform">
                  <Wallet size={20} />
                </div>
                <div className="text-left">
                  <p className="text-xs text-red-100 font-medium">Ví Voucher của tôi</p>
                  <p className="text-sm font-black text-white">
                    {walletCount > 0 ? `${walletCount} mã đã lưu` : 'Chưa lưu mã nào'}
                  </p>
                </div>
                <ChevronRight size={18} className="text-white/60 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>

          {/* CODE CLAIM BAR */}
          <div className="mt-8 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 shadow-xl border border-white/50 text-slate-800">
            <form onSubmit={handleClaimManualCode} className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Gift className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500" size={18} />
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="Nhập mã ưu đãi bí mật (VD: AVORA50K, FREESHIP...)"
                  className="w-full pl-10 pr-4 py-2.5 text-sm sm:text-base font-mono font-bold tracking-wider uppercase text-slate-900 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={claiming || !inputCode.trim()}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center justify-center gap-2 cursor-pointer"
              >
                {claiming ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Bookmark size={16} />
                    <span>Lưu vào ví ngay</span>
                  </>
                )}
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* 2. NAVIGATION TABS & SEARCH FILTER */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-2 sm:p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ưu đãi ({allVouchers.length})
            </button>
            <button
              onClick={() => setActiveTab('FOOD')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'FOOD'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Giảm giá món
            </button>
            <button
              onClick={() => setActiveTab('FREE_SHIP')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'FREE_SHIP'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              FreeShip
            </button>
            <button
              onClick={() => setActiveTab('MEMBER')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'MEMBER'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ưu đãi thành viên
            </button>
            <button
              onClick={() => setActiveTab('WALLET')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'WALLET'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Wallet size={14} />
              <span>Ví của tôi</span>
              {walletCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
                  {walletCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('EXPIRED_USED')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'EXPIRED_USED'
                  ? 'bg-slate-700 text-white shadow-xs font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock size={14} />
              <span>Hết hạn / Đã dùng</span>
              {expiredUsedCount > 0 && (
                <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                  activeTab === 'EXPIRED_USED' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {expiredUsedCount}
                </span>
              )}
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã hoặc tên..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

        </div>
      </div>

      {/* 3. VOUCHERS LIST */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* Notice for Wallet view if not logged in */}
        {activeTab === 'WALLET' && !currentUser && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-900 my-4 shadow-xs">
            <Wallet className="w-12 h-12 text-amber-600 mx-auto mb-2" />
            <h3 className="font-bold text-base">Bạn chưa đăng nhập</h3>
            <p className="text-xs text-amber-700 mt-1 max-w-sm mx-auto">
              Đăng nhập tài khoản để lưu trữ các voucher đã gom và sử dụng khi đặt đơn tại Avora Restaurant.
            </p>
            <Link
              href="/login?redirectURL=/vouchers"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md cursor-pointer transition-colors"
            >
              Đăng nhập ngay
            </Link>
          </div>
        )}

        {loading && allVouchers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <div className="w-10 h-10 border-3 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium">Đang tải kho voucher Avora...</p>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 shadow-2xs mt-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
              <Ticket size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {activeTab === 'WALLET'
                ? 'Ví voucher của bạn đang trống'
                : activeTab === 'EXPIRED_USED'
                ? 'Không có voucher nào đã dùng hoặc hết hạn'
                : 'Không tìm thấy mã ưu đãi nào phù hợp'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeTab === 'WALLET'
                ? 'Hãy khám phá các voucher hot ở tab "Tất cả ưu đãi" và bấm "Lưu vào ví" để tích lũy.'
                : activeTab === 'EXPIRED_USED'
                ? 'Các mã ưu đãi đã sử dụng hoặc hết hạn của bạn sẽ được hiển thị tại đây.'
                : 'Thử tìm kiếm với từ khóa khác hoặc khám phá các danh mục mã giảm giá khác.'}
            </p>
            {activeTab === 'WALLET' && (
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className="mt-4 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
              >
                Khám phá voucher ngay
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {displayedList.map((voucher) => {
              const isShipping = voucher.discountType === 'FREE_SHIP';
              const now = new Date();
              const startDate = new Date(voucher.startDate);
              const endDate = new Date(voucher.endDate);

              const isSystemExhausted = voucher.isSystemExhausted || (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit);
              const isUserExhausted = voucher.isUserExhausted || (voucher.usageLimitPerUser !== null && (voucher.usedCountByUser || 0) >= voucher.usageLimitPerUser);
              const isExpired = now > endDate;
              const isNotStarted = now < startDate;
              const isAvailable = voucher.isActive && !isExpired && !isNotStarted && !isSystemExhausted && !isUserExhausted;

              const isSaved = voucher.isSavedInWallet || walletVouchers.some((w) => w.voucher?.id === voucher.id || w.voucherId === voucher.id);

              // Usage percent progress
              const usagePercent = voucher.usageLimit 
                ? Math.min(100, Math.round((voucher.usedCount / voucher.usageLimit) * 100))
                : 0;

              return (
                <div
                  key={voucher.id}
                  className={`relative flex bg-white rounded-2xl sm:rounded-3xl border overflow-hidden transition-all shadow-xs hover:shadow-md ${
                    !isAvailable
                      ? 'border-slate-200 opacity-70 bg-slate-50/60'
                      : isShipping
                      ? 'border-emerald-200/80 hover:border-emerald-300'
                      : 'border-red-200/80 hover:border-red-300'
                  }`}
                >
                  {/* LEFT VOUCHER VALUE CUTOUT SECTION */}
                  <div
                    className={`w-28 sm:w-32 shrink-0 flex flex-col items-center justify-center p-3 relative text-white select-none ${
                      !isAvailable
                        ? 'bg-slate-400'
                        : isShipping
                        ? 'bg-gradient-to-b from-emerald-500 to-teal-600'
                        : 'bg-gradient-to-b from-red-500 to-rose-600'
                    }`}
                  >
                    {/* Cutout Notches */}
                    <div className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-slate-50/60 border border-slate-200" />
                    <div className="absolute -bottom-3 -right-3 w-6 h-6 rounded-full bg-slate-50/60 border border-slate-200" />

                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-1.5 shadow-inner">
                      {isShipping ? <Truck size={20} /> : <Ticket size={20} />}
                    </div>

                    <div className="text-center font-black tracking-tight leading-none">
                      {voucher.discountType === 'PERCENTAGE' && (
                        <>
                          <span className="text-xl sm:text-2xl">GIẢM {voucher.discountValue}%</span>
                        </>
                      )}
                      {voucher.discountType === 'FIXED_AMOUNT' && (
                        <>
                          <span className="text-lg sm:text-xl">GIẢM {Math.round(voucher.discountValue / 1000)}K</span>
                        </>
                      )}
                      {voucher.discountType === 'FREE_SHIP' && (
                        <>
                          <span className="text-sm sm:text-base font-black">FREESHIP</span>
                          {voucher.discountValue > 0 && (
                            <span className="block text-[10px] opacity-90 mt-0.5">TỐI ĐA {Math.round(voucher.discountValue / 1000)}K</span>
                          )}
                        </>
                      )}
                    </div>

                    <span className="mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-black/20 text-white/90">
                      {isShipping ? 'Vận chuyển' : 'Đơn hàng'}
                    </span>
                  </div>

                  {/* RIGHT BODY CONTENT */}
                  <div className="flex-1 p-3.5 sm:p-4 flex flex-col justify-between min-w-0 border-l border-dashed border-slate-200">
                    
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2 py-0.5 rounded-md border border-slate-200">
                          {voucher.code}
                        </span>

                        {voucher.isUsed && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                            ĐÃ SỬ DỤNG
                          </span>
                        )}
                        {!voucher.isUsed && isUserExhausted && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                            HẾT LƯỢT CỦA BẠN
                          </span>
                        )}
                        {!voucher.isUsed && isSystemExhausted && !isUserExhausted && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                            HẾT LƯỢT HỆ THỐNG
                          </span>
                        )}
                        {!voucher.isUsed && isExpired && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 border border-slate-300">
                            HẾT HẠN
                          </span>
                        )}

                        {isSaved && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                            <Bookmark size={10} className="fill-teal-700" />
                            <span>Đã trong ví</span>
                          </span>
                        )}
                      </div>

                      {/* Title & Conditions */}
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 mt-1.5 leading-snug line-clamp-1">
                        {voucher.title}
                      </h3>

                      <p className="text-xs text-slate-500 mt-0.5">
                        Đơn tối thiểu: <strong className="text-slate-700 font-semibold">{voucher.minOrderValue.toLocaleString('vi-VN')}đ</strong>
                        {voucher.maxDiscount ? ` • Giảm tối đa ${(voucher.maxDiscount / 1000).toLocaleString('vi-VN')}k` : ''}
                      </p>

                      {/* Progress bar if limited */}
                      {voucher.usageLimit ? (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-1">
                            <span>Đã dùng {usagePercent}%</span>
                            <span>{voucher.usedCount}/{voucher.usageLimit} lượt</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                usagePercent >= 90 ? 'bg-rose-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Flame size={12} className="text-amber-500" />
                          <span>Ưu đãi không giới hạn lượt dùng</span>
                        </p>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={12} />
                          <span>HSD: {endDate.toLocaleDateString('vi-VN')}</span>
                        </div>

                        {/* Điều kiện Button */}
                        <button
                          type="button"
                          onClick={() => setConditionVoucher(voucher)}
                          className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Info size={12} />
                          <span>Điều kiện</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Copy Code button */}
                        <button
                          type="button"
                          onClick={() => handleCopyCode(voucher.code)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Sao chép mã"
                        >
                          {copiedCode === voucher.code ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>

                        {/* Save to wallet OR Use Now button */}
                        {activeTab === 'WALLET' || activeTab === 'EXPIRED_USED' ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUseNow(voucher.code)}
                              disabled={!isAvailable}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                isAvailable
                                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <span>{voucher.isUsed ? 'Đã dùng' : isExpired ? 'Hết hạn' : 'Dùng ngay'}</span>
                              {isAvailable && <ArrowRight size={12} />}
                            </button>
                            {isSaved && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFromWallet(voucher.id, voucher.code)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Gỡ khỏi ví"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {!isSaved ? (
                              <button
                                type="button"
                                onClick={() => handleSaveToWallet(voucher)}
                                disabled={!isAvailable}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                  isAvailable
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer shadow-2xs'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                <Bookmark size={12} />
                                <span>Lưu vào ví</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUseNow(voucher.code)}
                                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <span>Dùng ngay</span>
                                <ArrowRight size={12} />
                              </button>
                            )}
                          </>
                        )}

                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* MODAL ĐIỀU KIỆN VOUCHER (THEO CỘT CSDL) */}
      <VoucherConditionModal
        voucher={conditionVoucher}
        isOpen={!!conditionVoucher}
        onClose={() => setConditionVoucher(null)}
        currentUserTierId={currentUser?.membershipTierId}
      />

    </div>
  );
}
