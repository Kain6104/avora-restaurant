"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Truck, CheckCircle2, Sparkles, AlertCircle, ShieldCheck } from 'lucide-react';

interface FreeShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  freeShippingQualified: boolean;
  freeShippingThreshold: number;
  freeShippingEligibleAmount: number;
  freeShippingRemainingAmount: number;
  shippingDiscountSource?: string;
}

export default function FreeShippingModal({
  isOpen,
  onClose,
  freeShippingQualified,
  freeShippingThreshold = 500000,
  freeShippingEligibleAmount = 0,
  freeShippingRemainingAmount = 0,
  shippingDiscountSource = 'NONE',
}: FreeShippingModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const progressPercent = freeShippingThreshold > 0
    ? Math.min(100, Math.round((freeShippingEligibleAmount / freeShippingThreshold) * 100))
    : 100;

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className="relative w-full sm:max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-200 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              freeShippingQualified ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
            }`}>
              <Truck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">Chính sách miễn phí vận chuyển</h3>
              <p className="text-xs text-slate-500">Ưu đãi giao hàng của AVORA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {freeShippingQualified ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <h4 className="font-bold text-sm">Miễn phí vận chuyển đã được áp dụng</h4>
              </div>
              <p className="text-xs leading-relaxed text-emerald-800">
                Đơn hàng của bạn đã đủ điều kiện nhận ưu đãi vận chuyển miễn phí (Giá trị tính hưởng ưu đãi:{' '}
                <strong>{freeShippingEligibleAmount.toLocaleString('vi-VN')}₫</strong> / Ngưỡng:{' '}
                <strong>{freeShippingThreshold.toLocaleString('vi-VN')}₫</strong>).
              </p>
              {shippingDiscountSource === 'ORDER_THRESHOLD' && (
                <span className="inline-block text-[11px] font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full mt-1">
                  Đạt ngưỡng đơn hàng tự động
                </span>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-600 shrink-0" />
                <h4 className="font-bold text-sm text-amber-900">Bạn sắp được miễn phí vận chuyển!</h4>
              </div>
              <p className="text-xs leading-relaxed text-amber-800">
                Chỉ cần thêm <strong>{freeShippingRemainingAmount.toLocaleString('vi-VN')}₫</strong> vào đơn hàng để nhận ưu đãi miễn phí vận chuyển toàn bộ tiền ship.
              </p>

              {/* Progress bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] font-bold text-amber-900">
                  <span>{freeShippingEligibleAmount.toLocaleString('vi-VN')}₫</span>
                  <span>Ngưỡng: {freeShippingThreshold.toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="w-full h-2.5 bg-amber-200/70 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Điều kiện tính */}
          <div className="text-[11px] text-slate-500 space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <p className="font-bold text-slate-700 flex items-center gap-1.5">
              <AlertCircle size={14} className="text-slate-400" /> Lưu ý điều kiện tính:
            </p>
            <p className="leading-relaxed">• Giá trị xét miễn phí ship dựa trên tiền hàng sau giảm giá món/Flash Sale và trước phí ship.</p>
            <p className="leading-relaxed">• Không áp dụng đồng thời gây tiêu hao lãng phí mã Freeship nếu đơn đã đạt ngưỡng tự động.</p>
          </div>

          {/* Quy định thuế GTGT đối với bên thứ 3 vận chuyển */}
          <div className="text-[11px] text-slate-600 space-y-1.5 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/60">
            <p className="font-bold text-amber-900 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-amber-700" /> Quy định xuất hóa đơn GTGT (VAT) cước vận chuyển:
            </p>
            <p className="leading-relaxed text-slate-600">
              • Dịch vụ giao nhận được thực hiện bởi đối tác vận chuyển thứ ba độc lập (Ahamove / GrabExpress).
            </p>
            <p className="leading-relaxed text-slate-600">
              • Cước phí vận chuyển là khoản phí dịch vụ chi trả trực tiếp cho đơn vị vận chuyển. Nhà hàng chỉ phát hành hóa đơn giá trị gia tăng (VAT) cho phần tiền thức ăn và đồ uống, <strong>không xuất hóa đơn thuế GTGT đối với cước phí vận chuyển</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#da251d] hover:bg-[#b91c2c] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

