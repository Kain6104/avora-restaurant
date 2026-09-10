import React, { useEffect, useState } from 'react';
import { X, Ticket, AlertCircle, Info } from 'lucide-react';
import VoucherConditionModal from './voucher/VoucherConditionModal';

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (voucher: any) => void;
  orderValue: number;
}

export default function VoucherModal({ isOpen, onClose, onApply, orderValue }: VoucherModalProps) {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conditionVoucher, setConditionVoucher] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
      fetchVouchers();
    }
  }, [isOpen]);

  const fetchVouchers = async () => {
    setLoading(true);
    setError('');
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const res = await fetch('/api/promotions/vouchers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#f8f7f5] w-full max-w-md h-[80vh] sm:h-[600px] sm:rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="p-4 border-b border-slate-200 bg-white sm:rounded-t-3xl shrink-0 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-red-600" />
            Chọn mã khuyến mãi
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-10 flex flex-col items-center">
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              {error}
            </div>
          ) : vouchers.length === 0 ? (
            <div className="text-center text-slate-500 py-10 flex flex-col items-center">
              <Ticket className="w-12 h-12 mb-3 text-slate-300" />
              <p>Hiện không có mã giảm giá nào phù hợp.</p>
            </div>
          ) : (
            vouchers.map(voucher => {
              let isEligible = true;
              let reason = "";
              const now = new Date();
              const startDate = new Date(voucher.startDate);
              const endDate = new Date(voucher.endDate);

              const isSystemExhausted = voucher.isSystemExhausted || (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit);
              const isUserExhausted = voucher.isUserExhausted || (voucher.usageLimitPerUser !== null && (voucher.usedCountByUser || 0) >= voucher.usageLimitPerUser);

              let badgeText = '';
              if (voucher.membershipTierId && currentUser?.membershipTierId !== voucher.membershipTierId) {
                isEligible = false;
                reason = "Mã voucher này không dành cho hạng thẻ của bạn.";
                badgeText = "HẠNG THẺ KHÁC";
              } else if (voucher.isFirstOrderOnly && voucher.userOrderCount > 0) {
                isEligible = false;
                reason = "Mã voucher này chỉ áp dụng cho đơn hàng đầu tiên của bạn.";
                badgeText = "ĐƠN ĐẦU TIÊN";
              } else if (isUserExhausted) {
                isEligible = false;
                reason = `Bạn đã sử dụng hết số lượt cho phép của mã này (${voucher.usedCountByUser || voucher.usageLimitPerUser}/${voucher.usageLimitPerUser} lượt).`;
                badgeText = "HẾT LƯỢT CỦA BẠN";
              } else if (orderValue < voucher.minOrderValue) {
                isEligible = false;
                reason = `Bạn cần mua thêm ${(voucher.minOrderValue - orderValue).toLocaleString('vi-VN')}đ để sử dụng mã này.`;
                badgeText = `THIẾU ${Math.round((voucher.minOrderValue - orderValue)/1000)}K`;
              } else if (isSystemExhausted) {
                isEligible = false;
                reason = "Mã voucher đã hết lượt sử dụng toàn hệ thống.";
                badgeText = "HẾT LƯỢT HỆ THỐNG";
              } else if (now < startDate || now > endDate) {
                isEligible = false;
                reason = "Mã voucher chưa bắt đầu hoặc đã hết hạn.";
                badgeText = "HẾT HẠN";
              }

              return (
                <div key={voucher.id} className="flex flex-col gap-2 mb-2">
                  <div className={`bg-white rounded-xl shadow-sm border ${isEligible ? 'border-red-100 hover:border-red-300 hover:shadow-md' : 'border-slate-200 bg-slate-50/70 opacity-65'} overflow-hidden transition-all flex`}>
                    <div className={`w-24 shrink-0 flex flex-col items-center justify-center text-white p-3 ${isEligible ? 'bg-gradient-to-b from-red-500 to-red-600' : 'bg-slate-400'}`}>
                      <Ticket className="w-8 h-8 mb-1 opacity-80" />
                      <span className="font-black text-center leading-tight">
                        {voucher.discountType === 'PERCENTAGE' ? `GIẢM ${voucher.discountValue}%` : 
                         voucher.discountType === 'FREE_SHIP' ? 'FREE SHIP' : 
                         `GIẢM ${(voucher.discountValue/1000)}K`}
                      </span>
                    </div>
                    <div className="flex-1 p-3 flex flex-col relative">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{voucher.code}</h3>
                        {badgeText && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${isUserExhausted ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {badgeText}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-2">Đơn tối thiểu {voucher.minOrderValue.toLocaleString('vi-VN')}đ</p>
                      <div className="mt-auto flex justify-between items-end">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">HSD: {new Date(voucher.endDate).toLocaleDateString('vi-VN')}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConditionVoucher(voucher);
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:text-red-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                          >
                            <Info size={11} />
                            <span>Điều kiện</span>
                          </button>
                        </div>
                        <button 
                          disabled={!isEligible}
                          onClick={() => isEligible && onApply(voucher)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg ${isEligible ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        >
                          {isEligible ? 'Áp dụng' : 'Không khả dụng'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {!isEligible && reason && (
                    <div className="bg-slate-100 text-slate-600 text-[11px] p-2.5 rounded-xl border border-slate-200/70 flex gap-2 leading-relaxed">
                      <AlertCircle className={`w-4 h-4 shrink-0 ${isUserExhausted ? 'text-rose-500' : 'text-slate-400'}`} />
                      <p className={isUserExhausted ? 'font-semibold text-rose-700' : 'text-slate-600'}>{reason}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Voucher Condition Modal (Based on DB columns) */}
      <VoucherConditionModal
        voucher={conditionVoucher}
        isOpen={!!conditionVoucher}
        onClose={() => setConditionVoucher(null)}
        currentOrderValue={orderValue}
        currentUserTierId={currentUser?.membershipTierId}
      />
    </div>
  );
}
