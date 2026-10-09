'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  ChefHat,
  RotateCw,
  Eye,
  Activity,
  Calendar as CalendarIcon,
  Check,
  Receipt,
  PieChart as PieChartIcon,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useRouter } from 'next/navigation';
import {
  AdminCard,
  StatCard,
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingSkeleton,
} from '@/app/admin/components/ui';
import { buildApiUrl } from '@/lib/utils/api';

const DONUT_COLORS = [
  '#0284c7', // Sky blue
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#64748b', // Slate
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { selectedBranchId } = useAdmin();
  const { t, locale } = useLanguage();

  const [period, setPeriod] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  // Reference Style Sub-tab toggles
  const [paymentTab, setPaymentTab] = useState<'revenue' | 'orders'>('revenue');
  const [taxTab, setTaxTab] = useState<'net' | 'invoices'>('net');
  const [categoryTab, setCategoryTab] = useState<'revenue' | 'quantity'>('revenue');
  const [productTab, setProductTab] = useState<'revenue' | 'quantity'>('revenue');
  const [topProductLimit, setTopProductLimit] = useState<number>(5);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const customRef = useRef<HTMLDivElement>(null);

  // Close custom popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customRef.current && !customRef.current.contains(e.target as Node)) {
        setIsCustomOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize custom dates with default 30 days
  useEffect(() => {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 29);
    setCustomTo(today.toISOString().split('T')[0]);
    setCustomFrom(past.toISOString().split('T')[0]);
  }, []);

  // Calculate Date Range based on Period or Custom Dates
  const dateRange = useMemo(() => {
    if (period === 'custom' && customFrom && customTo) {
      return {
        from: customFrom,
        to: customTo,
      };
    }
    const to = new Date();
    const from = new Date();
    const days = period === '7' ? 7 : period === '90' ? 90 : 30;
    from.setDate(to.getDate() - days + 1);
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  }, [period, customFrom, customTo]);

  const fetchDashboardStats = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const url = buildApiUrl('/api/admin/dashboard/stats', {
          branchId: selectedBranchId,
          from: dateRange.from,
          to: dateRange.to,
        });

        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [selectedBranchId, dateRange.from, dateRange.to]
  );

  useEffect(() => {
    fetchDashboardStats(false);
    const interval = setInterval(() => fetchDashboardStats(true), 20000); // 20s live polling
    return () => clearInterval(interval);
  }, [fetchDashboardStats]);

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const summary = data?.summary || {};
  const revenueChart = data?.revenueChart || [];
  const salesChannels = data?.salesChannels || [];
  const salesByCategory = data?.salesByCategory || [];
  const topProducts = (data?.topProducts || []).slice(0, topProductLimit);
  const recentOrders = data?.recentOrders || [];
  const recentActivities = data?.recentActivities || [];

  // Sparkline data from real daily revenue
  const sparklineRevenue = revenueChart.map((d: any) => ({ value: d.revenue }));
  const sparklineOrders = revenueChart.map((d: any) => ({ value: d.orders }));

  // Helper: map payment method code to human-friendly translated title
  const getPaymentName = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'CASH':
      case 'TIEN_MAT':
        return t('payment.CASH', 'Tiền mặt');
      case 'BANK_TRANSFER':
      case 'CHUYEN_KHOAN':
        return t('payment.BANK_TRANSFER', 'Chuyển khoản');
      case 'VIETQR':
      case 'QR':
        return t('payment.VIETQR', 'Techcombank VietQR Pro');
      case 'CREDIT_CARD':
      case 'CA_THE':
        return t('payment.CREDIT_CARD', 'Cà thẻ POS');
      case 'VISA':
      case 'MASTERCARD':
        return t('payment.VISA', 'Thẻ Visa / MasterCard');
      case 'MOMO':
        return t('payment.MOMO', 'Ví điện tử MoMo');
      case 'VNPAY':
        return t('payment.VNPAY', 'Cổng VNPay QR');
      case 'COD':
        return t('payment.COD', 'Thanh toán khi nhận hàng (COD)');
      default:
        return method || t('payment.OTHER', 'Phương thức khác');
    }
  };

  // Tax Breakdown Donut Data
  const taxDonutData = useMemo(() => {
    if (!summary.grossRevenue) return [];
    return [
      {
        name: t('dashboard.netRevenue', 'Doanh thu sau thuế'),
        value: summary.netRevenue || 0,
        percentage: 92,
      },
      {
        name: t('dashboard.taxAmount', 'Thuế VAT (8%)'),
        value: summary.taxAmount || 0,
        percentage: 8,
      },
    ];
  }, [summary, t]);

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6 pb-8 sm:pb-12">
      {/* Top Page Header with Period Tabs & Custom Date Range */}
      <PageHeader
        title={t('nav.dashboard', 'Tổng quan')}
        subtitle="Dữ liệu kinh doanh và báo cáo trực quan thời gian thực trên toàn chuỗi"
        breadcrumbs={[{ label: t('nav.overview', 'Tổng quan') }]}
        badge={
          <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-full border border-slate-200/80 shadow-2xs">
            {dateRange.from.split('-').reverse().join('/')} - {dateRange.to.split('-').reverse().join('/')}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Period Selector Tabs */}
            <div className="flex items-center bg-white p-1 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
              {(['7', '30', '90'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPeriod(p);
                    setIsCustomOpen(false);
                  }}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all min-h-[32px] sm:min-h-0 ${
                    period === p
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {p === '7'
                    ? t('dashboard.days7', '7 ngày')
                    : p === '30'
                    ? t('dashboard.days30', '30 ngày')
                    : t('dashboard.days90', '90 ngày')}
                </button>
              ))}

              {/* Custom Date Range Popover */}
              <div className="relative" ref={customRef}>
                <button
                  type="button"
                  onClick={() => setIsCustomOpen(!isCustomOpen)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all min-h-[32px] sm:min-h-0 ${
                    period === 'custom'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <CalendarIcon size={14} />
                  <span>{t('common.custom', 'Tùy chỉnh')}</span>
                </button>

                {isCustomOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-100 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3">
                    <p className="font-bold text-xs text-slate-800">
                      {t('common.custom', 'Chọn khoảng thời gian')}
                    </p>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          {t('common.fromDate', 'Từ ngày')}
                        </label>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          {t('common.toDate', 'Đến ngày')}
                        </label>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:bg-white"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (customFrom && customTo) {
                          setPeriod('custom');
                          setIsCustomOpen(false);
                        }
                      }}
                      className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                    >
                      <Check size={14} />
                      <span>{t('common.apply', 'Áp dụng')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchDashboardStats(false)}
              aria-label={t('common.refresh', 'Làm mới')}
              className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-bold shadow-2xs transition-colors min-h-[36px] min-w-[36px] inline-flex items-center justify-center"
            >
              <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {/* 4 Main KPI Cards with Real Trends & Sparklines - 2 cols on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        <StatCard
          title={t('dashboard.periodRevenue', 'Doanh thu')}
          value={formatMoney(summary.totalRevenue || 0)}
          change={summary.revenueChangePercent}
          changePeriod={t('dashboard.comparePeriod', 'so với kỳ trước')}
          icon={<DollarSign size={20} strokeWidth={2.5} />}
          color="red"
          sparklineData={sparklineRevenue}
          loading={loading}
        />
        <StatCard
          title={t('dashboard.totalOrders', 'Tổng đơn')}
          value={(summary.totalOrders || 0).toLocaleString()}
          change={summary.ordersChangePercent}
          changePeriod={t('dashboard.comparePeriod', 'so với kỳ trước')}
          icon={<ShoppingBag size={20} strokeWidth={2.5} />}
          color="blue"
          sparklineData={sparklineOrders}
          loading={loading}
        />
        <StatCard
          title={t('dashboard.completedOrders', 'Đơn xong')}
          value={(summary.completedOrders || 0).toLocaleString()}
          change={summary.completedOrdersChangePercent}
          changePeriod={t('dashboard.comparePeriod', 'so với kỳ trước')}
          icon={<CheckCircle2 size={20} strokeWidth={2.5} />}
          color="green"
          loading={loading}
        />
        <StatCard
          title={t('dashboard.avgOrderValue', 'AOV')}
          value={formatMoney(summary.averageOrderValue || 0)}
          change={summary.avgOrderChangePercent}
          changePeriod={t('dashboard.comparePeriod', 'so với kỳ trước')}
          icon={<TrendingUp size={20} strokeWidth={2.5} />}
          color="purple"
          loading={loading}
        />
      </div>

      {/* 4 DETAILED BREAKDOWN OVERVIEW CARDS (SAPO F&B STYLE AS IN REFERENCE IMAGE) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {/* CARD 1: TỔNG DOANH THU GỒM THUẾ (THEO PHƯƠNG THỨC THANH TOÁN) */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs p-3 sm:p-5 flex flex-col justify-between">
          {/* Sub-tab Switcher Header */}
          <div className="flex items-center gap-4 border-b border-slate-100 pb-3">
            <button
              type="button"
              onClick={() => setPaymentTab('revenue')}
              className={`text-xs sm:text-sm font-bold pb-1 transition-all relative ${
                paymentTab === 'revenue'
                  ? 'text-sky-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t('dashboard.grossRevenue', 'Tổng doanh thu gồm thuế')}</span>
              {paymentTab === 'revenue' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setPaymentTab('orders')}
              className={`text-xs sm:text-sm font-bold pb-1 transition-all relative ${
                paymentTab === 'orders'
                  ? 'text-sky-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t('dashboard.invoiceCount', 'Số hóa đơn')}</span>
              {paymentTab === 'orders' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Card Body: Legend List (Left) + Donut Chart (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-4 flex-1">
            {/* Legend Breakdown */}
            <div className="md:col-span-7 space-y-2 max-h-60 overflow-y-auto pr-1">
              {salesChannels.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {t('common.noData', 'Chưa có dữ liệu')}
                </div>
              ) : (
                salesChannels.map((item: any, idx: number) => {
                  const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                  const displayValue =
                    paymentTab === 'revenue'
                      ? formatMoney(item.revenue)
                      : `${item.orders.toLocaleString()} đơn`;
                  const pct = paymentTab === 'revenue' ? item.percentage : item.orderPercentage;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-semibold text-slate-700 truncate" title={getPaymentName(item.channel)}>
                          {getPaymentName(item.channel)}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900 block">{displayValue}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({pct}%)</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Donut Chart with Percentages */}
            <div className="md:col-span-5 h-48 sm:h-56 relative flex items-center justify-center">
              {salesChannels.length === 0 ? (
                <PieChartIcon size={40} className="text-slate-200" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesChannels}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey={paymentTab === 'revenue' ? 'revenue' : 'orders'}
                      nameKey="channel"
                    >
                      {salesChannels.map((_: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        paymentTab === 'revenue' ? formatMoney(Number(value)) : `${value} đơn`,
                        getPaymentName(name),
                      ]}
                      contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* CARD 2: TỔNG DOANH THU SAU THUẾ / CHI TIẾT THUẾ */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs p-3 sm:p-5 flex flex-col justify-between">
          {/* Sub-tab Switcher Header */}
          <div className="flex items-center gap-4 border-b border-slate-100 pb-3">
            <button
              type="button"
              onClick={() => setTaxTab('net')}
              className={`text-xs sm:text-sm font-bold pb-1 transition-all relative ${
                taxTab === 'net' ? 'text-sky-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t('dashboard.netRevenue', 'Tổng doanh thu sau thuế')}</span>
              {taxTab === 'net' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTaxTab('invoices')}
              className={`text-xs sm:text-sm font-bold pb-1 transition-all relative ${
                taxTab === 'invoices' ? 'text-sky-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t('dashboard.invoiceCount', 'Số hóa đơn')}</span>
              {taxTab === 'invoices' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Card Body: Legend List (Left) + Donut Chart (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-4 flex-1">
            <div className="md:col-span-7 space-y-3">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600 shrink-0" />
                  <span className="font-semibold text-xs text-slate-700">
                    {t('dashboard.netRevenue', 'Doanh thu thuần sau thuế')}
                  </span>
                </div>
                <span className="font-bold text-xs sm:text-sm text-slate-900">
                  {formatMoney(summary.netRevenue || 0)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shrink-0" />
                  <span className="font-semibold text-xs text-slate-700">
                    {t('dashboard.taxAmount', 'Thuế VAT (8%)')}
                  </span>
                </div>
                <span className="font-bold text-xs sm:text-sm text-slate-900">
                  {formatMoney(summary.taxAmount || 0)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-red-50/50 border border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt size={14} className="text-red-600 shrink-0" />
                  <span className="font-bold text-xs text-red-900">
                    {t('dashboard.grossRevenue', 'Tổng thanh toán (gồm thuế)')}
                  </span>
                </div>
                <span className="font-black text-xs sm:text-sm text-red-600">
                  {formatMoney(summary.grossRevenue || 0)}
                </span>
              </div>
            </div>

            <div className="md:col-span-5 h-44 sm:h-56 relative flex items-center justify-center">
              {summary.grossRevenue > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taxDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      <Cell fill="#0284c7" />
                      <Cell fill="#ec4899" />
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatMoney(Number(val)), 'Số tiền']}
                      contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <PieChartIcon size={40} className="text-slate-200" />
              )}
            </div>
          </div>
        </div>

        {/* CARD 3: MẶT HÀNG THEO DANH MỤC */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs p-3 sm:p-5 flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
              {t('dashboard.salesByCategory', 'Mặt hàng theo Danh mục')}
            </h3>

            {/* Sub-tab Switcher */}
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setCategoryTab('revenue')}
                className={`font-bold pb-0.5 transition-all relative ${
                  categoryTab === 'revenue'
                    ? 'text-sky-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t('dashboard.totalAmount', 'Tổng số tiền')}</span>
                {categoryTab === 'revenue' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setCategoryTab('quantity')}
                className={`font-bold pb-0.5 transition-all relative ${
                  categoryTab === 'quantity'
                    ? 'text-sky-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t('dashboard.quantity', 'Số lượng')}</span>
                {categoryTab === 'quantity' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
                )}
              </button>
            </div>
          </div>

          {/* Card Body: Legend List + Donut Chart */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-4 flex-1">
            <div className="md:col-span-7 space-y-2 max-h-60 overflow-y-auto pr-1">
              {salesByCategory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {t('common.noData', 'Chưa có dữ liệu')}
                </div>
              ) : (
                salesByCategory.map((cat: any, idx: number) => {
                  const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                  const displayValue =
                    categoryTab === 'revenue'
                      ? formatMoney(cat.revenue)
                      : `${cat.totalQuantity.toLocaleString()} phần`;
                  const pct =
                    categoryTab === 'revenue' ? cat.percentage : cat.qtyPercentage;

                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between text-xs p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-semibold text-slate-800 truncate" title={cat.name}>
                          {cat.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900 block">{displayValue}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({pct}%)</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="md:col-span-5 h-44 sm:h-56 relative flex items-center justify-center">
              {salesByCategory.length === 0 ? (
                <PieChartIcon size={40} className="text-slate-200" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey={categoryTab === 'revenue' ? 'revenue' : 'totalQuantity'}
                      nameKey="name"
                    >
                      {salesByCategory.map((_: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        categoryTab === 'revenue' ? formatMoney(Number(val)) : `${val} phần`,
                        name,
                      ]}
                      contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* CARD 4: MẶT HÀNG BÁN CHẠY */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs p-3 sm:p-5 flex flex-col justify-between">
          {/* Header with Limit Selector & Sub-tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
              {t('dashboard.topSellingItems', 'Mặt hàng bán chạy')}
            </h3>

            <div className="flex items-center gap-3">
              {/* Top 5 / Top 10 Dropdown */}
              <select
                value={topProductLimit}
                onChange={(e) => setTopProductLimit(Number(e.target.value))}
                className="h-7 px-2 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700 cursor-pointer"
              >
                <option value={5}>{t('dashboard.top5Products', 'Top 5 sản phẩm')}</option>
                <option value={10}>{t('dashboard.top10Products', 'Top 10 sản phẩm')}</option>
              </select>

              {/* Sub-tab Switcher */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setProductTab('revenue')}
                  className={`font-bold pb-0.5 transition-all relative ${
                    productTab === 'revenue'
                      ? 'text-sky-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{t('dashboard.totalAmount', 'Tổng số tiền')}</span>
                  {productTab === 'revenue' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setProductTab('quantity')}
                  className={`font-bold pb-0.5 transition-all relative ${
                    productTab === 'quantity'
                      ? 'text-sky-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{t('dashboard.quantity', 'Số lượng')}</span>
                  {productTab === 'quantity' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Card Body: Legend List + Donut Chart */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-4 flex-1">
            <div className="md:col-span-7 space-y-2 max-h-60 overflow-y-auto pr-1">
              {topProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {t('common.noData', 'Chưa có dữ liệu')}
                </div>
              ) : (
                topProducts.map((p: any, idx: number) => {
                  const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                  const displayValue =
                    productTab === 'revenue'
                      ? formatMoney(p.revenue)
                      : `${p.totalQuantity.toLocaleString()} phần`;
                  const pct =
                    productTab === 'revenue' ? p.percentage : p.qtyPercentage;

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-xs p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-semibold text-slate-800 truncate" title={p.name}>
                          {p.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900 block">{displayValue}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({pct}%)</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="md:col-span-5 h-44 sm:h-56 relative flex items-center justify-center">
              {topProducts.length === 0 ? (
                <PieChartIcon size={40} className="text-slate-200" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topProducts}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey={productTab === 'revenue' ? 'revenue' : 'totalQuantity'}
                      nameKey="name"
                    >
                      {topProducts.map((_: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        productTab === 'revenue' ? formatMoney(Number(val)) : `${val} phần`,
                        name,
                      ]}
                      contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Revenue Area Chart */}
      <AdminCard
        title={t('dashboard.revenueChart', 'Biểu đồ Doanh thu')}
        subtitle={t('dashboard.revenueChartSubtitle', 'Thống kê doanh thu theo thời gian thực')}
        icon={<TrendingUp size={16} />}
        badge={
          <span className="text-xs font-black text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
            {formatMoney(summary.totalRevenue || 0)}
          </span>
        }
      >
        <div className={`h-60 sm:h-72 lg:h-80 w-full mt-2 transition-opacity duration-200 ${loading ? 'opacity-70' : ''}`}>
          {loading && revenueChart.length === 0 ? (
            <LoadingSkeleton variant="chart" />
          ) : revenueChart.length === 0 ? (
            <EmptyState
              title={t('common.noData', 'Không có dữ liệu doanh thu')}
              description="Chưa có đơn hàng hoàn thành nào trong khoảng thời gian này."
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueChart}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val: any) => {
                    if (!val) return '';
                    const parts = val.split('-');
                    return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : val;
                  }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  dy={8}
                />
                <YAxis
                  tickFormatter={(val: any) =>
                    val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${val / 1000}k`
                  }
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  dx={-4}
                />
                <Tooltip
                  formatter={(value: any) => [formatMoney(Number(value) || 0), 'Doanh thu']}
                  labelFormatter={(label: any) => `Ngày: ${label}`}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #f1f5f9',
                    borderRadius: '14px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#ef4444"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </AdminCard>

      {/* Row: Recent Orders & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
        {/* Recent Real Orders Table */}
        <div className="lg:col-span-2">
          <AdminCard
            title={t('dashboard.recentOrders', 'Đơn hàng mới nhất')}
            icon={<ShoppingBag size={16} />}
            action={
              <button
                type="button"
                onClick={() => router.push('/admin/orders')}
                className="text-xs font-bold text-red-600 hover:underline min-h-[36px] inline-flex items-center"
              >
                {t('common.details', 'Quản lý đơn hàng')}
              </button>
            }
          >
            <div className="admin-scroll-table">
              {recentOrders.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  {t('dashboard.noRecentOrders', 'Chưa có đơn hàng nào')}
                </p>
              ) : (
                <table className="w-full text-left text-xs sm:text-sm min-w-[550px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold text-[10px] sm:text-[11px] uppercase tracking-wider">
                      <th className="pb-2.5 px-2">{t('table.orderCode', 'Mã đơn')}</th>
                      <th className="pb-2.5 px-2">{t('table.customer', 'Khách hàng')}</th>
                      <th className="pb-2.5 px-2">{t('table.branch', 'Chi nhánh')}</th>
                      <th className="pb-2.5 px-2 text-right">{t('table.totalAmount', 'Tổng tiền')}</th>
                      <th className="pb-2.5 px-2 text-center">{t('table.status', 'Trạng thái')}</th>
                      <th className="pb-2.5 px-2 text-right">{t('table.action', 'Chi tiết')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentOrders.map((order: any) => (
                      <tr
                        key={order.id}
                        onClick={() => router.push(`/admin/orders/${order.id}`)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-2 font-mono font-bold text-slate-900">
                          {order.orderCode.toUpperCase()}
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-slate-800">{order.customerName}</td>
                        <td className="py-2.5 px-2 text-slate-600">{order.branchName}</td>
                        <td className="py-2.5 px-2 text-right font-black text-red-600">
                          {formatMoney(order.totalAmount)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <StatusBadge status={order.status} size="sm" />
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/orders/${order.id}`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl min-h-[36px] min-w-[36px] inline-flex items-center justify-center"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </AdminCard>
        </div>

        {/* Real Recent Activities */}
        <div>
          <AdminCard
            title={t('dashboard.recentActivities', 'Hoạt động gần đây')}
            icon={<Activity size={16} />}
            action={
              <button
                type="button"
                onClick={() => router.push('/admin/audit-logs')}
                className="text-xs font-bold text-red-600 hover:underline"
              >
                {t('common.details', 'Xem log')}
              </button>
            }
          >
            <div className={`space-y-2 max-h-80 overflow-y-auto pr-1 transition-opacity duration-200 ${loading ? 'opacity-70' : ''}`}>
              {loading && recentActivities.length === 0 ? (
                <LoadingSkeleton variant="table" />
              ) : recentActivities.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  {t('dashboard.noRecentActivities', 'Chưa có hoạt động nào được ghi nhận')}
                </p>
              ) : (
                recentActivities.map((act: any) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100/80 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-800 bg-slate-200/70 px-1.5 py-0.5 rounded text-[10px]">
                          {act.action}
                        </span>
                        <span className="font-semibold text-slate-700 truncate">{act.target}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {act.userName} ({act.userRole})
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {new Date(act.createdAt).toLocaleTimeString(
                        locale === 'en' ? 'en-US' : 'vi-VN',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        }
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
