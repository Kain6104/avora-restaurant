'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Award,
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
  Users,
  Coins,
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

export default function AdminMembershipPointReportsPage() {
  const { selectedBranchId } = useAdmin();
  const { t } = useLanguage();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'tiers' | 'dynamics' | 'liability' | 'reconciliation' | 'transactions'>('overview');

  // Loading & State
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Datasets
  const [kpis, setKpis] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [dynamics, setDynamics] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);

  // Transactions Table
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txPagination, setTxPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [txSearch, setTxSearch] = useState('');
  const [txSourceFilter, setTxSourceFilter] = useState('ALL');
  const [txLoading, setTxLoading] = useState(false);

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
      const [ovRes, tierRes, dynRes, liabRes, recRes] = await Promise.all([
        fetch(`/api/admin/reports/membership-points/overview?${baseQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/membership-points/tiers?${baseQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/membership-points/dynamics?${baseQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/membership-points/liability?${baseQuery}`, { credentials: 'include' }),
        fetch(`/api/admin/reports/membership-points/reconciliation?${baseQuery}`, { credentials: 'include' }),
      ]);

      const [ovJson, tierJson, dynJson, liabJson, recJson] = await Promise.all([
        ovRes.json(),
        tierRes.json(),
        dynRes.json(),
        liabRes.json(),
        recRes.json(),
      ]);

      if (ovJson.success) setKpis(ovJson.data?.kpis || null);
      if (tierJson.success) setTiers(tierJson.data || []);
      if (dynJson.success) setDynamics(dynJson.data || []);
      if (liabJson.success) setLiabilities(liabJson.data || []);
      if (recJson.success) setReconciliations(recJson.data || []);
    } catch (err) {
      console.error('Lỗi khi tải báo cáo hội viên & điểm:', err);
    } finally {
      setLoading(false);
    }
  }, [baseQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch transactions
  const fetchTransactions = useCallback(async (page = 1) => {
    setTxLoading(true);
    try {
      const p = new URLSearchParams(baseQuery);
      p.set('page', String(page));
      p.set('limit', String(txPagination.limit));
      if (txSearch) p.set('search', txSearch);
      if (txSourceFilter !== 'ALL') p.set('source', txSourceFilter);

      const res = await fetch(`/api/admin/reports/membership-points/transactions?${p.toString()}`, { credentials: 'include' });
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
      console.error('Lỗi khi tải lịch sử điểm:', err);
    } finally {
      setTxLoading(false);
    }
  }, [baseQuery, txPagination.limit, txSearch, txSourceFilter]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions(1);
    }
  }, [activeTab, fetchTransactions]);

  // Export Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/reports/membership-points/export?${baseQuery}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_BaoCao_HoiVien_Diem_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700">
              <Award className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Báo Cáo Hội Viên & Điểm Tích Lũy
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Hiệu suất hạng thẻ, biến động điểm, nghĩa vụ nợ (Liability) & đối soát sổ cái (Ledger)
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
        {/* Doanh thu hội viên */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Doanh Thu Hội Viên</span>
            <span className="p-1 rounded-md bg-emerald-50 text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-slate-900 mt-1">
            {formatCurrency(kpis?.revenueFromMembers)}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>AOV đơn hội viên:</span>
            <span className="font-bold text-emerald-700">{formatCurrency(kpis?.memberAov)}</span>
          </div>
        </div>

        {/* Tổng điểm cấp & tiêu */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Điểm Đã Cấp / Đã Tiêu</span>
            <span className="p-1 rounded-md bg-amber-50 text-amber-600">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-slate-900 mt-1">
            +{kpis?.totalPointsIssued || 0} / -{kpis?.totalPointsRedeemed || 0}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Tỷ lệ tiêu điểm (Redemption):</span>
            <span className="font-bold text-slate-700">{kpis?.pointRedemptionRatePercent || 0}%</span>
          </div>
        </div>

        {/* Nghĩa vụ nợ điểm (Liability) */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Nghĩa Vụ Nợ Điểm (Liability)</span>
            <span className="p-1 rounded-md bg-rose-50 text-[#800020]">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-[#800020] mt-1">
            {formatCurrency(kpis?.estimatedPointLiabilityVnd)}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Điểm tồn chưa tiêu:</span>
            <span className="font-bold text-slate-700">{kpis?.outstandingPointsBalance || 0} pts</span>
          </div>
        </div>

        {/* Đối soát sổ cái điểm */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Đối Soát Sổ Cái Điểm</span>
            <span className={`p-1 rounded-md ${kpis?.reconciliationDiscrepanciesCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <p className={`text-base sm:text-xl font-black mt-1 ${kpis?.reconciliationDiscrepanciesCount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {kpis?.reconciliationDiscrepanciesCount > 0 ? `${kpis.reconciliationDiscrepanciesCount} Lệch Sổ Cái` : 'Sổ Cái Cân Khớp'}
          </p>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Thành viên có điểm:</span>
            <span className="font-bold text-slate-700">{kpis?.activePointHoldersCount || 0} người</span>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation */}
      <div className="flex border-b border-slate-200 text-xs sm:text-sm font-semibold overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'TỔNG QUAN' },
          { id: 'tiers', label: `HẠNG THẺ (${tiers.length})` },
          { id: 'dynamics', label: `BIẾN ĐỘNG ĐIỂM (${dynamics.length})` },
          { id: 'liability', label: 'NGHĨA VỤ NỢ ĐIỂM' },
          { id: 'reconciliation', label: `ĐỐI SOÁT SỔ CÁI (${reconciliations.length})` },
          { id: 'transactions', label: 'LỊCH SỬ GIAO DỊCH' },
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
              Doanh Thu Đóng Góp Theo Từng Hạng Thẻ Hội Viên
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tiers} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="tierName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <RechartsTooltip formatter={(val: any) => formatCurrency(Number(val))} />
                  <Bar dataKey="revenue" fill="#800020" name="Doanh thu (₫)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-2">
                So Sánh Hội Viên vs Khách Vãng Lai
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-800 block">AOV Đơn Hội Viên</span>
                    <span className="text-[11px] text-slate-500">Khách có tài khoản thành viên tích điểm</span>
                  </div>
                  <span className="text-sm font-black text-emerald-700">{formatCurrency(kpis?.memberAov)}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-800 block">AOV Đơn Khách Vãng Lai</span>
                    <span className="text-[11px] text-slate-500">Khách không đăng nhập / không tích điểm</span>
                  </div>
                  <span className="text-sm font-black text-slate-700">{formatCurrency(kpis?.nonMemberAov)}</span>
                </div>

                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="font-bold text-amber-900 block">Chênh Lệch Chi Tiêu Hội Viên</span>
                    <span className="text-[11px] text-amber-700">Hội viên chi tiêu cao hơn khách vãng lai</span>
                  </div>
                  <span className="text-sm font-black text-amber-800">
                    +{formatCurrency(Math.max(0, (kpis?.memberAov || 0) - (kpis?.nonMemberAov || 0)))}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
              * Dữ liệu chỉ tính các đơn hoàn thành (Completed Orders) theo đúng chuẩn Enterprise Reporting.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TIERS */}
      {activeTab === 'tiers' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Hạng Thẻ</th>
                  <th className="px-3 py-2.5 text-right">Chi Tiêu Tối Thiểu</th>
                  <th className="px-3 py-2.5 text-center">Hệ Số Điểm</th>
                  <th className="px-3 py-2.5 text-right">Số Thành Viên</th>
                  <th className="px-3 py-2.5 text-right">Hoạt Động Trong Kỳ</th>
                  <th className="px-3 py-2.5 text-right">Đơn Hoàn Thành</th>
                  <th className="px-3 py-2.5 text-right">Doanh Thu Thu Được</th>
                  <th className="px-3 py-2.5 text-right">AOV</th>
                  <th className="px-3 py-2.5 text-right">Điểm Tích Lũy</th>
                  <th className="px-3 py-2.5 text-right">Điểm Đã Tiêu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tiers.map((t) => (
                  <tr key={t.tierId} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{t.tierName}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(t.minSpending)}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-amber-700">{t.pointMultiplier}x</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-800">{t.totalMembersCount}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{t.activeMembersCount}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{t.completedOrdersCount}</td>
                    <td className="px-3 py-2.5 text-right font-black text-slate-900">{formatCurrency(t.revenue)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{formatCurrency(t.aov)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">+{t.pointsEarned}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#800020]">-{t.pointsRedeemed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DYNAMICS */}
      {activeTab === 'dynamics' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Phân Loại Dòng Biến Động Điểm (Point Transaction Sources)
            </h3>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Hoạt Động / Nguồn Điểm</th>
                  <th className="px-3 py-2.5 text-right">Số Lượt Giao Dịch</th>
                  <th className="px-3 py-2.5 text-right">Khách Hàng Duy Nhất</th>
                  <th className="px-3 py-2.5 text-right">Tổng Điểm Phát Sinh</th>
                  <th className="px-3 py-2.5 text-right">Biến Động Ròng (Net)</th>
                  <th className="px-3 py-2.5 text-right">Tỷ Trọng Hoạt Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dynamics.map((d) => (
                  <tr key={d.sourceType} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{d.label}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{d.transactionCount}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{d.uniqueUsersCount}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">{d.pointsIssuedOrRedeemed} pts</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${d.netChange > 0 ? 'text-emerald-700' : d.netChange < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      {d.netChange > 0 ? `+${d.netChange}` : d.netChange}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{d.percentageOfActivity}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LIABILITY */}
      {activeTab === 'liability' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-3 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                Nghĩa Vụ Nợ Điểm Tích Lũy (Outstanding Point Liability)
              </h3>
              <p className="text-[11px] text-slate-500">
                Giá trị quy đổi quyền lợi điểm hệ thống nợ khách hàng (1 Point = 1.000 ₫ quy đổi chuẩn)
              </p>
            </div>
            <div className="text-right mt-2 sm:mt-0">
              <span className="text-[10px] text-slate-400 block">Tổng Nghĩa Vụ Nợ Ước Tính:</span>
              <span className="text-base font-black text-[#800020]">{formatCurrency(kpis?.estimatedPointLiabilityVnd)}</span>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Hạng Thẻ</th>
                  <th className="px-3 py-2.5 text-right">Thành Viên Còn Điểm</th>
                  <th className="px-3 py-2.5 text-right">Số Điểm Đang Nợ</th>
                  <th className="px-3 py-2.5 text-right">Giá Trị Nợ (₫)</th>
                  <th className="px-3 py-2.5 text-right">Hết Hạn Trong 7 Ngày</th>
                  <th className="px-3 py-2.5 text-right">Hết Hạn Trong 30 Ngày</th>
                  <th className="px-3 py-2.5 text-right">Hết Hạn Trong 60 Ngày</th>
                  <th className="px-3 py-2.5 text-right">Hết Hạn Trong 90 Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liabilities.map((l) => (
                  <tr key={l.tierId} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{l.tierName}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{l.membersWithPointsCount}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-700">{l.outstandingPoints} pts</td>
                    <td className="px-3 py-2.5 text-right font-black text-[#800020]">{formatCurrency(l.estimatedLiabilityVnd)}</td>
                    <td className="px-3 py-2.5 text-right text-red-600 font-semibold">{l.expiringIn7Days} pts</td>
                    <td className="px-3 py-2.5 text-right text-amber-700 font-medium">{l.expiringIn30Days} pts</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{l.expiringIn60Days} pts</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{l.expiringIn90Days} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: RECONCILIATION */}
      {activeTab === 'reconciliation' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Đối Soát Sổ Cái Điểm Từng Khách Hàng (Formula: Opening + Earn - Redeem - Expire = Closing)
            </h3>
            <p className="text-[11px] text-slate-500">
              So khớp số dư tính từ toàn bộ lịch sử giao dịch với trường currentPoints trên User
            </p>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Khách Hàng</th>
                  <th className="px-3 py-2.5">Hạng Thẻ</th>
                  <th className="px-3 py-2.5 text-right">Tổng Tích (Earn)</th>
                  <th className="px-3 py-2.5 text-right">Tổng Tiêu (Redeem)</th>
                  <th className="px-3 py-2.5 text-right">Hết Hạn (Expire)</th>
                  <th className="px-3 py-2.5 text-right">Tính Toán Sổ Cái</th>
                  <th className="px-3 py-2.5 text-right">Số Dư Trong DB</th>
                  <th className="px-3 py-2.5 text-right">Chênh Lệch</th>
                  <th className="px-3 py-2.5 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliations.map((r) => (
                  <tr key={r.userId} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">{r.fullName}</div>
                      <div className="text-[10px] text-slate-400">{r.phone || r.memberCode || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{r.tierName}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">+{r.totalEarned}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[#800020]">-{r.totalRedeemed}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">-{r.totalExpired}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">{r.calculatedClosingBalance} pts</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">{r.databaseCurrentPoints} pts</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${r.discrepancy !== 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {r.discrepancy > 0 ? `+${r.discrepancy}` : r.discrepancy}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          r.isReconciled ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
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

      {/* TAB 6: TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              Nhật Ký Sổ Cái Giao Dịch Điểm ({txPagination.total})
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTransactions(1)}
                placeholder="Tìm tên, SĐT, mã đơn..."
                className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Thời Gian</th>
                  <th className="px-3 py-2.5">Khách Hàng</th>
                  <th className="px-3 py-2.5">Hạng Thẻ</th>
                  <th className="px-3 py-2.5">Loại Giao Dịch</th>
                  <th className="px-3 py-2.5 text-right">Trước GD</th>
                  <th className="px-3 py-2.5 text-right">Biến Động</th>
                  <th className="px-3 py-2.5 text-right">Sau GD</th>
                  <th className="px-3 py-2.5">Mã Đơn / Diễn Giải</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      Đang tải lịch sử giao dịch...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      Không có giao dịch điểm nào phù hợp
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 text-slate-500">{new Date(t.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{t.userName}</div>
                        <div className="text-[10px] text-slate-400">{t.userPhone || t.memberCode || '—'}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{t.tierName}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{t.source}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{t.balanceBefore}</td>
                      <td className={`px-3 py-2.5 text-right font-black ${t.amount > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">{t.balanceAfter}</td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate">
                        {t.orderCode ? `Đơn ${t.orderCode} • ` : ''}{t.description || '—'}
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
              Trang {txPagination.page} / {txPagination.totalPages || 1} ({txPagination.total} giao dịch)
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
    </div>
  );
}
