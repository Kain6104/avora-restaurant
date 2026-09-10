"use client";

import React, { useState } from 'react';
import { X, Split, Plus, Minus, ArrowRight } from 'lucide-react';
import { PosCartItem, PosTable } from './pos-types';

interface SplitOrderModalProps {
  cartItems: PosCartItem[];
  availableTables: PosTable[];
  onClose: () => void;
  onConfirmSplit: (
    items: Array<{ orderItemId: string; quantity: number }>,
    targetTableId?: string,
    reason?: string,
  ) => Promise<void>;
  isProcessing?: boolean;
}

export const SplitOrderModal: React.FC<SplitOrderModalProps> = ({
  cartItems,
  availableTables,
  onClose,
  onConfirmSplit,
  isProcessing = false,
}) => {
  const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({});
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [reason, setReason] = useState('Tách thanh toán riêng');

  const handleUpdateSplitQty = (itemId: string, maxQty: number, change: number) => {
    const current = splitQuantities[itemId] || 0;
    const next = Math.min(maxQty, Math.max(0, current + change));
    setSplitQuantities({ ...splitQuantities, [itemId]: next });
  };

  const totalSplitItemsCount = Object.values(splitQuantities).reduce((a, b) => a + b, 0);

  const handleConfirm = async () => {
    const items = Object.entries(splitQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

    if (items.length === 0) return;

    await onConfirmSplit(items, targetTableId || undefined, reason);
    onClose();
  };

  const vacantTables = availableTables.filter((t) => t.visualStatus === 'VACANT');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Split className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">Tách đơn hàng (Split Order)</h3>
              <p className="text-[11px] text-gray-500">
                Chọn món cần tách sang một hóa đơn hoặc bàn mới
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

        {/* Content: Items selection */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          <span className="text-xs font-bold text-gray-700">Chọn số lượng món cần tách:</span>

          <div className="space-y-2">
            {cartItems.map((item) => {
              const splitQty = splitQuantities[item.id] || 0;
              return (
                <div
                  key={item.id}
                  className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-gray-900">{item.product.name}</div>
                    <div className="text-[11px] text-gray-500">
                      Tổng có: {item.quantity} phần • {item.priceAtSale.toLocaleString('vi-VN')}đ
                    </div>
                  </div>

                  {/* Quantity control */}
                  <div className="flex items-center border border-gray-200 rounded-lg bg-white">
                    <button
                      type="button"
                      onClick={() => handleUpdateSplitQty(item.id, item.quantity, -1)}
                      className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-indigo-700">
                      {splitQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateSplitQty(item.id, item.quantity, 1)}
                      className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Optional: Target Table */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            <label className="text-xs font-bold text-gray-700">Chuyển sang bàn mới (Tùy chọn):</label>
            <select
              value={targetTableId}
              onChange={(e) => setTargetTableId(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none font-medium"
            >
              <option value="">Giữ nguyên tại bàn này (Tạo hóa đơn phụ)</option>
              {vacantTables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.areaName}) - Trống
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Lý do tách đơn:</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Khách thanh toán riêng..."
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-white"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={totalSplitItemsCount === 0 || isProcessing}
            onClick={handleConfirm}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            {isProcessing ? 'Đang tách...' : `XÁC NHẬN TÁCH (${totalSplitItemsCount} MÓN)`}
          </button>
        </div>
      </div>
    </div>
  );
};
