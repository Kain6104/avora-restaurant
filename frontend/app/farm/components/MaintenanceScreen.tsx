'use client';

import React from 'react';
import Link from 'next/link';
import { Hammer, Clock, ArrowLeft, ShieldAlert } from 'lucide-react';

interface MaintenanceScreenProps {
  message?: string;
  estimatedEndTime?: string | null;
}

export default function MaintenanceScreen({ message, estimatedEndTime }: MaintenanceScreenProps) {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center p-6 bg-[#0e1712] text-white select-none">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.1)_0%,transparent_70%)] pointer-events-none" />

      {/* Back button */}
      <div className="absolute top-6 left-6 z-10">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-xs font-semibold text-slate-200 transition-all cursor-pointer shadow-lg active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại AVORA</span>
        </Link>
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-6 flex flex-col items-center">
        {/* Animated Icon */}
        <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.2)]">
          <Hammer className="w-10 h-10 animate-bounce" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/40 border border-amber-500/30 text-[11px] font-bold text-amber-300 uppercase tracking-wide">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Nâng Cấp Định Kỳ</span>
          </div>
          <h1 className="text-2xl font-black text-amber-100 tracking-tight">
            Nông Trại Đang Bảo Trì
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
            {message ||
              'Khu vườn AVORA Farm đang được các nghệ nhân chăm sóc nâng cấp để mang đến trải nghiệm tuyệt vời nhất. Quý khách vui lòng trở lại sau ít phút!'}
          </p>
        </div>

        {/* Estimated Time if provided */}
        {estimatedEndTime && (
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.05] border border-white/10 text-xs text-amber-200 font-mono">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Dự kiến mở lại: {new Date(estimatedEndTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 font-bold text-xs text-white shadow-xl shadow-amber-900/30 transition-all active:scale-95 cursor-pointer"
          >
            <span>Khám phá Thực đơn AVORA</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
