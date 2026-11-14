'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Building2,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import { useWaiterStore } from '@/store/useWaiterStore';
import PullToRefresh from '../common/PullToRefresh';

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
  hasCheckOut?: boolean;
}

interface DailyTimecardGroup {
  dateKey: string;
  rawDate: string;
  items: AttendanceItem[];
  totalHours: number;
  dayStatus: string;
  branchNames: string;
}

const isViolationStatus = (st: string) =>
  ['LATE', 'EARLY_LEAVE', 'LATE_AND_EARLY_LEAVE', 'MISSING_CHECKOUT'].includes(st);

const getEffectiveStatus = (item: AttendanceItem): string => {
  const raw = String(item.status || '').toUpperCase().trim();
  const hasOut = Boolean(
    item.hasCheckOut ||
    (item.checkOut && item.checkOut !== 'Đang làm' && item.checkOut !== '--:--')
  );

  // If item is actively in progress (no checkout and explicitly marked as working or 'Đang làm')
  if (!hasOut && (item.checkOut === 'Đang làm' || raw === 'WORKING' || raw === 'IN_PROGRESS')) {
    return 'WORKING';
  }

  // Handle known backend statuses
  if (raw === 'LATE_AND_EARLY_LEAVE') return 'LATE_AND_EARLY_LEAVE';
  if (raw === 'LATE') return 'LATE';
  if (raw === 'EARLY_LEAVE') return 'EARLY_LEAVE';
  if (raw === 'MISSING_CHECKOUT') return 'MISSING_CHECKOUT';
  if (raw === 'ON_TIME' || raw === 'COMPLETED' || raw === 'PRESENT') return 'ON_TIME';
  if (raw === 'FLEXIBLE') return 'FLEXIBLE';
  if (raw === 'ABSENT') return 'ABSENT';

  // Fallback: If has checkout, treat as ON_TIME / Completed, NEVER 'Đang làm'
  if (hasOut) {
    return 'ON_TIME';
  }
  return 'WORKING';
};

interface PersonalTimecardViewProps {
  onBack: () => void;
}

type DatePreset = 'last_30' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';
type StatusFilter = 'ALL' | 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' | 'MISSING_CHECKOUT' | 'WORKING';

function toLocalIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMondayAndSunday(refDate: Date, weekOffset = 0): { start: string; end: string } {
  const base = new Date(refDate);
  const day = base.getDay();
  const diffToMonday = base.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
  const monday = new Date(base.getFullYear(), base.getMonth(), diffToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return {
    start: toLocalIsoDate(monday),
    end: toLocalIsoDate(sunday),
  };
}

function normalizeIsoDateKey(rawDate?: string): string {
  if (!rawDate) return '';
  if (rawDate.includes('/')) {
    const parts = rawDate.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return rawDate;
}

function formatViDateLabel(rawDate: string): string {
  const iso = normalizeIsoDateKey(rawDate);
  const parts = iso.split('-');
  if (parts.length !== 3) return rawDate;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayLabel = Number.isNaN(d.getTime()) ? '' : weekdayLabels[d.getDay()];
  return `${dayLabel ? `${dayLabel}, ` : ''}${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function PersonalTimecardView({ onBack }: PersonalTimecardViewProps) {
  const { currentUser, currentBranch } = useWaiterStore();

  const [activeTab, setActiveTab] = useState<'LIST' | 'MATRIX'>('LIST');
  const [datePreset, setDatePreset] = useState<DatePreset>('last_30');

  // Dates for List tab (default: last 30 days)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalIsoDate(d);
  });
  const [endDate, setEndDate] = useState(() => toLocalIsoDate(new Date()));

  // Dates for Matrix tab (default: current week Monday..Sunday)
  const initialWeek = useMemo(() => getMondayAndSunday(new Date(), 0), []);
  const [matrixStartDate, setMatrixStartDate] = useState(initialWeek.start);
  const [matrixEndDate, setMatrixEndDate] = useState(initialWeek.end);

  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyViolations, setOnlyViolations] = useState(false);
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDateExpand = (dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const [historyList, setHistoryList] = useState<AttendanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async (start: string, end: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/attendance/employee/history?startDate=${start}&endDate=${end}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setHistoryList(json.data);
        } else {
          setHistoryList([]);
        }
      } else {
        setErrorMessage('Không thể tải dữ liệu bảng công. Kéo xuống để thử lại.');
      }
    } catch (e) {
      console.warn('Lỗi lấy dữ liệu bảng công:', e);
      setErrorMessage('Lỗi kết nối khi tải bảng công.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const s = activeTab === 'LIST' ? startDate : matrixStartDate;
    const e = activeTab === 'LIST' ? endDate : matrixEndDate;
    (async () => {
      try {
        const res = await fetch(`/api/attendance/employee/history?startDate=${s}&endDate=${e}`, {
          credentials: 'include',
        });
        if (!active) return;
        if (res.ok) {
          const json = await res.json();
          setHistoryList(json.success && Array.isArray(json.data) ? json.data : []);
          setErrorMessage(null);
        } else {
          setErrorMessage('Không thể tải dữ liệu bảng công. Kéo xuống để thử lại.');
        }
      } catch (err) {
        if (!active) return;
        console.warn('Lỗi lấy dữ liệu bảng công:', err);
        setErrorMessage('Lỗi kết nối khi tải bảng công.');
      }
    })();
    return () => {
      active = false;
    };
  }, [activeTab]);

  const applyQuickFilter = (preset: Exclude<DatePreset, 'custom'>) => {
    const now = new Date();
    let sStr = startDate;
    let eStr = endDate;

    if (preset === 'last_30') {
      const s = new Date(now);
      s.setDate(now.getDate() - 30);
      sStr = toLocalIsoDate(s);
      eStr = toLocalIsoDate(now);
    } else if (preset === 'this_week') {
      const range = getMondayAndSunday(now, 0);
      sStr = range.start;
      eStr = range.end;
    } else if (preset === 'last_week') {
      const range = getMondayAndSunday(now, -1);
      sStr = range.start;
      eStr = range.end;
    } else if (preset === 'this_month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      sStr = toLocalIsoDate(s);
      eStr = toLocalIsoDate(e);
    } else if (preset === 'last_month') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      sStr = toLocalIsoDate(s);
      eStr = toLocalIsoDate(e);
    }

    setDatePreset(preset);
    setStartDate(sStr);
    setEndDate(eStr);
    fetchData(sStr, eStr);
  };

  const shiftMatrixWeek = (deltaWeeks: number) => {
    const base = new Date(`${matrixStartDate}T00:00:00`);
    const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
    const range = deltaWeeks === 0 ? getMondayAndSunday(new Date(), 0) : getMondayAndSunday(safeBase, deltaWeeks);
    setMatrixStartDate(range.start);
    setMatrixEndDate(range.end);
    fetchData(range.start, range.end);
  };

  const resetAdvancedFilters = () => {
    setStatusFilter('ALL');
    setSearchQuery('');
    setOnlyViolations(false);
    setSortOrder('DESC');
  };

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'ALL') count += 1;
    if (searchQuery.trim()) count += 1;
    if (onlyViolations) count += 1;
    if (sortOrder !== 'DESC') count += 1;
    return count;
  }, [statusFilter, searchQuery, onlyViolations, sortOrder]);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = historyList.filter((item) => {
      const effStatus = getEffectiveStatus(item);

      if (onlyViolations && !isViolationStatus(effStatus)) {
        return false;
      }
      if (statusFilter === 'WORKING') {
        if (effStatus !== 'WORKING') return false;
      } else if (statusFilter === 'LATE') {
        if (effStatus !== 'LATE' && effStatus !== 'LATE_AND_EARLY_LEAVE') return false;
      } else if (statusFilter !== 'ALL' && effStatus !== statusFilter) {
        return false;
      }

      if (q) {
        const hay = `${item.shiftName || ''} ${item.branchName || ''} ${item.notes || ''} ${item.date || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const kA = `${normalizeIsoDateKey(a.date)} ${a.checkIn || ''}`;
      const kB = `${normalizeIsoDateKey(b.date)} ${b.checkIn || ''}`;
      return sortOrder === 'DESC' ? kB.localeCompare(kA) : kA.localeCompare(kB);
    });

    return list;
  }, [historyList, statusFilter, searchQuery, onlyViolations, sortOrder]);

  const totalHours = useMemo(() => {
    return filteredHistory.reduce((acc, cur) => acc + (Number(cur.hours) || 0), 0);
  }, [filteredHistory]);

  const violationCount = useMemo(() => {
    return filteredHistory.filter((item) => isViolationStatus(getEffectiveStatus(item))).length;
  }, [filteredHistory]);

  const groupedHistory = useMemo(() => {
    const groupsMap = new Map<string, DailyTimecardGroup>();

    for (const item of filteredHistory) {
      const key = normalizeIsoDateKey(item.date) || 'unknown';
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          dateKey: key,
          rawDate: item.date,
          items: [],
          totalHours: 0,
          dayStatus: 'ON_TIME',
          branchNames: '',
        });
      }
      const group = groupsMap.get(key)!;
      group.items.push(item);
      group.totalHours += Number(item.hours || 0);
    }

    const groups = Array.from(groupsMap.values());
    for (const g of groups) {
      const bNames = Array.from(
        new Set(g.items.map((it) => it.branchName).filter(Boolean))
      ).join(', ');
      g.branchNames = bNames;
    }

    groups.sort((a, b) => {
      return sortOrder === 'DESC'
        ? b.dateKey.localeCompare(a.dateKey)
        : a.dateKey.localeCompare(b.dateKey);
    });

    return groups;
  }, [filteredHistory, sortOrder]);

  const getBadgeConfig = (status: string) => {
    const s = String(status || '').toUpperCase().trim();
    switch (s) {
      case 'ON_TIME':
      case 'COMPLETED':
      case 'PRESENT':
        return {
          text: 'Đúng giờ',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          cellBorder: 'border-emerald-200 bg-emerald-50/40',
          icon: CheckCircle2,
        };
      case 'LATE_AND_EARLY_LEAVE':
        return {
          text: 'Trễ & Về sớm',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          cellBorder: 'border-rose-200 bg-rose-50/50',
          icon: AlertTriangle,
        };
      case 'LATE':
        return {
          text: 'Đi trễ',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          cellBorder: 'border-rose-200 bg-rose-50/50',
          icon: AlertTriangle,
        };
      case 'EARLY_LEAVE':
        return {
          text: 'Về sớm',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          cellBorder: 'border-amber-200 bg-amber-50/50',
          icon: AlertTriangle,
        };
      case 'MISSING_CHECKOUT':
        return {
          text: 'Thiếu Checkout',
          bg: 'bg-orange-50 text-orange-700 border-orange-200',
          cellBorder: 'border-orange-200 bg-orange-50/50',
          icon: AlertCircle,
        };
      case 'FLEXIBLE':
        return {
          text: 'Linh hoạt',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          cellBorder: 'border-blue-200 bg-blue-50/40',
          icon: Clock,
        };
      case 'ABSENT':
        return {
          text: 'Vắng mặt',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          cellBorder: 'border-slate-200 bg-slate-50',
          icon: AlertCircle,
        };
      case 'WORKING':
      case 'IN_PROGRESS':
        return {
          text: 'Đang làm',
          bg: 'bg-sky-50 text-sky-700 border-sky-200',
          cellBorder: 'border-sky-200 bg-sky-50/40',
          icon: Clock,
        };
      default:
        return {
          text: 'Hoàn tất',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          cellBorder: 'border-slate-200 bg-slate-50',
          icon: Clock,
        };
    }
  };

  const getDayBadgeConfig = (items: AttendanceItem[]) => {
    const effStatuses = items.map(getEffectiveStatus);
    if (effStatuses.some((s) => s === 'LATE_AND_EARLY_LEAVE')) {
      return {
        text: 'Trễ & Về sớm',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: AlertTriangle,
      };
    }
    if (effStatuses.some((s) => s === 'LATE')) {
      return {
        text: 'Đi trễ',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: AlertTriangle,
      };
    }
    if (effStatuses.some((s) => s === 'EARLY_LEAVE')) {
      return {
        text: 'Về sớm',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: AlertTriangle,
      };
    }
    if (effStatuses.some((s) => s === 'MISSING_CHECKOUT')) {
      return {
        text: 'Thiếu Checkout',
        bg: 'bg-orange-50 text-orange-700 border-orange-200',
        icon: AlertCircle,
      };
    }
    if (effStatuses.some((s) => s === 'WORKING')) {
      return {
        text: 'Đang làm',
        bg: 'bg-sky-50 text-sky-700 border-sky-200',
        icon: Clock,
      };
    }
    return {
      text: 'Đúng giờ',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
    };
  };

  // Ma trận 7 ngày từ matrixStartDate
  const matrixDays = useMemo(() => {
    const days: Array<{ dayName: string; dateShort: string; isoDate: string; isToday: boolean }> = [];
    const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const parts = matrixStartDate.split('-').map(Number);
    const start = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
    const todayStr = toLocalIsoDate(new Date());

    for (let i = 0; i < 7; i++) {
      const current = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = toLocalIsoDate(current);
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
    filteredHistory.forEach((item) => {
      const dateKey = normalizeIsoDateKey(item.date);
      if (!dateKey) return;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(item);
    });
    return map;
  }, [filteredHistory]);

  const daysWorkedCount = useMemo(() => Object.keys(attByDate).length, [attByDate]);

  const quickPresetButtons: Array<{ key: Exclude<DatePreset, 'custom'>; label: string }> = [
    { key: 'last_30', label: '30 ngày' },
    { key: 'this_week', label: 'Tuần này' },
    { key: 'last_week', label: 'Tuần trước' },
    { key: 'this_month', label: 'Tháng này' },
    { key: 'last_month', label: 'Tháng trước' },
  ];

  const statusChips: Array<{ key: StatusFilter; label: string }> = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'ON_TIME', label: 'Đúng giờ' },
    { key: 'LATE', label: 'Đi trễ' },
    { key: 'EARLY_LEAVE', label: 'Về sớm' },
    { key: 'MISSING_CHECKOUT', label: 'Thiếu Checkout' },
    { key: 'WORKING', label: 'Đang làm' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] select-none text-slate-800 overflow-hidden font-sans">
      {/* 1. COMPACT NATIVE TOP BAR (Safe Area Ready) */}
      <div className="px-3 pt-[max(10px,calc(env(safe-area-inset-top)+4px))] pb-2 bg-white border-b border-slate-200/80 flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={onBack}
          type="button"
          className="w-9 h-9 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer"
          aria-label="Quay lại"
        >
          <ArrowLeft size={20} strokeWidth={2.4} />
        </button>

        <div className="min-w-0 text-center flex-1">
          <h1 className="font-extrabold text-[15px] text-slate-900 tracking-tight truncate">
            Bảng công cá nhân
          </h1>
          <p className="text-[11px] text-slate-500 font-medium truncate">
            {currentUser?.fullName || 'Nhân viên'}
            {currentBranch?.name ? ` • ${currentBranch.name}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchData(activeTab === 'LIST' ? startDate : matrixStartDate, activeTab === 'LIST' ? endDate : matrixEndDate)}
          disabled={isLoading}
          className="w-9 h-9 rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
          aria-label="Làm mới bảng công"
        >
          <RefreshCw size={17} className={isLoading ? 'animate-spin text-[#DA251D]' : ''} />
        </button>
      </div>

      {/* 2. COMPACT SEGMENTED CONTROL (DANH SÁCH / MA TRẬN) */}
      <div className="px-3 py-2 bg-white border-b border-slate-100 shrink-0">
        <div className="max-w-md mx-auto grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'LIST'
                ? 'bg-[#DA251D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List size={15} strokeWidth={2.4} />
            <span>Danh sách</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MATRIX')}
            className={`py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'MATRIX'
                ? 'bg-[#DA251D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid size={15} strokeWidth={2.4} />
            <span>Ma trận tuần</span>
          </button>
        </div>
      </div>

      {/* 3. SCROLLABLE BODY WITH PULL-TO-REFRESH */}
      <PullToRefresh
        onRefresh={async () => {
          const s = activeTab === 'LIST' ? startDate : matrixStartDate;
          const e = activeTab === 'LIST' ? endDate : matrixEndDate;
          await fetchData(s, e);
        }}
        className="px-2.5 py-2.5 space-y-2.5 pb-24"
      >
        {/* SUMMARY KPI STRIP — PRIORITY METRICS FIRST */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-slate-200/80 px-2.5 py-2 shadow-2xs">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              <span>Tổng giờ</span>
              <Clock size={12} className="text-[#DA251D]" />
            </div>
            <div className="text-base font-black text-[#DA251D] font-mono leading-tight mt-0.5 tabular-nums">
              {totalHours.toFixed(1)}h
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 px-2.5 py-2 shadow-2xs">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              <span>Ngày công</span>
              <CheckCircle2 size={12} className="text-emerald-600" />
            </div>
            <div className="text-base font-black text-slate-900 font-mono leading-tight mt-0.5 tabular-nums">
              {daysWorkedCount} ngày
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 px-2.5 py-2 shadow-2xs">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              <span>Vi phạm</span>
              <AlertTriangle size={12} className={violationCount > 0 ? 'text-rose-600' : 'text-emerald-500'} />
            </div>
            <div
              className={`text-base font-black font-mono leading-tight mt-0.5 tabular-nums ${
                violationCount > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {violationCount} lần
            </div>
          </div>
        </div>

        {/* FILTER CARD (ZERO-OVERFLOW ON MOBILE) */}
        {activeTab === 'LIST' ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 space-y-2 shadow-2xs overflow-hidden">
            {/* Row 1: Scrollable Quick Range Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {quickPresetButtons.map((btn) => {
                const isActive = datePreset === btn.key;
                return (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => applyQuickFilter(btn.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-red-50 text-[#DA251D] border border-red-200'
                        : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200/70'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            {/* Row 2: Strictly Non-Overflowing Date Pickers + Apply + Advanced Filter Toggle */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5 w-full">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="min-w-0 w-full h-8 px-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-800 outline-none focus:border-[#DA251D]"
                aria-label="Từ ngày"
              />
              <span className="text-slate-400 text-xs font-bold shrink-0">–</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="min-w-0 w-full h-8 px-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-800 outline-none focus:border-[#DA251D]"
                aria-label="Đến ngày"
              />
              <button
                type="button"
                onClick={() => fetchData(startDate, endDate)}
                className="h-8 px-3 rounded-lg bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white text-[11px] font-bold transition-all shrink-0 cursor-pointer"
              >
                Lọc
              </button>
            </div>

            {/* Row 3: Compact Advanced Filter Trigger */}
            <div className="flex items-center justify-between pt-0.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-[#DA251D] py-1 cursor-pointer"
              >
                <Filter size={13} className={activeAdvancedCount > 0 ? 'text-[#DA251D]' : 'text-slate-500'} />
                <span>Bộ lọc nâng cao</span>
                {activeAdvancedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#DA251D] text-white text-[10px] font-black">
                    {activeAdvancedCount}
                  </span>
                )}
                {showAdvancedFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              <span className="text-[11px] font-semibold text-slate-400">
                {filteredHistory.length}/{historyList.length} ca
              </span>
            </div>

            {/* Expanded Advanced Filter Panel */}
            {showAdvancedFilters && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                {/* Search shift/note */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên ca, chi nhánh, ghi chú..."
                    className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#DA251D]"
                  />
                </div>

                {/* Status filter chips */}
                <div className="flex flex-wrap gap-1.5">
                  {statusChips.map((chip) => {
                    const active = statusFilter === chip.key;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => setStatusFilter(chip.key)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>

                {/* Violation & Sort Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOnlyViolations((prev) => !prev)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                        onlyViolations
                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      <AlertTriangle size={12} />
                      <span>Chỉ xem vi phạm</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSortOrder((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'))}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <ArrowUpDown size={12} />
                      <span>{sortOrder === 'DESC' ? 'Mới nhất' : 'Cũ nhất'}</span>
                    </button>
                  </div>

                  {activeAdvancedCount > 0 && (
                    <button
                      type="button"
                      onClick={resetAdvancedFilters}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-[#DA251D] hover:bg-red-50 cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      <span>Đặt lại</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* MATRIX FILTER BAR */
          <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 space-y-2 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={() => shiftMatrixWeek(-1)}
                className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>Tuần trước</span>
              </button>

              <button
                type="button"
                onClick={() => shiftMatrixWeek(0)}
                className="h-8 px-3 rounded-lg bg-red-50 text-[#DA251D] border border-red-200 text-[11px] font-extrabold cursor-pointer"
              >
                Tuần hiện tại
              </button>

              <button
                type="button"
                onClick={() => shiftMatrixWeek(1)}
                className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Tuần sau</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5 w-full">
              <input
                type="date"
                value={matrixStartDate}
                onChange={(e) => setMatrixStartDate(e.target.value)}
                className="min-w-0 w-full h-8 px-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-800 outline-none focus:border-[#DA251D]"
                aria-label="Từ ngày ma trận"
              />
              <span className="text-slate-400 text-xs font-bold shrink-0">–</span>
              <input
                type="date"
                value={matrixEndDate}
                onChange={(e) => setMatrixEndDate(e.target.value)}
                className="min-w-0 w-full h-8 px-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-800 outline-none focus:border-[#DA251D]"
                aria-label="Đến ngày ma trận"
              />
              <button
                type="button"
                onClick={() => fetchData(matrixStartDate, matrixEndDate)}
                className="h-8 px-3 rounded-lg bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white text-[11px] font-bold transition-all shrink-0 cursor-pointer"
              >
                Áp dụng
              </button>
            </div>
          </div>
        )}

        {/* ERROR BANNER */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        {activeTab === 'LIST' ? (
          isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200/80 p-3 animate-pulse space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3.5 w-28 bg-slate-200 rounded" />
                    <div className="h-4 w-16 bg-slate-200 rounded-full" />
                  </div>
                  <div className="h-3 w-40 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : groupedHistory.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200/80 py-10 px-4 text-center">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Calendar size={20} />
              </div>
              <p className="text-xs font-bold text-slate-700">
                Không có dữ liệu chấm công phù hợp
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Thử thay đổi khoảng ngày hoặc bỏ bớt điều kiện lọc nâng cao.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {groupedHistory.map((group) => {
                const isExpanded = Boolean(expandedDates[group.dateKey]);
                const dayBadge = getDayBadgeConfig(group.items);
                const DayBadgeIcon = dayBadge.icon;

                return (
                  <div
                    key={group.dateKey}
                    className="bg-white rounded-xl border border-slate-200/85 p-3 shadow-2xs transition-all select-none"
                  >
                    {/* Collapsed 2-line Card Header (Tap to expand/collapse) */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleDateExpand(group.dateKey)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleDateExpand(group.dateKey);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {/* Line 1: Date + Total Hours + Aggregated Day Badge + Chevron */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Calendar size={13} className="text-[#DA251D] shrink-0" />
                          <span className="text-xs font-extrabold text-slate-900 truncate">
                            {formatViDateLabel(group.rawDate)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-red-50 text-[#DA251D] font-mono text-[11px] font-black tabular-nums shrink-0">
                            {group.totalHours.toFixed(1)} giờ
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${dayBadge.bg}`}
                          >
                            <DayBadgeIcon size={11} />
                            <span>{dayBadge.text}</span>
                          </span>
                          <div className="text-slate-400 p-0.5">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
                      </div>

                      {/* Line 2: Single-line truncated branchName at ~90% width */}
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 max-w-[90%] truncate">
                        <Building2 size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">
                          {group.branchNames || currentBranch?.name || 'Chi nhánh nhà hàng'}
                        </span>
                        {group.items.length > 1 && (
                          <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                            ({group.items.length} ca)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded: Per-shift breakdown */}
                    {isExpanded && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2 animate-in fade-in duration-150">
                        {group.items.map((item, idx) => {
                          const badge = getBadgeConfig(getEffectiveStatus(item));
                          const BadgeIcon = badge.icon;
                          return (
                            <div
                              key={item.id || idx}
                              className="bg-slate-50/80 rounded-lg p-2.5 space-y-1.5 border border-slate-100/90 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-extrabold text-slate-800 text-[11px]">
                                  {item.shiftName}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                                >
                                  <BadgeIcon size={10} />
                                  <span>{badge.text}</span>
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-2 font-mono text-slate-700">
                                  <span>
                                    Vào: <strong className="text-slate-900">{item.checkIn || '--:--'}</strong>
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <span>
                                    Ra: <strong className="text-slate-900">{item.checkOut || '--:--'}</strong>
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-[#DA251D]">
                                  {Number(item.hours || 0).toFixed(1)} giờ
                                </span>
                              </div>

                              {(item.branchName || item.notes) && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-1 border-t border-slate-200/50 text-[10px] text-slate-500">
                                  {item.branchName && (
                                    <span className="inline-flex items-center gap-1">
                                      <Building2 size={10} className="text-slate-400 shrink-0" />
                                      <span className="truncate">{item.branchName}</span>
                                    </span>
                                  )}
                                  {item.notes && <span className="italic text-slate-600">{item.notes}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* MATRIX VIEW */
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden w-full max-w-full">
            <div
              className="overflow-x-auto touch-pan-x overscroll-x-contain scroll-smooth no-scrollbar"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
            >
              <table className="min-w-[600px] w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="p-2.5 font-bold border-r border-slate-200 text-left min-w-[105px] w-[105px] sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                      Nhân viên
                    </th>
                    {matrixDays.map((d) => (
                      <th
                        key={d.isoDate}
                        className="p-2 font-bold min-w-[70px] border-r border-slate-200 last:border-r-0"
                      >
                        <div className="text-[10px] text-slate-500">{d.dayName}</div>
                        <div
                          className={`mt-0.5 px-2 py-0.5 rounded-lg inline-block font-mono text-[11px] ${
                            d.isToday ? 'bg-[#DA251D] text-white font-bold shadow-xs' : 'text-slate-700'
                          }`}
                        >
                          {d.dateShort}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  <tr className="border-b border-slate-100 last:border-b-0">
                    <td className="p-2.5 border-r border-slate-200 text-left align-top sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                      <div className="font-extrabold text-xs text-slate-900 truncate">
                        {currentUser?.fullName || 'Nhân viên'}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase mt-0.5 font-bold">
                        {currentUser?.role || 'STAFF'}
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-[#DA251D] border border-red-200 whitespace-nowrap">
                        {daysWorkedCount} ngày
                      </span>
                    </td>

                    {matrixDays.map((d) => {
                      const records = attByDate[d.isoDate] || [];

                      return (
                        <td
                          key={d.isoDate}
                          className={`p-1.5 border-r border-slate-200 last:border-r-0 align-top ${
                            d.isToday ? 'bg-red-50/25' : ''
                          }`}
                        >
                          {records.length === 0 ? (
                            <div className="h-14 flex items-center justify-center">
                              <div className="w-9 h-12 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-300 font-mono">
                                -
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 min-h-[56px]">
                              {records.map((r, idx) => {
                                const badge = getBadgeConfig(getEffectiveStatus(r));
                                return (
                                  <div
                                    key={r.id || idx}
                                    className={`rounded-lg p-1.5 text-[10px] text-left border ${badge.cellBorder}`}
                                  >
                                    <div className="font-bold text-slate-800 truncate">{r.shiftName}</div>
                                    <div className="font-mono text-[9px] text-slate-600 mt-0.5">
                                      {r.checkIn || '--:--'} - {r.checkOut || '--:--'}
                                    </div>
                                    <div className="text-[9px] font-black text-[#DA251D] font-mono mt-0.5">
                                      {Number(r.hours || 0).toFixed(1)}h
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
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
