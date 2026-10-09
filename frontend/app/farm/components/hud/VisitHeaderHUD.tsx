'use client';

import React from 'react';
import { ArrowLeft, Hand, Shield, Users } from 'lucide-react';

interface VisitHeaderHUDProps {
  visitingState: {
    user: {
      id: string;
      fullName?: string;
      avatarUrl?: string;
      memberCode?: string;
    };
    level?: number;
    treeLevel?: number;
    isFriend?: boolean;
    remainingSteals?: number;
    dailyStealsMax?: number;
    dailyStealsUsed?: number;
  };
  onBack: () => void;
}

export default function VisitHeaderHUD({ visitingState, onBack }: VisitHeaderHUDProps) {
  const user = visitingState?.user;
  const isFriend = !!visitingState?.isFriend;
  const level = visitingState?.level ?? 1;
  const treeLevel = visitingState?.treeLevel ?? 1;

  const maxSteals = visitingState?.dailyStealsMax ?? (isFriend ? 10 : 3);
  const usedSteals = visitingState?.dailyStealsUsed ?? 0;
  const remainingSteals = visitingState?.remainingSteals ?? Math.max(0, maxSteals - usedSteals);

  return (
    <header className="fixed top-2.5 left-2.5 right-2.5 sm:top-4 sm:left-5 sm:right-5 z-40 flex items-center justify-between pointer-events-none select-none">
      {/* Cụm Bên Trái: Nút Quay Về & Thẻ Thông Tin Chủ Vườn */}
      <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
        {/* Nút quay về vườn của tôi */}
        <button
          onClick={onBack}
          id="btn-exit-visit-mode"
          className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-stone-900/85 hover:bg-stone-900 text-amber-300 hover:text-amber-200 border border-amber-500/40 shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all active:scale-95 group font-bold text-xs sm:text-sm"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="hidden sm:inline">Về vườn của tôi</span>
          <span className="sm:hidden">Về vườn</span>
        </button>

        {/* Thông tin chủ trang trại đang ghé thăm */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-amber-950/75 border border-amber-500/30 backdrop-blur-md shadow-lg">
          <div className="relative">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName || 'Bạn bè'}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-amber-400/80 shadow"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-600 text-amber-100 flex items-center justify-center font-bold text-sm border-2 border-amber-400/80 shadow">
                {(user?.fullName || 'B')[0].toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full bg-amber-500 text-stone-950 font-black text-[9px] shadow leading-tight">
              {level}
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-amber-100 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[180px]">
                {user?.fullName || 'Nông Trại Bạn Bè'}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                  isFriend
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                    : 'bg-stone-800/80 text-stone-300 border-stone-600/40'
                }`}
              >
                {isFriend ? 'Bạn bè' : 'Người lạ'}
              </span>
            </div>
            <span className="text-[10px] text-amber-300/80 font-medium">
              Cây thần AVORA Lv.{treeLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Cụm Bên Phải: Đếm Lượt Trộm Hôm Nay */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-purple-950/80 border border-purple-400/50 backdrop-blur-md shadow-[0_4px_16px_rgba(124,58,237,0.3)]">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs shadow">
            🖐️
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] uppercase tracking-wider font-bold text-purple-300">
              Lượt trộm hôm nay
            </span>
            <span className="text-xs sm:text-sm font-black text-amber-300">
              {remainingSteals} <span className="text-purple-300/70 font-normal">/ {maxSteals}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
