'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Crown,
  Edit2,
  Trash2,
  Plus,
  Users,
  Eye,
  Award,
  TrendingUp,
  Percent,
  CheckCircle2,
  XCircle,
  RotateCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import ImageUploader from '@/app/admin/components/ImageUploader';
import {
  PageHeader,
  FilterBar,
  SearchInput,
  AdminCard,
  StatusBadge,
  DataTable,
  MobileDataCard,
  Pagination,
  Modal,
  ConfirmDialog,
  FormField,
} from '@/app/admin/components/ui';
import { buildApiUrl } from '@/lib/utils/api';

interface MembershipTier {
  id: string;
  name: string;
  minSpending: number;
  pointMultiplier: number;
  discountPercent: number;
  isActive: boolean;
  imageUrl?: string;
  _count?: { users: number };
}

const TIER_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#64748b'];

export default function AdminMembershipTiersPage() {
  const { t, locale } = useLanguage();
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<MembershipTier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    minSpending: 0,
    pointMultiplier: 1,
    discountPercent: 0,
    isActive: true,
    imageUrl: '',
  });

  // Delete modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Detail Modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Dashboard stats
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/admin/membership-tiers/dashboard-stats', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data.data || null);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchTiers = useCallback(async () => {
    setLoading(true);
    try {
      const url = buildApiUrl('/api/admin/membership-tiers', {
        search,
        page,
        limit: 10,
      });

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTiers(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
        setTotalCount(data.meta?.total || (data.data || []).length);
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi tải danh sách hạng thẻ');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchTiers();
    fetchDashboardStats();
  }, [fetchTiers]);

  const openCreateModal = () => {
    setEditingTier(null);
    setFormData({
      name: '',
      minSpending: 0,
      pointMultiplier: 1,
      discountPercent: 0,
      isActive: true,
      imageUrl: '',
    });
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
      imageUrl: tier.imageUrl || '',
    });
    setIsModalOpen(true);
  };

  const openDetailModal = async (id: string) => {
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/membership-tiers/${id}/analytics`, {
        credentials: 'include',
      });
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

    const url = editingTier
      ? `/api/admin/membership-tiers/${editingTier.id}`
      : `/api/admin/membership-tiers`;
    const method = editingTier ? 'PATCH' : 'POST';

    try {
      const submitData = {
        ...formData,
        minSpending: Number(formData.minSpending),
        pointMultiplier: Number(formData.pointMultiplier),
        discountPercent: Number(formData.discountPercent),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
        credentials: 'include',
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Có lỗi xảy ra');

      toast.success(editingTier ? 'Cập nhật hạng thành công!' : 'Tạo mới hạng thành công!');
      setIsModalOpen(false);
      fetchTiers();
      fetchDashboardStats();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/membership-tiers/${deleteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Xóa thất bại');

      toast.success('Đã xóa hạng thẻ');
      setDeleteId(null);
      fetchTiers();
      fetchDashboardStats();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const columns = [
    {
      key: 'name',
      header: t('memberships.tierName', 'Tên hạng'),
      render: (tier: MembershipTier) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 font-bold overflow-hidden shrink-0">
            {tier.imageUrl ? (
              <img src={tier.imageUrl} alt={tier.name} className="w-full h-full object-cover" />
            ) : (
              <Crown size={18} />
            )}
          </div>
          <div>
            <span className="font-bold text-slate-900 text-xs sm:text-sm block">{tier.name}</span>
            <span className="text-[11px] text-slate-400 font-medium">
              Từ {formatMoney(tier.minSpending)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'pointMultiplier',
      header: t('memberships.pointsMultiplier', 'Hệ số tích điểm'),
      align: 'center' as const,
      render: (tier: MembershipTier) => (
        <span className="font-bold text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
          x{tier.pointMultiplier}
        </span>
      ),
    },
    {
      key: 'discountPercent',
      header: t('memberships.discountPercent', 'Giảm giá hóa đơn'),
      align: 'center' as const,
      render: (tier: MembershipTier) => (
        <span className="font-bold text-xs text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
          {tier.discountPercent}%
        </span>
      ),
    },
    {
      key: 'members',
      header: t('memberships.memberCount', 'Số thành viên'),
      align: 'center' as const,
      render: (tier: MembershipTier) => (
        <span className="font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
          {tier._count?.users || 0} {t('common.results', 'khách')}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status', 'Trạng thái'),
      align: 'center' as const,
      render: (tier: MembershipTier) => (
        <StatusBadge status={tier.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
      ),
    },
    {
      key: 'actions',
      header: t('common.actions', 'Thao tác'),
      align: 'right' as const,
      render: (tier: MembershipTier) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openDetailModal(tier.id);
            }}
            aria-label={t('common.details', 'Xem thống kê')}
            className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(tier);
            }}
            aria-label={t('common.edit', 'Chỉnh sửa hạng')}
            className="p-1.5 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(tier.id);
            }}
            aria-label={t('common.delete', 'Xóa hạng')}
            className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t('memberships.title', 'Hạng Thẻ Thành Viên')}
        subtitle={t('memberships.subtitle', 'Cấu hình chính sách thăng hạng, quyền lợi VIP và hệ số tích lũy điểm')}
        breadcrumbs={[
          { label: t('nav.customers', 'Khách hàng') },
          { label: t('nav.memberships', 'Hạng thành viên') },
        ]}
        badge={
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            {t('common.total', 'Tổng')} {totalCount} {t('common.results', 'hạng thẻ')}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchTiers}
              aria-label={t('common.refresh', 'Làm mới')}
              className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-bold shadow-2xs transition-colors"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{t('common.refresh', 'Làm mới')}</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Plus size={15} />
              <span>{t('common.add', 'Thêm hạng mới')}</span>
            </button>
          </div>
        }
      />

      {/* Distribution Chart & Recent Movements */}
      {dashboardStats && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
          {/* Donut Chart */}
          <AdminCard title={t('memberships.distribution', 'Phân bố thành viên')} icon={<Crown size={16} />}>
            <div className="h-56 w-full relative">
              {!dashboardStats.memberTierDistribution ||
              dashboardStats.memberTierDistribution.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                  {t('common.noData', 'Không có dữ liệu phân bố')}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardStats.memberTierDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="users"
                      nameKey="name"
                    >
                      {dashboardStats.memberTierDistribution.map((_: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={TIER_COLORS[index % TIER_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`${value} ${t('common.results', 'thành viên')}`, t('dashboard.quantity', 'Số lượng')]}
                      contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {dashboardStats.memberTierDistribution?.map((entry: any, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-100"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: TIER_COLORS[idx % TIER_COLORS.length] }}
                  />
                  {entry.name}: {entry.users}
                </span>
              ))}
            </div>
          </AdminCard>

          {/* Recent movements */}
          <div className="xl:col-span-2">
            <AdminCard title={t('memberships.recentMovements', 'Chuyển động hạng gần đây')} icon={<TrendingUp size={16} />}>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {!dashboardStats.recentTierMovements ||
                dashboardStats.recentTierMovements.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    {t('memberships.noMovements', 'Chưa có chuyển động hạng nào gần đây')}
                  </p>
                ) : (
                  dashboardStats.recentTierMovements.map((m: any) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100/80 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{m.user?.fullName || t('table.customer', 'Khách hàng')}</p>
                        <span className="text-[11px] text-slate-400">
                          {new Date(m.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')} · {m.description}
                        </span>
                      </div>
                      <span className="font-bold text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                        {m.membershipTierName}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </AdminCard>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        actions={
          search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              {t('common.clearFilter', 'Xóa lọc')}
            </button>
          )
        }
      >
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder={t('memberships.searchPlaceholder', 'Tìm theo tên hạng thẻ...')}
          />
        </div>
      </FilterBar>

      {/* Tiers DataTable */}
      <DataTable
        columns={columns}
        data={tiers}
        keyExtractor={(t) => t.id}
        loading={loading}
        onRowClick={(t) => openDetailModal(t.id)}
        emptyTitle="Chưa có hạng thành viên nào"
        emptyDescription="Tạo hạng thẻ đầu tiên để bắt đầu chương trình khách hàng thân thiết."
        mobileCardRender={(t) => (
          <MobileDataCard
            avatar={
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold">
                {t.imageUrl ? (
                  <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Crown size={18} />
                )}
              </div>
            }
            title={t.name}
            subtitle={`Chi tiêu từ ${formatMoney(t.minSpending)}`}
            badge={<StatusBadge status={t.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />}
            details={[
              { label: 'Hệ số điểm', value: `x${t.pointMultiplier}` },
              { label: 'Giảm giá', value: `${t.discountPercent}%` },
              { label: 'Số thành viên', value: `${t._count?.users || 0} khách` },
            ]}
            actions={
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => openDetailModal(t.id)}
                  className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
                >
                  <Eye size={13} />
                  <span>Chi tiết</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(t)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(t.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            }
          />
        )}
      />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={10}
        onPageChange={setPage}
        itemName="hạng thành viên"
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTier ? 'Chỉnh sửa hạng thẻ' : 'Thêm hạng thẻ mới'}
        subtitle="Cấu hình quyền lợi và mức chi tiêu đạt hạng"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              {editingTier ? 'Lưu thay đổi' : 'Tạo mới'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <FormField label="Tên hạng thành viên" required>
            <input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="VD: VIP Kim Cương"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mốc chi tiêu tối thiểu (VNĐ)" required>
              <input
                required
                type="number"
                value={formData.minSpending}
                onChange={(e) =>
                  setFormData({ ...formData, minSpending: Number(e.target.value) })
                }
                className="w-full h-10 px-3 text-xs sm:text-sm font-bold text-red-600 border border-slate-200 rounded-xl outline-none"
              />
            </FormField>
            <FormField label="Hệ số tích điểm" required>
              <input
                required
                type="number"
                step="0.1"
                value={formData.pointMultiplier}
                onChange={(e) =>
                  setFormData({ ...formData, pointMultiplier: Number(e.target.value) })
                }
                className="w-full h-10 px-3 text-xs sm:text-sm border border-slate-200 rounded-xl outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Giảm giá trực tiếp (%)">
              <input
                type="number"
                value={formData.discountPercent}
                onChange={(e) =>
                  setFormData({ ...formData, discountPercent: Number(e.target.value) })
                }
                className="w-full h-10 px-3 text-xs sm:text-sm border border-slate-200 rounded-xl outline-none"
              />
            </FormField>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <span>Kích hoạt hạng thẻ này</span>
              </label>
            </div>
          </div>

          <FormField label="Biểu tượng / Huy hiệu hạng">
            <ImageUploader
              imageUrl={formData.imageUrl}
              folder="tiers"
              onUploadSuccess={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
              label=""
              className="w-full flex flex-col items-center justify-center"
            />
          </FormField>
        </form>
      </Modal>

      {/* Analytics Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Thống kê chi tiết hạng thành viên"
        maxWidth="lg"
      >
        {loadingDetail ? (
          <div className="p-8 text-center text-xs text-slate-400">Đang tải thống kê...</div>
        ) : detailData ? (
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Tổng thành viên</span>
                <span className="font-bold text-base text-slate-900">
                  {detailData.totalUsers || 0} khách
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Tổng doanh thu</span>
                <span className="font-black text-base text-red-600">
                  {formatMoney(detailData.totalRevenue || 0)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Chi tiêu TB / khách</span>
                <span className="font-bold text-base text-slate-900">
                  {formatMoney(detailData.averageSpendingPerUser || 0)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Xóa hạng thành viên"
        message="Bạn có chắc chắn muốn xóa hạng thẻ này? Thành viên thuộc hạng này có thể cần được phân bổ lại."
        confirmText="Xóa hạng thẻ"
        loading={deleteLoading}
        type="danger"
      />
    </div>
  );
}
