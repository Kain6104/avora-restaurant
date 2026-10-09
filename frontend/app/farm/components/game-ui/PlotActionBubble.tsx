'use client';

import React from 'react';
import { Sprout, X } from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';

interface PlotActionBubbleProps {
  plot: any;
  screenPos: { x: number; y: number };
  onOpenSeedTray: () => void;
  onClose: () => void;
}

export default function PlotActionBubble({
  plot,
  screenPos,
  onOpenSeedTray,
  onClose,
}: PlotActionBubbleProps) {
  if (!plot || plot.status !== 'EMPTY') return null;

  // Tự động căn chỉnh lật vị trí nếu sát mép trên màn hình
  const isNearTop = screenPos.y < 120;
  const topOffset = isNearTop ? 45 : -55;

  return (
    <div
      className="fixed z-40 pointer-events-none transition-transform duration-75 ease-out"
      style={{
        left: `${screenPos.x}px`,
        top: `${screenPos.y + topOffset}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="pointer-events-auto relative flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#fffdfa]/96 backdrop-blur-md border-2 border-[#e0a93b] shadow-[0_8px_24px_rgba(70,45,15,0.25)] animate-in fade-in zoom-in-90 duration-200">
        {/* Nút Gieo Hạt */}
        <button
          onClick={() => {
            farmSound.playTap();
            onOpenSeedTray();
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Sprout className="w-4 h-4 text-emerald-200 animate-bounce" />
          <span>Gieo hạt</span>
        </button>

        {/* Nút Đóng nhỏ */}
        <button
          onClick={() => {
            farmSound.playTap();
            onClose();
          }}
          className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          title="Đóng"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Mũi tên chỉ báo hướng về ô đất */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-x-6 border-x-transparent ${
            isNearTop
              ? '-top-2 border-b-8 border-b-[#e0a93b]'
              : '-bottom-2 border-t-8 border-t-[#e0a93b]'
          }`}
        />
      </div>
    </div>
  );
}
