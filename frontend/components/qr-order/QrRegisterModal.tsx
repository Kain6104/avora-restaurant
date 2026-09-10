'use client';

import React, { useState, useEffect } from 'react';
import { X, UserPlus, ArrowRight, MailCheck, RotateCw, ArrowLeft, CheckCircle2 } from 'lucide-react';
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

  // Countdown timer for resend OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  // Validate Vietnamese phone number: exactly 10 digits starting with 03, 05, 07, 08, 09
  const validatePhone = (num: string) => {
    const vnPhoneRegex = /^(03|05|07|08|09)\d{8}$/;
    return vnPhoneRegex.test(num.trim());
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanPhone || !cleanEmail || !password) {
      toast.error('Vui lòng điền đầy đủ các thông tin');
      return;
    }

    if (!validatePhone(cleanPhone)) {
      toast.error('Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số (bắt đầu bằng 03, 05, 07, 08, 09).');
      return;
    }

    if (password.length < 6) {
      toast.error('Mật khẩu phải có tối thiểu 6 ký tự');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Đăng ký tài khoản
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

      toast.success('Mã xác thực đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư!');
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
      // 2. Xác thực tài khoản bằng OTP
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

      // 3. Tự động liên kết tài khoản vừa xác thực vào QR session
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

      toast.success('Xác thực tài khoản thành công! Đã tự động kích hoạt quyền lợi thành viên.');
      if (joinData.success && joinData.guest) {
        const guestData: QrGuest = {
          id: joinData.guest.id,
          guestName: joinData.guest.guestName,
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
        toast.success('Đã gửi lại mã xác nhận mới vào email!');
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
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl my-auto space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center shrink-0">
              {step === 'FORM' ? <UserPlus className="w-5 h-5" /> : <MailCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {step === 'FORM' ? 'Đăng ký thành viên' : 'Xác thực Email'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {step === 'FORM' ? 'Nhận quyền lợi & tích điểm ngay' : `Mã 6 số đã gửi tới ${email}`}
              </p>
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

        {/* STEP 1: Registration Form */}
        {step === 'FORM' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1">
                Họ và tên <span className="text-[#da251d]">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1">
                Số điện thoại <span className="text-[#da251d]">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="0912345678 (10 số)"
                maxLength={10}
                required
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Bắt đầu bằng 03, 05, 07, 08, 09 (đúng 10 chữ số)
              </span>
            </div>

            <div>
              <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1">
                Email nhận mã OTP <span className="text-[#da251d]">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                required
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1">
                Mật khẩu <span className="text-[#da251d]">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                required
                minLength={6}
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-2xl bg-[#da251d] hover:bg-[#b81d16] active:scale-[0.98] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-md shadow-red-500/25 transition-all cursor-pointer"
              >
                <span>{isSubmitting ? 'ĐANG GỬI THÔNG TIN...' : 'TIẾP TỤC & NHẬN MÃ OTP'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Email OTP Verification */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3 bg-red-50/70 border border-red-100 rounded-2xl text-center space-y-1">
              <p className="text-xs font-bold text-slate-800">
                Mã xác nhận đã gửi đến:
              </p>
              <p className="text-xs font-black text-[#da251d] truncate">
                {email}
              </p>
              <p className="text-[11px] text-slate-500">
                Vui lòng kiểm tra hộp thư đến (hoặc thư mục Spam) để lấy mã gồm 6 chữ số.
              </p>
            </div>

            <div>
              <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1 text-center">
                MÃ XÁC THỰC OTP (6 CHỮ SỐ) <span className="text-[#da251d]">*</span>
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
                required
                className="w-full h-12 text-center text-xl font-mono font-black tracking-[0.4em] rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-[#da251d] focus:bg-white outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || otp.trim().length < 6}
              className="w-full h-12 rounded-2xl bg-[#da251d] hover:bg-[#b81d16] active:scale-[0.98] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-md shadow-red-500/25 transition-all cursor-pointer"
            >
              <span>{isVerifying ? 'ĐANG XÁC THỰC...' : 'XÁC NHẬN & HOÀN TẤT'}</span>
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
                className="text-[#da251d] hover:underline font-bold disabled:opacity-40 disabled:no-underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                <span>{cooldown > 0 ? `Gửi lại sau (${cooldown}s)` : 'Gửi lại mã OTP'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

