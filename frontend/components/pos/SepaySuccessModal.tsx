"use client";

import React, { useState } from 'react';
import {
  CheckCircle2,
  Printer,
  X,
  CreditCard,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  Layers,
  Check,
} from 'lucide-react';

export interface SepaySuccessModalData {
  orderId: string;
  orderCode: string;
  temporaryOrderCode?: string;
  tableName?: string;
  amount: number;
  paidAt?: string | Date;
  transactionCode?: string;
  cashierName?: string;
}

interface SepaySuccessModalProps {
  isOpen: boolean;
  data: SepaySuccessModalData | null;
  onClose: () => void;
  onPrintReceipt: (orderId: string) => Promise<void> | void;
  isDarkMode?: boolean;
}

export function formatVietnameseDateTime(dateArg?: Date | string | number): string {
  const d = dateArg ? new Date(dateArg) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

export const SepaySuccessModal: React.FC<SepaySuccessModalProps> = ({
  isOpen,
  data,
  onClose,
  onPrintReceipt,
  isDarkMode = false,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !data) return null;

  const displayOrderCode = data.orderCode || data.temporaryOrderCode || 'ĐƠN HÀNG';
  const displayTableName = data.tableName || 'Bàn dùng tại chỗ';
  const displayAmount = (Number(data.amount) || 0).toLocaleString('vi-VN');
  const formattedPaidAt = formatVietnameseDateTime(data.paidAt);

  const handlePrintClick = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      await onPrintReceipt(data.orderId);
    } catch (e) {
      console.error('Lỗi khi in hóa đơn:', e);
    } finally {
      setIsPrinting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 select-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full max-w-md rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Banner */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 px-6 pt-7 pb-6 text-white text-center overflow-hidden">
          {/* Subtle Ambient Rings */}
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>

          {/* Animated Success Badge */}
          <div className="relative inline-flex items-center justify-center mb-3">
            <div className="w-16 h-16 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-950/20 ring-4 ring-white/30 animate-in zoom-in-75 duration-300">
              <CheckCircle2 size={36} className="text-emerald-600 stroke-[2.4]" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs">
              <Sparkles size={11} className="fill-slate-950 text-slate-950" />
            </span>
          </div>

          <h2 className="text-xl font-black uppercase tracking-tight">
            Thanh toán thành công!
          </h2>
          <p className="text-xs text-emerald-50 mt-1 font-medium">
            SePay VietQR đã xác nhận khớp lệnh chuyển khoản ngân hàng tự động
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Highlighted Amount Box */}
          <div className={`p-4 rounded-2xl border text-center flex flex-col items-center justify-center ${
            isDarkMode
              ? 'bg-emerald-950/30 border-emerald-900/60'
              : 'bg-emerald-50/70 border-emerald-200/80'
          }`}>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              isDarkMode ? 'text-emerald-400' : 'text-emerald-800'
            }`}>
              Tổng số tiền đã thanh toán
            </span>
            <div className={`text-3xl font-black font-mono tracking-tight mt-0.5 ${
              isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
            }`}>
              {displayAmount} <span className="text-lg font-bold">đ</span>
            </div>
          </div>

          {/* Details Table Card */}
          <div className={`rounded-2xl border p-3.5 space-y-2.5 text-xs ${
            isDarkMode
              ? 'bg-slate-800/60 border-slate-750'
              : 'bg-slate-50 border-slate-200/70'
          }`}>
            {/* Table Name */}
            <div className="flex items-center justify-between">
              <span className={`font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Layers size={13} className="text-slate-400" />
                Vị trí phục vụ
              </span>
              <span className={`font-bold px-2.5 py-0.5 rounded-lg border shadow-2xs ${
                isDarkMode ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-200/70'
              }`}>
                {displayTableName}
              </span>
            </div>

            {/* Order Code */}
            <div className="flex items-center justify-between">
              <span className={`font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <CreditCard size={13} className="text-slate-400" />
                Mã đơn hàng
              </span>
              <span className={`font-mono font-black px-2 py-0.5 rounded-lg border ${
                isDarkMode ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-200/70'
              }`}>
                {displayOrderCode}
              </span>
            </div>

            {/* Transaction Ref */}
            {data.transactionCode && (
              <div className="flex items-center justify-between">
                <span className={`font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Sparkles size={13} className="text-slate-400" />
                  Mã GD SePay
                </span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded-md border ${
                  isDarkMode
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-900/70'
                    : 'bg-emerald-100/70 text-emerald-800 border-emerald-200'
                }`}>
                  {data.transactionCode}
                </span>
              </div>
            )}

            {/* Time hh:mm:ss dd/mm/yyyy */}
            <div className={`flex items-center justify-between pt-1 border-t ${
              isDarkMode ? 'border-slate-700/60' : 'border-slate-200/60'
            }`}>
              <span className={`font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Clock size={13} className="text-slate-400" />
                Thời gian giao dịch
              </span>
              <span className={`font-mono font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                {formattedPaidAt}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Không in hóa đơn | In hóa đơn */}
        <div className={`p-4 sm:p-5 border-t flex items-center gap-3 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/80 border-slate-100'
        }`}>
          {/* Button 1: Không in hóa đơn */}
          <button
            type="button"
            onClick={onClose}
            disabled={isPrinting}
            className={`flex-1 py-3 px-4 rounded-xl border font-bold text-xs sm:text-sm transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer disabled:opacity-50 text-center ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            Không in hóa đơn
          </button>

          {/* Button 2: In hóa đơn */}
          <button
            type="button"
            onClick={handlePrintClick}
            disabled={isPrinting}
            className="flex-1 py-3 px-4 rounded-xl bg-[#da251d] hover:bg-[#b81d16] text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-red-600/20 active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 text-center"
          >
            <Printer size={15} />
            {isPrinting ? 'Đang gửi in...' : 'In hóa đơn'}
          </button>
        </div>
      </div>
    </div>
  );
};

