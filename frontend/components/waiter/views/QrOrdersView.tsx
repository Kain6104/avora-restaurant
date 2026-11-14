'use client';

import React from 'react';
import useSWR from 'swr';
import { useWaiterStore } from '@/store/useWaiterStore';
import { QrCode, CheckCircle, XCircle, BellRing, Receipt, Clock, Check, User, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { PullToRefresh } from '../common/PullToRefresh';
import ResponsiveModal from '@/components/ui/ResponsiveModal';

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store', credentials: 'include' }).then(r => r.json());

const formatVnTime = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    return `${get('hour')}:${get('minute')} ${get('day')}/${get('month')}/${get('year')}`;
  } catch {
    return '';
  }
};

interface QrServiceRequestItem {
  id: string;
  requestType?: string;
  status?: string;
  tableId?: string;
  table?: { name?: string };
  guestName?: string;
  customerName?: string;
  orderCode?: string;
  note?: string;
  reason?: string;
  paymentMethodCode?: string;
  totalAmount?: number;
  createdAt?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  completedAt?: string;
}

interface QrOrderRoundDishItem {
  id?: string;
  quantity?: number;
  price?: number;
  product?: { name?: string };
  optionsTextSnapshot?: string;
  note?: string;
}

interface QrOrderRoundEntry {
  id: string;
  tableId?: string;
  table?: { name?: string };
  status?: string;
  roundNumber?: number;
  guestName?: string;
  orderCode?: string;
  createdAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectReason?: string;
  items?: QrOrderRoundDishItem[];
}

export default function QrOrdersView() {
  const isOffline = useWaiterStore(s => s.isOffline);
  const activeBranchId = useWaiterStore(s => s.activeBranchId);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = React.useState<'PENDING' | 'CONFIRMED'>('PENDING');

  // Reject modal state
  const [rejectModalRound, setRejectModalRound] = React.useState<{ id: string; tableName?: string } | null>(null);
  const [selectedQuickReason, setSelectedQuickReason] = React.useState<string>('Hết món / Hết nguyên liệu');
  const [customRejectReason, setCustomRejectReason] = React.useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = React.useState<boolean>(false);

  const { data: response, isLoading, mutate } = useSWR(
    isOffline || !activeBranchId ? null : `/api/pos/qr-orders?branchId=${activeBranchId}`,
    fetcher,
    {
      refreshInterval: 4000,
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  );

  const qrRequests = (response?.data?.qrOrders || []) as QrOrderRoundEntry[];
  const serviceRequests = (response?.data?.serviceRequests || []) as QrServiceRequestItem[];

  const handleConfirmQr = async (orderId: string, tableName?: string) => {
    if (processingId === orderId) return;
    setProcessingId(orderId);
    try {
      await mutate(
        async (current: { success?: boolean; data?: { qrOrders?: QrOrderRoundEntry[]; serviceRequests?: QrServiceRequestItem[] } } | undefined) => {
          const res = await fetch(`/api/pos/qr-orders/${orderId}/confirm`, {
            method: 'POST',
            credentials: 'include',
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.message || 'Lỗi xác nhận đơn QR');
          }
          if (!current?.data) return current;
          return {
            ...current,
            data: {
              ...current.data,
              qrOrders: (current.data.qrOrders || []).map((q) =>
                q.id === orderId ? { ...q, status: 'CONFIRMED' } : q
              ),
            },
          };
        },
        {
          optimisticData: (current: { success?: boolean; data?: { qrOrders?: QrOrderRoundEntry[]; serviceRequests?: QrServiceRequestItem[] } } | undefined) =>
            current?.data
              ? {
                  ...current,
                  data: {
                    ...current.data,
                    qrOrders: (current.data.qrOrders || []).map((q) =>
                      q.id === orderId ? { ...q, status: 'CONFIRMED' } : q
                    ),
                  },
                }
              : current,
          rollbackOnError: true,
          revalidate: true,
        }
      );
      toast.success(`Đã duyệt đơn QR cho ${tableName || 'bàn'}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể duyệt đơn');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (orderId: string, tableName?: string) => {
    setRejectModalRound({ id: orderId, tableName });
    setSelectedQuickReason('Hết món / Hết nguyên liệu');
    setCustomRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalRound || isSubmittingReject) return;
    const finalReason =
      selectedQuickReason === 'Lý do khác'
        ? customRejectReason.trim()
        : [selectedQuickReason, customRejectReason.trim()].filter(Boolean).join(' - ');

    if (!finalReason) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    const { id: orderId, tableName } = rejectModalRound;
    setIsSubmittingReject(true);
    setProcessingId(orderId);
    try {
      await mutate(
        async (current: { success?: boolean; data?: { qrOrders?: QrOrderRoundEntry[]; serviceRequests?: QrServiceRequestItem[] } } | undefined) => {
          const res = await fetch(`/api/pos/qr-orders/${orderId}/reject`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: finalReason }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.message || 'Lỗi từ chối đơn QR');
          }
          if (!current?.data) return current;
          return {
            ...current,
            data: {
              ...current.data,
              qrOrders: (current.data.qrOrders || []).filter((q) => q.id !== orderId),
            },
          };
        },
        {
          optimisticData: (current: { success?: boolean; data?: { qrOrders?: QrOrderRoundEntry[]; serviceRequests?: QrServiceRequestItem[] } } | undefined) =>
            current?.data
              ? {
                  ...current,
                  data: {
                    ...current.data,
                    qrOrders: (current.data.qrOrders || []).filter((q) => q.id !== orderId),
                  },
                }
              : current,
          rollbackOnError: true,
          revalidate: true,
        }
      );
      toast.success(`Đã từ chối đơn QR cho ${tableName || 'bàn'}`);
      setRejectModalRound(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể từ chối đơn');
    } finally {
      setIsSubmittingReject(false);
      setProcessingId(null);
    }
  };

  const handleResolveServiceRequest = async (reqId: string, label: string) => {
    if (processingId === reqId) return;
    setProcessingId(reqId);
    try {
      await mutate(
        async (current: { success?: boolean; data?: { qrOrders?: QrOrderRoundEntry[]; serviceRequests?: QrServiceRequestItem[] } } | undefined) => {
          const res = await fetch(`/api/pos/service-requests/${reqId}/resolve`, {
            method: 'POST',
            credentials: 'include',
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.message || 'Không thể cập nhật yêu cầu');
          }
          if (!current?.data) return current;
          return {
            ...current,
            data: {
              ...current.data,
              serviceRequests: (current.data.serviceRequests || []).map((s) =>
                s.id === reqId ? { ...s, status: 'COMPLETED' } : s
              ),
            },
          };
        },
        {
          optimisticData: (current: { success?: boolean; data?: { qrOrders?: QrOrderRoundEntry[]; serviceRequests?: QrServiceRequestItem[] } } | undefined) =>
            current?.data
              ? {
                  ...current,
                  data: {
                    ...current.data,
                    serviceRequests: (current.data.serviceRequests || []).map((s) =>
                      s.id === reqId ? { ...s, status: 'COMPLETED' } : s
                    ),
                  },
                }
              : current,
          rollbackOnError: true,
          revalidate: true,
        }
      );
      toast.success(`Đã hoàn tất ${label}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể hoàn tất yêu cầu');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelServiceRequest = async (reqId: string, label: string) => {
    if (processingId === reqId) return;
    setProcessingId(reqId);
    try {
      await mutate(
        async (current: { success?: boolean; data?: { qrOrders?: QrOrderRoundEntry[]; serviceRequests?: QrServiceRequestItem[] } } | undefined) => {
          const res = await fetch(`/api/pos/service-requests/${reqId}/cancel`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Nhân viên hủy yêu cầu tại bàn' }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.message || 'Không thể hủy yêu cầu');
          }
          if (!current?.data) return current;
          return {
            ...current,
            data: {
              ...current.data,
              serviceRequests: (current.data.serviceRequests || []).map((s) =>
                s.id === reqId ? { ...s, status: 'CANCELLED' } : s
              ),
            },
          };
        },
        {
          optimisticData: (current: { success?: boolean; data?: { qrOrders?: QrOrderRoundEntry[]; serviceRequests?: QrServiceRequestItem[] } } | undefined) =>
            current?.data
              ? {
                  ...current,
                  data: {
                    ...current.data,
                    serviceRequests: (current.data.serviceRequests || []).map((s) =>
                      s.id === reqId ? { ...s, status: 'CANCELLED' } : s
                    ),
                  },
                }
              : current,
          rollbackOnError: true,
          revalidate: true,
        }
      );
      toast.success(`Đã hủy ${label}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể hủy yêu cầu');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingQrRequests = qrRequests.filter((q) => q.status === 'PENDING');
  const processedQrRequests = qrRequests.filter((q) => q.status === 'CONFIRMED' || q.status === 'APPROVED' || q.status === 'REJECTED');

  const pendingServiceRequests = serviceRequests.filter(
    (s) => s.status === 'OPEN' || s.status === 'ACKNOWLEDGED' || s.status === 'PENDING' || !s.status
  );
  const processedServiceRequests = serviceRequests.filter(
    (s) => s.status === 'COMPLETED' || s.status === 'RESOLVED' || s.status === 'CANCELLED'
  );

  const pendingCount = pendingQrRequests.length + pendingServiceRequests.length;
  const processedCount = processedQrRequests.length + processedServiceRequests.length;

  const activeQrList = activeSubTab === 'PENDING' ? pendingQrRequests : processedQrRequests;
  const activeServiceList = activeSubTab === 'PENDING' ? pendingServiceRequests : processedServiceRequests;
  const hasCurrentTabItems = activeQrList.length > 0 || activeServiceList.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50 select-none">
      <div className="px-3.5 pt-[max(8px,calc(env(safe-area-inset-top)+2px))] pb-2.5 bg-white border-b border-slate-200/80 shrink-0 shadow-2xs select-none flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <QrCode className="text-[#DA251D] shrink-0" size={17} />
            <span className="truncate">Yêu cầu từ khách (QR)</span>
          </h2>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            Gọi món, gọi hỗ trợ & thanh toán qua QR
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-50 text-[#DA251D] border border-red-100 text-[11px] font-bold shrink-0">
            {pendingCount} chờ xử lý
          </span>
        )}
      </div>

      {/* 2 Sub-tabs directly below header */}
      <div className="px-3.5 py-2 bg-white border-b border-slate-200/80 flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSubTab('PENDING')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'PENDING'
              ? 'bg-[#DA251D] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span>Chờ xác nhận</span>
          {pendingCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeSubTab === 'PENDING' ? 'bg-white text-[#DA251D]' : 'bg-[#DA251D] text-white'
              }`}
            >
              {pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('CONFIRMED')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'CONFIRMED'
              ? 'bg-[#DA251D] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span>Đã xử lý</span>
          {processedCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeSubTab === 'CONFIRMED' ? 'bg-white text-[#DA251D]' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {processedCount}
            </span>
          )}
        </button>
      </div>

      <PullToRefresh
        onRefresh={async () => {
          if (activeBranchId) {
            const freshRes = await fetch(`/api/pos/qr-orders?branchId=${activeBranchId}`, {
              cache: 'no-store',
              credentials: 'include',
            });
            if (freshRes.ok) {
              const freshJson = await freshRes.json();
              await mutate(freshJson, { revalidate: false });
              return;
            }
          }
          await mutate();
        }}
        isOffline={isOffline}
        className="p-2.5 space-y-2.5 pb-6"
      >
        {isLoading && !isOffline && !hasCurrentTabItems ? (
          <div className="space-y-2.5 animate-pulse">
            {[1, 2, 3].map((slot) => (
              <div key={slot} className="bg-white rounded-xl p-3 border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-24 rounded bg-slate-200" />
                  <div className="h-3 w-12 rounded bg-slate-100" />
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasCurrentTabItems ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <QrCode size={22} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {activeSubTab === 'PENDING' ? 'Chưa có yêu cầu mới chờ xử lý' : 'Chưa có yêu cầu đã xác nhận gần đây'}
            </p>
          </div>
        ) : (
          <>
            {/* Service / Payment Requests from QR */}
            {activeServiceList.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 px-1">
                  Hỗ trợ & Thanh toán ({activeServiceList.length})
                </h3>
                {activeServiceList.map((sReq) => {
                  const isPayment = sReq.requestType === 'PAYMENT';
                  const isBusy = processingId === sReq.id;
                  const isCancelled = sReq.status === 'CANCELLED';
                  const isCompleted = sReq.status === 'COMPLETED' || sReq.status === 'RESOLVED';
                  const isDone = isCompleted || isCancelled;
                  return (
                    <div
                      key={sReq.id}
                      className={`bg-white rounded-xl p-3 shadow-2xs border flex flex-col gap-2 ${
                        isCancelled
                          ? 'border-rose-200 bg-rose-50/20'
                          : isDone
                          ? 'border-slate-200'
                          : isPayment
                          ? 'border-blue-200 bg-blue-50/15'
                          : 'border-amber-200 bg-amber-50/15'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isCancelled
                                ? 'bg-rose-100 text-rose-700'
                                : isDone
                                ? 'bg-emerald-100 text-emerald-700'
                                : isPayment
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {isPayment ? <Receipt size={14} /> : <BellRing size={14} />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-sm text-slate-900">
                                {sReq.table?.name || 'Bàn'}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isCancelled
                                    ? 'bg-rose-100 text-rose-800'
                                    : isDone
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isPayment
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {isCancelled
                                  ? 'Đã hủy'
                                  : isDone
                                  ? 'Đã xử lý'
                                  : isPayment
                                  ? 'Thanh toán'
                                  : 'Gọi NV'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              <strong className="text-slate-700">{sReq.guestName}</strong>
                              {sReq.orderCode ? ` · #${sReq.orderCode}` : ''}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 shrink-0 pt-0.5">
                          <Clock size={10} />
                          {formatVnTime(sReq.createdAt)}
                        </span>
                      </div>

                      {(sReq.note || sReq.paymentMethodCode || isPayment) && (
                        <div className="bg-white/95 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 space-y-0.5">
                          {isPayment && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-600 truncate">
                                PT:{' '}
                                <strong className="text-slate-900">
                                  {sReq.paymentMethodCode || 'Tại bàn / Quầy'}
                                </strong>
                              </span>
                              <span className="font-mono font-bold text-[#DA251D] shrink-0">
                                {Number(sReq.totalAmount || 0).toLocaleString('vi-VN')}₫
                              </span>
                            </div>
                          )}
                          {sReq.note && <p className="text-[11px] text-slate-600">Ghi chú: {sReq.note}</p>}
                        </div>
                      )}

                      {!isDone ? (
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleCancelServiceRequest(
                                sReq.id,
                                `${isPayment ? 'thanh toán' : 'hỗ trợ'} tại ${sReq.table?.name || 'bàn'}`,
                              )
                            }
                            className="w-1/3 min-h-[44px] py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 active:scale-[0.99] transition-all cursor-pointer"
                          >
                            <XCircle size={14} />
                            <span>Hủy</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleResolveServiceRequest(
                                sReq.id,
                                `${isPayment ? 'thanh toán' : 'hỗ trợ'} tại ${sReq.table?.name || 'bàn'}`,
                              )
                            }
                            className="flex-1 min-h-[44px] py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.99] transition-all cursor-pointer"
                          >
                            <Check size={15} />
                            <span>{isBusy ? 'Đang xử lý...' : 'Tiếp nhận & Hoàn tất'}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span className="flex items-center gap-1 text-slate-600">
                            <User size={12} className={isCancelled ? 'text-rose-600' : 'text-emerald-600'} />
                            <span>
                              {isCancelled ? 'Nhân viên hủy: ' : 'Nhân viên xử lý: '}
                              <strong className="text-slate-800">
                                {sReq.acknowledgedByName || 'Nhân viên phục vụ'}
                              </strong>
                            </span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {formatVnTime(sReq.completedAt || sReq.acknowledgedAt || sReq.createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* QR Food Rounds & Orders */}
            {activeQrList.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 px-1">
                  Lượt gọi món QR ({activeQrList.length})
                </h3>
                {activeQrList.map((req) => {
                  const isPending = req.status === 'PENDING';
                  const isRejected = req.status === 'REJECTED';
                  const isBusy = processingId === req.id;
                  return (
                    <div
                      key={req.id}
                      className={`bg-white rounded-xl p-3 shadow-2xs border flex flex-col gap-2 ${
                        isRejected ? 'border-rose-200 bg-rose-50/15' : isPending ? 'border-red-200' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-black text-slate-900 text-sm">
                              {req.table?.name || req.tableId}
                            </h3>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                isPending
                                  ? 'bg-red-100 text-[#DA251D]'
                                  : isRejected
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isPending
                                ? `Lượt #${req.roundNumber || 1} · Chờ duyệt`
                                : isRejected
                                ? `Lượt #${req.roundNumber || 1} · ĐÃ TỪ CHỐI`
                                : `Lượt #${req.roundNumber || 1} · Đã gửi bếp`}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {req.guestName || 'Khách tại bàn'}
                            {req.orderCode ? ` · #${req.orderCode}` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 shrink-0 pt-0.5">
                          {formatVnTime(req.createdAt)}
                        </span>
                      </div>

                      <div className="bg-slate-50 rounded-lg px-2.5 py-2 space-y-1.5 border border-slate-100">
                        {req.items?.map((item, i) => (
                          <div key={item.id || i} className="text-xs space-y-0.5">
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="font-bold text-slate-800 leading-snug">
                                {item.quantity}x {item.product?.name}
                              </span>
                              <span className="text-slate-700 font-semibold font-mono text-[11px] shrink-0">
                                {((item.price || 0) * (item.quantity || 1)).toLocaleString('vi-VN')}₫
                              </span>
                            </div>
                            {item.optionsTextSnapshot && (
                              <p className="text-[11px] text-slate-500 leading-tight">+ {item.optionsTextSnapshot}</p>
                            )}
                            {item.note && (
                              <p className="text-[11px] text-amber-700 italic leading-tight">Ghi chú: {item.note}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {isRejected && req.rejectReason && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-100">
                          Lý do từ chối: <strong>{req.rejectReason}</strong>
                        </div>
                      )}

                      {isPending ? (
                        <div className="flex gap-2 pt-0.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openRejectModal(req.id, req.table?.name)}
                            className="flex-1 min-h-[44px] bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <XCircle size={16} />
                            <span>Từ chối</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleConfirmQr(req.id, req.table?.name)}
                            className="flex-1 min-h-[44px] bg-[#DA251D] hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs shadow-red-200 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <CheckCircle size={16} />
                            <span>{isBusy ? 'Đang xử lý...' : 'Xác nhận'}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span className="flex items-center gap-1 text-slate-600">
                            <User size={12} className={isRejected ? 'text-rose-600' : 'text-emerald-600'} />
                            <span>
                              {isRejected ? 'Nhân viên từ chối: ' : 'Nhân viên duyệt: '}
                              <strong className="text-slate-800">
                                {req.approvedByName || 'Nhân viên phục vụ'}
                              </strong>
                            </span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {formatVnTime(req.approvedAt || req.createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </PullToRefresh>

      {/* Reject Reason Modal */}
      <ResponsiveModal
        isOpen={Boolean(rejectModalRound)}
        onClose={() => !isSubmittingReject && setRejectModalRound(null)}
        title={`Từ chối món ${rejectModalRound?.tableName ? `(${rejectModalRound.tableName})` : ''}`}
        footer={
          <div className="flex gap-2 w-full">
            <button
              type="button"
              disabled={isSubmittingReject}
              onClick={() => setRejectModalRound(null)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isSubmittingReject}
              onClick={handleConfirmReject}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmittingReject ? <Loader2 size={16} className="animate-spin" /> : 'Xác nhận từ chối'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          <p className="text-xs text-slate-600">
            Vui lòng chọn hoặc nhập lý do từ chối để thông báo lại cho khách:
          </p>

          <div className="space-y-1.5">
            {[
              'Hết món / Hết nguyên liệu',
              'Bếp đang quá tải, tạm dừng nhận món',
              'Khách tại bàn yêu cầu hủy',
              'Sai thông tin tùy chọn món',
              'Lý do khác',
            ].map((reason) => (
              <label
                key={reason}
                onClick={() => setSelectedQuickReason(reason)}
                className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                  selectedQuickReason === reason
                    ? 'border-red-500 bg-red-50/50 font-bold text-red-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="rejectQuickReason"
                  checked={selectedQuickReason === reason}
                  onChange={() => setSelectedQuickReason(reason)}
                  className="accent-[#DA251D]"
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú thêm cho khách {selectedQuickReason === 'Lý do khác' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={2}
              value={customRejectReason}
              onChange={(e) => setCustomRejectReason(e.target.value)}
              placeholder={
                selectedQuickReason === 'Lý do khác'
                  ? 'Nhập lý do cụ thể...'
                  : 'Ghi chú thêm nếu có (ví dụ: món sẽ có lại sau 30 phút)...'
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#DA251D] resize-none leading-relaxed"
            />
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}
