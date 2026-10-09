'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { farmEventBus } from '../../game/services/farmEventBus';

export interface GameToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'reward';
  message: string;
  subMessage?: string;
}

export default function GameToast() {
  const [toasts, setToasts] = useState<GameToastItem[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const unsub = farmEventBus.on('GAME_TOAST', (item: Omit<GameToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast = { ...item, id };
      queueMicrotask(() => {
        setToasts((prev) => [...prev.slice(-2), newToast]); // Giữ tối đa 3 toasts nhỏ gọn
      });

      const tId = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2600);
      timers.push(tId);
    });

    return () => {
      unsub();
      timers.forEach(clearTimeout);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-1 pointer-events-none w-auto max-w-[92vw] px-2 select-none">
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isReward = toast.type === 'reward';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm border ${
              isError
                ? 'bg-rose-50/95 border-rose-300 text-rose-900'
                : isReward
                ? 'bg-amber-50/95 border-amber-300 text-amber-950'
                : 'bg-white/95 border-amber-200/80 text-stone-800'
            }`}
          >
            {/* Ultra-compact Icon */}
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                isError
                  ? 'bg-rose-500 text-white'
                  : isReward
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {isError ? (
                <AlertCircle className="w-2.5 h-2.5" />
              ) : isReward ? (
                <Sparkles className="w-2.5 h-2.5" />
              ) : (
                <CheckCircle2 className="w-2.5 h-2.5" />
              )}
            </div>

            {/* Content */}
            <div className="flex items-center gap-1 text-[11px] font-bold leading-none font-sans whitespace-nowrap">
              <span>{toast.message}</span>
              {toast.subMessage && (
                <span className="text-[9.5px] opacity-70 font-normal hidden min-[400px]:inline">
                  • {toast.subMessage}
                </span>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="p-0.5 rounded-full hover:bg-black/5 text-stone-400 hover:text-stone-700 transition cursor-pointer ml-0.5"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
