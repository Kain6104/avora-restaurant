'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store,
  ArrowLeft,
  Receipt,
  Percent,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';

const BRAND_PRIMARY = '#800020';

export default function AdminBranchTaxDetailPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const branchId = resolvedParams.branchId;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Modal inspection state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Date filters
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const fetchBranchTax = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/reports/tax/overview?branchId=${branchId}&from=${fromDate}&to=${toDate}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Error fetching branch tax detail:', err);
    } finally {
      setLoading(false);
    }
  }, [branchId, fromDate, toDate]);

  useEffect(() => {
    fetchBranchTax();
  }, [fetchBranchTax]);

  const handleOpenBreakdownModal = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
    setModalLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/tax/breakdown/${orderId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setModalData(json.data.order);
      }
    } catch (err) {
      console.error('Error fetching tax breakdown:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const kpis = data?.kpis;
  const rates = data?.rates || [];
  const trends = data?.dailyTrends || [];

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white p-3 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link
            href="/admin/reports/tax"
            className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 tracking-tight font-serif">
                Báo Cáo Thuế Chi Nhánh
              </h1>
              <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold bg-[#800020] text-white rounded-full">
                {branchId.substring(0, 8)}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Phân rã thuế VAT & kiểm tra đối soát toán học độc lập cho chi nhánh
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[10px] sm:text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            <span>Chỉ tính đơn hoàn thành</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs h-8 sm:h-9"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs h-8 sm:h-9"
            />
            <button
              onClick={fetchBranchTax}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer min-h-[32px] flex items-center justify-center"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#800020]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2.5 md:gap-3">
        <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block truncate">Đơn Hoàn Thành</span>
          <div className="text-sm sm:text-base md:text-xl font-black text-slate-900 mt-0.5 sm:mt-1 truncate">
            {kpis?.completedOrders || 0} đơn
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
            Số món: {kpis?.completedOrderItems || 0}
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block truncate">Doanh Thu Tính Thuế</span>
          <div className="text-sm sm:text-base md:text-xl font-black text-slate-900 mt-0.5 sm:mt-1 truncate">
            {formatMoney(kpis?.taxableRevenue)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
            Gộp: {formatMoney(kpis?.grossSales)}
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block truncate">Tổng Thuế VAT</span>
          <div className="text-sm sm:text-base md:text-xl font-black text-[#800020] mt-0.5 sm:mt-1 truncate">
            {formatMoney(kpis?.totalVat)}
          </div>
          <div className="text-[10px] sm:text-xs text-rose-600 mt-0.5 truncate">
            Hoàn: -{formatMoney(kpis?.vatRefunded)}
          </div>
        </div>

        <div className="bg-slate-900 text-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-xs">
          <span className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider block truncate">VAT Ròng (Net)</span>
          <div className="text-sm sm:text-base md:text-xl font-black text-white mt-0.5 sm:mt-1 truncate">
            {formatMoney(kpis?.netVat)}
          </div>
          <div className="text-[10px] sm:text-xs text-emerald-400 mt-0.5 truncate">
            TB: {formatMoney(kpis?.averageVatPerCompletedOrder)}
          </div>
        </div>
      </div>

      {/* Rates Breakdown */}
      <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <h3 className="text-xs sm:text-sm font-bold text-slate-900">Phân Rã Mức Thuế Suất Chi Nhánh</h3>
        <div className="admin-scroll-table overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[750px] text-xs text-left">
            <thead className="bg-[#800020] text-white font-bold">
              <tr>
                <th className="p-2.5 sm:p-3">Mức Thuế Suất</th>
                <th className="p-2.5 sm:p-3 text-right">Đơn Hoàn Thành</th>
                <th className="p-2.5 sm:p-3 text-right">Số Món Bán</th>
                <th className="p-2.5 sm:p-3 text-right">Doanh Thu Tính Thuế</th>
                <th className="p-2.5 sm:p-3 text-right">Tiền Thuế VAT</th>
                <th className="p-2.5 sm:p-3 text-right">Thuế Thực Nộp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rates.map((r: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2.5 sm:p-3 font-bold text-slate-900">{r.rateLabel}</td>
                  <td className="p-2.5 sm:p-3 text-right">{r.completedOrdersCount}</td>
                  <td className="p-2.5 sm:p-3 text-right">{r.quantitySold}</td>
                  <td className="p-2.5 sm:p-3 text-right font-medium">{formatMoney(r.taxableAmount)}</td>
                  <td className="p-2.5 sm:p-3 text-right font-bold text-[#800020]">{formatMoney(r.taxAmount)}</td>
                  <td className="p-2.5 sm:p-3 text-right font-black text-emerald-700">{formatMoney(r.netTaxAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Order Breakdown Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-3.5 sm:p-6 space-y-3 sm:space-y-4 shadow-2xl max-h-[96vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Chi Tiết Đơn {modalData?.orderCode}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {modalLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">Đang tải...</div>
            ) : modalData ? (
              <div className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span>Tổng tiền món:</span>
                  <span className="font-bold">{formatMoney(modalData.grossItemAmount)}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Giảm giá:</span>
                  <span className="font-bold">-{formatMoney(modalData.totalItemDiscount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Doanh thu tính thuế:</span>
                  <span className="font-bold">{formatMoney(modalData.taxableRevenueBeforeVat)}</span>
                </div>
                <div className="flex justify-between text-[#800020]">
                  <span>Thuế VAT:</span>
                  <span className="font-bold">{formatMoney(modalData.vatTotalAmount)}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
