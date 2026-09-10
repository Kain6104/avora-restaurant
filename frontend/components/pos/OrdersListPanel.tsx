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
  AlertCircle,
  FileText,
  Globe,
  ShieldCheck,
  Tag,
  PackageCheck,
  ChefHat,
  Lock,
} from 'lucide-react';
import { PosOrder } from './pos-types';

interface OrdersListPanelProps {
  orders: PosOrder[];
  onSelectOrder: (order: PosOrder) => void;
  onPayOrder?: (order: PosOrder) => void;
  onPrintTempBill?: (order: PosOrder) => void;
  onOpenOrderFeesModal?: (order: PosOrder) => void;
  onQuickUpdateStatus?: (orderId: string, status: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const OrdersListPanel: React.FC<OrdersListPanelProps> = ({
  orders,
  onSelectOrder,
  onPayOrder,
  onPrintTempBill,
  onOpenOrderFeesModal,
  onQuickUpdateStatus,
  onRefresh,
  isLoading = false,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

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

  // Format real-time serving duration (00:52:47 or X ngày) - Không hiển thị giờ vào
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
    // 1. Phục vụ tại bàn nếu gắn bàn
    if (o.tableId || o.table) return 'DINE_IN';
    const tblName = (o as any).tableName || '';
    if (tblName && !/mang\s*về|take\s*away|giao\s*hàng|delivery/i.test(tblName)) {
      return 'DINE_IN';
    }

    // 2. Kiểm tra nội dung địa chỉ để loại trừ các nhãn mặc định mang về/tại bàn
    const addr = (o.deliveryAddress || '').trim().toLowerCase();
    const isMockTakeawayAddr = !addr || addr.includes('mang về') || addr.includes('take away') || addr.includes('tại quầy') || addr.includes('tại quán');
    const isMockDineInAddr = addr.includes('tại bàn') || addr.includes('dine in');

    if (isMockDineInAddr) return 'DINE_IN';
    if (isMockTakeawayAddr && (addr.includes('mang về') || addr.includes('take away') || o.orderType === 'TAKEAWAY')) {
      return 'TAKEAWAY';
    }

    // 3. Nếu orderType rõ ràng
    if (o.orderType === 'TAKEAWAY') return 'TAKEAWAY';
    if (o.orderType === 'DINE_IN') return 'DINE_IN';
    if (o.orderType === 'DELIVERY') {
      // Chỉ là GIAO HÀNG nếu có địa chỉ giao hàng thực tế (không phải nhãn giả "Mang về" / "Tại bàn")
      if (isMockTakeawayAddr) return 'TAKEAWAY';
      return 'DELIVERY';
    }

    // 4. Nếu có địa chỉ thực tế dài hơn 5 ký tự và không phải nhãn giả -> Giao hàng, ngược lại Mang đi
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

  // Lọc chỉ lấy các đơn đang active trong POS (bỏ hoàn toàn đơn đã thanh toán ra khỏi POS)
  const activeOrders = orders.filter((o) => o.status !== 'COMPLETED');

  // Filtered orders
  const filteredOrders = activeOrders.filter((o) => {
    if (statusFilter === 'PAYMENT_REQUESTED') {
      if (o.paymentStatus !== 'PAYMENT_REQUESTED' && o.status !== 'HELD') return false;
    } else if (statusFilter !== 'ALL' && o.status !== statusFilter) {
      return false;
    }
    
    if (typeFilter === 'ONLINE') {
      if (!isOnlineOrder(o)) return false;
    } else if (typeFilter !== 'ALL') {
      const orderType = getOrderType(o);
      if (orderType !== typeFilter) return false;
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

  // Count summaries
  const paymentRequestedCount = activeOrders.filter(
    (o) => o.paymentStatus === 'PAYMENT_REQUESTED' || o.status === 'HELD',
  ).length;
  const pendingCount = activeOrders.filter(
    (o) =>
      (o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'PREPARING' || o.status === 'DELIVERING') &&
      o.paymentStatus !== 'PAYMENT_REQUESTED',
  ).length;
  const onlineOrdersCount = activeOrders.filter((o) => isOnlineOrder(o)).length;

  return (
    <div className="flex-1 flex flex-col bg-slate-100/70 overflow-hidden select-none">
      {/* 1. Header Toolbar Filters */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 shadow-2xs">
        {/* Left: Status & Type Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
          {/* Status Quick Filters */}
          <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
            {[
              { id: 'ALL', label: 'Tất cả', count: activeOrders.length },
              { id: 'PENDING', label: 'Đang phục vụ', count: pendingCount },
              { id: 'PAYMENT_REQUESTED', label: 'Chờ thanh toán', count: paymentRequestedCount, isHighlight: paymentRequestedCount > 0 },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === st.id
                    ? st.id === 'PAYMENT_REQUESTED'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-900 text-white shadow-xs'
                    : st.isHighlight
                    ? 'text-amber-800 bg-amber-100/80 hover:bg-amber-200/80 font-extrabold border border-amber-300 animate-pulse'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    statusFilter === st.id
                      ? 'bg-white/20 text-white'
                      : st.isHighlight
                      ? 'bg-amber-300 text-amber-950 font-black'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {st.count}
                </span>
              </button>
            ))}
          </div>

          {/* Type Filter (Tại bàn / Mang đi / Giao hàng / Online Web) */}
          <div className="flex items-center gap-1 shrink-0 border-l border-slate-200 pl-2">
            <button
              type="button"
              onClick={() => setTypeFilter(typeFilter === 'DINE_IN' ? 'ALL' : 'DINE_IN')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                typeFilter === 'DINE_IN'
                  ? 'bg-sky-100 text-sky-800 border border-sky-300 font-bold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <UtensilsCrossed className="w-3 h-3 text-sky-600" />
              <span>Tại bàn</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter(typeFilter === 'TAKEAWAY' ? 'ALL' : 'TAKEAWAY')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                typeFilter === 'TAKEAWAY'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 font-bold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-3 h-3 text-amber-600" />
              <span>Mang đi</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter(typeFilter === 'DELIVERY' ? 'ALL' : 'DELIVERY')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                typeFilter === 'DELIVERY'
                  ? 'bg-purple-100 text-purple-800 border border-purple-300 font-bold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Truck className="w-3 h-3 text-purple-600" />
              <span>Giao hàng</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter(typeFilter === 'ONLINE' ? 'ALL' : 'ONLINE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                typeFilter === 'ONLINE'
                  ? 'bg-teal-100 text-teal-800 border border-teal-300 font-bold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-3 h-3 text-teal-600" />
              <span>Đơn Online ({onlineOrdersCount})</span>
            </button>
          </div>
        </div>

        {/* Right: Search & Refresh */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mã đơn, bàn, khách hàng..."
              className="w-full text-xs bg-slate-100 text-slate-800 placeholder:text-slate-400 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 outline-none focus:border-[#da251d] focus:bg-white transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Làm mới danh sách đơn hàng"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#da251d]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Orders Card Grid (Lưới thẻ nhỏ gọn, tinh tế theo yêu cầu) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {filteredOrders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
            <FileText className="w-9 h-9 text-slate-300 stroke-1" />
            <p className="text-xs font-medium">Không tìm thấy đơn hàng nào phù hợp</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 pb-8">
            {filteredOrders.map((o) => {
              const isOnline = isOnlineOrder(o);
              const orderType = getOrderType(o);
              const isCompleted = o.status === 'COMPLETED';
              const isPaymentRequested = o.paymentStatus === 'PAYMENT_REQUESTED' || o.status === 'HELD';
              const isHeld = o.status === 'HELD';
              const isTakeaway = !isOnline && orderType === 'TAKEAWAY';
              const isDelivery = !isOnline && orderType === 'DELIVERY';
              const isDineIn = !isOnline && orderType === 'DINE_IN';
              const isSepayPaid = o.paymentMethod === 'SEPAY' && o.paymentStatus === 'PAID';
              const isPaid = o.paymentStatus === 'PAID' || isCompleted;

              const tableName = o.table?.name || (o as any).tableName || '';
              const cleanTableNum = tableName.replace(/^bàn\s*/i, '').trim();

              const elapsedTimer = getElapsedDuration(o.createdAt);
              const itemCount = o.orderItems?.reduce((sum, it) => sum + it.quantity, 0) || 0;

              return (
                <div
                  key={o.id}
                  className={`relative rounded-xl bg-white border transition-all duration-150 shadow-2xs hover:shadow-xs flex flex-col overflow-hidden ${
                    isPaymentRequested
                      ? 'border-amber-400 ring-2 ring-amber-300/80 shadow-md bg-amber-50/15'
                      : isSepayPaid
                      ? 'border-emerald-300'
                      : isOnline
                      ? 'border-teal-200/90 hover:border-teal-400'
                      : isTakeaway
                      ? 'border-amber-200/90 hover:border-amber-400'
                      : isDelivery
                      ? 'border-purple-200/90 hover:border-purple-400'
                      : 'border-sky-200/90 hover:border-sky-400'
                  }`}
                >
                  {/* Top Color Accent Line */}
                  <div
                    className={`h-0.5 w-full ${
                      isPaymentRequested
                        ? 'bg-amber-500 animate-pulse'
                        : isSepayPaid
                        ? 'bg-emerald-600'
                        : isOnline
                        ? 'bg-teal-500'
                        : isTakeaway
                        ? 'bg-orange-500'
                        : isDelivery
                        ? 'bg-purple-600'
                        : 'bg-sky-600'
                    }`}
                  />

                  {/* Card Header: Type Badge + Payment Status */}
                  <div className="px-2 py-1 flex items-center justify-between border-b border-slate-100 bg-slate-50/70">
                    {/* Left: Type Badge */}
                    {isOnline ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-1 py-0.2 rounded border border-teal-200">
                        <Globe className="w-3 h-3 text-teal-600 shrink-0" />
                        <span>Online</span>
                      </div>
                    ) : isTakeaway ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-orange-700">
                        <ShoppingBag className="w-3 h-3 text-orange-600 shrink-0" />
                        <span>Mang đi</span>
                      </div>
                    ) : isDelivery ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-purple-700">
                        <Truck className="w-3 h-3 text-purple-600 shrink-0" />
                        <span>Giao hàng</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-sky-700">
                        <UtensilsCrossed className="w-3 h-3 text-sky-600 shrink-0" />
                        <span className="truncate max-w-[90px]">{tableName ? cleanTableNum : 'Tại bàn'}</span>
                      </div>
                    )}

                    {/* Right: Payment Status */}
                    <div className="flex items-center gap-1">
                      {isDineIn && (
                        <div className="flex items-center gap-0.5 text-[9px] font-semibold text-slate-500 bg-white px-1 py-0.2 rounded border border-slate-200">
                          <Users className="w-2.5 h-2.5 text-slate-400" />
                          <span>{o.guestCount || 1}</span>
                        </div>
                      )}
                      {isPaymentRequested ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300 animate-pulse">
                          Chờ TT
                        </span>
                      ) : isSepayPaid ? (
                        <span
                          className="inline-flex items-center gap-0.5 text-[9px] font-black text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded border border-emerald-300"
                          title="Tiền đã về tài khoản ngân hàng (SePay)"
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                          <span>SePay</span>
                        </span>
                      ) : isPaid ? (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          Đã TT
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                          Chưa TT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Center: Prominent Identifier & Info */}
                  <div
                    onClick={() => onSelectOrder(o)}
                    className="p-2 flex-1 flex flex-col justify-between cursor-pointer hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Compact Code or Table Number */}
                    <div className="text-center my-0.5">
                      {isDineIn && cleanTableNum ? (
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight leading-tight truncate" title={tableName}>
                            {cleanTableNum}
                          </div>
                          <div className="text-[9px] font-mono text-slate-400 truncate">
                            #{o.orderCode || o.temporaryOrderCode || 'TMP'}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight leading-tight truncate">
                            {isOnline ? 'Đơn Online' : isDelivery ? 'Giao hàng' : isDineIn ? 'Tại bàn' : 'Mang đi'}
                          </div>
                          <div className="text-[9px] font-mono text-slate-400 truncate">
                            #{o.orderCode || o.temporaryOrderCode || 'TMP'}
                          </div>
                          {o.customerName && o.customerName !== 'Khách mang đi' && o.customerName !== 'Khách giao hàng' && (
                            <div className="text-[10px] font-medium text-slate-500 truncate mt-0.5" title={o.customerName}>
                              {o.customerName}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Order Status Pill */}
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {isOnline ? (
                          <>
                            {o.status === 'PENDING' && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Chờ xác nhận
                              </span>
                            )}
                            {o.status === 'CONFIRMED' && (
                              <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                                Đã xác nhận
                              </span>
                            )}
                            {o.status === 'PREPARING' && (
                              <span className="text-[9px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200">
                                Đang chuẩn bị
                              </span>
                            )}
                            {o.status === 'DELIVERING' && (
                              <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                                Đang giao
                              </span>
                            )}
                            {o.status === 'COMPLETED' && (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Hoàn tất
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {isPaymentRequested ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse shadow-2xs">
                                <CreditCard className="w-2.5 h-2.5 text-amber-600" />
                                <span>Chờ thanh toán</span>
                              </span>
                            ) : o.temporaryOrderCode && !o.orderCode ? (
                              <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Đang phục vụ
                              </span>
                            ) : null}
                            {(o.serviceChargeTotal || 0) > 0 && (
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                +{(o.serviceChargeTotal || 0) / 1000}k phụ thu
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stats Row: Real-time Elapsed Time & Total Amount */}
                    <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      {/* Left: Real-time serving duration */}
                      <div
                        className="flex items-center gap-0.5 font-mono text-slate-500 text-[9px] font-medium"
                        title="Thời gian phục vụ (Realtime)"
                      >
                        <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        <span>{elapsedTimer}</span>
                      </div>

                      {/* Right: Total Amount */}
                      <div className="font-extrabold text-xs text-[#da251d]">
                        {(o.totalAmount || 0).toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Action Buttons (...) & Thanh toán */}
                  <div className="px-1.5 py-1 bg-slate-50/80 border-t border-slate-100 flex items-center gap-1">
                    {/* More button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuOrderId(activeMenuOrderId === o.id ? null : o.id);
                        }}
                        className="w-6 h-6 rounded-md bg-white hover:bg-slate-200 border border-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="Tùy chọn khác"
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuOrderId === o.id && (
                        <div
                          ref={menuRef}
                          className="absolute left-0 bottom-full mb-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 text-xs select-none"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuOrderId(null);
                              onSelectOrder(o);
                            }}
                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>{isOnline ? 'Xem chi tiết đơn' : 'Xem & sửa món'}</span>
                          </button>
                          {onOpenOrderFeesModal && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuOrderId(null);
                                onOpenOrderFeesModal(o);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 flex items-center gap-2 font-medium cursor-pointer border-t border-slate-100"
                            >
                              <Tag className="w-3.5 h-3.5 text-amber-600" />
                              <span>{isOnline ? 'Chi tiết đơn & Phí ship' : 'Phụ thu & Hóa đơn VAT'}</span>
                            </button>
                          )}
                          {/* Quick Status Transitions - ONLY FOR ONLINE DELIVERY ORDERS */}
                          {isOnline && o.status === 'PENDING' && onQuickUpdateStatus && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuOrderId(null);
                                onQuickUpdateStatus(o.id, 'CONFIRMED');
                              }}
                              className="w-full text-left px-3 py-1.5 text-sky-700 hover:bg-sky-50 flex items-center gap-2 font-bold cursor-pointer border-t border-slate-100"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                              <span>Xác nhận đơn</span>
                            </button>
                          )}
                          {isOnline && o.status === 'CONFIRMED' && onQuickUpdateStatus && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuOrderId(null);
                                onQuickUpdateStatus(o.id, 'PREPARING');
                              }}
                              className="w-full text-left px-3 py-1.5 text-orange-700 hover:bg-orange-50 flex items-center gap-2 font-bold cursor-pointer border-t border-slate-100"
                            >
                              <ChefHat className="w-3.5 h-3.5 text-orange-600" />
                              <span>Bắt đầu làm món</span>
                            </button>
                          )}
                          {isOnline && o.status === 'PREPARING' && onQuickUpdateStatus && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuOrderId(null);
                                onQuickUpdateStatus(o.id, 'DELIVERING');
                              }}
                              className="w-full text-left px-3 py-1.5 text-purple-700 hover:bg-purple-50 flex items-center gap-2 font-bold cursor-pointer border-t border-slate-100"
                            >
                              <Truck className="w-3.5 h-3.5 text-purple-600" />
                              <span>Bắt đầu giao hàng</span>
                            </button>
                          )}
                          {isOnline && o.status === 'DELIVERING' && onQuickUpdateStatus && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuOrderId(null);
                                onQuickUpdateStatus(o.id, 'COMPLETED');
                              }}
                              className="w-full text-left px-3 py-1.5 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 font-bold cursor-pointer border-t border-slate-100"
                            >
                              <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Hoàn thành đơn</span>
                            </button>
                          )}
                          {onPrintTempBill && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuOrderId(null);
                                onPrintTempBill(o);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 flex items-center gap-2 font-medium cursor-pointer border-t border-slate-100"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-500" />
                              <span>{isOnline ? 'In đơn hàng online' : 'In tạm tính'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Thanh toán / Đã TT / Xem đơn Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOnline || isCompleted || isSepayPaid) {
                          onSelectOrder(o);
                        } else if (onPayOrder) {
                          onPayOrder(o);
                        } else {
                          onSelectOrder(o);
                        }
                      }}
                      className={`flex-1 h-6 rounded-md font-bold text-[10px] flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer ${
                        isOnline
                          ? isSepayPaid
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-700 hover:bg-slate-800 text-white'
                          : isPaymentRequested
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold ring-1 ring-amber-400 animate-pulse'
                          : isSepayPaid
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-[#da251d] hover:bg-[#b81d16] text-white active:scale-95'
                      }`}
                    >
                      {isOnline ? (
                        isSepayPaid ? (
                          <>
                            <ShieldCheck className="w-2.5 h-2.5" />
                            <span>Đã TT (SePay)</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-2.5 h-2.5" />
                            <span>Xem đơn</span>
                          </>
                        )
                      ) : isSepayPaid ? (
                        <>
                          <ShieldCheck className="w-2.5 h-2.5" />
                          <span>Đã TT (SePay)</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-2.5 h-2.5" />
                          <span>{isPaymentRequested ? 'Thu tiền ngay' : 'Thanh toán'}</span>
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
    </div>
  );
};
