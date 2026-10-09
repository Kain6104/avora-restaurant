'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Moon } from 'lucide-react';
import type { FarmTheme } from '../../utils/farmPreferences';

interface FarmBootLoaderProps {
  progress: {
    percent: number;
    loaded: number;
    total: number;
  };
  isReady: boolean;
  theme?: FarmTheme;
  onFadeComplete?: () => void;
}

export default function FarmBootLoader({
  progress,
  isReady,
  theme = 'DAY',
  onFadeComplete,
}: FarmBootLoaderProps) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  const percent = Math.min(100, Math.max(0, progress.percent));
  const loaded = progress.loaded;
  const total = progress.total > 0 ? progress.total : 58;

  const isNight = theme === 'NIGHT';

  // Dynamic tip text based on actual progress & theme
  const getTipText = () => {
    if (isNight) {
      if (percent < 20) return '🌙 Đang thắp sáng những vì sao trên bầu trời AVORA...';
      if (percent < 45) return '🌱 Đang tưới đẫm sương trăng cho những luống mầm thảo mộc...';
      if (percent < 70) return '💧 Đang kết tinh ánh trăng huyền ảo quanh Cây Thần...';
      if (percent < 95) return '🧧 Đang treo phong bao Lì Xì Dạ Quang lên cành...';
      return '✨ Tiên cảnh đêm đã sẵn sàng! Đang mở cổng bước vào...';
    } else {
      if (percent < 20) return '🌸 Đang đánh thức Cây Thần AVORA ngàn năm...';
      if (percent < 45) return '🌱 Đang chuẩn bị phù sa và những mầm thảo mộc...';
      if (percent < 70) return '💧 Đang kết tinh sương sớm thần tiên tưới đất...';
      if (percent < 95) return '🧧 Đang treo phong bao Lì Xì Đại Cát lên cành...';
      return '✨ Tiên cảnh đã sẵn sàng! Đang mở cổng bước vào...';
    }
  };

  useEffect(() => {
    if (isReady) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        if (onFadeComplete) onFadeComplete();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isReady, onFadeComplete]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center p-3 select-none transition-opacity duration-400 ease-out overflow-hidden ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        minHeight: '100dvh',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(12px, env(safe-area-inset-left))',
        paddingRight: 'max(12px, env(safe-area-inset-right))',
      }}
    >
      {/* 1. Cinematic Farm Backdrop Image (Tự động match chuẩn DAY hoặc NIGHT ngay từ frame đầu tiên) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[#0a1017]">
        <img
          src={isNight ? '/game/farm/backgrounds/avora-farm-night.webp' : '/game/farm/backgrounds/avora-farm-day.webp'}
          alt="AVORA Farm Background"
          className="w-full h-full object-cover object-center scale-105 animate-[pulse_14s_ease-in-out_infinite]"
        />

        {/* Ethereal Vignette Overlay theo Theme */}
        {isNight ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-[#0b1329]/70 via-[#070e1d]/50 to-[#020617]/80 backdrop-blur-[1px]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.25)_0%,rgba(15,23,42,0.6)_75%,rgba(2,6,23,0.85)_100%)]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-amber-50/40 via-white/20 to-amber-100/50 backdrop-blur-[1px]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.4)_0%,rgba(254,243,199,0.5)_75%,rgba(217,119,6,0.25)_100%)]" />
          </>
        )}
      </div>

      {/* 2. Floating Radiant Glow Orbs */}
      {isNight ? (
        <>
          <div className="absolute top-1/4 left-1/4 w-48 sm:w-80 h-48 sm:h-80 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-52 sm:w-96 h-52 sm:h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
        </>
      ) : (
        <>
          <div className="absolute top-1/4 left-1/4 w-48 sm:w-80 h-48 sm:h-80 bg-amber-300/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-52 sm:w-96 h-52 sm:h-96 bg-emerald-300/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
        </>
      )}

      {/* 3. Center Ethereal Fairy Shrine Card (Harmonized with Theme) */}
      <div
        className={`relative z-10 w-full max-w-[390px] rounded-3xl backdrop-blur-2xl p-4 sm:p-5 flex flex-col items-center text-center space-y-2.5 ${
          isNight
            ? 'bg-[#0f172a]/94 border-2 border-[#818cf8]/80 shadow-[0_20px_50px_rgba(10,15,35,0.5)] ring-1 ring-indigo-400/40 text-slate-100'
            : 'bg-[#fffdfa]/95 border-2 border-[#d4af37] shadow-[0_20px_50px_rgba(180,120,40,0.22)] ring-1 ring-amber-300/60 text-[#4a2e10]'
        }`}
      >
        {/* Imperial Corner Ornaments */}
        <span className={`absolute top-2 left-3 text-[10px] select-none opacity-80 ${isNight ? 'text-indigo-400' : 'text-amber-600'}`}>❖</span>
        <span className={`absolute top-2 right-3 text-[10px] select-none opacity-80 ${isNight ? 'text-indigo-400' : 'text-amber-600'}`}>❖</span>
        <span className={`absolute bottom-2 left-3 text-[10px] select-none opacity-80 ${isNight ? 'text-indigo-400' : 'text-amber-600'}`}>❖</span>
        <span className={`absolute bottom-2 right-3 text-[10px] select-none opacity-80 ${isNight ? 'text-indigo-400' : 'text-amber-600'}`}>❖</span>

        {/* Floating Lotus / Moon Icon */}
        <div
          className={`relative w-11 h-11 sm:w-13 sm:h-13 rounded-full border-2 flex items-center justify-center shrink-0 shadow-md ${
            isNight
              ? 'bg-gradient-to-br from-indigo-900 via-slate-800 to-indigo-950 border-[#818cf8] shadow-[0_4px_16px_rgba(99,102,241,0.4)]'
              : 'bg-gradient-to-br from-amber-100 via-rose-50 to-emerald-50 border-[#e0a93b] shadow-[0_4px_16px_rgba(212,175,55,0.35)]'
          }`}
        >
          <span className="text-xl sm:text-2xl animate-bounce">{isNight ? '🌙' : '🌸'}</span>
          <div
            className={`absolute -inset-1 rounded-full border animate-ping opacity-50 ${
              isNight ? 'border-indigo-400/50' : 'border-amber-400/50'
            }`}
          />
        </div>

        {/* Branding & Subtitle */}
        <div className="space-y-0.5">
          <h1
            className={`text-lg sm:text-xl font-black font-serif tracking-wider drop-shadow-xs ${
              isNight ? 'text-amber-300' : 'text-[#4a2e10]'
            }`}
          >
            AVORA FARM
          </h1>
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider shadow-2xs ${
              isNight
                ? 'bg-indigo-950/70 border-indigo-500/60 text-indigo-300'
                : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-400/60 text-emerald-800'
            }`}
          >
            {isNight ? <Moon className="w-3 h-3 text-amber-300" /> : <Sparkles className="w-3 h-3 text-amber-500" />}
            <span>{isNight ? 'Tiên Cảnh Ánh Trăng Đêm' : 'Khu Vườn Thần Tiên'}</span>
          </div>
        </div>

        {/* Dynamic Status Tip */}
        <p
          className={`text-[10.5px] sm:text-xs font-medium min-h-[28px] flex items-center justify-center px-2 leading-tight ${
            isNight ? 'text-slate-300' : 'text-[#6d4c1b]'
          }`}
        >
          {getTipText()}
        </p>

        {/* Progress Bar Container */}
        <div className="w-full space-y-1 pt-0.5">
          <div
            className={`relative w-full h-3 sm:h-3.5 rounded-full border overflow-hidden shadow-inner p-0.5 ${
              isNight ? 'bg-[#090d16] border-indigo-500/70' : 'bg-[#f5ecdc] border-[#d4af37]/80'
            }`}
          >
            {/* Vibrant Gradient Fill */}
            <div
              className={`h-full rounded-full transition-all duration-250 ease-out relative ${
                isNight
                  ? 'bg-gradient-to-r from-indigo-600 via-sky-400 to-amber-300 shadow-[0_0_12px_rgba(99,102,241,0.6)]'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
              }`}
              style={{ width: `${Math.max(4, percent)}%` }}
            >
              {/* Highlight shine */}
              <div className="absolute inset-0 bg-white/40 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Numbers: Count & Percentage */}
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono font-bold px-0.5">
            <span className={isNight ? 'text-slate-400' : 'text-stone-500'}>
              {loaded > 0 ? `Đang nạp (${loaded}/${total} tài nguyên)` : 'Đang khởi động dữ liệu...'}
            </span>
            <span className={`font-black text-xs sm:text-sm ${isNight ? 'text-amber-300' : 'text-amber-800'}`}>
              {percent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
