'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import {
  Layers,
  Sparkles,
  Eye,
  MousePointerClick,
  Users,
  TrendingUp,
  Plus,
  RefreshCw,
  GripVertical,
  Play,
  Square,
  Edit2,
  Trash2,
  ExternalLink,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  BarChart3,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Store,
  ShieldAlert,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { PageHeader, AdminCard, FormField } from '@/app/admin/components/ui';

interface BannerItem {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string;
  mobileImageUrl?: string | null;
  altText: string | null;
  linkUrl: string | null;
  active: boolean;
  bannerOrder: number;
  popup: boolean;
  position: 'HERO' | 'POPUP' | 'PROMO';
  targetAudience: 'ALL' | 'MEMBERS_ONLY' | 'VIP_ONLY';
  popupFrequency: 'ONCE_PER_SESSION' | 'EVERY_PAGE_LOAD';
  startDate: string | null;
  endDate: string | null;
  viewCount: number;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
  branches?: { id: string; name: string }[];
  branchIds?: string[];
  impressions?: number;
  clicks?: number;
  ctr?: number;
  uniqueMembers?: number;
  displayIndex?: number;
  isLive?: boolean;
  isExpired?: boolean;
  isUpcoming?: boolean;
}

interface AnalyticsData {
  totalBanners: number;
  activeCount: number;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  uniqueMembersReached: number;
  dailyTrends: { date: string; views: number; clicks: number }[];
  topBanners: {
    id: string;
    title: string;
    imageUrl: string;
    position: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }[];
}

export default function AdminBannersPage() {
  const { selectedBranchId, availableBranches, role, can } = useAdmin();
  const { t } = useLanguage();

  // State quản lý tabs & bộ lọc
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ALL' | 'POPUP'>('ACTIVE');
  const [activeZone, setActiveZone] = useState<'HERO' | 'POPUP'>('HERO');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED'>('ALL');

  // State dữ liệu
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [activeBanners, setActiveBanners] = useState<BannerItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Partial<BannerItem> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);

  // Detail Analytics Modal
  const [selectedBannerForAnalytics, setSelectedBannerForAnalytics] = useState<BannerItem | null>(null);

  // Kéo thả sắp xếp
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const previousActiveOrderRef = useRef<BannerItem[]>([]);

  // Tải dữ liệu chính
  const fetchData = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranchId && selectedBranchId !== 'ALL' ? `&branchIdScope=${selectedBranchId}` : '';

      const [allRes, activeRes, analyticsRes] = await Promise.all([
        fetch(`/api/admin/banners?page=1&limit=100${branchParam}`),
        fetch(`/api/admin/banners/active?position=${activeZone}${branchParam}`),
        fetch(`/api/admin/banners/analytics?${branchParam.slice(1)}`),
      ]);

      if (allRes.ok) {
        const allData = await allRes.json();
        setBanners(allData.data || []);
      }

      if (activeRes.ok) {
        const activeData = await activeRes.json();
        const liveItems = activeData.data || [];
        setActiveBanners(liveItems);
        previousActiveOrderRef.current = liveItems;
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData.data || null);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu banner:', err);
      toast.error('Không thể tải dữ liệu banner');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranchId, activeZone]);

  // Bộ lọc danh sách "Tất cả Banner"
  const filteredBanners = useMemo(() => {
    return banners.filter((b) => {
      // Lọc tab POPUP
      if (activeTab === 'POPUP' && b.position !== 'POPUP') return false;

      // Lọc từ khóa
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = b.title?.toLowerCase().includes(term);
        const matchAlt = b.altText?.toLowerCase().includes(term);
        const matchLink = b.linkUrl?.toLowerCase().includes(term);
        if (!matchTitle && !matchAlt && !matchLink) return false;
      }

      // Lọc trạng thái
      if (statusFilter === 'ACTIVE' && !b.isLive) return false;
      if (statusFilter === 'INACTIVE' && b.active) return false;
      if (statusFilter === 'EXPIRED' && !b.isExpired) return false;

      return true;
    });
  }, [banners, activeTab, searchTerm, statusFilter]);

  /* ==========================================================================
     XỬ LÝ KÉO THẢ SẮP XẾP VÀ ROLLBACK
     ========================================================================== */

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      handleDragEnd();
      return;
    }

    // 1. Sao lưu trạng thái cũ để Rollback nếu API lỗi
    const originalList = [...activeBanners];
    previousActiveOrderRef.current = originalList;

    // 2. Cập nhật mảng theo vị trí mới
    const updatedList = [...activeBanners];
    const [movedItem] = updatedList.splice(draggedIndex, 1);
    updatedList.splice(targetIndex, 0, movedItem);

    // Cập nhật displayIndex hiển thị #1, #2, #3...
    const reindexedList = updatedList.map((item, idx) => ({
      ...item,
      displayIndex: idx + 1,
      bannerOrder: idx + 1,
    }));

    setActiveBanners(reindexedList);
    handleDragEnd();

    // 3. Gửi API lưu Transaction
    try {
      setReordering(true);
      const payload = {
        position: activeZone,
        items: reindexedList.map((item, idx) => ({
          id: item.id,
          bannerOrder: idx + 1,
        })),
      };

      const res = await fetch('/api/admin/banners/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Lỗi server khi lưu thứ tự');
      }

      toast.success('Đã cập nhật thứ tự hiển thị trên website!');
    } catch (err) {
      console.error('Reorder error:', err);
      // 4. ROLLBACK về vị trí ban đầu
      setActiveBanners(previousActiveOrderRef.current);
      toast.error('Lỗi khi lưu thứ tự hiển thị. Đã hoàn tác vị trí cũ!');
    } finally {
      setReordering(false);
    }
  };

  /* ==========================================================================
     THAO TÁC CRUD & BẬT TẮT
     ========================================================================== */

  const handleToggleStatus = async (banner: BannerItem) => {
    try {
      const res = await fetch(`/api/admin/banners/${banner.id}/status`, {
        method: 'PATCH',
      });
      if (res.ok) {
        toast.success(`Đã ${banner.active ? 'tạm dừng' : 'kích hoạt'} banner!`);
        fetchData();
      } else {
        toast.error('Không thể cập nhật trạng thái');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi cập nhật trạng thái');
    }
  };

  const handleDeleteBanner = async (banner: BannerItem) => {
    if (!confirm(`Bạn có chắc muốn xóa banner "${banner.title || banner.altText || 'này'}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/banners/${banner.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Đã xóa banner thành công!');
        fetchData();
      } else {
        toast.error('Không thể xóa banner');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi xóa banner');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa 5MB!');
      return;
    }

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/upload?folder=banners', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setEditingBanner((prev) => ({ ...prev, imageUrl: data.url }));
        toast.success('Tải ảnh banner lên thành công!');
      } else {
        toast.error('Không thể tải ảnh lên');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi tải ảnh');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner?.imageUrl) {
      toast.error('Vui lòng cung cấp hình ảnh banner!');
      return;
    }

    try {
      setIsSubmitting(true);
      const isUpdating = !!editingBanner.id;
      const url = isUpdating ? `/api/admin/banners/${editingBanner.id}` : '/api/admin/banners';
      const method = isUpdating ? 'PATCH' : 'POST';

      const payload = {
        ...editingBanner,
        popup: editingBanner.position === 'POPUP',
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isUpdating ? 'Cập nhật banner thành công!' : 'Tạo banner mới thành công!');
        setIsEditModalOpen(false);
        setEditingBanner(null);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Thao tác không thành công');
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateModal = (presetPosition: 'HERO' | 'POPUP' = 'HERO') => {
    setEditingBanner({
      title: '',
      description: '',
      imageUrl: '',
      linkUrl: '',
      altText: '',
      position: presetPosition,
      targetAudience: 'ALL',
      popupFrequency: 'ONCE_PER_SESSION',
      active: true,
      startDate: null,
      endDate: null,
      branchIds: selectedBranchId && selectedBranchId !== 'ALL' ? [selectedBranchId] : [],
    });
    setIsEditModalOpen(true);
  };

  const openEditModal = (banner: BannerItem) => {
    setEditingBanner({
      ...banner,
      branchIds: banner.branches?.map((b) => b.id) || [],
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title="Quản trị Banner & Popup Quảng cáo"
        subtitle="Theo dõi số lượt hiển thị, click, lượng thành viên đã xem, và kéo thả trực tiếp để sắp xếp thứ tự hiển thị trên trang chủ."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Marketing', href: '/admin/vouchers' },
          { label: 'Banner & Popup' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              type="button"
              onClick={() => openCreateModal('HERO')}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>Thêm Banner Mới</span>
            </button>
          </div>
        }
      />

      {/* 2. Top KPI Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Impressions */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tổng hiển thị</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Eye size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {analytics?.totalImpressions?.toLocaleString('vi-VN') || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Lượt xuất hiện trên màn hình</p>
          </div>
        </div>

        {/* Total Clicks */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Lượt Click</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <MousePointerClick size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {analytics?.totalClicks?.toLocaleString('vi-VN') || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Lượt người dùng tương tác</p>
          </div>
        </div>

        {/* Avg CTR */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tỉ lệ Click (CTR)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {analytics?.avgCtr || 0}%
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(analytics?.avgCtr || 0, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Unique Member Reach */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Thành viên đã xem</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Users size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {analytics?.uniqueMembersReached?.toLocaleString('vi-VN') || 0}
            </div>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">Khách hàng thành viên độc nhất</p>
          </div>
        </div>

        {/* Active Campaigns Count */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Đang hoạt động</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Sparkles size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {analytics?.activeCount || 0} / {analytics?.totalBanners || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Banner đang chạy trực tiếp</p>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {/* Tab 1: Banner Đang Hoạt Động (Yêu cầu trọng tâm) */}
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Banner đang hoạt động</span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-red-50 text-red-600 rounded-full">
              {activeBanners.length}
            </span>
          </button>

          {/* Tab 2: Tất cả Banner */}
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'ALL'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>Tất cả Banner</span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 rounded-full">
              {banners.length}
            </span>
          </button>

          {/* Tab 3: Popup Modal */}
          <button
            type="button"
            onClick={() => setActiveTab('POPUP')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'POPUP'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles size={14} />
            <span>Popup Modal</span>
          </button>
        </div>

        {/* Xem trước thứ tự hiển thị */}
        {activeTab === 'ACTIVE' && activeBanners.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPreviewSlideIndex(0);
              setIsPreviewOpen(true);
            }}
            className="mb-2 sm:mb-0 px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Play size={13} fill="currentColor" />
            <span>Xem trước thứ tự hiển thị</span>
          </button>
        )}
      </div>

      {/* ==========================================================================
          TAB 1: BANNER ĐANG HOẠT ĐỘNG (KÉO THẢ SẮP XẾP TRỰC TIẾP)
          ========================================================================== */}
      {activeTab === 'ACTIVE' && (
        <div className="space-y-4">
          {/* Sub-bar: Khu vực hiển thị & Hướng dẫn kéo thả */}
          <div className="bg-red-50/70 border border-red-100 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600 text-white rounded-xl shadow-xs">
                <ArrowUpDown size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Kéo thả để sắp xếp thứ tự hiển thị trên trang chủ
                </h3>
                <p className="text-xs text-slate-600">
                  Banner ở vị trí <strong className="text-red-600">#1</strong> sẽ xuất hiện đầu tiên với độ ưu tiên cao nhất. Thứ tự được lưu tự động bằng Transaction an toàn.
                </p>
              </div>
            </div>

            {/* Zone Selector: Hero Slider vs Popup (Cô lập vùng kéo thả) */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-red-200/80 shadow-2xs self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveZone('HERO')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeZone === 'HERO'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hero Slider Trang Chủ
              </button>
              <button
                type="button"
                onClick={() => setActiveZone('POPUP')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeZone === 'POPUP'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Popup Modal Chào Mừng
              </button>
            </div>
          </div>

          {/* Danh sách Kéo thả Sắp xếp */}
          {activeBanners.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <div className="w-14 h-14 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3">
                <Layers size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Không có banner nào đang hoạt động</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Hiện tại không có banner nào thuộc khu vực {activeZone === 'HERO' ? 'Hero Slider' : 'Popup Modal'} đang trong thời gian hiệu lực và kích hoạt.
              </p>
              <button
                type="button"
                onClick={() => openCreateModal(activeZone)}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-red-700 transition-colors"
              >
                Tạo banner mới ngay
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeBanners.map((banner, index) => (
                <div
                  key={banner.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`bg-white rounded-2xl border transition-all duration-200 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-grab active:cursor-grabbing select-none ${
                    draggedIndex === index
                      ? 'opacity-40 scale-[0.98] border-red-400 bg-red-50/40'
                      : dragOverIndex === index
                      ? 'border-red-600 border-dashed bg-red-50/20 shadow-md'
                      : 'border-slate-100 shadow-xs hover:shadow-md hover:border-slate-200'
                  }`}
                >
                  {/* Left: Drag Handle, Number Badge, Thumbnail, Info */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
                    {/* Grip Handle */}
                    <div className="text-slate-400 hover:text-slate-700 cursor-grab shrink-0 p-1">
                      <GripVertical size={20} />
                    </div>

                    {/* Order Number Badge */}
                    <div className="shrink-0 flex flex-col items-center justify-center">
                      <span
                        className={`w-8 h-8 rounded-xl font-mono text-xs font-black flex items-center justify-center shadow-xs ${
                          index === 0
                            ? 'bg-amber-500 text-white shadow-amber-500/30 ring-2 ring-amber-400/40'
                            : index === 1
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        #{index + 1}
                      </span>
                      {index === 0 && (
                        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter mt-1">
                          Ưu tiên 1
                        </span>
                      )}
                    </div>

                    {/* Thumbnail Image Preview */}
                    <div className="relative w-28 sm:w-36 aspect-[16/9] rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0">
                      <Image
                        src={banner.imageUrl}
                        alt={banner.title || 'Banner'}
                        fill
                        className="object-cover"
                      />
                    </div>

                    {/* Banner Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {banner.title || banner.altText || 'Chiến dịch không tiêu đề'}
                        </h4>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 shrink-0">
                          Đang chạy
                        </span>
                      </div>

                      {banner.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {banner.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-1.5">
                        {banner.linkUrl && (
                          <span className="flex items-center gap-1 text-slate-600 font-mono">
                            <ExternalLink size={11} />
                            <span className="truncate max-w-[160px]">{banner.linkUrl}</span>
                          </span>
                        )}
                        {banner.endDate && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            <span>Đến: {new Date(banner.endDate).toLocaleDateString('vi-VN')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0">
                    {/* Live Metrics Pill */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs font-mono">
                      <span className="flex items-center gap-1 text-slate-600" title="Lượt hiển thị">
                        <Eye size={13} className="text-blue-500" />
                        <strong>{banner.impressions?.toLocaleString('vi-VN') || 0}</strong>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="flex items-center gap-1 text-slate-600" title="Lượt click">
                        <MousePointerClick size={13} className="text-red-500" />
                        <strong>{banner.clicks?.toLocaleString('vi-VN') || 0}</strong>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="flex items-center gap-1 text-emerald-600 font-bold" title="CTR">
                        {banner.ctr || 0}%
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedBannerForAnalytics(banner)}
                        title="Xem chi tiết thống kê"
                        className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
                      >
                        <BarChart3 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(banner)}
                        title="Chỉnh sửa banner"
                        className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(banner)}
                        title="Tạm dừng banner"
                        className="p-2 hover:bg-amber-50 text-amber-600 rounded-xl transition-colors"
                      >
                        <Square size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==========================================================================
          TAB 2 & 3: TẤT CẢ BANNER / POPUP MODAL (QUẢN TRỊ DANH SÁCH)
          ========================================================================== */}
      {(activeTab === 'ALL' || activeTab === 'POPUP') && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-80">
              <input
                type="text"
                placeholder="Tìm kiếm theo tiêu đề, link đích..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Đã tắt</option>
                <option value="EXPIRED">Đã hết hạn</option>
              </select>

              <button
                type="button"
                onClick={() => openCreateModal(activeTab === 'POPUP' ? 'POPUP' : 'HERO')}
                className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus size={15} />
                <span>Thêm mới</span>
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Banner</th>
                    <th className="py-3 px-4">Khu vực & Đối tượng</th>
                    <th className="py-3 px-4">Thời gian chạy</th>
                    <th className="py-3 px-4 text-center">Thống kê hiệu quả</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBanners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Không tìm thấy banner nào phù hợp với bộ lọc
                      </td>
                    </tr>
                  ) : (
                    filteredBanners.map((banner) => (
                      <tr key={banner.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Banner Preview & Title */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-20 aspect-[16/9] rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              <Image
                                src={banner.imageUrl}
                                alt={banner.title || 'Banner'}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <h4 className="font-bold text-slate-900 truncate">
                                {banner.title || banner.altText || 'Không tiêu đề'}
                              </h4>
                              {banner.linkUrl && (
                                <p className="text-[11px] text-slate-400 font-mono truncate">
                                  {banner.linkUrl}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Position & Target Audience */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-block px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase ${
                                banner.position === 'POPUP'
                                  ? 'bg-purple-50 text-purple-600 border border-purple-100'
                                  : 'bg-blue-50 text-blue-600 border border-blue-100'
                              }`}
                            >
                              {banner.position === 'POPUP' ? 'Popup Modal' : 'Hero Slider'}
                            </span>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {banner.targetAudience === 'MEMBERS_ONLY' ? 'Chỉ thành viên' : 'Tất cả khách'}
                            </p>
                          </div>
                        </td>

                        {/* Dates */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5 text-[11px] text-slate-600">
                            {banner.startDate && (
                              <p>Từ: {new Date(banner.startDate).toLocaleDateString('vi-VN')}</p>
                            )}
                            {banner.endDate ? (
                              <p>Đến: {new Date(banner.endDate).toLocaleDateString('vi-VN')}</p>
                            ) : (
                              <p className="text-slate-400 italic">Không giới hạn</p>
                            )}
                          </div>
                        </td>

                        {/* Performance Stats */}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-3">
                            <div className="text-center">
                              <span className="text-slate-400 text-[10px]">Hiển thị</span>
                              <p className="font-bold text-slate-800">
                                {banner.viewCount?.toLocaleString('vi-VN') || 0}
                              </p>
                            </div>
                            <div className="text-center">
                              <span className="text-slate-400 text-[10px]">Clicks</span>
                              <p className="font-bold text-red-600">
                                {banner.clickCount?.toLocaleString('vi-VN') || 0}
                              </p>
                            </div>
                            <div className="text-center">
                              <span className="text-slate-400 text-[10px]">CTR</span>
                              <p className="font-bold text-emerald-600">{banner.ctr || 0}%</p>
                            </div>
                          </div>
                        </td>

                        {/* Status Toggle Switch */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(banner)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                              banner.active
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {banner.active ? 'Đang bật' : 'Đã tắt'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedBannerForAnalytics(banner)}
                              title="Thống kê chi tiết"
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                            >
                              <BarChart3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(banner)}
                              title="Chỉnh sửa"
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBanner(banner)}
                              title="Xóa banner"
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL XEM TRƯỚC THỨ TỰ HIỂN THỊ (LIVE PREVIEW CAROUSEL)
          ========================================================================== */}
      {isPreviewOpen && activeBanners.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Play size={16} className="text-red-600 fill-red-600" />
                  Mô phỏng Thứ tự Hiển thị trên Trang chủ
                </h3>
                <p className="text-xs text-slate-500">
                  Slide đang xem: <strong className="text-red-600">#{previewSlideIndex + 1}</strong> trên tổng số {activeBanners.length} banner đang chạy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Simulated Banner Container */}
            <div className="p-6 bg-slate-950 flex-1 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10">
                <Image
                  src={activeBanners[previewSlideIndex]?.imageUrl}
                  alt={activeBanners[previewSlideIndex]?.title || 'Banner'}
                  fill
                  className="object-cover transition-all duration-300"
                />

                {/* Simulated Order Badge on Slide */}
                <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-white text-xs font-mono font-bold flex items-center gap-1.5 border border-white/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Vị trí #{previewSlideIndex + 1}
                </div>

                {/* Prev / Next controls */}
                <button
                  type="button"
                  onClick={() =>
                    setPreviewSlideIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length)
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewSlideIndex((prev) => (prev + 1) % activeBanners.length)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-all"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Slide Indicators */}
              <div className="flex items-center gap-2 mt-4">
                {activeBanners.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPreviewSlideIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      previewSlideIndex === idx ? 'w-8 bg-red-500' : 'w-2 bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Footer with Banner Details */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="truncate max-w-md">
                <span className="font-bold text-slate-800">
                  {activeBanners[previewSlideIndex]?.title || 'Banner không tiêu đề'}
                </span>
                {activeBanners[previewSlideIndex]?.linkUrl && (
                  <span className="text-slate-400 font-mono ml-2">
                    ({activeBanners[previewSlideIndex]?.linkUrl})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold"
              >
                Đóng xem trước
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL THÊM / CHỈNH SỬA BANNER
          ========================================================================== */}
      {isEditModalOpen && editingBanner && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingBanner.id ? 'Chỉnh sửa Banner / Popup' : 'Thêm Banner Mới'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingBanner(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {/* Image Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Hình ảnh Banner <span className="text-red-600">*</span>
                </label>
                {editingBanner.imageUrl ? (
                  <div className="relative aspect-[21/9] w-full rounded-2xl overflow-hidden border border-slate-200 group bg-slate-100">
                    <Image
                      src={editingBanner.imageUrl}
                      alt="Banner Preview"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <label className="px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-100">
                        Đổi ảnh
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-[21/9] border-2 border-dashed border-slate-200 hover:border-red-500 rounded-2xl cursor-pointer bg-slate-50/60 hover:bg-red-50/20 transition-all p-4">
                    <Upload size={24} className="text-slate-400 mb-2" />
                    <span className="text-xs font-bold text-slate-700">
                      {uploadingImage ? 'Đang tải ảnh lên...' : 'Nhấp để tải ảnh lên từ máy tính'}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      Khuyến nghị tỉ lệ 16:9 hoặc 21:9 (Tối đa 5MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                )}
              </div>

              {/* Title & Description */}
              <div className="grid grid-cols-1 gap-3">
                <FormField label="Tiêu đề chiến dịch / Banner">
                  <input
                    type="text"
                    value={editingBanner.title || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                    placeholder="VD: Flash Sale Thần Tốc - Giảm 50% Món Nhật"
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                  />
                </FormField>

                <FormField label="Đường dẫn đích khi nhấp (Link URL)">
                  <input
                    type="text"
                    value={editingBanner.linkUrl || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, linkUrl: e.target.value })}
                    placeholder="VD: /flash-sale hoặc /menu hoặc https://..."
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 font-mono"
                  />
                </FormField>

                <FormField label="Mô tả ngắn">
                  <textarea
                    rows={2}
                    value={editingBanner.description || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, description: e.target.value })}
                    placeholder="Mô tả tóm tắt quyền lợi hoặc chương trình..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                  />
                </FormField>
              </div>

              {/* Position & Target Audience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Khu vực hiển thị">
                  <select
                    value={editingBanner.position || 'HERO'}
                    onChange={(e: any) => setEditingBanner({ ...editingBanner, position: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="HERO">Hero Slider (Đầu trang chủ)</option>
                    <option value="POPUP">Popup Modal (Thông báo bật lên)</option>
                    <option value="PROMO">Banner Phụ (Thanh ưu đãi)</option>
                  </select>
                </FormField>

                <FormField label="Đối tượng nhìn thấy">
                  <select
                    value={editingBanner.targetAudience || 'ALL'}
                    onChange={(e: any) => setEditingBanner({ ...editingBanner, targetAudience: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="ALL">Tất cả khách hàng</option>
                    <option value="MEMBERS_ONLY">Chỉ thành viên đã đăng nhập</option>
                    <option value="VIP_ONLY">Khách hàng hạng VIP / Gold</option>
                  </select>
                </FormField>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Ngày bắt đầu hiển thị">
                  <input
                    type="datetime-local"
                    value={
                      editingBanner.startDate
                        ? new Date(editingBanner.startDate).toISOString().slice(0, 16)
                        : ''
                    }
                    onChange={(e) =>
                      setEditingBanner({
                        ...editingBanner,
                        startDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </FormField>

                <FormField label="Ngày kết thúc hiển thị">
                  <input
                    type="datetime-local"
                    value={
                      editingBanner.endDate
                        ? new Date(editingBanner.endDate).toISOString().slice(0, 16)
                        : ''
                    }
                    onChange={(e) =>
                      setEditingBanner({
                        ...editingBanner,
                        endDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </FormField>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div>
                  <h5 className="text-xs font-bold text-slate-900">Kích hoạt banner</h5>
                  <p className="text-[11px] text-slate-500">
                    Bật để banner sẵn sàng hiển thị trên website khi đúng thời gian hiệu lực
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={editingBanner.active !== false}
                  onChange={(e) => setEditingBanner({ ...editingBanner, active: e.target.checked })}
                  className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : editingBanner.id ? 'Lưu Thay Đổi' : 'Tạo Banner Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL CHI TIẾT THỐNG KÊ (ANALYTICS MODAL)
          ========================================================================== */}
      {selectedBannerForAnalytics && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <BarChart3 size={18} className="text-red-600" />
                  Báo cáo Hiệu quả Banner
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">
                  {selectedBannerForAnalytics.title || selectedBannerForAnalytics.altText || 'Banner'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBannerForAnalytics(null)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Lượt Hiển thị</span>
                <p className="text-xl font-black text-slate-900 mt-1">
                  {selectedBannerForAnalytics.impressions?.toLocaleString('vi-VN') || 0}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Lượt Click</span>
                <p className="text-xl font-black text-red-600 mt-1">
                  {selectedBannerForAnalytics.clicks?.toLocaleString('vi-VN') || 0}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Tỉ lệ Click (CTR)</span>
                <p className="text-xl font-black text-emerald-600 mt-1">
                  {selectedBannerForAnalytics.ctr || 0}%
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Thành viên đã xem</span>
                <p className="text-xl font-black text-amber-600 mt-1">
                  {selectedBannerForAnalytics.uniqueMembers?.toLocaleString('vi-VN') || 0}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-red-50/60 rounded-2xl border border-red-100 text-xs text-slate-700 space-y-1">
              <p>
                <strong>Vị trí:</strong> {selectedBannerForAnalytics.position}
              </p>
              <p>
                <strong>Thứ tự ưu tiên:</strong> #{selectedBannerForAnalytics.bannerOrder}
              </p>
              <p>
                <strong>Đối tượng:</strong> {selectedBannerForAnalytics.targetAudience}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedBannerForAnalytics(null)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors"
            >
              Đóng báo cáo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
