'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  Gift,
  ShieldCheck,
  Search,
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
  Minus,
  Check,
} from 'lucide-react';
import { AvoraCoin } from '@/components/ui/AvoraCoin';
import { QrBottomSheet } from './QrBottomSheet';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CAN_REDEEM'>('ALL');

  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [redeemQuantity, setRedeemQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasLoadedOnceRef = React.useRef(false);

  const fetchRewards = async () => {
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    try {
      const res = await fetch(`/api/qr-order/${token}/rewards`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        hasLoadedOnceRef.current = true;
        setIsAllowed(data.allowed !== false);
        if (data.message && data.allowed === false) {
          setBranchNotice(data.message);
        }
        setRewards(data.items || []);
      }
    } catch {
      if (!hasLoadedOnceRef.current) {
        toast.error('Không thể tải danh sách quà tặng');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadRewards = async () => {
      try {
        const res = await fetch(`/api/qr-order/${token}/rewards`, { cache: 'no-store' });
        const data = await res.json();
        if (active && data.success) {
          hasLoadedOnceRef.current = true;
          setIsAllowed(data.allowed !== false);
          if (data.message && data.allowed === false) {
            setBranchNotice(data.message);
          }
          setRewards(data.items || []);
        }
      } catch {
        if (active && !hasLoadedOnceRef.current) toast.error('Không thể tải danh sách quà tặng');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadRewards();
    return () => {
      active = false;
    };
  }, [token]);

  const userPoints = guest.user?.points ?? 0;

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
      toast.error(`Cần thêm ${(item.redemptionPoints - userPoints).toLocaleString()} AVORA Coin để đổi món này`);
      return;
    }
    setSelectedReward(item);
    setRedeemQuantity(1);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward) return;

    const totalPointsNeeded = selectedReward.redemptionPoints * redeemQuantity;
    if (userPoints < totalPointsNeeded) {
      toast.error('Số AVORA Coin khả dụng không đủ cho số lượng này');
      return;
    }

    setIsSubmitting(true);
    try {
      const deviceSessionId =
        (typeof window !== 'undefined' && localStorage.getItem('avora_qr_device_id')) ||
        guest.deviceSessionId;

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

      toast.success(data.message || `Đã đổi thành công ${redeemQuantity}x ${selectedReward.name}`);
      setSelectedReward(null);

      if (onRedeemSuccess) {
        onRedeemSuccess();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi đổi điểm');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col text-slate-800 font-sans select-none bg-transparent pb-[calc(2rem+env(safe-area-inset-bottom))]"
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-red-100/60 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại"
            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 leading-tight truncate">
              Đổi điểm thưởng
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              {sessionData.table.name} • {sessionData.branch.name}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchRewards}
          aria-label="Tải lại quà tặng"
          className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-3.5">
        {/* Member Balance Card */}
        {guest.user ? (
          <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {guest.user.membershipTier?.name || guest.user.tierName || 'Thành viên AVORA'}
                  </span>
                </span>
                <h2 className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                  {guest.user.fullName}
                </h2>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Số dư khả dụng
                </span>
                <AvoraCoin
                  amount={userPoints}
                  size="md"
                  valueClassName="text-lg font-bold text-[#DA251D]"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Món đổi sẽ thêm trực tiếp vào bàn với giá 0đ</span>
              <button
                type="button"
                onClick={() => setSelectedFilter('CAN_REDEEM')}
                className="font-bold text-[#DA251D] hover:underline cursor-pointer shrink-0"
              >
                Lọc đủ điểm
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900">Chưa liên kết thành viên</h3>
                <p className="text-[11px] text-slate-500 truncate">
                  Đăng nhập để xem AVORA Coin & đổi món 0đ
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenRegister}
              className="px-3 py-1.5 rounded-lg bg-[#DA251D] hover:bg-[#b81d16] text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              Liên kết
            </button>
          </div>
        )}

        {!isAllowed && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>
              {branchNotice || 'Chi nhánh hiện chưa kích hoạt chương trình đổi điểm sang món tại bàn.'}
            </span>
          </div>
        )}

        {/* Search & Filter Strip */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm món đổi thưởng..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#DA251D]"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0 bg-slate-200/70 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setSelectedFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                selectedFilter === 'ALL' ? 'bg-white text-slate-900' : 'text-slate-600'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('CAN_REDEEM')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                selectedFilter === 'CAN_REDEEM' ? 'bg-white text-[#DA251D]' : 'text-slate-600'
              }`}
            >
              Đủ Coin
            </button>
          </div>
        </div>

        {/* Compact Rewards List */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Loader2 className="w-7 h-7 animate-spin text-[#DA251D] mx-auto" />
            <p className="text-xs font-semibold">Đang tải danh sách quà tặng...</p>
          </div>
        ) : filteredRewards.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-xl border border-slate-200 p-6 space-y-2 text-slate-400">
            <Gift className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Không có món quà nào phù hợp</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRewards.map((item) => {
              const canAfford = userPoints >= item.redemptionPoints;
              const missingPoints = item.redemptionPoints - userPoints;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 p-2.5 flex items-center gap-3"
                >
                  <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden relative shrink-0 border border-slate-200">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="64px"
                        className="object-contain p-0.5"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Gift className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <AvoraCoin
                        amount={item.redemptionPoints}
                        size="xs"
                        valueClassName="text-xs font-bold text-amber-700"
                      />
                      <span className="text-[10px] text-slate-400 line-through font-mono">
                        {item.price.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <p className="text-[10px] mt-1">
                      {canAfford ? (
                        <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Đủ Coin để đổi
                        </span>
                      ) : (
                        <span className="text-rose-500 font-semibold">
                          Còn thiếu {missingPoints.toLocaleString('vi-VN')}
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenRedeem(item)}
                    disabled={!canAfford || !isAllowed}
                    className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                      canAfford && isAllowed
                        ? 'bg-[#DA251D] hover:bg-[#b81d16] text-white cursor-pointer'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Đổi món
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Sheet Confirmation for Loyalty Redemption */}
      <QrBottomSheet
        isOpen={Boolean(selectedReward)}
        onClose={() => setSelectedReward(null)}
        title="Xác nhận đổi thưởng"
        subtitle={selectedReward?.name}
        headerIcon={<Gift className="w-4 h-4" />}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedReward(null)}
              disabled={isSubmitting}
              className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmRedeem}
              disabled={isSubmitting}
              className="h-10 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Gift className="w-3.5 h-3.5" />
                  <span>Xác nhận đổi</span>
                </>
              )}
            </button>
          </div>
        }
      >
        {selectedReward && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Đơn giá đổi:</span>
                <AvoraCoin
                  amount={selectedReward.redemptionPoints}
                  size="xs"
                  valueClassName="font-bold text-amber-700"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                <span className="font-bold text-slate-700">Số lượng:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRedeemQuantity((q) => Math.max(1, q - 1))}
                    disabled={redeemQuantity <= 1}
                    aria-label="Giảm số lượng"
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-bold font-mono w-6 text-center">
                    {redeemQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRedeemQuantity((q) => q + 1)}
                    disabled={
                      userPoints < selectedReward.redemptionPoints * (redeemQuantity + 1)
                    }
                    aria-label="Tăng số lượng"
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                <span className="text-slate-500">Tổng trừ:</span>
                <AvoraCoin
                  amount={selectedReward.redemptionPoints * redeemQuantity}
                  prefix="-"
                  size="sm"
                  valueClassName="font-bold text-[#DA251D]"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Món đổi thưởng sẽ tự động được thêm vào đơn bàn với giá 0đ.
            </p>
          </div>
        )}
      </QrBottomSheet>
    </div>
  );
};
