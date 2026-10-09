'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Zap,
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
  Package,
  ShieldCheck,
  AlertCircle,
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

export default function AdminFlashSaleReportsPage() {
  const { selectedBranchId } = useAdmin();
  const { t } = useLanguage();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'products' | 'timeslots' | 'reconciliation'>('overview');

  // Loading & State
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Datasets
  const [kpis, setKpis] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);

  // Filter States
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranchId || 'ALL');
  const [campaignFilter, setCampaignFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
    if (campaignFilter && campaignFilter !== 'ALL') p.set('campaignId', campaignFilter);
    return p.toString();
  }, [fromDate, toDate, branchFilter, campaignFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, campRes, prodRes, slotRes, recRes] = await Promise.all([
        fetch(`/api/admin/reports/flash-sales/overview?${baseQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/flash-sales/campaigns?${baseQuery}&search=${encodeURIComponent(searchQuery)}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/flash-sales/products?${baseQuery}&search=${encodeURIComponent(searchQuery)}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/flash-sales/timeslots?${baseQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/flash-sales/reconciliation?${baseQuery}`, { credentials: 'include' }),
      ]);

      const [ovJson, campJson, prodJson, slotJson, recJson] = await Promise.all([
        ovRes.json(),
        campRes.json(),
        prodRes.json(),
        slotRes.json(),
        recRes.json(),
      ]);

      if (ovJson.success) setKpis(ovJson.data?.kpis || null);
      if (campJson.success) setCampaigns(campJson.data || []);
      if (prodJson.success) setProducts(prodJson.data || []);
      if (slotJson.success) setTimeSlots(slotJson.data || []);
      if (recJson.success) setReconciliations(recJson.data || []);
    } catch (err) {
      console.error('Lỗi khi tải báo cáo flash sale:', err);
    } finally {
      setLoading(false);
    }
  }, [baseQuery, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Export Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/reports/flash-sales/export?${baseQuery}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_BaoCao_FlashSale_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <Zap className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Báo Cáo Flash Sale & Khung Giờ Vàng
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Hiệu quả chiến dịch, tỷ lệ bán hết (Sell-through) và đối soát tồn kho món ăn
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-xs">
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
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Chiến dịch</label>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value="ALL">Tất cả chiến dịch</option>
              {campaigns.map((c) => (
                <option key={c.campaignId} value={c.campaignId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tìm kiếm món / chiến dịch</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tên món hoặc chiến dịch..."
                className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Doanh thu Flash Sale */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Doanh Thu Flash Sale</span>
            <span className="p-1 rounded-md bg-amber-50 text-amber-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-slate-900 mt-1">
            {formatCurrency(kpis?.grossFlashSaleRevenue)}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Món bán hoàn thành:</span>
            <span className="font-bold text-slate-700">{kpis?.totalFlashSaleItemsSold || 0} suất</span>
          </div>
        </div>

        {/* Chi phí giảm giá */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Chi Phí Giảm Giá Món</span>
            <span className="p-1 rounded-md bg-rose-50 text-[#800020]">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-[#800020] mt-1">
            {formatCurrency(kpis?.flashSaleDiscountCost)}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Tổng giá trị gốc:</span>
            <span className="font-bold text-slate-700">{formatCurrency(kpis?.originalValueTotal)}</span>
          </div>
        </div>

        {/* Tỷ lệ bán hết Sell-Through */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tỷ Lệ Bán Hết (Sell-through)</span>
            <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-emerald-700 mt-1">
            {kpis?.overallSellThroughRate ? `${kpis.overallSellThroughRate}%` : '0%'}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Tồn phân bổ:</span>
            <span className="font-bold text-slate-700">{kpis?.totalStockAllocated || 0} suất</span>
          </div>
        </div>

        {/* Cảnh báo tồn & đối soát */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Đối Soát Tồn Kho Flash Sale</span>
            <span className={`p-1 rounded-md ${kpis?.reconciliationErrorsCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <p className={`text-base sm:text-xl font-black mt-1 ${kpis?.reconciliationErrorsCount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {kpis?.reconciliationErrorsCount > 0 ? `${kpis.reconciliationErrorsCount} Lỗi Lệch Tồn` : 'Cân Bằng Chuẩn'}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Vượt tồn (Overselling):</span>
            <span className={`font-bold ${kpis?.oversellingIncidentsCount > 0 ? 'text-red-600' : 'text-slate-700'}`}>
              {kpis?.oversellingIncidentsCount || 0} vụ
            </span>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation */}
      <div className="flex border-b border-slate-200 text-xs sm:text-sm font-semibold overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'TỔNG QUAN' },
          { id: 'campaigns', label: `CHIẾN DỊCH (${campaigns.length})` },
          { id: 'products', label: `MÓN ĂN (${products.length})` },
          { id: 'timeslots', label: 'KHUNG GIỜ VÀNG' },
          { id: 'reconciliation', label: `ĐỐI SOÁT TỒN KHO (${reconciliations.length})` },
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

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-3">
              Doanh Thu Theo Khung Giờ Bán Trong Ngày
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeSlots} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="timeSlotLabel" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <RechartsTooltip formatter={(val: any) => formatCurrency(Number(val))} />
                  <Bar dataKey="revenue" fill="#d97706" name="Doanh thu (₫)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              Minh Bạch Đo Lường Conversion (Chuyển Đổi)
            </h3>
            <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-lg text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Trạng thái dữ liệu lượt xem chiến dịch:</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {kpis?.conversionRateText || 'Hệ thống hiện tại ghi nhận các lượt bán thành công từ đơn Completed. Để tính chính xác Conversion Rate (Số người mua / Số người xem chiến dịch), đề xuất kích hoạt Event Tracking ghi nhận Product Impression trên Client App.'}
              </p>
            </div>

            <div className="space-y-2 text-xs pt-2">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Món Flash Sale Bán Chạy Nhất:</span>
                <span className="font-bold text-slate-900">{kpis?.topProductName || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Chiến Dịch Doanh Thu Cao Nhất:</span>
                <span className="font-bold text-slate-900">{kpis?.topCampaignName || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Số Lượng Khách Mua Duy Nhất:</span>
                <span className="font-bold text-slate-900">{kpis?.uniqueBuyers || 0} khách</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">AOV Trung Bình Đơn Flash Sale:</span>
                <span className="font-bold text-slate-900">{formatCurrency(kpis?.averageFlashSaleOrderValue)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Chiến Dịch</th>
                  <th className="px-3 py-2.5">Thời Gian</th>
                  <th className="px-3 py-2.5 text-right">Đơn Hoàn Thành</th>
                  <th className="px-3 py-2.5 text-right">Số Suất Bán</th>
                  <th className="px-3 py-2.5 text-right">Giá Trị Gốc</th>
                  <th className="px-3 py-2.5 text-right">Chi Phí Giảm</th>
                  <th className="px-3 py-2.5 text-right">Doanh Thu Thu Được</th>
                  <th className="px-3 py-2.5 text-right">Tỷ Lệ Bán Hết</th>
                  <th className="px-3 py-2.5 text-center">Trạng Thái Tồn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((c) => (
                  <tr key={c.campaignId} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{c.campaignCode}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {new Date(c.startTime).toLocaleDateString('vi-VN')} - {new Date(c.endTime).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{c.completedOrdersCount}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">{c.itemsSoldCount}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(c.originalValue)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[#800020]">{formatCurrency(c.discountCost)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">{formatCurrency(c.revenue)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-50 text-emerald-700">
                        {c.sellThroughRate}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.hasStockError ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {c.hasStockError ? 'LỖI TỒN' : 'KHỚP'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCTS */}
      {activeTab === 'products' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Món Ăn</th>
                  <th className="px-3 py-2.5">Danh Mục</th>
                  <th className="px-3 py-2.5">Chiến Dịch</th>
                  <th className="px-3 py-2.5 text-right">Giá Flash Sale</th>
                  <th className="px-3 py-2.5 text-right">Giá Gốc</th>
                  <th className="px-3 py-2.5 text-right">Tồn Đầu</th>
                  <th className="px-3 py-2.5 text-right">Đã Bán</th>
                  <th className="px-3 py-2.5 text-right">Tồn Còn</th>
                  <th className="px-3 py-2.5 text-right">Doanh Thu</th>
                  <th className="px-3 py-2.5 text-right">Sell-through</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p, idx) => (
                  <tr key={`${p.campaignId}_${p.productId}_${idx}`} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{p.productName}</td>
                    <td className="px-3 py-2.5 text-slate-500">{p.categoryName}</td>
                    <td className="px-3 py-2.5 text-slate-600">{p.campaignName}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-700">{formatCurrency(p.flashPrice)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400 line-through">{formatCurrency(p.originalPrice)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{p.initialStock}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{p.soldQuantity}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{p.remainingStock}</td>
                    <td className="px-3 py-2.5 text-right font-black text-slate-900">{formatCurrency(p.revenue)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-blue-600">{p.sellThroughRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TIMESLOTS */}
      {activeTab === 'timeslots' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
          <h3 className="text-xs sm:text-sm font-bold text-slate-800">
            Phân Bổ Sản Lượng & Doanh Thu Theo Khung Giờ Nhà Hàng
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {timeSlots.map((ts) => (
              <div key={ts.timeSlotLabel} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">{ts.timeSlotLabel}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                    {ts.itemsSoldCount} suất
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-slate-500">Doanh thu:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(ts.revenue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">AOV đơn giờ này:</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(ts.aov)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: STOCK RECONCILIATION */}
      {activeTab === 'reconciliation' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                Đối Soát Tồn Kho Toàn Diện (Formula: Initial Stock = Sold + Remaining)
              </h3>
              <p className="text-[11px] text-slate-500">
                Tự động kiểm tra sai lệch giữa bộ đếm hệ thống và thực tế đơn hàng hoàn tất
              </p>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Chiến Dịch</th>
                  <th className="px-3 py-2.5">Món Ăn</th>
                  <th className="px-3 py-2.5 text-right">Tồn Đầu</th>
                  <th className="px-3 py-2.5 text-right">Đếm Bán DB</th>
                  <th className="px-3 py-2.5 text-right">Thực Bán (Completed)</th>
                  <th className="px-3 py-2.5 text-right">Tồn Còn Lại</th>
                  <th className="px-3 py-2.5 text-right">Chênh Lệch</th>
                  <th className="px-3 py-2.5 text-center">Trạng Thái Đối Soát</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliations.map((r, idx) => (
                  <tr key={`${r.campaignId}_${r.productId}_${idx}`} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{r.campaignName}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{r.productName}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{r.initialStock}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{r.systemSoldCounter}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{r.actualCompletedSoldQuantity}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{r.remainingStock}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${r.discrepancyQuantity !== 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {r.discrepancyQuantity > 0 ? `+${r.discrepancyQuantity}` : r.discrepancyQuantity}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          r.reconciliationStatus === 'BALANCED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {r.reconciliationStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
