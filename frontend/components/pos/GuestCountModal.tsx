"use client";

import React, { useState, useEffect } from 'react';
import { X, Delete } from 'lucide-react';

interface GuestCountModalProps {
  isOpen: boolean;
  currentCount: number;
  onClose: () => void;
  onConfirm: (count: number) => void;
}

export const GuestCountModal: React.FC<GuestCountModalProps> = ({
  isOpen,
  currentCount = 1,
  onClose,
  onConfirm,
}) => {
  const [valStr, setValStr] = useState<string>('1');

  useEffect(() => {
    if (isOpen) {
      setValStr(String(Math.max(1, currentCount || 1)));
    }
  }, [isOpen, currentCount]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    setValStr((prev) => {
      if (prev === '0' || prev === '1') {
        // If current is just 1 (initial default) and user presses a key, replace it
        return digit;
      }
      if (prev.length >= 3) return prev; // max 999 guests
      return prev + digit;
    });
  };

  const handleClear = () => {
    setValStr('1');
  };

  const handleBackspace = () => {
    setValStr((prev) => {
      if (prev.length <= 1) return '1';
      return prev.slice(0, -1);
    });
  };

  const handleSubmit = () => {
    const finalCount = parseInt(valStr, 10);
    const validCount = isNaN(finalCount) || finalCount <= 0 ? 1 : Math.min(finalCount, 999);
    onConfirm(validCount);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[320px] sm:max-w-[340px] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Blue bar with white title and red close button */}
        <div className="bg-[#0080ff] px-4 py-3 flex items-center justify-between">
          <h3 className="text-white font-extrabold text-base tracking-wide">
            Số khách
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded flex items-center justify-center text-red-600 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5 text-red-600 stroke-[3]" />
          </button>
        </div>

        {/* Body Container */}
        <div className="p-3.5 sm:p-4 bg-white space-y-3">
          {/* Display Input Area */}
          <div className="border border-slate-300 rounded-lg px-3 py-2 bg-white flex items-center justify-end min-h-[50px] shadow-inner">
            <span className="text-2xl sm:text-3xl font-bold text-slate-800 font-mono tracking-tight">
              {valStr}
            </span>
          </div>

          {/* Touch Keypad Grid: 4 columns x 4 rows matching Image 4 */}
          <div className="grid grid-cols-4 gap-2">
            {/* Row 1: 7, 8, 9, Backspace */}
            <button
              type="button"
              onClick={() => handleDigit('7')}
              className="h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              7
            </button>
            <button
              type="button"
              onClick={() => handleDigit('8')}
              className="h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              8
            </button>
            <button
              type="button"
              onClick={() => handleDigit('9')}
              className="h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              9
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-13 bg-white border border-slate-300 rounded-lg text-rose-500 hover:bg-rose-50 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
              title="Xóa ký tự cuối"
            >
              {/* Backspace icon */}
              <div className="w-7 h-5 bg-rose-400/80 rounded-sm flex items-center justify-center text-white shadow-xs">
                <X className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </button>

            {/* Row 2: 4, 5, 6, C */}
            <button
              type="button"
              onClick={() => handleDigit('4')}
              className="h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              4
            </button>
            <button
              type="button"
              onClick={() => handleDigit('5')}
              className="h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              5
            </button>
            <button
              type="button"
              onClick={() => handleDigit('6')}
              className="h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              6
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
              title="Xóa tất cả"
            >
              C
            </button>

            {/* Row 3: 1, 2, 3 and ĐỒNG Ý (spans 2 rows) */}
            <button
              type="button"
              onClick={() => handleDigit('1')}
              className="h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              1
            </button>
            <button
              type="button"
              onClick={() => handleDigit('2')}
              className="h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              2
            </button>
            <button
              type="button"
              onClick={() => handleDigit('3')}
              className="h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              3
            </button>

            {/* Tall 'ĐỒNG Ý' button spanning Row 3 and Row 4 */}
            <button
              type="button"
              onClick={handleSubmit}
              className="row-span-2 bg-[#0080ff] hover:bg-[#0070e0] active:bg-[#0060c0] active:scale-[0.98] text-white rounded-lg font-extrabold text-sm sm:text-base tracking-wide shadow-md transition-all flex items-center justify-center cursor-pointer"
            >
              ĐỒNG Ý
            </button>

            {/* Row 4: 0 (spans 3 columns) */}
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="col-span-3 h-13 bg-white border border-slate-300 rounded-lg text-lg font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-95 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            >
              0
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
