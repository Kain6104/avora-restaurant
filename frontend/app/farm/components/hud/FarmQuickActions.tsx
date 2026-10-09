'use client';

import React, { useState } from 'react';
import { Droplet, Sparkles, Wheat, Loader2 } from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';

interface FarmQuickActionsProps {
  thirstyPlotsCount: number;
  readyPlotsCount: number;
  onQuickWaterAll: () => Promise<void>;
  onQuickHarvestAll: () => Promise<void>;
  isMobileLandscape?: boolean;
  isUltraCompact?: boolean;
  userEnergy: number;
}

export default function FarmQuickActions({
  thirstyPlotsCount,
  readyPlotsCount,
  onQuickWaterAll,
  onQuickHarvestAll,
  isMobileLandscape = false,
  isUltraCompact = false,
  userEnergy,
}: FarmQuickActionsProps) {
  const [isWatering, setIsWatering] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);

  const handleWaterClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isWatering) return;
    farmSound.playTap();
    setIsWatering(true);
    try {
      await onQuickWaterAll();
    } finally {
      setIsWatering(false);
    }
  };

  const handleHarvestClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isHarvesting) return;
    farmSound.playTap();
    setIsHarvesting(true);
    try {
      await onQuickHarvestAll();
    } finally {
      setIsHarvesting(false);
    }
  };

  const hasThirsty = thirstyPlotsCount > 0;
  const hasReady = readyPlotsCount > 0;

  return (
    <div
      className={`fixed right-2 sm:right-4 lg:right-6 z-40 flex flex-col items-center gap-2.5 sm:gap-3 lg:gap-3.5 pointer-events-none select-none transition-all duration-300 ${
        isMobileLandscape
          ? 'bottom-16 right-2'
          : isUltraCompact
          ? 'bottom-20 right-2'
          : 'bottom-24 sm:bottom-28 lg:bottom-24'
      }`}
      style={{
        paddingRight: 'max(0px, env(safe-area-inset-right))',
      }}
    >
      {/* 1. NÚT NỔI TƯỚI NHANH (WATER QUICK FAB) */}
      <div className="relative group pointer-events-auto flex items-center">
        {/* Tooltip hiển thị khi hover trên Desktop */}
        <div className="hidden sm:block absolute right-full mr-2.5 lg:mr-3 px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] lg:text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-sky-400/40">
          Tưới nhanh ({thirstyPlotsCount} cây khát)
        </div>

        {/* Hiệu ứng sóng nước lan tỏa (Water Wave Ripples) khi có cây cần tưới */}
        {hasThirsty && (
          <>
            <span className="absolute inset-0 rounded-full bg-sky-400/35 animate-ping duration-1000 pointer-events-none" />
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400/30 via-sky-400/20 to-blue-500/30 blur-sm animate-pulse pointer-events-none" />
          </>
        )}

        <button
          onClick={handleWaterClick}
          disabled={isWatering}
          className={`relative flex items-center justify-center rounded-2xl sm:rounded-3xl border-2 transition-all duration-200 active:scale-95 cursor-pointer shadow-xl overflow-hidden ${
            isMobileLandscape ? 'w-11 h-11' : isUltraCompact ? 'w-11 h-11' : 'w-13 h-13 sm:w-14 sm:h-14 lg:w-[68px] lg:h-[68px]'
          } ${
            hasThirsty
              ? 'bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 border-sky-200/90 shadow-[0_0_22px_rgba(14,165,233,0.55)]'
              : 'bg-gradient-to-br from-slate-700/85 via-slate-800/90 to-slate-900/90 border-slate-600/70 text-slate-300 opacity-80 hover:opacity-100'
          }`}
          title="Tưới nhanh toàn bộ các cây thiếu nước"
          aria-label="Tưới nhanh"
        >
          {/* Lớp ánh sáng phản chiếu bóng bẩy (Glossy Top Reflection) */}
          <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none" />

          {/* Icon & Loading */}
          {isWatering ? (
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-white animate-spin" />
          ) : (
            <div className="relative flex flex-col items-center justify-center">
              <Droplet
                className={`w-5 h-5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 text-white transition-transform ${
                  hasThirsty ? 'fill-sky-100 drop-shadow-[0_2px_6px_rgba(255,255,255,0.6)] animate-bounce' : 'fill-slate-400'
                }`}
              />
              {!isMobileLandscape && !isUltraCompact && (
                <span className="text-[8px] lg:text-[10px] font-black text-white/95 leading-none mt-0.5 tracking-tighter uppercase drop-shadow-xs">
                  Tưới
                </span>
              )}
            </div>
          )}

          {/* Badge đếm số cây thiếu nước */}
          {hasThirsty && (
            <span className="absolute -top-1 -right-1 lg:-top-1.5 lg:-right-1.5 min-w-[19px] h-[19px] lg:min-w-[24px] lg:h-[24px] px-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 border-1.5 border-white text-white text-[9.5px] lg:text-xs font-black flex items-center justify-center shadow-md animate-pulse">
              {thirstyPlotsCount}
            </span>
          )}
        </button>
      </div>

      {/* 2. NÚT NỔI THU HOẠCH NHANH (HARVEST QUICK FAB) */}
      <div className="relative group pointer-events-auto flex items-center">
        {/* Tooltip hiển thị khi hover trên Desktop */}
        <div className="hidden sm:block absolute right-full mr-2.5 lg:mr-3 px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] lg:text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-amber-400/40">
          Thu hoạch nhanh ({readyPlotsCount} cây chín)
        </div>

        {/* Hiệu ứng hào quang vàng & Sparkles lấp lánh khi có cây chín */}
        {hasReady && (
          <>
            <span className="absolute inset-0 rounded-full bg-amber-400/35 animate-ping duration-1000 pointer-events-none" />
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400/30 via-yellow-300/30 to-amber-500/30 blur-sm animate-pulse pointer-events-none" />
          </>
        )}

        <button
          onClick={handleHarvestClick}
          disabled={isHarvesting}
          className={`relative flex items-center justify-center rounded-2xl sm:rounded-3xl border-2 transition-all duration-200 active:scale-95 cursor-pointer shadow-xl overflow-hidden ${
            isMobileLandscape ? 'w-11 h-11' : isUltraCompact ? 'w-11 h-11' : 'w-13 h-13 sm:w-14 sm:h-14 lg:w-[68px] lg:h-[68px]'
          } ${
            hasReady
              ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 border-yellow-200/95 shadow-[0_0_24px_rgba(245,158,11,0.65)]'
              : 'bg-gradient-to-br from-slate-700/85 via-slate-800/90 to-slate-900/90 border-slate-600/70 text-slate-300 opacity-80 hover:opacity-100'
          }`}
          title="Thu hoạch tất cả các cây trồng đã chín"
          aria-label="Thu hoạch nhanh"
        >
          {/* Lớp ánh sáng phản chiếu bóng bẩy */}
          <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

          {/* Vệt sáng lướt qua (Shimmer Sheen) */}
          {hasReady && (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />
          )}

          {/* Icon & Loading */}
          {isHarvesting ? (
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-white animate-spin" />
          ) : (
            <div className="relative flex flex-col items-center justify-center">
              {/* Lưỡi hái / Bông lúa hoàng kim với sparkles */}
              <div className="relative">
                <Wheat
                  className={`w-5 h-5 sm:w-6 sm:h-6 lg:w-7.5 lg:h-7.5 text-white transition-transform ${
                    hasReady ? 'text-yellow-100 drop-shadow-[0_2px_6px_rgba(255,255,255,0.6)] animate-pulse' : 'text-slate-400'
                  }`}
                />
                {hasReady && (
                  <Sparkles className="absolute -top-1 -right-1 lg:-top-1.5 lg:-right-1.5 w-2.5 h-2.5 lg:w-3.5 lg:h-3.5 text-yellow-100 animate-spin duration-3000" />
                )}
              </div>
              {!isMobileLandscape && !isUltraCompact && (
                <span className="text-[8px] lg:text-[10px] font-black text-white/95 leading-none mt-0.5 tracking-tighter uppercase drop-shadow-xs">
                  Gặt hết
                </span>
              )}
            </div>
          )}

          {/* Badge đếm số cây sẵn sàng gặt */}
          {hasReady && (
            <span className="absolute -top-1 -right-1 lg:-top-1.5 lg:-right-1.5 min-w-[19px] h-[19px] lg:min-w-[24px] lg:h-[24px] px-1 rounded-full bg-gradient-to-r from-rose-600 to-amber-600 border-1.5 border-white text-white text-[9.5px] lg:text-xs font-black flex items-center justify-center shadow-md animate-bounce">
              {readyPlotsCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
