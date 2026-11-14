'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import {
  TrendingUp,
  Percent,
  RefreshCw,
  DollarSign,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { PageHeader, AdminCard } from '@/app/admin/components/ui';

export default function ProfitabilityReportPage() {
  const { selectedBranchId } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [foodCost, setFoodCost] = useState<any>(null);
  const [recipes, setRecipes] = useState<any[]>([]);
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

      const [fcRes, recRes] = await Promise.all([
        fetch(`/api/admin/inventory/reports/food-cost?${p.toString()}`, { credentials: 'include' }),
        fetch('/api/admin/inventory/recipes', { credentials: 'include' }),
      ]);

      const [fcJson, recJson] = await Promise.all([fcRes.json(), recRes.json()]);
      if (fcJson.success) setFoodCost(fcJson.data);
      if (recJson.success) setRecipes(recJson.data || []);
    } catch (e) {
      console.error('Error loading profitability report:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = foodCost?.financialKpis || {};

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Phân Tích Lợi Nhuận Gộp & Biên Lợi Nhuận Món Ăn (Profitability)"
        subtitle="Đánh giá hiệu quả sinh lời thực tế từ doanh thu thuần trừ giá vốn nguyên liệu, hao hụt bếp và biên lợi nhuận gộp từng công thức"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/reports/food-cost"
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              Chi Tiết Food Cost
            </Link>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700 transition"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
        }
      />

      {/* FILTERS */}
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
        </div>
      </AdminCard>

      {/* PROFITABILITY KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminCard className="p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-bold uppercase text-slate-500">Lợi Nhuận Gộp Thực Tế</p>
          <h3 className="text-2xl font-black text-emerald-700 mt-1">
            {loading ? '...' : formatMoney(kpis.grossProfit)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Sau khi trừ Actual COGS & Waste</p>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-indigo-500">
          <p className="text-xs font-bold uppercase text-slate-500">Biên Lợi Nhuận Gộp (Margin %)</p>
          <h3 className="text-2xl font-black text-indigo-700 mt-1">
            {loading ? '...' : `${kpis.grossMarginPercent || 0}%`}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Chuẩn F&B khuyến nghị: &gt; 60%</p>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-blue-500">
          <p className="text-xs font-bold uppercase text-slate-500">Tổng Doanh Thu Món</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">
            {loading ? '...' : formatMoney(kpis.totalNetFoodSales)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{foodCost?.orderCount || 0} đơn hoàn tất</p>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-rose-500">
          <p className="text-xs font-bold uppercase text-slate-500">Chi Phí Hao Hụt & Hủy Món</p>
          <h3 className="text-2xl font-black text-rose-600 mt-1">
            {loading ? '...' : formatMoney(kpis.totalWasteCost)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Ảnh hưởng trực tiếp lợi nhuận</p>
        </AdminCard>
      </div>

      {/* MENU MARGIN ANALYSIS BY RECIPE */}
      <AdminCard className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
            <BookOpen size={16} className="text-[#da251d]" />
            Phân Tích Biên Lợi Nhuận Định Mức Theo Từng Món Ăn (Recipe BOM Margin)
          </h4>
          <Link href="/admin/inventory/recipes" className="text-xs font-bold text-[#da251d] hover:underline">
            Quản lý công thức →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                <th className="py-3 px-4">Mã CT</th>
                <th className="py-3 px-4">Món Ăn / Thành Phẩm</th>
                <th className="py-3 px-4 text-right">Giá Bán Menu</th>
                <th className="py-3 px-4 text-right">Giá Vốn BOM / Phần</th>
                <th className="py-3 px-4 text-right">Lợi Nhuận Gộp / Phần</th>
                <th className="py-3 px-4 text-right">Tỷ Lệ Cost %</th>
                <th className="py-3 px-4 text-right">Gross Margin %</th>
                <th className="py-3 px-4">Đánh Giá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {recipes.map((r) => {
                const activeVer = r.versions?.find((v: any) => v.status === 'PUBLISHED') || r.versions?.[0];
                const sellPrice = Number(r.product?.price || 0);
                const cost = Number(activeVer?.costPerServing || 0);
                const profit = sellPrice - cost;
                const costPct = sellPrice > 0 ? ((cost / sellPrice) * 100).toFixed(1) : '0.0';
                const marginPct = sellPrice > 0 ? ((profit / sellPrice) * 100).toFixed(1) : '0.0';
                const numMargin = parseFloat(marginPct);

                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{r.code}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {r.product?.name || r.name}
                      {r.isSemiFinished && (
                        <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-[9px] font-bold">
                          BÁN THÀNH PHẨM
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800">
                      {r.isSemiFinished ? '---' : formatMoney(sellPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600">{formatMoney(cost)}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700">
                      {r.isSemiFinished ? '---' : formatMoney(profit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                      {r.isSemiFinished ? '---' : `${costPct}%`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-indigo-700">
                      {r.isSemiFinished ? '---' : `${marginPct}%`}
                    </td>
                    <td className="py-3 px-4">
                      {!r.isSemiFinished && (
                        numMargin >= 60 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            <CheckCircle2 size={11} /> TỐT
                          </span>
                        ) : numMargin >= 40 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            TRUNG BÌNH
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                            <AlertCircle size={11} /> COST CAO
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {recipes.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Chưa có công thức BOM nào được thiết lập
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}
