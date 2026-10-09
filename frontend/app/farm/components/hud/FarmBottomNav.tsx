'use client';

import React from 'react';
import {
  Home,
  Package,
  BookOpen,
  Store,
  Gift,
  Target,
  Users,
  Wheat,
  Award,
  Droplet,
  Crosshair,
} from 'lucide-react';
import { farmEventBus } from '../../game/services/farmEventBus';

interface FarmBottomNavProps {
  onOpenInventory: () => void;
  onOpenCollection: () => void;
  onOpenShop: () => void;
  onOpenRewards: () => void;
  onOpenMissions: () => void;
  onOpenFriends: () => void;
  onHarvestAll: () => void;
  isWaterMode?: boolean;
  onToggleWaterMode?: () => void;
  farmLevel: number;
  unclaimedMissionsCount?: number;
  unseenInventoryCount?: number;
  isMobileLandscape?: boolean;
  isUltraCompact?: boolean;
}

export default function FarmBottomNav({
  onOpenInventory,
  onOpenCollection,
  onOpenShop,
  onOpenRewards,
  onOpenMissions,
  onOpenFriends,
  onHarvestAll,
  isWaterMode = false,
  onToggleWaterMode,
  farmLevel,
  unclaimedMissionsCount = 0,
  unseenInventoryCount = 0,
  isMobileLandscape = false,
  isUltraCompact = false,
}: FarmBottomNavProps) {
  const handleResetCamera = () => {
    farmEventBus.emit('RESET_CAMERA');
  };

  const showLabels = !isUltraCompact;

  return (
    <nav
      className={`absolute bottom-0 left-0 right-0 z-30 pointer-events-none p-1.5 sm:p-2.5 flex items-end ${
        isMobileLandscape ? 'justify-center' : 'flex-col sm:flex-row justify-between'
      } gap-1.5 sm:gap-2.5`}
      style={{
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(8px, env(safe-area-inset-left))',
        paddingRight: 'max(8px, env(safe-area-inset-right))',
      }}
    >
      {/* Bottom Left: Quest Milestone Ribbon Banner (Hidden in ultra-compact, shrunk in mobile landscape) */}
      {!isMobileLandscape && (
        <div className="pointer-events-auto flex items-center gap-1.5 lg:gap-2.5 px-2.5 py-1 sm:px-3 sm:py-1.5 lg:px-4 lg:py-2 rounded-xl lg:rounded-2xl bg-[#fffdfa]/94 backdrop-blur-md border border-[#e0a93b]/70 shadow-[0_3px_12px_rgba(70,45,15,0.12)] text-[#4e342e]">
          <div className="w-5 h-5 lg:w-7 lg:h-7 rounded-md lg:rounded-lg bg-gradient-to-br from-amber-500 to-[#b71c1c] flex items-center justify-center text-white shadow-xs shrink-0">
            <Award className="w-3 h-3 lg:w-4 lg:h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[9.5px] lg:text-xs font-bold text-[#3e2723] font-serif leading-tight">
              Mục tiêu cấp độ
            </span>
            <span className="text-[8px] lg:text-[10px] text-[#8d6e63] font-semibold leading-tight">
              Cấp {farmLevel}
            </span>
          </div>
        </div>
      )}

      {/* Main Game Action Dock (Super Compact on Mobile Landscape, Enlarged on Desktop) */}
      <div
        className="flex items-center gap-0.5 sm:gap-1 lg:gap-1.5 px-1 sm:px-2 lg:px-3 py-0.5 sm:py-1 lg:py-1.5 rounded-2xl lg:rounded-3xl bg-[#fffdfa]/95 backdrop-blur-xl border border-[#e0a93b]/75 shadow-[0_6px_24px_rgba(70,45,15,0.18)] pointer-events-auto max-w-full overflow-x-auto scrollbar-none"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Reset Camera / Center Island */}
        <button
          onClick={handleResetCamera}
          className="flex flex-col items-center justify-center p-1 lg:p-1.5 rounded-xl hover:bg-[#f5efe6] text-[#5d4037] transition-all active:scale-95 cursor-pointer min-w-[30px] sm:min-w-[42px] lg:min-w-[54px]"
          title="Về trung tâm hòn đảo"
        >
          <Crosshair className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-emerald-600" />
          {showLabels && <span className="text-[7.5px] sm:text-[9px] lg:text-[11px] font-bold mt-0.5 lg:mt-1 whitespace-nowrap">Vườn</span>}
        </button>

        {/* Quick Water Mode Tool */}
        {onToggleWaterMode && (
          <button
            onClick={onToggleWaterMode}
            className={`flex flex-col items-center justify-center p-1 lg:p-1.5 rounded-xl transition-all active:scale-95 cursor-pointer min-w-[30px] sm:min-w-[42px] lg:min-w-[54px] ${
              isWaterMode
                ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.5)] ring-1.5 ring-sky-300 animate-pulse'
                : 'hover:bg-[#f5efe6] text-[#5d4037]'
            }`}
            title="Bật/Tắt chế độ tưới nước nhanh"
          >
            <Droplet className={`w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 ${isWaterMode ? 'text-white fill-white' : 'text-sky-600 fill-sky-500'}`} />
            {showLabels && <span className="text-[7.5px] sm:text-[9px] lg:text-[11px] font-bold mt-0.5 lg:mt-1 whitespace-nowrap">Tưới</span>}
          </button>
        )}

        {/* Inventory */}
        <button
          onClick={onOpenInventory}
          className="relative flex flex-col items-center justify-center p-1 lg:p-1.5 rounded-xl hover:bg-[#f5efe6] text-[#5d4037] transition-all active:scale-95 cursor-pointer min-w-[30px] sm:min-w-[42px] lg:min-w-[54px]"
          title="Túi đồ & Hạt giống"
        >
          <div className="relative">
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-amber-600" />
            {unseenInventoryCount > 0 && (
              <span className="absolute -top-1.5 -right-2 lg:-top-2 lg:-right-2.5 px-1 lg:px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[7px] lg:text-[9px] font-black leading-tight shadow-xs animate-bounce">
                {unseenInventoryCount > 9 ? '9+' : unseenInventoryCount}
              </span>
            )}
          </div>
          {showLabels && <span className="text-[7.5px] sm:text-[9px] lg:text-[11px] font-bold mt-0.5 lg:mt-1 whitespace-nowrap">Túi đồ</span>}
        </button>

        {/* Collection Album */}
        <button
          onClick={onOpenCollection}
          className="relative flex flex-col items-center justify-center p-1 sm:px-1.5 lg:px-2.5 lg:py-1.5 rounded-xl bg-gradient-to-b from-[#e8f5e9] to-[#c8e6c9] border border-emerald-600/50 hover:bg-[#a5d6a7] text-[#1b5e20] transition-all active:scale-95 cursor-pointer min-w-[32px] sm:min-w-[46px] lg:min-w-[60px] shadow-xs"
          title="Album Bộ sưu tập đột biến"
        >
          <div className="relative">
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-emerald-700" />
            <span className="absolute -top-1.5 -right-2 lg:-top-2 lg:-right-2.5 px-0.5 lg:px-1 py-0.1 rounded-full bg-[#b71c1c] text-white text-[6.5px] lg:text-[8px] font-black leading-tight shadow-xs">
              Mới
            </span>
          </div>
          {showLabels && <span className="text-[7.5px] sm:text-[9px] lg:text-[11px] font-black mt-0.5 lg:mt-1 whitespace-nowrap text-emerald-900">Album</span>}
        </button>

        {/* Shop */}
        <button
          onClick={onOpenShop}
          className="flex flex-col items-center justify-center p-1 lg:p-1.5 rounded-xl hover:bg-[#f5efe6] text-[#5d4037] transition-all active:scale-95 cursor-pointer min-w-[30px] sm:min-w-[42px] lg:min-w-[54px]"
          title="Cửa hàng Hạt giống & Phân bón"
        >
          <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-blue-600" />
          {showLabels && <span className="text-[7.5px] sm:text-[9px] lg:text-[11px] font-bold mt-0.5 lg:mt-1 whitespace-nowrap">Cửa hàng</span>}
        </button>

        {/* Rewards */}
        <button
          onClick={onOpenRewards}
          className="flex flex-col items-center justify-center p-1 lg:p-1.5 rounded-xl hover:bg-[#f5efe6] text-[#5d4037] transition-all active:scale-95 cursor-pointer min-w-[30px] sm:min-w-[42px] lg:min-w-[54px]"
          title="Đổi Voucher & Quà tặng"
        >
          <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-rose-600" />
          {showLabels && <span className="text-[7.5px] sm:text-[9px] lg:text-[11px] font-bold mt-0.5 lg:mt-1 whitespace-nowrap">Đổi quà</span>}
        </button>

        {/* Missions */}
        <button
          onClick={onOpenMissions}
          className="relative flex flex-col items-center justify-center p-1 lg:p-1.5 rounded-xl hover:bg-[#f5efe6] text-[#5d4037] transition-all active:scale-95 cursor-pointer min-w-[30px] sm:min-w-[42px] lg:min-w-[54px]"
          title="Nhiệm vụ Nông trại"
        >
          <div className="relative">
            <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-sky-600" />
            {unclaimedMissionsCount > 0 && (
              <span className="absolute -top-1.5 -right-2 lg:-top-2 lg:-right-2.5 px-1 lg:px-1.5 py-0.2 rounded-full bg-[#c62828] text-white text-[7px] lg:text-[9px] font-black leading-tight shadow-xs animate-bounce">
                {unclaimedMissionsCount > 9 ? '9+' : unclaimedMissionsCount}
              </span>
            )}
          </div>
          {showLabels && <span className="text-[7.5px] sm:text-[9px] lg:text-[11px] font-bold mt-0.5 lg:mt-1 whitespace-nowrap">Nhiệm vụ</span>}
        </button>

        {/* Friends */}
        <button
          onClick={onOpenFriends}
          className="flex flex-col items-center justify-center p-1 lg:p-1.5 rounded-xl hover:bg-[#f5efe6] text-[#5d4037] transition-all active:scale-95 cursor-pointer min-w-[30px] sm:min-w-[42px] lg:min-w-[54px]"
          title="Thăm vườn Bạn bè"
        >
          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-teal-600" />
          {showLabels && <span className="text-[7.5px] sm:text-[9px] lg:text-[11px] font-bold mt-0.5 lg:mt-1 whitespace-nowrap">Bạn bè</span>}
        </button>

        {/* Harvest All (Unlocked at Lv.3+) */}
        {farmLevel >= 3 && (
          <button
            onClick={onHarvestAll}
            className="flex items-center gap-1 lg:gap-2 px-2 py-1 sm:px-2.5 sm:py-1 lg:px-3.5 lg:py-2 rounded-xl lg:rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-[#c67d00] hover:from-amber-400 hover:to-amber-500 text-white shadow-[0_2px_8px_rgba(200,120,0,0.35)] transition-all active:scale-95 cursor-pointer ml-0.5 border border-amber-300/70"
            title="Thu hoạch tất cả cây đã chín"
          >
            <Wheat className="w-3.5 h-3.5 lg:w-4.5 lg:h-4.5 text-yellow-100 animate-pulse shrink-0" />
            <span className="text-[8px] sm:text-[9.5px] lg:text-xs font-black whitespace-nowrap">
              {isUltraCompact ? 'Gặt' : 'Gặt hết'}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
