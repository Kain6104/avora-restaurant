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
    <div className="bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30 p-3 sm:p-5 rounded-2xl border border-amber-200/70 shadow-2xs flex flex-col md:flex-row gap-3 sm:gap-6 md:gap-8 items-center md:items-stretch">
      {/* Cột Điểm trung bình */}
      <div className="flex md:flex-col items-center justify-between md:justify-center w-full md:w-auto min-w-0 md:min-w-[160px] border-b md:border-b-0 md:border-r border-amber-100 pb-3 md:pb-0 md:pr-6 shrink-0">
        <div className="flex items-center md:flex-col gap-2.5 md:gap-1">
          <div className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-500 tracking-tight font-serif drop-shadow-2xs">
            {summary.avgRating > 0 ? summary.avgRating.toFixed(1) : '0.0'}
          </div>
          <div className="flex flex-col md:items-center">
            <RatingStars rating={summary.avgRating} size="sm" />
            <p className="text-[10px] sm:text-xs font-bold text-amber-900/70 mt-0.5">
              {total > 0 ? `${total} đánh giá` : 'Chưa có đánh giá'}
            </p>
          </div>
        </div>

        {/* Quick Filter Badges for Mobile in header */}
        <div className="flex md:hidden items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectFilter && onSelectFilter(selectedFilter === 'verified' ? undefined : 'verified')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all cursor-pointer ${
              selectedFilter === 'verified'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-emerald-800 border-emerald-200'
            }`}
          >
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Đã mua ({summary.verifiedReviewCount})</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectFilter && onSelectFilter(selectedFilter === 'media' ? undefined : 'media')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all cursor-pointer ${
              selectedFilter === 'media'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-blue-800 border-blue-200'
            }`}
          >
            <ImageIcon className="w-3 h-3 text-blue-600" />
            <span>Có ảnh ({summary.mediaReviewCount})</span>
          </button>
        </div>
      </div>

      {/* Cột Phân bố sao */}
      <div className="flex-1 w-full flex flex-col justify-center gap-1">
        {starsDistribution.map(({ star, count }) => {
          const pct = getPercentage(count);
          const isSelected = selectedRating === star;

          return (
            <button
              key={star}
              type="button"
              onClick={() => onSelectRating && onSelectRating(isSelected ? undefined : star)}
              className={`flex items-center gap-2 w-full group py-0.5 px-2 rounded-lg transition-all text-left cursor-pointer ${
                isSelected
                  ? 'bg-amber-100 text-amber-900 font-bold'
                  : 'hover:bg-amber-50/80 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-0.5 w-8 text-[11px] sm:text-xs font-bold shrink-0 text-amber-950">
                <span>{star}</span>
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
              </div>

              {/* Thanh tiến trình phân bố */}
              <div className="flex-1 h-1.5 sm:h-2 bg-amber-100/70 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isSelected ? 'bg-amber-500' : 'bg-gradient-to-r from-amber-400 to-yellow-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="w-12 text-right text-[10px] sm:text-xs font-medium text-slate-500 shrink-0 font-mono">
                {count} <span className="text-[9px] text-slate-400 font-normal">({pct}%)</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Filter Badges for Desktop */}
      <div className="hidden md:flex flex-col justify-center gap-2 border-l border-amber-100 pl-6 shrink-0">
        <button
          type="button"
          onClick={() => onSelectFilter && onSelectFilter(selectedFilter === 'verified' ? undefined : 'verified')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            selectedFilter === 'verified'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Đã mua hàng ({summary.verifiedReviewCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectFilter && onSelectFilter(selectedFilter === 'media' ? undefined : 'media')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            selectedFilter === 'media'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
          <span>Có ảnh / video ({summary.mediaReviewCount})</span>
        </button>

        {(selectedRating !== undefined || selectedFilter !== undefined) && (
          <button
            type="button"
            onClick={() => {
              if (onSelectRating) onSelectRating(undefined);
              if (onSelectFilter) onSelectFilter(undefined);
            }}
            className="text-[11px] text-amber-700 hover:text-red-600 font-bold underline text-center py-0.5 cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>
    </div>
  );
};

export default RatingSummary;
