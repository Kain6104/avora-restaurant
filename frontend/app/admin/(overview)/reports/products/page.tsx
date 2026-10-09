'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Package,
  Layers,
  TrendingUp,
  Download,
  RefreshCw,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  ShoppingBag,
  DollarSign,
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

// Palette màu doanh nghiệp AVORA cố định
const CHART_COLORS = [
  '#800020', // Burgundy (Brand)
  '#dc2626', // Red
  '#2563eb', // Blue
  '#16a34a', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#475569', // Slate
  '#db2777', // Pink
];

export default function AdminProductReportsPage() {
  const router = useRouter();
  const { selectedBranchId } = useAdmin();
  const { t, locale } = useLanguage();

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);

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
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>('ALL');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('COMPLETED'); // Mặc định chỉ lấy đơn hoàn thành
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [taxRateFilter, setTaxRateFilter] = useState<string>('ALL');
  const [vatModeFilter, setVatModeFilter] = useState<string>('ALL');
  const [isFlashSaleFilter, setIsFlashSaleFilter] = useState<string>('ALL');
  const [hasVoucherFilter, setHasVoucherFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState<boolean>(false);

  // Chart Toggle: 'revenue' | 'quantity'
  const [chartMetric, setChartMetric] = useState<'revenue' | 'quantity'>('revenue');

  // Expanded Categories State
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Active Tooltip Popover
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Synchronize branch from AdminContext if changed
  useEffect(() => {
    if (selectedBranchId) {
      setBranchFilter(selectedBranchId);
    }
  }, [selectedBranchId]);

  // Load Metadata (Branches, Categories, Options)
  useEffect(() => {
    fetch('/api/admin/reports/products/metadata/filters', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          setMetadata(json.data);
        }
      })
      .catch((err) => console.error('Error loading report filter metadata:', err));
  }, []);

  // Fetch Report Data
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (fromHour) params.set('fromHour', fromHour);
      if (toHour) params.set('toHour', toHour);
      if (branchFilter && branchFilter !== 'ALL') params.set('branchId', branchFilter);
      if (categoryFilter && categoryFilter !== 'ALL') params.set('categoryId', categoryFilter);
      if (orderSourceFilter && orderSourceFilter !== 'ALL') params.set('orderSource', orderSourceFilter);
      if (orderTypeFilter && orderTypeFilter !== 'ALL') params.set('orderType', orderTypeFilter);
      if (orderStatusFilter) params.set('orderStatus', orderStatusFilter);
      if (paymentMethodFilter && paymentMethodFilter !== 'ALL') params.set('paymentMethod', paymentMethodFilter);
      if (taxRateFilter && taxRateFilter !== 'ALL') params.set('taxRate', taxRateFilter);
      if (vatModeFilter && vatModeFilter !== 'ALL') params.set('vatPriceMode', vatModeFilter);
      if (isFlashSaleFilter && isFlashSaleFilter !== 'ALL') params.set('isFlashSale', isFlashSaleFilter);
      if (hasVoucherFilter && hasVoucherFilter !== 'ALL') params.set('hasVoucher', hasVoucherFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/admin/reports/products/overview?${params.toString()}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        setData(json.data);

        // Mặc định mở rộng 3 danh mục đầu tiên
        if (json.data?.categoryTree) {
          const initialExpanded: Record<string, boolean> = {};
          json.data.categoryTree.slice(0, 3).forEach((c: any) => {
            initialExpanded[c.categoryId] = true;
          });
          setExpandedCategories(initialExpanded);
        }
      }
    } catch (err) {
      console.error('Error fetching product report data:', err);
    } finally {
      setLoading(false);
    }
  }, [
    fromDate,
    toDate,
    fromHour,
    toHour,
    branchFilter,
    categoryFilter,
    orderSourceFilter,
    orderTypeFilter,
    orderStatusFilter,
    paymentMethodFilter,
    taxRateFilter,
    vatModeFilter,
    isFlashSaleFilter,
    hasVoucherFilter,
    searchTerm,
  ]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Handle Preset Changes
  const applyPreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

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
      const p = new Date();
      p.setDate(p.getDate() - 7);
      setFromDate(p.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === '30days') {
      const p = new Date();
      p.setDate(p.getDate() - 30);
      setFromDate(p.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === 'thisMonth') {
      const p = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(p.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === 'lastMonth') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      setFromDate(first.toISOString().split('T')[0]);
      setToDate(last.toISOString().split('T')[0]);
    }
  };

  // Reset Filters
  const resetFilters = () => {
    applyPreset('30days');
    setFromHour('0');
    setToHour('23');
    setCategoryFilter('ALL');
    setOrderSourceFilter('ALL');
    setOrderTypeFilter('ALL');
    setOrderStatusFilter('COMPLETED');
    setPaymentMethodFilter('ALL');
    setTaxRateFilter('ALL');
    setVatModeFilter('ALL');
    setIsFlashSaleFilter('ALL');
    setHasVoucherFilter('ALL');
    setSearchTerm('');
  };

  // Export Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (fromHour) params.set('fromHour', fromHour);
      if (toHour) params.set('toHour', toHour);
      if (branchFilter && branchFilter !== 'ALL') params.set('branchId', branchFilter);
      if (categoryFilter && categoryFilter !== 'ALL') params.set('categoryId', categoryFilter);
      if (orderSourceFilter && orderSourceFilter !== 'ALL') params.set('orderSource', orderSourceFilter);
      if (orderTypeFilter && orderTypeFilter !== 'ALL') params.set('orderType', orderTypeFilter);
      if (orderStatusFilter) params.set('orderStatus', orderStatusFilter);
      if (paymentMethodFilter && paymentMethodFilter !== 'ALL') params.set('paymentMethod', paymentMethodFilter);
      if (taxRateFilter && taxRateFilter !== 'ALL') params.set('taxRate', taxRateFilter);
      if (vatModeFilter && vatModeFilter !== 'ALL') params.set('vatPriceMode', vatModeFilter);
      if (isFlashSaleFilter && isFlashSaleFilter !== 'ALL') params.set('isFlashSale', isFlashSaleFilter);
      if (hasVoucherFilter && hasVoucherFilter !== 'ALL') params.set('hasVoucher', hasVoucherFilter);

      const res = await fetch(`/api/admin/reports/products/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_BaoCaoMatHang_${fromDate}_den_${toDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading excel:', err);
      alert('Không thể xuất file Excel. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  // Currency Formatter (VND)
  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Toggle Category Expand/Collapse
  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const expandAll = () => {
    if (!data?.categoryTree) return;
    const all: Record<string, boolean> = {};
    data.categoryTree.forEach((c: any) => (all[c.categoryId] = true));
    setExpandedCategories(all);
  };

  const collapseAll = () => {
    setExpandedCategories({});
  };

  const kpis = data?.kpis;
  const charts = data?.charts;
  const categoryTree = data?.categoryTree || [];

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 max-w-[1600px] mx-auto pb-8 sm:pb-16 admin-page-wrapper">
      {/* 1. Page Header */}
      <PageHeader
        title="Báo cáo Tổng hợp Danh mục & Mặt hàng"
        subtitle="Dữ liệu doanh thu, sản lượng, thuế VAT, tùy chọn món và phân bổ giảm giá chuẩn xác 100% theo thời gian thực"
        breadcrumbs={[
          { label: 'Tổng quan' },
          { label: 'Báo cáo', href: '/admin/reports' },
          { label: 'Báo cáo mặt hàng' },
        ]}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={fetchReportData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl shadow-2xs transition-colors min-h-[40px]"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exporting || loading}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#800020] hover:bg-[#6b001b] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors min-h-[40px]"
            >
              <Download size={14} className={exporting ? 'animate-bounce' : ''} />
              <span>{exporting ? 'Đang xuất Excel...' : 'Xuất Excel'}</span>
            </button>
          </div>
        }
      />

      {/* 2. Comprehensive Filter Bar */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs p-2.5 sm:p-4 lg:p-5 space-y-2.5 sm:space-y-4">
        {/* Row 1: Presets & Primary Filters */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
          {/* Presets - Horizontal Scrollable on Mobile */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 overflow-x-auto scrollbar-none py-1 max-w-full shrink-0">
            {[
              { id: 'today', label: 'Hôm nay' },
              { id: 'yesterday', label: 'Hôm qua' },
              { id: '7days', label: '7 ngày' },
              { id: '30days', label: '30 ngày' },
              { id: 'thisMonth', label: 'Tháng này' },
              { id: 'lastMonth', label: 'Tháng trước' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg transition-all whitespace-nowrap text-[11px] sm:text-xs min-h-[36px] sm:min-h-[auto] flex items-center ${
                  datePreset === p.id
                    ? 'bg-white text-[#800020] shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-slate-50 min-h-[40px]">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setDatePreset('custom');
                setFromDate(e.target.value);
              }}
              className="bg-transparent border-none outline-none font-medium text-slate-700 text-xs w-[105px] sm:w-auto"
            />
            <span className="text-slate-400 text-xs">→</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setDatePreset('custom');
                setToDate(e.target.value);
              }}
              className="bg-transparent border-none outline-none font-medium text-slate-700 text-xs w-[105px] sm:w-auto"
            />
          </div>

          {/* Hours Filter */}
          <div className="flex items-center gap-1 text-xs text-slate-600 border border-slate-200 rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-slate-50 min-h-[40px]">
            <Clock size={13} className="text-slate-400 shrink-0" />
            <select
              value={fromHour}
              onChange={(e) => setFromHour(e.target.value)}
              className="bg-transparent border-none outline-none font-medium text-slate-700 cursor-pointer text-xs"
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <span className="text-slate-400 text-xs">→</span>
            <select
              value={toHour}
              onChange={(e) => setToHour(e.target.value)}
              className="bg-transparent border-none outline-none font-medium text-slate-700 cursor-pointer text-xs"
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:59
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div className="flex items-center gap-1.5 min-h-[40px]">
            <Store size={14} className="text-slate-400 shrink-0 hidden sm:inline-block" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none cursor-pointer hover:bg-slate-100/70 min-h-[40px]"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {metadata?.branches?.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[130px] sm:min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm món/mã hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] min-h-[40px]"
            />
          </div>

          {/* Advanced Filter Toggle */}
          <button
            onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
            className={`inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-xl border transition-colors min-h-[40px] ${
              isAdvancedFilterOpen
                ? 'bg-[#800020]/10 border-[#800020] text-[#800020]'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter size={13} />
            <span className="hidden sm:inline">Bộ lọc nâng cao</span>
            <span className="sm:hidden">Lọc</span>
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 ${isAdvancedFilterOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Reset button */}
          <button
            onClick={resetFilters}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-200 sm:border-transparent"
            title="Đặt lại bộ lọc"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Row 2: Advanced Collapsible Filter Drawer */}
        {isAdvancedFilterOpen && (
          <div className="pt-2.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 text-xs">
            {/* Category */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Danh mục</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none font-medium"
              >
                <option value="ALL">Tất cả danh mục</option>
                {metadata?.categories?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Source */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kênh bán (Source)</label>
              <select
                value={orderSourceFilter}
                onChange={(e) => setOrderSourceFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none font-medium"
              >
                <option value="ALL">Tất cả kênh</option>
                {metadata?.orderSources?.map((s: string) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Loại phục vụ (Type)</label>
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none font-medium"
              >
                <option value="ALL">Tất cả loại</option>
                {metadata?.orderTypes?.map((t: string) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Status */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Trạng thái đơn</label>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none font-medium"
              >
                <option value="COMPLETED">Đơn hoàn thành (COMPLETED)</option>
                <option value="ALL">Tất cả trạng thái</option>
                <option value="VALID">Đơn hợp lệ (loại hủy/nháp)</option>
                {metadata?.orderStatuses?.filter((st: string) => st !== 'COMPLETED')?.map((st: string) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* VAT Rate */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Thuế suất VAT</label>
              <select
                value={taxRateFilter}
                onChange={(e) => setTaxRateFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none font-medium"
              >
                <option value="ALL">Tất cả mức VAT</option>
                {metadata?.vatRates?.map((r: number) => (
                  <option key={r} value={r}>
                    VAT {r}%
                  </option>
                ))}
              </select>
            </div>

            {/* VAT Price Mode */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kiểu giá VAT</label>
              <select
                value={vatModeFilter}
                onChange={(e) => setVatModeFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none font-medium"
              >
                <option value="ALL">Tất cả kiểu giá</option>
                {metadata?.vatPriceModes?.map((m: any) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Flash Sale */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Flash Sale</label>
              <select
                value={isFlashSaleFilter}
                onChange={(e) => setIsFlashSaleFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none font-medium"
              >
                <option value="ALL">Tất cả</option>
                <option value="true">Chỉ hàng Flash Sale</option>
                <option value="false">Chỉ hàng giá thường</option>
              </select>
            </div>

            {/* Voucher */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Áp dụng Voucher</label>
              <select
                value={hasVoucherFilter}
                onChange={(e) => setHasVoucherFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none font-medium"
              >
                <option value="ALL">Tất cả đơn</option>
                <option value="true">Đơn có áp dụng Voucher</option>
                <option value="false">Đơn không áp Voucher</option>
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">PT Thanh toán</label>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 outline-none font-medium"
              >
                <option value="ALL">Tất cả phương thức</option>
                {metadata?.paymentMethods?.map((pm: string) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 3. 19 Metric KPI Dashboard Grid */}
      <div className="space-y-2.5 sm:space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#800020] shrink-0" />
            <span>Chỉ số Hiệu suất & Tài chính Mặt hàng</span>
          </h2>
          <span className="text-[10px] sm:text-xs text-slate-500">
            Chạm vào biểu tượng <Info size={11} className="inline text-slate-400" /> để xem công thức tính toán
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {/* KPI 1: SL Bán */}
          <KpiCard
            title="Số lượng bán"
            value={kpis?.totalSoldQuantity || 0}
            unit="món"
            formula="SUM(OrderItem.quantity) của các đơn hợp lệ trong kỳ"
            icon={<ShoppingBag size={16} className="text-blue-600" />}
            bgColor="bg-blue-50/60"
            borderColor="border-blue-100"
            textColor="text-blue-700"
            loading={loading}
          />

          {/* KPI 2: Số Order */}
          <KpiCard
            title="Số đơn hàng"
            value={kpis?.totalOrderCount || 0}
            unit="đơn"
            formula="COUNT(DISTINCT Order.id) chứa các mặt hàng đã chọn"
            icon={<Layers size={16} className="text-indigo-600" />}
            bgColor="bg-indigo-50/60"
            borderColor="border-indigo-100"
            textColor="text-indigo-700"
            loading={loading}
          />

          {/* KPI 3: Khách mua */}
          <KpiCard
            title="Khách hàng"
            value={kpis?.distinctCustomerCount || 0}
            unit="khách"
            formula="COUNT(DISTINCT CustomerPhone / CustomerId) đã mua"
            icon={<Package size={16} className="text-cyan-600" />}
            bgColor="bg-cyan-50/60"
            borderColor="border-cyan-100"
            textColor="text-cyan-700"
            loading={loading}
          />

          {/* KPI 4: Tiền trước giảm */}
          <KpiCard
            title="Tiền hàng trước giảm"
            value={formatMoney(kpis?.grossProductSales || 0)}
            formula="SUM(quantity * priceAtSale). Đã bao gồm phụ thu Option."
            icon={<DollarSign size={16} className="text-amber-600" />}
            bgColor="bg-amber-50/60"
            borderColor="border-amber-100"
            textColor="text-amber-700"
            loading={loading}
          />

          {/* KPI 5: Doanh thu Option */}
          <KpiCard
            title="Doanh thu Option"
            value={formatMoney(kpis?.optionRevenue || 0)}
            formula="SUM(quantity * priceAdjustmentAtSale) của tất cả options đã chọn"
            icon={<Sparkles size={16} className="text-emerald-600" />}
            bgColor="bg-emerald-50/60"
            borderColor="border-emerald-100"
            textColor="text-emerald-700"
            loading={loading}
          />

          {/* KPI 6: Giảm trực tiếp item */}
          <KpiCard
            title="Giảm trực tiếp món"
            value={formatMoney(kpis?.directItemDiscount || 0)}
            formula="SUM(quantity * OrderItem.discountAmount) giảm giá trực tiếp từng dòng món"
            icon={<Percent size={16} className="text-rose-600" />}
            bgColor="bg-rose-50/60"
            borderColor="border-rose-100"
            textColor="text-rose-700"
            loading={loading}
          />

          {/* KPI 7: Voucher phân bổ */}
          <KpiCard
            title="Giảm cấp đơn phân bổ"
            value={formatMoney(kpis?.allocatedOrderDiscount || 0)}
            formula="Order.discountAmount được phân bổ theo tỷ trọng giá trị các món hợp lệ (Thuật toán Largest Remainder)"
            icon={<Percent size={16} className="text-orange-600" />}
            bgColor="bg-orange-50/60"
            borderColor="border-orange-100"
            textColor="text-orange-700"
            loading={loading}
          />

          {/* KPI 8: Tổng giảm liên quan món */}
          <KpiCard
            title="Tổng giảm giá món"
            value={formatMoney(kpis?.totalProductDiscount || 0)}
            formula="Giảm trực tiếp món + Giảm giá cấp đơn phân bổ"
            icon={<Percent size={16} className="text-red-600" />}
            bgColor="bg-red-50/60"
            borderColor="border-red-100"
            textColor="text-red-700"
            loading={loading}
          />

          {/* KPI 9: Doanh thu sau giảm */}
          <KpiCard
            title="Doanh thu sau giảm"
            value={formatMoney(kpis?.netProductSalesAfterDiscount || 0)}
            formula="Tiền hàng trước giảm - Tổng giảm giá liên quan món"
            icon={<TrendingUp size={16} className="text-teal-600" />}
            bgColor="bg-teal-50/60"
            borderColor="border-teal-100"
            textColor="text-teal-700"
            loading={loading}
          />

          {/* KPI 10: Doanh thu chưa VAT */}
          <KpiCard
            title="Doanh thu chưa VAT"
            value={formatMoney(kpis?.productRevenueBeforeTax || 0)}
            formula="Giá trị món ăn trước thuế VAT (Taxable Base)"
            icon={<DollarSign size={16} className="text-slate-600" />}
            bgColor="bg-slate-100/70"
            borderColor="border-slate-200"
            textColor="text-slate-800"
            loading={loading}
          />

          {/* KPI 11: Tổng VAT hàng hóa */}
          <KpiCard
            title="Tổng thuế VAT món"
            value={formatMoney(kpis?.productTaxAmount || 0)}
            formula="SUM(taxAmount) của các mặt hàng. Tôn trọng snapshot lịch sử OrderItem."
            icon={<Percent size={16} className="text-purple-600" />}
            bgColor="bg-purple-50/60"
            borderColor="border-purple-100"
            textColor="text-purple-700"
            loading={loading}
          />

          {/* KPI 12: Doanh thu có VAT */}
          <KpiCard
            title="Doanh thu có VAT"
            value={formatMoney(kpis?.productRevenueWithTax || 0)}
            formula="Doanh thu chưa VAT + Tiền thuế VAT (Gross Product Sales With VAT)"
            icon={<TrendingUp size={16} className="text-[#800020]" />}
            bgColor="bg-[#800020]/5"
            borderColor="border-[#800020]/20"
            textColor="text-[#800020]"
            loading={loading}
            highlight
          />
        </div>

        {/* Order-Level Metrics Row (Strictly separated) */}
        <div className="bg-slate-50/80 rounded-xl sm:rounded-2xl border border-slate-200/80 p-2.5 sm:p-3.5 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
            <span className="font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 text-[11px] sm:text-xs">
              <Truck size={14} className="text-slate-500 shrink-0" />
              <span>Chỉ số cấp Đơn hàng (Order-Level Metrics)</span>
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400">
              Phí ship, phụ phí dịch vụ và tiền hoàn trả thuộc cấp đơn
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2.5">
            <KpiCardSmall
              title="Phí ship gốc"
              value={formatMoney(kpis?.orderShippingFeeTotal || 0)}
              formula="SUM(DISTINCT Order.shippingFee)"
            />
            <KpiCardSmall
              title="Giảm phí ship"
              value={formatMoney(kpis?.orderShippingDiscountTotal || 0)}
              formula="SUM(DISTINCT Order.shippingDiscount) - Không trừ vào doanh thu món"
            />
            <KpiCardSmall
              title="Phí ship thực thu"
              value={formatMoney(kpis?.orderNetShippingFeeTotal || 0)}
              formula="MAX(0, Phí ship gốc - Giảm phí ship)"
            />
            <KpiCardSmall
              title="Phụ phí dịch vụ"
              value={formatMoney(kpis?.orderServiceChargeTotal || 0)}
              formula="SUM(DISTINCT Order.serviceChargeTotal)"
            />
            <KpiCardSmall
              title="Hoàn tiền (Refund)"
              value={formatMoney(kpis?.orderRefundTotal || 0)}
              formula="SUM(DISTINCT OrderPayment.refunds.amount)"
              negative
            />
            <KpiCardSmall
              title="DOANH THU RÒNG"
              value={formatMoney(kpis?.netRevenueOverall || 0)}
              formula="Doanh thu hàng có VAT + Ship thực thu + Phụ phí dịch vụ - Tiền hoàn trả"
              highlight
            />
          </div>
        </div>
      </div>

      {/* 4. Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Chart 1: Category Distribution */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <PieIcon size={15} className="text-[#800020]" />
              <span>Cơ cấu theo Danh mục</span>
            </h3>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setChartMetric('revenue')}
                className={`px-2 py-1 rounded-md transition-all text-[11px] sm:text-xs ${
                  chartMetric === 'revenue'
                    ? 'bg-white text-[#800020] shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Doanh thu
              </button>
              <button
                onClick={() => setChartMetric('quantity')}
                className={`px-2 py-1 rounded-md transition-all text-[11px] sm:text-xs ${
                  chartMetric === 'quantity'
                    ? 'bg-white text-[#800020] shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Số lượng
              </button>
            </div>
          </div>

          <div className="h-56 sm:h-64">
            {charts?.categoryRevenueChart?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.categoryRevenueChart}
                    dataKey={chartMetric === 'revenue' ? 'revenue' : 'quantity'}
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {charts.categoryRevenueChart.map((_: any, idx: number) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: any) =>
                      chartMetric === 'revenue' ? formatMoney(Number(val)) : `${val} món`
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        {/* Chart 2: Top 10 Best Sellers */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <BarChart2 size={15} className="text-[#800020]" />
            <span>Top 10 Món bán chạy nhất ({chartMetric === 'revenue' ? 'Doanh thu' : 'Số lượng'})</span>
          </h3>

          <div className="h-56 sm:h-64">
            {chartMetric === 'revenue' ? (
              charts?.topProductsRevenue?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={charts.topProductsRevenue}
                    layout="vertical"
                    margin={{ left: -10, right: 10, top: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                      stroke="#94a3b8"
                      fontSize={10}
                    />
                    <YAxis
                      type="category"
                      dataKey="productName"
                      width={85}
                      stroke="#64748b"
                      fontSize={10}
                      tickFormatter={(name) =>
                        name.length > 11 ? name.slice(0, 11) + '...' : name
                      }
                    />
                    <RechartsTooltip formatter={(val: any) => formatMoney(Number(val))} />
                    <Bar dataKey="revenue" fill="#800020" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )
            ) : charts?.topProductsQuantity?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.topProductsQuantity}
                  layout="vertical"
                  margin={{ left: -10, right: 10, top: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                  <YAxis
                    type="category"
                    dataKey="productName"
                    width={85}
                    stroke="#64748b"
                    fontSize={10}
                    tickFormatter={(name) =>
                      name.length > 11 ? name.slice(0, 11) + '...' : name
                    }
                  />
                  <RechartsTooltip formatter={(val: any) => `${val} món`} />
                  <Bar dataKey="quantity" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        {/* Chart 3: Sales Trend Over Time */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <TrendingUp size={15} className="text-[#800020]" />
            <span>Xu hướng Doanh thu theo Thời gian</span>
          </h3>

          <div className="h-56 sm:h-64">
            {charts?.salesTrend?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.salesTrend} margin={{ left: -15, right: 10, top: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#800020" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#800020" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="period"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(p) => p.slice(5)}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    formatter={(val: any) => formatMoney(Number(val))}
                    labelFormatter={(label) => `Thời gian: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="netRevenue"
                    stroke="#800020"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                    name="Doanh thu có VAT"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>
      </div>

      {/* 5. Master Category + Product Tree Table */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-2.5 sm:p-4 lg:p-5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 bg-slate-50/50">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Package size={16} className="text-[#800020] shrink-0" />
              <span>Bảng Doanh thu Danh mục & Mặt hàng Chi tiết</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Click vào tên Danh mục để mở rộng/thu gọn. Click vào Tên sản phẩm để xem báo cáo chi tiết món.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={expandAll}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 min-h-[36px] flex items-center"
            >
              Mở rộng tất cả
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 min-h-[36px] flex items-center"
            >
              Thu gọn tất cả
            </button>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="admin-scroll-table">
          <table className="w-full text-left text-xs border-collapse min-w-[1250px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px] select-none">
                <th className="py-3 px-3 min-w-[220px]">Danh mục / Tên mặt hàng</th>
                <th className="py-3 px-2 min-w-[90px]">Mã hàng</th>
                <th className="py-3 px-2 text-center min-w-[60px]">ĐVT</th>
                <th className="py-3 px-2 text-right min-w-[70px]">SL bán</th>
                <th className="py-3 px-2 text-right min-w-[65px]">% SL</th>
                <th className="py-3 px-2 text-right min-w-[95px]">Giá TB</th>
                <th className="py-3 px-2 text-right min-w-[110px]">Trước giảm</th>
                <th className="py-3 px-2 text-right min-w-[105px]">Tiền Option</th>
                <th className="py-3 px-2 text-right min-w-[95px]">Giảm món</th>
                <th className="py-3 px-2 text-right min-w-[95px]">Giảm order</th>
                <th className="py-3 px-2 text-right min-w-[95px]">Tổng giảm</th>
                <th className="py-3 px-2 text-right min-w-[110px]">Sau giảm</th>
                <th className="py-3 px-2 text-right min-w-[110px]">Chưa VAT</th>
                <th className="py-3 px-2 text-right min-w-[95px]">Thuế VAT</th>
                <th className="py-3 px-2 text-right min-w-[115px] bg-slate-200/50">Có VAT</th>
                <th className="py-3 px-2 text-right min-w-[65px]">% DT</th>
                <th className="py-3 px-2 text-center min-w-[75px]">Thuế suất</th>
                <th className="py-3 px-2 text-center min-w-[80px]">Kiểu VAT</th>
                <th className="py-3 px-2 text-right min-w-[65px]">Số đơn</th>
                <th className="py-3 px-3 text-center min-w-[90px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={20} className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#800020]" />
                    <span>Đang tải và tính toán số liệu tài chính...</span>
                  </td>
                </tr>
              ) : categoryTree.length === 0 ? (
                <tr>
                  <td colSpan={20} className="py-12 text-center text-slate-400">
                    <Package size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">Không tìm thấy dữ liệu mặt hàng</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Thử thay đổi dải ngày hoặc xóa bớt các bộ lọc để xem số liệu
                    </p>
                  </td>
                </tr>
              ) : (
                categoryTree.map((cat: any) => {
                  const isExpanded = !!expandedCategories[cat.categoryId];
                  return (
                    <React.Fragment key={cat.categoryId}>
                      {/* Category Header Row */}
                      <tr
                        onClick={() => toggleCategory(cat.categoryId)}
                        className="bg-slate-50/90 hover:bg-slate-100/80 font-bold text-slate-800 cursor-pointer transition-colors border-t border-slate-200"
                      >
                        <td className="py-2.5 px-3 flex items-center gap-2">
                          <span className="text-slate-400">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                          <span className="text-[#800020] uppercase">{cat.categoryName}</span>
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                            {cat.products.length} món
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-slate-400">-</td>
                        <td className="py-2.5 px-2 text-center text-slate-400">-</td>
                        <td className="py-2.5 px-2 text-right">{cat.soldQuantity.toLocaleString('vi-VN')}</td>
                        <td className="py-2.5 px-2 text-right">{cat.quantitySharePercent}%</td>
                        <td className="py-2.5 px-2 text-right text-slate-400">-</td>
                        <td className="py-2.5 px-2 text-right">{formatMoney(cat.grossAmount)}</td>
                        <td className="py-2.5 px-2 text-right text-emerald-700">{formatMoney(cat.optionRevenue)}</td>
                        <td className="py-2.5 px-2 text-right text-rose-700">{formatMoney(cat.directItemDiscount)}</td>
                        <td className="py-2.5 px-2 text-right text-orange-700">{formatMoney(cat.allocatedOrderDiscount)}</td>
                        <td className="py-2.5 px-2 text-right text-red-700">{formatMoney(cat.totalDiscount)}</td>
                        <td className="py-2.5 px-2 text-right">{formatMoney(cat.amountAfterDiscount)}</td>
                        <td className="py-2.5 px-2 text-right">{formatMoney(cat.revenueBeforeTax)}</td>
                        <td className="py-2.5 px-2 text-right text-purple-700">{formatMoney(cat.taxAmount)}</td>
                        <td className="py-2.5 px-2 text-right text-[#800020] bg-slate-200/40">
                          {formatMoney(cat.revenueWithTax)}
                        </td>
                        <td className="py-2.5 px-2 text-right">{cat.revenueSharePercent}%</td>
                        <td className="py-2.5 px-2 text-center text-slate-400">-</td>
                        <td className="py-2.5 px-2 text-center text-slate-400">-</td>
                        <td className="py-2.5 px-2 text-right">{cat.orderCount}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategory(cat.categoryId);
                            }}
                            className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                          >
                            {isExpanded ? 'Thu gọn' : 'Xem món'}
                          </button>
                        </td>
                      </tr>

                      {/* Child Product Rows */}
                      {isExpanded &&
                        cat.products.map((p: any) => (
                          <tr
                            key={p.productId}
                            className="hover:bg-slate-50/70 transition-colors text-slate-700 group"
                          >
                            <td className="py-2 px-3 pl-8">
                              <Link
                                href={`/admin/reports/products/${p.productId}`}
                                className="font-semibold text-slate-900 group-hover:text-[#800020] transition-colors flex items-center gap-1.5"
                              >
                                <span>{p.productName}</span>
                                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#800020]" />
                              </Link>
                            </td>
                            <td className="py-2 px-2 font-mono text-slate-500 text-[11px]">
                              {p.productCode || p.productId.slice(0, 8)}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-500">{p.productUnit}</td>
                            <td className="py-2 px-2 text-right font-medium">
                              {p.soldQuantity.toLocaleString('vi-VN')}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-500">{p.quantitySharePercent}%</td>
                            <td className="py-2 px-2 text-right text-slate-600">{formatMoney(p.avgUnitPrice)}</td>
                            <td className="py-2 px-2 text-right">{formatMoney(p.grossAmount)}</td>
                            <td className="py-2 px-2 text-right text-emerald-600 font-medium">
                              {formatMoney(p.optionRevenue)}
                            </td>
                            <td className="py-2 px-2 text-right text-rose-600 font-medium">
                              {formatMoney(p.directItemDiscount)}
                            </td>
                            <td className="py-2 px-2 text-right text-orange-600 font-medium">
                              {formatMoney(p.allocatedOrderDiscount)}
                            </td>
                            <td className="py-2 px-2 text-right text-red-600 font-medium">
                              {formatMoney(p.totalDiscount)}
                            </td>
                            <td className="py-2 px-2 text-right font-medium">
                              {formatMoney(p.amountAfterDiscount)}
                            </td>
                            <td className="py-2 px-2 text-right">{formatMoney(p.revenueBeforeTax)}</td>
                            <td className="py-2 px-2 text-right text-purple-600 font-medium">
                              {formatMoney(p.taxAmount)}
                            </td>
                            <td className="py-2 px-2 text-right font-bold text-slate-900 bg-slate-100/50">
                              {formatMoney(p.revenueWithTax)}
                            </td>
                            <td className="py-2 px-2 text-right font-medium">{p.revenueSharePercent}%</td>
                            <td className="py-2 px-2 text-center">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                {p.vatRateDisplay}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                {p.vatModeDisplay}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right">{p.orderCount}</td>
                            <td className="py-2 px-3 text-center">
                              <Link
                                href={`/admin/reports/products/${p.productId}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#800020]/10 hover:bg-[#800020] text-[#800020] hover:text-white font-semibold text-[11px] transition-all"
                              >
                                <Eye size={11} />
                                <span>Chi tiết</span>
                              </Link>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   SUB-COMPONENTS FOR METRICS & CHARTS
   ========================================================================== */

function KpiCard({
  title,
  value,
  unit,
  formula,
  icon,
  bgColor,
  borderColor,
  textColor,
  highlight = false,
  loading = false,
}: any) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className={`relative p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all ${bgColor} ${borderColor} ${
        highlight ? 'ring-2 ring-[#800020]/30 shadow-sm' : 'shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 truncate pr-1">{title}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="hidden sm:inline-block scale-90 sm:scale-100">{icon}</span>
          <button
            type="button"
            className="relative cursor-pointer text-slate-400 hover:text-slate-600 p-0.5 rounded touch-manipulation"
            onClick={() => setShowTooltip(!showTooltip)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label="Xem công thức"
          >
            <Info size={12} />
            {showTooltip && (
              <div className="absolute z-50 bottom-full right-0 mb-2 w-52 sm:w-56 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl pointer-events-none">
                <p className="font-bold mb-0.5 text-amber-300">Công thức:</p>
                <p>{formula}</p>
              </div>
            )}
          </button>
        </div>
      </div>

      <div className={`mt-0.5 transition-opacity duration-150 ${loading ? 'opacity-70' : ''}`}>
        {loading && (value === undefined || value === null) ? (
          <div className="h-5 sm:h-6 w-20 sm:w-24 bg-slate-200 animate-pulse rounded" />
        ) : (
          <div className="flex items-baseline gap-1">
            <span className={`text-xs sm:text-base md:text-lg font-black tracking-tight truncate ${textColor}`}>
              {value}
            </span>
            {unit && <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 shrink-0">{unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCardSmall({ title, value, formula, negative = false, highlight = false }: any) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl border text-xs relative ${
        highlight
          ? 'bg-[#800020]/10 border-[#800020]/30 text-[#800020] font-bold'
          : negative
          ? 'bg-rose-50/80 border-rose-200 text-rose-800'
          : 'bg-white border-slate-200 text-slate-700'
      }`}
    >
      <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mb-0.5">
        <span className="truncate">{title}</span>
        <button
          type="button"
          className="cursor-pointer text-slate-400 hover:text-slate-600 ml-1 shrink-0 p-0.5 touch-manipulation"
          onClick={() => setShowTooltip(!showTooltip)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label="Xem quy tắc"
        >
          <Info size={10} />
          {showTooltip && (
            <div className="absolute z-50 bottom-full right-0 mb-1.5 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl pointer-events-none">
              <p className="font-bold text-amber-300 mb-0.5">Quy tắc:</p>
              <p>{formula}</p>
            </div>
          )}
        </button>
      </div>
      <div className="font-extrabold text-xs sm:text-sm truncate">{value}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-xs">
      <Package size={24} className="mb-1 text-slate-300" />
      <span>Không có dữ liệu trong khoảng thời gian này</span>
    </div>
  );
}
