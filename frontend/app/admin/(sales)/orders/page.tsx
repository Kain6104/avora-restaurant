'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Search, Eye, ShoppingBag, Clock, CheckCircle2, Truck, Package, XCircle, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import Pagination from '@/app/admin/components/Pagination';
import { buildApiUrl } from '@/lib/utils/api';

interface Order {
  id: string;
  orderCode: string;
  totalAmount: number;
  subTotal: number;
  shippingFee: number;
  discountAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
  note: string;
  deliveryAddress: string;
  customerName?: string;
  customerPhone?: string;
  branch?: { name: string; street?: string; ward?: string; district?: string; province?: string };
  orderItems?: any[];
  voucher?: { code: string; discountType: string; discountValue: number };
  isViewedByAdmin?: boolean;
  cancelReason?: string;
  canceledBy?: string;
  user?: { id?: string; fullName?: string; email?: string; phone?: string };
}

interface Meta {
  total: number;
  totalPages: number;
  page: number;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock size={16} />,
  CONFIRMED: <CheckCircle2 size={16} />,
  PREPARING: <Package size={16} />,
  DELIVERING: <Truck size={16} />,
  COMPLETED: <ShoppingBag size={16} />,
  CANCELLED: <XCircle size={16} />,
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  DELIVERING: 'Đang giao',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  PREPARING: 'bg-purple-100 text-purple-800 border-purple-200',
  DELIVERING: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
};

export default function AdminOrdersPage() {
  const { selectedBranchId, role } = useAdmin();
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, totalPages: 1, page: 1 });
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  
  // Status counts
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const isInitialMount = useRef(true);

  // Sync state to URL
  useEffect(() => {
    if (isInitialMount.current) return;
    const params = new URLSearchParams(window.location.search);
    if (search) params.set('search', search); else params.delete('search');
    if (filterStatus) params.set('status', filterStatus); else params.delete('status');
    if (dateFrom) params.set('dateFrom', dateFrom); else params.delete('dateFrom');
    if (dateTo) params.set('dateTo', dateTo); else params.delete('dateTo');
    if (page > 1) params.set('page', page.toString()); else params.delete('page');
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [search, filterStatus, dateFrom, dateTo, page]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchOrders(false);
    } else {
      fetchOrders(false);
    }
    
    fetchStatusCounts();
    
    // Auto-refresh every 15 seconds
    const interval = setInterval(() => {
      fetchOrders(true);
      fetchStatusCounts();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [selectedBranchId, page, filterStatus, dateFrom, dateTo]);

  const fetchOrders = async (silent = false, currentSearch = search) => {
    if (!silent) setLoading(true);
    try {
      const url = buildApiUrl('/api/admin/orders', {
        branchId: selectedBranchId,
        search: currentSearch,
        status: filterStatus,
        dateFrom,
        dateTo,
        page,
        limit: 10
      });

      const res = await fetch(url, {
        credentials: 'include'
      });
      const data = await res.json();
      setOrders(data.data || []);
      setMeta(data.meta || { total: 0, totalPages: 1, page: 1 });
    } catch (error) {
      console.error(error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchStatusCounts = async () => {
    try {
      const statuses = Object.keys(STATUS_LABELS);
      const counts: Record<string, number> = {};
      await Promise.all(
        statuses.map(async (s) => {
          const url = buildApiUrl('/api/admin/orders', {
            branchId: selectedBranchId,
            dateFrom,
            dateTo,
            limit: 1,
            status: s
          });
          const res = await fetch(url, { credentials: 'include' });
          const data = await res.json();
          counts[s] = data.meta?.total ?? 0;
        })
      );
      setStatusCounts(counts);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };
  

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };


  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quản lý Đơn hàng</h1>
          <span className="text-sm text-gray-500">
            Tổng: <span className="font-bold text-gray-800">{meta.total}</span> đơn hàng
          </span>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <input 
            type="date"
            className="border rounded-lg px-3 py-2 text-sm bg-white font-medium shadow-sm outline-none focus:ring-2 focus:ring-red-500"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            title="Từ ngày"
          />
          <span className="text-gray-400">-</span>
          <input 
            type="date"
            className="border rounded-lg px-3 py-2 text-sm bg-white font-medium shadow-sm outline-none focus:ring-2 focus:ring-red-500"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            title="Đến ngày"
          />

          <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
            <input 
              type="text" 
              placeholder="Tìm mã đơn, tên, SĐT..." 
              className="w-full border rounded-lg pl-10 pr-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-red-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <button type="submit" className="hidden"></button>
          </form>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setPage(1); fetchOrders(); }} className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50 bg-white">
              Xóa
            </button>
          )}
        </div>
      </div>

      {/* Thống kê đơn hàng (như bên Users) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setFilterStatus(filterStatus === key ? '' : key); setPage(1); }}
            className={`p-3 rounded-xl border-2 text-left transition-all ${
              filterStatus === key ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${STATUS_COLORS[key]}`}>
                {STATUS_ICONS[key]} {label}
              </span>
            </div>
            <div className="text-xl font-bold text-gray-900 mt-2">{statusCounts[key] ?? '...'}</div>
            <div className="text-xs text-gray-500">đơn hàng</div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 font-bold text-gray-600">Mã Đơn</th>
                <th className="px-6 py-4 font-bold text-gray-600">Khách Hàng</th>
                <th className="px-6 py-4 font-bold text-gray-600">Chi Nhánh</th>
                <th className="px-6 py-4 font-bold text-gray-600 text-right">Tổng Tiền</th>
                <th className="px-6 py-4 font-bold text-gray-600 text-center">Thanh Toán</th>
                <th className="px-6 py-4 font-bold text-gray-600 text-center">Trạng Thái</th>
                <th className="px-6 py-4 font-bold text-gray-600">Thời Gian</th>
                <th className="px-6 py-4 font-bold text-gray-600 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      Đang tải dữ liệu...
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500">Không tìm thấy đơn hàng nào</td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id} onClick={() => router.push(`/admin/orders/${order.id}`)} className={`hover:bg-gray-50 transition-colors cursor-pointer ${!order.isViewedByAdmin ? 'bg-red-50/30' : ''}`}>
                    <td className="px-6 py-4 font-mono font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {(order.orderCode || order.id.split('-')[0]).toUpperCase()}
                        {!order.isViewedByAdmin && (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">NEW</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{order.user?.fullName || order.customerName || 'Khách vãng lai'}</div>
                      {order.isInvoiceRequested && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                            <FileText size={10} /> XUẤT VAT
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {order.branch?.name || '-'}
                    </td>
                    <td className="px-6 py-4 font-black text-red-600">
                      {formatMoney(order.totalAmount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs font-medium">
                      {new Date(order.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/admin/orders/${order.id}`); }} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600" title="Xem chi tiết">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <Pagination 
          currentPage={page} 
          totalPages={meta.totalPages} 
          totalItems={meta.total} 
          itemName="đơn hàng" 
          onPageChange={setPage} 
        />
      </div>


    </div>
  );
}
