"use client";

import React, { useState } from 'react';
import {
  X,
  Percent,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Tag,
} from 'lucide-react';
import { PosCartItem } from './pos-types';

interface ItemDiscountModalProps {
  item: PosCartItem | null;
  onClose: () => void;
  onApplyDiscount: (itemId: string, discountAmount: number, discountReason: string) => void;
  onRemoveDiscount: (itemId: string) => void;
}

const QUICK_PERCENTAGES = [5, 10, 15, 20, 30, 50];
const QUICK_ITEM_REASONS = [
  'Món ra chậm / chờ lâu',
  'Khách quen thân thiết',
  'Ưu đãi sinh nhật khách',
  'Món đổi lại / lỗi phục vụ',
  'Quản lý phê duyệt tặng',
  'Lý do khác',
];

export const ItemDiscountModal: React.FC<ItemDiscountModalProps> = ({
  item,
  onClose,
  onApplyDiscount,
  onRemoveDiscount,
}) => {
  if (!item) return null;

  const originalUnitPrice = item.originalPriceAtSale || item.priceAtSale;
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [percentVal, setPercentVal] = useState<number>(
    item.discountAmount ? Math.round((item.discountAmount / originalUnitPrice) * 100) : 10
  );
  const [fixedVal, setFixedVal] = useState<number>(item.discountAmount || 20000);
  const [selectedReason, setSelectedReason] = useState<string>(item.discountReason || '');
  const [customReason, setCustomReason] = useState<string>('');

  const calculatedDiscount =
    discountType === 'PERCENT'
      ? Math.round((originalUnitPrice * Math.min(100, Math.max(0, percentVal))) / 100)
      : Math.min(originalUnitPrice, Math.max(0, fixedVal));

  const newPrice = Math.max(0, originalUnitPrice - calculatedDiscount);

  const finalReason =
    selectedReason === 'Lý do khác'
      ? customReason.trim()
      : selectedReason
      ? `${selectedReason}${customReason.trim() ? ` - ${customReason.trim()}` : ''}`
      : customReason.trim();

  const handleConfirm = () => {
    if (calculatedDiscount <= 0 || !finalReason) return;
    onApplyDiscount(item.id, calculatedDiscount, finalReason);
    onClose();
  };

  const handleRemove = () => {
    onRemoveDiscount(item.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Giảm giá món ăn</h3>
              <p className="text-[11px] text-gray-500 truncate max-w-[260px]">
                {item.product.name} (x{item.quantity})
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
          {/* Price Preview Card */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80 flex items-center justify-between">
            <div>
              <span className="text-gray-400 text-[11px] block">Giá gốc:</span>
              <span className="font-semibold text-gray-700 line-through">
                {originalUnitPrice.toLocaleString('vi-VN')}đ
              </span>
            </div>
            <div className="text-right">
              <span className="text-emerald-600 text-[11px] block font-bold">
                Sau giảm giá (-{calculatedDiscount.toLocaleString('vi-VN')}đ):
              </span>
              <span className="font-extrabold text-[#da251d] text-base">
                {newPrice.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>

          {/* Discount Type Toggle */}
          <div>
            <label className="block text-gray-700 font-bold mb-1.5">Hình thức giảm giá:</label>
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDiscountType('PERCENT')}
                className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                  discountType === 'PERCENT'
                    ? 'bg-white text-[#da251d] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Theo phần trăm (%)</span>
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('FIXED')}
                className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                  discountType === 'FIXED'
                    ? 'bg-white text-[#da251d] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Số tiền cố định (đ)</span>
              </button>
            </div>
          </div>

          {/* Input & Quick Chips */}
          {discountType === 'PERCENT' ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={percentVal || ''}
                  onChange={(e) => setPercentVal(Number(e.target.value))}
                  className="w-full text-center text-lg font-extrabold py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#da251d] focus:bg-white transition-all text-[#da251d]"
                />
                <span className="font-bold text-gray-500 text-sm">%</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PERCENTAGES.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPercentVal(pct)}
                    className={`px-2.5 py-1 rounded-lg border font-bold transition-all text-[11px] ${
                      percentVal === pct
                        ? 'bg-[#da251d] text-white border-[#da251d]'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={fixedVal || ''}
                  onChange={(e) => setFixedVal(Number(e.target.value))}
                  className="w-full text-center text-lg font-extrabold py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#da251d] focus:bg-white transition-all text-[#da251d]"
                />
                <span className="font-bold text-gray-500 text-sm">đ</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[10000, 20000, 50000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFixedVal(amt)}
                    className={`px-2.5 py-1 rounded-lg border font-bold transition-all text-[11px] ${
                      fixedVal === amt
                        ? 'bg-[#da251d] text-white border-[#da251d]'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {amt.toLocaleString('vi-VN')}đ
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mandatory Reason (Bắt buộc kèm lý do) */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-gray-700 font-bold mb-1.5 flex items-center gap-1">
              <span>Lý do giảm giá:</span>
              <span className="text-rose-500">* (Bắt buộc)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_ITEM_REASONS.map((r) => {
                const isSelected = selectedReason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedReason(isSelected ? '' : r)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>

            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Ghi chú thêm lý do chi tiết (nếu có)..."
              rows={2}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white text-xs resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          {item.discountAmount ? (
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition-colors text-xs flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa giảm giá</span>
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-semibold transition-colors text-xs"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={calculatedDiscount <= 0 || !finalReason}
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold transition-all shadow-xs text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Áp dụng giảm giá</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
