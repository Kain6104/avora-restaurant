'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Loader2 } from 'lucide-react';

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  recipientName: string;
  phone: string;
  address: string;
  deliveryTimeText: string;
  discountVoucherText?: string;
  shippingVoucherText?: string;
  paymentMethodText: string;
}

export default function OrderConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  recipientName,
  phone,
  address,
  deliveryTimeText,
  discountVoucherText = 'Không sử dụng',
  shippingVoucherText = 'Không sử dụng',
  paymentMethodText,
}: OrderConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={isSubmitting ? undefined : onClose}
      />

      {/* Modal Card */}
      <div
        className="relative bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-in zoom-in-95 duration-200 my-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ShieldCheck size={18} strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Xác nhận đơn hàng
            </h3>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-xs text-slate-500 font-normal leading-relaxed -mt-1">
          Vui lòng kiểm tra kỹ thông tin giao hàng bên dưới trước khi chốt đơn.
        </p>

        {/* Gray Review Card */}
        <div className="bg-[#f8f9fa] rounded-2xl p-4 sm:p-5 border border-slate-100 text-xs sm:text-[13px] space-y-3">
          
          {/* Người nhận */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-500 shrink-0">Người nhận:</span>
            <span className="font-extrabold text-slate-900 text-right">{recipientName || 'Chưa cập nhật'}</span>
          </div>

          {/* Điện thoại */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-500 shrink-0">Điện thoại:</span>
            <span className="font-extrabold text-slate-900 text-right tracking-wide">{phone || 'Chưa cập nhật'}</span>
          </div>

          {/* Địa chỉ giao */}
          <div className="space-y-1">
            <span className="text-slate-500 block">Địa chỉ giao:</span>
            <p className="font-extrabold text-slate-900 text-right leading-snug break-words">
              {address || 'Chưa chọn địa chỉ'}
            </p>
          </div>

          <div className="border-t border-slate-200/80 my-2" />

          {/* Giao lúc */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-500 shrink-0">Giao lúc:</span>
            <span className="font-black text-red-600 text-right">
              {deliveryTimeText || 'Sớm nhất có thể'}
            </span>
          </div>

          {/* Voucher giảm giá */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-500 shrink-0">Voucher giảm giá:</span>
            <span className="font-bold text-red-600 text-right">
              {discountVoucherText}
            </span>
          </div>

          {/* Voucher Freeship */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-500 shrink-0">Voucher Freeship:</span>
            <span className="font-bold text-emerald-600 text-right">
              {shippingVoucherText}
            </span>
          </div>

          {/* Thanh toán */}
          <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/80">
            <span className="text-slate-500 shrink-0">Thanh toán:</span>
            <span className="font-black text-slate-900 text-right">
              {paymentMethodText || 'Chưa chọn'}
            </span>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm text-center transition-colors cursor-pointer disabled:opacity-50"
          >
            Kiểm tra lại
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-full bg-[#da251d] hover:bg-[#b91c2c] text-white font-black text-xs sm:text-sm text-center shadow-lg shadow-[#da251d]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <span>Xác Nhận Đặt Hàng</span>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
