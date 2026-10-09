'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { Send, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import RatingStars from './RatingStars';
import ReviewMediaUploader, { UploadedMediaItem } from './ReviewMediaUploader';

interface ProductReviewComposerProps {
  productId: string;
  existingReview?: {
    id: string;
    rating: number;
    content: string;
    media?: UploadedMediaItem[];
  } | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const ProductReviewComposer: React.FC<ProductReviewComposerProps> = ({
  productId,
  existingReview,
  onSuccess,
  onCancel,
}) => {
  const [rating, setRating] = useState<number>(existingReview?.rating || 5);
  const [content, setContent] = useState<string>(existingReview?.content || '');
  const [mediaList, setMediaList] = useState<UploadedMediaItem[]>(existingReview?.media || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setContent(existingReview.content);
      setMediaList(existingReview.media || []);
    }
  }, [existingReview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rating || rating < 1 || rating > 5) {
      toast.error('Vui lòng chọn số sao từ 1 đến 5');
      return;
    }

    if (content.trim().length < 2) {
      toast.error('Vui lòng nhập nhận xét ít nhất 2 ký tự');
      return;
    }

    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('access_token')) : null;
    if (!token) {
      toast.error('Vui lòng đăng nhập để gửi đánh giá');
      return;
    }

    setIsSubmitting(true);

    try {
      const isEdit = Boolean(existingReview?.id);
      const apiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? ''
        : (process.env.NEXT_PUBLIC_API_URL || '');
      const url = isEdit
        ? `${apiUrl}/api/product-reviews/${existingReview!.id}`
        : `${apiUrl}/api/products/${productId}/reviews`;
      const method = isEdit ? 'PATCH' : 'POST';

      const payload: any = {
        rating: Math.floor(rating),
        content: content.trim(),
        mediaIds: mediaList.map((m) => m.id),
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || 'Có lỗi khi lưu đánh giá');
      }

      toast.success(isEdit ? 'Cập nhật đánh giá thành công!' : 'Đánh giá món ăn thành công!');
      if (!isEdit) {
        setContent('');
        setMediaList([]);
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể lưu đánh giá');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <h3 className="text-sm sm:text-base font-bold text-slate-900">
          {existingReview ? 'Chỉnh sửa đánh giá của bạn' : 'Viết đánh giá món ăn'}
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Chọn số sao tương tác */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-xl bg-amber-50/50 border border-amber-100">
        <span className="text-xs font-bold text-slate-700">
          Mức độ hài lòng của bạn:
        </span>
        <div className="flex items-center gap-2.5">
          <RatingStars
            rating={rating}
            interactive={true}
            onChange={(r) => setRating(r)}
            size="lg"
          />
          <span className="text-xs sm:text-sm font-black text-amber-500">
            {rating === 5 && 'Tuyệt vời'}
            {rating === 4 && 'Hài lòng'}
            {rating === 3 && 'Bình thường'}
            {rating === 2 && 'Chưa hài lòng'}
            {rating === 1 && 'Rất tệ'}
          </span>
        </div>
      </div>

      {/* Khung nhập nhận xét */}
      <div className="space-y-1">
        <label
          htmlFor="review-content"
          className="block text-xs font-bold text-slate-800"
        >
          Nhận xét chi tiết:
        </label>
        <textarea
          id="review-content"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Hãy chia sẻ cảm nhận về hương vị, độ tươi ngon, cách bài trí..."
          maxLength={2000}
          className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all resize-y"
          required
        />
        <div className="flex justify-between text-xs text-slate-400 font-mono">
          <span>Tối thiểu 2 ký tự</span>
          <span>{content.length}/2000</span>
        </div>
      </div>

      {/* Tải hình ảnh & video */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-800">
          Hình ảnh / Video thực tế (Tối đa 5 tệp):
        </label>
        <ReviewMediaUploader
          mediaList={mediaList}
          onMediaChange={setMediaList}
          maxFiles={5}
          disabled={isSubmitting}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 active:scale-98 text-white text-xs font-black shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>{existingReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá món ăn'}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default ProductReviewComposer;
