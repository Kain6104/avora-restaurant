'use client';

import React, { useState, useEffect } from 'react';
import { X, Mail, ShieldCheck, ArrowRight, Loader2, KeyRound, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentEmail: string;
  onSuccess: (newEmail: string) => void;
}

export default function ChangeEmailModal({
  isOpen,
  onClose,
  userId,
  currentEmail,
  onSuccess,
}: ChangeEmailModalProps) {
  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStep('REQUEST');
      setNewEmail('');
      setOtp('');
      setLoading(false);
      setResendCooldown(0);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newEmail.trim()) {
      toast.error('Vui lòng nhập địa chỉ email mới');
      return;
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Định dạng email không hợp lệ');
      return;
    }

    if (cleanEmail === currentEmail.toLowerCase()) {
      toast.error('Email mới phải khác với email hiện tại');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/request-email-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: cleanEmail }),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Mã OTP đã được gửi đến email mới');
        setStep('VERIFY');
        setResendCooldown(60);
      } else {
        toast.error(data.message || 'Không thể gửi mã OTP');
      }
    } catch (error) {
      toast.error('Lỗi kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error('Vui lòng nhập mã OTP 6 chữ số');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify-email-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: newEmail.trim().toLowerCase(),
          otp: otp.trim(),
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Đổi email và xác thực thành công!');
        onSuccess(newEmail.trim().toLowerCase());
        onClose();
      } else {
        toast.error(data.message || 'Mã OTP không hợp lệ');
      }
    } catch (error) {
      toast.error('Lỗi kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-50 text-red-600">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Đổi Email Người Dùng</h3>
              <p className="text-xs text-slate-500">Xác thực bắt buộc qua mã OTP gửi đến email mới</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {step === 'REQUEST' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle size={14} className="text-amber-600" />
                  <span>Quy trình bảo mật tài khoản:</span>
                </div>
                <p>
                  Hệ thống sẽ gửi mã xác thực 6 chữ số đến hộp thư của <strong>Email mới</strong>. Email chỉ được cập nhật sau khi mã OTP được xác minh chính xác.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email hiện tại (Đã xác thực)
                </label>
                <input
                  disabled
                  value={currentEmail}
                  className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa chỉ Email mới <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    required
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nhap_email_moi@example.com"
                    className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 font-medium"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={loading || !newEmail.trim()}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Đang gửi mã...</span>
                    </>
                  ) : (
                    <>
                      <span>Tiếp tục & Gửi OTP</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  <span>Mã OTP đã được gửi thành công!</span>
                </div>
                <p>
                  Vui lòng kiểm tra hộp thư đến của: <strong>{newEmail}</strong> và nhập mã xác thực 6 chữ số vào ô bên dưới.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã xác thực OTP (6 chữ số) <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    required
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full h-11 pl-9 pr-3 text-center tracking-[8px] font-mono text-base font-bold bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                  <span>Mã có hiệu lực trong 10 phút</span>
                  {resendCooldown > 0 ? (
                    <span className="text-slate-400 font-medium">
                      Gửi lại mã sau {resendCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRequestOtp()}
                      disabled={loading}
                      className="text-red-600 hover:text-red-700 font-bold flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw size={11} />
                      <span>Gửi lại mã OTP</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep('REQUEST')}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  ← Đổi email khác
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Đang xác thực...</span>
                    </>
                  ) : (
                    <span>Xác nhận Đổi Email</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
