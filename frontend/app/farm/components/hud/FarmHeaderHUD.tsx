'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  ArrowLeft,
  Mail,
  History,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import type { FarmTheme } from '../../utils/farmPreferences';

interface FarmHeaderHUDProps {
  user: any;
  farm: any;
  theme?: FarmTheme;
  onToggleTheme?: () => void;
  // Giữ lại tương thích ngược nếu component cha truyền
  currentWeather?: string;
  onWeatherChange?: (weather: string) => void;
  onRefresh?: () => void;
  isAudioEnabled?: boolean;
  onToggleAudio?: () => void;
  onOpenLevelUpModal?: () => void;
  luckyTickets?: number;
  onOpenLuckyEnvelope?: () => void;
  onOpenMailbox?: () => void;
  unreadMailCount?: number;
  onOpenHistory?: () => void;
  onOpenEnergyDetail?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isMobileLandscape?: boolean;
}

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(num >= 10_000_000 ? 1 : 2).replace(/\.0$/, '') + 'M';
  }
  if (num >= 100_000) {
    return (num / 1_000).toFixed(0) + 'K';
  }
  if (num >= 10_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString('vi-VN');
}

export default function FarmHeaderHUD({
  user,
  farm,
  theme = 'DAY',
  onToggleTheme,
  currentWeather,
  onWeatherChange,
  isAudioEnabled = false,
  onToggleAudio,
  onOpenLevelUpModal,
  luckyTickets = 0,
  onOpenLuckyEnvelope,
  onOpenMailbox,
  unreadMailCount = 0,
  onOpenHistory,
  onOpenEnergyDetail,
  isFullscreen = false,
  onToggleFullscreen,
  isMobileLandscape = false,
}: FarmHeaderHUDProps) {
  const [showCoinTooltip, setShowCoinTooltip] = useState(false);

  const isNight = theme === 'NIGHT' || currentWeather === 'NIGHT';

  const level = farm?.level ?? 1;
  const exp = farm?.exp ?? 0;
  const expNext = level * 100;
  const expPercent = Math.min(100, Math.round((exp / expNext) * 100));

  const energy = farm?.energy ?? 30;
  const maxEnergy = farm?.maxEnergy ?? 30;
  const farmCoin = farm?.farmCoin ?? 0;
  const loyaltyPoints = user?.currentPoints ?? user?.points ?? 0;

  // Xử lý chuyển đổi trực tiếp 2 Theme DAY ↔ NIGHT
  const handleThemeToggle = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else if (onWeatherChange) {
      onWeatherChange(isNight ? 'SUNNY' : 'NIGHT');
    }
  };

  // Glass style thích ứng nhẹ theo Theme (yêu cầu số 15)
  const backBtnGlass = isNight
    ? 'bg-[#0f172a]/85 hover:bg-[#1e293b] border-[#d4af37]/60 text-amber-100 shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
    : 'bg-[#fffdfa]/94 hover:bg-[#ffffff] border-[#d4af37]/70 text-[#5d4037] shadow-[0_2px_8px_rgba(100,70,20,0.12)]';

  const cardGlass = isNight
    ? 'bg-[#0f172a]/85 border-[#d4af37]/60 text-slate-100 shadow-[0_3px_12px_rgba(0,0,0,0.35)]'
    : 'bg-[#fffdfa]/94 border-[#e0a93b]/70 text-[#4e342e] shadow-[0_3px_12px_rgba(90,60,20,0.14)]';

  const pillGlass = isNight
    ? 'bg-[#0f172a]/85 hover:bg-[#1e293b] border-[#d4af37]/50 text-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
    : 'bg-[#fffdfa]/94 hover:bg-[#ffffff] border-[#e0a93b]/60 text-[#37474f] shadow-[0_2px_8px_rgba(90,60,20,0.1)]';

  const actionBtnGlass = isNight
    ? 'bg-[#0f172a]/85 hover:bg-[#1e293b] border-[#d4af37]/50 text-amber-200 shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
    : 'bg-[#fffdfa]/94 hover:bg-[#ffffff] border-[#e0a93b]/70 text-[#5d4037] shadow-[0_2px_8px_rgba(90,60,20,0.12)]';

  return (
    <header
      className={`absolute top-0 left-0 right-0 z-30 pointer-events-none p-1.5 sm:p-3 flex items-start justify-between gap-1 sm:gap-2 transition-colors duration-500 ${
        isNight ? 'text-amber-100' : 'text-[#3e2723]'
      }`}
      style={{
        paddingTop: 'max(6px, env(safe-area-inset-top))',
        paddingLeft: 'max(8px, env(safe-area-inset-left))',
        paddingRight: 'max(8px, env(safe-area-inset-right))',
      }}
    >
      {/* ========================================================================= */}
      {/* Top Left: AVORA (Leftmost) + Player Profile, then Mail & History below    */}
      {/* ========================================================================= */}
      <div className="flex flex-col items-start gap-1.5 pointer-events-auto">
        {/* Top Row: [ ← AVORA ] [ Player Profile ] */}
        <div className="flex items-center gap-1.5 lg:gap-2">
          {/* 1. Back Button to AVORA Restaurant (FIRST / LEFTMOST) */}
          <Link
            href="/"
            className={`h-7 sm:h-8 lg:h-9 px-2 sm:px-2.5 lg:px-3 flex items-center justify-center gap-1 lg:gap-1.5 rounded-xl backdrop-blur-md border text-[10px] sm:text-xs lg:text-sm font-bold transition-all active:scale-95 cursor-pointer shrink-0 ${backBtnGlass}`}
            title="Quay lại Nhà hàng AVORA"
          >
            <ArrowLeft className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-[#e53935]" />
            <span className="font-serif font-black tracking-wide">AVORA</span>
          </Link>

          {/* 2. Compact Player Profile Card (NEXT TO AVORA) */}
          <div
            onClick={onOpenLevelUpModal}
            className={`flex items-center gap-1 sm:gap-1.5 lg:gap-2 px-1.5 py-1 sm:px-2 sm:py-1 lg:px-2.5 lg:py-1.5 rounded-xl backdrop-blur-md border transition-all cursor-pointer select-none active:scale-98 ${cardGlass} ${
              farm?.pendingLevelUp || exp >= expNext
                ? 'border-amber-400 ring-2 ring-amber-400 ring-offset-1 ring-offset-amber-950 shadow-[0_3px_16px_rgba(212,175,55,0.5)]'
                : 'hover:border-[#d4af37]'
            }`}
            title="Nhấp để xem và nâng cấp cấp độ trang trại"
          >
            {/* Avatar */}
            <div className="relative w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-full overflow-hidden ring-1.5 ring-[#e0a93b] bg-[#f5efe6] shrink-0 shadow-inner">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-serif font-black text-[#8d6e63] text-[10px] lg:text-xs">
                  {(user?.fullName || 'A')[0]}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white" />
            </div>

            {/* Name & EXP Bar */}
            <div className="flex flex-col min-w-[54px] sm:min-w-[85px] lg:min-w-[100px] leading-none">
              <div className="flex items-center justify-between gap-1 text-[8.5px] sm:text-[10px] lg:text-[11px] font-bold">
                <span className={`truncate max-w-[48px] sm:max-w-[80px] lg:max-w-[96px] font-serif ${isNight ? 'text-amber-100' : 'text-[#4e342e]'}`}>
                  {user?.fullName || 'Trang trại'}
                </span>
                {farm?.pendingLevelUp || exp >= expNext ? (
                  <span className="px-1 py-0.2 rounded-full bg-gradient-to-r from-amber-500 to-red-500 text-white font-black text-[7px] sm:text-[8px] lg:text-[9px] animate-bounce">
                    LÊN!
                  </span>
                ) : (
                  <span className="px-1 py-0.2 rounded bg-gradient-to-r from-amber-500 to-amber-600 text-white font-extrabold text-[7.5px] sm:text-[8.5px] lg:text-[9.5px]">
                    Lv.{level}
                  </span>
                )}
              </div>

              {/* Micro EXP Bar */}
              <div className={`w-full h-1 lg:h-1.5 rounded-full overflow-hidden mt-1 border ${isNight ? 'bg-slate-800 border-slate-700' : 'bg-[#e0d8cc] border-[#c4b5a0]/40'}`}>
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-lime-500 rounded-full transition-all duration-300"
                  style={{ width: `${expPercent}%` }}
                />
              </div>
              <div className={`hidden sm:block text-[7px] lg:text-[8.5px] font-mono mt-0.5 text-right font-semibold ${isNight ? 'text-slate-400' : 'text-[#8d6e63]'}`}>
                {exp}/{expNext} XP
              </div>
            </div>
          </div>
        </div>

        {/* Vertical Column Below AVORA: [ ✉ ] then [ ↶ ] */}
        <div className="flex flex-col items-start gap-1 lg:gap-1.5">
          {/* Mailbox */}
          {onOpenMailbox && (
            <button
              onClick={onOpenMailbox}
              className={`relative w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-xl backdrop-blur-md border transition-all active:scale-95 cursor-pointer shrink-0 ${actionBtnGlass}`}
              title="Hòm thư Nông Trại"
            >
              <Mail className="w-3.5 h-3.5 lg:w-4.5 lg:h-4.5" />
              {unreadMailCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] lg:min-w-[16px] lg:h-[16px] px-0.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-[8px] lg:text-[9px] rounded-full flex items-center justify-center shadow-md animate-bounce border border-white">
                  {unreadMailCount > 99 ? '99+' : unreadMailCount}
                </span>
              )}
            </button>
          )}

          {/* History */}
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-xl backdrop-blur-md border transition-all active:scale-95 cursor-pointer shrink-0 ${actionBtnGlass}`}
              title="Lịch sử giao dịch nông trại"
            >
              <History className="w-3.5 h-3.5 lg:w-4.5 lg:h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Top Right: Currencies, Energy, Sound, Fullscreen, Day/Night Theme Switch  */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 pointer-events-auto">
        {/* Lucky Envelope Ticket Pill */}
        {luckyTickets > 0 && (
          <button
            onClick={onOpenLuckyEnvelope}
            className="flex items-center gap-0.5 lg:gap-1 px-1.5 py-1 sm:px-2 sm:py-1.5 lg:px-2.5 lg:py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white backdrop-blur-md border border-amber-300/80 shadow-[0_2px_8px_rgba(220,38,38,0.35)] text-[9.5px] sm:text-xs lg:text-sm font-bold animate-pulse active:scale-95 cursor-pointer shrink-0"
            title={`Bạn có ${luckyTickets} bao lì xì may mắn trên Cây Thần. Nhấp để mở ngay!`}
          >
            <span className="text-xs sm:text-sm lg:text-base leading-none">🧧</span>
            <span className="font-mono font-black text-amber-100 text-[9px] sm:text-xs lg:text-sm">×{luckyTickets}</span>
          </button>
        )}

        {/* Clickable Energy Pill */}
        <button
          onClick={onOpenEnergyDetail}
          className={`flex items-center gap-0.5 sm:gap-1 lg:gap-1.5 px-1.5 py-1 sm:px-2 sm:py-1.5 lg:px-2.5 lg:py-1.5 rounded-xl backdrop-blur-md border text-[9.5px] sm:text-xs lg:text-sm font-bold transition-all active:scale-95 cursor-pointer ${pillGlass}`}
          title="Nhấp để xem chi tiết thời gian hồi phục Năng lượng (1⚡ / 3 phút)"
        >
          <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-sky-400 fill-sky-400 shrink-0" />
          <span className={`font-mono font-black text-[9.5px] sm:text-xs lg:text-sm ${isNight ? 'text-sky-200' : 'text-[#37474f]'}`}>
            {energy}{!isMobileLandscape && `/${maxEnergy}`}
          </span>
        </button>

        {/* Farm Coin Pill with Tap Tooltip for full number */}
        <div className="relative">
          <button
            onClick={() => setShowCoinTooltip(!showCoinTooltip)}
            className={`flex items-center gap-0.5 sm:gap-1 lg:gap-1.5 px-1.5 py-1 sm:px-2.5 sm:py-1.5 lg:px-3 lg:py-1.5 rounded-xl backdrop-blur-md border text-[9.5px] sm:text-xs lg:text-sm font-bold cursor-pointer active:scale-95 transition-all ${pillGlass}`}
            title="Nhấp để xem số xu chính xác"
          >
            <AvoraCoinIcon size="sm" className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 shrink-0" />
            <span className={`font-mono font-black text-[9.5px] sm:text-xs lg:text-sm ${isNight ? 'text-amber-300' : 'text-[#5d4037]'}`}>
              {isMobileLandscape ? formatCompactNumber(farmCoin) : farmCoin.toLocaleString('vi-VN')}
            </span>
          </button>

          {/* Full Coin Tooltip Popover */}
          {showCoinTooltip && (
            <div
              onClick={() => setShowCoinTooltip(false)}
              className="absolute top-full mt-1.5 right-0 z-50 px-2.5 py-1.5 rounded-xl bg-[#0e1712]/95 border border-[#d4af37] shadow-xl text-white font-mono text-[11px] font-black whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 flex items-center gap-1.5"
            >
              <AvoraCoinIcon size="sm" className="w-3.5 h-3.5" />
              <span>{farmCoin.toLocaleString('vi-VN')} Xu</span>
            </div>
          )}
        </div>

        {/* Loyalty Point Pill (Visible when width permits) */}
        <div className={`hidden min-[480px]:flex items-center gap-0.5 lg:gap-1 px-1.5 py-1 sm:px-2 sm:py-1.5 lg:px-2.5 lg:py-1.5 rounded-xl backdrop-blur-md border text-[9.5px] sm:text-xs lg:text-sm font-bold ${pillGlass}`}>
          <Sparkles className="w-3 h-3 lg:w-4 lg:h-4 text-rose-400 shrink-0" />
          <span className={`font-mono font-extrabold text-[9.5px] sm:text-xs lg:text-sm ${isNight ? 'text-rose-300' : 'text-[#880e4f]'}`}>
            {isMobileLandscape ? formatCompactNumber(loyaltyPoints) : loyaltyPoints.toLocaleString('vi-VN')}
          </span>
        </div>

        {/* In-Game Fullscreen Toggle Button */}
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-xl backdrop-blur-md border transition-all active:scale-95 cursor-pointer ${actionBtnGlass}`}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Mở toàn màn hình'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4.5 lg:h-4.5" />
            ) : (
              <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4.5 lg:h-4.5" />
            )}
          </button>
        )}

        {/* Video Audio Soundscape Switcher */}
        {onToggleAudio && (
          <button
            onClick={onToggleAudio}
            className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-xl backdrop-blur-md border transition-all active:scale-95 cursor-pointer ${
              isAudioEnabled
                ? isNight
                  ? 'bg-indigo-950/80 border-indigo-400 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.3)]'
                  : 'bg-amber-50 border-[#d4af37] text-amber-700 shadow-[0_2px_8px_rgba(212,175,55,0.25)]'
                : actionBtnGlass
            }`}
            title={isAudioEnabled ? 'Tắt âm thanh cảnh quan' : 'Bật âm thanh cảnh quan video'}
          >
            {isAudioEnabled ? (
              <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4.5 lg:h-4.5 text-amber-500" />
            ) : (
              <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4.5 lg:h-4.5 opacity-60" />
            )}
          </button>
        )}

        {/* ===================================================================== */}
        {/* NÚT CHUYỂN DAY / NIGHT THEME (YÊU CẦU SỐ 2: CHỈ CÓ 2 GIAO DIỆN ☀ / 🌙) */}
        {/* ===================================================================== */}
        <button
          onClick={handleThemeToggle}
          className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-xl backdrop-blur-md border transition-all active:scale-90 cursor-pointer ${
            isNight
              ? 'bg-[#151a30]/90 hover:bg-[#1e2544] border-indigo-400/70 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.35)]'
              : 'bg-[#fffdfa]/94 hover:bg-[#ffffff] border-[#e0a93b]/70 text-amber-500 shadow-[0_2px_8px_rgba(90,60,20,0.15)]'
          }`}
          title={isNight ? '🌙 Ban đêm - Nhấn để chuyển sang Ban ngày (☀)' : '☀ Ban ngày - Nhấn để chuyển sang Ban đêm (🌙)'}
        >
          {isNight ? (
            <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5 text-indigo-300 fill-indigo-400/20 animate-pulse" />
          ) : (
            <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5 text-amber-500 fill-amber-400/30" />
          )}
        </button>
      </div>
    </header>
  );
}
