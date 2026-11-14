"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  Check,
  X,
  Clock,
  Smartphone,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChefHat,
  Sparkles,
  Zap,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  BellRing,
  Receipt,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePosSocket } from './usePosSocket';

interface PendingQrRoundItem {
  id: string;
  quantity: number;
  priceAtSale: number;
  pricingMode: string;
  note?: string;
  optionsTextSnapshot?: string;
  product: {
    id: string;
    name: string;
    imageUrl?: string;
    unit?: string;
  };
}

interface PendingQrRound {
  id: string;
  roundNumber: number;
  orderId: string;
  guestName: string;
  status: string;
  createdAt: string;
  order: {
    id: string;
    orderCode: string;
    table?: {
      id: string;
      tableCode: string;
      name: string;
    };
  };
  items: PendingQrRoundItem[];
}

interface PosServiceRequestItem {
  id: string;
  requestType?: string;
  paymentMethodCode?: string;
  status?: string;
  note?: string;
  orderId?: string | null;
  orderCode?: string | null;
  totalAmount?: number;
  table?: {
    id: string;
    name: string;
    tableCode: string;
  } | null;
  guestName?: string;
  createdAt?: string;
}

interface QrOrderPanelProps {
  branchId: string;
  onAcceptQrOrder?: (order: any) => void;
  isDarkMode?: boolean;
}

export const QrOrderPanel: React.FC<QrOrderPanelProps> = ({ branchId, onAcceptQrOrder, isDarkMode = false }) => {
  const [rounds, setRounds] = useState<PendingQrRound[]>([]);
  const [serviceRequests, setServiceRequests] = useState<PosServiceRequestItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'FOOD' | 'SERVICE'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Branch Setting: qrAutoSendToKitchen
  const [qrAutoSendToKitchen, setQrAutoSendToKitchen] = useState(false);
  const [isUpdatingSetting, setIsUpdatingSetting] = useState(false);

  // Reject modal state
  const [rejectingRound, setRejectingRound] = useState<PendingQrRound | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  // 1. Fetch pending rounds & service requests
  const fetchData = useCallback(async (quiet = false) => {
    if (!branchId) return;
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [roundsRes, posQrRes] = await Promise.all([
        fetch(`/api/qr-order/admin/branches/${branchId}/qr-rounds/pending`),
        fetch(`/api/pos/qr-orders?branchId=${branchId}`),
      ]);

      const roundsData = await roundsRes.json();
      if (roundsData.success && Array.isArray(roundsData.data)) {
        setRounds(roundsData.data);
      }

      const posQrData = await posQrRes.json();
      if (posQrData.success && Array.isArray(posQrData.data?.serviceRequests)) {
        const pendingSR = posQrData.data.serviceRequests.filter(
          (s: any) => s.status === 'OPEN' || s.status === 'ACKNOWLEDGED' || s.status === 'PENDING' || !s.status
        );
        setServiceRequests(pendingSR);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách QR order & yêu cầu bàn', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [branchId]);

  // 2. Fetch branch QR settings
  const fetchQrSettings = useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await fetch(`/api/qr-order/admin/branches/${branchId}/qr-settings`);
      const data = await res.json();
      if (data.success && data.data) {
        setQrAutoSendToKitchen(!!data.data.qrAutoSendToKitchen);
      }
    } catch (err) {
      console.error('Lỗi tải cài đặt QR', err);
    }
  }, [branchId]);

  useEffect(() => {
    fetchData();
    fetchQrSettings();
  }, [fetchData, fetchQrSettings]);

  // 3. Socket real-time listener for incoming QR rounds & service requests
  usePosSocket({
    branchId,
    onEvent: (envelope) => {
      if (
        envelope.eventType === 'QR_ORDER_ROUND_SUBMITTED' ||
        envelope.eventType === 'QR_ROUND_APPROVED' ||
        envelope.eventType === 'QR_ROUND_REJECTED' ||
        envelope.eventType === 'ORDER_UPDATED' ||
        envelope.eventType === 'TABLE_SERVICE_REQUEST_CREATED' ||
        envelope.eventType === 'TABLE_SERVICE_REQUEST_RESOLVED' ||
        envelope.eventType === 'TABLE_SERVICE_REQUEST_CANCELLED' ||
        envelope.eventType === 'QR_CALL_STAFF' ||
        envelope.eventType === 'QR_PAYMENT_REQUEST'
      ) {
        fetchData(true);
      }
    },
  });

  // 4. Toggle auto send to kitchen
  const handleToggleAutoSend = async () => {
    const nextVal = !qrAutoSendToKitchen;
    setIsUpdatingSetting(true);
    try {
      const res = await fetch(`/api/qr-order/admin/branches/${branchId}/qr-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrAutoSendToKitchen: nextVal }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi lưu cấu hình');
      }
      setQrAutoSendToKitchen(nextVal);
      toast.success(
        nextVal
          ? 'Đã BẬT: Món gọi qua QR sẽ tự động gửi thẳng vào bếp!'
          : 'Đã TẮT: Món gọi qua QR sẽ cần nhân viên duyệt tại tab này.'
      );
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật cấu hình');
    } finally {
      setIsUpdatingSetting(false);
    }
  };

  // 5. Approve round
  const handleApprove = async (round: PendingQrRound) => {
    setIsProcessingId(round.id);
    try {
      const res = await fetch(`/api/qr-order/admin/rounds/${round.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi duyệt món');
      }

      setRounds((prev) => prev.filter((r) => r.id !== round.id));
      toast.success(`Đã duyệt & gửi bếp lượt gọi món của ${round.order.table?.name || 'bàn'}`);

      onAcceptQrOrder?.(round.order);
    } catch (err: any) {
      toast.error(err.message || 'Không thể duyệt món');
    } finally {
      setIsProcessingId(null);
    }
  };

  // 6. Reject round
  const handleRejectConfirm = async () => {
    if (!rejectingRound) return;
    setIsProcessingId(rejectingRound.id);
    try {
      const res = await fetch(`/api/qr-order/admin/rounds/${rejectingRound.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi từ chối món');
      }

      setRounds((prev) => prev.filter((r) => r.id !== rejectingRound.id));
      toast.success(`Đã từ chối lượt gọi món #${rejectingRound.roundNumber}`);
      setRejectingRound(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err.message || 'Không thể từ chối món');
    } finally {
      setIsProcessingId(null);
    }
  };

  // 7. Resolve service request
  const handleResolveServiceRequest = async (sReq: PosServiceRequestItem) => {
    setIsProcessingId(sReq.id);
    try {
      const res = await fetch(`/api/pos/service-requests/${sReq.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi xử lý yêu cầu');
      }
      setServiceRequests((prev) => prev.filter((s) => s.id !== sReq.id));
      toast.success(
        sReq.requestType === 'PAYMENT'
          ? `Đã tiếp nhận yêu cầu thanh toán của ${sReq.table?.name || 'bàn'}`
          : `Đã hỗ trợ yêu cầu phục vụ của ${sReq.table?.name || 'bàn'}`
      );
    } catch (err: any) {
      toast.error(err.message || 'Không thể xử lý yêu cầu');
    } finally {
      setIsProcessingId(null);
    }
  };

  // 8. Cancel service request
  const handleCancelServiceRequest = async (sReq: PosServiceRequestItem) => {
    setIsProcessingId(sReq.id);
    try {
      const res = await fetch(`/api/pos/service-requests/${sReq.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Nhân viên thu ngân hủy yêu cầu' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi hủy yêu cầu');
      }
      setServiceRequests((prev) => prev.filter((s) => s.id !== sReq.id));
      toast.success(`Đã hủy yêu cầu của ${sReq.table?.name || 'bàn'}`);
    } catch (err: any) {
      toast.error(err.message || 'Không thể hủy yêu cầu');
    } finally {
      setIsProcessingId(null);
    }
  };

  const visibleRounds = activeFilter === 'SERVICE' ? [] : rounds;
  const visibleServiceRequests = activeFilter === 'FOOD' ? [] : serviceRequests;
  const totalCount = rounds.length + serviceRequests.length;

  return (
    <div className={`flex-1 flex flex-col overflow-hidden select-none ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
    }`}>
      {/* Top Header & Settings Bar */}
      <div className={`border-b px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            isDarkMode ? 'bg-red-950/50 text-red-400' : 'bg-red-50 text-[#da251d]'
          }`}>
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Yêu cầu từ khách qua mã QR tại bàn
              </h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                isDarkMode
                  ? 'bg-red-950/40 border-red-900/60 text-red-300'
                  : 'bg-red-50 border-red-200 text-[#da251d]'
              }`}>
                {totalCount} yêu cầu chờ xử lý
              </span>
            </div>
            <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Đồng bộ thời gian thực các lượt gọi món, gọi nhân viên và yêu cầu thanh toán từ khách
            </p>
          </div>
        </div>

        {/* Right Action Bar: Auto-Send Toggle + Refresh */}
        <div className="flex items-center gap-3">
          {/* Toggle Switch */}
          <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border ${
            isDarkMode ? 'bg-slate-850 border-slate-700' : 'bg-slate-100/90 border-slate-200'
          }`}>
            <div className="text-right">
              <span className={`text-xs font-bold block flex items-center gap-1 justify-end ${
                isDarkMode ? 'text-slate-200' : 'text-slate-800'
              }`}>
                <Zap className={`w-3.5 h-3.5 ${qrAutoSendToKitchen ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                Tự động gửi bếp
              </span>
              <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {qrAutoSendToKitchen ? 'Bật: Không cần xác nhận' : 'Tắt: Nhân viên duyệt'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleAutoSend}
              disabled={isUpdatingSetting}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer disabled:opacity-50 ${
                qrAutoSendToKitchen ? 'bg-emerald-500' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                  qrAutoSendToKitchen ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchData(true)}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
              isDarkMode
                ? 'border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
            }`}
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sub-tabs for filtering */}
      <div className={`px-6 py-2 border-b flex items-center gap-2 shrink-0 ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'ALL'
              ? 'bg-[#da251d] text-white shadow-xs'
              : isDarkMode
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Tất cả ({totalCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('FOOD')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'FOOD'
              ? 'bg-[#da251d] text-white shadow-xs'
              : isDarkMode
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Món chờ duyệt ({rounds.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('SERVICE')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'SERVICE'
              ? 'bg-[#da251d] text-white shadow-xs'
              : isDarkMode
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Hỗ trợ & Thanh toán ({serviceRequests.length})
        </button>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 overflow-y-auto p-6 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-[#da251d]" />
            <span className="text-xs font-semibold">Đang tải danh sách yêu cầu QR...</span>
          </div>
        ) : visibleRounds.length === 0 && visibleServiceRequests.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 max-w-sm mx-auto">
            <div className={`w-16 h-16 rounded-3xl border flex items-center justify-center mb-3 shadow-xs ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-600' : 'bg-white border-slate-200 text-slate-300'
            }`}>
              <Smartphone className="w-8 h-8" />
            </div>
            <h3 className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Không có yêu cầu nào đang chờ
            </h3>
            <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {qrAutoSendToKitchen
                ? 'Chi nhánh đang bật chế độ TỰ ĐỘNG GỬI BẾP. Yêu cầu gọi món và hỗ trợ sẽ hiển thị ngay khi khách gửi.'
                : 'Khách hàng quét mã QR trên bàn sẽ xuất hiện tại đây theo thời gian thực để nhân viên tiếp nhận.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6 pb-12">
            {/* Service / Payment Requests Section */}
            {visibleServiceRequests.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Yêu cầu hỗ trợ & thanh toán ({visibleServiceRequests.length})
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleServiceRequests.map((sReq) => {
                    const isPayment = sReq.requestType === 'PAYMENT';
                    const isBusy = isProcessingId === sReq.id;
                    return (
                      <div
                        key={sReq.id}
                        className={`rounded-3xl border p-5 flex flex-col justify-between shadow-sm relative overflow-hidden ${
                          isPayment
                            ? isDarkMode ? 'bg-blue-950/20 border-blue-900/50' : 'bg-blue-50/40 border-blue-200'
                            : isDarkMode ? 'bg-amber-950/20 border-amber-900/50' : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                                isPayment
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-amber-600 text-white'
                              }`}>
                                {isPayment ? <Receipt className="w-5 h-5" /> : <BellRing className="w-5 h-5" />}
                              </div>
                              <div>
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                  {sReq.table?.name || `Bàn ${sReq.table?.tableCode || ''}`}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                                    isPayment
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  }`}>
                                    {isPayment ? 'Gọi thanh toán' : 'Gọi nhân viên'}
                                  </span>
                                  {sReq.guestName && (
                                    <span className="text-[11px] text-slate-500 truncate">
                                      • {sReq.guestName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {sReq.createdAt && (
                              <span className="text-[10px] text-slate-400 font-mono shrink-0 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(sReq.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          {sReq.note && (
                            <p className={`text-xs p-2.5 rounded-xl border ${
                              isDarkMode ? 'bg-slate-900/80 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                            }`}>
                              {sReq.note}
                            </p>
                          )}

                          {isPayment && (
                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="text-slate-500 font-medium">Hình thức:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {sReq.paymentMethodCode === 'TRANSFER' || sReq.paymentMethodCode === 'BANK_TRANSFER'
                                  ? 'Chuyển khoản'
                                  : 'Tiền mặt'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-slate-200/80 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleCancelServiceRequest(sReq)}
                            disabled={isBusy}
                            className="py-2.5 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Từ chối</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveServiceRequest(sReq)}
                            disabled={isBusy}
                            className={`py-2.5 px-3 text-white rounded-2xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                              isPayment
                                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                            }`}
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                <span>{isPayment ? 'Tiếp nhận' : 'Hoàn tất'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Food Rounds Section */}
            {visibleRounds.length > 0 && (
              <div className="space-y-3">
                {visibleServiceRequests.length > 0 && (
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Món gọi chờ duyệt ({visibleRounds.length})
                  </h4>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleRounds.map((round) => {
                    const totalRoundPrice = round.items.reduce(
                      (sum, it) => sum + (it.priceAtSale || 0) * it.quantity,
                      0
                    );
                    const isProcessing = isProcessingId === round.id;

                    return (
                      <div
                        key={round.id}
                        className={`rounded-3xl border shadow-sm p-5 flex flex-col justify-between space-y-3 relative overflow-hidden ${
                          isDarkMode
                            ? 'bg-slate-900 border-red-950/80 text-slate-100 hover:border-red-900/80'
                            : 'bg-white border-red-200/90 text-slate-900'
                        }`}
                      >
                        <div className="space-y-2">
                          {/* Header: Table & Round Info */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-black text-[#da251d]">
                                  {round.order.table?.name || `Bàn ${round.order.table?.tableCode || ''}`}
                                </span>
                                <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                                  isDarkMode ? 'bg-red-950 text-red-300 border border-red-900/60' : 'bg-red-100 text-red-800'
                                }`}>
                                  Lượt #{round.roundNumber}
                                </span>
                              </div>
                              <span className={`text-xs font-semibold block mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                Người gọi: <strong className={isDarkMode ? 'text-white' : 'text-slate-800'}>{round.guestName || 'Khách tại bàn'}</strong>
                              </span>
                            </div>

                            <span className={`text-[10px] flex items-center gap-1 font-mono shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              <Clock className="w-3 h-3" />
                              {new Date(round.createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Items List */}
                          <div className={`divide-y border-y py-2 space-y-2 max-h-56 overflow-y-auto ${
                            isDarkMode ? 'divide-slate-800 border-slate-800' : 'divide-slate-100 border-slate-100'
                          }`}>
                            {round.items.map((it) => (
                              <div key={it.id} className="text-xs pt-2 first:pt-0 space-y-0.5">
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <span className={`font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{it.quantity}x </span>
                                    <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{it.product.name}</span>
                                    {it.pricingMode === 'BUFFET_INCLUDED' && (
                                      <span className="ml-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-1 py-0.2 rounded font-bold">
                                        Buffet
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-mono font-bold shrink-0 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    {it.pricingMode === 'BUFFET_INCLUDED' && it.priceAtSale === 0
                                      ? '0đ'
                                      : `${((it.priceAtSale || 0) * it.quantity).toLocaleString('vi-VN')}đ`}
                                  </span>
                                </div>

                                {it.optionsTextSnapshot && (
                                  <p className={`text-[10px] pl-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Tùy chọn: {it.optionsTextSnapshot}
                                  </p>
                                )}

                                {it.note && (
                                  <p className={`text-[10px] px-2 py-0.5 rounded-md pl-4 ${
                                    isDarkMode ? 'text-amber-300 bg-amber-950/40 border border-amber-900/60' : 'text-amber-800 bg-amber-50'
                                  }`}>
                                    Ghi chú: "{it.note}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Total Price of this Round */}
                          <div className="flex justify-between items-baseline pt-1 text-xs">
                            <span className={`font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tổng tiền lượt gọi:</span>
                            <span className="font-extrabold text-sm text-[#da251d] font-mono">
                              {totalRoundPrice.toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        </div>

                        {/* Actions: Reject & Approve */}
                        <div className={`grid grid-cols-2 gap-2 pt-3 border-t ${
                          isDarkMode ? 'border-slate-800' : 'border-slate-100'
                        }`}>
                          <button
                            type="button"
                            onClick={() => setRejectingRound(round)}
                            disabled={isProcessing}
                            className={`py-2.5 px-3 border rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                              isDarkMode
                                ? 'border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white'
                                : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Từ chối</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApprove(round)}
                            disabled={isProcessing}
                            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <ChefHat className="w-4 h-4" />
                                <span>Duyệt & Gửi bếp</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Reason Dialog */}
      {rejectingRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 border ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isDarkMode ? 'bg-rose-950/60 text-rose-400' : 'bg-rose-50 text-rose-600'
              }`}>
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Từ chối lượt gọi món
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {rejectingRound.order.table?.name} • Lượt #{rejectingRound.roundNumber}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-bold block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Lý do từ chối:
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="VD: Món tạm hết nguyên liệu, khách đổi ý..."
                className={`w-full h-20 p-3 rounded-2xl text-xs outline-none transition-all resize-none border ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-red-400 focus:bg-slate-750'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-red-400'
                }`}
              />

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {['Tạm hết nguyên liệu', 'Bàn hủy gọi món', 'Quá giờ phục vụ bếp'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                      isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingRound(null);
                  setRejectReason('');
                }}
                disabled={isProcessingId === rejectingRound.id}
                className={`py-2.5 rounded-2xl font-bold text-xs cursor-pointer transition-colors ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={isProcessingId === rejectingRound.id}
                className="py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer shadow-md shadow-rose-600/25 flex items-center justify-center gap-1"
              >
                {isProcessingId === rejectingRound.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Xác nhận từ chối</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
