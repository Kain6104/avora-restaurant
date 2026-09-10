'use client';

import React from 'react';
import {
  ArrowLeft,
  Clock,
  ChefHat,
  CheckCircle2,
  UtensilsCrossed,
  XCircle,
  Bell,
  RefreshCw,
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
          <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-200">
            Đã gửi bếp
          </span>
        );
      case 'PREPARING':
      case 'ACKNOWLEDGED':
        return (
          <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-200 flex items-center gap-1">
            <ChefHat className="w-3 h-3 text-amber-600" />
            <span>Đang nấu</span>
          </span>
        );
      case 'READY':
        return (
          <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Bếp hoàn thành</span>
          </span>
        );
      case 'SERVED':
        return (
          <span className="text-[10px] bg-purple-50 text-purple-800 px-2 py-0.5 rounded-full font-bold border border-purple-200 flex items-center gap-1">
            <UtensilsCrossed className="w-3 h-3 text-purple-600" />
            <span>Đã lên món</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold border border-rose-200">
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            Chờ xử lý
          </span>
        );
    }
  };

  const renderSourceBadge = (source: string, orderedByName?: string) => {
    if (source === 'QR_ORDER') {
      return (
        <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
          QR - {orderedByName || 'Khách'}
        </span>
      );
    }
    if (source === 'WAITER') {
      return (
        <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-bold">
          Phục vụ
        </span>
      );
    }
    return (
      <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-bold">
        POS
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans select-none pb-[calc(2rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 z-20 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-slate-900 leading-tight">Đơn của bàn</h2>
            <span className="text-xs text-slate-400 font-semibold">{sessionData.table.name}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
          title="Tải lại đơn"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Main List */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Order Info Card */}
        <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Mã đơn: {orderHistory?.orderCode || sessionData.order.orderCode}
            </span>
            <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
              {(orderHistory?.totalAmount ?? sessionData.order.totalAmount).toLocaleString('vi-VN')}đ
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
              {items.length} món đã gọi
            </span>
          </div>
        </div>

        {/* Notice Card */}
        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-2 text-amber-900 text-xs font-medium">
          <span>Món đã gửi bếp không thể tự hủy trên điện thoại.</span>
          <button
            type="button"
            onClick={onOpenCallStaff}
            className="text-xs font-black text-[#da251d] hover:underline shrink-0 cursor-pointer"
          >
            Gọi phục vụ
          </button>
        </div>

        {/* Ordered Items List */}
        {items.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <UtensilsCrossed className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-bold">Bàn chưa gửi món nào sang bếp</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item, idx) => {
              const isBuffet = item.pricingMode === 'BUFFET_INCLUDED';
              const isTicket = item.pricingMode === 'BUFFET_TICKET';
              const lineTotal = item.priceAtSale * item.quantity;

              return (
                <div
                  key={item.id || idx}
                  className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-black text-slate-900">{item.productName}</h4>

                      {/* Pricing Mode */}
                      {isBuffet && (
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-1.5 py-0.2 rounded font-black">
                          Buffet
                        </span>
                      )}
                      {isTicket && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-black">
                          Vé Buffet
                        </span>
                      )}

                      {/* Source */}
                      {renderSourceBadge(item.source, item.orderedByName)}
                    </div>

                    <span className="text-xs font-black text-slate-900 font-mono shrink-0">
                      {isBuffet && item.priceAtSale === 0 ? '0đ' : `${lineTotal.toLocaleString('vi-VN')}đ`}
                    </span>
                  </div>

                  {/* Options & Note */}
                  {item.optionsTextSnapshot && (
                    <p className="text-[10px] text-slate-500">
                      Tùy chọn: {item.optionsTextSnapshot}
                    </p>
                  )}
                  {item.note && (
                    <p className="text-[10px] text-amber-800 italic">
                      Ghi chú: "{item.note}"
                    </p>
                  )}

                  {/* Subline: Status & Quantity */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
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
