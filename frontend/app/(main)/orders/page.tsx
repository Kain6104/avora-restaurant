'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import {
  ShoppingBag, ChevronRight, Clock, CheckCircle2, XCircle,
  Truck, Package, ChefHat, Search, Filter, ArrowLeft,
  ReceiptText, RotateCcw, MapPin, Star, ChevronDown
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type OrderStatus = 'ALL' | 'PENDING' | 'PREPARING' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING:    { label: 'Chờ xác nhận', color: 'text-amber-700',  bg: 'bg-amber-100',   icon: <Clock className="w-3.5 h-3.5" /> },
  PREPARING:  { label: 'Đang chuẩn bị', color: 'text-blue-700',   bg: 'bg-blue-100',    icon: <ChefHat className="w-3.5 h-3.5" /> },
  DELIVERING: { label: 'Đang giao',     color: 'text-purple-700', bg: 'bg-purple-100',  icon: <Truck className="w-3.5 h-3.5" /> },
  COMPLETED:  { label: 'Hoàn thành',   color: 'text-emerald-700',bg: 'bg-emerald-100', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  CANCELLED:  { label: 'Đã hủy',       color: 'text-red-700',    bg: 'bg-red-100',     icon: <XCircle className="w-3.5 h-3.5" /> },
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
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<OrderStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setOrders(data.orders || []);
        } else {
          toast.error('Vui lòng đăng nhập để tiếp tục');
          window.location.href = '/login?redirectURL=/orders';
        }
      } catch {
        toast.error('Vui lòng đăng nhập để tiếp tục');
        window.location.href = '/login?redirectURL=/orders';
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
    const matchSearch = !searchQuery || o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items?.some((i: any) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const activeCount = (status: OrderStatus) =>
    status === 'ALL' ? orders.length : orders.filter(o => o.status === status).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Đang tải đơn hàng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── BREADCRUMB (Sticky) ── */}
      <div className="sticky top-[52px] md:top-[56px] z-[45] bg-white border-b border-slate-100 shadow-sm transition-all">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center gap-3">
          <Link href="/profile" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Link href="/" className="hover:text-red-600 transition-colors">Trang chủ</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/profile" className="hover:text-red-600 transition-colors">Tài khoản</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-900 font-bold">Đơn hàng của tôi</span>
          </div>
        </div>
      </div>

      {/* ── HERO HEADER ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 pt-8 pb-16 md:pb-20 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 md:px-8 relative z-10">

          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white">Đơn hàng của tôi</h1>
              </div>
              <p className="text-white/50 text-sm">Theo dõi và quản lý tất cả đơn hàng</p>
            </div>

            {/* Stats pill */}
            <div className="hidden md:flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-3 text-white">
                <p className="text-white/60 text-xs mb-0.5">Tổng đơn hàng</p>
                <p className="text-2xl font-black">{orders.length}</p>
              </div>
              <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl px-5 py-3 text-emerald-300">
                <p className="text-emerald-300/70 text-xs mb-0.5">Hoàn thành</p>
                <p className="text-2xl font-black">{orders.filter(o => o.status === 'COMPLETED').length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT (card overlaps hero) ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 -mt-8 md:-mt-10 pb-24 md:pb-12 relative z-10">

        {/* Search + Filter bar */}
        <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-slate-100 p-3 md:p-4 mb-4 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100 transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Tìm theo mã đơn hoặc tên món..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:border-red-400 hover:text-red-600 transition-all shrink-0">
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Status tabs - horizontal scroll */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 mb-4 overflow-hidden">
          <div className="flex overflow-x-auto hide-scrollbar">
            {statusTabs.map(({ key, label }) => {
              const count = activeCount(key);
              const active = activeStatus === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveStatus(key)}
                  className={`flex items-center gap-2 px-4 md:px-5 py-3.5 whitespace-nowrap text-sm font-bold transition-all border-b-2 shrink-0 ${
                    active
                      ? 'border-red-600 text-red-600 bg-red-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                      active ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders list */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <ShoppingBag className="w-9 h-9 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Không tìm thấy đơn hàng</h3>
            <p className="text-slate-500 text-sm mb-6">
              {searchQuery ? 'Không có kết quả phù hợp. Thử tìm kiếm khác.' : 'Bạn chưa có đơn hàng nào ở trạng thái này.'}
            </p>
            <Link href="/menu" className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-full hover:bg-red-700 transition-colors shadow-md shadow-red-600/30 text-sm">
              Đặt món ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
              const isExpanded = expandedOrder === order.id;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
                >
                  {/* Order header */}
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {/* Status icon */}
                        <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 ${cfg.color}`}>
                          {cfg.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">#{order.id.slice(-8).toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{timeAgo(order.createdAt)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-slate-900">
                          {new Intl.NumberFormat('vi-VN').format(order.totalAmount)}đ
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">{order.items?.length || 0} món</p>
                      </div>
                    </div>

                    {/* Address */}
                    {order.deliveryAddress && (
                      <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 mb-3">
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{order.deliveryAddress}</span>
                      </div>
                    )}

                    {/* Items preview */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex -space-x-2">
                        {order.items?.slice(0, 3).map((item: any, i: number) => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden shrink-0 shadow-sm">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {order.items?.length > 3 && (
                          <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                            +{order.items.length - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-medium flex-1 truncate">
                        {order.items?.[0]?.name}{order.items?.length > 1 ? ` và ${order.items.length - 1} món khác` : ''}
                      </span>
                      <button
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className="text-xs text-slate-400 hover:text-red-600 transition-colors flex items-center gap-0.5 shrink-0"
                      >
                        Chi tiết
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Expanded: item list */}
                    {isExpanded && (
                      <div className="border border-slate-100 rounded-xl overflow-hidden mb-3">
                        {order.items?.map((item: any, i: number) => (
                          <div key={i} className={`flex items-center gap-3 p-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                            <img src={item.image} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 line-clamp-1">{item.name}</p>
                              <p className="text-xs text-slate-400">x{item.qty}</p>
                            </div>
                            <p className="text-sm font-bold text-red-600 shrink-0">
                              {new Intl.NumberFormat('vi-VN').format(item.price)}đ
                            </p>
                          </div>
                        ))}
                        <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-100">
                          <span className="text-sm font-bold text-slate-700">Tổng cộng</span>
                          <span className="text-sm font-black text-red-600">
                            {new Intl.NumberFormat('vi-VN').format(order.totalAmount)}đ
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Track bar for delivering */}
                    {order.status === 'DELIVERING' && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                          <span className="font-medium text-purple-700 flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5" /> Đang trên đường giao
                          </span>
                          <span>~ 15 phút</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full animate-pulse" style={{ width: '65%' }} />
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:border-slate-300 hover:bg-slate-50 transition-colors">
                        <ReceiptText className="w-3.5 h-3.5" /> Xem hoá đơn
                      </button>

                      {order.status === 'COMPLETED' && (
                        <>
                          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:border-slate-300 hover:bg-slate-50 transition-colors">
                            <Star className="w-3.5 h-3.5" /> Đánh giá
                          </button>
                          <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 transition-colors shadow-sm shadow-red-600/30">
                            <RotateCcw className="w-3.5 h-3.5" /> Mua lại
                          </button>
                        </>
                      )}

                      {order.status === 'DELIVERING' && (
                        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-purple-600 text-white font-bold rounded-xl text-xs hover:bg-purple-700 transition-colors">
                          <Package className="w-3.5 h-3.5" /> Theo dõi
                        </button>
                      )}

                      {order.status === 'PENDING' && (
                        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl text-xs hover:bg-red-100 transition-colors border border-red-200">
                          <XCircle className="w-3.5 h-3.5" /> Huỷ đơn
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}` }} />
    </div>
  );
}
