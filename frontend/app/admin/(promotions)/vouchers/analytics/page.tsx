'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Ticket, 
  ArrowLeft, 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Sparkles, 
  Truck, 
  Calendar, 
  Check, 
  X, 
  RefreshCw, 
  Printer, 
  Download, 
  Search, 
  Filter, 
  Edit2, 
  Percent, 
  ArrowUpRight, 
  Info,
  ShieldCheck,
  Flame,
  Award,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdmin } from '@/contexts/AdminContext';
import VoucherCalendar14Days, { TimelineDay } from '../components/VoucherCalendar14Days';

export default function VoucherAnalyticsPage() {
  const router = useRouter();
  const { selectedBranchId } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FIXED_AMOUNT' | 'PERCENTAGE' | 'FREE_SHIP'>('ALL');
  const [sortBy, setSortBy] = useState<'REVENUE' | 'USAGE' | 'ROI' | 'DISCOUNT'>('REVENUE');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const branchParam = selectedBranchId ? `?branchId=${selectedBranchId}` : '';
      const res = await fetch(`/api/admin/promotions/vouchers/analytics${branchParam}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        toast.error('Không thể tải dữ liệu báo cáo thống kê');
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const summary = data?.summary || {
    totalVouchers: 0,
    activeVouchers: 0,
    expiredVouchers: 0,
    exhaustedVouchers: 0,
    totalUsageOrders: 0,
    totalDiscountAmount: 0,
    totalOrderRevenue: 0,
    avgDiscountPerOrder: 0,
    avgOrderValue: 0,
    marketingRoi: 0,
  };

  const timelineDays: TimelineDay[] = data?.timelineDays || [];
  const allVoucherStats: any[] = data?.allVoucherStats || [];
  const byDiscountType = data?.byDiscountType || {
    FIXED_AMOUNT: { count: 0, usages: 0, revenue: 0, discount: 0 },
    PERCENTAGE: { count: 0, usages: 0, revenue: 0, discount: 0 },
    FREE_SHIP: { count: 0, usages: 0, revenue: 0, discount: 0 },
  };

  // Filter and sort vouchers drill-down
  const filteredVouchers = allVoucherStats
    .filter(v => {
      const matchSearch = v.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === 'ALL' || v.discountType === typeFilter;
      return matchSearch && matchType;
    })
    .sort((a, b) => {
      if (sortBy === 'REVENUE') return b.totalRevenueGenerated - a.totalRevenueGenerated;
      if (sortBy === 'USAGE') return b.usedCount - a.usedCount;
      if (sortBy === 'ROI') return b.roiMultiplier - a.roiMultiplier;
      if (sortBy === 'DISCOUNT') return b.totalDiscountGiven - a.totalDiscountGiven;
      return 0;
    });

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/vouchers"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Quay lại Danh sách Vouchers</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center font-black shadow-md shadow-red-200">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Báo Cáo & Thống Kê Siêu Chi Tiết Voucher</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  Analytics Hub
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Đo lường doanh thu kích cầu (GMV), ngân sách tài trợ, tỷ lệ ROI marketing và tần suất sử dụng thực tế.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
          
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Printer size={14} />
            <span>In Báo Cáo</span>
          </button>

          <Link
            href="/admin/vouchers/create"
            className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>Thêm Voucher</span>
          </Link>
        </div>
      </div>

      {/* 2. 5 SUPER KPI METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Doanh thu kích cầu (GMV) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-0" />
          <div className="relative z-10">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black mb-2">
              <TrendingUp size={18} />
            </div>
            <p className="text-xs font-semibold text-slate-500">Doanh thu kích cầu (GMV)</p>
            <p className="text-xl font-black text-slate-900 mt-1">
              {summary.totalOrderRevenue.toLocaleString('vi-VN')} ₫
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
              <span>TB {summary.avgOrderValue.toLocaleString('vi-VN')} ₫/đơn</span>
            </p>
          </div>
        </div>

        {/* KPI 2: Ngân sách tài trợ */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 rounded-bl-full -z-0" />
          <div className="relative z-10">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black mb-2">
              <DollarSign size={18} />
            </div>
            <p className="text-xs font-semibold text-slate-500">Ngân sách chiết khấu tài trợ</p>
            <p className="text-xl font-black text-rose-600 mt-1">
              {summary.totalDiscountAmount.toLocaleString('vi-VN')} ₫
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5">
              TB giảm {summary.avgDiscountPerOrder.toLocaleString('vi-VN')} ₫/đơn
            </p>
          </div>
        </div>

        {/* KPI 3: Marketing ROI Multiplier */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-bl-full -z-0" />
          <div className="relative z-10">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black mb-2">
              <Sparkles size={18} />
            </div>
            <p className="text-xs font-semibold text-slate-500">Hệ số ROI Doanh thu</p>
            <p className="text-xl font-black text-amber-600 mt-1">
              {summary.marketingRoi > 0 ? `${summary.marketingRoi}x` : 'N/A'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {summary.marketingRoi > 0 ? `Thu ${summary.marketingRoi}đ trên 1đ giảm` : 'Chưa có phát sinh'}
            </p>
          </div>
        </div>

        {/* KPI 4: Tổng lượt dùng */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0" />
          <div className="relative z-10">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black mb-2">
              <Ticket size={18} />
            </div>
            <p className="text-xs font-semibold text-slate-500">Tổng đơn dùng voucher</p>
            <p className="text-xl font-black text-slate-900 mt-1">
              {summary.totalUsageOrders} đơn
            </p>
            <p className="text-[11px] text-blue-600 font-medium mt-1.5">
              {summary.activeVouchers} voucher đang hoạt động
            </p>
          </div>
        </div>

        {/* KPI 5: Tỷ lệ phủ & Tình trạng */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50 rounded-bl-full -z-0" />
          <div className="relative z-10">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black mb-2">
              <Users size={18} />
            </div>
            <p className="text-xs font-semibold text-slate-500">Tình trạng kho voucher</p>
            <p className="text-xl font-black text-slate-900 mt-1">
              {summary.totalVouchers} mã
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {summary.exhaustedVouchers} hết lượt • {summary.expiredVouchers} hết hạn
            </p>
          </div>
        </div>

      </div>

      {/* 3. LỊCH THỐNG KÊ 14 NGÀY GẦN NHẤT SIÊU XỊN XÒ */}
      <VoucherCalendar14Days timelineDays={timelineDays} />

      {/* 4. CƠ CẤU THEO LOẠI CHIẾT KHẤU */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Percent size={18} className="text-red-600" />
              <span>Cơ Cấu Hiệu Quả Theo Loại Ưu Đãi</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              So sánh đóng góp doanh thu và chi phí giữa các phương thức khuyến mãi.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card: Giảm tiền cố định */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Giảm Tiền Cố Định</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {byDiscountType.FIXED_AMOUNT.count} voucher
              </span>
            </div>
            <p className="text-lg font-black text-slate-900">
              {byDiscountType.FIXED_AMOUNT.revenue.toLocaleString('vi-VN')} ₫
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Doanh thu ({byDiscountType.FIXED_AMOUNT.usages} lượt dùng)
            </p>
            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-400">Chiết khấu tài trợ:</span>
              <span className="font-bold text-rose-600">-{byDiscountType.FIXED_AMOUNT.discount.toLocaleString('vi-VN')} ₫</span>
            </div>
          </div>

          {/* Card: Giảm phần trăm */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Giảm Theo Phần Trăm (%)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {byDiscountType.PERCENTAGE.count} voucher
              </span>
            </div>
            <p className="text-lg font-black text-slate-900">
              {byDiscountType.PERCENTAGE.revenue.toLocaleString('vi-VN')} ₫
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Doanh thu ({byDiscountType.PERCENTAGE.usages} lượt dùng)
            </p>
            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-400">Chiết khấu tài trợ:</span>
              <span className="font-bold text-rose-600">-{byDiscountType.PERCENTAGE.discount.toLocaleString('vi-VN')} ₫</span>
            </div>
          </div>

          {/* Card: FreeShip */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Truck size={14} className="text-emerald-600" />
                Miễn Phí Giao Hàng
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {byDiscountType.FREE_SHIP.count} voucher
              </span>
            </div>
            <p className="text-lg font-black text-slate-900">
              {byDiscountType.FREE_SHIP.revenue.toLocaleString('vi-VN')} ₫
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Doanh thu ({byDiscountType.FREE_SHIP.usages} lượt dùng)
            </p>
            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-400">Chiết khấu tài trợ:</span>
              <span className="font-bold text-rose-600">-{byDiscountType.FREE_SHIP.discount.toLocaleString('vi-VN')} ₫</span>
            </div>
          </div>

        </div>
      </div>

      {/* 5. BẢNG THỐNG KÊ SIÊU CHI TIẾT TỪNG VOUCHER (DRILL-DOWN TABLE) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Ticket size={18} className="text-red-600" />
              <span>Bảng Thống Kê Hiệu Quả Từng Voucher</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {filteredVouchers.length} mã
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chi tiết doanh thu, chiết khấu đã tài trợ, giá trị đơn trung bình (AOV) và hệ số ROI của từng mã.
            </p>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã hoặc tiêu đề..."
                className="pl-8 pr-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 w-48 sm:w-56"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả loại mã</option>
              <option value="FIXED_AMOUNT">Giảm tiền</option>
              <option value="PERCENTAGE">Giảm %</option>
              <option value="FREE_SHIP">FreeShip</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="REVENUE">Sắp xếp: Doanh thu cao nhất</option>
              <option value="USAGE">Sắp xếp: Lượt dùng nhiều nhất</option>
              <option value="ROI">Sắp xếp: ROI cao nhất</option>
              <option value="DISCOUNT">Sắp xếp: Chiết khấu nhiều nhất</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200/80">
                <th className="p-3.5 pl-4">Voucher</th>
                <th className="p-3.5">Loại & Mức giảm</th>
                <th className="p-3.5">Tiến độ sử dụng</th>
                <th className="p-3.5 text-right">Doanh thu (GMV)</th>
                <th className="p-3.5 text-right">Chiết khấu</th>
                <th className="p-3.5 text-right">Đơn TB (AOV)</th>
                <th className="p-3.5 text-center">Hệ số ROI</th>
                <th className="p-3.5 pr-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Không tìm thấy voucher nào phù hợp tiêu chí lọc.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => {
                  const usagePercent = v.usageLimit ? Math.round((v.usedCount / v.usageLimit) * 100) : null;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      
                      {/* Code & Title */}
                      <td className="p-3.5 pl-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {v.code}
                          </span>
                          {!v.isActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                              Tắt
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 font-medium text-[11px] mt-0.5 line-clamp-1 max-w-xs">
                          {v.title}
                        </p>
                      </td>

                      {/* Type & Discount */}
                      <td className="p-3.5">
                        <span className="font-bold text-slate-800">
                          {v.discountType === 'PERCENTAGE' ? `Giảm ${v.discountValue}%` :
                           v.discountType === 'FREE_SHIP' ? 'Free Ship' :
                           `Giảm ${(v.discountValue / 1000)}K`}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Đơn từ {(v.minOrderValue / 1000)}K
                        </p>
                      </td>

                      {/* Usage quota */}
                      <td className="p-3.5 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                          <span>{v.usedCount} lượt</span>
                          <span className="text-slate-400">
                            {v.usageLimit ? `/ ${v.usageLimit}` : 'Không giới hạn'}
                          </span>
                        </div>
                        {v.usageLimit ? (
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                usagePercent && usagePercent >= 90
                                  ? 'bg-rose-500'
                                  : usagePercent && usagePercent >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(usagePercent || 0, 100)}%` }}
                            />
                          </div>
                        ) : null}
                      </td>

                      {/* Revenue GMV */}
                      <td className="p-3.5 text-right font-black text-emerald-700">
                        {v.totalRevenueGenerated.toLocaleString('vi-VN')} ₫
                      </td>

                      {/* Discount given */}
                      <td className="p-3.5 text-right font-bold text-rose-600">
                        -{v.totalDiscountGiven.toLocaleString('vi-VN')} ₫
                      </td>

                      {/* AOV */}
                      <td className="p-3.5 text-right text-slate-700 font-medium">
                        {v.avgOrderValue > 0 ? `${v.avgOrderValue.toLocaleString('vi-VN')} ₫` : '-'}
                      </td>

                      {/* ROI Multiplier */}
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-0.5 text-[11px] font-black px-2 py-0.5 rounded-full ${
                          v.roiMultiplier >= 5
                            ? 'bg-emerald-100 text-emerald-800'
                            : v.roiMultiplier >= 2
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {v.roiMultiplier > 0 ? `${v.roiMultiplier}x` : '-'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 pr-4 text-center">
                        <Link
                          href={`/admin/vouchers/edit?id=${v.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                        >
                          <Edit2 size={12} />
                          <span>Sửa</span>
                        </Link>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
