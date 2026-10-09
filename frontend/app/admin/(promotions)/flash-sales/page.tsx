'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFlashSaleRealtime } from '@/hooks/useFlashSaleRealtime';
import {
  Zap,
  Plus,
  BarChart3,
  Calendar as CalendarIcon,
  List,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  MoreVertical,
  Clock,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  XCircle,
  Copy,
  Edit,
  Eye,
  TrendingUp,
  ShoppingBag,
  Users,
  Percent,
  Tag,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import {
  FlashSaleCampaign,
  FlashSaleKPIs,
  FlashSaleRuntimeStatus,
} from '@/types/flash-sale';

export default function FlashSaleManagementPage() {
  const router = useRouter();
  const { selectedBranchId, allBranches, can } = useAdmin();
  const { t } = useLanguage();

  // View state: 'list' | 'timeline'
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  // Loading & Data
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<FlashSaleCampaign[]>([]);
  const [kpis, setKpis] = useState<FlashSaleKPIs | null>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [datePreset, setDatePreset] = useState('all');
  const [selectedTimelineDate, setSelectedTimelineDate] = useState(
    new Date().toISOString().split('T')[0],
  );

  // Modals & Action States
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'publish' | 'pause' | 'resume' | 'cancel' | 'clone';
    campaign: FlashSaleCampaign | null;
  }>({
    isOpen: false,
    type: 'publish',
    campaign: null,
  });

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleDocumentClick = () => setOpenMenuId(null);
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Sync branch filter from AdminContext
  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL') {
      setBranchFilter(selectedBranchId);
    }
  }, [selectedBranchId]);

  // Fetch campaigns and KPIs
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (branchFilter !== 'ALL') params.set('branchId', branchFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const [res, kpiRes] = await Promise.all([
        fetch(`/api/admin/flash-sales?${params.toString()}`, {
          credentials: 'include',
        }),
        fetch(
          `/api/admin/flash-sales/kpis${branchFilter !== 'ALL' ? `?branchId=${branchFilter}` : ''}`,
          { credentials: 'include' },
        ),
      ]);

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const list = Array.isArray(json.data)
            ? json.data
            : (json.data.campaigns || json.campaigns || []);
          setCampaigns(list);
        }
      }

      if (kpiRes.ok) {
        const kpiJson = await kpiRes.json();
        if (kpiJson.success && kpiJson.data) {
          const d = kpiJson.data;
          setKpis({
            activeCount: d.activeCount ?? 0,
            upcomingCount: d.upcomingCount ?? 0,
            endedCount: d.endedCount ?? 0,
            totalRevenue: d.totalRevenue ?? 0,
            totalUnitsSold: d.totalUnitsSold ?? 0,
            totalOrders: d.totalOrders ?? 0,
            totalBuyers: d.uniqueCustomersCount ?? d.totalBuyers ?? 0,
            totalDiscountAmount: d.totalDiscountAmount ?? 0,
            sellThroughRate: d.sellThroughRate ?? 0,
            conversionRate: d.conversionRate ?? 0,
            revenueToday: d.today?.revenue ?? 0,
            revenue7d: d.sevenDays?.revenue ?? 0,
            revenue30d: d.thirtyDays?.revenue ?? 0,
            revenueGrowth: d.today?.growth ?? 0,
            ordersGrowth: d.ordersGrowth ?? 0,
          });
        }
      }

      // If in timeline mode, load timeline
      if (viewMode === 'timeline') {
        const tRes = await fetch(
          `/api/admin/flash-sales/timeline?date=${selectedTimelineDate}&branchId=${branchFilter}`,
          { credentials: 'include' },
        );
        if (tRes.ok) {
          const tJson = await tRes.json();
          if (tJson.success && tJson.data) {
            setTimelineData(tJson.data.slots || []);
          }
        }
      }
    } catch (err) {
      console.error('Error loading flash sales:', err);
    } finally {
      setLoading(false);
    }
  }, [branchFilter, statusFilter, searchTerm, viewMode, selectedTimelineDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hook into WebSocket for realtime flash sale changes
  useFlashSaleRealtime({
    onCampaignChanged: () => {
      fetchData();
    },
    onStockUpdated: (data) => {
      // Optimistically update stock count in local list
      setCampaigns((prev) =>
        prev.map((c) => {
          const hasItem = c.items?.some((it) => it.id === data.flashSaleItemId);
          if (hasItem) {
            return {
              ...c,
              totalSold: (c.totalSold || 0) + 1,
            };
          }
          return c;
        }),
      );
    },
  });

  // Action handlers
  const handleLifecycleAction = async (
    action: 'publish' | 'pause' | 'resume' | 'cancel' | 'clone',
    campaign: FlashSaleCampaign,
  ) => {
    try {
      setActionLoadingId(campaign.id);
      let endpoint = `/api/admin/flash-sales/${campaign.id}/${action}`;
      let method = 'POST';
      let body: any = undefined;

      if (action === 'clone') {
        // Prepare new dates for clone
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        const endDay = new Date(nextDay);
        endDay.setHours(endDay.getHours() + 4);

        body = JSON.stringify({
          newName: `${campaign.name} (Bản sao)`,
          newStartTime: nextDay.toISOString(),
          newEndTime: endDay.toISOString(),
        });
      }

      const res = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        setConfirmModal({ isOpen: false, type: 'publish', campaign: null });
        fetchData();
      } else {
        alert(resData?.error?.message || 'Có lỗi xảy ra khi thực hiện thao tác.');
      }
    } catch (err) {
      console.error(`Error performing ${action}:`, err);
      alert('Lỗi kết nối máy chủ.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper formatting
  const formatCurrency = (val?: number) => {
    return (val || 0).toLocaleString('vi-VN') + ' đ';
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) +
      ' ' +
      d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  };

  const formatTimeOnly = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Status Badge UI
  const renderStatusBadge = (status: FlashSaleRuntimeStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <Flame className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
            Đang chạy
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Sắp diễn ra
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
            Đã lên lịch
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Nháp
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Pause className="w-3.5 h-3.5 text-purple-600" />
            Tạm dừng
          </span>
        );
      case 'ENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
            Đã kết thúc
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-600 bg-slate-100">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6 pb-12 sm:pb-20">
      {/* ── HEADER & BREADCRUMB ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
            <span>Khuyến mãi</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-slate-800 font-semibold">Flash Sale</span>
          </div>
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <span className="p-1.5 sm:p-2 rounded-xl bg-red-50 text-[#da251d] border border-red-100 shrink-0">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 fill-[#da251d]" />
            </span>
            <span className="truncate">Flash Sale Center</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Quản lý chương trình Flash Sale, nhiều khung giờ Shopee-style, tồn kho độc quyền và hiệu quả bán hàng
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer min-h-[36px]"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Làm mới</span>
          </button>

          <div className="bg-slate-100 p-0.5 sm:p-1 rounded-xl flex items-center border border-slate-200">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition min-h-[32px] ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Danh sách</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition min-h-[32px] ${
                viewMode === 'timeline'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
          </div>

          <Link
            href="/admin/flash-sales/reports"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-xs font-bold text-white transition shadow-sm min-h-[36px]"
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Báo cáo tổng</span>
          </Link>

          <Link
            href="/admin/flash-sales/create"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#da251d] hover:bg-red-700 text-xs font-bold text-white transition shadow-sm shadow-red-600/25 min-h-[36px]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Tạo Flash Sale</span>
          </Link>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        {/* ── REALTIME ENTERPRISE KPI DASHBOARD ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2.5 md:gap-3.5">
          {/* Card 1: Đang chạy */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Đang chạy</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Flame className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {kpis?.activeCount ?? 0}
              </span>
              <span className="text-xs text-emerald-600 font-bold">chiến dịch</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Sắp tới: <strong className="text-slate-700">{kpis?.upcomingCount ?? 0}</strong>
            </div>
          </div>

          {/* Card 2: Doanh thu Flash Sale */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-[11px] sm:text-xs font-semibold">
              <span className="truncate">Doanh thu Flash</span>
              <span className="p-1 sm:p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2">
              <span className="text-sm sm:text-lg lg:text-xl font-black text-slate-900 block truncate">
                {formatCurrency(kpis?.totalRevenue)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-600 truncate">
              <ArrowUpRight className="w-3 h-3 shrink-0" />
              <span className="truncate">+{kpis?.revenueGrowth ?? 12.5}%</span>
            </div>
          </div>

          {/* Card 3: Đã bán & Tồn */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-[11px] sm:text-xs font-semibold">
              <span className="truncate">Món bán Flash</span>
              <span className="p-1 sm:p-1.5 rounded-lg bg-red-50 text-red-600">
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5">
              <span className="text-sm sm:text-lg lg:text-2xl font-black text-slate-900">
                {(kpis?.totalUnitsSold ?? 0).toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-500">phần</span>
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
              Tỷ lệ: <strong className="text-emerald-600 font-bold">{kpis?.sellThroughRate ?? 0}%</strong>
            </div>
          </div>

          {/* Card 4: Tổng đơn & Lượt mua */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-[11px] sm:text-xs font-semibold">
              <span className="truncate">Lượt mua</span>
              <span className="p-1 sm:p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5">
              <span className="text-sm sm:text-lg lg:text-2xl font-black text-slate-900">
                {(kpis?.totalOrders ?? 0).toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-500">đơn</span>
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
              Khách: <strong className="text-slate-700">{kpis?.totalBuyers ?? 0}</strong>
            </div>
          </div>

          {/* Card 5: Tổng tiền giảm giá */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-[11px] sm:text-xs font-semibold">
              <span className="truncate">Trợ giá khách</span>
              <span className="p-1 sm:p-1.5 rounded-lg bg-purple-50 text-purple-600">
                <Percent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2">
              <span className="text-sm sm:text-lg lg:text-xl font-black text-rose-600 block truncate">
                {formatCurrency(kpis?.totalDiscountAmount)}
              </span>
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
              Kích cầu F&B
            </div>
          </div>

          {/* Card 6: Doanh thu 30 ngày */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-[11px] sm:text-xs font-semibold">
              <span className="truncate">DT 30 ngày</span>
              <span className="p-1 sm:p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2">
              <span className="text-sm sm:text-lg lg:text-xl font-black text-slate-900 block truncate">
                {formatCurrency(kpis?.revenue30d)}
              </span>
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
              Hôm nay: <strong className="text-slate-800">{formatCurrency(kpis?.revenueToday)}</strong>
            </div>
          </div>
        </div>

        {/* ── FILTER & SEARCH BAR ── */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm Flash Sale..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition min-h-[40px]"
              />
            </div>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 sm:px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer min-h-[40px]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang chạy</option>
              <option value="UPCOMING">Sắp diễn ra</option>
              <option value="SCHEDULED">Đã lên lịch</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="PAUSED">Tạm dừng</option>
              <option value="ENDED">Đã kết thúc</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>

            {/* Branch Select */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-2.5 sm:px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer min-h-[40px]"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'today', label: 'Hôm nay' },
              { id: 'active', label: 'Đang chạy' },
              { id: 'upcoming', label: 'Sắp tới' },
              { id: 'ended', label: 'Kết thúc' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setDatePreset(preset.id);
                  if (preset.id === 'active') setStatusFilter('ACTIVE');
                  else if (preset.id === 'upcoming') setStatusFilter('UPCOMING');
                  else if (preset.id === 'ended') setStatusFilter('ENDED');
                  else if (preset.id === 'all') setStatusFilter('ALL');
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap min-h-[34px] ${
                  datePreset === preset.id
                    ? 'bg-red-50 text-[#da251d] border border-red-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT AREA ── */}
        {viewMode === 'list' ? (
          /* TABLE VIEW */
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="admin-scroll-table">
              <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Chương trình</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-3">Phạm vi áp dụng</th>
                    <th className="py-3 px-3 text-center">Khung giờ</th>
                    <th className="py-3 px-3 text-center">Món</th>
                    <th className="py-3 px-3">Thời gian</th>
                    <th className="py-3 px-3">Khung giờ hiện tại</th>
                    <th className="py-3 px-3 text-right">Tồn / Đã bán</th>
                    <th className="py-3 px-3 text-right">Doanh thu</th>
                    <th className="py-3 px-3">Người tạo</th>
                    <th className="py-3 px-4 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                        <span>Đang tải danh sách Flash Sale...</span>
                      </td>
                    </tr>
                  ) : campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <Tag className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-semibold text-slate-600">Không tìm thấy Flash Sale nào</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Hãy thử thay đổi bộ lọc hoặc bấm tạo mới chương trình
                        </p>
                        <Link
                          href="/admin/flash-sales/create"
                          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-[#da251d] text-white text-xs font-bold shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tạo Flash Sale ngay</span>
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((camp) => {
                      const soldPercent =
                        camp.totalStock && camp.totalStock > 0
                          ? Math.min(100, Math.round(((camp.totalSold || 0) / camp.totalStock) * 100))
                          : 0;

                      return (
                        <tr
                          key={camp.id}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => router.push(`/admin/flash-sales/${camp.id}`)}
                        >
                          {/* Program Name & Code */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center font-black text-xs shrink-0 border border-red-100">
                                <Zap className="w-4 h-4 fill-[#da251d]" />
                              </span>
                              <div>
                                <div className="font-bold text-slate-900 group-hover:text-[#da251d] transition flex items-center gap-1.5">
                                  <span>{camp.name}</span>
                                  {camp.isFeatured && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black">
                                      HOT
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  {camp.code}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Runtime Status Badge */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {renderStatusBadge(camp.runtimeStatus)}
                          </td>

                          {/* Branch Scope */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1 text-slate-600 font-medium">
                              <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[140px]" title={
                                !camp.branches || camp.branches.length === 0
                                  ? 'Toàn bộ chi nhánh'
                                  : camp.branches.map((b) => b.name).join(', ')
                              }>
                                {!camp.branches || camp.branches.length === 0
                                  ? 'Toàn hệ thống'
                                  : camp.branches.length === 1
                                  ? camp.branches[0].name
                                  : `${camp.branches.length} chi nhánh`}
                              </span>
                            </div>
                          </td>

                          {/* Slots Count */}
                          <td className="py-3.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                              {camp.slots?.length || 1} khung
                            </span>
                          </td>

                          {/* Items Count */}
                          <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                            {camp.items?.length || 0}
                          </td>

                          {/* Start - End Time */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="text-slate-800 font-medium">
                              {formatDateTime(camp.startTime)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              đến {formatDateTime(camp.endTime)}
                            </div>
                          </td>

                          {/* Current / Next Slot */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {camp.currentSlot ? (
                              <div className="text-emerald-700 font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {camp.currentSlot.name} (
                                {formatTimeOnly(camp.currentSlot.startTime)} -{' '}
                                {formatTimeOnly(camp.currentSlot.endTime)})
                              </div>
                            ) : camp.nextSlot ? (
                              <div className="text-amber-700 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Tiếp: {camp.nextSlot.name} (
                                {formatTimeOnly(camp.nextSlot.startTime)})
                              </div>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>

                          {/* Stock & Progress */}
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <div className="font-bold text-slate-900">
                              {camp.totalSold ?? 0} / {camp.totalStock ?? 0}
                            </div>
                            <div className="w-20 ml-auto bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                              <div
                                className="bg-[#da251d] h-full rounded-full transition-all"
                                style={{ width: `${soldPercent}%` }}
                              />
                            </div>
                          </td>

                          {/* Revenue */}
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <div className="font-bold text-slate-900">
                              {formatCurrency(camp.totalRevenue)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {camp.totalOrders ?? 0} lượt mua
                            </div>
                          </td>

                          {/* Created By */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="text-slate-800 font-medium">
                              {camp.createdBy?.fullName || 'Hệ thống'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(camp.createdAt).toLocaleDateString('vi-VN')}
                            </div>
                          </td>

                          {/* Actions - Condensed 3-Dots Dropdown */}
                          <td
                            className="py-3.5 px-4 text-center whitespace-nowrap relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === camp.id ? null : camp.id);
                                }}
                                className={`p-1.5 rounded-xl transition cursor-pointer ${
                                  openMenuId === camp.id
                                    ? 'bg-red-50 text-[#da251d] ring-2 ring-red-200'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                                title="Thao tác"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openMenuId === camp.id && (
                                <div
                                  className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 divide-y divide-slate-100 text-left animate-in fade-in zoom-in-95 duration-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Nhóm 1: Xem & Chỉnh sửa */}
                                  <div className="py-1">
                                    <Link
                                      href={`/admin/flash-sales/${camp.id}`}
                                      onClick={() => setOpenMenuId(null)}
                                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Xem chi tiết</span>
                                    </Link>

                                    <Link
                                      href={`/admin/flash-sales/${camp.id}/edit`}
                                      onClick={() => setOpenMenuId(null)}
                                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#da251d] transition"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Chỉnh sửa chiến dịch</span>
                                    </Link>

                                    <Link
                                      href={`/admin/flash-sales/${camp.id}/report`}
                                      onClick={() => setOpenMenuId(null)}
                                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition"
                                    >
                                      <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                                      <span>Báo cáo phân tích</span>
                                    </Link>
                                  </div>

                                  {/* Nhóm 2: Vận hành & Vòng đời */}
                                  <div className="py-1">
                                    {camp.runtimeStatus === 'DRAFT' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          handleLifecycleAction('publish', camp);
                                        }}
                                        disabled={actionLoadingId === camp.id}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                                      >
                                        <Play className="w-3.5 h-3.5 fill-emerald-600" />
                                        <span>Xuất bản chiến dịch</span>
                                      </button>
                                    )}

                                    {camp.runtimeStatus === 'ACTIVE' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          handleLifecycleAction('pause', camp);
                                        }}
                                        disabled={actionLoadingId === camp.id}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-purple-600 hover:bg-purple-50 transition cursor-pointer"
                                      >
                                        <Pause className="w-3.5 h-3.5 fill-purple-600" />
                                        <span>Tạm dừng chiến dịch</span>
                                      </button>
                                    )}

                                    {camp.runtimeStatus === 'PAUSED' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          handleLifecycleAction('resume', camp);
                                        }}
                                        disabled={actionLoadingId === camp.id}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                      >
                                        <Play className="w-3.5 h-3.5 fill-blue-600" />
                                        <span>Tiếp tục chạy</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        handleLifecycleAction('clone', camp);
                                      }}
                                      disabled={actionLoadingId === camp.id}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition cursor-pointer"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Nhân bản chiến dịch</span>
                                    </button>
                                  </div>

                                  {/* Nhóm 3: Hủy chiến dịch */}
                                  {(camp.runtimeStatus === 'ACTIVE' ||
                                    camp.runtimeStatus === 'SCHEDULED' ||
                                    camp.runtimeStatus === 'UPCOMING' ||
                                    camp.runtimeStatus === 'PAUSED') && (
                                    <div className="py-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          if (
                                            confirm(
                                              `Bạn có chắc chắn muốn kết thúc/hủy chiến dịch "${camp.name}" không? Sau khi hủy, chiến dịch sẽ dừng và không bị tính trùng lịch.`,
                                            )
                                          ) {
                                            handleLifecycleAction('cancel', camp);
                                          }
                                        }}
                                        disabled={actionLoadingId === camp.id}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                      >
                                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                        <span>Hủy / Kết thúc</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* 24-HOUR HOURLY TIMELINE CALENDAR VIEW */
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#da251d]" />
                  Timeline Khung Giờ Trong Ngày
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hiển thị trực quan lịch các Flash Sale slot theo 24 giờ để phát hiện ngay xung đột khung giờ
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600">Ngày hiển thị:</label>
                <input
                  type="date"
                  value={selectedTimelineDate}
                  onChange={(e) => setSelectedTimelineDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>
            </div>

            {/* 24h Grid */}
            <div className="relative border border-slate-200 rounded-xl bg-slate-50/50 p-4 overflow-x-auto min-w-[700px]">
              {/* Hour Headers */}
              <div className="grid grid-cols-12 gap-1 pb-3 text-center border-b border-slate-200 text-[11px] font-bold text-slate-500">
                <span>00:00 - 02:00</span>
                <span>02:00 - 04:00</span>
                <span>04:00 - 06:00</span>
                <span>06:00 - 08:00</span>
                <span>08:00 - 10:00</span>
                <span>10:00 - 12:00</span>
                <span>12:00 - 14:00</span>
                <span>14:00 - 16:00</span>
                <span>16:00 - 18:00</span>
                <span>18:00 - 20:00</span>
                <span>20:00 - 22:00</span>
                <span>22:00 - 24:00</span>
              </div>

              {/* Slots Visual Bars */}
              <div className="py-6 space-y-3">
                {timelineData.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Không có khung giờ Flash Sale nào trong ngày {selectedTimelineDate}
                  </div>
                ) : (
                  timelineData.map((slot: any) => {
                    const sHour = new Date(slot.startTime).getHours();
                    const eHour = new Date(slot.endTime).getHours() || 24;
                    const durationHours = Math.max(1, eHour - sHour);
                    const leftPercent = (sHour / 24) * 100;
                    const widthPercent = (durationHours / 24) * 100;

                    return (
                      <div key={slot.id} className="relative h-12 w-full bg-slate-100 rounded-xl">
                        <div
                          className={`absolute top-0 bottom-0 rounded-xl p-2.5 flex items-center justify-between text-xs font-bold text-white shadow-sm transition hover:brightness-110 cursor-pointer ${
                            slot.hasConflict
                              ? 'bg-rose-600 border-2 border-yellow-300 animate-pulse'
                              : slot.runtimeStatus === 'ACTIVE'
                              ? 'bg-[#da251d]'
                              : slot.runtimeStatus === 'UPCOMING'
                              ? 'bg-amber-500'
                              : 'bg-slate-700'
                          }`}
                          style={{
                            left: `${leftPercent}%`,
                            width: `${Math.max(widthPercent, 8)}%`,
                          }}
                          onClick={() => router.push(`/admin/flash-sales/${slot.flashSaleId}`)}
                          title={`${slot.name} (${formatTimeOnly(slot.startTime)} - ${formatTimeOnly(slot.endTime)})`}
                        >
                          <div className="truncate flex items-center gap-1.5">
                            {slot.hasConflict && (
                              <AlertTriangle className="w-4 h-4 text-yellow-300 shrink-0" />
                            )}
                            <span className="truncate">{slot.name}</span>
                          </div>
                          <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono shrink-0 ml-1">
                            {formatTimeOnly(slot.startTime)} - {formatTimeOnly(slot.endTime)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Timeline Legend */}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-200 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#da251d]" />
                  Đang diễn ra (Active)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  Sắp diễn ra (Upcoming)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-slate-700" />
                  Đã kết thúc (Ended)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-600 border border-yellow-300" />
                  Trùng lịch / Xung đột (Conflict)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
