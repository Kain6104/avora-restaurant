'use client';

import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  ArrowRight,
  MailCheck,
  RotateCw,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { QrBottomSheet } from './QrBottomSheet';
import { QrGoogleSignInButton } from './QrGoogleSignInButton';
import toast from 'react-hot-toast';
import { QrGuest } from './qr-types';

interface QrRegisterModalProps {
  isOpen: boolean;
  token: string;
  guest: QrGuest;
  onClose: () => void;
  onRegistered: (guest: QrGuest) => void;
}

export const QrRegisterModal: React.FC<QrRegisterModalProps> = ({
  isOpen,
  token,
  guest,
  onClose,
  onRegistered,
}) => {
  const [step, setStep] = useState<'FORM' | 'OTP'>('FORM');
  const [fullName, setFullName] = useState(guest.guestName || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const validatePhone = (num: string) => /^(03|05|07|08|09)\d{8}$/.test(num.trim());

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanPhone || !cleanEmail || !password) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (!validatePhone(cleanPhone)) {
      toast.error(
        'Số điện thoại không hợp lệ. Vui lòng nhập đủ 10 số bắt đầu bằng 03, 05, 07, 08, 09.'
      );
      return;
    }

    if (password.length < 6) {
      toast.error('Mật khẩu phải có tối thiểu 6 ký tự');
      return;
    }

    setIsSubmitting(true);
    try {
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          password,
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regData.message || regData.error?.message || 'Đăng ký không thành công');
      }

      toast.success('Mã xác thực đã được gửi tới email của bạn');
      setStep('OTP');
      setCooldown(60);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi đăng ký thành viên');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      toast.error('Vui lòng nhập đủ 6 chữ số mã xác thực');
      return;
    }

    setIsVerifying(true);
    try {
      const verifyRes = await fetch('/api/auth/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: cleanOtp,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.message || verifyData.error?.message || 'Mã xác thực không hợp lệ');
      }

      const joinRes = await fetch(`/api/qr-order/${token}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: fullName.trim(),
          deviceSessionId: guest.deviceSessionId,
          memberIdentifier: phone.trim(),
        }),
      });
      const joinData = await joinRes.json();

      toast.success('Xác thực tài khoản thành công. Đã kích hoạt quyền lợi thành viên.');
      if (joinData.success && joinData.guest) {
        const guestData: QrGuest = {
          id: joinData.guest.id,
          guestName: joinData.guest.guestName,
          userId: joinData.guest.userId ?? joinData.guest.user?.id ?? null,
          deviceSessionId: joinData.guest.deviceSessionId,
          memberVerified: true,
          user: joinData.guest.user ?? null,
        };
        onRegistered(guestData);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Xác thực OTP thất bại');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Đã gửi lại mã xác nhận mới vào email');
        setCooldown(60);
      } else {
        toast.error(data.message || 'Không thể gửi lại mã xác nhận');
      }
    } catch {
      toast.error('Lỗi khi gửi lại mã');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <QrBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'FORM' ? 'Đăng ký thành viên AVORA' : 'Xác thực Email OTP'}
      subtitle={
        step === 'FORM'
          ? 'Tích AVORA Coin & đổi món miễn phí'
          : `Mã 6 số đã gửi tới ${email}`
      }
      headerIcon={
        step === 'FORM' ? <UserPlus className="w-4 h-4" /> : <MailCheck className="w-4 h-4" />
      }
    >
      {step === 'FORM' ? (
        <div className="space-y-3.5">
          {/* Quick Google Auth at top */}
          <div className="space-y-2">
            <QrGoogleSignInButton
              token={token}
              deviceSessionId={guest.deviceSessionId}
              onSuccess={(guestData) => {
                onRegistered(guestData);
                onClose();
              }}
              label="Đăng nhập bằng Google"
            />
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink mx-3 text-[10px] font-semibold uppercase text-slate-400">
              Hoặc đăng ký bằng SĐT & Email
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Họ và tên <span className="text-[#DA251D]">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white text-xs outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Số điện thoại <span className="text-[#DA251D]">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="0912345678 (10 số)"
                maxLength={10}
                required
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white text-xs outline-none font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Email nhận mã OTP <span className="text-[#DA251D]">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                required
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white text-xs outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Mật khẩu <span className="text-[#DA251D]">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                required
                minLength={6}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white text-xs outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>{isSubmitting ? 'Đang gửi thông tin...' : 'Tiếp tục & Nhận mã OTP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="p-3 bg-red-50/70 border border-red-100 rounded-xl text-center space-y-1">
            <p className="text-xs font-bold text-slate-800">Mã xác nhận đã gửi đến:</p>
            <p className="text-xs font-bold text-[#DA251D] truncate">{email}</p>
            <p className="text-[11px] text-slate-500">
              Kiểm tra hộp thư đến hoặc thư mục Spam để lấy mã gồm 6 chữ số.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1 text-center">
              Nhập mã OTP (6 chữ số)
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoFocus
              required
              className="w-full h-11 text-center text-lg font-mono font-bold tracking-[0.35em] rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-[#DA251D] focus:bg-white outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isVerifying || otp.trim().length < 6}
            className="w-full h-11 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>{isVerifying ? 'Đang xác thực...' : 'Xác nhận & Hoàn tất'}</span>
            <CheckCircle2 className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => setStep('FORM')}
              className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Sửa thông tin</span>
            </button>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={cooldown > 0 || isResending}
              className="text-[#DA251D] hover:underline font-bold disabled:opacity-40 disabled:no-underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              <span>{cooldown > 0 ? `Gửi lại sau (${cooldown}s)` : 'Gửi lại mã OTP'}</span>
            </button>
          </div>
        </form>
      )}
    </QrBottomSheet>
  );
};
