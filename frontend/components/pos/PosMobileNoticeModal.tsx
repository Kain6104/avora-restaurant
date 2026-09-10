"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, Smartphone, ArrowRight, UtensilsCrossed, ShieldAlert, LayoutDashboard } from 'lucide-react';
import { platformBridge } from '@/lib/platform/platform-bridge';

interface PosMobileNoticeModalProps {
  isOpen: boolean;
}

export const PosMobileNoticeModal: React.FC<PosMobileNoticeModalProps> = ({
  isOpen,
}) => {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 select-none animate-in fade-in duration-300">
      {/* Ambient background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card - Sáng Đỏ Trắng Luxury Theme */}
      <div className="relative w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-red-950/20 overflow-hidden border-t-4 border-t-[#da251d]">
        {/* Decorative Brand Logo Watermark */}
        <div className="absolute top-3 right-4 text-[10px] font-black tracking-widest text-slate-300 select-none uppercase font-mono">
          AVORA RESTAURANT
        </div>

        {/* Visual Device Indicator */}
        <div className="relative mx-auto w-24 h-20 mb-6 flex items-center justify-center">
          <div className="relative flex items-center justify-center gap-3">
            {/* Mobile Icon (Dimmed) */}
            <div className="w-10 h-15 rounded-xl bg-slate-100 border border-slate-300 flex flex-col items-center justify-between p-1 opacity-70">
              <div className="w-4 h-1 bg-slate-400 rounded-full mt-0.5" />
              <Smartphone className="w-5 h-5 text-slate-500" />
              <div className="w-2 h-2 rounded-full border border-slate-400" />
            </div>

            <ArrowRight className="w-5 h-5 text-[#da251d] animate-pulse" />

            {/* Desktop / Large Tablet Icon (Radiant Red Accent) */}
            <div className="w-16 h-12 rounded-xl bg-red-50 border-2 border-red-200 flex flex-col items-center justify-center shadow-md shadow-red-500/15">
              <Monitor className="w-7 h-7 text-[#da251d]" />
            </div>
          </div>
        </div>

        {/* Small Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[#da251d] text-[11px] font-mono font-bold tracking-wide uppercase mb-3">
          <ShieldAlert className="w-3.5 h-3.5 text-[#da251d]" />
          YÊU CẦU THIẾT BỊ MÀN HÌNH LỚN
        </div>

        {/* Heading */}
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-3">
          Giao diện POS Thu Ngân
        </h2>

        {/* Required message */}
        <p className="text-sm text-slate-700 font-semibold leading-relaxed mb-4">
          Giao diện thu ngân POS yêu cầu thiết bị màn hình lớn (Desktop/Tablet ngang) để hoạt động ổn định nhất.
        </p>

        {/* Subtext info */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs leading-relaxed mb-6 text-left shadow-xs">
          Đối với nhân viên order và phục vụ bàn trên điện thoại di động, vui lòng sử dụng ứng dụng chuyên dụng <span className="text-[#da251d] font-bold">AVORA Waiter</span> để có trải nghiệm thao tác tốt nhất.
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/pos/waiter')}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-[#da251d] via-[#e53935] to-[#c21f18] hover:from-[#b81d16] hover:to-[#9a1812] text-white font-bold text-sm rounded-xl shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 cursor-pointer select-none active:scale-98 transition-all"
          >
            <UtensilsCrossed className="w-4 h-4 text-white" />
            <span>Đến trang Order Phục Vụ</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (platformBridge.isDesktop) {
                platformBridge.openExternalBrowser('/admin/dashboard');
              } else {
                router.push('/admin/dashboard');
              }
            }}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer select-none transition-all shadow-xs"
          >
            <LayoutDashboard className="w-4 h-4 text-slate-400" />
            <span>Về Trang Quản Trị</span>
          </button>
        </div>
      </div>
    </div>
  );
};
