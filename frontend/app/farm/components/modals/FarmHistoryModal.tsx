'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  ShoppingBag,
  Sparkles,
  Gift,
  Users,
  Wheat,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import { farmSound } from '../../game/services/FarmSoundManager';

interface FarmHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoin?: number;
  userPoints?: number;
}

type HistoryTab = 'ALL' | 'BUY' | 'SELL' | 'REDEEM' | 'EXCHANGE' | 'GIFT' | 'SOCIAL';

const TABS: { id: HistoryTab; label: string; icon: any }[] = [
  { id: 'ALL', label: 'Tất cả', icon: History },
  { id: 'BUY', label: 'Mua vật phẩm', icon: ShoppingBag },
  { id: 'SELL', label: 'Bán nông sản', icon: Wheat },
  { id: 'REDEEM', label: 'Đổi thưởng', icon: Gift },
  { id: 'EXCHANGE', label: 'Xu & Điểm AVORA', icon: Sparkles },
  { id: 'GIFT', label: 'Quà nhận được', icon: Gift },
  { id: 'SOCIAL', label: 'Bạn bè', icon: Users },
];

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 10_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toLocaleString('vi-VN');
}

export default function FarmHistoryModal({
  isOpen,
  onClose,
  userCoin = 0,
  userPoints = 0,
}: FarmHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>('ALL');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchHistory(activeTab, 1, searchQuery);
    }
  }, [isOpen, activeTab]);

  const fetchHistory = async (tab: HistoryTab, pageNum: number = 1, search: string = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        tab,
        page: pageNum.toString(),
        limit: '25',
      });
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/farm/history?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setTransactions(json.data.transactions || []);
          setSummary(json.data.summary || null);
          setTotalPages(json.data.totalPages || 1);
          setTotalCount(json.data.total || 0);
          setPage(pageNum);
        }
      }
    } catch (e) {
      console.warn('Could not fetch farm history:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory(activeTab, 1, searchQuery);
  };

  const formatVietnamTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'SEED_PURCHASE':
        return { label: 'Mua Hạt Giống', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'ITEM_PURCHASE':
        return { label: 'Mua Vật Phẩm', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'PRODUCE_SALE':
        return { label: 'Bán Nông Sản', color: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'VOUCHER_REDEMPTION':
        return { label: 'Đổi Voucher', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'COIN_TO_POINT_EXCHANGE':
        return { label: 'Đổi Xu Sang Điểm', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'ADMIN_GIFT':
      case 'MAINTENANCE_GIFT':
      case 'SYSTEM_COMPENSATION':
        return { label: 'Quà Hệ Thống', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
      case 'LUCKY_ENVELOPE_REWARD':
        return { label: 'Lì Xì Cây Thần', color: 'bg-red-100 text-red-800 border-red-300' };
      case 'MISSION_REWARD':
        return { label: 'Nhiệm Vụ', color: 'bg-teal-100 text-teal-800 border-teal-300' };
      case 'FRIEND_STEAL_GAIN':
        return { label: 'Thu Hoạch May Mắn', color: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'FRIEND_STEAL_LOSS':
        return { label: 'Bạn Bè Hái Giúp', color: 'bg-stone-100 text-stone-700 border-stone-300' };
      case 'FRIEND_WATER':
        return { label: 'Tưới Cây Giúp Bạn', color: 'bg-sky-100 text-sky-800 border-sky-300' };
      default:
        return { label: 'Giao Dịch Farm', color: 'bg-stone-100 text-stone-700 border-stone-300' };
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9996] flex flex-col w-screen h-screen bg-[#fffdfa] text-stone-900 font-sans overflow-hidden animate-in fade-in duration-200 select-none"
    >
      {/* ========================================================= */}
      {/* 1. HEADER                                                 */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-r from-[#2d1b08] via-[#422006] to-[#2d1b08] text-[#fdfbf7] px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between border-b border-[#d4af37]/70 shrink-0 shadow-md gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            ← Trở về
          </button>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-amber-400 to-[#d4af37] flex items-center justify-center text-stone-900 shadow-md shrink-0">
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="font-serif font-black text-xs sm:text-sm text-[#fff8e1] tracking-wide truncate">
                LỊCH SỬ AVORA FARM
              </h2>
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[9px] font-bold border border-amber-300/40 shrink-0">
                {totalCount} giao dịch
              </span>
            </div>
            <p className="hidden sm:block text-[10px] text-[#d7ccc8] font-medium truncate">
              Sổ cái truy vết biến động nông sản, tài sản và tương tác bạn bè
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Balances */}
          <div className="hidden sm:flex items-center gap-2 bg-black/40 px-2.5 py-0.5 rounded-full border border-amber-500/30 text-[10px] sm:text-[11px] font-mono">
            <div className="flex items-center gap-1 text-amber-300">
              <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
              <span className="font-bold">{formatCompactNumber(userCoin)} Xu</span>
            </div>
            <div className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1 text-emerald-300">
              <Sparkles className="w-3 h-3 fill-emerald-400" />
              <span className="font-bold">{formatCompactNumber(userPoints)} Điểm</span>
            </div>
          </div>

          <button
            onClick={() => {
              farmSound.playClick();
              onClose();
            }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

        {/* ========================================================= */}
        {/* 2. TABS NAVIGATION & SEARCH BAR                           */}
        {/* ========================================================= */}
        <div className="bg-[#faf5eb] border-b border-[#e0c598] p-2 sm:p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 shrink-0">
          {/* Tabs Scroll */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    farmSound.playClick();
                    setActiveTab(tab.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-serif text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm'
                      : 'bg-white text-[#5d4037] hover:bg-amber-100/70 border border-[#e0c598]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 shrink-0">
            <div className="relative flex-1 sm:w-56">
              <input
                type="text"
                placeholder="Tìm mã / tên vật phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#d7ccc8] text-xs font-medium text-[#3e2723] focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              Lọc
            </button>
          </form>
        </div>

        {/* ========================================================= */}
        {/* 3. TRANSACTION LIST                                       */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-[#faf5eb] space-y-2.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <RotateCcw className="w-8 h-8 text-amber-700 animate-spin" />
              <p className="font-serif font-bold text-sm text-[#5d4037]">
                Đang truy xuất dữ liệu sổ cái từ máy chủ...
              </p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-stone-200/70 flex items-center justify-center text-3xl">
                📜
              </div>
              <h3 className="font-serif font-black text-base text-[#5d4037]">
                Chưa có dữ liệu giao dịch trong mục này
              </h3>
              <p className="text-xs text-stone-500 max-w-sm">
                Toàn bộ các hoạt động mua bán hạt giống, thu hoạch, đổi quà và quà tặng sẽ được ghi nhận chi tiết tại đây.
              </p>
            </div>
          ) : (
            transactions.map((tx) => {
              const badge = getTypeBadge(tx.type);
              const hasCoinChange = tx.farmCoinDelta !== 0 && tx.farmCoinDelta !== null;
              const hasPointChange = tx.avoraPointDelta !== 0 && tx.avoraPointDelta !== null;
              const isPositiveCoin = tx.farmCoinDelta > 0;
              const isPositivePoint = tx.avoraPointDelta > 0;

              return (
                <div
                  key={tx.id}
                  className="p-3 sm:p-4 rounded-2xl bg-white border border-[#e0c598] hover:border-[#d4af37] shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                >
                  {/* Left info: Icon, Name, Category badge, Ref */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-[#faf5eb] border border-[#e5d4be] flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                      {tx.itemIconUrl && tx.itemIconUrl.length <= 4 ? (
                        <span>{tx.itemIconUrl}</span>
                      ) : tx.itemIconUrl ? (
                        <img src={tx.itemIconUrl} alt={tx.itemName} className="w-8 h-8 object-contain" />
                      ) : (
                        <span>🌾</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider ${badge.color}`}>
                          {badge.label}
                        </span>
                        {tx.source && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 font-mono">
                            {tx.source}
                          </span>
                        )}
                        {tx.referenceId && (
                          <span className="text-[10px] font-mono text-stone-400 truncate max-w-[140px]" title={tx.referenceId}>
                            #{tx.referenceId}
                          </span>
                        )}
                      </div>

                      <h4 className="font-serif font-black text-sm text-[#3e2723] truncate">
                        {tx.quantity > 1 ? `${tx.quantity}x ` : ''}
                        {tx.itemName}
                      </h4>

                      <div className="flex items-center gap-2 text-[11px] text-stone-500 font-medium mt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-stone-400" />
                          {formatVietnamTime(tx.createdAt)}
                        </span>
                        {tx.unitPrice > 0 && (
                          <>
                            <span>•</span>
                            <span>Đơn giá: {tx.unitPrice.toLocaleString('vi-VN')} Xu</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right info: Currency delta and new balance */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-dashed border-stone-200">
                    {/* Currency deltas */}
                    <div className="flex items-center gap-2 font-mono font-black text-sm">
                      {hasCoinChange && (
                        <span
                          className={`flex items-center gap-0.5 ${
                            isPositiveCoin ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isPositiveCoin ? '+' : ''}
                          {tx.farmCoinDelta.toLocaleString('vi-VN')} Xu
                        </span>
                      )}

                      {hasPointChange && (
                        <span
                          className={`flex items-center gap-0.5 ${
                            isPositivePoint ? 'text-purple-700' : 'text-stone-700'
                          }`}
                        >
                          {isPositivePoint ? '+' : ''}
                          {tx.avoraPointDelta.toLocaleString('vi-VN')} Điểm
                        </span>
                      )}
                    </div>

                    {/* Balance after */}
                    <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                      {tx.balanceCoinAfter !== null && (
                        <span>Số dư: {tx.balanceCoinAfter.toLocaleString('vi-VN')} Xu</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ========================================================= */}
        {/* 4. FOOTER PAGINATION                                      */}
        {/* ========================================================= */}
        {totalPages > 1 && (
          <div className="bg-[#faf5eb] border-t border-[#e0c598] p-2.5 sm:p-3 flex items-center justify-between shrink-0 text-xs font-bold text-[#5d4037]">
            <span>
              Trang {page} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => fetchHistory(activeTab, page - 1, searchQuery)}
                className="px-3 py-1 rounded-xl bg-white border border-[#d7ccc8] hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
              >
                Trước
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchHistory(activeTab, page + 1, searchQuery)}
                className="px-3 py-1 rounded-xl bg-white border border-[#d7ccc8] hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
