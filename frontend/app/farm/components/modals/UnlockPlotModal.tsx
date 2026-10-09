'use client';

import { X, Lock, Sparkles } from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';

interface UnlockPlotModalProps {
  plotIndex: number;
  userCoin: number;
  unlockedCount: number;
  onClose: () => void;
  onUnlock: (plotIndex: number) => void;
}

export default function UnlockPlotModal({
  plotIndex,
  userCoin,
  unlockedCount,
  onClose,
  onUnlock,
}: UnlockPlotModalProps) {
  const cost = Math.max(50, unlockedCount * 30);
  const canAfford = userCoin >= cost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fffdf7] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border-2 border-[#d4af37] flex flex-col relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4a2e18] via-[#2c1810] to-[#4a2e18] p-4 text-white flex items-center justify-between border-b-2 border-[#d4af37]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ffd54f] to-[#ff8f00] p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full rounded-[9px] bg-[#2c1810] flex items-center justify-center text-amber-400 font-bold">
                <Lock className="w-4 h-4 text-amber-300" />
              </div>
            </div>
            <h3 className="font-extrabold text-base text-[#fff8e1]">Mở Khóa Ô Đất #{plotIndex + 1}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#5d4037]/80 hover:bg-[#8d6e63] text-[#fff8e1] border border-[#d4af37]/50 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 text-center space-y-4 bg-[#fffdf7]">
          <div className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-100 to-orange-100 text-amber-700 mx-auto flex items-center justify-center shadow-inner border-2 border-[#d4af37]/50">
            <Sparkles className="w-8 h-8" />
          </div>

          <div>
            <p className="text-sm text-[#5d4037] font-semibold">
              Khai hoang vùng đất hoang dã thành đất canh tác màu mỡ trên hòn đảo nổi thần tiên!
            </p>
          </div>

          <div className="bg-[#faf5eb] p-3.5 rounded-2xl border-2 border-[#e5d4be] flex items-center justify-around shadow-xs">
            <div className="flex flex-col items-center">
              <span className="text-[11px] text-[#8d6e63] font-bold uppercase">Chi phí</span>
              <span className="text-base font-black text-amber-700 flex items-center gap-1.5 mt-0.5">
                <AvoraCoinIcon size="sm" className="w-4 h-4" />
                {cost} Xu
              </span>
            </div>
            <div className="h-8 w-px bg-[#ebd9be]" />
            <div className="flex flex-col items-center">
              <span className="text-[11px] text-[#8d6e63] font-bold uppercase">Hiện có</span>
              <span className={`text-base font-black flex items-center gap-1.5 mt-0.5 ${canAfford ? 'text-[#2e7d32]' : 'text-[#c62828]'}`}>
                <AvoraCoinIcon size="sm" className="w-4 h-4" />
                {userCoin} Xu
              </span>
            </div>
          </div>

          <div className="pt-2">
            {canAfford ? (
              <button
                onClick={() => {
                  onUnlock(plotIndex);
                  onClose();
                }}
                className="w-full py-3 bg-gradient-to-b from-[#ffca28] to-[#ff8f00] text-[#3e2723] font-black text-sm rounded-2xl shadow-md border border-[#ffd54f] hover:brightness-105 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Xác Nhận Khai Hoang</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-[#c62828] font-bold">
                  Bạn không đủ Farm Coin để mở khóa ô đất này!
                </div>
                <button
                  disabled
                  className="w-full py-3 bg-[#e0d5c3] text-[#a1887f] font-bold text-sm rounded-2xl border border-[#d7ccc8] cursor-not-allowed"
                >
                  Không Đủ Farm Coin
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
