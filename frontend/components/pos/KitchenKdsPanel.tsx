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

  const stations = [
    { id: 'ALL', name: 'Tất cả trạm', icon: ChefHat },
    { id: 'HOT_KITCHEN', name: 'Bếp Nóng', icon: Flame },
    { id: 'SUSHI', name: 'Bếp Lạnh & Sushi', icon: Fish },
    { id: 'BAR', name: 'Bar & Đồ Uống', icon: Wine },
    { id: 'DESSERT', name: 'Tráng Miệng', icon: IceCream },
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
        <span className="bg-red-600 text-white text-xs font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          {elapsedMinutes} phút!
        </span>
      );
    }
    if (elapsedMinutes >= 10) {
      return (
        <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {elapsedMinutes} phút
        </span>
      );
    }
    return (
      <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {elapsedMinutes} phút
      </span>
    );
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
            className="p-2 bg-gray-100 text-gray-600 hover:text-gray-900 rounded-xl transition-colors"
            title={soundEnabled ? 'Tắt âm báo' : 'Bật âm báo'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="p-2 bg-gray-100 text-gray-600 hover:text-gray-900 rounded-xl transition-colors"
            title="Làm mới KDS"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tickets Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-300 mb-3 shadow-xs">
              <ChefHat className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-gray-700 mb-1">Hiện không có món nào đang chờ chế biến</h3>
            <p className="text-xs text-gray-400">Bếp và quầy pha chế đã hoàn thành tất cả đơn hàng!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between overflow-hidden"
              >
                {/* Ticket Header */}
                <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-gray-500 font-bold">{ticket.orderCode}</span>
                    <h4 className="text-sm font-extrabold text-gray-900">{ticket.tableName}</h4>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getElapsedBadge(ticket.sentToKitchenAt)}
                    <span className="text-[10px] text-gray-400">{ticket.guestCount} khách</span>
                  </div>
                </div>

                {/* Ticket Items */}
                <div className="p-3.5 divide-y divide-gray-100 flex-1 space-y-2">
                  {ticket.items.map((item) => {
                    const isReady = item.kitchenStatus === 'READY';
                    const isCooking = item.kitchenStatus === 'PREPARING';

                    return (
                      <div key={item.id} className="pt-2 first:pt-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-red-50 text-[#da251d] flex items-center justify-center font-extrabold text-xs shrink-0">
                                {item.quantity}x
                              </span>
                              <span className={`text-xs font-bold ${isReady ? 'line-through text-gray-400' : 'text-gray-900'}`}>
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
                          <div className="flex items-center gap-1">
                            {!isReady ? (
                              <button
                                type="button"
                                onClick={() => onUpdateItemStatus(item.id, 'READY')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-xs font-bold transition-colors flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Xong</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onUpdateItemStatus(item.id, 'SERVED')}
                                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white border border-purple-200 text-xs font-bold transition-colors flex items-center gap-1"
                              >
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>Phục vụ</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ticket Note / Footer */}
                {ticket.note && (
                  <div className="p-2.5 bg-amber-50 border-t border-amber-100 text-[11px] font-medium text-amber-800">
                    {ticket.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
