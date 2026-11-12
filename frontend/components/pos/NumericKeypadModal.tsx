"use client";

import React, { useState, useEffect } from 'react';
import { X, Delete, Check, Plus, Minus, Calculator } from 'lucide-react';
import { PosCartItem, PosProduct } from './pos-types';
import { isWeightUnit, normalizePosQty } from './pos-utils';

interface NumericKeypadModalProps {
  isOpen: boolean;
  item?: PosCartItem | null;
  productToAdd?: PosProduct | null;
  onClose: () => void;
  onConfirm: (newQuantity: number, customUnitPrice?: number) => void;
  isDarkMode?: boolean;
}

export const NumericKeypadModal: React.FC<NumericKeypadModalProps> = ({
  isOpen,
  item,
  productToAdd,
  onClose,
  onConfirm,
  isDarkMode = false,
}) => {
  const targetProduct = item?.product || productToAdd || null;
  const allowDecimal = isWeightUnit(targetProduct?.unit);
  const allowOpenPrice = Boolean(targetProduct?.allowOpenPriceOnPos) && item?.pricingMode !== 'BUFFET_INCLUDED';

  const [valStr, setValStr] = useState<string>('1');
  const [priceStr, setPriceStr] = useState<string>('0');

  useEffect(() => {
    if (!isOpen || !targetProduct) return;
    if (item) {
      setValStr(String(normalizePosQty(item.quantity || 1) || 1));
      const optAdj = (item.selectedOptions || []).reduce(
        (s, o) => s + Number(o.priceAdjustmentAtSale || 0),
        0,
      );
      const basePrice =
        item.customPrice !== undefined
          ? item.customPrice
          : Math.max(0, Number(item.priceAtSale ?? targetProduct.effectivePrice ?? targetProduct.price ?? 0) - optAdj);
      setPriceStr(String(Math.round(basePrice)));
    } else if (productToAdd) {
      setValStr(allowDecimal ? '0.5' : '1');
      const initPrice = Number(productToAdd.effectivePrice ?? productToAdd.price ?? 0);
      setPriceStr(String(Math.round(initPrice)));
    }
  }, [item, productToAdd, isOpen, targetProduct, allowDecimal]);

  if (!isOpen || !targetProduct) return null;

  const normalizedStr = valStr.replace(/,/g, '.');
  const parsedQty = parseFloat(normalizedStr);
  const currentNum = Number.isFinite(parsedQty) ? Math.round(parsedQty * 1000) / 1000 : 0;
  const parsedPrice = Number(priceStr.replace(/[^0-9]/g, ''));
  const currentPrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;
  const sentQty = item?.sentQuantity || 0;
  const stepDelta = allowDecimal ? 0.1 : 1;

  const handleDigit = (digit: string) => {
    setValStr((prev) => {
      const cleanPrev = prev.replace(/,/g, '.');
      if (digit === '.') {
        if (!allowDecimal) return cleanPrev;
        if (cleanPrev.includes('.')) return cleanPrev;
        return cleanPrev === '' ? '0.' : cleanPrev + '.';
      }
      if (cleanPrev === '0' || cleanPrev === '') return digit;
      if (cleanPrev.includes('.')) {
        const [, decPart] = cleanPrev.split('.');
        if (decPart && decPart.length >= 3) return cleanPrev;
      }
      if (cleanPrev.length >= 8) return cleanPrev;
      return cleanPrev + digit;
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
      const num = parseFloat(prev.replace(/,/g, '.')) || 0;
      const minVal = allowDecimal ? 0.1 : 1;
      const next = Math.max(minVal, Math.round((num + delta) * 1000) / 1000);
      return String(next);
    });
  };

  const handleSetExact = (num: number) => {
    setValStr(String(Math.round(num * 1000) / 1000));
  };

  const handleSubmit = () => {
    const finalQty = Math.round(currentNum * 1000) / 1000;
    if (!Number.isFinite(finalQty) || finalQty <= 0) {
      return;
    }
    if (allowOpenPrice && (!Number.isFinite(currentPrice) || currentPrice < 0)) {
      return;
    }
    onConfirm(finalQty, allowOpenPrice ? currentPrice : undefined);
    onClose();
  };

  const unitLabel = targetProduct.unit || 'phần';
  const displayUnitPrice = allowOpenPrice
    ? currentPrice
    : Number(item?.priceAtSale ?? targetProduct.effectivePrice ?? targetProduct.price ?? 0);
  const previewTotal = Math.round(currentNum * displayUnitPrice);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[95vh] ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isDarkMode ? 'bg-red-950/50 text-red-400' : 'bg-red-50 text-[#da251d]'
              }`}
            >
              <Calculator className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className={`text-sm font-bold line-clamp-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {targetProduct.name}
              </h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Đơn giá: {displayUnitPrice.toLocaleString('vi-VN')}đ / {unitLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display Area */}
        <div
          className={`p-3.5 border-b flex flex-col items-center justify-center space-y-2.5 overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}
        >
          <div
            className={`text-xs font-semibold uppercase tracking-wider ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {allowDecimal ? `Số lượng / Trọng lượng (${unitLabel})` : `Số lượng đặt (${unitLabel})`}
          </div>
          <div className="flex items-center justify-center gap-2.5 w-full">
            <button
              type="button"
              onClick={() => handlePresetDelta(-stepDelta)}
              className={`w-11 h-11 rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-750 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title={`Giảm ${stepDelta}`}
            >
              <Minus className="w-5 h-5" />
            </button>
            <div
              className={`flex-1 max-w-[170px] text-center border-2 rounded-xl py-1 px-2 ${
                isDarkMode ? 'bg-slate-950 border-red-500/40 text-red-400' : 'bg-slate-50 border-red-500/30 text-[#da251d]'
              }`}
            >
              {allowDecimal ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={valStr}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                    const parts = cleaned.split('.');
                    const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
                    setValStr(formatted);
                  }}
                  className="w-full text-center text-2xl font-black tracking-tight bg-transparent outline-none font-mono"
                />
              ) : (
                <span className="text-3xl font-black tracking-tight font-mono">{currentNum}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => handlePresetDelta(stepDelta)}
              className={`w-11 h-11 rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-750 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title={`Tăng ${stepDelta}`}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {allowOpenPrice && (
            <div className="w-full pt-1">
              <label className={`block text-[11px] font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Đơn giá bán tại POS (VNĐ / {unitLabel}):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  className={`w-full h-10 px-3 pr-9 rounded-xl border-2 text-right font-mono font-black text-base outline-none ${
                    isDarkMode
                      ? 'bg-slate-950 border-amber-500/50 text-amber-300 focus:border-amber-400'
                      : 'bg-amber-50/40 border-amber-300 text-slate-900 focus:border-amber-500'
                  }`}
                  placeholder="Nhập giá bán..."
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">đ</span>
              </div>
            </div>
          )}

          {(allowDecimal || allowOpenPrice) && (
            <div className={`w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg ${
              isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800'
            }`}>
              <span className="font-semibold">Tạm tính ({currentNum || 0} {unitLabel}):</span>
              <span className="font-mono font-black text-[#da251d]">
                {previewTotal.toLocaleString('vi-VN')}đ
              </span>
            </div>
          )}

          {/* Kitchen Delta State Warning */}
          {sentQty > 0 && (
            <div
              className={`text-xs font-medium px-2.5 py-1 rounded-md text-center border ${
                isDarkMode
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              Đã gửi bếp: <span className="font-bold">{sentQty}</span>
              {currentNum > sentQty && (
                <span className={`font-bold ml-1.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  (+{Math.round((currentNum - sentQty) * 1000) / 1000} gửi thêm)
                </span>
              )}
              {currentNum < sentQty && (
                <span className={`font-bold ml-1.5 ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>
                  (-{Math.round((sentQty - currentNum) * 1000) / 1000} hủy bớt)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Presets */}
        <div
          className={`grid ${allowDecimal ? 'grid-cols-6' : 'grid-cols-4'} gap-1.5 px-4 pt-2.5 pb-1 ${
            isDarkMode ? 'bg-slate-850' : 'bg-slate-50/50'
          }`}
        >
          {(allowDecimal ? [0.1, 0.2, 0.3, 0.5, 1, 1.5] : [1, 2, 5, 10]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleSetExact(preset)}
              className={`py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-750'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Numeric Keypad Touch Grid */}
        <div
          className={`p-3.5 grid grid-cols-3 gap-2 ${
            isDarkMode ? 'bg-slate-850' : 'bg-slate-50/50'
          }`}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className={`h-11 rounded-xl border text-lg font-bold active:scale-95 shadow-sm transition-all ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750 active:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100 active:bg-slate-200'
              }`}
            >
              {digit}
            </button>
          ))}

          {allowDecimal ? (
            <button
              type="button"
              onClick={() => handleDigit('.')}
              className={`h-11 rounded-xl border text-2xl font-black active:scale-95 shadow-sm transition-all ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-750'
                  : 'bg-white border-slate-200 text-[#da251d] hover:bg-red-50'
              }`}
              title="Dấu thập phân (, hoặc .)"
            >
              .
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClear}
              className={`h-11 rounded-xl border text-xs font-bold active:scale-95 shadow-sm transition-all ${
                isDarkMode
                  ? 'bg-amber-950/50 border-amber-800/60 text-amber-300 hover:bg-amber-900/50'
                  : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}
            >
              XÓA (C)
            </button>
          )}

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className={`h-11 rounded-xl border text-lg font-bold active:scale-95 shadow-sm transition-all ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750 active:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100 active:bg-slate-200'
            }`}
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className={`h-11 rounded-xl border active:scale-95 flex items-center justify-center shadow-sm transition-all ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
            title="Xóa lùi"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div
          className={`p-3.5 border-t flex gap-2 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {allowDecimal && (
            <button
              type="button"
              onClick={handleClear}
              className={`px-3 h-11 rounded-xl border font-bold active:scale-95 transition-all text-xs ${
                isDarkMode
                  ? 'border-amber-800/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/40'
                  : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Xóa (C)
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 h-11 rounded-xl border font-bold active:scale-95 transition-all text-sm ${
              isDarkMode
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={currentNum <= 0}
            className="flex-2 h-11 rounded-xl bg-[#da251d] hover:bg-[#b81d16] active:scale-95 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20 transition-all text-sm"
          >
            <Check className="w-4 h-4" />
            ĐỒNG Ý ({currentNum} {unitLabel})
          </button>
        </div>
      </div>
    </div>
  );
};
