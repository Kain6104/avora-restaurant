'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Mail, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingOverlay from '@/components/LoadingOverlay';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.65;
      if (videoRef.current.readyState >= 3) {
        setIsVideoLoaded(true);
      }
    }
  }, []);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Vui lòng nhập email');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.message || 'Đã có lỗi xảy ra');
      } else {
        toast.success(data.message || 'Đã gửi mã OTP đến email của bạn');
        setCountdown(60);
        setStep(2);
      }
    } catch (err) {
      toast.error('Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTPCode = async (codeToVerify: string) => {
    if (!codeToVerify || codeToVerify.length !== 6) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: codeToVerify }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.message || 'Mã OTP không hợp lệ hoặc đã hết hạn');
        setOtpDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        toast.success('Mã xác nhận hợp lệ. Vui lòng nhập mật khẩu mới.');
        setOtp(codeToVerify);
        setStep(3);
      }
    } catch (err) {
      toast.error('Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentOtp = otpDigits.join('');
    if (currentOtp.length !== 6) {
      toast.error('Vui lòng nhập đủ 6 số OTP');
      return;
    }
    verifyOTPCode(currentOtp);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d+$/.test(value)) return;
    
    const newOtp = [...otpDigits];
    newOtp[index] = value;
    setOtpDigits(newOtp);
    
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    if (newOtp.join('').length === 6) {
      verifyOTPCode(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (!otp) {
      toast.error('Vui lòng nhập mã OTP');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.message || 'Mã OTP không hợp lệ hoặc đã hết hạn');
      } else {
        toast.success('Khôi phục mật khẩu thành công! Vui lòng đăng nhập lại.');
        router.push('/login');
      }
    } catch (err) {
      toast.error('Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {(loading || !isVideoLoaded) && <LoadingOverlay />}
      <div className="relative min-h-screen text-white flex">
        {/* Full-screen Background Video */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => setIsVideoLoaded(true)}
          className="fixed inset-0 w-full h-full object-cover object-left md:object-center z-0"
        >
          <source src="/background_login.mp4" type="video/mp4" />
        </video>

        {/* Right side - Form */}
        <div className="ml-auto w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 relative z-10 min-h-screen bg-transparent backdrop-blur-[2px]">
          <div className="w-full max-w-[420px] flex flex-col">
            {/* Logo */}
            <div className="flex justify-center mb-3 lg:mb-3">
              <Link href="/">
                <img
                  src="/avora_logo_ngang.png"
                  alt="Avora Logo"
                  className="h-16 lg:h-22 object-contain drop-shadow-md"
                />
              </Link>
            </div>

            <div className="text-center mb-8 lg:mb-10">
              <h2 className="text-2xl lg:text-3xl font-black text-white lg:text-slate-900 mb-2 drop-shadow-md lg:drop-shadow-sm">
                Khôi phục mật khẩu
              </h2>
              <p className="text-white/90 lg:text-slate-700 text-sm lg:text-base font-semibold drop-shadow-md lg:drop-shadow-sm">
                {step === 1 
                  ? "Nhập email của bạn để nhận mã xác nhận" 
                  : step === 2 
                  ? "Nhập mã xác nhận (OTP) đã được gửi đến email của bạn"
                  : "Nhập mật khẩu mới cho tài khoản của bạn"}
              </p>
            </div>

            {step === 1 ? (
              <form className="space-y-4" onSubmit={handleSendOTP}>
                <div>
                  <label className="block text-xs lg:text-sm font-black text-white lg:text-slate-800 mb-2 drop-shadow-md lg:drop-shadow-sm">Email đăng nhập</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type="email"
                      required
                      className="block w-full pl-11 pr-4 py-3 lg:py-3.5 bg-white/40 border border-slate-200/60 rounded-2xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-bold text-sm lg:text-base shadow-sm hover:bg-white/50"
                      placeholder="Nhập email của bạn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group w-full flex justify-center items-center py-3 lg:py-3.5 px-4 mt-6 text-sm lg:text-base font-black rounded-2xl text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-red-500 transition-all shadow-xl shadow-red-600/30 disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-1"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Nhận Mã Xác Nhận <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            ) : step === 2 ? (
              <form className="space-y-4" onSubmit={handleVerifyOTP}>
                <div>
                  <label className="block text-xs lg:text-sm font-black text-white lg:text-slate-800 mb-3 drop-shadow-md lg:drop-shadow-sm">Mã xác nhận (OTP)</label>
                  <div className="flex justify-between gap-2 lg:gap-3">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                          if (pastedData) {
                            const newOtp = [...otpDigits];
                            for (let i = 0; i < pastedData.length; i++) {
                              if (index + i < 6) newOtp[index + i] = pastedData[i];
                            }
                            setOtpDigits(newOtp);
                            const nextIndex = Math.min(index + pastedData.length, 5);
                            inputRefs.current[nextIndex]?.focus();
                            
                            if (newOtp.join('').length === 6) {
                              verifyOTPCode(newOtp.join(''));
                            }
                          }
                        }}
                        className="w-10 h-12 lg:w-12 lg:h-14 text-center text-xl lg:text-2xl font-black bg-white/60 border border-slate-200/60 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm hover:bg-white/80"
                      />
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 px-1">
                    <p className="text-xs text-white/80 lg:text-slate-500 font-medium">Đã gửi mã đến {email}</p>
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={countdown > 0 || loading}
                      className="text-xs font-bold text-red-500 hover:text-red-400 disabled:text-slate-400 lg:disabled:text-slate-400 transition-colors"
                    >
                      {countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Gửi lại mã'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="group w-full flex justify-center items-center py-3 lg:py-3.5 px-4 text-sm lg:text-base font-black rounded-2xl text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-red-500 transition-all shadow-xl shadow-red-600/30 disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-1"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Xác Nhận Mã <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="w-full py-3 lg:py-3.5 px-4 text-sm lg:text-base font-bold text-white lg:text-slate-700 hover:bg-white/20 lg:hover:bg-slate-100 rounded-2xl transition-colors drop-shadow-md lg:drop-shadow-none"
                  >
                    Quay lại
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleResetPassword}>
                <div>
                  <label className="block text-xs lg:text-sm font-black text-white lg:text-slate-800 mb-2 drop-shadow-md lg:drop-shadow-sm">Mật khẩu mới</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="block w-full pl-11 pr-11 py-3 lg:py-3.5 bg-white/40 border border-slate-200/60 rounded-2xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-bold text-sm lg:text-base backdrop-blur-md shadow-sm hover:bg-white/50"
                      placeholder="Nhập mật khẩu mới"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs lg:text-sm font-black text-white lg:text-slate-800 mb-2 drop-shadow-md lg:drop-shadow-sm">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="block w-full pl-11 pr-11 py-3 lg:py-3.5 bg-white/40 border border-slate-200/60 rounded-2xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-bold text-sm lg:text-base backdrop-blur-md shadow-sm hover:bg-white/50"
                      placeholder="Nhập lại mật khẩu mới"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="group w-full flex justify-center items-center py-3 lg:py-3.5 px-4 text-sm lg:text-base font-black rounded-2xl text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-red-500 transition-all shadow-xl shadow-red-600/30 disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-1"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Đổi Mật Khẩu <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={loading}
                    className="w-full py-3 lg:py-3.5 px-4 text-sm lg:text-base font-bold text-white lg:text-slate-700 hover:bg-white/20 lg:hover:bg-slate-100 rounded-2xl transition-colors drop-shadow-md lg:drop-shadow-none"
                  >
                    Quay lại
                  </button>
                </div>
              </form>
            )}

            <div className="mt-10 text-center text-xs lg:text-sm text-white/90 lg:text-slate-600 font-bold drop-shadow-md lg:drop-shadow-sm">
              Đã nhớ mật khẩu?{' '}
              <Link href="/login" className="font-black text-red-500 lg:text-red-600 hover:text-red-400 lg:hover:text-red-700 underline decoration-2 underline-offset-4">
                Quay về đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
