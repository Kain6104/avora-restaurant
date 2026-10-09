'use client';

import React, { useState, useEffect } from 'react';
import { Zap, X, Clock, BatteryCharging, CheckCircle2, Sparkles, Heart, Info, ArrowUpCircle } from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';

interface EnergyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  energy: number;
  maxEnergy: number;
  lastEnergyRecoveryAt?: string | Date | null;
}

export default function EnergyDetailModal({
  isOpen,
  onClose,
  energy,
  maxEnergy,
  lastEnergyRecoveryAt,
}: EnergyDetailModalProps) {
  const [secondsUntilNext, setSecondsUntilNext] = useState<number>(0);
  const [timeToFullSeconds, setTimeToFullSeconds] = useState<number>(0);

  const isFull = energy >= maxEnergy;
  const percent = Math.min(100, Math.round((energy / Math.max(1, maxEnergy)) * 100));

  useEffect(() => {
    if (!isOpen) return;

    const calculateTimes = () => {
      if (isFull) {
        setSecondsUntilNext(0);
        setTimeToFullSeconds(0);
        return;
      }

      const now = Date.now();
      const lastRecTime = lastEnergyRecoveryAt ? new Date(lastEnergyRecoveryAt).getTime() : now;
      const elapsedSec = Math.max(0, Math.floor((now - lastRecTime) / 1000));
      const remainingSecForNext = Math.max(0, 180 - (elapsedSec % 180));

      setSecondsUntilNext(remainingSecForNext);

      const neededPoints = Math.max(0, maxEnergy - energy);
      if (neededPoints > 0) {
        const totalFullSec = (neededPoints - 1) * 180 + remainingSecForNext;
        setTimeToFullSeconds(totalFullSec);
      } else {
        setTimeToFullSeconds(0);
      }
    };

    calculateTimes();
    const interval = setInterval(calculateTimes, 1000);
    return () => clearInterval(interval);
  }, [isOpen, energy, maxEnergy, lastEnergyRecoveryAt, isFull]);

  if (!isOpen) return null;

  const formatMinSec = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatHoursMin = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h} giờ ${m} phút`;
    }
    return `${m} phút ${s.toString().padStart(2, '0')} giây`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md sm:max-w-xl rounded-2xl bg-[#fffdfa] border-2 border-[#e0a93b] shadow-2xl overflow-hidden text-[#3e2723] flex flex-col max-h-[92dvh] overflow-y-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="relative bg-gradient-to-r from-amber-600 via-sky-600 to-indigo-700 px-3 py-1.5 sm:py-2 text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-300 shadow-inner shrink-0">
              <Zap className="w-3.5 h-3.5 fill-amber-300" />
            </div>
            <div>
              <h2 className="font-serif font-black text-xs sm:text-sm tracking-wide leading-tight drop-shadow-xs">
                Năng Lượng Trang Trại
              </h2>
              <p className="text-[9.5px] text-amber-100/90 font-medium">Hồi phục 1⚡ mỗi 3 phút (180s)</p>
            </div>
          </div>

          <button
            onClick={() => {
              farmSound.playTap();
              onClose();
            }}
            className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Side-by-side on landscape/desktop */}
        <div className="p-2.5 sm:p-3 flex flex-col sm:grid sm:grid-cols-2 gap-2 sm:gap-2.5">
          {/* Column 1: Energy Gauge Card */}
          <div className="flex flex-col gap-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-50 via-amber-50/50 to-emerald-50 border border-sky-200/80 shadow-2xs flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#5d4037] flex items-center gap-1">
                  <BatteryCharging className="w-3.5 h-3.5 text-sky-600" />
                  Mức năng lượng
                </span>
                <span className="font-mono font-black text-sm text-sky-700">
                  {energy} <span className="text-[10px] text-stone-500 font-bold">/ {maxEnergy}⚡</span>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-stone-200 overflow-hidden shadow-inner p-0.5 border border-stone-300/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 transition-all duration-300 shadow-xs"
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Countdown Details */}
              {isFull ? (
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-lg border border-emerald-300/60 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Năng lượng đã đầy 100%!</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                  <div className="p-1.5 rounded-lg bg-white/90 border border-sky-200/70 shadow-2xs flex flex-col items-center text-center">
                    <span className="text-[9px] text-stone-500 font-bold flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5 text-sky-600" /> +1⚡ Kế Tiếp
                    </span>
                    <span className="font-mono font-black text-xs text-sky-800 mt-0.5">
                      {formatMinSec(secondsUntilNext)}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white/90 border border-amber-200/70 shadow-2xs flex flex-col items-center text-center">
                    <span className="text-[9px] text-stone-500 font-bold flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" /> Hồi Đầy ({maxEnergy}⚡)
                    </span>
                    <span className="font-mono font-black text-xs text-amber-800 mt-0.5">
                      {formatHoursMin(timeToFullSeconds)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Tips */}
            <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[9.5px] text-[#5d4037] flex flex-col gap-0.5">
              <span className="font-bold flex items-center gap-1 text-amber-900">
                <ArrowUpCircle className="w-3 h-3 text-amber-600" /> Cách Nhận Thêm Năng Lượng:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-stone-600 font-medium">
                <li>Lên cấp nông trại (+5⚡ đến +20⚡ tối đa)</li>
                <li>Mở Bao Lì Xì Cây Thần mỗi ngày</li>
                <li>Ghé thăm nhà hàng AVORA dùng bữa</li>
              </ul>
            </div>
          </div>

          {/* Column 2: Activity Cost Table & Action */}
          <div className="flex flex-col justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-[#8d6e63] tracking-wider flex items-center gap-1">
                <Info className="w-3 h-3 text-amber-600" /> Mức Tiêu Hao Năng Lượng
              </span>
              <div className="grid grid-cols-2 gap-1 text-[10.5px]">
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#fbf9f5] border border-[#e0d8cc]/80">
                  <span className="text-[#5d4037] font-semibold">🌱 Gieo hạt</span>
                  <span className="font-mono font-black text-rose-600">-3⚡</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#fbf9f5] border border-[#e0d8cc]/80">
                  <span className="text-[#5d4037] font-semibold">💧 Tưới nước</span>
                  <span className="font-mono font-black text-rose-600">-1⚡</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#fbf9f5] border border-[#e0d8cc]/80">
                  <span className="text-[#5d4037] font-semibold">🌾 Thu hoạch</span>
                  <span className="font-mono font-black text-emerald-600 text-[10px]">0⚡</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#fbf9f5] border border-[#e0d8cc]/80">
                  <span className="text-[#5d4037] font-semibold">⛏️ Nhổ bỏ cây</span>
                  <span className="font-mono font-black text-emerald-600 text-[10px]">0⚡</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                farmSound.playTap();
                onClose();
              }}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 text-white font-serif font-black text-xs shadow-sm transition-all active:scale-98 hover:brightness-105 cursor-pointer mt-1"
            >
              Đã Hiểu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
