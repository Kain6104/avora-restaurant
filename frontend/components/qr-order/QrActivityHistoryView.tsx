'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  History,
  RefreshCw,
  UtensilsCrossed,
  AlertCircle,
} from 'lucide-react';
import { AvoraCoin } from '@/components/ui/AvoraCoin';
import { formatVietnamDateTime } from '@/lib/utils/vietnam-time';
import { QrActivityItem, QrActivityResponse, QrSessionData } from './qr-types';

interface QrActivityHistoryViewProps {
  token: string;
  sessionData: QrSessionData;
  refreshTrigger?: number;
  onBack: () => void;
  onOpenCallStaff: () => void;
}

const getStatusBadge = (status: string) => {
  const normalized = (status || '').toUpperCase();
  if (['COMPLETED', 'RESOLVED', 'PAID', 'SERVED', 'REDEEMED'].includes(normalized)) {
    return {
      label:
        normalized === 'PAID'
          ? 'Đã thanh toán'
          : normalized === 'SERVED'
          ? 'Đã phục vụ'
          : normalized === 'REDEEMED'
          ? 'Đã đổi'
          : 'Hoàn tất',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (['OPEN', 'PENDING', 'REQUESTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PREPARING'].includes(normalized)) {
    return {
      label:
        normalized === 'OPEN' || normalized === 'PENDING' || normalized === 'REQUESTED'
          ? 'Đang chờ xử lý'
          : normalized === 'ACKNOWLEDGED'
          ? 'Đã tiếp nhận'
          : 'Đang xử lý',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  if (['CANCELLED', 'REJECTED'].includes(normalized)) {
    return {
      label: 'Đã hủy',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }
  return {
    label: status || 'Đã ghi nhận',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  };
};

const renderActivityIcon = (type: QrActivityItem['type']) => {
  switch (type) {
    case 'ROUND':
      return <UtensilsCrossed className="w-4 h-4 text-[#DA251D]" />;
    case 'CALL_STAFF':
      return <BellRing className="w-4 h-4 text-amber-600" />;
    case 'PAYMENT_REQUEST':
      return <CreditCard className="w-4 h-4 text-blue-600" />;
    case 'REWARD_REDEEM':
      return <Gift className="w-4 h-4 text-emerald-600" />;
    case 'PAYMENT_COMPLETED':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    default:
      return <Clock className="w-4 h-4 text-slate-500" />;
  }
};

export const QrActivityHistoryView: React.FC<QrActivityHistoryViewProps> = ({
  token,
  sessionData,
  refreshTrigger = 0,
  onBack,
  onOpenCallStaff,
}) => {
  const [data, setData] = useState<QrActivityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasLoadedOnceRef = React.useRef(false);

  const fetchActivity = useCallback(async () => {
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/qr-order/${token}/activity`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Không thể tải lịch sử hoạt động');
      }
      hasLoadedOnceRef.current = true;
      setData(json);
    } catch (err: unknown) {
      if (!hasLoadedOnceRef.current) {
        setErrorMsg(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/qr-order/${token}/activity`, { cache: 'no-store' });
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Không thể tải lịch sử hoạt động');
        }
        hasLoadedOnceRef.current = true;
        setData(json);
        setErrorMsg(null);
      } catch (err: unknown) {
        if (active && !hasLoadedOnceRef.current) {
          setErrorMsg(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [token, refreshTrigger]);

  const activities = data?.activities || [];
  const isPaid = data?.orderPaymentStatus === 'PAID' || sessionData.order.paymentStatus === 'PAID';

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
              Lịch sử hoạt động
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              {sessionData.table.name} • {sessionData.branch.name}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchActivity}
          aria-label="Làm mới"
          className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-3">
        {/* Session Summary Bar */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
              Mã bàn #{sessionData.order.orderCode}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold text-slate-900">
                {data?.summary?.totalEvents ?? activities.length} sự kiện
              </span>
              {(data?.summary?.pendingRequests ?? 0) > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {data?.summary.pendingRequests} đang chờ
                </span>
              )}
            </div>
          </div>

          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
              isPaid
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            {isPaid ? 'Đã thanh toán' : 'Đang phục vụ'}
          </span>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between gap-2 text-xs text-rose-700">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={fetchActivity}
              className="text-xs font-bold text-rose-800 underline shrink-0 cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && activities.length === 0 ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 p-3.5 animate-pulse flex gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/90 py-14 px-6 text-center space-y-2.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <History className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Chưa có hoạt động nào</h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Các lượt gọi món, yêu cầu hỗ trợ, đổi AVORA Coin và thanh toán tại bàn sẽ được ghi nhận tại đây.
            </p>
            <button
              type="button"
              onClick={onOpenCallStaff}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#DA251D] text-white text-xs font-bold cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Gọi nhân viên hỗ trợ</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/90 divide-y divide-slate-100">
            {activities.map((item) => {
              const badge = getStatusBadge(item.status);
              const coinPoints =
                typeof item.metadata?.pointsDelta === 'number'
                  ? item.metadata.pointsDelta
                  : typeof item.metadata?.points === 'number'
                  ? item.metadata.points
                  : typeof item.metadata?.pointsRedeemed === 'number'
                  ? item.metadata.pointsRedeemed
                  : null;
              const roundItems = Array.isArray(item.metadata?.items)
                ? item.metadata.items
                : [];
              const statusMessage =
                typeof item.metadata?.statusMessage === 'string'
                  ? item.metadata.statusMessage
                  : null;
              const normalizedRoundStatus = (item.status || '').toUpperCase();
              const isRejected =
                normalizedRoundStatus === 'REJECTED' || normalizedRoundStatus === 'CANCELLED';

              return (
                <div key={item.id} className="p-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    {renderActivityIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h3>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {item.description && roundItems.length === 0 && (
                      <p className="text-[11px] text-slate-600 leading-relaxed break-words">
                        {item.description}
                      </p>
                    )}

                    {/* Detailed item breakdown with product images for each round */}
                    {roundItems.length > 0 && (
                      <div className="rounded-xl bg-slate-50/90 border border-slate-200/70 divide-y divide-slate-100 overflow-hidden">
                        {roundItems.map((rit, rIdx) => {
                          const isBuffetDish = rit.pricingMode === 'BUFFET_INCLUDED';
                          return (
                            <div
                              key={rit.id || `${item.id}-it-${rIdx}`}
                              className="p-2 flex items-center gap-2.5"
                            >
                              <div className="w-9 h-9 rounded-lg bg-white border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center">
                                {rit.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={rit.imageUrl}
                                    alt={rit.productName}
                                    className="w-full h-full object-contain p-0.5"
                                  />
                                ) : (
                                  <UtensilsCrossed className="w-3.5 h-3.5 text-slate-300" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold text-slate-800 truncate">
                                    <span className="text-[#DA251D] font-mono mr-1">
                                      {rit.quantity}x
                                    </span>
                                    {rit.productName}
                                  </p>
                                  <span className="text-[10px] font-mono font-bold shrink-0 text-slate-500">
                                    {isBuffetDish
                                      ? '0đ'
                                      : `${((rit.priceAtSale || 0) * (rit.quantity || 1)).toLocaleString('vi-VN')}đ`}
                                  </span>
                                </div>
                                {rit.optionsTextSnapshot && (
                                  <p className="text-[10px] text-slate-500 truncate">
                                    + {rit.optionsTextSnapshot}
                                  </p>
                                )}
                                {rit.note && (
                                  <p className="text-[10px] text-amber-700 italic truncate">
                                    Ghi chú: {rit.note}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Staff confirmation / rejection detail */}
                    {statusMessage && (
                      <div
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border leading-snug ${
                          isRejected
                            ? 'bg-rose-50/90 border-rose-200 text-rose-800'
                            : normalizedRoundStatus === 'PENDING_APPROVAL' ||
                              normalizedRoundStatus === 'OPEN'
                            ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                            : 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        {statusMessage}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-mono">
                          {formatVietnamDateTime(item.timestamp, 'HH:mm • DD/MM/YYYY')}
                        </span>
                        {item.actorName && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 font-medium">{item.actorName}</span>
                          </>
                        )}
                      </div>

                      {coinPoints !== null && coinPoints !== 0 && (
                        <AvoraCoin
                          amount={Math.abs(coinPoints)}
                          prefix={item.type === 'REWARD_REDEEM' || coinPoints < 0 ? '-' : '+'}
                          size="xs"
                          valueClassName="text-[11px] font-bold text-amber-700"
                        />
                      )}
                    </div>
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
