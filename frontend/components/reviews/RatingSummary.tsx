'use strict';
'use client';

import React from 'react';
import { Star, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import RatingStars from './RatingStars';

export interface RatingSummaryData {
  avgRating: number;
  ratingCount: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
  verifiedReviewCount: number;
  mediaReviewCount: number;
}

interface RatingSummaryProps {
  summary: RatingSummaryData;
  selectedRating?: number;
  onSelectRating?: (rating: number | undefined) => void;
  selectedFilter?: string;
  onSelectFilter?: (filter: string | undefined) => void;
}

export const RatingSummary: React.FC<RatingSummaryProps> = ({
  summary,
  selectedRating,
  onSelectRating,
  selectedFilter,
  onSelectFilter,
}) => {
  const total = summary.ratingCount || 0;

  const getPercentage = (count: number) => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  const starsDistribution = [
    { star: 5, count: summary.fiveStarCount },
    { star: 4, count: summary.fourStarCount },
    { star: 3, count: summary.threeStarCount },
    { star: 2, count: summary.twoStarCount },
    { star: 1, count: summary.oneStarCount },
  ];

  return (
    <div className="bg-gradient-to-br from-amber-50/60 via-white to-orange-50/40 p-5 sm:p-6 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-stretch">
      {/* Cột Điểm trung bình lớn */}
      <div className="flex flex-col items-center justify-center min-w-[180px] sm:min-w-[200px] border-b md:border-b-0 md:border-r border-amber-100 pb-5 md:pb-0 md:pr-8">
        <div className="text-5xl font-black text-amber-500 tracking-tight font-serif drop-shadow-xs">
          {summary.avgRating > 0 ? summary.avgRating.toFixed(1) : '0.0'}
        </div>
        <div className="my-2">
          <RatingStars rating={summary.avgRating} size="md" />
        </div>
        <p className="text-xs font-bold text-amber-900/70 text-center">
          {total > 0 ? `${total} lượt đánh giá thực tế` : 'Chưa có lượt đánh giá nào'}
        </p>
      </div>

      {/* Cột Phân bố sao */}
      <div className="flex-1 w-full flex flex-col justify-center gap-1.5">
        {starsDistribution.map(({ star, count }) => {
          const pct = getPercentage(count);
          const isSelected = selectedRating === star;

          return (
            <button
              key={star}
              type="button"
              onClick={() => onSelectRating && onSelectRating(isSelected ? undefined : star)}
              className={`flex items-center gap-2.5 w-full group py-1 px-2.5 rounded-xl transition-all text-left cursor-pointer ${
                isSelected
                  ? 'bg-amber-100 text-amber-900 font-bold shadow-2xs'
                  : 'hover:bg-amber-50/80 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1 w-12 text-xs font-bold shrink-0 text-amber-950">
                <span>{star}</span>
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              </div>

              {/* Thanh tiến trình phân bố */}
              <div className="flex-1 h-2.5 bg-amber-100/70 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isSelected ? 'bg-amber-500' : 'bg-gradient-to-r from-amber-400 to-yellow-400 group-hover:from-amber-500 group-hover:to-yellow-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="w-16 text-right text-xs font-semibold text-slate-500 shrink-0 font-mono">
                {count} <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Filter Badges */}
      <div className="flex md:flex-col justify-center gap-2 border-t md:border-t-0 md:border-l border-amber-100 pt-4 md:pt-0 md:pl-8 shrink-0 w-full md:w-auto">
        <button
          type="button"
          onClick={() => onSelectFilter && onSelectFilter(selectedFilter === 'verified' ? undefined : 'verified')}
          className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
            selectedFilter === 'verified'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Đã mua hàng ({summary.verifiedReviewCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectFilter && onSelectFilter(selectedFilter === 'media' ? undefined : 'media')}
          className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
            selectedFilter === 'media'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-blue-600" />
          <span>Có ảnh / video ({summary.mediaReviewCount})</span>
        </button>

        {(selectedRating !== undefined || selectedFilter !== undefined) && (
          <button
            type="button"
            onClick={() => {
              if (onSelectRating) onSelectRating(undefined);
              if (onSelectFilter) onSelectFilter(undefined);
            }}
            className="text-xs text-amber-700 hover:text-red-600 font-bold underline text-center py-1 cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>
    </div>
  );
};

export default RatingSummary;
