"use client";

import React from 'react';
import { ShieldAlert, Layers, PlayCircle, XCircle, CheckCircle2, Lock } from 'lucide-react';
import { platformBridge } from '@/lib/platform/platform-bridge';

interface PosConcurrencyLockModalProps {
  isOpen: boolean;
  onResumeHere: () => void;
  onCloseTab?: () => void;
}

export const PosConcurrencyLockModal: React.FC<PosConcurrencyLockModalProps> = ({
  isOpen,
  onResumeHere,
  onCloseTab,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 select-none p-4">
      {/* Ambient background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card - Sáng Đỏ Trắng Luxury Theme */}
      <div className="relative w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl shadow-2xl shadow-red-950/20 overflow-hidden text-center p-8 sm:p-10 border-t-4 border-t-[#da251d]">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200/60 rounded-full text-xs font-bold text-[#da251d] mb-6">
          <Lock className="w-3.5 h-3.5" />
          <span>Phiên làm việc POS được bảo vệ</span>
        </div>

        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-red-100 to-amber-50 border border-red-200/80 flex items-center justify-center mb-6 shadow-md shadow-red-500/10">
          <Layers className="w-10 h-10 text-[#da251d]" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
          POS Đang Mở Ở Cửa Sổ Khác
        </h2>

        {/* Description */}
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          Hệ thống phát hiện một cửa sổ hoặc tab POS khác vừa chiếm quyền điều khiển thiết bị bán hàng này. Để tránh xung đột số lượng món và đơn in trùng lặp, tab này đã tạm dừng tương tác.
        </p>

        {/* Notice Info Box */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left mb-8 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-800">Dữ liệu an toàn:</span> Mọi thao tác lưu nháp và hóa đơn của bạn không bị mất. Bạn có thể giành lại quyền điều khiển bất kỳ lúc nào bằng nút bên dưới.
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onResumeHere}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-[#da251d] via-[#e53935] to-[#c21f18] hover:from-[#b81d16] hover:to-[#9a1812] text-white font-bold text-sm rounded-xl shadow-lg shadow-red-600/25 hover:shadow-red-600/35 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
          >
            <PlayCircle className="w-4 h-4 text-white" />
            <span>Tiếp tục làm việc tại đây</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onCloseTab) {
                onCloseTab();
              } else if (platformBridge.isDesktop) {
                platformBridge.openExternalBrowser('/admin/dashboard');
              } else if (typeof window !== 'undefined') {
                window.location.href = '/admin/dashboard';
              }
            }}
            className="w-full sm:w-auto px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer select-none shadow-xs"
          >
            <XCircle className="w-4 h-4 text-slate-400" />
            <span>Đóng tab này</span>
          </button>
        </div>
      </div>
    </div>
  );
};
