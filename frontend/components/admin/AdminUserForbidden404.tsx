'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, LogOut, ShieldAlert } from 'lucide-react';
import { logoutUser } from '@/lib/auth';

export default function AdminUserForbidden404() {
  const handleLogout = async () => {
    // Với role USER bị chặn tại 404, tuyệt đối KHÔNG lưu đường dẫn cấm vào redirect
    await logoutUser({ redirectUrl: '/login', reload: true, noRedirectParam: true });
  };

  return (
    <div className="fixed inset-0 z-[9999] min-h-[100dvh] w-full bg-slate-50 flex flex-col items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.06)] p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Logo */}
        <div className="flex justify-center">
          <Image
            src="/avora_logo_ngang.png"
            alt="AVORA"
            width={120}
            height={36}
            className="object-contain"
            priority
          />
        </div>

        {/* 404 Visual Indicator */}
        <div className="relative mx-auto w-24 h-24 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center text-[#DA251D] shadow-inner">
          <ShieldAlert size={48} strokeWidth={2.2} />
          <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-[#DA251D] text-white font-mono font-black text-xs shadow-xs">
            404
          </span>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            404 – KHÔNG TÌM THẤY TRANG
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed">
            Trang bạn đang truy cập không tồn tại hoặc không khả dụng.
          </p>
          <p className="text-xs text-slate-400">
            Vui lòng quay lại trang chủ hoặc lựa chọn chức năng phù hợp.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#DA251D] hover:bg-red-700 active:scale-95 text-white font-bold text-sm shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            <Home size={18} />
            <span>Về trang chủ</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-sm transition-all cursor-pointer"
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-xs text-slate-400">
        AVORA Restaurant Management System
      </div>
    </div>
  );
}
