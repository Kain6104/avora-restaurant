'use strict';
'use client';

import React from 'react';
import { Gift, ShieldCheck, CheckCircle2 } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import RatingStars from './RatingStars';
import ReviewMediaViewer from './ReviewMediaViewer';

dayjs.extend(utc);
dayjs.extend(timezone);

interface OrderReviewReadonlyCardProps {
  review: {
    id: string;
    overallRating: number;
    foodRating?: number | null;
    serviceRating?: number | null;
    deliveryRating?: number | null;
    content: string;
    createdAt: string;
    rewardPointsSnapshot: number;
    rewardGranted: boolean;
    media?: any[];
  };
}

export const OrderReviewReadonlyCard: React.FC<OrderReviewReadonlyCardProps> = ({ review }) => {
  const formattedDate = dayjs(review.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm');

  return (
    <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-amber-200/80 shadow-xs space-y-2.5 sm:space-y-3.5">
      {/* Header trạng thái */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 sm:pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs sm:text-sm">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>Đánh giá đã được ghi nhận (Bản ghi bất biến)</span>
        </div>

        {review.rewardGranted && (
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-amber-50 text-amber-800 rounded-full text-[11px] sm:text-xs font-black border border-amber-300 shadow-2xs">
            <Gift className="w-3 h-3 text-amber-500" />
            <span>Đã nhận +{review.rewardPointsSnapshot} điểm AVORA</span>
          </div>
        )}
      </div>

      {/* Đánh giá tổng quan & các tiêu chí (Siêu gọn trên mobile) */}
      <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-50/60 via-white to-orange-50/30 border border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase tracking-wider font-bold shrink-0">
            Tổng quan:
          </span>
          <div className="flex items-center gap-1.5">
            <RatingStars rating={review.overallRating} size="sm" />
            <span className="text-base sm:text-lg font-black text-amber-500 font-serif">
              {review.overallRating}/5
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-700 flex-wrap">
          {review.foodRating && (
            <div className="flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md border border-amber-100 shadow-2xs">
              <span className="text-slate-400 font-medium text-[10px]">Món</span>
              <span className="font-black text-amber-500 text-xs">{review.foodRating}★</span>
            </div>
          )}
          {review.serviceRating && (
            <div className="flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md border border-amber-100 shadow-2xs">
              <span className="text-slate-400 font-medium text-[10px]">Dịch vụ</span>
              <span className="font-black text-amber-500 text-xs">{review.serviceRating}★</span>
            </div>
          )}
          {review.deliveryRating && (
            <div className="flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md border border-amber-100 shadow-2xs">
              <span className="text-slate-400 font-medium text-[10px]">Giao hàng</span>
              <span className="font-black text-amber-500 text-xs">{review.deliveryRating}★</span>
            </div>
          )}
        </div>
      </div>

      {/* Nội dung đánh giá */}
      <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100 font-medium">
        {review.content}
      </div>

      {/* Media đính kèm */}
      {review.media && review.media.length > 0 && (
        <ReviewMediaViewer media={review.media} className="my-1" />
      )}

      <div className="text-[10px] text-slate-400 text-right font-mono">
        Gửi lúc: {formattedDate}
      </div>
    </div>
  );
};

export default OrderReviewReadonlyCard;
