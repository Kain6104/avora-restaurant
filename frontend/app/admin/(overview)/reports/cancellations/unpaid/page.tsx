'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import {
  ArrowLeft,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Building2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  User as UserIcon,
  ShoppingBag,
  Store,
  Truck,
  CheckCircle2,
  XCircle,
  ChefHat,
  Ban,
  Receipt,
  FileText,
  DollarSign,
  Info,
  ShieldAlert,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { PageHeader, AdminCard, StatusBadge } from '@/app/admin/components/ui';

export default function UnpaidOrderCancellationReportPage() {
  const router = useRouter();
  const { selectedBranchId, allBranches } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Filters
  const [datePreset, setDatePreset] = useState<string>('30days');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL') {
      setBranchFilter(selectedBranchId);
    }
  }, [selectedBranchId]);

  const formatMoney = useCallback((amount: number = 0) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo) p.set('dateTo', dateTo);
      if (branchFilter && branchFilter !== 'ALL') p.set('branchId', branchFilter);
      if (reasonFilter && reasonFilter !== 'ALL') p.set('reasonCode', reasonFilter);
      if (searchTerm) p.set('search', searchTerm.trim());

      const res = await fetch(`/api/admin/cancellations/unpaid?${p.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        // Mặc định mở rộng ngày đầu tiên
        if (json.data.groupedByDate && json.data.groupedByDate.length > 0) {
          const firstDate = json.data.groupedByDate[0].date;
          setExpandedDates((prev) => ({ ...prev, [firstDate]: true }));
        }
      }
    } catch (e) {
      console.error('Error fetching unpaid cancellations:', e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, branchFilter, reasonFilter, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const d = new Date();
    if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      d.setDate(d.getDate() - 1);
      const str = d.toISOString().split('T')[0];
      setDateFrom(str);
      setDateTo(str);
    } else if (preset === '7days') {
      d.setDate(d.getDate() - 7);
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo(now.toISOString().split('T')[0]);
    } else if (preset === '30days') {
      d.setDate(d.getDate() - 30);
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo(now.toISOString().split('T')[0]);
    }
  };

  const toggleDate = (dateStr: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  const kpis = data?.kpis;
  const groupedByDate = data?.groupedByDate || [];

  return (
    <div className="space-y-4 md:space-y-6 pb-12 admin-page-wrapper">
      {/* Header */}
      <PageHeader
        title="Báo Cáo Hủy Đơn Chưa Thanh Toán"
        subtitle="Theo dõi chi tiết các đơn hàng bị hủy khi chưa thu tiền: đối soát lý do hủy, hao hụt bếp, thu hồi voucher và điểm thưởng"
        breadcrumbs={[
          { label: 'Tổng quan', href: '/admin' },
          { label: 'Báo cáo', href: '/admin/reports' },
          { label: 'Báo cáo tài chính', href: '/admin/reports/financial' },
          { label: 'Hủy đơn chưa thanh toán' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/reports/cancellations/paid"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-2xs min-h-[38px]"
            >
              <Receipt size={14} className="text-amber-600" />
              <span>Xem Báo Cáo Hủy Hóa Đơn Đã Thu</span>
            </Link>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 min-h-[38px]"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>
          </div>
        }
      />

      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* KPI 1: Số đơn hủy */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tổng Đơn Hủy Chưa Thu</span>
            <Ban size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {kpis?.totalCancelledOrders?.toLocaleString('vi-VN') || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Đơn hàng chưa phát sinh tiền</div>
        </div>

        {/* KPI 2: GIÁ TRỊ ĐƠN HỦY CHƯA THU (EXCLUDED FROM REVENUE ALERT) */}
        <div className="bg-gradient-to-br from-rose-50 to-white p-4 rounded-xl border border-rose-200 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Giá Trị Đơn Hủy Chưa Thu</span>
            <AlertCircle size={16} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-800">
            {formatMoney(kpis?.totalCancelledOrderValue || 0)}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 mt-1">
            <ShieldAlert size={12} />
            <span>LOẠI TRỪ 100% KHỎI DOANH THU THỰC</span>
          </div>
        </div>

        {/* KPI 3: Hủy sau khi gửi bếp */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Hủy Sau Khi Gửi Bếp</span>
            <ChefHat size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800">
            {kpis?.cancelledAfterKitchenDispatch?.toLocaleString('vi-VN') || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Nguy cơ hao hụt nguyên vật liệu</div>
        </div>

        {/* KPI 4: Giao dịch ngân hàng trễ */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">GD Ngân Hàng Sau Hủy</span>
            <Clock size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-800">
            {kpis?.ordersWithLateBankNotifications?.toLocaleString('vi-VN') || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Cần đối soát / hoàn tiền khách</div>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {[
              { id: 'today', label: 'Hôm nay' },
              { id: 'yesterday', label: 'Hôm qua' },
              { id: '7days', label: '7 ngày' },
              { id: '30days', label: '30 ngày' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition min-h-[32px] ${
                  datePreset === p.id
                    ? 'bg-[#800020] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Branch Filter */}
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-slate-400" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-[#800020] min-h-[36px]"
            >
              <option value="ALL">Toàn Hệ Thống (Tất cả chi nhánh)</option>
              {allBranches?.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.branchCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Từ Ngày</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setDatePreset('custom');
              }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 min-h-[36px]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Đến Ngày</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setDatePreset('custom');
              }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 min-h-[36px]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Lý Do Hủy</label>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 min-h-[36px]"
            >
              <option value="ALL">Tất cả lý do</option>
              <option value="CUSTOMER_CHANGED_MIND">Khách hàng đổi ý</option>
              <option value="CUSTOMER_WRONG_ITEM">Khách đặt nhầm món</option>
              <option value="STAFF_INPUT_ERROR">Nhân viên nhập nhầm món</option>
              <option value="DUPLICATE_ORDER">Trùng đơn hàng</option>
              <option value="WRONG_ORDER_INFO">Sai thông tin đơn hàng</option>
              <option value="OUT_OF_STOCK_INGREDIENTS">Hết nguyên liệu</option>
              <option value="OUT_OF_STOCK_ITEM">Hết món</option>
              <option value="CANNOT_DELIVER">Không thể giao hàng</option>
              <option value="CANNOT_CONTACT_CUSTOMER">Không liên hệ được khách</option>
              <option value="CUSTOMER_NO_SHOW">Khách không đến nhận</option>
              <option value="SYSTEM_ERROR">Lỗi hệ thống</option>
              <option value="OTHER">Lý do khác</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tìm Kiếm</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Mã hủy, mã đơn, tên, SĐT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 min-h-[36px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* GROUPED LIST BY DATE */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
          <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold uppercase tracking-wider">Đang tải dữ liệu đơn hủy...</span>
        </div>
      ) : groupedByDate.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <Ban size={40} className="mx-auto mb-2 text-slate-300" />
          <h4 className="font-bold text-slate-700">Không có đơn hủy chưa thanh toán nào</h4>
          <p className="text-xs text-slate-400 mt-1">Không tìm thấy bản ghi phù hợp với bộ lọc đã chọn</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByDate.map((group: any) => {
            const isExpanded = expandedDates[group.date] ?? false;
            return (
              <div key={group.date} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                {/* Date Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleDate(group.date)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-100/80 transition text-left cursor-pointer border-b border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md bg-white border border-slate-300 flex items-center justify-center text-slate-600">
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-500" />
                        <span className="font-black text-sm text-slate-800">
                          {new Date(group.date).toLocaleDateString('vi-VN', {
                            weekday: 'long',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">Ngày hủy đơn</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">
                        {group.orderCount} đơn hủy
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">Số lượng</span>
                    </div>
                    <div>
                      <span className="text-sm font-black text-rose-700 block">
                        {formatMoney(group.totalValue)}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">Giá trị chưa thu</span>
                    </div>
                  </div>
                </button>

                {/* Orders in this Date */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Thời điểm</th>
                          <th className="py-2.5 px-3">Mã Hủy / Mã Đơn</th>
                          <th className="py-2.5 px-3">Chi Nhánh / Vị Trí</th>
                          <th className="py-2.5 px-3">Khách Hàng</th>
                          <th className="py-2.5 px-3">Món Ăn</th>
                          <th className="py-2.5 px-3 text-right">Giá Trị Đơn</th>
                          <th className="py-2.5 px-3">Lý Do Hủy</th>
                          <th className="py-2.5 px-3">Nhân Sự Hủy</th>
                          <th className="py-2.5 px-3 text-center">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.map((row: any) => (
                          <tr key={row.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                              {new Date(row.createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              <span className="font-bold text-rose-700 block">{row.cancellationCode}</span>
                              <span className="text-[10px] text-slate-400">
                                {row.orderCode || row.order?.temporaryOrderCode || '--'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-800 block">
                                {row.branch?.name || row.branchId}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {row.order?.table?.name ? `Bàn ${row.order.table.name}` : 'Mang đi / Giao hàng'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-800 block">
                                {row.customerName || 'Khách vãng lai'}
                              </span>
                              <span className="text-[10px] text-slate-400">{row.customerPhone || '--'}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              <span className="font-bold">
                                {row.order?.orderItems?.length || 0} món
                              </span>
                              {row.kitchenTicketDispatched && (
                                <span className="ml-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 font-bold text-[9px] rounded uppercase">
                                  Đã gửi bếp
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-rose-700 whitespace-nowrap">
                              {formatMoney(row.originalTotal)}
                            </td>
                            <td className="py-2.5 px-3 max-w-xs">
                              <span className="font-bold text-slate-800 block truncate">
                                {row.reasonCode}
                              </span>
                              {row.explanation && (
                                <span className="text-[11px] text-slate-500 line-clamp-1">
                                  {row.explanation}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-bold text-slate-800 block">
                                {row.cancelledByName || row.requestedByName || 'Hệ thống'}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase font-mono">
                                {row.cancelledByRole || row.requestedByRole || 'STAFF'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => {
                                  setSelectedItem(row);
                                  setIsDetailModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition cursor-pointer"
                              >
                                Chi tiết
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DRILL-DOWN DETAIL MODAL */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <Ban size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Hồ Sơ Hủy Đơn #{selectedItem.cancellationCode}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Thời điểm hủy: {new Date(selectedItem.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Order Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Mã Đơn Gốc</span>
                  <strong className="text-slate-900 font-mono text-sm">
                    {selectedItem.orderCode || selectedItem.order?.temporaryOrderCode || '--'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Chi Nhánh</span>
                  <strong className="text-slate-900">{selectedItem.branch?.name || '--'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Khách Hàng</span>
                  <strong className="text-slate-900">{selectedItem.customerName || 'Khách vãng lai'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Vị Trí Phục Vụ</span>
                  <strong className="text-slate-900">
                    {selectedItem.order?.table?.name ? `Bàn ${selectedItem.order.table.name}` : 'Mang đi / Online'}
                  </strong>
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign size={14} className="text-slate-500" />
                  <span>Chi Tiết Giá Trị Hủy (Excluded From Revenue)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 pt-1">
                  <div>Tiền món: <strong className="text-slate-900">{formatMoney(selectedItem.subtotal)}</strong></div>
                  <div>Giảm giá: <strong className="text-amber-700">-{formatMoney(selectedItem.discountAmount)}</strong></div>
                  <div>Thuế VAT: <strong className="text-blue-700">+{formatMoney(selectedItem.taxAmount)}</strong></div>
                  <div>Phí dịch vụ: <strong className="text-slate-900">+{formatMoney(selectedItem.serviceChargeTotal)}</strong></div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-700">TỔNG GIÁ TRỊ ĐƠN HỦY CHƯA THU:</span>
                  <strong className="text-base font-black text-rose-700">{formatMoney(selectedItem.originalTotal)}</strong>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Số tiền thực thu: <strong>0 ₫</strong></span>
                  <span>Số tiền hoàn lại: <strong>0 ₫</strong></span>
                </div>
              </div>

              {/* Cancellation Reason & Staff */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2">
                <h4 className="font-bold text-rose-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Info size={14} className="text-rose-600" />
                  <span>Thông Tin Lý Do Hủy & Kiểm Toán</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-500 block">Lý do chuẩn hóa:</span>
                    <strong className="text-rose-900 font-bold">{selectedItem.reasonCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nhân viên hủy:</span>
                    <strong className="text-slate-900 font-bold">
                      {selectedItem.cancelledByName || 'Admin'} ({selectedItem.cancelledByRole || 'STAFF'})
                    </strong>
                  </div>
                </div>
                {selectedItem.explanation && (
                  <div className="pt-2 border-t border-rose-100">
                    <span className="text-slate-500 block">Giải thích chi tiết:</span>
                    <p className="text-slate-800 font-medium italic mt-0.5">{selectedItem.explanation}</p>
                  </div>
                )}
                {selectedItem.notes && (
                  <div className="pt-1">
                    <span className="text-slate-500 block">Ghi chú bổ sung:</span>
                    <p className="text-slate-700 mt-0.5">{selectedItem.notes}</p>
                  </div>
                )}
              </div>

              {/* Operational & Kitchen Info */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <ChefHat size={14} className="text-slate-500" />
                  <span>Trạng Thái Bếp & Thất Thoát (Waste)</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    Đã in phiếu hủy bếp:{' '}
                    <strong>{selectedItem.kitchenTicketDispatched ? 'CÓ (Đã gửi bếp)' : 'KHÔNG (Chưa gửi bếp)'}</strong>
                  </div>
                  <div>
                    Ghi nhận hao hụt/lãng phí món:{' '}
                    <strong>{selectedItem.wasteRecorded ? 'CÓ' : 'KHÔNG'}</strong>
                  </div>
                </div>
                {selectedItem.wasteNotes && (
                  <p className="text-slate-600 italic">Ghi chú hao hụt: {selectedItem.wasteNotes}</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <Link
                href={`/admin/orders/${selectedItem.orderId}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#800020] hover:underline"
              >
                <span>Mở trang chi tiết đơn hàng</span>
                <ExternalLink size={13} />
              </Link>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
