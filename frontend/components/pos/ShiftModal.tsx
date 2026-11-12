"use client";

import React, { useState } from 'react';
import { X, DollarSign, Calculator, Lock, Unlock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PosCashShift } from './pos-types';

interface ShiftModalProps {
  branchId: string;
  activeShift: PosCashShift | null;
  onClose: () => void;
  onOpenShift: (openingBalance: number, note?: string) => Promise<void>;
  onCloseShift: (closingBalance: number, note?: string) => Promise<void>;
  isProcessing?: boolean;
  onOpenEndOfDayReport?: () => void;
  isDarkMode?: boolean;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  branchId,
  activeShift,
  onClose,
  onOpenShift,
  onCloseShift,
  isProcessing = false,
  onOpenEndOfDayReport,
  isDarkMode = false,
}) => {
  const isShiftOpen = !!activeShift && activeShift.status === 'OPEN';

  const [openingBalanceStr, setOpeningBalanceStr] = useState('2000000'); // default 2,000,000 VND
  const [closingBalanceStr, setClosingBalanceStr] = useState('');
  const [note, setNote] = useState('');

  const openingBalance = parseInt(openingBalanceStr || '0', 10);
  const closingBalance = parseInt(closingBalanceStr || '0', 10);

  const expectedCashBalance = activeShift
    ? activeShift.openingBalance + activeShift.totalCash
    : 0;

  const cashDifference = closingBalanceStr ? closingBalance - expectedCashBalance : 0;

  const handleOpenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onOpenShift(openingBalance, note.trim() || undefined);
    onClose();
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCloseShift(closingBalance, note.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className={`rounded-t-3xl sm:rounded-2xl shadow-2xl border max-w-md w-full overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 sm:animate-in sm:zoom-in-95 ${
        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-gray-50/50 border-gray-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isShiftOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isShiftOpen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </div>
            <div>
              <h3 className={`text-sm font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {isShiftOpen ? 'Kết ca làm việc (Đóng ca)' : 'Mở ca làm việc thu ngân'}
              </h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {isShiftOpen ? 'Kiểm đếm tiền két và bàn giao ca' : 'Nhập tiền mặt đầu ca để bắt đầu bán hàng'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!isShiftOpen ? (
          /* OPEN SHIFT FORM */
          <form onSubmit={handleOpenSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Tiền mặt đầu ca (Tiền thối két ban đầu):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1000"
                  min="0"
                  required
                  value={openingBalanceStr}
                  onChange={(e) => setOpeningBalanceStr(e.target.value)}
                  className={`w-full text-base font-bold rounded-xl px-3 py-2.5 outline-none font-mono border ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-[#da251d]'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#da251d] focus:bg-white'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  VND
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {[1000000, 2000000, 3000000, 5000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningBalanceStr(amt.toString())}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {(amt / 1000000).toLocaleString('vi-VN')} triệu
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Ghi chú ca mở:</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Nhận két từ ca sáng đầy đủ..."
                className={`w-full text-xs rounded-xl px-3 py-2 outline-none border ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-[#da251d]'
                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#da251d] focus:bg-white'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-300 text-white py-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer"
            >
              {isProcessing ? 'Đang mở ca...' : 'XÁC NHẬN MỞ CA BÁN HÀNG'}
            </button>
          </form>
        ) : (
          /* CLOSE SHIFT FORM */
          <form onSubmit={handleCloseSubmit} className="p-5 space-y-4">
            {/* Shift Summary */}
            <div className={`p-3.5 rounded-xl border space-y-2 text-xs ${
              isDarkMode ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}>
              <div className="flex justify-between">
                <span>Tiền đầu ca:</span>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {activeShift.openingBalance.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex justify-between">
                <span>Doanh thu tiền mặt:</span>
                <span className="font-bold text-emerald-500">
                  +{activeShift.totalCash.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex justify-between">
                <span>Doanh thu chuyển khoản / thẻ:</span>
                <span className="font-bold text-blue-500">
                  +{(activeShift.totalTransfer + activeShift.totalCard).toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tổng đơn hàng đã phục vụ:</span>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{activeShift.orderCount} đơn</span>
              </div>
              <div className={`pt-2 border-t flex justify-between items-baseline ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Tiền mặt lý thuyết trong két:</span>
                <span className="text-base font-extrabold text-[#da251d] font-mono">
                  {expectedCashBalance.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Actual Closing Count */}
            <div className="space-y-1.5">
              <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Tiền mặt thực tế đếm được trong két:
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1000"
                  min="0"
                  required
                  placeholder={expectedCashBalance.toString()}
                  value={closingBalanceStr}
                  onChange={(e) => setClosingBalanceStr(e.target.value)}
                  className={`w-full text-base font-bold rounded-xl px-3 py-2.5 outline-none font-mono border ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-[#da251d]'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#da251d] focus:bg-white'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  VND
                </span>
              </div>
            </div>

            {/* Difference Alert */}
            {closingBalanceStr && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                  cashDifference === 0
                    ? isDarkMode ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : cashDifference > 0
                    ? isDarkMode ? 'bg-blue-950/40 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'
                    : isDarkMode ? 'bg-rose-950/40 border-rose-800 text-rose-300' : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {cashDifference === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>
                    {cashDifference === 0
                      ? 'Két khớp 100%'
                      : cashDifference > 0
                      ? 'Thừa tiền két:'
                      : 'Thiếu tiền két:'}
                  </span>
                </div>
                <span className="font-extrabold font-mono text-sm">
                  {cashDifference > 0 ? `+${cashDifference.toLocaleString('vi-VN')}đ` : `${cashDifference.toLocaleString('vi-VN')}đ`}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Ghi chú kết ca:</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Bàn giao két cho ca tối..."
                className={`w-full text-xs rounded-xl px-3 py-2 outline-none border ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-[#da251d]'
                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#da251d] focus:bg-white'
                }`}
              />
            </div>

            {onOpenEndOfDayReport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEndOfDayReport();
                }}
                className={`w-full border py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isDarkMode
                    ? 'bg-red-950/30 hover:bg-red-950/50 text-rose-300 border-red-800'
                    : 'bg-red-50 hover:bg-red-100 text-[#da251d] border-red-200'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Xem chi tiết doanh thu & in phiếu kết ca</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isProcessing || !closingBalanceStr}
              className={`w-full py-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-white'
                  : 'bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white'
              }`}
            >
              {isProcessing ? 'Đang kết ca...' : 'XÁC NHẬN KẾT CA & IN BÁO CÁO'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
