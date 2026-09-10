'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Filter,
  RefreshCw,
  Store,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useAdmin } from '@/contexts/AdminContext';

export default function GlobalFlashSaleReportsPage() {
  const { allBranches } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any>(null);

  // Filters
  const [dateRange, setDateRange] = useState('30days');
  const [branchFilter, setBranchFilter] = useState('ALL');

  const fetchGlobalReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('range', dateRange);
      if (branchFilter !== 'ALL') params.set('branchId', branchFilter);

      const res = await fetch(`/api/admin/flash-sales/reports?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setData({ kpis: null, campaigns: [], comparison: [] });
        }
      } else {
        setData({ kpis: null, campaigns: [], comparison: [] });
      }
    } catch (err) {
      console.error('Error fetching global flash sale reports:', err);
      setData({ kpis: null, campaigns: [], comparison: [] });
    } finally {
      setLoading(false);
    }
  }, [dateRange, branchFilter]);

  useEffect(() => {
    fetchGlobalReports();
  }, [fetchGlobalReports]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await fetch(`/api/admin/flash-sales/reports/export?range=${dateRange}&branchId=${branchFilter}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FlashSale_Global_Report_${dateRange}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Không thể xuất file.');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <BarChart3 className="w-10 h-10 text-[#da251d] animate-bounce mx-auto mb-3" />
          <p className="font-bold text-slate-700">Đang tải trung tâm phân tích tổng hợp Flash Sale...</p>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalRevenue: 0,
    totalUnitsSold: 0,
    totalOrders: 0,
    totalDiscountAmount: 0,
    totalBuyers: 0,
    sellThroughRate: 0,
  };
  const campaigns = data?.campaigns || [];
  const campaignComparison = data?.comparison || [];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-20">
      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/flash-sales"
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
                  <span className="text-slate-800 font-semibold">Báo cáo tổng hợp</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 mt-0.5">
                  <BarChart3 className="w-6 h-6 text-[#da251d]" />
                  <span>Báo Cáo Tổng Hợp Chiến Dịch Flash Sale</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchGlobalReports}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                title="Làm mới"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

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
        {/* Filter bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="7days">7 ngày qua</option>
              <option value="30days">30 ngày qua</option>
              <option value="90days">90 ngày qua</option>
              <option value="this_month">Tháng này</option>
              <option value="all">Toàn bộ thời gian</option>
            </select>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Tổng cộng: <strong className="text-slate-800">{campaigns.length}</strong> chiến dịch đã ghi nhận
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-semibold">Tổng doanh thu Flash</span>
            <div className="text-xl font-black text-slate-900 mt-1">
              {formatCurrency(kpis.totalRevenue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {kpis.totalOrders || 0} lượt đơn hàng
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-semibold">Món đã bán</span>
            <div className="text-xl font-black text-[#da251d] mt-1">
              {(kpis.totalUnitsSold || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Tỷ lệ bán hết: <strong className="text-emerald-600">{kpis.sellThroughRate || 0}%</strong>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-semibold">Tiền giảm cho khách</span>
            <div className="text-xl font-black text-rose-600 mt-1">
              {formatCurrency(kpis.totalDiscountAmount)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Trợ giá thực tế</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-semibold">Khách hàng tham gia</span>
            <div className="text-xl font-black text-slate-900 mt-1">
              {(kpis.totalBuyers || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Người dùng duy nhất</div>
          </div>
        </div>

        {/* Campaign Comparison Chart */}
        {campaignComparison.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              So Sánh Doanh Thu Giữa Các Chiến Dịch
            </h3>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignComparison} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(val) => `${(val / 1000000).toLocaleString()}tr`}
                  />
                  <RechartsTooltip formatter={(val: any) => [formatCurrency(val), 'Doanh thu']} />
                  <Bar dataKey="revenue" fill="#da251d" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Campaigns List Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Bảng Hiệu Quả Từng Chiến Dịch
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Chiến dịch</th>
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3 text-right">Doanh thu</th>
                  <th className="py-3 px-3 text-center">Đơn hàng</th>
                  <th className="py-3 px-3 text-right">Món bán</th>
                  <th className="py-3 px-3 text-center">Tỷ lệ bán</th>
                  <th className="py-3 px-3 text-right">Khách mua</th>
                  <th className="py-3 px-4 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((camp: any) => (
                  <tr key={camp.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{camp.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{camp.code}</div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(camp.startTime).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3.5 px-3 text-right font-black text-slate-900">
                      {formatCurrency(camp.revenue)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-700">
                      {camp.ordersCount}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-800">
                      {camp.unitsSold} / {camp.flashStock}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="font-bold text-emerald-600">{camp.sellThroughRate}%</span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-slate-700">
                      {camp.uniqueBuyers}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Link
                        href={`/admin/flash-sales/${camp.id}/report`}
                        className="text-[#da251d] font-bold hover:underline"
                      >
                        Xem báo cáo
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
