'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import {
  Boxes,
  DollarSign,
  AlertTriangle,
  Clock,
  RefreshCw,
  Warehouse,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { PageHeader, AdminCard } from '@/app/admin/components/ui';

export default function InventoryValuationReportPage() {
  const { selectedBranchId } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [valuation, setValuation] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>(null);

  const formatMoney = (val = 0) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const bParam = selectedBranchId && selectedBranchId !== 'ALL' ? `?branchId=${selectedBranchId}` : '';
      const [valRes, alertRes] = await Promise.all([
        fetch(`/api/admin/inventory/reports/valuation${bParam}`, { credentials: 'include' }),
        fetch(`/api/admin/inventory/reports/expiration-alerts${bParam}`, { credentials: 'include' }),
      ]);
      const [valJson, alertJson] = await Promise.all([valRes.json(), alertRes.json()]);
      if (valJson.success) setValuation(valJson.data);
      if (alertJson.success) setAlerts(alertJson.data);
    } catch (e) {
      console.error('Error fetching inventory valuation report:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = valuation?.kpis || {};
  const alertSummary = alerts?.summary || {};

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Báo Cáo Định Giá Tồn Kho & Cảnh Báo Hạn Dùng (FEFO)"
        subtitle="Thống kê giá trị tài sản tồn kho theo chi nhánh, kho, nhóm nguyên liệu và cảnh báo lô hàng sắp hết hạn"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/reports/food-cost"
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              Báo Cáo Food Cost
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

      {/* KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminCard className="p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-bold uppercase text-slate-500">Tổng Giá Trị Tồn Kho</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">
            {loading ? '...' : formatMoney(kpis.totalInventoryValue)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{kpis.totalItems || 0} bản ghi tồn kho</p>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-amber-500">
          <p className="text-xs font-bold uppercase text-slate-500">Dưới Ngưỡng Tối Thiểu</p>
          <h3 className="text-2xl font-black text-amber-600 mt-1">{loading ? '...' : kpis.lowStockCount || 0}</h3>
          <p className="text-xs text-slate-500 mt-1">Hết hàng hoàn toàn: {kpis.outOfStockCount || 0}</p>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-rose-500">
          <p className="text-xs font-bold uppercase text-slate-500">Lô Đã Quá Hạn</p>
          <h3 className="text-2xl font-black text-rose-600 mt-1">{loading ? '...' : alertSummary.expiredCount || 0}</h3>
          <p className="text-xs text-slate-500 mt-1">Cần kiểm tra & hủy ngay</p>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-indigo-500">
          <p className="text-xs font-bold uppercase text-slate-500">Hết Hạn Trong 7 Ngày</p>
          <h3 className="text-2xl font-black text-indigo-600 mt-1">
            {loading
              ? '...'
              : (alertSummary.expiringIn1DayCount || 0) +
                (alertSummary.expiringIn3DaysCount || 0) +
                (alertSummary.expiringIn7DaysCount || 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Ưu tiên xuất chế biến theo FEFO</p>
        </AdminCard>
      </div>

      {/* BY BRANCH & WAREHOUSE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminCard className="p-5">
          <h4 className="text-sm font-black uppercase text-slate-800 mb-4 flex items-center gap-2">
            <Warehouse size={16} className="text-[#da251d]" /> Phân Bổ Giá Trị Theo Kho Lưu Trữ
          </h4>
          <div className="space-y-3">
            {valuation?.warehouses?.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-xs">
                <div>
                  <p className="font-bold text-slate-900">{w.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {w.branchName} • {w.itemCount} mặt hàng
                  </p>
                </div>
                <span className="font-black text-emerald-700 text-sm">{formatMoney(w.totalValue)}</span>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard className="p-5">
          <h4 className="text-sm font-black uppercase text-slate-800 mb-4 flex items-center gap-2">
            <Boxes size={16} className="text-indigo-600" /> Phân Bổ Giá Trị Theo Nhóm Hàng
          </h4>
          <div className="space-y-3">
            {valuation?.byCategory?.map((c: any) => (
              <div key={c.categoryName} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-xs">
                <div>
                  <p className="font-bold text-slate-900">{c.categoryName}</p>
                  <p className="text-[11px] text-slate-500">{c.itemCount} mã đang tồn</p>
                </div>
                <span className="font-black text-slate-900 text-sm">{formatMoney(c.totalValue)}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
