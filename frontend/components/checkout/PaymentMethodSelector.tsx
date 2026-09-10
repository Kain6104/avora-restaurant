import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CreditCard,
  QrCode,
  DollarSign,
  Wallet,
  Check,
  X,
  Loader2,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Info,
  Sparkles,
  Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface PaymentMethodItem {
  id: string;
  methodCode: string;
  gatewayType: string;
  name: string;
  description?: string;
  iconUrl?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  minOrderValue: number;
  isEligible?: boolean;
  remainingToMin?: number;
}

interface PaymentMethodSelectorProps {
  totalAmount: number;
  branchId?: string;
  selectedMethodCode: string;
  onSelectMethod: (method: PaymentMethodItem | null) => void;
  orderCodeHint?: string;
}

export default function PaymentMethodSelector({
  totalAmount,
  branchId,
  selectedMethodCode,
  onSelectMethod,
}: PaymentMethodSelectorProps) {
  const [methods, setMethods] = useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempSelectedCode, setTempSelectedCode] = useState<string>(selectedMethodCode);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        setLoading(true);
        let url = `/api/payment-methods/active?totalAmount=${totalAmount}`;
        if (branchId) url += `&branchId=${branchId}`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const list: PaymentMethodItem[] = data.data || [];
          setMethods(list);

          // Kiểm tra xem method đang chọn có hợp lệ và đủ điều kiện minOrderValue không
          const currentMethod = list.find((m) => m.methodCode === selectedMethodCode);
          const isCurrentEligible = currentMethod && totalAmount >= (currentMethod.minOrderValue || 0);

          if (isCurrentEligible && currentMethod) {
            setTempSelectedCode(currentMethod.methodCode);
            onSelectMethod(currentMethod);
          } else {
            // Tìm method đầu tiên thỏa điều kiện minOrderValue
            const firstEligible = list.find((m) => totalAmount >= (m.minOrderValue || 0));
            if (firstEligible) {
              setTempSelectedCode(firstEligible.methodCode);
              onSelectMethod(firstEligible);
            } else {
              // Không có method nào đủ điều kiện
              setTempSelectedCode('');
              onSelectMethod(null);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch payment methods', e);
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, [totalAmount, branchId]);

  useEffect(() => {
    setTempSelectedCode(selectedMethodCode);
  }, [selectedMethodCode]);

  const currentSelectedMethod = methods.find((m) => m.methodCode === selectedMethodCode);
  const isSelectedMethodEligible = currentSelectedMethod
    ? totalAmount >= (currentSelectedMethod.minOrderValue || 0)
    : false;

  const handleOpenModal = () => {
    setTempSelectedCode(selectedMethodCode);
    setIsModalOpen(true);
  };

  const handleMethodClick = (method: PaymentMethodItem) => {
    const isEligible = totalAmount >= (method.minOrderValue || 0);
    if (!isEligible) {
      const missingAmount = method.minOrderValue - totalAmount;
      toast.error(
        `Phương thức "${method.name}" yêu cầu đơn hàng từ ${method.minOrderValue.toLocaleString(
          'vi-VN'
        )}đ. Bạn cần thêm ${missingAmount.toLocaleString('vi-VN')}đ!`,
        { id: `min-val-${method.id}`, duration: 4000 }
      );
      return;
    }
    setTempSelectedCode(method.methodCode);
  };

  const handleConfirmSelection = () => {
    const chosen = methods.find((m) => m.methodCode === tempSelectedCode);
    if (chosen) {
      if (totalAmount < (chosen.minOrderValue || 0)) {
        toast.error(`Phương thức "${chosen.name}" chưa đủ điều kiện giá trị đơn hàng tối thiểu`);
        return;
      }
      onSelectMethod(chosen);
    } else {
      onSelectMethod(null);
    }
    setIsModalOpen(false);
  };

  const getMethodIcon = (gatewayType: string) => {
    switch (gatewayType?.toUpperCase()) {
      case 'SEPAY':
      case 'TRANSFER':
      case 'VIETQR':
        return <QrCode size={18} className="text-[#da251d]" />;
      case 'COD':
        return <DollarSign size={18} className="text-emerald-600" />;
      case 'MOMO':
        return <Wallet size={18} className="text-pink-600" />;
      case 'VNPAY':
        return <CreditCard size={18} className="text-blue-600" />;
      default:
        return <CreditCard size={18} className="text-blue-600" />;
    }
  };

  return (
    <div className="bg-white p-4 sm:p-5 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
      {/* Header with Mandatory Indicator */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center text-sm sm:text-base font-bold text-slate-800">
          <Wallet className="mr-2 text-[#da251d]" size={18} />
          <span>Phương thức thanh toán</span>
          <span className="text-red-500 font-black ml-1 text-sm">*</span>
        </h2>
        {currentSelectedMethod && isSelectedMethodEligible ? (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check size={12} className="stroke-[3]" />
            Đã chọn
          </span>
        ) : (
          <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertCircle size={12} />
            Bắt buộc chọn
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-5 text-center text-slate-400 text-xs space-y-2">
          <Loader2 size={20} className="animate-spin mx-auto text-[#da251d]" />
          <p className="font-medium">Đang tải danh sách phương thức thanh toán...</p>
        </div>
      ) : methods.length === 0 ? (
        <div className="p-4 bg-red-50/70 rounded-2xl border border-red-200 text-xs text-red-700 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle size={15} className="shrink-0" />
            <span>Chưa có phương thức thanh toán nào khả dụng</span>
          </div>
          <p className="text-slate-600">
            Hiện tại chi nhánh này chưa kích hoạt cổng thanh toán. Vui lòng liên hệ nhà hàng hoặc chọn chi nhánh khác.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active / Current Selection Card */}
          <div
            onClick={handleOpenModal}
            className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all ${
              currentSelectedMethod && isSelectedMethodEligible
                ? 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-300 shadow-2xs'
                : 'bg-red-50/40 hover:bg-red-50/80 border-red-300 ring-2 ring-red-100'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs shrink-0">
                {currentSelectedMethod
                  ? getMethodIcon(currentSelectedMethod.gatewayType)
                  : <Wallet size={20} className="text-slate-400" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {currentSelectedMethod?.name || 'Vui lòng chọn 1 phương thức thanh toán'}
                  </p>
                  {currentSelectedMethod?.minOrderValue && currentSelectedMethod.minOrderValue > 0 ? (
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.2 rounded-md">
                      Đơn tối thiểu {currentSelectedMethod.minOrderValue.toLocaleString('vi-VN')}đ
                    </span>
                  ) : currentSelectedMethod ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-md">
                      Mọi đơn hàng
                    </span>
                  ) : null}
                </div>
                {currentSelectedMethod?.description && (
                  <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                    {currentSelectedMethod.description}
                  </p>
                )}
                {currentSelectedMethod && !isSelectedMethodEligible && (
                  <p className="text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Chưa đạt mức tối thiểu {currentSelectedMethod.minOrderValue.toLocaleString('vi-VN')}đ (cần thêm{' '}
                    {(currentSelectedMethod.minOrderValue - totalAmount).toLocaleString('vi-VN')}đ)
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-2 shrink-0">
              <span className="text-xs font-bold text-[#da251d] hover:underline hidden xs:inline">
                {currentSelectedMethod ? 'Thay đổi' : 'Chọn ngay'}
              </span>
              <ChevronRight size={18} className="text-slate-400" />
            </div>
          </div>

          {/* Quick Preview of All Methods with Min Order Value */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Tất cả phương thức ({methods.length})
              </span>
              <button
                type="button"
                onClick={handleOpenModal}
                className="text-[11px] font-bold text-[#da251d] hover:underline cursor-pointer"
              >
                Xem chi tiết
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {methods.map((method) => {
                const isEligible = totalAmount >= (method.minOrderValue || 0);
                const isSelected = selectedMethodCode === method.methodCode;

                return (
                  <div
                    key={method.id}
                    onClick={() => {
                      if (isEligible) {
                        onSelectMethod(method);
                      } else {
                        handleMethodClick(method);
                      }
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected && isEligible
                        ? 'bg-red-50/50 border-[#da251d] ring-1 ring-[#da251d]/30 shadow-2xs'
                        : isEligible
                        ? 'bg-white hover:bg-slate-50 border-slate-200'
                        : 'bg-slate-50/60 border-slate-200/80 opacity-65 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                        {getMethodIcon(method.gatewayType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                          {method.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {method.minOrderValue > 0 ? (
                            <span
                              className={`text-[10px] font-bold ${
                                isEligible ? 'text-slate-500' : 'text-amber-700'
                              }`}
                            >
                              Tối thiểu: {method.minOrderValue.toLocaleString('vi-VN')}đ
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600">
                              Mọi đơn hàng
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected && isEligible ? (
                        <div className="w-4 h-4 rounded-full bg-[#da251d] text-white flex items-center justify-center">
                          <Check size={10} className="stroke-[3]" />
                        </div>
                      ) : !isEligible ? (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100/80 border border-amber-200 px-1.5 py-0.2 rounded">
                          Chưa đủ
                        </span>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
          MODAL: CHỌN PHƯƠNG THỨC THANH TOÁN CHI TIẾT
      ═════════════════════════════════════════════════════════ */}
      {isModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Wallet size={20} className="text-[#da251d]" />
                <span>Chọn Phương Thức Thanh Toán</span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Current Order Total Notice */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-slate-700 font-bold">Giá trị đơn hàng xét điều kiện:</span>
                <span className="text-[11px] text-slate-500">Giá trị trước giảm giá, chưa gồm phí vận chuyển</span>
              </div>
              <span className="font-mono font-black text-sm sm:text-base text-[#da251d]">
                {totalAmount.toLocaleString('vi-VN')}đ
              </span>
            </div>

            {/* Modal Body: All Payment Methods with Minimum Order Value & Eligibility */}
            <div className="p-4 sm:p-5 space-y-2.5 overflow-y-auto flex-1">
              {methods.map((method) => {
                const isEligible = totalAmount >= (method.minOrderValue || 0);
                const isSelected = tempSelectedCode === method.methodCode;
                const missing = Math.max(0, (method.minOrderValue || 0) - totalAmount);

                return (
                  <div
                    key={method.id}
                    onClick={() => handleMethodClick(method)}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      !isEligible
                        ? 'bg-slate-50/70 border-slate-200/90 opacity-70 hover:opacity-90'
                        : isSelected
                        ? 'bg-red-50/40 border-[#da251d] ring-2 ring-red-100 shadow-sm'
                        : 'bg-white hover:bg-slate-50 border-slate-200/90'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                        {getMethodIcon(method.gatewayType)}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                            {method.name}
                          </h4>
                          {/* Minimum Order Value Badge */}
                          {method.minOrderValue > 0 ? (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                isEligible
                                  ? 'bg-slate-100 border-slate-200 text-slate-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-800'
                              }`}
                            >
                              Đơn tối thiểu {method.minOrderValue.toLocaleString('vi-VN')}đ
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md">
                              Áp dụng mọi đơn hàng
                            </span>
                          )}
                        </div>

                        {method.description && (
                          <p className="text-[11px] text-slate-500 font-medium line-clamp-2">
                            {method.description}
                          </p>
                        )}

                        {/* Ineligible Warning */}
                        {!isEligible && (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 pt-0.5">
                            <AlertCircle size={13} className="shrink-0 text-amber-600" />
                            <span>
                              Chưa đủ điều kiện (cần thêm {missing.toLocaleString('vi-VN')}đ để sử dụng)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Radio Selector Circle */}
                    <div className="shrink-0 ml-2">
                      {!isEligible ? (
                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center">
                          <Lock size={11} />
                        </div>
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'border-[#da251d] bg-[#da251d]' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmSelection}
                disabled={!tempSelectedCode || methods.find((m) => m.methodCode === tempSelectedCode)?.minOrderValue! > totalAmount}
                className="px-6 py-2.5 bg-[#da251d] hover:bg-[#b81d16] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Xác nhận chọn
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
