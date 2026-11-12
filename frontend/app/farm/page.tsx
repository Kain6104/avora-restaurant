'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AvoraUnityFarmEmbed from './components/unity/AvoraUnityFarmEmbed';
import FarmClientRoot from './FarmClientRoot';

export default function FarmPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [useUnityMode, setUseUnityMode] = useState<boolean>(true);

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
        setIsAuthenticated(true); // Cho phép fallback nếu offline
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
          Đang kết nối tới thế giới nông trại trên mây...
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[100dvh] bg-[#0c120f]">
      {/* Nút chuyển đổi nhanh chế độ Unity 6 / Web Canvas cổ điển */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-amber-500/30 text-xs">
        <span className="text-slate-300 font-medium">Chế độ:</span>
        <button
          onClick={() => setUseUnityMode(true)}
          className={`px-2.5 py-1 rounded-full font-bold transition-all ${
            useUnityMode
              ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Unity 6 (URP 2.5D)
        </button>
        <button
          onClick={() => setUseUnityMode(false)}
          className={`px-2.5 py-1 rounded-full font-bold transition-all ${
            !useUnityMode
              ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Bản Web 2D
        </button>
      </div>

      {useUnityMode ? (
        <AvoraUnityFarmEmbed />
      ) : (
        <FarmClientRoot />
      )}
    </div>
  );
}
