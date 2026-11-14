'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import {
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
  Receipt,
  FileText,
  DollarSign,
  Info,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ExternalLink,
  CreditCard,
  Building,
  HelpCircle,
} from 'lucide-react';
import { PageHeader, AdminCard, StatusBadge } from '@/app/admin/components/ui';

export default function PaidInvoiceCancellationReportPage() {
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
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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
      if (statusFilter && statusFilter !== 'ALL') p.set('status', statusFilter);
      if (reasonFilter && reasonFilter !== 'ALL') p.set('reasonCode', reasonFilter);
      if (searchTerm) p.set('search', searchTerm.trim());

      const res = await fetch(`/api/admin/cancellations/paid?${p.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.groupedByDate && json.data.groupedByDate.length > 0) {
          const firstDate = json.data.groupedByDate[0].date;
          setExpandedDates((prev) => ({ ...prev, [firstDate]: true }));
        }
      }
    } catch (e) {
      console.error('Error fetching paid cancellations:', e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, branchFilter, statusFilter, reasonFilter, searchTerm]);

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
        title="Báo Cáo Hủy Hóa Đơn Đã Thanh Toán"
        subtitle="Quản lý và đối soát toàn diện chu trình hủy hóa đơn đã thu tiền: xét duyệt Dual Approval, tiến độ hoàn tiền thực tế và điều chỉnh hóa đơn VAT"
        breadcrumbs={[
          { label: 'Tổng quan', href: '/admin' },
          { label: 'Báo cáo', href: '/admin/reports' },
          { label: 'Báo cáo tài chính', href: '/admin/reports/financial' },
          { label: 'Hủy hóa đơn đã thanh toán' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/reports/cancellations/unpaid"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-2xs min-h-[38px]"
            >
              <FileText size={14} className="text-rose-600" />
              <span>Xem Báo Cáo Hủy Đơn Chưa Thu</span>
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

      {/* 9 DISTINCT KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {/* Card 1: Số HĐ hủy */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Số HĐ Hủy Đã Thu
          </span>
          <div className="text-lg sm:text-xl font-black text-slate-900">
            {kpis?.countPaidInvoicesCancelled?.toLocaleString('vi-VN') || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Hồ sơ hủy đã thanh toán</div>
        </div>

        {/* Card 2: Giá trị gốc */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Giá Trị Hóa Đơn Gốc
          </span>
          <div className="text-lg sm:text-xl font-black text-slate-900">
            {formatMoney(kpis?.originalInvoiceValue || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Tổng tiền hóa đơn ban đầu</div>
        </div>

        {/* Card 3: Tiền thực thu */}
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/20">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Tiền Đã Thực Thu
          </span>
          <div className="text-lg sm:text-xl font-black text-emerald-800">
            {formatMoney(kpis?.totalPaymentCollected || 0)}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Đã vào tài khoản / két tiền</div>
        </div>

        {/* Card 4: Hoàn tiền đã duyệt */}
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs bg-blue-50/20">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-700 block mb-1">
            Hoàn Tiền Đã Duyệt
          </span>
          <div className="text-lg sm:text-xl font-black text-blue-800">
            {formatMoney(kpis?.refundApproved || 0)}
          </div>
          <div className="text-[10px] text-blue-600 mt-0.5">Đã thông qua Dual Approval</div>
        </div>

        {/* Card 5: HOÀN TIỀN ĐÃ HOÀN TẤT */}
        <div className="bg-white p-3.5 rounded-xl border border-emerald-300 shadow-2xs bg-gradient-to-br from-white to-emerald-50">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
            Hoàn Tiền Đã Hoàn Tất
          </span>
          <div className="text-lg sm:text-xl font-black text-emerald-900">
            {formatMoney(kpis?.refundCompleted || 0)}
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-0.5">Thực chi quỹ / bank</div>
        </div>

        {/* Card 6: HOÀN TIỀN CHỜ XỬ LÝ (TÁCH BIỆT RÕ RÀNG) */}
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs bg-amber-50/30">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
            Hoàn Tiền Chờ Xử Lý
          </span>
          <div className="text-lg sm:text-xl font-black text-amber-800">
            {formatMoney(kpis?.refundPending || 0)}
          </div>
          <div className="text-[10px] text-amber-600 font-bold mt-0.5">Chưa xuất quỹ / Chờ chi</div>
        </div>

        {/* Card 7: Hoàn thất bại */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-600 block mb-1">
            Hoàn Tiền Thất Bại
          </span>
          <div className="text-lg sm:text-xl font-black text-rose-700">
            {formatMoney(kpis?.refundFailed || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Lỗi cổng / bank từ chối</div>
        </div>

        {/* Card 8: Số tiền giữ lại */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-purple-700 block mb-1">
            Tiền Giữ Lại (Chính Sách)
          </span>
          <div className="text-lg sm:text-xl font-black text-purple-800">
            {formatMoney(kpis?.amountRetained || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Phí hủy / Chế tài nhà hàng</div>
        </div>

        {/* Card 9: Tác động tài chính ròng */}
        <div className="col-span-2 sm:col-span-1 bg-white p-3.5 rounded-xl border border-[#800020]/20 shadow-2xs bg-gradient-to-br from-white to-[#800020]/5">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#800020] block mb-1">
            Tác Động Tài Chính Ròng
          </span>
          <div className="text-lg sm:text-xl font-black text-[#800020]">
            {formatMoney(kpis?.netFinancialImpact || 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Thực thu - Đã hoàn</div>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Trạng Thái Hồ Sơ</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 min-h-[36px]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING_APPROVAL">Chờ duyệt hủy (Pending Approval)</option>
              <option value="APPROVED">Đã duyệt (Approved)</option>
              <option value="REFUND_PENDING">Chờ hoàn tiền (Refund Pending)</option>
              <option value="PARTIALLY_REFUNDED">Đã hoàn một phần</option>
              <option value="REFUNDED">Đã hoàn tất toàn bộ tiền (Refunded)</option>
              <option value="REJECTED">Bị từ chối (Rejected)</option>
              <option value="COMPLETED">Đã đóng hồ sơ & xong HĐ thuế</option>
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
          <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold uppercase tracking-wider">Đang tải dữ liệu hồ sơ hủy hóa đơn...</span>
        </div>
      ) : groupedByDate.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <Receipt size={40} className="mx-auto mb-2 text-slate-300" />
          <h4 className="font-bold text-slate-700">Không có hóa đơn hủy nào</h4>
          <p className="text-xs text-slate-400 mt-1">Không tìm thấy bản ghi phù hợp với bộ lọc đã chọn</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByDate.map((group: any) => {
            const isExpanded = expandedDates[group.date] ?? false;
            return (
              <div key={group.date} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
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
                      <span className="text-[11px] text-slate-500">Ngày yêu cầu / hủy hóa đơn</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">{group.count} hóa đơn</span>
                      <span className="text-[10px] text-slate-400 uppercase">Số lượng</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-700 block">
                        {formatMoney(group.totalCollected)}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">Thực thu ban đầu</span>
                    </div>
                    <div>
                      <span className="text-sm font-black text-amber-700 block">
                        {formatMoney(group.completedRefund)}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">Đã hoàn tiền</span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Thời điểm</th>
                          <th className="py-2.5 px-3">Mã Hủy / Mã Đơn</th>
                          <th className="py-2.5 px-3">Chi Nhánh</th>
                          <th className="py-2.5 px-3">Khách Hàng</th>
                          <th className="py-2.5 px-3 text-right">Giá Trị Gốc</th>
                          <th className="py-2.5 px-3 text-right">Đã Thu</th>
                          <th className="py-2.5 px-3 text-right">Đã Hoàn</th>
                          <th className="py-2.5 px-3">Trạng Thái Hồ Sơ</th>
                          <th className="py-2.5 px-3">Người Đề Xuất / Duyệt</th>
                          <th className="py-2.5 px-3 text-center">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.map((row: any) => {
                          const isFullyRefunded = row.status === 'REFUNDED' || row.status === 'COMPLETED';
                          const isPendingApproval = row.status === 'PENDING_APPROVAL' || row.status === 'REQUESTED';
                          const isRejected = row.status === 'REJECTED';

                          return (
                            <tr key={row.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                {new Date(row.createdAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <span className="font-bold text-amber-700 block">{row.cancellationCode}</span>
                                <span className="text-[10px] text-slate-400">
                                  {row.orderCode || row.order?.temporaryOrderCode || '--'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">
                                {row.branch?.name || row.branchId}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-800 block">
                                  {row.customerName || 'Khách vãng lai'}
                                </span>
                                <span className="text-[10px] text-slate-400">{row.customerPhone || '--'}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium text-slate-600 whitespace-nowrap">
                                {formatMoney(row.originalTotal)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                {formatMoney(row.totalCollected)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-rose-700 whitespace-nowrap">
                                {formatMoney(row.totalRefunded)}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                    isFullyRefunded
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isPendingApproval
                                      ? 'bg-amber-100 text-amber-800 animate-pulse'
                                      : isRejected
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="text-[11px]">
                                  <span className="text-slate-500">Tạo: </span>
                                  <strong className="text-slate-800">{row.requestedByName || '--'}</strong>
                                </div>
                                {row.approvedByName && (
                                  <div className="text-[10px] text-emerald-700">
                                    <span>Duyệt: </span>
                                    <strong className="font-semibold">{row.approvedByName}</strong>
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setSelectedItem(row);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition cursor-pointer"
                                >
                                  Xem Timeline
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DRILL-DOWN TIMELINE MODAL */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Chi Tiết & Tiến Trình Hoàn Tiền Hóa Đơn #{selectedItem.cancellationCode}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mã đơn gốc: {selectedItem.orderCode || selectedItem.orderId}
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
              {/* Financial Comparison Summary (Side-by-Side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Box Left: Hóa Đơn Gốc */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Receipt size={14} className="text-slate-600" />
                    <span>Hóa Đơn & Thu Tiền Ban Đầu</span>
                  </h4>
                  <div className="space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Tổng tiền hóa đơn:</span>
                      <strong className="text-slate-900">{formatMoney(selectedItem.originalTotal)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Tổng tiền đã thu:</span>
                      <strong className="text-emerald-700">{formatMoney(selectedItem.totalCollected)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Thu ngân thu tiền:</span>
                      <strong className="text-slate-800">{selectedItem.cashierName || 'Thu ngân quầy'}</strong>
                    </div>
                  </div>
                </div>

                {/* Box Right: Hoàn Tiền & Đảo Ngược */}
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                  <h4 className="font-bold text-amber-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <DollarSign size={14} className="text-amber-700" />
                    <span>Hồ Sơ Hủy & Trạng Thái Hoàn Tiền</span>
                  </h4>
                  <div className="space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Tiền đề xuất hoàn:</span>
                      <strong className="text-slate-900">{formatMoney(selectedItem.requestedRefundAmount)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Đã hoàn thành công:</span>
                      <strong className="text-emerald-700">{formatMoney(selectedItem.totalRefunded)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Tiền giữ lại (chính sách):</span>
                      <strong className="text-purple-700">{formatMoney(selectedItem.retainedAmount)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* 10-STEP CHRONOLOGICAL AUDIT TIMELINE */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-600" />
                  <span>Tiến Trình Nghiệp Vụ Chuẩn (10-Step Chronological Lifecycle)</span>
                </h4>

                <div className="space-y-2.5 pt-1">
                  {/* Step 1: Tạo đơn */}
                  <div className="flex items-start gap-3 text-xs">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <strong className="text-slate-900 block font-semibold">Tạo đơn hàng ban đầu</strong>
                      <span className="text-slate-400 text-[11px]">
                        Thời điểm: {new Date(selectedItem.order?.createdAt || selectedItem.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  {/* Step 2: Xác nhận thanh toán */}
                  <div className="flex items-start gap-3 text-xs">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <strong className="text-slate-900 block font-semibold">
                        Ghi nhận thanh toán thành công ({formatMoney(selectedItem.totalCollected)})
                      </strong>
                      <span className="text-slate-400 text-[11px]">
                        Phương thức: {selectedItem.order?.paymentMethod || 'CASH / VIETQR'}
                      </span>
                    </div>
                  </div>

                  {/* Step 3: Đề xuất hủy hóa đơn */}
                  <div className="flex items-start gap-3 text-xs">
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <strong className="text-amber-900 block font-semibold">
                        Đề xuất hủy hóa đơn bởi {selectedItem.requestedByName} ({selectedItem.requestedByRole || 'STAFF'})
                      </strong>
                      <span className="text-slate-500 text-[11px] block">
                        Lý do: [{selectedItem.reasonCode}] {selectedItem.explanation}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        Thời điểm gửi: {new Date(selectedItem.requestedAt || selectedItem.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  {/* Step 4: Xét duyệt Dual Approval */}
                  <div className="flex items-start gap-3 text-xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${
                        selectedItem.approvedByName
                          ? 'bg-emerald-100 text-emerald-700'
                          : selectedItem.rejectedByName
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      4
                    </div>
                    <div>
                      <strong className="text-slate-900 block font-semibold">
                        {selectedItem.approvedByName
                          ? `Phê duyệt hủy bởi ${selectedItem.approvedByName} (${selectedItem.approvedByRole || 'MANAGER'})`
                          : selectedItem.rejectedByName
                          ? `Từ chối duyệt bởi ${selectedItem.rejectedByName}`
                          : 'Đang chờ phê duyệt từ Quản lý / Kế toán (Dual Approval Required)'}
                      </strong>
                      {selectedItem.approvedAt && (
                        <span className="text-slate-400 text-[10px] block">
                          Thời điểm duyệt: {new Date(selectedItem.approvedAt).toLocaleString('vi-VN')}
                        </span>
                      )}
                      {selectedItem.rejectionReason && (
                        <span className="text-rose-600 text-[11px] block">
                          Lý do từ chối: {selectedItem.rejectionReason}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Step 5: Lệnh chi hoàn tiền */}
                  <div className="flex items-start gap-3 text-xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${
                        selectedItem.totalRefunded > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      5
                    </div>
                    <div>
                      <strong className="text-slate-900 block font-semibold">
                        {selectedItem.totalRefunded > 0
                          ? `Đã thực thi chi hoàn: ${formatMoney(selectedItem.totalRefunded)}`
                          : 'Chưa thực hiện lệnh chi hoàn tiền'}
                      </strong>
                      {selectedItem.refunds && selectedItem.refunds.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {selectedItem.refunds.map((r: any) => (
                            <div key={r.id} className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200">
                              Chi <strong>{formatMoney(r.amount)}</strong> qua <strong>{r.refundMethod}</strong>
                              {r.bankReference && ` (Mã FT: ${r.bankReference})`} bởi {r.executedByName || 'Thủ quỹ'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 6: Xử lý hóa đơn điện tử VAT */}
                  <div className="flex items-start gap-3 text-xs">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${
                        selectedItem.taxInvoiceStatus === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      6
                    </div>
                    <div>
                      <strong className="text-slate-900 block font-semibold">
                        {selectedItem.taxInvoiceStatus === 'COMPLETED'
                          ? `Đã xử lý hóa đơn VAT: ${selectedItem.taxInvoiceAction || 'CANCEL'}`
                          : 'Xử lý chứng từ thuế VAT: Không áp dụng hoặc Đang chờ kế toán'}
                      </strong>
                      {selectedItem.taxInvoiceNotes && (
                        <span className="text-slate-500 text-[11px] block">{selectedItem.taxInvoiceNotes}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <Link
                href={`/admin/orders/${selectedItem.orderId}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#800020] hover:underline"
              >
                <span>Mở trang chi tiết đơn hàng để thực thi thao tác</span>
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
