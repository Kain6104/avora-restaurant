import React, { useEffect, useState } from 'react';
import { X, Ticket, AlertCircle } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen) {
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
              const isEligible = orderValue >= voucher.minOrderValue;
              return (
                <div key={voucher.id} className={`bg-white rounded-xl shadow-sm border ${isEligible ? 'border-red-100 hover:border-red-300 hover:shadow-md' : 'border-slate-200 opacity-60'} overflow-hidden transition-all flex`}>
                  <div className={`w-24 shrink-0 flex flex-col items-center justify-center text-white p-3 ${isEligible ? 'bg-gradient-to-b from-red-500 to-red-600' : 'bg-slate-400'}`}>
                    <Ticket className="w-8 h-8 mb-1 opacity-80" />
                    <span className="font-black text-center leading-tight">
                      {voucher.discountType === 'PERCENTAGE' ? `GIẢM ${voucher.discountValue}%` : 
                       voucher.discountType === 'FREE_SHIP' ? 'FREE SHIP' : 
                       `GIẢM ${(voucher.discountValue/1000)}K`}
                    </span>
                  </div>
                  <div className="flex-1 p-3 flex flex-col relative">
                    <h3 className="font-bold text-slate-900 text-sm mb-1 line-clamp-1">{voucher.code}</h3>
                    <p className="text-xs text-slate-500 mb-2">Đơn tối thiểu {voucher.minOrderValue.toLocaleString('vi-VN')}đ</p>
                    <div className="mt-auto flex justify-between items-end">
                      <span className="text-[10px] text-slate-400">HSD: {new Date(voucher.endDate).toLocaleDateString('vi-VN')}</span>
                      <button 
                        disabled={!isEligible}
                        onClick={() => onApply(voucher)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg ${isEligible ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      >
                        Áp dụng
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
