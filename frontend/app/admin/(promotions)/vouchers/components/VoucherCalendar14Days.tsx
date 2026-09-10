'use client';

import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Flame, 
  Sparkles, 
  TrendingUp, 
  Ticket, 
  DollarSign, 
  Award,
  ChevronRight,
  Info,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export interface TimelineDay {
  date: string;
  dayOfWeek?: number;
  dayLabel?: string;
  usageCount: number;
  discountTotal: number;
  revenueTotal: number;
  isPeak?: boolean;
}

interface VoucherCalendar14DaysProps {
  timelineDays: TimelineDay[];
  onSelectDay?: (day: TimelineDay) => void;
}

export default function VoucherCalendar14Days({ timelineDays, onSelectDay }: VoucherCalendar14DaysProps) {
  const [selectedDay, setSelectedDay] = useState<TimelineDay | null>(null);

  if (!timelineDays || timelineDays.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-slate-400">
        <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Chưa có dữ liệu thống kê 14 ngày.</p>
      </div>
    );
  }

  // Calculate statistics
  const maxUsage = Math.max(...timelineDays.map(d => d.usageCount), 1);
  const maxRevenue = Math.max(...timelineDays.map(d => d.revenueTotal), 1);
  const total14DaysUsage = timelineDays.reduce((acc, d) => acc + d.usageCount, 0);
  const total14DaysRevenue = timelineDays.reduce((acc, d) => acc + d.revenueTotal, 0);
  const total14DaysDiscount = timelineDays.reduce((acc, d) => acc + d.discountTotal, 0);
  const avgDailyUsage = (total14DaysUsage / timelineDays.length).toFixed(1);
  const avgDailyRevenue = Math.round(total14DaysRevenue / timelineDays.length);

  // Peak day
  const peakDay = timelineDays.reduce((prev, curr) => (curr.usageCount > prev.usageCount ? curr : prev), timelineDays[0]);

  // Today string YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // Vietnamese day names mapper
  const getFullDayName = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const map = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return map[day];
  };

  const formatDateDisplay = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  const handleDayClick = (day: TimelineDay) => {
    setSelectedDay(selectedDay?.date === day.date ? null : day);
    if (onSelectDay) onSelectDay(day);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-6">
      
      {/* 1. Header & Quick Insights */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-black">
              <CalendarIcon size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Lịch Sử Dụng Voucher 14 Ngày Gần Nhất</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles size={11} />
                  Thời gian thực
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Theo dõi tần suất áp dụng, doanh thu kích cầu và hiệu suất từng ngày theo chu kỳ 2 tuần.
              </p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          <span className="text-slate-400 font-normal">Mật độ:</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-200" />
            0 lượt
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-300" />
            1-3
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            4-9
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            10+ lượt
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            Đỉnh điểm
          </span>
        </div>
      </div>

      {/* 2. CALENDAR 14-DAY GRID (2 WEEKS) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {timelineDays.map((day) => {
          const isToday = day.date === todayStr;
          const isSelected = selectedDay?.date === day.date;
          const isPeak = day.isPeak || (peakDay && peakDay.usageCount > 0 && day.date === peakDay.date);
          const ratio = day.usageCount / maxUsage;
          const dayName = getFullDayName(day.date);
          const formattedDate = formatDateDisplay(day.date);

          // Card Background and border styling based on usage intensity
          let cardBg = 'bg-slate-50/70 hover:bg-slate-100/90 border-slate-200/80 text-slate-700';
          let badgeBg = 'bg-slate-200/70 text-slate-600';
          let barBg = 'bg-slate-300';

          if (day.usageCount > 0) {
            if (isPeak) {
              cardBg = 'bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-amber-500/5 hover:from-amber-500/20 border-amber-300 shadow-xs shadow-amber-100';
              badgeBg = 'bg-amber-500 text-white shadow-xs';
              barBg = 'bg-gradient-to-r from-amber-500 to-rose-500';
            } else if (day.usageCount >= 10) {
              cardBg = 'bg-amber-50/80 hover:bg-amber-100/80 border-amber-200';
              badgeBg = 'bg-amber-100 text-amber-800 font-bold';
              barBg = 'bg-amber-500';
            } else if (day.usageCount >= 4) {
              cardBg = 'bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-200';
              badgeBg = 'bg-emerald-100 text-emerald-800 font-bold';
              barBg = 'bg-emerald-500';
            } else {
              cardBg = 'bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-100/80';
              badgeBg = 'bg-emerald-100/70 text-emerald-700 font-medium';
              barBg = 'bg-emerald-400';
            }
          }

          if (isSelected) {
            cardBg += ' ring-2 ring-red-500 ring-offset-2 scale-[1.02] shadow-md z-10';
          }

          return (
            <div
              key={day.date}
              onClick={() => handleDayClick(day)}
              className={`relative rounded-2xl p-3.5 border transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[140px] group ${cardBg}`}
            >
              {/* Header: Day Name + Date + Peak/Today Pill */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {dayName}
                  </span>
                  
                  {isToday ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                      Hôm nay
                    </span>
                  ) : isPeak && day.usageCount > 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white shadow-2xs">
                      <Award size={10} />
                      Đỉnh
                    </span>
                  ) : null}
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-base font-black text-slate-900 tracking-tight">
                    {formattedDate}
                  </span>
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${badgeBg}`}>
                    {day.usageCount} lượt
                  </span>
                </div>
              </div>

              {/* Financial Metrics */}
              <div className="my-2 space-y-1">
                {day.revenueTotal > 0 ? (
                  <div className="text-[11px] font-bold text-emerald-700 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-normal">Doanh thu:</span>
                    <span>+{Math.round(day.revenueTotal / 1000).toLocaleString('vi-VN')}K</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 italic">Chưa có doanh thu</div>
                )}

                {day.discountTotal > 0 && (
                  <div className="text-[10px] font-semibold text-rose-600 flex items-center justify-between">
                    <span className="text-slate-400 font-normal">Giảm giá:</span>
                    <span>-{Math.round(day.discountTotal / 1000).toLocaleString('vi-VN')}K</span>
                  </div>
                )}
              </div>

              {/* Bottom Visual Bar relative to peak */}
              <div>
                <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${barBg}`}
                    style={{ width: `${Math.max(ratio * 100, day.usageCount > 0 ? 10 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. SELECTED DAY DETAIL DRAWER / INSPECTION CARD */}
      {selectedDay && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center font-black text-amber-400 border border-white/15 shadow-inner">
                <Ticket size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">
                    Chi Tiết Ngày: {getFullDayName(selectedDay.date)}, {selectedDay.date}
                  </h3>
                  {selectedDay.date === todayStr && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
                      Hôm nay
                    </span>
                  )}
                  {selectedDay.isPeak && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 flex items-center gap-1">
                      <Award size={12} />
                      Ngày cao điểm nhất
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Tổng hợp hiệu suất phát sinh đơn hàng áp dụng voucher trong ngày này.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors self-start sm:self-auto cursor-pointer"
            >
              Đóng chi tiết
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[11px] text-slate-400 font-medium">Lượt sử dụng voucher</p>
              <p className="text-xl font-black text-amber-400 mt-0.5">{selectedDay.usageCount} lượt</p>
              <p className="text-[10px] text-slate-400 mt-1">Chiếm {total14DaysUsage > 0 ? Math.round((selectedDay.usageCount / total14DaysUsage) * 100) : 0}% chu kỳ 14 ngày</p>
            </div>

            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[11px] text-slate-400 font-medium">Doanh thu kích cầu (GMV)</p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">
                {selectedDay.revenueTotal.toLocaleString('vi-VN')} ₫
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Đơn hàng thực tế khách đã trả</p>
            </div>

            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[11px] text-slate-400 font-medium">Ngân sách chiết khấu tài trợ</p>
              <p className="text-xl font-black text-rose-400 mt-0.5">
                {selectedDay.discountTotal.toLocaleString('vi-VN')} ₫
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Tổng tiền món & phí ship đã giảm</p>
            </div>

            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[11px] text-slate-400 font-medium">Hiệu suất ROI Doanh thu / Giảm giá</p>
              <p className="text-xl font-black text-cyan-300 mt-0.5">
                {selectedDay.discountTotal > 0
                  ? `${(selectedDay.revenueTotal / selectedDay.discountTotal).toFixed(1)}x`
                  : (selectedDay.revenueTotal > 0 ? 'Tối đa' : '0x')}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Thu về trên mỗi 1đ chiết khấu</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUMMARY STATS RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
            <Flame size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold">Ngày bùng nổ nhất</p>
            <p className="text-sm font-black text-slate-900">
              {peakDay ? `${formatDateDisplay(peakDay.date)} (${peakDay.usageCount} lượt)` : 'Chưa có'}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold">Trung bình lượt dùng/ngày</p>
            <p className="text-sm font-black text-slate-900">{avgDailyUsage} lượt/ngày</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold">Doanh thu TB/ngày</p>
            <p className="text-sm font-black text-slate-900">
              {avgDailyRevenue.toLocaleString('vi-VN')} ₫
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold">Tổng 14 ngày kích cầu</p>
            <p className="text-sm font-black text-slate-900">
              {total14DaysRevenue.toLocaleString('vi-VN')} ₫
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
