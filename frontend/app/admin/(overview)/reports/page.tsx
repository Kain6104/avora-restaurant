 'use client';

import React, { useEffect, useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { BarChart3, TrendingUp, Users, ShoppingBag, DollarSign, Target, CreditCard, Flame, AlertCircle, Clock, Layers } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function AdminReportsPage() {
  const { selectedBranchId } = useAdmin();
  const [summary, setSummary] = useState<any>(null);
  const [revenueComparison, setRevenueComparison] = useState<any[]>([]);
  const [dishStats, setDishStats] = useState<any>(null);
  const [paymentStats, setPaymentStats] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [tierRevenueStats, setTierRevenueStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dishSearch, setDishSearch] = useState('');
  
  // Default to last 6 months
  const defaultFrom = new Date();
  defaultFrom.setMonth(defaultFrom.getMonth() - 5);
  defaultFrom.setDate(1);
  
  const [revenueFromDate, setRevenueFromDate] = useState(defaultFrom.toISOString().split('T')[0]);
  const [revenueToDate, setRevenueToDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, [selectedBranchId, revenueFromDate, revenueToDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchQuery = selectedBranchId && selectedBranchId !== 'ALL' ? `branchId=${selectedBranchId}` : '';
      const dateQuery = `?${branchQuery}${branchQuery ? '&' : ''}from=${revenueFromDate}&to=${revenueToDate}`;
      
      const [sumRes, revRes, dishRes, payRes, peakRes, catRes, tierRes] = await Promise.all([
        fetch(`/api/admin/reports/summary${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/revenue-comparison${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/dish-stats${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/payment-stats${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/peak-hours${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/category-stats${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/tier-revenue${dateQuery}`, { credentials: 'include' })
      ]);

      setSummary((await sumRes.json()).data);
      setRevenueComparison((await revRes.json()).data);
      setDishStats((await dishRes.json()).data);
      setPaymentStats((await payRes.json()).data);
      setPeakHours((await peakRes.json()).data);
      setCategoryStats((await catRes.json()).data);
      setTierRevenueStats((await tierRes.json()).data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const PAYMENT_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];

  if (loading || !summary) {
    return <div className="animate-pulse space-y-6">
      <div className="h-8 bg-gray-200 w-48 rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-80 bg-gray-200 rounded-xl"></div>
        <div className="h-80 bg-gray-200 rounded-xl"></div>
      </div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">Báo cáo Phân tích chuyên sâu</h1>
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Từ</span>
            <input 
              type="date" 
              value={revenueFromDate}
              onChange={e => setRevenueFromDate(e.target.value)}
              className="text-sm border-none outline-none focus:ring-0 cursor-pointer font-medium text-gray-700 p-0" 
            />
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Đến</span>
            <input 
              type="date" 
              value={revenueToDate}
              onChange={e => setRevenueToDate(e.target.value)}
              className="text-sm border-none outline-none focus:ring-0 cursor-pointer font-medium text-gray-700 p-0" 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Tổng Đơn Thành Công</p>
            <h3 className="text-2xl font-black text-gray-900">{summary.completedOrders}</h3>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
            <Target size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Tỷ Lệ Thành Công</p>
            <h3 className="text-2xl font-black text-gray-900">{summary.successRate.toFixed(1)}%</h3>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Doanh Thu Tích Lũy</p>
            <h3 className="text-xl font-black text-gray-900">{formatMoney(summary.totalRevenue)}</h3>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Tổng Khách Hàng</p>
            <h3 className="text-2xl font-black text-gray-900">{summary.totalUsers}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue Comparison */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="text-blue-600" />
              Tăng trưởng Doanh thu
            </h3>
          </div>
          <div className="flex-1 min-h-[288px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueComparison}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tickFormatter={(val) => {
                   if(val.includes('-') && val.split('-').length === 2) return `Tháng ${val.split('-')[1]}`;
                   return val.split('-').slice(1).join('/');
                }} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(val) => `${val / 1000000}M`} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [formatMoney(value), 'Doanh thu']}
                  labelFormatter={(label) => label.includes('-') && label.split('-').length === 2 ? `Tháng ${label}` : `Ngày: ${label}`}
                  contentStyle={{ borderRadius: '12px' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <CreditCard className="text-pink-500" />
            Tỉ trọng Phương thức thanh toán
          </h3>
          <div className="flex flex-col md:flex-row items-center h-72">
            <div className="flex-1 w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="revenue"
                  >
                    {paymentStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatMoney(value), 'Doanh thu']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full space-y-4">
              {paymentStats.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[idx % PAYMENT_COLORS.length] }}></div>
                    <span className="font-semibold text-gray-700">{entry.method}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatMoney(entry.revenue)}</p>
                    <p className="text-xs text-gray-500">{entry.count} đơn</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* All Dishes Stats */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Flame className="text-orange-500" />
              Thống kê Bán Hàng theo Món Ăn
            </h3>
            <input
              type="text"
              placeholder="Tìm kiếm món ăn..."
              value={dishSearch}
              onChange={(e) => setDishSearch(e.target.value)}
              className="px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-full md:w-64"
            />
          </div>
          <div className="flex-1 space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {dishStats?.allSelling
              ?.filter((p: any) => p.name.toLowerCase().includes(dishSearch.toLowerCase()))
              .map((product: any, idx: number) => (
              <div key={product.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-orange-50/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm shrink-0">
                  #{dishStats.allSelling.findIndex((p: any) => p.id === product.id) + 1}
                </div>
                <div className="w-12 h-12 rounded-lg bg-white border overflow-hidden shrink-0">
                  {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover" /> : <div className="text-[10px] text-center mt-3 text-gray-400">No img</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">Đã bán: <span className="font-bold text-orange-600">{product.soldQuantity}</span></p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-gray-900">{formatMoney(product.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Peak Hours Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Clock className="text-indigo-500" />
            Khung giờ Vàng (Đơn hàng theo giờ)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={peakHours.filter(h => h.orderCount > 0 || h.hour > 6 && h.hour < 23)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tickFormatter={(val) => `${val}h`} />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [name === 'revenue' ? formatMoney(value) : value, name === 'revenue' ? 'Doanh thu' : 'Số đơn']}
                  labelFormatter={(label) => `Giờ: ${label}:00 - ${Number(label)+1}:00`}
                  contentStyle={{ borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="orderCount" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPeak)" name="orderCount" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Stats */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Layers className="text-emerald-500" />
            Doanh thu theo Danh mục
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(val) => `${val / 1000000}M`} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [formatMoney(value), 'Doanh thu']}
                  contentStyle={{ borderRadius: '12px' }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Tier Revenue Stats */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Target className="text-amber-500" />
            Doanh thu theo Hạng Thành Viên
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tierRevenueStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(val) => `${val / 1000000}M`} />
                <Tooltip 
                  formatter={(value: number) => [formatMoney(value), 'Doanh thu']}
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px' }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={40}>
                  {tierRevenueStats.map((entry, index) => {
                    const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#64748b'];
                    return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
