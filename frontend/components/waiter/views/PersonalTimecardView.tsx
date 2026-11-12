'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  List,
  Grid,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Building2,
} from 'lucide-react';
import { useWaiterStore } from '@/store/useWaiterStore';

interface AttendanceItem {
  id: string;
  date: string;
  shiftName: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  status: string;
  notes: string;
  branchName?: string;
}

interface PersonalTimecardViewProps {
  onBack: () => void;
}

export default function PersonalTimecardView({ onBack }: PersonalTimecardViewProps) {
  const { currentUser, currentBranch } = useWaiterStore();

  const [activeTab, setActiveTab] = useState<'LIST' | 'MATRIX'>('LIST');
  const [filterType, setFilterType] = useState<'custom' | 'this_week' | 'last_week' | 'this_month' | 'last_month'>('custom');

  // Dates for List tab
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Dates for Matrix tab (Default: current week)
  const [matrixStartDate, setMatrixStartDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  });
  const [matrixEndDate, setMatrixEndDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const sunday = new Date(now.setDate(diff + 6));
    return sunday.toISOString().split('T')[0];
  });

  const [historyList, setHistoryList] = useState<AttendanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Quick range helper
  const applyQuickFilter = (type: 'this_week' | 'last_week' | 'this_month' | 'last_month') => {
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (type === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      s = new Date(now.setDate(diff));
      e = new Date(s);
      e.setDate(s.getDate() + 6);
    } else if (type === 'last_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      s = new Date(now.setDate(diff));
      e = new Date(s);
      e.setDate(s.getDate() + 6);
    } else if (type === 'this_month') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === 'last_month') {
      s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      e = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const sStr = s.toISOString().split('T')[0];
    const eStr = e.toISOString().split('T')[0];
    setStartDate(sStr);
    setEndDate(eStr);
    fetchData(sStr, eStr);
  };

  const fetchData = async (start: string, end: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/attendance/employee/history?startDate=${start}&endDate=${end}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setHistoryList(json.data);
        }
      }
    } catch (e) {
      console.warn('Lỗi lấy dữ liệu bảng công:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const s = activeTab === 'LIST' ? startDate : matrixStartDate;
    const e = activeTab === 'LIST' ? endDate : matrixEndDate;
    fetchData(s, e);
  }, [activeTab]);

  // Thống kê tổng giờ & vi phạm
  const totalHours = useMemo(() => {
    return historyList.reduce((acc, cur) => acc + (Number(cur.hours) || 0), 0);
  }, [historyList]);

  const violationCount = useMemo(() => {
    return historyList.filter(
      (item) => item.status === 'LATE' || item.status === 'EARLY_LEAVE' || item.status === 'MISSING_CHECKOUT',
    ).length;
  }, [historyList]);

  // Trạng thái badge
  const getBadgeConfig = (status: string) => {
    switch (status) {
      case 'ON_TIME':
        return { text: 'Đúng giờ', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
      case 'LATE':
        return { text: 'Đi trễ', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertTriangle };
      case 'EARLY_LEAVE':
        return { text: 'Về sớm', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle };
      case 'MISSING_CHECKOUT':
        return { text: 'Thiếu Checkout', bg: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertCircle };
      default:
        return { text: 'Đang làm', bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock };
    }
  };

  // Ma trận tuần
  const matrixDays = useMemo(() => {
    const days: Array<{ dayName: string; dateShort: string; isoDate: string; isToday: boolean }> = [];
    const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const start = new Date(matrixStartDate);
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const iso = current.toISOString().split('T')[0];
      const dd = String(current.getDate()).padStart(2, '0');
      const mm = String(current.getMonth() + 1).padStart(2, '0');

      days.push({
        dayName: dayNames[i],
        dateShort: `${dd}/${mm}`,
        isoDate: iso,
        isToday: iso === todayStr,
      });
    }
    return days;
  }, [matrixStartDate]);

  const attByDate = useMemo(() => {
    const map: Record<string, AttendanceItem[]> = {};
    historyList.forEach((item) => {
      let dateKey = item.date;
      if (item.date && item.date.includes('/')) {
        const parts = item.date.split('/');
        if (parts.length === 3) {
          dateKey = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(item);
    });
    return map;
  }, [historyList]);

  const daysWorkedCount = useMemo(() => {
    return Object.keys(attByDate).length;
  }, [attByDate]);

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] select-none text-slate-800 overflow-hidden font-sans">
      {/* 1. TOP BAR — NATIVE IOS TITLE & BACK (SAFE AREA IPHONE) */}
      <div className="px-4 pt-[max(12px,calc(env(safe-area-inset-top)+4px))] pb-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
        <button
          onClick={onBack}
          type="button"
          className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-90 transition-all flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>

        <h1 className="font-extrabold text-base text-slate-900 tracking-tight text-center">
          Bảng công cá nhân
        </h1>

        <div className="w-8" />
      </div>

      {/* 2. SEGMENTED CONTROL (DANH SÁCH / MA TRẬN) */}
      <div className="p-3 bg-white border-b border-slate-100 shrink-0">
        <div className="max-w-md mx-auto grid grid-cols-2 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'LIST'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List size={16} strokeWidth={2.5} />
            <span>Danh sách</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MATRIX')}
            className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'MATRIX'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid size={16} strokeWidth={2.5} />
            <span>Ma trận</span>
          </button>
        </div>
      </div>

      {/* 3. SCROLLABLE CONTENT BODY */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 pb-24 touch-pan-y">
        {/* ========================================================= */}
        {/* TAB 1: DANH SÁCH (GỘP CÁC CA LÀM CÙNG NGÀY)               */}
        {/* ========================================================= */}
        {activeTab === 'LIST' && (
          <>
            {/* Box Khoảng thời gian */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <Filter size={13} className="text-[#DA251D]" />
                <span>KHOẢNG THỜI GIAN</span>
              </div>

              {/* Dropdown presets */}
              <select
                value={filterType}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setFilterType(val);
                  if (val !== 'custom') applyQuickFilter(val);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#DA251D]"
              >
                <option value="custom">Tùy chỉnh khoảng ngày...</option>
                <option value="this_week">Tuần này</option>
                <option value="last_week">Tuần trước</option>
                <option value="this_month">Tháng này</option>
                <option value="last_month">Tháng trước</option>
              </select>

              {/* Input ngày Bắt đầu - Kết thúc + Nút Tìm kiếm */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-transparent outline-none font-medium text-slate-800 text-[11px]"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-transparent outline-none font-medium text-slate-800 text-[11px]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => fetchData(startDate, endDate)}
                  className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-sm shrink-0 transition-all cursor-pointer"
                  title="Áp dụng tìm kiếm"
                >
                  <Search size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* 2 Thẻ KPI: TỔNG GIỜ CÔNG & VI PHẠM (TRỄ/SỚM) - THEO CHUẨN SUSHI WA */}
            <div className="grid grid-cols-2 gap-3">
              {/* Thẻ 1: Tổng Giờ Công */}
              <div className="bg-white rounded-2xl p-4 border-l-4 border-l-blue-500 border border-slate-200/80 shadow-2xs flex flex-col items-start justify-center">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                  TỔNG GIỜ CÔNG
                </span>
                <span className="text-2xl font-black text-blue-600 font-mono mt-1 leading-none">
                  {totalHours.toFixed(1)}h
                </span>
              </div>

              {/* Thẻ 2: Vi phạm (Trễ/Sớm) */}
              <div className="bg-white rounded-2xl p-4 border-l-4 border-l-rose-500 border border-slate-200/80 shadow-2xs flex flex-col items-start justify-center">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                  VI PHẠM (TRỄ/SỚM)
                </span>
                <span className="text-2xl font-black text-rose-600 font-mono mt-1 leading-none">
                  {violationCount} lần
                </span>
              </div>
            </div>

            {/* Danh sách CHI TIẾT CÁC CA LÀM (CHUẨN 100% GIAO DIỆN SUSHI WA) */}
            <div className="space-y-3">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 px-1">
                CHI TIẾT CÁC CA LÀM
              </div>

              {isLoading ? (
                <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center text-slate-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-xs font-semibold">Đang tải dữ liệu ca làm việc...</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center text-slate-400">
                  <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold">Không có dữ liệu ca làm trong khoảng thời gian này.</p>
                </div>
              ) : (
                historyList.map((shift, idx) => {
                  const cfg = getBadgeConfig(shift.status);
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={shift.id || idx}
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 space-y-2.5 transition-all"
                    >
                      {/* Dòng 1: Ngày làm việc (Màu xanh) & Badge trạng thái */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-blue-600">
                          <Calendar size={15} className="text-blue-600 shrink-0" />
                          <span>{shift.date}</span>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.bg}`}>
                          <Icon size={12} strokeWidth={2.5} />
                          <span>{cfg.text}</span>
                        </span>
                      </div>

                      {/* Dòng 2: Tên ca làm việc */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <UserIcon size={14} className="text-slate-500 shrink-0" />
                        <span>{shift.shiftName}</span>
                      </div>

                      {/* Dòng 3: Khung 3 cột Giờ Vào - Giờ Ra - Số Giờ */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50/80 rounded-xl p-2.5 text-center border border-slate-100">
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Giờ Vào</div>
                          <div className="font-mono font-black text-xs text-emerald-600 mt-0.5">
                            {shift.checkIn || '--:--'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Giờ Ra</div>
                          <div className={`font-mono font-black text-xs mt-0.5 ${shift.checkOut === 'Đang làm' ? 'text-amber-500 animate-pulse' : 'text-rose-500'}`}>
                            {shift.checkOut || '--:--'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Số giờ</div>
                          <div className="font-mono font-black text-xs text-blue-600 mt-0.5">
                            {Number(shift.hours).toFixed(2)}h
                          </div>
                        </div>
                      </div>

                      {/* Dòng 4: Ghi chú vi phạm / ca gãy / thông tin thêm */}
                      {shift.notes ? (
                        <div className="text-[11px] text-rose-600 flex items-center gap-1.5 pt-0.5 font-medium">
                          <AlertCircle size={13} className="text-rose-500 shrink-0" />
                          <span>{shift.notes}</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                          <Building2 size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{shift.branchName || currentBranch?.name || 'Chi nhánh AVORA'}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 2: MA TRẬN TUẦN (SỬA LỖI OVERFLOW - CUỘN NGANG)      */}
        {/* ========================================================= */}
        {activeTab === 'MATRIX' && (
          <>
            {/* Box Bộ Lọc Ma Trận */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                BỘ LỌC MA TRẬN:
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                  <Calendar size={14} className="text-[#DA251D] shrink-0" />
                  <input
                    type="date"
                    value={matrixStartDate}
                    onChange={(e) => setMatrixStartDate(e.target.value)}
                    className="w-full bg-transparent outline-none font-medium text-slate-800 text-[11px]"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="date"
                    value={matrixEndDate}
                    onChange={(e) => setMatrixEndDate(e.target.value)}
                    className="w-full bg-transparent outline-none font-medium text-slate-800 text-[11px]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => fetchData(matrixStartDate, matrixEndDate)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition-all shrink-0 cursor-pointer"
                >
                  Áp dụng
                </button>
              </div>
            </div>

            {/* Bảng Ma Trận Chi Tiết - Bọc container overflow-x-auto, cố định cột nhân viên */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden w-full max-w-full">
              <div 
                className="overflow-x-auto touch-pan-x overscroll-x-contain scroll-smooth no-scrollbar"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
              >
                <table className="min-w-[620px] w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      {/* Cột Nhân Viên Cố Định Bên Trái (Sticky Column) */}
                      <th className="p-3 font-bold border-r border-slate-200 text-left min-w-[110px] w-[110px] sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                        Nhân viên
                      </th>
                      {matrixDays.map((d) => (
                        <th
                          key={d.isoDate}
                          className="p-2 font-bold min-w-[70px] border-r border-slate-200 last:border-r-0"
                        >
                          <div className="text-[10px] text-slate-500">{d.dayName}</div>
                          <div
                            className={`mt-0.5 px-2 py-0.5 rounded-lg inline-block font-mono text-xs ${
                              d.isToday ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-700'
                            }`}
                          >
                            {d.dateShort}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                      {/* Cột Nhân Viên Cố Định Bên Trái (Sticky Column) */}
                      <td className="p-3 border-r border-slate-200 text-left align-top sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                        <div className="font-extrabold text-xs text-blue-600 truncate">
                          {currentUser?.fullName || 'Nhân viên'}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase mt-0.5 font-bold">
                          {currentUser?.role || 'SERVER'}
                        </div>
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          {daysWorkedCount} ngày
                        </span>
                      </td>

                      {/* Các Ô Ngày Trong Tuần */}
                      {matrixDays.map((d) => {
                        const records = attByDate[d.isoDate] || [];

                        return (
                          <td
                            key={d.isoDate}
                            className={`p-1.5 border-r border-slate-200 last:border-r-0 align-top ${
                              d.isToday ? 'bg-blue-50/20' : ''
                            }`}
                          >
                            {records.length === 0 ? (
                              <div className="h-16 flex items-center justify-center">
                                <div className="w-10 h-14 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 font-mono">
                                  -
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 min-h-[64px]">
                                {records.map((r, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-slate-100 rounded-lg p-1.5 text-[10px] text-left border border-slate-200"
                                  >
                                    <div className="font-bold text-slate-800 truncate">{r.shiftName}</div>
                                    <div className="font-mono text-[9px] text-slate-500 mt-0.5">
                                      {r.checkIn} - {r.checkOut}
                                    </div>
                                    <div className="text-[9px] font-bold text-blue-600 font-mono mt-0.5">
                                      {Number(r.hours).toFixed(1)}h
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
