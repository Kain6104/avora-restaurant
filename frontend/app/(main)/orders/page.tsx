'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import {
  ShoppingBag, Clock, CheckCircle2, XCircle,
  Truck, Package, ChefHat, Search, Filter,
  ReceiptText, RotateCcw, MapPin, ChevronDown, QrCode, ArrowRight
} from 'lucide-react';
import CancelOrderModal from '@/components/CancelOrderModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400';

type OrderStatus = 'ALL' | 'PENDING' | 'PREPARING' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING:    { label: 'Chờ xác nhận', color: 'text-amber-700',  bg: 'bg-amber-50 border border-amber-200/80',   icon: <Clock className="w-3.5 h-3.5 text-amber-600" /> },
  PREPARING:  { label: 'Đang chuẩn bị', color: 'text-blue-700',   bg: 'bg-blue-50 border border-blue-200/80',    icon: <ChefHat className="w-3.5 h-3.5 text-blue-600" /> },
  DELIVERING: { label: 'Đang giao',     color: 'text-purple-700', bg: 'bg-purple-50 border border-purple-200/80',  icon: <Truck className="w-3.5 h-3.5 text-purple-600" /> },
  COMPLETED:  { label: 'Hoàn thành',   color: 'text-emerald-700',bg: 'bg-emerald-50 border border-emerald-200/80', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> },
  CANCELLED:  { label: 'Đã hủy',       color: 'text-rose-700',    bg: 'bg-rose-50 border border-rose-200/80',     icon: <XCircle className="w-3.5 h-3.5 text-rose-600" /> },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
}

export default function OrdersPage() {

  // Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<OrderStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [cancelTargetCode, setCancelTargetCode] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data || []);
      } else if (res.status === 401) {
        setIsUnauthorized(true);
      }
    } catch {
      toast.error('Lỗi khi tải đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const statusTabs: { key: OrderStatus; label: string }[] = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'PENDING', label: 'Chờ xác nhận' },
    { key: 'PREPARING', label: 'Đang chuẩn bị' },
    { key: 'DELIVERING', label: 'Đang giao' },
    { key: 'COMPLETED', label: 'Hoàn thành' },
    { key: 'CANCELLED', label: 'Đã hủy' },
  ];

  const filtered = orders.filter(o => {
    const matchStatus = activeStatus === 'ALL' || o.status === activeStatus;
    const matchSearch = !searchQuery || 
      (o.orderCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.orderItems?.some((i: any) => i.product?.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const activeCount = (status: OrderStatus) =>
    status === 'ALL' ? orders.length : orders.filter(o => o.status === status).length;

  if (isUnauthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-md border border-slate-100 flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-1">Chưa đăng nhập</h2>
            <p className="text-xs text-slate-500">Vui lòng đăng nhập để theo dõi và quản lý toàn bộ đơn hàng của bạn.</p>
          </div>
          <Link
            href="/login?redirect=/orders"
            className="w-full py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-600/20"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/60 to-white pb-16 pt-4 sm:pt-6">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 text-red-600" />
              <span>Lịch Sử Đơn Hàng</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Theo dõi tiến trình chế biến & giao hàng thời gian thực từ AVORA
            </p>
          </div>

          </div>

        {/* Orders List */}
            {/* Search bar & Status Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden flex-1">
                <div className="flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-1 sm:p-1.5 gap-1">
                  {statusTabs.map(({ key, label }) => {
                    const count = activeCount(key);
                    const active = activeStatus === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveStatus(key)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 whitespace-nowrap text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer ${
                          active
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <span>{label}</span>
                        {count > 0 && (
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-[18px] text-center ${
                              active ? 'bg-white text-red-600' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo mã đơn hoặc món ăn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-medium outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Orders Content */}
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs animate-pulse h-48" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 sm:p-16 text-center max-w-md mx-auto my-6">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">Không tìm thấy đơn hàng</h3>
                <p className="text-xs text-slate-500 mb-5">
                  {searchQuery ? 'Không có đơn hàng nào khớp với tìm kiếm.' : 'Bạn chưa có đơn hàng nào ở trạng thái này.'}
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-md shadow-red-600/20 text-xs active:scale-95"
                >
                  <span>Khám phá thực đơn ngay</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
                {filtered.map((order) => {
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                  const isExpanded = expandedOrder === order.id;
                  const isUnpaidOnline =
                    (order.status === 'PENDING' || order.status === 'PREPARING') &&
                    (order.paymentMethod === 'SEPAY' || order.paymentMethod === 'TRANSFER' || order.paymentMethod === 'SEPAY_QR') &&
                    order.paymentStatus !== 'PAID';

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                                  {cfg.icon}
                                  <span>{cfg.label}</span>
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-700">
                                  #{order.orderCode}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                {timeAgo(order.createdAt)} • {new Date(order.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-base sm:text-lg font-black text-red-600">
                              {new Intl.NumberFormat('vi-VN').format(order.totalAmount)} ₫
                            </div>
                            <span className="text-[10.5px] font-semibold text-slate-400">
                              {order.orderItems?.length || 0} món
                            </span>
                          </div>
                        </div>

                        {order.deliveryAddress && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-xl px-2.5 py-1.5 mb-3">
                            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span className="truncate">{order.deliveryAddress}</span>
                          </div>
                        )}

                        {/* Thumbnail preview */}
                        <div
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="flex items-center gap-2.5 p-2 rounded-2xl bg-slate-50/70 hover:bg-slate-100/70 transition-colors cursor-pointer mb-3"
                        >
                          <div className="flex -space-x-2 shrink-0">
                            {order.orderItems?.slice(0, 3).map((item: any, idx: number) => {
                              const imgSrc = item.product?.imageUrl || item.imageUrl || FALLBACK_IMG;
                              return (
                                <div
                                  key={idx}
                                  className="w-8 h-8 rounded-full border-2 border-white overflow-hidden shrink-0 shadow-2xs bg-white"
                                >
                                  <img
                                    src={imgSrc}
                                    alt={item.product?.name || item.name || 'Món ăn'}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = FALLBACK_IMG;
                                    }}
                                  />
                                </div>
                              );
                            })}
                            {order.orderItems?.length > 3 && (
                              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-700 shrink-0 z-10 shadow-2xs">
                                +{order.orderItems.length - 3}
                              </div>
                            )}
                          </div>

                          <span className="text-xs font-semibold text-slate-700 flex-1 truncate">
                            {order.orderItems?.[0]?.product?.name || order.orderItems?.[0]?.name || 'Món ăn'}
                            {order.orderItems?.length > 1 ? ` và ${order.orderItems.length - 1} món khác` : ''}
                          </span>

                          <div className="text-[11px] font-bold text-red-600 flex items-center gap-0.5 shrink-0">
                            <span>{isExpanded ? 'Thu gọn' : 'Xem món'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Items list */}
                        {isExpanded && (
                          <div className="space-y-2 mb-3 pt-1 border-t border-slate-100 animate-in fade-in duration-200">
                            {order.orderItems?.map((item: any, idx: number) => {
                              const imgSrc = item.product?.imageUrl || item.imageUrl || FALLBACK_IMG;
                              return (
                                <div key={idx} className="flex items-center justify-between gap-2.5 py-1.5 border-b border-slate-50 last:border-none">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-200/60">
                                      <img
                                        src={imgSrc}
                                        alt={item.product?.name || item.name || 'Món'}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.src = FALLBACK_IMG;
                                        }}
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-800 truncate">
                                        {item.product?.name || item.name || 'Món ăn'}
                                      </p>
                                      {item.optionsTextSnapshot && (
                                        <p className="text-[10px] text-slate-400 truncate">
                                          {item.optionsTextSnapshot}
                                        </p>
                                      )}
                                      <p className="text-[10px] text-slate-500 font-semibold">
                                        Số lượng: {item.quantity}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-xs font-bold text-slate-700 shrink-0">
                                    {new Intl.NumberFormat('vi-VN').format(item.priceAtSale * item.quantity)} ₫
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Card actions */}
                      <div className="p-3 sm:p-4 bg-slate-50/60 border-t border-slate-100 flex items-center gap-2">
                        <Link
                          href={`/orders/${order.orderCode}`}
                          className="flex-1 py-2 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <ReceiptText className="w-3.5 h-3.5 text-slate-500" />
                          <span>Xem chi tiết</span>
                        </Link>

                        {isUnpaidOnline && (
                          <Link
                            href={`/payment/sepay?orderCode=${order.orderCode}`}
                            className="flex-1 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-red-600/30"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Thanh toán VietQR</span>
                          </Link>
                        )}

                        {order.status === 'COMPLETED' && (
                          <Link
                            href="/"
                            className="py-2 sm:py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-red-600/20"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Đặt lại</span>
                          </Link>
                        )}

                        {order.status === 'PENDING' && (
                          <button
                            onClick={() => setCancelTargetCode(order.orderCode)}
                            className="py-2 sm:py-2.5 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            Hủy
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </div>

            {/* Cancel Order Modal */}
      {cancelTargetCode && (
        <CancelOrderModal
          isOpen={Boolean(cancelTargetCode)}
          orderCode={cancelTargetCode}
          onClose={() => setCancelTargetCode(null)}
          onSuccess={() => {
            setCancelTargetCode(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
