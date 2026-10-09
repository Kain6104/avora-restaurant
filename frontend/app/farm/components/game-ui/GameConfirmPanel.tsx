'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';

interface GameConfirmPanelProps {
  isOpen: boolean;
  message: string;
  subMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function GameConfirmPanel({
  isOpen,
  message,
  subMessage,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy bỏ',
  onConfirm,
  onCancel,
}: GameConfirmPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-3xl bg-[#fffdfa]/98 border-2 border-[#e0a93b] shadow-[0_12px_40px_rgba(70,45,15,0.35)] p-5 flex flex-col items-center text-center gap-3 text-[#3e2723] animate-in zoom-in-95 duration-180">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-inner">
          <HelpCircle className="w-7 h-7" />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm sm:text-base font-black font-serif">
            {message}
          </span>
          {subMessage && (
            <span className="text-xs text-stone-500 font-medium">
              {subMessage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full pt-2">
          <button
            onClick={() => {
              farmSound.playTap();
              onCancel();
            }}
            className="flex-1 py-2.5 rounded-2xl border-2 border-stone-200 hover:bg-stone-100 text-stone-700 font-bold text-xs transition-all active:scale-95 cursor-pointer"
          >
            {cancelLabel}
          </button>

          <button
            onClick={() => {
              farmSound.playTap();
              onConfirm();
            }}
            className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 hover:from-amber-400 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
