'use client';

import React, { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import {
  Calendar,
  Clock,
  CalendarCheck,
  CalendarDays,
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit,
  RotateCcw,
  Smartphone,
  MapPin,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  QrCode,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminAttendancePage() {
  const [activeTab, setActiveTab] = useState<'history' | 'shifts' | 'weekly' | 'logs' | 'devices'>('history');

  // Bộ lọc chung
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const s = new Date(now.setDate(diff));
    return s.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const s = new Date(startDate);
    s.setDate(s.getDate() + 6);
    return s.toISOString().split('T')[0];
  });
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');

  // Fetch dữ liệu tổng hợp
  const queryUrl = `/api/attendance/admin/dashboard?startDate=${startDate}&endDate=${endDate}${
    selectedBranchId ? `&branchId=${selectedBranchId}` : ''
  }${selectedRoleId ? `&roleId=${selectedRoleId}` : ''}`;

  const { data: response, isLoading } = useSWR(queryUrl, fetcher, { revalidateOnFocus: false });
  const dashboardData = response?.data || {};

  const attendances: any[] = dashboardData.attendances || [];
  const shifts: any[] = dashboardData.shifts || [];
  const logs: any[] = dashboardData.logs || [];
  const branches: any[] = dashboardData.branches || [];
  const roles: any[] = dashboardData.roles || [];
  const users: any[] = dashboardData.users || [];

  // State các Modal
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isShiftImportOpen, setIsShiftImportOpen] = useState(false);
  const [isHistoryImportOpen, setIsHistoryImportOpen] = useState(false);

  // Form Thêm công thủ công
  const [manualAddForm, setManualAddForm] = useState({
    userId: '',
    branchId: '',
    workDate: new Date().toISOString().split('T')[0],
    checkIn: '08:00',
    checkOut: '17:00',
    isSplit: false,
    checkIn2: '18:00',
    checkOut2: '22:00',
    shiftId: '',
    reason: '',
  });

  // Form Chỉnh sửa công
  const [selectedAttToEdit, setSelectedAttToEdit] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    checkIn: '',
    checkOut: '',
    shiftId: '',
    reason: '',
  });

  // Form Thêm / Sửa ca làm việc
  const [shiftForm, setShiftForm] = useState<{
    id?: string;
    name: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    gracePeriodMins: number;
    branchId: string;
    roleId: string;
    isSplitShift: boolean;
    startTime2: string;
    endTime2: string;
    assignedUserIds: string[];
  }>({
    name: 'Ca Sáng',
    shiftDate: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '16:00',
    gracePeriodMins: 5,
    branchId: '',
    roleId: '',
    isSplitShift: false,
    startTime2: '17:00',
    endTime2: '22:00',
    assignedUserIds: [],
  });

  // Checkbox chọn nhiều ca để xóa
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);

  // State file uploads
  const [shiftImportFile, setShiftImportFile] = useState<File | null>(null);
  const [shiftImportRoleId, setShiftImportRoleId] = useState('');
  const [shiftImportBranchId, setShiftImportBranchId] = useState('');

  const [historyImportFile, setHistoryImportFile] = useState<File | null>(null);
  const [historyImportBranchId, setHistoryImportBranchId] = useState('');
  const [historyUpdateExisting, setHistoryUpdateExisting] = useState(false);

  // Filter logs
  const [logFilterCategory, setLogFilterCategory] = useState<'ALL' | 'MANUAL' | 'ERROR' | 'SUCCESS' | 'IN' | 'OUT'>('ALL');

  // Filter attendances theo tên
  const filteredAttendances = attendances.filter((a) => {
    if (!searchEmployeeQuery) return true;
    const q = searchEmployeeQuery.toLowerCase();
    const name = a.user?.fullName?.toLowerCase() || '';
    const username = a.user?.username?.toLowerCase() || '';
    return name.includes(q) || username.includes(q);
  });

  // Lọc log theo category
  const filteredLogs = logs.filter((log) => {
    if (logFilterCategory === 'MANUAL') return log.errorCode?.includes('MANUAL') || log.scanType?.includes('MANUAL');
    if (logFilterCategory === 'ERROR') return !log.isSuccess || log.errorCode?.includes('WARNING');
    if (logFilterCategory === 'SUCCESS') return log.isSuccess && log.errorCode === 'SUCCESS';
    if (logFilterCategory === 'IN') return log.scanType === 'CHECK_IN';
    if (logFilterCategory === 'OUT') return log.scanType === 'CHECK_OUT';
    return true;
  });

  // Xử lý Export Excel
  const handleExportExcel = () => {
    const params = new URLSearchParams({
      startDate,
      endDate,
      calculateOvertime: 'true',
    });
    if (selectedBranchId) params.append('branchId', selectedBranchId);
    if (selectedRoleId) params.append('roleId', selectedRoleId);

    window.open(`/api/attendance/admin/export?${params.toString()}`, '_blank');
  };

  // Submit Thêm công thủ công
  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddForm.userId || !manualAddForm.branchId || !manualAddForm.reason) {
      toast.error('Vui lòng điền đầy đủ nhân viên, chi nhánh và lý do.');
      return;
    }
    try {
      const res = await fetch('/api/attendance/admin/manual-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualAddForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi thêm công');
      toast.success(data.message || 'Thêm công thủ công thành công!');
      setIsManualAddOpen(false);
      mutate(queryUrl);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Mở modal sửa công
  const openEditAttendance = (att: any) => {
    setSelectedAttToEdit(att);
    setEditForm({
      checkIn: att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '',
      checkOut: att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '',
      shiftId: att.shiftId || '',
      reason: '',
    });
    setIsEditModalOpen(true);
  };

  // Submit sửa công
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.reason.trim()) {
      toast.error('Bắt buộc phải nhập lý do chỉnh sửa.');
      return;
    }
    try {
      const res = await fetch('/api/attendance/admin/manual-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId: selectedAttToEdit.id,
          actionType: 'UPDATE',
          checkIn: editForm.checkIn || undefined,
          checkOut: editForm.checkOut || undefined,
          shiftId: editForm.shiftId || undefined,
          reason: editForm.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi cập nhật');
      toast.success('Cập nhật giờ công và lưu log thành công!');
      setIsEditModalOpen(false);
      mutate(queryUrl);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Xóa công kèm lý do
  const handleDeleteAttendance = async (att: any) => {
    const reason = prompt(`XÁC NHẬN XÓA BẢN GHI CÔNG\n\nNhân viên: ${att.user?.fullName}\nNgày: ${att.workDate?.split('T')[0]}\n\nVui lòng nhập lý do xóa để ghi vào nhật ký hệ thống:`);
    if (!reason) return;

    try {
      const res = await fetch('/api/attendance/admin/manual-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId: att.id,
          actionType: 'DELETE',
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi xóa công');
      toast.success('Đã xóa bản ghi công và lưu log audit!');
      mutate(queryUrl);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Submit Thêm / Sửa ca
  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.name || !shiftForm.shiftDate || !shiftForm.startTime || !shiftForm.endTime) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    try {
      const res = await fetch('/api/attendance/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi lưu ca');
      toast.success('Lưu ca làm việc và đồng bộ bảng công thành công!');
      setIsShiftModalOpen(false);
      mutate(queryUrl);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Xóa 1 ca
  const handleDeleteShift = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa ca làm việc này? Toàn bộ bảng công của ngày đó sẽ tự động được đồng bộ lại.')) return;
    try {
      const res = await fetch(`/api/attendance/admin/shifts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi xóa ca');
      toast.success('Đã xóa ca làm việc thành công!');
      mutate(queryUrl);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Xóa nhiều ca
  const handleBulkDeleteShifts = async () => {
    if (selectedShiftIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 ca để xóa.');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedShiftIds.length} ca đã chọn?`)) return;

    try {
      const res = await fetch('/api/attendance/admin/shifts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftIds: selectedShiftIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi xóa hàng loạt');
      toast.success(data.message || 'Đã xóa các ca đã chọn thành công!');
      setSelectedShiftIds([]);
      mutate(queryUrl);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Import lịch ca tuần
  const handleImportWeeklyShifts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftImportFile || !shiftImportRoleId || !shiftImportBranchId) {
      toast.error('Vui lòng chọn file Excel, vai trò và chi nhánh áp dụng.');
      return;
    }

    const formData = new FormData();
    formData.append('file', shiftImportFile);
    formData.append('roleId', shiftImportRoleId);
    formData.append('branchId', shiftImportBranchId);

    try {
      const res = await fetch('/api/attendance/admin/shifts/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi import lịch ca');
      toast.success(data.message || 'Import lịch ca thành công!');
      setIsShiftImportOpen(false);
      mutate(queryUrl);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Import lịch sử công từ Sushi Wa
  const handleImportHistoricalAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!historyImportFile || !historyImportBranchId) {
      toast.error('Vui lòng chọn file Excel và chi nhánh đích.');
      return;
    }

    const formData = new FormData();
    formData.append('file', historyImportFile);
    formData.append('branchId', historyImportBranchId);
    formData.append('updateExisting', String(historyUpdateExisting));

    try {
      const res = await fetch('/api/attendance/admin/import-historical', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi import lịch sử');
      toast.success(data.message || 'Import bảng công lịch sử thành công!');
      setIsHistoryImportOpen(false);
      mutate(queryUrl);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Reset thiết bị nhân viên
  const handleResetDevice = async (userId: string, empName: string) => {
    if (!confirm(`Xác nhận xóa liên kết thiết bị cho nhân viên "${empName}"?\nSau khi reset, nhân viên có thể dùng điện thoại mới để chấm công.`)) return;
    try {
      const res = await fetch('/api/attendance/admin/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi reset thiết bị');
      toast.success(data.message || 'Đã reset thiết bị thành công!');
      mutate(queryUrl);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ON_TIME':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Đúng giờ</span>;
      case 'LATE':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Đi trễ</span>;
      case 'EARLY_LEAVE':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Về sớm</span>;
      case 'LATE_AND_EARLY_LEAVE':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">Trễ & Về sớm</span>;
      case 'FLEXIBLE':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Ca tự do</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  // Tạo danh sách 7 ngày cho Ma trận
  const sDateObj = new Date(startDate);
  const dateRangeList: Array<{ iso: string; dateStr: string; dayName: string; isToday: boolean }> = [];
  const cur = new Date(sDateObj);
  for (let i = 0; i < 7; i++) {
    const iso = cur.toISOString().split('T')[0];
    const dNum = cur.getDay();
    const dayName = dNum === 0 ? 'CN' : `Thứ ${dNum + 1}`;
    const dateStr = `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}`;
    const isToday = iso === new Date().toISOString().split('T')[0];
    dateRangeList.push({ iso, dateStr, dayName, isToday });
    cur.setDate(cur.getDate() + 1);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* HEADER QUẢN TRỊ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#DA251D] uppercase tracking-wider mb-1">
            <ShieldCheck size={14} />
            Hệ Thống Chấm Công AVORA • Ported from Sushi Wa
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Quản Lý Chấm Công & Lịch Ca</h1>
          <p className="text-xs text-slate-500 mt-1">
            Kiểm soát giờ làm việc, định vị GPS, phân ca tự động, xuất báo cáo Excel chuẩn HR và quản lý thiết bị.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/attendance/qr-display"
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <QrCode size={15} />
            <span>Màn Hình QR Quầy</span>
            <ExternalLink size={12} className="opacity-70" />
          </Link>

          <Link
            href="/admin/attendance/static-qr"
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-2 transition-all border border-slate-200"
          >
            <QrCode size={15} />
            <span>Tạo QR Tĩnh In Biển</span>
          </Link>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <Download size={15} />
            <span>Xuất Excel Bảng Công</span>
          </button>
        </div>
      </div>

      {/* THANH BỘ LỌC CHUNG */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Từ ngày:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none focus:border-[#DA251D]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Đến ngày:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none focus:border-[#DA251D]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Chi nhánh:</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none focus:border-[#DA251D]"
          >
            <option value="">Tất cả chi nhánh</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Vai trò nhân sự:</label>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none focus:border-[#DA251D]"
          >
            <option value="">Tất cả vai trò</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={() => mutate(queryUrl)}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* 5 TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
        {[
          { key: 'history', label: 'BẢNG CÔNG', icon: CalendarCheck, count: attendances.length },
          { key: 'shifts', label: 'CẤU HÌNH LỊCH CA', icon: Clock, count: shifts.length },
          { key: 'weekly', label: 'MA TRẬN CA LÀM', icon: CalendarDays },
          { key: 'logs', label: 'NHẬT KÝ GPS & LOG', icon: MapPin, count: logs.length },
          { key: 'devices', label: 'QUẢN LÝ THIẾT BỊ', icon: Smartphone, count: users.filter((u) => u.registeredDeviceId).length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-5 py-3.5 border-b-2 font-bold text-xs transition-all whitespace-nowrap ${
                isActive
                  ? 'border-[#DA251D] text-[#DA251D] bg-red-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-[#DA251D] text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BẢNG CÔNG */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col gap-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm nhân viên theo tên hoặc username..."
                value={searchEmployeeQuery}
                onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 outline-none focus:border-[#DA251D]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsHistoryImportOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-200"
              >
                <Upload size={14} />
                <span>Import Công Sushi Wa</span>
              </button>

              <button
                onClick={() => setIsManualAddOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#DA251D] hover:bg-[#b91c1c] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={15} />
                <span>Thêm Công Thủ Công</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-y border-slate-200 text-slate-600">
                  <th className="p-3 font-bold text-center w-12">STT</th>
                  <th className="p-3 font-bold min-w-[140px]">Nhân viên</th>
                  <th className="p-3 font-bold min-w-[120px]">Chi nhánh</th>
                  <th className="p-3 font-bold min-w-[100px]">Ngày làm</th>
                  <th className="p-3 font-bold min-w-[120px]">Ca làm việc</th>
                  <th className="p-3 font-bold text-center min-w-[80px]">Giờ vào</th>
                  <th className="p-3 font-bold text-center min-w-[80px]">Giờ ra</th>
                  <th className="p-3 font-bold text-center min-w-[80px]">Tổng giờ</th>
                  <th className="p-3 font-bold text-center min-w-[110px]">Trạng thái</th>
                  <th className="p-3 font-bold min-w-[160px]">Ghi chú</th>
                  <th className="p-3 font-bold text-center min-w-[100px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#DA251D]" />
                      Đang tải bảng công...
                    </td>
                  </tr>
                ) : filteredAttendances.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      Không có bản ghi công nào trong khoảng thời gian này.
                    </td>
                  </tr>
                ) : (
                  filteredAttendances.map((att, idx) => {
                    const uRole = att.user?.roleAssignments?.[0]?.role?.name || att.user?.role || 'NV';
                    const inStr = att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '-';
                    const outStr = att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : 'Đang làm';
                    const dateFormatted = att.workDate ? att.workDate.split('T')[0] : '';

                    return (
                      <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">
                          <div>{att.user?.fullName || att.user?.username}</div>
                          <span className="text-[10px] text-slate-400 font-normal">({uRole})</span>
                        </td>
                        <td className="p-3 text-slate-700">{att.branch?.name || '-'}</td>
                        <td className="p-3 font-mono text-slate-700">{dateFormatted}</td>
                        <td className="p-3 text-slate-700 font-medium">
                          {att.shift?.name || <span className="text-slate-400 italic">Ca tự do</span>}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-600">{inStr}</td>
                        <td className={`p-3 text-center font-mono font-bold ${outStr === 'Đang làm' ? 'text-amber-500 animate-pulse' : 'text-slate-700'}`}>
                          {outStr}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-blue-600">
                          {att.totalWorkHours ? Number(att.totalWorkHours).toFixed(2) + 'h' : '-'}
                        </td>
                        <td className="p-3 text-center">{getStatusBadge(att.status)}</td>
                        <td className="p-3 text-slate-600 text-[11px] max-w-[200px] truncate" title={att.notes}>
                          {att.notes || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditAttendance(att)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title="Chỉnh sửa giờ công"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteAttendance(att)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Xóa bản ghi công"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CẤU HÌNH LỊCH CA */}
      {activeTab === 'shifts' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col gap-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShiftForm({
                    name: 'Ca Sáng',
                    shiftDate: new Date().toISOString().split('T')[0],
                    startTime: '08:00',
                    endTime: '16:00',
                    gracePeriodMins: 5,
                    branchId: selectedBranchId || branches[0]?.id || '',
                    roleId: selectedRoleId || roles[0]?.id || '',
                    isSplitShift: false,
                    startTime2: '17:00',
                    endTime2: '22:00',
                    assignedUserIds: [],
                  });
                  setIsShiftModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#DA251D] hover:bg-[#b91c1c] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={15} />
                <span>Thêm Ca Mới</span>
              </button>

              <button
                onClick={() => setIsShiftImportOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-200"
              >
                <Upload size={14} />
                <span>Import Lịch Ca Tuần</span>
              </button>
            </div>

            {selectedShiftIds.length > 0 && (
              <button
                onClick={handleBulkDeleteShifts}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Trash2 size={14} />
                <span>Xóa {selectedShiftIds.length} ca đã chọn</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-y border-slate-200 text-slate-600">
                  <th className="p-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={shifts.length > 0 && selectedShiftIds.length === shifts.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedShiftIds(shifts.map((s) => s.id));
                        else setSelectedShiftIds([]);
                      }}
                    />
                  </th>
                  <th className="p-3 font-bold min-w-[130px]">Tên ca</th>
                  <th className="p-3 font-bold min-w-[100px]">Ngày áp dụng</th>
                  <th className="p-3 font-bold min-w-[120px]">Khung giờ</th>
                  <th className="p-3 font-bold min-w-[100px]">Vai trò</th>
                  <th className="p-3 font-bold min-w-[120px]">Chi nhánh</th>
                  <th className="p-3 font-bold text-center min-w-[90px]">Cho phép trễ</th>
                  <th className="p-3 font-bold min-w-[180px]">Nhân viên gán ca</th>
                  <th className="p-3 font-bold text-center min-w-[90px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Đang tải danh sách ca...
                    </td>
                  </tr>
                ) : shifts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Không có ca làm việc nào trong khoảng thời gian này.
                    </td>
                  </tr>
                ) : (
                  shifts.map((s) => {
                    const isSelected = selectedShiftIds.includes(s.id);
                    const shiftDateStr = s.shiftDate ? s.shiftDate.split('T')[0] : '';
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedShiftIds([...selectedShiftIds, s.id]);
                              else setSelectedShiftIds(selectedShiftIds.filter((id) => id !== s.id));
                            }}
                          />
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {s.name}
                          {s.isSplitShift && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                              Ca gãy
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-700">{shiftDateStr}</td>
                        <td className="p-3 font-mono text-slate-800">
                          <div>{s.startTime} - {s.endTime}</div>
                          {s.isSplitShift && s.startTime2 && (
                            <div className="text-amber-700 text-[11px] font-semibold">
                              + {s.startTime2} - {s.endTime2}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-700">{s.role?.name || 'Tất cả vai trò'}</td>
                        <td className="p-3 text-slate-700">{s.branch?.name || 'Toàn hệ thống'}</td>
                        <td className="p-3 text-center font-mono text-slate-600">{s.gracePeriodMins || 5} phút</td>
                        <td className="p-3 text-slate-600">
                          {s.assignedUsers && s.assignedUsers.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {s.assignedUsers.map((u: any) => (
                                <span key={u.id} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] border border-slate-200">
                                  {u.fullName || u.username}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Áp dụng chung cho Role</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setShiftForm({
                                  id: s.id,
                                  name: s.name,
                                  shiftDate: shiftDateStr,
                                  startTime: s.startTime,
                                  endTime: s.endTime,
                                  gracePeriodMins: s.gracePeriodMins || 5,
                                  branchId: s.branchId || '',
                                  roleId: s.roleId || '',
                                  isSplitShift: s.isSplitShift || false,
                                  startTime2: s.startTime2 || '',
                                  endTime2: s.endTime2 || '',
                                  assignedUserIds: s.assignedUsers ? s.assignedUsers.map((u: any) => u.id) : [],
                                });
                                setIsShiftModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title="Sửa ca"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteShift(s.id)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Xóa ca"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MA TRẬN CA LÀM (WEEKLY MATRIX) */}
      {activeTab === 'weekly' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">
              Ma Trận Ca Làm & Chấm Công Tuần ({startDate} đến {endDate})
            </h3>
            <span className="text-xs text-slate-500">
              Tổng cộng {users.length} nhân viên
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                  <th className="p-3 text-left font-bold min-w-[150px] border-r border-slate-200">
                    Nhân viên
                  </th>
                  {dateRangeList.map((d) => (
                    <th
                      key={d.iso}
                      className={`p-2.5 font-bold min-w-[120px] border-r border-slate-200 last:border-r-0 ${
                        d.isToday ? 'bg-red-50 text-[#DA251D]' : ''
                      }`}
                    >
                      <div className="text-[10px] opacity-80">{d.dayName}</div>
                      <div className="font-mono text-sm">{d.dateStr}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const uRole = u.roleAssignments?.[0]?.role?.name || u.role || 'NV';
                  // Tìm attendances của user trong khoảng thời gian này
                  const userAtts = attendances.filter((a) => a.userId === u.id);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-left border-r border-slate-200 bg-slate-50/30">
                        <div className="font-bold text-slate-900 leading-tight">{u.fullName || u.username}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{uRole}</div>
                        <div className="mt-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 inline-block px-1.5 py-0.5 rounded">
                          {userAtts.length} ca làm
                        </div>
                      </td>

                      {dateRangeList.map((d) => {
                        const dayRecords = userAtts.filter((a) => a.workDate && a.workDate.split('T')[0] === d.iso);
                        return (
                          <td
                            key={d.iso}
                            className={`p-2 border-r border-slate-200 last:border-r-0 align-top ${
                              d.isToday ? 'bg-red-50/20' : ''
                            }`}
                          >
                            {dayRecords.length === 0 ? (
                              <span className="text-slate-300 font-mono">-</span>
                            ) : (
                              <div className="flex flex-col gap-1 text-left">
                                {dayRecords.map((att: any) => {
                                  const inTime = att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '??:??';
                                  const outTime = att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit' }) : 'Đang làm';
                                  return (
                                    <div
                                      key={att.id}
                                      className="bg-white border border-slate-200 rounded p-1.5 shadow-2xs hover:border-[#DA251D] transition-colors"
                                      title={att.notes || 'Không có ghi chú'}
                                    >
                                      <div className="font-bold text-slate-800 truncate text-[10px]">
                                        {att.shift?.name || 'Ca tự do'}
                                      </div>
                                      <div className="font-mono text-[9px] text-slate-500 mt-0.5">
                                        {inTime} - {outTime}
                                      </div>
                                      <div className="text-[9px] font-mono font-bold text-blue-600 mt-0.5">
                                        {att.totalWorkHours ? `${Number(att.totalWorkHours).toFixed(1)}h` : ''}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: NHẬT KÝ GPS & LOG */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600 mr-1">Bộ lọc log:</span>
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'SUCCESS', label: 'Hợp lệ' },
                { key: 'ERROR', label: 'Vi phạm / GPS' },
                { key: 'MANUAL', label: 'Admin Sửa' },
                { key: 'IN', label: 'Check-in' },
                { key: 'OUT', label: 'Check-out' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setLogFilterCategory(f.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    logFilterCategory === f.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500">
              Hiển thị {filteredLogs.length} dòng nhật ký gần nhất
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-y border-slate-200 text-slate-600">
                  <th className="p-3 font-bold min-w-[130px]">Thời gian</th>
                  <th className="p-3 font-bold min-w-[140px]">Nhân viên</th>
                  <th className="p-3 font-bold min-w-[120px]">Chi nhánh</th>
                  <th className="p-3 font-bold min-w-[130px]">Ca làm / Thao tác</th>
                  <th className="p-3 font-bold text-center min-w-[90px]">Hành động</th>
                  <th className="p-3 font-bold text-center min-w-[100px]">Khoảng cách GPS</th>
                  <th className="p-3 font-bold text-center min-w-[90px]">Trạng thái</th>
                  <th className="p-3 font-bold min-w-[180px]">Mã lỗi / Lý do</th>
                  <th className="p-3 font-bold min-w-[130px]">Thiết bị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Đang tải nhật ký GPS...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Không có dòng log nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const timeStr = log.scanTime
                      ? new Date(log.scanTime).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '-';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono text-slate-600">{timeStr}</td>
                        <td className="p-3 font-bold text-slate-900">{log.user?.fullName || log.user?.username || 'Khách'}</td>
                        <td className="p-3 text-slate-700">{log.branch?.name || '-'}</td>
                        <td className="p-3 text-slate-700">{log.shiftName || log.rawQrData || '-'}</td>
                        <td className="p-3 text-center">
                          <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                            {log.scanType}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">
                          {log.distanceCalculated ? `${Number(log.distanceCalculated).toFixed(1)}m` : '-'}
                          {log.clientAccuracy > 0 && (
                            <span className="block text-[9px] text-slate-400">±{Number(log.clientAccuracy).toFixed(0)}m</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {log.isSuccess ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Thành công
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              Từ chối
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 text-[11px] max-w-[200px] truncate" title={log.errorCode || ''}>
                          {log.errorCode}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-slate-500 max-w-[130px] truncate" title={log.deviceId || ''}>
                          {log.deviceId}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: QUẢN LÝ THIẾT BỊ */}
      {activeTab === 'devices' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Danh Sách Thiết Bị Đã Đăng Ký Chấm Công</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mỗi nhân viên chỉ được sử dụng đúng điện thoại đã đăng ký để chấm công. Khi nhân viên đổi máy mới, quản trị viên có thể bấm "Reset Thiết Bị".
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-y border-slate-200 text-slate-600">
                  <th className="p-3 font-bold w-12 text-center">STT</th>
                  <th className="p-3 font-bold min-w-[160px]">Nhân viên</th>
                  <th className="p-3 font-bold min-w-[140px]">Tài khoản / Email</th>
                  <th className="p-3 font-bold min-w-[110px]">Vai trò</th>
                  <th className="p-3 font-bold min-w-[180px]">Mã phần cứng (Device ID)</th>
                  <th className="p-3 font-bold text-center min-w-[120px]">Trạng thái</th>
                  <th className="p-3 font-bold text-center min-w-[120px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u, idx) => {
                  const hasDevice = !!u.registeredDeviceId;
                  const uRole = u.roleAssignments?.[0]?.role?.name || u.role;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{u.fullName || u.username}</td>
                      <td className="p-3 text-slate-600 font-mono">{u.email || u.username}</td>
                      <td className="p-3 text-slate-700">{uRole}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-800">
                        {u.registeredDeviceId ? (
                          <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 block truncate max-w-[200px]" title={u.registeredDeviceId}>
                            {u.registeredDeviceId}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa đăng ký thiết bị</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {hasDevice ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1 mx-auto w-fit">
                            <CheckCircle size={11} />
                            Đã kích hoạt
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 mx-auto w-fit block">
                            Chờ quét lần đầu
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {hasDevice ? (
                          <button
                            onClick={() => handleResetDevice(u.id, u.fullName || u.username)}
                            className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center gap-1 mx-auto transition-colors border border-amber-200"
                          >
                            <RotateCcw size={12} />
                            <span>Reset Máy</span>
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: THÊM CÔNG THỦ CÔNG (HỖ TRỢ CA GÃY) */}
      {/* ======================================================== */}
      {isManualAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900">Thêm Công Thủ Công</h3>
              <button onClick={() => setIsManualAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleManualAddSubmit} className="flex flex-col gap-3.5 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Nhân viên (*):</label>
                <select
                  required
                  value={manualAddForm.userId}
                  onChange={(e) => setManualAddForm({ ...manualAddForm, userId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.username} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Chi nhánh (*):</label>
                  <select
                    required
                    value={manualAddForm.branchId}
                    onChange={(e) => setManualAddForm({ ...manualAddForm, branchId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                  >
                    <option value="">-- Chọn chi nhánh --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">Ngày làm việc (*):</label>
                  <input
                    type="date"
                    required
                    value={manualAddForm.workDate}
                    onChange={(e) => setManualAddForm({ ...manualAddForm, workDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2.5">
                <div className="font-bold text-slate-700">Khung giờ 1:</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-500 mb-1 block">Giờ vào:</label>
                    <input
                      type="time"
                      value={manualAddForm.checkIn}
                      onChange={(e) => setManualAddForm({ ...manualAddForm, checkIn: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 mb-1 block">Giờ ra:</label>
                    <input
                      type="time"
                      value={manualAddForm.checkOut}
                      onChange={(e) => setManualAddForm({ ...manualAddForm, checkOut: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={manualAddForm.isSplit}
                      onChange={(e) => setManualAddForm({ ...manualAddForm, isSplit: e.target.checked })}
                    />
                    <span>Đây là Ca Gãy (Có 2 khung giờ trong ngày)</span>
                  </label>
                </div>

                {manualAddForm.isSplit && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-slate-500 mb-1 block">Giờ vào (Khung 2):</label>
                      <input
                        type="time"
                        value={manualAddForm.checkIn2}
                        onChange={(e) => setManualAddForm({ ...manualAddForm, checkIn2: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 mb-1 block">Giờ ra (Khung 2):</label>
                      <input
                        type="time"
                        value={manualAddForm.checkOut2}
                        onChange={(e) => setManualAddForm({ ...manualAddForm, checkOut2: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Ca làm chỉ định (Tùy chọn):</label>
                <select
                  value={manualAddForm.shiftId}
                  onChange={(e) => setManualAddForm({ ...manualAddForm, shiftId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="">-- Để trống nếu làm ca tự do --</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Lý do tạo thủ công (*):</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Quên mang điện thoại, Admin duyệt..."
                  value={manualAddForm.reason}
                  onChange={(e) => setManualAddForm({ ...manualAddForm, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium outline-none focus:border-[#DA251D]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsManualAddOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#DA251D] hover:bg-[#b91c1c] text-white font-bold"
                >
                  Lưu Bảng Công
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CHỈNH SỬA BẢNG CÔNG (ADMIN) */}
      {/* ======================================================== */}
      {isEditModalOpen && selectedAttToEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900">Chỉnh Sửa Giờ Công</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-3.5 mt-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800">{selectedAttToEdit.user?.fullName}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  Ngày làm: {selectedAttToEdit.workDate?.split('T')[0]} | Chi nhánh: {selectedAttToEdit.branch?.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Giờ vào:</label>
                  <input
                    type="time"
                    value={editForm.checkIn}
                    onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Giờ ra:</label>
                  <input
                    type="time"
                    value={editForm.checkOut}
                    onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Ca làm việc:</label>
                <select
                  value={editForm.shiftId}
                  onChange={(e) => setEditForm({ ...editForm, shiftId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="">Giữ nguyên ca hiện tại</option>
                  <option value="-1">Hủy liên kết ca (Chuyển sang ca tự do)</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Lý do chỉnh sửa (*):</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập lý do chỉnh sửa để ghi vào nhật ký hệ thống..."
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium outline-none focus:border-[#DA251D]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#DA251D] hover:bg-[#b91c1c] text-white font-bold"
                >
                  Cập Nhật Giờ Công
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: THÊM / SỬA CA LÀM VIỆC */}
      {/* ======================================================== */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900">
                {shiftForm.id ? 'Chỉnh Sửa Ca Làm Việc' : 'Thêm Ca Làm Việc Mới'}
              </h3>
              <button onClick={() => setIsShiftModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleShiftSubmit} className="flex flex-col gap-3.5 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Tên ca (*):</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Ca Sáng, Ca Gãy..."
                    value={shiftForm.name}
                    onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Ngày làm việc (*):</label>
                  <input
                    type="date"
                    required
                    value={shiftForm.shiftDate}
                    onChange={(e) => setShiftForm({ ...shiftForm, shiftDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Chi nhánh áp dụng:</label>
                  <select
                    value={shiftForm.branchId}
                    onChange={(e) => setShiftForm({ ...shiftForm, branchId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                  >
                    <option value="">Toàn hệ thống</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Vai trò nhân sự:</label>
                  <select
                    value={shiftForm.roleId}
                    onChange={(e) => setShiftForm({ ...shiftForm, roleId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                  >
                    <option value="">Tất cả vai trò</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Giờ bắt đầu (*):</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Giờ kết thúc (*):</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Cho phép trễ (phút):</label>
                  <input
                    type="number"
                    min="0"
                    value={shiftForm.gracePeriodMins}
                    onChange={(e) => setShiftForm({ ...shiftForm, gracePeriodMins: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={shiftForm.isSplitShift}
                    onChange={(e) => setShiftForm({ ...shiftForm, isSplitShift: e.target.checked })}
                  />
                  <span>Đây là Ca Gãy (Có khung giờ thứ 2)</span>
                </label>

                {shiftForm.isSplitShift && (
                  <div className="grid grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-slate-200">
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Giờ bắt đầu khung 2:</label>
                      <input
                        type="time"
                        value={shiftForm.startTime2}
                        onChange={(e) => setShiftForm({ ...shiftForm, startTime2: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Giờ kết thúc khung 2:</label>
                      <input
                        type="time"
                        value={shiftForm.endTime2}
                        onChange={(e) => setShiftForm({ ...shiftForm, endTime2: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  Nhân viên được gán riêng ca này (Tùy chọn):
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50 flex flex-col gap-1">
                  {users.map((u) => {
                    const isChecked = shiftForm.assignedUserIds.includes(u.id);
                    return (
                      <label key={u.id} className="inline-flex items-center gap-2 p-1 rounded hover:bg-slate-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setShiftForm({ ...shiftForm, assignedUserIds: [...shiftForm.assignedUserIds, u.id] });
                            } else {
                              setShiftForm({ ...shiftForm, assignedUserIds: shiftForm.assignedUserIds.filter((id) => id !== u.id) });
                            }
                          }}
                        />
                        <span className="text-slate-800">{u.fullName || u.username}</span>
                        <span className="text-slate-400 text-[10px]">({u.role})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#DA251D] hover:bg-[#b91c1c] text-white font-bold"
                >
                  Lưu Ca Làm Việc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: IMPORT LỊCH CA TUẦN TỪ EXCEL */}
      {/* ======================================================== */}
      {isShiftImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900">Import Lịch Ca Tuần (Excel)</h3>
              <button onClick={() => setIsShiftImportOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleImportWeeklyShifts} className="flex flex-col gap-3.5 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">File Excel lịch ca (*.xlsx):</label>
                <input
                  type="file"
                  required
                  accept=".xlsx"
                  onChange={(e) => setShiftImportFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-[#DA251D] hover:file:bg-red-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Áp dụng cho vai trò (*):</label>
                <select
                  required
                  value={shiftImportRoleId}
                  onChange={(e) => setShiftImportRoleId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="">-- Chọn vai trò --</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Áp dụng cho chi nhánh (*):</label>
                <select
                  required
                  value={shiftImportBranchId}
                  onChange={(e) => setShiftImportBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="">-- Chọn chi nhánh --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
                <AlertTriangle size={14} className="inline mr-1 text-amber-600" />
                Hệ thống sẽ tự động quét Thứ 2 đến Chủ nhật, nhận diện giờ ca và gán nhân viên theo tên trong bảng.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsShiftImportOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#DA251D] hover:bg-[#b91c1c] text-white font-bold"
                >
                  Bắt Đầu Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: IMPORT BẢNG CÔNG LỊCH SỬ SUSHI WA */}
      {/* ======================================================== */}
      {isHistoryImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900">Import Công Lịch Sử Sushi Wa</h3>
              <button onClick={() => setIsHistoryImportOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleImportHistoricalAttendance} className="flex flex-col gap-3.5 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">File Excel báo cáo Sushi Wa (*.xlsx):</label>
                <input
                  type="file"
                  required
                  accept=".xlsx"
                  onChange={(e) => setHistoryImportFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-[#DA251D] hover:file:bg-red-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Chi nhánh đích (*):</label>
                <select
                  required
                  value={historyImportBranchId}
                  onChange={(e) => setHistoryImportBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="">-- Chọn chi nhánh ghi nhận công --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={historyUpdateExisting}
                    onChange={(e) => setHistoryUpdateExisting(e.target.checked)}
                  />
                  <span>Ghi đè/cập nhật nếu bản ghi công đã tồn tại</span>
                </label>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600">
                Dữ liệu sau khi import sẽ được gắn nhãn nguồn gốc <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-bold">sourceSystem = SUSHI_WA</code> để phục vụ đối chiếu và kiểm tra tính toàn vẹn.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsHistoryImportOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#DA251D] hover:bg-[#b91c1c] text-white font-bold"
                >
                  Nhập Dữ Liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

