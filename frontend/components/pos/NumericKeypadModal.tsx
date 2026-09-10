"use client";

import React, { useState, useEffect } from 'react';
import { X, Delete, Check, Plus, Minus, Calculator } from 'lucide-react';
import { PosCartItem } from './pos-types';

interface NumericKeypadModalProps {
  isOpen: boolean;
  item: PosCartItem | null;
  onClose: () => void;
  onConfirm: (newQuantity: number) => void;
}

export const NumericKeypadModal: React.FC<NumericKeypadModalProps> = ({
  isOpen,
  item,
  onClose,
  onConfirm,
}) => {
  const [valStr, setValStr] = useState<string>('1');

  useEffect(() => {
    if (item) {
      setValStr(String(item.quantity || 1));
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const currentNum = parseInt(valStr, 10) || 0;
  const sentQty = item.sentQuantity || 0;

  const handleDigit = (digit: string) => {
    setValStr((prev) => {
      if (prev === '0' || prev === '') return digit;
      if (prev.length >= 4) return prev; // max 9999
      return prev + digit;
    });
  };

  const handleClear = () => {
    setValStr('0');
  };

  const handleBackspace = () => {
    setValStr((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handlePresetDelta = (delta: number) => {
    setValStr((prev) => {
      const num = parseInt(prev, 10) || 0;
      const next = Math.max(1, num + delta);
      return String(next);
    });
  };

  const handleSetExact = (num: number) => {
    setValStr(String(Math.max(1, num)));
  };

  const handleSubmit = () => {
    const finalQty = parseInt(valStr, 10);
    if (isNaN(finalQty) || finalQty <= 0) {
      return;
    }
    onConfirm(finalQty);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-[#da251d] flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 line-clamp-1">
                {item.product.name}
              </h3>
              <p className="text-xs text-slate-500">
                Đơn giá: {item.priceAtSale.toLocaleString('vi-VN')}đ / {item.product.unit || 'phần'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display Area */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-col items-center justify-center">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Số lượng đặt
          </div>
          <div className="flex items-center justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => handlePresetDelta(-1)}
              className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold flex items-center justify-center transition-all"
            >
              <Minus className="w-5 h-5" />
            </button>
            <div className="flex-1 max-w-[140px] text-center bg-slate-50 border-2 border-red-500/30 rounded-xl py-1.5 px-3">
              <span className="text-3xl font-black text-[#da251d] tracking-tight">
                {currentNum}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handlePresetDelta(1)}
              className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold flex items-center justify-center transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Kitchen Delta State Warning */}
          {sentQty > 0 && (
            <div className="mt-2 text-xs font-medium px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-center">
              Đã gửi bếp: <span className="font-bold">{sentQty}</span>
              {currentNum > sentQty && (
                <span className="text-emerald-700 font-bold ml-1.5">
                  (+{currentNum - sentQty} gửi thêm)
                </span>
              )}
              {currentNum < sentQty && (
                <span className="text-red-700 font-bold ml-1.5">
                  (-{sentQty - currentNum} hủy bớt)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Presets */}
        <div className="grid grid-cols-4 gap-1.5 px-4 pt-3 pb-1 bg-slate-50/50">
          {[1, 2, 5, 10].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleSetExact(preset)}
              className="py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              ={preset}
            </button>
          ))}
        </div>

        {/* Numeric Keypad Touch Grid */}
        <div className="p-4 grid grid-cols-3 gap-2 bg-slate-50/50">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-12 rounded-xl bg-white border border-slate-200 text-slate-800 text-xl font-bold hover:bg-slate-100 active:bg-slate-200 active:scale-95 shadow-sm transition-all"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-bold hover:bg-amber-100 active:scale-95 shadow-sm transition-all"
          >
            XÓA (C)
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 rounded-xl bg-white border border-slate-200 text-slate-800 text-xl font-bold hover:bg-slate-100 active:bg-slate-200 active:scale-95 shadow-sm transition-all"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 active:scale-95 flex items-center justify-center shadow-sm transition-all"
            title="Xóa lùi"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 active:scale-95 transition-all text-sm"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={currentNum <= 0}
            className="flex-2 h-12 rounded-xl bg-[#da251d] hover:bg-[#b81d16] active:scale-95 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-md shadow-red-500/20 transition-all text-base"
          >
            <Check className="w-5 h-5" />
            ĐỒNG Ý ({currentNum})
          </button>
        </div>
      </div>
    </div>
  );
};
