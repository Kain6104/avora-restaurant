'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  User,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  LogIn,
} from 'lucide-react';
import { AvoraCoin } from '@/components/ui/AvoraCoin';
import { QrGoogleSignInButton } from './QrGoogleSignInButton';
import { QrGuest, QrSessionData } from './qr-types';
import toast from 'react-hot-toast';

interface QrWelcomeViewProps {
  token: string;
  sessionData: QrSessionData;
  onJoinSuccess: (guest: QrGuest) => void;
  onOpenRegister: () => void;
}

export const QrWelcomeView: React.FC<QrWelcomeViewProps> = ({
  token,
  sessionData,
  onJoinSuccess,
  onOpenRegister,
}) => {
  const [guestName, setGuestName] = useState('');
  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [memberData, setMemberData] = useState<any>(null);
  const [isJoining, setIsJoining] = useState(false);

  const [deviceId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('avora_qr_device_id');
      if (saved) return saved;
      const newId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `qr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('avora_qr_device_id', newId);
      return newId;
    }
    return `qr_${Date.now()}`;
  });

  const handleLookupMember = async () => {
    const cleanId = memberIdentifier.trim();
    if (!cleanId) return;
    setIsLookingUp(true);
    try {
      const res = await fetch(`/api/qr-order/${token}/member/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId }),
      });
      const data = await res.json();
      if (data.found && data.member) {
        setMemberData(data.member);
        if (!guestName.trim() && data.member.fullName) {
          setGuestName(data.member.fullName);
        }
        toast.success(`Đã tìm thấy thành viên: ${data.member.fullName}`);
      } else {
        setMemberData(null);
        toast.error('Không tìm thấy tài khoản thành viên này');
      }
    } catch {
      toast.error('Lỗi tra cứu thông tin thành viên');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) {
      toast.error('Vui lòng nhập tên của bạn');
      return;
    }

    setIsJoining(true);
    try {
      const res = await fetch(`/api/qr-order/${token}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: name,
          deviceSessionId: deviceId,
          memberIdentifier: memberIdentifier.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể tham gia bàn');
      }

      const guestData: QrGuest = {
        id: data.guest.id,
        guestName: data.guest.guestName,
        userId: data.guest.userId ?? data.guest.user?.id ?? null,
        deviceSessionId: data.guest.deviceSessionId,
        memberVerified: data.guest.memberVerified ?? false,
        user: data.guest.user ?? null,
      };
      toast.success(`Chào mừng ${name} đến với AVORA`);
      onJoinSuccess(guestData);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tham gia phiên gọi món');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col text-slate-800 font-sans select-none bg-transparent"
    >
      {/* Compact Header Banner */}
      <div className="pt-[calc(1.25rem+env(safe-area-inset-top))] px-4 pb-5 bg-white border-b border-slate-200/80 flex flex-col items-center text-center">
        <div className="w-32 h-9 relative mb-3">
          <Image
            src="/avora_logo_ngang.png"
            alt="AVORA Restaurant"
            fill
            sizes="128px"
            className="object-contain"
            priority
          />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 border border-red-200/80 text-xs font-bold mb-2.5">
          <MapPin className="w-3.5 h-3.5 text-[#DA251D] shrink-0" />
          <span className="text-[#DA251D]">{sessionData.table.name}</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 font-semibold">{sessionData.branch.name}</span>
        </div>

        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          Chào mừng Quý khách
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-xs">
          Xác nhận thông tin nhanh để gọi món, theo dõi bếp và tích điểm AVORA Coin tại bàn.
        </p>
      </div>

      {/* Main Card */}
      <main className="flex-1 px-4 py-4 max-w-md mx-auto w-full space-y-3">
        {/* Fast Google Sign-In Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <LogIn className="w-3.5 h-3.5 text-[#DA251D]" />
              <span>Đăng nhập</span>
            </span>
            <span className="text-[10px] text-slate-400">Tự động vào bàn</span>
          </div>
          <QrGoogleSignInButton
            token={token}
            deviceSessionId={deviceId}
            onSuccess={onJoinSuccess}
          />
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl p-4 border border-slate-200 space-y-4"
        >
          {/* Guest Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tên hiển thị tại bàn <span className="text-[#DA251D]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ví dụ: Anh Tuấn, Chị Lan..."
                required
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white focus:ring-2 focus:ring-red-100 outline-none text-sm font-semibold transition-all"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Optional Member Lookup */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Thành viên AVORA</span>
              </label>
              <span className="text-[10px] text-slate-400">Không bắt buộc</span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={memberIdentifier}
                onChange={(e) => {
                  setMemberIdentifier(e.target.value);
                  if (memberData) setMemberData(null);
                }}
                onBlur={() => {
                  if (memberIdentifier.trim().length >= 3 && !memberData) {
                    handleLookupMember();
                  }
                }}
                placeholder="SĐT / Email / Mã thành viên"
                className="w-full h-11 pl-3.5 pr-22 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white focus:ring-2 focus:ring-red-100 outline-none text-xs font-medium transition-all"
              />
              <button
                type="button"
                onClick={handleLookupMember}
                disabled={isLookingUp || !memberIdentifier.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-2.5 rounded-lg bg-slate-200/80 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                {isLookingUp ? 'Tìm...' : 'Kiểm tra'}
              </button>
            </div>

            {memberData && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {memberData.fullName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600">
                    <span>
                      Hạng: <strong className="text-[#DA251D]">{memberData.tierName || 'Thành viên'}</strong>
                    </span>
                    <AvoraCoin amount={memberData.points || 0} size="xs" />
                  </div>
                </div>
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isJoining || !guestName.trim()}
            className="w-full h-11 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>{isJoining ? 'Đang vào bàn...' : 'Bắt đầu gọi món'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Chưa có tài khoản thành viên?{' '}
              <button
                type="button"
                onClick={onOpenRegister}
                className="font-bold text-[#DA251D] hover:underline cursor-pointer"
              >
                Đăng ký & xác thực
              </button>
            </p>
          </div>
        </form>
      </main>

      <footer className="py-3 text-center text-[10px] text-slate-400 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        AVORA F&B • Hệ thống gọi món QR tại bàn
      </footer>
    </div>
  );
};
