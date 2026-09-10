'use client';

import React, { useState } from 'react';
import { X, User, CheckCircle2, Unlink, AlertCircle } from 'lucide-react';
import { QrGuest } from './qr-types';
import toast from 'react-hot-toast';

interface QrChangeGuestModalProps {
  isOpen: boolean;
  token: string;
  guest: QrGuest;
  hasRedeemedPoints?: boolean;
  onClose: () => void;
  onGuestUpdated: (guest: QrGuest) => void;
  onOpenRegister: () => void;
}

export const QrChangeGuestModal: React.FC<QrChangeGuestModalProps> = ({
  isOpen,
  token,
  guest,
  hasRedeemedPoints = false,
  onClose,
  onGuestUpdated,
  onOpenRegister,
}) => {
  if (!isOpen) return null;

  const [guestName, setGuestName] = useState(guest.guestName);
  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [memberData, setMemberData] = useState<any | null>(guest.user || null);
  const [isSaving, setIsSaving] = useState(false);

  const handleLookupMember = async () => {
    const ident = memberIdentifier.trim();
    if (!ident) return;

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
        toast.success(`Đã tìm thấy: ${data.user.fullName}`);
      } else {
        toast.error(data.message || 'Không tìm thấy tài khoản thành viên');
      }
    } catch (err: any) {
      toast.error('Lỗi khi tra cứu thành viên');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSave = async () => {
    const name = guestName.trim();
    if (!name) {
      toast.error('Vui lòng nhập tên của bạn');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/qr-order/${token}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: name,
          deviceSessionId: guest.deviceSessionId,
          memberIdentifier: memberIdentifier.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể cập nhật thông tin');
      }

      // Backend trả về data.guest trực tiếp
      const updatedGuest: QrGuest = {
        id: data.guest.id,
        guestName: data.guest.guestName,
        deviceSessionId: data.guest.deviceSessionId,
        memberVerified: data.guest.memberVerified ?? false,
        user: data.guest.user ?? null,
      };
      toast.success('Đã cập nhật thông tin thành công!');
      onGuestUpdated(updatedGuest);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật thông tin');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl my-auto space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#da251d]" />
            <h3 className="text-base font-black text-slate-900">Thông tin của bạn</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1.5">
              Tên hiển thị <span className="text-[#da251d]">*</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none font-bold"
            />
          </div>

          {/* Member account section */}
          <div>
            <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1.5">
              Tài khoản thành viên
            </label>

            {hasRedeemedPoints && (
              <div className="mb-2.5 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed font-medium">
                  Đơn hàng này đã đổi điểm thưởng lấy món ăn. Tài khoản thành viên đã được cố định cho phiên bàn này.
                </p>
              </div>
            )}

            {memberData ? (
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">{memberData.fullName}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Hạng: <strong>{memberData.tierName || 'Thành viên'}</strong> • Điểm: <strong>{memberData.points || 0}</strong>
                  </p>
                </div>

                {!hasRedeemedPoints ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMemberData(null);
                      setMemberIdentifier('');
                    }}
                    className="text-xs font-bold text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Bỏ liên kết"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-lg">
                    Đã đổi điểm
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={memberIdentifier}
                    onChange={(e) => setMemberIdentifier(e.target.value)}
                    placeholder="SĐT / Email / Mã thành viên"
                    className="w-full h-11 pl-3.5 pr-20 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleLookupMember}
                    disabled={isLookingUp || !memberIdentifier.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    {isLookingUp ? '...' : 'Liên kết'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRegister();
                  }}
                  className="text-xs text-[#da251d] font-bold hover:underline block cursor-pointer"
                >
                  + Đăng ký tài khoản thành viên mới
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !guestName.trim()}
          className="w-full h-12 rounded-2xl bg-[#da251d] hover:bg-[#b81d16] active:scale-[0.98] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center shadow-md shadow-red-500/25 transition-all cursor-pointer"
        >
          <span>{isSaving ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}</span>
        </button>
      </div>
    </div>
  );
};
