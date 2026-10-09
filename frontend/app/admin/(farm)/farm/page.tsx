'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminFarmNav from './components/AdminFarmNav';
import {
  Sprout,
  Dna,
  Coins,
  Trophy,
  Search,
  TrendingUp,
  AlertTriangle,
  Gift,
  Users,
  CheckCircle2,
  Hammer,
  Power,
  Clock,
  Save,
} from 'lucide-react';

export default function AdminFarmDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedUser, setInspectedUser] = useState<any>(null);
  const [inspecting, setInspecting] = useState(false);

  // Maintenance Control State
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [maintenanceEnd, setMaintenanceEnd] = useState('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  useEffect(() => {
    fetchDashboard();
    fetchMaintenance();
  }, []);

  const fetchMaintenance = async () => {
    try {
      const res = await fetch('/api/admin/farm/maintenance', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setMaintenanceEnabled(!!json.data.enabled);
          setMaintenanceMsg(json.data.message || '');
          setMaintenanceEnd(json.data.estimatedEndTime || '');
        }
      }
    } catch (e) {
      console.warn('Could not fetch maintenance config:', e);
    }
  };

  const handleSaveMaintenance = async () => {
    try {
      setSavingMaintenance(true);
      const res = await fetch('/api/admin/farm/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: maintenanceEnabled,
          message: maintenanceMsg,
          estimatedEndTime: maintenanceEnd || null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          maintenanceEnabled
            ? 'ĐÃ BẬT Chế độ Bảo trì Farm (Khách hàng sẽ bị chặn)'
            : 'ĐÃ TẮT Bảo trì Farm (Khách hàng có thể vào bình thường)'
        );
      } else {
        toast.error(json.message || 'Không thể lưu cài đặt bảo trì');
      }
    } catch (err) {
      toast.error('Lỗi khi lưu cài đặt bảo trì');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/farm/dashboard', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (e) {
      toast.error('Không thể tải dữ liệu Dashboard Farm');
    } finally {
      setLoading(false);
    }
  };

  const handleInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setInspecting(true);
      const res = await fetch(`/api/admin/farm/inspect/${encodeURIComponent(searchQuery.trim())}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setInspectedUser(json.data);
      } else {
        toast.error(json.message || 'Không tìm thấy người dùng này');
        setInspectedUser(null);
      }
    } catch (err) {
      toast.error('Lỗi tra cứu người dùng');
    } finally {
      setInspecting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <AdminFarmNav />

      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Sprout className="w-7 h-7 text-emerald-600" />
            <span>AVORA Farm Command Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Trung tâm giám sát, cân bằng kinh tế và quản trị mini-game loyalty AVORA
          </p>
        </div>

        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs hover:bg-slate-50 transition cursor-pointer self-start sm:self-auto"
        >
          Làm mới dữ liệu
        </button>
      </div>

      {/* Maintenance Control Banner */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          maintenanceEnabled
            ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
            : 'bg-white border-slate-200 shadow-2xs'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                maintenanceEnabled
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-800">
                  Chế Độ Bảo Trì Nông Trại (Maintenance Mode)
                </h3>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    maintenanceEnabled
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {maintenanceEnabled ? 'ĐANG BẢO TRÌ' : 'HOẠT ĐỘNG BÌNH THƯỜNG'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Khi kích hoạt, mọi người chơi thông thường khi vào /farm sẽ thấy màn hình bảo trì và toàn bộ API sửa đổi trang trại sẽ bị chặn từ server.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-center">
            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => setMaintenanceEnabled(!maintenanceEnabled)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                maintenanceEnabled ? 'bg-amber-500' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  maintenanceEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs font-bold text-slate-700">
              {maintenanceEnabled ? 'Bật' : 'Tắt'}
            </span>
          </div>
        </div>

        {/* Maintenance Message & Estimated End Time Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Thông điệp thông báo bảo trì</label>
            <input
              type="text"
              value={maintenanceMsg}
              onChange={(e) => setMaintenanceMsg(e.target.value)}
              placeholder="VD: Khu vườn AVORA Farm đang được các nghệ nhân chăm sóc nâng cấp định kỳ..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Thời gian dự kiến mở lại (Tùy chọn)</label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={maintenanceEnd ? maintenanceEnd.slice(0, 16) : ''}
                onChange={(e) => setMaintenanceEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-amber-500 outline-none font-mono text-[11px]"
              />
              <button
                type="button"
                disabled={savingMaintenance}
                onClick={handleSaveMaintenance}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold">Tổng Nông Trại</span>
            <h3 className="text-2xl font-black text-slate-800 mt-0.5">{data?.totalFarms || 0}</h3>
            <span className="text-[11px] text-slate-400">Cấp độ TB: Lv.{data?.averageFarmLevel}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Dna className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold">Đột Biến Phát Hiện</span>
            <h3 className="text-2xl font-black text-slate-800 mt-0.5">{data?.totalMutations || 0}</h3>
            <span className="text-[11px] text-purple-600 font-bold">
              Tỷ lệ đột biến: {data?.mutationRatePercent}%
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold">Coin Đang Lưu Hành</span>
            <h3 className="text-2xl font-black text-amber-600 mt-0.5">
              {(data?.totalCoinsCirculating || 0).toLocaleString('vi-VN')}
            </h3>
            <span className="text-[11px] text-slate-400">Tiền tệ nội bộ Farm</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold">Voucher Đã Đổi</span>
            <h3 className="text-2xl font-black text-rose-600 mt-0.5">{data?.totalRedemptions || 0}</h3>
            <span className="text-[11px] text-slate-400">Đổi qua Reward Shop</span>
          </div>
        </div>
      </div>

      {/* 2. Farm Inspector Search */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500" />
          <span>Tra Cứu Nông Trại Khách Hàng (Farm Inspector)</span>
        </h3>

        <form onSubmit={handleInspect} className="flex gap-2 max-w-lg">
          <input
            type="text"
            placeholder="Nhập Email, SĐT, Mã thành viên hoặc User ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={inspecting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            {inspecting ? 'Đang tìm...' : 'Tra Cứu'}
          </button>
        </form>

        {inspectedUser && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <span className="font-extrabold text-sm text-slate-800">
                  {inspectedUser.fullName} ({inspectedUser.email})
                </span>
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-md text-[10px]">
                  {inspectedUser.memberCode || 'No Code'}
                </span>
              </div>
              <span className="font-bold text-emerald-700">
                Nông trại Lv.{inspectedUser.userFarm?.level} • {inspectedUser.userFarm?.farmCoin} Coin •{' '}
                {inspectedUser.points} Điểm AVORA
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600">
              <div>
                <span className="text-slate-400 block">Số ô đất mở khóa:</span>
                <span className="font-black text-slate-800">
                  {inspectedUser.userFarm?.unlockedPlotsCount}/25 ô
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Cấp Cây AVORA Tree:</span>
                <span className="font-black text-slate-800">
                  Cấp {inspectedUser.userFarm?.treeLevel} ({inspectedUser.userFarm?.treeExp} XP)
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Mẫu vật bộ sưu tập:</span>
                <span className="font-black text-slate-800">
                  {inspectedUser.userFarm?.collections?.length || 0} loài
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Vật phẩm trong kho:</span>
                <span className="font-black text-slate-800">
                  {inspectedUser.userFarm?.inventory?.length || 0} loại
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Tables: Top Crops & Recent Redemptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Crops */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Cây Trồng Phổ Biến Nhất</span>
          </h3>

          <div className="divide-y divide-slate-100 text-xs">
            {data?.topCrops?.map((crop: any) => (
              <div key={crop.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{crop.name}</span>
                  <span className="text-[10px] ml-2 px-1.5 py-0.2 bg-slate-100 text-slate-600 font-semibold rounded-md">
                    {crop.category}
                  </span>
                </div>
                <span className="font-extrabold text-emerald-600">
                  {crop._count?.instances || 0} lượt trồng
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Redemptions */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <Gift className="w-4 h-4 text-rose-600" />
            <span>Lịch Sử Đổi Thưởng Gần Đây</span>
          </h3>

          <div className="divide-y divide-slate-100 text-xs">
            {data?.recentRedemptions?.length === 0 ? (
              <div className="py-6 text-center text-slate-400">Chưa có lượt đổi thưởng nào</div>
            ) : (
              data?.recentRedemptions?.map((r: any) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">{r.reward?.title}</span>
                    <span className="text-slate-400 block text-[11px]">
                      {r.farm?.user?.fullName} ({r.farm?.user?.memberCode || 'Khách'})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-rose-600 font-bold block">
                      {r.loyaltyPointsSpent > 0 ? `-${r.loyaltyPointsSpent} Điểm` : `-${r.farmCoinSpent} Coin`}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(r.createdAt).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
