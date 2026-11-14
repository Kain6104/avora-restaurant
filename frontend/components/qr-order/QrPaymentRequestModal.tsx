'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Banknote,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Landmark,
  AlertCircle,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { QrBottomSheet } from './QrBottomSheet';
import { QrPaymentMethod } from './qr-types';
import toast from 'react-hot-toast';

interface QrPaymentRequestModalProps {
  isOpen: boolean;
  token: string;
  totalAmount: number;
  orderCode?: string;
  tableName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QrPaymentRequestModal: React.FC<QrPaymentRequestModalProps> = ({
  isOpen,
  token,
  totalAmount,
  orderCode,
  tableName,
  onClose,
  onSuccess,
}) => {
  const [paymentMethods, setPaymentMethods] = useState<QrPaymentMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedMethod, setSubmittedMethod] = useState<QrPaymentMethod | null>(null);

  const fetchMethods = useCallback(async () => {
    setIsLoadingMethods(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/qr-order/${token}/payment-methods`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể tải phương thức thanh toán');
      }
      const list: QrPaymentMethod[] = data.methods || [];
      setPaymentMethods(list);
      if (list.length > 0) {
        setSelectedCode((prev) =>
          prev && list.some((m) => m.methodCode === prev) ? prev : list[0].methodCode
        );
      } else {
        setSelectedCode('');
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoadingMethods(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isOpen) {
      // Reset submitted state on reopen
      setIsSubmitted(false);
      setSubmittedMethod(null);
      setNote('');
      return;
    }
    void fetchMethods();
  }, [isOpen, fetchMethods]);

  const selectedMethodObj = useMemo(
    () => paymentMethods.find((m) => m.methodCode === selectedCode) || null,
    [paymentMethods, selectedCode]
  );

  const handleRequestPayment = async () => {
    if (!selectedMethodObj) {
      toast.error('Vui lòng chọn phương thức thanh toán');
      return;
    }

    // 1. Kiểm tra mạng
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Không thể gửi yêu cầu, vui lòng thử lại hoặc gọi trực tiếp phục vụ');
      return;
    }

    // 2. Chống spam Cooldown 15 giây
    const COOLDOWN_MS = 15000;
    const lastPaymentTime = Number(
      (typeof window !== 'undefined' && localStorage.getItem('avora_qr_last_payment_time')) || 0
    );
    const elapsed = Date.now() - lastPaymentTime;
    if (elapsed < COOLDOWN_MS) {
      toast('Bạn vừa gửi yêu cầu, vui lòng đợi 15 giây', { icon: '⏳' });
      return;
    }

    setIsSubmitting(true);
    try {
      const deviceSessionId =
        (typeof window !== 'undefined' && localStorage.getItem('avora_qr_device_id')) ||
        'guest-device';

      const res = await fetch(`/api/qr-order/${token}/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PAYMENT',
          paymentMethodCode: selectedMethodObj.methodCode,
          deviceSessionId,
          note: note.trim() || undefined,
        }),
      });

      if (res.status === 401 || res.status === 404) {
        toast.error('Phiên gọi món đã kết thúc');
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể gửi yêu cầu thanh toán');
      }

      if (data.isDuplicate) {
        toast('Đang có yêu cầu chờ phục vụ tiếp nhận, vui lòng đợi trong giây lát', { icon: '⏳' });
        setSubmittedMethod(selectedMethodObj);
        setIsSubmitted(true);
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('avora_qr_last_payment_time', Date.now().toString());
      }

      toast.success('Yêu cầu đã được gửi tới phục vụ');
      setSubmittedMethod(selectedMethodObj);
      setIsSubmitted(true);
      onSuccess?.();
    } catch (err: unknown) {
      toast.error('Không thể gửi yêu cầu, vui lòng thử lại hoặc gọi trực tiếp phục vụ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMethodIcon = (method: QrPaymentMethod) => {
    const code = method.methodCode.toUpperCase();
    const gw = (method.gatewayType || '').toUpperCase();
    if (code === 'CASH' || gw === 'CASH') {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center shrink-0">
          <Banknote className="w-4 h-4" />
        </div>
      );
    }
    if (gw === 'TRANSFER' || code.includes('BANK') || code.includes('TRANSFER')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shrink-0">
          <Landmark className="w-4 h-4" />
        </div>
      );
    }
    if (gw === 'PAYOS' || gw === 'SEPAY_QR') {
      return (
        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center shrink-0">
          <QrCode className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
        <CreditCard className="w-4 h-4" />
      </div>
    );
  };

  const footerNode = isSubmitted ? (
    <button
      type="button"
      onClick={onClose}
      className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all active:scale-[0.99] cursor-pointer"
    >
      Đóng
    </button>
  ) : (
    <button
      type="button"
      onClick={handleRequestPayment}
      disabled={isSubmitting || !selectedMethodObj}
      className="w-full h-11 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
    >
      <span>{isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu thanh toán'}</span>
      <ArrowRight className="w-4 h-4" />
    </button>
  );

  return (
    <QrBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isSubmitted ? 'Yêu cầu thanh toán' : 'Gọi thanh toán'}
      subtitle={
        isSubmitted
          ? tableName ? `Bàn ${tableName}` : undefined
          : `Tạm tính: ${totalAmount.toLocaleString('vi-VN')}đ`
      }
      headerIcon={<CreditCard className="w-4 h-4 text-[#DA251D]" />}
      footer={footerNode}
    >
      {isSubmitted && submittedMethod ? (
        <div className="py-2 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-2xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              ĐÃ GỬI YÊU CẦU THANH TOÁN
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
              Nhân viên sẽ đến bàn hỗ trợ bạn thanh toán.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left text-xs space-y-2">
            {tableName && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Bàn phục vụ:</span>
                <span className="font-bold text-slate-900">{tableName}</span>
              </div>
            )}
            {orderCode && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Mã đơn:</span>
                <span className="font-mono font-bold text-slate-900">#{orderCode}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Phương thức:</span>
              <span className="font-bold text-slate-900">{submittedMethod.name}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
              <span className="text-slate-500 font-medium">Tạm tính:</span>
              <span className="font-black text-sm text-[#DA251D]">
                {totalAmount.toLocaleString('vi-VN')}đ
              </span>
            </div>
            {note.trim() && (
              <div className="pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium block mb-0.5">Ghi chú:</span>
                <span className="text-slate-700 italic block">{note.trim()}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Chọn hình thức thanh toán
            </label>

            {isLoadingMethods ? (
              <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#DA251D]" />
                <span className="text-xs font-medium">Đang tải phương thức khả dụng...</span>
              </div>
            ) : loadError ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-700">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{loadError}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchMethods}
                  className="inline-flex items-center gap-1 font-bold text-rose-800 underline shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Thử lại</span>
                </button>
              </div>
            ) : paymentMethods.length === 0 ? (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 text-center">
                Hiện chưa có phương thức thanh toán khả dụng. Vui lòng nhấn gọi nhân viên để được hỗ trợ tại bàn.
              </div>
            ) : (
              <div className="space-y-2">
                {paymentMethods.map((method) => {
                  const isSelected = selectedCode === method.methodCode;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedCode(method.methodCode)}
                      className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-red-50/70 border-[#DA251D] text-slate-900 shadow-2xs'
                          : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getMethodIcon(method)}
                        <div className="min-w-0">
                          <span className="text-xs font-bold block truncate">{method.name}</span>
                          <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                            {method.description ||
                              (method.gatewayType === 'CASH'
                                ? 'Nhân viên thu tiền mặt tại bàn'
                                : method.gatewayType === 'TRANSFER'
                                ? 'Nhân viên hướng dẫn chuyển khoản tại bàn'
                                : 'Nhân viên mang máy quẹt thẻ đến bàn')}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#DA251D] border-[#DA251D]'
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

          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Ghi chú cho thu ngân (Tùy chọn)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Cần tách bill, lấy hóa đơn VAT..."
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200/80 focus:border-[#DA251D] focus:bg-white text-xs font-medium outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      )}
    </QrBottomSheet>
  );
};
