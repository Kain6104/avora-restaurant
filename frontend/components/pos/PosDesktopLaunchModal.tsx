"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Download,
  RefreshCw,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { platformBridge } from '@/lib/platform/platform-bridge';

interface PosDesktopLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LaunchStatus = 'PREPARING' | 'LAUNCHING' | 'TIMEOUT' | 'ERROR';

export const PosDesktopLaunchModal: React.FC<PosDesktopLaunchModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [status, setStatus] = useState<LaunchStatus>('PREPARING');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startLaunchFlow = async () => {
    setStatus('PREPARING');
    setErrorMessage('');

    try {
      // 1. Request single-use SSO launch code from backend
      const res = await fetch('/api/auth/desktop/launch-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('ERROR');
        setErrorMessage(
          data.message || 'Tài khoản của bạn không có quyền sử dụng AVORA POS Desktop.',
        );
        return;
      }

      const launchCode = data.code;
      if (!launchCode) {
        setStatus('ERROR');
        setErrorMessage('Không nhận được mã ủy quyền SSO từ máy chủ.');
        return;
      }

      // 2. Call custom protocol: avora-pos://open?code=<urlEncodedCode>
      setStatus('LAUNCHING');
      const protocolUrl = `avora-pos://open?code=${encodeURIComponent(launchCode)}`;

      // Listen for window blur event: if the desktop app takes focus, the browser window blurs
      let appDetected = false;
      const onBlur = () => {
        appDetected = true;
      };
      window.addEventListener('blur', onBlur, { once: true });

      // Trigger OS protocol handler
      window.location.href = protocolUrl;

      // 3. Fallback timer (3.5 seconds): if browser window didn't blur or app is not installed
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = setTimeout(() => {
        window.removeEventListener('blur', onBlur);
        if (!appDetected) {
          setStatus('TIMEOUT');
        }
      }, 3500);
    } catch (err: any) {
      setStatus('ERROR');
      setErrorMessage(err.message || 'Lỗi kết nối máy chủ khi khởi tạo SSO.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      startLaunchFlow();
    } else {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    }
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with AVORA Red accent line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#DA251D] via-red-500 to-amber-500" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 text-center">
          {/* Status Icon */}
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center shadow-xs">
            {status === 'PREPARING' && (
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-[#DA251D] animate-spin" />
              </div>
            )}

            {status === 'LAUNCHING' && (
              <div className="relative w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                <Monitor className="w-8 h-8 text-[#DA251D] animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#DA251D]"></span>
                </span>
              </div>
            )}

            {status === 'TIMEOUT' && (
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Monitor className="w-8 h-8 text-amber-600" />
              </div>
            )}

            {status === 'ERROR' && (
              <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-rose-600" />
              </div>
            )}
          </div>

          {/* Titles & Messages */}
          {status === 'PREPARING' && (
            <>
              <h3 className="text-lg font-black text-slate-800 mb-1">
                Đang chuẩn bị phiên làm việc...
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Hệ thống đang tạo mã xác thực SSO một lần an toàn (TTL 60s) để mở AVORA POS Desktop.
              </p>
            </>
          )}

          {status === 'LAUNCHING' && (
            <>
              <h3 className="text-lg font-black text-slate-800 mb-1">
                Đang mở AVORA POS Desktop...
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Vui lòng xác nhận thông báo của trình duyệt nếu có yêu cầu mở ứng dụng <strong className="text-slate-700 font-semibold">AVORA POS</strong>.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6 text-left flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Tài khoản của bạn sẽ được đăng nhập tự động trên ứng dụng máy tính mà không cần nhập lại mật khẩu.
                </p>
              </div>
            </>
          )}

          {status === 'TIMEOUT' && (
            <>
              <h3 className="text-lg font-black text-slate-800 mb-1">
                Không thể mở AVORA POS Desktop
              </h3>
              <p className="text-xs text-slate-500 mb-5">
                Ứng dụng chưa được mở hoặc chưa được cài đặt trên thiết bị của bạn.
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-2.5 mb-4">
                <button
                  type="button"
                  onClick={startLaunchFlow}
                  className="w-full h-11 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Thử mở lại ứng dụng</span>
                </button>

                <a
                  href="/api/pos-desktop/update/download"
                  download="AVORA-POS-Setup.exe"
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải AVORA POS Desktop (.exe)</span>
                </a>
              </div>
            </>
          )}

          {status === 'ERROR' && (
            <>
              <h3 className="text-lg font-black text-rose-700 mb-1">
                Xác thực không thành công
              </h3>
              <p className="text-xs text-slate-600 bg-rose-50 border border-rose-200 rounded-xl p-3.5 mb-5 text-left leading-relaxed">
                {errorMessage}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startLaunchFlow}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Thử lại
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-10 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </>
          )}

          {/* Footer note */}
          {(status === 'LAUNCHING' || status === 'TIMEOUT') && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>AVORA POS Desktop v1.0.1</span>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Tiếp tục dùng trên Web
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
