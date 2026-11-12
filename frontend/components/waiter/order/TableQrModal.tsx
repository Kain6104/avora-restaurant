'use client';

import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Copy,
  ExternalLink,
  Printer,
  RotateCcw,
  Ban,
  CheckCircle2,
  Sparkles,
  Loader2,
  Download,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import ResponsiveModal from '@/components/ui/ResponsiveModal';

interface TableQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  tableCode?: string;
  tableId: string;
  branchId?: string;
  orderId?: string;
}

export default function TableQrModal({
  isOpen,
  onClose,
  tableName,
  tableCode,
  tableId,
  branchId,
  orderId,
}: TableQrModalProps) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string>('ACTIVE');
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [buffetPackageName, setBuffetPackageName] = useState<string | null>(null);

  const fetchQrSession = async () => {
    if (!isOpen || !tableId) return;
    setLoading(true);
    try {
      const url = branchId
        ? `/api/qr-order/admin/tables/${tableId}/qr?branchId=${branchId}`
        : `/api/qr-order/admin/tables/${tableId}/qr`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();

      if (data.success && data.data) {
        setQrToken(data.data.rawToken || null);
        setQrStatus(data.data.qrSession?.status || 'ACTIVE');
        if (data.data.order?.orderCode || data.data.order?.temporaryOrderCode) {
          setOrderCode(data.data.order?.orderCode || data.data.order?.temporaryOrderCode);
        }

        // Check active buffet session for this order
        const targetOrderId = orderId || data.data.order?.id;
        if (targetOrderId) {
          try {
            const buffetRes = await fetch(`/api/buffet/orders/${targetOrderId}/session`, {
              credentials: 'include',
            });
            const buffetData = await buffetRes.json();
            if (buffetData.success && buffetData.data) {
              setBuffetPackageName(buffetData.data.packageNameSnapshot);
            } else {
              setBuffetPackageName(null);
            }
          } catch {
            setBuffetPackageName(null);
          }
        }
      } else {
        toast.error(data.message || 'Không thể tải phiên QR của bàn');
      }
    } catch {
      toast.error('Lỗi khi kết nối tải mã QR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQrSession();
    }
  }, [isOpen, tableId, branchId, orderId]);

  // URL QR tự động resolve theo public origin hiện tại
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = qrToken && origin ? `${origin}/qr/${qrToken}` : '';

  const handleCopyLink = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      toast.success('Đã sao chép liên kết gọi món QR!');
    } catch {
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadQr = () => {
    const svg = document.getElementById('table-qr-svg');
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
      downloadLink.download = `QR-${tableName || 'Table'}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      toast.success('Đã tải hình mã QR!');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleRegenerate = async () => {
    if (!orderId) {
      toast.error('Không tìm thấy mã đơn hàng để tạo lại');
      return;
    }
    if (!confirm('Tạo lại mã QR sẽ vô hiệu hóa mã cũ. Tiếp tục?')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/qr-order/admin/tables/${tableId}/qr/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setQrToken(data.data.rawToken);
        setQrStatus('ACTIVE');
        toast.success('Đã tạo lại mã QR mới thành công!');
      } else {
        toast.error(data.message || 'Không thể tạo lại QR');
      }
    } catch {
      toast.error('Lỗi khi tạo lại mã QR');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!orderId) {
      toast.error('Không tìm thấy mã đơn hàng');
      return;
    }
    if (!confirm('Bạn có chắc chắn muốn tạm khóa mã QR của bàn này?')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/qr-order/admin/tables/${tableId}/qr/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        setQrStatus('DISABLED');
        toast.success('Đã tạm khóa mã QR của bàn!');
      } else {
        toast.error(data.message || 'Không thể khóa mã QR');
      }
    } catch {
      toast.error('Lỗi khi khóa mã QR');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      title={`QR Gọi Món – ${tableName}`}
      subtitle={tableCode ? `Mã bàn: ${tableCode}` : 'Khách quét QR để xem thực đơn & gửi món'}
      icon={<QrCode size={18} className="text-[#DA251D]" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          <span className="font-bold text-slate-500">
            {tableCode ? `${tableName} (${tableCode})` : tableName}
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
        {/* Status chips */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">
              Mã đơn hàng
            </span>
            <span className="font-mono font-bold text-slate-800 truncate block text-xs">
              {orderCode || (orderId ? `TMP-${orderId.slice(0, 8).toUpperCase()}` : 'Đang mở')}
            </span>
          </div>

          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">
              Trạng thái QR
            </span>
            <span
              className={`font-black text-xs inline-flex items-center gap-1 ${
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

        {/* Active Buffet Session Banner */}
        {buffetPackageName && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs">
            <Sparkles size={14} className="text-amber-600 shrink-0" />
            <div className="truncate">
              <span className="text-amber-800 font-bold">Gói Buffet: </span>
              <span className="text-amber-950 font-black">{buffetPackageName}</span>
            </div>
          </div>
        )}

        {/* QR Box Canvas */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 font-medium">
              <Loader2 size={24} className="animate-spin text-[#DA251D]" />
              <span>Đang tạo mã QR gọi món...</span>
            </div>
          ) : qrUrl ? (
            <>
              <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-100 mb-2">
                <QRCodeSVG
                  id="table-qr-svg"
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
            <div className="h-40 flex flex-col items-center justify-center text-xs text-rose-600 font-semibold">
              <span>Chưa thể tải mã QR cho bàn này</span>
              <span className="text-[10px] text-slate-400 font-normal mt-1">
                Đảm bảo bàn đã có đơn hàng mở
              </span>
            </div>
          )}
        </div>

        {/* Primary Action Button: Mở trang gọi món QR */}
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

        {/* Action Buttons Grid */}
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
            onClick={handlePrint}
            disabled={!qrUrl}
            className="py-2 px-2.5 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Printer size={13} />
            <span>In phiếu QR</span>
          </button>

          <button
            type="button"
            onClick={handleRegenerate}
            disabled={actionLoading || !orderId}
            className="py-2 px-2.5 bg-amber-50 hover:bg-amber-100 active:scale-95 border border-amber-200 text-amber-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={13} />
            <span>Tạo lại QR</span>
          </button>
        </div>

        {/* Disable Button */}
        {orderId && qrStatus === 'ACTIVE' && (
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
}
