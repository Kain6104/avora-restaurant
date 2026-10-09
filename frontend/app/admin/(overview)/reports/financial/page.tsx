'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DollarSign,
  TrendingUp,
  Download,
  RefreshCw,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  ShoppingBag,
  Percent,
  Truck,
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
  CreditCard,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  X,
  Building2,
  SlidersHorizontal,
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
import { AdminCard, PageHeader, LoadingSkeleton } from '@/app/admin/components/ui';

// Palette màu AVORA
const BRAND_PRIMARY = '#800020'; // Burgundy
const BRAND_SECONDARY = '#B91C1C'; // Red
const BRAND_DARK = '#1E293B'; // Slate 800

const CHART_COLORS = [
  '#800020', // Burgundy (Brand)
  '#2563eb', // Blue
  '#16a34a', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#475569', // Slate
  '#db2777', // Pink
  '#dc2626', // Red
];

export default function AdminFinancialReportsPage() {
  const router = useRouter();
  const { selectedBranchId } = useAdmin();
  const { t, locale } = useLanguage();

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'transactions'>('overview');
  const [overviewData, setOverviewData] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);

  // Transactions pagination & data
  const [txData, setTxData] = useState<any[]>([]);
  const [txPagination, setTxPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [txLoading, setTxLoading] = useState(false);

  // Modal inspection state
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter States
  const [datePreset, setDatePreset] = useState<string>('30days');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [fromHour, setFromHour] = useState<string>('0');
  const [toHour, setToHour] = useState<string>('23');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>('ALL');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [taxRateFilter, setTaxRateFilter] = useState<string>('ALL');
  const [vatModeFilter, setVatModeFilter] = useState<string>('ALL');
  const [hasVoucherFilter, setHasVoucherFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState<boolean>(false);

  // Đồng bộ selectedBranchId từ AdminContext
  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL') {
      setBranchFilter(selectedBranchId);
    }
  }, [selectedBranchId]);

  // Format VND
  const formatMoney = useCallback(
    (amount: number = 0) => {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(amount);
    },
    [],
  );

  // Fetch Filter Metadata
  useEffect(() => {
    fetch('/api/admin/reports/financial/metadata/filters', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setMetadata(json.data);
      })
      .catch((err) => console.error('Error fetching financial metadata:', err));
  }, []);

  // Xây dựng Query Params
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDate) p.append('from', fromDate);
    if (toDate) p.append('to', toDate);
    if (fromHour !== '0') p.append('fromHour', fromHour);
    if (toHour !== '23') p.append('toHour', toHour);
    if (branchFilter && branchFilter !== 'ALL') p.append('branchId', branchFilter);
    if (orderSourceFilter && orderSourceFilter !== 'ALL') p.append('orderSource', orderSourceFilter);
    if (orderTypeFilter && orderTypeFilter !== 'ALL') p.append('orderType', orderTypeFilter);
    if (orderStatusFilter && orderStatusFilter !== 'ALL') p.append('orderStatus', orderStatusFilter);
    if (paymentStatusFilter && paymentStatusFilter !== 'ALL') p.append('paymentStatus', paymentStatusFilter);
    if (paymentMethodFilter && paymentMethodFilter !== 'ALL') p.append('paymentMethod', paymentMethodFilter);
    if (taxRateFilter && taxRateFilter !== 'ALL') p.append('taxRate', taxRateFilter);
    if (vatModeFilter && vatModeFilter !== 'ALL') p.append('vatPriceMode', vatModeFilter);
    if (hasVoucherFilter !== 'ALL') p.append('hasVoucher', hasVoucherFilter);
    if (searchTerm.trim()) p.append('search', searchTerm.trim());
    return p;
  }, [
    fromDate,
    toDate,
    fromHour,
    toHour,
    branchFilter,
    orderSourceFilter,
    orderTypeFilter,
    orderStatusFilter,
    paymentStatusFilter,
    paymentMethodFilter,
    taxRateFilter,
    vatModeFilter,
    hasVoucherFilter,
    searchTerm,
  ]);

  // Fetch Overview Data
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/financial/overview?${queryParams.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setOverviewData(json.data);
      }
    } catch (err) {
      console.error('Error fetching financial overview:', err);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  // Fetch Transactions Data
  const fetchTransactions = useCallback(
    async (page = 1, limit = 20) => {
      setTxLoading(true);
      try {
        const p = new URLSearchParams(queryParams.toString());
        p.append('page', page.toString());
        p.append('limit', limit.toString());
        p.append('sortBy', 'createdAt');
        p.append('sortOrder', 'desc');

        const res = await fetch(`/api/admin/reports/financial/transactions?${p.toString()}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success) {
          setTxData(json.data.orders);
          setTxPagination(json.data.pagination);
        }
      } catch (err) {
        console.error('Error fetching financial transactions:', err);
      } finally {
        setTxLoading(false);
      }
    },
    [queryParams],
  );

  useEffect(() => {
    fetchOverview();
    if (activeTab === 'transactions') {
      fetchTransactions(1, txPagination.limit);
    }
  }, [fetchOverview, activeTab]);

  // Thay đổi Date Preset
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setFromDate(d.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFromDate(d.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(firstDay.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === 'lastMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(firstDay.toISOString().split('T')[0]);
      setToDate(lastDay.toISOString().split('T')[0]);
    } else if (preset === 'thisQuarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const firstDay = new Date(now.getFullYear(), qMonth, 1);
      setFromDate(firstDay.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === 'thisYear') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      setFromDate(firstDay.toISOString().split('T')[0]);
      setToDate(todayStr);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    handlePresetChange('30days');
    setFromHour('0');
    setToHour('23');
    setBranchFilter('ALL');
    setOrderSourceFilter('ALL');
    setOrderTypeFilter('ALL');
    setOrderStatusFilter('ALL');
    setPaymentStatusFilter('ALL');
    setPaymentMethodFilter('ALL');
    setTaxRateFilter('ALL');
    setVatModeFilter('ALL');
    setHasVoucherFilter('ALL');
    setSearchTerm('');
  };

  // Export Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/reports/financial/export?${queryParams.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Không thể xuất file Excel.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_BaoCaoTaiChinh_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải file báo cáo tài chính');
    } finally {
      setExporting(false);
    }
  };

  // Open Order Drill-down Modal
  const handleOpenInspection = async (orderId: string) => {
    setIsModalOpen(true);
    setModalLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/financial/transactions/${orderId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setSelectedOrder(json.data);
      }
    } catch (err) {
      console.error('Error fetching order inspection detail:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const summary = overviewData?.summary;
  const branchBreakdown = overviewData?.branchBreakdown || [];
  const paymentBreakdown = overviewData?.paymentBreakdown || [];
  const vatBreakdown = overviewData?.vatBreakdown || [];
  const discountBreakdown = overviewData?.discountBreakdown || {};
  const dailyTrend = overviewData?.dailyTrend || [];

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-8 sm:pb-12 admin-page-wrapper">
      {/* Header */}
      <PageHeader
        title="Báo Cáo Tài Chính & Đối Soát Doanh Thu"
        subtitle="Hệ thống đối soát tài chính siêu chi tiết: chuẩn số nguyên VND, đối soát 4 Invariants, phân rã VAT và quản lý dòng tiền đa chi nhánh"
        breadcrumbs={[
          { label: 'Tổng quan', href: '/admin' },
          { label: 'Báo cáo', href: '/admin/reports' },
          { label: 'Báo cáo tài chính' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                fetchOverview();
                if (activeTab === 'transactions') fetchTransactions(txPagination.page, txPagination.limit);
              }}
              disabled={loading}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 min-h-[38px]"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden xs:inline">Làm mới</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exporting || loading}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white bg-[#800020] hover:bg-[#660019] rounded-lg transition shadow-2xs disabled:opacity-50 min-h-[38px]"
            >
              <FileSpreadsheet size={14} />
              <span>{exporting ? 'Đang xuất...' : 'Xuất Excel 8 Sheets'}</span>
            </button>
          </div>
        }
      />

      {/* Reconciliation Health Banner */}
      {summary && (
        <div
          className={`p-2.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 shadow-2xs transition-all ${
            summary.reconciliationHealth.unreconciledOrdersCount === 0
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            {summary.reconciliationHealth.unreconciledOrdersCount === 0 ? (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 size={18} strokeWidth={2.5} />
              </div>
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 animate-pulse">
                <ShieldAlert size={18} strokeWidth={2.5} />
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-xs sm:text-sm font-bold">
                  {summary.reconciliationHealth.unreconciledOrdersCount === 0
                    ? '100% Khớp Đối Soát Toán Học'
                    : `CẢNH BÁO: Phát hiện ${summary.reconciliationHealth.unreconciledOrdersCount} đơn hàng lệch!`}
                </span>
                <span
                  className={`text-[10px] sm:text-[11px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full ${
                    summary.reconciliationHealth.unreconciledOrdersCount === 0
                      ? 'bg-emerald-200 text-emerald-800'
                      : 'bg-rose-200 text-rose-800'
                  }`}
                >
                  Độ khớp {summary.reconciliationHealth.reconciliationRatePercent}%
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
                {summary.reconciliationHealth.unreconciledOrdersCount === 0
                  ? `Đã kiểm tra đối soát toàn diện ${summary.reconciliationHealth.totalCheckedOrders.toLocaleString('vi-VN')} đơn hàng. Mọi công thức và dòng tiền đều cân bằng chính xác từng đồng.`
                  : `Tổng giá trị sai lệch: ${formatMoney(summary.reconciliationHealth.totalDiscrepancyAmount)}. Vui lòng xem tab "Đối soát giao dịch" để kiểm tra.`}
              </p>
            </div>
          </div>
          {summary.reconciliationHealth.unreconciledOrdersCount > 0 && (
            <button
              onClick={() => setActiveTab('transactions')}
              className="px-2.5 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition shadow-2xs whitespace-nowrap self-end sm:self-auto min-h-[36px]"
            >
              Xem danh sách đơn lệch
            </button>
          )}
        </div>
      )}
      {/* FILTER TOOLBAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-2.5 sm:p-4 shadow-2xs space-y-2 sm:space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5 whitespace-nowrap w-full sm:w-auto">
            {[
              { id: 'today', label: 'Hôm nay' },
              { id: 'yesterday', label: 'Hôm qua' },
              { id: '7days', label: '7 ngày' },
              { id: '30days', label: '30 ngày' },
              { id: 'thisMonth', label: 'Tháng này' },
              { id: 'lastMonth', label: 'Tháng trước' },
              { id: 'thisQuarter', label: 'Quý này' },
              { id: 'thisYear', label: 'Năm nay' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition shrink-0 min-h-[32px] ${
                  datePreset === p.id
                    ? 'bg-[#800020] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Toggle Advanced Filters & Reset */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <button
              onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition min-h-[34px] ${
                isAdvancedFilterOpen
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Nâng cao</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${isAdvancedFilterOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <button
              onClick={handleResetFilters}
              title="Đặt lại tất cả bộ lọc"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition min-h-[34px] min-w-[34px] flex items-center justify-center border border-slate-200"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Primary Filter Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 pt-1">
          {/* Branch Filter */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 mb-0.5 sm:mb-1">
              Chi Nhánh
            </label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 sm:px-2.5 py-1.5 sm:py-2 text-slate-800 font-medium focus:ring-1 focus:ring-[#800020] focus:border-[#800020] min-h-[38px]"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {metadata?.branches?.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.branchCode})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Custom */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 mb-0.5 sm:mb-1">
              Từ Ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setDatePreset('custom');
              }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 sm:px-2.5 py-1.5 sm:py-2 text-slate-800 font-medium focus:ring-1 focus:ring-[#800020] min-h-[38px]"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 mb-0.5 sm:mb-1">
              Đến Ngày
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setDatePreset('custom');
              }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 sm:px-2.5 py-1.5 sm:py-2 text-slate-800 font-medium focus:ring-1 focus:ring-[#800020] min-h-[38px]"
            />
          </div>

          {/* Search Box */}
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 mb-0.5 sm:mb-1">
              Tìm Kiếm Giao Dịch
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 sm:top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Mã đơn, SĐT, tên khách..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 sm:py-2 text-slate-800 font-medium focus:ring-1 focus:ring-[#800020] min-h-[38px]"
              />
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {isAdvancedFilterOpen && (
          <div className="pt-2.5 sm:pt-3 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3 animate-in fade-in duration-200">
            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 mb-1">Khung Giờ</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={fromHour}
                  onChange={(e) => setFromHour(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-center min-h-[34px]"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={toHour}
                  onChange={(e) => setToHour(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-center min-h-[34px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 mb-1">Trạng Thái Đơn</label>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 min-h-[34px]"
              >
                {metadata?.orderStatuses?.map((s: any) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 mb-1">Trạng Thái TT</label>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 min-h-[34px]"
              >
                {metadata?.paymentStatuses?.map((s: any) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 mb-1">Phương Thức TT</label>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 min-h-[34px]"
              >
                <option value="ALL">Tất cả phương thức</option>
                {metadata?.paymentMethods?.map((p: any) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 mb-1">Nguồn Đơn</label>
              <select
                value={orderSourceFilter}
                onChange={(e) => setOrderSourceFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 min-h-[34px]"
              >
                {metadata?.orderSources?.map((s: any) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 mb-1">Thuế Suất VAT</label>
              <select
                value={taxRateFilter}
                onChange={(e) => setTaxRateFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 min-h-[34px]"
              >
                {metadata?.taxRates?.map((t: any) => (
                  <option key={t.rate} value={t.rate}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 10 FINANCIAL KPI CARDS */}
      {loading && !summary ? (
        <LoadingSkeleton variant="card" count={10} />
      ) : summary ? (
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 transition-opacity duration-200 ${loading ? 'opacity-70' : ''}`}>
          {/* Card 1: Gross Sales */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5 sm:mb-1 truncate">
              Gross Sales
            </span>
            <div className="text-sm sm:text-base md:text-lg font-black text-slate-900 truncate">
              {formatMoney(summary.grossSales)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
              Món: {formatMoney(summary.grossItemAmount)}
            </div>
          </div>

          {/* Card 2: Total Discount */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-600 block mb-0.5 sm:mb-1 truncate">
              Tổng Khuyến Mãi
            </span>
            <div className="text-sm sm:text-base md:text-lg font-black text-amber-700 truncate">
              {formatMoney(summary.totalDiscountOverall)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
              Voucher: {formatMoney(summary.orderVoucherDiscount)}
            </div>
          </div>

          {/* Card 3: Net Sales */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-[#800020]/20 shadow-2xs bg-gradient-to-br from-white to-[#800020]/5 hover:border-[#800020]/40 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#800020] block mb-0.5 sm:mb-1 truncate">
              Net Sales
            </span>
            <div className="text-sm sm:text-base md:text-lg font-black text-[#800020] truncate">
              {formatMoney(summary.netSales)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
              Doanh số ròng thực phẩm
            </div>
          </div>

          {/* Card 4: VAT */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-0.5 sm:mb-1 truncate">
              Thuế VAT
            </span>
            <div className="text-sm sm:text-base md:text-lg font-black text-blue-700 truncate">
              {formatMoney(summary.vatTotalAmount)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
              Trước thuế: {formatMoney(summary.revenueBeforeVat)}
            </div>
          </div>

          {/* Card 5: Shipping Paid */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5 sm:mb-1 truncate">
              Phí Ship Thu
            </span>
            <div className="text-sm sm:text-base md:text-lg font-black text-indigo-700 truncate">
              {formatMoney(summary.shippingFeeCustomerPaid)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
              Bù: {formatMoney(summary.shippingFeeSubsidized)}
            </div>
          </div>

          {/* Card 6: Grand Total Payable */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-0.5 sm:mb-1 truncate">
              Tổng Khách Phải Trả
            </span>
            <div className="text-sm sm:text-base md:text-lg font-black text-slate-800 truncate">
              {formatMoney(summary.totalCustomerPayable)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
              Số đơn: {summary.totalOrderCount.toLocaleString('vi-VN')}
            </div>
          </div>

          {/* Card 7: Collected Revenue */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/20 hover:border-emerald-300 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-0.5 sm:mb-1 truncate">
              Thực Thu (Collected)
            </span>
            <div className="text-sm sm:text-base md:text-lg font-black text-emerald-800 truncate">
              {formatMoney(summary.totalCollectedRevenue)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-600 mt-0.5 sm:mt-1 truncate">
              Đã thu thực tế
            </div>
          </div>

          {/* Card 8: Outstanding */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5 sm:mb-1 truncate">
              Công Nợ / Chưa Thu
            </span>
            <div className="text-sm sm:text-base md:text-lg font-black text-slate-700 truncate">
              {formatMoney(summary.totalOutstandingRevenue)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
              COD / Chờ thanh toán
            </div>
          </div>

          {/* Card 9: Refunded */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-rose-200 shadow-2xs bg-rose-50/20 hover:border-rose-300 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-600 block mb-0.5 sm:mb-1 truncate">
              Hoàn Tiền (Refunded)
            </span>
            <div className="text-sm sm:text-base md:text-lg font-black text-rose-700 truncate">
              {formatMoney(summary.totalRefundedAmount)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
              {summary.refundedOrderCount} GD hoàn
            </div>
          </div>

          {/* Card 10: Net Collected */}
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-emerald-300 shadow-2xs bg-gradient-to-br from-white to-emerald-50 hover:border-emerald-400 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 block mb-0.5 sm:mb-1 truncate">
              Thực Thu Ròng (Net)
            </span>
            <div className="text-sm sm:text-base md:text-lg font-black text-emerald-900 truncate">
              {formatMoney(summary.netCollectedRevenue)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-700 mt-0.5 sm:mt-1 truncate">
              AOV: {formatMoney(summary.averageOrderValue)}
            </div>
          </div>
        </div>
      ) : null}

      {/* NAVIGATION TABS */}
      <div className="border-b border-slate-200 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-3 sm:gap-6 whitespace-nowrap min-w-max">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 sm:pb-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 transition min-h-[42px] ${
              activeTab === 'overview'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PieIcon size={15} />
            <span>Tổng Quan & Biểu Đồ</span>
          </button>

          <button
            onClick={() => setActiveTab('branches')}
            className={`pb-2.5 sm:pb-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 transition min-h-[42px] ${
              activeTab === 'branches'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 size={15} />
            <span>Báo Cáo Chi Nhánh</span>
            <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-slate-100 rounded-full text-slate-600">
              {branchBreakdown.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-2.5 sm:pb-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 transition min-h-[42px] ${
              activeTab === 'transactions'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt size={15} />
            <span>Đối Soát Giao Dịch</span>
            {summary?.reconciliationHealth?.unreconciledOrdersCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-rose-500 text-white rounded-full">
                {summary.reconciliationHealth.unreconciledOrdersCount} LỆCH
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: TỔNG QUAN & BIỂU ĐỒ */}
      {activeTab === 'overview' && (
        <div className="space-y-3 sm:space-y-4 md:space-y-6">
          {/* Revenue & Cashflow Daily Trend */}
          <AdminCard
            title="Xu Hướng Doanh Thu & Dòng Tiền Theo Ngày"
            subtitle="So sánh tương quan giữa Gross Sales (Doanh số trước giảm), Net Sales và Thực thu ròng theo thời gian"
          >
            <div className="h-60 sm:h-72 w-full pt-2 sm:pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grossColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="netColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#800020" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#800020" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="collectedColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="dateStr" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis
                    tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                    tick={{ fontSize: 10 }}
                    stroke="#94a3b8"
                  />
                  <RechartsTooltip
                    formatter={(val: any) => formatMoney(Number(val))}
                    labelFormatter={(label) => `Ngày: ${label}`}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                  <Area
                    type="monotone"
                    name="Gross Sales"
                    dataKey="grossSales"
                    stroke="#2563eb"
                    fillOpacity={1}
                    fill="url(#grossColor)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    name="Net Sales"
                    dataKey="netSales"
                    stroke="#800020"
                    fillOpacity={1}
                    fill="url(#netColor)"
                    strokeWidth={2.5}
                  />
                  <Area
                    type="monotone"
                    name="Thực Thu Ròng"
                    dataKey="netCollected"
                    stroke="#16a34a"
                    fillOpacity={1}
                    fill="url(#collectedColor)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </AdminCard>

          {/* 3 Donut / Bar Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
            {/* Payment Method Breakdown */}
            <AdminCard title="Phương Thức Thanh Toán" subtitle="Tỷ trọng thực thu">
              <div className="h-56 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentBreakdown}
                      dataKey="collectedAmount"
                      nameKey="paymentMethod"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {paymentBreakdown.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: any) => formatMoney(Number(val))} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </AdminCard>

            {/* VAT Rate Breakdown */}
            <AdminCard title="Cơ Cấu Thuế Suất VAT" subtitle="Phân rã thuế phát sinh">
              <div className="h-56 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={vatBreakdown}
                      dataKey="vatAmount"
                      nameKey="rate"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {vatBreakdown.map((_: any, index: number) => (
                        <Cell key={`cell-vat-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any, name: any) => [formatMoney(Number(val)), `VAT ${name}%`]}
                    />
                    <Legend formatter={(val) => `VAT ${val}%`} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </AdminCard>

            {/* Discount Structure */}
            <AdminCard title="Cấu Trúc Khuyến Mãi" subtitle="Phân loại chiết khấu">
              <div className="h-56 sm:h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Voucher', amount: discountBreakdown.orderVoucherDiscount || 0 },
                      { name: 'Giảm Món', amount: discountBreakdown.itemDirectDiscount || 0 },
                      { name: 'Flash Sale', amount: discountBreakdown.flashSaleDiscount || 0 },
                      { name: 'Ship Voucher', amount: discountBreakdown.shippingDiscount || 0 },
                      { name: 'Điểm Đổi', amount: discountBreakdown.pointsDiscount || 0 },
                    ]}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" />
                    <YAxis
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 10 }}
                    />
                    <RechartsTooltip formatter={(val: any) => formatMoney(Number(val))} />
                    <Bar dataKey="amount" fill="#800020" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AdminCard>
          </div>
        </div>
      )}

      {/* TAB 2: BÁO CÁO CHI NHÁNH & SO SÁNH ĐA CHIỀU */}
      {activeTab === 'branches' && (
        <div className="space-y-3 sm:space-y-6">
          <AdminCard
            title="So Sánh Hiệu Suất Tài Chính Chi Nhánh"
            subtitle="Dòng TOTAL khớp chính xác 100% với toàn hệ thống. Click vào từng chi nhánh để xem Financial Deep Dive chuyên sâu."
          >
            <div className="admin-scroll-table">
              <table className="w-full text-xs text-left min-w-[900px]">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Chi Nhánh</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right">Số Đơn</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right">Gross Sales</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-amber-700">Giảm Giá</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-blue-700">VAT</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right">Ship Thu</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-[#800020] font-black">Net Sales</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-emerald-700">Thực Thu</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-rose-700">Hoàn Trả</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right font-black text-emerald-900">Thực Thu Ròng</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right">AOV</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-center">Đối Soát</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-center">Chi Tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {branchBreakdown.map((b: any) => (
                    <tr
                      key={b.branchId}
                      className="hover:bg-slate-50/80 transition group cursor-pointer"
                      onClick={() => router.push(`/admin/reports/financial/${b.branchId}`)}
                    >
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                        <Store size={14} className="text-[#800020] shrink-0" />
                        <span>{b.branchName}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({b.branchCode})</span>
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-semibold whitespace-nowrap">
                        {b.orderCount.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-semibold whitespace-nowrap">
                        {formatMoney(b.grossSales)}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-semibold text-amber-700 whitespace-nowrap">
                        {formatMoney(b.totalDiscount)}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-semibold text-blue-700 whitespace-nowrap">
                        {formatMoney(b.vatAmount)}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-slate-600 whitespace-nowrap">
                        {formatMoney(b.shippingPaid)}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-extrabold text-[#800020] whitespace-nowrap">
                        {formatMoney(b.netSales)}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {formatMoney(b.collectedRevenue)}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-rose-700 whitespace-nowrap">
                        {formatMoney(b.refundedAmount)}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-black text-emerald-900 whitespace-nowrap">
                        {formatMoney(b.netCollected)}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-slate-600 whitespace-nowrap">
                        {formatMoney(b.aov)}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-center whitespace-nowrap">
                        {b.unreconciledCount === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 sm:px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> KHỚP
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 sm:px-2 py-0.5 rounded-full">
                            <AlertTriangle size={11} /> {b.unreconciledCount} LỆCH
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-0.5 text-xs text-[#800020] font-bold group-hover:translate-x-0.5 transition">
                          Xem <ChevronRight size={13} />
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* DÒNG TỔNG CỘNG KHỚP 100% */}
                  {summary && (
                    <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300">
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 uppercase tracking-wider text-[#800020] whitespace-nowrap">
                        TỔNG CỘNG HỆ THỐNG
                      </td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right whitespace-nowrap">
                        {summary.totalOrderCount.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right whitespace-nowrap">{formatMoney(summary.grossSales)}</td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-amber-800 whitespace-nowrap">
                        {formatMoney(summary.totalDiscountOverall)}
                      </td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-blue-800 whitespace-nowrap">
                        {formatMoney(summary.vatTotalAmount)}
                      </td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right whitespace-nowrap">
                        {formatMoney(summary.shippingFeeCustomerPaid)}
                      </td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-[#800020] whitespace-nowrap">
                        {formatMoney(summary.netSales)}
                      </td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-emerald-800 whitespace-nowrap">
                        {formatMoney(summary.totalCollectedRevenue)}
                      </td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-rose-800 whitespace-nowrap">
                        {formatMoney(summary.totalRefundedAmount)}
                      </td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-emerald-950 whitespace-nowrap">
                        {formatMoney(summary.netCollectedRevenue)}
                      </td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right whitespace-nowrap">{formatMoney(summary.averageOrderValue)}</td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-center whitespace-nowrap">
                        {summary.reconciliationHealth.unreconciledOrdersCount === 0 ? (
                          <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-200 px-1.5 sm:px-2 py-0.5 rounded-full">
                            100% KHỚP
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold text-rose-800 bg-rose-200 px-1.5 sm:px-2 py-0.5 rounded-full">
                            {summary.reconciliationHealth.unreconciledOrdersCount} LỆCH
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-center text-slate-400">-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </div>
      )}

      {/* TAB 3: ĐỐI SOÁT GIAO DỊCH CHI TIẾT */}
      {activeTab === 'transactions' && (
        <div className="space-y-3 sm:space-y-4">
          <AdminCard
            title="Danh Sách Giao Dịch Đối Soát Chi Tiết"
            subtitle={`Bảng đối soát transaction-level đến từng đơn hàng. Click vào icon chi tiết để xem toàn bộ công thức và kiểm tra 4 Invariants.`}
            action={
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">
                  Tổng {txPagination.total.toLocaleString('vi-VN')} đơn
                </span>
              </div>
            }
          >
            <div className="admin-scroll-table">
              <table className="w-full text-xs text-left min-w-[1000px]">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Mã Đơn</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Ngày Giờ</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Chi Nhánh</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Khách Hàng</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right">Tiền Hàng</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-amber-700">Giảm Giá</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-blue-700">VAT</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right">Ship</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right font-black text-slate-900">Tổng Đơn</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-emerald-700">Thực Thu</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-right text-rose-700">Hoàn Tiền</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-center">PT Thanh Toán</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-center">Trạng Thái</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-center">Đối Soát</th>
                    <th className="px-2.5 py-2.5 sm:px-3 sm:py-3 text-center">Chi Tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txLoading ? (
                    <tr>
                      <td colSpan={15} className="py-8 text-center text-slate-400">
                        <RefreshCw size={20} className="animate-spin inline mr-2 text-[#800020]" />
                        Đang tải danh sách giao dịch...
                      </td>
                    </tr>
                  ) : txData.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="py-8 text-center text-slate-400">
                        Không tìm thấy giao dịch nào thỏa mãn bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    txData.map((o) => (
                      <tr key={o.orderId} className="hover:bg-slate-50/80 transition">
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-bold text-slate-900 font-mono whitespace-nowrap">
                          {o.orderCode}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-slate-500 whitespace-nowrap">
                          {new Date(o.createdAt).toLocaleString('vi-VN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 font-medium text-slate-700 whitespace-nowrap">{o.branchName}</td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{o.customerName}</div>
                          {o.customerPhone && (
                            <div className="text-[10px] text-slate-400">{o.customerPhone}</div>
                          )}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">
                          {formatMoney(o.grossItemAmount)}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium text-amber-700 whitespace-nowrap">
                          {formatMoney(o.totalItemDiscount + o.pointsDiscount)}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium text-blue-700 whitespace-nowrap">
                          {formatMoney(o.vatTotalAmount)}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-slate-600 whitespace-nowrap">
                          {formatMoney(o.shippingFeeCustomerPaid)}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatMoney(o.orderTotalAmount)}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                          {formatMoney(o.collectedRevenue)}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-rose-700 whitespace-nowrap">
                          {o.refundedAmount > 0 ? formatMoney(o.refundedAmount) : '-'}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-center whitespace-nowrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {o.paymentMethod}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-center whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              o.orderStatus === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : o.orderStatus === 'CANCELLED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {o.orderStatus}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-center whitespace-nowrap">
                          {o.reconciliation.isReconciled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                              <CheckCircle2 size={10} /> OK
                            </span>
                          ) : (
                            <span
                              title={o.reconciliation.notes.join('\n')}
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded cursor-help"
                            >
                              <AlertTriangle size={10} /> LỆCH
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleOpenInspection(o.orderId)}
                            className="p-1.5 text-slate-500 hover:text-[#800020] hover:bg-slate-100 rounded transition min-h-[34px] min-w-[34px] inline-flex items-center justify-center"
                            title="Kiểm tra chi tiết đối soát đơn hàng"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {txPagination.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500 font-medium">
                  Trang {txPagination.page} / {txPagination.totalPages}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchTransactions(txPagination.page - 1, txPagination.limit)}
                    disabled={txPagination.page <= 1 || txLoading}
                    className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 min-h-[32px]"
                  >
                    Trước
                  </button>
                  {Array.from({ length: Math.min(5, txPagination.totalPages) }).map((_, i) => {
                    const pNum = i + 1;
                    return (
                      <button
                        key={pNum}
                        onClick={() => fetchTransactions(pNum, txPagination.limit)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] ${
                          txPagination.page === pNum
                            ? 'bg-[#800020] text-white'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fetchTransactions(txPagination.page + 1, txPagination.limit)}
                    disabled={txPagination.page >= txPagination.totalPages || txLoading}
                    className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 min-h-[32px]"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </AdminCard>
        </div>
      )}

      {/* FINANCIAL INSPECTION MODAL (DRILL-DOWN TO ITEM / INVARIANT LEVEL) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-1.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[96vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-3 sm:p-6 space-y-3 sm:space-y-6 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3 sm:pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h3 className="text-sm sm:text-lg font-bold text-slate-900">
                    Chi Tiết Đối Soát Đơn Hàng {selectedOrder?.orderCode}
                  </h3>
                  {selectedOrder && (
                    <span
                      className={`text-[10px] sm:text-xs font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full ${
                        selectedOrder.reconciliation.isReconciled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedOrder.reconciliation.isReconciled ? '100% Khớp Invariant' : 'Lệch Đối Soát'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                  Chi nhánh: <span className="font-semibold text-slate-700">{selectedOrder?.branchName}</span> |
                  Khách: <span className="font-semibold text-slate-700">{selectedOrder?.customerName}</span> (
                  {selectedOrder?.customerPhone || 'N/A'})
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition min-h-[34px] min-w-[34px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {modalLoading || !selectedOrder ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin inline mr-2 text-[#800020]" />
                Đang nạp dữ liệu phân rã tài chính...
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-6">
                {/* 4 Invariants Checklist */}
                <div className="bg-slate-50 p-2.5 sm:p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">
                    Báo Cáo Kiểm Tra 4 Đẳng Thức Toán Học (Reconciliation Engine)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                    <div className="flex items-center gap-1.5">
                      {selectedOrder.reconciliation.discrepancyTotal === 0 ? (
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-rose-600 shrink-0" />
                      )}
                      <span>
                        Tổng đơn: Expected = Actual ({formatMoney(selectedOrder.orderTotalAmount)})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {selectedOrder.reconciliation.discrepancySubtotal === 0 ? (
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-rose-600 shrink-0" />
                      )}
                      <span>
                        Tiền hàng: SUM(Items) = Subtotal (
                        {formatMoney(selectedOrder.grossItemAmount)})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {selectedOrder.reconciliation.discrepancyDiscountAllocated === 0 ? (
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-rose-600 shrink-0" />
                      )}
                      <span>
                        Phân bổ Voucher: SUM = Order Discount (
                        {formatMoney(selectedOrder.orderVoucherDiscount)})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {selectedOrder.netCollected === selectedOrder.collectedRevenue - selectedOrder.refundedAmount ? (
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-rose-600 shrink-0" />
                      )}
                      <span>
                        Dòng tiền: Net = Collected - Refunded (
                        {formatMoney(selectedOrder.netCollected)})
                      </span>
                    </div>
                  </div>

                  {selectedOrder.reconciliation.notes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-rose-700 text-xs font-semibold">
                      Ghi chú bất thường: {selectedOrder.reconciliation.notes.join(' | ')}
                    </div>
                  )}
                </div>

                {/* Items Financial Decomposition Table */}
                <div>
                  <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 sm:mb-2">
                    Phân Rã Tài Chính Từng Món Ăn (OrderItem Level)
                  </h4>
                  <div className="admin-scroll-table border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left min-w-[750px]">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-2.5 py-2 sm:px-3 sm:py-2.5">Món Ăn</th>
                          <th className="px-2 py-2 sm:px-2 sm:py-2.5 text-center">SL</th>
                          <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Giá Bán</th>
                          <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Topping</th>
                          <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-amber-700">Voucher</th>
                          <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right">Sau Giảm</th>
                          <th className="px-2 py-2 sm:px-2 sm:py-2.5 text-center">Thuế</th>
                          <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-blue-700">Tiền VAT</th>
                          <th className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-bold text-[#800020]">Doanh Thu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedOrder.items.map((item: any) => (
                          <tr key={item.orderItemId} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 whitespace-nowrap">
                              <div className="font-bold text-slate-800">{item.productName}</div>
                              {item.isFlashSaleItem && (
                                <span className="text-[10px] text-amber-600 font-semibold">
                                  Flash Sale (Giảm {formatMoney(item.flashSaleDiscount)})
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 sm:px-2 sm:py-2.5 text-center font-semibold">{item.quantity}</td>
                            <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium whitespace-nowrap">
                              {formatMoney(item.unitPriceAtSale)}
                            </td>
                            <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-slate-600 whitespace-nowrap">
                              {item.totalOptionAmount > 0 ? formatMoney(item.totalOptionAmount) : '-'}
                            </td>
                            <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right text-amber-700 font-semibold whitespace-nowrap">
                              {item.allocatedOrderDiscount > 0
                                ? `-${formatMoney(item.allocatedOrderDiscount)}`
                                : '-'}
                            </td>
                            <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium text-slate-800 whitespace-nowrap">
                              {formatMoney(item.netAmountAfterDiscount)}
                            </td>
                            <td className="px-2 py-2 sm:px-2 sm:py-2.5 text-center whitespace-nowrap">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                {item.taxPercentage}%
                              </span>
                            </td>
                            <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-medium text-blue-700 whitespace-nowrap">
                              {formatMoney(item.taxAmount)}
                            </td>
                            <td className="px-2.5 py-2 sm:px-3 sm:py-2.5 text-right font-extrabold text-[#800020] whitespace-nowrap">
                              {formatMoney(item.revenueWithTax)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Order Summary Decomposition Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-slate-50 p-2.5 sm:p-4 rounded-xl border border-slate-200 text-[11px] sm:text-xs">
                  <div>
                    <span className="text-slate-500 block truncate">Tiền hàng:</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {formatMoney(selectedOrder.grossItemAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block truncate">Voucher đơn:</span>
                    <span className="font-bold text-amber-700 truncate block">
                      -{formatMoney(selectedOrder.orderVoucherDiscount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block truncate">Điểm quy đổi:</span>
                    <span className="font-bold text-amber-700 truncate block">
                      -{formatMoney(selectedOrder.pointsDiscount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block truncate">Phụ phí DV:</span>
                    <span className="font-bold text-slate-800 truncate block">
                      +{formatMoney(selectedOrder.serviceChargeTotal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block truncate">Phí ship gốc:</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {formatMoney(selectedOrder.shippingFeeOriginal)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block truncate">Giảm phí ship:</span>
                    <span className="font-bold text-emerald-700 truncate block">
                      -{formatMoney(selectedOrder.shippingDiscount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block truncate">Khách trả ship:</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {formatMoney(selectedOrder.shippingFeeCustomerPaid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block truncate">TỔNG ĐƠN:</span>
                    <span className="font-black text-xs sm:text-sm text-[#800020] truncate block">
                      {formatMoney(selectedOrder.orderTotalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
