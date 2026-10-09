'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import FarmClientRoot from './FarmClientRoot';

export default function FarmPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          toast.error('Vui lòng đăng nhập để vào Nông Trại AVORA Farm', { duration: 3500 });
          router.push('/login?redirectURL=/farm');
          return;
        }
        setIsAuthenticated(true);
      } catch (e) {
        setIsAuthenticated(true); // Cho phép fallback nếu offline hoặc có token cookie
      }
    }

    checkAuth();
  }, [router]);

  if (isAuthenticated === null) {
    return (
      <div className="fixed inset-0 w-screen h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-[#0e1712] text-white">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-xl">
            🌸
          </div>
        </div>
        <h2 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-200 to-amber-400">
          AVORA ENCHANTED GARDEN
        </h2>
        <p className="text-xs text-slate-400 mt-2 font-medium">
          Đang kết nối tới hòn đảo nổi thần tiên...
        </p>
      </div>
    );
  }

  return <FarmClientRoot />;
}
