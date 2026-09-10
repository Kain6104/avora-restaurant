"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Monitor,
  Download,
  ExternalLink,
  ArrowRight,
  Printer,
  WifiOff,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Lock,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export const PosWebBlocker: React.FC = () => {
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  const handleLaunchDesktopApp = async () => {
    setIsLaunching(true);
    setLaunchMessage('Đang tạo mã đăng nhập 1 chạm và kết nối ứng dụng Desktop...');

    try {
      const res = await fetch('/api/auth/desktop/launch-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.code) {
        throw new Error(data.message || 'Không thể tạo mã ủy quyền SSO.');
      }

      const launchCode = data.code;
      const protocolUrl = `avora-pos://open?code=${encodeURIComponent(launchCode)}`;

      setLaunchMessage('Đang mở AVORA POS trên máy tính của bạn...');

      let appOpened = false;
      const onBlur = () => {
        appOpened = true;
      };
      window.addEventListener('blur', onBlur, { once: true });

      // Trigger custom protocol
      window.location.href = protocolUrl;

      setTimeout(() => {
        window.removeEventListener('blur', onBlur);
        setIsLaunching(false);
        if (!appOpened) {
          toast(
            'Nếu ứng dụng chưa mở, có thể bạn chưa cài đặt AVORA POS. Hãy tải bộ cài đặt bên dưới!',
            { icon: '💡', duration: 6000 }
          );
          setLaunchMessage(null);
        } else {
          setLaunchMessage('Đã mở ứng dụng AVORA POS thành công!');
        }
      }, 4000);
    } catch (err: any) {
      setIsLaunching(false);
      setLaunchMessage(null);
      toast.error(err.message || 'Không thể khởi động ứng dụng Desktop');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] text-slate-900 flex flex-col justify-between select-none relative overflow-x-hidden">
      {/* Subtle Warm Brand Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 max-w-[850px] w-full h-[380px] bg-gradient-to-b from-red-100/50 via-red-50/20 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-0 max-w-[450px] w-full h-[350px] bg-gradient-to-t from-red-50/40 to-transparent blur-2xl pointer-events-none -z-10" />

      {/* 1. Header Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between z-10 border-b border-slate-200/60">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-10 w-32 sm:w-36">
            <Image
              src="/avora_logo_ngang.png"
              alt="AVORA Restaurant"
              fill
              sizes="(max-width: 640px) 128px, 144px"
              className="object-contain"
              priority
            />
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[#da251d] text-xs font-bold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#da251d]" />
            <span>Chuyên Dụng Thu Ngân</span>
          </span>

          <Link
            href="/admin/dashboard"
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <span>Trang quản trị</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </header>

      {/* 2. Main Hero Card */}
      <main className="w-full max-w-4xl mx-auto px-6 py-8 sm:py-12 z-10 flex flex-col items-center text-center">
        {/* Glowing Icon Badge */}
        <div className="relative mb-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-red-500 to-[#da251d] text-white flex items-center justify-center shadow-xl shadow-red-500/25 border-4 border-white">
            <Monitor className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 border-2 border-white text-white flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Headlines */}
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight max-w-2xl leading-tight">
          AVORA POS đã chuyển sang ứng dụng{' '}
          <span className="bg-gradient-to-r from-[#da251d] to-red-600 bg-clip-text text-transparent">
            Windows Desktop
          </span>
        </h1>

        <p className="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed font-medium">
          Để đảm bảo tốc độ in hóa đơn tức thì qua <b>WinSpool RAW</b> không độ trễ, tự động kết nối két tiền thu ngân, bảo mật thiết bị quầy và hoạt động liên tục khi rớt mạng, hệ thống POS hiện hoạt động độc quyền trên ứng dụng <b>AVORA POS Desktop</b>.
        </p>

        {/* Primary Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-md justify-center">
          <button
            type="button"
            onClick={handleLaunchDesktopApp}
            disabled={isLaunching}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-[#da251d] hover:bg-red-700 active:bg-red-800 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-red-600/30 transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
          >
            <Monitor className="w-4.5 h-4.5" />
            <span>{isLaunching ? 'Đang mở ứng dụng...' : 'Mở AVORA POS Desktop'}</span>
          </button>

          <a
            href="/api/pos-desktop/update/download/latest"
            download="AVORA-POS-Setup.exe"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-red-50/60 border-2 border-red-200 hover:border-red-400 text-[#da251d] font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
          >
            <Download className="w-4.5 h-4.5 text-[#da251d]" />
            <span>Tải bộ cài đặt (.exe)</span>
          </a>
        </div>

        {launchMessage && (
          <p className="mt-3 text-xs font-bold text-red-600 animate-pulse">
            {launchMessage}
          </p>
        )}

        {/* 4 Feature Value Pillars */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center font-bold mb-3">
              <Zap className="w-4.5 h-4.5" />
            </div>
            <h4 className="text-xs font-black text-slate-900 mb-1">In nhiệt siêu tốc RAW</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              In trực tiếp tới máy in hóa đơn &amp; tem nhãn qua cổng Windows Spooler, không pop-up trình duyệt.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold mb-3">
              <WifiOff className="w-4.5 h-4.5" />
            </div>
            <h4 className="text-xs font-black text-slate-900 mb-1">Hoạt động ngoại tuyến</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Lưu trữ đơn hàng &amp; ca thu ngân trong SQLite cục bộ, tự động đồng bộ khi có kết nối trở lại.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-3">
              <Printer className="w-4.5 h-4.5" />
            </div>
            <h4 className="text-xs font-black text-slate-900 mb-1">Tự nhận diện máy in</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Tự động kết nối máy in XP-80C, Xprinter XP-350B, tự động phát xung mở két tiền thu ngân.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-3">
              <Lock className="w-4.5 h-4.5" />
            </div>
            <h4 className="text-xs font-black text-slate-900 mb-1">Bảo mật quầy thu ngân</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Mã hóa phiên làm việc cấp phần cứng DPAPI, chế độ toàn màn hình Kiosk chống rời ứng dụng ngoài ý muốn.
            </p>
          </div>
        </div>

        {/* Simple 3-step guide */}
        <div className="mt-10 p-4 rounded-2xl bg-red-50/60 border border-red-100 max-w-xl w-full flex items-center justify-around text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#da251d] text-white flex items-center justify-center text-[10px]">1</span>
            <span>Tải bộ cài đặt</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#da251d] text-white flex items-center justify-center text-[10px]">2</span>
            <span>Cài đặt 1 chạm</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#da251d] text-white flex items-center justify-center text-[10px]">3</span>
            <span>Bán hàng &amp; In bill</span>
          </div>
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 z-10">
        <p>© 2026 AVORA Restaurant Solutions. Bản quyền phần mềm điểm bán hàng.</p>
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="hover:text-[#da251d] transition-colors font-medium">
            Trang Quản Trị
          </Link>
          <span>•</span>
          <a
            href="/api/pos-desktop/update/download/latest"
            download="AVORA-POS-Setup.exe"
            className="hover:text-[#da251d] transition-colors font-medium flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            <span>Tải AVORA POS Setup</span>
          </a>
        </div>
      </footer>
    </div>
  );
};
