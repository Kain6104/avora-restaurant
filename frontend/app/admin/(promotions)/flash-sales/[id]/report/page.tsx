'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  Zap,
  TrendingUp,
  ShoppingBag,
  Users,
  Percent,
  Flame,
  Award,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Store,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import {
  FlashSaleReportKPI,
  FlashSaleFunnel,
  FlashSaleSlotPerformance,
  FlashSaleProductPerformance,
  FlashSaleBranchPerformance,
} from '@/types/flash-sale';

interface CampaignReportPageProps {
  params: Promise<{ id: string }>;
}

export default function CampaignReportPage({ params }: CampaignReportPageProps) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/flash-sales/${id}/report`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      }
    } catch (err) {
      console.error('Error fetching flash sale report:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await fetch(`/api/admin/flash-sales/${id}/report/export`, {
        credentials: 'include',
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FlashSale_Report_${data?.campaign?.code || id}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Không thể xuất file Excel.');
      }
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (val?: number) => {
    return (val || 0).toLocaleString('vi-VN') + ' đ';
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <BarChart3 className="w-10 h-10 text-[#da251d] animate-bounce mx-auto mb-3" />
          <p className="font-bold text-slate-700">Đang khởi tạo báo cáo phân tích Flash Sale...</p>
        </div>
      </div>
    );
  }

  const kpi: FlashSaleReportKPI = {
    grossSales: data.kpis?.grossSales || 0,
    netRevenue: data.kpis?.netRevenue || 0,
    totalDiscount: data.kpis?.totalDiscount ?? data.kpis?.totalDiscountAmount ?? 0,
    totalOrders: data.kpis?.totalOrders ?? data.kpis?.totalOrdersCount ?? 0,
    successfulOrders: data.kpis?.successfulOrders ?? data.kpis?.completedOrdersCount ?? 0,
    cancelledOrders: data.kpis?.cancelledOrders ?? data.kpis?.cancelledOrdersCount ?? 0,
    cancellationRate: data.kpis?.cancellationRate || 0,
    totalUnitsSold: data.kpis?.totalUnitsSold || 0,
    totalFlashStock: data.kpis?.totalFlashStock ?? data.kpis?.totalStock ?? 0,
    sellThroughRate: data.kpis?.sellThroughRate || 0,
    soldOutProductsCount: data.kpis?.soldOutProductsCount || 0,
    uniqueBuyers: data.kpis?.uniqueBuyers ?? data.kpis?.uniqueBuyersCount ?? 0,
    averageOrderValue: data.kpis?.averageOrderValue ?? data.kpis?.aov ?? 0,
    averageItemsPerBuyer: data.kpis?.averageItemsPerBuyer ?? data.kpis?.avgItemsPerBuyer ?? 0,
    averageSpendingPerBuyer: data.kpis?.averageSpendingPerBuyer ?? data.kpis?.avgSpendingPerBuyer ?? 0,
  };

  const funnel: FlashSaleFunnel = {
    impressions: data.funnel?.impressions || 0,
    productViews: data.funnel?.productViews || 0,
    addToCart: data.funnel?.addToCart || 0,
    checkouts: data.funnel?.checkouts || 0,
    purchased: data.funnel?.purchased || 0,
    conversionRate: data.funnel?.conversionRate || 0,
  };

  const slotPerformances: FlashSaleSlotPerformance[] =
    data.slotPerformances || data.slotPerformance || [];
  const productPerformances: FlashSaleProductPerformance[] =
    data.productPerformances || data.productRanking || [];
  const branchPerformances: FlashSaleBranchPerformance[] =
    data.branchPerformances || data.branchPerformance || [];
  const hourlyRevenue = data.hourlyRevenue || [];
  const insights: string[] = data.insights || [];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-20">
      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/admin/flash-sales/${id}`}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Link href="/admin/flash-sales" className="hover:underline">
                    Flash Sale
                  </Link>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <Link href={`/admin/flash-sales/${id}`} className="hover:underline font-bold">
                    {data.campaign?.name}
                  </Link>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-800 font-semibold">Báo cáo hiệu quả</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 mt-0.5">
                  <BarChart3 className="w-6 h-6 text-[#da251d]" />
                  <span>Flash Sale Analytics Center</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* ── SMART INSIGHTS ALERT BOX ── */}
        {insights.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-amber-50 rounded-2xl p-4 border border-red-200/80 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-black text-[#da251d] uppercase tracking-wider mb-2">
              <Zap className="w-4 h-4 fill-[#da251d]" />
              <span>Smart Performance Insights</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-700 font-medium">
              {insights.map((ins, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-red-100">
                  <CheckCircle2 className="w-4 h-4 text-[#da251d] shrink-0 mt-0.5" />
                  <span>{ins}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CORE REVENUE & KPI GRID ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-semibold">Doanh thu thuần</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {formatCurrency(kpi.netRevenue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Doanh thu gộp: {formatCurrency(kpi.grossSales)}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-semibold">Tổng tiền giảm</span>
            <div className="text-lg sm:text-xl font-black text-rose-600 mt-1">
              {formatCurrency(kpi.totalDiscount)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Trợ giá kích cầu</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-semibold">Đơn hoàn tất</span>
            <div className="text-lg sm:text-xl font-black text-emerald-600 mt-1">
              {kpi.successfulOrders} / {kpi.totalOrders}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Hủy: {kpi.cancelledOrders} ({kpi.cancellationRate}%)
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-semibold">Tỷ lệ bán hết</span>
            <div className="text-lg sm:text-xl font-black text-[#da251d] mt-1">
              {kpi.sellThroughRate}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {kpi.totalUnitsSold} / {kpi.totalFlashStock} phần
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-semibold">Khách mua hàng</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {kpi.uniqueBuyers}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              TB {kpi.averageItemsPerBuyer} món/khách
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-semibold">Giá trị đơn TB (AOV)</span>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {formatCurrency(kpi.averageOrderValue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              TB chi tiêu: {formatCurrency(kpi.averageSpendingPerBuyer)}
            </div>
          </div>
        </div>

        {/* ── CONVERSION FUNNEL & HOURLY CHART ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Conversion Funnel (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Flash Sale Conversion Funnel
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Phễu chuyển đổi từ tiếp cận đến đơn hàng thành công
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                { label: 'Lượt tiếp cận (Impression)', val: funnel.impressions, color: 'bg-slate-200' },
                { label: 'Xem chi tiết món (Product View)', val: funnel.productViews, color: 'bg-blue-300' },
                { label: 'Thêm vào giỏ (Add to Cart)', val: funnel.addToCart, color: 'bg-amber-300' },
                { label: 'Tiến hành Checkout', val: funnel.checkouts, color: 'bg-orange-400' },
                { label: 'Mua thành công (Purchased)', val: funnel.purchased, color: 'bg-[#da251d]' },
              ].map((step, idx) => {
                const percentOfFirst =
                  funnel.impressions > 0
                    ? Math.round((step.val / funnel.impressions) * 100)
                    : 100;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">{step.label}</span>
                      <span className="font-bold text-slate-900">{step.val.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div
                        className={`${step.color} h-full rounded-full transition-all`}
                        style={{ width: `${Math.max(percentOfFirst, 5)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Tỷ lệ chuyển đổi chung:</span>
                <span className="font-black text-[#da251d] text-sm">{funnel.conversionRate}%</span>
              </div>
            </div>
          </div>

          {/* Hourly Revenue Chart (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Biểu đồ Doanh Thu Theo Giờ
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Diễn biến dòng tiền phát sinh theo các mốc thời gian trong chiến dịch
                </p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#da251d" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#da251d" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(val) => `${(val / 1000).toLocaleString()}k`}
                  />
                  <RechartsTooltip
                    formatter={(val: any) => [formatCurrency(val), 'Doanh thu']}
                    labelFormatter={(label) => `Khung giờ: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#da251d"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── SLOT PERFORMANCE TABLE ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#da251d]" />
            <span>Hiệu quả từng khung giờ (Slot Performance)</span>
          </h3>

          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Khung giờ</th>
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3 text-right">Doanh thu</th>
                  <th className="py-3 px-3 text-center">Đơn hàng</th>
                  <th className="py-3 px-3 text-right">Số món bán</th>
                  <th className="py-3 px-3 text-center">Tỷ lệ bán</th>
                  <th className="py-3 px-3 text-right">Khách mua</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slotPerformances.map((slot) => (
                  <tr key={slot.slotId} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-bold text-slate-900">{slot.slotName}</td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(slot.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(slot.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      {formatCurrency(slot.revenue)}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">
                      {slot.ordersCount}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">
                      {slot.unitsSold} / {slot.flashStock}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                        {slot.sellThroughRate}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-700">
                      {slot.uniqueBuyers}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── PRODUCT PERFORMANCE RANKING ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Xếp hạng sản phẩm bán chạy (Product Ranking)</span>
          </h3>

          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Xếp hạng</th>
                  <th className="py-3 px-4">Sản phẩm</th>
                  <th className="py-3 px-3 text-right">Giá gốc</th>
                  <th className="py-3 px-3 text-right">Giá Flash</th>
                  <th className="py-3 px-3 text-center">% Giảm</th>
                  <th className="py-3 px-3 text-right">Đã bán / Tồn</th>
                  <th className="py-3 px-3 text-center">Tỷ lệ</th>
                  <th className="py-3 px-3 text-right">Doanh thu</th>
                  <th className="py-3 px-3 text-right">Lượt mua</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productPerformances.map((prod, idx) => (
                  <tr key={prod.productId} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-900'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{prod.productName}</td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      {formatCurrency(prod.regularPrice)}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-[#da251d]">
                      {formatCurrency(prod.flashSalePrice)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#da251d] font-bold">
                        -{prod.discountPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">
                      {prod.sold} / {prod.stock}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-emerald-600">{prod.sellThroughRate}%</span>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      {formatCurrency(prod.revenue)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-700">
                      {prod.ordersCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── BRANCH PERFORMANCE COMPARISON ── */}
        {branchPerformances.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Store className="w-4 h-4 text-indigo-600" />
              <span>Hiệu quả theo Chi nhánh (Branch Performance)</span>
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Chi nhánh</th>
                    <th className="py-3 px-3 text-right">Doanh thu</th>
                    <th className="py-3 px-3 text-center">Đơn hàng</th>
                    <th className="py-3 px-3 text-right">Số món bán</th>
                    <th className="py-3 px-3 text-right">Khách mua</th>
                    <th className="py-3 px-3 text-right">AOV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {branchPerformances.map((b) => (
                    <tr key={b.branchId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-900">{b.branchName}</td>
                      <td className="py-3 px-3 text-right font-black text-[#da251d]">
                        {formatCurrency(b.revenue)}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">{b.ordersCount}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">{b.unitsSold}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-700">{b.uniqueBuyers}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(b.averageOrderValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
