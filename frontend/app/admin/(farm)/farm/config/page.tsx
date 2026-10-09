'use client';

import React, { useState, useEffect } from 'react';
import AdminFarmNav from '../components/AdminFarmNav';
import {
  Sliders,
  Shield,
  Clock,
  Coins,
  Zap,
  Hammer,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminFarmConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState({
    strangerDailyStealLimit: 3,
    friendDailyStealLimit: 10,
    protectionWindowMinutes: 15,
    coinsToPointsRatio: 2,
    maxEnergy: 100,
    maintenanceMode: false,
    maintenanceMessage:
      'Khu vườn AVORA Farm đang được các nghệ nhân chăm sóc nâng cấp định kỳ. Quý khách vui lòng trở lại sau!',
    estimatedEndTime: '',
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const [configRes, maintRes] = await Promise.all([
        fetch('/api/admin/farm/config', { credentials: 'include' }),
        fetch('/api/admin/farm/maintenance', { credentials: 'include' }),
      ]);

      const newCfg: any = {};
      if (configRes.ok) {
        const json = await configRes.json();
        if (json.data) Object.assign(newCfg, json.data);
      }

      if (maintRes.ok) {
        const json = await maintRes.json();
        if (json.data) {
          newCfg.maintenanceMode = !!json.data.enabled;
          if (json.data.message) newCfg.maintenanceMessage = json.data.message;
          if (json.data.estimatedEndTime) newCfg.estimatedEndTime = json.data.estimatedEndTime;
        }
      }

      setConfig((prev) => ({ ...prev, ...newCfg }));
    } catch (e) {
      toast.error('Không thể tải cấu hình game farm');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const [configRes, maintRes] = await Promise.all([
        fetch('/api/admin/farm/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            strangerDailyStealLimit: Number(config.strangerDailyStealLimit),
            friendDailyStealLimit: Number(config.friendDailyStealLimit),
            protectionWindowMinutes: Number(config.protectionWindowMinutes),
            coinsToPointsRatio: Number(config.coinsToPointsRatio),
            maxEnergy: Number(config.maxEnergy),
          }),
        }),
        fetch('/api/admin/farm/maintenance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            enabled: config.maintenanceMode,
            message: config.maintenanceMessage,
            estimatedEndTime: config.estimatedEndTime || null,
          }),
        }),
      ]);

      if (configRes.ok && maintRes.ok) {
        toast.success('Đã lưu toàn bộ cấu hình hệ thống Game Farm thành công!');
      } else {
        toast.error('Lỗi khi lưu cấu hình');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (!confirm('Đặt lại tất cả thông số về mặc định ban đầu?')) return;
    setConfig({
      strangerDailyStealLimit: 3,
      friendDailyStealLimit: 10,
      protectionWindowMinutes: 15,
      coinsToPointsRatio: 2,
      maxEnergy: 100,
      maintenanceMode: false,
      maintenanceMessage:
        'Khu vườn AVORA Farm đang được các nghệ nhân chăm sóc nâng cấp định kỳ. Quý khách vui lòng trở lại sau!',
      estimatedEndTime: '',
    });
    toast.success('Đã nạp thông số mặc định. Hãy bấm "Lưu Cấu Hình" để áp dụng.');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Subnav */}
      <AdminFarmNav />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-amber-600" />
            <span>Cấu Hình Vận Hành Toàn Diện Game Farm</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Điều chỉnh hạn mức tương tác cộng đồng, thời gian bảo vệ nông sản, tỷ lệ quy đổi điểm và chế độ bảo trì
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc Định</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : 'Lưu Cấu Hình Game'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-16 text-center text-xs font-bold text-gray-400 rounded-2xl border">
          Đang tải cấu hình hệ thống...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Social & Stealing Limits */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">Tương Tác Xã Hội & Hái Trộm Nông Sản</h3>
                <p className="text-[11px] text-gray-500">
                  Quy định số lượt hái trộm may mắn mỗi ngày giữa bạn bè và người lạ
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Hạn Mức Trộm Người Lạ (Lượt / Ngày)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={config.strangerDailyStealLimit}
                    onChange={(e) =>
                      setConfig({ ...config, strangerDailyStealLimit: parseInt(e.target.value) || 0 })
                    }
                    className="w-32 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[11px] text-gray-500">Mặc định: 3 lượt/ngày</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Hạn Mức Trộm Bạn Bè Đã Kết Nối (Lượt / Ngày)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.friendDailyStealLimit}
                    onChange={(e) =>
                      setConfig({ ...config, friendDailyStealLimit: parseInt(e.target.value) || 0 })
                    }
                    className="w-32 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[11px] text-gray-500">Mặc định: 10 lượt/ngày</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Cửa Sổ Bảo Vệ Cây Vừa Chín (Phút)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={config.protectionWindowMinutes}
                    onChange={(e) =>
                      setConfig({ ...config, protectionWindowMinutes: parseInt(e.target.value) || 0 })
                    }
                    className="w-32 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[11px] text-gray-500">
                    Trong thời gian này, chỉ chủ trại mới được thu hoạch (Mặc định: 15 phút)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Economy & Conversion */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">Kinh Tế & Tỷ Lệ Đổi Điểm Loyalty</h3>
                <p className="text-[11px] text-gray-500">
                  Tỷ lệ quy đổi Xu nông trại sang Điểm thành viên AVORA và cơ chế thể lực
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Tỷ Lệ Đổi Xu Sang Điểm AVORA (Xu / 1 Điểm)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={config.coinsToPointsRatio}
                    onChange={(e) =>
                      setConfig({ ...config, coinsToPointsRatio: parseInt(e.target.value) || 1 })
                    }
                    className="w-32 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[11px] text-gray-500">
                    Ví dụ: 2 Xu = 1 Điểm Loyalty (100 Xu = 50 Điểm)
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Năng Lượng Tối Đa (Max Energy)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="50"
                    max="500"
                    value={config.maxEnergy}
                    onChange={(e) => setConfig({ ...config, maxEnergy: parseInt(e.target.value) || 100 })}
                    className="w-32 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[11px] text-gray-500">Mặc định: 100⚡</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Các thay đổi về tỷ lệ đổi điểm và hạn mức hái trộm sẽ có hiệu lực tức thời đối với toàn bộ người chơi khi lưu.
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Maintenance Mode */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2 border-b pb-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-800">
                <Hammer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">Bảo Trì Toàn Diện Game Farm</h3>
                <p className="text-[11px] text-gray-500">
                  Khi kích hoạt, toàn bộ khách hàng truy cập /farm sẽ thấy màn hình thông báo bảo trì
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    config.maintenanceMode ? 'bg-rose-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      config.maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="font-bold text-gray-900">
                  {config.maintenanceMode
                    ? '🚨 Chế độ bảo trì ĐANG BẬT (Khách hàng không thể vào farm)'
                    : '✅ Chế độ bảo trì ĐANG TẮT (Hoạt động bình thường)'}
                </span>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Thông Điệp Bảo Trì Cho Người Dùng
                </label>
                <textarea
                  rows={2}
                  value={config.maintenanceMessage}
                  onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Thời Gian Kết Thúc Dự Kiến (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 22:00 ngày 13/09/2026"
                  value={config.estimatedEndTime}
                  onChange={(e) => setConfig({ ...config, estimatedEndTime: e.target.value })}
                  className="w-full sm:w-72 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
