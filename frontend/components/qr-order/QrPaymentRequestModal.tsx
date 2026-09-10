'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { QrPaymentMethod } from './qr-types';
import toast from 'react-hot-toast';

interface QrPaymentRequestModalProps {
  isOpen: boolean;
  token: string;
  totalAmount: number;
  onClose: () => void;
}

export const QrPaymentRequestModal: React.FC<QrPaymentRequestModalProps> = ({
  isOpen,
  token,
  totalAmount,
  onClose,
}) => {
  const [paymentMethods, setPaymentMethods] = useState<QrPaymentMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payosCheckoutUrl, setPayosCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchMethods = async () => {
      setIsLoadingMethods(true);
      try {
        const res = await fetch(`/api/qr-order/${token}/payment-methods`);
        const data = await res.json();
        if (isMounted && data.success && data.methods) {
          setPaymentMethods(data.methods);
          if (data.methods.length > 0) {
            setSelectedMethod(data.methods[0].methodCode);
          }
        }
      } catch (err) {
        console.error('Lỗi tải phương thức thanh toán', err);
      } finally {
        if (isMounted) setIsLoadingMethods(false);
      }
    };

    fetchMethods();
    return () => {
      isMounted = false;
    };
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleRequestPayment = async () => {
    if (!selectedMethod) {
      toast.error('Vui lòng chọn phương thức thanh toán');
      return;
    }

    setIsSubmitting(true);
    try {
      const deviceSessionId =
        (typeof window !== 'undefined' && localStorage.getItem('avora_qr_device_id')) || 'guest-device';

      const res = await fetch(`/api/qr-order/${token}/payment-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodCode: selectedMethod,
          deviceSessionId,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi gửi yêu cầu thanh toán');
      }

      if (data.request?.checkoutUrl || data.data?.checkoutUrl) {
        setPayosCheckoutUrl(data.request?.checkoutUrl || data.data?.checkoutUrl);
        toast.success('Đã tạo mã QR thanh toán PayOS');
      } else {
        toast.success('Đã gửi yêu cầu thanh toán tới thu ngân!');
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi yêu cầu thanh toán');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMethodIcon = (method: QrPaymentMethod) => {
    if (method.iconUrl) {
      return (
        <div className="w-8 h-8 rounded-xl relative overflow-hidden bg-slate-100 shrink-0">
          <Image src={method.iconUrl} alt={method.name} fill className="object-contain" />
        </div>
      );
    }
    if (method.methodCode === 'CASH') {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Banknote className="w-5 h-5" />
        </div>
      );
    }
    if (method.methodCode === 'PAYOS' || method.gatewayType === 'PAYOS') {
      return (
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <QrCode className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
        <CreditCard className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl my-auto space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Gọi thanh toán</h3>
              <p className="text-[11px] text-slate-400">
                Tổng hóa đơn: <strong className="text-[#da251d] font-mono">{totalAmount.toLocaleString('vi-VN')}đ</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* If PayOS checkout url generated */}
        {payosCheckoutUrl ? (
          <div className="space-y-4 text-center py-2">
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-blue-600 mx-auto" />
              <h4 className="text-sm font-black text-slate-900">Liên kết thanh toán trực tuyến</h4>
              <p className="text-xs text-slate-500">
                Nhấn bên dưới để chuyển sang cổng thanh toán bảo mật PayOS
              </p>
            </div>

            <a
              href={payosCheckoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all"
            >
              <span>MỞ CỔNG THANH TOÁN PAYOS</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Đóng cửa sổ
            </button>
          </div>
        ) : (
          <>
            {/* Payment Methods List from DB */}
            <div className="space-y-2.5">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wide block">
                Chọn phương thức thanh toán
              </label>

              {isLoadingMethods ? (
                <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#da251d]" />
                  <span className="text-xs">Đang tải phương thức thanh toán...</span>
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 text-center">
                  Vui lòng liên hệ trực tiếp nhân viên phục vụ tại bàn.
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentMethods.map((method) => {
                    const isSelected = selectedMethod === method.methodCode;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedMethod(method.methodCode)}
                        className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-400 text-slate-900 ring-1 ring-blue-400/30'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {getMethodIcon(method)}
                          <div>
                            <span className="text-xs font-black block">{method.name}</span>
                            <span className="text-[10px] text-slate-400">
                              {method.description ||
                                (method.methodCode === 'CASH'
                                  ? 'Thanh toán trực tiếp với nhân viên'
                                  : method.methodCode === 'PAYOS'
                                  ? 'Quét QR thanh toán trực tuyến'
                                  : 'Nhân viên mang máy POS đến bàn')}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Note input */}
            <div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú thêm (VD: Xuất hóa đơn VAT...)"
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-blue-400 focus:bg-white text-xs outline-none transition-all"
              />
            </div>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleRequestPayment}
              disabled={isSubmitting || !selectedMethod}
              className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
            >
              <span>{isSubmitting ? 'ĐANG GỬI...' : 'GỬI YÊU CẦU THANH TOÁN'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
