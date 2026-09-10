'use client';

import React, { useState } from 'react';
import { 
  X, 
  Tag, 
  Percent, 
  Ticket, 
  Edit3, 
  Check, 
  Trash2, 
  Sparkles 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderOptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSuccess?: () => void;
}

type TabType = 'DISCOUNT' | 'VOUCHER' | 'NOTE';

const QUICK_REASONS = [
  'Khách quen / Khách thân thiết',
  'Khách VIP nhà hàng',
  'Ưu đãi theo chương trình',
  'Đền bù dịch vụ / món ra chậm',
  'Quản lý duyệt giảm trực tiếp',
];

const QUICK_NOTES = [
  'Làm ít cay / Không cay',
  'Không hành, không ngò',
  'Làm món nhanh giúp khách',
  'Mang lên cùng một lúc',
  'Ít đá / Không đường',
];

export default function OrderOptionsDrawer({
  isOpen,
  onClose,
  order,
  onSuccess,
}: OrderOptionsDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('DISCOUNT');

  // Discount state
  const subTotal = order?.subTotal || order?.totalAmount || 0;
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [percentVal, setPercentVal] = useState<number>(order?.discountAmount && subTotal > 0 ? Math.round((order.discountAmount / subTotal) * 100) : 10);
  const [fixedVal, setFixedVal] = useState<number>(order?.discountAmount || 50000);
  const [discountReason, setDiscountReason] = useState<string>(order?.discountReason || '');

  // Voucher state
  const [voucherCode, setVoucherCode] = useState<string>('');

  // Note state
  const [note, setNote] = useState<string>(order?.note || '');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !order) return null;

  const calculatedDiscount =
    discountType === 'PERCENT'
      ? Math.round((subTotal * Math.min(100, Math.max(0, percentVal))) / 100)
      : Math.min(subTotal, Math.max(0, fixedVal));

  // Save Discount
  const handleSaveDiscount = async () => {
    if (calculatedDiscount > 0 && !discountReason.trim()) {
      toast.error('Vui lòng chọn hoặc nhập lý do giảm giá');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountAmount: calculatedDiscount,
          discountReason: calculatedDiscount > 0 ? discountReason.trim() : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(calculatedDiscount > 0 ? `Đã áp dụng giảm giá: -${calculatedDiscount.toLocaleString('vi-VN')}đ` : 'Đã xóa giảm giá');
        onSuccess?.();
        onClose();
      } else {
        toast.error(data.message || 'Lỗi áp dụng giảm giá');
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi kết nối');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Apply Voucher
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      toast.error('Vui lòng nhập mã voucher');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountReason: `Mã Voucher: ${voucherCode.trim().toUpperCase()}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã áp dụng mã ${voucherCode.trim().toUpperCase()}`);
        onSuccess?.();
        onClose();
      } else {
        toast.error(data.message || 'Mã voucher không hợp lệ');
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi kết nối');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Note
  const handleSaveNote = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã cập nhật ghi chú đơn hàng!');
        onSuccess?.();
        onClose();
      } else {
        toast.error(data.message || 'Lỗi cập nhật ghi chú');
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi kết nối');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2 text-slate-800">
            <Sparkles size={20} className="text-[#DA251D]" />
            <h3 className="font-bold text-base">Tùy chọn đơn hàng</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs: Giảm giá | Voucher | Ghi chú */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('DISCOUNT')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'DISCOUNT'
                ? 'bg-white text-[#DA251D] shadow-xs'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <Percent size={14} />
            <span>Giảm giá</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VOUCHER')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'VOUCHER'
                ? 'bg-white text-[#DA251D] shadow-xs'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <Ticket size={14} />
            <span>Voucher</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('NOTE')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'NOTE'
                ? 'bg-white text-[#DA251D] shadow-xs'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <Edit3 size={14} />
            <span>Ghi chú</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* 1. DISCOUNT TAB */}
          {activeTab === 'DISCOUNT' && (
            <div className="space-y-4">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDiscountType('PERCENT')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    discountType === 'PERCENT' ? 'bg-white text-[#DA251D] shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Theo phần trăm (%)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('FIXED')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    discountType === 'FIXED' ? 'bg-white text-[#DA251D] shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Số tiền cố định (đ)
                </button>
              </div>

              {discountType === 'PERCENT' ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Mức chiết khấu:</span>
                    <span className="text-sm font-black text-[#DA251D]">{percentVal}% (-{calculatedDiscount.toLocaleString('vi-VN')}đ)</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[5, 10, 15, 20, 30].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPercentVal(p)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          percentVal === p
                            ? 'bg-[#DA251D] text-white border-[#DA251D] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Số tiền giảm (VND)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    value={fixedVal}
                    onChange={(e) => setFixedVal(Number(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-[#DA251D]"
                  />
                </div>
              )}

              {/* Reasons */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Lý do giảm giá:
                </label>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Nhập lý do giảm giá..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#DA251D] mb-2"
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REASONS.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDiscountReason(r)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-red-50 hover:text-[#DA251D] text-slate-700 rounded-lg text-[11px] font-medium border border-slate-200/70"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. VOUCHER TAB */}
          {activeTab === 'VOUCHER' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Mã Voucher / Khuyến mãi
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="Nhập mã voucher (ví dụ: SUMMER2026)..."
                    className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase tracking-wider outline-none focus:bg-white focus:border-[#DA251D]"
                  />
                  <Ticket size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl text-xs text-red-800 space-y-1">
                <p className="font-bold">Gợi ý mã khuyến mãi:</p>
                <div className="flex gap-2 pt-1">
                  {['AVORA10', 'WELCOME', 'VIPFREE'].map((vc) => (
                    <button
                      key={vc}
                      type="button"
                      onClick={() => setVoucherCode(vc)}
                      className="px-2.5 py-1 bg-white font-bold text-[#DA251D] rounded-lg border border-red-200 shadow-xs hover:bg-red-50"
                    >
                      {vc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. NOTE TAB */}
          {activeTab === 'NOTE' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Ghi chú cho đơn hàng & bếp
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập yêu cầu đặc biệt của khách hàng..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-[#DA251D] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Gợi ý ghi chú nhanh:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_NOTES.map((qn, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNote((prev) => (prev ? `${prev}, ${qn}` : qn))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-red-50 hover:text-[#DA251D] text-slate-700 rounded-lg text-[11px] font-medium border border-slate-200/70"
                    >
                      + {qn}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {activeTab === 'DISCOUNT' && order?.discountAmount ? (
            <button
              type="button"
              onClick={async () => {
                setPercentVal(0);
                setFixedVal(0);
                setIsSubmitting(true);
                await fetch(`/api/pos/orders/${order.id}/update`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ discountAmount: 0, discountReason: null }),
                });
                setIsSubmitting(false);
                toast.success('Đã hủy giảm giá');
                onSuccess?.();
                onClose();
              }}
              className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <Trash2 size={15} />
              Xóa giảm giá
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-100"
            >
              Đóng
            </button>

            {activeTab === 'DISCOUNT' && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveDiscount}
                className="px-5 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white text-sm font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check size={16} />
                {isSubmitting ? 'Đang lưu...' : 'Áp dụng giảm giá'}
              </button>
            )}

            {activeTab === 'VOUCHER' && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleApplyVoucher}
                className="px-5 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white text-sm font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check size={16} />
                {isSubmitting ? 'Đang kiểm tra...' : 'Dùng Voucher'}
              </button>
            )}

            {activeTab === 'NOTE' && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveNote}
                className="px-5 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white text-sm font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check size={16} />
                {isSubmitting ? 'Đang lưu...' : 'Lưu ghi chú'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
