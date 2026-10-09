'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Check, FastForward, Award } from 'lucide-react';
import PlantSprite from '../common/PlantSprite';
import { farmSound } from '../../game/services/FarmSoundManager';

interface MysteryCropRevealProps {
  isOpen: boolean;
  crop: any;
  isMutated?: boolean;
  mutation?: any;
  isNewDiscovery?: boolean;
  onClose: () => void;
}

export default function MysteryCropReveal({
  isOpen,
  crop,
  isMutated = false,
  mutation = null,
  isNewDiscovery = false,
  onClose,
}: MysteryCropRevealProps) {
  const [stage, setStage] = useState<'PACK_OPENING' | 'REVEALED'>('PACK_OPENING');

  useEffect(() => {
    if (!isOpen) {
      setStage('PACK_OPENING');
      return;
    }

    farmSound.playLevelUp();

    // Chuyển từ hiệu ứng mở gói sang hiện cây sau 450ms
    const timer = setTimeout(() => {
      setStage('REVEALED');
      farmSound.playHarvest();
    }, 450);

    // Tự động đóng sau 4 giây
    const autoClose = setTimeout(() => {
      onClose();
    }, 4000);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoClose);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !crop) return null;

  const displayName = isMutated && mutation?.name ? mutation.name : (crop.name || 'Cây Trồng');
  const displayRarity = isMutated && mutation?.rarity ? mutation.rarity : (crop.rarity || 'COMMON');
  const cropCode = crop.code?.replace('_SEED', '') || 'JAPANESE_RICE';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Background Starburst Radial Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-r from-amber-400/20 via-pink-500/20 to-purple-600/20 blur-3xl animate-spin [animation-duration:12s]" />
      </div>

      <div
        className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#fffdf8] via-[#faf4ea] to-[#f4ebe0] border-3 border-[#e0a93b] shadow-[0_24px_60px_rgba(70,45,15,0.45)] p-6 flex flex-col items-center text-center overflow-hidden animate-in zoom-in-95 duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Floating Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white text-[11px] font-black tracking-wider uppercase shadow-md mb-3 animate-bounce">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isNewDiscovery ? '✨ KHÁM PHÁ MỚI! ✨' : '✨ GIEO HẠT THÀNH CÔNG ✨'}</span>
        </div>

        {/* Big Artwork Showcase */}
        <div className="relative w-36 h-36 rounded-2xl bg-gradient-to-b from-amber-100/60 to-orange-100/40 border-2 border-[#e5d4be] flex items-center justify-center p-3 shadow-inner my-2">
          {stage === 'PACK_OPENING' ? (
            <div className="text-4xl animate-pulse">🎁</div>
          ) : (
            <div className="w-28 h-28 relative flex items-center justify-center animate-in zoom-in duration-300 scale-110">
              <PlantSprite
                cropCode={cropCode}
                stage={5}
                mutationCode={isMutated ? mutation?.code : undefined}
                isMutated={isMutated}
                alt={displayName}
              />
            </div>
          )}
        </div>

        {/* Crop Name & Rarity */}
        <h3 className="font-extrabold text-xl font-serif text-[#2d1b08] mt-2 leading-tight">
          {displayName}
        </h3>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 font-black text-xs uppercase tracking-wider border border-amber-300 shadow-2xs">
            {displayRarity}
          </span>
          {isMutated && (
            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-xs shadow-2xs">
              Đột Biến
            </span>
          )}
        </div>

        {isMutated && (
          <p className="text-xs text-amber-800 font-semibold mt-1">
            Cây gốc: {crop.name}
          </p>
        )}

        <p className="text-xs text-[#795548] font-medium mt-2 max-w-[240px]">
          {isNewDiscovery
            ? 'Mẫu vật đã được tự động thêm vào Album Thần Nông của bạn!'
            : 'Hạt giống bí ẩn đã nảy mầm và đang phát triển trong ô đất.'}
        </p>

        {/* Action Skip / Confirm Button */}
        <div className="w-full flex items-center gap-2.5 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Tiếp tục chơi</span>
          </button>

          <button
            onClick={onClose}
            className="px-3 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Bỏ qua hiệu ứng"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Bỏ qua</span>
          </button>
        </div>
      </div>
    </div>
  );
}
