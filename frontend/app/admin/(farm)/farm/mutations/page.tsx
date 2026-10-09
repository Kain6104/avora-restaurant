'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Dna, Plus, Edit2, Trash2, Sparkles, X, Filter } from 'lucide-react';

export default function AdminFarmMutationsPage() {
  const [mutations, setMutations] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMutation, setEditingMutation] = useState<any>(null);
  const [filterCrop, setFilterCrop] = useState<string>('ALL');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    sourceCropId: '',
    mutationType: 'COLOR',
    rarity: 'RARE',
    description: '',
    mutationChance: 0.1,
    yieldMultiplier: 1.5,
    rewardExp: 60,
    rewardFarmCoin: 50,
    rewardLoyaltyPoints: 1,
    colorHex: '#3b82f6',
    glowEffect: 'cyan',
    particleEffect: 'sparkles',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resMut, resCrops] = await Promise.all([
        fetch('/api/admin/farm/mutations', { credentials: 'include' }),
        fetch('/api/admin/farm/crops', { credentials: 'include' }),
      ]);

      if (resMut.ok) {
        const json = await resMut.json();
        setMutations(json.data || []);
      }
      if (resCrops.ok) {
        const json = await resCrops.json();
        setCrops(json.data || []);
      }
    } catch (e) {
      toast.error('Không thể tải danh sách đột biến');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingMutation(null);
    setFormData({
      code: '',
      name: '',
      sourceCropId: crops[0]?.id || '',
      mutationType: 'COLOR',
      rarity: 'RARE',
      description: '',
      mutationChance: 0.1,
      yieldMultiplier: 1.5,
      rewardExp: 60,
      rewardFarmCoin: 50,
      rewardLoyaltyPoints: 1,
      colorHex: '#3b82f6',
      glowEffect: 'cyan',
      particleEffect: 'sparkles',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (mut: any) => {
    setEditingMutation(mut);
    setFormData({
      code: mut.code,
      name: mut.name,
      sourceCropId: mut.sourceCropId,
      mutationType: mut.mutationType,
      rarity: mut.rarity,
      description: mut.description || '',
      mutationChance: mut.mutationChance,
      yieldMultiplier: mut.yieldMultiplier,
      rewardExp: mut.rewardExp,
      rewardFarmCoin: mut.rewardFarmCoin,
      rewardLoyaltyPoints: mut.rewardLoyaltyPoints || 0,
      colorHex: mut.colorHex || '#3b82f6',
      glowEffect: mut.glowEffect || 'cyan',
      particleEffect: mut.particleEffect || 'sparkles',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingMutation
        ? `/api/admin/farm/mutations/${editingMutation.id}`
        : '/api/admin/farm/mutations';
      const method = editingMutation ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          mutationChance: Number(formData.mutationChance),
          yieldMultiplier: Number(formData.yieldMultiplier),
          rewardExp: Number(formData.rewardExp),
          rewardFarmCoin: Number(formData.rewardFarmCoin),
          rewardLoyaltyPoints: Number(formData.rewardLoyaltyPoints),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(editingMutation ? 'Cập nhật đột biến thành công' : 'Thêm đột biến thành công');
        setIsModalOpen(false);
        fetchData();
      } else {
        toast.error(json.message || 'Lỗi khi lưu đột biến');
      }
    } catch (err) {
      toast.error('Có lỗi xảy ra khi lưu thông tin');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa thể đột biến "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/farm/mutations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Đã xóa thể đột biến');
        fetchData();
      } else {
        toast.error('Không thể xóa thể đột biến');
      }
    } catch (e) {
      toast.error('Lỗi khi xóa thể đột biến');
    }
  };

  const filteredMutations = filterCrop === 'ALL'
    ? mutations
    : mutations.filter(m => m.sourceCropId === filterCrop);

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'COMMON': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'UNCOMMON': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'RARE': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'EPIC': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'LEGENDARY': return 'bg-amber-50 text-amber-700 border-amber-300 font-black ring-1 ring-amber-300';
      case 'MYTHIC': return 'bg-rose-50 text-rose-700 border-rose-300 font-black ring-1 ring-rose-400 animate-pulse';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'COLOR': return 'bg-blue-50 text-blue-700';
      case 'GIANT': return 'bg-orange-50 text-orange-700';
      case 'GOLDEN': return 'bg-yellow-50 text-yellow-800';
      case 'CRYSTAL': return 'bg-teal-50 text-teal-700';
      case 'SAKURA': return 'bg-pink-50 text-pink-700';
      case 'MOONLIGHT': return 'bg-indigo-50 text-indigo-700';
      case 'RAINBOW': return 'bg-violet-50 text-violet-700';
      case 'AVORA': return 'bg-red-50 text-red-700 font-black';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Dna className="w-7 h-7 text-purple-600" />
            <span>Quản Lý Đột Biến (Mutations Engine)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cấu hình tỉ lệ xuất hiện, hiệu ứng visual và phần thưởng cho các biến thể cây trồng đặc biệt
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Crop Filter */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterCrop}
              onChange={(e) => setFilterCrop(e.target.value)}
              className="bg-transparent font-medium outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả cây gốc ({mutations.length})</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-purple-700 transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Đột Biến</span>
          </button>
        </div>
      </div>

      {/* Mutations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Thể đột biến</th>
                <th className="py-3 px-4">Cây gốc</th>
                <th className="py-3 px-4">Loại & Độ hiếm</th>
                <th className="py-3 px-4 text-center">Tỉ lệ gốc</th>
                <th className="py-3 px-4 text-center">Hệ số sản lượng</th>
                <th className="py-3 px-4 text-center">Thưởng EXP / Coin</th>
                <th className="py-3 px-4 text-center">Điểm Loyalty</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredMutations.map((mut) => (
                <tr key={mut.id} className="hover:bg-purple-50/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs"
                        style={{ backgroundColor: mut.colorHex || '#8b5cf6' }}
                      >
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{mut.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{mut.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {mut.sourceCrop?.name || '---'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRarityBadge(mut.rarity)}`}>
                        {mut.rarity}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${getTypeBadge(mut.mutationType)}`}>
                        {mut.mutationType}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-purple-700">
                    {(mut.mutationChance * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">
                    x{mut.yieldMultiplier}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="font-semibold text-slate-800">+{mut.rewardExp} EXP</div>
                    <div className="text-amber-600 font-bold">+{mut.rewardFarmCoin} Coin</div>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-rose-600">
                    +{mut.rewardLoyaltyPoints} Điểm
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(mut)}
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(mut.id, mut.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMutations.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Chưa có đột biến nào phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Dna className="w-5 h-5 text-purple-600" />
                <span>{editingMutation ? 'Chỉnh sửa Đột Biến' : 'Thêm Biến Thể Đột Biến Mới'}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingMutation}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="VD: CRYSTAL_STRAWBERRY"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tên biến thể *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: Dâu Pha Lê Tuyết"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cây gốc *</label>
                  <select
                    value={formData.sourceCropId}
                    onChange={(e) => setFormData({ ...formData, sourceCropId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none"
                  >
                    {crops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Loại đột biến</label>
                  <select
                    value={formData.mutationType}
                    onChange={(e) => setFormData({ ...formData, mutationType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none font-bold"
                  >
                    <option value="COLOR">Màu sắc (COLOR)</option>
                    <option value="GIANT">Khổng lồ (GIANT)</option>
                    <option value="GOLDEN">Hoàng kim (GOLDEN)</option>
                    <option value="CRYSTAL">Pha lê (CRYSTAL)</option>
                    <option value="SAKURA">Anh đào (SAKURA)</option>
                    <option value="MOONLIGHT">Ánh trăng (MOONLIGHT)</option>
                    <option value="RAINBOW">Cầu vồng (RAINBOW)</option>
                    <option value="AVORA">Đặc quyền AVORA</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Độ hiếm</label>
                  <select
                    value={formData.rarity}
                    onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none font-bold"
                  >
                    <option value="COMMON">Thường (COMMON)</option>
                    <option value="UNCOMMON">Đặc biệt (UNCOMMON)</option>
                    <option value="RARE">Hiếm (RARE)</option>
                    <option value="EPIC">Sử thi (EPIC)</option>
                    <option value="LEGENDARY">Huyền thoại (LEGENDARY)</option>
                    <option value="MYTHIC">Thần thoại (MYTHIC)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tỉ lệ xuất hiện (0 - 1)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="1"
                    required
                    value={formData.mutationChance}
                    onChange={(e) => setFormData({ ...formData, mutationChance: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">VD: 0.014 = 1.4%, 0.001 = 0.1%</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hệ số sản lượng</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={formData.yieldMultiplier}
                    onChange={(e) => setFormData({ ...formData, yieldMultiplier: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">VD: 1.5 = +50% sản lượng</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Màu nhận diện (Hex)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.colorHex}
                      onChange={(e) => setFormData({ ...formData, colorHex: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5 shrink-0"
                    />
                    <input
                      type="text"
                      value={formData.colorHex}
                      onChange={(e) => setFormData({ ...formData, colorHex: e.target.value })}
                      className="w-full px-2 py-2 rounded-xl border border-slate-200 font-mono text-center uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                <div>
                  <label className="block font-bold text-purple-900 mb-1">Thưởng EXP</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.rewardExp}
                    onChange={(e) => setFormData({ ...formData, rewardExp: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-900 mb-1">Thưởng Farm Coin</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.rewardFarmCoin}
                    onChange={(e) => setFormData({ ...formData, rewardFarmCoin: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-rose-900 mb-1">Thưởng Điểm AVORA</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.rewardLoyaltyPoints}
                    onChange={(e) => setFormData({ ...formData, rewardLoyaltyPoints: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả đột biến</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả truyền thuyết và thuộc tính của biến thể đột biến này..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {editingMutation ? 'Cập nhật' : 'Tạo đột biến'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
