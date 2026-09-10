'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useWaiterStore } from '@/store/useWaiterStore';
import { db } from '@/lib/offline/db';
import OpenTableSheet from './OpenTableSheet';
import { Users, Clock, Plus, X, ShoppingBag, Bike } from 'lucide-react';
import toast from 'react-hot-toast';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function formatElapsed(startTime?: string | Date | null) {
  if (!startTime) return '00:00:00';
  const startMs = new Date(startTime).getTime();
  if (isNaN(startMs)) return '00:00:00';
  const diffMs = Math.max(0, Date.now() - startMs);
  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function TableMapView() {
  const activeBranchId = useWaiterStore(s => s.activeBranchId);
  const isOffline = useWaiterStore(s => s.isOffline);
  const { setSelectedTableId, setSelectedOrderId, setActiveTab } = useWaiterStore();
  
  // Realtime ticking clock every second for active service timers
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClockTick(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Quick Takeaway / Delivery Modal State
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // Use SWR to fetch real tables from DB
  const { data: response, error, isLoading, mutate } = useSWR(
    isOffline || !activeBranchId ? null : `/api/pos/tables?branchId=${activeBranchId}`, 
    fetcher,
    { refreshInterval: 5000 }
  );

  const [activeArea, setActiveArea] = useState<string>('ALL');

  // Fallback to Dexie if offline
  const [offlineTables, setOfflineTables] = useState<any[]>([]);
  React.useEffect(() => {
    if (isOffline) {
      db.posTables.toArray().then(setOfflineTables);
    } else if (response?.data?.tables) {
      if (Array.isArray(response.data.tables)) {
        const tablesList = response.data.tables.map((t: any) => ({
          id: t.id,
          tableCode: t.tableCode,
          name: t.name,
          areaId: t.areaId,
          capacity: t.capacity,
          status: t.status,
          isActive: t.isActive
        }));
        db.posTables.bulkPut(tablesList).catch(console.error);
      }
    }
  }, [isOffline, response]);

  const tables = isOffline ? offlineTables : (response?.data?.tables || []);
  
  // Extract real areas from API response
  const areas = [{ id: 'ALL', name: 'Tất cả' }, ...(response?.data?.areas || [])];

  const filteredTables = activeArea === 'ALL' ? tables : tables.filter((t: any) => t.areaId === activeArea);

  const [openingTable, setOpeningTable] = useState<any | null>(null);

  const handleTableClick = (table: any) => {
    const isServing = Boolean(table.activeSession !== null || table.currentOrder !== null || table.visualStatus === 'OCCUPIED' || table.visualStatus === 'BILL_PRINTED');
    if (isServing) {
      setSelectedOrderId(null);
      setSelectedTableId(table.id);
    } else {
      setOpeningTable(table);
    }
  };

  const handleConfirmOpen = async (guestCount: number) => {
    if (!activeBranchId || !openingTable) return;
    try {
      const res = await fetch('/api/pos/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: activeBranchId,
          tableId: openingTable.id,
          guestCount,
          items: [] // Empty order to start a session
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.message === 'TABLE_ALREADY_OPENED') {
          toast.error('Bàn đã được mở bởi nhân viên khác!');
          setSelectedOrderId(null);
          setSelectedTableId(openingTable.id);
          setOpeningTable(null);
          mutate();
          return;
        }
        throw new Error(data.message || 'Lỗi khi mở bàn');
      }
      toast.success(`Đã mở ${openingTable.name || openingTable.tableCode} (${guestCount} khách)`);
      mutate();
      setSelectedOrderId(null);
      setSelectedTableId(openingTable.id);
      setOpeningTable(null);
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi mở bàn');
    }
  };

  // Quick Create Takeaway or Delivery Order without Table
  const handleCreateQuickOrder = async (orderType: 'TAKEAWAY' | 'DELIVERY') => {
    if (!activeBranchId) {
      toast.error('Vui lòng chọn chi nhánh');
      return;
    }
    setIsCreatingOrder(true);
    const toastId = toast.loading(`Đang tạo đơn ${orderType === 'TAKEAWAY' ? 'mang đi' : 'giao hàng'}...`);
    try {
      const res = await fetch('/api/pos/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: activeBranchId,
          orderType,
          customerName: orderType === 'TAKEAWAY' ? 'Khách mang đi' : 'Khách giao hàng',
          guestCount: 1,
          items: [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi khi tạo đơn hàng');
      }
      toast.success(`Đã tạo đơn ${orderType === 'TAKEAWAY' ? 'mang đi' : 'giao hàng'}!`, { id: toastId });
      setIsCreateOrderModalOpen(false);
      setSelectedTableId(null);
      setSelectedOrderId(data.data.id);
      setActiveTab('MENU');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tạo đơn hàng', { id: toastId });
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] select-none relative">
      {/* Area Tabs */}
      <div className="w-full overflow-x-auto no-scrollbar bg-white border-b border-slate-200 shrink-0 shadow-xs z-10">
        <div className="flex px-4 gap-2 min-w-max py-2">
          {areas.map((area) => (
            <button
              key={area.id}
              onClick={() => setActiveArea(area.id)}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeArea === area.id 
                  ? 'bg-[#DA251D] text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {area.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table Grid */}
      <div className="flex-1 overflow-y-auto p-3.5 touch-pan-y pb-28">
        {isLoading && !isOffline ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DA251D]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {filteredTables.map((table: any) => {
              const isServing = Boolean(table.activeSession !== null || table.currentOrder !== null || table.visualStatus === 'OCCUPIED' || table.visualStatus === 'BILL_PRINTED');
              const isReserved = table.visualStatus === 'RESERVED';
              const hasReadyItems = table.currentOrder?.kitchenStatus === 'READY';
              const hasUnpaidInvoice = table.visualStatus === 'BILL_PRINTED';

              const enteredGuestCount = table.activeSession?.guestCount || table.currentOrder?.guestCount;
              const totalAmount = table.currentOrder?.totalAmount || table.currentOrder?.subTotal || 0;
              const serviceStartTime = table.activeSession?.openedAt || table.currentOrder?.createdAt;

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => handleTableClick(table)}
                  className={`relative flex flex-col items-center justify-between p-2.5 rounded-2xl shadow-xs border active:scale-95 transition-all text-center min-h-[105px] ${
                    isServing
                      ? 'bg-white border-red-500/40 ring-1 ring-red-500/20 shadow-red-500/5'
                      : isReserved
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                      : 'bg-white border-slate-200/90 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {/* Top: Table Name */}
                  <div className="w-full flex items-center justify-between gap-1">
                    <span className={`font-bold text-xs truncate ${isServing ? 'text-[#DA251D]' : 'text-slate-800'}`}>
                      {table.name || table.tableCode}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-0.5 shrink-0">
                      <Users size={10} className={isServing ? 'text-[#DA251D]' : 'text-slate-400'} />
                      <strong className={isServing ? 'text-[#DA251D]' : 'text-slate-600'}>
                        {isServing && enteredGuestCount ? enteredGuestCount : table.capacity}
                      </strong>
                    </span>
                  </div>

                  {/* Middle: Order Total & Realtime Ticking Elapsed Timer */}
                  {isServing ? (
                    <div className="w-full my-auto flex flex-col items-center justify-center py-1">
                      <span className="font-extrabold text-xs text-slate-900 leading-tight">
                        {totalAmount.toLocaleString('vi-VN')} đ
                      </span>
                      <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-mono font-bold tracking-tight">
                        <Clock size={10} className="text-amber-600" />
                        <span>{formatElapsed(serviceStartTime)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="my-auto text-[11px] text-slate-400 font-medium">
                      Bàn trống
                    </div>
                  )}

                  {/* Bottom: Status Pill */}
                  <div className="w-full flex justify-center mt-auto pt-1">
                    {isServing ? (
                      hasUnpaidInvoice ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full uppercase">
                          Chờ TT
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-2 py-0.5 bg-red-50 text-[#DA251D] rounded-full uppercase">
                          Có khách
                        </span>
                      )
                    ) : isReserved ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full uppercase">
                        Đã đặt
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                        Trống
                      </span>
                    )}
                  </div>

                  {/* Ready Kitchen Indicator Badge */}
                  {hasReadyItems && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button (+) for Takeaway & Delivery */}
      <button
        type="button"
        onClick={() => setIsCreateOrderModalOpen(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-[#DA251D] hover:bg-[#b81d16] active:scale-90 text-white flex items-center justify-center shadow-xl shadow-red-500/30 transition-all border-2 border-white cursor-pointer"
        title="Tạo đơn hàng mang đi / giao hàng"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {/* Modal: Tạo đơn hàng mới (Mang đi / Giao hàng) */}
      {isCreateOrderModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div 
            className="fixed inset-0" 
            onClick={() => !isCreatingOrder && setIsCreateOrderModalOpen(false)} 
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl z-10 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xl text-slate-800">Tạo đơn hàng mới</h3>
              <button
                type="button"
                disabled={isCreatingOrder}
                onClick={() => setIsCreateOrderModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <button
                type="button"
                disabled={isCreatingOrder}
                onClick={() => handleCreateQuickOrder('TAKEAWAY')}
                className="w-full py-4 px-6 rounded-2xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-98 text-white font-bold text-base flex items-center justify-center gap-3 shadow-md shadow-red-500/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                <ShoppingBag size={22} strokeWidth={2.2} />
                <span>Mang đi</span>
              </button>

              <button
                type="button"
                disabled={isCreatingOrder}
                onClick={() => handleCreateQuickOrder('DELIVERY')}
                className="w-full py-4 px-6 rounded-2xl bg-slate-600 hover:bg-slate-700 active:scale-98 text-white font-bold text-base flex items-center justify-center gap-3 shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                <Bike size={22} strokeWidth={2.2} />
                <span>Giao hàng</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {openingTable && (
        <OpenTableSheet 
          table={openingTable} 
          onClose={() => setOpeningTable(null)}
          onConfirm={handleConfirmOpen}
        />
      )}
    </div>
  );
}
