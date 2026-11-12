"use client";

import React, { useState } from 'react';
import {
  AlertTriangle,
  Ban,
} from 'lucide-react';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { PosOrder } from './pos-types';

interface CancelOrderModalProps {
  order: PosOrder | null;
  onClose: () => void;
  onConfirmCancel: (orderId: string, reason: string) => Promise<void>;
  isProcessing?: boolean;
  isDarkMode?: boolean;
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
  isDarkMode = false,
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
    <ResponsiveModal
      isOpen={true}
      onClose={onClose}
      title="Xác nhận hủy đơn hàng"
      subtitle={`Mã đơn: ${order.orderCode || 'TMP'}${order.table?.name ? ` • Bàn: ${order.table.name}` : ''}`}
      icon={<Ban size={18} className="text-rose-600" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Đóng
          </button>

          <button
            type="button"
            disabled={!finalReason || isProcessing}
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            {isProcessing ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Ban className="w-3.5 h-3.5" />
            )}
            <span>Xác nhận hủy đơn</span>
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 py-1 text-xs">
        {/* Warning Banner */}
        <div className={`flex items-start gap-2.5 p-3 rounded-2xl border ${
          isDarkMode ? 'bg-amber-950/40 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200/80 text-amber-800'
        }`}>
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Thao tác này sẽ hủy toàn bộ món trong đơn và giải phóng bàn. <strong>Bắt buộc phải chọn hoặc nhập lý do hủy.</strong>
          </p>
        </div>

        {/* Quick Reasons Chips */}
        <div>
          <label className={`block font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
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
                  className={`px-2.5 py-1.5 rounded-xl border text-left text-[11px] font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-rose-600 border-rose-500 text-white font-bold shadow-2xs'
                      : isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
          <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            Ghi chú chi tiết / Lý do cụ thể:
          </label>
          <textarea
            rows={3}
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Nhập chi tiết lý do hủy đơn..."
            className={`w-full p-2.5 rounded-xl outline-none focus:border-rose-500 text-xs font-sans resize-none border shadow-2xs ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>
      </div>
    </ResponsiveModal>
  );
};
