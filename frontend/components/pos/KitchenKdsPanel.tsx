"use client";

import React, { useState, useEffect } from 'react';
import {
  Flame,
  Fish,
  Wine,
  IceCream,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  CheckCheck,
  ChefHat,
  Calendar,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface KitchenItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  note?: string;
  optionsText?: string;
  stationId?: string;
  kitchenStatus: 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  sentToKitchenAt?: string;
  acknowledgedAt?: string;
  readyAt?: string;
}

interface KitchenTicket {
  id: string;
  orderCode: string;
  tableName: string;
  guestCount: number;
  note?: string;
  sentToKitchenAt?: string;
  elapsedSeconds: number;
  items: KitchenItem[];
}

interface KitchenKdsPanelProps {
  branchId: string;
  tickets: KitchenTicket[];
  onUpdateItemStatus: (itemId: string, status: string) => Promise<void>;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const KitchenKdsPanel: React.FC<KitchenKdsPanelProps> = ({
  branchId,
  tickets,
  onUpdateItemStatus,
  onRefresh,
  isLoading = false,
}) => {
  const [selectedStation, setSelectedStation] = useState<string>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live timer tick every 10 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Pre-ordered reservations state
  const [preOrderReservations, setPreOrderReservations] = useState<any[]>([]);
  const [preOrderPrepStatus, setPreOrderPrepStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!branchId) return;
    const fetchPreOrders = async () => {
      try {
        const res = await fetch(`/api/pos/reservations?branchId=${branchId}&status=CONFIRMED`, { credentials: 'include' });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const withDishes = json.data.filter((r: any) => Array.isArray(r.preOrderedItems) && r.preOrderedItems.length > 0);
          setPreOrderReservations(withDishes);
        }
      } catch (e) {
        console.error('Failed to fetch pre-ordered reservations for KDS:', e);
      }
    };
    fetchPreOrders();
    const interval = setInterval(fetchPreOrders, 20000);
    return () => clearInterval(interval);
  }, [branchId]);

  const stations = [
    { id: 'ALL', name: 'Tất cả trạm', icon: ChefHat },
    { id: 'HOT_KITCHEN', name: 'Bếp Nóng', icon: Flame },
    { id: 'SUSHI', name: 'Bếp Lạnh & Sushi', icon: Fish },
    { id: 'BAR', name: 'Bar & Đồ Uống', icon: Wine },
    { id: 'DESSERT', name: 'Tráng Miệng', icon: IceCream },
    { id: 'PRE_ORDER', name: `Món Đặt Trước (${preOrderReservations.length})`, icon: Calendar },
  ];

  // Filter tickets by station
  const filteredTickets = tickets
    .map((ticket) => {
      if (selectedStation === 'ALL') return ticket;
      const filteredItems = ticket.items.filter((it) => it.stationId === selectedStation);
      return filteredItems.length > 0 ? { ...ticket, items: filteredItems } : null;
    })
    .filter(Boolean) as KitchenTicket[];

  const getElapsedBadge = (sentAt?: string) => {
    if (!sentAt) return null;
    const elapsedMinutes = Math.floor((Date.now() - new Date(sentAt).getTime()) / 60000);

    if (elapsedMinutes >= 20) {
      return (
        <span className="bg-red-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 animate-pulse shadow-xs">
          <AlertTriangle className="w-3.5 h-3.5" />
          {elapsedMinutes} phút!
        </span>
      );
    }
    if (elapsedMinutes >= 10) {
      return (
        <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs">
          <Clock className="w-3 h-3" />
          {elapsedMinutes} phút
        </span>
      );
    }
    return (
      <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs">
        <Clock className="w-3 h-3" />
        {elapsedMinutes} phút
      </span>
    );
  };

  const getTicketSequenceNumber = (orderCode: string, fallbackIdx: number): string => {
    if (!orderCode) return `#${(fallbackIdx + 1).toString().padStart(2, '0')}`;
    const parts = orderCode.split(/[-_]/);
    const lastPart = parts[parts.length - 1];
    const parsed = parseInt(lastPart, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return `#${parsed < 100 ? parsed.toString().padStart(2, '0') : parsed}`;
    }
    const match = orderCode.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        return `#${num < 100 ? num.toString().padStart(2, '0') : num}`;
      }
    }
    return `#${(fallbackIdx + 1).toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-100/70 overflow-hidden select-none">
      {/* KDS Header: Stations and Sound Toggle */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {stations.map((st) => {
            const Icon = st.icon;
            const isSelected = selectedStation === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStation(st.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                  isSelected
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{st.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-gray-100 text-gray-600 hover:text-gray-900 rounded-xl transition-colors cursor-pointer"
            title={soundEnabled ? 'Tắt âm báo' : 'Bật âm báo'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="p-2 bg-gray-100 text-gray-600 hover:text-gray-900 rounded-xl transition-colors cursor-pointer"
            title="Làm mới KDS"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tickets Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedStation === 'PRE_ORDER' ? (
          preOrderReservations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
              <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-300 mb-3 shadow-xs">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-gray-700 mb-1">Không có đơn đặt bàn kèm món đặt trước</h3>
              <p className="text-xs text-gray-400">Tất cả khách đặt bàn hôm nay chưa yêu cầu lên món trước.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
              {preOrderReservations.map((r, idx) => {
                const status = preOrderPrepStatus[r.id] || 'WAITING';
                const isReady = status === 'READY';
                const isPreparing = status === 'PREPARING';

                return (
                  <div
                    key={r.id}
                    className={`bg-white rounded-2xl border flex flex-col justify-between overflow-hidden transition-all shadow-xs ${
                      isReady ? 'border-emerald-300 ring-1 ring-emerald-200' : isPreparing ? 'border-amber-300 ring-1 ring-amber-200' : 'border-indigo-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="p-3.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="bg-indigo-600 text-white font-black text-sm px-2.5 py-1 rounded-xl shadow-xs tracking-wider flex items-center justify-center shrink-0">
                          <span>#RSV</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 leading-tight truncate">
                            {r.customerName}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-600">
                            <span className="font-mono font-bold text-indigo-700">{r.reservationCode}</span>
                            <span>•</span>
                            <span>{r.partySize} khách</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-extrabold text-xs block">
                          {r.reservationTime}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {r.assignedTables?.length > 0 ? r.assignedTables.map((t: any) => t.name).join(', ') : 'Chờ gán bàn'}
                        </span>
                      </div>
                    </div>

                    {/* Pre-ordered items */}
                    <div className="p-3.5 divide-y divide-gray-100 flex-1 space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Utensils className="w-3 h-3 text-red-600" />
                        <span>Món đặt trước ({r.preOrderedItems?.length || 0} món):</span>
                      </div>
                      {r.preOrderedItems?.map((it: any, iIdx: number) => (
                        <div key={iIdx} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate">{it.name}</span>
                            {it.optionsTextSnapshot && (
                              <span className="text-[10px] text-slate-500 block">{it.optionsTextSnapshot}</span>
                            )}
                            {it.note && (
                              <span className="text-[10px] text-amber-700 block italic">"{it.note}"</span>
                            )}
                          </div>
                          <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg shrink-0 ml-2">
                            x{it.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Footer / Prep Action */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-600">
                        {isReady ? 'Đã sẵn sàng ra món' : isPreparing ? 'Đang chuẩn bị nguyên liệu' : 'Chờ sơ chế'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextStatus = isReady ? 'WAITING' : isPreparing ? 'READY' : 'PREPARING';
                          setPreOrderPrepStatus(prev => ({ ...prev, [r.id]: nextStatus }));
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 ${
                          isReady
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : isPreparing
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>{isReady ? 'Hoàn tất' : isPreparing ? 'Báo sẵn sàng' : 'Bắt đầu sơ chế'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredTickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-300 mb-3 shadow-xs">
              <ChefHat className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-gray-700 mb-1">Hiện không có món nào đang chờ chế biến</h3>
            <p className="text-xs text-gray-400">Bếp và quầy pha chế đã hoàn thành tất cả đơn hàng!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
            {filteredTickets.map((ticket, index) => {
              const elapsedMinutes = ticket.sentToKitchenAt
                ? Math.floor((Date.now() - new Date(ticket.sentToKitchenAt).getTime()) / 60000)
                : 0;
              const isUrgent = elapsedMinutes >= 20;
              const isWarning = elapsedMinutes >= 10 && elapsedMinutes < 20;
              const seqNumber = getTicketSequenceNumber(ticket.orderCode, index);
              const unreadyItems = ticket.items.filter(
                (it) => it.kitchenStatus !== 'READY' && it.kitchenStatus !== 'SERVED'
              );

              return (
                <div
                  key={ticket.id}
                  className={`bg-white rounded-2xl border flex flex-col justify-between overflow-hidden transition-all shadow-xs ${
                    isUrgent
                      ? 'border-red-500 ring-2 ring-red-400/40 shadow-md'
                      : isWarning
                      ? 'border-amber-300 shadow-sm'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Ticket Header with prominent Sequence Number Badge & Table Info */}
                  <div className="p-3.5 bg-slate-50 border-b border-gray-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Big prominent sequence badge */}
                      <div className="bg-gradient-to-br from-[#da251d] to-red-700 text-white font-black text-lg px-2.5 py-1 rounded-xl shadow-xs tracking-wider flex items-center justify-center shrink-0 border border-red-700/30">
                        <span>{seqNumber}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-black text-gray-900 leading-tight truncate">
                          {ticket.tableName}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono font-bold text-gray-500 truncate">
                            {ticket.orderCode}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="text-[11px] font-semibold text-gray-500">
                            {ticket.guestCount} khách
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {getElapsedBadge(ticket.sentToKitchenAt)}
                    </div>
                  </div>

                  {/* Ticket Items */}
                  <div className="p-3.5 divide-y divide-gray-100 flex-1 space-y-2.5">
                    {ticket.items.map((item) => {
                      const isReady = item.kitchenStatus === 'READY';
                      const isServed = item.kitchenStatus === 'SERVED';

                      return (
                        <div key={item.id} className="pt-2.5 first:pt-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-red-50 text-[#da251d] border border-red-100 flex items-center justify-center font-black text-xs shrink-0">
                                  {item.quantity}x
                                </span>
                                <span
                                  className={`text-xs font-bold leading-snug ${
                                    isServed
                                      ? 'line-through text-gray-300'
                                      : isReady
                                      ? 'line-through text-emerald-600'
                                      : 'text-gray-900'
                                  }`}
                                >
                                  {item.name}
                                </span>
                              </div>

                              {item.optionsText && (
                                <div className="text-[11px] text-gray-500 font-medium pl-8 mt-0.5">
                                  {item.optionsText}
                                </div>
                              )}

                              {item.note && (
                                <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md ml-8 mt-1 inline-block">
                                  Ghi chú: {item.note}
                                </div>
                              )}
                            </div>

                            {/* Action Button */}
                            <div className="flex items-center gap-1 shrink-0">
                              {!isReady && !isServed ? (
                                <button
                                  type="button"
                                  onClick={() => onUpdateItemStatus(item.id, 'READY')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                                  title="Đánh dấu món này đã chế biến xong"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Xong</span>
                                </button>
                              ) : isReady ? (
                                <button
                                  type="button"
                                  onClick={() => onUpdateItemStatus(item.id, 'SERVED')}
                                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                                  title="Đánh dấu nhân viên đã bưng ra bàn"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                  <span>Phục vụ</span>
                                </button>
                              ) : (
                                <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                                  Đã phục vụ
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Batch Action: Complete all unready items */}
                  {unreadyItems.length > 1 && (
                    <div className="px-3.5 py-2 bg-emerald-50/70 border-t border-emerald-100 flex items-center justify-between">
                      <span className="text-[11px] text-emerald-800 font-semibold">
                        Còn {unreadyItems.length} món chờ
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          for (const it of unreadyItems) {
                            await onUpdateItemStatus(it.id, 'READY');
                          }
                        }}
                        className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Xong tất cả ({unreadyItems.length})</span>
                      </button>
                    </div>
                  )}

                  {/* Ticket Note / Footer */}
                  {ticket.note && (
                    <div className="p-2.5 bg-amber-50 border-t border-amber-100 text-[11px] font-medium text-amber-800">
                      <strong>Ghi chú đơn:</strong> {ticket.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
