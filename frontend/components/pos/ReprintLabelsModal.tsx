'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronUp, ChevronDown, Minus, Plus } from 'lucide-react';
import { PosCartItem } from './pos-types';

interface ReprintLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PosCartItem[];
  orderCode?: string;
  tableName?: string;
  branchName?: string;
  onConfirmPrint: (selectedItems: { item: PosCartItem; quantity: number }[]) => void;
}

interface ItemPrintState {
  selected: boolean;
  quantity: number;
}

export const ReprintLabelsModal: React.FC<ReprintLabelsModalProps> = ({
  isOpen,
  onClose,
  items,
  orderCode,
  tableName,
  branchName,
  onConfirmPrint,
}) => {
  const [itemStates, setItemStates] = useState<Record<string, ItemPrintState>>({});
  const listRef = useRef<HTMLDivElement>(null);

  // Initialize selection state whenever modal opens or items change
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, ItemPrintState> = {};
      for (const item of items) {
        initial[item.id] = {
          selected: true,
          quantity: item.quantity || 1,
        };
      }
      setItemStates(initial);
    }
  }, [isOpen, items]);

  if (!isOpen) return null;

  const validItems = items.filter((it) => it.quantity > 0);
  const selectedCount = validItems.filter((it) => itemStates[it.id]?.selected).length;
  const isAllSelected = validItems.length > 0 && selectedCount === validItems.length;

  const handleToggleSelectAll = () => {
    const nextVal = !isAllSelected;
    setItemStates((prev) => {
      const next = { ...prev };
      for (const it of validItems) {
        if (next[it.id]) {
          next[it.id] = { ...next[it.id], selected: nextVal };
        } else {
          next[it.id] = { selected: nextVal, quantity: it.quantity || 1 };
        }
      }
      return next;
    });
  };

  const handleToggleItem = (itemId: string) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        selected: !prev[itemId]?.selected,
        quantity: prev[itemId]?.quantity || 1,
      },
    }));
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setItemStates((prev) => {
      const current = prev[itemId] || { selected: true, quantity: 1 };
      const newQty = Math.max(1, current.quantity + delta);
      return {
        ...prev,
        [itemId]: {
          ...current,
          quantity: newQty,
        },
      };
    });
  };

  const handleScroll = (direction: 'up' | 'down') => {
    if (listRef.current) {
      const offset = direction === 'up' ? -120 : 120;
      listRef.current.scrollBy({ top: offset, behavior: 'smooth' });
    }
  };

  const handleConfirm = () => {
    const selectedList = validItems
      .filter((it) => itemStates[it.id]?.selected)
      .map((it) => ({
        item: it,
        quantity: itemStates[it.id]?.quantity || 1,
      }));

    if (selectedList.length === 0) return;
    onConfirmPrint(selectedList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        {/* 1. Header Close Button (Top Right X) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 2. Top Controls Banner: [x] In tem | 4 Mặt hàng */}
        <div className="pt-3 px-3.5 pb-2">
          <div className="h-10 bg-slate-100/90 rounded-lg px-3.5 flex items-center justify-between border border-slate-200/80">
            <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer accent-[#0070f3]"
              />
              <span>In tem</span>
            </label>
            <span className="text-xs font-semibold text-slate-700 select-none pr-6">
              {validItems.length} Mặt hàng
            </span>
          </div>
        </div>

        {/* 3. Items List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 divide-y divide-slate-100 min-h-[200px] max-h-[55vh]"
        >
          {validItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Không có món nào trong đơn hàng để in lại tem.
            </div>
          ) : (
            validItems.map((item) => {
              const state = itemStates[item.id] || { selected: true, quantity: item.quantity || 1 };
              const unitPrice = item.priceAtSale || item.product?.price || 0;
              const optionsText = item.optionsTextSnapshot || item.selectedOptions?.map((o) => o.nameAtSale).join(', ');

              return (
                <div
                  key={item.id}
                  className={`py-3 flex items-center justify-between gap-3 transition-colors ${
                    state.selected ? 'bg-white' : 'opacity-60 bg-slate-50/50'
                  }`}
                >
                  {/* Left: Checkbox & Item info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={state.selected}
                      onChange={() => handleToggleItem(item.id)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer accent-[#0070f3] shrink-0"
                    />
                    <div
                      className="min-w-0 cursor-pointer select-none flex-1"
                      onClick={() => handleToggleItem(item.id)}
                    >
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.product?.name || 'Tên món ăn'}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        Giá thường - {unitPrice.toLocaleString('vi-VN')}đ
                        {optionsText ? ` • ${optionsText}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Stepper [-] Qty [+] */}
                  <div className="flex items-center shrink-0 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/80 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, -1)}
                      disabled={!state.selected || state.quantity <= 1}
                      className="w-9 h-8 flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:text-slate-600 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      title="Giảm số lượng tem"
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <span className="w-10 text-center text-xs sm:text-sm font-bold text-slate-800 select-none font-mono">
                      {state.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, 1)}
                      disabled={!state.selected}
                      className="w-9 h-8 flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:text-slate-600 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      title="Tăng số lượng tem"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Bottom Action Bar: Scroll arrows + [ XÁC NHẬN IN LẠI ] */}
        <div className="flex items-stretch h-12 border-t border-slate-200 bg-white">
          {/* Scroll Up Button */}
          <button
            type="button"
            onClick={() => handleScroll('up')}
            className="w-14 flex items-center justify-center border-r border-slate-200 hover:bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors cursor-pointer"
            title="Cuộn lên"
          >
            <ChevronUp className="w-5 h-5 text-slate-600 stroke-[2.5]" />
          </button>

          {/* Scroll Down Button */}
          <button
            type="button"
            onClick={() => handleScroll('down')}
            className="w-14 flex items-center justify-center border-r border-slate-200 hover:bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors cursor-pointer"
            title="Cuộn xuống"
          >
            <ChevronDown className="w-5 h-5 text-slate-600 stroke-[2.5]" />
          </button>

          {/* Primary Action Button: XÁC NHẬN IN LẠI */}
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleConfirm}
            className="flex-1 bg-[#0080ff] hover:bg-[#0070e0] active:bg-[#0060c0] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-black tracking-wide flex items-center justify-center uppercase select-none transition-all cursor-pointer"
          >
            XÁC NHẬN IN LẠI
            {selectedCount > 0 && ` (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};
