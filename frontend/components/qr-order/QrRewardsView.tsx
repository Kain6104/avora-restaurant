'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  Gift,
  Sparkles,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
  Minus,
  Check,
  Flame,
} from 'lucide-react';
import { QrGuest, QrSessionData } from './qr-types';
import toast from 'react-hot-toast';

interface RewardItem {
  id: string;
  name: string;
  imageUrl?: string;
  price: number;
  unit?: string;
  redemptionPoints: number;
}

interface QrRewardsViewProps {
  token: string;
  sessionData: QrSessionData;
  guest: QrGuest;
  onBack: () => void;
  onOpenRegister: () => void;
  onRedeemSuccess?: () => void;
}

export const QrRewardsView: React.FC<QrRewardsViewProps> = ({
  token,
  sessionData,
  guest,
  onBack,
  onOpenRegister,
  onRedeemSuccess,
}) => {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true);
  const [branchNotice, setBranchNotice] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CAN_REDEEM'>('ALL');

  // Quantity modal / active redeem item
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [redeemQuantity, setRedeemQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRewards = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/qr-order/${token}/rewards`);
      const data = await res.json();
      if (data.success) {
        setIsAllowed(data.allowed !== false);
        if (data.message && data.allowed === false) {
          setBranchNotice(data.message);
        }
        setRewards(data.items || []);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách đổi điểm', err);
      toast.error('Không thể tải danh sách quà tặng');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, [token]);

  const userPoints = guest.user?.points ?? 0;

  // Filtered items
  const filteredRewards = useMemo(() => {
    return rewards.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      if (!matchesSearch) return false;
      if (selectedFilter === 'CAN_REDEEM') {
        return userPoints >= item.redemptionPoints;
      }
      return true;
    });
  }, [rewards, searchQuery, selectedFilter, userPoints]);

  const handleOpenRedeem = (item: RewardItem) => {
    if (!guest.user) {
      toast.error('Vui lòng liên kết tài khoản thành viên để đổi điểm');
      onOpenRegister();
      return;
    }
    if (userPoints < item.redemptionPoints) {
      toast.error(`Cần thêm ${(item.redemptionPoints - userPoints).toLocaleString()} điểm để đổi món này`);
      return;
    }
    setSelectedReward(item);
    setRedeemQuantity(1);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward) return;

    const totalPointsNeeded = selectedReward.redemptionPoints * redeemQuantity;
    if (userPoints < totalPointsNeeded) {
      toast.error('Số điểm tích lũy không đủ cho số lượng này');
      return;
    }

    setIsSubmitting(true);
    try {
      const deviceSessionId =
        (typeof window !== 'undefined' && localStorage.getItem('avora_qr_device_id')) || guest.deviceSessionId;

      const res = await fetch(`/api/qr-order/${token}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedReward.id,
          quantity: redeemQuantity,
          deviceSessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi đổi quà');
      }

      toast.success(data.message || `Đã đổi thành công ${redeemQuantity}x ${selectedReward.name}!`);
      setSelectedReward(null);

      // Deduct locally for immediate UI responsiveness
      if (guest.user) {
        guest.user.points = Math.max(0, userPoints - totalPointsNeeded);
      }

      if (onRedeemSuccess) {
        onRedeemSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi đổi điểm');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans select-none pb-[calc(3rem+env(safe-area-inset-bottom))]">
      {/* Sticky Header */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 z-20 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-slate-900 leading-tight">Đổi điểm thưởng</h2>
            <span className="text-xs text-slate-400 font-semibold">{sessionData.table.name}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchRewards}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
          title="Tải lại quà tặng"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Member Points Card */}
        {guest.user ? (
          <div className="p-4.5 rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xs pointer-events-none" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-100 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Thành viên {guest.user.membershipTier?.name || 'Thân thiết'}
                </span>
                <h3 className="text-lg font-black mt-0.5">{guest.user.fullName}</h3>
                <p className="text-xs text-amber-100 font-mono mt-0.5">{guest.user.phone || ''}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-amber-200 block">Số điểm khả dụng</span>
                <div className="flex items-baseline justify-end gap-1 mt-0.5">
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span className="text-2xl font-black font-mono tracking-tight">{userPoints.toLocaleString()}</span>
                  <span className="text-xs font-bold text-amber-200">pts</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-amber-100">
              <span>Đổi món ăn vào bàn không giới hạn</span>
              <span className="font-bold underline cursor-pointer" onClick={() => setSelectedFilter('CAN_REDEEM')}>
                Lọc món đủ điểm
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">Bạn chưa liên kết tài khoản</h4>
                <p className="text-[11px] text-slate-500">Đăng nhập để xem điểm & đổi các món ăn miễn phí</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenRegister}
              className="px-3.5 py-2 rounded-xl bg-[#da251d] hover:bg-red-700 text-white text-xs font-bold shrink-0 shadow-xs cursor-pointer"
            >
              Liên kết
            </button>
          </div>
        )}

        {/* Branch Notice if Disabled */}
        {!isAllowed && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{branchNotice || 'Chi nhánh hiện chưa kích hoạt chương trình đổi điểm sang món tại bàn.'}</span>
          </div>
        )}

        {/* Search & Filter bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm món quà đổi điểm..."
              className="w-full h-10 pl-9 pr-3 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0 bg-slate-200/70 p-1 rounded-2xl text-xs">
            <button
              type="button"
              onClick={() => setSelectedFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                selectedFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('CAN_REDEEM')}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                selectedFilter === 'CAN_REDEEM'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đủ điểm
            </button>
          </div>
        </div>

        {/* Rewards List */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
            <p className="text-xs font-semibold">Đang tải danh sách quà tặng...</p>
          </div>
        ) : filteredRewards.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 p-6 space-y-2 text-slate-400">
            <Gift className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Không có món quà nào phù hợp</p>
            <p className="text-[11px] text-slate-400">
              {selectedFilter === 'CAN_REDEEM'
                ? 'Bạn chưa đủ điểm cho các món trong danh sách hoặc hãy chọn "Tất cả".'
                : 'Hiện chi nhánh chưa kích hoạt các món đổi điểm.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredRewards.map((item) => {
              const canAfford = userPoints >= item.redemptionPoints;
              const missingPoints = item.redemptionPoints - userPoints;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl border border-slate-200/80 p-3 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-all group"
                >
                  <div className="flex gap-3">
                    {/* Item Image */}
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden relative shrink-0 border border-slate-100">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Gift className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-lg bg-amber-500/90 backdrop-blur-xs text-[10px] font-black text-white flex items-center gap-0.5 shadow-xs">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{item.redemptionPoints} pts</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-slate-900 line-clamp-2 leading-snug">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 line-through">
                        Giá gốc: {item.price.toLocaleString('vi-VN')}đ
                      </p>
                      <div className="mt-1">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                          0đ sau đổi
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Redeem Button */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 font-medium">
                      {canAfford ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Đủ điểm
                        </span>
                      ) : (
                        <span className="text-rose-500 font-bold">
                          Thiếu {missingPoints.toLocaleString()} pts
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenRedeem(item)}
                      disabled={!canAfford || !isAllowed}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                        canAfford && isAllowed
                          ? 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Gift className="w-3.5 h-3.5" />
                      <span>Đổi món</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Confirmation & Quantity Modal */}
      {selectedReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Xác nhận đổi điểm</h3>
                <p className="text-xs text-slate-500 line-clamp-1">{selectedReward.name}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Đơn giá đổi:</span>
                <strong className="text-amber-700 font-mono">{selectedReward.redemptionPoints} điểm / phần</strong>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <span className="text-xs font-bold text-slate-700">Số lượng:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRedeemQuantity((q) => Math.max(1, q - 1))}
                    disabled={redeemQuantity <= 1}
                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-black w-6 text-center">{redeemQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setRedeemQuantity((q) => q + 1)}
                    disabled={userPoints < selectedReward.redemptionPoints * (redeemQuantity + 1)}
                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                <span className="text-slate-500">Tổng điểm trừ:</span>
                <span className="text-base font-black text-[#da251d] font-mono">
                  {(selectedReward.redemptionPoints * redeemQuantity).toLocaleString()} điểm
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Món đổi điểm sẽ tự động được thêm vào đơn bàn với giá 0đ.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedReward(null)}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmRedeem}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs cursor-pointer shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Gift className="w-3.5 h-3.5" />
                    <span>Đổi ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
