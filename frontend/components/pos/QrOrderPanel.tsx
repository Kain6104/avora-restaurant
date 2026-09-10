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

interface QrOrderPanelProps {
  branchId: string;
  onAcceptQrOrder?: (order: any) => void;
}

export const QrOrderPanel: React.FC<QrOrderPanelProps> = ({ branchId, onAcceptQrOrder }) => {
  const [rounds, setRounds] = useState<PendingQrRound[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Branch Setting: qrAutoSendToKitchen
  const [qrAutoSendToKitchen, setQrAutoSendToKitchen] = useState(false);
  const [isUpdatingSetting, setIsUpdatingSetting] = useState(false);

  // Reject modal state
  const [rejectingRound, setRejectingRound] = useState<PendingQrRound | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  // 1. Fetch pending rounds
  const fetchPendingRounds = useCallback(async (quiet = false) => {
    if (!branchId) return;
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch(`/api/qr-order/admin/branches/${branchId}/qr-rounds/pending`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRounds(data.data);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách QR order chờ duyệt', err);
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
    fetchPendingRounds();
    fetchQrSettings();
  }, [fetchPendingRounds, fetchQrSettings]);

  // 3. Socket real-time listener for incoming QR rounds
  usePosSocket({
    branchId,
    onEvent: (envelope) => {
      if (
        envelope.eventType === 'QR_ORDER_ROUND_SUBMITTED' ||
        envelope.eventType === 'QR_ROUND_APPROVED' ||
        envelope.eventType === 'QR_ROUND_REJECTED' ||
        envelope.eventType === 'ORDER_UPDATED'
      ) {
        fetchPendingRounds(true);
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

  return (
    <div className="flex-1 flex flex-col bg-slate-50/70 overflow-hidden select-none">
      {/* Top Header & Settings Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">Yêu cầu gọi món qua mã QR tại bàn</h3>
              <span className="text-xs bg-red-50 border border-red-200 text-[#da251d] font-bold px-2 py-0.5 rounded-full">
                {rounds.length} lượt chờ duyệt
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Khách quét QR gọi món sẽ hiển thị tại đây để nhân viên kiểm tra và xác nhận vào bếp
            </p>
          </div>
        </div>

        {/* Right Action Bar: Auto-Send Toggle + Refresh */}
        <div className="flex items-center gap-3">
          {/* Toggle Switch */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-100/90 border border-slate-200">
            <div className="text-right">
              <span className="text-xs font-bold text-slate-800 block flex items-center gap-1 justify-end">
                <Zap className={`w-3.5 h-3.5 ${qrAutoSendToKitchen ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                Tự động gửi bếp
              </span>
              <span className="text-[10px] text-slate-400">
                {qrAutoSendToKitchen ? 'Bật: Không cần xác nhận' : 'Tắt: Nhân viên duyệt'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleAutoSend}
              disabled={isUpdatingSetting}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer disabled:opacity-50 ${
                qrAutoSendToKitchen ? 'bg-emerald-500' : 'bg-slate-300'
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
            onClick={() => fetchPendingRounds(true)}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-[#da251d]" />
            <span className="text-xs font-semibold">Đang tải danh sách gọi món QR...</span>
          </div>
        ) : rounds.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 mb-3 shadow-xs">
              <Smartphone className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 mb-1">Không có yêu cầu gọi món nào đang chờ</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {qrAutoSendToKitchen
                ? 'Chi nhánh đang bật chế độ TỰ ĐỘNG GỬI BẾP. Mọi món khách gọi qua QR đã được chuyển thẳng tới bếp/KDS.'
                : 'Khách hàng quét mã QR trên bàn sẽ xuất hiện tại đây theo thời gian thực để nhân viên duyệt.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
            {rounds.map((round) => {
              const totalRoundPrice = round.items.reduce(
                (sum, it) => sum + (it.priceAtSale || 0) * it.quantity,
                0
              );
              const isProcessing = isProcessingId === round.id;

              return (
                <div
                  key={round.id}
                  className="bg-white rounded-3xl border border-red-200/90 shadow-sm p-5 flex flex-col justify-between space-y-3 relative overflow-hidden"
                >
                  <div className="space-y-2">
                    {/* Header: Table & Round Info */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-[#da251d]">
                            {round.order.table?.name || `Bàn ${round.order.table?.tableCode || ''}`}
                          </span>
                          <span className="text-[10px] bg-red-100 text-red-800 font-extrabold px-1.5 py-0.2 rounded-md">
                            Lượt #{round.roundNumber}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 font-semibold block mt-0.5">
                          Người gọi: <strong>{round.guestName || 'Khách tại bàn'}</strong>
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(round.createdAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="divide-y divide-slate-100 border-y border-slate-100 py-2 space-y-2 max-h-56 overflow-y-auto">
                      {round.items.map((it) => (
                        <div key={it.id} className="text-xs pt-2 first:pt-0 space-y-0.5">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-black text-slate-900">{it.quantity}x </span>
                              <span className="text-slate-800 font-medium">{it.product.name}</span>
                              {it.pricingMode === 'BUFFET_INCLUDED' && (
                                <span className="ml-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-1 py-0.2 rounded font-bold">
                                  Buffet
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-bold text-slate-900 shrink-0">
                              {it.pricingMode === 'BUFFET_INCLUDED' && it.priceAtSale === 0
                                ? '0đ'
                                : `${((it.priceAtSale || 0) * it.quantity).toLocaleString('vi-VN')}đ`}
                            </span>
                          </div>

                          {it.optionsTextSnapshot && (
                            <p className="text-[10px] text-slate-500 pl-4">
                              Tùy chọn: {it.optionsTextSnapshot}
                            </p>
                          )}

                          {it.note && (
                            <p className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md pl-4">
                              Ghi chú: "{it.note}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Total Price of this Round */}
                    <div className="flex justify-between items-baseline pt-1 text-xs">
                      <span className="text-slate-500 font-medium">Tổng tiền lượt gọi:</span>
                      <span className="font-extrabold text-sm text-[#da251d] font-mono">
                        {totalRoundPrice.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>

                  {/* Actions: Reject & Approve */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setRejectingRound(round)}
                      disabled={isProcessing}
                      className="py-2.5 px-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
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
        )}
      </div>

      {/* Reject Reason Dialog */}
      {rejectingRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Từ chối lượt gọi món</h3>
                <p className="text-xs text-slate-500">
                  {rejectingRound.order.table?.name} • Lượt #{rejectingRound.roundNumber}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Lý do từ chối:</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="VD: Món tạm hết nguyên liệu, khách đổi ý..."
                className="w-full h-20 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none focus:border-red-400 transition-all resize-none"
              />

              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {['Tạm hết nguyên liệu', 'Bàn hủy gọi món', 'Quá giờ phục vụ bếp'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg text-slate-700 font-medium cursor-pointer"
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
                className="py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
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
