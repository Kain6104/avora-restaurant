'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import AdminUserForbidden404 from '@/components/admin/AdminUserForbidden404';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RootError Boundary]:', error);
  }, [error]);

  const isCustomerOnAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && (() => {
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const parsed = JSON.parse(u);
        return parsed.role === 'USER';
      }
    } catch {}
    return false;
  })();

  if (isCustomerOnAdmin) {
    return <AdminUserForbidden404 />;
  }

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 flex flex-col items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.06)] p-6 sm:p-8 text-center space-y-5 animate-in fade-in duration-200">
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

        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-600 shadow-inner">
          <AlertTriangle size={32} strokeWidth={2.2} />
        </div>

        <div className="space-y-2">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            Đã xảy ra lỗi
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Hệ thống không thể tải được trang này. Vui lòng bấm thử lại để tiếp tục.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (reset) reset();
              else window.location.reload();
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw size={15} />
            <span>Thử lại</span>
          </button>

          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#DA251D] hover:bg-red-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            <Home size={15} />
            <span>Về trang chủ</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

