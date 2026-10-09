'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, User, Eye, EyeOff, X, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingOverlay from '@/components/LoadingOverlay';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function LoginPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  // Remembered Account State
  interface RememberedAccount {
    identifier: string;
    name?: string;
    role?: string;
  }
  const [rememberedAccount, setRememberedAccount] = useState<RememberedAccount | null>(null);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('avora_remembered_account');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.identifier) {
          setRememberedAccount(parsed);
          setIdentifier(parsed.identifier);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (rememberedAccount && !isSwitchingAccount) {
      const timer = setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [rememberedAccount, isSwitchingAccount]);

  // OTP Verification States
  const [step, setStep] = useState<1 | 2>(1);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [countdown, setCountdown] = useState(0);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const apiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? ''
        : API_URL;

      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        credentials: 'include',
        body: JSON.stringify({ email: identifier, password }), // Sending as 'email' but backend will handle both
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.message === 'Tài khoản này được liên kết với Google. Vui lòng đăng nhập bằng Google.') {
          setShowGoogleModal(true);
        } else if (data.requiresVerification) {
          setUnverifiedEmail(data.email);
          setStep(2);
          setCountdown(60);
          toast.success(data.message || 'Hệ thống đã gửi mã xác thực. Vui lòng kiểm tra email.');
        } else {
          toast.error(data.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
        }
        return;
      }

      // Success!
      toast.success('Đăng nhập thành công!');
      const authToken = data?.access_token || data?.token;
      if (typeof window !== 'undefined') {
        if (authToken) {
          localStorage.setItem('token', authToken);
          localStorage.setItem('access_token', authToken);
          // Set client-side cookie so middleware and fetches always see it
          document.cookie = `token=${authToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        }
        if (data?.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          window.dispatchEvent(new CustomEvent('user-updated', { detail: data.user }));
        }
        localStorage.setItem(
          'avora_remembered_account',
          JSON.stringify({
            identifier: identifier.trim(),
            name: data?.user?.fullName || identifier.trim(),
            role: data?.user?.role,
          })
        );
      }
      const searchParams = new URLSearchParams(window.location.search);
      const defaultDest = (data?.user?.role === 'ADMIN' || data?.user?.role === 'MANAGER') ? '/admin' : '/';
      const redirectURL = searchParams.get('redirectURL') || (typeof window !== 'undefined' && (window as any).IS_AVORA_DESKTOP ? '/admin/pos' : defaultDest);
      window.location.href = redirectURL;
    } catch (err) {
      console.error('Login error:', err);
      toast.error('Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Không thể gửi lại mã.');
      } else {
        toast.success('Đã gửi lại mã xác nhận.');
        setCountdown(60);
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTPCode = async (codeToVerify: string) => {
    if (!codeToVerify || codeToVerify.length !== 6) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail, otp: codeToVerify }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.message || 'Mã OTP không hợp lệ.');
        setOtpDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        toast.success('Xác thực thành công! Đang chuyển hướng...');
        const redirectURL = new URLSearchParams(window.location.search).get('redirectURL') || '/';
        router.push(redirectURL);
        router.refresh();
      }
    } catch (err) {
      toast.error('Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTPForm = async (e: React.FormEvent) => {
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
              {step === 1 ? 'Okacrinasai!' : 'Xác Thực Tài Khoản'}
            </h2>
            <p className="text-white/90 lg:text-slate-700 text-sm lg:text-base font-semibold drop-shadow-md lg:drop-shadow-sm">
              {step === 1 
                ? 'Mừng quý khách quay trở lại. Đăng nhập để tiếp tục!'
                : `Vui lòng nhập mã OTP 6 số đã gửi đến email ${unverifiedEmail}`}
            </p>
          </div>

          {step === 1 ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Remembered Account Card or Identifier Input */}
            {rememberedAccount && !isSwitchingAccount ? (
              <div className="p-3.5 bg-white/75 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#da251d] to-red-500 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {rememberedAccount.name || 'Tài khoản AVORA'}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate font-mono">
                      {rememberedAccount.identifier}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSwitchingAccount(true);
                    setIdentifier('');
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-red-50 hover:text-[#da251d] text-slate-700 rounded-xl text-xs font-bold transition-all shrink-0 border border-slate-200 shadow-2xs hover:border-red-200 cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Đổi tài khoản khác</span>
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs lg:text-sm font-black text-white lg:text-slate-800 drop-shadow-md lg:drop-shadow-sm">
                    Tài khoản
                  </label>
                  {rememberedAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSwitchingAccount(false);
                        setIdentifier(rememberedAccount.identifier);
                      }}
                      className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                    >
                      Dùng lại {rememberedAccount.name || rememberedAccount.identifier}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    className="block w-full pl-11 pr-4 py-3 lg:py-3.5 bg-white/40 border border-slate-200/60 rounded-2xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-bold text-sm lg:text-base shadow-sm hover:bg-white/50"
                    placeholder="Email hoặc Số điện thoại"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs lg:text-sm font-black text-white lg:text-slate-800 drop-shadow-md lg:drop-shadow-sm">Mật khẩu</label>
                <Link href="/forgot-password" className="text-xs font-bold text-red-500 lg:text-red-600 hover:text-red-400 lg:hover:text-red-700 transition-colors drop-shadow-md lg:drop-shadow-sm">
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="block w-full pl-11 pr-11 py-3 lg:py-3.5 bg-white/40 border border-slate-200/60 rounded-2xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-bold text-sm lg:text-base backdrop-blur-md shadow-sm hover:bg-white/50"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <button
              type="submit"
              disabled={loading}
              className="group w-full flex justify-center items-center py-3 lg:py-3.5 px-4 mt-6 text-sm lg:text-base font-black rounded-2xl text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-red-500 transition-all shadow-xl shadow-red-600/30 disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-1"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Đăng Nhập <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          ) : (
          <form className="space-y-4" onSubmit={handleVerifyOTPForm}>
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
                <p className="text-xs text-white/80 lg:text-slate-500 font-medium">Đã gửi mã đến {unverifiedEmail}</p>
                <button
                  type="button"
                  onClick={handleResendOTP}
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
                Trở lại đăng nhập
              </button>
            </div>
          </form>
          )}

          <div className="mt-10">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/30 lg:border-slate-300/60"></div>
              </div>
              <div className="relative flex justify-center text-[10px] lg:text-xs">
                <span className="px-4 bg-transparent text-white/90 lg:text-slate-600 font-black uppercase tracking-widest backdrop-blur-sm drop-shadow-md lg:drop-shadow-sm">
                  Hoặc tiếp tục với
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button 
                type="button"
                disabled={loading || isGoogleLoading}
                onClick={() => {
                  setIsGoogleLoading(true);
                  const searchParams = new URLSearchParams(window.location.search);
                  const targetRedirect = searchParams.get('redirectURL') || (typeof window !== 'undefined' && window.IS_AVORA_DESKTOP ? '/admin/pos' : '/');
                  window.location.href = `${API_URL}/api/auth/google?redirectURL=${encodeURIComponent(targetRedirect)}`;
                }}
                className="w-full flex justify-center items-center py-3 lg:py-3.5 px-4 bg-white border border-slate-300 rounded-2xl hover:bg-slate-50 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 text-slate-700 font-bold text-sm lg:text-base gap-3 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="h-5 w-5" />
                {isGoogleLoading ? (
                  <span className="flex items-center">
                    Đang chuyển hướng
                    <span className="flex ml-1 gap-0.5 items-end h-4">
                      <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"></span>
                    </span>
                  </span>
                ) : (
                  'Đăng nhập với Google'
                )}
              </button>
            </div>
          </div>

          <div className="mt-10 text-center text-xs lg:text-sm text-white/90 lg:text-slate-600 font-bold drop-shadow-md lg:drop-shadow-sm">
            Khách mới đến Avora?{' '}
            <Link href="/register" className="font-black text-red-500 lg:text-red-600 hover:text-red-400 lg:hover:text-red-700 underline decoration-2 underline-offset-4">
              Tạo tài khoản ngay
            </Link>
          </div>
        </div>
      </div>
      </div>

      {/* Google Login Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowGoogleModal(false)}></div>
          <div className="relative bg-white/90 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowGoogleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 hover:bg-slate-200 rounded-full p-1"
            >
              <X size={20} />
            </button>
            
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-8 h-8" />
            </div>
            
            <h3 className="text-xl font-black text-center text-slate-900 mb-3">Tài Khoản Đã Liên Kết</h3>
            <p className="text-slate-600 text-center text-sm mb-8 leading-relaxed">
              Tài khoản này được liên kết với Google. Vui lòng đăng nhập bằng Google, sau đó vào <b>mục bảo mật tài khoản</b> để thiết lập mật khẩu nếu bạn muốn đăng nhập bằng phương thức này.
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setIsGoogleLoading(true);
                  const searchParams = new URLSearchParams(window.location.search);
                  const targetRedirect = searchParams.get('redirectURL') || (typeof window !== 'undefined' && window.IS_AVORA_DESKTOP ? '/admin/pos' : '/');
                  window.location.href = `${API_URL}/api/auth/google?redirectURL=${encodeURIComponent(targetRedirect)}`;
                }}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGoogleLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-4 h-4 bg-white rounded-full p-0.5" />
                    Đăng nhập bằng Google
                  </>
                )}
              </button>
              <button
                onClick={() => setShowGoogleModal(false)}
                disabled={isGoogleLoading}
                className="w-full py-3 px-4 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-70"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Full Screen Loading */}
      {isGoogleLoading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center transform transition-all max-w-sm w-[90%]">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner relative">
              <div className="absolute inset-0 border-[3px] border-transparent border-t-blue-500 border-r-red-500 border-b-yellow-500 border-l-green-500 rounded-full animate-spin" style={{ animationDuration: '2s' }}></div>
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-10 h-10 relative z-10" />
            </div>
            <h3 className="text-lg lg:text-xl font-black text-slate-800 tracking-wide mb-1 text-center">Đang kết nối với Google</h3>
            <p className="text-slate-500 text-xs lg:text-sm font-medium mb-6 text-center">Hệ thống đang chuyển hướng, vui lòng chờ...</p>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '450ms' }}></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
