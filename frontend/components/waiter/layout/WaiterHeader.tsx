'use client';

import React from 'react';
import { Bell, Wifi, WifiOff } from 'lucide-react';
import { useWaiterStore } from '@/store/useWaiterStore';
import { useRealtimeNotifications } from '@/contexts/NotificationRealtimeProvider';
import Image from 'next/image';

export default function WaiterHeader() {
  const isOffline = useWaiterStore((state) => state.isOffline);
  const { unreadCount, openDrawer } = useRealtimeNotifications();

  return (
    <header className="w-full max-w-full box-border min-h-11 pt-[env(safe-area-inset-top,0px)] bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-3 sm:px-4 shrink-0 shadow-2xs z-30 select-none touch-none overscroll-none">
      {/* Left: Brand Logo only (Branch name moved to Tiện ích) */}
      <div className="flex items-center gap-2 min-w-0">
        <Image
          src="/avora_logo_ngang.png"
          alt="AVORA POS"
          width={64}
          height={19}
          className="object-contain shrink-0"
          priority
        />
      </div>

      {/* Right: Connection Status & Notification Bell */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Realtime Connection Status */}
        {isOffline ? (
          <div className="flex items-center gap-1 text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 text-[10.5px] font-bold">
            <WifiOff size={13} />
            <span className="hidden xs:inline">Offline</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10.5px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <Wifi size={13} />
            <span className="hidden xs:inline text-[10px]">Online</span>
          </div>
        )}

        {/* Notification Bell */}
        <button
          type="button"
          onClick={openDrawer}
          className="relative p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl active:bg-slate-200 transition-colors cursor-pointer shrink-0"
          title="Thông báo phục vụ"
          aria-label="Thông báo phục vụ"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 bg-[#DA251D] text-white text-[8.5px] font-black flex items-center justify-center rounded-full border border-white shadow-xs animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
