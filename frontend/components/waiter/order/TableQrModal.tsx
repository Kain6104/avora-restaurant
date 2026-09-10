'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Copy,
  ExternalLink,
  Printer,
  RotateCcw,
  Ban,
  CheckCircle2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

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

  if (!isOpen) return null;

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

  const handleRegenerate = async () => {
    if (!orderId) {
      toast.error('Không tìm thấy mã đơn hàng để tạo lại');
      return;
    }
    if (!confirm('Tạo lại mã QR sẽ lập tức vô hiệu hóa mã QR cũ. Khách đang quét mã cũ sẽ không gửi món được nữa. Tiếp tục?')) {
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
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none overflow-y-auto">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-50 to-orange-50/60 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#DA251D] text-white flex items-center justify-center shadow-xs">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                QR Gọi Món – {tableName}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Khách quét QR để xem thực đơn & gọi món
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Status chips */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Mã đơn
              </span>
              <span className="font-mono font-bold text-slate-800 truncate block">
                {orderCode || (orderId ? `TMP-${orderId.slice(0, 8).toUpperCase()}` : 'Đang mở')}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Trạng thái QR
              </span>
              <span
                className={`font-black inline-flex items-center gap-1 ${
                  qrStatus === 'ACTIVE'
                    ? 'text-emerald-600'
                    : qrStatus === 'DISABLED'
                    ? 'text-rose-600'
                    : 'text-slate-500'
                }`}
              >
                {qrStatus === 'ACTIVE' ? (
                  <>
                    <CheckCircle2 size={13} /> HOẠT ĐỘNG
                  </>
                ) : qrStatus === 'DISABLED' ? (
                  <>
                    <Ban size={13} /> TẠM KHÓA
                  </>
                ) : (
                  'ĐÃ ĐÓNG'
                )}
              </span>
            </div>
          </div>

          {/* Active Buffet Session Banner */}
          {buffetPackageName && (
            <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2 text-xs">
              <Sparkles size={16} className="text-amber-600 shrink-0" />
              <div className="truncate">
                <span className="text-amber-800 font-bold">Gói Buffet: </span>
                <span className="text-amber-950 font-black">{buffetPackageName}</span>
              </div>
            </div>
          )}

          {/* QR Box Canvas */}
          <div className="bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
            {loading ? (
              <div className="h-44 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 font-medium">
                <Loader2 size={24} className="animate-spin text-[#DA251D]" />
                <span>Đang tải mã QR gọi món...</span>
              </div>
            ) : qrUrl ? (
              <>
                <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-100 mb-2.5">
                  <QRCodeSVG
                    value={qrUrl}
                    size={190}
                    level="H"
                    includeMargin
                    imageSettings={{
                      src: '/avora_logo_ngang.png',
                      height: 32,
                      width: 32,
                      excavate: true,
                    }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 font-mono font-medium max-w-xs truncate select-all">
                  {qrUrl}
                </div>
              </>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-xs text-rose-600 font-semibold">
                <span>Chưa thể tải mã QR cho bàn này</span>
                <span className="text-[11px] text-slate-400 font-normal mt-1">
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
              className="w-full py-3 px-4 bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <ExternalLink size={17} />
              <span>Mở trang gọi món QR (Xem giao diện khách)</span>
            </button>
          )}

          {/* Action grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!qrUrl}
              className="py-2.5 px-3 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Copy size={14} />
              <span>Sao chép liên kết</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!qrUrl}
              className="py-2.5 px-3 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Printer size={14} />
              <span>In mã QR</span>
            </button>

            <button
              type="button"
              onClick={handleRegenerate}
              disabled={actionLoading || !orderId}
              className="py-2.5 px-3 bg-amber-50/70 hover:bg-amber-100 active:scale-95 border border-amber-200 text-amber-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={14} />
              <span>Tạo lại QR mới</span>
            </button>

            <button
              type="button"
              onClick={handleDisable}
              disabled={actionLoading || !orderId || qrStatus === 'DISABLED'}
              className="py-2.5 px-3 bg-rose-50/70 hover:bg-rose-100 active:scale-95 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Ban size={14} />
              <span>Vô hiệu hóa QR</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Bàn: {tableCode || tableName}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
