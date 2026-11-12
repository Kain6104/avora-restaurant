"use client";

import React, { useEffect } from 'react';
import { Power, AlertTriangle, X } from 'lucide-react';

interface PosExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isExiting?: boolean;
  isDarkMode?: boolean;
}

export const PosExitConfirmModal: React.FC<PosExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isExiting = false,
  isDarkMode = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !isExiting) {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExiting, onClose, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div
        className={`relative w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden select-none animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Close Button */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-2 text-red-600">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold ${
              isDarkMode ? 'bg-red-950/50 text-red-400' : 'bg-red-100 text-[#da251d]'
            }`}>
              <Power className="w-5 h-5 text-[#da251d]" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-[#da251d]">
              AVORA POS
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isExiting}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
              isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4 space-y-3">
          <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Xác nhận đóng ứng dụng AVORA POS?
          </h3>
          <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Bạn có chắc chắn muốn thoát khỏi ứng dụng không? Toàn bộ giao diện bán hàng sẽ đóng và kết thúc phiên làm việc trên máy tính thu ngân này.
          </p>

          <div className={`p-3 rounded-2xl flex items-start gap-2.5 text-[11px] font-medium border ${
            isDarkMode
              ? 'bg-amber-950/40 border-amber-900/60 text-amber-300'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Lưu ý: Hãy đảm bảo các đơn hàng đã được lưu hoặc gửi bếp, ca làm việc đã được kiểm đếm trước khi đóng ứng dụng.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`p-5 border-t flex items-center justify-end gap-3 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <button
            type="button"
            onClick={onClose}
            disabled={isExiting}
            className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 ${
              isDarkMode
                ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
            }`}
          >
            Hủy / Quay lại (Esc)
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isExiting}
            className="px-5 py-2.5 rounded-xl bg-[#da251d] hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-red-600/20 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Power className={`w-4 h-4 ${isExiting ? 'animate-spin' : ''}`} />
            <span>{isExiting ? 'Đang đóng ứng dụng...' : 'Đóng ứng dụng (Enter)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
