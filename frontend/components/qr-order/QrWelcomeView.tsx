'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { User, Sparkles, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { QrSessionData, QrGuest } from './qr-types';
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
  const [memberData, setMemberData] = useState<any | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Generate or retrieve persistent deviceSessionId
  const getDeviceSessionId = () => {
    if (typeof window === 'undefined') return 'device-default';
    let id = localStorage.getItem('avora_qr_device_id');
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('avora_qr_device_id', id);
    }
    return id;
  };

  const handleLookupMember = async () => {
    const ident = memberIdentifier.trim();
    if (!ident) {
      setMemberData(null);
      return;
    }

    setIsLookingUp(true);
    try {
      const res = await fetch(`/api/qr-order/${token}/member/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: ident }),
      });
      const data = await res.json();
      if (data.found && data.user) {
        setMemberData(data.user);
        if (!guestName) {
          setGuestName(data.user.fullName);
        }
        toast.success(`Đã tìm thấy thành viên: ${data.user.fullName}`);
      } else {
        setMemberData(null);
        toast.error(data.message || 'Không tìm thấy tài khoản thành viên');
      }
    } catch (err: any) {
      setMemberData(null);
      toast.error('Lỗi khi tra cứu tài khoản thành viên');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) {
      toast.error('Vui lòng nhập tên của bạn để bắt đầu gọi món');
      return;
    }

    setIsJoining(true);
    try {
      const res = await fetch(`/api/qr-order/${token}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: name,
          deviceSessionId: getDeviceSessionId(),
          memberIdentifier: memberIdentifier.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể tham gia phiên gọi món');
      }

      // Backend trả về data.guest trực tiếp (không nested trong data.data)
      const guestData: QrGuest = {
        id: data.guest.id,
        guestName: data.guest.guestName,
        deviceSessionId: data.guest.deviceSessionId,
        memberVerified: data.guest.memberVerified ?? false,
        user: data.guest.user ?? null,
      };
      toast.success(`Chào mừng ${name} đến với Avora!`);
      onJoinSuccess(guestData);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tham gia phiên gọi món');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans select-none">
      {/* Top Banner & Branding */}
      <div className="pt-[calc(1.5rem+env(safe-area-inset-top))] px-5 pb-6 bg-gradient-to-b from-red-50/70 via-white to-slate-50 flex flex-col items-center text-center">
        <div className="w-40 h-12 relative mb-4">
          <Image
            src="/avora_logo_ngang.png"
            alt="Avora Restaurant"
            fill
            sizes="160px"
            className="object-contain"
            priority
          />
        </div>

        {/* Table & Branch Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-100/70 border border-red-200 text-[#da251d] text-xs font-black shadow-xs mb-3">
          <span>{sessionData.table.name}</span>
          <span>•</span>
          <span className="font-semibold text-slate-700">{sessionData.branch.name}</span>
        </div>

        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Chào mừng Quý khách</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Vui lòng cho Avora biết tên của bạn để bắt đầu gọi món cùng bàn ăn.
        </p>
      </div>

      {/* Main Join Form */}
      <main className="flex-1 px-5 -mt-2 max-w-md mx-auto w-full">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-5">
          {/* Tên khách */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
              Tên của bạn <span className="text-[#da251d]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ví dụ: Anh Tuấn, Chị Lan..."
                required
                className="w-full h-12 pl-11 pr-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white focus:ring-2 focus:ring-red-100 outline-none text-sm font-semibold transition-all"
              />
              <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Thành viên (không bắt buộc) */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Tích điểm thành viên</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Không bắt buộc</span>
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
                placeholder="SĐT / Email / Username / Mã thẻ"
                className="w-full h-12 pl-4 pr-24 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white focus:ring-2 focus:ring-red-100 outline-none text-sm font-medium transition-all"
              />
              <button
                type="button"
                onClick={handleLookupMember}
                disabled={isLookingUp || !memberIdentifier.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                {isLookingUp ? 'Tìm...' : 'Kiểm tra'}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              Nếu đã là thành viên Avora, nhập thông tin để nhận quyền lợi ưu đãi và tích điểm.
            </p>

            {/* Member Card if found */}
            {memberData && (
              <div className="mt-3 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-slate-800 flex items-center justify-between animate-in fade-in zoom-in-95 duration-200">
                <div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">Xin chào, {memberData.fullName}</span>
                  </div>
                  <p className="text-[11px] text-amber-900 mt-0.5 font-medium">
                    Hạng: <strong className="font-black text-[#da251d]">{memberData.tierName || 'Thành viên'}</strong> • Điểm: <strong className="font-black text-slate-900">{memberData.points || 0}</strong>
                  </p>
                </div>
                <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0" />
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isJoining || !guestName.trim()}
              className="w-full h-13 rounded-2xl bg-[#da251d] hover:bg-[#b81d16] active:scale-[0.98] disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 transition-all cursor-pointer"
            >
              <span>{isJoining ? 'Đang vào bàn...' : 'TIẾP TỤC GỌI MÓN'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Link to Register Modal */}
          <div className="text-center pt-1 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Chưa là thành viên?{' '}
              <button
                type="button"
                onClick={onOpenRegister}
                className="font-black text-[#da251d] hover:underline cursor-pointer"
              >
                Đăng ký thành viên
              </button>
            </p>
          </div>
        </form>
      </main>

      {/* Footer Safe Area */}
      <footer className="py-4 text-center text-[10px] text-slate-400 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        AVORA Restaurant • Hệ thống gọi món thông minh tại bàn
      </footer>
    </div>
  );
};
