'use client';

import React, { useState, useEffect } from 'react';
import { X, Gift, ShieldCheck, Loader2 } from 'lucide-react';
import { QrGuest } from './qr-types';
import toast from 'react-hot-toast';

interface QrRewardsModalProps {
  isOpen: boolean;
  token: string;
  guest: QrGuest;
  onClose: () => void;
  onOpenRegister: () => void;
}

export const QrRewardsModal: React.FC<QrRewardsModalProps> = ({
  isOpen,
  token,
  guest,
  onClose,
  onOpenRegister,
}) => {
  const [rewards, setRewards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchRewards = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/qr-order/${token}/rewards`);
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

  if (!isOpen) return null;

  const handleRedeem = async (productId: string, pointsRequired: number) => {
    if (!guest.user) {
      toast.error('Vui lòng liên kết tài khoản thành viên để sử dụng điểm');
      return;
    }
    if ((guest.user.points || 0) < pointsRequired) {
      toast.error('Số điểm tích lũy không đủ để đổi món này');
      return;
    }

    setRedeemingId(productId);
    try {
      const deviceSessionId =
        (typeof window !== 'undefined' && localStorage.getItem('avora_qr_device_id')) || guest.deviceSessionId;

      const res = await fetch(`/api/qr-order/${token}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1, deviceSessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi đổi quà');
      }

      toast.success(data.message || 'Đổi món bằng điểm thưởng thành công!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi đổi điểm');
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl my-auto space-y-5 animate-in zoom-in-95 duration-200 max-h-[88vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Đổi điểm thưởng</h3>
              <p className="text-[11px] text-slate-400">Quà tặng & quyền lợi thành viên</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Member Status Card */}
        {guest.user ? (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900">{guest.user.fullName}</span>
              </div>
              <p className="text-xs text-amber-950 font-bold mt-0.5">
                Hạng: <strong>{guest.user.membershipTier?.name || 'Thành viên'}</strong>
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Điểm có sẵn</span>
              <span className="text-base font-black text-[#da251d] font-mono">
                {guest.user.points || 0} pts
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
            <p className="text-xs text-slate-600 font-medium">
              Vui lòng liên kết tài khoản thành viên để sử dụng điểm thưởng.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
              className="px-4 py-2 rounded-xl bg-[#da251d] text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              Đăng ký thành viên ngay
            </button>
          </div>
        )}

        {/* Rewards List */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
            Món quà có thể đổi
          </h4>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span className="text-xs">Đang tải quà tặng...</span>
            </div>
          ) : rewards.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
              Chi nhánh hiện chưa có món quà đổi điểm nào.
            </div>
          ) : (
            <div className="space-y-2">
              {rewards.map((reward) => {
                const pointsNeeded = reward.redemptionPoints ?? reward.points ?? 0;
                const canRedeem = guest.user && (guest.user.points || 0) >= pointsNeeded;
                const isRedeeming = redeemingId === reward.id;

                return (
                  <div
                    key={reward.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-black text-slate-900 truncate">{reward.name}</h5>
                      <span className="text-xs font-black text-amber-600 font-mono">
                        {pointsNeeded} điểm
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRedeem(reward.id, pointsNeeded)}
                      disabled={!canRedeem || isRedeeming}
                      className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer shrink-0"
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
    </div>
  );
};
