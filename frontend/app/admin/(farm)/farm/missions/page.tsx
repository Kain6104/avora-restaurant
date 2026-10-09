'use client';

import React, { useState, useEffect } from 'react';
import AdminFarmNav from '../components/AdminFarmNav';
import {
  Target,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Coins,
  Sparkles,
  Zap,
  Filter,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminFarmMissionsPage() {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DAILY' | 'LIFETIME'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    type: 'DAILY',
    actionType: 'PLANT',
    targetCount: 5,
    rewardExp: 50,
    rewardFarmCoin: 30,
    rewardLoyaltyPoints: 0,
    sortOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchMissions();
  }, []);

  const fetchMissions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/farm/missions', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setMissions(json.data || []);
      } else {
        toast.error('Không thể tải danh sách nhiệm vụ');
      }
    } catch (e) {
      toast.error('Lỗi khi tải danh sách nhiệm vụ');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingMission(null);
    setFormData({
      code: `MISSION_${Date.now().toString().slice(-4)}`,
      title: '',
      description: '',
      type: 'DAILY',
      actionType: 'PLANT',
      targetCount: 5,
      rewardExp: 50,
      rewardFarmCoin: 30,
      rewardLoyaltyPoints: 0,
      sortOrder: missions.length + 1,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: any) => {
    setEditingMission(m);
    setFormData({
      code: m.code,
      title: m.title,
      description: m.description || '',
      type: m.type,
      actionType: m.actionType,
      targetCount: m.targetCount,
      rewardExp: m.rewardExp || 0,
      rewardFarmCoin: m.rewardFarmCoin || 0,
      rewardLoyaltyPoints: m.rewardLoyaltyPoints || 0,
      sortOrder: m.sortOrder || 0,
      isActive: m.isActive,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này?')) return;
    try {
      const res = await fetch(`/api/admin/farm/missions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Đã xóa nhiệm vụ');
        fetchMissions();
      } else {
        toast.error('Không thể xóa nhiệm vụ');
      }
    } catch (e) {
      toast.error('Lỗi khi xóa nhiệm vụ');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const url = editingMission
        ? `/api/admin/farm/missions/${editingMission.id}`
        : '/api/admin/farm/missions';
      const method = editingMission ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(editingMission ? 'Cập nhật nhiệm vụ thành công!' : 'Tạo nhiệm vụ mới thành công!');
        setIsModalOpen(false);
        fetchMissions();
      } else {
        toast.error(json.message || 'Lỗi khi lưu nhiệm vụ');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi lưu nhiệm vụ');
    } finally {
      setSaving(false);
    }
  };

  const filteredMissions = missions.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || m.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Subnav */}
      <AdminFarmNav />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-amber-600" />
            <span>Quản Lý Nhiệm Vụ & Thành Tựu Farm</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Điều chỉnh toàn bộ nhiệm vụ Hàng Ngày, Thành Tựu Chương 1 - 4 và phần thưởng EXP, Xu Nông Trại
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Nhiệm Vụ Mới</span>
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['ALL', 'DAILY', 'LIFETIME'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                typeFilter === t
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'ALL' ? 'Tất cả' : t === 'DAILY' ? 'Hàng Ngày' : 'Thành Tựu (Chương)'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Missions Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-gray-400">Đang tải nhiệm vụ...</div>
        ) : filteredMissions.length === 0 ? (
          <div className="py-16 text-center space-y-1">
            <p className="text-sm font-bold text-gray-600">Không tìm thấy nhiệm vụ nào!</p>
            <p className="text-xs text-gray-400">Thử thay đổi bộ lọc tìm kiếm hoặc tạo nhiệm vụ mới.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                  <th className="p-3 pl-4">Mã & Tên Nhiệm Vụ</th>
                  <th className="p-3">Loại</th>
                  <th className="p-3">Hành Động & Mục Tiêu</th>
                  <th className="p-3">Phần Thưởng</th>
                  <th className="p-3">Trạng Thái</th>
                  <th className="p-3 text-right pr-4">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMissions.map((m) => (
                  <tr key={m.id} className="hover:bg-amber-50/40 transition">
                    <td className="p-3 pl-4">
                      <div className="font-bold text-gray-900">{m.title}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">{m.code}</div>
                      {m.description && (
                        <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{m.description}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          m.type === 'DAILY'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {m.type === 'DAILY' ? 'Hàng Ngày' : 'Thành Tựu'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-gray-700">{m.actionType}</span>
                      <span className="text-gray-400"> (x{m.targetCount})</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 font-mono font-bold">
                        {m.rewardExp > 0 && (
                          <span className="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 text-[10px]">
                            +{m.rewardExp} EXP
                          </span>
                        )}
                        {m.rewardFarmCoin > 0 && (
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] flex items-center gap-0.5">
                            <Coins className="w-2.5 h-2.5 text-amber-500" />
                            +{m.rewardFarmCoin} Xu
                          </span>
                        )}
                        {m.rewardLoyaltyPoints > 0 && (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-500" />
                            +{m.rewardLoyaltyPoints} Điểm
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {m.isActive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-500 font-bold text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" /> Tạm dừng
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(m)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-800 transition cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-rose-100 text-gray-600 hover:text-rose-700 transition cursor-pointer"
                          title="Xóa"
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
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                <span>{editingMission ? 'Chỉnh Sửa Nhiệm Vụ' : 'Tạo Nhiệm Vụ Mới'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Mã Nhiệm Vụ (Unique Code)</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingMission}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Phân Loại</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="DAILY">Hàng Ngày (Daily)</option>
                    <option value="LIFETIME">Thành Tựu (Lifetime / Chapters)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Tên Nhiệm Vụ</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Gieo 10 Hạt Giống Thần Nông"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Mô Tả Hướng Dẫn</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả cách hoàn thành..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Loại Hành Động</label>
                  <select
                    value={formData.actionType}
                    onChange={(e) => setFormData({ ...formData, actionType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="PLANT">PLANT (Gieo hạt)</option>
                    <option value="WATER">WATER (Tưới nước)</option>
                    <option value="FERTILIZE">FERTILIZE (Bón phân)</option>
                    <option value="HARVEST">HARVEST (Thu hoạch)</option>
                    <option value="DISCOVER_MUTATION">DISCOVER_MUTATION (Khám phá đột biến)</option>
                    <option value="HELP_FRIEND">HELP_FRIEND (Tưới hộ bạn bè)</option>
                    <option value="ORDER_COMPLETED">ORDER_COMPLETED (Đơn hàng AVORA)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Số Lượng Yêu Cầu</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.targetCount}
                    onChange={(e) => setFormData({ ...formData, targetCount: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Thưởng EXP</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.rewardExp}
                    onChange={(e) => setFormData({ ...formData, rewardExp: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-mono text-sky-700 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Thưởng Farm Coin</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.rewardFarmCoin}
                    onChange={(e) => setFormData({ ...formData, rewardFarmCoin: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-mono text-amber-700 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Thưởng Điểm AVORA</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.rewardLoyaltyPoints}
                    onChange={(e) => setFormData({ ...formData, rewardLoyaltyPoints: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 font-mono text-emerald-700 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Kích hoạt nhiệm vụ này trong game
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition cursor-pointer shadow-sm"
                >
                  {saving ? 'Đang lưu...' : editingMission ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
