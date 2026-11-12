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
  isDarkMode?: boolean;
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
  isDarkMode = false,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* 1. Header Close Button (Top Right X) */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isDarkMode ? 'text-rose-400 hover:bg-rose-950/40 hover:text-rose-300' : 'text-rose-500 hover:bg-rose-50 hover:text-rose-700'
          }`}
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 2. Top Controls Banner: [x] In tem | 4 Mặt hàng */}
        <div className="pt-3 px-3.5 pb-2">
          <div className={`h-10 rounded-lg px-3.5 flex items-center justify-between border ${
            isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100/90 border-slate-200/80'
          }`}>
            <label className={`flex items-center gap-2.5 text-xs font-bold cursor-pointer select-none ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer accent-[#0070f3]"
              />
              <span>In tem</span>
            </label>
            <span className={`text-xs font-semibold select-none pr-6 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-700'
            }`}>
              {validItems.length} Mặt hàng
            </span>
          </div>
        </div>

        {/* 3. Items List */}
        <div
          ref={listRef}
          className={`flex-1 overflow-y-auto px-4 divide-y min-h-[200px] max-h-[55vh] ${
            isDarkMode ? 'divide-slate-800' : 'divide-slate-100'
          }`}
        >
          {validItems.length === 0 ? (
            <div className={`py-12 text-center text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
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
                    state.selected
                      ? isDarkMode ? 'bg-slate-900' : 'bg-white'
                      : isDarkMode ? 'opacity-50 bg-slate-950/40' : 'opacity-60 bg-slate-50/50'
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
                      <h4 className={`text-xs sm:text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {item.product?.name || 'Tên món ăn'}
                      </h4>
                      <p className={`text-[11px] truncate mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Giá thường - {unitPrice.toLocaleString('vi-VN')}đ
                        {optionsText ? ` • ${optionsText}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Stepper [-] Qty [+] */}
                  <div className={`flex items-center shrink-0 border rounded-lg overflow-hidden shadow-2xs ${
                    isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50/80'
                  }`}>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, -1)}
                      disabled={!state.selected || state.quantity <= 1}
                      className={`w-9 h-8 flex items-center justify-center transition-colors cursor-pointer ${
                        isDarkMode
                          ? 'text-slate-300 hover:text-rose-400 hover:bg-slate-700 disabled:opacity-30'
                          : 'text-slate-600 hover:text-rose-600 hover:bg-slate-100 disabled:opacity-40'
                      }`}
                      title="Giảm số lượng tem"
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                    <span className={`w-10 text-center text-xs sm:text-sm font-bold select-none font-mono ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      {state.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, 1)}
                      disabled={!state.selected}
                      className={`w-9 h-8 flex items-center justify-center transition-colors cursor-pointer ${
                        isDarkMode
                          ? 'text-slate-300 hover:text-emerald-400 hover:bg-slate-700 disabled:opacity-30'
                          : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-100 disabled:opacity-40'
                      }`}
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
        <div className={`flex items-stretch h-12 border-t ${
          isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}>
          {/* Scroll Up Button */}
          <button
            type="button"
            onClick={() => handleScroll('up')}
            className={`w-14 flex items-center justify-center border-r transition-colors cursor-pointer ${
              isDarkMode
                ? 'border-slate-800 hover:bg-slate-800 text-slate-400 active:bg-slate-750'
                : 'border-slate-200 hover:bg-slate-100 text-slate-600 active:bg-slate-200'
            }`}
            title="Cuộn lên"
          >
            <ChevronUp className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Scroll Down Button */}
          <button
            type="button"
            onClick={() => handleScroll('down')}
            className={`w-14 flex items-center justify-center border-r transition-colors cursor-pointer ${
              isDarkMode
                ? 'border-slate-800 hover:bg-slate-800 text-slate-400 active:bg-slate-750'
                : 'border-slate-200 hover:bg-slate-100 text-slate-600 active:bg-slate-200'
            }`}
            title="Cuộn xuống"
          >
            <ChevronDown className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Primary Action Button: XÁC NHẬN IN LẠI */}
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleConfirm}
            className="flex-1 bg-[#0080ff] hover:bg-[#0070e0] active:bg-[#0060c0] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-black tracking-wide flex items-center justify-center uppercase select-none transition-all cursor-pointer"
          >
            XÁC NHẬN IN LẠI
            {selectedCount > 0 && ` (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};
