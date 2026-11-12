"use client";

import React, { useState, useEffect } from 'react';
import { X, Users } from 'lucide-react';
import ResponsiveModal from '@/components/ui/ResponsiveModal';

interface GuestCountModalProps {
  isOpen: boolean;
  currentCount: number;
  onClose: () => void;
  onConfirm: (count: number) => void;
  isDarkMode?: boolean;
}

export const GuestCountModal: React.FC<GuestCountModalProps> = ({
  isOpen,
  currentCount = 1,
  onClose,
  onConfirm,
  isDarkMode = false,
}) => {
  const [valStr, setValStr] = useState<string>('1');

  useEffect(() => {
    if (isOpen) {
      setValStr(String(Math.max(1, currentCount || 1)));
    }
  }, [isOpen, currentCount]);

  const handleDigit = (digit: string) => {
    setValStr((prev) => {
      if (prev === '0' || prev === '1') {
        return digit;
      }
      if (prev.length >= 3) return prev;
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
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="Số khách"
      subtitle="Nhập số lượng khách vào bàn"
      icon={<Users size={18} className="text-[#0080ff]" />}
      maxWidth="sm"
    >
      <div className="space-y-3 py-1">
        {/* Display Input Area */}
        <div className={`border rounded-xl px-4 py-2 flex items-center justify-end min-h-[50px] shadow-inner ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
            isDarkMode ? 'text-white' : 'text-slate-800'
          }`}>
            {valStr}
          </span>
        </div>

        {/* Touch Keypad Grid: 4 columns x 4 rows */}
        <div className="grid grid-cols-4 gap-2">
          {/* Row 1: 7, 8, 9, Backspace */}
          {['7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className={`h-12 border rounded-xl text-base font-bold shadow-2xs transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750 active:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className={`h-12 border rounded-xl transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-rose-400 hover:bg-slate-750'
                : 'bg-white border-slate-200 text-rose-500 hover:bg-rose-50'
            }`}
            title="Xóa ký tự cuối"
          >
            <div className="w-6 h-5 bg-rose-500/80 rounded flex items-center justify-center text-white shadow-xs">
              <X className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </button>

          {/* Row 2: 4, 5, 6, C */}
          {['4', '5', '6'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className={`h-12 border rounded-xl text-base font-bold shadow-2xs transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750 active:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className={`h-12 border rounded-xl text-base font-bold shadow-2xs transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
            title="Xóa tất cả"
          >
            C
          </button>

          {/* Row 3: 1, 2, 3 and ĐỒNG Ý (spans 2 rows) */}
          {['1', '2', '3'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className={`h-12 border rounded-xl text-base font-bold shadow-2xs transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750 active:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              {digit}
            </button>
          ))}

          {/* Tall 'ĐỒNG Ý' button spanning Row 3 and Row 4 */}
          <button
            type="button"
            onClick={handleSubmit}
            className="row-span-2 bg-[#0080ff] hover:bg-[#0070e0] active:bg-[#0060c0] active:scale-[0.98] text-white rounded-xl font-black text-xs sm:text-sm tracking-wide shadow-md transition-all flex items-center justify-center cursor-pointer"
          >
            ĐỒNG Ý
          </button>

          {/* Row 4: 0 (spans 3 columns) */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className={`col-span-3 h-12 border rounded-xl text-base font-bold shadow-2xs transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750 active:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 active:bg-slate-100'
            }`}
          >
            0
          </button>
        </div>
      </div>
    </ResponsiveModal>
  );
};
