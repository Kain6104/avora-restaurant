'use client';

import React from 'react';
import { X, Clock, Sprout, TrendingUp, Sparkles, Info, ShieldCheck } from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import PlantSprite from '../common/PlantSprite';

interface SeedInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  crop: {
    code: string;
    name: string;
    category?: string;
    rarity?: string;
    seedPrice?: number;
    sellPrice?: number;
    price?: number;
    growDuration?: number;
    baseYield?: number;
    description?: string;
    minFarmLevel?: number;
  } | null;
}

export default function SeedInfoModal({ isOpen, onClose, crop }: SeedInfoModalProps) {
  if (!isOpen || !crop) return null;

  const seedPrice = crop.seedPrice ?? crop.price ?? 10;
  const sellPrice = crop.sellPrice ?? Math.round(seedPrice * 1.5);
  const baseYield = crop.baseYield ?? 4;
  const totalRevenue = sellPrice * baseYield;
  const netProfit = totalRevenue - seedPrice;
  const durationSec = crop.growDuration ?? 120;
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const durationText = minutes > 0 ? `${minutes} phút ${seconds > 0 ? `${seconds}s` : ''}` : `${seconds} giây`;

  // Crop preview image
  const getCropImage = (code: string) => {
    switch (code) {
      case 'JAPANESE_RICE':
        return '/game/farm/crops/rice/stage_5.png';
      case 'STRAWBERRY':
        return '/game/farm/crops/strawberry/stage_5.png';
      case 'WASABI':
        return '/game/farm/crops/wasabi/stage_5.png';
      case 'SHISO':
        return '/game/farm/crops/shiso/stage_5.png';
      case 'MATCHA_LEAF':
        return '/game/farm/crops/matcha/stage_5.png';
      case 'YUZU':
        return '/game/farm/crops/yuzu/stage_5.png';
      case 'GRAPE':
        return '/game/farm/crops/grape/stage_5.png';
      case 'PEACH':
        return '/game/farm/crops/peach/stage_5.png';
      default:
        return '/game/farm/crops/rice/stage_5.png';
    }
  };

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#fffdfa] rounded-3xl border-2 border-[#d4af37] shadow-[0_16px_48px_rgba(70,45,15,0.35)] overflow-hidden flex flex-col font-sans">
        
        {/* Modal Header */}
        <div className="relative px-5 py-4 bg-gradient-to-r from-[#4a3014] via-[#7d531d] to-[#4a3014] text-white flex items-center justify-between border-b border-[#e0a93b]/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#d4af37]/30 border border-[#f5d77f] flex items-center justify-center">
              <Info className="w-3.5 h-3.5 text-[#ffe58f]" />
            </div>
            <h3 className="text-base font-bold font-serif text-[#fff8e7]">THÔNG SỐ NÔNG SẢN</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-all cursor-pointer text-white/90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          
          {/* Crop Profile Header Card */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-[#faf6ef] border border-[#e8ded0]">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#e0a93b]/50 p-2 shrink-0 flex items-center justify-center shadow-xs">
              <PlantSprite cropCode={crop.code} stage={5} alt={crop.name} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase">
                  {crop.rarity || 'PHỔ THÔNG'}
                </span>
                {crop.minFarmLevel && crop.minFarmLevel > 1 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold">
                    Cấp {crop.minFarmLevel}
                  </span>
                )}
              </div>
              <h4 className="font-serif font-black text-[#422006] text-base truncate">{crop.name}</h4>
              <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">
                {crop.description || 'Nguyên liệu nông sản thượng hạng được chăm sóc trên hòn đảo thần thoại AVORA.'}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Growth Duration */}
            <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 font-medium">Thời gian chín</div>
                <div className="text-xs font-black text-sky-900">{durationText}</div>
              </div>
            </div>

            {/* Base Yield */}
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Sprout className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 font-medium">Sản lượng cơ bản</div>
                <div className="text-xs font-black text-emerald-900">~{baseYield} nông sản/cây</div>
              </div>
            </div>

            {/* Seed Price */}
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AvoraCoinIcon size="sm" className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 font-medium">Giá hạt giống</div>
                <div className="text-xs font-black text-amber-900 flex items-center gap-1">
                  {seedPrice} <AvoraCoinIcon size="xs" className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* Sell Price */}
            <div className="p-3 rounded-xl bg-orange-50/70 border border-orange-200/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 font-medium">Giá bán ra</div>
                <div className="text-xs font-black text-orange-900 flex items-center gap-1">
                  {sellPrice} <AvoraCoinIcon size="xs" className="w-3 h-3" /> / đơn vị
                </div>
              </div>
            </div>
          </div>

          {/* Economic Profit Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#fff9e6] to-[#fff3d1] border border-[#eedaa2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <div>
                <div className="text-[11px] font-bold text-[#8c6227]">Lợi Nhuận Ước Tính/Vụ</div>
                <div className="text-[10px] text-gray-500 flex items-center gap-1">
                  Doanh thu ({totalRevenue} Xu) - Vốn hạt ({seedPrice} Xu)
                </div>
              </div>
            </div>
            <div className="text-sm font-black font-mono text-emerald-700 flex items-center gap-1">
              +{netProfit} <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Culinary Note */}
          <div className="p-3 rounded-xl bg-[#fcfbf9] border border-gray-200 flex items-start gap-2.5 text-[11px] text-[#5d4037]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              Nông sản thu hoạch có thể bán trực tiếp thu Xu Nông Trại, hoặc dùng trong <strong>Cửa hàng Nông Sản</strong> để đổi Voucher ưu đãi ẩm thực độc quyền tại nhà hàng AVORA!
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-[#d4af37] text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer hover:from-amber-600 hover:to-amber-700 shadow-md active:scale-98"
          >
            ĐÃ HIỂU
          </button>
        </div>
      </div>
    </div>
  );
}
