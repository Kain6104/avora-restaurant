'use strict';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, Plus, SlidersHorizontal, Loader2, LogIn, Pencil, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import RatingSummary, { RatingSummaryData } from './RatingSummary';
import ProductReviewCard from './ProductReviewCard';
import ProductReviewComposer from './ProductReviewComposer';

interface ProductReviewsSectionProps {
  productId: string;
  productName: string;
  initialOpenComposer?: boolean;
}

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  productId,
  productName,
  initialOpenComposer = false,
}) => {
  const [summary, setSummary] = useState<RatingSummaryData | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState<number | undefined>();
  const [selectedFilter, setSelectedFilter] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<'newest' | 'helpful' | 'highest' | 'lowest'>('newest');

  const [isMounted, setIsMounted] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const [isComposerOpen, setIsComposerOpen] = useState(initialOpenComposer);
  const [editingReview, setEditingReview] = useState<any | null>(null);

  useEffect(() => {
    if (initialOpenComposer && isLoggedIn) {
      setIsComposerOpen(true);
    }
  }, [initialOpenComposer, isLoggedIn]);

  // Check login & extract current user (Dual support: localStorage + cookie verification)
  useEffect(() => {
    setIsMounted(true);
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('access_token')) : null;
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;

      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u?.id) {
            setCurrentUserId(u.id);
            setIsLoggedIn(true);
          }
        } catch {}
      }

      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.sub || payload.id) {
            setCurrentUserId(payload.sub || payload.id);
            setIsLoggedIn(true);
          }
        } catch {}
      }

      // Luôn kiểm tra xác thực qua /api/auth/me với Cookie + Bearer
      try {
        const headers: Record<string, string> = { 'ngrok-skip-browser-warning': 'true' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/auth/me', { credentials: 'include', headers });
        if (res.ok) {
          const me = await res.json();
          if (me?.id) {
            setCurrentUserId(me.id);
            setIsLoggedIn(true);
            if (typeof window !== 'undefined') {
              localStorage.setItem('user', JSON.stringify(me));
            }
          }
        }
      } catch {}
    };

    checkAuth();

    const handleUserUpdate = (e: any) => {
      if (e.detail?.id) {
        setCurrentUserId(e.detail.id);
        setIsLoggedIn(true);
      } else {
        checkAuth();
      }
    };

    window.addEventListener('user-updated', handleUserUpdate);
    return () => window.removeEventListener('user-updated', handleUserUpdate);
  }, []);

  // Lock body scroll when composer modal is open
  useEffect(() => {
    if (isComposerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isComposerOpen]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/reviews/summary`, {
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSummary(data.data);
      }
    } catch (e) {
      // Silently fail summary
    }
  }, [productId]);

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('access_token')) : null;
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '10');
      params.append('sort', sortBy);
      if (selectedRating !== undefined) params.append('rating', String(selectedRating));
      if (selectedFilter === 'verified') params.append('verifiedOnly', 'true');
      if (selectedFilter === 'media') params.append('hasMedia', 'true');

      const headers: Record<string, string> = { 'ngrok-skip-browser-warning': 'true' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/products/${productId}/reviews?${params.toString()}`, {
        credentials: 'include',
        headers,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setReviews(data.data || []);
        setTotalReviews(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      toast.error('Không thể tải danh sách đánh giá');
    } finally {
      setIsLoading(false);
    }
  }, [productId, page, sortBy, selectedRating, selectedFilter]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Handle delete
  const handleDeleteReview = async (reviewId: string) => {
    const result = await Swal.fire({
      title: 'Xóa đánh giá?',
      text: 'Bạn có chắc chắn muốn xóa đánh giá của mình không? Điểm đánh giá sẽ được tính toán lại.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Đồng ý xóa',
      cancelButtonText: 'Hủy bỏ',
    });

    if (!result.isConfirmed) return;

    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('access_token')) : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`/api/product-reviews/${reviewId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Đã xóa đánh giá thành công');
        fetchSummary();
        fetchReviews();
      } else {
        toast.error(data.message || 'Không thể xóa đánh giá');
      }
    } catch (err) {
      toast.error('Lỗi khi xóa đánh giá');
    }
  };

  const userExistingReview = reviews.find((r) => r.userId === currentUserId);

  return (
    <div id="reviews-section" className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-500">
              <Star className="w-5 h-5 fill-amber-400" />
            </span>
            <span>Đánh giá từ khách hàng</span>
            {totalReviews > 0 && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {totalReviews}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Những trải nghiệm ẩm thực thực tế về món {productName}
          </p>
        </div>

        {/* Nút gửi đánh giá / Chỉnh sửa */}
        {!isComposerOpen && (
          <div className="shrink-0">
            {isLoggedIn ? (
              userExistingReview ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingReview(userExistingReview);
                    setIsComposerOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa đánh giá của bạn</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingReview(null);
                    setIsComposerOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Viết đánh giá món ăn</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/login?redirectURL=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`;
                }}
                className="px-4 py-2 rounded-xl border border-red-600 text-red-600 hover:bg-red-50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập để đánh giá</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Review Composer Modal (Rendered via Portal to document.body to avoid stacking context issues) */}
      {isMounted && isComposerOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => {
            setIsComposerOpen(false);
            setEditingReview(null);
          }}
        >
          <div 
            className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-amber-200/80 p-3.5 sm:p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <ProductReviewComposer
              productId={productId}
              existingReview={editingReview}
              onSuccess={() => {
                setIsComposerOpen(false);
                setEditingReview(null);
                fetchSummary();
                fetchReviews();
              }}
              onCancel={() => {
                setIsComposerOpen(false);
                setEditingReview(null);
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Rating Summary & Distribution */}
      {summary && (
        <RatingSummary
          summary={summary}
          selectedRating={selectedRating}
          onSelectRating={(r) => {
            setSelectedRating(r);
            setPage(1);
          }}
          selectedFilter={selectedFilter}
          onSelectFilter={(f) => {
            setSelectedFilter(f);
            setPage(1);
          }}
        />
      )}

      {/* Toolbar: Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Sắp xếp theo:</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { key: 'newest', label: 'Mới nhất' },
            { key: 'helpful', label: 'Hữu ích nhất' },
            { key: 'highest', label: 'Đánh giá cao' },
            { key: 'lowest', label: 'Đánh giá thấp' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setSortBy(item.key as any);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                sortBy === item.key
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
          <span className="text-xs font-semibold text-slate-400">Đang tải đánh giá từ khách hàng...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-12 px-6 text-center bg-gradient-to-b from-amber-50/40 via-white to-white rounded-2xl border border-dashed border-amber-200/80">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-6 h-6" />
          </div>
          <p className="text-slate-800 font-bold text-sm">
            Chưa có đánh giá nào cho món ăn này
          </p>
          <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
            Hãy là một trong những thực khách đầu tiên thưởng thức và chia sẻ cảm nhận về món {productName}!
          </p>
          {isLoggedIn && !userExistingReview && (
            <button
              type="button"
              onClick={() => setIsComposerOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gửi đánh giá đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((rev) => (
            <ProductReviewCard
              key={rev.id}
              review={rev}
              currentUserId={currentUserId}
              onEdit={(r) => {
                setEditingReview(r);
                setIsComposerOpen(true);
              }}
              onDelete={handleDeleteReview}
            />
          ))}

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    page === p
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
  );
};

export default ProductReviewsSection;
