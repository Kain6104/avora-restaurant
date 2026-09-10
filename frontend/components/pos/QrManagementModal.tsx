"use client";

import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Printer,
  Copy,
  RotateCcw,
  Ban,
  CheckCircle2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { platformBridge } from '@/lib/platform/platform-bridge';
import { PosTable, PosBranch, PosOrder } from './pos-types';

interface QrManagementModalProps {
  table: PosTable;
  branch: PosBranch | null;
  order: PosOrder | null;
  onClose: () => void;
}

export const QrManagementModal: React.FC<QrManagementModalProps> = ({
  table,
  branch,
  order,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string>('ACTIVE');
  const [buffetPackageName, setBuffetPackageName] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchQrSession = async () => {
    if (!branch?.id || !table?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/qr-order/admin/tables/${table.id}/qr?branchId=${branch.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.data) {
        setQrToken(data.data.rawToken || null);
        setQrStatus(data.data.qrSession?.status || 'ACTIVE');

        // Check active buffet session of this order
        if (order?.id) {
          const buffetRes = await fetch(`/api/buffet/orders/${order.id}/session`, {
            credentials: 'include',
          });
          const buffetData = await buffetRes.json();
          if (buffetData.success && buffetData.data) {
            setBuffetPackageName(buffetData.data.packageNameSnapshot);
          }
        }
      } else {
        toast.error(data.message || 'Không thể tải phiên QR của bàn');
      }
    } catch (err) {
      toast.error('Lỗi khi tải thông tin mã QR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQrSession();
  }, [table.id, branch?.id, order?.id]);

  const qrUrl = qrToken && typeof window !== 'undefined'
    ? `${window.location.origin}/qr/${qrToken}`
    : '';

  const handleCopyLink = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      toast.success('Đã sao chép liên kết gọi món QR!');
    } catch (e) {
      toast.error('Không thể sao chép liên kết');
    }
  };

  const handleRegenerate = async () => {
    if (!order?.id) return;
    if (!confirm('Tạo lại mã QR sẽ lập tức vô hiệu hóa mã QR cũ. Bạn có chắc chắn muốn tạo lại?')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/qr-order/admin/tables/${table.id}/qr/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setQrToken(data.data.rawToken);
        setQrStatus('ACTIVE');
        toast.success('Đã tạo lại mã QR mới thành công!');
      } else {
        toast.error(data.message || 'Không thể tạo lại QR');
      }
    } catch (e) {
      toast.error('Lỗi khi tạo lại mã QR');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!order?.id) return;
    if (!confirm('Bạn có chắc chắn muốn vô hiệu hóa mã QR của bàn này?')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/qr-order/admin/tables/${table.id}/qr/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (data.success) {
        setQrStatus('DISABLED');
        toast.success('Đã vô hiệu hóa mã QR của bàn!');
      } else {
        toast.error(data.message || 'Không thể vô hiệu hóa');
      }
    } catch (e) {
      toast.error('Lỗi khi vô hiệu hóa mã QR');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintQr = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3 bg-gradient-to-r from-red-50 to-slate-50 border-b border-red-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#da251d] text-white flex items-center justify-center shadow-xs">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                QR Gọi Món – {table.name}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {branch?.name || 'Chi nhánh AVORA'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-white/80 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                Mã đơn hàng
              </span>
              <span className="text-xs font-black text-slate-800 font-mono">
                {order?.orderCode || 'Đang mở'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                Trạng thái QR
              </span>
              <span
                className={`text-xs font-black inline-flex items-center gap-1 ${
                  qrStatus === 'ACTIVE'
                    ? 'text-emerald-600'
                    : qrStatus === 'DISABLED'
                    ? 'text-rose-600'
                    : 'text-slate-500'
                }`}
              >
                {qrStatus === 'ACTIVE' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> ĐANG HOẠT ĐỘNG
                  </>
                ) : qrStatus === 'DISABLED' ? (
                  <>
                    <Ban className="w-3.5 h-3.5" /> ĐÃ TẠM KHÓA
                  </>
                ) : (
                  'ĐÃ ĐÓNG'
                )}
              </span>
            </div>
          </div>

          {/* Buffet Session Banner */}
          <div className="p-2.5 bg-amber-50/70 border border-amber-200/70 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <span className="text-amber-800 font-bold">Gói Buffet: </span>
                <span className="text-amber-950 font-black">
                  {buffetPackageName || 'Không sử dụng Buffet (Gọi món lẻ)'}
                </span>
              </div>
            </div>
          </div>

          {/* QR Code Canvas Card */}
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-inner">
            {loading ? (
              <div className="h-36 flex items-center justify-center text-xs text-slate-400 font-medium">
                Đang nạp mã QR...
              </div>
            ) : qrUrl ? (
              <>
                <div className="p-2.5 bg-white rounded-xl shadow-xs border border-slate-100 mb-2">
                  <QRCodeSVG
                    value={qrUrl}
                    size={160}
                    level="H"
                    includeMargin
                    imageSettings={{
                      src: '/avora_logo_ngang.png',
                      height: 28,
                      width: 28,
                      excavate: true,
                    }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 font-medium max-w-xs truncate">
                  {qrUrl}
                </div>
              </>
            ) : (
              <div className="h-36 flex items-center justify-center text-xs text-rose-500 font-medium">
                Chưa thể khởi tạo mã QR cho bàn này
              </div>
            )}
          </div>

          {/* Primary Action: Mở trang QR Order xem giao diện khách */}
          {qrUrl && (
            <button
              type="button"
              onClick={() => {
                if (platformBridge.isDesktop) {
                  platformBridge.openExternalBrowser(qrUrl);
                } else {
                  window.open(qrUrl, '_blank');
                }
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#da251d] hover:bg-[#b81d16] active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở trang gọi món QR (Xem giao diện khách hàng)</span>
            </button>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrintQr}
              className="py-2 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>In mã QR</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="py-2 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Sao chép link</span>
            </button>

            <button
              type="button"
              disabled={actionLoading}
              onClick={handleRegenerate}
              className="py-2 px-2.5 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>Tạo lại QR</span>
            </button>

            <button
              type="button"
              disabled={actionLoading || qrStatus === 'DISABLED'}
              onClick={handleDisable}
              className="py-2 px-2.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5 text-rose-600" />
              <span>Vô hiệu hóa QR</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium shrink-0">
          <span>Khách quét QR sẽ xem được thực đơn & gọi món</span>
          {qrUrl && (
            <a
              href={qrUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#da251d] font-bold flex items-center gap-1 hover:underline"
            >
              <span>Mở thử trang</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
