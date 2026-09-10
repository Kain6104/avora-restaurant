"use client";

import React, { useState } from 'react';
import { X, Combine, AlertCircle } from 'lucide-react';
import { PosTable, PosOrder } from './pos-types';

interface MergeOrderModalProps {
  currentOrder: PosOrder | null;
  occupiedTables: PosTable[];
  onClose: () => void;
  onConfirmMerge: (sourceOrderId: string, targetOrderId: string, reason?: string) => Promise<void>;
  isProcessing?: boolean;
}

export const MergeOrderModal: React.FC<MergeOrderModalProps> = ({
  currentOrder,
  occupiedTables,
  onClose,
  onConfirmMerge,
  isProcessing = false,
}) => {
  const [selectedSourceOrderId, setSelectedSourceOrderId] = useState<string>('');
  const [reason, setReason] = useState('Gộp chung bàn để thanh toán');

  // Filter occupied tables excluding current table
  const candidateTables = occupiedTables.filter(
    (t) => t.currentOrder && t.currentOrder.id !== currentOrder?.id,
  );

  const handleConfirm = async () => {
    if (!selectedSourceOrderId || !currentOrder?.id) return;
    await onConfirmMerge(selectedSourceOrderId, currentOrder.id, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Combine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">Gộp đơn hàng (Merge Order)</h3>
              <p className="text-[11px] text-gray-500">
                Gộp tất cả món từ một bàn khác vào đơn hiện tại
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-cyan-50/50 border border-cyan-200 rounded-xl text-xs text-cyan-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
            <span>
              Đơn hàng đích nhận gộp: <b>{currentOrder?.orderCode || 'Đơn hiện tại'}</b>. Đơn nguồn sau khi gộp sẽ được chuyển sang trạng thái hoàn tất/đã gộp và bàn nguồn sẽ được giải phóng tự động.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Chọn bàn / đơn cần gộp vào đây:</label>
            {candidateTables.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center text-xs text-gray-500">
                Không có bàn nào khác đang có khách để gộp
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {candidateTables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedSourceOrderId(t.currentOrder!.id)}
                    className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                      selectedSourceOrderId === t.currentOrder!.id
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-900 font-bold'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <div>
                      <div>{t.name} ({t.areaName})</div>
                      <div className="text-[10px] text-gray-500 font-normal">
                        Mã đơn: {t.currentOrder!.orderCode} • {t.currentOrder!.itemCount} món
                      </div>
                    </div>
                    <span className="font-extrabold text-[#da251d]">
                      {t.currentOrder!.totalAmount.toLocaleString('vi-VN')}đ
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Lý do gộp đơn:</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Khách ngồi chung bàn..."
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-white"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!selectedSourceOrderId || isProcessing}
            onClick={handleConfirm}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-300 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            {isProcessing ? 'Đang gộp...' : 'XÁC NHẬN GỘP ĐƠN'}
          </button>
        </div>
      </div>
    </div>
  );
};
