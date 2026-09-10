'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  CalendarCheck,
  Users,
  TrendingUp,
  XCircle,
  UserX,
  Clock,
  Globe,
  ChevronLeft,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAdmin } from '@/contexts/AdminContext';

const SOURCE_COLORS: Record<string, string> = {
  WEB: '#3b82f6',
  CHATBOT: '#10b981',
  VOICE: '#f59e0b',
  WALK_IN: '#8b5cf6',
  ADMIN: '#64748b',
};

const SOURCE_LABELS: Record<string, string> = {
  WEB: 'Website Khách',
  CHATBOT: 'Chatbot AI',
  VOICE: 'Voice Call AI',
  WALK_IN: 'Khách Tại Quầy',
  ADMIN: 'Nhân Viên Đặt',
};

export default function ReservationAnalyticsPage() {
  const { availableBranches, user } = useAdmin();
  const branches = availableBranches || [];

  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    if (user?.role !== 'ADMIN' && user?.branchId) {
      setSelectedBranchId(user.branchId);
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        params.append('branchId', selectedBranchId);
      }
      params.append('days', days.toString());

      const res = await fetch(`/api/admin/reservations/analytics?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json?.data || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedBranchId, days]);

  // Hourly Peak Chart Data
  const hourlyData = React.useMemo(() => {
    if (!analytics?.peakHours) return [];
    const hours = [
      '10:00', '11:00', '12:00', '13:00', '14:00',
      '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
    ];
    return hours.map((h) => ({
      hour: h,
      bookings: analytics.peakHours[h] || 0,
    }));
  }, [analytics]);

  // Source Pie Chart Data
  const sourceData = React.useMemo(() => {
    if (!analytics?.sourceBreakdown) return [];
    return Object.keys(analytics.sourceBreakdown).map((k) => ({
      name: SOURCE_LABELS[k] || k,
      value: analytics.sourceBreakdown[k],
      color: SOURCE_COLORS[k] || '#94a3b8',
    })).filter((d) => d.value > 0);
  }, [analytics]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/reservations"
              className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Quay lại Quản lý đặt bàn</span>
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-red-600" />
            <span>Báo Cáo & Phân Tích Đặt Bàn</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Số liệu thống kê thực tế từ hệ thống đặt bàn AVORA Restaurant (Không dùng dữ liệu ảo)
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          {user?.role === 'ADMIN' && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:outline-none"
            >
              <option value="ALL">Tất cả chi nhánh</option>
              {branches.map((b: { id: string; name: string }) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:outline-none"
          >
            <option value="7">7 ngày qua</option>
            <option value="14">14 ngày qua</option>
            <option value="30">30 ngày qua</option>
            <option value="90">90 ngày qua</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-red-600" />
          <span className="text-xs">Đang tổng hợp số liệu thực tế...</span>
        </div>
      ) : !analytics ? (
        <div className="py-20 text-center text-slate-400">
          <span className="text-xs">Chưa có dữ liệu trong khoảng thời gian này</span>
        </div>
      ) : (
        <>
          {/* Main KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[11px] text-slate-400 font-semibold block">Tổng Lượt Đặt</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {analytics.totalBookings}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{days} ngày qua</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[11px] text-slate-400 font-semibold block">Tổng Số Khách</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {analytics.totalGuests}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                TB {analytics.avgPartySize} khách/bàn
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[11px] text-emerald-700 font-semibold block">Tỷ Lệ Thành Công</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {analytics.conversionRate}%
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{analytics.completed} lượt hoàn tất</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[11px] text-rose-700 font-semibold block">Tỷ Lệ Hủy Bàn</span>
              <span className="text-2xl font-black text-rose-600 mt-1 block">
                {analytics.cancellationRate}%
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{analytics.cancelled} lượt hủy</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[11px] text-red-700 font-semibold block">Tỷ Lệ Vắng Mặt</span>
              <span className="text-2xl font-black text-red-700 mt-1 block">
                {analytics.noShowRate}%
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{analytics.noShow} lượt no-show</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[11px] text-purple-700 font-semibold block">Đang Phục Vụ</span>
              <span className="text-2xl font-black text-purple-700 mt-1 block">
                {analytics.seatedOrCheckedIn}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Đã check-in / dùng bữa</span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Peak Hours Hourly Chart */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-red-600" />
                    <span>Khung Giờ Cao Điểm (Peak Hours)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Phân bổ số lượt đặt bàn theo khung giờ trong ngày</p>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                      formatter={(val: any) => [`${val} lượt đặt`, 'Số lượng']}
                    />
                    <Bar dataKey="bookings" fill="#da251d" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Source Distribution */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>Nguồn Đặt Bàn (Source)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mb-4">Tỷ lệ đặt qua Web, Chatbot, Voice AI, Quầy</p>

                {sourceData.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">Chưa có dữ liệu nguồn</div>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sourceData}
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {sourceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Source Legends */}
              <div className="space-y-1.5 pt-3 border-t border-slate-100">
                {sourceData.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <strong className="text-slate-800">{s.value} lượt</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
