'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Users,
  Search,
  Filter,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpDown,
  Utensils,
  MapPin,
  Phone,
  Eye,
  BarChart3,
  CalendarCheck,
  UserCheck,
  Building,
  UserX,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdmin } from '@/contexts/AdminContext';

interface Reservation {
  id: string;
  reservationCode: string;
  customerName: string;
  customerPhone: string;
  customerPhoneMasked?: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  startAt?: string;
  endAt?: string;
  status: string;
  source: string;
  seatingPreference?: string;
  specialRequests?: string;
  internalNote?: string;
  branchId: string;
  branch: {
    id: string;
    name: string;
    branchCode: string;
  };
  tables: Array<{
    tableId: string;
    table: {
      id: string;
      tableCode: string;
      name: string;
      capacity: number;
      area?: { name: string };
    };
  }>;
}

interface TableItem {
  id: string;
  tableCode: string;
  name: string;
  capacity: number;
  area?: { name: string };
}

export default function AdminReservationsPage() {
  const { availableBranches, user } = useAdmin();
  const branches = availableBranches || [];

  // Active view: list vs timeline
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);

  // Data
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Timeline data
  const [timelineTables, setTimelineTables] = useState<TableItem[]>([]);
  const [timelineReservations, setTimelineReservations] = useState<Reservation[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);

  // Modals
  const [isWalkInOpen, setIsWalkInOpen] = useState<boolean>(false);
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInPhone, setWalkInPhone] = useState<string>('');
  const [walkInPartySize, setWalkInPartySize] = useState<number>(2);
  const [walkInStatus, setWalkInStatus] = useState<'CHECKED_IN' | 'SEATED'>('SEATED');
  const [walkInSubmitting, setWalkInSubmitting] = useState<boolean>(false);

  // Assign Tables Modal
  const [assigningReservation, setAssigningReservation] = useState<Reservation | null>(null);
  const [branchTables, setBranchTables] = useState<TableItem[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [assigningSubmitting, setAssigningSubmitting] = useState<boolean>(false);

  // Initialize branch
  useEffect(() => {
    if (user?.role !== 'ADMIN' && user?.branchId) {
      setSelectedBranchId(user.branchId);
    } else if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId('ALL');
    }
  }, [user, branches, selectedBranchId]);

  // Fetch list
  const fetchReservations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        params.append('branchId', selectedBranchId);
      }
      if (selectedDate) params.append('date', selectedDate);
      if (selectedStatus && selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/admin/reservations?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setReservations(json?.data?.data || []);
        setTotalCount(json?.data?.total || 0);
      } else {
        toast.error('Không thể tải danh sách đặt bàn');
      }
    } catch (e) {
      console.error(e);
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Fetch timeline
  const fetchTimeline = async () => {
    const branchId = selectedBranchId === 'ALL' ? branches[0]?.id : selectedBranchId;
    if (!branchId) return;

    try {
      setLoadingTimeline(true);
      const res = await fetch(
        `/api/admin/reservations/timeline?branchId=${branchId}&date=${selectedDate}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const json = await res.json();
        setTimelineTables(json?.data?.tables || []);
        setTimelineReservations(json?.data?.reservations || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTimeline(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'list') {
      fetchReservations();
    } else {
      fetchTimeline();
    }
  }, [viewMode, selectedBranchId, selectedDate, selectedStatus, page, searchQuery]);

  // Status transition action
  const handleTransitionStatus = async (id: string, newStatus: string, reason?: string) => {
    try {
      const res = await fetch(`/api/admin/reservations/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus, reason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Đã chuyển sang ${newStatus}`);
        if (viewMode === 'list') fetchReservations();
        else fetchTimeline();
      } else {
        toast.error(data?.error?.message || 'Thao tác không thành công');
      }
    } catch (err) {
      toast.error('Lỗi cập nhật trạng thái');
    }
  };

  // Walk-in submission
  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveBranchId = selectedBranchId === 'ALL' ? branches[0]?.id : selectedBranchId;
    if (!effectiveBranchId) {
      toast.error('Vui lòng chọn chi nhánh');
      return;
    }

    try {
      setWalkInSubmitting(true);
      const res = await fetch('/api/admin/reservations/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          branchId: effectiveBranchId,
          customerName: walkInName.trim(),
          customerPhone: walkInPhone.trim() || undefined,
          partySize: walkInPartySize,
          initialStatus: walkInStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Tiếp nhận khách vãng lai thành công!');
        setIsWalkInOpen(false);
        setWalkInName('');
        setWalkInPhone('');
        if (viewMode === 'list') fetchReservations();
        else fetchTimeline();
      } else {
        toast.error(data?.error?.message || 'Không thể tạo khách vãng lai');
      }
    } catch (err) {
      toast.error('Lỗi máy chủ');
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // Open Table Assignment Modal
  const openAssignModal = async (reservation: Reservation) => {
    setAssigningReservation(reservation);
    setSelectedTableIds(reservation.tables?.map((t) => t.tableId) || []);

    try {
      const res = await fetch(`/api/admin/tables?branchId=${reservation.branchId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setBranchTables(json?.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveAssignedTables = async () => {
    if (!assigningReservation) return;
    try {
      setAssigningSubmitting(true);
      const res = await fetch(`/api/admin/reservations/${assigningReservation.id}/tables`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tableIds: selectedTableIds }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Đã cập nhật bàn thành công');
        setAssigningReservation(null);
        if (viewMode === 'list') fetchReservations();
        else fetchTimeline();
      } else {
        toast.error(data?.error?.message || 'Không thể gán bàn');
      }
    } catch (e) {
      toast.error('Lỗi máy chủ');
    } finally {
      setAssigningSubmitting(false);
    }
  };

  // Calculate summary KPIs for today
  const kpis = useMemo(() => {
    const totalBookings = reservations.length;
    const totalGuests = reservations.reduce((sum, r) => sum + r.partySize, 0);
    const pending = reservations.filter((r) => r.status === 'PENDING').length;
    const confirmed = reservations.filter((r) => r.status === 'CONFIRMED').length;
    const active = reservations.filter(
      (r) => r.status === 'CHECKED_IN' || r.status === 'SEATED',
    ).length;
    const noShow = reservations.filter((r) => r.status === 'NO_SHOW').length;

    return { totalBookings, totalGuests, pending, confirmed, active, noShow };
  }, [reservations]);

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Đã duyệt</span>;
      case 'PENDING':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Chờ duyệt</span>;
      case 'CHECKED_IN':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Check-in</span>;
      case 'SEATED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Đang phục vụ</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Hoàn tất</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Đã hủy</span>;
      case 'NO_SHOW':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">Vắng mặt</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Từ chối</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 shrink-0" />
            <span>Quản Lý Đặt Bàn</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">
            Quản lý đặt chỗ thời gian thực, chống overbooking và điều phối sơ đồ bàn thông minh
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <Link
            href="/admin/reservations/analytics"
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 min-h-[38px] px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
          >
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <span>Phân tích</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsWalkInOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 min-h-[38px] px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Khách vãng lai</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2.5 md:gap-3">
        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block truncate">Tổng đặt bàn</span>
          <span className="text-base sm:text-lg lg:text-xl font-black text-slate-800 mt-0.5 sm:mt-1 block">{kpis.totalBookings}</span>
        </div>
        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block truncate">Khách dự kiến</span>
          <span className="text-base sm:text-lg lg:text-xl font-black text-slate-800 mt-0.5 sm:mt-1 block">{kpis.totalGuests}</span>
        </div>
        <div className="bg-amber-50/60 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] text-amber-700 font-medium block truncate">Chờ duyệt</span>
          <span className="text-base sm:text-lg lg:text-xl font-black text-amber-700 mt-0.5 sm:mt-1 block">{kpis.pending}</span>
        </div>
        <div className="bg-emerald-50/60 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] text-emerald-700 font-medium block truncate">Đã xác nhận</span>
          <span className="text-base sm:text-lg lg:text-xl font-black text-emerald-700 mt-0.5 sm:mt-1 block">{kpis.confirmed}</span>
        </div>
        <div className="bg-purple-50/60 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-purple-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] text-purple-700 font-medium block truncate">Đang tại bàn</span>
          <span className="text-base sm:text-lg lg:text-xl font-black text-purple-700 mt-0.5 sm:mt-1 block">{kpis.active}</span>
        </div>
        <div className="bg-rose-50/60 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-rose-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] text-rose-700 font-medium block truncate">Vắng mặt</span>
          <span className="text-base sm:text-lg lg:text-xl font-black text-rose-700 mt-0.5 sm:mt-1 block">{kpis.noShow}</span>
        </div>
      </div>

      {/* Filter & View Switcher Bar */}
      <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2.5 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Branch filter (if Admin) */}
          {user?.role === 'ADMIN' && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500 h-9 sm:h-10"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {branches.map((b: { id: string; name: string }) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {/* Date Picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500 h-9 sm:h-10"
          />

          {/* Status filter (in list mode) */}
          {viewMode === 'list' && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500 h-9 sm:h-10"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt (Pending)</option>
              <option value="CONFIRMED">Đã duyệt (Confirmed)</option>
              <option value="CHECKED_IN">Đã Check-in</option>
              <option value="SEATED">Đang dùng bữa (Seated)</option>
              <option value="COMPLETED">Hoàn tất (Completed)</option>
              <option value="NO_SHOW">Vắng mặt (No-show)</option>
              <option value="CANCELLED">Đã hủy (Cancelled)</option>
            </select>
          )}

          {/* Search Box */}
          {viewMode === 'list' && (
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm mã, tên, SĐT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 sm:py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-red-500 w-full sm:w-60 h-9 sm:h-10"
              />
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Danh Sách
          </button>
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'timeline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Lịch Giờ
          </button>
        </div>
      </div>

      {/* VIEW 1: TABLE LIST VIEW */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-red-600" />
              <span className="text-xs">Đang tải danh sách đặt bàn...</span>
            </div>
          ) : reservations.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Không có đặt bàn nào</p>
              <span className="text-xs">Thử thay đổi ngày hoặc bộ lọc tìm kiếm</span>
            </div>
          ) : (
            <div className="admin-scroll-table overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3.5">Mã Đặt Bàn</th>
                    <th className="px-4 py-3.5">Khách Hàng</th>
                    <th className="px-4 py-3.5">Chi Nhánh</th>
                    <th className="px-4 py-3.5">Thời Gian</th>
                    <th className="px-4 py-3.5">Khách</th>
                    <th className="px-4 py-3.5">Bàn Gán</th>
                    <th className="px-4 py-3.5">Trạng Thái</th>
                    <th className="px-4 py-3.5 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {reservations.map((res) => (
                    <tr key={res.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-slate-900 block">{res.reservationCode}</span>
                        <span className="text-[10px] text-slate-400">{res.source}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <strong className="text-slate-800 block">{res.customerName}</strong>
                        <span className="text-[11px] text-slate-400">{res.customerPhoneMasked || res.customerPhone}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-slate-700">{res.branch?.name}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <strong className="text-slate-900 block">{res.reservationTime}</strong>
                        <span className="text-[11px] text-slate-400">
                          {res.reservationDate ? res.reservationDate.split('T')[0] : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-800">{res.partySize}</span> khách
                      </td>
                      <td className="px-4 py-3.5">
                        {res.tables && res.tables.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {res.tables.map((t) => (
                              <span
                                key={t.tableId}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[11px]"
                              >
                                {t.table?.name || t.table?.tableCode}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openAssignModal(res)}
                            className="text-amber-600 hover:text-amber-700 font-semibold text-[11px] underline"
                          >
                            + Gán bàn
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5">{renderStatusBadge(res.status)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Status buttons based on current state */}
                          {res.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus(res.id, 'CONFIRMED')}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus(res.id, 'REJECTED', 'Hết chỗ')}
                                className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px]"
                              >
                                Từ chối
                              </button>
                            </>
                          )}

                          {res.status === 'CONFIRMED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus(res.id, 'CHECKED_IN')}
                                className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]"
                              >
                                Check-in
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus(res.id, 'SEATED')}
                                className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px]"
                              >
                                Xếp bàn
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus(res.id, 'NO_SHOW')}
                                className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-[11px]"
                              >
                                Vắng mặt
                              </button>
                            </>
                          )}

                          {res.status === 'CHECKED_IN' && (
                            <button
                              type="button"
                              onClick={() => handleTransitionStatus(res.id, 'SEATED')}
                              className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px]"
                            >
                              Xếp bàn
                            </button>
                          )}

                          {res.status === 'SEATED' && (
                            <button
                              type="button"
                              onClick={() => handleTransitionStatus(res.id, 'COMPLETED')}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                            >
                              Hoàn tất
                            </button>
                          )}

                          {/* Quick change tables */}
                          <button
                            type="button"
                            onClick={() => openAssignModal(res)}
                            title="Gán / Đổi bàn"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          >
                            <Utensils className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: DAY TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 sm:p-6 overflow-x-auto">
          {loadingTimeline ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-red-600" />
              <span className="text-xs">Đang tải sơ đồ timeline theo giờ...</span>
            </div>
          ) : timelineTables.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Utensils className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Chi nhánh này chưa có sơ đồ bàn</p>
              <Link href="/admin/tables" className="text-xs text-red-600 underline font-bold mt-1 inline-block">
                Cài đặt danh sách bàn ngay
              </Link>
            </div>
          ) : (
            <div className="min-w-[900px]">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-700">Sơ đồ bàn ngày {selectedDate}</span>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Đã duyệt</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Check-in</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Đang dùng bữa</span>
                </div>
              </div>

              {/* Hours Header (10:00 -> 22:00) */}
              <div className="grid grid-cols-13 gap-1 mb-2 text-center text-[10px] font-bold text-slate-400">
                <div className="text-left font-bold text-slate-600">Bàn</div>
                {['10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h', '21h'].map((h) => (
                  <div key={h} className="border-l border-slate-100">{h}</div>
                ))}
              </div>

              {/* Tables Rows */}
              <div className="space-y-1.5">
                {timelineTables.map((tbl) => {
                  // Find bookings assigned to this table
                  const tableBookings = timelineReservations.filter((r) =>
                    r.tables?.some((t) => t.tableId === tbl.id),
                  );

                  return (
                    <div
                      key={tbl.id}
                      className="grid grid-cols-13 gap-1 items-center bg-slate-50/70 p-2 rounded-xl text-xs"
                    >
                      <div className="font-semibold text-slate-800 flex items-center justify-between pr-2">
                        <span>{tbl.name}</span>
                        <span className="text-[10px] text-slate-400">({tbl.capacity}c)</span>
                      </div>

                      <div className="col-span-12 relative h-8 bg-slate-100 rounded-lg flex items-center px-1 overflow-hidden">
                        {tableBookings.map((b) => (
                          <div
                            key={b.id}
                            className={`px-2 py-1 rounded text-[10px] font-bold text-white truncate shadow-xs mr-1 ${
                              b.status === 'SEATED'
                                ? 'bg-purple-600'
                                : b.status === 'CHECKED_IN'
                                ? 'bg-blue-600'
                                : 'bg-emerald-600'
                            }`}
                            title={`${b.reservationCode} - ${b.customerName} (${b.partySize} khách) lúc ${b.reservationTime}`}
                          >
                            {b.reservationTime} • {b.customerName} ({b.partySize}k)
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WALK-IN MODAL */}
      {isWalkInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-1.5 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 max-w-md w-full shadow-2xl max-h-[96vh] overflow-y-auto flex flex-col">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-red-600 shrink-0" />
              <span>Tiếp Nhận Khách Vãng Lai</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4">
              Khách hàng đang có mặt tại quầy. Hệ thống sẽ tạo đặt bàn tức thời và chuyển thẳng sang xếp bàn.
            </p>

            <form onSubmit={handleCreateWalkIn} className="space-y-3 sm:space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tên Khách Hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Anh Tuấn"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-red-500 h-9 sm:h-10"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Số Điện Thoại (Tùy chọn)
                </label>
                <input
                  type="tel"
                  placeholder="VD: 0901234567"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-red-500 h-9 sm:h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Số Lượng Khách</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={walkInPartySize}
                    onChange={(e) => setWalkInPartySize(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-red-500 h-9 sm:h-10"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Trạng Thái Bắt Đầu</label>
                  <select
                    value={walkInStatus}
                    onChange={(e: any) => setWalkInStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-red-500 h-9 sm:h-10"
                  >
                    <option value="SEATED">Xếp vào bàn ngay</option>
                    <option value="CHECKED_IN">Check-in chờ bàn</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 sm:gap-2.5 pt-2 sm:pt-3">
                <button
                  type="button"
                  onClick={() => setIsWalkInOpen(false)}
                  className="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={walkInSubmitting || !walkInName}
                  className="min-h-[40px] px-4 sm:px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {walkInSubmitting ? 'Đang tạo...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN TABLES MODAL */}
      {assigningReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-1.5 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 max-w-lg w-full shadow-2xl max-h-[96vh] overflow-y-auto flex flex-col">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Utensils className="w-5 h-5 text-red-600 shrink-0" />
              <span>Gán Bàn Phục Vụ</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4">
              Đặt bàn: <strong>{assigningReservation.reservationCode}</strong> ({assigningReservation.partySize} khách) lúc{' '}
              <strong className="text-red-600">{assigningReservation.reservationTime}</strong>.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 sm:space-y-2 border border-slate-100 rounded-xl p-2.5 sm:p-3 mb-3 sm:mb-4">
              {branchTables.map((tbl) => {
                const isSelected = selectedTableIds.includes(tbl.id);
                return (
                  <label
                    key={tbl.id}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTableIds([...selectedTableIds, tbl.id]);
                          } else {
                            setSelectedTableIds(selectedTableIds.filter((id) => id !== tbl.id));
                          }
                        }}
                        className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                      />
                      <div>
                        <strong className="text-xs">{tbl.name}</strong>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 block">{tbl.area?.name}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold">{tbl.capacity} chỗ</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => setAssigningReservation(null)}
                className="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={assigningSubmitting}
                onClick={handleSaveAssignedTables}
                className="min-h-[40px] px-4 sm:px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {assigningSubmitting ? 'Đang lưu...' : 'Lưu bàn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
