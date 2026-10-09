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
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  branchId,
  activeShift,
  onClose,
  onOpenShift,
  onCloseShift,
  isProcessing = false,
  onOpenEndOfDayReport,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isShiftOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isShiftOpen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">
                {isShiftOpen ? 'Kết ca làm việc (Đóng ca)' : 'Mở ca làm việc thu ngân'}
              </h3>
              <p className="text-[11px] text-gray-500">
                {isShiftOpen ? 'Kiểm đếm tiền két và bàn giao ca' : 'Nhập tiền mặt đầu ca để bắt đầu bán hàng'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!isShiftOpen ? (
          /* OPEN SHIFT FORM */
          <form onSubmit={handleOpenSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">
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
                  className="w-full text-base font-bold bg-gray-50 border border-gray-200 focus:border-[#da251d] focus:bg-white rounded-xl px-3 py-2.5 outline-none font-mono"
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
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    {(amt / 1000000).toLocaleString('vi-VN')} triệu
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Ghi chú ca mở:</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Nhận két từ ca sáng đầy đủ..."
                className="w-full text-xs bg-gray-50 border border-gray-200 focus:border-[#da251d] focus:bg-white rounded-xl px-3 py-2 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-300 text-white py-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-98"
            >
              {isProcessing ? 'Đang mở ca...' : 'XÁC NHẬN MỞ CA BÁN HÀNG'}
            </button>
          </form>
        ) : (
          /* CLOSE SHIFT FORM */
          <form onSubmit={handleCloseSubmit} className="p-5 space-y-4">
            {/* Shift Summary */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Tiền đầu ca:</span>
                <span className="font-bold text-gray-800">
                  {activeShift.openingBalance.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Doanh thu tiền mặt:</span>
                <span className="font-bold text-emerald-600">
                  +{activeShift.totalCash.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Doanh thu chuyển khoản / thẻ:</span>
                <span className="font-bold text-blue-600">
                  +{(activeShift.totalTransfer + activeShift.totalCard).toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tổng đơn hàng đã phục vụ:</span>
                <span className="font-bold text-gray-900">{activeShift.orderCount} đơn</span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline">
                <span className="font-bold text-gray-900">Tiền mặt lý thuyết trong két:</span>
                <span className="text-base font-extrabold text-[#da251d] font-mono">
                  {expectedCashBalance.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Actual Closing Count */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">
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
                  className="w-full text-base font-bold bg-gray-50 border border-gray-200 focus:border-[#da251d] focus:bg-white rounded-xl px-3 py-2.5 outline-none font-mono"
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
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : cashDifference > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {cashDifference === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
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
              <label className="text-xs font-bold text-gray-700">Ghi chú kết ca:</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Bàn giao két cho ca tối..."
                className="w-full text-xs bg-gray-50 border border-gray-200 focus:border-[#da251d] focus:bg-white rounded-xl px-3 py-2 outline-none"
              />
            </div>

            {onOpenEndOfDayReport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEndOfDayReport();
                }}
                className="w-full bg-red-50 hover:bg-red-100 text-[#da251d] border border-red-200 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-[#da251d]" />
                <span>Xem chi tiết doanh thu & in phiếu kết ca</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isProcessing || !closingBalanceStr}
              className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white py-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer"
            >
              {isProcessing ? 'Đang kết ca...' : 'XÁC NHẬN KẾT CA & IN BÁO CÁO'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
