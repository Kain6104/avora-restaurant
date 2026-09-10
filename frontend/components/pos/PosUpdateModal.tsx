'use client';

import React, { useState } from 'react';
import { Sparkles, Download, RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { platformBridge, UpdateManifestInfo } from '@/lib/platform/platform-bridge';
import { toast } from 'react-hot-toast';

interface PosUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: UpdateManifestInfo | null;
  currentVersion: string;
  isMandatory?: boolean;
  hasUnsavedChanges?: boolean;
}

export const PosUpdateModal: React.FC<PosUpdateModalProps> = ({
  isOpen,
  onClose,
  manifest,
  currentVersion,
  isMandatory = false,
  hasUnsavedChanges = false,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen || !manifest) return null;

  const handleStartUpdate = async () => {
    // Directive 73: Check safe update state before updating
    if (hasUnsavedChanges) {
      toast.error('AVORA POS đang có dữ liệu chưa hoàn tất. Vui lòng hoàn tất hoặc lưu đơn trước khi cập nhật.', {
        duration: 4000,
        id: 'unsafe-update-blocked',
      });
      return;
    }

    setIsDownloading(true);
    setStatusMessage('Đang kết nối và tải gói cài đặt cập nhật...');
    setDownloadProgress(25);

    try {
      if (platformBridge.downloadUpdate && platformBridge.applyUpdate) {
        setStatusMessage('Đang tải bản cập nhật...');
        setDownloadProgress(60);

        const res = await platformBridge.downloadUpdate(manifest);
        if (!res.success || !res.filePath) {
          throw new Error(res.error || 'Tải bản cập nhật thất bại.');
        }

        setStatusMessage('Xác thực chữ ký SHA-256 thành công. Đang khởi động tiến trình nâng cấp...');
        setDownloadProgress(100);

        await new Promise((r) => setTimeout(r, 1000));
        await platformBridge.applyUpdate(res.filePath);
      } else {
        // Web fallback: download directly
        window.open(manifest.downloadUrl, '_blank');
        toast.success('Đã mở liên kết tải gói cài đặt cập nhật.');
        setIsDownloading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi cập nhật phần mềm';
      toast.error(msg);
      setIsDownloading(false);
      setStatusMessage('');
      setDownloadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header with gradient branding */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#da251d] flex items-center justify-center shadow-lg shadow-red-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Cập nhật AVORA POS
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/30 text-red-200 border border-red-400/30">
                  {manifest.updateType === 'MANDATORY' ? 'Bắt buộc' : 'Bản mới'}
                </span>
              </h3>
              <p className="text-xs text-slate-300">Hệ thống bán hàng chuyên nghiệp cho nhà hàng</p>
            </div>
          </div>

          {!isMandatory && !isDownloading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Version comparison banner */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400">Phiên bản hiện tại</span>
              <div className="text-sm font-black text-slate-700">v{currentVersion}</div>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <div className="w-8 h-[2px] bg-slate-300"></div>
              <div className="text-xs font-bold text-[#da251d]">➔</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-600">Phiên bản mới</span>
              <div className="text-sm font-black text-emerald-700">v{manifest.version}</div>
            </div>
          </div>

          {/* Unsaved changes alert */}
          {hasUnsavedChanges && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed font-medium">
                Hệ thống phát hiện đang có đơn hàng hoặc thay đổi chưa hoàn tất. Vui lòng lưu đơn trước khi tiến hành cập nhật.
              </div>
            </div>
          )}

          {/* Release Notes */}
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2.5">
              Những cải tiến trong bản cập nhật này:
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-xs text-slate-600">
              {manifest.releaseNotes && manifest.releaseNotes.length > 0 ? (
                manifest.releaseNotes.map((note, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="leading-snug">{note}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 italic">Bản cập nhật bao gồm cải tiến hiệu năng và sửa lỗi hệ thống.</div>
              )}
            </div>
          </div>

          {/* Progress bar when downloading */}
          {isDownloading && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>{statusMessage}</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          {!isMandatory && !isDownloading && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cập nhật sau
            </button>
          )}

          <button
            type="button"
            onClick={handleStartUpdate}
            disabled={isDownloading || hasUnsavedChanges}
            className="px-5 py-2.5 text-xs font-black text-white bg-[#da251d] hover:bg-red-700 rounded-xl transition-all shadow-md shadow-red-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Đang xử lý nâng cấp...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Cập nhật ngay
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
