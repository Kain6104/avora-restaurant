'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Barcode from 'react-barcode';
import {
  Crown,
  Sparkles,
  ChevronRight,
  Gift,
  History,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  Calendar,
  Percent,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  UtensilsCrossed,
  Ticket,
  Copy,
  Check,
  Tag,
  Clock,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PointTransaction {
  id: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  orderCode?: string;
  description?: string;
  createdAt: string;
}

interface TierInfo {
  id: string;
  name: string;
  minSpending: number;
  pointMultiplier: number;
  discountPercent: number;
  imageUrl?: string;
}

interface ExclusiveVoucher {
  id: string;
  code: string;
  title: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIP';
  discountValue: number;
  maxDiscount?: number;
  minOrderValue: number;
  endDate: string;
}

interface LoyaltyData {
  points: number;
  totalSpending: number;
  memberCode?: string;
  currentTier: TierInfo | null;
  nextTier: TierInfo | null;
  progressPercent: number;
  amountNeededForNextTier: number;
  allTiers: TierInfo[];
  exclusiveVouchers: ExclusiveVoucher[];
  stats: {
    totalEarned: number;
    totalUsed: number;
    transactionCount: number;
  };
  transactions: PointTransaction[];
}

export default function LoyaltyPage() {
  const router = useRouter();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'EARNED' | 'SPENT'>('ALL');
  const [copiedVoucherCode, setCopiedVoucherCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch user info
        const userRes = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });

        if (!userRes.ok) {
          toast.error('Vui lòng đăng nhập để xem lịch sử tích điểm');
          router.push('/login?redirectURL=/loyalty');
          return;
        }

        const userData = await userRes.json();
        setUser(userData);

        // 2. Fetch loyalty data
        const loyaltyRes = await fetch(`${API_URL}/api/membership/points-history`, {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });

        if (loyaltyRes.ok) {
          const loyaltyData: LoyaltyData = await loyaltyRes.json();
          setData(loyaltyData);
        }
      } catch (error) {
        console.error('Error fetching loyalty data:', error);
        toast.error('Không thể tải thông tin tích điểm');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleCopyVoucher = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedVoucherCode(code);
    toast.success(`Đã sao chép mã ưu đãi: ${code}`);
    setTimeout(() => setCopiedVoucherCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f6f8] text-slate-800 font-sans">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-500">Đang tải điểm thưởng Avora Club...</p>
      </div>
    );
  }

  if (!data) return null;

  const currentTierName = data.currentTier?.name || 'Thành viên mới';
  const isDiamond =
    currentTierName.toLowerCase().includes('kim cương') || currentTierName.toLowerCase().includes('diamond');
  const isGold = currentTierName.toLowerCase().includes('vàng') || currentTierName.toLowerCase().includes('gold');
  const isSilver = currentTierName.toLowerCase().includes('bạc') || currentTierName.toLowerCase().includes('silver');

  const memberCodeDisplay = data.memberCode || user?.memberCode || user?.id?.slice(0, 8).toUpperCase() || 'AVR-MEMBER';

  // Filter transactions
  const filteredTransactions = (data.transactions || []).filter((tx) => {
    if (filterType === 'EARNED') return tx.amount > 0;
    if (filterType === 'SPENT') return tx.amount < 0;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-800 pb-20 font-sans">
      {/* ── BREADCRUMB HEADER ── */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link href="/" className="text-slate-500 hover:text-slate-900 transition-colors">
              Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[#da251d] font-bold flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" />
              Avora Club & Tích Điểm VIP
            </span>
          </div>

          <Link
            href="/menu"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#da251d] hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 active:scale-95 transition-all"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Đặt món tích điểm</span>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-2.5 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6">
        {/* ── THẺ THÀNH VIÊN VIP & TIẾN ĐỘ THĂNG HẠNG ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 items-stretch">
          {/* CỘT TRÁI: THẺ THÀNH VIÊN VIP HOLOGRAM (5/12) */}
          <div className="lg:col-span-5 flex flex-col">
            <div
              className={`relative overflow-hidden rounded-3xl p-5 sm:p-7 flex flex-col justify-between shadow-xl transition-all duration-300 min-h-[260px] sm:min-h-[290px] text-white ${
                isDiamond
                  ? 'bg-gradient-to-br from-slate-900 via-[#1e293b] to-[#0f172a] border border-cyan-500/40 shadow-slate-900/30'
                  : isGold
                  ? 'bg-gradient-to-br from-[#b45309] via-[#d97706] to-[#78350f] border border-amber-300/40 shadow-amber-900/20'
                  : isSilver
                  ? 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800 border border-slate-400/40 shadow-slate-800/20'
                  : 'bg-gradient-to-br from-[#da251d] via-[#b91c1c] to-[#991b1b] border border-red-400/40 shadow-red-900/20'
              }`}
            >
              {/* Holographic light effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/20 pointer-events-none" />
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

              {/* Card Top */}
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black tracking-widest uppercase text-white/80">
                      AVORA RESTAURANT VIP
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5 tracking-tight flex items-center gap-2">
                    {currentTierName}
                    <Crown
                      className={`w-5 h-5 ${
                        isDiamond
                          ? 'text-cyan-300'
                          : isGold
                          ? 'text-yellow-300'
                          : isSilver
                          ? 'text-slate-200'
                          : 'text-amber-300'
                      }`}
                    />
                  </h3>
                </div>

                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white font-black text-xs shadow-inner">
                  VIP
                </div>
              </div>

              {/* Card Middle: Điểm Số */}
              <div className="relative z-10 my-3 sm:my-5">
                <p className="text-[11px] font-bold text-white/85 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  Điểm tích lũy khả dụng
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl sm:text-5xl font-black tracking-tight text-white font-mono">
                    {new Intl.NumberFormat('vi-VN').format(data.points)}
                  </span>
                  <span className="text-sm font-black text-yellow-300">ĐIỂM</span>
                </div>
              </div>

              {/* Card Bottom: Member Name & Barcode (Lấy memberCode từ bảng User) */}
              <div className="relative z-10 pt-3 border-t border-white/20 flex items-end justify-between gap-2">
                <div>
                  <p className="text-[9px] uppercase font-bold text-white/70">Thành viên</p>
                  <p className="text-xs sm:text-sm font-black text-white truncate max-w-[170px]">
                    {user?.fullName || user?.username || 'Hội viên Avora'}
                  </p>
                  <p className="text-[10px] text-white/80 font-mono">{user?.phone || '090 *** ****'}</p>
                </div>

                {/* Mini Barcode Lấy từ user.memberCode */}
                <div className="bg-white px-2 py-1.5 rounded-xl shrink-0 shadow-md">
                  <Barcode
                    value={memberCodeDisplay}
                    width={1.2}
                    height={22}
                    fontSize={8}
                    margin={0}
                    displayValue={false}
                  />
                  <p className="text-[8px] font-mono text-center text-slate-800 font-black mt-0.5 tracking-wider">
                    {memberCodeDisplay}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: LỘ TRÌNH THĂNG HẠNG & THỐNG KÊ (7/12) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-3 sm:space-y-4">
            {/* THẺ TIẾN TRÌNH THĂNG HẠNG */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 flex-1 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Lộ trình tích lũy chi tiêu
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mt-2">
                    {data.nextTier ? (
                      <>
                        Chi tiêu thêm{' '}
                        <span className="text-[#da251d] font-bold font-mono">
                          {new Intl.NumberFormat('vi-VN').format(data.amountNeededForNextTier)}đ
                        </span>{' '}
                        để thăng hạng <span className="text-amber-600 font-black">{data.nextTier.name}</span>
                      </>
                    ) : (
                      '🎉 Chúc mừng! Bạn đang sở hữu cấp bậc Hội Viên VIP Cao Nhất!'
                    )}
                  </h4>
                </div>

                {data.nextTier && (
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-slate-400 font-medium">Hạng kế tiếp</span>
                    <p className="text-xs sm:text-sm font-black text-amber-600 flex items-center gap-1 justify-end">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      {data.nextTier.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 my-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">
                    Đã chi tiêu:{' '}
                    <span className="text-slate-900 font-mono">
                      {new Intl.NumberFormat('vi-VN').format(data.totalSpending)}đ
                    </span>
                  </span>
                  <span className="text-[#da251d] font-mono">{data.progressPercent}%</span>
                </div>

                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-[#da251d] via-orange-500 to-amber-500 rounded-full transition-all duration-1000 shadow-sm"
                    style={{ width: `${Math.max(data.progressPercent, 4)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                  <span>{currentTierName}</span>
                  {data.nextTier && (
                    <span>
                      Mục tiêu: {new Intl.NumberFormat('vi-VN').format(data.nextTier.minSpending)}đ
                    </span>
                  )}
                </div>
              </div>

              {/* Đặc quyền cấp hiện tại */}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block">Tỷ lệ nhân điểm</span>
                  <span className="text-[#da251d] font-black text-sm sm:text-base">
                    x{data.currentTier?.pointMultiplier || 1}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block">Giảm giá món</span>
                  <span className="text-emerald-600 font-black text-sm sm:text-base">
                    {data.currentTier?.discountPercent ? `${data.currentTier.discountPercent}%` : 'Theo voucher'}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-purple-600 font-black text-sm sm:text-base flex items-center justify-center gap-1">
                    <span>VIP Gift</span>
                    <Gift className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* 3 THỐNG KÊ TỔNG QUAN */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 text-center shadow-2xs">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-1">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng điểm đã tích</span>
                <p className="text-sm sm:text-lg font-black text-emerald-600 font-mono mt-0.5">
                  +{new Intl.NumberFormat('vi-VN').format(data.stats.totalEarned)}
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 text-center shadow-2xs">
                <div className="w-7 h-7 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-1">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Điểm đã sử dụng</span>
                <p className="text-sm sm:text-lg font-black text-red-600 font-mono mt-0.5">
                  -{new Intl.NumberFormat('vi-VN').format(data.stats.totalUsed)}
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 text-center shadow-2xs">
                <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-1">
                  <History className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Lần giao dịch</span>
                <p className="text-sm sm:text-lg font-black text-slate-800 font-mono mt-0.5">
                  {data.stats.transactionCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── VOUCHER ĐỘC QUYỀN DÀNH CHO HẠNG THÀNH VIÊN ── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#da251d]" />
                Ưu Đãi & Voucher Độc Quyền Hạng {currentTierName}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Các mã khuyến mãi và đặc quyền ẩm thực dành riêng cho cấp bậc thành viên của bạn
              </p>
            </div>
            <Link
              href="/menu"
              className="text-xs font-bold text-[#da251d] hover:underline flex items-center gap-1"
            >
              <span>Xem thực đơn áp dụng</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!data.exclusiveVouchers || data.exclusiveVouchers.length === 0) ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
              <Ticket className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">Chưa có voucher độc quyền mới cho hạng này.</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Voucher định kỳ sẽ được cập nhật tự động vào đầu mỗi tháng.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {data.exclusiveVouchers.map((voucher) => {
                const isCopied = copiedVoucherCode === voucher.code;
                const formattedEndDate = new Date(voucher.endDate).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });

                return (
                  <div
                    key={voucher.id}
                    className="bg-gradient-to-br from-red-50/40 via-white to-amber-50/30 border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-bl-full pointer-events-none" />

                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-red-100 text-[#da251d] px-2 py-0.5 rounded-md">
                          {voucher.discountType === 'FREE_SHIP'
                            ? 'Miễn phí vận chuyển'
                            : voucher.discountType === 'PERCENTAGE'
                            ? `Giảm ${voucher.discountValue}%`
                            : `Giảm ${new Intl.NumberFormat('vi-VN').format(voucher.discountValue)}đ`}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> HSD: {formattedEndDate}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{voucher.title}</h4>
                      {voucher.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {voucher.description}
                        </p>
                      )}

                      <div className="mt-2.5 text-[11px] text-slate-400">
                        <span>Đơn tối thiểu: </span>
                        <strong className="text-slate-700 font-mono">
                          {new Intl.NumberFormat('vi-VN').format(voucher.minOrderValue)}đ
                        </strong>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        <Tag className="w-3 h-3 text-[#da251d]" />
                        <span className="font-mono font-black text-xs text-slate-800">{voucher.code}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyVoucher(voucher.code)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#da251d] hover:bg-red-700 text-white shadow-xs active:scale-95'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── BẢNG ĐẶC QUYỀN HẠNG HỘI VIÊN AVORA CLUB ── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Bảng Đặc Quyền Các Hạng Hội Viên
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Càng ăn nhiều, tích lũy càng cao, nhận ưu đãi giảm giá và hệ số nhân điểm càng lớn
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data.allTiers?.map((tier) => {
              const isCurrent = data.currentTier?.id === tier.id;

              return (
                <div
                  key={tier.id}
                  className={`p-4 rounded-2xl border transition-all relative flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-amber-50/50 border-amber-400 ring-2 ring-amber-400/20 shadow-sm'
                      : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {isCurrent && (
                    <span className="absolute -top-2.5 right-3 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                      Hạng của bạn
                    </span>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{tier.name}</h4>
                        <span className="text-[11px] text-slate-500">
                          {tier.minSpending === 0
                            ? 'Mặc định khi đăng ký'
                            : `Từ ${new Intl.NumberFormat('vi-VN').format(tier.minSpending)}đ`}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-200/60">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          Tích lũy điểm: <strong className="text-slate-900 font-bold">x{tier.pointMultiplier}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Percent className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          Giảm giá món:{' '}
                          <strong className="text-slate-900 font-bold">
                            {tier.discountPercent > 0 ? `${tier.discountPercent}%` : 'Theo voucher'}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Gift className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>Quà sinh nhật độc quyền VIP</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── LỊCH SỬ GIAO DỊCH ĐIỂM (FEED) ── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                Lịch Sử Tích & Dùng Điểm
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Biến động điểm thưởng trong tài khoản của bạn</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Tất cả ({data.transactions?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('EARNED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'EARNED'
                    ? 'bg-white text-emerald-600 shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                + Tích điểm
              </button>
              <button
                type="button"
                onClick={() => setFilterType('SPENT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'SPENT'
                    ? 'bg-white text-red-600 shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                - Dùng điểm
              </button>
            </div>
          </div>

          {/* List items */}
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">Chưa có giao dịch tích điểm nào</p>
              <p className="text-xs text-slate-500">
                Hãy đặt món ngay để bắt đầu tích lũy điểm thưởng và nâng hạng VIP nhé!
              </p>
              <div className="pt-3">
                <Link
                  href="/menu"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#da251d] text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 hover:bg-red-700 transition-all"
                >
                  <ShoppingBag className="w-4 h-4" /> Khám phá thực đơn
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const isPlus = tx.amount > 0;
                const formattedTxDate = new Date(tx.createdAt).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });

                return (
                  <div
                    key={tx.id}
                    className="py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-2xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isPlus ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {isPlus ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {tx.description || (isPlus ? 'Tích điểm đơn hàng' : 'Sử dụng điểm')}
                          </p>
                          {tx.orderCode && (
                            <Link
                              href={`/orders/${tx.orderCode}`}
                              className="text-[10px] font-mono font-bold text-[#da251d] hover:underline bg-red-50 px-1.5 py-0.5 rounded border border-red-100"
                            >
                              #{tx.orderCode}
                            </Link>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formattedTxDate}
                          </span>
                          <span>•</span>
                          <span>
                            Số dư: <strong className="text-slate-700 font-mono">{tx.balanceAfter}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm sm:text-base font-black font-mono ${
                          isPlus ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {isPlus ? `+${tx.amount}` : tx.amount}
                      </span>
                      <span className="block text-[10px] font-bold text-slate-400">ĐIỂM</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── HƯỚNG DẪN TÍCH & SỬ DỤNG ĐIỂM (FAQ) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm">
              1
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Ăn uống & Tích điểm</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Mỗi đơn hàng hoàn tất sẽ tự động tích điểm vào tài khoản. Càng lên hạng cao thì tỷ lệ nhân điểm càng khủng (lên tới x2).
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm">
              2
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Trừ tiền trực tiếp</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sử dụng điểm tích lũy để trừ tiền trực tiếp vào hóa đơn thanh toán giỏ hàng khi đặt món tại website.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black text-sm">
              3
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Đặc quyền hội viên VIP</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Nhận voucher miễn phí vận chuyển độc quyền mỗi tháng, quà tặng sinh nhật bất ngờ và ưu đãi món ăn VIP.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
