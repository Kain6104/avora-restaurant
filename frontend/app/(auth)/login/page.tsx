'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, User, Eye, EyeOff, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Loading from '../../loading';

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
      const res = await fetch(`${API_URL}/api/auth/login`, {
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
        } else {
          toast.error(data.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
        }
      } else {
        toast.success('Đăng nhập thành công!');
        const redirectURL = new URLSearchParams(window.location.search).get('redirectURL') || '/';
        router.push(redirectURL);
        router.refresh();
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error('Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {(loading || !isVideoLoaded) && <Loading />}
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
              Okacrinasai!
            </h2>
            <p className="text-white/90 lg:text-slate-700 text-sm lg:text-base font-semibold drop-shadow-md lg:drop-shadow-sm">
              Mừng quý khách quay trở lại. Đăng nhập để tiếp tục!
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs lg:text-sm font-black text-white lg:text-slate-800 mb-2 drop-shadow-md lg:drop-shadow-sm">Tài khoản</label>
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

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs lg:text-sm font-black text-white lg:text-slate-800 drop-shadow-md lg:drop-shadow-sm">Mật khẩu</label>
                <a href="#" className="text-xs font-bold text-red-500 lg:text-red-600 hover:text-red-400 lg:hover:text-red-700 transition-colors drop-shadow-md lg:drop-shadow-sm">
                  Quên mật khẩu?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
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
                  window.location.href = `${API_URL}/api/auth/google`;
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
                  window.location.href = `${API_URL}/api/auth/google`;
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
    </>
  );
}
