'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import {
  Boxes,
  AlertTriangle,
  Clock,
  TrendingUp,
  Package,
  Warehouse,
  BookOpen,
  Truck,
  ArrowRightLeft,
  ClipboardCheck,
  FileText,
  RefreshCw,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { PageHeader, AdminCard } from '@/app/admin/components/ui';

export default function InventoryDashboardPage() {
  const { selectedBranchId } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [valuation, setValuation] = useState<any>(null);
  const [foodCost, setFoodCost] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>(null);

  const formatMoney = (amount = 0) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const bParam = selectedBranchId && selectedBranchId !== 'ALL' ? `?branchId=${selectedBranchId}` : '';
      const [valRes, fcRes, alertRes] = await Promise.all([
        fetch(`/api/admin/inventory/reports/valuation${bParam}`, { credentials: 'include' }),
        fetch(`/api/admin/inventory/reports/food-cost${bParam}`, { credentials: 'include' }),
        fetch(`/api/admin/inventory/reports/expiration-alerts${bParam}`, { credentials: 'include' }),
      ]);
      const valJson = await valRes.json();
      const fcJson = await fcRes.json();
      const alertJson = await alertRes.json();

      if (valJson.success) setValuation(valJson.data);
      if (fcJson.success) setFoodCost(fcJson.data);
      if (alertJson.success) setAlerts(alertJson.data);
    } catch (e) {
      console.error('Error loading inventory dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = valuation?.kpis || {};
  const fcKpis = foodCost?.financialKpis || {};
  const alertSummary = alerts?.summary || {};

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Tổng Quan Quản Trị Kho & Giá Vốn"
        subtitle="Theo dõi giá trị tồn kho, cảnh báo nguyên liệu sắp hết, hạn sử dụng FEFO và hiệu suất Food Cost"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
            <Link
              href="/admin/inventory/procurement"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700 transition shadow-sm"
            >
              <Truck size={14} />
              Nhập Kho Mới
            </Link>
          </div>
        }
      />

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminCard className="p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng Giá Trị Tồn Kho</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {loading ? '...' : formatMoney(kpis.totalInventoryValue)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Trên {kpis.totalItems || 0} mã nguyên liệu lưu kho
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign size={22} />
            </div>
          </div>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-amber-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Nguyên Liệu Sắp Hết / Hết</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">
                {loading ? '...' : `${kpis.lowStockCount || 0} / ${kpis.outOfStockCount || 0}`}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Sắp chạm ngưỡng tồn tối thiểu</p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle size={22} />
            </div>
          </div>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-rose-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Cảnh Báo Hạn Dùng (FEFO)</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">
                {loading ? '...' : (alertSummary.expiredCount || 0) + (alertSummary.expiringIn3DaysCount || 0)} Lô
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Quá hạn: {alertSummary.expiredCount || 0} • Hết trong 3 ngày: {alertSummary.expiringIn3DaysCount || 0}
              </p>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <Clock size={22} />
            </div>
          </div>
        </AdminCard>

        <AdminCard className="p-5 border-l-4 border-l-indigo-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tỷ Lệ Food Cost Thực Tế</p>
              <h3 className="text-2xl font-black text-indigo-600 mt-1">
                {loading ? '...' : `${fcKpis.actualFoodCostPercent || 0}%`}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Lý thuyết: {fcKpis.theoreticalFoodCostPercent || 0}% • Hao hụt: {formatMoney(fcKpis.totalWasteCost)}
              </p>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <TrendingUp size={22} />
            </div>
          </div>
        </AdminCard>
      </div>

      {/* SHORTCUTS & MODULES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Nguyên liệu', href: '/admin/inventory/ingredients', icon: Package, color: 'text-blue-600 bg-blue-50' },
          { label: 'Công thức BOM', href: '/admin/inventory/recipes', icon: BookOpen, color: 'text-rose-600 bg-rose-50' },
          { label: 'Kho & Tồn kho', href: '/admin/inventory/warehouses', icon: Warehouse, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Mua hàng & Nhập', href: '/admin/inventory/procurement', icon: Truck, color: 'text-amber-600 bg-amber-50' },
          { label: 'Chuyển kho', href: '/admin/inventory/transfers', icon: ArrowRightLeft, color: 'text-purple-600 bg-purple-50' },
          { label: 'Kiểm kê & Hủy', href: '/admin/inventory/stocktakes', icon: ClipboardCheck, color: 'text-cyan-600 bg-cyan-50' },
          { label: 'Sổ cái kho', href: '/admin/inventory/transactions', icon: FileText, color: 'text-slate-600 bg-slate-100' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl hover:border-[#da251d] hover:shadow-md transition group text-center"
          >
            <div className={`p-3 rounded-xl ${item.color} mb-2 group-hover:scale-110 transition`}>
              <item.icon size={20} />
            </div>
            <span className="text-xs font-bold text-slate-800">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* VALUATION BY BRANCH & CATEGORY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
              <Warehouse size={16} className="text-[#da251d]" />
              Định Giá Tồn Kho Theo Kho / Chi Nhánh
            </h4>
            <Link href="/admin/inventory/warehouses" className="text-xs font-bold text-[#da251d] hover:underline flex items-center gap-0.5">
              Chi tiết <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="space-y-3">
            {valuation?.warehouses?.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-900">{w.name}</p>
                  <p className="text-xs text-slate-500">
                    Mã kho: {w.code} • Chi nhánh: {w.branchName} • {w.itemCount} mặt hàng
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-700">{formatMoney(w.totalValue)}</p>
                </div>
              </div>
            ))}
            {(!valuation?.warehouses || valuation.warehouses.length === 0) && (
              <p className="text-xs text-slate-400 text-center py-6">Chưa có dữ liệu tồn kho</p>
            )}
          </div>
        </AdminCard>

        <AdminCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
              <Boxes size={16} className="text-indigo-600" />
              Cơ Cấu Tồn Kho Theo Nhóm Nguyên Liệu
            </h4>
            <Link href="/admin/inventory/ingredients" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-0.5">
              Danh mục <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="space-y-3">
            {valuation?.byCategory?.map((c: any) => (
              <div key={c.categoryName} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-900">{c.categoryName}</p>
                  <p className="text-xs text-slate-500">{c.itemCount} nguyên liệu đang lưu kho</p>
                </div>
                <p className="text-sm font-black text-slate-900">{formatMoney(c.totalValue)}</p>
              </div>
            ))}
            {(!valuation?.byCategory || valuation.byCategory.length === 0) && (
              <p className="text-xs text-slate-400 text-center py-6">Chưa có dữ liệu nhóm nguyên liệu</p>
            )}
          </div>
        </AdminCard>
      </div>

      {/* EXPIRATION FEFO TABLE */}
      <AdminCard className="p-5">
        <h4 className="text-sm font-black uppercase text-slate-800 mb-4 flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600" />
          Danh Sách Lô Hàng Sắp Hết Hạn (FEFO Alert - Trong 7 Ngày Tới)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                <th className="py-2.5 px-3">Mã Lô</th>
                <th className="py-2.5 px-3">Nguyên Liệu</th>
                <th className="py-2.5 px-3">Kho Lưu Trữ</th>
                <th className="py-2.5 px-3">Ngày Hết Hạn</th>
                <th className="py-2.5 px-3 text-right">Số Lượng Còn</th>
                <th className="py-2.5 px-3">Tình Trạng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {[...(alerts?.expired || []), ...(alerts?.expiringIn1Day || []), ...(alerts?.expiringIn3Days || []), ...(alerts?.expiringIn7Days || [])].map((batch: any) => {
                const isExpired = new Date(batch.expirationDate) < new Date();
                return (
                  <tr key={batch.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-bold text-slate-800">{batch.batchNumber}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{batch.ingredient?.name}</td>
                    <td className="py-3 px-3 text-slate-600">{batch.warehouse?.name}</td>
                    <td className="py-3 px-3 font-medium">{new Date(batch.expirationDate).toLocaleDateString('vi-VN')}</td>
                    <td className="py-3 px-3 text-right font-bold">{Number(batch.remainingQuantity).toLocaleString()}</td>
                    <td className="py-3 px-3">
                      {isExpired ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded text-[10px]">ĐÃ QUÁ HẠN</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">SẮP HẾT HẠN</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!alerts || ((alerts.expired?.length || 0) + (alerts.expiringIn1Day?.length || 0) + (alerts.expiringIn3Days?.length || 0) + (alerts.expiringIn7Days?.length || 0)) === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                    Không có lô hàng nào sắp hết hạn trong 7 ngày tới
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
