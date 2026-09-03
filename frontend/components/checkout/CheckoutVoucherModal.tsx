import React, { useEffect, useState } from 'react';
import { X, Search, Ticket, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import Image from 'next/image';
import VoucherDetailModal from './VoucherDetailModal';

interface CheckoutVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (voucher: any) => void;
  orderValue: number;
  appliedVoucher?: any | null;
}

export default function CheckoutVoucherModal({ isOpen, onClose, onApply, orderValue, appliedVoucher }: CheckoutVoucherModalProps) {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(appliedVoucher || null);
  const [voucherCode, setVoucherCode] = useState("");
  const [applyingCode, setApplyingCode] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewingVoucher, setViewingVoucher] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
      fetchVouchers();
      setSelectedVoucher(appliedVoucher || null);
    }
  }, [isOpen, appliedVoucher]);

  const fetchVouchers = async () => {
    setLoading(true);
    setError('');
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const res = await fetch('/api/promotions/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ userId: user?.id })
      });
      const data = await res.json();
      if (res.ok) {
        setVouchers(Array.isArray(data) ? data : []);
      } else {
        setError(data.message || 'Lỗi khi tải voucher');
      }
    } catch (err) {
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyManualCode = async () => {
    if (!voucherCode) return;
    setApplyingCode(true);
    try {
      const res = await fetch('/api/promotions/vouchers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ code: voucherCode, orderValue, userId: currentUser?.id })
      });
      const data = await res.json();
      if (res.ok) {
        onApply(data.voucher);
        onClose();
      } else {
        alert(data.message || 'Mã không hợp lệ');
      }
    } catch (err) {
      alert('Lỗi kết nối');
    } finally {
      setApplyingCode(false);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedVoucher) {
      onApply(selectedVoucher);
    }
    onClose();
  };

  if (!isOpen) return null;

  const freeShipVouchers = vouchers.filter(v => v.discountType === 'FREE_SHIP');
  const orderVouchers = vouchers.filter(v => v.discountType !== 'FREE_SHIP');

  const renderVoucherList = (list: any[]) => {
    if (list.length === 0) return <div className="text-sm text-slate-500 py-2">Không có mã nào trong mục này.</div>;

    return list.map(voucher => {
      let isEligible = true;
      let reason = "";
      const now = new Date();
      const startDate = new Date(voucher.startDate);
      const endDate = new Date(voucher.endDate);

      if (voucher.membershipTierId && currentUser?.membershipTierId !== voucher.membershipTierId) {
        isEligible = false;
        reason = "Chỉ dành cho hạng thẻ được chỉ định.";
      } else if (voucher.isFirstOrderOnly && voucher.userOrderCount > 0) {
        isEligible = false;
        reason = "Chỉ áp dụng cho đơn hàng đầu tiên.";
      } else if (voucher.usageLimitPerUser !== null && voucher.usedCountByUser >= voucher.usageLimitPerUser) {
        isEligible = false;
        reason = "Bạn đã dùng hết lượt.";
      } else if (orderValue < voucher.minOrderValue) {
        isEligible = false;
        reason = `Mua thêm ${(voucher.minOrderValue - orderValue).toLocaleString('vi-VN')}đ để sử dụng.`;
      } else if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
        isEligible = false;
        reason = "Hết lượt sử dụng.";
      } else if (now < startDate || now > endDate) {
        isEligible = false;
        reason = "Chưa bắt đầu hoặc hết hạn.";
      }

      const isSelected = selectedVoucher?.id === voucher.id;

      return (
        <div key={voucher.id} className="mb-3">
          <div className={`relative flex bg-white border rounded-lg overflow-hidden transition-all shadow-sm ${!isEligible ? 'opacity-60 border-slate-200' : isSelected ? 'border-[#da251d] bg-red-50/20' : 'border-slate-200'
            }`}>

            {/* Left Decor / Logo */}
            <div className={`w-20 shrink-0 flex items-center justify-center border-r border-dashed border-slate-200 ${voucher.discountType === 'FREE_SHIP' ? 'bg-[#00B14F]/5' : 'bg-[#da251d]/5'}`}>
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 overflow-hidden relative">
                {voucher.discountType === 'FREE_SHIP' ? (
                  <span className="font-black text-[#00B14F] text-[10px]">FreeShip</span>
                ) : (
                  <span className="font-black text-[#da251d] text-[10px]">Voucher</span>
                )}
                {/* Half circles for ticket effect */}
                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-r border-slate-200"></div>
                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-l border-slate-200"></div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-3 flex flex-col justify-center">
              <h3 className="font-bold text-sm text-slate-800 leading-tight mb-1">{voucher.title || voucher.code}</h3>
              {voucher.maxDiscount ? (
                <p className="text-xs text-slate-500 mb-0.5">Giảm tối đa {(voucher.maxDiscount / 1000)}k</p>
              ) : voucher.discountType === 'FIXED_AMOUNT' ? (
                <p className="text-xs text-slate-500 mb-0.5">Giảm {(voucher.discountValue / 1000)}k</p>
              ) : null}
              <p className="text-[10px] text-slate-400 mt-1">HSD: {endDate.toLocaleDateString('vi-VN')}</p>
            </div>

            {/* Right Actions */}
            <div className="w-20 shrink-0 flex flex-col items-center justify-between p-3 border-l border-dashed border-slate-200 bg-slate-50/50">
              <label className={`flex items-center justify-center w-full h-full ${isEligible ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <input 
                  type="radio" 
                  className="sr-only" 
                  disabled={!isEligible}
                  checked={isSelected}
                  onChange={() => {
                    if (isEligible) setSelectedVoucher(voucher);
                  }}
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isSelected ? 'border-[#da251d]' : 'border-slate-300'
                } ${!isEligible ? 'opacity-50 bg-slate-100' : ''}`}>
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#da251d]" />}
                </div>
              </label>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setViewingVoucher(voucher);
                  setDetailModalOpen(true);
                }}
                className="text-[10px] text-slate-500 hover:text-[#da251d] font-medium mt-2"
              >
                Điều kiện
              </button>
            </div>
          </div>

          {/* Reason if invalid */}
          {!isEligible && (
            <div className="mt-1 flex items-center gap-1.5 px-1 py-1 rounded text-[11px] text-slate-500 bg-slate-50">
              <AlertCircle size={12} className="shrink-0" />
              <span>{reason}</span>
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center sm:p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-[#f5f6f8] w-full sm:max-w-lg h-[90vh] sm:h-[80vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">

          {/* Header */}
          <div className="bg-white p-4 flex items-center justify-between rounded-t-2xl border-b border-slate-200 shrink-0">
            <h2 className="text-lg font-bold text-slate-800">Kho Voucher</h2>
            <div className="flex items-center gap-3">
              <div className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 border border-amber-100">
                {currentUser?.points?.toLocaleString('vi-VN') || 0} <span className="text-[10px] bg-amber-400 text-white rounded-full w-4 h-4 flex items-center justify-center">V</span>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white px-4 py-3 border-b border-slate-200 shrink-0">
            <div className="relative flex items-center">
              <input
                type="text"
                className="w-full p-2.5 pl-4 pr-24 bg-slate-50 border border-slate-200 rounded-full focus:ring-2 focus:ring-[#da251d]/20 focus:border-[#da251d] outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
                placeholder="Nhập mã khuyến mãi..."
                value={voucherCode}
                onChange={e => setVoucherCode(e.target.value)}
              />
              <button
                disabled={!voucherCode || applyingCode}
                onClick={handleApplyManualCode}
                className="absolute right-1 top-1 bottom-1 px-4 bg-[#da251d] hover:bg-[#b91c2c] disabled:bg-slate-300 text-white font-bold rounded-full text-xs transition-colors"
              >
                {applyingCode ? '...' : 'Áp dụng'}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-[#da251d]" size={30} />
              </div>
            ) : error ? (
              <div className="text-center text-red-500 py-10">{error}</div>
            ) : vouchers.length === 0 ? (
              <div className="text-center text-slate-500 py-10">Không có mã giảm giá nào.</div>
            ) : (
              <div className="space-y-6">

                {/* Free Ship */}
                {freeShipVouchers.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-3">
                      <span className="w-5 h-5 rounded-full bg-[#00B14F]/10 flex items-center justify-center text-[#00B14F]">
                        <Ticket size={12} />
                      </span>
                      Miễn phí vận chuyển
                    </h3>
                    {renderVoucherList(freeShipVouchers)}
                  </div>
                )}

                {/* Orders Vouchers */}
                {orderVouchers.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-3 mt-4">
                      <span className="w-5 h-5 rounded-full bg-[#da251d]/10 flex items-center justify-center text-[#da251d]">
                        <Ticket size={12} />
                      </span>
                      Mã giảm giá đơn hàng
                    </h3>
                    {renderVoucherList(orderVouchers)}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-white p-4 border-t border-slate-200 shrink-0">
            <button
              onClick={handleConfirmSelection}
              className="w-full bg-[#da251d] hover:bg-[#b91c2c] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#da251d]/20 transition-all active:scale-[0.98]"
            >
              Xác nhận chọn Voucher
            </button>
          </div>

        </div>
      </div>

      <VoucherDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        voucher={viewingVoucher}
      />
    </>
  );
}
