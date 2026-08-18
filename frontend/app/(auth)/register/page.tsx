'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Lock, Mail, User, Eye, EyeOff, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
    if (!phoneRegex.test(phone)) {
      setError('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09).');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ fullName, email, phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
      } else {
        toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
        router.push('/login');
      }
    } catch (err) {
      console.error('Register error:', err);
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
          src="https://images.unsplash.com/photo-1553621042-f6e147245754?w=1200" 
          alt="Sushi Making" 
          className="absolute inset-0 w-full h-full object-cover scale-105 hover:scale-100 transition-transform duration-1000"
        />
        <div className="relative z-20 flex flex-col justify-center items-center w-full h-full p-12 text-center pl-0">
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-4 drop-shadow-lg">
            Khơi Dậy<br />
            <span className="text-red-600">Đam Mê</span> Ẩm Thực
          </h1>
          <p className="text-white/70 uppercase tracking-[0.2em] text-xs font-semibold drop-shadow-md">
            Trở thành thành viên của gia đình Avora.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 bg-black relative z-20 overflow-y-auto">
        <div className="w-full max-w-sm my-auto">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Link href="/">
              <img 
                src="/avora_logo_ngang.png" 
                alt="Avora Logo" 
                className="h-14 object-contain"
              />
            </Link>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-white mb-2">
              Tạo Tài Khoản
            </h2>
            <p className="text-slate-400 text-[13px] font-medium">
              Gia nhập Avora để nhận nhiều ưu đãi hấp dẫn!
            </p>
          </div>

          {error && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-lg text-sm mb-5 font-bold text-center border border-red-900/50">
              {error}
            </div>
          )}

          <form className="space-y-3.5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Họ và Tên</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-10 pr-4 py-2.5 bg-[#18181b] border border-[#27272a] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all font-medium text-[13px]"
                  placeholder="Nhập họ và tên"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  className="block w-full pl-10 pr-4 py-2.5 bg-[#18181b] border border-[#27272a] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all font-medium text-[13px]"
                  placeholder="Nhập email của bạn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Số điện thoại</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="tel"
                  required
                  className="block w-full pl-10 pr-4 py-2.5 bg-[#18181b] border border-[#27272a] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all font-medium text-[13px]"
                  placeholder="Nhập số điện thoại (10 số)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Mật khẩu</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="block w-full pl-9 pr-8 py-2.5 bg-[#18181b] border border-[#27272a] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all font-medium text-[13px]"
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Xác nhận</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="block w-full pl-9 pr-3 py-2.5 bg-[#18181b] border border-[#27272a] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all font-medium text-[13px]"
                    placeholder="Nhập lại"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full flex justify-center items-center py-2.5 px-4 mt-5 text-[13px] font-bold rounded-xl text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-red-500 transition-all shadow-md hover:shadow-red-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  ĐĂNG KÝ <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6">
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

            <div className="mt-4 grid grid-cols-3 gap-3">
              <button className="flex justify-center items-center py-2 px-4 bg-[#18181b] border border-[#27272a] rounded-xl hover:bg-[#27272a] transition-colors shadow-sm">
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="h-4 w-4" />
              </button>
              <button className="flex justify-center items-center py-2 px-4 bg-[#18181b] border border-[#27272a] rounded-xl hover:bg-[#27272a] transition-colors shadow-sm">
                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" alt="Facebook" className="h-4 w-4" />
              </button>
              <button className="flex justify-center items-center py-2 px-4 bg-[#18181b] border border-[#27272a] rounded-xl hover:bg-[#27272a] transition-colors shadow-sm text-blue-400 font-bold text-[13px]">
                Zalo
              </button>
            </div>
          </div>

          <div className="mt-8 text-center text-[11px] text-slate-400 font-medium pb-4">
            Đã có tài khoản?{' '}
            <Link href="/login" className="font-bold text-red-600 hover:text-red-500 underline decoration-2 underline-offset-4">
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
