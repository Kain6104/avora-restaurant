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
  XCircle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  User as UserIcon,
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
}

interface PersonalTimecardViewProps {
  onBack: () => void;
}

export default function PersonalTimecardView({ onBack }: PersonalTimecardViewProps) {
  const { currentUser } = useWaiterStore();

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
        return { text: 'Đang làm', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock };
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
      {/* 1. TOP BAR — NATIVE IOS TITLE & BACK */}
      <div className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
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
            className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'LIST'
                ? 'bg-[#007AFF] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List size={16} strokeWidth={2.5} />
            <span>Danh sách</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MATRIX')}
            className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'MATRIX'
                ? 'bg-[#007AFF] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid size={16} strokeWidth={2.5} />
            <span>Ma trận</span>
          </button>
        </div>
      </div>

      {/* 3. SCROLLABLE CONTENT BODY */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 pb-20 touch-pan-y">
        {/* ========================================================= */}
        {/* TAB 1: DANH SÁCH (ẢNH 3 ĐÍNH KÈM)                         */}
        {/* ========================================================= */}
        {activeTab === 'LIST' && (
          <>
            {/* Box Khoảng thời gian */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <Filter size={13} className="text-[#007AFF]" />
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#007AFF]"
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
                  className="w-10 h-10 rounded-xl bg-[#007AFF] hover:bg-blue-600 active:scale-95 text-white flex items-center justify-center shadow-sm shrink-0 transition-all cursor-pointer"
                  title="Áp dụng tìm kiếm"
                >
                  <Search size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* 2 Thẻ KPI: TỔNG GIỜ CÔNG & VI PHẠM (TRỄ/SỚM) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Thẻ 1: Tổng Giờ Công (Viền xanh) */}
              <div className="bg-white rounded-2xl p-3.5 border-l-4 border-l-[#007AFF] border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  TỔNG GIỜ CÔNG
                </span>
                <span className="text-2xl font-black text-[#007AFF] font-mono mt-1 leading-none">
                  {totalHours.toFixed(1)}h
                </span>
              </div>

              {/* Thẻ 2: Vi phạm (Trễ/Sớm) (Viền đỏ) */}
              <div className="bg-white rounded-2xl p-3.5 border-l-4 border-l-[#FF3B30] border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  VI PHẠM (TRỄ/SỚM)
                </span>
                <span className="text-2xl font-black text-[#FF3B30] font-mono mt-1 leading-none">
                  {violationCount} lần
                </span>
              </div>
            </div>

            {/* Danh sách CHI TIẾT CÁC CA LÀM */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 px-1">
                CHI TIẾT CÁC CA LÀM
              </div>

              {isLoading ? (
                <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center text-slate-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#007AFF]" />
                  <p className="text-xs font-semibold">Đang tải chi tiết ca làm việc...</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center text-slate-400">
                  <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold">Không có dữ liệu ca làm trong khoảng thời gian này.</p>
                </div>
              ) : (
                historyList.map((item) => {
                  const cfg = getBadgeConfig(item.status);
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5"
                    >
                      {/* Top: Ngày & Badge Trạng Thái */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <Calendar size={14} className="text-[#007AFF]" />
                          <span>{item.date}</span>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.bg}`}>
                          <Icon size={12} strokeWidth={2.5} />
                          <span>{cfg.text}</span>
                        </span>
                      </div>

                      {/* Tên Ca Làm */}
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <UserIcon size={14} className="text-slate-400 shrink-0" />
                        <span>{item.shiftName}</span>
                      </div>

                      {/* 3 Cột: Giờ Vào - Giờ Ra - Số giờ */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Giờ Vào</div>
                          <div className="font-mono font-black text-xs text-emerald-600 mt-0.5">
                            {item.checkIn || '--:--'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Giờ Ra</div>
                          <div className={`font-mono font-black text-xs mt-0.5 ${item.checkOut === 'Đang làm' ? 'text-amber-500 animate-pulse' : 'text-slate-800'}`}>
                            {item.checkOut || '--:--'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Số giờ</div>
                          <div className="font-mono font-black text-xs text-[#007AFF] mt-0.5">
                            {Number(item.hours).toFixed(2)}h
                          </div>
                        </div>
                      </div>

                      {/* Ghi chú ca gãy / trễ */}
                      {item.notes && (
                        <div className="text-[11px] text-slate-600 bg-amber-50/60 border border-amber-200/70 rounded-xl px-2.5 py-1.5 flex items-start gap-1.5">
                          <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                          <span>{item.notes}</span>
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
        {/* TAB 2: MA TRẬN TUẦN (ẢNH 2 ĐÍNH KÈM)                      */}
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
                  <Calendar size={14} className="text-[#007AFF] shrink-0" />
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
                  className="px-4 py-2 bg-[#007AFF] hover:bg-blue-600 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition-all shrink-0 cursor-pointer"
                >
                  Áp dụng
                </button>
              </div>
            </div>

            {/* Bảng Ma Trận Chi Tiết */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="p-3 font-bold border-r border-slate-200 text-left min-w-[110px]">
                        Nhân viên
                      </th>
                      {matrixDays.map((d) => (
                        <th
                          key={d.isoDate}
                          className="p-2 font-bold min-w-[70px] border-r border-slate-200 last:border-r-0"
                        >
                          <div className="text-[10px] text-slate-500">{d.dayName}</div>
                          <div
                            className={`mt-0.5 px-1.5 py-0.5 rounded-md inline-block font-mono ${
                              d.isToday ? 'bg-[#007AFF] text-white font-bold' : 'text-slate-700'
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
                      {/* Cột Nhân Viên */}
                      <td className="p-3 border-r border-slate-200 text-left align-top">
                        <div className="font-extrabold text-xs text-[#007AFF]">
                          {currentUser?.fullName || 'Nhân viên'}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase mt-0.5 font-bold">
                          {currentUser?.role || 'SERVER'}
                        </div>
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
                              d.isToday ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            {records.length === 0 ? (
                              <div className="h-16 flex items-center justify-center text-slate-300 font-mono">
                                -
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
                                    <div className="text-[9px] font-bold text-[#007AFF] font-mono mt-0.5">
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
