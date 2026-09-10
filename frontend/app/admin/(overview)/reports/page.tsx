'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  TrendingUp,
  ShoppingBag,
  Target,
  CreditCard,
  Flame,
  Clock,
  Layers,
  Users,
  DollarSign,
  ChefHat,
  Search,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  AdminCard,
  StatCard,
  PageHeader,
  DateRangeFilter,
  SearchInput,
  LoadingSkeleton,
} from '@/app/admin/components/ui';

export default function AdminReportsPage() {
  const { selectedBranchId } = useAdmin();
  const { t, locale } = useLanguage();
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
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }, []);

  const defaultTo = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [revenueFromDate, setRevenueFromDate] = useState(defaultFrom);
  const [revenueToDate, setRevenueToDate] = useState(defaultTo);

  useEffect(() => {
    fetchData();
  }, [selectedBranchId, revenueFromDate, revenueToDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchQuery =
        selectedBranchId && selectedBranchId !== 'ALL' ? `branchId=${selectedBranchId}` : '';
      const dateQuery = `?${branchQuery}${branchQuery ? '&' : ''}from=${revenueFromDate}&to=${revenueToDate}`;

      const [sumRes, revRes, dishRes, payRes, peakRes, catRes, tierRes] = await Promise.all([
        fetch(`/api/admin/reports/summary${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/revenue-comparison${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/dish-stats${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/payment-stats${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/peak-hours${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/category-stats${dateQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/tier-revenue${dateQuery}`, { credentials: 'include' }),
      ]);

      if (sumRes.ok) setSummary((await sumRes.json()).data);
      if (revRes.ok) setRevenueComparison((await revRes.json()).data || []);
      if (dishRes.ok) setDishStats((await dishRes.json()).data || null);
      if (payRes.ok) setPaymentStats((await payRes.json()).data || []);
      if (peakRes.ok) setPeakHours((await peakRes.json()).data || []);
      if (catRes.ok) setCategoryStats((await catRes.json()).data || []);
      if (tierRes.ok) setTierRevenueStats((await tierRes.json()).data || []);
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const PAYMENT_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t('reports.title', 'Báo cáo & Phân tích')}
        subtitle={t('reports.subtitle', 'Dữ liệu chuyên sâu về tăng trưởng doanh thu, khung giờ vàng và xu hướng ẩm thực')}
        breadcrumbs={[
          { label: t('nav.overview', 'Tổng quan') },
          { label: t('nav.reports', 'Báo cáo') },
        ]}
        actions={
          <DateRangeFilter
            fromDate={revenueFromDate}
            toDate={revenueToDate}
            onChange={(from, to) => {
              setRevenueFromDate(from);
              setRevenueToDate(to);
            }}
          />
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        <StatCard
          title={t('reports.completedOrders', 'ĐƠN THÀNH CÔNG')}
          value={summary?.completedOrders || 0}
          changePeriod={t('reports.completedOrdersSub', 'trong kỳ báo cáo')}
          icon={<ShoppingBag size={22} strokeWidth={2.5} />}
          color="blue"
          loading={loading}
        />
        <StatCard
          title={t('reports.successRate', 'TỶ LỆ THÀNH CÔNG')}
          value={summary?.successRate ? `${summary.successRate.toFixed(1)}%` : '0%'}
          changePeriod={t('reports.successRateSub', 'trên tổng số đơn')}
          icon={<Target size={22} strokeWidth={2.5} />}
          color="green"
          loading={loading}
        />
        <StatCard
          title={t('reports.periodRevenue', 'DOANH THU TÍCH LŨY')}
          value={formatMoney(summary?.totalRevenue || 0)}
          changePeriod={t('reports.periodRevenueSub', 'tổng thu thực tế')}
          icon={<DollarSign size={22} strokeWidth={2.5} />}
          color="red"
          loading={loading}
        />
        <StatCard
          title={t('reports.totalCustomers', 'TỔNG KHÁCH HÀNG')}
          value={summary?.totalUsers || 0}
          changePeriod={t('reports.totalCustomersSub', 'khách hàng đăng ký')}
          icon={<Users size={22} strokeWidth={2.5} />}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Revenue Trend & Payment Methods */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
        {/* Tăng trưởng doanh thu Line Chart */}
        <AdminCard
          title={t('reports.revenueGrowth', 'Tăng trưởng doanh thu')}
          subtitle={t('reports.revenueGrowthSub', 'Biến động doanh thu theo chu kỳ')}
          icon={<TrendingUp size={16} />}
        >
          <div className="h-72 sm:h-80 w-full mt-2">
            {!revenueComparison || revenueComparison.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                {t('common.noData', 'Chưa có dữ liệu so sánh doanh thu')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueComparison} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(val: any) => {
                      if (typeof val === 'string') {
                        if (val.includes('-') && val.split('-').length === 2)
                          return `${locale === 'en' ? 'M' : 'Tháng '}${val.split('-')[1]}`;
                        return val.split('-').slice(1).join('/');
                      }
                      return String(val);
                    }}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    tickFormatter={(val: any) => `${Number(val) / 1000000}M`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    dx={-8}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatMoney(Number(value) || 0), 'Doanh thu']}
                    labelFormatter={(label: any) => {
                      if (typeof label === 'string' && label.includes('-') && label.split('-').length === 2)
                        return `${locale === 'en' ? 'Month ' : 'Tháng '}${label}`;
                      return `Ngày: ${label}`;
                    }}
                    contentStyle={{ borderRadius: '14px', fontSize: '12px', fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#ef4444"
                    strokeWidth={3.5}
                    dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </AdminCard>

        {/* Tỷ trọng phương thức thanh toán */}
        <AdminCard
          title={t('reports.paymentMethods', 'Phương thức thanh toán')}
          subtitle={t('reports.paymentMethodsSub', 'Tỷ trọng doanh thu theo kênh thanh toán')}
          icon={<CreditCard size={16} />}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-72 sm:h-80">
            <div className="w-full sm:w-1/2 h-48 sm:h-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="revenue"
                  >
                    {paymentStats.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [formatMoney(Number(value) || 0), 'Doanh thu']}
                    contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-2.5 text-xs overflow-y-auto max-h-56">
              {paymentStats.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100/80"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PAYMENT_COLORS[idx % PAYMENT_COLORS.length] }}
                    />
                    <span className="font-semibold text-slate-700 truncate">{entry.method}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900">{formatMoney(entry.revenue)}</p>
                    <p className="text-[10px] text-slate-400">{entry.count} đơn</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AdminCard>
      </div>

      {/* Dish Sales Performance */}
      <AdminCard
        title={t('reports.dishPerformance', 'Hiệu suất món ăn')}
        subtitle={t('reports.dishPerformanceSub', 'Thống kê chi tiết số lượng và doanh thu từng món')}
        icon={<Flame size={16} />}
        action={
          <div className="w-48 sm:w-60">
            <SearchInput
              value={dishSearch}
              onChange={setDishSearch}
              placeholder={t('common.search', 'Tìm món ăn...')}
              size="sm"
            />
          </div>
        }
      >
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {dishStats?.allSelling
            ?.filter((d: any) => d.name.toLowerCase().includes(dishSearch.toLowerCase()))
            .map((dish: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-2xl border border-slate-100 hover:bg-red-50/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0">
                    {dish.imageUrl ? (
                      <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" />
                    ) : (
                      <ChefHat size={16} className="text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {dish.name}
                    </p>
                    <span className="text-[11px] text-slate-400">
                      {t('dashboard.soldCount', 'Đã bán')}:{' '}
                      <strong className="text-red-600 font-bold">{dish.totalQuantity}</strong>
                    </span>
                  </div>
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-900 shrink-0">
                  {formatMoney(dish.revenue)}
                </span>
              </div>
            ))}
        </div>
      </AdminCard>

      {/* Peak Ordering Hours Area Chart */}
      <AdminCard
        title={t('reports.goldenHours', 'Khung giờ vàng (Peak Hours)')}
        subtitle={t('reports.goldenHoursSub', 'Phân bố lượt đặt món theo các khung giờ trong ngày')}
        icon={<Clock size={16} />}
      >
        <div className="h-64 sm:h-72 w-full mt-2">
          {peakHours.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
              {t('common.noData', 'Chưa có dữ liệu khung giờ')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={peakHours} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dx={-8} />
                <Tooltip
                  formatter={(value: any) => [`${value} đơn`, 'Số lượng đơn']}
                  labelFormatter={(label: any) => `Khung giờ: ${label}`}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPeak)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </AdminCard>

      {/* Revenue by Category Bar Chart */}
      <AdminCard
        title={t('reports.categoryRevenue', 'Doanh thu theo danh mục')}
        subtitle={t('reports.categoryRevenueSub', 'Tỷ trọng đóng góp doanh số từng nhóm thực đơn')}
        icon={<Layers size={16} />}
      >
        <div className="h-64 sm:h-72 w-full mt-2">
          {categoryStats.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
              {t('common.noData', 'Chưa có dữ liệu danh mục')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                <YAxis
                  tickFormatter={(val: any) => `${Number(val) / 1000000}M`}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  dx={-8}
                />
                <Tooltip
                  formatter={(value: any) => [formatMoney(Number(value) || 0), 'Doanh thu']}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </AdminCard>
    </div>
  );
}
