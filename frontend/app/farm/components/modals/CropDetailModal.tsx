'use client';

import React from 'react';
import { X, Droplet, Sparkles, Clock, Zap, Flame } from 'lucide-react';

interface CropDetailModalProps {
  plot: any;
  onClose: () => void;
  onWater: (plotIndex: number) => void;
  onFertilize: (plotIndex: number, fertilizerCode: string) => void;
  onHarvest: (plotIndex: number) => void;
}

export default function CropDetailModal({
  plot,
  onClose,
  onWater,
  onFertilize,
  onHarvest,
}: CropDetailModalProps) {
  if (!plot || !plot.cropInstance) return null;

  const instance = plot.cropInstance;
  const isMutated = Boolean(instance.isMutated || instance.mutationId);
  const mutatedName = instance.mutation?.name;
  const baseCropName = instance.crop?.name || instance.cropNameSnapshot || 'Cây gốc';
  const displayName = isMutated && mutatedName ? mutatedName : (instance.cropNameSnapshot || instance.crop?.name || 'Cây Trồng');
  const rarity = instance.mutation?.rarity || instance.crop?.rarity || 'COMMON';

  const [secondsRemaining, setSecondsRemaining] = React.useState<number>(0);
  const [progressPercent, setProgressPercent] = React.useState<number>(0);
  const isReady = plot.status === 'READY' || secondsRemaining <= 0;

  React.useEffect(() => {
    if (!instance) return;

    const readyAtMs = new Date(instance.readyAt).getTime();
    const plantedAtMs = instance.plantedAt
      ? new Date(instance.plantedAt).getTime()
      : readyAtMs - (instance.growDurationSnapshot || 60) * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((readyAtMs - now) / 1000));
      setSecondsRemaining(diff);

      const totalDuration = readyAtMs - plantedAtMs;
      if (totalDuration > 0) {
        setProgressPercent(Math.min(100, Math.max(0, Math.round(((now - plantedAtMs) / totalDuration) * 100))));
      } else {
        setProgressPercent(100);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [instance]);

  const stageNames = ['Hạt Giống', 'Nảy Mầm', 'Cây Non', 'Đang Lớn', 'Trưởng Thành', 'Sẵn Sàng Thu Hoạch'];
  const stageIndex = isReady ? 5 : Math.min(4, Math.floor((progressPercent / 100) * 5));
  const currentStageName = stageNames[stageIndex];

  const formatSeconds = (sec: number) => {
    if (sec <= 0) return 'Đã chín!';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s} giây nữa`;
    return `${m} phút ${s}s nữa`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fffdf7] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border-2 border-[#d4af37] flex flex-col relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4a2e18] via-[#2c1810] to-[#4a2e18] p-4 text-white flex items-center justify-between border-b-2 border-[#d4af37]/60">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#ffd54f]">
                Ô Đất #{plot.plotIndex + 1}
              </span>
              {isMutated && (
                <span className="px-1.5 py-0.2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] font-black uppercase tracking-wider">
                  Đột Biến • {rarity}
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-lg leading-tight text-[#fff8e1]">
              {displayName}
            </h3>
            {isMutated && (
              <span className="text-[11px] text-amber-200/90 font-medium">
                Cây gốc: {baseCropName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#5d4037]/80 hover:bg-[#8d6e63] text-[#fff8e1] border border-[#d4af37]/50 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 bg-[#fffdf7]">
          {/* Giai đoạn & Tiến độ */}
          <div className="bg-[#faf5eb] p-3.5 rounded-2xl border-2 border-[#e5d4be] shadow-xs">
            <div className="flex justify-between items-center text-xs font-black text-[#5d4037] mb-1.5">
              <span>Giai đoạn: {currentStageName}</span>
              <span className="text-[#2e7d32] font-black">{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#e8dac1] h-3 rounded-full overflow-hidden border border-[#d4af37]/30">
              <div
                className={`h-full rounded-full transition-all duration-500 shadow-xs ${
                  isMutated
                    ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500'
                    : 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#795548] mt-2 font-bold">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Thời gian còn lại: <strong className="text-[#3e2723]">{formatSeconds(secondsRemaining)}</strong></span>
            </div>
          </div>

          {/* Độ ẩm & Phân bón */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Độ ẩm đất */}
            <div className="bg-[#e1f5fe]/80 p-3 rounded-2xl border border-sky-200 flex flex-col">
              <span className="text-[11px] text-sky-900 font-bold flex items-center gap-1">
                <Droplet className="w-3.5 h-3.5 text-sky-600" />
                Độ ẩm đất
              </span>
              <span className="text-base font-black text-sky-950 mt-0.5">
                {Math.round(plot.waterLevel)}%
              </span>
              <span className="text-[10px] text-sky-700 mt-0.5 font-medium">
                {plot.waterLevel > 60 ? 'Đất đủ ẩm' : 'Cần tưới nước'}
              </span>
            </div>

            {/* Phân bón */}
            <div className="bg-[#fff9c4]/60 p-3 rounded-2xl border border-amber-200 flex flex-col">
              <span className="text-[11px] text-amber-900 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Phân bón
              </span>
              <span className="text-sm font-black text-amber-950 mt-1 truncate">
                {plot.fertilizerItemId ? 'Đã bón phân' : 'Chưa bón'}
              </span>
              <span className="text-[10px] text-amber-800 mt-0.5 font-medium">
                {plot.fertilizerBonus > 0 ? `+${Math.round(plot.fertilizerBonus * 100)}% Đột biến` : 'Tăng cơ hội biến dị'}
              </span>
            </div>
          </div>

          {/* Nút hành động */}
          <div className="space-y-2 pt-1">
            {isReady ? (
              <button
                onClick={() => {
                  onHarvest(plot.plotIndex);
                  onClose();
                }}
                className="w-full py-3 bg-gradient-to-b from-[#ffca28] to-[#ff8f00] text-[#3e2723] font-black text-sm rounded-2xl shadow-lg border border-[#ffd54f] hover:brightness-105 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5 text-amber-900" />
                <span>Thu Hoạch Ngay</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onWater(plot.plotIndex);
                    onClose();
                  }}
                  disabled={plot.waterLevel >= 80}
                  className={`flex-1 py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition border ${
                    plot.waterLevel < 80
                      ? 'bg-[#0288d1] text-white hover:bg-[#0277bd] shadow-md border-sky-300 cursor-pointer active:scale-95'
                      : 'bg-[#e0d5c3] text-[#a1887f] border-[#d7ccc8] cursor-not-allowed'
                  }`}
                >
                  <Droplet className="w-4 h-4" />
                  <span>Tưới Nước (1⚡)</span>
                </button>

                {!plot.fertilizerItemId && (
                  <button
                    onClick={() => {
                      onFertilize(plot.plotIndex, 'FERTILIZER_MUTATION');
                      onClose();
                    }}
                    className="flex-1 py-2.5 bg-gradient-to-b from-[#ffca28] to-[#ff8f00] text-[#3e2723] border border-[#ffd54f] rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Bón Phân</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
