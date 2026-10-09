'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Users,
  Download,
  RefreshCw,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Building2,
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Clock,
  Sparkles,
  ShoppingBag,
  Award,
  UserCheck,
  UserPlus,
  UserX,
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

export default function AdminCustomerReportsPage() {
  const { selectedBranchId } = useAdmin();
  const { t } = useLanguage();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'segments' | 'cohorts' | 'top'>('overview');

  // Loading & State
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Datasets
  const [kpis, setKpis] = useState<any>(null);
  const [frequency, setFrequency] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);

  // Top Customers Table with Pagination
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [topPagination, setTopPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [topSearch, setTopSearch] = useState('');
  const [topTierFilter, setTopTierFilter] = useState('ALL');
  const [topLoading, setTopLoading] = useState(false);

  // Customer Detail Modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filter States
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranchId || 'ALL');

  // Date Presets
  const [datePreset, setDatePreset] = useState<
    'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'custom'
  >('thisMonth');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL') {
      setBranchFilter(selectedBranchId);
    }
  }, [selectedBranchId]);

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const formatYMD = (d: Date) => d.toISOString().slice(0, 10);

    if (datePreset === 'today') return { fromDate: formatYMD(now), toDate: formatYMD(now) };
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
    return p.toString();
  }, [fromDate, toDate, branchFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, segRes, cohRes] = await Promise.all([
        fetch(`/api/admin/reports/customers/overview?${baseQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/customers/segments?${baseQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/customers/cohorts?${baseQuery}`, { credentials: 'include' }),
      ]);

      const [ovJson, segJson, cohJson] = await Promise.all([
        ovRes.json(),
        segRes.json(),
        cohRes.json(),
      ]);

      if (ovJson.success) {
        setKpis(ovJson.data?.kpis || null);
        setFrequency(ovJson.data?.frequency || []);
      }
      if (segJson.success) setSegments(segJson.data || []);
      if (cohJson.success) setCohorts(cohJson.data || []);
    } catch (err) {
      console.error('Lỗi khi tải báo cáo khách hàng:', err);
    } finally {
      setLoading(false);
    }
  }, [baseQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch top customers
  const fetchTopCustomers = useCallback(async (page = 1) => {
    setTopLoading(true);
    try {
      const p = new URLSearchParams(baseQuery);
      p.set('page', String(page));
      p.set('limit', String(topPagination.limit));
      if (topSearch) p.set('search', topSearch);
      if (topTierFilter !== 'ALL') p.set('tierId', topTierFilter);

      const res = await fetch(`/api/admin/reports/customers/top?${p.toString()}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setTopCustomers(json.data || []);
        if (json.meta) {
          setTopPagination({
            page: json.meta.page,
            limit: json.meta.limit,
            total: json.meta.total,
            totalPages: json.meta.totalPages,
          });
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải top khách hàng:', err);
    } finally {
      setTopLoading(false);
    }
  }, [baseQuery, topPagination.limit, topSearch, topTierFilter]);

  useEffect(() => {
    if (activeTab === 'top') {
      fetchTopCustomers(1);
    }
  }, [activeTab, fetchTopCustomers]);

  // Customer Detail Modal
  const openCustomerDetail = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/customers/detail/${customerId}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setCustomerDetail(json.data);
      }
    } catch (err) {
      console.error('Lỗi khi tải chi tiết khách hàng:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Export Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/reports/customers/export?${baseQuery}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_BaoCao_KhachHang_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Báo Cáo Khách Hàng & Giữ Chân (Retention)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Khách mới (First Completed Order), Khách quay lại, Ma trận Cohort Retention & Phân khúc RFM
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-xs">
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
        </div>
      </div>

      {/* 3. KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Khách mới trong kỳ */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Khách Mới (Đơn Đầu)</span>
            <span className="p-1 rounded-md bg-blue-50 text-blue-600">
              <UserPlus className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-blue-700 mt-1">
            {kpis?.newCustomersInPeriod || 0} khách
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Theo First Completed Order:</span>
            <span className="font-bold text-slate-700">Chuẩn Audit</span>
          </div>
        </div>

        {/* Khách quay lại */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Khách Quay Lại (Returning)</span>
            <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-emerald-700 mt-1">
            {kpis?.returningCustomersInPeriod || 0} khách
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Tỷ lệ lặp lại (Repeat rate):</span>
            <span className="font-bold text-slate-700">{kpis?.repeatPurchaseRatePercent || 0}%</span>
          </div>
        </div>

        {/* Doanh thu Net & Chi tiêu TB */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Doanh Thu Thuần (Net)</span>
            <span className="p-1 rounded-md bg-rose-50 text-[#800020]">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-slate-900 mt-1">
            {formatCurrency(kpis?.totalCustomerNetRevenue)}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Chi tiêu TB / khách:</span>
            <span className="font-bold text-slate-700">{formatCurrency(kpis?.averageCustomerSpend)}</span>
          </div>
        </div>

        {/* Rời bỏ & Nguy cơ */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Khách Nguy Cơ / Rời Bỏ</span>
            <span className="p-1 rounded-md bg-amber-50 text-amber-600">
              <UserX className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-amber-700 mt-1">
            {kpis?.atRiskCustomersCount || 0} / {kpis?.churnedCustomersCount || 0}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>VIP Customers:</span>
            <span className="font-bold text-emerald-700">{kpis?.vipCustomersCount || 0} khách</span>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation */}
      <div className="flex border-b border-slate-200 text-xs sm:text-sm font-semibold overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'TỔNG QUAN & TẦN SUẤT' },
          { id: 'segments', label: 'PHÂN KHÚC KHÁCH HÀNG (RFM)' },
          { id: 'cohorts', label: 'MA TRẬN GIỮ CHÂN (COHORT RETENTION)' },
          { id: 'top', label: 'TOP KHÁCH HÀNG CHI TIÊU' },
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

      {/* TAB 1: OVERVIEW & FREQUENCY */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Tần suất đặt hàng */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-3">
              Phân Bổ Tần Suất Mua Hàng (Số Đơn Hoàn Thành / Khách)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={frequency} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip formatter={(val: any, name: any) => name === 'Khách' ? `${val} người` : formatCurrency(Number(val))} />
                  <Bar dataKey="customerCount" fill="#1E293B" name="Khách" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quy tắc tính New / Returning */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-2">
                Quy Tắc Đo Lường Chuẩn Doanh Nghiệp (Audit Grounding)
              </h3>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-800 block">1. Khách Hàng Mới (New Customer):</span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Xác định nghiêm ngặt bằng thời điểm hoàn thành đơn đầu tiên (<span className="font-mono font-semibold">First Completed Order</span>), không dựa vào ngày tạo tài khoản.
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-800 block">2. Khách Quay Lại (Returning Customer):</span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Khách hàng có ít nhất một đơn hoàn thành trước kỳ báo cáo và tiếp tục phát sinh đơn hoàn thành trong kỳ.
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-800 block">3. Khoảng Cách Trung Bình Giữa Các Đơn:</span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {kpis?.averageDaysBetweenOrders ? `${kpis.averageDaysBetweenOrders} ngày giữa 2 lần đặt món liên tiếp` : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
              * Tất cả chỉ số doanh thu và AOV được tính toán đồng nhất theo Financial Calculation Engine hiện có.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RFM SEGMENTS */}
      {activeTab === 'segments' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {segments.map((s) => (
            <div key={s.segment} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm text-slate-900">{s.segment}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-700">
                  {s.customerCount} khách ({s.percentage}%)
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{s.description}</p>
              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tổng doanh thu:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(s.totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">AOV trung bình:</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(s.averageAov)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recency TB:</span>
                  <span className="font-semibold text-slate-700">{s.averageRecencyDays} ngày trước</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: COHORT RETENTION */}
      {activeTab === 'cohorts' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Ma Trận Giữ Chân Khách Hàng (Cohort Retention Matrix)
            </h3>
            <p className="text-[11px] text-slate-500">
              Theo dõi % khách hàng quay lại mua hàng sau tháng đầu tiên hoàn thành đơn (M0 = 100%)
            </p>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Tháng Đơn Đầu (Cohort)</th>
                  <th className="px-3 py-2.5 text-right">Quy Mô Khách</th>
                  <th className="px-3 py-2.5 text-center">Tháng 0 (M0)</th>
                  <th className="px-3 py-2.5 text-center">Tháng 1 (M1)</th>
                  <th className="px-3 py-2.5 text-center">Tháng 2 (M2)</th>
                  <th className="px-3 py-2.5 text-center">Tháng 3 (M3)</th>
                  <th className="px-3 py-2.5 text-center">Tháng 4 (M4)</th>
                  <th className="px-3 py-2.5 text-center">Tháng 5 (M5)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cohorts.map((c) => (
                  <tr key={c.cohortMonth} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{c.cohortMonth}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{c.initialCustomersCount}</td>
                    {[c.m0, c.m1, c.m2, c.m3, c.m4, c.m5].map((pct, idx) => {
                      let bgClass = 'bg-slate-50 text-slate-400';
                      if (pct >= 80) bgClass = 'bg-emerald-600 text-white font-bold';
                      else if (pct >= 50) bgClass = 'bg-emerald-400 text-white font-bold';
                      else if (pct >= 30) bgClass = 'bg-emerald-100 text-emerald-800 font-semibold';
                      else if (pct > 0) bgClass = 'bg-blue-50 text-blue-700';

                      return (
                        <td key={idx} className="px-3 py-2.5 text-center">
                          <span className={`inline-block w-14 py-1 rounded text-[11px] ${bgClass}`}>
                            {pct}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TOP CUSTOMERS */}
      {activeTab === 'top' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              Bảng Xếp Hạng Top Khách Hàng Chi Tiêu ({topPagination.total})
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTopCustomers(1)}
                placeholder="Tìm tên, SĐT, mã thẻ..."
                className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Khách Hàng</th>
                  <th className="px-3 py-2.5">Hạng Thẻ</th>
                  <th className="px-3 py-2.5">Phân Khúc Phân Tích</th>
                  <th className="px-3 py-2.5 text-right">Đơn Hoàn Thành</th>
                  <th className="px-3 py-2.5 text-right">Tổng Chi Tiêu Gross</th>
                  <th className="px-3 py-2.5 text-right">Thực Chi (Net)</th>
                  <th className="px-3 py-2.5 text-right">AOV</th>
                  <th className="px-3 py-2.5">Đơn Gần Nhất</th>
                  <th className="px-3 py-2.5 text-center">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topLoading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-400">
                      Đang tải danh sách khách hàng...
                    </td>
                  </tr>
                ) : topCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-400">
                      Không có khách hàng nào phù hợp
                    </td>
                  </tr>
                ) : (
                  topCustomers.map((u) => (
                    <tr
                      key={u.customerId}
                      onClick={() => openCustomerDetail(u.customerId)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{u.fullName}</div>
                        <div className="text-[10px] text-slate-400">{u.phone || u.email || '—'}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                          {u.membershipTier}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{u.analyticalSegment}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">{u.completedOrdersCount}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(u.lifetimeGrossSpend)}</td>
                      <td className="px-3 py-2.5 text-right font-black text-[#800020]">{formatCurrency(u.lifetimeNetSpend)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{formatCurrency(u.aov)}</td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {u.lastCompletedOrderDate ? new Date(u.lastCompletedOrderDate).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCustomerDetail(u.customerId);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
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

          {/* Pagination */}
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Trang {topPagination.page} / {topPagination.totalPages || 1} ({topPagination.total} khách)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={topPagination.page <= 1}
                onClick={() => fetchTopCustomers(topPagination.page - 1)}
                className="p-1 border border-slate-200 rounded disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={topPagination.page >= topPagination.totalPages}
                onClick={() => fetchTopCustomers(topPagination.page + 1)}
                className="p-1 border border-slate-200 rounded disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Customer Detail Modal */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedCustomerId(null)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            {detailLoading || !customerDetail ? (
              <div className="py-12 text-center text-slate-400 text-sm">Đang tải hồ sơ phân tích khách hàng...</div>
            ) : (
              <>
                <div className="border-b border-slate-100 pb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                    CUSTOMER PROFILE
                  </span>
                  <h2 className="text-lg font-black text-slate-900 mt-1">
                    {customerDetail.profile.fullName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    SĐT: {customerDetail.profile.phone || '—'} • Hạng: {customerDetail.profile.tierName} • Mã: {customerDetail.profile.memberCode || '—'}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Đơn Hoàn Thành</span>
                    <span className="text-base font-black text-slate-800">
                      {customerDetail.metrics.completedOrdersCount} đơn
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Tổng Chi Gross</span>
                    <span className="text-base font-black text-slate-800">
                      {formatCurrency(customerDetail.metrics.grossSpend)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Thực Chi (Net)</span>
                    <span className="text-base font-black text-[#800020]">
                      {formatCurrency(customerDetail.metrics.netSpend)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">AOV Trung Bình</span>
                    <span className="text-base font-black text-emerald-600">
                      {formatCurrency(customerDetail.metrics.aov)}
                    </span>
                  </div>
                </div>

                {/* Preferences */}
                <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                  <h4 className="font-bold text-slate-800">Hành Vi Tiêu Dùng:</h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>• Chi nhánh quen: <span className="font-semibold text-slate-800">{customerDetail.metrics.favoriteBranch}</span></div>
                    <div>• Nhóm món thích: <span className="font-semibold text-slate-800">{customerDetail.metrics.favoriteCategory}</span></div>
                    <div>• PT thanh toán: <span className="font-semibold text-slate-800">{customerDetail.metrics.preferredPayment}</span></div>
                  </div>
                </div>

                {/* Top món mua nhiều */}
                {customerDetail.metrics.topProducts?.length > 0 && (
                  <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                    <h4 className="font-bold text-slate-800">Món Mua Nhiều Nhất:</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {customerDetail.metrics.topProducts.map((p: any) => (
                        <span key={p.name} className="px-2 py-1 rounded bg-slate-100 text-slate-800 font-medium text-[11px]">
                          {p.name} ({p.qty} phần)
                        </span>
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
