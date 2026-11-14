'use client';

import React from 'react';
import Image from 'next/image';
import {
  UtensilsCrossed,
  BellRing,
  Banknote,
  Gift,
  History,
  ShoppingBag,
  ChevronRight,
  ShieldCheck,
  Users,
  Clock,
  MapPin,
  FileText,
  Sparkles,
} from 'lucide-react';
import { AvoraCoin } from '@/components/ui/AvoraCoin';
import { QrGuest, QrSessionData } from './qr-types';

interface QrDashboardViewProps {
  token: string;
  sessionData: QrSessionData;
  guest: QrGuest;
  cartCount: number;
  orderItemsCount?: number;
  isSocketConnected: boolean;
  onOpenMenu: () => void;
  onOpenTableOrders: () => void;
  onOpenCallStaff: () => void;
  onOpenPayment: () => void;
  onOpenVatInvoice: () => void;
  onOpenChangeGuest: () => void;
  onOpenRewards: () => void;
  onOpenActivity: () => void;
  onOpenCart: () => void;
}

export const QrDashboardView: React.FC<QrDashboardViewProps> = ({
  sessionData,
  guest,
  cartCount,
  orderItemsCount = 0,
  isSocketConnected,
  onOpenMenu,
  onOpenTableOrders,
  onOpenCallStaff,
  onOpenPayment,
  onOpenVatInvoice,
  onOpenChangeGuest,
  onOpenRewards,
  onOpenActivity,
  onOpenCart,
}) => {
  const userPoints = guest.user?.points ?? 0;
  const isLoggedIn = Boolean(guest.user);
  const tierName = guest.user?.membershipTier?.name || guest.user?.tierName || 'Thành viên';
  const isPaid = sessionData.order.paymentStatus === 'PAID';
  const orderCodeDisplay = sessionData.order.orderCode || '';

  return (
    <div
      className="min-h-screen flex flex-col text-slate-800 font-sans select-none bg-transparent pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
    >
      {/* 4.1 Slim Premium Top Bar */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-red-100/60 px-4 py-2 pt-[calc(0.6rem+env(safe-area-inset-top))] shadow-2xs">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
          {/* Logo AVORA */}
          <div className="w-28 h-8 relative shrink-0">
            <Image
              src="/avora_logo_ngang.png"
              alt="AVORA"
              fill
              sizes="112px"
              className="object-contain object-left"
              priority
            />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {/* Online Sync Status */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${
                isSocketConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                  : 'bg-amber-50 text-amber-700 border-amber-200/70'
              }`}
              title={isSocketConnected ? 'Đang đồng bộ trực tiếp' : 'Đang kết nối lại'}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSocketConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span className="whitespace-nowrap">{isSocketConnected ? 'Trực tuyến' : 'Kết nối lại'}</span>
            </span>

            {/* User Quick Pill */}
            <button
              type="button"
              onClick={onOpenChangeGuest}
              aria-label="Thông tin khách hàng"
              className="h-8 pl-1 pr-2 rounded-full bg-white/95 hover:bg-slate-100 border border-slate-200/80 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-2xs max-w-[130px]"
            >
              <div className="w-6 h-6 rounded-full bg-[#DA251D] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                {guest.guestName ? guest.guestName.charAt(0).toUpperCase() : 'K'}
              </div>
              <span className="text-xs font-bold text-slate-800 truncate">
                {guest.guestName || 'Khách bàn'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-3.5 max-w-md mx-auto w-full flex flex-col gap-3.5">
        {/* 4.2 Table Header Card (Separate Red Banner with Asset) */}
        <section className="relative rounded-2xl overflow-hidden shadow-sm border border-red-200/40 p-4 text-white min-h-[100px] flex flex-col justify-between">
          <Image
            src="/images/qr-order/backgrounds/qr-order-table-header-bg.png"
            alt="Table header background"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover object-center pointer-events-none"
          />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <div className="inline-flex items-center gap-1 text-xs font-medium text-white/95 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-white/90" />
              <span className="truncate">{sessionData.branch.name}</span>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 border border-white/25 text-xs font-semibold text-white backdrop-blur-md shrink-0 whitespace-nowrap">
              <Users className="w-3.5 h-3.5" />
              <span>{sessionData.order.guestCount || 1} khách</span>
            </span>
          </div>

          <div className="relative z-10 flex items-baseline justify-between gap-2 mt-2">
            <h1 className="text-[28px] font-black tracking-tight text-white leading-none whitespace-nowrap">
              {sessionData.table.name}
            </h1>
            {orderCodeDisplay && (
              <span className="text-xs font-mono font-medium text-white/90 tracking-wide whitespace-nowrap">
                #{orderCodeDisplay}
              </span>
            )}
          </div>
        </section>

        {/* 4.3 Member Information Card */}
        <section className="p-3.5 rounded-2xl bg-white border border-red-100/70 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-red-50 text-[#DA251D] border border-red-100/80 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate leading-tight">
                {guest.guestName}
              </h2>

              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 leading-none whitespace-nowrap">
                  {isLoggedIn ? tierName : 'Thành viên'}
                </span>
                <div className="flex items-center gap-1 text-xs text-slate-500 font-medium whitespace-nowrap">
                  <AvoraCoin amount={userPoints} size="xs" valueClassName="text-xs font-bold text-slate-700" />
                  {isLoggedIn && guest.user?.phone && (
                    <span className="font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      • {guest.user.phone}
                    </span>
                  )}
                  {isLoggedIn && !guest.user?.phone && guest.user?.memberCode && (
                    <span className="font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      • {guest.user.memberCode}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenChangeGuest}
            className="px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/90 text-xs font-bold text-slate-700 shrink-0 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
          >
            {isLoggedIn ? 'Tài khoản' : 'Liên kết'}
          </button>
        </section>

        {/* 4.4 Buffet / Menu Banner */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="w-full relative rounded-2xl overflow-hidden shadow-xs border border-red-200/60 p-3.5 text-left transition-all active:scale-[0.99] cursor-pointer group min-h-[96px] flex items-center"
        >
          <Image
            src="/images/qr-order/backgrounds/qr-order-menu-banner-bg.png"
            alt="Menu banner background"
            fill
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover object-right pointer-events-none transition-transform duration-300 group-hover:scale-[1.01]"
          />

          {/* Left Content Area (max 78% width on mobile to fit text cleanly) */}
          <div className="relative z-10 flex items-center gap-2.5 max-w-[78%] sm:max-w-[72%] min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#DA251D] border border-white/25 flex items-center justify-center shrink-0 text-white shadow-xs">
              <UtensilsCrossed className="w-5 h-5" />
            </div>

            <div className="min-w-0 space-y-0.5">
              {sessionData.buffetSession?.status === 'ACTIVE' ? (
                <>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/25 border border-amber-300/40 text-[10px] font-black uppercase tracking-wider text-amber-200 truncate max-w-full">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      ĐANG MỞ • {sessionData.buffetSession.packageNameSnapshot || 'BUFFET'}
                    </span>
                  </div>
                  <h3 className="text-[13px] sm:text-sm font-black text-white leading-tight break-words">
                    Xem thực đơn &amp; Gọi món 0đ
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-red-100/90 line-clamp-1">
                    Chọn món Buffet theo gói • Gọi thêm &amp; Nước
                  </p>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 border border-white/30 text-[10px] font-black uppercase tracking-wider text-white truncate max-w-full">
                    <UtensilsCrossed className="w-3 h-3 shrink-0" />
                    <span className="truncate">THỰC ĐƠN AVORA</span>
                  </div>
                  <h3 className="text-[13px] sm:text-sm font-black text-white leading-tight break-words">
                    Xem thực đơn &amp; Gọi món
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-red-100/90 line-clamp-1">
                    Chọn món tươi ngon • Gọi trực tiếp xuống bếp
                  </p>
                </>
              )}
            </div>
          </div>
        </button>

        {/* 4.5 Order Summary Card */}
        <section
          onClick={onOpenTableOrders}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenTableOrders();
            }
          }}
          className="w-full relative rounded-2xl overflow-hidden shadow-2xs border border-red-100/90 p-4 text-left transition-all active:scale-[0.99] cursor-pointer group min-h-[96px] flex items-center justify-between gap-3"
        >
          <Image
            src="/images/qr-order/backgrounds/qr-order-summary-bg.png"
            alt="Order summary background"
            fill
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover object-right pointer-events-none"
          />

          <div className="relative z-10 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                ĐƠN CỦA BÀN #{orderCodeDisplay}
              </span>
            </div>

            <span
              className={`inline-block text-[10.5px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                isPaid
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200/70'
              }`}
            >
              {isPaid ? 'Đã thanh toán' : 'Đang phục vụ'}
            </span>

            <div className="flex items-baseline gap-2 pt-0.5 whitespace-nowrap">
              <span className="text-[22px] font-black text-slate-900 tracking-tight leading-none font-mono">
                {sessionData.order.totalAmount.toLocaleString('vi-VN')}đ
              </span>
              {orderItemsCount > 0 && (
                <span className="text-xs font-medium text-slate-500">
                  ({orderItemsCount} món đã gọi)
                </span>
              )}
            </div>
          </div>

          <div className="relative z-10 shrink-0">
            <span className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white text-xs font-bold text-[#DA251D] border border-red-100 shadow-2xs transition-all whitespace-nowrap">
              <span>Xem chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </section>

        {/* 4.6 Tiện ích tại bàn (2-Column Grid) */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3.5 bg-[#DA251D] rounded-full shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                TIỆN ÍCH TẠI BÀN
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium whitespace-nowrap">
              <Clock className="w-3.5 h-3.5" />
              Cập nhật trực tiếp
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <UtilityCard
              icon={<BellRing className="w-4 h-4 text-amber-600" />}
              iconBg="bg-amber-50 border-amber-200/70"
              title="Gọi nhân viên"
              subtitle="Thêm đá, khăn, hỗ trợ tại bàn"
              onClick={onOpenCallStaff}
            />
            <UtilityCard
              icon={<Banknote className="w-4 h-4 text-blue-600" />}
              iconBg="bg-blue-50 border-blue-200/70"
              title="Gọi thanh toán"
              subtitle="Tiền mặt, thẻ hoặc QR Banking"
              onClick={onOpenPayment}
            />
            <UtilityCard
              icon={<Gift className="w-4 h-4 text-emerald-600" />}
              iconBg="bg-emerald-50 border-emerald-200/70"
              title="Đổi điểm thưởng"
              subtitle="Dùng AVORA Coin đổi ưu đãi"
              onClick={onOpenRewards}
            />
            <UtilityCard
              icon={<History className="w-4 h-4 text-purple-600" />}
              iconBg="bg-purple-50 border-purple-200/70"
              title="Lịch sử bàn"
              subtitle="Theo dõi lượt gọi & yêu cầu"
              onClick={onOpenActivity}
            />
            <UtilityCard
              icon={<FileText className="w-4 h-4 text-rose-600" />}
              iconBg="bg-rose-50 border-rose-200/70"
              title="Xuất hóa đơn"
              subtitle={
                sessionData.order.isInvoiceRequested
                  ? `Đã gửi MST: ${sessionData.order.invoiceTaxCode || ''}`
                  : 'Tra cứu MST & nhận HĐĐT'
              }
              onClick={onOpenVatInvoice}
            />
          </div>
        </section>
      </main>

      {/* Bottom Floating Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-red-100 shadow-lg">
          <div className="max-w-md mx-auto">
            <button
              type="button"
              onClick={onOpenCart}
              className="w-full h-12 px-4 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] text-white font-bold text-xs flex items-center justify-between cursor-pointer shadow-md transition-all"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                <span>Giỏ hàng đang chọn ({cartCount} món)</span>
              </span>
              <span className="inline-flex items-center gap-1 font-extrabold">
                <span>Xem &amp; Gửi bếp</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface UtilityCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}

const UtilityCard: React.FC<UtilityCardProps> = ({
  icon,
  iconBg,
  title,
  subtitle,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="p-2 sm:p-2.5 rounded-2xl bg-white hover:bg-slate-50/90 active:scale-[0.98] border border-slate-200/70 shadow-2xs flex items-center gap-2 sm:gap-2.5 text-left transition-all cursor-pointer min-h-[58px]"
  >
    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${iconBg}`}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[12px] sm:text-xs font-bold text-slate-900 leading-snug break-words">{title}</div>
      <div className="text-[9.5px] sm:text-[10px] text-slate-400 mt-0.5 leading-tight line-clamp-1">{subtitle}</div>
    </div>
  </button>
);
