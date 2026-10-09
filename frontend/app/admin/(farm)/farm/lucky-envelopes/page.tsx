'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AdminFarmNav from '../components/AdminFarmNav';
import {
  Gift,
  Coins,
  Sparkles,
  Award,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  Save,
  RotateCcw,
  Sliders,
  History,
  TrendingUp,
  Percent,
  Layers,
  X,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LuckyConfig {
  isEventActive: boolean;
  allowExistingTicketsToOpen: boolean;
  maxVisibleEnvelopes: number;
  ticketsPerMission: number;
}

interface LuckyReward {
  id: string;
  name: string;
  description?: string | null;
  rewardType: string;
  referenceId?: string | null;
  minAmount: number;
  maxAmount: number;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
  weight: number;
  probabilityPercent: number;
  imageUrl?: string | null;
  isActive: boolean;
  globalStock?: number | null;
  claimedStock: number;
  perUserLimit?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface AnalyticsData {
  totalTicketsEarned: number;
  totalOpened: number;
  totalTicketsUnused: number;
  totalCoinDistributed: number;
  rarityBreakdown: Record<string, number>;
  topRewards: { name: string; rarity: string; count: number }[];
}

export default function LuckyEnvelopesAdminPage() {
  const [activeTab, setActiveTab] = useState<'rewards' | 'history'>('rewards');
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // Config State
  const [config, setConfig] = useState<LuckyConfig>({
    isEventActive: true,
    allowExistingTicketsToOpen: true,
    maxVisibleEnvelopes: 8,
    ticketsPerMission: 1,
  });

  // Rewards State
  const [rewards, setRewards] = useState<LuckyReward[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // History State
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);

  // Reward Modal (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<LuckyReward | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    rewardType: string;
    referenceId: string;
    minAmount: number;
    maxAmount: number;
    rarity: string;
    weight: number | string;
    imageUrl: string;
    isActive: boolean;
    globalStock: string;
    perUserLimit: string;
  }>({
    name: '',
    description: '',
    rewardType: 'COIN',
    referenceId: '',
    minAmount: 100,
    maxAmount: 200,
    rarity: 'COMMON',
    weight: 50,
    imageUrl: '',
    isActive: true,
    globalStock: '',
    perUserLimit: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [cfgRes, rwdRes, anaRes] = await Promise.all([
        fetch('/api/admin/farm/lucky-envelope/config', { credentials: 'include' }),
        fetch('/api/admin/farm/lucky-envelope/rewards', { credentials: 'include' }),
        fetch('/api/admin/farm/lucky-envelope/analytics', { credentials: 'include' }),
      ]);

      if (cfgRes.ok) {
        const json = await cfgRes.json();
        if (json.data) setConfig(json.data);
      }

      if (rwdRes.ok) {
        const json = await rwdRes.json();
        if (json.data) setRewards(json.data);
      }

      if (anaRes.ok) {
        const json = await anaRes.json();
        if (json.data) setAnalytics(json.data);
      }
    } catch (e) {
      toast.error('Lỗi khi tải dữ liệu cấu hình lì xì');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (page: number = 1) => {
    try {
      const res = await fetch(`/api/admin/farm/lucky-envelope/history?page=${page}&limit=15`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setHistoryItems(json.data.items || []);
          setHistoryPage(json.data.pagination.page);
          setHistoryTotalPages(json.data.pagination.totalPages);
          setHistoryTotalCount(json.data.pagination.total);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory(historyPage);
    }
  }, [activeTab, historyPage, fetchHistory]);

  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      const res = await fetch('/api/admin/farm/lucky-envelope/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Đã cập nhật cấu hình Sự Kiện Lì Xì thành công!');
        setConfig(json.data);
      } else {
        toast.error(json.message || 'Lỗi khi lưu cấu hình');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi lưu cấu hình');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleRewardActive = async (reward: LuckyReward) => {
    try {
      const updatedActive = !reward.isActive;
      const res = await fetch(`/api/admin/farm/lucky-envelope/rewards/${reward.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: updatedActive }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Đã ${updatedActive ? 'bật' : 'tắt'} phần thưởng "${reward.name}"`);
        fetchData();
      } else {
        toast.error(json.message || 'Không thể cập nhật');
      }
    } catch (e) {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

  const handleOpenAddModal = () => {
    setEditingReward(null);
    setFormData({
      name: '',
      description: '',
      rewardType: 'COIN',
      referenceId: '',
      minAmount: 100,
      maxAmount: 200,
      rarity: 'COMMON',
      weight: 50,
      imageUrl: '/game/farm/items/coin.png',
      isActive: true,
      globalStock: '',
      perUserLimit: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (reward: LuckyReward) => {
    setEditingReward(reward);
    setFormData({
      name: reward.name,
      description: reward.description || '',
      rewardType: reward.rewardType,
      referenceId: reward.referenceId || '',
      minAmount: reward.minAmount,
      maxAmount: reward.maxAmount,
      rarity: reward.rarity,
      weight: reward.weight,
      imageUrl: reward.imageUrl || '',
      isActive: reward.isActive,
      globalStock: reward.globalStock !== null && reward.globalStock !== undefined ? String(reward.globalStock) : '',
      perUserLimit: reward.perUserLimit !== null && reward.perUserLimit !== undefined ? String(reward.perUserLimit) : '',
    });
    setIsModalOpen(true);
  };

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên phần thưởng');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      rewardType: formData.rewardType,
      referenceId: formData.referenceId.trim() || undefined,
      minAmount: Number(formData.minAmount),
      maxAmount: Number(formData.maxAmount),
      rarity: formData.rarity,
      weight: Number(formData.weight),
      imageUrl: formData.imageUrl.trim() || undefined,
      isActive: formData.isActive,
      globalStock: formData.globalStock !== '' ? Number(formData.globalStock) : null,
      perUserLimit: formData.perUserLimit !== '' ? Number(formData.perUserLimit) : null,
    };

    try {
      let res;
      if (editingReward) {
        res = await fetch(`/api/admin/farm/lucky-envelope/rewards/${editingReward.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/admin/farm/lucky-envelope/rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(editingReward ? 'Đã sửa phần thưởng thành công' : 'Đã thêm phần thưởng mới vào Pool');
        setIsModalOpen(false);
        fetchData();
      } else {
        toast.error(json.message || 'Lỗi khi lưu phần thưởng');
      }
    } catch (e) {
      toast.error('Lỗi mạng khi lưu phần thưởng');
    }
  };

  const handleDeleteReward = async (reward: LuckyReward) => {
    if (!confirm(`Bạn có chắc muốn xóa hoặc vô hiệu hóa phần thưởng "${reward.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/farm/lucky-envelope/rewards/${reward.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Đã xóa/vô hiệu hóa "${reward.name}"`);
        fetchData();
      } else {
        toast.error(json.message || 'Không thể xóa phần thưởng');
      }
    } catch (e) {
      toast.error('Lỗi khi xóa phần thưởng');
    }
  };

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'LEGENDARY':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-300">HUYỀN THOẠI</span>;
      case 'EPIC':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">SỬ THI</span>;
      case 'RARE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-300">QUÝ HIẾM</span>;
      case 'UNCOMMON':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-300">ĐẶC BIỆT</span>;
      case 'COMMON':
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">PHỔ THÔNG</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <AdminFarmNav />

      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-red-900 via-red-800 to-amber-900 rounded-3xl p-6 text-white shadow-md border border-amber-400/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🧧</span>
            <h1 className="text-2xl font-serif font-black tracking-wide text-amber-200">
              QUẢN TRỊ BAO LÌ XÌ MAY MẮN
            </h1>
          </div>
          <p className="text-sm text-amber-100/80">
            Cấu hình tỷ lệ Weighted Random, kiểm soát kho quà Cây Thần và Master Switch an toàn
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. MASTER SWITCH & EVENT CONFIGURATION */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-gray-900">Cấu Hình Trực Tiếp (Master Switch)</h2>
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={savingConfig}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingConfig ? 'Đang Lưu...' : 'Lưu Cấu Hình'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Master Switch ON/OFF */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-gray-700 block mb-1">Sự Kiện Lì Xì Cây Thần</span>
              <p className="text-xs text-gray-500">
                Bật để treo bao lì xì và cấp vé khi làm nhiệm vụ.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`text-xs font-black ${config.isEventActive ? 'text-emerald-600' : 'text-red-600'}`}>
                {config.isEventActive ? 'ĐANG BẬT (ACTIVE)' : 'TẠM DỪNG (OFF)'}
              </span>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, isEventActive: !prev.isEventActive }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  config.isEventActive ? 'bg-emerald-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    config.isEventActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Allow Existing Tickets To Open */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-gray-700 block mb-1">Cho Phép Mở Vé Còn Lại</span>
              <p className="text-xs text-gray-500">
                Khi sự kiện OFF, user còn vé có được mở tiếp không.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`text-xs font-bold ${config.allowExistingTicketsToOpen ? 'text-blue-600' : 'text-gray-500'}`}>
                {config.allowExistingTicketsToOpen ? 'CHO PHÉP' : 'CHẶN MỞ'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    allowExistingTicketsToOpen: !prev.allowExistingTicketsToOpen,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  config.allowExistingTicketsToOpen ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    config.allowExistingTicketsToOpen ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Max Visible Envelopes */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-gray-700 block mb-1">Bao Treo Tối Đa (Max Visible)</span>
              <p className="text-xs text-gray-500">
                Giới hạn số bao hiển thị đồng thời trên cây (1 - 20 bao).
              </p>
            </div>
            <div className="mt-3">
              <input
                type="number"
                min="1"
                max="20"
                value={config.maxVisibleEnvelopes}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxVisibleEnvelopes: parseInt(e.target.value, 10) || 8,
                  }))
                }
                className="w-full px-3 py-1.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* Tickets Per Mission */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-gray-700 block mb-1">Vé Thưởng Mỗi Nhiệm Vụ</span>
              <p className="text-xs text-gray-500">
                Số vé +1 Lucky Envelope Ticket khi nhận quà nhiệm vụ.
              </p>
            </div>
            <div className="mt-3">
              <input
                type="number"
                min="1"
                max="10"
                value={config.ticketsPerMission}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    ticketsPerMission: parseInt(e.target.value, 10) || 1,
                  }))
                }
                className="w-full px-3 py-1.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-900 bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. KPI ANALYTICS OVERVIEW */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Tổng Vé Đã Phát</div>
            <div className="text-lg font-black text-gray-900 font-mono">
              {(analytics?.totalTicketsEarned || 0).toLocaleString('vi-VN')}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-700 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Tổng Lì Xì Đã Mở</div>
            <div className="text-lg font-black text-gray-900 font-mono">
              {(analytics?.totalOpened || 0).toLocaleString('vi-VN')}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Vé Chưa Dùng</div>
            <div className="text-lg font-black text-gray-900 font-mono">
              {(analytics?.totalTicketsUnused || 0).toLocaleString('vi-VN')}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Tổng Xu Đã Cấp</div>
            <div className="text-lg font-black text-gray-900 font-mono">
              {(analytics?.totalCoinDistributed || 0).toLocaleString('vi-VN')}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('rewards')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'rewards'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Kho Quà & Tỷ Lệ ({rewards.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Lịch Sử Mở Thưởng</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: REWARD POOL MANAGEMENT */}
      {/* ========================================================= */}
      {activeTab === 'rewards' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 flex items-center justify-between border-b border-gray-100 gap-2">
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                Danh Sách Phần Thưởng Trong Pool
              </h3>
              <p className="text-xs text-gray-500">
                Tỷ lệ xác suất tính toán thời gian thực theo tổng Weight của các phần thưởng đang BẬT.
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Phần Thưởng</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">Phần Thưởng</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Số Lượng (Min - Max)</th>
                  <th className="px-4 py-3">Độ Hiếm</th>
                  <th className="px-4 py-3">Trọng Số (Weight)</th>
                  <th className="px-4 py-3">Xác Suất (%)</th>
                  <th className="px-4 py-3">Kho & Giới Hạn</th>
                  <th className="px-4 py-3 text-center">Trạng Thái</th>
                  <th className="px-4 py-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {rewards.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50/70 transition-colors ${!r.isActive ? 'opacity-55' : ''}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {r.imageUrl ? (
                          <img
                            src={r.imageUrl}
                            alt={r.name}
                            className="w-8 h-8 rounded-lg object-contain bg-gray-100 p-1 border border-gray-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                            🎁
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-gray-900">{r.name}</div>
                          {r.description && (
                            <div className="text-[11px] text-gray-400 truncate max-w-xs">{r.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono px-2 py-0.5 rounded bg-gray-100 font-semibold text-gray-700">
                        {r.rewardType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold">
                      {r.minAmount === r.maxAmount ? r.minAmount : `${r.minAmount} ~ ${r.maxAmount}`}
                    </td>
                    <td className="px-4 py-3">{getRarityBadge(r.rarity)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{r.weight}</td>
                    <td className="px-4 py-3 font-mono font-black text-amber-600">
                      {r.isActive ? `${r.probabilityPercent}%` : '0% (Tắt)'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.globalStock !== null ? (
                        <div>
                          <span>Kho: {r.claimedStock} / {r.globalStock}</span>
                          {r.perUserLimit && <div className="text-[10px]">Tối đa: {r.perUserLimit}/người</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400">Không giới hạn</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleRewardActive(r)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
                          r.isActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {r.isActive ? 'Đang Bật' : 'Đã Tắt'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(r)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-amber-700 hover:bg-amber-50 transition-all cursor-pointer"
                          title="Sửa phần thưởng"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteReward(r)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                          title="Xóa / Tắt phần thưởng"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: AUDIT & OPENING HISTORY */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 flex items-center justify-between border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                Lịch Sử Mở Bao Lì Xì Của Người Chơi
              </h3>
              <p className="text-xs text-gray-500">
                Tổng cộng {historyTotalCount.toLocaleString('vi-VN')} lượt mở đã ghi nhận trong cơ sở dữ liệu.
              </p>
            </div>
            <button
              onClick={() => fetchHistory(historyPage)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tải Lại</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">Thời Gian</th>
                  <th className="px-4 py-3">Người Chơi</th>
                  <th className="px-4 py-3">Phần Thưởng</th>
                  <th className="px-4 py-3">Số Lượng</th>
                  <th className="px-4 py-3">Độ Hiếm</th>
                  <th className="px-4 py-3">Loại Thưởng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {historyItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono text-[11px]">
                      {new Date(item.openedAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {item.user?.fullName || item.user?.email || item.userId}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{item.rewardName}</td>
                    <td className="px-4 py-3 font-mono font-black text-amber-600">
                      +{item.rewardAmount.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3">{getRarityBadge(item.rarity)}</td>
                    <td className="px-4 py-3 font-mono text-gray-500">{item.rewardType}</td>
                  </tr>
                ))}
                {historyItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400 text-xs">
                      Chưa có lịch sử mở bao lì xì nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <div>
                Trang {historyPage} / {historyTotalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 cursor-pointer"
                >
                  Trước
                </button>
                <button
                  onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                  disabled={historyPage >= historyTotalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MODAL THÊM / SỬA PHẦN THƯỞNG */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-amber-50/50">
              <h3 className="font-bold text-gray-900 text-base">
                {editingReward ? 'Sửa Phần Thưởng Lì Xì' : 'Thêm Phần Thưởng Mới'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReward} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="font-bold text-gray-700 block mb-1">Tên Phần Thưởng *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 500 Xu Nông Trại, Hạt Giống Lúa Nhật..."
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900"
                />
              </div>

              {/* Description */}
              <div>
                <label className="font-bold text-gray-700 block mb-1">Mô Tả Quà Tặng</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Lộc may mắn đầu xuân..."
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900"
                />
              </div>

              {/* Reward Type & Reference ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Loại Thưởng</label>
                  <select
                    value={formData.rewardType}
                    onChange={(e) => setFormData((p) => ({ ...p, rewardType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900 font-bold bg-white"
                  >
                    <option value="COIN">COIN (Xu Nông Trại)</option>
                    <option value="EXP">EXP (Kinh Nghiệm)</option>
                    <option value="ENERGY">ENERGY (Năng Lượng)</option>
                    <option value="SEED">SEED (Hạt Giống)</option>
                    <option value="FERTILIZER">FERTILIZER (Phân Bón)</option>
                    <option value="MUTATION_CROP">MUTATION_CROP (Cây Đột Biến)</option>
                    <option value="TOOL">TOOL (Vật Phẩm / Gói Quà)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Mã Tham Chiếu (referenceId)</label>
                  <input
                    type="text"
                    placeholder="VD: JAPANESE_RICE, FERTILIZER_SPEED..."
                    value={formData.referenceId}
                    onChange={(e) => setFormData((p) => ({ ...p, referenceId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900"
                  />
                </div>
              </div>

              {/* Min & Max Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Số Lượng Tối Thiểu (Min)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.minAmount}
                    onChange={(e) => setFormData((p) => ({ ...p, minAmount: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Số Lượng Tối Đa (Max)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.maxAmount}
                    onChange={(e) => setFormData((p) => ({ ...p, maxAmount: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Rarity & Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Độ Hiếm (Rarity)</label>
                  <select
                    value={formData.rarity}
                    onChange={(e) => setFormData((p) => ({ ...p, rarity: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900 font-bold bg-white"
                  >
                    <option value="COMMON">COMMON (Phổ thông)</option>
                    <option value="UNCOMMON">UNCOMMON (Đặc biệt)</option>
                    <option value="RARE">RARE (Quý hiếm)</option>
                    <option value="EPIC">EPIC (Sử thi)</option>
                    <option value="LEGENDARY">LEGENDARY (Huyền thoại)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Trọng Số Trúng (Weight) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.00001"
                    max="100000"
                    required
                    value={formData.weight}
                    onChange={(e) => setFormData((p) => ({ ...p, weight: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900 font-mono font-bold text-amber-700"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Hỗ trợ số thập phân (VD: 0.001, 0.01, 0.5, 10...)</p>
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="font-bold text-gray-700 block mb-1">Đường Dẫn Ảnh (imageUrl)</label>
                <input
                  type="text"
                  placeholder="/game/farm/items/coin.png"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, imageUrl: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900"
                />
              </div>

              {/* Stock & Per User Limit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Tổng Số Lượng Kho (globalStock)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Bỏ trống = Không giới hạn"
                    value={formData.globalStock}
                    onChange={(e) => setFormData((p) => ({ ...p, globalStock: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Giới Hạn Mỗi Người (perUserLimit)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Bỏ trống = Không giới hạn"
                    value={formData.perUserLimit}
                    onChange={(e) => setFormData((p) => ({ ...p, perUserLimit: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-900"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="font-bold text-gray-700">Kích Hoạt Phần Thưởng Này (Active)</span>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4 text-amber-600 rounded"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-sm cursor-pointer"
                >
                  Lưu Phần Thưởng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
