'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Receipt,
  Download,
  RefreshCw,
  Filter,
  Search,
  ChevronRight,
  HelpCircle,
  Percent,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  Store,
  Calendar,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye,
  Info,
  Clock,
  PieChart as PieIcon,
  BarChart2,
  Layers,
  AlertTriangle,
  X,
  Building2,
  UtensilsCrossed,
  FileSpreadsheet,
  Check,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { AdminCard, PageHeader } from '@/app/admin/components/ui';

// AVORA Brand Palette
const BRAND_PRIMARY = '#800020'; // Burgundy
const BRAND_SECONDARY = '#B91C1C'; // Red
const BRAND_DARK = '#1E293B'; // Slate 800

const CHART_COLORS = [
  '#800020', // Burgundy (8%)
  '#2563eb', // Blue (10%)
  '#16a34a', // Emerald (5%)
  '#94a3b8', // Slate (0%)
  '#d97706', // Amber (Other)
  '#7c3aed', // Purple
  '#0891b2', // Cyan
  '#ea580c', // Orange
];

export default function AdminTaxReportsPage() {
  const router = useRouter();
  const { selectedBranchId } = useAdmin();
  const { t, locale } = useLanguage();

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'rates' | 'branches' | 'categories' | 'products' | 'transactions' | 'reconciliation'
  >('overview');

  const [overviewData, setOverviewData] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);

  // Tab specific data
  const [ratesData, setRatesData] = useState<any[]>([]);
  const [branchesData, setBranchesData] = useState<any[]>([]);
  const [categoriesData, setCategoriesData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [reconciliationData, setReconciliationData] = useState<any>(null);

  // Transactions pagination & data
  const [txData, setTxData] = useState<any[]>([]);
  const [txPagination, setTxPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [txLoading, setTxLoading] = useState(false);

  // Modal inspection state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter States
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranchId || 'ALL');
  const [taxRateFilter, setTaxRateFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<
    'today' | '7days' | '30days' | 'thisMonth' | 'thisQuarter' | 'thisYear' | 'custom'
  >('30days');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [warningOnly, setWarningOnly] = useState<boolean>(false);

  // Sync selectedBranchId from global context
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

  // Load Metadata (Branches, Categories, Tax Rates)
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch('/api/admin/reports/tax/metadata/filters', {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && json.data) {
          setMetadata(json.data);
        }
      } catch (err) {
        console.error('Failed to load tax metadata:', err);
      }
    }
    loadMeta();
  }, []);

  // Build query string params
  const queryParamsString = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set('from', fromDate);
    if (toDate) p.set('to', toDate);
    if (branchFilter && branchFilter !== 'ALL') p.set('branchId', branchFilter);
    if (taxRateFilter && taxRateFilter !== 'ALL') p.set('taxRate', taxRateFilter);
    if (categoryFilter && categoryFilter !== 'ALL') p.set('categoryId', categoryFilter);
    if (orderSourceFilter && orderSourceFilter !== 'ALL') p.set('orderSource', orderSourceFilter);
    if (paymentMethodFilter && paymentMethodFilter !== 'ALL') p.set('paymentMethod', paymentMethodFilter);
    if (searchTerm.trim()) p.set('search', searchTerm.trim());
    if (warningOnly) p.set('hasWarning', 'true');
    return p.toString();
  }, [
    fromDate,
    toDate,
    branchFilter,
    taxRateFilter,
    categoryFilter,
    orderSourceFilter,
    paymentMethodFilter,
    searchTerm,
    warningOnly,
  ]);

  // Load Overview Data
  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/tax/overview?${queryParamsString}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setOverviewData(json.data);
      }
    } catch (err) {
      console.error('Error fetching tax overview:', err);
    } finally {
      setLoading(false);
    }
  }, [queryParamsString]);

  // Load Tab Specific Data
  const loadTabData = useCallback(async () => {
    try {
      if (activeTab === 'rates') {
        const res = await fetch(`/api/admin/reports/tax/rates?${queryParamsString}`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) setRatesData(json.data.rates || []);
      } else if (activeTab === 'branches') {
        const res = await fetch(`/api/admin/reports/tax/branches?${queryParamsString}`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) setBranchesData(json.data.branches || []);
      } else if (activeTab === 'categories') {
        const res = await fetch(`/api/admin/reports/tax/categories?${queryParamsString}`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) setCategoriesData(json.data.categories || []);
      } else if (activeTab === 'products') {
        const res = await fetch(`/api/admin/reports/tax/products?${queryParamsString}`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) setProductsData(json.data.products || []);
      } else if (activeTab === 'reconciliation') {
        const res = await fetch(`/api/admin/reports/tax/reconciliation?${queryParamsString}`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) setReconciliationData(json.data || null);
      }
    } catch (err) {
      console.error(`Error loading tab ${activeTab}:`, err);
    }
  }, [activeTab, queryParamsString]);

  // Load Transactions (paginated)
  const loadTransactions = useCallback(
    async (page = 1) => {
      setTxLoading(true);
      try {
        const p = new URLSearchParams(queryParamsString);
        p.set('page', page.toString());
        p.set('limit', '20');
        const res = await fetch(`/api/admin/reports/tax/transactions?${p.toString()}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success) {
          setTxData(json.data.items || []);
          setTxPagination(json.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
        }
      } catch (err) {
        console.error('Error loading tax transactions:', err);
      } finally {
        setTxLoading(false);
      }
    },
    [queryParamsString],
  );

  // Initial and trigger load
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTransactions(1);
    } else if (activeTab !== 'overview') {
      loadTabData();
    }
  }, [activeTab, loadTabData, loadTransactions]);

  // Open Breakdown Modal for an Order
  const handleOpenBreakdownModal = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
    setModalLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/tax/breakdown/${orderId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setModalData(json.data.order);
      } else {
        alert(json.error?.message || 'Không thể tải chi tiết thuế của đơn hàng.');
      }
    } catch (err) {
      console.error('Error fetching tax breakdown:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Export Excel 9 Sheets
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/reports/tax/export?${queryParamsString}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_BaoCaoThue_VAT_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Xuất file Excel thất bại. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  const formatVND = (n: number | undefined | null) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
  };

  const formatNumber = (n: number | undefined | null) => {
    return new Intl.NumberFormat('vi-VN').format(n || 0);
  };

  const kpis: any = overviewData?.kpis;
  const ratesSummary: any[] = overviewData?.rates || [];
  const trendsData: any[] = overviewData?.dailyTrends || [];

  // Pie Chart Data: VAT by Rate
  const pieData = useMemo(() => {
    if (!kpis) return [];
    return [
      { name: 'VAT 8%', value: kpis.vat8Amount, color: '#800020' },
      { name: 'VAT 10%', value: kpis.vat10Amount, color: '#2563eb' },
      { name: 'VAT 5%', value: kpis.vat5Amount, color: '#16a34a' },
      { name: 'VAT 0%', value: kpis.vat0Amount, color: '#94a3b8' },
      ...(kpis.vatOtherAmount > 0
        ? [{ name: 'VAT Khác', value: kpis.vatOtherAmount, color: '#d97706' }]
        : []),
    ].filter((item) => item.value > 0);
  }, [kpis]);

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-8 sm:pb-12 admin-page-wrapper">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-[#800020]/10 text-[#800020] rounded-xl shrink-0">
              <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight font-serif">
                  Báo Cáo Thuế / VAT AVORA
                </h1>
                <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold bg-[#800020] text-white rounded-full uppercase tracking-wider shadow-2xs">
                  Zero-Tolerance
                </span>
              </div>
              <p className="text-[11px] sm:text-xs md:text-sm text-slate-500 mt-0.5">
                Hệ thống báo cáo & đối soát thuế chuyên sâu, minh bạch nguồn gốc từng đồng thuế VAT.
              </p>
            </div>
          </div>
        </div>

        {/* COMPLETED ONLY MANDATORY BADGE & ACTIONS */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-50 border border-emerald-200/80 rounded-lg sm:rounded-xl text-emerald-800 text-[11px] sm:text-xs font-bold shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            <span>COMPLETED ONLY</span>
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting || loading}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#800020] hover:bg-[#6b001a] text-white font-bold text-xs rounded-lg sm:rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 min-h-[38px]"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>{exporting ? 'Đang xuất...' : 'Xuất Excel (9 Sheets)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="bg-white p-2.5 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5 sm:space-y-4">
        {/* Date presets & Branch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-none whitespace-nowrap w-full sm:w-auto">
            {(
              [
                { id: 'today', label: 'Hôm nay' },
                { id: '7days', label: '7 ngày' },
                { id: '30days', label: '30 ngày' },
                { id: 'thisMonth', label: 'Tháng này' },
                { id: 'thisQuarter', label: 'Quý này' },
                { id: 'thisYear', label: 'Năm nay' },
                { id: 'custom', label: 'Tùy chỉnh' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 min-h-[32px] ${
                  datePreset === p.id
                    ? 'bg-white text-[#800020] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Branch selector */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Store className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full sm:w-auto px-2.5 sm:px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#800020]/20 min-h-[36px]"
            >
              <option value="ALL">Tất cả chi nhánh hệ thống</option>
              {metadata?.branches?.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom date range if custom is selected */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 p-2 sm:p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">Từ:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs min-h-[34px]"
            />
            <span className="font-semibold text-slate-600">Đến:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs min-h-[34px]"
            />
          </div>
        )}

        {/* Secondary filters row */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Tax Rate Filter */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="text-slate-500 font-medium text-[11px] sm:text-xs">VAT:</span>
            <select
              value={taxRateFilter}
              onChange={(e) => setTaxRateFilter(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs min-h-[36px]"
            >
              <option value="ALL">Tất cả</option>
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="8">8%</option>
              <option value="10">10%</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="text-slate-500 font-medium text-[11px] sm:text-xs">Mục:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs truncate min-h-[36px]"
            >
              <option value="ALL">Tất cả</option>
              {metadata?.categories?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="relative col-span-2 sm:flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm mã đơn, tên món..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#800020] min-h-[36px]"
            />
          </div>

          {/* Warning Only Toggle & Refresh */}
          <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:justify-start gap-2 ml-auto">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={warningOnly}
                onChange={(e) => setWarningOnly(e.target.checked)}
                className="rounded text-[#800020] focus:ring-[#800020] w-3.5 h-3.5"
              />
              <span className="text-amber-800 font-semibold flex items-center gap-1 text-[11px] sm:text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Cảnh báo
              </span>
            </label>

            <button
              onClick={loadOverview}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center border border-slate-200"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#800020]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {/* Card 1: Completed Orders */}
        <div className="bg-white p-2.5 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Đơn Hoàn Thành</span>
            <div className="p-1 sm:p-2 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
            {loading ? <div className="h-6 sm:h-8 w-20 bg-slate-200 animate-pulse rounded-lg" /> : formatNumber(kpis?.completedOrders)}
          </div>
          <div className="flex items-center justify-between mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-slate-100 text-[10px] sm:text-xs text-slate-500 truncate">
            <span>Dòng món:</span>
            <span className="font-bold text-slate-700 truncate">{formatNumber(kpis?.completedOrderItems)}</span>
          </div>
        </div>

        {/* Card 2: Taxable Revenue */}
        <div className="bg-white p-2.5 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Doanh Thu Tính Thuế</span>
            <div className="p-1 sm:p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
            {loading ? <div className="h-6 sm:h-8 w-24 bg-slate-200 animate-pulse rounded-lg" /> : formatVND(kpis?.taxableRevenue)}
          </div>
          <div className="flex items-center justify-between mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-slate-100 text-[10px] sm:text-xs text-slate-500 truncate">
            <span>Gộp:</span>
            <span className="font-bold text-slate-700 truncate">{formatVND(kpis?.grossSales)}</span>
          </div>
        </div>

        {/* Card 3: Total VAT & Refunded */}
        <div className="bg-white p-2.5 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Tổng Thuế VAT</span>
            <div className="p-1 sm:p-2 bg-[#800020]/10 text-[#800020] rounded-lg shrink-0">
              <Percent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-xl lg:text-2xl font-black text-[#800020] tracking-tight truncate">
            {loading ? <div className="h-6 sm:h-8 w-24 bg-slate-200 animate-pulse rounded-lg" /> : formatVND(kpis?.totalVat)}
          </div>
          <div className="flex items-center justify-between mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-slate-100 text-[10px] sm:text-xs text-slate-500 truncate">
            <span>Hoàn:</span>
            <span className="font-bold text-rose-600 truncate">-{formatVND(kpis?.vatRefunded)}</span>
          </div>
        </div>

        {/* Card 4: Net VAT */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-2.5 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-300 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">VAT Thực Nộp (Net)</span>
            <div className="p-1 sm:p-2 bg-white/10 text-emerald-400 rounded-lg shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-xl lg:text-2xl font-black text-white tracking-tight truncate">
            {loading ? <div className="h-6 sm:h-8 w-24 bg-slate-700 animate-pulse rounded-lg" /> : formatVND(kpis?.netVat)}
          </div>
          <div className="flex items-center justify-between mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-slate-700/60 text-[10px] sm:text-xs text-slate-400 truncate">
            <span>TB/Đơn:</span>
            <span className="font-bold text-emerald-400 truncate">{formatVND(kpis?.averageVatPerCompletedOrder)}</span>
          </div>
        </div>
      </div>

      {/* 4. Rates Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase truncate">Thuế VAT 8%</div>
          <div className="text-xs sm:text-sm md:text-base font-black text-slate-900 mt-0.5 truncate">
            {formatVND(kpis?.vat8Amount)}
          </div>
          <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Mức ưu đãi Nghị định</div>
        </div>

        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase truncate">Thuế VAT 10%</div>
          <div className="text-xs sm:text-sm md:text-base font-black text-slate-900 mt-0.5 truncate">
            {formatVND(kpis?.vat10Amount)}
          </div>
          <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Thuế suất tiêu chuẩn</div>
        </div>

        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase truncate">Thuế VAT 5%</div>
          <div className="text-xs sm:text-sm md:text-base font-black text-slate-900 mt-0.5 truncate">
            {formatVND(kpis?.vat5Amount)}
          </div>
          <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Sơ chế/nông sản</div>
        </div>

        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase truncate">Thuế VAT 0%</div>
          <div className="text-xs sm:text-sm md:text-base font-black text-slate-900 mt-0.5 truncate">
            {formatVND(kpis?.vat0Amount)}
          </div>
          <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
            DThu 0%: {formatVND(kpis?.nonTaxableRevenue)}
          </div>
        </div>
      </div>

      {/* 5. Tab Navigation */}
      <div className="border-b border-slate-200 bg-white px-2 sm:px-4 rounded-t-xl sm:rounded-t-2xl shadow-xs overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap py-1.5 sm:py-2 min-w-max">
          {([
            { id: 'overview', label: 'Tổng Quan & Biểu Đồ', icon: BarChart2 },
            { id: 'rates', label: 'Theo Mức Thuế (0, 5, 8, 10%)', icon: Percent },
            { id: 'branches', label: 'Theo Chi Nhánh', icon: Store },
            { id: 'categories', label: 'Theo Danh Mục', icon: Layers },
            { id: 'products', label: 'Theo Món Ăn', icon: UtensilsCrossed },
            { id: 'transactions', label: 'Chi Tiết Giao Dịch', icon: Receipt },
            {
              id: 'reconciliation',
              label: 'Đối Soát & Cảnh Báo',
              icon: ShieldAlert,
              badge: kpis?.paymentWarningCount > 0 ? kpis.paymentWarningCount : undefined,
            },
          ] as Array<{
            id: 'overview' | 'rates' | 'branches' | 'categories' | 'products' | 'transactions' | 'reconciliation';
            label: string;
            icon: any;
            badge?: number;
          }>).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-bold rounded-lg sm:rounded-xl transition-all whitespace-nowrap min-h-[40px] ${
                  active
                    ? 'bg-[#800020] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-amber-500 text-white rounded-full">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Tab Content Area */}
      <div className="bg-white p-2.5 sm:p-4 lg:p-6 rounded-b-xl sm:rounded-b-2xl border border-t-0 border-slate-200 shadow-xs">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-3 sm:space-y-6">
            {/* Visual Charts: Daily Trend & Rate Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
              {/* Daily Trend Chart (Area) */}
              <div className="lg:col-span-2 p-3 sm:p-5 bg-slate-50/50 rounded-xl sm:rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                      Xu Hướng Thuế VAT & Doanh Thu Theo Ngày Hoàn Thành
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-500">
                      Dựa trên ngày hoàn thành đơn thực tế
                    </p>
                  </div>
                </div>

                <div className="h-56 sm:h-64 w-full">
                  {trendsData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      Chưa có dữ liệu xu hướng trong khoảng thời gian đã chọn
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="taxableGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="vatGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#800020" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#800020" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="displayDate" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} tickFormatter={(val) => `${val / 1000000}M`} />
                        <RechartsTooltip
                          formatter={(val: any) => formatVND(Number(val))}
                          labelFormatter={(label) => `Ngày: ${label}`}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Area
                          type="monotone"
                          dataKey="taxableRevenue"
                          name="Doanh thu tính thuế"
                          stroke="#2563eb"
                          fillOpacity={1}
                          fill="url(#taxableGrad)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="totalVat"
                          name="Thuế VAT"
                          stroke="#800020"
                          fillOpacity={1}
                          fill="url(#vatGrad)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Pie Chart: VAT by Rate */}
              <div className="p-3 sm:p-5 bg-slate-50/50 rounded-xl sm:rounded-2xl border border-slate-200/80">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-0.5">Tỷ Trọng Thuế VAT</h3>
                <p className="text-[10px] sm:text-xs text-slate-500 mb-2">Phân bổ tiền thuế theo thuế suất</p>

                <div className="h-48 sm:h-52 w-full">
                  {pieData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      Không có phát sinh thuế
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(val: any) => formatVND(Number(val))} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="space-y-1 sm:space-y-1.5 mt-2 text-xs">
                  {pieData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] sm:text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                      <span className="font-bold text-slate-800">{formatVND(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Rates Summary Table */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">Bảng Tổng Hợp Thuế Suất</h3>
                <button
                  onClick={() => setActiveTab('rates')}
                  className="text-xs font-bold text-[#800020] hover:underline flex items-center gap-1 min-h-[32px]"
                >
                  Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="admin-scroll-table border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left min-w-[700px]">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Mức thuế suất</th>
                      <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Đơn hoàn thành</th>
                      <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Số lượng món</th>
                      <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Doanh thu tính thuế</th>
                      <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Tiền thuế VAT</th>
                      <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Tổng tiền gồm thuế</th>
                      <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế thực nộp (Net)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ratesSummary.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-900 whitespace-nowrap">{r.rateLabel}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatNumber(r.completedOrdersCount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatNumber(r.quantitySold)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(r.taxableAmount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-[#800020] whitespace-nowrap">{formatVND(r.taxAmount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(r.grossAmount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-emerald-700 whitespace-nowrap">{formatVND(r.netTaxAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RATES BREAKDOWN */}
        {activeTab === 'rates' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Chi Tiết Từng Mức Thuế Suất VAT</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Phân rã doanh thu, số món và tiền thuế theo từng mức 0%, 5%, 8%, 10%
                </p>
              </div>
            </div>

            <div className="admin-scroll-table border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left min-w-[850px]">
                <thead className="bg-[#800020] text-white font-bold">
                  <tr>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Mức Thuế Suất</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Đơn Hoàn Thành</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Số Món Bán</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Doanh Thu Tính Thuế</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế VAT Phát Sinh</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Tổng Tiền Sau Thuế</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế Hoàn Trả</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế VAT Thực Nộp</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế Suất Thực Tế</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ratesData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-400">
                        Chưa có dữ liệu phát sinh thuế
                      </td>
                    </tr>
                  ) : (
                    ratesData.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-900 whitespace-nowrap">{r.rateLabel}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatNumber(r.completedOrdersCount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatNumber(r.quantitySold)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(r.taxableAmount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-[#800020] whitespace-nowrap">{formatVND(r.taxAmount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(r.grossAmount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium text-rose-600 whitespace-nowrap">
                          {r.refundedTaxAmount > 0 ? `-${formatVND(r.refundedTaxAmount)}` : '0 ₫'}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-black text-emerald-700 whitespace-nowrap">{formatVND(r.netTaxAmount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-semibold text-slate-600 whitespace-nowrap">{r.effectiveTaxRatePercent}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: BRANCHES BREAKDOWN */}
        {activeTab === 'branches' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Báo Cáo Thuế VAT Theo Chi Nhánh</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Đảm bảo tính bất biến: Tổng thuế hệ thống = Tổng thuế các chi nhánh cộng lại
                </p>
              </div>
            </div>

            <div className="admin-scroll-table border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left min-w-[900px]">
                <thead className="bg-[#800020] text-white font-bold">
                  <tr>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Mã CN</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Tên Chi Nhánh</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Đơn Hoàn Thành</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Doanh Thu Tính Thuế</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">VAT 0%</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">VAT 5%</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">VAT 8%</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">VAT 10%</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Tổng Thuế VAT</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế VAT Ròng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {branchesData.map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-500 whitespace-nowrap">{b.branchCode || b.branchId.substring(0, 6)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-900 whitespace-nowrap">{b.branchName}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatNumber(b.completedOrders)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(b.taxableAmount)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium text-slate-500 whitespace-nowrap">{formatVND(b.vat0Amount)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium text-slate-600 whitespace-nowrap">{formatVND(b.vat5Amount)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-[#800020] whitespace-nowrap">{formatVND(b.vat8Amount)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-blue-700 whitespace-nowrap">{formatVND(b.vat10Amount)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">{formatVND(b.totalVat)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-black text-emerald-700 whitespace-nowrap">{formatVND(b.netVat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CATEGORIES BREAKDOWN */}
        {activeTab === 'categories' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Báo Cáo Thuế VAT Theo Danh Mục Món Ăn</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">Tỷ trọng đóng góp tiền thuế của từng nhóm món</p>
              </div>
            </div>

            <div className="admin-scroll-table border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left min-w-[750px]">
                <thead className="bg-[#800020] text-white font-bold">
                  <tr>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Danh Mục Món Ăn</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Đơn Hoàn Thành</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Số Lượng Bán</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Doanh Thu Món</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Doanh Thu Tính Thuế</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế VAT</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Tỷ Trọng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoriesData.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-900 whitespace-nowrap">{c.categoryName}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatNumber(c.completedOrdersCount)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatNumber(c.quantitySold)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(c.grossRevenue)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(c.taxableAmount)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-[#800020] whitespace-nowrap">{formatVND(c.vatAmount)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-slate-700 whitespace-nowrap">{c.contributionPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: PRODUCTS BREAKDOWN */}
        {activeTab === 'products' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Báo Cáo Thuế VAT Theo Từng Sản Phẩm / Món Ăn</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">Chỉ tính món trong các đơn hoàn thành</p>
              </div>
            </div>

            <div className="admin-scroll-table border border-slate-200 rounded-xl max-h-[600px]">
              <table className="w-full text-xs text-left min-w-[850px]">
                <thead className="bg-[#800020] text-white font-bold sticky top-0">
                  <tr>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Mã Món</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Tên Món Ăn</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Danh Mục</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Số Lượng</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Đơn Giá TB</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế Suất</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Doanh Thu Tính Thuế</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế VAT</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế VAT Ròng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productsData.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-500 whitespace-nowrap">{p.itemCode || p.productId.substring(0, 6)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-900 whitespace-nowrap">{p.productName}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-slate-600 whitespace-nowrap">{p.categoryName}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatNumber(p.quantitySold)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(p.averageSalePrice)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-slate-700 whitespace-nowrap">{p.taxPercentage}%</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(p.taxableAmount)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-[#800020] whitespace-nowrap">{formatVND(p.vatAmount)}</td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-black text-emerald-700 whitespace-nowrap">{formatVND(p.netVatAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: TRANSACTIONS (DRILL-DOWN ITEMS) */}
        {activeTab === 'transactions' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Chi Tiết Giao Dịch Từng Dòng Món Ăn</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Bảng đối soát chi tiết từng món. Bấm vào nút xem để tra cứu nguồn gốc từng đồng thuế.
                </p>
              </div>
            </div>

            <div className="admin-scroll-table border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left min-w-[900px]">
                <thead className="bg-[#800020] text-white font-bold">
                  <tr>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Mã Đơn</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Thời Điểm Hoàn Thành</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Chi Nhánh</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Món Ăn</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">SL</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Đơn Giá</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Topping</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Voucher</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Mức VAT</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Tính Thuế</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Tiền Thuế</th>
                    <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txLoading ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-400">
                        Đang tải danh sách giao dịch...
                      </td>
                    </tr>
                  ) : txData.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-400">
                        Không có giao dịch nào khớp với bộ lọc
                      </td>
                    </tr>
                  ) : (
                    txData.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-900 whitespace-nowrap">{it.orderCode}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-slate-500 whitespace-nowrap">
                          {new Date(it.completionTimestamp).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-slate-700 whitespace-nowrap">{it.branchName}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-800 whitespace-nowrap">
                          <div>{it.productName}</div>
                          <span className="text-[10px] text-slate-400 font-normal">{it.categoryName}</span>
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{it.quantity}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right whitespace-nowrap">{formatVND(it.unitPriceAtSale)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-slate-600 whitespace-nowrap">
                          {it.optionAmount > 0 ? formatVND(it.optionAmount) : '-'}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium text-rose-600 whitespace-nowrap">
                          {it.allocatedVoucherDiscount > 0 ? `-${formatVND(it.allocatedVoucherDiscount)}` : '-'}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-slate-700 whitespace-nowrap">{it.taxPercentage}%</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(it.taxableAmount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-[#800020] whitespace-nowrap">{formatVND(it.taxAmount)}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleOpenBreakdownModal(it.orderId)}
                            className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-[#800020] hover:text-white rounded-lg transition-colors inline-flex items-center gap-1 min-h-[30px]"
                          >
                            <Eye className="w-3 h-3" /> Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {txPagination.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between text-xs pt-2 gap-2">
                <span className="text-slate-500">
                  Trang {txPagination.page} / {txPagination.totalPages} ({txPagination.total} món)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={txPagination.page <= 1 || txLoading}
                    onClick={() => loadTransactions(txPagination.page - 1)}
                    className="px-2.5 py-1 bg-slate-100 rounded-lg font-bold hover:bg-slate-200 disabled:opacity-40 min-h-[32px]"
                  >
                    Trước
                  </button>
                  <button
                    disabled={txPagination.page >= txPagination.totalPages || txLoading}
                    onClick={() => loadTransactions(txPagination.page + 1)}
                    className="px-2.5 py-1 bg-slate-100 rounded-lg font-bold hover:bg-slate-200 disabled:opacity-40 min-h-[32px]"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: RECONCILIATION */}
        {activeTab === 'reconciliation' && (
          <div className="space-y-3 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Báo Cáo Đối Soát Toán Học & Cảnh Báo Thuế</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Kiểm tra 5 bất biến toán học: Sai lệch dù 1 đồng cũng được phát hiện và truy vết
                </p>
              </div>
            </div>

            {/* Health summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <div className="p-2.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase truncate block">Đã Kiểm Tra</span>
                <div className="text-sm sm:text-xl font-black text-slate-900 mt-0.5 sm:mt-1 truncate">
                  {formatNumber(reconciliationData?.summary?.totalCompletedOrdersChecked)}
                </div>
              </div>

              <div className="p-2.5 sm:p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] sm:text-xs text-emerald-800 font-bold uppercase truncate block">Khớp Tuyệt Đối</span>
                <div className="text-sm sm:text-xl font-black text-emerald-700 mt-0.5 sm:mt-1 truncate">
                  {formatNumber(reconciliationData?.summary?.reconciledOrdersCount)}
                </div>
                <div className="text-[9px] sm:text-[10px] text-emerald-600 mt-0.5 truncate">
                  Tỷ lệ: {reconciliationData?.summary?.reconciliationRatePercent}%
                </div>
              </div>

              <div className="p-2.5 sm:p-4 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[10px] sm:text-xs text-rose-800 font-bold uppercase truncate block">Lệch Tiền Đối Soát</span>
                <div className="text-sm sm:text-xl font-black text-rose-700 mt-0.5 sm:mt-1 truncate">
                  {formatNumber(reconciliationData?.summary?.errorOrdersCount)}
                </div>
                <div className="text-[9px] sm:text-[10px] text-rose-600 mt-0.5 truncate">LỖI ĐỐI SOÁT</div>
              </div>

              <div className="p-2.5 sm:p-4 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[10px] sm:text-xs text-amber-800 font-bold uppercase truncate block">Cảnh Báo Thanh Toán</span>
                <div className="text-sm sm:text-xl font-black text-amber-700 mt-0.5 sm:mt-1 truncate">
                  {formatNumber(reconciliationData?.summary?.warningOrdersCount)}
                </div>
                <div className="text-[9px] sm:text-[10px] text-amber-600 mt-0.5 truncate">CẢNH BÁO TT</div>
              </div>
            </div>

            {/* List of Warning Orders */}
            <div className="space-y-2 sm:space-y-3">
              <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Danh Sách Đơn Hoàn Thành Có Cảnh Báo</span>
              </h4>

              {reconciliationData?.warnings?.length === 0 ? (
                <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                  Không có đơn hàng nào phát sinh cảnh báo bất thường thanh toán.
                </div>
              ) : (
                <div className="admin-scroll-table border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left min-w-[700px]">
                    <thead className="bg-amber-100/70 text-amber-900 font-bold">
                      <tr>
                        <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Mã Đơn</th>
                        <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Chi Nhánh</th>
                        <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Trạng Thái TT</th>
                        <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Tổng Tiền</th>
                        <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Đã Thu</th>
                        <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Ghi Chú Cảnh Báo</th>
                        <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-center">Tra Cứu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reconciliationData?.warnings?.map((w: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-900 whitespace-nowrap">{w.orderCode}</td>
                          <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-slate-700 whitespace-nowrap">{w.branchName}</td>
                          <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-amber-800 whitespace-nowrap">{w.paymentStatus}</td>
                          <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(w.storedTotalAmount)}</td>
                          <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(w.collectedRevenue)}</td>
                          <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-slate-600 whitespace-nowrap">{w.notes?.join('; ')}</td>
                          <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleOpenBreakdownModal(w.orderId)}
                              className="px-2 py-1 text-[11px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-200 rounded-lg transition-colors min-h-[30px]"
                            >
                              Xem đơn
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 7. Single Order VAT Breakdown Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[96vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 sm:p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-[#800020]/10 text-[#800020] rounded-lg shrink-0">
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-base font-bold text-slate-900">
                    Bóc Tách Thuế VAT: Đơn {modalData?.orderCode || selectedOrderId}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-500">
                    Chi tiết từng thành phần: Giá gốc → Option → Voucher → Thuế
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-6 text-xs">
              {modalLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#800020] mx-auto mb-2" />
                  Đang tính toán và xác thực đối soát đơn hàng...
                </div>
              ) : modalData ? (
                <>
                  {/* Order Overview Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-slate-50 p-2.5 sm:p-4 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-slate-400 font-medium truncate block">Chi nhánh:</span>
                      <div className="font-bold text-slate-800 truncate">{modalData.branchName}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium truncate block">Hoàn thành:</span>
                      <div className="font-bold text-slate-800 truncate">
                        {new Date(modalData.completionTimestamp).toLocaleString('vi-VN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium truncate block">Thanh toán:</span>
                      <div className="font-bold text-emerald-700 truncate">
                        {modalData.paymentMethod} ({modalData.paymentStatus})
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium truncate block">Chế độ thuế:</span>
                      <div className="font-bold text-slate-800 truncate">{modalData.vatPriceMode}</div>
                    </div>
                  </div>

                  {/* Items Breakdown Table */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <h4 className="font-bold text-slate-800 text-[11px] sm:text-xs">Chi tiết từng dòng món ăn (Order Items)</h4>
                    <div className="admin-scroll-table border border-slate-200 rounded-xl">
                      <table className="w-full text-xs text-left min-w-[700px]">
                        <thead className="bg-slate-100 text-slate-700 font-bold">
                          <tr>
                            <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Tên Món</th>
                            <th className="px-2 py-2 sm:px-2.5 sm:py-2.5 text-right">SL</th>
                            <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Đơn Giá</th>
                            <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Topping</th>
                            <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Giảm Món</th>
                            <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Voucher</th>
                            <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Sau Giảm</th>
                            <th className="px-2 py-2 sm:px-2.5 sm:py-2.5 text-right">Mức VAT</th>
                            <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Tính Thuế</th>
                            <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Thuế VAT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {modalData.items?.map((it: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-900 whitespace-nowrap">{it.productName}</td>
                              <td className="px-2 py-2 sm:px-2.5 sm:py-2.5 text-right font-medium whitespace-nowrap">{it.quantity}</td>
                              <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right whitespace-nowrap">{formatVND(it.unitPriceAtSale)}</td>
                              <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-slate-600 whitespace-nowrap">
                                {it.totalOptionAmount > 0 ? formatVND(it.totalOptionAmount) : '-'}
                              </td>
                              <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-rose-600 whitespace-nowrap">
                                {it.totalDirectDiscount > 0 ? `-${formatVND(it.totalDirectDiscount)}` : '-'}
                              </td>
                              <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-rose-600 whitespace-nowrap">
                                {it.allocatedOrderDiscount > 0 ? `-${formatVND(it.allocatedOrderDiscount)}` : '-'}
                              </td>
                              <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                {formatVND(it.netAmountAfterDiscount)}
                              </td>
                              <td className="px-2 py-2 sm:px-2.5 sm:py-2.5 text-right font-bold text-slate-700 whitespace-nowrap">{it.taxPercentage}%</td>
                              <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">{formatVND(it.taxableAmount)}</td>
                              <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-black text-[#800020] whitespace-nowrap">{formatVND(it.taxAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary Totals & Mathematical Invariants */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                    <div className="p-2.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1 sm:space-y-1.5 text-[11px] sm:text-xs">
                      <h5 className="font-bold text-slate-800 mb-1.5">Tổng Hợp Tài Chính Đơn Hàng</h5>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tiền món (Gross):</span>
                        <span className="font-bold">{formatVND(modalData.grossItemAmount)}</span>
                      </div>
                      <div className="flex justify-between text-rose-600">
                        <span>Giảm giá & Voucher:</span>
                        <span className="font-bold">-{formatVND(modalData.totalItemDiscount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Phụ phí dịch vụ:</span>
                        <span className="font-bold">{formatVND(modalData.serviceChargeTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Phí giao hàng:</span>
                        <span className="font-bold">{formatVND(modalData.shippingFeeCustomerPaid)}</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-slate-200 text-xs sm:text-sm font-black text-slate-900">
                        <span>Tổng thanh toán:</span>
                        <span>{formatVND(modalData.orderTotalAmount)}</span>
                      </div>
                    </div>

                    <div className="p-2.5 sm:p-4 bg-[#800020]/5 rounded-xl border border-[#800020]/20 space-y-1 sm:space-y-1.5 text-[11px] sm:text-xs">
                      <h5 className="font-bold text-[#800020] mb-1.5 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>Kết Quả Đối Soát Thuế</span>
                      </h5>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Doanh thu tính thuế:</span>
                        <span className="font-bold">{formatVND(modalData.taxableRevenueBeforeVat)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Tổng thuế VAT:</span>
                        <span className="font-black text-[#800020]">{formatVND(modalData.vatTotalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold pt-1">
                        <span>Trạng thái Invariant:</span>
                        <span>{modalData.reconciliation?.isReconciled ? 'KHỚP 100%' : 'SAI LỆCH'}</span>
                      </div>
                      {modalData.reconciliation?.notes?.length > 0 && (
                        <div className="pt-1.5 text-[10px] sm:text-[11px] text-slate-600">
                          {modalData.reconciliation.notes.map((note: string, i: number) => (
                            <div key={i}>• {note}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end p-2.5 sm:p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-slate-200 hover:bg-slate-300 font-bold rounded-lg sm:rounded-xl text-slate-700 transition-colors text-xs min-h-[36px]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
