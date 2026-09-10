'use client';

import React, { useState } from 'react';
import { Ticket, Copy, Check, Sparkles, Clock, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export interface ArticleVoucherItem {
  id: string;
  articleId: string;
  voucherId: string;
  customNote?: string | null;
  voucher: {
    id: string;
    code: string;
    title?: string | null;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    discountValue: number;
    maxDiscount?: number | null;
    minOrderValue?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    isActive: boolean;
  };
}

interface RelatedVouchersProps {
  articleId: string;
  vouchers: ArticleVoucherItem[];
}

export default function RelatedVouchers({ articleId, vouchers }: RelatedVouchersProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!vouchers || vouchers.length === 0) return null;

  const handleVoucherClick = (voucherId: string) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      fetch(`${baseUrl}/api/articles/${articleId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventType: 'VOUCHER_CLICK',
          metadata: { voucherId },
        }),
      }).catch(() => {});
    } catch {
      // Non-blocking
    }
  };

  const handleCopy = (code: string, voucherId: string) => {
    handleVoucherClick(voucherId);
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Đã sao chép mã ưu đãi: ${code}!`);
    setTimeout(() => {
      setCopiedCode(null);
    }, 3000);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(dateStr));
    } catch {
      return null;
    }
  };

  return (
    <div className="my-8 p-4 sm:p-6 bg-gradient-to-br from-red-500/10 via-amber-500/5 to-rose-500/10 rounded-3xl border border-red-200/70 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm">
            <Ticket size={16} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
              Mã ưu đãi độc quyền <Sparkles size={14} className="text-amber-500" />
            </h3>
            <p className="text-xs text-slate-500">Áp dụng ngay khi thanh toán đơn hàng</p>
          </div>
        </div>
      </div>

      {/* Voucher Cards: Mobile Horizontal Swipe Scroll, Desktop Grid */}
      <div className="flex overflow-x-auto md:grid md:grid-cols-2 gap-3.5 pb-2 md:pb-0 custom-scrollbar snap-x snap-mandatory md:overflow-visible">
        {vouchers.map(({ voucher, customNote }) => {
          const discountLabel =
            voucher.discountType === 'PERCENTAGE'
              ? `Giảm ${voucher.discountValue}%`
              : `Giảm ${formatCurrency(voucher.discountValue)}`;

          const isCopied = copiedCode === voucher.code;
          const endDateFormatted = formatDate(voucher.endDate);

          return (
            <div
              key={voucher.id}
              className="relative bg-white rounded-2xl p-4 border border-dashed border-red-300 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden min-w-[260px] max-w-[290px] md:min-w-0 md:max-w-none snap-start shrink-0 md:shrink"
            >
              {/* Left Notch / Stamp decor */}
              <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-50 border-r border-red-200" />
              <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-50 border-l border-red-200" />

              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block font-black text-base sm:text-lg text-red-600 tracking-tight">
                      {discountLabel}
                    </span>
                    {voucher.title && (
                      <h4 className="font-semibold text-xs sm:text-sm text-slate-800 mt-0.5 line-clamp-1">
                        {voucher.title}
                      </h4>
                    )}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                    {voucher.isActive ? 'Đang hiệu lực' : 'Hết hạn'}
                  </span>
                </div>

                {customNote && (
                  <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100 italic line-clamp-2">
                    {customNote}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                  {voucher.minOrderValue ? (
                    <span>Đơn tối thiểu: {formatCurrency(voucher.minOrderValue)}</span>
                  ) : null}
                  {endDateFormatted && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> HSD: {endDateFormatted}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <div className="bg-red-50/80 px-2.5 py-1 rounded-lg border border-red-100 text-red-700 font-mono font-bold text-xs">
                  {voucher.code}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(voucher.code, voucher.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                    isCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white hover:shadow-xs'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <Check size={13} strokeWidth={2.5} /> Đã sao chép
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> Sao chép mã
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
