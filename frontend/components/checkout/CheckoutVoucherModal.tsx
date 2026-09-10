'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Ticket, AlertCircle, ChevronRight, Loader2, Check, ShieldCheck, Truck, Wallet } from 'lucide-react';
import Image from 'next/image';
import VoucherConditionModal from '@/components/voucher/VoucherConditionModal';
import toast from 'react-hot-toast';

interface CheckoutVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (vouchers: { discountVoucher: any | null; shippingVoucher: any | null }) => void;
  orderValue: number;
  userId?: string;
  currentUser?: any;
  appliedDiscountVoucher?: any | null;
  appliedShippingVoucher?: any | null;
  branchId?: string;
  paymentMethodId?: string;
}

export default function CheckoutVoucherModal({
  isOpen,
  onClose,
  onApply,
  orderValue,
  userId: initialUserId,
  currentUser: initialCurrentUser,
  appliedDiscountVoucher,
  appliedShippingVoucher,
  branchId,
  paymentMethodId,
}: CheckoutVoucherModalProps) {
  const [mounted, setMounted] = useState(false);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(initialCurrentUser || null);

  const [activeTab, setActiveTab] = useState<'KHO' | 'WALLET'>('KHO');

  useEffect(() => {
    setMounted(true);
  }, []);

  const [selectedDiscountVoucher, setSelectedDiscountVoucher] = useState<any | null>(
    appliedDiscountVoucher || null
  );
  const [selectedShippingVoucher, setSelectedShippingVoucher] = useState<any | null>(
    appliedShippingVoucher || null
  );

  const [voucherCode, setVoucherCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewingVoucher, setViewingVoucher] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialCurrentUser) {
        setCurrentUser(initialCurrentUser);
      }
      fetchVouchers();
      setSelectedDiscountVoucher(appliedDiscountVoucher || null);
      setSelectedShippingVoucher(appliedShippingVoucher || null);
      setVoucherCode('');
    }
  }, [isOpen, appliedDiscountVoucher, appliedShippingVoucher, initialCurrentUser, initialUserId]);

  const fetchVouchers = async () => {
    setLoading(true);
    setError('');
    try {
      let resolvedUser = initialCurrentUser || currentUser;
      let effectiveUserId = initialUserId || resolvedUser?.id;

      if (!resolvedUser) {
        try {
          const userRes = await fetch('/api/auth/me', {
            credentials: 'include',
            headers: { 'ngrok-skip-browser-warning': 'true' },
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            resolvedUser = userData?.user || userData || null;
            setCurrentUser(resolvedUser);
            if (resolvedUser?.id) effectiveUserId = resolvedUser.id;
          }
        } catch (_) {}
      }

      if (!effectiveUserId && typeof window !== 'undefined') {
        const stored = localStorage.getItem('user');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            resolvedUser = parsed;
            setCurrentUser(parsed);
            if (parsed?.id) effectiveUserId = parsed.id;
          } catch (_) {}
        }
      }

      // 1. Fetch public vouchers
      const publicPromise = fetch('/api/promotions/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ userId: effectiveUserId }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : (data?.data || []);
          }
          return [];
        })
        .catch(() => []);

      // 2. Fetch wallet vouchers if user is identified
      const walletPromise = effectiveUserId
        ? fetch(`/api/promotions/vouchers/wallet?userId=${effectiveUserId}`, {
            credentials: 'include',
            headers: { 'ngrok-skip-browser-warning': 'true' },
          })
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                return Array.isArray(data) ? data : (data?.data || []);
              }
              return [];
            })
            .catch(() => [])
        : Promise.resolve([]);

      const [publicList, walletData] = await Promise.all([publicPromise, walletPromise]);

      const walletItems = (walletData || []).map((item: any) => ({
        ...item.voucher,
        isSavedInWallet: true,
        customerVoucherId: item.id,
        isUsed: item.isUsed,
      }));

      const mergedMap = new Map<string, any>();
      (publicList || []).forEach((v: any) => {
        mergedMap.set(v.id, { ...v, isSavedInWallet: false });
      });

      walletItems.forEach((wv: any) => {
        if (mergedMap.has(wv.id)) {
          const existing = mergedMap.get(wv.id);
          mergedMap.set(wv.id, {
            ...existing,
            ...wv,
            isSavedInWallet: true,
          });
        } else {
          mergedMap.set(wv.id, wv);
        }
      });

      setVouchers(Array.from(mergedMap.values()));
    } catch (err) {
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyManualCode = async () => {
    if (!voucherCode.trim()) return;
    setApplyingCode(true);
    try {
      const res = await fetch('/api/promotions/vouchers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          code: voucherCode.trim().toUpperCase(),
          orderValue,
          userId: currentUser?.id,
          branchId,
          paymentMethodId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.voucher) {
        const v = data.voucher;
        if (v.discountType === 'FREE_SHIP') {
          setSelectedShippingVoucher(v);
          toast.success(`Đã chọn mã freeship ${v.code}`);
        } else {
          setSelectedDiscountVoucher(v);
          toast.success(`Đã chọn mã giảm giá ${v.code}`);
        }
        setVoucherCode('');
      } else {
        toast.error(data.message || 'Mã không hợp lệ hoặc không đủ điều kiện');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    } finally {
      setApplyingCode(false);
    }
  };

  const handleConfirmSelection = () => {
    onApply({
      discountVoucher: selectedDiscountVoucher,
      shippingVoucher: selectedShippingVoucher,
    });
    onClose();
  };

  if (!isOpen || !mounted) return null;

  // LỌC BỎ HOÀN TOÀN CÁC VOUCHER HẾT HẠN HOẶC BỊ TẮT (KHÔNG RENDER VÀO MODAL)
  const now = new Date();
  const validVouchers = vouchers.filter((v) => {
    if (v.isActive === false) return false;
    if (v.endDate && new Date(v.endDate) < now) return false;
    return true;
  });

  const publicVouchers = validVouchers.filter((v) => v.isPublic !== false);
  const walletList = validVouchers.filter((v) => v.isSavedInWallet);
  const currentList = activeTab === 'WALLET' ? walletList : publicVouchers;
  const publicCount = publicVouchers.length;
  const walletCount = walletList.length;
  const freeShipVouchers = currentList.filter((v) => v.discountType === 'FREE_SHIP');
  const orderVouchers = currentList.filter((v) => v.discountType !== 'FREE_SHIP');

  const selectedCount = (selectedDiscountVoucher ? 1 : 0) + (selectedShippingVoucher ? 1 : 0);

  const renderVoucherList = (list: any[], isShipping: boolean) => {
    // Đảm bảo không render bất kỳ voucher hết hạn nào
    const nonExpiredList = list.filter((v) => {
      if (v.isActive === false) return false;
      if (v.endDate && new Date(v.endDate) < now) return false;
      return true;
    });

    if (nonExpiredList.length === 0) {
      return (
        <div className="text-xs text-slate-400 py-3 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
          Chưa có mã ưu đãi khả dụng trong mục này
        </div>
      );
    }

    // Phân tích trạng thái chi tiết của từng voucher
    const analyzedList = nonExpiredList.map((voucher) => {
      const startDate = new Date(voucher.startDate);

      const isSystemExhausted = voucher.isSystemExhausted || (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit);
      const isUserExhausted = voucher.usageLimitPerUser !== null && (voucher.usedCountByUser || 0) >= voucher.usageLimitPerUser;
      const isFirstOrderViolated = voucher.isFirstOrderOnly && (voucher.userOrderCount > 0 || (currentUser?._count?.orders > 0));
      const isTierViolated = voucher.membershipTierId && currentUser?.membershipTierId !== voucher.membershipTierId;
      const isBelowMinOrder = orderValue < voucher.minOrderValue;
      const isNotStarted = now < startDate;

      let isEligible = true;
      let reason = '';
      let badge: { text: string; bg: string; textCol: string } | null = null;

      if (voucher.isUsed) {
        isEligible = false;
        reason = 'Mã ưu đãi này đã được sử dụng.';
        badge = { text: 'ĐÃ DÙNG', bg: 'bg-slate-200 border-slate-300', textCol: 'text-slate-600' };
      } else if (isUserExhausted) {
        isEligible = false;
        reason = `Bạn đã sử dụng hết số lần cho phép của mã này (${voucher.usedCountByUser || voucher.usageLimitPerUser}/${voucher.usageLimitPerUser} lần).`;
        badge = { text: 'ĐÃ HẾT LƯỢT CỦA BẠN', bg: 'bg-rose-100 border-rose-300', textCol: 'text-rose-700' };
      } else if (isSystemExhausted) {
        isEligible = false;
        reason = 'Mã khuyến mãi đã hết lượt sử dụng trên toàn hệ thống.';
        badge = { text: 'HẾT LƯỢT HỆ THỐNG', bg: 'bg-slate-200 border-slate-300', textCol: 'text-slate-700' };
      } else if (isNotStarted) {
        isEligible = false;
        reason = 'Mã khuyến mãi chưa bắt đầu.';
        badge = { text: 'CHƯA BẮT ĐẦU', bg: 'bg-slate-200 border-slate-300', textCol: 'text-slate-600' };
      } else if (isFirstOrderViolated) {
        isEligible = false;
        reason = 'Chỉ áp dụng cho khách hàng đặt đơn hàng đầu tiên.';
        badge = { text: 'CHỈ ĐƠN ĐẦU TIÊN', bg: 'bg-amber-100 border-amber-300', textCol: 'text-amber-800' };
      } else if (isTierViolated) {
        isEligible = false;
        reason = 'Chỉ dành cho hạng thẻ hội viên được chỉ định.';
        badge = { text: 'HỘI VIÊN', bg: 'bg-purple-100 border-purple-300', textCol: 'text-purple-800' };
      } else if (isBelowMinOrder) {
        isEligible = false;
        const diff = voucher.minOrderValue - orderValue;
        reason = `Mua thêm ${diff.toLocaleString('vi-VN')}đ để đủ điều kiện áp dụng mã này.`;
        badge = { text: `THIẾU ${(diff / 1000).toLocaleString('vi-VN')}K`, bg: 'bg-amber-50 border-amber-200', textCol: 'text-amber-700' };
      }

      return {
        ...voucher,
        isEligible,
        reason,
        badge,
        isUserExhausted,
        isSystemExhausted,
      };
    });

    // Sắp xếp: Mã khả dụng lên trước, mã hết lượt/không khả dụng xuống dưới
    const sortedList = [...analyzedList].sort((a, b) => {
      if (a.isEligible === b.isEligible) return 0;
      return a.isEligible ? -1 : 1;
    });

    return sortedList.map((voucher) => {
      const isEligible = voucher.isEligible;
      const reason = voucher.reason;
      const badge = voucher.badge;
      const endDate = new Date(voucher.endDate);

      const isSelected = isShipping
        ? selectedShippingVoucher?.id === voucher.id
        : selectedDiscountVoucher?.id === voucher.id;

      const handleToggle = () => {
        if (!isEligible) {
          if (reason) {
            toast.error(reason, { id: `voucher-ineligible-${voucher.id}`, duration: 2500 });
          }
          return;
        }
        if (isShipping) {
          setSelectedShippingVoucher(isSelected ? null : voucher);
        } else {
          setSelectedDiscountVoucher(isSelected ? null : voucher);
        }
      };

      return (
        <div key={voucher.id} className="mb-2.5">
          <div
            onClick={handleToggle}
            className={`relative flex bg-white border rounded-2xl overflow-hidden transition-all shadow-2xs select-none ${
              !isEligible
                ? 'opacity-65 border-slate-200 bg-slate-50/70 cursor-not-allowed'
                : isSelected
                ? 'border-red-500 bg-red-50/20 shadow-xs cursor-pointer ring-2 ring-red-500/20'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/30 cursor-pointer'
            }`}
          >
            {/* Left Decor / Icon */}
            <div
              className={`w-16 sm:w-20 shrink-0 flex items-center justify-center border-r border-dashed border-slate-200 ${
                !isEligible
                  ? 'bg-slate-100 text-slate-400'
                  : isShipping
                  ? 'bg-emerald-50/60'
                  : 'bg-red-50/60'
              }`}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full flex flex-col items-center justify-center shadow-2xs border border-slate-100 overflow-hidden relative">
                {isShipping ? (
                  <>
                    <Truck size={16} className={isEligible ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className={`font-black text-[8px] sm:text-[9px] mt-0.5 ${isEligible ? 'text-emerald-600' : 'text-slate-400'}`}>FreeShip</span>
                  </>
                ) : (
                  <>
                    <Ticket size={16} className={isEligible ? 'text-red-600' : 'text-slate-400'} />
                    <span className={`font-black text-[8px] sm:text-[9px] mt-0.5 ${isEligible ? 'text-red-600' : 'text-slate-400'}`}>Voucher</span>
                  </>
                )}
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-50 rounded-full border-r border-slate-200"></div>
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-50 rounded-full border-l border-slate-200"></div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-3 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                  {voucher.code}
                </span>

                {/* Badge trạng thái nếu hết lượt hoặc không đủ điều kiện */}
                {badge && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border tracking-wide ${badge.bg} ${badge.textCol}`}>
                    {badge.text}
                  </span>
                )}

                {voucher.isSavedInWallet && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                    Trong ví của bạn
                  </span>
                )}

                {voucher.minOrderValue > 0 && !badge && (
                  <span className="text-[10px] text-slate-500 font-medium">
                    Đơn từ {(voucher.minOrderValue / 1000).toLocaleString('vi-VN')}k
                  </span>
                )}
              </div>

              <h4 className={`font-bold text-xs sm:text-sm leading-tight mt-1 truncate ${!isEligible ? 'text-slate-600' : 'text-slate-800'}`}>
                {voucher.title}
              </h4>

              {voucher.discountType === 'PERCENTAGE' && (
                <p className={`text-[11px] font-semibold mt-0.5 ${!isEligible ? 'text-slate-500' : 'text-red-600'}`}>
                  Giảm {voucher.discountValue}%
                  {voucher.maxDiscount ? ` (tối đa ${(voucher.maxDiscount / 1000).toLocaleString('vi-VN')}k)` : ''}
                </p>
              )}
              {voucher.discountType === 'FIXED_AMOUNT' && (
                <p className={`text-[11px] font-semibold mt-0.5 ${!isEligible ? 'text-slate-500' : 'text-red-600'}`}>
                  Giảm {(voucher.discountValue / 1000).toLocaleString('vi-VN')}k vào tiền món
                </p>
              )}
              {voucher.discountType === 'FREE_SHIP' && (
                <p className={`text-[11px] font-semibold mt-0.5 ${!isEligible ? 'text-slate-500' : 'text-emerald-600'}`}>
                  {voucher.discountValue > 0
                    ? `Giảm tối đa ${(voucher.discountValue / 1000).toLocaleString('vi-VN')}k phí giao hàng`
                    : 'Miễn phí giao hàng 100%'}
                </p>
              )}
              
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-400">HSD: {endDate.toLocaleDateString('vi-VN')}</span>
                {voucher.usageLimitPerUser !== null && (
                  <span className="text-[10px] text-slate-400">
                    • Bạn đã dùng: {voucher.usedCountByUser || 0}/{voucher.usageLimitPerUser}
                  </span>
                )}
              </div>
            </div>

            {/* Right Action: Selector & Detail Link */}
            <div className="w-16 sm:w-20 shrink-0 flex flex-col items-center justify-between p-2.5 sm:p-3 border-l border-dashed border-slate-200 bg-slate-50/40">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  !isEligible
                    ? 'border-slate-200 bg-slate-100 text-slate-300'
                    : isSelected
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {isSelected && isEligible && <Check size={12} strokeWidth={3} />}
                {!isEligible && <X size={12} strokeWidth={2.5} className="text-slate-400" />}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setViewingVoucher(voucher);
                  setDetailModalOpen(true);
                }}
                className="text-[10px] text-slate-500 hover:text-red-600 font-semibold transition-colors mt-2"
              >
                Điều kiện
              </button>
            </div>
          </div>

          {/* Reason if not eligible */}
          {!isEligible && (
            <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-slate-600 bg-slate-100/90 border border-slate-200/60">
              <AlertCircle size={12} className={`shrink-0 ${voucher.isUserExhausted ? 'text-rose-500' : 'text-amber-500'}`} />
              <span className={voucher.isUserExhausted ? 'font-semibold text-rose-700' : 'text-slate-600'}>
                {reason}
              </span>
            </div>
          )}
        </div>
      );
    });
  };

  const modalElement = (
    <>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        {/* Modal Window */}
        <div
          className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-200 my-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-red-50 text-red-600">
                <Ticket size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800">Kho Voucher Avora</h3>
                <p className="text-xs text-slate-500">
                  Áp dụng tối đa 1 mã Freeship + 1 mã Giảm giá đơn hàng
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Manual Input Code */}
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="NHẬP MÃ ƯU ĐÃI CỦA BẠN..."
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyManualCode()}
                className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm font-bold bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-red-600 uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 tracking-wider shadow-2xs"
              />
              <button
                type="button"
                onClick={handleApplyManualCode}
                disabled={applyingCode || !voucherCode.trim()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs shrink-0 cursor-pointer"
              >
                {applyingCode ? <Loader2 size={16} className="animate-spin" /> : 'Áp dụng'}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 pt-1 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('KHO')}
              className={`flex items-center gap-1.5 py-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'KHO'
                  ? 'border-red-600 text-red-600 bg-white shadow-2xs rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Ticket size={15} />
              <span>Kho Voucher Avora</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">
                {publicCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('WALLET')}
              className={`flex items-center gap-1.5 py-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'WALLET'
                  ? 'border-red-600 text-red-600 bg-white shadow-2xs rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Wallet size={15} />
              <span>Voucher của tôi</span>
              {walletCount > 0 ? (
                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">
                  {walletCount}
                </span>
              ) : (
                <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-semibold">
                  0
                </span>
              )}
            </button>
          </div>

          {/* Body List */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 className="animate-spin text-red-600" size={28} />
                <span className="text-xs font-semibold">Đang tải kho voucher...</span>
              </div>
            ) : error ? (
              <div className="text-center text-red-500 py-10 text-xs font-semibold">{error}</div>
            ) : activeTab === 'WALLET' && currentList.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-200">
                  <Wallet size={26} />
                </div>
                <h4 className="font-bold text-sm text-slate-800">Chưa có voucher nào trong ví</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Bạn chưa lưu voucher nào vào ví cá nhân. Hãy chuyển sang tab Kho Voucher Avora để chọn các mã ưu đãi đang có sẵn nhé!
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('KHO')}
                  className="mt-3.5 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Xem Kho Voucher Avora →
                </button>
              </div>
            ) : (
              <>
                {/* 1. SECTION: MÃ MIỄN PHÍ VẬN CHUYỂN */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wide">
                      <span className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                        <Truck size={14} />
                      </span>
                      Mã Miễn Phí Vận Chuyển
                    </h4>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Chọn tối đa 1 mã
                    </span>
                  </div>
                  {renderVoucherList(freeShipVouchers, true)}
                </div>

                {/* 2. SECTION: MÃ GIẢM GIÁ ĐƠN HÀNG */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wide">
                      <span className="p-1 rounded-md bg-red-100 text-red-700">
                        <Ticket size={14} />
                      </span>
                      Mã Giảm Giá Đơn Hàng
                    </h4>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Chọn tối đa 1 mã
                    </span>
                  </div>
                  {renderVoucherList(orderVouchers, false)}
                </div>
              </>
            )}
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <div className="text-xs font-semibold text-slate-600">
              Đã chọn: <span className="font-bold text-red-600">{selectedCount}</span>/2 mã ưu đãi
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmSelection}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {selectedCount > 0 ? `Áp dụng (${selectedCount} mã)` : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <VoucherConditionModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        voucher={viewingVoucher}
        currentOrderValue={orderValue}
        currentUserTierId={currentUser?.membershipTierId}
      />
    </>
  );

  return createPortal(modalElement, document.body);
}
