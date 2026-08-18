'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, User, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
        setError(data.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
      } else {
        toast.success('Đăng nhập thành công!');
        const redirectURL = new URLSearchParams(window.location.search).get('redirectURL') || '/';
        router.push(redirectURL);
        router.refresh();
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Left side - Image */}
      <div
        className="hidden lg:flex w-1/2 relative overflow-hidden"
        style={{
          WebkitMaskImage: 'linear-gradient(to right, black 70%, transparent 100%)',
          maskImage: 'linear-gradient(to right, black 70%, transparent 100%)'
        }}
      >
        <div className="absolute inset-0 bg-black/10 z-10"></div>
        <img
          src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1200"
          alt="Sushi Boat"
          className="absolute inset-0 w-full h-full object-cover scale-105 hover:scale-100 transition-transform duration-1000"
        />
        <div className="relative z-20 flex flex-col justify-center items-center w-full h-full p-12 text-center pl-0">
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-4 drop-shadow-lg">
            Nghệ Thuật<br />
            <span className="text-red-600">Ẩm Thực</span> Nhật Bản
          </h1>
          <p className="text-white/70 uppercase tracking-[0.2em] text-xs font-semibold drop-shadow-md">
            Khám phá tinh hoa hương vị cùng Avora.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 bg-black relative z-20">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Link href="/">
              <img
                src="/avora_logo_ngang2.png"
                alt="Avora Logo"
                className="h-20 object-contain"
              />
            </Link>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-white mb-2">
              Okacrinasai!
            </h2>
            <p className="text-slate-400 text-sm font-medium">
              Mừng quý khách quay trở lại. Đăng nhập để tiếp tục!
            </p>
          </div>

          {error && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-lg text-sm mb-5 font-bold text-center border border-red-900/50">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Tài khoản</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-10 pr-4 py-3 bg-[#18181b] border border-[#27272a] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all font-medium text-sm"
                  placeholder="Email hoặc Số điện thoại"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-300">Mật khẩu</label>
                <a href="#" className="text-[11px] font-bold text-red-600 hover:text-red-500 transition-colors">
                  Quên mật khẩu?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="block w-full pl-10 pr-10 py-3 bg-[#18181b] border border-[#27272a] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all font-medium text-sm"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full flex justify-center items-center py-3 px-4 mt-6 text-sm font-bold rounded-xl text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-red-500 transition-all shadow-md hover:shadow-red-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Đăng Nhập <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="px-3 bg-black text-slate-500 font-bold uppercase tracking-wider">
                  Hoặc tiếp tục với
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <button className="flex justify-center items-center py-2.5 px-4 bg-[#18181b] border border-[#27272a] rounded-xl hover:bg-[#27272a] transition-colors shadow-sm">
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="h-4 w-4" />
              </button>
              <button className="flex justify-center items-center py-2.5 px-4 bg-[#18181b] border border-[#27272a] rounded-xl hover:bg-[#27272a] transition-colors shadow-sm">
                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" alt="Facebook" className="h-4 w-4" />
              </button>
              <button className="flex justify-center items-center py-2.5 px-4 bg-[#18181b] border border-[#27272a] rounded-xl hover:bg-[#27272a] transition-colors shadow-sm text-blue-400 font-bold text-xs">
                Zalo
              </button>
            </div>
          </div>

          <div className="mt-8 text-center text-[11px] text-slate-400 font-medium">
            Khách mới đến Avora?{' '}
            <Link href="/register" className="font-bold text-red-600 hover:text-red-500 underline decoration-2 underline-offset-4">
              Tạo tài khoản ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
