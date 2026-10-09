'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  CreditCard,
  Download,
  RefreshCw,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Building2,
  TrendingUp,
  DollarSign,
  Receipt,
  Layers,
  FileSpreadsheet,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Banknote,
  QrCode,
  Smartphone,
  ShieldCheck,
  HelpCircle,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  Legend,
} from 'recharts';
import { AdminCard, PageHeader } from '@/app/admin/components/ui';

// AVORA Brand Palette
const BRAND_PRIMARY = '#800020'; // Burgundy
const BRAND_DARK = '#1E293B'; // Slate 800
const BRAND_EMERALD = '#15803D'; // Emerald

const METHOD_PALETTE = [
  '#800020', // Burgundy
  '#2563eb', // Royal Blue
  '#16a34a', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#db2777', // Pink
  '#475569', // Slate
];

export default function AdminPaymentMethodReportsPage() {
  const { selectedBranchId } = useAdmin();
  const { t } = useLanguage();

  // Primary 2 Tabs: [THEO DOANH THU] | [THEO SỐ ĐƠN]
  const [metricTab, setMetricTab] = useState<'revenue' | 'orders'>('revenue');

  // Sub-navigation View Tabs
  const [viewTab, setViewTab] = useState<'methods' | 'branches' | 'trend' | 'transactions' | 'reconciliation'>('methods');

  // Loading & Action States
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'name'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Core Datasets
  const [overviewData, setOverviewData] = useState<any>(null);
  const [methodsData, setMethodsData] = useState<any[]>([]);
  const [branchesData, setBranchesData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [reconciliationData, setReconciliationData] = useState<any>(null);
  const [metadata, setMetadata] = useState<{ branches: any[]; paymentMethods: any[] }>({
    branches: [],
    paymentMethods: [],
  });

  // Transactions Pagination & Search
  const [txData, setTxData] = useState<any[]>([]);
  const [txPagination, setTxPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [txLoading, setTxLoading] = useState(false);
  const [txSearch, setTxSearch] = useState('');
  const [txMethodFilter, setTxMethodFilter] = useState('ALL');

  // Filters
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranchId || 'ALL');
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>('ALL');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<
    'today' | '7days' | '30days' | 'thisMonth' | 'thisQuarter' | 'thisYear' | 'custom'
  >('30days');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  // Sync Branch from global context
  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL') {
      setBranchFilter(selectedBranchId);
    }
  }, [selectedBranchId]);

  // Calculate Date Range based on presets
  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const formatYMD = (d: Date) => d.toISOString().slice(0, 10);

    if (datePreset === 'today') {
      return { fromDate: formatYMD(now), toDate: formatYMD(now) };
    }
    if (datePreset === '7days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      return { fromDate: formatYMD(past), toDate: formatYMD(now) };
    }
    if (datePreset === '30days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      return { fromDate: formatYMD(past), toDate: formatYMD(now) };
    }
    if (datePreset === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fromDate: formatYMD(start), toDate: formatYMD(now) };
    }
    if (datePreset === 'thisQuarter') {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterMonth, 1);
      return { fromDate: formatYMD(start), toDate: formatYMD(now) };
    }
    if (datePreset === 'thisYear') {
      const start = new Date(now.getFullYear(), 0, 1);
      return { fromDate: formatYMD(start), toDate: formatYMD(now) };
    }
    return { fromDate: customFrom, toDate: customTo };
  }, [datePreset, customFrom, customTo]);

  // Load Metadata
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/admin/reports/payment-methods/metadata/filters', {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && json.data) {
          setMetadata(json.data);
        }
      } catch (err) {
        console.error('Failed to load payment methods metadata:', err);
      }
    }
    loadMeta();
  }, []);

  // Build query string
  const baseQueryString = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set('from', fromDate);
    if (toDate) p.set('to', toDate);
    if (branchFilter && branchFilter !== 'ALL') p.set('branchId', branchFilter);
    if (orderSourceFilter && orderSourceFilter !== 'ALL') p.set('orderSource', orderSourceFilter);
    if (orderTypeFilter && orderTypeFilter !== 'ALL') p.set('orderType', orderTypeFilter);
    if (paymentMethodFilter && paymentMethodFilter !== 'ALL') p.set('paymentMethod', paymentMethodFilter);
    return p.toString();
  }, [fromDate, toDate, branchFilter, orderSourceFilter, orderTypeFilter, paymentMethodFilter]);

  // Load Main Datasets
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Overview & KPIs
      const overviewRes = await fetch(
        `/api/admin/reports/payment-methods/overview?${baseQueryString}`,
        { credentials: 'include' },
      );
      const overviewJson = await overviewRes.json();
      if (overviewJson.success && overviewJson.data) {
        setOverviewData(overviewJson.data.kpis);
        setReconciliationData(overviewJson.data.reconciliation);
      }

      // 2. Methods Breakdown
      const methodsRes = await fetch(
        `/api/admin/reports/payment-methods/methods?${baseQueryString}&sortBy=${sortBy}&sortOrder=${sortOrder}`,
        { credentials: 'include' },
      );
      const methodsJson = await methodsRes.json();
      if (methodsJson.success && methodsJson.data) {
        setMethodsData(methodsJson.data.methods || []);
      }

      // 3. Branches Breakdown
      const branchesRes = await fetch(
        `/api/admin/reports/payment-methods/branches?${baseQueryString}`,
        { credentials: 'include' },
      );
      const branchesJson = await branchesRes.json();
      if (branchesJson.success && branchesJson.data) {
        setBranchesData(branchesJson.data || []);
      }

      // 4. Daily Trend
      const trendRes = await fetch(
        `/api/admin/reports/payment-methods/trend?${baseQueryString}`,
        { credentials: 'include' },
      );
      const trendJson = await trendRes.json();
      if (trendJson.success && trendJson.data) {
        setTrendData(trendJson.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch payment method reports:', err);
    } finally {
      setLoading(false);
    }
  }, [baseQueryString, sortBy, sortOrder]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Load Transactions (paginated)
  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const p = new URLSearchParams(baseQueryString);
      p.set('page', String(txPagination.page));
      p.set('limit', String(txPagination.limit));
      if (txSearch.trim()) p.set('search', txSearch.trim());
      if (txMethodFilter && txMethodFilter !== 'ALL') p.set('paymentMethod', txMethodFilter);

      const res = await fetch(`/api/admin/reports/payment-methods/transactions?${p.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTxData(json.data.items || []);
        setTxPagination((prev) => ({
          ...prev,
          total: json.data.pagination.total,
          totalPages: json.data.pagination.totalPages,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setTxLoading(false);
    }
  }, [baseQueryString, txPagination.page, txPagination.limit, txSearch, txMethodFilter]);

  useEffect(() => {
    if (viewTab === 'transactions') {
      fetchTransactions();
    }
  }, [viewTab, fetchTransactions]);

  // Export Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/reports/payment-methods/export?${baseQueryString}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_BaoCao_PhuongThucThanhToan_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Xuất file Excel thất bại, vui lòng thử lại!');
    } finally {
      setExporting(false);
    }
  };

  // Sorted Methods for Bar Chart & Table
  const displayMethods = useMemo(() => {
    const list = [...methodsData];
    list.sort((a, b) => {
      let valA = metricTab === 'revenue' ? a.grossRevenue : a.orderCount;
      let valB = metricTab === 'revenue' ? b.grossRevenue : b.orderCount;

      if (sortBy === 'name') {
        valA = a.methodName.toLowerCase();
        valB = b.methodName.toLowerCase();
        return sortOrder === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      }

      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return list;
  }, [methodsData, metricTab, sortBy, sortOrder]);

  // Max value for Relative Bar calculation in Horizontal Bar Chart
  const maxBarMetric = useMemo(() => {
    if (displayMethods.length === 0) return 1;
    const values = displayMethods.map((m) => (metricTab === 'revenue' ? m.grossRevenue : m.orderCount));
    return Math.max(...values, 1);
  }, [displayMethods, metricTab]);

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      {/* 1. HEADER & STRICT RULE BADGE */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-4 bg-white p-3 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#800020]/10 flex items-center justify-center text-[#800020] shrink-0">
              <CreditCard className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight truncate">
                  Báo Cáo Phương Thức Thanh Toán
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  COMPLETED ONLY
                </span>
              </div>
              <p className="text-[11px] sm:text-xs md:text-sm text-slate-500 mt-0.5 truncate">
                Doanh thu, số đơn, tỷ trọng và đối soát dòng tiền theo từng phương thức
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">
          <button
            onClick={() => fetchReportData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs md:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg sm:rounded-xl transition-colors disabled:opacity-50 min-h-[36px] sm:min-h-[40px]"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#800020]' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs md:text-sm font-bold text-white bg-[#800020] hover:bg-[#600018] rounded-lg sm:rounded-xl shadow-xs transition-all disabled:opacity-50 min-h-[36px] sm:min-h-[40px]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
          </button>
        </div>
      </div>

      {/* 2. COMPREHENSIVE FILTER BAR (Grid 2 cols on mobile) */}
      <AdminCard className="p-2.5 sm:p-4 md:p-5 bg-white border-slate-200/80 rounded-xl sm:rounded-2xl shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {/* Preset Thời gian */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">Thời gian</label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as any)}
              className="w-full text-xs px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] h-8 sm:h-9"
            >
              <option value="today">Hôm nay</option>
              <option value="7days">7 ngày gần nhất</option>
              <option value="30days">30 ngày gần nhất</option>
              <option value="thisMonth">Tháng này</option>
              <option value="thisQuarter">Quý này</option>
              <option value="thisYear">Năm nay</option>
              <option value="custom">Tùy chỉnh...</option>
            </select>
          </div>

          {/* Chi nhánh */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">Chi nhánh</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full text-xs px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] h-8 sm:h-9"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {metadata.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Nguồn đơn */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">Nguồn đơn</label>
            <select
              value={orderSourceFilter}
              onChange={(e) => setOrderSourceFilter(e.target.value)}
              className="w-full text-xs px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] h-8 sm:h-9"
            >
              <option value="ALL">Tất cả nguồn</option>
              <option value="POS">POS Thu ngân</option>
              <option value="WEB">Website</option>
              <option value="QR_ORDER">QR Order</option>
              <option value="CHATBOT">Chatbot</option>
              <option value="VOICE">Voice</option>
            </select>
          </div>

          {/* Loại đơn */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">Loại đơn</label>
            <select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value)}
              className="w-full text-xs px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] h-8 sm:h-9"
            >
              <option value="ALL">Tất cả loại</option>
              <option value="DINE_IN">Ăn tại chỗ</option>
              <option value="TAKE_AWAY">Mang đi</option>
              <option value="DELIVERY">Giao hàng</option>
            </select>
          </div>

          {/* Lọc phương thức thanh toán */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] sm:text-xs font-bold text-slate-600 mb-1">Phương thức</label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full text-xs px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] h-8 sm:h-9"
            >
              <option value="ALL">Tất cả phương thức</option>
              {metadata.paymentMethods.map((m) => (
                <option key={m.methodCode} value={m.methodCode}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom date range picker if selected */}
        {datePreset === 'custom' && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600">Từ:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-200 rounded-lg bg-slate-50 font-medium"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600">Đến:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-200 rounded-lg bg-slate-50 font-medium"
              />
            </div>
          </div>
        )}
      </AdminCard>

      {/* 3. KPI OVERVIEW CARDS (Compact 2 cols on mobile) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {/* Doanh thu */}
        <div className="p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate">Tổng doanh thu</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#800020]/10 flex items-center justify-center text-[#800020] shrink-0">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-lg md:text-xl font-black text-slate-900 mt-1 sm:mt-2 truncate">
            {(overviewData?.totalGrossRevenue || 0).toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Đơn hoàn thành</div>
        </div>

        {/* Số đơn hoàn thành */}
        <div className="p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate">Đơn hoàn thành</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-lg md:text-xl font-black text-slate-900 mt-1 sm:mt-2">
            {overviewData?.totalCompletedOrders || 0} <span className="text-xs font-normal text-slate-500">đơn</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Distinct Orders</div>
        </div>

        {/* Thực thu */}
        <div className="p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate">Thực thu</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
              <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-lg md:text-xl font-black text-emerald-700 mt-1 sm:mt-2 truncate">
            {(overviewData?.totalCollectedRevenue || 0).toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-0.5 truncate">Đã thanh toán</div>
        </div>

        {/* Hoàn tiền */}
        <div className="p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate">Hoàn tiền</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-lg md:text-xl font-black text-red-600 mt-1 sm:mt-2 truncate">
            {(overviewData?.totalRefundedAmount || 0).toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Đã hoàn trả</div>
        </div>

        {/* Net Collected */}
        <div className="p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate">Net Thu</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-lg md:text-xl font-black text-slate-900 mt-1 sm:mt-2 truncate">
            {(overviewData?.netCollected || 0).toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Thực thu - Hoàn</div>
        </div>

        {/* Tỷ lệ Cashless */}
        <div className="p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate">Cashless Rate</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-lg md:text-xl font-black text-slate-900 mt-1 sm:mt-2">
            {(overviewData?.cashlessRatePercent || 0).toFixed(1)}%
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
            {overviewData?.cashlessOrderCount || 0}/{overviewData?.totalCompletedOrders || 0} đơn
          </div>
        </div>
      </div>

      {/* 4. RECONCILIATION BANNER */}
      {reconciliationData && (
        <div
          className={`p-2.5 sm:p-3.5 rounded-xl border flex items-center justify-between gap-2 ${
            reconciliationData.isReconciled
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-red-50/80 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {reconciliationData.isReconciled ? (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 shrink-0" />
            )}
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold truncate block sm:inline">
                {reconciliationData.isReconciled
                  ? 'Đối Soát: KHỚP 100% (RECONCILED)'
                  : 'CẢNH BÁO: Lệch số liệu đối soát!'}
              </span>
              <span className="text-[11px] sm:text-xs ml-0 sm:ml-2 opacity-80 hidden md:inline">
                DT: {reconciliationData.actualRevenue?.toLocaleString('vi-VN')} đ | Đơn:{' '}
                {reconciliationData.actualOrderCount}
              </span>
            </div>
          </div>

          <button
            onClick={() => setViewTab('reconciliation')}
            className="text-xs font-bold underline hover:opacity-80 shrink-0"
          >
            Chi tiết &rarr;
          </button>
        </div>
      )}

      {/* 5. SUB-NAVIGATION TABS (Horizontally scrollable on mobile) */}
      <div className="flex items-center justify-between border-b border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-none -mx-1 px-1 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewTab('methods')}
            className={`px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 ${
              viewTab === 'methods'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Phương Thức & Biểu Đồ
          </button>

          <button
            onClick={() => setViewTab('branches')}
            className={`px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 ${
              viewTab === 'branches'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Chi Nhánh
          </button>

          <button
            onClick={() => setViewTab('trend')}
            className={`px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 ${
              viewTab === 'trend'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Xu Hướng
          </button>

          <button
            onClick={() => setViewTab('transactions')}
            className={`px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 ${
              viewTab === 'transactions'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Giao Dịch
          </button>

          <button
            onClick={() => setViewTab('reconciliation')}
            className={`px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 ${
              viewTab === 'reconciliation'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Đối Soát
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: BIỂU ĐỒ & BẢNG PHƯƠNG THỨC THANH TOÁN (2 TAB DOANH THU | SỐ ĐƠN)
          ========================================================================= */}
      {viewTab === 'methods' && (
        <div className="space-y-3 sm:space-y-4 md:space-y-6">
          {/* TAB CHỌN: THEO DOANH THU | THEO SỐ ĐƠN */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mr-0.5">Chế độ:</span>
              <div className="inline-flex p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-slate-100 border border-slate-200">
                <button
                  onClick={() => setMetricTab('revenue')}
                  className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-black transition-all ${
                    metricTab === 'revenue'
                      ? 'bg-[#800020] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  THEO DOANH THU
                </button>
                <button
                  onClick={() => setMetricTab('orders')}
                  className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-black transition-all ${
                    metricTab === 'orders'
                      ? 'bg-[#800020] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  THEO SỐ ĐƠN
                </button>
              </div>
            </div>

            {/* Sắp xếp */}
            <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500">Xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-medium h-7 sm:h-8"
              >
                <option value="revenue">Doanh thu</option>
                <option value="orders">Số đơn</option>
                <option value="name">Tên</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="p-1 sm:p-1.5 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 min-h-[32px] min-w-[32px] flex items-center justify-center"
                title={sortOrder === 'desc' ? 'Cao -> Thấp' : 'Thấp -> Cao'}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* BIỂU ĐỒ HORIZONTAL BAR CHART GIỐNG ẢNH THAM KHẢO */}
          <AdminCard className="p-3 sm:p-5 md:p-6 bg-white border-slate-200/80 rounded-xl sm:rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between mb-3 sm:mb-5">
              <div>
                <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-900">
                  {metricTab === 'revenue'
                    ? 'Biểu Đồ Doanh Thu'
                    : 'Biểu Đồ Số Đơn'}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  {metricTab === 'revenue'
                    ? 'Xếp hạng đóng góp doanh thu theo phương thức'
                    : 'Xếp hạng số lượng đơn hoàn thành theo phương thức'}
                </p>
              </div>

              <div className="text-[11px] sm:text-xs font-semibold text-slate-500 text-right">
                Tổng:{' '}
                <span className="font-bold text-slate-900 block sm:inline">
                  {metricTab === 'revenue'
                    ? `${(overviewData?.totalGrossRevenue || 0).toLocaleString('vi-VN')} đ`
                    : `${overviewData?.totalCompletedOrders || 0} đơn`}
                </span>
              </div>
            </div>

            {/* Custom Horizontal Bar Visualization */}
            <div className="space-y-2.5 sm:space-y-3.5">
              {displayMethods.map((m, idx) => {
                const metricVal = metricTab === 'revenue' ? m.grossRevenue : m.orderCount;
                const percentShare = metricTab === 'revenue' ? m.revenueSharePercent : m.orderSharePercent;
                const barWidth = Math.max(2, (metricVal / maxBarMetric) * 100);
                const barColor = METHOD_PALETTE[idx % METHOD_PALETTE.length];

                return (
                  <div key={m.methodCode} className="group p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center justify-between text-xs sm:text-sm mb-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-slate-800 min-w-0">
                        <span
                          className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: barColor }}
                        />
                        <span className="truncate">{m.methodName}</span>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-400">
                          {percentShare.toFixed(1)}%
                        </span>
                        <span className="font-black text-slate-900 text-xs sm:text-sm md:text-base">
                          {metricTab === 'revenue'
                            ? `${m.grossRevenue.toLocaleString('vi-VN')} đ`
                            : `${m.orderCount} đơn`}
                        </span>
                      </div>
                    </div>

                    {/* Thanh Bar Ngang */}
                    <div className="w-full bg-slate-100 rounded-full h-2 sm:h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>

                    {/* Metric Phụ Bên Dưới */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] sm:text-[11px] text-slate-500 mt-1 pl-1 sm:pl-4">
                      {metricTab === 'revenue' ? (
                        <>
                          <span>
                            Đơn: <strong className="text-slate-700">{m.orderCount}</strong>
                          </span>
                          <span>
                            AOV: <strong className="text-slate-700">{m.averageOrderValue.toLocaleString('vi-VN')} đ</strong>
                          </span>
                          {m.refundedAmount > 0 && (
                            <span>
                              Hoàn: <strong className="text-red-600">{m.refundedAmount.toLocaleString('vi-VN')} đ</strong>
                            </span>
                          )}
                          <span>
                            Net: <strong className="text-slate-700">{m.netCollected.toLocaleString('vi-VN')} đ</strong>
                          </span>
                        </>
                      ) : (
                        <>
                          <span>
                            DT: <strong className="text-slate-700">{m.grossRevenue.toLocaleString('vi-VN')} đ</strong>
                          </span>
                          <span>
                            Tỷ trọng: <strong className="text-slate-700">{m.revenueSharePercent.toFixed(1)}%</strong>
                          </span>
                          <span>
                            AOV: <strong className="text-slate-700">{m.averageOrderValue.toLocaleString('vi-VN')} đ</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminCard>

          {/* BẢNG CHI TIẾT BÊN DƯỚI (CÓ DÒNG TỔNG CỘNG X ĐƠN) */}
          <AdminCard className="p-0 bg-white border-slate-200/80 rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-base font-black text-slate-900">
                  Bảng Chi Tiết Phương Thức
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-400">
                  Đầy đủ chỉ số nghiệp vụ của từng phương thức
                </p>
              </div>
            </div>

            <div className="admin-scroll-table">
              <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Phương Thức</th>
                    <th className="py-2.5 px-3 text-right">Số Đơn</th>
                    <th className="py-2.5 px-3 text-right">Tỷ Trọng Đơn</th>
                    <th className="py-2.5 px-3 text-right">Tổng Doanh Thu</th>
                    <th className="py-2.5 px-3 text-right">Tỷ Trọng DT</th>
                    <th className="py-2.5 px-3 text-right">AOV</th>
                    <th className="py-2.5 px-3 text-right">Hoàn Tiền</th>
                    <th className="py-2.5 px-3 text-right">Net Thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayMethods.map((m) => (
                    <tr key={m.methodCode} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{m.methodName}</span>
                          {m.isCash ? (
                            <span className="px-1 py-0.2 text-[8px] sm:text-[9px] font-extrabold bg-amber-100 text-amber-800 rounded">
                              CASH
                            </span>
                          ) : (
                            <span className="px-1 py-0.2 text-[8px] sm:text-[9px] font-extrabold bg-blue-100 text-blue-800 rounded">
                              CASHLESS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                        {m.orderCount}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {m.orderSharePercent.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {m.grossRevenue.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                        {m.revenueSharePercent.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {m.averageOrderValue.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-red-600">
                        {m.refundedAmount > 0 ? `${m.refundedAmount.toLocaleString('vi-VN')} đ` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {m.netCollected.toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* DÒNG TỔNG CỘNG (X ĐƠN) BẮT BUỘC KHỚP TUYỆT ĐỐI */}
                <tfoot className="bg-slate-900 text-white font-black text-xs sm:text-sm">
                  <tr>
                    <td className="py-3 px-3">
                      TỔNG CỘNG ({overviewData?.totalCompletedOrders || 0} ĐƠN)
                    </td>
                    <td className="py-3 px-3 text-right">
                      {overviewData?.totalCompletedOrders || 0}
                    </td>
                    <td className="py-3 px-3 text-right">100.0%</td>
                    <td className="py-3 px-3 text-right text-amber-300 font-extrabold text-xs sm:text-base">
                      {(overviewData?.totalGrossRevenue || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-right">100.0%</td>
                    <td className="py-3 px-3 text-right">
                      {(overviewData?.overallAov || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-right text-red-300">
                      {(overviewData?.totalRefundedAmount || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-300 font-extrabold text-xs sm:text-base">
                      {(overviewData?.netCollected || 0).toLocaleString('vi-VN')} đ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </AdminCard>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: SO SÁNH CHI NHÁNH
          ========================================================================= */}
      {viewTab === 'branches' && (
        <AdminCard className="p-0 bg-white border-slate-200/80 rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-100">
            <h3 className="text-xs sm:text-base font-black text-slate-900">
              So Sánh Thanh Toán Giữa Các Chi Nhánh
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400">
              Tỷ lệ tiền mặt, không tiền mặt và đóng góp của từng cơ sở
            </p>
          </div>

          <div className="admin-scroll-table">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Chi Nhánh</th>
                  <th className="py-2.5 px-3 text-right">Đơn Hoàn Thành</th>
                  <th className="py-2.5 px-3 text-right">Tổng Doanh Thu</th>
                  <th className="py-2.5 px-3 text-right">Hoàn Tiền</th>
                  <th className="py-2.5 px-3 text-right">Net Thu</th>
                  <th className="py-2.5 px-3 text-right">Đơn Tiền Mặt</th>
                  <th className="py-2.5 px-3 text-right">Đơn Cashless</th>
                  <th className="py-2.5 px-3 text-right">Tỷ Lệ Cashless</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchesData.map((b) => (
                  <tr key={b.branchId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {b.branchName} <span className="text-[11px] font-normal text-slate-400">({b.branchCode})</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                      {b.totalOrders}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                      {b.totalRevenue.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2.5 px-3 text-right text-red-600 font-semibold">
                      {b.totalRefunded > 0 ? `${b.totalRefunded.toLocaleString('vi-VN')} đ` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {b.netCollected.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {b.cashOrders}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {b.cashlessOrders}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                      {b.cashlessRatePercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* =========================================================================
          VIEW 3: XU HƯỚNG THEO THỜI GIAN (DAILY TREND)
          ========================================================================= */}
      {viewTab === 'trend' && (
        <AdminCard className="p-3 sm:p-5 md:p-6 bg-white border-slate-200/80 rounded-xl sm:rounded-2xl shadow-2xs space-y-3 sm:space-y-4">
          <div>
            <h3 className="text-xs sm:text-base font-black text-slate-900">
              Xu Hướng Doanh Thu Theo Ngày
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400">Biến động doanh thu hoàn thành theo thời gian</p>
          </div>

          <div className="h-56 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTrendRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND_PRIMARY} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={BRAND_PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis
                  tickFormatter={(val) => `${(val / 1000).toLocaleString()}k`}
                  tick={{ fontSize: 10 }}
                  stroke="#94a3b8"
                />
                <RechartsTooltip
                  formatter={(value: any) => [`${Number(value).toLocaleString('vi-VN')} đ`, '']}
                  labelFormatter={(lbl) => `Ngày: ${lbl}`}
                />
                <Area
                  type="monotone"
                  dataKey="totalRevenue"
                  name="Doanh thu hoàn thành"
                  stroke={BRAND_PRIMARY}
                  fillOpacity={1}
                  fill="url(#colorTrendRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>
      )}

      {/* =========================================================================
          VIEW 4: CHI TIẾT GIAO DỊCH (TRANSACTIONS DRILL-DOWN)
          ========================================================================= */}
      {viewTab === 'transactions' && (
        <AdminCard className="p-0 bg-white border-slate-200/80 rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-3">
            <div>
              <h3 className="text-xs sm:text-base font-black text-slate-900">
                Drill-down Chi Tiết Giao Dịch
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Toàn bộ đơn hàng đã hoàn thành và phân bổ thanh toán
              </p>
            </div>

            {/* Transaction Filter & Search */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm mã đơn, tên..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchTransactions()}
                  className="text-xs pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg w-full sm:w-48 h-8"
                />
              </div>

              <select
                value={txMethodFilter}
                onChange={(e) => setTxMethodFilter(e.target.value)}
                className="text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium h-8"
              >
                <option value="ALL">Tất cả PTTT</option>
                {metadata.paymentMethods.map((m) => (
                  <option key={m.methodCode} value={m.methodCode}>
                    {m.name}
                  </option>
                ))}
              </select>

              <button
                onClick={fetchTransactions}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 h-8"
              >
                Lọc
              </button>
            </div>
          </div>

          <div className="admin-scroll-table">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Mã Đơn</th>
                  <th className="py-2.5 px-3">Thời Gian</th>
                  <th className="py-2.5 px-3">Chi Nhánh</th>
                  <th className="py-2.5 px-3">Khách Hàng</th>
                  <th className="py-2.5 px-3">PTTT Chính</th>
                  <th className="py-2.5 px-3 text-right">Tổng Đơn</th>
                  <th className="py-2.5 px-3 text-right">Thực Thu</th>
                  <th className="py-2.5 px-3 text-right">Hoàn Tiền</th>
                  <th className="py-2.5 px-3 text-right">Net Thu</th>
                  <th className="py-2.5 px-3 text-center">Split</th>
                  <th className="py-2.5 px-3">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txLoading ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-slate-400 font-medium">
                      Đang tải danh sách giao dịch...
                    </td>
                  </tr>
                ) : txData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-slate-400 font-medium">
                      Không tìm thấy giao dịch nào phù hợp
                    </td>
                  </tr>
                ) : (
                  txData.map((tx) => (
                    <tr key={tx.orderId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#800020]">
                        {tx.orderCode}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500">
                        {tx.completionTimestamp ? new Date(tx.completionTimestamp).toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">{tx.branchName}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{tx.customerName}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900">{tx.primaryPaymentMethodName}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {tx.orderTotalAmount.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                        {tx.collectedRevenue.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-2.5 px-3 text-right text-red-600 font-semibold">
                        {tx.refundedAmount > 0 ? `${tx.refundedAmount.toLocaleString('vi-VN')} đ` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {tx.netCollected.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {tx.isSplitPayment ? (
                          <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-purple-100 text-purple-800 rounded-full">
                            Split ({tx.paymentLines?.length})
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.2 text-[9px] font-bold rounded-full ${
                            tx.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : tx.paymentStatus === 'REFUNDED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {tx.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          <div className="p-2.5 sm:p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              {txData.length}/{txPagination.total} đơn
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setTxPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={txPagination.page <= 1}
                className="p-1 sm:p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-800 text-[11px] sm:text-xs">
                {txPagination.page}/{txPagination.totalPages}
              </span>
              <button
                onClick={() =>
                  setTxPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))
                }
                disabled={txPagination.page >= txPagination.totalPages}
                className="p-1 sm:p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </AdminCard>
      )}

      {/* =========================================================================
          VIEW 5: ĐỐI SOÁT TOÁN HỌC (ZERO-TOLERANCE RECONCILIATION)
          ========================================================================= */}
      {viewTab === 'reconciliation' && (
        <AdminCard className="p-3 sm:p-5 md:p-6 bg-white border-slate-200/80 rounded-xl sm:rounded-2xl shadow-2xs space-y-3 sm:space-y-4">
          <div>
            <h3 className="text-xs sm:text-base md:text-lg font-black text-slate-900">
              Kiểm Tra Bất Biến Đối Soát Toán Học
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400">
              Cam kết Zero-Tolerance: Tổng các dòng phương thức = 100% tổng hệ thống
            </p>
          </div>

          <div className="admin-scroll-table border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Mục Đối Soát</th>
                  <th className="py-2.5 px-3 text-right">Kỳ Vọng</th>
                  <th className="py-2.5 px-3 text-right">Thực Tế</th>
                  <th className="py-2.5 px-3 text-right">Chênh Lệch</th>
                  <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliationData && [
                  {
                    name: 'Tổng Doanh Thu (Gross Revenue)',
                    exp: `${reconciliationData.expectedRevenue?.toLocaleString('vi-VN')} đ`,
                    act: `${reconciliationData.actualRevenue?.toLocaleString('vi-VN')} đ`,
                    diff: reconciliationData.discrepancyRevenue,
                  },
                  {
                    name: 'Tổng Số Đơn Hoàn Thành (Orders)',
                    exp: `${reconciliationData.expectedOrderCount} đơn`,
                    act: `${reconciliationData.actualOrderCount} đơn`,
                    diff: reconciliationData.discrepancyOrderCount,
                  },
                  {
                    name: 'Tổng Hoàn Tiền (Refunded)',
                    exp: `${reconciliationData.expectedRefund?.toLocaleString('vi-VN')} đ`,
                    act: `${reconciliationData.actualRefund?.toLocaleString('vi-VN')} đ`,
                    diff: reconciliationData.discrepancyRefund,
                  },
                  {
                    name: 'Tổng Net Thu (Net Collected)',
                    exp: `${reconciliationData.expectedNetCollected?.toLocaleString('vi-VN')} đ`,
                    act: `${reconciliationData.actualNetCollected?.toLocaleString('vi-VN')} đ`,
                    diff: reconciliationData.discrepancyNetCollected,
                  },
                ].map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-800">{item.name}</td>
                    <td className="py-2.5 px-3 text-right text-slate-700">{item.exp}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{item.act}</td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                        item.diff === 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {item.diff === 0 ? '0' : item.diff.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {item.diff === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" /> KHỚP 100%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3" /> LỆCH
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reconciliationData?.notes?.length > 0 && (
            <div className="p-2.5 sm:p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4" /> Ghi chú đối soát phát hiện:
              </div>
              {reconciliationData.notes.map((n: string, idx: number) => (
                <div key={idx} className="pl-4">
                  &bull; {n}
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      )}
    </div>
  );
}
