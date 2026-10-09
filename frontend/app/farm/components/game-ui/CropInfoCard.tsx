'use client';

import React, { useEffect, useState } from 'react';
import { Droplet, Sparkles, Wheat, X, Clock, Zap, Shovel } from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import { farmSound } from '../../game/services/FarmSoundManager';
import { farmEventBus } from '../../game/services/farmEventBus';

interface CropInfoCardProps {
  plot: any;
  screenPos: { x: number; y: number };
  onWater: (plotIndex: number) => Promise<void>;
  onFertilize: (plotIndex: number) => void;
  onHarvest: (plotIndex: number) => Promise<void>;
  onRequestUproot: (plotIndex: number) => void;
  onClose: () => void;
  userEnergy: number;
}

export default function CropInfoCard({
  plot,
  screenPos,
  onWater,
  onFertilize,
  onHarvest,
  onRequestUproot,
  onClose,
  userEnergy,
}: CropInfoCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>('Đang tính...');
  const [isWatering, setIsWatering] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const cropInstance = plot?.cropInstance;
  const isReady = plot?.status === 'READY';
  const isWatered = plot?.status === 'WATERED' || (cropInstance && cropInstance.wateredCount > 0);

  const isMutated = Boolean(cropInstance?.isMutated || cropInstance?.mutationId);
  const mutatedName = cropInstance?.mutation?.name;
  const baseCropName = cropInstance?.crop?.name || cropInstance?.cropNameSnapshot || 'Cây gốc';
  const displayName = isMutated && mutatedName ? mutatedName : (cropInstance?.cropNameSnapshot || cropInstance?.crop?.name || 'Cây Trồng');
  const rarity = cropInstance?.mutation?.rarity || cropInstance?.crop?.rarity || 'COMMON';
  const sellPrice = (cropInstance?.mutation?.bonusSellPrice || 0) + (cropInstance?.rewardFarmCoinSnapshot || cropInstance?.crop?.sellPrice || 10);

  // Tỉ lệ đột biến của cây trồng
  const mutationRate = cropInstance?.mutationRateSnapshot ?? cropInstance?.crop?.baseMutationRate ?? 0.05;
  const mutationRatePercent = (mutationRate * 100).toFixed(1);

  // Đếm ngược thời gian chín dựa trên Timestamp chuẩn (Không bị reset khi mở/đóng modal)
  useEffect(() => {
    if (!cropInstance || isReady) {
      setTimeLeft('Đã chín!');
      setProgressPercent(100);
      return;
    }

    const readyAtMs = new Date(cropInstance.readyAt).getTime();
    const plantedAtMs = cropInstance.plantedAt ? new Date(cropInstance.plantedAt).getTime() : (readyAtMs - (cropInstance.growDurationSnapshot || 60) * 1000);

    const updateCountdown = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((readyAtMs - now) / 1000));

      if (diffSec <= 0) {
        setTimeLeft('Đã chín!');
        setProgressPercent(100);
      } else {
        const m = Math.floor(diffSec / 60);
        const s = diffSec % 60;
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);

        const totalDuration = readyAtMs - plantedAtMs;
        if (totalDuration > 0) {
          const currentProgress = Math.min(99, Math.max(5, Math.round(((now - plantedAtMs) / totalDuration) * 100)));
          setProgressPercent(currentProgress);
        } else {
          setProgressPercent(50);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [cropInstance, isReady]);

  if (!plot || (!cropInstance && !isReady)) return null;

  const stage = plot.growthState?.stage ?? (isReady ? 5 : 2);

  const handleWaterClick = async () => {
    if (isWatering || isWatered) return;
    setIsWatering(true);
    farmSound.playWater();
    farmEventBus.emit('WATER_SPLASH', { plotIndex: plot.plotIndex });
    try {
      await onWater(plot.plotIndex);
    } finally {
      setIsWatering(false);
    }
  };

  const handleHarvestClick = async () => {
    if (isHarvesting) return;
    setIsHarvesting(true);
    farmSound.playHarvest();
    try {
      await onHarvest(plot.plotIndex);
      onClose();
    } finally {
      setIsHarvesting(false);
    }
  };

  // Tính toán vị trí hiển thị: Chống văng khỏi màn hình (Viewport Clamping)
  const winW = typeof window !== 'undefined' ? window.innerWidth : 800;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 600;

  // Kích thước ước lượng an toàn của card
  const cardHalfW = winW < 640 ? 105 : 120;
  const cardHalfH = winW < 640 ? 82 : 92;

  // Nếu cây ở gần mép trên (y < 165px), đặt card xuống phía dưới cây để không bị che bởi Top HUD
  const isTopPlot = screenPos.y < 170;
  const targetOffsetY = isTopPlot ? 78 : -78;

  // Nếu cây ở gần mép phải thì lệch sang trái, nếu ở giữa thì cân đối
  const isNearRight = screenPos.x > winW - 160;
  const isNearLeft = screenPos.x < 160;
  const targetOffsetX = isNearRight ? -80 : (isNearLeft ? 80 : 0);

  // Kẹp chặt tọa độ bên trong khung nhìn an toàn (Safe Viewport Bounds)
  const clampedX = Math.max(cardHalfW + 10, Math.min(winW - cardHalfW - 10, screenPos.x + targetOffsetX));
  const clampedY = Math.max(cardHalfH + 54, Math.min(winH - cardHalfH - 72, screenPos.y + targetOffsetY));

  return (
    <div
      className="fixed z-40 pointer-events-none transition-transform duration-75 ease-out"
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="pointer-events-auto relative w-[215px] sm:w-[245px] p-2.5 sm:p-3 rounded-2xl bg-[#fffdfa]/98 backdrop-blur-md border-2 border-[#e0a93b] shadow-[0_10px_30px_rgba(70,45,15,0.3)] flex flex-col gap-2 text-[#3e2723] animate-in fade-in zoom-in-95 duration-150"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#e0a93b]/30 pb-1.5">
          <div className="flex flex-col max-w-[170px]">
            {isMutated ? (
              <div className="flex items-center gap-1 mb-0.5">
                <span className="px-1.5 py-0.2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-xs">
                  <Sparkles className="w-2 h-2" /> Đột Biến
                </span>
                <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-900 text-[7.5px] sm:text-[8px] font-bold">
                  {rarity}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 mb-0.5">
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-800 text-[8px] sm:text-[8.5px] font-bold border border-purple-200">
                  <Sparkles className="w-2 h-2 text-purple-600" />
                  Đột biến: {mutationRatePercent}%
                </span>
              </div>
            )}
            <span className="text-[11px] sm:text-xs font-black font-serif leading-tight text-[#2d1b08] truncate">
              {displayName}
            </span>
            {isMutated && (
              <span className="text-[8.5px] sm:text-[9.5px] text-amber-800 font-medium truncate">
                Gốc: {baseCropName}
              </span>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] sm:text-[10px] text-emerald-700 font-bold">
                {isReady ? '⭐ Sẵn sàng thu hoạch' : `Giai đoạn ${stage + 1}/6`}
              </span>
              <span className="text-[8.5px] sm:text-[9.5px] text-stone-500 font-semibold flex items-center gap-0.5">
                • {sellPrice} <AvoraCoinIcon size="xs" className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
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
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Growth Progress Bar */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-stone-600">
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" />
              {timeLeft}
            </span>
            <span>{progressPercent}%</span>
          </div>

          <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isMutated
                  ? 'bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {isReady ? (
            /* Nút Thu hoạch nổi bật khi cây chín + Nút Đào Cây */
            <>
              <button
                onClick={handleHarvestClick}
                disabled={isHarvesting}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-[11px] sm:text-xs font-black shadow-[0_2px_10px_rgba(212,175,55,0.4)] transition-all active:scale-95 cursor-pointer animate-pulse"
              >
                <Wheat className="w-3.5 h-3.5 text-white" />
                <span>{isHarvesting ? 'Đang hái...' : 'Thu hoạch'}</span>
              </button>

              <button
                onClick={() => {
                  farmSound.playTap();
                  onRequestUproot(plot.plotIndex);
                }}
                className="p-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all active:scale-95 cursor-pointer shadow-xs"
                title="Nhổ bỏ cây này (Đào cây)"
              >
                <Shovel className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            /* Các nút chăm sóc khi cây đang lớn + Nút Đào Cây */
            <>
              <button
                onClick={handleWaterClick}
                disabled={isWatering || isWatered}
                className={`flex-1 flex items-center justify-center gap-1 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all active:scale-95 cursor-pointer shadow-xs ${
                  isWatered
                    ? 'bg-sky-100 text-sky-500 border border-sky-200 cursor-not-allowed'
                    : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-500/20'
                }`}
                title={isWatered ? 'Đất đã đủ nước' : 'Tưới nước'}
              >
                <Droplet className="w-3 h-3 fill-current" />
                <span>{isWatered ? 'Đã tưới' : 'Tưới'}</span>
              </button>

              <button
                onClick={() => {
                  farmSound.playTap();
                  onFertilize(plot.plotIndex);
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[10px] sm:text-[11px] font-bold shadow-purple-500/20 transition-all active:scale-95 cursor-pointer shadow-xs"
                title="Bón phân kích thích sinh trưởng"
              >
                <Sparkles className="w-3 h-3 text-purple-200" />
                <span>Bón phân</span>
              </button>

              <button
                onClick={() => {
                  farmSound.playTap();
                  onRequestUproot(plot.plotIndex);
                }}
                className="p-1 sm:p-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all active:scale-95 cursor-pointer shadow-xs"
                title="Nhổ bỏ cây này (Đào cây)"
              >
                <Shovel className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
