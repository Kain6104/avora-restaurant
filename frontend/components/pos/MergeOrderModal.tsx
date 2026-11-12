"use client";

import React, { useState } from 'react';
import { Combine, AlertCircle } from 'lucide-react';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { PosTable, PosOrder } from './pos-types';

interface MergeOrderModalProps {
  currentOrder: PosOrder | null;
  occupiedTables: PosTable[];
  onClose: () => void;
  onConfirmMerge: (sourceOrderId: string, targetOrderId: string, reason?: string) => Promise<void>;
  isProcessing?: boolean;
  isDarkMode?: boolean;
}

export const MergeOrderModal: React.FC<MergeOrderModalProps> = ({
  currentOrder,
  occupiedTables,
  onClose,
  onConfirmMerge,
  isProcessing = false,
  isDarkMode = false,
}) => {
  const [selectedSourceOrderId, setSelectedSourceOrderId] = useState<string>('');
  const [reason, setReason] = useState('Gộp chung bàn để thanh toán');

  const candidateTables = occupiedTables.filter(
    (t) => t.currentOrder && t.currentOrder.id !== currentOrder?.id,
  );

  const handleConfirm = async () => {
    if (!selectedSourceOrderId || !currentOrder?.id) return;
    await onConfirmMerge(selectedSourceOrderId, currentOrder.id, reason);
    onClose();
  };

  return (
    <ResponsiveModal
      isOpen={true}
      onClose={onClose}
      title="Gộp đơn hàng"
      subtitle={`Gộp các món từ bàn khác vào đơn ${currentOrder?.orderCode || 'hiện tại'}`}
      icon={<Combine size={18} className="text-cyan-600" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!selectedSourceOrderId || isProcessing}
            onClick={handleConfirm}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            {isProcessing ? 'Đang gộp...' : 'Xác nhận gộp đơn'}
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 py-1 text-xs">
        <div className={`p-3 rounded-2xl text-xs flex items-start gap-2 border ${
          isDarkMode
            ? 'bg-cyan-950/40 border-cyan-800/60 text-cyan-200'
            : 'bg-cyan-50/60 border-cyan-200 text-cyan-900'
        }`}>
          <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`} />
          <span className="leading-relaxed">
            Đơn nhận gộp: <b>{currentOrder?.orderCode || 'Đơn hiện tại'}</b>. Đơn nguồn sau khi gộp sẽ tự động kết thúc và bàn nguồn được giải phóng.
          </span>
        </div>

        <div className="space-y-1.5">
          <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            Chọn bàn / đơn cần gộp vào đây:
          </label>
          {candidateTables.length === 0 ? (
            <div className={`p-4 rounded-2xl border text-center text-xs ${
              isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              Không có bàn nào khác đang có khách để gộp
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto overscroll-contain p-0.5">
              {candidateTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedSourceOrderId(t.currentOrder!.id)}
                  className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                    selectedSourceOrderId === t.currentOrder!.id
                      ? isDarkMode
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 font-bold shadow-xs'
                        : 'bg-cyan-50 border-cyan-500 text-cyan-900 font-bold shadow-xs'
                      : isDarkMode
                      ? 'bg-slate-800/70 border-slate-700 hover:bg-slate-750 text-slate-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold">{t.name} {t.areaName ? `(${t.areaName})` : ''}</div>
                    <div className={`text-[10px] font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Mã đơn: {t.currentOrder!.orderCode} • {t.currentOrder!.itemCount} món
                    </div>
                  </div>
                  <span className="font-black text-[#da251d]">
                    {t.currentOrder!.totalAmount.toLocaleString('vi-VN')} đ
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            Lý do gộp đơn:
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Khách ngồi chung bàn..."
            className={`w-full text-xs rounded-xl px-3 py-2 outline-none border transition-all shadow-2xs ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-cyan-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-cyan-500'
            }`}
          />
        </div>
      </div>
    </ResponsiveModal>
  );
};
