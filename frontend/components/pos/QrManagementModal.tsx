"use client";

import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Printer,
  Copy,
  RotateCcw,
  Ban,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Download,
  Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { PosTable, PosBranch, PosOrder } from './pos-types';

interface QrManagementModalProps {
  table: PosTable;
  branch: PosBranch | null;
  order: PosOrder | null;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const QrManagementModal: React.FC<QrManagementModalProps> = ({
  table,
  branch,
  order,
  onClose,
  isDarkMode = false,
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

  // URL QR tự động theo domain hiện tại
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = qrToken && origin ? `${origin}/qr/${qrToken}` : '';

  const handleCopyLink = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      toast.success('Đã sao chép liên kết gọi món QR!');
    } catch (e) {
      toast.error('Không thể sao chép liên kết');
    }
  };

  const handleOpenCustomerPage = () => {
    if (!qrUrl) {
      toast.error('Chưa có liên kết gọi món QR');
      return;
    }
    window.open(qrUrl, '_blank');
  };

  const handleDownloadQr = () => {
    const svg = document.getElementById('pos-qr-svg');
    if (!svg) {
      toast.error('Không tìm thấy ảnh mã QR để tải');
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR-${table.name || 'Table'}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      toast.success('Đã tải hình mã QR!');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleRegenerate = async () => {
    if (!order?.id) return;
    if (!confirm('Tạo lại mã QR sẽ vô hiệu hóa mã cũ. Tiếp tục?')) return;
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
    if (!confirm('Bạn có chắc chắn muốn vô hiệu hóa mã QR của bàn này?')) return;
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
    <ResponsiveModal
      isOpen={true}
      onClose={onClose}
      title={`QR Gọi Món – ${table.name}`}
      subtitle={branch?.name ? `${branch.name} • Quét xem menu và gọi món` : 'Khách quét QR để xem menu và gọi món'}
      icon={<QrCode size={18} className="text-[#DA251D]" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          <span className="font-bold text-slate-500">
            {table.name}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      }
    >
      <div className="space-y-3 py-1">
        {/* Metadata Cards */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">
              Mã đơn hàng
            </span>
            <span className="text-xs font-black text-slate-800 font-mono truncate block">
              {order?.orderCode || 'Đang mở'}
            </span>
          </div>

          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">
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
                  <CheckCircle2 size={13} /> Hoạt động
                </>
              ) : qrStatus === 'DISABLED' ? (
                <>
                  <Ban size={13} /> Tạm khóa
                </>
              ) : (
                'Đã đóng'
              )}
            </span>
          </div>
        </div>

        {/* Buffet Session Banner */}
        {buffetPackageName && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-600 shrink-0" />
              <div className="text-xs">
                <span className="text-amber-800 font-bold">Gói Buffet: </span>
                <span className="text-amber-950 font-black">{buffetPackageName}</span>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Canvas Card */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-xs text-slate-400 font-medium">
              <Loader2 size={24} className="animate-spin text-[#DA251D]" />
              <span>Đang nạp mã QR...</span>
            </div>
          ) : qrUrl ? (
            <>
              <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-100 mb-2">
                <QRCodeSVG
                  id="pos-qr-svg"
                  value={qrUrl}
                  size={170}
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
              <div className="text-[11px] text-slate-500 font-mono font-medium max-w-full truncate px-2 select-all">
                {qrUrl}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-rose-500 font-medium">
              Chưa thể khởi tạo mã QR cho bàn này
            </div>
          )}
        </div>

        {/* Primary Action Button: Mở trang gọi món */}
        {qrUrl && (
          <button
            type="button"
            onClick={handleOpenCustomerPage}
            className="w-full py-2.5 px-3 bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <ExternalLink size={15} />
            <span>Mở trang gọi món (Tab mới)</span>
          </button>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={!qrUrl}
            className="py-2 px-2.5 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Copy size={13} />
            <span>Sao chép link</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={!qrUrl}
            className="py-2 px-2.5 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Download size={13} />
            <span>Tải ảnh QR</span>
          </button>

          <button
            type="button"
            onClick={handlePrintQr}
            disabled={!qrUrl}
            className="py-2 px-2.5 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Printer size={13} />
            <span>In phiếu QR</span>
          </button>

          <button
            type="button"
            onClick={handleRegenerate}
            disabled={actionLoading || !order?.id}
            className="py-2 px-2.5 bg-amber-50 hover:bg-amber-100 active:scale-95 border border-amber-200 text-amber-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={13} />
            <span>Tạo lại QR</span>
          </button>
        </div>

        {/* Disable Button */}
        {order?.id && qrStatus === 'ACTIVE' && (
          <button
            type="button"
            onClick={handleDisable}
            disabled={actionLoading}
            className="w-full py-1.5 text-center text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
          >
            Tạm khóa mã QR này
          </button>
        )}
      </div>
    </ResponsiveModal>
  );
};
