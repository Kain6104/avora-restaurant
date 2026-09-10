'use client';

import React from 'react';
import { 
  X, 
  Ticket, 
  Calendar, 
  Store, 
  CreditCard, 
  Crown, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingBag, 
  Truck, 
  Percent, 
  Info,
  ShieldCheck,
  Zap,
  Tag
} from 'lucide-react';

export interface VoucherConditionModalProps {
  voucher: any | null;
  isOpen: boolean;
  onClose: () => void;
  currentOrderValue?: number; // Optional: for checkout comparison
  currentUserTierId?: string | null;
}

export default function VoucherConditionModal({
  voucher,
  isOpen,
  onClose,
  currentOrderValue,
  currentUserTierId
}: VoucherConditionModalProps) {
  if (!isOpen || !voucher) return null;

  const now = new Date();
  const startDate = new Date(voucher.startDate);
  const endDate = new Date(voucher.endDate);
  const isExpired = now > endDate;
  const isNotStarted = now < startDate;

  const isPercentage = voucher.discountType === 'PERCENTAGE';
  const isShipping = voucher.discountType === 'FREE_SHIP';
  const isFixed = voucher.discountType === 'FIXED_AMOUNT';

  // Format currency
  const formatCurrency = (amount: number) => {
    return (amount || 0).toLocaleString('vi-VN') + ' ₫';
  };

  // Format date time
  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Scope label
  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case 'ONLINE': return 'Chỉ áp dụng đặt hàng trực tuyến (Giao tận nơi)';
      case 'POS': return 'Chỉ áp dụng ăn tại nhà hàng (POS / Bàn)';
      default: return 'Áp dụng cho cả Đặt món Online & Ăn tại nhà hàng';
    }
  };

  // Check min order value status if checkout
  const hasOrderValue = currentOrderValue !== undefined;
  const isOrderValueMet = !hasOrderValue || currentOrderValue >= (voucher.minOrderValue || 0);

  // Remaining quota
  const remainingUserQuota = voucher.remainingUserQuota !== undefined 
    ? voucher.remainingUserQuota 
    : (voucher.usageLimitPerUser !== null && voucher.usedCountByUser !== undefined
        ? Math.max(0, voucher.usageLimitPerUser - voucher.usedCountByUser)
        : voucher.usageLimitPerUser);

  // Product Scope Label
  const getProductScopeLabel = () => {
    const pScope = voucher.applicableProductsScope || 'ALL';
    switch (pScope) {
      case 'CATEGORY':
        return 'Chỉ áp dụng cho các món thuộc Danh mục được chỉ định';
      case 'SPECIFIC_PRODUCTS':
        return 'Chỉ áp dụng cho Danh sách món ăn được chọn cụ thể';
      case 'BEST_SELLER':
        return '🔥 Ưu đãi độc quyền: Chỉ áp dụng cho các món Bán chạy nhất (Best Sellers)';
      case 'SLOW_SELLER':
        return '⚡ Ưu đãi kích cầu: Chỉ áp dụng cho các món ăn được chỉ định trong đợt này';
      default:
        return 'Áp dụng cho tất cả món ăn trên toàn bộ thực đơn';
    }
  };

  // Customer Scope Label
  const getCustomerScopeLabel = () => {
    if (voucher.isFirstOrderOnly || voucher.targetCustomerScope === 'NEW_CUSTOMER') {
      return '🎉 Khách hàng mới: Chỉ áp dụng cho đơn hàng đầu tiên';
    }
    if (voucher.targetCustomerScope === 'SPECIFIC_CUSTOMERS') {
      return 'Ưu đãi đặc quyền: Dành riêng cho khách hàng được tặng mã';
    }
    if (voucher.targetCustomerScope === 'MEMBERSHIP_TIER' || (voucher.membershipTiers && voucher.membershipTiers.length > 0)) {
      return '👑 Áp dụng theo hạng thẻ thành viên';
    }
    return 'Áp dụng cho tất cả khách hàng';
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[86vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="relative bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 text-white p-5 pb-6 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black shadow-inner border border-white/20">
              {isShipping ? <Truck size={24} /> : <Ticket size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm tracking-wider bg-white text-red-600 px-2.5 py-0.5 rounded-lg shadow-xs">
                  {voucher.code}
                </span>
                {voucher.isActive && !isExpired && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/90 text-white">
                    Đang hoạt động
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black mt-1 leading-tight text-white drop-shadow-xs line-clamp-1">
                {voucher.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Modal Body: Detailed Conditions from Database Columns */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 divide-y divide-slate-100">
          
          {/* 1. Mức giảm & Loại chiết khấu */}
          <div className="space-y-2 pt-1">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Percent size={14} className="text-red-600" />
              <span>Giá trị ưu đãi & Mức giảm</span>
            </h3>
            
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-slate-500">Mức chiết khấu:</span>
                <span className="font-black text-base text-red-600">
                  {isPercentage ? `Giảm ${voucher.discountValue}%` :
                   isShipping ? `Miễn phí ship (Tối đa ${formatCurrency(voucher.discountValue)})` :
                   `Giảm ${formatCurrency(voucher.discountValue)}`}
                </span>
              </div>

              {isPercentage && voucher.maxDiscount && (
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Mức giảm tối đa:</span>
                  <span className="font-bold text-slate-800">{formatCurrency(voucher.maxDiscount)}</span>
                </div>
              )}

              {voucher.description && (
                <p className="text-slate-500 text-[11px] pt-1 border-t border-slate-200/60 leading-relaxed italic">
                  {voucher.description}
                </p>
              )}
            </div>
          </div>

          {/* 2. Điều kiện giá trị đơn hàng */}
          <div className="space-y-2 pt-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-red-600" />
              <span>Giá trị đơn hàng tối thiểu</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-[11px]">Đơn hàng tối thiểu:</p>
                <p className="font-black text-sm text-slate-900 mt-0.5">
                  {voucher.minOrderValue > 0 ? formatCurrency(voucher.minOrderValue) : 'Không giới hạn giá trị đơn'}
                </p>
              </div>

              {hasOrderValue && (
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isOrderValueMet 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isOrderValueMet ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                    {isOrderValueMet ? 'Đủ điều kiện' : `Thiếu ${formatCurrency(voucher.minOrderValue - currentOrderValue)}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Thời gian hiệu lực */}
          <div className="space-y-2 pt-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-red-600" />
              <span>Thời gian chương trình</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1 text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Bắt đầu từ:</span>
                <span className="font-semibold text-slate-800">{formatDateTime(startDate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Hạn kết thúc:</span>
                <span className={`font-bold ${isExpired ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatDateTime(endDate)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Giới hạn lượt sử dụng */}
          <div className="space-y-2 pt-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Tag size={14} className="text-red-600" />
              <span>Hạn mức sử dụng</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Giới hạn mỗi khách hàng:</span>
                <span className="font-bold text-slate-800">
                  {voucher.usageLimitPerUser ? `${voucher.usageLimitPerUser} lần / tài khoản` : 'Không giới hạn'}
                </span>
              </div>

              {voucher.usedCountByUser !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Bạn đã sử dụng:</span>
                  <span className="font-bold text-slate-800">
                    {voucher.usedCountByUser} lượt
                    {remainingUserQuota !== null && (
                      <span className="text-emerald-600 ml-1">
                        (Còn {remainingUserQuota} lượt)
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tổng lượt toàn hệ thống:</span>
                <span className="font-bold text-slate-800">
                  {voucher.usageLimit ? `${voucher.usedCount || 0} / ${voucher.usageLimit} lượt` : 'Không giới hạn'}
                </span>
              </div>

              {voucher.isFirstOrderOnly && (
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold flex items-center gap-1.5 mt-1">
                  <Zap size={14} className="text-amber-600 shrink-0" />
                  <span>Ưu đãi độc quyền: Chỉ áp dụng cho đơn hàng đầu tiên của khách hàng mới.</span>
                </div>
              )}
            </div>
          </div>

          {/* 5. Phạm vi kênh áp dụng */}
          <div className="space-y-2 pt-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-red-600" />
              <span>Kênh áp dụng</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 font-medium text-slate-700">
              {getScopeLabel(voucher.applicableScope || 'ALL')}
            </div>
          </div>

          {/* 6. Món ăn áp dụng */}
          <div className="space-y-2 pt-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-red-600" />
              <span>Món ăn áp dụng</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5">
              <p className="font-semibold text-slate-800">{getProductScopeLabel()}</p>
              {voucher.applicableProductsScope === 'BEST_SELLER' && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                  🔥 Tự động áp dụng cho các món ăn thuộc top bán chạy nhất hệ thống.
                </p>
              )}
              {voucher.applicableProductsScope === 'SLOW_SELLER' && (
                <p className="text-[11px] text-blue-700 bg-blue-50 p-2 rounded-xl border border-blue-200">
                  ⚡ Áp dụng cho các món thuộc danh sách ưu đãi kích cầu đặc biệt.
                </p>
              )}
            </div>
          </div>

          {/* 7. Đối tượng khách hàng & Hạng thẻ thành viên */}
          <div className="space-y-2 pt-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Crown size={14} className="text-red-600" />
              <span>Đối tượng khách hàng & Hạng thành viên</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2">
              <p className="font-semibold text-slate-800">{getCustomerScopeLabel()}</p>
              {voucher.membershipTiers && voucher.membershipTiers.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-slate-500 text-[11px]">Chỉ dành riêng cho khách hàng đạt các hạng thẻ sau:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {voucher.membershipTiers.map((tier: any) => {
                      const isMatching = currentUserTierId && currentUserTierId === tier.id;
                      return (
                        <span
                          key={tier.id}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 ${
                            isMatching
                              ? 'bg-purple-100 text-purple-800 border-purple-300'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          <Crown size={12} className="text-amber-500" />
                          <span>{tier.name}</span>
                          {isMatching && <span className="text-[9px] text-purple-600 font-black">(Hạng của bạn)</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-slate-700 font-medium">Áp dụng cho tất cả khách hàng (Mọi hạng thành viên)</p>
              )}
            </div>
          </div>

          {/* 7. Chi nhánh áp dụng */}
          <div className="space-y-2 pt-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Store size={14} className="text-red-600" />
              <span>Chi nhánh áp dụng</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              {voucher.branches && voucher.branches.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-slate-500 text-[11px]">Áp dụng tại các chi nhánh được chỉ định:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {voucher.branches.map((b: any) => (
                      <span
                        key={b.id}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-slate-800 border border-slate-200 flex items-center gap-1"
                      >
                        <Store size={12} className="text-slate-400" />
                        <span>{b.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-slate-700 font-medium">Áp dụng trên toàn bộ chi nhánh hệ thống Avora Restaurant</p>
              )}
            </div>
          </div>

          {/* 8. Phương thức thanh toán áp dụng */}
          <div className="space-y-2 pt-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard size={14} className="text-red-600" />
              <span>Phương thức thanh toán</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              {voucher.appliesToAllPaymentMethods || !voucher.voucherPaymentMethods || voucher.voucherPaymentMethods.length === 0 ? (
                <p className="text-slate-700 font-medium">Áp dụng cho tất cả hình thức thanh toán (Tiền mặt, Chuyển khoản QR SePay, Thẻ ATM...)</p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-slate-500 text-[11px]">Chỉ áp dụng khi thanh toán bằng:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {voucher.voucherPaymentMethods.map((vpm: any) => {
                      const pmName = vpm.paymentMethod?.name || vpm.paymentMethodName || 'Phương thức thanh toán';
                      return (
                        <span
                          key={vpm.id || vpm.paymentMethodId}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-slate-800 border border-slate-200 flex items-center gap-1"
                        >
                          <CreditCard size={12} className="text-blue-500" />
                          <span>{pmName}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Đã hiểu & Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
