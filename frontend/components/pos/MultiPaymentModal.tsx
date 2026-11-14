"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  Banknote,
  QrCode,
  CreditCard,
  Wallet,
  Delete,
  RotateCcw,
  Layers,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useModalZIndex } from '@/lib/modal-stack';
import { PosPaymentMethod } from './PaymentModal';

interface MultiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  paymentMethods: PosPaymentMethod[];
  initialSplitAmounts: Record<string, number>;
  onApply: (newSplitAmounts: Record<string, number>) => void;
  isDarkMode?: boolean;
}

export const MultiPaymentModal: React.FC<MultiPaymentModalProps> = ({
  isOpen,
  onClose,
  grandTotal,
  paymentMethods,
  initialSplitAmounts,
  onApply,
  isDarkMode = false,
}) => {
  const modalZIndex = useModalZIndex(isOpen, 110);
  // Split amounts state
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  // Currently active/focused method in the list for numpad input
  const [activeMethodCode, setActiveMethodCode] = useState<string>('');

  // Initialize from initialSplitAmounts or sensible default
  useEffect(() => {
    if (isOpen) {
      const activeEntries = Object.entries(initialSplitAmounts).filter(([_, amt]) => (amt || 0) > 0);
      if (activeEntries.length > 0) {
        setSplitAmounts({ ...initialSplitAmounts });
        setActiveMethodCode(activeEntries[0][0]);
      } else {
        // Default to cash or first method with grandTotal
        const defaultCash = paymentMethods.find(
          (m) =>
            m.methodCode === 'CASH' ||
            m.methodCode === 'COD' ||
            m.gatewayType === 'CASH' ||
            m.gatewayType === 'COD' ||
            /tiền\s*mặt/i.test(m.name || '')
        ) || paymentMethods[0];

        const initialCode = defaultCash ? defaultCash.methodCode : 'CASH';
        setSplitAmounts({ [initialCode]: grandTotal });
        setActiveMethodCode(initialCode);
      }
    }
  }, [isOpen, initialSplitAmounts, grandTotal, paymentMethods]);

  if (!isOpen) return null;

  // Selected method codes with non-negative amounts
  const selectedCodes = Object.keys(splitAmounts);
  const totalAllocated = Object.values(splitAmounts).reduce((sum, v) => sum + (v || 0), 0);
  const diff = totalAllocated - grandTotal;
  const isOver = diff > 0;
  const isUnder = diff < 0;

  // Helper to get method info
  const getMethod = (code: string) => paymentMethods.find((m) => m.methodCode === code);

  // Helper to determine icon & type
  const getMethodIcon = (method?: PosPaymentMethod) => {
    if (!method) return <CreditCard className="w-6 h-6 text-blue-500" />;
    const code = method.methodCode.toUpperCase();
    const gateway = method.gatewayType.toUpperCase();
    if (code.includes('CASH') || code.includes('COD') || gateway === 'COD' || gateway === 'CASH') {
      return <Banknote className="w-7 h-7 text-emerald-500" />;
    }
    if (code.includes('SEPAY') || gateway === 'SEPAY' || code.includes('TRANSFER')) {
      return <QrCode className="w-7 h-7 text-red-500" />;
    }
    if (code.includes('CARD') || gateway === 'CARD') {
      return <CreditCard className="w-7 h-7 text-blue-500" />;
    }
    return <Wallet className="w-7 h-7 text-amber-500" />;
  };

  // Toggle or add method
  const handleToggleMethod = (methodCode: string) => {
    if (selectedCodes.includes(methodCode)) {
      // Remove it
      if (selectedCodes.length === 1) {
        toast('Cần giữ lại ít nhất 1 phương thức thanh toán');
        return;
      }
      setSplitAmounts((prev) => {
        const next = { ...prev };
        delete next[methodCode];
        return next;
      });
      if (activeMethodCode === methodCode) {
        const remaining = selectedCodes.filter((c) => c !== methodCode);
        setActiveMethodCode(remaining[0] || '');
      }
    } else {
      // Add it and allocate remaining balance
      const currentAllocated = Object.values(splitAmounts).reduce((sum, v) => sum + (v || 0), 0);
      const needed = Math.max(0, grandTotal - currentAllocated);
      setSplitAmounts((prev) => ({
        ...prev,
        [methodCode]: needed,
      }));
      setActiveMethodCode(methodCode);
    }
  };

  // Delete single method
  const handleDeleteMethod = (methodCode: string) => {
    if (selectedCodes.length === 1) {
      toast('Cần giữ lại ít nhất 1 phương thức thanh toán');
      return;
    }
    setSplitAmounts((prev) => {
      const next = { ...prev };
      delete next[methodCode];
      return next;
    });
    if (activeMethodCode === methodCode) {
      const remaining = selectedCodes.filter((c) => c !== methodCode);
      setActiveMethodCode(remaining[0] || '');
    }
  };

  // Change amount directly from input
  const handleInputChange = (methodCode: string, valStr: string) => {
    const rawVal = valStr.replace(/\D/g, '');
    const num = rawVal === '' ? 0 : parseInt(rawVal, 10);
    setSplitAmounts((prev) => ({
      ...prev,
      [methodCode]: num,
    }));
  };

  // Touch Numpad Actions
  const handleNumpad = (action: string) => {
    if (!activeMethodCode) return;
    const currentVal = splitAmounts[activeMethodCode] || 0;
    const strVal = currentVal.toString();

    if (action === 'C') {
      // Reset active method to 0
      setSplitAmounts((prev) => ({ ...prev, [activeMethodCode]: 0 }));
    } else if (action === 'DEL') {
      // Backspace
      const newStr = strVal.length > 1 ? strVal.slice(0, -1) : '0';
      setSplitAmounts((prev) => ({ ...prev, [activeMethodCode]: parseInt(newStr, 10) }));
    } else if (action === '000') {
      if (currentVal > 0) {
        const newStr = strVal + '000';
        setSplitAmounts((prev) => ({ ...prev, [activeMethodCode]: Math.min(999999999, parseInt(newStr, 10)) }));
      }
    } else if (action === 'FILL_REMAINING') {
      // Auto-fill whatever remains to reach grandTotal
      const otherAllocated = Object.entries(splitAmounts)
        .filter(([c]) => c !== activeMethodCode)
        .reduce((sum, [_, v]) => sum + (v || 0), 0);
      const needed = Math.max(0, grandTotal - otherAllocated);
      setSplitAmounts((prev) => ({ ...prev, [activeMethodCode]: needed }));
    } else {
      // Number digit '0'-'9'
      const newStr = currentVal === 0 ? action : strVal + action;
      setSplitAmounts((prev) => ({ ...prev, [activeMethodCode]: Math.min(999999999, parseInt(newStr, 10)) }));
    }
  };

  // Save & Apply
  const handleSave = () => {
    const filtered: Record<string, number> = {};
    for (const [code, amt] of Object.entries(splitAmounts)) {
      if ((amt || 0) > 0) {
        filtered[code] = amt;
      }
    }

    if (Object.keys(filtered).length === 0) {
      toast.error('Vui lòng phân bổ số tiền lớn hơn 0 cho ít nhất 1 phương thức!');
      return;
    }

    if (totalAllocated < grandTotal) {
      toast.error(`Tổng số tiền các phương thức (${totalAllocated.toLocaleString('vi-VN')}đ) chưa đủ số tiền cần thanh toán (${grandTotal.toLocaleString('vi-VN')}đ)!`);
      return;
    }

    onApply(filtered);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150 select-none"
      style={{ zIndex: modalZIndex }}
    >
      <div
        className={`w-full max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-all max-h-[92dvh] sm:max-h-[92vh] animate-in slide-in-from-bottom duration-200 sm:animate-in sm:zoom-in-95 ${
          isDarkMode
            ? 'bg-[#181f2c] border-[#2c374c] text-slate-100 shadow-slate-950/60'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* ================= HEADER ================= */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${
            isDarkMode ? 'bg-[#1e2738] border-[#2c374c]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#da251d] text-white flex items-center justify-center font-bold shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-base font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Thanh toán nhiều phương thức
              </h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Chọn phương thức và phân bổ số tiền thanh toán cho đơn hàng
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/60' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= BODY: 2 COLUMNS ================= */}
        <div
          className={`flex-1 grid grid-cols-1 md:grid-cols-12 overflow-y-auto divide-y md:divide-y-0 md:divide-x ${
            isDarkMode ? 'divide-[#2c374c]' : 'divide-slate-200'
          }`}
        >
          {/* ================= LEFT COLUMN: SELECTED METHODS (col-span-5) ================= */}
          <div className="md:col-span-5 p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              {/* Highlight Box: Cần thanh toán */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isDarkMode
                    ? 'bg-[#1e2738] border-[#2c374c] text-slate-100'
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                <span className="font-semibold text-xs">Cần thanh toán</span>
                <span className="text-base font-black tracking-tight font-mono text-[#da251d] dark:text-red-400">
                  {grandTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>

              {/* Selected Methods List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
                {selectedCodes.map((code) => {
                  const m = getMethod(code);
                  const amt = splitAmounts[code] || 0;
                  const isActive = activeMethodCode === code;

                  return (
                    <div
                      key={code}
                      onClick={() => setActiveMethodCode(code)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        isActive
                          ? isDarkMode
                            ? 'bg-red-950/30 border-[#da251d] ring-2 ring-[#da251d]/30'
                            : 'bg-red-50/60 border-[#da251d] ring-2 ring-red-100'
                          : isDarkMode
                          ? 'bg-[#1e2738] border-[#2c374c] hover:border-slate-600'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Delete X Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMethod(code);
                        }}
                        className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                          isDarkMode
                            ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/50'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        title="Xóa phương thức này"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Method Name */}
                      <span className={`text-xs font-semibold truncate flex-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {m?.name || code}
                      </span>

                      {/* Amount Input */}
                      <div className="relative w-28 shrink-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={amt.toLocaleString('vi-VN')}
                          onChange={(e) => handleInputChange(code, e.target.value)}
                          onFocus={() => setActiveMethodCode(code)}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono font-bold text-right outline-none border transition-colors ${
                            isActive
                              ? isDarkMode
                                ? 'bg-[#141b27] border-[#da251d] text-white'
                                : 'bg-white border-[#da251d] text-slate-900 shadow-xs'
                              : isDarkMode
                              ? 'bg-[#181f2c] border-[#2c374c] text-slate-200'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Left Column Bottom Summary */}
            <div
              className={`pt-3 border-t space-y-1.5 text-xs ${
                isDarkMode ? 'border-[#2c374c]' : 'border-slate-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Tổng tiền đã phân bổ:</span>
                <span className={`font-bold font-mono text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {totalAllocated.toLocaleString('vi-VN')}đ
                </span>
              </div>

              <div className="flex justify-between items-center font-bold">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                  {isOver ? 'Tiền thừa:' : 'Còn thiếu:'}
                </span>
                <span
                  className={`font-mono text-sm ${
                    diff === 0
                      ? 'text-emerald-500'
                      : isOver
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  }`}
                >
                  {diff === 0
                    ? '0đ (Đã đủ tiền)'
                    : isOver
                    ? `+${diff.toLocaleString('vi-VN')}đ`
                    : `${diff.toLocaleString('vi-VN')}đ`}
                </span>
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN: METHODS GRID + NUMPAD (col-span-7) ================= */}
          <div className="md:col-span-7 p-4 space-y-3.5 flex flex-col justify-between">
            {/* Upper: Grid of available payment methods */}
            <div className="space-y-2">
              <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Chọn các phương thức thanh toán:
              </span>

              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map((m) => {
                  const isSelected = selectedCodes.includes(m.methodCode);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleToggleMethod(m.methodCode)}
                      className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer min-h-[70px] ${
                        isSelected
                          ? isDarkMode
                            ? 'bg-red-950/30 border-[#da251d] ring-1 ring-[#da251d]/50 text-red-300'
                            : 'bg-red-50 border-[#da251d] ring-1 ring-red-200 text-[#da251d] font-bold'
                          : isDarkMode
                          ? 'bg-[#1e2738] border-[#2c374c] hover:bg-[#253046] text-slate-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {/* Checkmark Badge at top-right */}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-[#da251d] rounded-full flex items-center justify-center text-white shadow-2xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}

                      <div className="mb-1">{getMethodIcon(m)}</div>
                      <span className="text-[11px] font-semibold leading-tight line-clamp-1">
                        {m.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lower: Touch Numeric Keypad */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className={`font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Nhập số tiền cho:{' '}
                  <span className="font-bold text-[#da251d] dark:text-red-400">
                    {getMethod(activeMethodCode)?.name || activeMethodCode || 'Chưa chọn'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleNumpad('FILL_REMAINING')}
                  className="text-[#da251d] dark:text-red-400 hover:underline font-bold cursor-pointer"
                >
                  Điền số tiền còn thiếu
                </button>
              </div>

              {/* Numpad 4x4 Grid matching Sapo POS */}
              <div className="grid grid-cols-4 gap-1.5">
                {/* Row 1 */}
                <button
                  type="button"
                  onClick={() => handleNumpad('7')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-white border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('8')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-white border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('9')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-white border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('DEL')}
                  className={`h-11 rounded-xl font-bold transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center border ${
                    isDarkMode
                      ? 'bg-[#2a374e] hover:bg-[#344460] text-amber-400 border-[#2c374c]'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                  }`}
                  title="Xóa ký tự cuối"
                >
                  <Delete className="w-5 h-5" />
                </button>

                {/* Row 2 */}
                <button
                  type="button"
                  onClick={() => handleNumpad('4')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-white border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('5')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-white border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('6')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-white border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('FILL_REMAINING')}
                  className={`h-11 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center border text-center leading-tight px-1 ${
                    isDarkMode
                      ? 'bg-red-950/40 hover:bg-red-900/40 text-red-300 border-red-800'
                      : 'bg-red-50 hover:bg-red-100 text-[#da251d] border-red-200'
                  }`}
                >
                  Điền nốt
                </button>

                {/* Row 3 */}
                <button
                  type="button"
                  onClick={() => handleNumpad('1')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-white border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('2')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-white border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('3')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-white border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('C')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 border-rose-900/80'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                  }`}
                  title="Xóa về 0"
                >
                  C
                </button>

                {/* Row 4 */}
                <button
                  type="button"
                  onClick={() => handleNumpad('000')}
                  className={`h-11 rounded-xl text-sm font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-slate-200 border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  000
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpad('0')}
                  className={`h-11 rounded-xl text-base font-bold font-mono transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-white border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const half = Math.floor(grandTotal / 2);
                    if (selectedCodes.length === 2) {
                      setSplitAmounts({
                        [selectedCodes[0]]: half,
                        [selectedCodes[1]]: grandTotal - half,
                      });
                    } else if (activeMethodCode) {
                      setSplitAmounts((prev) => ({ ...prev, [activeMethodCode]: half }));
                    }
                  }}
                  className={`h-11 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                    isDarkMode
                      ? 'bg-[#222d40] hover:bg-[#2a3850] text-slate-200 border-[#2c374c]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                  title="Chia đôi 50%"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeMethodCode) {
                      setSplitAmounts({ [activeMethodCode]: grandTotal });
                    }
                  }}
                  className={`h-11 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 border text-center ${
                    isDarkMode
                      ? 'bg-[#2a374e] hover:bg-[#344460] text-emerald-400 border-[#2c374c]'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  Toàn bộ
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================= FOOTER: BIG SAVE BUTTON ================= */}
        <div
          className={`p-3.5 border-t shrink-0 ${
            isDarkMode ? 'bg-[#1e2738] border-[#2c374c]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={totalAllocated < grandTotal}
            className={`w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wide text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-99 ${
              totalAllocated < grandTotal
                ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60'
                : 'bg-[#da251d] hover:bg-[#b81d16] shadow-red-500/20'
            }`}
          >
            <Check className="w-5 h-5 stroke-[3]" />
            <span>
              {totalAllocated < grandTotal
                ? `CÒN THIẾU ${(grandTotal - totalAllocated).toLocaleString('vi-VN')}đ - VUI LÒNG ĐIỀN ĐỦ`
                : `LƯU VÀ ÁP DỤNG (${totalAllocated.toLocaleString('vi-VN')}đ)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

