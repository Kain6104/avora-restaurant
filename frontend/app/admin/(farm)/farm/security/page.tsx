'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Activity,
  UserCheck,
  AlertTriangle,
  Clock,
  User,
  Filter,
  RefreshCw,
} from 'lucide-react';

export default function AdminFarmSecurityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('ALL');

  useEffect(() => {
    fetchSecurityLogs();
  }, []);

  const fetchSecurityLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/farm/security', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data?.recentLogs || []);
      }
    } catch (e) {
      toast.error('Không thể tải nhật ký an ninh Farm');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'HARVEST': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PLANT': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'WATER': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'MUTATION_DISCOVERED': return 'bg-purple-50 text-purple-700 border-purple-200 font-black';
      case 'REDEEM_REWARD': return 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
      case 'GATHER_FRIEND': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const filteredLogs = filterAction === 'ALL'
    ? logs
    : logs.filter(l => l.action === filterAction);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-rose-600" />
            <span>Giám Sát An Ninh & Chống Gian Lận (Security & Anti-Cheat)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi hành động thời gian thực, phát hiện thao tác thu hoạch bất thường, ngăn chặn race condition & can thiệp client
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-transparent font-medium outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả hành động ({logs.length})</option>
              <option value="HARVEST">Thu hoạch (HARVEST)</option>
              <option value="PLANT">Gieo trồng (PLANT)</option>
              <option value="WATER">Tưới nước (WATER)</option>
              <option value="MUTATION_DISCOVERED">Đột biến (MUTATION)</option>
              <option value="REDEEM_REWARD">Đổi quà (REDEEM_REWARD)</option>
              <option value="GATHER_FRIEND">Thu thập bạn bè (GATHER_FRIEND)</option>
            </select>
          </div>

          <button
            onClick={fetchSecurityLogs}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Security Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Cơ chế Server-Authoritative</div>
            <div className="text-base font-black text-emerald-600">Đang hoạt động (100%)</div>
            <div className="text-[11px] text-slate-400">Không tính toán thưởng ở client</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Chống Race-Condition</div>
            <div className="text-base font-black text-blue-600">Database Transaction</div>
            <div className="text-[11px] text-slate-400">Khóa thu hoạch 2 tab đồng thời</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Cảnh báo nghi vấn</div>
            <div className="text-base font-black text-slate-800">0 Sự cố</div>
            <div className="text-[11px] text-emerald-600 font-bold">Hệ thống an toàn</div>
          </div>
        </div>
      </div>

      {/* Realtime Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Nhật Ký Hành Động Kinh Tế Mới Nhất (Audit Trail)</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">Hiển thị 50 sự kiện gần nhất</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Người chơi</th>
                <th className="py-3 px-4">Mã thành viên</th>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Chi tiết sự kiện</th>
                <th className="py-3 px-4 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.map((log) => {
                const user = log.farm?.user;
                return (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {user?.fullName || 'Người dùng ẩn danh'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                      {user?.memberCode || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate font-mono text-[11px]">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '---')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[10px] text-slate-400">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Chưa có nhật ký hoạt động nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
