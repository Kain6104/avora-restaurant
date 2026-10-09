'use client';

import React, { useState } from 'react';
import { Share, PlusSquare, Smartphone, CheckCircle2, Sparkles, X } from 'lucide-react';

interface IOSFullscreenGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * IOSFullscreenGuideModal
 * Popup hướng dẫn kích hoạt Toàn Màn Hình 100% (PWA Web App) độc quyền cho thiết bị iOS / Safari.
 * Thiết kế phong cách Royal Ivory Glass + Đỏ AVORA #DA251D + Vàng Champagne.
 */
export default function IOSFullscreenGuideModal({
  isOpen,
  onClose,
}: IOSFullscreenGuideModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleConfirmClose = () => {
    if (dontShowAgain && typeof window !== 'undefined') {
      try {
        localStorage.setItem('avora_farm_seen_ios_fullscreen_guide', 'true');
      } catch {}
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-[7px] animate-in fade-in duration-200 select-none">
      {/* Background Radial Glow */}
      <div className="absolute w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(218,37,29,0.25)_0%,rgba(212,175,55,0.15)_50%,transparent_70%)] pointer-events-none blur-2xl" />

      <div
        className="relative w-full max-w-[420px] rounded-[26px] bg-gradient-to-b from-[#fffefc]/98 via-[#fdfbf7]/96 to-[#f8f5ee]/98 border border-[#d4af37]/60 shadow-[0_20px_50px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.8)_inset] p-4 sm:p-5 text-[#2d1b08] overflow-hidden"
        style={{
          boxShadow:
            '0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.85) inset, 0 1px 3px rgba(212,175,55,0.3)',
        }}
      >
        {/* Nút đóng góc phải */}
        <button
          onClick={handleConfirmClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-stone-200/70 hover:bg-stone-300 text-stone-600 active:scale-95 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 4 họa tiết góc hoàng gia */}
        <span className="absolute top-2 left-2.5 text-[9px] text-[#d4af37]/60">❖</span>
        <span className="absolute top-2 right-10 text-[9px] text-[#d4af37]/60">❖</span>
        <span className="absolute bottom-2 left-2.5 text-[9px] text-[#d4af37]/60">❖</span>
        <span className="absolute bottom-2 right-2.5 text-[9px] text-[#d4af37]/60">❖</span>

        {/* Header Huy Hiệu */}
        <div className="flex flex-col items-center text-center mb-3.5">
          <div className="relative mb-2">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#DA251D] to-[#b31b14] p-0.5 shadow-[0_6px_20px_rgba(218,37,29,0.35)] flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-gradient-to-b from-[#80120d] to-[#450906] flex items-center justify-center border border-amber-300/30">
                <Smartphone className="w-7 h-7 text-amber-300 drop-shadow-[0_2px_6px_rgba(255,215,0,0.5)]" />
              </div>
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-400 animate-pulse" />
          </div>

          <span className="text-[10px] font-black tracking-[0.2em] text-[#b31b14] uppercase">
            CHẾ ĐỘ NATIVE GAME APP
          </span>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-[#3b1d11]">
            Toàn Màn Hình 100% Trên iPhone
          </h2>
          <p className="text-[11.5px] text-stone-600 mt-0.5 max-w-[320px] leading-relaxed">
            Apple iOS Safari giới hạn nút phóng to trực tiếp. Hãy thêm vào Màn hình chính để chơi không viền mượt mà!
          </p>
        </div>

        {/* Các bước hướng dẫn */}
        <div className="space-y-2 mb-3.5">
          {/* Bước 1 */}
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/80 border border-amber-200/60 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
              <Share className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-stone-800">
                Bước 1: Bấm nút Chia sẻ <span className="font-mono text-blue-600">⎋</span>
              </div>
              <div className="text-[10.5px] text-stone-500">
                Ở thanh công cụ dưới đáy trình duyệt Safari
              </div>
            </div>
          </div>

          {/* Bước 2 */}
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/80 border border-amber-200/60 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
              <PlusSquare className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-stone-800">
                Bước 2: Chọn &quot;Thêm vào MH chính&quot; ➕
              </div>
              <div className="text-[10.5px] text-stone-500">
                Cuộn xuống menu tác vụ và bấm Thêm (Add)
              </div>
            </div>
          </div>

          {/* Bước 3 */}
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/80 border border-amber-200/60 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-stone-800">
                Bước 3: Mở icon AVORA Farm từ màn hình
              </div>
              <div className="text-[10.5px] text-stone-500">
                Trải nghiệm toàn màn hình 100% không thanh địa chỉ
              </div>
            </div>
          </div>
        </div>

        {/* Trạng thái hiện tại */}
        <div className="flex items-center justify-center gap-1.5 py-1 px-3 mb-3 rounded-full bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-[10.5px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>Đã tự động thu gọn thanh duyệt web Safari</span>
        </div>

        {/* Checkbox không nhắc lại */}
        <label className="flex items-center justify-center gap-2 mb-3.5 cursor-pointer text-[11px] text-stone-500 select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-stone-300 text-[#DA251D] focus:ring-[#DA251D]/30"
          />
          <span>Không hiển thị lại hướng dẫn này</span>
        </label>

        {/* Nút CTA Chính */}
        <button
          onClick={handleConfirmClose}
          className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#DA251D] via-[#e52d24] to-[#b31b14] hover:brightness-105 active:scale-[0.98] border border-amber-300/60 text-amber-50 font-bold text-sm tracking-wide shadow-[0_6px_20px_rgba(218,37,29,0.3)] transition-all flex items-center justify-center cursor-pointer"
        >
          ĐÃ HIỂU, TIẾP TỤC CHĂM SÓC
        </button>
      </div>
    </div>
  );
}
