'use strict';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Sparkles,
  Star,
  ShieldCheck,
  Image as ImageIcon,
  Gift,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Eye,
  Reply,
  Trash2,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Film,
  Building2,
  Calendar,
  UtensilsCrossed,
  X,
  Send,
  Loader2,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import RatingStars from '@/components/reviews/RatingStars';
import VerifiedPurchaseBadge from '@/components/reviews/VerifiedPurchaseBadge';
import ReviewMediaViewer from '@/components/reviews/ReviewMediaViewer';

dayjs.extend(utc);
dayjs.extend(timezone);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AdminReviewsPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'hidden'>('products');
  const [stats, setStats] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  // Hidden Reviews State
  const [hiddenFilterType, setHiddenFilterType] = useState<'ALL' | 'PRODUCTS' | 'ORDERS'>('ALL');
  const [hiddenReviews, setHiddenReviews] = useState<{ products: any[]; orders: any[] }>({
    products: [],
    orders: [],
  });
  const [hiddenSearch, setHiddenSearch] = useState('');
  const [loadingHidden, setLoadingHidden] = useState(false);

  // Product Reviews State
  const [productReviews, setProductReviews] = useState<any[]>([]);
  const [prodPage, setProdPage] = useState(1);
  const [prodTotalPages, setProdTotalPages] = useState(1);
  const [prodTotal, setProdTotal] = useState(0);
  const [loadingProd, setLoadingProd] = useState(false);

  // Product Filters
  const [prodSearch, setProdSearch] = useState('');
  const [prodRating, setProdRating] = useState<string>('');
  const [prodBranch, setProdBranch] = useState<string>('ALL');
  const [prodVerified, setProdVerified] = useState<string>('');
  const [prodHasMedia, setProdHasMedia] = useState<string>('');
  const [prodStatus, setProdStatus] = useState<string>('ACTIVE');
  const [prodSort, setProdSort] = useState<string>('newest');

  // Order Reviews State
  const [orderReviews, setOrderReviews] = useState<any[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotalPages, setOrderTotalPages] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [loadingOrder, setLoadingOrder] = useState(false);

  // Order Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderRating, setOrderRating] = useState<string>('');
  const [orderBranch, setOrderBranch] = useState<string>('ALL');
  const [orderHasMedia, setOrderHasMedia] = useState<string>('');
  const [orderHasFollowUps, setOrderHasFollowUps] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState<string>('ACTIVE');
  const [orderSort, setOrderSort] = useState<string>('newest');

  // Modal State for Reply
  const [replyModal, setReplyModal] = useState<{
    open: boolean;
    type: 'product' | 'order';
    item: any;
    content: string;
    isSubmitting: boolean;
  }>({
    open: false,
    type: 'product',
    item: null,
    content: '',
    isSubmitting: false,
  });

  // Modal State for Detail View
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    type: 'product' | 'order';
    item: any;
  }>({
    open: false,
    type: 'product',
    item: null,
  });

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    };
  };

  // Fetch branches for filter
  useEffect(() => {
    fetch(`${API_URL}/api/branches`, { headers: getHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data.success || Array.isArray(data)) {
          setBranches(Array.isArray(data) ? data : data.data || []);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/reviews/stats`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.data);
      }
    } catch (e) {}
  }, []);

  // Fetch Product Reviews
  const fetchProductReviews = useCallback(async () => {
    setLoadingProd(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(prodPage));
      params.append('limit', '10');
      if (prodSearch.trim()) params.append('search', prodSearch.trim());
      if (prodRating) params.append('rating', prodRating);
      if (prodBranch && prodBranch !== 'ALL') params.append('branchId', prodBranch);
      if (prodVerified) params.append('isVerified', prodVerified);
      if (prodHasMedia) params.append('hasMedia', prodHasMedia);
      if (prodStatus) params.append('status', prodStatus);
      if (prodSort) params.append('sortBy', prodSort);

      const res = await fetch(`${API_URL}/api/admin/reviews/products?${params.toString()}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProductReviews(data.data || []);
        setProdTotal(data.pagination?.total || 0);
        setProdTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      toast.error('Lỗi tải danh sách đánh giá món ăn');
    } finally {
      setLoadingProd(false);
    }
  }, [prodPage, prodSearch, prodRating, prodBranch, prodVerified, prodHasMedia, prodStatus, prodSort]);

  // Fetch Order Reviews
  const fetchOrderReviews = useCallback(async () => {
    setLoadingOrder(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(orderPage));
      params.append('limit', '10');
      if (orderSearch.trim()) params.append('search', orderSearch.trim());
      if (orderRating) params.append('rating', orderRating);
      if (orderBranch && orderBranch !== 'ALL') params.append('branchId', orderBranch);
      if (orderHasMedia) params.append('hasMedia', orderHasMedia);
      if (orderHasFollowUps) params.append('hasFollowUps', orderHasFollowUps);
      if (orderStatus) params.append('status', orderStatus);
      if (orderSort) params.append('sortBy', orderSort);

      const res = await fetch(`${API_URL}/api/admin/reviews/orders?${params.toString()}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrderReviews(data.data || []);
        setOrderTotal(data.pagination?.total || 0);
        setOrderTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      toast.error('Lỗi tải danh sách đánh giá đơn hàng');
    } finally {
      setLoadingOrder(false);
    }
  }, [orderPage, orderSearch, orderRating, orderBranch, orderHasMedia, orderHasFollowUps, orderStatus, orderSort]);

  // Fetch Hidden Reviews
  const fetchHiddenReviews = useCallback(async () => {
    setLoadingHidden(true);
    try {
      const pParams = new URLSearchParams();
      pParams.append('status', 'HIDDEN');
      pParams.append('limit', '50');
      if (hiddenSearch.trim()) pParams.append('search', hiddenSearch.trim());

      const oParams = new URLSearchParams();
      oParams.append('status', 'HIDDEN');
      oParams.append('limit', '50');
      if (hiddenSearch.trim()) oParams.append('search', hiddenSearch.trim());

      const [pRes, oRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/reviews/products?${pParams.toString()}`, { headers: getHeaders() }),
        fetch(`${API_URL}/api/admin/reviews/orders?${oParams.toString()}`, { headers: getHeaders() }),
      ]);

      const [pData, oData] = await Promise.all([pRes.json(), oRes.json()]);

      setHiddenReviews({
        products: pRes.ok && pData.success ? pData.data || [] : [],
        orders: oRes.ok && oData.success ? oData.data || [] : [],
      });
    } catch (err: any) {
      toast.error('Lỗi tải danh sách đánh giá đã ẩn');
    } finally {
      setLoadingHidden(false);
    }
  }, [hiddenSearch]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'products') fetchProductReviews();
    else if (activeTab === 'orders') fetchOrderReviews();
    else if (activeTab === 'hidden') fetchHiddenReviews();
  }, [activeTab, fetchProductReviews, fetchOrderReviews, fetchHiddenReviews]);

  // Handle Moderate (Hide / Restore)
  const handleModerate = async (type: 'product' | 'order', id: string, currentStatus: string) => {
    const isCurrentlyHidden = currentStatus === 'HIDDEN';
    const nextStatus = isCurrentlyHidden ? 'ACTIVE' : 'HIDDEN';
    const actionLabel = isCurrentlyHidden ? 'khôi phục hiển thị' : 'ẩn đánh giá này';

    const result = await Swal.fire({
      title: `${isCurrentlyHidden ? 'Khôi phục' : 'Ẩn'} đánh giá?`,
      text: `Bạn có chắc muốn ${actionLabel}? ${
        type === 'product' ? 'Hệ thống sẽ tự động tính toán lại điểm trung bình của món ăn.' : ''
      }`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    try {
      const url =
        type === 'product'
          ? `${API_URL}/api/admin/reviews/products/${id}/moderate`
          : `${API_URL}/api/admin/reviews/orders/${id}/moderate`;

      const res = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || 'Lỗi kiểm duyệt');
      }

      toast.success(data.message || 'Cập nhật trạng thái thành công');
      fetchStats();
      if (activeTab === 'hidden') fetchHiddenReviews();
      if (type === 'product') fetchProductReviews();
      else fetchOrderReviews();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể thực hiện kiểm duyệt');
    }
  };

  // Submit Admin Reply
  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyModal.content.trim()) {
      toast.error('Vui lòng nhập nội dung phản hồi');
      return;
    }

    setReplyModal((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const isProduct = replyModal.type === 'product';
      const url = isProduct
        ? `${API_URL}/api/admin/reviews/products/${replyModal.item.id}/reply`
        : `${API_URL}/api/admin/reviews/orders/${replyModal.item.id}/reply`;

      const res = await fetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content: replyModal.content.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || 'Lỗi lưu phản hồi');
      }

      toast.success(data.message || 'Đã gửi phản hồi tới khách hàng');
      setReplyModal({ open: false, type: 'product', item: null, content: '', isSubmitting: false });
      if (activeTab === 'hidden') fetchHiddenReviews();
      if (isProduct) fetchProductReviews();
      else fetchOrderReviews();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu phản hồi');
    } finally {
      setReplyModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Delete Admin Reply
  const handleDeleteReply = async (type: 'product' | 'order', id: string) => {
    const result = await Swal.fire({
      title: 'Xóa phản hồi?',
      text: 'Bạn có chắc chắn muốn xóa phản hồi chính thức này không?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      confirmButtonText: 'Đồng ý xóa',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    try {
      const url =
        type === 'product'
          ? `${API_URL}/api/admin/reviews/products/${id}/reply`
          : `${API_URL}/api/admin/reviews/orders/${id}/reply`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || 'Lỗi xóa phản hồi');
      }

      toast.success('Đã xóa phản hồi');
      if (activeTab === 'hidden') fetchHiddenReviews();
      if (type === 'product') fetchProductReviews();
      else fetchOrderReviews();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xóa phản hồi');
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      {/* ── HEADER & KPI CARDS ── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-amber-500" />
              <span>Quản lý Đánh giá & Phản hồi</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Theo dõi và phản hồi đánh giá món ăn & trải nghiệm đơn hàng của khách hàng thành viên AVORA
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchStats();
              if (activeTab === 'products') fetchProductReviews();
              else if (activeTab === 'orders') fetchOrderReviews();
              else if (activeTab === 'hidden') fetchHiddenReviews();
            }}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Làm mới dữ liệu</span>
          </button>
        </div>

        {/* Thống kê nhanh Overview Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Đánh giá món ăn</span>
                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {stats.productReviews?.total || 0}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span>Trung bình:</span>
                <span className="font-bold text-amber-600 font-mono">
                  {stats.productReviews?.avgRating || 0}★
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Xác minh mua hàng</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                {stats.productReviews?.verifiedPercentage || 0}%
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span>{stats.productReviews?.verifiedCount || 0} đánh giá đã xác minh</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Đánh giá đơn hàng</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {stats.orderReviews?.total || 0}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span>Trung bình:</span>
                <span className="font-bold text-amber-600 font-mono">
                  {stats.orderReviews?.avgRating || 0}★
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Điểm thưởng đã cấp</span>
                <Gift className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-purple-600 mt-2 font-mono">
                +{(stats.orderReviews?.totalRewardPoints || 0).toLocaleString('vi-VN')}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span>Tích lũy từ đánh giá trải nghiệm</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── TABS NAVIGATION ── */}
      <div className="flex items-center gap-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`pb-3.5 px-2 font-bold text-sm tracking-wide transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'products'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Đánh giá món ăn ({prodTotal})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`pb-3.5 px-2 font-bold text-sm tracking-wide transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Đánh giá đơn hàng ({orderTotal})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hidden')}
          className={`pb-3.5 px-2 font-bold text-sm tracking-wide transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'hidden'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <EyeOff className="w-4 h-4" />
          <span>
            Đánh giá đã ẩn ({stats?.hiddenReviews?.total ?? (hiddenReviews.products.length + hiddenReviews.orders.length)})
          </span>
        </button>
      </div>

      {/* ── TAB 1: PRODUCT REVIEWS ── */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={prodSearch}
                  onChange={(e) => {
                    setProdSearch(e.target.value);
                    setProdPage(1);
                  }}
                  placeholder="Tìm theo tên khách, món ăn, nội dung..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Rating */}
              <div>
                <select
                  value={prodRating}
                  onChange={(e) => {
                    setProdRating(e.target.value);
                    setProdPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Tất cả số sao</option>
                  <option value="5">5 Sao</option>
                  <option value="4">4 Sao</option>
                  <option value="3">3 Sao</option>
                  <option value="2">2 Sao</option>
                  <option value="1">1 Sao</option>
                </select>
              </div>

              {/* Verified Purchase */}
              <div>
                <select
                  value={prodVerified}
                  onChange={(e) => {
                    setProdVerified(e.target.value);
                    setProdPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Tất cả xác minh</option>
                  <option value="true">Đã mua tại AVORA</option>
                  <option value="false">Chưa xác minh</option>
                </select>
              </div>

              {/* Has Media */}
              <div>
                <select
                  value={prodHasMedia}
                  onChange={(e) => {
                    setProdHasMedia(e.target.value);
                    setProdPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Có hình ảnh/video</option>
                  <option value="true">Có ảnh / video</option>
                  <option value="false">Không có media</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <select
                  value={prodStatus}
                  onChange={(e) => {
                    setProdStatus(e.target.value);
                    setProdPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ACTIVE">Hoạt động (Hiển thị)</option>
                  <option value="HIDDEN">Đã ẩn (Bị kiểm duyệt)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Reviews List / Table */}
          {loadingProd ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-500">Đang tải danh sách đánh giá...</p>
            </div>
          ) : productReviews.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-700">Không có đánh giá nào phù hợp</p>
              <p className="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc tìm kiếm</p>
            </div>
          ) : (
            <div className="space-y-3">
              {productReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      {rev.user?.avatarUrl ? (
                        <img
                          src={rev.user.avatarUrl}
                          alt={rev.user.fullName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {(rev.user?.fullName || 'KH').slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {rev.user?.fullName || 'Khách hàng'}
                          </span>
                          {rev.user?.membershipTier?.name && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {rev.user.membershipTier.name}
                            </span>
                          )}
                          <VerifiedPurchaseBadge
                            isVerifiedPurchase={rev.isVerifiedPurchase}
                            purchasedAt={rev.purchasedAt}
                          />
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                          <span>{rev.user?.email || rev.user?.phone || 'No email'}</span>
                          <span>•</span>
                          <span>{dayjs(rev.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Món ăn được đánh giá & Điểm */}
                    <div className="flex items-center gap-3 self-start sm:self-auto bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                      {rev.product?.imageUrl && (
                        <img
                          src={rev.product.imageUrl}
                          alt={rev.product.name}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <span className="text-xs font-bold text-slate-900 block truncate max-w-[200px]">
                          {rev.product?.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <RatingStars rating={rev.rating} size="sm" />
                          <span className="text-xs font-bold text-slate-700 font-mono ml-1">
                            {rev.rating}/5
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nội dung đánh giá */}
                  <div className="text-xs sm:text-sm text-slate-800 leading-relaxed pl-13 whitespace-pre-wrap">
                    {rev.content}
                  </div>

                  {/* Media đính kèm */}
                  {rev.media && rev.media.length > 0 && (
                    <div className="pl-13">
                      <ReviewMediaViewer media={rev.media} />
                    </div>
                  )}

                  {/* Phản hồi hiện tại từ Admin nếu có */}
                  {rev.reply && (
                    <div className="ml-13 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-800 flex items-center gap-1.5">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
                          <span>Phản hồi từ AVORA ({rev.reply.admin?.fullName || 'Ban quản trị'})</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {dayjs(rev.reply.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {rev.reply.content}
                      </p>
                    </div>
                  )}

                  {/* Action Toolbar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Lượt thích: {rev._count?.reactions || 0}</span>
                      <span>•</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          rev.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {rev.status === 'ACTIVE' ? 'Đang hiển thị' : 'Đã ẩn'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Phản hồi */}
                      <button
                        type="button"
                        onClick={() =>
                          setReplyModal({
                            open: true,
                            type: 'product',
                            item: rev,
                            content: rev.reply?.content || '',
                            isSubmitting: false,
                          })
                        }
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5 text-slate-600" />
                        <span>{rev.reply ? 'Sửa phản hồi' : 'Phản hồi'}</span>
                      </button>

                      {rev.reply && (
                        <button
                          type="button"
                          onClick={() => handleDeleteReply('product', rev.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Xóa phản hồi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Ẩn / Khôi phục */}
                      <button
                        type="button"
                        onClick={() => handleModerate('product', rev.id, rev.status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                          rev.status === 'ACTIVE'
                            ? 'bg-red-50 hover:bg-red-100 text-red-600'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {rev.status === 'ACTIVE' ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Ẩn đánh giá</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Khôi phục</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Phân trang */}
              {prodTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  {Array.from({ length: prodTotalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProdPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        prodPage === p ? 'bg-amber-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ORDER REVIEWS ── */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => {
                    setOrderSearch(e.target.value);
                    setOrderPage(1);
                  }}
                  placeholder="Tìm theo mã đơn, tên khách, số điện thoại..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Rating */}
              <div>
                <select
                  value={orderRating}
                  onChange={(e) => {
                    setOrderRating(e.target.value);
                    setOrderPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Tất cả số sao</option>
                  <option value="5">5 Sao</option>
                  <option value="4">4 Sao</option>
                  <option value="3">3 Sao</option>
                  <option value="2">2 Sao</option>
                  <option value="1">1 Sao</option>
                </select>
              </div>

              {/* Branch */}
              <div>
                <select
                  value={orderBranch}
                  onChange={(e) => {
                    setOrderBranch(e.target.value);
                    setOrderPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">Tất cả chi nhánh</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Has Follow-Ups */}
              <div>
                <select
                  value={orderHasFollowUps}
                  onChange={(e) => {
                    setOrderHasFollowUps(e.target.value);
                    setOrderPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Có phản hồi bổ sung</option>
                  <option value="true">Có bổ sung (Follow-up)</option>
                  <option value="false">Chỉ đánh giá gốc</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <select
                  value={orderStatus}
                  onChange={(e) => {
                    setOrderStatus(e.target.value);
                    setOrderPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ACTIVE">Hoạt động (Hiển thị)</option>
                  <option value="HIDDEN">Đã ẩn (Bị kiểm duyệt)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Order Reviews List */}
          {loadingOrder ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-500">Đang tải danh sách đánh giá đơn hàng...</p>
            </div>
          ) : orderReviews.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
              <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-700">Chưa có đánh giá đơn hàng nào phù hợp</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orderReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-4"
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-100 text-amber-700 font-bold rounded-2xl flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            #{rev.order?.orderCode || 'ORDER'}
                          </span>
                          {rev.order?.branch?.name && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                              {rev.order.branch.name}
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">
                            +{rev.rewardPointsSnapshot} Điểm AVORA
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                          <span>Khách: {rev.user?.fullName || 'N/A'}</span>
                          <span>•</span>
                          <span>{dayjs(rev.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100 self-start sm:self-auto">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Tổng quan</span>
                        <div className="flex items-center gap-1.5">
                          <RatingStars rating={rev.overallRating} size="sm" />
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            {rev.overallRating}/5
                          </span>
                        </div>
                      </div>

                      {rev.foodRating && (
                        <div className="border-l border-slate-200 pl-3">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Món ăn</span>
                          <span className="text-xs font-bold text-slate-700 font-mono">{rev.foodRating}★</span>
                        </div>
                      )}
                      {rev.serviceRating && (
                        <div className="border-l border-slate-200 pl-3">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Dịch vụ</span>
                          <span className="text-xs font-bold text-slate-700 font-mono">{rev.serviceRating}★</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nội dung đánh giá gốc */}
                  <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap pl-2 border-l-2 border-amber-500">
                    {rev.content}
                  </div>

                  {/* Media gốc nếu có */}
                  {rev.media && rev.media.length > 0 && (
                    <ReviewMediaViewer media={rev.media} />
                  )}

                  {/* Phản hồi bổ sung Timeline nếu có */}
                  {rev.followUps && rev.followUps.length > 0 && (
                    <div className="space-y-2 p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                        Lịch sử phản hồi bổ sung của khách ({rev.followUps.length}):
                      </span>
                      {rev.followUps.map((fu: any, idx: number) => (
                        <div key={fu.id || idx} className="text-xs text-slate-600 pl-3 border-l border-amber-400">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                            <span className="font-bold text-slate-600">Bổ sung #{idx + 1}</span>
                            <span>{dayjs(fu.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}</span>
                          </div>
                          <p>{fu.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Phản hồi từ Admin nếu có */}
                  {rev.reply && (
                    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Phản hồi từ AVORA ({rev.reply.admin?.fullName || 'Ban quản trị'})</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {dayjs(rev.reply.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {rev.reply.content}
                      </p>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        rev.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {rev.status === 'ACTIVE' ? 'Đang hiển thị' : 'Đã ẩn'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setReplyModal({
                            open: true,
                            type: 'order',
                            item: rev,
                            content: rev.reply?.content || '',
                            isSubmitting: false,
                          })
                        }
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5 text-slate-600" />
                        <span>{rev.reply ? 'Sửa phản hồi' : 'Phản hồi đơn'}</span>
                      </button>

                      {rev.reply && (
                        <button
                          type="button"
                          onClick={() => handleDeleteReply('order', rev.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Xóa phản hồi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleModerate('order', rev.id, rev.status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                          rev.status === 'ACTIVE'
                            ? 'bg-red-50 hover:bg-red-100 text-red-600'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {rev.status === 'ACTIVE' ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Ẩn</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Khôi phục</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Phân trang */}
              {orderTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  {Array.from({ length: orderTotalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setOrderPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        orderPage === p ? 'bg-amber-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: HIDDEN REVIEWS (ĐÁNH GIÁ ĐÃ ẨN) ── */}
      {activeTab === 'hidden' && (
        <div className="space-y-4">
          {/* Banner Thông báo Kiểm duyệt */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                <EyeOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Kho lưu trữ đánh giá đã ẩn (Bị kiểm duyệt)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Các đánh giá này đang tạm ẩn khỏi trang khách hàng và không tính vào điểm số đánh giá trung bình. Admin có thể xem xét và bấm <strong className="text-emerald-700">Khôi phục hiển thị</strong> bất kỳ lúc nào.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 font-mono text-xs font-bold text-amber-800 bg-white/80 px-3 py-1.5 rounded-xl border border-amber-200">
              <span>Tổng cộng:</span>
              <span className="text-sm text-red-600">
                {hiddenReviews.products.length + hiddenReviews.orders.length}
              </span>
            </div>
          </div>

          {/* Sub-tabs and Search */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setHiddenFilterType('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    hiddenFilterType === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({hiddenReviews.products.length + hiddenReviews.orders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHiddenFilterType('PRODUCTS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    hiddenFilterType === 'PRODUCTS'
                      ? 'bg-white text-amber-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                  <span>Món ăn ({hiddenReviews.products.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHiddenFilterType('ORDERS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    hiddenFilterType === 'ORDERS'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>Đơn hàng ({hiddenReviews.orders.length})</span>
                </button>
              </div>

              {/* Search */}
              <div className="relative sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={hiddenSearch}
                  onChange={(e) => setHiddenSearch(e.target.value)}
                  placeholder="Tìm kiếm đánh giá đã ẩn..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* List Content */}
          {loadingHidden ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-500">Đang tải danh sách đánh giá đã ẩn...</p>
            </div>
          ) : (hiddenFilterType === 'ALL' && hiddenReviews.products.length === 0 && hiddenReviews.orders.length === 0) ||
            (hiddenFilterType === 'PRODUCTS' && hiddenReviews.products.length === 0) ||
            (hiddenFilterType === 'ORDERS' && hiddenReviews.orders.length === 0) ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="font-bold text-slate-700">Không có đánh giá nào đang bị ẩn</p>
              <p className="text-xs text-slate-400 mt-1">
                Tất cả đánh giá trên hệ thống đều đang hiển thị công khai bình thường.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. Món ăn đã ẩn */}
              {(hiddenFilterType === 'ALL' || hiddenFilterType === 'PRODUCTS') &&
                hiddenReviews.products.map((rev) => (
                  <div
                    key={`prod-${rev.id}`}
                    className="p-5 bg-white rounded-2xl border-2 border-red-200 shadow-2xs hover:border-red-300 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {rev.user?.avatarUrl ? (
                          <img
                            src={rev.user.avatarUrl}
                            alt={rev.user.fullName}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {(rev.user?.fullName || 'KH').slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {rev.user?.fullName || 'Khách hàng'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Đánh giá món ăn
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                              <EyeOff className="w-3 h-3" />
                              <span>ĐÃ ẨN</span>
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                            <span>{rev.user?.email || rev.user?.phone || 'No email'}</span>
                            <span>•</span>
                            <span>{dayjs(rev.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Món ăn */}
                      <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                        {rev.product?.imageUrl && (
                          <img
                            src={rev.product.imageUrl}
                            alt={rev.product.name}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <span className="text-xs font-bold text-slate-900 block truncate max-w-[200px]">
                            {rev.product?.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <RatingStars rating={rev.rating} size="sm" />
                            <span className="text-xs font-bold text-slate-700 font-mono ml-1">
                              {rev.rating}/5
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Nội dung */}
                    <div className="text-xs sm:text-sm text-slate-800 leading-relaxed pl-13 whitespace-pre-wrap">
                      {rev.content}
                    </div>

                    {/* Media */}
                    {rev.media && rev.media.length > 0 && (
                      <div className="pl-13">
                        <ReviewMediaViewer media={rev.media} />
                      </div>
                    )}

                    {/* Phản hồi */}
                    {rev.reply && (
                      <div className="ml-13 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-800 flex items-center gap-1.5">
                            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
                            <span>Phản hồi từ AVORA ({rev.reply.admin?.fullName || 'Ban quản trị'})</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {dayjs(rev.reply.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {rev.reply.content}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-red-500">
                        * Đánh giá này đang bị ẩn khỏi khách hàng
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setReplyModal({
                              open: true,
                              type: 'product',
                              item: rev,
                              content: rev.reply?.content || '',
                              isSubmitting: false,
                            })
                          }
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Reply className="w-3.5 h-3.5 text-slate-600" />
                          <span>{rev.reply ? 'Sửa phản hồi' : 'Phản hồi'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleModerate('product', rev.id, 'HIDDEN')}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Khôi phục hiển thị</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* 2. Đơn hàng đã ẩn */}
              {(hiddenFilterType === 'ALL' || hiddenFilterType === 'ORDERS') &&
                hiddenReviews.orders.map((rev) => (
                  <div
                    key={`order-${rev.id}`}
                    className="p-5 bg-white rounded-2xl border-2 border-red-200 shadow-2xs hover:border-red-300 transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-100 text-purple-700 font-bold rounded-2xl flex items-center justify-center">
                          <Sparkles className="w-5 h-5" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-slate-900 text-sm">
                              #{rev.order?.orderCode || 'ORDER'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              Đánh giá đơn hàng
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                              <EyeOff className="w-3 h-3" />
                              <span>ĐÃ ẨN</span>
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                            <span>Khách: {rev.user?.fullName || 'N/A'}</span>
                            <span>•</span>
                            <span>{dayjs(rev.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100 self-start sm:self-auto">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Tổng quan</span>
                          <div className="flex items-center gap-1.5">
                            <RatingStars rating={rev.overallRating} size="sm" />
                            <span className="text-xs font-bold text-slate-800 font-mono">
                              {rev.overallRating}/5
                            </span>
                          </div>
                        </div>
                        {rev.foodRating && (
                          <div className="border-l border-slate-200 pl-3">
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Món ăn</span>
                            <span className="text-xs font-bold text-slate-700 font-mono">{rev.foodRating}★</span>
                          </div>
                        )}
                        {rev.serviceRating && (
                          <div className="border-l border-slate-200 pl-3">
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Dịch vụ</span>
                            <span className="text-xs font-bold text-slate-700 font-mono">{rev.serviceRating}★</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nội dung */}
                    <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap pl-2 border-l-2 border-red-400">
                      {rev.content}
                    </div>

                    {/* Media */}
                    {rev.media && rev.media.length > 0 && (
                      <ReviewMediaViewer media={rev.media} />
                    )}

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-red-500">
                        * Đánh giá đơn hàng này đang bị ẩn khỏi khách hàng
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setReplyModal({
                              open: true,
                              type: 'order',
                              item: rev,
                              content: rev.reply?.content || '',
                              isSubmitting: false,
                            })
                          }
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Reply className="w-3.5 h-3.5 text-slate-600" />
                          <span>{rev.reply ? 'Sửa phản hồi' : 'Phản hồi đơn'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleModerate('order', rev.id, 'HIDDEN')}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Khôi phục hiển thị</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: ADMIN REPLY DIALOG ── */}
      {replyModal.open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setReplyModal((prev) => ({ ...prev, open: false }))}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-amber-500" />
                <span>Phản hồi chính thức từ AVORA Restaurant</span>
              </h3>
              <button
                type="button"
                onClick={() => setReplyModal((prev) => ({ ...prev, open: false }))}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReply} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nội dung phản hồi tới khách hàng:
                </label>
                <textarea
                  rows={4}
                  value={replyModal.content}
                  onChange={(e) =>
                    setReplyModal((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="Cảm ơn quý khách đã chia sẻ trải nghiệm... AVORA luôn sẵn sàng lắng nghe..."
                  maxLength={1500}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                  required
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>Khách hàng sẽ nhận được thông báo về phản hồi này.</span>
                  <span>{replyModal.content.length}/1500</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReplyModal((prev) => ({ ...prev, open: false }))}
                  disabled={replyModal.isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={replyModal.isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  {replyModal.isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Gửi phản hồi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
