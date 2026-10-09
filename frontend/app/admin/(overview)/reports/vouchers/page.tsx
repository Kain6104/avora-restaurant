'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  TicketPercent,
  Download,
  RefreshCw,
  Filter,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Building2,
  TrendingUp,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  ShieldAlert,
  HelpCircle,
  Clock,
  Sparkles,
  ShoppingBag,
  Users,
  Percent,
  X,
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
const BRAND_AMBER = '#d97706';
const BRAND_EMERALD = '#15803D';
const BRAND_RED = '#b91c1c';

export default function AdminVoucherReportsPage() {
  const { selectedBranchId } = useAdmin();
  const { t } = useLanguage();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'transactions' | 'fraud'>('overview');

  // Loading & State
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<string>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Datasets
  const [overviewData, setOverviewData] = useState<any>(null);
  const [performanceList, setPerformanceList] = useState<any[]>([]);
  const [fraudSignals, setFraudSignals] = useState<any[]>([]);

  // Transactions State
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txPagination, setTxPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [txSearch, setTxSearch] = useState('');
  const [txLoading, setTxLoading] = useState(false);

  // Deep-dive Modal
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [deepDiveData, setDeepDiveData] = useState<any>(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);

  // Filter States
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranchId || 'ALL');
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>('ALL');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('ALL');
  const [discountTypeFilter, setDiscountTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Date Range Presets
  const [datePreset, setDatePreset] = useState<
    'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'custom'
  >('thisMonth');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL') {
      setBranchFilter(selectedBranchId);
    }
  }, [selectedBranchId]);

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const formatYMD = (d: Date) => d.toISOString().slice(0, 10);

    if (datePreset === 'today') {
      return { fromDate: formatYMD(now), toDate: formatYMD(now) };
    }
    if (datePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { fromDate: formatYMD(y), toDate: formatYMD(y) };
    }
    if (datePreset === 'thisWeek') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now.setDate(diff));
      return { fromDate: formatYMD(mon), toDate: formatYMD(new Date()) };
    }
    if (datePreset === 'lastWeek') {
      const day = now.getDay();
      const diff = now.getDate() - day - 6;
      const lastMon = new Date(now.setDate(diff));
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastSun.getDate() + 6);
      return { fromDate: formatYMD(lastMon), toDate: formatYMD(lastSun) };
    }
    if (datePreset === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fromDate: formatYMD(start), toDate: formatYMD(now) };
    }
    if (datePreset === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { fromDate: formatYMD(start), toDate: formatYMD(end) };
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

  const baseQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set('from', fromDate);
    if (toDate) p.set('to', toDate);
    if (branchFilter && branchFilter !== 'ALL') p.set('branchId', branchFilter);
    if (orderSourceFilter && orderSourceFilter !== 'ALL') p.set('orderSource', orderSourceFilter);
    if (orderTypeFilter && orderTypeFilter !== 'ALL') p.set('orderType', orderTypeFilter);
    if (discountTypeFilter && discountTypeFilter !== 'ALL') p.set('discountType', discountTypeFilter);
    return p.toString();
  }, [fromDate, toDate, branchFilter, orderSourceFilter, orderTypeFilter, discountTypeFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, perfRes, fraudRes] = await Promise.all([
        fetch(`/api/admin/reports/vouchers/overview?${baseQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/vouchers/performance?${baseQuery}&sortBy=${sortBy}&sortOrder=${sortOrder}&search=${encodeURIComponent(searchQuery)}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/vouchers/fraud?${baseQuery}`, { credentials: 'include' }),
      ]);

      const [overviewJson, perfJson, fraudJson] = await Promise.all([
        overviewRes.json(),
        perfRes.json(),
        fraudRes.json(),
      ]);

      if (overviewJson.success) setOverviewData(overviewJson.data?.kpis || null);
      if (perfJson.success) setPerformanceList(perfJson.data || []);
      if (fraudJson.success) setFraudSignals(fraudJson.data || []);
    } catch (err) {
      console.error('Lỗi khi tải báo cáo voucher:', err);
    } finally {
      setLoading(false);
    }
  }, [baseQuery, sortBy, sortOrder, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch transactions with pagination
  const fetchTransactions = useCallback(async (page = 1) => {
    setTxLoading(true);
    try {
      const p = new URLSearchParams(baseQuery);
      p.set('page', String(page));
      p.set('limit', String(txPagination.limit));
      if (txSearch) p.set('search', txSearch);

      const res = await fetch(`/api/admin/reports/vouchers/transactions?${p.toString()}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data || []);
        if (json.meta) {
          setTxPagination({
            page: json.meta.page,
            limit: json.meta.limit,
            total: json.meta.total,
            totalPages: json.meta.totalPages,
          });
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải giao dịch voucher:', err);
    } finally {
      setTxLoading(false);
    }
  }, [baseQuery, txPagination.limit, txSearch]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions(1);
    }
  }, [activeTab, fetchTransactions]);

  // Open Deep Dive Modal
  const openDeepDive = async (voucherId: string) => {
    setSelectedVoucherId(voucherId);
    setDeepDiveLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/vouchers/detail/${voucherId}?${baseQuery}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setDeepDiveData(json.data);
      }
    } catch (err) {
      console.error('Lỗi khi tải chi tiết voucher:', err);
    } finally {
      setDeepDiveLoading(false);
    }
  };

  // Export Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/reports/vouchers/export?${baseQuery}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_BaoCao_Voucher_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Xuất báo cáo thất bại, vui lòng thử lại');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return '0 ₫';
    return `${Math.round(val).toLocaleString('vi-VN')} ₫`;
  };

  return (
    <div className="w-full min-h-screen pb-16 px-2 sm:px-4 md:px-6 max-w-[1600px] mx-auto space-y-3 sm:space-y-4">
      {/* 1. Header */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#800020]/10 text-[#800020]">
              <TicketPercent className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Báo Cáo Voucher & Khuyến Mãi
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Hiệu quả doanh thu, chi phí giảm giá và phát hiện bất thường (Chỉ tính đơn hoàn thành)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 active:scale-95 transition-all min-h-[40px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#66001a] rounded-lg shadow-2xs active:scale-95 transition-all min-h-[40px]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 sm:p-3 shadow-2xs space-y-2.5">
        {/* Preset Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'today', label: 'Hôm nay' },
            { id: 'yesterday', label: 'Hôm qua' },
            { id: 'thisWeek', label: 'Tuần này' },
            { id: 'lastWeek', label: 'Tuần trước' },
            { id: 'thisMonth', label: 'Tháng này' },
            { id: 'lastMonth', label: 'Tháng trước' },
            { id: 'thisQuarter', label: 'Quý này' },
            { id: 'thisYear', label: 'Năm nay' },
            { id: 'custom', label: 'Tùy chọn' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setDatePreset(item.id as any)}
              className={`px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors min-h-[34px] ${
                datePreset === item.id
                  ? 'bg-[#800020] text-white font-semibold shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Dynamic Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 pt-1 border-t border-slate-100 text-xs">
          {datePreset === 'custom' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Từ ngày</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Đến ngày</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Chi nhánh</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value="ALL">Toàn hệ thống</option>
              <option value="b1">Chi nhánh 1</option>
              <option value="b2">Chi nhánh 2</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Loại chiết khấu</label>
            <select
              value={discountTypeFilter}
              onChange={(e) => setDiscountTypeFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value="ALL">Tất cả loại mã</option>
              <option value="PERCENTAGE">Giảm theo %</option>
              <option value="FIXED_AMOUNT">Giảm số tiền cố định</option>
              <option value="FREE_SHIP">Miễn phí ship (Freeship)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nguồn đơn</label>
            <select
              value={orderSourceFilter}
              onChange={(e) => setOrderSourceFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value="ALL">Tất cả kênh bán</option>
              <option value="POS">Tại quầy (POS)</option>
              <option value="ONLINE">Website / App</option>
              <option value="QR_ORDER">Gọi món tại bàn QR</option>
              <option value="CHATBOT">Chatbot / Fanpage</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tìm kiếm voucher</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mã hoặc tên voucher..."
                className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Card 1: Doanh Thu Gross Từ Voucher */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Gross Revenue (Có Voucher)</span>
            <span className="p-1 rounded-md bg-blue-50 text-blue-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-slate-900 mt-1">
            {formatCurrency(overviewData?.grossRevenueGenerated)}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Đơn hoàn thành có mã:</span>
            <span className="font-bold text-slate-700">{overviewData?.totalCompletedOrdersWithVoucher || 0}</span>
          </div>
        </div>

        {/* Card 2: Chi Phí Giảm Giá */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Chi Phí Giảm Giá (Discount)</span>
            <span className="p-1 rounded-md bg-rose-50 text-[#800020]">
              <TicketPercent className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-[#800020] mt-1">
            {formatCurrency(overviewData?.totalDiscountCost)}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Freeship / Ship Discount:</span>
            <span className="font-bold text-slate-700">{formatCurrency(overviewData?.shippingDiscountCost)}</span>
          </div>
        </div>

        {/* Card 3: Hiệu Quả Doanh Thu / Chi Phí */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Revenue-to-Discount Ratio</span>
            <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-emerald-700 mt-1">
            {overviewData?.revenueToDiscountRatio ? `${overviewData.revenueToDiscountRatio}x` : '0x'}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>1đ discount mang lại:</span>
            <span className="font-bold text-slate-700">
              {overviewData?.revenueToDiscountRatio ? `${overviewData.revenueToDiscountRatio}đ DT` : '—'}
            </span>
          </div>
        </div>

        {/* Card 4: Tăng Trưởng AOV & Cảnh Báo */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">AOV Tăng Thêm (Incremental)</span>
            <span className="p-1 rounded-md bg-amber-50 text-amber-600">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-amber-700 mt-1">
            {formatCurrency(overviewData?.incrementalAov)}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Cảnh báo bất thường:</span>
            <span className={`font-bold ${overviewData?.potentialAbuseSignalsCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {overviewData?.potentialAbuseSignalsCount || 0} tín hiệu
            </span>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation */}
      <div className="flex border-b border-slate-200 text-xs sm:text-sm font-semibold overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'TỔNG QUAN & TỶ TRỌNG' },
          { id: 'performance', label: 'BẢNG HIỆU SUẤT VOUCHER' },
          { id: 'transactions', label: 'GIAO DỊCH ĐƠN HÀNG' },
          { id: 'fraud', label: `DẤU HIỆU BẤT THƯỜNG (${fraudSignals.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-2.5 px-3.5 border-b-2 whitespace-nowrap transition-colors min-h-[44px] ${
              activeTab === tab.id
                ? 'border-[#800020] text-[#800020] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 5. Tab Contents */}

      {/* TAB 1: TỔNG QUAN & CHARTS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Chart 1: Doanh Thu So Với Chi Phí Giảm Giá Top Vouchers */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
              <span>Top 5 Voucher: Doanh Thu Gross vs Chi Phí Giảm Giá (₫)</span>
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={performanceList.slice(0, 5).map((p) => ({
                    name: p.code,
                    Gross: p.grossRevenue,
                    Discount: p.totalDiscountCost,
                  }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <RechartsTooltip
                    formatter={(val: any) => formatCurrency(Number(val))}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Gross" fill="#1E293B" name="Doanh thu Gross (₫)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Discount" fill="#800020" name="Chi phí Giảm (₫)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown: Đối Tượng Khách Hàng Dùng Voucher */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-2">
                Phân Loại Người Dùng Voucher (Khách Mới vs Khách Cũ)
              </h3>
              <p className="text-[11px] text-slate-500 mb-4">
                Đánh giá voucher thu hút khách hàng mới hay kích thích khách hàng thân thiết quay lại.
              </p>

              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Lượt Sử Dụng Đơn Đầu Tiên (First Order)</span>
                    <span className="text-[11px] text-slate-500">Khách hàng mới phát sinh đơn hoàn thành</span>
                  </div>
                  <span className="text-sm font-black text-blue-600">
                    {overviewData?.firstOrderVoucherUsageCount || 0} lượt
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Lượt Sử Dụng Khách Quay Lại (Returning)</span>
                    <span className="text-[11px] text-slate-500">Khách hàng đã từng có đơn hoàn thành trước đây</span>
                  </div>
                  <span className="text-sm font-black text-emerald-600">
                    {overviewData?.returningCustomerVoucherUsageCount || 0} lượt
                  </span>
                </div>

                <div className="p-3 bg-rose-50/50 rounded-lg flex items-center justify-between border border-rose-100">
                  <div>
                    <span className="text-xs font-bold text-[#800020] block">Doanh Thu Thuần (Net Revenue)</span>
                    <span className="text-[11px] text-slate-500">Doanh thu sau khi trừ toàn bộ tiền giảm giá</span>
                  </div>
                  <span className="text-sm font-black text-[#800020]">
                    {formatCurrency(overviewData?.netRevenueGenerated)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 italic">
              * Dữ liệu chỉ áp dụng cho đơn hoàn thành (Completed). Các voucher bị hủy hoặc đơn chờ không tính vào doanh thu.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HIỆU SUẤT TỪNG VOUCHER */}
      {activeTab === 'performance' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              Bảng Hiệu Suất Chương Trình Voucher ({performanceList.length})
            </h3>
            <span className="text-[11px] text-slate-400">Click vào hàng để xem phân tích chuyên sâu</span>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Mã Voucher</th>
                  <th className="px-3 py-2.5">Chương Trình</th>
                  <th className="px-3 py-2.5">Loại Giảm</th>
                  <th className="px-3 py-2.5 text-right cursor-pointer" onClick={() => { setSortBy('uses'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center justify-end gap-1">Đã Dùng <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2.5 text-right cursor-pointer" onClick={() => { setSortBy('users'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center justify-end gap-1">Khách Duy Nhất <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2.5 text-right cursor-pointer" onClick={() => { setSortBy('revenue'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center justify-end gap-1">Doanh Thu Gross <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2.5 text-right cursor-pointer" onClick={() => { setSortBy('discount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center justify-end gap-1">Chi Phí Giảm <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2.5 text-right cursor-pointer" onClick={() => { setSortBy('aov'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    <div className="flex items-center justify-end gap-1">AOV <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-3 py-2.5 text-right">Hiệu Suất (ROI)</th>
                  <th className="px-3 py-2.5 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {performanceList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-slate-400">
                      Không tìm thấy voucher phù hợp bộ lọc
                    </td>
                  </tr>
                ) : (
                  performanceList.map((v) => (
                    <tr
                      key={v.voucherId}
                      onClick={() => openDeepDive(v.voucherId)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-[#800020]">{v.code}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{v.title}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : v.discountType === 'FREE_SHIP' ? 'Freeship' : `${(v.discountValue / 1000)}k`}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-800">{v.completedUses}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{v.uniqueUsers}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">{formatCurrency(v.grossRevenue)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#800020]">{formatCurrency(v.totalDiscountCost)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{formatCurrency(v.aov)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-emerald-50 text-emerald-700">
                          {v.revenueToDiscountRatio}x
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeepDive(v.voucherId);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-[#800020] hover:bg-rose-50"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GIAO DỊCH ĐƠN HÀNG */}
      {activeTab === 'transactions' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              Danh Sách Đơn Hàng Hoàn Thành Áp Dụng Voucher ({txPagination.total})
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTransactions(1)}
                placeholder="Tìm mã đơn, SĐT khách..."
                className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Mã Đơn</th>
                  <th className="px-3 py-2.5">Thời Gian Hoàn Thành</th>
                  <th className="px-3 py-2.5">Khách Hàng</th>
                  <th className="px-3 py-2.5">Chi Nhánh</th>
                  <th className="px-3 py-2.5">Mã Voucher</th>
                  <th className="px-3 py-2.5 text-right">Tổng Món (Gross)</th>
                  <th className="px-3 py-2.5 text-right">Giảm Giá</th>
                  <th className="px-3 py-2.5 text-right">Thực Thu (Net)</th>
                  <th className="px-3 py-2.5">Kênh / PT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txLoading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-400">
                      Đang tải danh sách đơn hàng...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-400">
                      Không có giao dịch nào phù hợp
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{t.orderCode || t.id.slice(0, 8)}</td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {new Date(t.completedAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-800">{t.customerName}</div>
                        <div className="text-[10px] text-slate-400">{t.customerPhone}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{t.branchName}</td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-[#800020]">{t.voucherCode}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{formatCurrency(t.subTotal)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-[#800020]">-{formatCurrency(t.discountAmount + t.shippingDiscount)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">{formatCurrency(t.totalAmount)}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                          {t.orderSource} • {t.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Trang {txPagination.page} / {txPagination.totalPages || 1} ({txPagination.total} đơn)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={txPagination.page <= 1}
                onClick={() => fetchTransactions(txPagination.page - 1)}
                className="p-1 border border-slate-200 rounded disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={txPagination.page >= txPagination.totalPages}
                onClick={() => fetchTransactions(txPagination.page + 1)}
                className="p-1 border border-slate-200 rounded disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CẢNH BÁO BẤT THƯỜNG / FRAUD SIGNALS */}
      {activeTab === 'fraud' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-slate-100 bg-rose-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-red-950">
                  Phát Hiện Dấu Hiệu Lạm Dụng / Nghi Ngờ Gian Lận Voucher
                </h3>
                <p className="text-[11px] text-red-700">
                  Hệ thống phân tích tần suất, tỷ lệ giảm giá và hành vi bất thường theo thuật toán Audit
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Thời Gian</th>
                  <th className="px-3 py-2.5">Mã Đơn</th>
                  <th className="px-3 py-2.5">Khách Hàng</th>
                  <th className="px-3 py-2.5">Voucher</th>
                  <th className="px-3 py-2.5">Loại Tín Hiệu</th>
                  <th className="px-3 py-2.5">Mức Độ</th>
                  <th className="px-3 py-2.5">Chi Tiết Cảnh Báo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fraudSignals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-emerald-600 font-semibold">
                      Không phát hiện dấu hiệu gian lận nào trong tập dữ liệu hiện tại!
                    </td>
                  </tr>
                ) : (
                  fraudSignals.map((sig) => (
                    <tr key={sig.id} className="hover:bg-rose-50/30">
                      <td className="px-3 py-2.5 text-slate-500">{new Date(sig.completedAt).toLocaleString('vi-VN')}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{sig.orderCode}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-800">{sig.customerName}</div>
                        <div className="text-[10px] text-slate-400">{sig.customerPhone}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[#800020]">{sig.voucherCode}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700">{sig.signalType}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            sig.severity === 'HIGH'
                              ? 'bg-red-100 text-red-700'
                              : sig.severity === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sig.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-xs">{sig.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Voucher Deep Dive Modal */}
      {selectedVoucherId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedVoucherId(null)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            {deepDiveLoading || !deepDiveData ? (
              <div className="py-12 text-center text-slate-400 text-sm">Đang tải phân tích chuyên sâu...</div>
            ) : (
              <>
                <div className="border-b border-slate-100 pb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#800020]/10 text-[#800020]">
                    VOUCHER DEEP DIVE
                  </span>
                  <h2 className="text-lg font-black text-slate-900 mt-1">
                    {deepDiveData.voucher.title} ({deepDiveData.voucher.code})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{deepDiveData.voucher.description || 'Không có mô tả'}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Đã Dùng Hoàn Thành</span>
                    <span className="text-base font-black text-slate-800">
                      {deepDiveData.performance.completedRedemptions}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Doanh Thu Gross</span>
                    <span className="text-base font-black text-slate-800">
                      {formatCurrency(deepDiveData.performance.grossRevenue)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Chi Phí Giảm Giá</span>
                    <span className="text-base font-black text-[#800020]">
                      {formatCurrency(deepDiveData.performance.discountCost)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Tỷ Lệ ROI (DT/Cost)</span>
                    <span className="text-base font-black text-emerald-600">
                      {deepDiveData.performance.revenueToDiscountRatio}x
                    </span>
                  </div>
                </div>

                {/* Scope Details */}
                <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                  <h4 className="font-bold text-slate-800">Phạm Vi Áp Dụng:</h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>• Kênh áp dụng: <span className="font-semibold text-slate-800">{deepDiveData.voucher.applicableScope}</span></div>
                    <div>• Đơn tối thiểu: <span className="font-semibold text-slate-800">{formatCurrency(deepDiveData.voucher.minOrderValue)}</span></div>
                    <div>• Giảm tối đa: <span className="font-semibold text-slate-800">{deepDiveData.voucher.maxDiscount ? formatCurrency(deepDiveData.voucher.maxDiscount) : 'Không giới hạn'}</span></div>
                    <div>• Đơn đầu tiên: <span className="font-semibold text-slate-800">{deepDiveData.voucher.isFirstOrderOnly ? 'Bắt buộc' : 'Không'}</span></div>
                  </div>
                </div>

                {/* Branch Breakdown */}
                {deepDiveData.branchBreakdown?.length > 0 && (
                  <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                    <h4 className="font-bold text-slate-800">Đóng Góp Theo Chi Nhánh:</h4>
                    <div className="space-y-1">
                      {deepDiveData.branchBreakdown.map((b: any) => (
                        <div key={b.branchName} className="flex justify-between items-center py-1 border-b border-slate-50">
                          <span className="text-slate-700">{b.branchName}</span>
                          <span className="font-bold text-slate-900">{b.count} đơn • {formatCurrency(b.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
