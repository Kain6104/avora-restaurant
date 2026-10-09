'use strict';
'use client';

import React, { useState } from 'react';
import { Send, Gift, Clock, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import RatingStars from './RatingStars';
import ReviewMediaUploader, { UploadedMediaItem } from './ReviewMediaUploader';

interface OrderReviewComposerProps {
  orderId: string;
  orderCode: string;
  rewardPoints?: number;
  daysRemaining?: number;
  onSuccess: (createdReview: any) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const OrderReviewComposer: React.FC<OrderReviewComposerProps> = ({
  orderId,
  orderCode,
  rewardPoints = 999,
  daysRemaining = 14,
  onSuccess,
}) => {
  const [overallRating, setOverallRating] = useState<number>(5);
  const [foodRating, setFoodRating] = useState<number>(5);
  const [serviceRating, setServiceRating] = useState<number>(5);
  const [deliveryRating, setDeliveryRating] = useState<number>(5);
  const [content, setContent] = useState<string>('');
  const [mediaList, setMediaList] = useState<UploadedMediaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!overallRating || overallRating < 1 || overallRating > 5) {
      toast.error('Vui lòng chọn số sao trải nghiệm tổng quan từ 1 đến 5');
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
      const payload = {
        overallRating: Math.floor(overallRating),
        foodRating: Math.floor(foodRating),
        serviceRating: Math.floor(serviceRating),
        deliveryRating: Math.floor(deliveryRating),
        content: content.trim(),
        mediaIds: mediaList.map((m) => m.id),
      };

      const apiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? ''
        : (process.env.NEXT_PUBLIC_API_URL || '');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${apiUrl}/api/orders/${orderId}/review`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || 'Lỗi gửi đánh giá đơn hàng');
      }

      toast.success(data.message || `Đánh giá thành công! Bạn được cộng +${rewardPoints} điểm AVORA.`);
      onSuccess(data.data);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể gửi đánh giá đơn hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Banner thông báo điểm thưởng & thời hạn - Siêu gọn nhẹ */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/80 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-2xs shrink-0">
            <Gift className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-slate-900 text-xs truncate block">
              Đánh giá đơn hàng nhận +{rewardPoints} điểm AVORA
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              Bản ghi bất biến ghi nhận 1 lần duy nhất
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-md text-[11px] font-bold text-amber-800 border border-amber-200/70 shrink-0">
          <Clock className="w-3 h-3 text-amber-500" />
          <span>Còn {daysRemaining} ngày</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
        {/* Đánh giá tổng quan */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-amber-50/60 via-white to-orange-50/20 border border-amber-200/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-bold text-slate-900">
              Trải nghiệm tổng quan đơn hàng:
            </span>
            <div className="flex items-center gap-2.5">
              <RatingStars
                rating={overallRating}
                interactive={true}
                onChange={(r) => setOverallRating(r)}
                size="lg"
              />
              <span className="text-xs sm:text-sm font-black text-amber-500 min-w-[75px]">
                {overallRating === 5 && 'Tuyệt vời'}
                {overallRating === 4 && 'Hài lòng'}
                {overallRating === 3 && 'Bình thường'}
                {overallRating === 2 && 'Chưa tốt'}
                {overallRating === 1 && 'Rất tệ'}
              </span>
            </div>
          </div>
        </div>

        {/* Đánh giá tiêu chí phụ (Siêu gọn) */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
          <div className="p-2 rounded-xl border border-amber-100 bg-amber-50/20 text-center space-y-1">
            <span className="text-[10px] sm:text-xs font-bold text-slate-700 block truncate">
              Chất lượng món
            </span>
            <div className="flex justify-center">
              <RatingStars
                rating={foodRating}
                interactive={true}
                onChange={(r) => setFoodRating(r)}
                size="sm"
              />
            </div>
          </div>

          <div className="p-2 rounded-xl border border-amber-100 bg-amber-50/20 text-center space-y-1">
            <span className="text-[10px] sm:text-xs font-bold text-slate-700 block truncate">
              Dịch vụ quán
            </span>
            <div className="flex justify-center">
              <RatingStars
                rating={serviceRating}
                interactive={true}
                onChange={(r) => setServiceRating(r)}
                size="sm"
              />
            </div>
          </div>

          <div className="p-2 rounded-xl border border-amber-100 bg-amber-50/20 text-center space-y-1">
            <span className="text-[10px] sm:text-xs font-bold text-slate-700 block truncate">
              Đóng gói & giao
            </span>
            <div className="flex justify-center">
              <RatingStars
                rating={deliveryRating}
                interactive={true}
                onChange={(r) => setDeliveryRating(r)}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Nhận xét */}
        <div className="space-y-1">
          <label
            htmlFor="order-review-content"
            className="block text-xs font-bold text-slate-800"
          >
            Chia sẻ nhận xét về đơn hàng:
          </label>
          <textarea
            id="order-review-content"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Bạn có hài lòng về tốc độ phục vụ, hương vị món ăn hay cách đóng gói không?..."
            maxLength={2000}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/40 text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all resize-y"
            required
          />
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Tối thiểu 2 ký tự</span>
            <span>{content.length}/2000</span>
          </div>
        </div>

        {/* Đính kèm hình ảnh (tối đa 5 ảnh) */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-800">
            Đính kèm hình ảnh thực tế (tùy chọn, tối đa 5 ảnh):
          </label>
          <ReviewMediaUploader
            mediaList={mediaList}
            onMediaChange={setMediaList}
            maxFiles={5}
            disabled={isSubmitting}
          />
        </div>

        {/* Nút gửi */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 active:scale-98 text-white text-xs sm:text-sm font-black shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang gửi đánh giá & cộng điểm...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Hoàn tất & Nhận +{rewardPoints} điểm AVORA</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrderReviewComposer;
