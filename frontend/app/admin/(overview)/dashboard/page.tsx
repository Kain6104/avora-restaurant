'use client';

import React, { useEffect, useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { TrendingUp, Users, ShoppingBag, XCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Stats {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalCustomers: number;
  recentOrders: any[];
  ordersByStatus: any[];
  revenueByDay: { date: string; revenue: number }[];
  topProducts?: any[];
  memberTierDistribution?: { name: string; users: number }[];
  recentTierMovements?: any[];
}

export default function DashboardPage() {
  const { selectedBranchId, availableBranches } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Default to last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [fromDate, setFromDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchStats();
  }, [selectedBranchId, fromDate, toDate]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/admin/dashboard/stats', window.location.origin);
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        url.searchParams.set('branchId', selectedBranchId);
      }
      if (fromDate) url.searchParams.set('from', fromDate);
      if (toDate) url.searchParams.set('to', toDate);

      const res = await fetch(url.toString(), {
        credentials: 'include'
      });
      const data = await res.json();
      setStats(data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <div className="animate-pulse flex flex-col gap-6">
      <div className="h-8 bg-gray-200 w-48 rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[1,2,3,4,5].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
      </div>
    </div>;
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">Tổng quan hệ thống</h1>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Từ</span>
            <input 
              type="date" 
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="text-sm border-none outline-none focus:ring-0 cursor-pointer font-medium text-gray-700" 
            />
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Đến</span>
            <input 
              type="date" 
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="text-sm border-none outline-none focus:ring-0 cursor-pointer font-medium text-gray-700" 
            />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Tổng doanh thu</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{formatMoney(stats.totalRevenue)}</h3>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Đơn hoàn thành</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.completedOrders}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <ShoppingBag size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Đơn bị hủy</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.cancelledOrders}</h3>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <XCircle size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Giá trị TB/Đơn</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{formatMoney(stats.averageOrderValue)}</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Tổng khách hàng</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{stats.totalCustomers || 0}</h3>
            </div>
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <Users size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Enhanced Area Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 xl:col-span-2">
          <h3 className="text-lg font-bold mb-6">Doanh thu theo ngày (Hoàn thành)</h3>
          <div className="h-72 w-full mt-4">
            {stats.revenueByDay.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400">Không có dữ liệu</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.revenueByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => val.split('-').slice(1).join('/')} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    tickFormatter={(val) => `${val / 1000000}M`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatMoney(value), 'Doanh thu']}
                    labelFormatter={(label) => `Ngày: ${label}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <h3 className="text-lg font-bold mb-4">Sản phẩm bán chạy</h3>
          <div className="flex-1 space-y-4">
            {!stats.topProducts || stats.topProducts.length === 0 ? (
              <div className="text-gray-400 text-center py-10">Chưa có dữ liệu</div>
            ) : (
              stats.topProducts.map((product: any, idx: number) => (
                <div key={product.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-gray-100 border overflow-hidden shrink-0">
                    {product.image ? <img src={product.image} className="w-full h-full object-cover" /> : <div className="text-[8px] text-center mt-3 text-gray-400">No img</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Đã bán: <span className="font-bold text-red-600">{product.totalQuantity}</span></p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Order Status Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 xl:col-span-1 flex flex-col">
          <h3 className="text-lg font-bold mb-4">Tỉ lệ Trạng thái Đơn hàng</h3>
          <div className="flex-1 min-h-[250px] w-full relative">
            {stats.ordersByStatus.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400">Không có dữ liệu</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {stats.ordersByStatus.map((entry, index) => {
                      const COLORS: any = {
                        COMPLETED: '#10b981', // green
                        CANCELLED: '#ef4444', // red
                        PENDING: '#f59e0b', // amber
                        PREPARING: '#3b82f6', // blue
                        DELIVERING: '#8b5cf6', // purple
                      };
                      return <Cell key={`cell-${index}`} fill={COLORS[entry.status] || '#cbd5e1'} />;
                    })}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, 'Số lượng']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {stats.ordersByStatus.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {stats.ordersByStatus.map((entry, idx) => {
                const STATUS_TEXT: any = { COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', PENDING: 'Chờ duyệt', PREPARING: 'Đang làm', DELIVERING: 'Đang giao' };
                const COLORS: any = { COMPLETED: 'bg-[#10b981]', CANCELLED: 'bg-[#ef4444]', PENDING: 'bg-[#f59e0b]', PREPARING: 'bg-[#3b82f6]', DELIVERING: 'bg-[#8b5cf6]' };
                return (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                    <div className={`w-3 h-3 rounded-full ${COLORS[entry.status] || 'bg-slate-300'}`}></div>
                    {STATUS_TEXT[entry.status] || entry.status} ({entry.count})
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Orders Table inside the new grid */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col xl:col-span-2">
          <h3 className="text-lg font-bold mb-4">Đơn hàng gần đây</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 font-bold text-gray-600">Khách Hàng</th>
                <th className="px-6 py-4 font-bold text-gray-600">Thời Gian</th>
                <th className="px-6 py-4 font-bold text-gray-600 text-right">Tổng Tiền</th>
                <th className="px-6 py-4 font-bold text-gray-600 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats.recentOrders.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-6 text-gray-500">Chưa có đơn hàng</td></tr>
              ) : (
                stats.recentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{order.user?.fullName || 'Khách vãng lai'}</td>
                    <td className="px-6 py-4 text-gray-500 font-medium">{new Date(order.createdAt).toLocaleString('vi-VN')}</td>
                    <td className="px-6 py-4 text-right font-black text-red-600">{formatMoney(order.totalAmount)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full inline-block ${
                        order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
