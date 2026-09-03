'use client';

import React, { useEffect, useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Search, Edit, Trash2, Plus, Users, Eye, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import Pagination from '@/app/admin/components/Pagination';
import ImageUploader from '@/app/admin/components/ImageUploader';
import { buildApiUrl } from '@/lib/utils/api';

interface MembershipTier {
  id: string;
  name: string;
  minSpending: number;
  pointMultiplier: number;
  discountPercent: number;
  discountPercent: number;
  isActive: boolean;
  imageUrl?: string;
  _count?: { users: number };
}

export default function AdminMembershipTiersPage() {
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<MembershipTier | null>(null);
  const [formData, setFormData] = useState({
    name: '', minSpending: 0, pointMultiplier: 1, discountPercent: 0, isActive: true, imageUrl: ''
  });

  // Detail Modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Dashboard stats
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  useEffect(() => {
    fetchTiers();
    fetchDashboardStats();
  }, [page]);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/admin/membership-tiers/dashboard-stats', { credentials: 'include' });
      const data = await res.json();
      setDashboardStats(data.data || null);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchTiers = async () => {
    setLoading(true);
    try {
      const url = buildApiUrl('/api/admin/membership-tiers', {
        search,
        page,
        limit: 10
      });

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setTiers(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi tải danh sách hạng thẻ');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTiers();
  };



  const openCreateModal = () => {
    setEditingTier(null);
    setFormData({ name: '', minSpending: 0, pointMultiplier: 1, discountPercent: 0, isActive: true, imageUrl: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (tier: MembershipTier) => {
    setEditingTier(tier);
    setFormData({ 
      name: tier.name, 
      minSpending: tier.minSpending, 
      pointMultiplier: tier.pointMultiplier, 
      discountPercent: tier.discountPercent,
      isActive: tier.isActive,
      imageUrl: tier.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  const openDetailModal = async (id: string) => {
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/membership-tiers/${id}/analytics`, { credentials: 'include' });
      if (!res.ok) throw new Error('Không thể tải chi tiết');
      const payload = await res.json();
      setDetailData(payload.data || payload);
    } catch (error: any) {
      toast.error(error.message);
      setIsDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.minSpending < 0) {
      return toast.error('Mốc chi tiêu phải lớn hơn hoặc bằng 0');
    }
    if (formData.pointMultiplier <= 0 || formData.discountPercent < 0) {
      return toast.error('Vui lòng nhập các chỉ số hợp lệ!');
    }

    const url = editingTier ? `/api/admin/membership-tiers/${editingTier.id}` : `/api/admin/membership-tiers`;
    const method = editingTier ? 'PATCH' : 'POST';
    
    try {
      const finalImageUrl = formData.imageUrl;
      const submitData = { ...formData, imageUrl: finalImageUrl };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
        credentials: 'include'
      });
      
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.message || 'Có lỗi xảy ra');
      
      toast.success(editingTier ? 'Cập nhật thành công!' : 'Tạo mới thành công!');
      setIsModalOpen(false);
      fetchTiers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa hạng thẻ này?')) return;
    
    try {
      const res = await fetch(`/api/admin/membership-tiers/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.message || 'Xóa thất bại');
      
      toast.success('Đã xóa hạng thẻ');
      fetchTiers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Hạng Thành Viên</h1>
          <p className="text-gray-500 text-sm mt-1">Thiết lập các mốc chi tiêu và cấu hình đặc quyền cho chương trình khách hàng thân thiết.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          <Plus size={20} />
          <span>Thêm hạng mới</span>
        </button>
      </div>

      {dashboardStats && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {/* Tier Distribution Pie Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 xl:col-span-1 flex flex-col">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Phân bố Hạng Thành Viên</h3>
            <div className="flex-1 min-h-[250px] w-full relative">
              {!dashboardStats.memberTierDistribution || dashboardStats.memberTierDistribution.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-gray-400">Không có dữ liệu</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardStats.memberTierDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="users"
                      nameKey="name"
                    >
                      {dashboardStats.memberTierDistribution.map((entry: any, index: number) => {
                        const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#64748b'];
                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [value, 'Thành viên']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {dashboardStats.memberTierDistribution && dashboardStats.memberTierDistribution.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {dashboardStats.memberTierDistribution.map((entry: any, idx: number) => {
                  const COLORS = ['bg-[#f59e0b]', 'bg-[#3b82f6]', 'bg-[#10b981]', 'bg-[#ef4444]', 'bg-[#8b5cf6]', 'bg-[#64748b]'];
                  return (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                      <div className={`w-3 h-3 rounded-full ${COLORS[idx % COLORS.length]}`}></div>
                      {entry.name} ({entry.users})
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Tier Movements */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col xl:col-span-2">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Chuyển động hạng gần đây</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-bold text-gray-600">Khách Hàng</th>
                  <th className="px-6 py-4 font-bold text-gray-600">Thời Gian</th>
                  <th className="px-6 py-4 font-bold text-gray-600">Loại Thao Tác</th>
                  <th className="px-6 py-4 font-bold text-gray-600">Mô Tả</th>
                  <th className="px-6 py-4 font-bold text-gray-600">Hạng Áp Dụng</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {!dashboardStats.recentTierMovements || dashboardStats.recentTierMovements.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-gray-500">Chưa có thay đổi hạng nào gần đây</td></tr>
                ) : (
                  dashboardStats.recentTierMovements.map((movement: any) => (
                    <tr key={movement.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{movement.user?.fullName || 'Không rõ'}</td>
                      <td className="px-6 py-4 text-gray-500 font-medium">{new Date(movement.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="px-6 py-4 font-medium">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full inline-block ${
                          movement.amount > 0 ? 'bg-green-100 text-green-700' : 
                          movement.amount < 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {movement.amount > 0 ? 'Tích Điểm' : movement.amount < 0 ? 'Trừ Điểm' : 'Điều Chỉnh'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{movement.description}</td>
                      <td className="px-6 py-4 text-gray-900 font-bold">{movement.membershipTierName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Tìm kiếm hạng thẻ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-red-500"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              Tìm
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm">
                <th className="p-4 font-medium border-b whitespace-nowrap">TÊN HẠNG</th>
                <th className="p-4 font-medium border-b whitespace-nowrap">MỐC CHI TIÊU</th>
                <th className="p-4 font-medium border-b whitespace-nowrap">HỆ SỐ ĐIỂM</th>
                <th className="p-4 font-medium border-b whitespace-nowrap">GIẢM GIÁ</th>
                <th className="p-4 font-medium border-b whitespace-nowrap">SỐ THÀNH VIÊN</th>
                <th className="p-4 font-medium border-b whitespace-nowrap">TRẠNG THÁI</th>
                <th className="p-4 font-medium border-b whitespace-nowrap text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">Đang tải dữ liệu...</td>
                </tr>
              ) : tiers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    <p className="font-medium text-lg">Chưa có hạng thành viên nào</p>
                    <p className="text-sm mt-1 mb-4">Hãy thiết lập hệ thống hạng thẻ để bắt đầu triân khách hàng.</p>
                    <button onClick={openCreateModal} className="text-red-600 font-medium hover:underline">
                      + Tạo hạng đầu tiên
                    </button>
                  </td>
                </tr>
              ) : (
                tiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {tier.imageUrl ? (
                          <img src={tier.imageUrl} alt={tier.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500 font-bold">
                            {tier.name.charAt(0)}
                          </div>
                        )}
                        <span className="font-semibold text-gray-800">{tier.name}</span>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-red-600">{formatMoney(tier.minSpending)}</td>
                    <td className="p-4">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">x{tier.pointMultiplier}</span>
                    </td>
                    <td className="p-4 text-green-600 font-medium">{tier.discountPercent}%</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Users size={16} />
                        <span>{tier._count?.users || 0}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${tier.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {tier.isActive ? 'Hoạt động' : 'Đã ẩn'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openDetailModal(tier.id)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Xem chi tiết">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => openEditModal(tier)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Sửa">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(tier.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Xóa">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination 
          currentPage={page} 
          totalPages={totalPages} 
          itemName="hạng thẻ" 
          onPageChange={setPage} 
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingTier ? 'Cập nhật hạng thẻ' : 'Thêm hạng thẻ mới'}</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên hạng thành viên *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Ví dụ: Hạng Vàng, Kim Cương"
                />
                <p className="text-xs text-gray-500 mt-1">Tên sẽ được hiển thị trực tiếp trên App của khách hàng.</p>
              </div>

              <div>
                <ImageUploader 
                  imageUrl={formData.imageUrl} 
                  folder="memberships" 
                  onUploadSuccess={(url) => setFormData(prev => ({ ...prev, imageUrl: url }))} 
                  label="Ảnh / Icon đại diện hạng"
                />
                <p className="text-xs text-gray-500 mt-1">Dung lượng tối đa 2MB, ưu tiên ảnh vuông (1:1).</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mốc chi tiêu tối thiểu (VNĐ) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={formData.minSpending}
                  onChange={e => setFormData({...formData, minSpending: Number(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Khi tổng chi tiêu tích lũy của khách hàng đạt mốc này, hệ thống sẽ tự động thăng hạng cho họ.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hệ số nhân điểm thưởng *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.1"
                    value={formData.pointMultiplier}
                    onChange={e => setFormData({...formData, pointMultiplier: Number(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Công thức: Số tiền chi tiêu × Hệ số này. VD: Nhập 1.5 thì khi khách chi 100k sẽ nhận được 150 điểm.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tỷ lệ giảm giá trực tiếp (%) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discountPercent}
                    onChange={e => setFormData({...formData, discountPercent: Number(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Áp dụng giảm giá tự động vào tổng hóa đơn cho thành viên thuộc hạng này. Nhập 0 nếu không áp dụng.</p>
                </div>
              </div>
              
              {editingTier && (
                <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs">
                  <strong>Lưu ý:</strong> Việc thay đổi mốc chi tiêu sẽ thay đổi lộ trình thăng hạng của khách hàng từ bây giờ, nhưng KHÔNG làm giáng cấp các thành viên cũ đã đạt hạng này.
                </div>
              )}

              <div className="pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Cho phép hoạt động</label>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-6">Nếu tắt, khách hàng mới sẽ không thể thăng lên hạng này. Khách cũ đang ở hạng này không bị ảnh hưởng.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  {editingTier ? 'Cập nhật hạng thẻ' : 'Lưu hạng thẻ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold">
                {loadingDetail ? 'Đang tải...' : `Chi tiết hạng: ${detailData?.tier?.name || ''}`}
              </h2>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loadingDetail ? (
                <div className="py-20 text-center text-gray-500">Đang tải dữ liệu chi tiết...</div>
              ) : detailData ? (
                <div className="space-y-6">
                  {/* Thẻ thống kê */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <p className="text-sm text-blue-600 font-medium mb-1">Tổng thành viên</p>
                      <p className="text-2xl font-bold text-blue-900">{detailData.analytics.totalUsers}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <p className="text-sm text-green-600 font-medium mb-1">Tổng doanh thu</p>
                      <p className="text-xl font-bold text-green-900">{formatMoney(detailData.analytics.totalRevenue)}</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <p className="text-sm text-amber-600 font-medium mb-1">Điểm đã phát</p>
                      <p className="text-2xl font-bold text-amber-900">{detailData.analytics.pointsIssued}</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                      <p className="text-sm text-purple-600 font-medium mb-1">Voucher đã dùng</p>
                      <p className="text-2xl font-bold text-purple-900">{detailData.analytics.vouchersUsed}</p>
                    </div>
                  </div>
                  
                  {/* Khuyến mãi hiện tại */}
                  {detailData.activePromotions && (detailData.activePromotions.vouchers?.length > 0 || detailData.activePromotions.flashSales?.length > 0 || detailData.activePromotions.combos?.length > 0) && (
                    <div>
                      <h3 className="font-bold text-lg mb-3">Chương trình Khuyến mãi đang áp dụng</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {detailData.activePromotions.vouchers?.length > 0 && (
                           <div className="border rounded-xl p-4 bg-gray-50">
                             <h4 className="font-bold text-gray-700 mb-2">Voucher</h4>
                             <ul className="space-y-2">
                               {detailData.activePromotions.vouchers.map((v: any) => (
                                 <li key={v.id}>
                                   <Link href={`/admin/vouchers?search=${v.code}`} className="text-blue-600 hover:underline text-sm flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                      {v.code} - {v.title}
                                   </Link>
                                 </li>
                               ))}
                             </ul>
                           </div>
                        )}
                        {detailData.activePromotions.flashSales?.length > 0 && (
                           <div className="border rounded-xl p-4 bg-gray-50">
                             <h4 className="font-bold text-gray-700 mb-2">Flash Sale</h4>
                             <ul className="space-y-2">
                               {detailData.activePromotions.flashSales.map((fs: any) => (
                                 <li key={fs.id}>
                                   <Link href={`/admin/flash-sales?search=${encodeURIComponent(fs.name)}`} className="text-amber-600 hover:underline text-sm flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                      {fs.name}
                                   </Link>
                                 </li>
                               ))}
                             </ul>
                           </div>
                        )}
                        {detailData.activePromotions.combos?.length > 0 && (
                           <div className="border rounded-xl p-4 bg-gray-50">
                             <h4 className="font-bold text-gray-700 mb-2">Combo</h4>
                             <ul className="space-y-2">
                               {detailData.activePromotions.combos.map((c: any) => (
                                 <li key={c.id}>
                                   <Link href={`/admin/combos?search=${encodeURIComponent(c.name)}`} className="text-green-600 hover:underline text-sm flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                      {c.name}
                                   </Link>
                                 </li>
                               ))}
                             </ul>
                           </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Danh sách thành viên */}
                  <div>
                    <h3 className="font-bold text-lg mb-3">Thành viên chi tiêu cao nhất (Top 10)</h3>
                    {detailData.topUsers.length === 0 ? (
                      <div className="bg-gray-50 p-8 rounded-xl text-center text-gray-500 border border-dashed">
                        Chưa có thành viên nào đạt hạng này.
                      </div>
                    ) : (
                      <div className="border rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-3 font-medium text-gray-600">Khách hàng</th>
                              <th className="p-3 font-medium text-gray-600">Số điện thoại</th>
                              <th className="p-3 font-medium text-gray-600 text-right">Tổng chi tiêu</th>
                              <th className="p-3 font-medium text-gray-600 text-right">Điểm hiện tại</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {detailData.topUsers.map((u: any) => (
                              <tr key={u.id} onClick={() => window.open(`/admin/users/${u.id}`, '_blank')} className="hover:bg-gray-100 cursor-pointer transition-colors">
                                <td className="p-3 font-medium text-blue-600">{u.fullName}</td>
                                <td className="p-3 text-gray-500">{u.phone}</td>
                                <td className="p-3 text-right text-red-600 font-medium">{formatMoney(u.totalSpending)}</td>
                                <td className="p-3 text-right text-blue-600">{u.currentPoints} pt</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-red-500">Lỗi không lấy được dữ liệu.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
