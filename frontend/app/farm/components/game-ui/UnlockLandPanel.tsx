'use client';

import React, { useState } from 'react';
import { Lock, Sparkles, X, ShieldAlert } from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import { farmSound } from '../../game/services/FarmSoundManager';

interface UnlockLandPanelProps {
  plot: any;
  screenPos: { x: number; y: number };
  farmLevel: number;
  farmCoin: number;
  onUnlock: (plotIndex: number) => Promise<void>;
  onClose: () => void;
}

export default function UnlockLandPanel({
  plot,
  screenPos,
  farmLevel,
  farmCoin,
  onUnlock,
  onClose,
}: UnlockLandPanelProps) {
  const [isUnlocking, setIsUnlocking] = useState(false);

  if (!plot || plot.status !== 'LOCKED') return null;

  const unlockLevel = plot.unlockLevel || Math.floor(plot.plotIndex / 3) + 1;
  const unlockCost = plot.unlockCost || unlockLevel * 200;

  const isLevelEligible = farmLevel >= unlockLevel;
  const isCoinEligible = farmCoin >= unlockCost;
  const canUnlock = isLevelEligible && isCoinEligible;

  const handleUnlockClick = async () => {
    if (!canUnlock || isUnlocking) return;
    setIsUnlocking(true);
    farmSound.playUnlock();
    try {
      await onUnlock(plot.plotIndex);
      onClose();
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div
      className="fixed z-40 pointer-events-none transition-transform duration-75 ease-out"
      style={{
        left: `${screenPos.x}px`,
        top: `${screenPos.y - 70}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="pointer-events-auto relative w-64 p-3.5 rounded-2xl bg-[#fffdfa]/96 backdrop-blur-md border-2 border-[#d4af37] shadow-[0_10px_32px_rgba(70,45,15,0.3)] flex flex-col gap-2.5 text-[#3e2723] animate-in fade-in zoom-in-95 duration-200"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gỗ cắm biển */}
        <div className="flex items-center justify-between border-b border-[#e0a93b]/40 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-amber-800 text-amber-100 flex items-center justify-center shadow-xs">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black font-serif tracking-wide text-amber-950">
                KHU VƯỜN MỚI
              </span>
              <span className="text-[10px] text-stone-500 font-semibold">
                Ô đất #{plot.plotIndex + 1}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              farmSound.playTap();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Requirements */}
        <div className="flex flex-col gap-1.5 bg-[#fbf8f2] p-2.5 rounded-xl border border-stone-200/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-600 font-medium">Cấp trang trại:</span>
            <span
              className={`font-black ${
                isLevelEligible ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              Cấp {unlockLevel} {isLevelEligible ? '✓' : `(Hiện tại: ${farmLevel})`}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-600 font-medium">Chi phí mở đất:</span>
            <span
              className={`font-black flex items-center gap-1 ${
                isCoinEligible ? 'text-amber-800' : 'text-red-600'
              }`}
            >
              <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
              {unlockCost.toLocaleString()} Xu {isCoinEligible ? '✓' : ''}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleUnlockClick}
          disabled={!canUnlock || isUnlocking}
          className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-extrabold shadow-md transition-all active:scale-95 cursor-pointer ${
            canUnlock
              ? 'bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-amber-500/30'
              : 'bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed'
          }`}
        >
          {canUnlock ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>{isUnlocking ? 'Đang khai phá...' : 'Khai phá ô đất'}</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-stone-400" />
              <span>Chưa đủ điều kiện</span>
            </>
          )}
        </button>

        {/* Mũi tên chỉ cắm biển xuống đất */}
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0 border-x-6 border-x-transparent border-t-8 border-t-[#d4af37]" />
      </div>
    </div>
  );
}
