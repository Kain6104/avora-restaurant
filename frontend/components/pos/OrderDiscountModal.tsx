"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  X,
  Percent,
  DollarSign,
  CheckCircle2,
  Trash2,
  Tag,
  Receipt,
  Ticket,
  Sparkles,
  Loader2,
  Coins,
  Search,
  User,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderDiscountModalProps {
  subTotal: number;
  currentDiscount?: number;
  currentReason?: string;
  currentDiscountType?: 'PERCENT' | 'FIXED' | 'VOUCHER' | 'POINTS';
  currentPercent?: number;
  orderId?: string;
  branchId?: string;
  initialMember?: any;
  onRedeemReward?: (reward: any, member: any) => Promise<void> | void;
  onClose: () => void;
  onApplyDiscount: (
    amount: number,
    reason: string,
    discountType?: 'PERCENT' | 'FIXED' | 'VOUCHER' | 'POINTS',
    percentVal?: number,
  ) => void;
  onRemoveDiscount: () => void;
}

const QUICK_PERCENTAGES = [5, 10, 15, 20, 30, 50, 100];
const QUICK_ORDER_REASONS = [
  'Khách hàng thân thiết / Khách quen',
  'Khách VIP của nhà hàng',
  'Đền bù dịch vụ / món ra chậm',
  'Ưu đãi sinh nhật khách',
  'Người quen của quản lý / chủ quán',
  'Lý do khác',
];

const POINT_RATE = 1000; // 1 điểm = 1.000 VNĐ

export const OrderDiscountModal: React.FC<OrderDiscountModalProps> = ({
  subTotal,
  currentDiscount = 0,
  currentReason = '',
  currentDiscountType,
  currentPercent,
  orderId,
  branchId,
  initialMember,
  onRedeemReward,
  onClose,
  onApplyDiscount,
  onRemoveDiscount,
}) => {
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED' | 'VOUCHER' | 'POINTS'>(
    currentDiscountType || (currentPercent !== undefined ? 'PERCENT' : 'PERCENT'),
  );
  const [percentVal, setPercentVal] = useState<number>(
    currentPercent !== undefined
      ? currentPercent
      : currentDiscount > 0 && subTotal > 0
      ? Math.round((currentDiscount / subTotal) * 100)
      : 10,
  );
  const [fixedVal, setFixedVal] = useState<number>(
    currentDiscount > 0 && currentDiscountType === 'FIXED' ? currentDiscount : 50000,
  );
  const [selectedReason, setSelectedReason] = useState<string>(currentReason || '');
  const [customReason, setCustomReason] = useState<string>('');

  // Voucher states
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherDiscount, setVoucherDiscount] = useState<number>(0);
  const [appliedVoucher, setAppliedVoucher] = useState<any | null>(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState<boolean>(false);
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([]);

  // Member Points states
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isSearchingMember, setIsSearchingMember] = useState(false);
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any | null>(initialMember || null);
  const [isChangingMember, setIsChangingMember] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);
  const [isRedeemingId, setIsRedeemingId] = useState<string | null>(null);
  const [pointsToUse, setPointsToUse] = useState<number>(0);

  // Sync initialMember
  useEffect(() => {
    if (initialMember) setSelectedMember(initialMember);
  }, [initialMember]);

  // Fetch available vouchers
  useEffect(() => {
    fetch(`/api/pos/vouchers?subTotal=${subTotal}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setAvailableVouchers(res.data);
        }
      })
      .catch(() => {});
  }, [subTotal]);

  // Fetch redeemable rewards
  useEffect(() => {
    if (discountType === 'POINTS') {
      setIsLoadingRewards(true);
      fetch(`/api/pos/rewards${branchId ? `?branchId=${branchId}` : ''}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            setRewards(res.data);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingRewards(false));
    }
  }, [discountType, branchId]);

  const handleValidateVoucher = async (codeToTest?: string) => {
    const code = (codeToTest || voucherCode).trim().toUpperCase();
    if (!code) {
      toast.error('Vui lòng nhập mã voucher');
      return;
    }

    setIsValidatingVoucher(true);
    try {
      const res = await fetch('/api/pos/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, subTotal }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const discountAmt = data.data.discountAmount || 0;
        setVoucherDiscount(discountAmt);
        setAppliedVoucher(data.data.voucher);
        setVoucherCode(code);
        toast.success(`Áp dụng voucher ${code}: -${discountAmt.toLocaleString('vi-VN')}đ`);
      } else {
        toast.error(data.message || 'Mã voucher không hợp lệ hoặc đã hết hạn');
      }
    } catch {
      toast.error('Lỗi kiểm tra voucher');
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  // Search Members for Points
  const handleSearchMember = async (q: string) => {
    setMemberSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setMemberSearchResults([]);
      return;
    }
    setIsSearchingMember(true);
    try {
      const res = await fetch(`/api/pos/members/search?query=${encodeURIComponent(q.trim())}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMemberSearchResults(data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsSearchingMember(false);
    }
  };

  const handleExecuteRedeem = async (item: any) => {
    if (!selectedMember) {
      toast.error('Vui lòng chọn khách hàng thành viên');
      return;
    }
    const currentPoints = selectedMember?.points ?? selectedMember?.currentPoints ?? 0;
    const requiredPoints = item.redemptionPoints || 0;
    if (currentPoints < requiredPoints) {
      toast.error(
        `Khách hàng hiện có ${currentPoints.toLocaleString('vi-VN')} điểm, không đủ ${requiredPoints.toLocaleString('vi-VN')} điểm để đổi món này.`,
      );
      return;
    }

    setIsRedeemingId(item.id);
    try {
      if (onRedeemReward) {
        await onRedeemReward(item, selectedMember);
      } else if (orderId) {
        const res = await fetch(`/api/pos/orders/${orderId}/redeem-reward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            productId: item.id,
            userId: selectedMember.id,
            quantity: 1,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || 'Đổi điểm thất bại');
        }
        toast.success(`Đã đổi thành công 1x ${item.name}!`);
      }

      // Deduct member points locally
      setSelectedMember((prev: any) =>
        prev
          ? {
              ...prev,
              points: Math.max(0, (prev.points ?? prev.currentPoints ?? 0) - requiredPoints),
              currentPoints: Math.max(0, (prev.currentPoints ?? prev.points ?? 0) - requiredPoints),
            }
          : null,
      );
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi đổi món');
    } finally {
      setIsRedeemingId(null);
    }
  };

  const memberPoints = selectedMember?.points ?? selectedMember?.currentPoints ?? 0;
  const maxPointsAllowed = Math.min(memberPoints, Math.floor(subTotal / POINT_RATE));
  const pointsDiscountAmount = pointsToUse * POINT_RATE;

  const calculatedDiscount =
    discountType === 'PERCENT'
      ? Math.round((subTotal * Math.min(100, Math.max(0, percentVal))) / 100)
      : discountType === 'FIXED'
      ? Math.min(subTotal, Math.max(0, fixedVal))
      : discountType === 'POINTS'
      ? Math.min(subTotal, pointsDiscountAmount)
      : voucherDiscount;

  const newTotal = Math.max(0, subTotal - calculatedDiscount);

  const finalReason =
    discountType === 'VOUCHER'
      ? `Voucher: ${voucherCode.trim().toUpperCase()}`
      : discountType === 'POINTS'
      ? `Đổi ${pointsToUse} điểm tích lũy (${selectedMember?.fullName || selectedMember?.phone || 'Hội viên'})`
      : selectedReason === 'Lý do khác'
      ? customReason.trim()
      : selectedReason
      ? `${selectedReason}${customReason.trim() ? ` - ${customReason.trim()}` : ''}`
      : customReason.trim();

  const handleConfirm = () => {
    if (calculatedDiscount <= 0 || !finalReason) {
      toast.error('Vui lòng chọn hoặc nhập đầy đủ thông tin giảm giá');
      return;
    }
    onApplyDiscount(
      calculatedDiscount,
      finalReason,
      discountType,
      discountType === 'PERCENT' ? percentVal : undefined,
    );
    onClose();
  };

  const handleRemove = () => {
    onRemoveDiscount();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-rose-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">Khuyến mại & Giảm giá hóa đơn</h3>
              <p className="text-[11px] text-gray-500">
                Chiết khấu trực tiếp, voucher hoặc đổi điểm thưởng thành viên
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Summary Preview */}
          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/80 flex items-center justify-between">
            <div>
              <span className="text-gray-400 text-[11px] block">Tổng tiền hàng:</span>
              <span className="font-semibold text-gray-700 line-through">
                {subTotal.toLocaleString('vi-VN')}đ
              </span>
            </div>
            <div className="text-right">
              <span className="text-emerald-600 text-[11px] block font-bold">
                Sau giảm giá (-{calculatedDiscount.toLocaleString('vi-VN')}đ):
              </span>
              <span className="font-extrabold text-[#da251d] text-base font-mono">
                {newTotal.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>

          {/* Discount Type Toggle: 4 Options */}
          <div>
            <label className="block text-gray-700 font-bold mb-1.5">Hình thức khuyến mại:</label>
            <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setDiscountType('PERCENT')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-xs cursor-pointer ${
                  discountType === 'PERCENT'
                    ? 'bg-white text-[#da251d] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>% Giảm</span>
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('FIXED')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-xs cursor-pointer ${
                  discountType === 'FIXED'
                    ? 'bg-white text-[#da251d] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Số tiền</span>
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('VOUCHER')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-xs cursor-pointer ${
                  discountType === 'VOUCHER'
                    ? 'bg-white text-[#da251d] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('POINTS')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-xs cursor-pointer ${
                  discountType === 'POINTS'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span>Đổi điểm</span>
              </button>
            </div>
          </div>

          {/* Tab 1: PERCENT */}
          {discountType === 'PERCENT' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={percentVal || ''}
                  onChange={(e) => setPercentVal(Number(e.target.value))}
                  className="w-full text-center text-lg font-extrabold py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#da251d] focus:bg-white transition-all text-[#da251d]"
                />
                <span className="font-bold text-gray-500 text-sm">%</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PERCENTAGES.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPercentVal(pct)}
                    className={`px-2.5 py-1 rounded-lg border font-bold transition-all text-[11px] cursor-pointer ${
                      percentVal === pct
                        ? 'bg-[#da251d] text-white border-[#da251d]'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: FIXED */}
          {discountType === 'FIXED' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={fixedVal || ''}
                  onChange={(e) => setFixedVal(Number(e.target.value))}
                  className="w-full text-center text-lg font-extrabold py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#da251d] focus:bg-white transition-all text-[#da251d]"
                />
                <span className="font-bold text-gray-500 text-sm">đ</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[20000, 50000, 100000, 200000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFixedVal(amt)}
                    className={`px-2.5 py-1 rounded-lg border font-bold transition-all text-[11px] cursor-pointer ${
                      fixedVal === amt
                        ? 'bg-[#da251d] text-white border-[#da251d]'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {amt.toLocaleString('vi-VN')}đ
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: VOUCHER */}
          {discountType === 'VOUCHER' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleValidateVoucher();
                      }
                    }}
                    placeholder="Nhập mã voucher (VD: VIPFREE, AVORA10)..."
                    className="w-full pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-wider outline-none focus:border-[#da251d] focus:bg-white"
                  />
                  <Ticket className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <button
                  type="button"
                  disabled={isValidatingVoucher || !voucherCode.trim()}
                  onClick={() => handleValidateVoucher()}
                  className="px-4 py-2.5 bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  {isValidatingVoucher ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Kiểm tra'
                  )}
                </button>
              </div>

              {appliedVoucher && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-800 block">
                      {appliedVoucher.name || `Voucher ${appliedVoucher.code}`}
                    </span>
                    <span className="text-emerald-600 text-[11px]">
                      {appliedVoucher.discountType === 'PERCENTAGE'
                        ? `Giảm ${appliedVoucher.discountValue}% (Tối đa: ${(appliedVoucher.maxDiscount || 0).toLocaleString('vi-VN')}đ)`
                        : `Giảm cố định ${appliedVoucher.discountValue.toLocaleString('vi-VN')}đ`}
                    </span>
                  </div>
                  <span className="font-black text-emerald-700 text-sm">
                    -{voucherDiscount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: POINTS (ĐỔI ĐIỂM THÀNH MÓN ĂN - Image 1 & 2) */}
          {discountType === 'POINTS' && (
            <div className="space-y-3">
              {/* Member Card or Member Search */}
              {selectedMember && !isChangingMember ? (
                <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1A73E8] text-white flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm leading-snug">
                        {selectedMember.fullName || selectedMember.phone || 'Khách hàng'}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setIsChangingMember(true)}
                          className="text-[#1A73E8] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <User className="w-3 h-3" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMember(null);
                            setIsChangingMember(true);
                          }}
                          className="text-[#E53935] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>Gỡ</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      ĐIỂM HIỆN CÓ
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#00875A] tracking-tight">
                      {memberPoints.toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Chọn khách hàng thành viên
                    </span>
                    {selectedMember && isChangingMember && (
                      <button
                        type="button"
                        onClick={() => setIsChangingMember(false)}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Quay lại
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={memberSearchQuery}
                      onChange={(e) => handleSearchMember(e.target.value)}
                      placeholder="Tìm SĐT hoặc tên khách hàng thành viên..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:border-[#da251d]"
                    />
                  </div>
                  {isSearchingMember && (
                    <p className="text-[11px] text-slate-400 italic">Đang tìm khách hàng...</p>
                  )}
                  {memberSearchResults.length > 0 && (
                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-xs">
                      {memberSearchResults.map((m: any) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedMember(m);
                            setIsChangingMember(false);
                            setMemberSearchQuery('');
                            setMemberSearchResults([]);
                          }}
                          className="w-full text-left p-2.5 hover:bg-amber-50 flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-slate-800 block">{m.fullName || m.phone}</span>
                            <span className="text-[11px] text-slate-400">{m.phone}</span>
                          </div>
                          <span className="font-bold text-[#00875A] bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                            {(m.points ?? m.currentPoints ?? 0).toLocaleString('vi-VN')} điểm
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* VẬT PHẨM CÓ THỂ ĐỔI */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  VẬT PHẨM CÓ THỂ ĐỔI:
                </h4>
                {isLoadingRewards ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between animate-pulse"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                          <div className="space-y-1">
                            <div className="w-28 h-3 bg-slate-200 rounded" />
                            <div className="w-16 h-2.5 bg-slate-200 rounded" />
                          </div>
                        </div>
                        <div className="w-14 h-7 bg-slate-200 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : rewards.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Hiện chưa có món nào thiết lập đổi điểm
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {rewards.map((item: any) => {
                      const requiredPoints = item.redemptionPoints || 0;
                      const canRedeem = selectedMember && memberPoints >= requiredPoints;
                      const isRedeeming = isRedeemingId === item.id;

                      return (
                        <div
                          key={item.id}
                          className="p-2.5 bg-white border border-slate-100 hover:border-slate-200 rounded-2xl flex items-center justify-between gap-2 shadow-2xs transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 shrink-0 relative overflow-hidden flex items-center justify-center">
                              {item.imageUrl ? (
                                <Image
                                  src={item.imageUrl}
                                  alt={item.name}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              ) : (
                                <Utensils className="w-5 h-5 text-slate-300" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-bold text-slate-800 text-xs truncate">
                                {item.name}
                              </h5>
                              <div className="flex items-center gap-1 text-[11px] font-bold text-[#F06A6A] mt-0.5">
                                <span>🪙</span>
                                <span>{requiredPoints.toLocaleString('vi-VN')} điểm</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={!canRedeem || isRedeeming}
                            onClick={() => handleExecuteRedeem(item)}
                            className={`shrink-0 px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center min-w-[56px] ${
                              canRedeem
                                ? 'bg-[#da251d] hover:bg-[#b81d16] text-white shadow-xs active:scale-95 cursor-pointer'
                                : 'bg-[#fca5a5]/40 text-[#fca5a5] cursor-not-allowed'
                            }`}
                          >
                            {isRedeeming ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              'Đổi'
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reason Selection (For non-voucher, non-points) */}
          {discountType !== 'VOUCHER' && discountType !== 'POINTS' && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="block text-gray-700 font-bold">Lý do giảm giá:</label>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_ORDER_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedReason(r)}
                    className={`p-2 rounded-xl border text-left font-medium transition-all text-[11px] cursor-pointer ${
                      selectedReason === r
                        ? 'border-[#da251d] bg-red-50/50 text-[#da251d] font-bold'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {selectedReason === 'Lý do khác' && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Ghi rõ lý do giảm giá..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#da251d] focus:bg-white"
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
          <div>
            {currentDiscount > 0 && (
              <button
                type="button"
                onClick={handleRemove}
                className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hủy giảm giá hiện tại</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-100 text-xs cursor-pointer"
            >
              Đóng
            </button>
            {discountType !== 'POINTS' && (
              <button
                type="button"
                disabled={calculatedDiscount <= 0}
                onClick={handleConfirm}
                className="px-5 py-2.5 rounded-xl bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-200 disabled:text-gray-400 text-white font-black text-xs transition-all shadow-md shadow-red-500/20 cursor-pointer"
              >
                Áp dụng khuyến mại
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
