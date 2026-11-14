'use client';

import React, { useState, useEffect } from 'react';
import { Gift, ShieldCheck, Loader2 } from 'lucide-react';
import { AvoraCoin } from '@/components/ui/AvoraCoin';
import { QrBottomSheet } from './QrBottomSheet';
import { QrGuest } from './qr-types';
import toast from 'react-hot-toast';

interface QrRewardsModalProps {
  isOpen: boolean;
  token: string;
  guest: QrGuest;
  onClose: () => void;
  onOpenRegister: () => void;
  onRedeemSuccess?: () => void;
}

interface RewardModalItem {
  id: string;
  name: string;
  redemptionPoints?: number;
  points?: number;
}

export const QrRewardsModal: React.FC<QrRewardsModalProps> = ({
  isOpen,
  token,
  guest,
  onClose,
  onOpenRegister,
  onRedeemSuccess,
}) => {
  const [rewards, setRewards] = useState<RewardModalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchRewards = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/qr-order/${token}/rewards`, { cache: 'no-store' });
        const data = await res.json();
        if (isMounted && data.success) {
          setRewards(data.items || data.data?.rewards || []);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách đổi điểm', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchRewards();
    return () => {
      isMounted = false;
    };
  }, [isOpen, token]);

  const handleRedeem = async (productId: string, pointsRequired: number) => {
    if (!guest.user) {
      toast.error('Vui lòng liên kết tài khoản thành viên để sử dụng điểm');
      return;
    }
    if ((guest.user.points || 0) < pointsRequired) {
      toast.error('Số AVORA Coin hiện tại chưa đủ để đổi món này');
      return;
    }

    setRedeemingId(productId);
    try {
      const deviceSessionId =
        (typeof window !== 'undefined' && localStorage.getItem('avora_qr_device_id')) ||
        guest.deviceSessionId;

      const res = await fetch(`/api/qr-order/${token}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1, deviceSessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi đổi quà');
      }

      toast.success(data.message || 'Đổi món bằng AVORA Coin thành công');
      onRedeemSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi đổi điểm');
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <QrBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Đổi AVORA Coin nhanh"
      subtitle="Quà tặng & quyền lợi thành viên tại bàn"
      headerIcon={<Gift className="w-4 h-4" />}
    >
      <div className="space-y-4">
        {guest.user ? (
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900">{guest.user.fullName}</span>
              </div>
              <p className="text-[11px] text-amber-900 font-medium mt-0.5">
                Hạng:{' '}
                <strong>{guest.user.membershipTier?.name || guest.user.tierName || 'Thành viên'}</strong>
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Số dư</span>
              <AvoraCoin
                amount={guest.user.points || 0}
                size="sm"
                valueClassName="text-sm font-bold text-[#DA251D]"
              />
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
            <p className="text-xs text-slate-600 font-medium">
              Liên kết tài khoản thành viên để sử dụng AVORA Coin đổi món.
            </p>
            <button
              type="button"
              onClick={onOpenRegister}
              className="px-4 py-2 rounded-lg bg-[#DA251D] text-white text-xs font-bold cursor-pointer"
            >
              Đăng nhập / Đăng ký ngay
            </button>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Món quà có thể đổi
          </h4>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span className="text-xs">Đang tải quà tặng...</span>
            </div>
          ) : rewards.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              Chi nhánh hiện chưa có món quà đổi điểm nào.
            </div>
          ) : (
            <div className="space-y-2">
              {rewards.map((reward) => {
                const pointsNeeded = reward.redemptionPoints ?? reward.points ?? 0;
                const canRedeem = Boolean(
                  guest.user && (guest.user.points || 0) >= pointsNeeded
                );
                const isRedeeming = redeemingId === reward.id;

                return (
                  <div
                    key={reward.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-slate-900 truncate">{reward.name}</h5>
                      <AvoraCoin
                        amount={pointsNeeded}
                        size="xs"
                        valueClassName="text-xs font-bold text-amber-700"
                        className="mt-0.5"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRedeem(reward.id, pointsNeeded)}
                      disabled={!canRedeem || isRedeeming}
                      className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
                    >
                      {isRedeeming ? 'Đang đổi...' : 'Đổi ngay'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </QrBottomSheet>
  );
};
