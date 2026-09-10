'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Clock,
  Store,
  RotateCcw,
  Sparkles,
  Info,
  DollarSign,
  ShoppingBag,
  Percent,
  TrendingUp,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Tag,
  Truck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Package,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { PageHeader } from '@/app/admin/components/ui';

const CHART_COLORS = ['#800020', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

export default function SingleProductReportPage() {
  const params = useParams();
  const productId = params?.productId as string;
  const router = useRouter();
  const { selectedBranchId } = useAdmin();
  const { locale } = useLanguage();

  // Data States
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);

  // Filter States
  const [datePreset, setDatePreset] = useState<string>('30days');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>('ALL');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('VALID');
  const [trendGrouping, setTrendGrouping] = useState<'hour' | 'day' | 'week' | 'month'>('day');

  // Transactions Table State (Server-side Pagination & Sort)
  const [txLoading, setTxLoading] = useState(false);
  const [txData, setTxData] = useState<any>({ transactions: [], total: 0, page: 1, limit: 20, totalPages: 1 });
  const [txPage, setTxPage] = useState<number>(1);
  const [txLimit, setTxLimit] = useState<number>(20);
  const [txSortBy, setTxSortBy] = useState<string>('createdAt');
  const [txSortOrder, setTxSortOrder] = useState<'asc' | 'desc'>('desc');
  const [txSearch, setTxSearch] = useState<string>('');

  // Active Distribution Tab: 'branch' | 'channel' | 'orderType'
  const [activeDistTab, setActiveDistTab] = useState<'branch' | 'channel' | 'orderType'>('channel');

  // Fetch Single Product Report
  const fetchProductReport = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set('from', fromDate);
      if (toDate) q.set('to', toDate);
      if (branchFilter && branchFilter !== 'ALL') q.set('branchId', branchFilter);
      if (orderSourceFilter && orderSourceFilter !== 'ALL') q.set('orderSource', orderSourceFilter);
      if (orderTypeFilter && orderTypeFilter !== 'ALL') q.set('orderType', orderTypeFilter);
      if (orderStatusFilter && orderStatusFilter !== 'VALID') q.set('orderStatus', orderStatusFilter);
      q.set('trendGrouping', trendGrouping);

      const res = await fetch(`/api/admin/reports/products/${productId}?${q.toString()}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error('Error fetching single product report:', err);
    } finally {
      setLoading(false);
    }
  }, [productId, fromDate, toDate, branchFilter, orderSourceFilter, orderTypeFilter, orderStatusFilter, trendGrouping]);

  // Fetch Transactions List (Server-side Paginated)
  const fetchTransactions = useCallback(async () => {
    if (!productId) return;
    setTxLoading(true);
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set('from', fromDate);
      if (toDate) q.set('to', toDate);
      if (branchFilter && branchFilter !== 'ALL') q.set('branchId', branchFilter);
      if (orderSourceFilter && orderSourceFilter !== 'ALL') q.set('orderSource', orderSourceFilter);
      if (orderTypeFilter && orderTypeFilter !== 'ALL') q.set('orderType', orderTypeFilter);
      if (orderStatusFilter && orderStatusFilter !== 'VALID') q.set('orderStatus', orderStatusFilter);
      if (txSearch.trim()) q.set('search', txSearch.trim());
      q.set('page', String(txPage));
      q.set('limit', String(txLimit));
      q.set('sortBy', txSortBy);
      q.set('sortOrder', txSortOrder);

      const res = await fetch(`/api/admin/reports/products/${productId}/transactions?${q.toString()}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        setTxData(json.data);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setTxLoading(false);
    }
  }, [productId, fromDate, toDate, branchFilter, orderSourceFilter, orderTypeFilter, orderStatusFilter, txSearch, txPage, txLimit, txSortBy, txSortOrder]);

  useEffect(() => {
    fetchProductReport();
  }, [fetchProductReport]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Presets
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
      setFromDate(y.toISOString().split('T')[0]);
      setToDate(todayStr);
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
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const q = new URLSearchParams();
      if (fromDate) q.set('from', fromDate);
      if (toDate) q.set('to', toDate);
      if (branchFilter && branchFilter !== 'ALL') q.set('branchId', branchFilter);
      if (orderSourceFilter && orderSourceFilter !== 'ALL') q.set('orderSource', orderSourceFilter);
      if (orderTypeFilter && orderTypeFilter !== 'ALL') q.set('orderType', orderTypeFilter);
      if (orderStatusFilter && orderStatusFilter !== 'VALID') q.set('orderStatus', orderStatusFilter);

      const res = await fetch(`/api/admin/reports/products/${productId}/export?${q.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_BaoCao_${info?.itemCode || productId}_${fromDate}_den_${toDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Không thể xuất file Excel. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  // Format Currency
  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const info = data?.currentProductInfo;
  const kpis = data?.kpis;
  const priceBreakdown = data?.priceBreakdown || [];
  const vatBreakdown = data?.vatBreakdown || [];
  const optionBreakdown = data?.optionBreakdown || [];
  const branchBreakdown = data?.branchBreakdown || [];
  const channelBreakdown = data?.channelBreakdown || [];
  const orderTypeBreakdown = data?.orderTypeBreakdown || [];
  const trendBreakdown = data?.trendBreakdown || [];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* 1. Header with Breadcrumb & Back button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/reports/products"
            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 transition-colors shadow-2xs"
            title="Quay lại Báo cáo tổng hợp"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
              <Link href="/admin/reports" className="hover:text-slate-800">
                Báo cáo
              </Link>
              <span>/</span>
              <Link href="/admin/reports/products" className="hover:text-slate-800">
                Mặt hàng
              </Link>
              <span>/</span>
              <span className="text-slate-700 font-semibold">{info?.name || 'Chi tiết'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>{info?.name || 'Báo cáo chi tiết mặt hàng'}</span>
              {info?.itemCode && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  {info.itemCode}
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchProductReport();
              fetchTransactions();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl shadow-2xs transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting || loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#800020] hover:bg-[#6b001b] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            <Download size={15} className={exporting ? 'animate-bounce' : ''} />
            <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
          </button>
        </div>
      </div>

      {/* 2. Hero Product Info Banner (Current info vs Historical Note) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-100 overflow-hidden relative border border-slate-200 shrink-0">
            {info?.imageUrl ? (
              <Image src={info.imageUrl} alt={info.name} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Package size={28} />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#800020]/10 text-[#800020]">
                {info?.category?.name || 'Danh mục'}
              </span>
              <span className="text-xs text-slate-500 font-medium">Đơn vị: {info?.unit || 'phần'}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">{info?.name}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
              <span>
                Giá niêm yết hiện tại:{' '}
                <strong className="text-slate-900">{formatMoney(info?.currentPrice || 0)}</strong>
              </span>
              <span>•</span>
              <span>
                Thuế VAT hiện tại:{' '}
                <strong className="text-slate-900">{info?.currentTaxPercentage || 0}%</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Historical snapshot integrity callout */}
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 max-w-md">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950">Thông tin niêm yết hiện tại</p>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                Mọi chỉ số doanh số, giá bán và thuế trong báo cáo lịch sử bên dưới được tính toán 100% dựa trên
                snapshot tại thời điểm phát sinh đơn hàng.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center gap-3 flex-wrap text-xs">
        {/* Presets */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl font-semibold text-slate-600">
          {[
            { id: 'today', label: 'Hôm nay' },
            { id: '7days', label: '7 ngày' },
            { id: '30days', label: '30 ngày' },
            { id: 'thisMonth', label: 'Tháng này' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                datePreset === p.id ? 'bg-white text-[#800020] shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date Inputs */}
        <div className="flex items-center gap-1.5 text-slate-600 border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50">
          <Calendar size={13} className="text-slate-400" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setDatePreset('custom');
              setFromDate(e.target.value);
            }}
            className="bg-transparent border-none outline-none font-medium"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setDatePreset('custom');
              setToDate(e.target.value);
            }}
            className="bg-transparent border-none outline-none font-medium"
          />
        </div>

        {/* Channel Filter */}
        <select
          value={orderSourceFilter}
          onChange={(e) => setOrderSourceFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-medium"
        >
          <option value="ALL">Tất cả kênh bán</option>
          <option value="POS">POS Bán hàng</option>
          <option value="ONLINE">Online Website</option>
          <option value="QR_ORDER">QR Order tại bàn</option>
          <option value="CHATBOT">AI Chatbot</option>
          <option value="VOICE">Voice Call</option>
        </select>

        {/* Order Type Filter */}
        <select
          value={orderTypeFilter}
          onChange={(e) => setOrderTypeFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-medium"
        >
          <option value="ALL">Tất cả loại đơn</option>
          <option value="DINE_IN">Tại bàn (Dine-in)</option>
          <option value="TAKEAWAY">Mang đi (Takeaway)</option>
          <option value="DELIVERY">Giao hàng (Delivery)</option>
        </select>

        {/* Order Status */}
        <select
          value={orderStatusFilter}
          onChange={(e) => setOrderStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-medium"
        >
          <option value="VALID">Đơn hợp lệ (loại hủy)</option>
          <option value="ALL">Tất cả trạng thái</option>
          <option value="COMPLETED">Đã hoàn thành</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </div>

      {/* 4. Single Product KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <DetailKpiCard
          title="Tổng số lượng bán"
          value={kpis?.totalSoldQuantity || 0}
          unit={info?.unit || 'phần'}
          formula="SUM(OrderItem.quantity) của món ăn trong kỳ"
          icon={<ShoppingBag size={18} className="text-blue-600" />}
          bgColor="bg-blue-50/60"
        />
        <DetailKpiCard
          title="Số đơn hàng có món"
          value={kpis?.totalOrderCount || 0}
          unit="đơn"
          formula="COUNT(DISTINCT OrderId) có chứa món này"
          icon={<Layers size={18} className="text-indigo-600" />}
          bgColor="bg-indigo-50/60"
        />
        <DetailKpiCard
          title="Giá bán trung bình"
          value={formatMoney(kpis?.avgUnitPrice || 0)}
          formula="Doanh thu có VAT / Tổng số lượng bán"
          icon={<DollarSign size={18} className="text-teal-600" />}
          bgColor="bg-teal-50/60"
        />
        <DetailKpiCard
          title="Giá bán thấp - cao nhất"
          value={`${formatMoney(kpis?.minSoldPrice || 0)} - ${formatMoney(kpis?.maxSoldPrice || 0)}`}
          formula="Biên độ giá thực tế tại thời điểm phát sinh đơn"
          icon={<TrendingUp size={18} className="text-purple-600" />}
          bgColor="bg-purple-50/60"
        />
        <DetailKpiCard
          title="Doanh thu Option"
          value={formatMoney(kpis?.optionRevenue || 0)}
          formula="Tổng tiền khách trả thêm cho các tùy chọn kèm theo món này"
          icon={<Sparkles size={18} className="text-emerald-600" />}
          bgColor="bg-emerald-50/60"
        />
        <DetailKpiCard
          title="Doanh thu có VAT"
          value={formatMoney(kpis?.productRevenueWithTax || 0)}
          formula="Tổng doanh thu sau giảm giá đã bao gồm thuế VAT"
          icon={<DollarSign size={18} className="text-[#800020]" />}
          bgColor="bg-[#800020]/10"
          highlight
        />
      </div>

      {/* Secondary Financial Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
        <MiniCard title="Tiền trước giảm" value={formatMoney(kpis?.grossProductSales || 0)} />
        <MiniCard title="Giảm trực tiếp" value={formatMoney(kpis?.directItemDiscount || 0)} />
        <MiniCard title="Voucher phân bổ" value={formatMoney(kpis?.allocatedOrderDiscount || 0)} />
        <MiniCard title="Tổng giảm món" value={formatMoney(kpis?.totalProductDiscount || 0)} />
        <MiniCard title="Doanh thu sau giảm" value={formatMoney(kpis?.netProductSalesAfterDiscount || 0)} />
        <MiniCard title="Doanh thu chưa VAT" value={formatMoney(kpis?.productRevenueBeforeTax || 0)} />
        <MiniCard title="Tiền thuế VAT" value={formatMoney(kpis?.productTaxAmount || 0)} />
        <MiniCard
          title="SL Flash Sale"
          value={`${kpis?.flashSaleQuantity || 0} (${formatMoney(kpis?.flashSaleRevenue || 0)})`}
        />
      </div>

      {/* 5. Deep-dive Modular Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module A: Price Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Tag size={16} className="text-[#800020]" />
            Phân rã Mức Giá Bán Thực Tế
          </h3>
          <p className="text-[11px] text-slate-500">Các mức giá món đã được khách mua trong lịch sử</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 font-bold text-slate-600 bg-slate-50/70">
                  <th className="py-2 px-2">Giá bán lúc mua</th>
                  <th className="py-2 px-2">Loại giá</th>
                  <th className="py-2 px-2 text-right">SL bán</th>
                  <th className="py-2 px-2 text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {priceBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      Chưa có dữ liệu
                    </td>
                  </tr>
                ) : (
                  priceBreakdown.map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2 px-2 font-semibold text-slate-900">{formatMoney(p.price)}</td>
                      <td className="py-2 px-2">
                        {p.type === 'FLASH_SALE' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Flash Sale
                          </span>
                        ) : p.type === 'PROMO' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800">
                            Khuyến mãi
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            Giá thường
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-medium">{p.quantity}</td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900">
                        {formatMoney(p.netRevenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Module B: VAT Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Percent size={16} className="text-[#800020]" />
            Phân rã Thuế VAT Lịch Sử
          </h3>
          <p className="text-[11px] text-slate-500">Mức thuế suất và kiểu giá áp dụng theo từng đơn</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 font-bold text-slate-600 bg-slate-50/70">
                  <th className="py-2 px-2">Thuế suất</th>
                  <th className="py-2 px-2">Kiểu giá</th>
                  <th className="py-2 px-2 text-right">SL bán</th>
                  <th className="py-2 px-2 text-right">Tiền thuế VAT</th>
                  <th className="py-2 px-2 text-right">Tổng có VAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vatBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      Chưa có dữ liệu
                    </td>
                  </tr>
                ) : (
                  vatBreakdown.map((v: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2 px-2 font-bold text-purple-700">{v.taxPercentage}%</td>
                      <td className="py-2 px-2 text-slate-600">
                        {v.vatPriceMode === 'VAT_INCLUDED' ? 'Giá gồm VAT' : 'Giá chưa VAT'}
                      </td>
                      <td className="py-2 px-2 text-right font-medium">{v.quantity}</td>
                      <td className="py-2 px-2 text-right text-purple-600 font-medium">
                        {formatMoney(v.taxAmount)}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900">
                        {formatMoney(v.totalAmountWithTax)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Module C: Option Attach Rate */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={16} className="text-[#800020]" />
            Tùy Chọn Món & Tỷ Lệ Đính Kèm (Attach Rate)
          </h3>
          <p className="text-[11px] text-slate-500">Mức độ khách hàng chọn thêm các options</p>

          <div className="overflow-x-auto max-h-[220px]">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 font-bold text-slate-600 bg-slate-50/70">
                  <th className="py-2 px-2">Tên tùy chọn</th>
                  <th className="py-2 px-2 text-right">Lượt chọn</th>
                  <th className="py-2 px-2 text-right">Phụ thu TB</th>
                  <th className="py-2 px-2 text-right">Doanh thu</th>
                  <th className="py-2 px-2 text-right">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {optionBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      Món ăn không có tùy chọn hoặc chưa có lượt chọn option
                    </td>
                  </tr>
                ) : (
                  optionBreakdown.map((opt: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2 px-2 font-medium text-slate-800">{opt.optionName}</td>
                      <td className="py-2 px-2 text-right">{opt.selectionCount}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{formatMoney(opt.avgPriceAdjustment)}</td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-700">
                        {formatMoney(opt.totalOptionRevenue)}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-slate-700">
                        {opt.attachRatePercent}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. Multi-dimensional Distribution & Trend Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Distribution Tabs (Branch / Channel / OrderType) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Phân Phối Bán Hàng Đa Chiều</h3>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setActiveDistTab('channel')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeDistTab === 'channel' ? 'bg-white text-[#800020] shadow-xs' : 'text-slate-500'
                }`}
              >
                Kênh bán
              </button>
              <button
                onClick={() => setActiveDistTab('orderType')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeDistTab === 'orderType' ? 'bg-white text-[#800020] shadow-xs' : 'text-slate-500'
                }`}
              >
                Loại phục vụ
              </button>
              <button
                onClick={() => setActiveDistTab('branch')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeDistTab === 'branch' ? 'bg-white text-[#800020] shadow-xs' : 'text-slate-500'
                }`}
              >
                Chi nhánh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 font-bold text-slate-600 bg-slate-50/70">
                  <th className="py-2.5 px-3">Phân nhóm</th>
                  <th className="py-2.5 px-2 text-right">SL bán</th>
                  <th className="py-2.5 px-2 text-right">Số đơn</th>
                  <th className="py-2.5 px-2 text-right">Doanh thu</th>
                  <th className="py-2.5 px-3 text-right">% Đóng góp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeDistTab === 'channel' &&
                  channelBreakdown.map((ch: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-semibold text-slate-800">{ch.channel}</td>
                      <td className="py-2 px-2 text-right font-medium">{ch.quantity}</td>
                      <td className="py-2 px-2 text-right text-slate-500">{ch.orderCount}</td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900">{formatMoney(ch.revenue)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-[#800020]">{ch.contributionPercent}%</td>
                    </tr>
                  ))}
                {activeDistTab === 'orderType' &&
                  orderTypeBreakdown.map((ot: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-semibold text-slate-800">{ot.orderType}</td>
                      <td className="py-2 px-2 text-right font-medium">{ot.quantity}</td>
                      <td className="py-2 px-2 text-right text-slate-500">{ot.orderCount}</td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900">{formatMoney(ot.revenue)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-[#800020]">{ot.contributionPercent}%</td>
                    </tr>
                  ))}
                {activeDistTab === 'branch' &&
                  branchBreakdown.map((b: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-semibold text-slate-800">{b.branchName}</td>
                      <td className="py-2 px-2 text-right font-medium">{b.quantity}</td>
                      <td className="py-2 px-2 text-right text-slate-500">{b.orderCount}</td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900">{formatMoney(b.revenue)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-[#800020]">{b.contributionPercent}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Sales Trend Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Diễn Biến Doanh Thu Theo Thời Gian</h3>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              {[
                { id: 'hour', label: 'Giờ' },
                { id: 'day', label: 'Ngày' },
                { id: 'week', label: 'Tuần' },
                { id: 'month', label: 'Tháng' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTrendGrouping(t.id as any)}
                  className={`px-2 py-1 rounded-md transition-all ${
                    trendGrouping === t.id ? 'bg-white text-[#800020] shadow-xs' : 'text-slate-500'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64">
            {trendBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendBreakdown}>
                  <defs>
                    <linearGradient id="colorProdTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#800020" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#800020" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} tickFormatter={(p) => p.slice(5)} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
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
                    fill="url(#colorProdTrend)"
                    name="Doanh thu"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Chưa có dữ liệu xu hướng trong khoảng thời gian này
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. Granular OrderItem Transaction History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers size={17} className="text-[#800020]" />
              Lịch Sử Chi Tiết Từng Lần Bán Mặt Hàng
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mỗi dòng thể hiện 1 OrderItem thực tế. Có thể tìm theo mã đơn, sắp xếp theo cột và phân trang server-side.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Order Code */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã đơn hàng..."
                value={txSearch}
                onChange={(e) => {
                  setTxSearch(e.target.value);
                  setTxPage(1);
                }}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#800020]/20"
              />
            </div>

            {/* Page Size */}
            <select
              value={txLimit}
              onChange={(e) => {
                setTxLimit(Number(e.target.value));
                setTxPage(1);
              }}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-medium"
            >
              <option value={10}>10 dòng/trang</option>
              <option value={20}>20 dòng/trang</option>
              <option value={50}>50 dòng/trang</option>
              <option value={100}>100 dòng/trang</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 min-w-[130px]">Thời gian</th>
                <th className="py-2.5 px-2 min-w-[100px]">Mã đơn</th>
                <th className="py-2.5 px-2 min-w-[120px]">Chi nhánh</th>
                <th className="py-2.5 px-2 min-w-[80px]">Kênh</th>
                <th className="py-2.5 px-2 min-w-[80px]">Loại đơn</th>
                <th className="py-2.5 px-2 min-w-[110px]">Khách hàng</th>
                <th className="py-2.5 px-2 text-right min-w-[50px]">SL</th>
                <th className="py-2.5 px-2 text-right min-w-[85px]">Giá bán</th>
                <th className="py-2.5 px-2 min-w-[130px]">Tùy chọn (Option)</th>
                <th className="py-2.5 px-2 text-right min-w-[85px]">Tiền Option</th>
                <th className="py-2.5 px-2 text-right min-w-[95px]">Trước giảm</th>
                <th className="py-2.5 px-2 text-right min-w-[80px]">Giảm món</th>
                <th className="py-2.5 px-2 text-right min-w-[85px]">Voucher đơn</th>
                <th className="py-2.5 px-2 text-right min-w-[95px]">Sau giảm</th>
                <th className="py-2.5 px-2 text-center min-w-[60px]">VAT %</th>
                <th className="py-2.5 px-2 text-right min-w-[75px]">Tiền VAT</th>
                <th className="py-2.5 px-2 text-right min-w-[100px] bg-slate-200/50">Có VAT</th>
                <th className="py-2.5 px-2 text-center min-w-[70px]">Flash Sale</th>
                <th className="py-2.5 px-2 text-right min-w-[85px]">Ship của đơn*</th>
                <th className="py-2.5 px-2 min-w-[80px]">PT Thanh toán</th>
                <th className="py-2.5 px-3 min-w-[90px]">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txLoading ? (
                <tr>
                  <td colSpan={21} className="py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#800020]" />
                    <span>Đang tải danh sách giao dịch...</span>
                  </td>
                </tr>
              ) : txData.transactions.length === 0 ? (
                <tr>
                  <td colSpan={21} className="py-12 text-center text-slate-400">
                    Không tìm thấy giao dịch nào trong điều kiện lọc
                  </td>
                </tr>
              ) : (
                txData.transactions.map((tx: any) => (
                  <tr key={tx.orderItemId} className="hover:bg-slate-50/70 transition-colors text-slate-700">
                    <td className="py-2 px-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : '-'}
                    </td>
                    <td className="py-2 px-2 font-mono font-bold text-blue-600 hover:underline">
                      <Link href={`/admin/orders/${tx.orderId}`} target="_blank" className="flex items-center gap-1">
                        <span>{tx.orderCode}</span>
                        <ExternalLink size={10} />
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-slate-600 truncate max-w-[130px]">{tx.branchName}</td>
                    <td className="py-2 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {tx.orderSource}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-600 text-[11px]">{tx.orderType}</td>
                    <td className="py-2 px-2 text-slate-800 font-medium truncate max-w-[120px]">
                      {tx.customerName}
                    </td>
                    <td className="py-2 px-2 text-right font-bold">{tx.quantity}</td>
                    <td className="py-2 px-2 text-right">{formatMoney(tx.priceAtSale)}</td>
                    <td className="py-2 px-2 text-slate-600 text-[11px] truncate max-w-[150px]">
                      {tx.optionsTextSnapshot || <span className="text-slate-300">Không</span>}
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-600 font-medium">
                      {formatMoney(tx.totalOptionRevenue)}
                    </td>
                    <td className="py-2 px-2 text-right font-medium">{formatMoney(tx.grossLineTotal)}</td>
                    <td className="py-2 px-2 text-right text-rose-600 font-medium">
                      {formatMoney(tx.totalDirectDiscount)}
                    </td>
                    <td className="py-2 px-2 text-right text-orange-600 font-medium">
                      {formatMoney(tx.allocatedOrderDiscount)}
                    </td>
                    <td className="py-2 px-2 text-right font-medium">{formatMoney(tx.netAmountAfterDiscount)}</td>
                    <td className="py-2 px-2 text-center text-purple-700 font-semibold">{tx.taxPercentage}%</td>
                    <td className="py-2 px-2 text-right text-purple-600 font-medium">{formatMoney(tx.taxAmount)}</td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900 bg-slate-100/60">
                      {formatMoney(tx.revenueWithTax)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {tx.isFlashSaleItem ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          FS
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-500 font-mono text-[11px]">
                      {formatMoney(tx.orderNetShippingFee)}
                    </td>
                    <td className="py-2 px-2 text-[11px] text-slate-600">{tx.paymentMethod}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          tx.orderStatus === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tx.orderStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server-side Pagination Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
          <span>
            Hiển thị <strong>{(txPage - 1) * txLimit + 1}</strong> -{' '}
            <strong>{Math.min(txPage * txLimit, txData.total)}</strong> trên tổng số{' '}
            <strong>{txData.total}</strong> lượt bán
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTxPage((p) => Math.max(1, p - 1))}
              disabled={txPage <= 1 || txLoading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-medium">
              Trang {txPage} / {txData.totalPages}
            </span>
            <button
              onClick={() => setTxPage((p) => Math.min(txData.totalPages, p + 1))}
              disabled={txPage >= txData.totalPages || txLoading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   DETAIL KPI SUB-COMPONENTS
   ========================================================================== */

function DetailKpiCard({ title, value, unit, formula, icon, bgColor, highlight = false }: any) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className={`p-3.5 rounded-2xl border text-xs relative ${bgColor} ${
        highlight ? 'border-[#800020]/30 ring-2 ring-[#800020]/20 shadow-xs' : 'border-slate-200/80 shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-slate-600 truncate pr-1">{title}</span>
        <div className="flex items-center gap-1">
          {icon}
          <div
            className="cursor-pointer text-slate-400 hover:text-slate-600"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info size={12} />
            {showTooltip && (
              <div className="absolute z-50 bottom-full right-0 mb-2 w-52 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl pointer-events-none">
                <p className="font-bold text-amber-300 mb-0.5">Công thức:</p>
                <p>{formula}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">{value}</span>
        {unit && <span className="text-[10px] font-semibold text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="p-2 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
      <div className="text-[10px] text-slate-400 font-medium truncate mb-0.5">{title}</div>
      <div className="font-bold text-slate-800 truncate text-xs">{value}</div>
    </div>
  );
}
