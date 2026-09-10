"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt, Info, ShieldCheck } from 'lucide-react';

export interface TaxGroupItem {
  name: string;
  quantity: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface TaxRateGroup {
  rate: number;
  taxableAmount: number;
  taxAmount: number;
  items: TaxGroupItem[];
}

interface TaxBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxBreakdown: TaxRateGroup[];
  totalTaxAmount: number;
  vatPriceMode: 'VAT_INCLUDED' | 'VAT_EXCLUDED' | string;
}

export default function TaxBreakdownModal({
  isOpen,
  onClose,
  taxBreakdown = [],
  totalTaxAmount = 0,
  vatPriceMode = 'VAT_INCLUDED',
}: TaxBreakdownModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const isIncluded = vatPriceMode === 'VAT_INCLUDED';

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-200 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Receipt size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">Chi tiết thuế VAT</h3>
              <p className="text-xs text-slate-500">Thuế giá trị gia tăng áp dụng cho đơn hàng</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice Badge */}
        <div className={`px-5 py-3 text-xs leading-relaxed flex items-start gap-2.5 shrink-0 ${
          isIncluded ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100' : 'bg-amber-50 text-amber-900 border-b border-amber-100'
        }`}>
          <Info size={16} className={`shrink-0 mt-0.5 ${isIncluded ? 'text-emerald-600' : 'text-amber-600'}`} />
          <span>
            {isIncluded
              ? 'Thuế VAT đã được bao gồm trong giá bán của từng món ăn và không làm tăng thêm tổng thanh toán.'
              : 'Thuế VAT được tính theo mức thuế áp dụng cho từng sản phẩm và cộng trực tiếp vào tổng thanh toán.'}
          </span>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 divide-y divide-slate-100">
          {taxBreakdown.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Không có sản phẩm nào chịu thuế trong đơn hàng.
            </div>
          ) : (
            taxBreakdown.map((group) => (
              <div key={group.rate} className="pt-3 first:pt-0 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                    Thuế suất {group.rate}%
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Thuế: <strong className="text-slate-800">{group.taxAmount.toLocaleString('vi-VN')}₫</strong>
                  </span>
                </div>

                <div className="space-y-2 bg-slate-50/80 rounded-xl p-3 border border-slate-100 text-xs">
                  {group.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">
                          {item.quantity}x {item.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Giá tính thuế: {item.taxableAmount.toLocaleString('vi-VN')}₫
                        </p>
                      </div>
                      <span className="font-bold text-slate-700 shrink-0">
                        {item.taxAmount.toLocaleString('vi-VN')}₫
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-xs font-bold px-1 text-slate-700">
                  <span>Tổng VAT {group.rate}%:</span>
                  <span className="text-red-600">{group.taxAmount.toLocaleString('vi-VN')}₫</span>
                </div>
              </div>
            ))
          )}

          {/* Quy định VAT cước vận chuyển */}
          <div className="pt-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 flex items-center gap-1">
                <ShieldCheck size={13} className="text-slate-400" /> Lưu ý về phí vận chuyển:
              </p>
              <p className="leading-relaxed">
                • Thuế GTGT chỉ tính trên các món ăn/thức uống do nhà hàng sản xuất và cung cấp. Cước phí vận chuyển do đối tác thứ ba (GrabExpress / Ahamove) thực hiện độc lập nên không bao gồm trong hóa đơn thuế VAT của nhà hàng.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Summary */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs text-slate-500 font-medium">Tổng tiền thuế VAT</p>
            <p className="text-lg font-black text-red-600">{totalTaxAmount.toLocaleString('vi-VN')}₫</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

