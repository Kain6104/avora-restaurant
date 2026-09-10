'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useWaiterStore } from '@/store/useWaiterStore';
import { db } from '@/lib/offline/db';
import { 
  Clock, 
  Utensils, 
  ShoppingBag, 
  Bike, 
  Globe, 
  Layers, 
  Search, 
  CheckCircle2, 
  Flame, 
  Receipt,
  User,
  Phone,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { isOnlineOrder } from '@/components/pos/pos-utils';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type OrderFilterType = 'ALL' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';

export function getOrderCategory(order: any): 'ONLINE' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' {
  if (isOnlineOrder(order)) {
    return 'ONLINE';
  }
  if (order.tableId || order.table) {
    return 'DINE_IN';
  }
  const tblName = (order.tableName || '').toLowerCase();
  if (tblName && !/mang\s*về|take\s*away|giao\s*hàng|delivery/i.test(tblName)) {
    return 'DINE_IN';
  }
  const addr = (order.deliveryAddress || '').trim().toLowerCase();
  const isMockTakeaway = !addr || addr.includes('mang về') || addr.includes('take away') || addr.includes('tại quầy') || addr.includes('tại quán');
  const isMockDineIn = addr.includes('tại bàn') || addr.includes('dine in');

  if (isMockDineIn) return 'DINE_IN';
  if (order.orderType === 'DINE_IN') return 'DINE_IN';
  if (order.orderType === 'DELIVERY' && !isMockTakeaway) return 'DELIVERY';
  if (order.orderType === 'TAKEAWAY') return 'TAKEAWAY';
  if (addr && !isMockTakeaway && !isMockDineIn && addr.length > 5) return 'DELIVERY';

  return 'TAKEAWAY';
}

export default function ActiveOrdersView() {
  const isOffline = useWaiterStore((s) => s.isOffline);
  const activeBranchId = useWaiterStore((s) => s.activeBranchId);
  const { setSelectedTableId, setSelectedOrderId, setActiveTab } = useWaiterStore();

  const [filter, setFilter] = useState<OrderFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: response, isLoading } = useSWR(
    isOffline || !activeBranchId ? null : `/api/pos/tables?branchId=${activeBranchId}`,
    fetcher,
    { refreshInterval: 4000 }
  );

  // Offline fallback
  const [offlineOrders, setOfflineOrders] = useState<any[]>([]);
  React.useEffect(() => {
    if (isOffline) {
      db.activeOrders?.toArray().then(setOfflineOrders).catch(() => {});
    }
  }, [isOffline]);

  const rawOrders: any[] = isOffline ? offlineOrders : (response?.data?.activeOrders || []);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: rawOrders.length,
      DINE_IN: 0,
      TAKEAWAY: 0,
      DELIVERY: 0,
      ONLINE: 0,
    };
    rawOrders.forEach((o) => {
      const cat = getOrderCategory(o);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [rawOrders]);

  // Filter & Search
  const filteredOrders = useMemo(() => {
    let list = rawOrders;
    if (filter !== 'ALL') {
      list = list.filter((o) => getOrderCategory(o) === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((o) => {
        const code = (o.temporaryOrderCode || o.orderCode || o.id || '').toLowerCase();
        const tableName = (o.table?.name || o.tableName || '').toLowerCase();
        const customer = (o.customerName || o.user?.fullName || '').toLowerCase();
        const phone = (o.customerPhone || o.user?.phone || '').toLowerCase();
        return code.includes(q) || tableName.includes(q) || customer.includes(q) || phone.includes(q);
      });
    }
    return list;
  }, [rawOrders, filter, searchQuery]);

  const filterTabs: { id: OrderFilterType; label: string; icon: React.ReactNode }[] = [
    { id: 'ALL', label: 'Tất cả', icon: <Layers size={14} /> },
    { id: 'DINE_IN', label: 'Tại bàn', icon: <Utensils size={14} /> },
    { id: 'TAKEAWAY', label: 'Mang đi', icon: <ShoppingBag size={14} /> },
    { id: 'DELIVERY', label: 'Giao hàng', icon: <Bike size={14} /> },
    { id: 'ONLINE', label: 'Đơn Online', icon: <Globe size={14} /> },
  ];

  const handleSelectOrder = (order: any) => {
    if (order.tableId) {
      setSelectedTableId(order.tableId);
      setSelectedOrderId(order.id || null);
    } else {
      setSelectedTableId(null);
      setSelectedOrderId(order.id);
    }
    // OrderDetailView will render automatically because selectedTableId or selectedOrderId is set
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-24">
      {/* TOP HEADER & SEARCH */}
      <div className="px-4 pt-2 pb-3 bg-white border-b border-slate-200/80 shrink-0 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-[#DA251D] flex items-center justify-center font-black">
              <Receipt size={18} />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 leading-tight">Danh sách đơn hàng</h1>
              <p className="text-[11px] font-medium text-slate-500">Đang phục vụ: {rawOrders.length} đơn</p>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã đơn, số bàn, khách hàng, SĐT..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-100 border-none text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#DA251D]/20 focus:outline-none transition-all"
          />
        </div>

        {/* TABS SELECTOR */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-4 px-4">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.id;
            const count = categoryCounts[tab.id];

            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer select-none ${
                  isActive
                    ? 'bg-[#DA251D] text-white shadow-sm ring-2 ring-[#DA251D]/20 scale-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 active:scale-95'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ORDERS LIST */}
      <div className="flex-1 overflow-y-auto p-4 touch-pan-y space-y-3">
        {isLoading && !isOffline ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#DA251D] border-t-transparent" />
            <p className="text-xs font-medium">Đang tải danh sách đơn...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
              <Receipt size={28} />
            </div>
            <p className="font-bold text-slate-700 text-sm">Không có đơn hàng nào</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              {searchQuery
                ? `Không tìm thấy đơn khớp với "${searchQuery}"`
                : filter === 'ALL'
                ? 'Hiện chưa có đơn nào đang hoạt động trong chi nhánh.'
                : `Không có đơn "${filterTabs.find((t) => t.id === filter)?.label}" nào.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOrders.map((order: any) => {
              const category = getOrderCategory(order);
              const isOnline = category === 'ONLINE';
              const codeDisplay = order.temporaryOrderCode || order.orderCode || (order.id ? order.id.slice(0, 8) : 'MỚI');
              const itemCount = order.itemCount || order.items?.length || order.orderItems?.length || 0;
              const totalAmount = Number(order.totalAmount) || 0;
              const elapsedMinutes = order.createdAt
                ? Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)
                : 0;

              return (
                <div
                  key={order.id}
                  onClick={() => handleSelectOrder(order)}
                  className={`w-full bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border transition-all text-left relative overflow-hidden active:scale-[0.99] cursor-pointer ${
                    isOnline
                      ? 'border-sky-200 hover:border-sky-400 ring-1 ring-sky-100'
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Top Header Card */}
                  <div className="flex justify-between items-start w-full gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {category === 'ONLINE' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 ring-1 ring-sky-300/40">
                            <Globe size={12} />
                            Đơn Online
                          </span>
                        )}
                        {category === 'DINE_IN' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md bg-red-50 text-[#DA251D] ring-1 ring-red-200">
                            <Utensils size={12} />
                            {order.table?.name || order.tableName || 'Tại bàn'}
                          </span>
                        )}
                        {category === 'TAKEAWAY' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                            <ShoppingBag size={12} />
                            Mang đi
                          </span>
                        )}
                        {category === 'DELIVERY' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">
                            <Bike size={12} />
                            Giao hàng
                          </span>
                        )}

                        {isOnline && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                            Chỉ xem • HĐ VAT
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-800 mt-1.5 truncate">
                        #{codeDisplay}
                        {order.guestCount ? ` • ${order.guestCount} khách` : ''}
                      </div>

                      {(order.customerName || order.customerPhone) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 font-medium truncate">
                          {order.customerName && (
                            <span className="flex items-center gap-1 truncate">
                              <User size={11} className="text-slate-400 shrink-0" />
                              {order.customerName}
                            </span>
                          )}
                          {order.customerPhone && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Phone size={10} className="shrink-0" />
                              {order.customerPhone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Price & Time */}
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-[#DA251D] text-base font-mono">
                        {totalAmount.toLocaleString('vi-VN')} đ
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-slate-400 mt-1">
                        <Clock size={12} />
                        <span>{elapsedMinutes} phút</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full h-px bg-slate-100 my-2.5" />

                  {/* Bottom details & status */}
                  <div className="flex justify-between items-center w-full">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>{itemCount} món</span>
                      {order.isInvoiceRequested && (
                        <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                          Có HĐ VAT
                        </span>
                      )}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {order.kitchenStatus === 'READY' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          <CheckCircle2 size={11} />
                          Sẵn sàng
                        </span>
                      ) : order.kitchenStatus === 'PREPARING' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          <Flame size={11} />
                          Đang làm
                        </span>
                      ) : order.status === 'HELD' || order.paymentStatus === 'PAYMENT_REQUESTED' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-violet-100 text-violet-800">
                          Chờ thu ngân
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          Chờ bếp
                        </span>
                      )}

                      <ChevronRight size={14} className="text-slate-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
