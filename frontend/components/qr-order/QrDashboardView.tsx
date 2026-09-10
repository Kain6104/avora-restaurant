'use client';

import React from 'react';
import Image from 'next/image';
import {
  Bell,
  CreditCard,
  UtensilsCrossed,
  Gift,
  ClipboardList,
  ChevronRight,
  Sparkles,
  User,
  ShieldCheck,
  Clock,
  QrCode,
  Edit2,
} from 'lucide-react';
import { QrSessionData, QrGuest } from './qr-types';

interface QrDashboardViewProps {
  sessionData: QrSessionData;
  guest: QrGuest;
  onOpenMenu: () => void;
  onOpenTableOrders: () => void;
  onOpenCallStaff: () => void;
  onOpenPaymentRequest: () => void;
  onOpenRewards: () => void;
  onOpenChangeGuest: () => void;
  orderedItemsCount?: number;
}

export const QrDashboardView: React.FC<QrDashboardViewProps> = ({
  sessionData,
  guest,
  onOpenMenu,
  onOpenTableOrders,
  onOpenCallStaff,
  onOpenPaymentRequest,
  onOpenRewards,
  onOpenChangeGuest,
  orderedItemsCount = 0,
}) => {
  const isBuffetActive = sessionData.buffetSession && sessionData.buffetSession.status === 'ACTIVE';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans select-none pb-[calc(2rem+env(safe-area-inset-bottom))]">
      {/* Top Header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 z-20 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-24 h-7 relative">
            <Image
              src="/avora_logo_ngang.png"
              alt="Avora"
              fill
              sizes="96px"
              className="object-contain"
              priority
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[#da251d] text-xs font-black">
          <span>{sessionData.table.name}</span>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-6">
        {/* Table & Guest Context Card */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-red-50 rounded-full opacity-60 pointer-events-none" />

          <div className="flex items-start justify-between gap-3 relative z-10">
            <div>
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                {sessionData.branch.name}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900">
                  Xin chào, <span className="text-[#da251d]">{guest.guestName}</span>
                </h2>
                <button
                  type="button"
                  onClick={onOpenChangeGuest}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                  title="Thay đổi tên hoặc thành viên"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Thay đổi</span>
                </button>
              </div>

              {/* Member Tier & Points Badge if verified */}
              {guest.user ? (
                <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    Hạng: <strong>{guest.user.membershipTier?.name || 'Thành viên'}</strong> • Điểm:{' '}
                    <strong className="text-slate-900 font-black">{guest.user.points || 0}</strong>
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Chưa liên kết thẻ thành viên để tích điểm.
                </p>
              )}
            </div>
          </div>

        </section>

        {/* Section: HỖ TRỢ BÀN ĂN */}
        <section className="space-y-2.5">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider px-1">
            Quý khách cần hỗ trợ gì?
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Gọi nhân viên */}
            <button
              type="button"
              onClick={onOpenCallStaff}
              className="bg-white hover:bg-slate-50/80 active:scale-[0.98] border border-slate-200/80 rounded-2xl p-4 flex flex-col items-start justify-between min-h-[105px] shadow-xs transition-all cursor-pointer text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block group-hover:text-amber-600 transition-colors">
                  GỌI NHÂN VIÊN
                </span>
                <span className="text-[10px] text-slate-400">Khăn, đá, hỗ trợ bàn</span>
              </div>
            </button>

            {/* Gọi thanh toán */}
            <button
              type="button"
              onClick={onOpenPaymentRequest}
              className="bg-white hover:bg-slate-50/80 active:scale-[0.98] border border-slate-200/80 rounded-2xl p-4 flex flex-col items-start justify-between min-h-[105px] shadow-xs transition-all cursor-pointer text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block group-hover:text-blue-600 transition-colors">
                  GỌI THANH TOÁN
                </span>
                <span className="text-[10px] text-slate-400">Tiền mặt, PayOS, thẻ...</span>
              </div>
            </button>
          </div>
        </section>

        {/* Section: THỰC ĐƠN & GỌI MÓN (Hero Action Card) */}
        <section className="space-y-2.5">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider px-1">
            Thực đơn & Gọi món
          </h3>

          <button
            type="button"
            onClick={onOpenMenu}
            className="w-full bg-gradient-to-r from-[#da251d] to-[#ba1b14] hover:from-[#c41f17] hover:to-[#9e1610] active:scale-[0.99] text-white rounded-3xl p-5 shadow-lg shadow-red-500/20 flex items-center justify-between transition-all cursor-pointer text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-base font-black tracking-wide block">
                  XEM THỰC ĐƠN & GỌI MÓN
                </span>
                <p className="text-xs text-white/80 mt-0.5">
                  {isBuffetActive
                    ? 'Gói Buffet & các món gọi thêm mang về'
                    : 'Thực đơn món ăn & đồ uống tươi ngon'}
                </p>
              </div>
            </div>

            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </button>
        </section>

        {/* Section: ĐƠN CỦA BÀN & QUYỀN LỢI */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Đơn của bàn */}
          <button
            type="button"
            onClick={onOpenTableOrders}
            className="bg-white hover:bg-slate-50/80 active:scale-[0.98] border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-xs transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block group-hover:text-purple-600 transition-colors">
                  ĐƠN CỦA BÀN
                </span>
                <span className="text-[10px] text-slate-400">
                  {orderedItemsCount > 0 ? `${orderedItemsCount} món đã gửi` : 'Chưa có món nào'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
          </button>

          {/* Đổi điểm thưởng */}
          <button
            type="button"
            onClick={onOpenRewards}
            className="bg-white hover:bg-slate-50/80 active:scale-[0.98] border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-xs transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block group-hover:text-emerald-600 transition-colors">
                  ĐỔI ĐIỂM THƯỞNG
                </span>
                <span className="text-[10px] text-slate-400">Xem quà & ưu đãi thành viên</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
          </button>
        </section>
      </main>
    </div>
  );
};
