"use client";

import React, { useState } from 'react';
import { Split, Plus, Minus } from 'lucide-react';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
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
  isDarkMode?: boolean;
}

export const SplitOrderModal: React.FC<SplitOrderModalProps> = ({
  cartItems,
  availableTables,
  onClose,
  onConfirmSplit,
  isProcessing = false,
  isDarkMode = false,
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
    <ResponsiveModal
      isOpen={true}
      onClose={onClose}
      title="Tách đơn hàng"
      subtitle="Chọn món cần tách sang một hóa đơn hoặc bàn mới"
      icon={<Split size={18} className="text-indigo-600" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
              isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={totalSplitItemsCount === 0 || isProcessing}
            onClick={handleConfirm}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            {isProcessing ? 'Đang tách...' : `Xác nhận tách (${totalSplitItemsCount} món)`}
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 py-1 text-xs">
        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
          Chọn số lượng món cần tách:
        </span>

        <div className="space-y-2 max-h-56 overflow-y-auto overscroll-contain p-0.5">
          {cartItems.map((item) => {
            const splitQty = splitQuantities[item.id] || 0;
            return (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  isDarkMode ? 'bg-slate-800/60 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="min-w-0 flex-1 mr-2">
                  <div className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {item.product.name}
                  </div>
                  <div className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Tổng: {item.quantity} phần • {item.priceAtSale.toLocaleString('vi-VN')} đ
                  </div>
                </div>

                {/* Quantity control */}
                <div className={`flex items-center border rounded-xl overflow-hidden shrink-0 ${
                  isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white'
                }`}>
                  <button
                    type="button"
                    onClick={() => handleUpdateSplitQty(item.id, item.quantity, -1)}
                    className={`w-7 h-7 flex items-center justify-center cursor-pointer active:scale-95 ${
                      isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center text-xs font-black text-indigo-600 font-mono">
                    {splitQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateSplitQty(item.id, item.quantity, 1)}
                    className={`w-7 h-7 flex items-center justify-center cursor-pointer active:scale-95 ${
                      isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Optional: Target Table */}
        <div className={`space-y-1 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200/80'}`}>
          <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            Chuyển sang bàn mới (Tùy chọn):
          </label>
          <select
            value={targetTableId}
            onChange={(e) => setTargetTableId(e.target.value)}
            className={`w-full text-xs rounded-xl px-3 py-2 outline-none font-medium border shadow-2xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <option value="" className={isDarkMode ? 'bg-slate-800 text-white' : ''}>
              Giữ nguyên tại bàn này (Tạo hóa đơn phụ)
            </option>
            {vacantTables.map((t) => (
              <option key={t.id} value={t.id} className={isDarkMode ? 'bg-slate-800 text-white' : ''}>
                {t.name} ({t.areaName}) - Trống
              </option>
            ))}
          </select>
        </div>

        {/* Reason */}
        <div className="space-y-1">
          <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            Lý do tách đơn:
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Khách thanh toán riêng..."
            className={`w-full text-xs rounded-xl px-3 py-2 outline-none border shadow-2xs ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900'
            }`}
          />
        </div>
      </div>
    </ResponsiveModal>
  );
};
