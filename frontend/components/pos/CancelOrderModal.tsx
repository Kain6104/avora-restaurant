"use client";

import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Ban,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { PosOrder } from './pos-types';

interface CancelOrderModalProps {
  order: PosOrder | null;
  onClose: () => void;
  onConfirmCancel: (orderId: string, reason: string) => Promise<void>;
  isProcessing?: boolean;
}

const QUICK_REASONS = [
  'Khách đổi ý không dùng nữa',
  'Khách về gấp / có việc bận',
  'Nhân viên nhập nhầm món / trùng đơn',
  'Món ăn hết hoặc chờ quá lâu',
  'Khách không hài lòng về dịch vụ',
  'Lý do khác',
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  onClose,
  onConfirmCancel,
  isProcessing = false,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');

  if (!order) return null;

  const finalReason = selectedReason === 'Lý do khác'
    ? customReason.trim()
    : selectedReason
    ? `${selectedReason}${customReason.trim() ? ` - ${customReason.trim()}` : ''}`
    : customReason.trim();

  const handleConfirm = async () => {
    if (!finalReason) return;
    await onConfirmCancel(order.id, finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <Ban className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Xác nhận hủy đơn hàng</h3>
              <p className="text-[11px] text-gray-500 font-mono">
                Mã đơn: <span className="font-bold text-gray-800">{order.orderCode}</span>
                {order.table?.name && ` • Bàn: ${order.table.name}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Warning Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Thao tác này sẽ hủy toàn bộ món trong đơn, giải phóng bàn (nếu không còn đơn khác) và ghi nhận vào nhật ký kiểm toán. <strong>Bắt buộc phải nhập lý do hủy.</strong>
            </p>
          </div>

          {/* Quick Reasons Chips */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">
              Chọn lý do hủy nhanh: <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((r) => {
                const isSelected = selectedReason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedReason(isSelected ? '' : r)}
                    className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'bg-rose-50 border-rose-400 text-rose-700 font-bold shadow-2xs'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Note Textarea */}
          <div>
            <label className="block text-gray-700 font-bold mb-1.5">
              Ghi chú chi tiết / Lý do cụ thể:
            </label>
            <textarea
              rows={3}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Nhập chi tiết lý do hủy đơn (ví dụ: khách dị ứng nguyên liệu, nhân viên bấm nhầm bàn...)"
              className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-rose-500 text-xs text-gray-800 placeholder:text-gray-400 font-sans resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 text-xs font-semibold transition-colors"
          >
            Đóng
          </button>

          <button
            type="button"
            disabled={!finalReason || isProcessing}
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            {isProcessing ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Ban className="w-3.5 h-3.5" />
            )}
            <span>Xác nhận hủy đơn</span>
          </button>
        </div>
      </div>
    </div>
  );
};
