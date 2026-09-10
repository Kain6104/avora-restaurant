'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Ticket, 
  Plus, 
  BarChart3, 
  ShieldAlert, 
  Search, 
  Filter, 
  Check, 
  X, 
  Edit2, 
  Trash2, 
  Power, 
  PowerOff, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Truck, 
  ExternalLink, 
  AlertTriangle, 
  AlertCircle, 
  ShieldCheck, 
  RefreshCw,
  Calendar,
  Sparkles,
  ChevronRight,
  Lock,
  Info,
  Bell,
  Wallet
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdmin } from '@/contexts/AdminContext';
import VoucherCalendar14Days from './components/VoucherCalendar14Days';

export default function VouchersPage() {
  const router = useRouter();
  const { selectedBranchId } = useAdmin();

  // Active view tab: 'LIST' | 'ANALYTICS' | 'FRAUD_ALERTS'
  const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYTICS' | 'FRAUD_ALERTS'>('LIST');

  // Vouchers List State
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'EXHAUSTED' | 'EXPIRED'>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Analytics State
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Fraud Alerts State
  const [fraudData, setFraudData] = useState<any>(null);
  const [loadingFraud, setLoadingFraud] = useState(false);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 1. Fetch vouchers list
  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/promotions/vouchers?limit=100`;
      if (searchTerm.trim()) url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      if (selectedBranchId && selectedBranchId !== 'ALL') url += `&branchIdScope=${selectedBranchId}`;

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setVouchers(json?.data || []);
      }
    } catch (err) {
      console.error('Error fetching vouchers:', err);
      toast.error('Lỗi khi tải danh sách Voucher');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedBranchId]);

  // 2. Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      let url = `/api/admin/promotions/vouchers/analytics`;
      if (selectedBranchId && selectedBranchId !== 'ALL') url += `?branchIdScope=${selectedBranchId}`;

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json?.data || null);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [selectedBranchId]);

  // 3. Fetch fraud alerts
  const fetchFraudAlerts = useCallback(async () => {
    setLoadingFraud(true);
    try {
      let url = `/api/admin/promotions/vouchers/fraud-alerts`;
      if (selectedBranchId && selectedBranchId !== 'ALL') url += `?branchIdScope=${selectedBranchId}`;

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setFraudData(json?.data || null);
      }
    } catch (err) {
      console.error('Error fetching fraud alerts:', err);
    } finally {
      setLoadingFraud(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchVouchers();
    fetchAnalytics();
    fetchFraudAlerts();
  }, [fetchVouchers, fetchAnalytics, fetchFraudAlerts]);

  // Toggle Voucher Active
  const handleToggleActive = async (voucher: any) => {
    try {
      const res = await fetch(`/api/admin/promotions/vouchers/${voucher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !voucher.isActive }),
      });
      if (res.ok) {
        toast.success(voucher.isActive ? `Đã tạm khóa mã [${voucher.code}]` : `Đã kích hoạt mã [${voucher.code}]`);
        fetchVouchers();
        fetchAnalytics();
      } else {
        toast.error('Không thể cập nhật trạng thái');
      }
    } catch (_) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  // Delete Voucher
  const handleDeleteVoucher = async () => {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/admin/promotions/vouchers/${deletingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Đã xóa voucher thành công');
        setDeletingId(null);
        fetchVouchers();
        fetchAnalytics();
      } else {
        toast.error('Không thể xóa voucher đã có phát sinh đơn hàng');
      }
    } catch (_) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  // Auto Distribute Voucher to Customer Wallets
  const handleAutoDistribute = async (voucher: any) => {
    if (!window.confirm(`Hệ thống sẽ kiểm tra điều kiện đối tượng của mã "${voucher.code}" và tự động phát vào Ví voucher cho các khách hàng đủ điều kiện. Bạn có chắc chắn muốn thực hiện?`)) {
      return;
    }
    const loadingToast = toast.loading(`Đang tự động phát mã "${voucher.code}" vào ví khách hàng...`);
    try {
      const res = await fetch(`/api/admin/promotions/vouchers/${voucher.id}/auto-distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || `Đã phát voucher thành công!`, { id: loadingToast, duration: 4000 });
      } else {
        toast.error(json.message || 'Lỗi khi phát voucher', { id: loadingToast });
      }
    } catch {
      toast.error('Không thể kết nối máy chủ', { id: loadingToast });
    }
  };

  // Filter list
  const filteredVouchers = vouchers.filter((v) => {
    const now = new Date();
    const isExpired = new Date(v.endDate) < now;
    const isExhausted = v.usageLimit !== null && v.usedCount >= v.usageLimit;

    if (filterStatus === 'ACTIVE' && (!v.isActive || isExpired || isExhausted)) return false;
    if (filterStatus === 'INACTIVE' && v.isActive) return false;
    if (filterStatus === 'EXPIRED' && !isExpired) return false;
    if (filterStatus === 'EXHAUSTED' && !isExhausted) return false;

    if (filterType !== 'ALL' && v.discountType !== filterType) return false;

    return true;
  });

  const criticalAlertCount = fraudData?.criticalCount || 0;
  const totalAlertCount = fraudData?.totalAlerts || 0;

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. TOP HEADER WITH ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-red-50 text-red-600">
              <Ticket size={22} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Quản Lý Mã Ưu Đãi (Vouchers)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Hệ thống phát hành khuyến mãi, phân tích doanh thu liên kết và cảnh báo gian lận lạm dụng mã.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              fetchVouchers();
              fetchAnalytics();
              fetchFraudAlerts();
              toast.success('Đã làm mới dữ liệu');
            }}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={16} />
          </button>

          {/* Create Button */}
          <Link
            href="/admin/vouchers/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Thêm Voucher Mới</span>
          </Link>
        </div>
      </div>

      {/* 2. TOP KPI CARDS STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đang hoạt động</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {analytics?.summary?.activeVouchers ?? '...'}
              <span className="text-xs font-normal text-slate-400 ml-1">
                / {analytics?.summary?.totalVouchers ?? vouchers.length} mã
              </span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <Ticket size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lượt dùng thành công</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {(analytics?.summary?.totalUsageOrders ?? 0).toLocaleString('vi-VN')}
              <span className="text-xs font-normal text-slate-400 ml-1">đơn</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng ngân sách giảm</p>
            <p className="text-xl sm:text-2xl font-black text-red-600 mt-0.5">
              {((analytics?.summary?.totalDiscountAmount ?? 0) / 1000000).toFixed(1)}M
              <span className="text-xs font-normal text-slate-400 ml-1">VNĐ</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Doanh thu mang lại</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {((analytics?.summary?.totalOrderRevenue ?? 0) / 1000000).toFixed(1)}M
              <span className="text-xs font-normal text-slate-400 ml-1">VNĐ</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <TrendingUp size={20} />
          </div>
        </div>

      </div>

      {/* 3. NAVIGATION VIEW TABS */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('LIST')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'LIST'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Ticket size={16} />
            <span>Danh sách Vouchers ({vouchers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'ANALYTICS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <BarChart3 size={16} />
            <span>Báo cáo Thống kê & Hiệu quả</span>
          </button>

          <button
            onClick={() => setActiveTab('FRAUD_ALERTS')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 relative ${
              activeTab === 'FRAUD_ALERTS'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
            }`}
          >
            <ShieldAlert size={16} />
            <span>Cảnh Báo Gian Lận</span>
            {totalAlertCount > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeTab === 'FRAUD_ALERTS' ? 'bg-white text-red-600' : 'bg-red-600 text-white'
              }`}>
                {totalAlertCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'FRAUD_ALERTS' && criticalAlertCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl font-bold animate-pulse">
            <AlertTriangle size={14} />
            <span>Phát hiện {criticalAlertCount} cảnh báo rủi ro cao!</span>
          </div>
        )}
      </div>

      {/* 4. TAB CONTENT 1: VOUCHERS LIST */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          
          {/* Filter Toolbar */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã code hoặc tên voucher..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {/* Filter by Status */}
              <select
                value={filterStatus}
                onChange={(e: any) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Tạm khóa</option>
                <option value="EXHAUSTED">Hết lượt</option>
                <option value="EXPIRED">Hết hạn</option>
              </select>

              {/* Filter by Type */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="ALL">Mọi loại chiết khấu</option>
                <option value="FIXED_AMOUNT">Giảm tiền mặt</option>
                <option value="PERCENTAGE">Giảm phần trăm (%)</option>
                <option value="FREE_SHIP">Miễn phí ship</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mb-2 text-red-600" />
                <p className="text-xs font-medium">Đang tải danh sách voucher...</p>
              </div>
            ) : filteredVouchers.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Không tìm thấy voucher nào</p>
                <p className="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc thêm voucher mới.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Mã Voucher & Tiêu đề</th>
                      <th className="py-3.5 px-4">Mức giảm giá</th>
                      <th className="py-3.5 px-4">Hạn ngạch & Sử dụng</th>
                      <th className="py-3.5 px-4">Thời gian hiệu lực</th>
                      <th className="py-3.5 px-4 text-center">Trạng thái</th>
                      <th className="py-3.5 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVouchers.map((v) => {
                      const now = new Date();
                      const isExpired = new Date(v.endDate) < now;
                      const isExhausted = v.usageLimit !== null && v.usedCount >= v.usageLimit;
                      const usagePercent = v.usageLimit 
                        ? Math.min(100, Math.round((v.usedCount / v.usageLimit) * 100))
                        : 0;

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          
                          {/* Code & Title */}
                          <td className="py-3.5 px-4 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-900 border border-slate-200">
                                {v.code}
                              </span>
                              {v.isPublic ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Công khai
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  Mã ẩn
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-slate-900 mt-1 line-clamp-1">{v.title}</p>
                            <p className="text-[11px] text-slate-400">
                              Đơn tối thiểu: {v.minOrderValue.toLocaleString('vi-VN')}đ
                            </p>
                          </td>

                          {/* Discount Type */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {v.discountType === 'PERCENTAGE' && (
                              <div>
                                <span className="font-bold text-red-600">Giảm {v.discountValue}%</span>
                                {v.maxDiscount && (
                                  <span className="block text-[11px] text-slate-400">
                                    Tối đa {(v.maxDiscount / 1000).toLocaleString('vi-VN')}k
                                  </span>
                                )}
                              </div>
                            )}
                            {v.discountType === 'FIXED_AMOUNT' && (
                              <div>
                                <span className="font-bold text-red-600">
                                  Giảm {v.discountValue.toLocaleString('vi-VN')}đ
                                </span>
                              </div>
                            )}
                            {v.discountType === 'FREE_SHIP' && (
                              <div>
                                <span className="font-bold text-emerald-600 flex items-center gap-1">
                                  <Truck size={14} />
                                  <span>FreeShip {v.discountValue > 0 ? `(tối đa ${(v.discountValue/1000)}k)` : '100%'}</span>
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Quota & Usage */}
                          <td className="py-3.5 px-4 min-w-[150px]">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                              <span>{v.usedCount} lượt</span>
                              <span className="text-slate-400 font-normal">
                                {v.usageLimit ? `/ ${v.usageLimit}` : '(Vô hạn)'}
                              </span>
                            </div>
                            {v.usageLimit ? (
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    usagePercent >= 90 ? 'bg-rose-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${usagePercent}%` }}
                                />
                              </div>
                            ) : null}
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              Mỗi khách: {v.usageLimitPerUser || 1} lần
                            </span>
                          </td>

                          {/* Validity Period */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600">
                            <div>Bắt đầu: {new Date(v.startDate).toLocaleDateString('vi-VN')}</div>
                            <div className={isExpired ? 'text-rose-600 font-semibold' : 'text-slate-500'}>
                              HSD: {new Date(v.endDate).toLocaleDateString('vi-VN')}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isExpired ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                Đã hết hạn
                              </span>
                            ) : isExhausted ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                Hết lượt dùng
                              </span>
                            ) : v.isActive ? (
                              <button
                                type="button"
                                onClick={() => handleToggleActive(v)}
                                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Power size={10} />
                                <span>Đang chạy</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleActive(v)}
                                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <PowerOff size={10} />
                                <span>Tạm khóa</span>
                              </button>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Auto Distribute to Customer Wallets */}
                              <button
                                type="button"
                                onClick={() => handleAutoDistribute(v)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="Tự động phát vào ví khách hàng đủ điều kiện"
                              >
                                <Wallet size={15} />
                              </button>

                              {/* Send Notification & Email Campaign */}
                              <Link
                                href={`/admin/vouchers/${v.id}/notify`}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                title="Gửi thông báo & Email cho khách hàng"
                              >
                                <Bell size={15} />
                              </Link>

                              {/* Edit Button -> Navigates to /admin/vouchers/[id]/edit */}
                              <Link
                                href={`/admin/vouchers/${v.id}/edit`}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Chỉnh sửa Voucher"
                              >
                                <Edit2 size={15} />
                              </Link>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => setDeletingId(v.id)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Xóa Voucher"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 5. TAB CONTENT 2: ANALYTICS & PERFORMANCE */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          
          {loadingAnalytics ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-red-600" />
              <p className="text-xs">Đang phân tích dữ liệu Voucher...</p>
            </div>
          ) : (
            <>
              {/* Detailed KPI breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                  <p className="text-xs text-slate-500 font-medium">Giá trị giảm trung bình/đơn</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {(analytics?.summary?.avgDiscountPerOrder ?? 0).toLocaleString('vi-VN')}đ
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Dựa trên các đơn hàng đã áp dụng voucher</p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                  <p className="text-xs text-slate-500 font-medium">Voucher hết hạn & hết lượt</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {analytics?.summary?.expiredVouchers ?? 0}
                    <span className="text-xs font-normal text-slate-400 ml-1">hết hạn</span> • {analytics?.summary?.exhaustedVouchers ?? 0}
                    <span className="text-xs font-normal text-slate-400 ml-1">hết lượt</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Cần gia hạn hoặc bổ sung hạn ngạch mới</p>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                  <p className="text-xs text-slate-500 font-medium">Tỷ lệ chiết khấu trên doanh thu</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">
                    {analytics?.summary?.totalOrderRevenue > 0
                      ? Math.round((analytics.summary.totalDiscountAmount / (analytics.summary.totalOrderRevenue + analytics.summary.totalDiscountAmount)) * 100)
                      : 0}%
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Chi phí marketing voucher an toàn (ngưỡng &lt; 20%)</p>
                </div>
              </div>

              {/* Top 10 High Performing Vouchers Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      Top 10 Voucher Sinh Lời & Hiệu Quả Nhất
                    </h3>
                    <p className="text-xs text-slate-500">Xếp hạng theo tổng doanh thu mang lại cho nhà hàng</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4">Hạng</th>
                        <th className="py-3 px-4">Mã Voucher & Tiêu đề</th>
                        <th className="py-3 px-4 text-center">Lượt dùng</th>
                        <th className="py-3 px-4 text-right">Tổng chiết khấu</th>
                        <th className="py-3 px-4 text-right">Doanh thu thu về</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(analytics?.topVouchers || []).map((tv: any, idx: number) => (
                        <tr key={tv.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-black text-slate-400">#{idx + 1}</td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-900">
                              {tv.code}
                            </span>
                            <span className="font-bold text-slate-800 ml-2">{tv.title}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">
                            {tv.usedCount} lượt
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-red-600">
                            {(tv.totalDiscountGiven || 0).toLocaleString('vi-VN')}đ
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            {(tv.totalRevenueGenerated || 0).toLocaleString('vi-VN')}đ
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/admin/vouchers/${tv.id}/edit`}
                              className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              <span>Chi tiết</span>
                              <ChevronRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 14 Days Super Calendar View */}
              <VoucherCalendar14Days timelineDays={analytics?.timelineDays || []} />

              {/* Banner Link to Dedicated Super-Detailed Analytics Page */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-black">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <span>Xem Báo Cáo Thống Kê Siêu Chi Tiết Toàn Diện</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">MỚI</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Bảng xếp hạng đầy đủ, phân tích cơ cấu chiết khấu (Fixed, %, FreeShip), hệ số ROI và công cụ in báo cáo.
                    </p>
                  </div>
                </div>

                <Link
                  href="/admin/vouchers/analytics"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
                >
                  <span>Mở Trung Tâm Analytics</span>
                  <ChevronRight size={14} />
                </Link>
              </div>

            </>
          )}

        </div>
      )}

      {/* 6. TAB CONTENT 3: FRAUD DETECTION & RISK ALERTS */}
      {activeTab === 'FRAUD_ALERTS' && (
        <div className="space-y-4">
          
          <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-red-200 mb-1">
                <ShieldAlert size={16} />
                <span>Động cơ phân tích rủi ro thời gian thực</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black">
                Trung Tâm Phát Hiện & Cảnh Báo Gian Lận Voucher
              </h2>
              <p className="text-xs text-red-100 max-w-xl mt-1">
                Tự động quét và phát hiện các hành vi lách hạn ngạch (dùng nhiều tài khoản trên 1 SĐT), đặt đơn giữ chỗ rồi huỷ (hoarding), và spike usage dồn dập.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md text-xs font-black">
                {totalAlertCount} sự kiện nghi vấn
              </span>
            </div>
          </div>

          {loadingFraud ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-red-600" />
              <p className="text-xs">Đang quét phân tích rủi ro đơn hàng...</p>
            </div>
          ) : totalAlertCount === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-2xs">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-bold text-base text-slate-800">Không có cảnh báo gian lận nào!</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Hệ thống kiểm toán không phát hiện bất kỳ dấu hiệu lạm dụng voucher, clone tài khoản hoặc spike usage nào trong 60 ngày qua.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(fraudData?.alerts || []).map((alert: any) => {
                const isCritical = alert.severity === 'CRITICAL';
                const isHigh = alert.severity === 'HIGH';

                return (
                  <div
                    key={alert.id}
                    className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-2xs transition-all ${
                      isCritical
                        ? 'border-rose-300 bg-rose-50/20'
                        : isHigh
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            isCritical
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : isHigh
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            MỨC ĐỘ: {alert.severity}
                          </span>

                          <span className="text-xs text-slate-400">
                            Phát hiện lúc: {new Date(alert.lastDetectedAt).toLocaleString('vi-VN')}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm sm:text-base text-slate-900 mt-1">
                          {alert.title}
                        </h4>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {alert.description}
                        </p>

                        {alert.recommendedAction && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold mt-2">
                            <Info size={12} className="text-blue-500" />
                            <span>Đề xuất: {alert.recommendedAction}</span>
                          </div>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                        {alert.phone && (
                          <a
                            href={`tel:${alert.phone}`}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            Gọi khách: {alert.phone}
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            toast.success('Đã ghi nhận xử lý cảnh báo này.');
                            setFraudData((prev: any) => ({
                              ...prev,
                              alerts: prev.alerts.filter((a: any) => a.id !== alert.id),
                              totalAlerts: prev.totalAlerts - 1
                            }));
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          Đã xử lý
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-1">Xác nhận xóa Voucher?</h3>
            <p className="text-xs text-slate-500 mb-5">
              Hành động này sẽ xóa hoàn toàn mã voucher khỏi hệ thống. Những đơn hàng cũ đã dùng mã vẫn sẽ được lưu trữ.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteVoucher}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
