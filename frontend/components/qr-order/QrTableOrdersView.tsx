'use client';

import React from 'react';
import {
  ArrowLeft,
  ChefHat,
  CheckCircle2,
  UtensilsCrossed,
  RefreshCw,
  BellRing,
} from 'lucide-react';
import { QrTableOrderHistory, QrSessionData } from './qr-types';

interface QrTableOrdersViewProps {
  sessionData: QrSessionData;
  orderHistory: QrTableOrderHistory | null;
  onBack: () => void;
  onRefresh: () => void;
  onOpenCallStaff: () => void;
  isLoading?: boolean;
}

export const QrTableOrdersView: React.FC<QrTableOrdersViewProps> = ({
  sessionData,
  orderHistory,
  onBack,
  onRefresh,
  onOpenCallStaff,
  isLoading,
}) => {
  const items = orderHistory?.items || [];

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">
            Đã gửi bếp
          </span>
        );
      case 'PREPARING':
      case 'ACKNOWLEDGED':
        return (
          <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold border border-amber-200 inline-flex items-center gap-1">
            <ChefHat className="w-3 h-3 text-amber-600" />
            <span>Đang nấu</span>
          </span>
        );
      case 'READY':
        return (
          <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Bếp hoàn thành</span>
          </span>
        );
      case 'SERVED':
        return (
          <span className="text-[10px] bg-purple-50 text-purple-800 px-2 py-0.5 rounded font-bold border border-purple-200 inline-flex items-center gap-1">
            <UtensilsCrossed className="w-3 h-3 text-purple-600" />
            <span>Đã lên món</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-bold border border-rose-200">
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium border border-slate-200">
            Chờ xử lý
          </span>
        );
    }
  };

  const renderSourceBadge = (source: string, orderedByName?: string) => {
    if (source === 'QR_ORDER') {
      return (
        <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
          QR - {orderedByName || 'Khách'}
        </span>
      );
    }
    if (source === 'WAITER') {
      return (
        <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
          Phục vụ
        </span>
      );
    }
    return (
      <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
        POS
      </span>
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col text-slate-800 font-sans select-none bg-transparent pb-[calc(2rem+env(safe-area-inset-bottom))]"
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-red-100/60 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại"
            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 leading-tight truncate">
              Đơn hàng của bàn
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              {sessionData.table.name} • {sessionData.branch.name}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          aria-label="Tải lại đơn"
          className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-3">
        {/* Order Summary Card */}
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
              Mã đơn: {orderHistory?.orderCode || sessionData.order.orderCode}
            </span>
            <div className="text-lg font-bold text-[#DA251D] font-mono mt-0.5">
              {(orderHistory?.totalAmount ?? sessionData.order.totalAmount).toLocaleString(
                'vi-VN'
              )}
              đ
            </div>
          </div>

          <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
            {items.length} món đã gọi
          </span>
        </div>

        {/* Notice Strip */}
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-amber-900 text-xs">
          <span>Món đã gửi bếp không thể tự hủy trên điện thoại.</span>
          <button
            type="button"
            onClick={onOpenCallStaff}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#DA251D] hover:underline shrink-0 cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Gọi phục vụ</span>
          </button>
        </div>

        {/* Ordered Items List */}
        {items.length === 0 ? (
          <div className="py-14 bg-white rounded-xl border border-slate-200 text-center text-slate-400 space-y-2">
            <UtensilsCrossed className="w-9 h-9 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Bàn chưa gửi món nào sang bếp</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => {
              const isBuffet = item.pricingMode === 'BUFFET_INCLUDED';
              const isTicket = item.pricingMode === 'BUFFET_TICKET';
              const lineTotal = item.priceAtSale * item.quantity;

              return (
                <div
                  key={item.id || idx}
                  className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <h4 className="text-xs font-bold text-slate-900">{item.productName}</h4>

                      {isBuffet && (
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                          Buffet
                        </span>
                      )}
                      {isTicket && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                          Vé Buffet
                        </span>
                      )}
                      {renderSourceBadge(item.source, item.orderedByName)}
                    </div>

                    <span className="text-xs font-bold text-slate-900 font-mono shrink-0">
                      {isBuffet && item.priceAtSale === 0
                        ? '0đ'
                        : `${lineTotal.toLocaleString('vi-VN')}đ`}
                    </span>
                  </div>

                  {item.optionsTextSnapshot && (
                    <p className="text-[11px] text-slate-500">
                      Tùy chọn: {item.optionsTextSnapshot}
                    </p>
                  )}
                  {item.note && (
                    <p className="text-[11px] text-amber-800 italic">
                      Ghi chú: &ldquo;{item.note}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                    <span className="text-xs text-slate-600">
                      Số lượng: <strong className="text-slate-900 font-bold">{item.quantity}</strong>
                    </span>
                    {renderStatusBadge(item.kitchenStatus)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
