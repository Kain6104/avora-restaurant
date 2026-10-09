'use client';

import React, { useState } from 'react';
import { Sparkles, Clock, TrendingUp, X } from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';

interface FertilizerTrayProps {
  isOpen: boolean;
  plotIndex: number | null;
  onApply: (plotIndex: number, type: string) => Promise<void>;
  onClose: () => void;
}

export default function FertilizerTray({
  isOpen,
  plotIndex,
  onApply,
  onClose,
}: FertilizerTrayProps) {
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen || plotIndex === null) return null;

  const fertilizers = [
    {
      id: 'GROWTH',
      name: 'Phân Tăng Trưởng',
      desc: 'Giảm 30 phút sinh trưởng',
      icon: Clock,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      id: 'MUTATION',
      name: 'Phân Đột Biến',
      desc: '+15% Tỷ lệ đột biến quý hiếm',
      icon: Sparkles,
      color: 'from-purple-500 to-pink-600',
    },
    {
      id: 'YIELD',
      name: 'Phân Bội Thu',
      desc: '+2 Sản lượng khi thu hoạch',
      icon: TrendingUp,
      color: 'from-amber-500 to-orange-600',
    },
  ];

  const handleSelect = async (type: string) => {
    if (isApplying) return;
    setIsApplying(true);
    farmSound.playMutation();
    try {
      await onApply(plotIndex, type);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex flex-col items-center pb-3 px-3 sm:px-6">
      <div
        className="pointer-events-auto w-full max-w-lg rounded-3xl bg-[#fffdfa]/96 backdrop-blur-xl border-2 border-[#e0a93b]/80 shadow-[0_12px_36px_rgba(60,40,10,0.3)] p-3.5 flex flex-col gap-2 animate-in slide-in-from-bottom-5 duration-200"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e0a93b]/30 pb-1.5 px-1 text-[#3e2723]">
          <span className="text-xs sm:text-sm font-extrabold font-serif">
            Chọn Loại Phân Bón (Ô đất #{plotIndex + 1})
          </span>
          <button
            onClick={() => {
              farmSound.playTap();
              onClose();
            }}
            className="p-1 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 py-1">
          {fertilizers.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => handleSelect(f.id)}
                disabled={isApplying}
                className="flex flex-col items-center p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border-2 border-stone-200 bg-[#faf7f2] hover:border-purple-400 hover:bg-purple-50/50 transition-all active:scale-95 cursor-pointer text-center group"
              >
                <div
                  className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br ${f.color} text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-[#3e2723] mt-1 leading-tight">
                  {f.name}
                </span>
                <span className="text-[8px] sm:text-[9px] text-stone-500 mt-0.5 font-medium line-clamp-2">
                  {f.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
