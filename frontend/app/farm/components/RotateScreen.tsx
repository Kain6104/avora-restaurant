'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RotateCw, ArrowLeft, Sparkles, Maximize2 } from 'lucide-react';

interface RotateScreenProps {
  onRequestLandscapeFullscreen?: () => Promise<{ fullscreen: boolean; locked: boolean }>;
}

export default function RotateScreen({ onRequestLandscapeFullscreen }: RotateScreenProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [instructionHint, setInstructionHint] = useState<string | null>(null);

  const handleActionClick = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    setInstructionHint(null);

    try {
      if (onRequestLandscapeFullscreen) {
        const res = await onRequestLandscapeFullscreen();
        if (!res.locked) {
          // If browser doesn't allow programmatic orientation lock (e.g. iOS Safari)
          setInstructionHint('Trình duyệt đã bật Toàn Màn Hình! Vui lòng xoay ngang điện thoại của bạn.');
        }
      } else {
        // Fallback direct attempt
        try {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
          }
        } catch {}
        try {
          const s: any = screen;
          if (s?.orientation?.lock) {
            await s.orientation.lock('landscape');
          }
        } catch {
          setInstructionHint('Vui lòng xoay ngang điện thoại để tiếp tục trò chơi.');
        }
      }
    } catch {
      setInstructionHint('Vui lòng mở khóa xoay và xoay ngang thiết bị.');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 bg-[#0a0f0d] text-white select-none overflow-hidden"
      style={{
        minHeight: '100dvh',
        paddingTop: 'max(24px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      {/* Ambient background glow & particles */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(46,125,50,0.22)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-12 left-8 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-16 right-8 w-52 h-52 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header: Back to AVORA Button */}
      <div className="w-full flex items-center justify-between z-10">
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-xs font-semibold text-slate-200 transition-all cursor-pointer shadow-lg active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-amber-300" />
          <span>Quay lại AVORA</span>
        </Link>
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>AVORA Farm 2.5D</span>
        </div>
      </div>

      {/* Center Main Stage */}
      <div className="relative z-10 max-w-sm w-full text-center space-y-5 flex flex-col items-center my-auto">
        {/* Animated Rotating Phone Device */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping opacity-70" />
          <div className="absolute inset-2 rounded-full border border-amber-400/40 animate-pulse" />

          {/* Rotating Phone Animation */}
          <div className="w-16 h-24 rounded-2xl border-2 border-emerald-400 bg-emerald-950/70 shadow-[0_0_30px_rgba(52,211,153,0.35)] flex flex-col items-center justify-between p-2 animate-[spin_4s_ease-in-out_infinite]">
            <div className="w-4 h-1 rounded-full bg-emerald-400/50" />
            <div className="flex items-center justify-center">
              <RotateCw className="w-6 h-6 text-amber-300 animate-spin" style={{ animationDuration: '3.5s' }} />
            </div>
            <div className="w-2.5 h-2.5 rounded-full border border-emerald-400/60" />
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black font-serif text-[#fef9c3] tracking-wide drop-shadow-sm">
            XOAY NGANG THIẾT BỊ CỦA BẠN
          </h1>
          <p className="text-xs text-slate-300/90 leading-relaxed max-w-xs mx-auto">
            AVORA Farm được tối ưu cho trải nghiệm Landscape.
            Nhấn nút bên dưới để mở chế độ trò chơi toàn màn hình.
          </p>
        </div>

        {/* Primary CTA Button: XOAY NGANG & MỞ TOÀN MÀN HÌNH */}
        <div className="w-full pt-1 space-y-2.5">
          <button
            onClick={handleActionClick}
            disabled={isRequesting}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-white font-extrabold text-sm sm:text-base tracking-wide shadow-[0_8px_25px_rgba(217,119,6,0.45)] border-2 border-amber-300/80 transition-all active:scale-96 cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCw className={`w-4 h-4 ${isRequesting ? 'animate-spin' : ''}`} />
            <Maximize2 className="w-4 h-4" />
            <span>XOAY NGANG & MỞ TOÀN MÀN HÌNH</span>
          </button>

          {/* Hint or Instruction alert */}
          {instructionHint && (
            <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-400/50 text-[11px] text-amber-200 font-semibold animate-in fade-in duration-200">
              {instructionHint}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="relative z-10 text-[11px] text-slate-400 text-center max-w-xs">
        <p className="opacity-80">🌸 Trò chơi sẽ tự động tiếp tục ngay khi bạn xoay ngang màn hình.</p>
      </div>
    </div>
  );
}
