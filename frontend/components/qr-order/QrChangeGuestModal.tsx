'use client';

import React, { useState } from 'react';
import { User, CheckCircle2, Unlink, AlertCircle } from 'lucide-react';
import { AvoraCoin } from '@/components/ui/AvoraCoin';
import { QrBottomSheet } from './QrBottomSheet';
import { QrGoogleSignInButton } from './QrGoogleSignInButton';
import { QrGuest } from './qr-types';
import toast from 'react-hot-toast';

interface MemberProfileSummary {
  id?: string;
  fullName: string;
  phone?: string;
  email?: string;
  points?: number;
  tierName?: string;
  membershipTier?: {
    name: string;
  };
}

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
  const [guestName, setGuestName] = useState(guest.guestName);
  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [memberData, setMemberData] = useState<MemberProfileSummary | null>(guest.user || null);
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
      const foundMember = data.member || data.user;
      if (data.found && foundMember) {
        setMemberData(foundMember);
        if (!guestName.trim() && foundMember.fullName) {
          setGuestName(foundMember.fullName);
        }
        toast.success(`Đã tìm thấy thành viên: ${foundMember.fullName}`);
      } else {
        toast.error(data.message || 'Không tìm thấy tài khoản thành viên');
      }
    } catch {
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
          memberIdentifier: memberData
            ? memberIdentifier.trim() || memberData.phone || memberData.email || undefined
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể cập nhật thông tin');
      }

      const updatedGuest: QrGuest = {
        id: data.guest.id,
        guestName: data.guest.guestName,
        userId: data.guest.userId ?? data.guest.user?.id ?? null,
        deviceSessionId: data.guest.deviceSessionId,
        memberVerified: data.guest.memberVerified ?? false,
        user: data.guest.user ?? null,
      };
      toast.success('Đã cập nhật thông tin bàn thành công');
      onGuestUpdated(updatedGuest);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật thông tin');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <QrBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Tài khoản & Thông tin khách"
      subtitle="Liên kết thành viên để tích & dùng AVORA Coin"
      headerIcon={<User className="w-4 h-4" />}
      footer={
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !guestName.trim()}
          className="w-full h-11 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
        >
          <span>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wide block mb-1.5">
            Tên hiển thị tại bàn <span className="text-[#DA251D]">*</span>
          </label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white text-xs outline-none font-bold"
          />
        </div>

        <div className="space-y-2.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
            Tài khoản thành viên AVORA
          </label>

          {hasRedeemedPoints && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed font-medium">
                Đơn hàng này đã đổi AVORA Coin lấy món ăn. Tài khoản thành viên đã được cố định cho phiên bàn.
              </p>
            </div>
          )}

          {memberData ? (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {memberData.fullName}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600">
                  <span>
                    Hạng:{' '}
                    <strong>
                      {memberData.membershipTier?.name || memberData.tierName || 'Thành viên'}
                    </strong>
                  </span>
                  <AvoraCoin amount={memberData.points || 0} size="xs" />
                </div>
              </div>

              {!hasRedeemedPoints ? (
                <button
                  type="button"
                  onClick={() => {
                    setMemberData(null);
                    setMemberIdentifier('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Bỏ liên kết"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              ) : (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-lg shrink-0">
                  Đã đổi xu
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Quick Google Login / Register */}
              <QrGoogleSignInButton
                token={token}
                deviceSessionId={guest.deviceSessionId}
                onSuccess={(updatedGuest) => {
                  onGuestUpdated(updatedGuest);
                  onClose();
                }}
                label="Đăng nhập bằng Google"
              />

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink mx-3 text-[10px] font-semibold uppercase text-slate-400">
                  Hoặc nhập SĐT / Email
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={memberIdentifier}
                  onChange={(e) => setMemberIdentifier(e.target.value)}
                  placeholder="SĐT / Email / Mã thành viên"
                  className="w-full h-10 pl-3 pr-20 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={handleLookupMember}
                  disabled={isLookingUp || !memberIdentifier.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  {isLookingUp ? '...' : 'Tìm'}
                </button>
              </div>

              <button
                type="button"
                onClick={onOpenRegister}
                className="text-xs text-[#DA251D] font-bold hover:underline block cursor-pointer"
              >
                + Đăng ký tài khoản thành viên mới
              </button>
            </div>
          )}
        </div>
      </div>
    </QrBottomSheet>
  );
};
