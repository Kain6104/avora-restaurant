'use client';

import React, { useEffect, useState } from 'react';
import { X, History, RotateCcw, Clock, User, Eye, CheckCircle2, AlertCircle } from 'lucide-react';

interface PrintTemplateVersionItem {
  id: string;
  version: number;
  content: string;
  paperSize?: string;
  createdBy?: string;
  createdAt: string;
}

interface VersionHistoryDrawerProps {
  templateId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  templateId,
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const [versions, setVersions] = useState<PrintTemplateVersionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<PrintTemplateVersionItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && templateId) {
      fetchVersions();
    }
  }, [isOpen, templateId]);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/print-templates/${templateId}/versions`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setVersions(data.data || []);
      } else {
        setError(data.message || 'Không thể tải lịch sử phiên bản');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối khi tải lịch sử');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version: PrintTemplateVersionItem) => {
    const isConfirmed = window.confirm(
      `Bạn có chắc chắn muốn khôi phục về phiên bản v${version.version}? Hành động này sẽ tạo một phiên bản mới tiếp theo mang nội dung của bản v${version.version}.`,
    );
    if (!isConfirmed) return;

    setRestoringId(version.id);
    try {
      const res = await fetch(`/api/print-templates/${templateId}/restore-version/${version.id}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        onRestoreSuccess();
        onClose();
      } else {
        alert(data.message || 'Lỗi khi khôi phục phiên bản');
      }
    } catch (err: any) {
      alert(err.message || 'Không thể kết nối đến máy chủ');
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <History className="w-4 h-4 text-red-600" />
            <span>Lịch sử phiên bản mẫu in</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thông báo quy tắc Rollback */}
        <div className="p-3 bg-blue-50 border-b border-blue-100 text-blue-800 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            Khôi phục (Rollback) sẽ tự động tạo một phiên bản mới kế tiếp, bảo toàn 100% lịch sử cũ.
          </span>
        </div>

        {/* Danh sách các phiên bản */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Đang tải lịch sử phiên bản...</div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Chưa có lịch sử phiên bản</div>
          ) : (
            versions.map((ver, idx) => {
              const isCurrent = idx === 0;

              return (
                <div
                  key={ver.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCurrent
                      ? 'border-red-300 bg-red-50/30 shadow-2xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-black bg-slate-900 text-white rounded-md font-mono">
                        v{ver.version}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-600 text-white rounded">
                          Hiện tại
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      {new Date(ver.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-1.5 mb-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{ver.createdBy || 'Hệ thống'}</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {ver.paperSize || '80mm'}
                    </span>
                  </div>

                  {/* Nút thao tác */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setPreviewVersion(ver)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Xem nội dung</span>
                    </button>

                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleRestore(ver)}
                        disabled={restoringId === ver.id}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors shadow-2xs"
                      >
                        <RotateCcw className={`w-3 h-3 ${restoringId === ver.id ? 'animate-spin' : ''}`} />
                        <span>Khôi phục</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal xem trước nội dung snapshot */}
        {previewVersion && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl p-4 max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="font-bold text-sm text-slate-800">
                  Nội dung phiên bản v{previewVersion.version} ({previewVersion.paperSize})
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewVersion(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 my-2 bg-slate-50 rounded-xl border border-slate-200">
                <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap">
                  {previewVersion.content}
                </pre>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreviewVersion(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const v = previewVersion;
                    setPreviewVersion(null);
                    handleRestore(v);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  Khôi phục phiên bản này
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
