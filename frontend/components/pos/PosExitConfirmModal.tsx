"use client";

import React, { useEffect } from 'react';
import { Power, AlertTriangle, X } from 'lucide-react';

interface PosExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isExiting?: boolean;
}

export const PosExitConfirmModal: React.FC<PosExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isExiting = false,
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
    <div className="fixed inset-0 z-99999 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden select-none animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Close Button */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-2 text-red-600">
            <div className="w-9 h-9 rounded-2xl bg-red-100 flex items-center justify-center font-bold">
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
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4 space-y-3">
          <h3 className="text-lg font-black text-slate-900">
            Xác nhận đóng ứng dụng AVORA POS?
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Bạn có chắc chắn muốn thoát khỏi ứng dụng không? Toàn bộ giao diện bán hàng sẽ đóng và kết thúc phiên làm việc trên máy tính thu ngân này.
          </p>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-[11px] text-amber-800 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Lưu ý: Hãy đảm bảo các đơn hàng đã được lưu hoặc gửi bếp, ca làm việc đã được kiểm đếm trước khi đóng ứng dụng.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExiting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
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
