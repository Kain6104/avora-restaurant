'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useWaiterStore } from '@/store/useWaiterStore';
import { useAdmin } from '@/contexts/AdminContext';
import { db } from '@/lib/offline/db';
import { useInstantTables } from '@/lib/offline/useOfflineData';
import { syncEngine } from '@/lib/offline/syncEngine';
import PullToRefresh from '../common/PullToRefresh';
import { useIsIPhone } from '@/lib/utils/device';
import OpenTableSheet from './OpenTableSheet';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { Users, Clock, Plus, X, ShoppingBag, Bike, RefreshCw, LayoutGrid, ShieldAlert, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store', credentials: 'include' }).then(r => r.json());

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
  const { 
    activeBranchId, 
    isOffline, 
    setSelectedTableId, 
    setSelectedOrderId, 
    setActiveTab,
    setSourceTab,
    tableActiveArea,
    setTableActiveArea,
    setScrollPosition,
    getScrollPosition,
    registerModalHandler,
  } = useWaiterStore();
  const isIPhone = useIsIPhone();
  const { can } = useAdmin();

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Restore scroll position when returning from order details
  useEffect(() => {
    const saved = getScrollPosition('TABLE_MAP');
    if (saved > 0 && scrollContainerRef.current) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = saved;
        }
      });
    }
  }, [getScrollPosition]);

  // Realtime ticking clock every second for active service timers
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClockTick(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Quick Takeaway / Delivery Modal State
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use SWR to fetch real tables from DB
  const { data: response, error, isLoading, mutate } = useSWR(
    isOffline || !activeBranchId ? null : `/api/pos/tables?branchId=${activeBranchId}`, 
    fetcher,
    { refreshInterval: 5000, keepPreviousData: true, revalidateOnFocus: false }
  );

  const [openingTable, setOpeningTable] = useState<any | null>(null);

  // Register modal handlers for Android back navigation
  useEffect(() => {
    return registerModalHandler('table-map', () => {
      if (openingTable) {
        setOpeningTable(null);
        return true;
      }
      if (isCreateOrderModalOpen) {
        setIsCreateOrderModalOpen(false);
        return true;
      }
      return false;
    });
  }, [openingTable, isCreateOrderModalOpen, registerModalHandler]);

  // Instant Load from Dexie with background SWR sync
  const { tables: localTables, areas: localAreas, hasLocalData } = useInstantTables(activeBranchId);

  // Sync SWR tables response to Dexie when received with strict branch reconciliation
  React.useEffect(() => {
    if (response?.data?.tables && Array.isArray(response.data.tables) && activeBranchId) {
      const incoming = response.data.tables;
      const incomingIds = new Set(incoming.map((t: any) => t.id));

      // Xóa các bàn cũ thuộc chi nhánh này nếu đã bị xóa trên server
      db.posTables
        .where('branchId')
        .equals(activeBranchId)
        .toArray()
        .then((existing) => {
          const staleIds = existing.filter((t) => !incomingIds.has(t.id)).map((t) => t.id);
          if (staleIds.length > 0) {
            db.posTables.bulkDelete(staleIds).catch(console.error);
          }
        })
        .catch(console.error);

      const tablesList = incoming.map((t: any) => ({
        id: t.id,
        branchId: activeBranchId,
        tableCode: t.tableCode,
        name: t.name,
        areaId: t.areaId || null,
        capacity: t.capacity || 4,
        status: t.status,
        isActive: t.isActive !== false,
        sortOrder: t.sortOrder,
        activeSession: t.activeSession || null,
        currentOrder: t.currentOrder || null,
        visualStatus: t.visualStatus || 'EMPTY',
        updatedAt: t.updatedAt,
      }));
      db.posTables.bulkPut(tablesList).catch(console.error);
    }
  }, [response, activeBranchId]);

  // Đảm bảo mỗi bàn chỉ tồn tại 1 bản ghi duy nhất theo ID, thuộc đúng activeBranchId
  const tables = React.useMemo(() => {
    const raw = hasLocalData && localTables.length > 0 ? localTables : (response?.data?.tables || []);
    const map = new Map<string, any>();
    for (const t of raw) {
      if (t && t.id && (!t.branchId || t.branchId === activeBranchId)) {
        map.set(t.id, t);
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.tableCode || '').localeCompare(b.tableCode || '');
    });
  }, [hasLocalData, localTables, response?.data?.tables, activeBranchId]);

  // Đảm bảo khu vực chỉ thuộc đúng activeBranchId và không trùng lặp
  const areas = React.useMemo(() => {
    const raw = hasLocalData && localAreas.length > 0 ? localAreas : (response?.data?.areas || []);
    const map = new Map<string, any>();
    for (const a of raw) {
      if (a && a.id && (!a.branchId || a.branchId === activeBranchId)) {
        map.set(a.id, a);
      }
    }
    const sorted = Array.from(map.values()).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return [{ id: 'ALL', name: 'Tất cả' }, ...sorted];
  }, [hasLocalData, localAreas, response?.data?.areas, activeBranchId]);

  const filteredTables = React.useMemo(() => {
    if (tableActiveArea === 'ALL') return tables;
    return tables.filter((t: any) => t.areaId === tableActiveArea);
  }, [tables, tableActiveArea]);

  const handleTableClick = (table: any) => {
    const isServing = Boolean(table.activeSession !== null || table.currentOrder !== null || table.visualStatus === 'OCCUPIED' || table.visualStatus === 'BILL_PRINTED');
    if (isServing) {
      setSourceTab('TABLES');
      setScrollPosition('TABLE_MAP', scrollContainerRef.current?.scrollTop || 0);
      setSelectedOrderId(null);
      setSelectedTableId(table.id);
    } else {
      // Check RBAC permission for opening table
      if (!can('pos.table.open', activeBranchId)) {
        toast.error('Bạn không có quyền mở bàn (pos.table.open)', {
          icon: <ShieldAlert className="w-4 h-4 text-rose-500" />
        });
        return;
      }
      setOpeningTable(table);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Đã làm mới dữ liệu bàn!');
    }, 400);
  };

  const handleConfirmOpen = async (guestCount: number) => {
    if (!activeBranchId || !openingTable) return;

    if (isOffline) {
      try {
        const tempOrderCode = `OFF-${openingTable.tableCode}-${Date.now().toString().slice(-4)}`;
        await db.posTables.update(openingTable.id, {
          status: 'OCCUPIED',
          visualStatus: 'OCCUPIED',
        });
        await db.activeOrders.put({
          id: `draft_${crypto.randomUUID()}`,
          branchId: activeBranchId,
          tableId: openingTable.id,
          orderCode: tempOrderCode,
          temporaryOrderCode: tempOrderCode,
          guestCount,
          totalAmount: 0,
          status: 'DRAFT',
          kitchenStatus: 'PENDING',
          updatedAt: new Date().toISOString(),
        });

        toast.success(`Đã mở ${openingTable.name || openingTable.tableCode} (${guestCount} khách - Chế độ ngoại tuyến)`);
        setSourceTab('TABLES');
        setScrollPosition('TABLE_MAP', scrollContainerRef.current?.scrollTop || 0);
        setSelectedOrderId(null);
        setSelectedTableId(openingTable.id);
        setOpeningTable(null);
      } catch (err: any) {
        toast.error('Lỗi mở bàn ngoại tuyến: ' + err.message);
      }
      return;
    }

    try {
      const preOrders = (openingTable as any).activeReservation?.preOrderedItems || [];
      const res = await fetch('/api/pos/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: activeBranchId,
          tableId: openingTable.id,
          guestCount,
          customerName: (openingTable as any).activeReservation?.customerName || undefined,
          customerPhone: (openingTable as any).activeReservation?.customerPhone || undefined,
          items: Array.isArray(preOrders) && preOrders.length > 0 ? preOrders.map((it: any) => ({
            productId: it.productId,
            quantity: it.quantity || 1,
            note: it.note || 'Món đặt trước',
            selectedOptionIds: it.selectedOptionIds || [],
            discountAmount: 0,
            pricingMode: 'REGULAR',
          })) : []
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
      setSourceTab('TABLES');
      setScrollPosition('TABLE_MAP', scrollContainerRef.current?.scrollTop || 0);
      setSelectedOrderId(null);
      setSelectedTableId(openingTable.id);
      setOpeningTable(null);
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi mở bàn');
    }
  };

  const handleCreateQuickOrder = async (orderType: 'TAKEAWAY' | 'DELIVERY') => {
    if (!activeBranchId) {
      toast.error('Vui lòng chọn chi nhánh');
      return;
    }
    if (!can('pos.order.create', activeBranchId)) {
      toast.error('Bạn không có quyền tạo đơn hàng (pos.order.create)', {
        icon: <ShieldAlert className="w-4 h-4 text-rose-500" />
      });
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
      setSourceTab('TABLES');
      setScrollPosition('TABLE_MAP', scrollContainerRef.current?.scrollTop || 0);
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
    <div className="flex flex-col h-full min-h-0 bg-[#f4f6f8] select-none relative overflow-hidden">
      {/* Sub-Header: Area Tabs & Refresh Button */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs z-10 shrink-0 select-none overscroll-none">
        <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
          {/* Areas Horizontal Scroll */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 touch-pan-x">
            {areas.map((area) => (
              <button
                key={area.id}
                onClick={() => setTableActiveArea(area.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  tableActiveArea === area.id 
                    ? 'bg-[#DA251D] text-white shadow-2xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {area.name}
              </button>
            ))}
          </div>

          {/* Table Count Badge & Reload */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200/60">
              {filteredTables.length} bàn
            </span>
            <button
              onClick={handleManualRefresh}
              className={`p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 active:scale-95 transition-transform border border-slate-200/60 cursor-pointer ${isRefreshing ? 'animate-spin' : ''}`}
              title="Làm mới"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Table Grid View - Fixed 3 Columns (Tích hợp PullToRefresh) */}
      <PullToRefresh
        onRefresh={async () => {
          if (activeBranchId) {
            const freshRes = await fetch(`/api/pos/tables?branchId=${activeBranchId}`, {
              cache: 'no-store',
              credentials: 'include',
            });
            if (freshRes.ok) {
              const freshJson = await freshRes.json();
              await mutate(freshJson, { revalidate: false });
            } else {
              await mutate();
            }
            await syncEngine.performDeltaSync(activeBranchId, false);
          } else {
            await mutate();
          }
        }}
        isOffline={isOffline}
        className="p-2 sm:p-2.5 pb-4"
      >
        {isLoading && !isOffline && !hasLocalData ? (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((slot) => (
              <div
                key={slot}
                className="rounded-2xl border border-slate-200 bg-white p-2.5 min-h-[96px] sm:min-h-[104px] flex flex-col justify-between"
              >
                <div className="h-4 w-12 mx-auto rounded bg-slate-200" />
                <div className="h-3 w-16 mx-auto rounded bg-slate-100" />
                <div className="h-3 w-10 mx-auto rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center">
            <LayoutGrid size={32} className="mb-2 text-slate-300" />
            <p className="text-xs font-semibold">Chưa có bàn nào trong khu vực này</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
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
                  className={`relative flex flex-col justify-between p-2 sm:p-2.5 rounded-2xl border active:scale-95 transition-all text-center min-h-[96px] sm:min-h-[104px] overflow-hidden cursor-pointer ${
                    isServing
                      ? hasUnpaidInvoice
                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 border-amber-700 text-white shadow-xs'
                        : 'bg-gradient-to-br from-[#E24A58] to-[#C91F32] border-[#A81727] text-white shadow-xs'
                      : isReserved
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-2xs'
                      : 'bg-white border-slate-200/90 text-slate-800 shadow-2xs hover:border-slate-300'
                  }`}
                >
                  {/* Top: Status dot + Table Name + Capacity */}
                  <div className="w-full flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isServing ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]' : isReserved ? 'bg-amber-400' : 'bg-emerald-500'
                      }`} />
                      <span className={`font-black text-xs sm:text-[13px] truncate ${isServing ? 'text-white' : 'text-slate-900'}`}>
                        {table.name || table.tableCode}
                      </span>
                    </div>

                    <span className={`text-[9.5px] font-bold flex items-center gap-0.5 shrink-0 ${isServing ? 'text-white/85' : 'text-slate-500'}`}>
                      <Users size={10} className={isServing ? 'text-white/80' : 'text-slate-400'} />
                      <span>{isServing && enteredGuestCount ? enteredGuestCount : table.capacity}</span>
                    </span>
                  </div>

                  {/* Middle: Total Amount & Live Elapsed Clock or Status */}
                  {isServing ? (
                    <div className="w-full my-auto flex flex-col items-center justify-center py-0.5">
                      <span className="font-black text-xs sm:text-[13px] text-white leading-tight tracking-tight">
                        {Number(totalAmount).toLocaleString('vi-VN')} đ
                      </span>
                      <div className="mt-0.5 inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-black/20 text-white text-[9px] font-mono font-bold tracking-tight">
                        <Clock size={8.5} className="text-white/90" />
                        <span>{formatElapsed(serviceStartTime)}</span>
                      </div>
                    </div>
                  ) : isReserved ? (
                    <div className="my-auto py-1">
                      <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded-md">
                        Đã đặt trước
                      </span>
                    </div>
                  ) : (
                    <div className="my-auto text-[11px] text-slate-400 font-medium">
                      Bàn trống
                    </div>
                  )}

                  {/* Bottom: Compact Status Pill */}
                  <div className="w-full flex justify-center mt-auto">
                    {isServing ? (
                      <span className="text-[8.5px] font-bold px-1.5 py-0.2 bg-white/20 text-white rounded-full uppercase tracking-wider">
                        {hasUnpaidInvoice ? 'Chờ TT' : 'Có khách'}
                      </span>
                    ) : isReserved ? (
                      <span className="text-[8.5px] font-bold px-1.5 py-0.2 bg-indigo-200/70 text-indigo-800 rounded-full uppercase">
                        Đặt trước
                      </span>
                    ) : (
                      <span className="text-[8.5px] font-semibold px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded-full">
                        Sẵn sàng
                      </span>
                    )}
                  </div>

                  {/* Ready Kitchen Indicator Badge */}
                  {hasReadyItems && (
                    <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-white animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </PullToRefresh>

      {/* Floating Action Button (+) for Takeaway & Delivery */}
      <button
        type="button"
        onClick={() => setIsCreateOrderModalOpen(true)}
        className={`fixed ${isIPhone ? 'bottom-[calc(env(safe-area-inset-bottom)+116px)]' : 'bottom-[82px]'} right-4 z-40 w-12 h-12 rounded-full bg-[#DA251D] hover:bg-[#b81d16] active:scale-90 text-white flex items-center justify-center shadow-xl shadow-red-500/30 transition-all border-2 border-white cursor-pointer`}
        title="Tạo đơn hàng mang đi / giao hàng"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* Responsive Bottom Sheet: Tạo đơn hàng mới (Mang đi / Giao hàng) */}
      <ResponsiveModal
        isOpen={isCreateOrderModalOpen}
        onClose={() => !isCreatingOrder && setIsCreateOrderModalOpen(false)}
        title="Tạo đơn hàng mới"
        subtitle="Chọn hình thức phục vụ không gắn bàn"
        maxWidth="sm"
      >
        <div className="space-y-2.5 py-1">
          <button
            type="button"
            disabled={isCreatingOrder}
            onClick={() => handleCreateQuickOrder('TAKEAWAY')}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-red-500/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            <ShoppingBag size={20} strokeWidth={2.2} />
            <span>Mang đi (Takeaway)</span>
          </button>

          <button
            type="button"
            disabled={isCreatingOrder}
            onClick={() => handleCreateQuickOrder('DELIVERY')}
            className="w-full py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-900 active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            <Bike size={20} strokeWidth={2.2} />
            <span>Giao hàng (Delivery)</span>
          </button>
        </div>
      </ResponsiveModal>

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
