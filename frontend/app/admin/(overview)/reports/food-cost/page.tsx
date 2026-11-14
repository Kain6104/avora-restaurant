'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Percent,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  PieChart,
  Trash2,
  Scale,
  Boxes,
} from 'lucide-react';
import { PageHeader, AdminCard } from '@/app/admin/components/ui';

export default function FoodCostReportPage() {
  const { selectedBranchId } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [valuation, setValuation] = useState<any>(null);

  // Date Filters (default current month)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const formatMoney = (val = 0) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (selectedBranchId && selectedBranchId !== 'ALL') p.set('branchId', selectedBranchId);
      if (startDate) p.set('startDate', startDate);
      if (endDate) p.set('endDate', endDate);

      const bParam = selectedBranchId && selectedBranchId !== 'ALL' ? `?branchId=${selectedBranchId}` : '';

      const [fcRes, valRes] = await Promise.all([
        fetch(`/api/admin/inventory/reports/food-cost?${p.toString()}`, { credentials: 'include' }),
        fetch(`/api/admin/inventory/reports/valuation${bParam}`, { credentials: 'include' }),
      ]);

      const [fcJson, valJson] = await Promise.all([fcRes.json(), valRes.json()]);
      if (fcJson.success) setReport(fcJson.data);
      if (valJson.success) setValuation(valJson.data);
    } catch (e) {
      console.error('Error loading food cost report:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = report?.financialKpis || {};
  const cert = report?.certificationBreakdown || {};
  const valKpis = valuation?.kpis || {};
  const variance = Number(kpis.varianceCOGS || 0);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Báo Cáo Food Cost & Hiệu Quả Giá Vốn (Food Cost Intelligence)"
        subtitle="Phân tích đối chiếu Giá Vốn Lý Thuyết (Recipe BOM) vs Giá Vốn Thực Tế (Sổ cái + Hao hụt bếp) & Lợi nhuận gộp"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/reports/inventory"
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              Định Giá Tồn Kho
            </Link>
            <Link
              href="/admin/reports/profitability"
              className="px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
            >
              Biên Lợi Nhuận
            </Link>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700 transition"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Cập nhật
            </button>
          </div>
        }
      />

      {/* DATE FILTERS */}
      <AdminCard className="p-4">
        <div className="flex flex-wrap items-end gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-600 block mb-1 flex items-center gap-1">
              <Calendar size={13} /> Từ ngày
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-200 rounded-lg p-2"
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1 flex items-center gap-1">
              <Calendar size={13} /> Đến ngày
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-200 rounded-lg p-2"
            />
          </div>
          <div className="ml-auto text-right text-slate-500">
            <p className="font-bold">Tổng đơn hàng hoàn tất trong kỳ:</p>
            <p className="text-lg font-black text-slate-900">{report?.orderCount || 0} đơn</p>
          </div>
        </div>
      </AdminCard>

      {/* PRIMARY FINANCIAL KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminCard className="p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Doanh Thu Món Ăn Thuần</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {loading ? '...' : formatMoney(kpis.totalNetFoodSales)}
              </h3>
              <p className="text-xs text-emerald-600 font-bold mt-1">
                Lợi nhuận gộp: {formatMoney(kpis.grossProfit)}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign size={22} />
            </div>
          </div>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-indigo-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Actual Food Cost %</p>
              <h3 className="text-2xl font-black text-indigo-700 mt-1">
                {loading ? '...' : `${kpis.actualFoodCostPercent || 0}%`}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Giá vốn thực tế: {formatMoney(kpis.actualCOGS)}
              </p>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Percent size={22} />
            </div>
          </div>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Theoretical Food Cost %</p>
              <h3 className="text-2xl font-black text-blue-700 mt-1">
                {loading ? '...' : `${kpis.theoreticalFoodCostPercent || 0}%`}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Giá vốn BOM lý thuyết: {formatMoney(kpis.theoreticalCOGS)}
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Scale size={22} />
            </div>
          </div>
        </AdminCard>

        <AdminCard className={`p-5 border-l-4 ${variance > 0 ? 'border-l-rose-500' : 'border-l-teal-500'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Chênh Lệch COGS (Variance)</p>
              <h3 className={`text-2xl font-black mt-1 ${variance > 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                {loading ? '...' : `${variance > 0 ? '+' : ''}${formatMoney(variance)}`}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Trong đó hao hụt/hủy: {formatMoney(kpis.totalWasteCost)}
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ${variance > 0 ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
              <AlertTriangle size={22} />
            </div>
          </div>
        </AdminCard>
      </div>

      {/* DETAILED COST BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminCard className="p-5 space-y-4">
          <h4 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
            <PieChart size={16} className="text-[#da251d]" />
            Cấu Trúc Giá Vốn & Tỷ Suất Lợi Nhuận Gộp (Gross Margin)
          </h4>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="font-bold text-slate-700">1. Doanh thu thuần (Net Food Sales)</span>
              <span className="font-black text-slate-900">{formatMoney(kpis.totalNetFoodSales)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="font-bold text-slate-700">2. Giá vốn định mức lý thuyết (Theoretical BOM COGS)</span>
              <span className="font-bold text-blue-700">{formatMoney(kpis.theoreticalCOGS)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="font-bold text-slate-700">3. Tiêu hao nguyên liệu bếp thực tế (Actual Kitchen Consumption)</span>
              <span className="font-bold text-indigo-700">{formatMoney(kpis.actualConsumptionCost)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-rose-50/70 rounded-lg border border-rose-100">
              <span className="font-bold text-rose-800 flex items-center gap-1.5">
                <Trash2 size={14} /> 4. Chi phí hao hụt & hư hỏng (Waste & Spoilage)
              </span>
              <span className="font-black text-rose-700">{formatMoney(kpis.totalWasteCost)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <span className="font-black text-indigo-900">5. Tổng Giá Vốn Thực Tế (Actual Total COGS = 3 + 4)</span>
              <span className="font-black text-indigo-900 text-sm">{formatMoney(kpis.actualCOGS)}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <div>
                <p className="font-black text-emerald-900 text-sm">Lợi Nhuận Gộp (Gross Profit)</p>
                <p className="text-[11px] text-emerald-700">
                  Biên lợi nhuận gộp (Gross Margin %): <strong>{kpis.grossMarginPercent || 0}%</strong>
                </p>
              </div>
              <span className="font-black text-emerald-700 text-lg">{formatMoney(kpis.grossProfit)}</span>
            </div>

            {cert.denominatorDefinition && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-[11px] text-slate-600">
                <p className="font-bold text-slate-800">Chuẩn Đối Chiếu Tài Chính (Certified Denominator):</p>
                <p>{cert.denominatorDefinition}</p>
                <div className="grid grid-cols-2 gap-1 pt-1 font-mono">
                  <span>• VAT đã bóc tách: {formatMoney(cert.vatExcludedAmount)}</span>
                  <span>• Phí ship loại trừ: {formatMoney(cert.shippingFeeExcluded)}</span>
                  <span>• Phí phục vụ loại trừ: {formatMoney(cert.serviceChargeExcluded)}</span>
                  <span>• Hoàn tiền loại trừ: {formatMoney(cert.refundedRevenueExcluded)}</span>
                  <span>• Giá vốn Buffet (0đ): {formatMoney(cert.buffetIncludedCost)}</span>
                  <span>• Giá vốn Đổi điểm (0đ): {formatMoney(cert.loyaltyRedemptionCost)}</span>
                </div>
              </div>
            )}
          </div>
        </AdminCard>

        <AdminCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
              <Boxes size={16} className="text-emerald-600" />
              Giá Trị Tồn Kho Hiện Hành Theo Nhóm
            </h4>
            <Link
              href="/admin/inventory"
              className="text-xs font-bold text-[#da251d] hover:underline flex items-center gap-0.5"
            >
              Về Kho <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl flex items-center justify-between border border-emerald-100">
            <span className="text-xs font-bold text-emerald-900">Tổng giá trị tồn kho toàn hệ thống:</span>
            <span className="text-base font-black text-emerald-700">{formatMoney(valKpis.totalInventoryValue)}</span>
          </div>

          <div className="space-y-2.5">
            {valuation?.byCategory?.map((c: any) => (
              <div key={c.categoryName} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs">
                <div>
                  <p className="font-bold text-slate-800">{c.categoryName}</p>
                  <p className="text-[11px] text-slate-500">{c.itemCount} nguyên liệu</p>
                </div>
                <span className="font-black text-slate-900">{formatMoney(c.totalValue)}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
