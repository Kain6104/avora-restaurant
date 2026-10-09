'use client';

import React, { useState } from 'react';
import { X, ArrowRight, Sparkles, Check, AlertCircle, Clock, Zap, TrendingUp, Lock } from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import { farmSound } from '../../game/services/FarmSoundManager';
import { farmEventBus } from '../../game/services/farmEventBus';

interface FarmLevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  farm: any;
  userInventory: any[];
  onLevelUpSuccess: (data: any) => void;
}

export default function FarmLevelUpModal({
  isOpen,
  onClose,
  farm,
  userInventory,
  onLevelUpSuccess,
}: FarmLevelUpModalProps) {
  const [isUpgrading, setIsUpgrading] = useState(false);

  if (!isOpen || !farm) return null;

  const currentLevel = farm.level || 1;
  const nextLevel = currentLevel + 1;
  const currentExp = farm.exp || 0;
  const req = farm.levelUpgradeRequirements || {
    expRequired: currentLevel * 100,
    coinCost: currentLevel * 100,
    requiredCropCode: 'JAPANESE_RICE',
    requiredCropName: 'Gạo Koshihikari',
    requiredCropQty: 3,
    cropIconUrl: '/game/farm/crops/rice/stage_5.png',
    perks: {
      growSpeedReduction: '+2.5%',
      energyBoost: '+5⚡',
      sellPriceBoost: '+5.0%',
      unlockTitle: `Thần Điền Cấp ${nextLevel}`,
    },
  };

  const hasEnoughExp = currentExp >= req.expRequired;
  const hasEnoughCoin = (farm.farmCoin || 0) >= req.coinCost;

  // Tìm nông sản trong kho đồ
  const cropInInventory = userInventory.find(
    (item) => item.itemType === 'CROP' && (item.itemCode === req.requiredCropCode || item.referenceId === req.requiredCropCode),
  );
  const currentCropQty = cropInInventory?.quantity || 0;
  const hasEnoughCrop = currentCropQty >= req.requiredCropQty;

  const canUpgrade = hasEnoughExp && hasEnoughCoin && hasEnoughCrop;

  const handleUpgrade = async () => {
    if (!canUpgrade || isUpgrading) return;
    setIsUpgrading(true);
    farmSound.playLevelUp();

    try {
      const res = await fetch('/api/farm/level-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: `🎉 Chúc mừng! Bạn đã thăng cấp lên Lv.${json.data.newLevel}!`,
          subMessage: req.perks.unlockTitle,
        });
        onLevelUpSuccess(json.data);
        onClose();
      } else {
        farmEventBus.emit('GAME_TOAST', {
          type: 'error',
          message: json.message || 'Chưa đủ điều kiện để nâng cấp nông trại!',
        });
      }
    } catch (e) {
      farmEventBus.emit('GAME_TOAST', {
        type: 'error',
        message: 'Lỗi kết nối khi nâng cấp',
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] flex flex-col w-screen h-screen bg-[#fffdfa] text-stone-900 font-sans overflow-hidden animate-in fade-in duration-200 select-none">
      {/* Top Japanese Zen Pattern Banner */}
      <div className="relative px-3 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-[#5a3e1b] via-[#8c6227] to-[#5a3e1b] text-white flex items-center justify-between border-b border-[#e0a93b]/60 shrink-0 shadow-md">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={onClose}
            className="px-2 sm:px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer"
          >
            ← Trở về
          </button>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#d4af37]/30 border border-[#f5d77f] flex items-center justify-center shadow-inner shrink-0">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ffe58f]" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black tracking-wide font-serif text-[#fff8e7]">
              NÂNG CẤP TRANG TRẠI
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#f5d77f]/90">Mở rộng diện tích và gia tăng năng suất canh tác</p>
          </div>
        </div>

          <button
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-all cursor-pointer text-white/90 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto min-h-0 flex-1">
          
          {/* Level Transition Indicator */}
          <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3.5 rounded-2xl bg-gradient-to-b from-[#fbf8f2] to-[#f4ede1] border border-[#e2d5c0] shadow-xs">
            <div className="flex flex-col items-center">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-[#8c6227]">Cấp Hiện Tại</span>
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-serif font-black text-base sm:text-xl flex items-center justify-center shadow-md mt-1 ring-2 ring-amber-300">
                {currentLevel}
              </div>
            </div>

            <div className="flex flex-col items-center flex-1 px-3 sm:px-4">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-[#5a3e1b] mb-1">
                <span className="font-mono">{currentExp}</span>
                <span className="text-[#a0886e]">/</span>
                <span className="font-mono">{req.expRequired} EXP</span>
              </div>
              <div className="w-full h-2.5 sm:h-3 bg-[#e0d8cc] rounded-full overflow-hidden border border-[#c4b5a0]/50 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300 shadow-inner"
                  style={{ width: `${Math.min(100, Math.round((currentExp / req.expRequired) * 100))}%` }}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#8c6227] mt-1 font-semibold">
                {hasEnoughExp ? '✅ Đã đủ kinh nghiệm' : `⚡ Cần thêm ${req.expRequired - currentExp} EXP`}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-emerald-700">Cấp Tiếp Theo</span>
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-serif font-black text-base sm:text-xl flex items-center justify-center shadow-md mt-1 ring-2 ring-emerald-300">
                {nextLevel}
              </div>
            </div>
          </div>

          {/* Perks & Unlocks Section */}
          <div className="space-y-1.5 sm:space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-[#5a3e1b]">
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Đặc Quyền Khi Đạt Cấp {nextLevel}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-[#fdfbf7] border border-[#e5dcd0] flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-medium">Tốc Độ Chín</div>
                  <div className="text-xs font-black text-sky-800">{req.perks.growSpeedReduction}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#fdfbf7] border border-[#e5dcd0] flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-medium">Năng Lượng</div>
                  <div className="text-xs font-black text-amber-800">{req.perks.energyBoost}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#fdfbf7] border border-[#e5dcd0] flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-medium">Giá Bán Nông Sản</div>
                  <div className="text-xs font-black text-emerald-800">{req.perks.sellPriceBoost}</div>
                </div>
              </div>
            </div>

            {/* Major Feature Unlock */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#fff9e6] to-[#fff3d1] border border-[#eedaa2] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-[#d4af37] text-white flex items-center justify-center shrink-0 shadow-sm">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-bold text-[#8c6227] uppercase">Mở Khóa Đặc Biệt</div>
                <div className="text-xs font-extrabold text-[#422006]">{req.perks.unlockTitle}</div>
              </div>
            </div>
          </div>

          {/* Requirements Box */}
          <div className="p-4 rounded-2xl bg-[#faf6ef] border border-[#e8ded0] space-y-3">
            <div className="text-xs font-extrabold text-[#5a3e1b] uppercase tracking-wider">
              Yêu Cầu Nâng Cấp (Vàng & Nông Sản)
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Farm Coin Requirement */}
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                hasEnoughCoin ? 'bg-white border-emerald-300' : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <AvoraCoinIcon size="md" className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-medium">Xu Nông Trại</div>
                  <div className="text-xs font-black font-mono">
                    <span className={hasEnoughCoin ? 'text-emerald-700' : 'text-red-600'}>
                      {farm.farmCoin?.toLocaleString('vi-VN')}
                    </span>
                    <span className="text-gray-400"> / {req.coinCost?.toLocaleString('vi-VN')}</span>
                  </div>
                </div>
              </div>

              {/* Crop Material Requirement */}
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                hasEnoughCrop ? 'bg-white border-emerald-300' : 'bg-red-50/70 border-red-200'
              }`}>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 overflow-hidden p-1">
                  <img src={req.cropIconUrl} alt={req.requiredCropName} className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-medium truncate max-w-[100px]">{req.requiredCropName}</div>
                  <div className="text-xs font-black font-mono">
                    <span className={hasEnoughCrop ? 'text-emerald-700' : 'text-red-600'}>
                      {currentCropQty}
                    </span>
                    <span className="text-gray-400"> / {req.requiredCropQty}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleUpgrade}
            disabled={!canUpgrade || isUpgrading}
            className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 ${
              canUpgrade
                ? 'bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-[0_4px_16px_rgba(212,175,55,0.4)] ring-2 ring-amber-300'
                : 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none'
            }`}
          >
            {isUpgrading ? (
              <span>Đang thăng cấp nông trại...</span>
            ) : canUpgrade ? (
              <>
                <Sparkles className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '3s' }} />
                <span>NÂNG CẤP LÊN CẤP {nextLevel}</span>
              </>
            ) : (
              <span>CHƯA ĐỦ ĐIỀU KIỆN THĂNG CẤP</span>
            )}
          </button>
        </div>
    </div>
  );
}
