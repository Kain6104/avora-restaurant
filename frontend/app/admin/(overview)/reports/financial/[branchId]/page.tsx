'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  CreditCard,
  Receipt,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Building2,
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
import { AdminCard, PageHeader, LoadingSkeleton } from '@/app/admin/components/ui';

const BRAND_PRIMARY = '#800020';
const CHART_COLORS = ['#800020', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

export default function AdminBranchFinancialDetailPage({
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
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
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

  const fetchBranchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/reports/financial/branch/${branchId}?from=${fromDate}&to=${toDate}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Error fetching branch financial detail:', err);
    } finally {
      setLoading(false);
    }
  }, [branchId, fromDate, toDate]);

  useEffect(() => {
    fetchBranchDetail();
  }, [fetchBranchDetail]);

  const handleOpenInspection = async (orderId: string) => {
    setIsModalOpen(true);
    setModalLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/financial/transactions/${orderId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setSelectedOrder(json.data);
      }
    } catch (err) {
      console.error('Error fetching order detail:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const branch = data?.branch;
  const summary = data?.summary;
  const paymentBreakdown = data?.paymentBreakdown || [];
  const vatBreakdown = data?.vatBreakdown || [];
  const hourlyTrend = data?.hourlyTrend || [];
  const dailyTrend = data?.dailyTrend || [];
  const recentOrders = data?.recentOrders || [];

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6 pb-8 sm:pb-12">
      {/* Back Link & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <Link
            href="/admin/reports/financial"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#800020] transition mb-1 min-h-[36px] sm:min-h-0"
          >
            <ArrowLeft size={14} /> Quay lại Báo cáo tài chính tổng quan
          </Link>
          <h1 className="text-base sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Store size={20} className="text-[#800020] shrink-0" />
            <span className="truncate">{branch ? `${branch.name} (${branch.branchCode})` : 'Chi Tiết Tài Chính Chi Nhánh'}</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Phân tích chuyên sâu doanh thu, khung giờ vàng, cơ cấu thanh toán và kiểm toán giao dịch tại chi nhánh
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 bg-white p-1 sm:p-1.5 rounded-lg border border-slate-200 shadow-2xs w-full sm:w-auto">
          <Calendar size={14} className="text-slate-400 ml-1.5 shrink-0" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-[11px] sm:text-xs border-0 bg-transparent text-slate-700 font-semibold focus:ring-0 p-1 flex-1 sm:flex-none"
          />
          <span className="text-slate-400 text-xs">-</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-[11px] sm:text-xs border-0 bg-transparent text-slate-700 font-semibold focus:ring-0 p-1 flex-1 sm:flex-none"
          />
          <button
            onClick={fetchBranchDetail}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-bold bg-[#800020] text-white rounded hover:bg-[#660019] transition min-h-[36px] sm:min-h-0"
          >
            Lọc
          </button>
        </div>
      </div>

      {/* Branch Info Card */}
      {branch && (
        <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin size={14} className="text-slate-400 shrink-0" />
            <span className="truncate">
              {branch.street || ''} {branch.ward || ''} {branch.district || ''} {branch.province || ''}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Phone size={14} className="text-slate-400 shrink-0" />
            <span>Hotline: {branch.phone || 'Chưa cập nhật'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <ShieldCheck size={14} className="text-slate-400 shrink-0" />
            <span>Quy đổi Loyalty: 1 điểm = {branch.pointRedeemRate || 1}₫</span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <LoadingSkeleton variant="card" count={8} />
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2.5 md:gap-3">
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-500 block mb-0.5 truncate">Gross Sales</span>
            <div className="text-sm sm:text-base md:text-lg font-black text-slate-900 truncate">{formatMoney(summary.grossSales)}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">{summary.totalOrderCount} đơn phát sinh</div>
          </div>

          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-[#800020]/20 bg-[#800020]/5 shadow-2xs">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase text-[#800020] block mb-0.5 truncate">Net Sales</span>
            <div className="text-sm sm:text-base md:text-lg font-black text-[#800020] truncate">{formatMoney(summary.netSales)}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Giảm: {formatMoney(summary.totalDiscountOverall)}</div>
          </div>

          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase text-emerald-700 block mb-0.5 truncate">Thực Thu Ròng</span>
            <div className="text-sm sm:text-base md:text-lg font-black text-emerald-900 truncate">{formatMoney(summary.netCollectedRevenue)}</div>
            <div className="text-[10px] sm:text-[11px] text-emerald-700 mt-0.5 truncate">Hoàn: {formatMoney(summary.totalRefundedAmount)}</div>
          </div>

          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-blue-200 shadow-2xs">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase text-blue-600 block mb-0.5 truncate">VAT & AOV</span>
            <div className="text-sm sm:text-base md:text-lg font-black text-blue-800 truncate">{formatMoney(summary.vatTotalAmount)}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">AOV: {formatMoney(summary.averageOrderValue)}</div>
          </div>
        </div>
      ) : null}

      {/* Hourly Peak Analysis & Daily Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        <AdminCard title="Khung Giờ Cao Điểm (Hourly Peak)" subtitle="Phân bổ doanh thu ròng theo 24 giờ">
          <div className="h-56 sm:h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <RechartsTooltip
                  formatter={(val: any) => formatMoney(Number(val))}
                  labelFormatter={(label) => `Khung giờ: ${label}:00 - ${label}:59`}
                />
                <Bar dataKey="netSales" fill="#800020" radius={[3, 3, 0, 0]} name="Doanh Thu" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title="Cơ Cấu Thanh Toán Tại Chi Nhánh" subtitle="Tỷ trọng theo phương thức">
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentBreakdown}
                  dataKey="collectedAmount"
                  nameKey="paymentMethod"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={4}
                >
                  {paymentBreakdown.map((_: any, index: number) => (
                    <Cell key={`pm-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(val: any) => formatMoney(Number(val))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>
      </div>

      {/* Recent Orders of this Branch */}
      <AdminCard
        title="Giao Dịch Gần Nhất Tại Chi Nhánh"
        subtitle="Danh sách các đơn hàng mới nhất và kết quả đối soát Invariant"
      >
        <div className="admin-scroll-table">
          <table className="w-full text-xs text-left min-w-[850px]">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-2.5 py-2">Mã Đơn</th>
                <th className="px-2.5 py-2">Thời Gian</th>
                <th className="px-2.5 py-2">Khách Hàng</th>
                <th className="px-2.5 py-2 text-right">Tiền Hàng</th>
                <th className="px-2.5 py-2 text-right text-amber-700">Giảm Giá</th>
                <th className="px-2.5 py-2 text-right text-blue-700">VAT</th>
                <th className="px-2.5 py-2 text-right font-bold text-slate-900">Tổng Đơn</th>
                <th className="px-2.5 py-2 text-right font-bold text-emerald-700">Thực Thu</th>
                <th className="px-2.5 py-2 text-center">PT Thanh Toán</th>
                <th className="px-2.5 py-2 text-center">Đối Soát</th>
                <th className="px-2.5 py-2 text-center">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map((o: any) => (
                <tr key={o.orderId} className="hover:bg-slate-50 transition">
                  <td className="px-2.5 py-2 font-mono font-bold text-slate-900">{o.orderCode}</td>
                  <td className="px-2.5 py-2 text-slate-500 whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-2.5 py-2 font-medium text-slate-800">{o.customerName}</td>
                  <td className="px-2.5 py-2 text-right">{formatMoney(o.grossItemAmount)}</td>
                  <td className="px-2.5 py-2 text-right text-amber-700">
                    {formatMoney(o.totalItemDiscount + o.pointsDiscount)}
                  </td>
                  <td className="px-2.5 py-2 text-right text-blue-700">{formatMoney(o.vatTotalAmount)}</td>
                  <td className="px-2.5 py-2 text-right font-bold text-slate-900">
                    {formatMoney(o.orderTotalAmount)}
                  </td>
                  <td className="px-2.5 py-2 text-right font-bold text-emerald-700">
                    {formatMoney(o.collectedRevenue)}
                  </td>
                  <td className="px-2.5 py-2 text-center font-semibold text-slate-600">{o.paymentMethod}</td>
                  <td className="px-2.5 py-2 text-center">
                    {o.reconciliation.isReconciled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        <CheckCircle2 size={10} /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                        <AlertTriangle size={10} /> LỆCH
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-center">
                    <button
                      onClick={() => handleOpenInspection(o.orderId)}
                      className="p-1.5 text-slate-500 hover:text-[#800020] hover:bg-slate-100 rounded min-h-[36px] min-w-[36px] inline-flex items-center justify-center"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* Modal Inspection */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-1.5 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-3xl w-full max-h-[96vh] sm:max-h-[85vh] overflow-y-auto p-3.5 sm:p-6 space-y-3 sm:space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 sm:pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Phân Rã Tài Chính Đơn {selectedOrder?.orderCode}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded min-h-[36px] min-w-[36px] inline-flex items-center justify-center">
                <X size={18} />
              </button>
            </div>

            {modalLoading || !selectedOrder ? (
              <div className="py-8 sm:py-12 text-center text-slate-400">Đang tải...</div>
            ) : (
              <div className="space-y-3 sm:space-y-4 text-xs">
                <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-700">Kiểm tra Đẳng thức:</div>
                  <div className="text-emerald-700 font-medium">
                    Expected ({formatMoney(selectedOrder.reconciliation.expectedTotalAmount)}) = Actual (
                    {formatMoney(selectedOrder.orderTotalAmount)})
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto admin-scroll-table">
                  <table className="w-full text-left min-w-[500px]">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2">Món</th>
                        <th className="p-2 text-center">SL</th>
                        <th className="p-2 text-right">Giá</th>
                        <th className="p-2 text-right text-amber-700">Voucher</th>
                        <th className="p-2 text-right text-blue-700">VAT</th>
                        <th className="p-2 text-right font-bold text-[#800020]">Doanh Thu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.map((it: any) => (
                        <tr key={it.orderItemId}>
                          <td className="p-2 font-medium text-slate-800">{it.productName}</td>
                          <td className="p-2 text-center">{it.quantity}</td>
                          <td className="p-2 text-right">{formatMoney(it.unitPriceAtSale)}</td>
                          <td className="p-2 text-right text-amber-700">
                            {it.allocatedOrderDiscount > 0 ? `-${formatMoney(it.allocatedOrderDiscount)}` : '-'}
                          </td>
                          <td className="p-2 text-right text-blue-700">{formatMoney(it.taxAmount)}</td>
                          <td className="p-2 text-right font-bold text-[#800020]">{formatMoney(it.revenueWithTax)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
