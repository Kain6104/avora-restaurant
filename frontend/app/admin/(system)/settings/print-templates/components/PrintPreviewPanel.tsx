'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Printer, RefreshCw, Layers, ShoppingBag, AlertCircle } from 'lucide-react';

interface RecentOrder {
  id: string;
  orderCode: string;
  customerName?: string;
  totalAmount: number;
  createdAt: string;
}

interface PrintPreviewPanelProps {
  branchId: string;
  templateContent: string;
  paperSize: string;
  settings?: Record<string, any>;
  onTestPrint?: () => void;
}

export const PrintPreviewPanel: React.FC<PrintPreviewPanelProps> = ({
  branchId,
  templateContent,
  paperSize,
  settings,
}) => {
  const [mode, setMode] = useState<'mock' | 'real'>('mock');
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Lấy danh sách 10 đơn hàng gần nhất của chi nhánh để test đơn thật
  useEffect(() => {
    if (branchId && mode === 'real') {
      fetchRecentOrders();
    }
  }, [branchId, mode]);

  const fetchRecentOrders = async () => {
    try {
      const res = await fetch(`/api/admin/orders?branchId=${branchId}&limit=10`, {
        credentials: 'include',
      });
      const data = await res.json();
      const orders = data.data?.orders || data.data || [];
      setRecentOrders(orders);
      if (orders.length > 0 && !selectedOrderId) {
        setSelectedOrderId(orders[0].id);
      }
    } catch (err) {
      console.error('Không thể lấy danh sách đơn hàng gần đây:', err);
    }
  };

  // Gọi backend preview API với debounce
  const fetchPreview = useCallback(async () => {
    if (!templateContent) {
      setPreviewHtml('');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/print-templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: templateContent,
          paperSize,
          settings,
          branchId,
          realOrderId: mode === 'real' ? selectedOrderId : undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.html) {
        setPreviewHtml(data.data.html);
      } else {
        setError(data.message || 'Lỗi khi tạo bản xem trước');
      }
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến máy chủ xem trước');
    } finally {
      setLoading(false);
    }
  }, [templateContent, paperSize, settings, branchId, mode, selectedOrderId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreview();
    }, 400);

    return () => clearTimeout(timer);
  }, [fetchPreview]);

  // In thử qua Iframe
  const handlePrintTest = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  // Chiều rộng hiển thị khung preview
  const getPreviewWidth = () => {
    switch (paperSize) {
      case '58mm':
        return 'w-[280px]';
      case '50x30mm':
      case '30x50mm':
        return 'w-[240px]';
      case '50x70mm':
        return 'w-[320px]';
      case 'A5':
        return 'w-[420px]';
      case 'A4':
        return 'w-[520px]';
      case '80mm':
      default:
        return 'w-[360px]';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header điều khiển xem trước */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 select-none">
        {/* Toggle Mock vs Real */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setMode('mock')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              mode === 'mock'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dữ liệu mẫu</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('real')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              mode === 'real'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Đơn thật</span>
          </button>
        </div>

        {/* Nút In Thử */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPreview}
            disabled={loading}
            title="Làm mới xem trước"
            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 bg-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handlePrintTest}
            disabled={!previewHtml || loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In thử ({paperSize})</span>
          </button>
        </div>
      </div>

      {/* Selector đơn hàng thật nếu ở mode = 'real' */}
      {mode === 'real' && (
        <div className="p-2.5 border-b border-slate-200 bg-amber-50/60 flex items-center gap-2 text-xs">
          <span className="font-bold text-amber-900 shrink-0">Chọn đơn gần đây:</span>
          {recentOrders.length === 0 ? (
            <span className="text-slate-500 italic">Chi nhánh chưa có đơn hàng nào</span>
          ) : (
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 outline-none"
            >
              {recentOrders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.orderCode} - {ord.customerName || 'Khách vãng lai'} -{' '}
                  {new Intl.NumberFormat('vi-VN').format(ord.totalAmount)}đ
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Khung mô phỏng máy in nhiệt với Iframe */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-200/70 flex justify-center items-start">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs flex items-center gap-2 max-w-md">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        ) : (
          <div
            className={`${getPreviewWidth()} bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden relative transition-all duration-200`}
          >
            {/* Thanh răng cưa đầu giấy in mô phỏng */}
            <div className="h-2 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 border-b border-dashed border-slate-300" />

            <iframe
              ref={iframeRef}
              srcDoc={previewHtml}
              title="Print Preview Frame"
              className="w-full min-h-[520px] border-none bg-white block"
              style={{ minHeight: '560px' }}
            />

            {/* Đuôi cuộn giấy xé */}
            <div className="h-3 bg-gradient-to-b from-white to-slate-100 border-t border-dotted border-slate-300" />
          </div>
        )}
      </div>

      {/* Footer ghi chú */}
      <div className="p-2 border-t border-slate-200 bg-white text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
        <span>Khổ giấy đang mô phỏng: <b>{paperSize}</b>. Bản xem trước được render trực tiếp từ Render Engine backend.</span>
      </div>
    </div>
  );
};
