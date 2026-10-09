'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Gift, Plus, Edit2, Trash2, Coins, Sparkles, X, Tag, ShieldCheck } from 'lucide-react';
import AdminFarmNav from '../components/AdminFarmNav';

export default function AdminFarmShopPage() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<any>(null);

  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    category: 'VOUCHER',
    voucherId: '',
    costFarmCoin: 500,
    costLoyaltyPoints: 100,
    stock: 50,
    limitPerUser: 1,
    minFarmLevel: 1,
    requiredTierId: '',
  });

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/farm/rewards', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setRewards(json.data || []);
      }
    } catch (e) {
      toast.error('Không thể tải danh sách phần thưởng Shop');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingReward(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      category: 'VOUCHER',
      voucherId: '',
      costFarmCoin: 500,
      costLoyaltyPoints: 100,
      stock: 50,
      limitPerUser: 1,
      minFarmLevel: 1,
      requiredTierId: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (reward: any) => {
    setEditingReward(reward);
    setFormData({
      code: reward.code,
      title: reward.title,
      description: reward.description || '',
      category: reward.category,
      voucherId: reward.voucherId || '',
      costFarmCoin: reward.costFarmCoin,
      costLoyaltyPoints: reward.costLoyaltyPoints,
      stock: reward.stock ?? 50,
      limitPerUser: reward.limitPerUser,
      minFarmLevel: reward.minFarmLevel,
      requiredTierId: reward.requiredTierId || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingReward
        ? `/api/admin/farm/rewards/${editingReward.id}`
        : '/api/admin/farm/rewards';
      const method = editingReward ? 'PATCH' : 'POST';

      const payload: any = {
        ...formData,
        costFarmCoin: Number(formData.costFarmCoin),
        costLoyaltyPoints: Number(formData.costLoyaltyPoints),
        stock: formData.stock ? Number(formData.stock) : undefined,
        limitPerUser: Number(formData.limitPerUser),
        minFarmLevel: Number(formData.minFarmLevel),
        voucherId: formData.voucherId ? formData.voucherId : undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(editingReward ? 'Cập nhật phần thưởng thành công' : 'Thêm phần thưởng mới thành công');
        setIsModalOpen(false);
        fetchRewards();
      } else {
        toast.error(json.message || 'Lỗi khi lưu phần thưởng');
      }
    } catch (err) {
      toast.error('Có lỗi xảy ra');
    }
  };

  const toggleActive = async (reward: any) => {
    try {
      const res = await fetch(`/api/admin/farm/rewards/${reward.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !reward.isActive }),
      });
      if (res.ok) {
        toast.success(reward.isActive ? 'Đã tắt quà tặng' : 'Đã kích hoạt quà tặng');
        fetchRewards();
      }
    } catch (e) {
      toast.error('Lỗi khi thay đổi trạng thái');
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'VOUCHER': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'FOOD_DISH': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'FREE_SHIP': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'MERCHANDISE': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'SPECIAL_SEED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <AdminFarmNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Gift className="w-7 h-7 text-amber-600" />
            <span>Quản Lý Cửa Hàng & Đổi Thưởng (Reward Shop)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cấu hình các voucher, món ăn, hiện vật và đặc quyền đổi bằng Điểm AVORA Loyalty hoặc Farm Coin
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-amber-700 transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Phần Thưởng Mới</span>
        </button>
      </div>

      {/* Rewards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.map((r) => (
          <div
            key={r.id}
            className={`p-5 rounded-2xl bg-white border transition-all flex flex-col justify-between ${
              r.isActive ? 'border-slate-200 shadow-2xs' : 'border-slate-200 bg-slate-50/50 opacity-60'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryBadge(r.category)}`}>
                  {r.category}
                </span>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {r.isActive ? 'Đang mở' : 'Tạm dừng'}
                </span>
              </div>

              <h3 className="text-sm font-black text-slate-900 line-clamp-1">{r.title}</h3>
              <p className="text-[11px] text-slate-400 font-mono mb-2">{r.code}</p>

              <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] mb-4">
                {r.description || 'Chưa có mô tả cho phần thưởng này.'}
              </p>

              {/* Price Tag */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                    <span>Điểm AVORA:</span>
                  </span>
                  <span className="font-black text-rose-600">{r.costLoyaltyPoints} Điểm</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1 font-medium">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    <span>Farm Coin:</span>
                  </span>
                  <span className="font-black text-amber-600">{r.costFarmCoin} Xu</span>
                </div>
              </div>

              {/* Conditions */}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-center border-t border-slate-100 pt-3">
                <div className="bg-slate-50 p-1.5 rounded-lg">
                  <div className="text-slate-400">Kho còn lại</div>
                  <div className="font-bold text-slate-800">{r.stock ?? 'Vô hạn'}</div>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-lg">
                  <div className="text-slate-400">Giới hạn/User</div>
                  <div className="font-bold text-slate-800">{r.limitPerUser} lần</div>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-lg">
                  <div className="text-slate-400">Cấp Farm</div>
                  <div className="font-bold text-emerald-700">Lv {r.minFarmLevel}</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
              <button
                onClick={() => toggleActive(r)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  r.isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }`}
              >
                {r.isActive ? 'Tắt phần thưởng' : 'Bật phần thưởng'}
              </button>

              <button
                onClick={() => openEditModal(r)}
                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                title="Chỉnh sửa"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-600" />
                <span>{editingReward ? 'Chỉnh sửa Phần Thưởng' : 'Tạo Phần Thưởng Đổi Quà'}</span>
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
                    disabled={!!editingReward}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="VD: REWARD_VOUCHER_50K"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tiêu đề phần thưởng *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="VD: Voucher Giảm 50.000đ"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Danh mục quà tặng</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 outline-none font-bold"
                  >
                    <option value="VOUCHER">Voucher giảm giá</option>
                    <option value="FOOD_DISH">Món ăn miễn phí</option>
                    <option value="FREE_SHIP">Miễn phí vận chuyển</option>
                    <option value="MERCHANDISE">Quà lưu niệm / Hiện vật</option>
                    <option value="SPECIAL_SEED">Gói hạt giống đặc biệt</option>
                    <option value="COSMETIC">Trang phục / Skin nông trại</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã Voucher ID (Tùy chọn)</label>
                  <input
                    type="text"
                    value={formData.voucherId}
                    onChange={(e) => setFormData({ ...formData, voucherId: e.target.value })}
                    placeholder="Nhập UUID voucher nếu là loại Voucher"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 outline-none font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                <div>
                  <label className="block font-bold text-rose-900 mb-1">Chi phí Điểm AVORA</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.costLoyaltyPoints}
                    onChange={(e) => setFormData({ ...formData, costLoyaltyPoints: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white focus:border-rose-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-900 mb-1">Chi phí Farm Coin</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.costFarmCoin}
                    onChange={(e) => setFormData({ ...formData, costFarmCoin: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số lượng tồn kho</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giới hạn / User</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.limitPerUser}
                    onChange={(e) => setFormData({ ...formData, limitPerUser: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cấp Nông Trại tối thiểu</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.minFarmLevel}
                    onChange={(e) => setFormData({ ...formData, minFarmLevel: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả phần thưởng</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả quyền lợi, điều kiện sử dụng hoặc hướng dẫn nhận quà..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 outline-none resize-none"
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
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {editingReward ? 'Lưu thay đổi' : 'Tạo phần thưởng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
