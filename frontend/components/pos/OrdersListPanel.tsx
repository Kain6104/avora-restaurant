"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  RotateCcw,
  Clock,
  ShoppingBag,
  UtensilsCrossed,
  Truck,
  Users,
  CreditCard,
  MoreHorizontal,
  Printer,
  Eye,
  CheckCircle2,
  FileText,
  Tag,
  PackageCheck,
  Plus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { PosOrder } from './pos-types';

export interface OrdersListPanelProps {
  orders: PosOrder[];
  onSelectOrder: (order: PosOrder) => void;
  onPayOrder?: (order: PosOrder) => void;
  onPrintTempBill?: (order: PosOrder) => void;
  onOpenOrderFeesModal?: (order: PosOrder) => void;
  onQuickUpdateStatus?: (orderId: string, status: string) => void;
  onCreateOrder?: (orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY') => void;
  onRefresh: () => void;
  isLoading?: boolean;
  isDarkMode?: boolean;
}

export type OrderCategory =
  | 'ALL'
  | 'PAYMENT_REQUESTED'
  | 'AWAITING_PAYMENT'
  | 'DINE_IN'
  | 'TAKEAWAY'
  | 'DELIVERY'
  | 'PARTNER'
  | 'ONLINE'
  | 'TABLES';

export const OrdersListPanel: React.FC<OrdersListPanelProps> = ({
  orders,
  onSelectOrder,
  onPayOrder,
  onPrintTempBill,
  onOpenOrderFeesModal,
  onQuickUpdateStatus,
  onCreateOrder,
  onRefresh,
  isLoading = false,
  isDarkMode = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<OrderCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Real-time ticking every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close card action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuOrderId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollGrid = (offset: number) => {
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollBy({ top: offset, behavior: 'smooth' });
    }
  };

  // Format real-time serving duration (00:52:47 or X ngày)
  const getElapsedDuration = (createdAtStr: string) => {
    const start = new Date(createdAtStr).getTime();
    if (isNaN(start)) return '00:00:00';

    const diffSec = Math.max(0, Math.floor((currentTime - start) / 1000));
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;

    const pad = (n: number) => String(n).padStart(2, '0');

    if (days > 0) {
      return `${days} ngày`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  // Determine order category
  const getOrderType = (o: PosOrder): 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' => {
    if (o.tableId || o.table) return 'DINE_IN';

    const tblName = (o as any).tableName || '';
    if (tblName && !/mang\s*về|take\s*away|giao\s*hàng|delivery/i.test(tblName)) {
      return 'DINE_IN';
    }

    const addr = (o.deliveryAddress || '').trim().toLowerCase();
    const isMockTakeawayAddr =
      !addr ||
      addr.includes('mang về') ||
      addr.includes('take away') ||
      addr.includes('tại quầy') ||
      addr.includes('tại quán');
    const isMockDineInAddr = addr.includes('tại bàn') || addr.includes('dine in');

    if (isMockDineInAddr) return 'DINE_IN';
    if (isMockTakeawayAddr && (addr.includes('mang về') || addr.includes('take away') || o.orderType === 'TAKEAWAY')) {
      return 'TAKEAWAY';
    }

    if (o.orderType === 'TAKEAWAY') return 'TAKEAWAY';
    if (o.orderType === 'DINE_IN') return 'DINE_IN';
    if (o.orderType === 'DELIVERY') {
      if (isMockTakeawayAddr) return 'TAKEAWAY';
      return 'DELIVERY';
    }

    if (addr && !isMockTakeawayAddr && !isMockDineInAddr && addr.length > 5) {
      return 'DELIVERY';
    }

    return 'TAKEAWAY';
  };

  // Helper: Check if order is placed online via Website
  const isOnlineOrder = (o: PosOrder): boolean => {
    return (
      o.orderSource === 'WEB' ||
      o.orderSource === 'CHATBOT' ||
      o.orderSource === 'VOICE' ||
      (Boolean(o.orderSource) && o.orderSource !== 'POS' && !o.tableId && !o.table)
    );
  };

  // Lọc chỉ lấy các đơn đang active trong POS (bỏ hoàn toàn đơn COMPLETED)
  const activeOrders = orders.filter((o) => o.status !== 'COMPLETED');
  const isAwaitingConfirmationOrder = (o: PosOrder) => o.paymentStatus === 'AWAITING_PAYMENT';
  const isPaymentRequestedOrder = (o: PosOrder) =>
    o.paymentStatus === 'PAYMENT_REQUESTED' || o.status === 'HELD';
  const allTabOrders = activeOrders.filter((o) => !isAwaitingConfirmationOrder(o));

  // Counts for right sidebar
  const paymentRequestedCount = activeOrders.filter(isPaymentRequestedOrder).length;

  const awaitingConfirmationCount = activeOrders.filter(isAwaitingConfirmationOrder).length;

  const dineInCount = allTabOrders.filter((o) => !isOnlineOrder(o) && getOrderType(o) === 'DINE_IN').length;
  const takeawayCount = allTabOrders.filter((o) => !isOnlineOrder(o) && getOrderType(o) === 'TAKEAWAY').length;
  const deliveryCount = allTabOrders.filter((o) => getOrderType(o) === 'DELIVERY' || isOnlineOrder(o)).length;
  const partnerCount = allTabOrders.filter(
    (o) => (o as any).orderSource === 'PARTNER' || (o as any).channel === 'PARTNER',
  ).length;
  const tablesCount = allTabOrders.filter((o) => Boolean(o.tableId || o.table || (o as any).tableName)).length;

  // Filtered orders
  const filteredOrders = activeOrders.filter((o) => {
    const isOnline = isOnlineOrder(o);
    const orderType = getOrderType(o);
    const isAwaiting = isAwaitingConfirmationOrder(o);

    if (activeCategory === 'AWAITING_PAYMENT') {
      if (!isAwaiting) return false;
    } else {
      // Đơn chờ xác nhận chỉ hiển thị ở tab "Chờ xác nhận", không hiển thị lẫn trong "Tất cả đơn" hay các tab khác
      if (isAwaiting) return false;

      if (activeCategory === 'PAYMENT_REQUESTED') {
        if (!isPaymentRequestedOrder(o)) return false;
      } else if (activeCategory === 'DINE_IN') {
        if (isOnline || orderType !== 'DINE_IN') return false;
      } else if (activeCategory === 'TAKEAWAY') {
        if (isOnline || orderType !== 'TAKEAWAY') return false;
      } else if (activeCategory === 'DELIVERY') {
        if (orderType !== 'DELIVERY' && !isOnline) return false;
      } else if (activeCategory === 'PARTNER') {
        if ((o as any).orderSource !== 'PARTNER' && (o as any).channel !== 'PARTNER') return false;
      } else if (activeCategory === 'TABLES') {
        if (!o.tableId && !o.table && !(o as any).tableName) return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const displayCode = (o.orderCode || o.temporaryOrderCode || '').toLowerCase();
      const codeMatch = displayCode.includes(q);
      const nameMatch = o.customerName?.toLowerCase().includes(q);
      const phoneMatch = o.customerPhone && o.customerPhone.includes(q);
      const tableMatch = o.table?.name?.toLowerCase().includes(q) || (o as any).tableName?.toLowerCase().includes(q);
      return Boolean(codeMatch || nameMatch || phoneMatch || tableMatch);
    }
    return true;
  });

  const handleCreateOrderClick = () => {
    if (!onCreateOrder) return;
    if (activeCategory === 'TAKEAWAY') {
      onCreateOrder('TAKEAWAY');
    } else if (activeCategory === 'DELIVERY') {
      onCreateOrder('DELIVERY');
    } else if (activeCategory === 'DINE_IN') {
      onCreateOrder('DINE_IN');
    } else {
      onCreateOrder('TAKEAWAY');
    }
  };

  return (
    <div className={`flex-1 flex flex-row overflow-hidden select-none transition-colors ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      }`}>
      {/* 1. Main Left Content Area: Toolbar + Compact Order Cards Grid */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar: Search input & Status info */}
        <div className={`border-b px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-2xs transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã đơn, mã tạm, số bàn, SĐT, tên khách..."
              className={`w-full text-xs rounded-lg pl-9 pr-3 py-1.5 outline-none transition-colors border ${isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-[#da251d]'
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-[#da251d] focus:bg-white'
                }`}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium hidden sm:inline ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
              Hiển thị <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{filteredOrders.length}</strong> đơn hàng
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              title="Làm mới danh sách đơn hàng"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#da251d]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Orders Card Grid (Compact Cards matching Sapo reference layout) */}
        <div
          ref={gridContainerRef}
          className={`flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}
        >
          {filteredOrders.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <FileText className="w-10 h-10 text-slate-400 stroke-1" />
              <p className="text-xs font-medium">Không tìm thấy đơn hàng nào trong phân loại này</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-8">
              {filteredOrders.map((o) => {
                const isOnline = isOnlineOrder(o);
                const orderType = getOrderType(o);
                const isTakeaway = !isOnline && orderType === 'TAKEAWAY';
                const isDelivery = !isOnline && orderType === 'DELIVERY';
                const isDineIn = !isOnline && orderType === 'DINE_IN';
                const isAwaitingConfirmation = o.paymentStatus === 'AWAITING_PAYMENT';
                const isPaymentRequested = o.paymentStatus === 'PAYMENT_REQUESTED' || o.status === 'HELD';
                const isPriceLockedOrder =
                  isAwaitingConfirmation ||
                  o.paymentStatus === 'PAID' ||
                  (o as any).paymentIntentStatus === 'ACTIVE' ||
                  Boolean((o as any).paymentLockedAt);

                const tableName = o.table?.name || (o as any).tableName || '';
                const cleanTableNum = tableName.replace(/^bàn\s*/i, '').trim();
                const displayCode = o.orderCode || o.temporaryOrderCode || o.id.slice(0, 8);
                const elapsedTimer = getElapsedDuration(o.createdAt);

                return (
                  <div
                    key={o.id}
                    className={`rounded-xl overflow-hidden transition-all flex flex-col justify-between select-none min-h-[140px] border ${isAwaitingConfirmation
                      ? isDarkMode
                        ? 'bg-gradient-to-b from-blue-950/80 to-slate-900 border-blue-500/80 text-white ring-2 ring-blue-500 shadow-md'
                        : 'bg-gradient-to-b from-blue-50 to-white border-blue-400 text-slate-900 ring-2 ring-blue-500 shadow-md'
                      : isPaymentRequested
                        ? isDarkMode
                          ? 'bg-gradient-to-b from-amber-950/70 to-slate-900 border-amber-500 text-white ring-2 ring-amber-500 shadow-md'
                          : 'bg-gradient-to-b from-amber-50 to-white border-amber-500 text-slate-900 ring-2 ring-amber-400 shadow-md'
                      : isDarkMode
                        ? 'bg-slate-900 border-slate-800 text-white shadow-sm hover:border-slate-700'
                        : 'bg-white border-slate-200 text-slate-800 shadow-xs hover:shadow-md'
                      }`}
                  >
                    {/* Card Top Strip with channel ribbon */}
                    <div
                      className={`px-2.5 py-1.5 flex items-center justify-between text-xs font-bold border-b ${isAwaitingConfirmation
                        ? 'bg-blue-600 text-white border-blue-700'
                        : isPaymentRequested
                          ? 'bg-amber-500 text-white border-amber-600'
                          : isTakeaway
                            ? isDarkMode ? 'bg-amber-500/20 text-amber-300 border-b-amber-500/30 border-t-2 border-t-amber-500' : 'bg-amber-500/10 text-amber-800 border-b-slate-100 border-t-2 border-t-amber-500'
                            : isDelivery || isOnline
                              ? isDarkMode ? 'bg-purple-500/20 text-purple-300 border-b-purple-500/30 border-t-2 border-t-purple-500' : 'bg-purple-500/10 text-purple-800 border-b-slate-100 border-t-2 border-t-purple-500'
                              : isDarkMode ? 'bg-sky-500/20 text-sky-300 border-b-sky-500/30 border-t-2 border-t-sky-500' : 'bg-sky-500/10 text-sky-800 border-b-slate-100 border-t-2 border-t-sky-500'
                        }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {isAwaitingConfirmation ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                            <span className="font-extrabold uppercase tracking-tight text-[11px]">CHỜ XÁC NHẬN NH</span>
                          </div>
                        ) : isPaymentRequested ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
                            <span className="font-extrabold uppercase tracking-tight text-[11px]">
                              CHỜ THANH TOÁN
                            </span>
                          </div>
                        ) : isTakeaway ? (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Mang đi</span>
                          </>
                        ) : isDelivery || isOnline ? (
                          <>
                            <Truck className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <span>{isOnline ? 'G/H (website)' : 'Giao hàng'}</span>
                          </>
                        ) : (
                          <>
                            <UtensilsCrossed className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            <span>Bàn</span>
                          </>
                        )}
                      </div>
                      {isAwaitingConfirmation ? (
                        <span className="font-mono text-[9.5px] bg-white/20 px-1 py-0.2 rounded font-bold uppercase shrink-0">
                          SePay
                        </span>
                      ) : isDineIn && (
                        <div className={`flex items-center gap-1 text-[11px] font-semibold shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>{o.guestCount || 1}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Center: Big Bold ID / Code */}
                    <div
                      className="px-3 py-2.5 flex flex-col items-center justify-center cursor-pointer flex-1"
                      onClick={() => onSelectOrder(o)}
                    >
                      <div className={`text-xl sm:text-2xl font-black tracking-tight text-center truncate max-w-full ${isAwaitingConfirmation
                        ? 'text-blue-600 dark:text-blue-400'
                        : isDarkMode
                          ? 'text-white'
                          : 'text-slate-800'
                        }`}>
                        {isDineIn ? (cleanTableNum || displayCode) : displayCode}
                      </div>

                      {/* Timer and Price Row */}
                      <div className={`flex items-center justify-between w-full mt-2 text-xs ${isDarkMode ? 'text-white' : 'text-black'}`}>
                        <div className={`flex items-center gap-1 truncate text-[11px] font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                          <Clock className={`w-3.5 h-3.5 shrink-0 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                          <span>{elapsedTimer}</span>
                        </div>
                        <div className={`font-black text-xs sm:text-sm text-right shrink-0 font-mono ${isAwaitingConfirmation
                          ? 'text-blue-600 dark:text-blue-400'
                          : isPaymentRequested
                            ? 'text-amber-700 dark:text-amber-400'
                            : isDarkMode
                              ? 'text-white'
                              : 'text-slate-900'
                          }`}>
                          {(Number(o.totalAmount) || 0).toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom: [...] Menu + Action Button */}
                    <div className={`px-2.5 py-1.5 border-t flex items-center justify-between gap-2 ${isDarkMode
                      ? 'border-slate-700 bg-slate-800/80 text-slate-300'
                      : 'border-slate-100 bg-slate-50/80 text-slate-600'
                      }`}>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuOrderId(activeMenuOrderId === o.id ? null : o.id);
                          }}
                          className={`w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
                            }`}
                          title="Thao tác khác"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Popover Menu */}
                        {activeMenuOrderId === o.id && (
                          <div
                            ref={menuRef}
                            className={`absolute left-0 bottom-full mb-1 w-44 rounded-xl shadow-xl py-1 z-30 animate-in fade-in duration-100 border ${isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-slate-200'
                              : 'bg-white border-slate-200 text-slate-700'
                              }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuOrderId(null);
                                onSelectOrder(o);
                              }}
                              className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 cursor-pointer font-medium ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                                }`}
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                              <span>Mở xem đơn</span>
                            </button>
                            {onPrintTempBill && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuOrderId(null);
                                  onPrintTempBill(o);
                                }}
                                className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 cursor-pointer font-medium ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                                  }`}
                              >
                                <Printer className="w-3.5 h-3.5 text-slate-400" />
                                <span>In tạm tính & QR</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Primary Card Action */}
                      {isAwaitingConfirmation ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onPayOrder) onPayOrder(o);
                            else onSelectOrder(o);
                          }}
                          className="text-xs bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black px-2.5 py-1 rounded-md shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span>Duyệt GD</span>
                        </button>
                      ) : isPaymentRequested ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onPayOrder) onPayOrder(o);
                            else onSelectOrder(o);
                          }}
                          className="text-xs bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-black px-2.5 py-1 rounded-md shadow-xs cursor-pointer transition-colors"
                        >
                          Thanh toán
                        </button>
                      ) : isDelivery ? (
                        <button
                          type="button"
                          onClick={() => onSelectOrder(o)}
                          className="text-xs text-purple-600 hover:text-purple-700 font-bold hover:underline cursor-pointer"
                        >
                          Chọn đối tác
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (onPayOrder) onPayOrder(o);
                            else onSelectOrder(o);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                        >
                          Thanh toán
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Compact Right Column (Filter & Navigation Sidebar matching Image 2) */}
      <aside className={`w-72 sm:w-80 md:w-88 shrink-0 flex flex-col justify-between border-l p-3.5 sm:p-4 select-none transition-colors ${isDarkMode
        ? 'bg-slate-900 border-slate-800 text-slate-100'
        : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
        }`}>
        <div className="space-y-3">
          {/* 1. Green Button: + Tạo đơn mới */}
          <button
            type="button"
            onClick={handleCreateOrderClick}
            className="w-full py-3.5 px-4 bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] text-white rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            <span>Tạo đơn mới</span>
          </button>

          {/* 2. Blue Button: Tất cả đơn (with count badge) */}
          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={`w-full py-3 sm:py-3.5 px-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-between transition-all cursor-pointer shadow-xs ${activeCategory === 'ALL'
              ? 'bg-[#2563eb] text-white ring-1 ring-blue-300 shadow-sm'
              : isDarkMode
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-2xs'
              }`}
          >
            <span>Tất cả đơn</span>
            <span className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-full ${activeCategory === 'ALL'
              ? 'bg-white/20 text-white'
              : isDarkMode
                ? 'bg-slate-700 text-slate-200'
                : 'bg-slate-200 text-slate-800'
              }`}>
              {allTabOrders.length}
            </span>
          </button>

          {/* 3. Two-Column Status Row: Chờ thanh toán | Chờ xác nhận */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setActiveCategory('PAYMENT_REQUESTED')}
              className={`p-3 rounded-xl text-center flex flex-col items-center justify-center relative transition-all cursor-pointer border-2 min-h-[64px] sm:min-h-[68px] ${activeCategory === 'PAYMENT_REQUESTED'
                ? 'border-amber-600 bg-amber-500 text-white font-black shadow-md ring-2 ring-amber-300'
                : paymentRequestedCount > 0
                  ? isDarkMode
                    ? 'border-amber-500 bg-amber-950/60 text-amber-200 hover:bg-amber-900/60 shadow-sm ring-1 ring-amber-500/60'
                    : 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-sm ring-1 ring-amber-300'
                  : isDarkMode
                    ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    : 'border-amber-300 bg-amber-50/40 text-amber-900 hover:bg-amber-50 shadow-2xs'
                }`}
            >
              {paymentRequestedCount > 0 && activeCategory !== 'PAYMENT_REQUESTED' && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping absolute top-2 left-2" />
              )}
              <span className={`text-xs absolute top-1.5 right-2 font-mono font-black px-1.5 py-0.2 rounded-full ${activeCategory === 'PAYMENT_REQUESTED'
                ? 'bg-white/25 text-white'
                : paymentRequestedCount > 0
                  ? 'bg-amber-500 text-white'
                  : isDarkMode
                    ? 'text-amber-400'
                    : 'text-amber-700'
                }`}>
                {paymentRequestedCount}
              </span>
              <span className="text-xs sm:text-[13px] font-black leading-tight mt-2">Chờ thanh toán</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('AWAITING_PAYMENT')}
              className={`p-3 rounded-xl text-center flex flex-col items-center justify-center relative transition-all cursor-pointer border min-h-[64px] sm:min-h-[68px] ${activeCategory === 'AWAITING_PAYMENT'
                ? 'border-blue-500 bg-blue-600 text-white font-black shadow-sm ring-1 ring-blue-400'
                : isDarkMode
                  ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-50 shadow-2xs'
                }`}
            >
              <span className={`text-xs absolute top-1.5 right-2 font-mono font-black ${activeCategory === 'AWAITING_PAYMENT'
                ? 'text-white'
                : isDarkMode
                  ? 'text-blue-400'
                  : 'text-blue-600'
                }`}>
                {awaitingConfirmationCount}
              </span>
              <span className="text-xs sm:text-[13px] font-bold leading-tight mt-2">Chờ xác nhận</span>
            </button>
          </div>

          {/* 4. 2x2 Grid of Channel Filters: Tại bàn | Mang đi | Giao hàng | Đối tác */}
          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
            {/* Tại bàn */}
            <button
              type="button"
              onClick={() => setActiveCategory('DINE_IN')}
              className={`p-3 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer border min-h-[70px] sm:min-h-[76px] ${activeCategory === 'DINE_IN'
                ? 'border-sky-500 bg-sky-600 text-white font-black shadow-sm'
                : isDarkMode
                  ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  : 'border-sky-200 bg-white text-sky-800 hover:bg-sky-50 shadow-2xs'
                }`}
            >
              <span className={`text-xs absolute top-1.5 right-2 font-mono font-black ${activeCategory === 'DINE_IN' ? 'text-white' : isDarkMode ? 'text-sky-400' : 'text-sky-600'
                }`}>
                {dineInCount}
              </span>
              <UtensilsCrossed className={`w-5 h-5 mb-1.5 ${activeCategory === 'DINE_IN' ? 'text-white' : isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
              <span className="text-xs sm:text-[13px] font-bold">Tại bàn</span>
            </button>

            {/* Mang đi */}
            <button
              type="button"
              onClick={() => setActiveCategory('TAKEAWAY')}
              className={`p-3 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer border min-h-[70px] sm:min-h-[76px] ${activeCategory === 'TAKEAWAY'
                ? 'border-amber-500 bg-amber-600 text-white font-black shadow-sm'
                : isDarkMode
                  ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50 shadow-2xs'
                }`}
            >
              <span className={`text-xs absolute top-1.5 right-2 font-mono font-black ${activeCategory === 'TAKEAWAY' ? 'text-white' : isDarkMode ? 'text-amber-400' : 'text-amber-600'
                }`}>
                {takeawayCount}
              </span>
              <ShoppingBag className={`w-5 h-5 mb-1.5 ${activeCategory === 'TAKEAWAY' ? 'text-white' : isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
              <span className="text-xs sm:text-[13px] font-bold">Mang đi</span>
            </button>

            {/* Giao hàng */}
            <button
              type="button"
              onClick={() => setActiveCategory('DELIVERY')}
              className={`p-3 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer border min-h-[70px] sm:min-h-[76px] ${activeCategory === 'DELIVERY'
                ? 'border-purple-500 bg-purple-600 text-white font-black shadow-sm'
                : isDarkMode
                  ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  : 'border-purple-200 bg-white text-purple-800 hover:bg-purple-50 shadow-2xs'
                }`}
            >
              <span className={`text-xs absolute top-1.5 right-2 font-mono font-black ${activeCategory === 'DELIVERY' ? 'text-white' : isDarkMode ? 'text-purple-400' : 'text-purple-600'
                }`}>
                {deliveryCount}
              </span>
              <Truck className={`w-5 h-5 mb-1.5 ${activeCategory === 'DELIVERY' ? 'text-white' : isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className="text-xs sm:text-[13px] font-bold">Giao hàng</span>
            </button>

            {/* Đối tác */}
            <button
              type="button"
              onClick={() => setActiveCategory('PARTNER')}
              className={`p-3 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer border min-h-[70px] sm:min-h-[76px] ${activeCategory === 'PARTNER'
                ? 'border-emerald-500 bg-emerald-600 text-white font-black shadow-sm'
                : isDarkMode
                  ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 shadow-2xs'
                }`}
            >
              <span className={`text-xs absolute top-1.5 right-2 font-mono font-black ${activeCategory === 'PARTNER' ? 'text-white' : isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                }`}>
                {partnerCount}
              </span>
              <PackageCheck className={`w-5 h-5 mb-1.5 ${activeCategory === 'PARTNER' ? 'text-white' : isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span className="text-xs sm:text-[13px] font-bold">Đối tác</span>
            </button>
          </div>

          {/* 5. Area / Table Filter List */}
          <div className="pt-1 space-y-1">
            <button
              type="button"
              onClick={() => setActiveCategory('TABLES')}
              className={`w-full p-3 rounded-xl flex items-center justify-between text-xs sm:text-sm font-black transition-all cursor-pointer border ${activeCategory === 'TABLES'
                ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                : isDarkMode
                  ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100 shadow-2xs'
                }`}
            >
              <span>Bàn</span>
              <span className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-black ${activeCategory === 'TABLES'
                ? 'bg-white/20 text-white'
                : isDarkMode
                  ? 'bg-slate-700 text-slate-300'
                  : 'bg-slate-200 text-slate-800'
                }`}>
                {tablesCount}
              </span>
            </button>
          </div>
        </div>

        {/* 6. Bottom Navigation Controls: Up / Down arrows */}
        <div className={`grid grid-cols-2 gap-2.5 pt-2.5 border-t shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={() => scrollGrid(-240)}
            className={`py-3.5 flex items-center justify-center rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 ${isDarkMode
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs'
              }`}
            title="Cuộn lên trên"
          >
            <ChevronUp className="w-5 h-5 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => scrollGrid(240)}
            className={`py-3.5 flex items-center justify-center rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 ${isDarkMode
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs'
              }`}
            title="Cuộn xuống dưới"
          >
            <ChevronDown className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </aside>
    </div>
  );
};
