'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Sprout, Plus, Edit2, Trash2, Clock, Coins, Sparkles, X } from 'lucide-react';
import AdminFarmNav from '../components/AdminFarmNav';

export default function AdminFarmCropsPage() {
  const [crops, setCrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState<any>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'JAPANESE_INGREDIENT',
    rarity: 'COMMON',
    description: '',
    growDuration: 300,
    seedPrice: 20,
    sellPrice: 30,
    baseYield: 4,
    rewardExp: 20,
    rewardFarmCoin: 20,
    baseMutationRate: 0.05,
    minFarmLevel: 1,
  });

  useEffect(() => {
    fetchCrops();
  }, []);

  const fetchCrops = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/farm/crops', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setCrops(json.data);
      }
    } catch (e) {
      toast.error('Không thể tải danh sách cây trồng');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCrop(null);
    setFormData({
      code: '',
      name: '',
      category: 'JAPANESE_INGREDIENT',
      rarity: 'COMMON',
      description: '',
      growDuration: 300,
      seedPrice: 20,
      sellPrice: 30,
      baseYield: 4,
      rewardExp: 20,
      rewardFarmCoin: 20,
      baseMutationRate: 0.05,
      minFarmLevel: 1,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (crop: any) => {
    setEditingCrop(crop);
    setFormData({
      code: crop.code,
      name: crop.name,
      category: crop.category,
      rarity: crop.rarity,
      description: crop.description || '',
      growDuration: crop.growDuration,
      seedPrice: crop.seedPrice,
      sellPrice: crop.sellPrice,
      baseYield: crop.baseYield,
      rewardExp: crop.rewardExp,
      rewardFarmCoin: crop.rewardFarmCoin,
      baseMutationRate: crop.baseMutationRate,
      minFarmLevel: crop.minFarmLevel,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingCrop
        ? `/api/admin/farm/crops/${editingCrop.id}`
        : '/api/admin/farm/crops';
      const method = editingCrop ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          growDuration: Number(formData.growDuration),
          seedPrice: Number(formData.seedPrice),
          sellPrice: Number(formData.sellPrice),
          baseYield: Number(formData.baseYield),
          rewardExp: Number(formData.rewardExp),
          rewardFarmCoin: Number(formData.rewardFarmCoin),
          baseMutationRate: Number(formData.baseMutationRate),
          minFarmLevel: Number(formData.minFarmLevel),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(editingCrop ? 'Cập nhật cây trồng thành công!' : 'Tạo cây trồng mới thành công!');
        setIsModalOpen(false);
        fetchCrops();
      } else {
        toast.error(json.message || 'Lưu thất bại');
      }
    } catch (err) {
      toast.error('Lỗi khi lưu dữ liệu');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <AdminFarmNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Sprout className="w-7 h-7 text-emerald-600" />
            <span>Quản Lý Cây Trồng & Hạt Giống</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cấu hình thời gian lớn, tỷ lệ đột biến, giá bán và sản lượng của cây trồng
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Cây Trồng Mới</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Cây Trồng</th>
                <th className="p-3.5">Nhóm & Độ Hiếm</th>
                <th className="p-3.5">Thời Gian Lớn</th>
                <th className="p-3.5">Giá Mua/Bán</th>
                <th className="p-3.5">Sản Lượng</th>
                <th className="p-3.5">Tỉ Lệ Đột Biến</th>
                <th className="p-3.5">Cấp Yêu Cầu</th>
                <th className="p-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : crops.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Chưa có cây trồng nào được cấu hình
                  </td>
                </tr>
              ) : (
                crops.map((crop) => (
                  <tr key={crop.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3.5 font-bold text-slate-800">
                      <div>{crop.name}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{crop.code}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 block w-fit mb-0.5">
                        {crop.category}
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 uppercase">
                        {crop.rarity}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 font-medium">
                      {crop.growDuration >= 60
                        ? `${Math.round(crop.growDuration / 60)} phút`
                        : `${crop.growDuration}s`}
                    </td>
                    <td className="p-3.5 font-semibold text-amber-600">
                      {crop.seedPrice} / {crop.sellPrice} Coin
                    </td>
                    <td className="p-3.5 font-bold text-emerald-600">
                      x{crop.baseYield}
                    </td>
                    <td className="p-3.5 font-bold text-purple-600">
                      {Math.round(crop.baseMutationRate * 100)}%
                    </td>
                    <td className="p-3.5 font-black text-slate-700">
                      Lv.{crop.minFarmLevel}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => openEditModal(crop)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-emerald-600 transition cursor-pointer"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-base">
                {editingCrop ? `Sửa Cây Trồng: ${editingCrop.name}` : 'Thêm Cây Trồng Mới'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mã Code (Unique)</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCrop}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="VD: WASABI_CRYSTAL"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tên Cây Trồng</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: Wasabi Pha Lê"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nhóm Cây</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="JAPANESE_INGREDIENT">Japanese Ingredient</option>
                    <option value="FRUIT">Fruit</option>
                    <option value="FANTASY_FOOD">Fantasy Food</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Độ Hiếm (Rarity)</label>
                  <select
                    value={formData.rarity}
                    onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="COMMON">Common</option>
                    <option value="UNCOMMON">Uncommon</option>
                    <option value="RARE">Rare</option>
                    <option value="EPIC">Epic</option>
                    <option value="LEGENDARY">Legendary</option>
                    <option value="MYTHIC">Mythic</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Thời Gian Lớn (Giây)</label>
                  <input
                    type="number"
                    min="10"
                    required
                    value={formData.growDuration}
                    onChange={(e) => setFormData({ ...formData, growDuration: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giá Hạt (Coin)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.seedPrice}
                    onChange={(e) => setFormData({ ...formData, seedPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giá Bán Lại (Coin)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.sellPrice}
                    onChange={(e) => setFormData({ ...formData, sellPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Sản Lượng Gốc</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.baseYield}
                    onChange={(e) => setFormData({ ...formData, baseYield: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tỷ Lệ Đột Biến (0 - 1)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    required
                    value={formData.baseMutationRate}
                    onChange={(e) => setFormData({ ...formData, baseMutationRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cấp Nông Trại Yêu Cầu</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.minFarmLevel}
                    onChange={(e) => setFormData({ ...formData, minFarmLevel: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mô Tả Cây Trồng</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {editingCrop ? 'Cập Nhật' : 'Tạo Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
