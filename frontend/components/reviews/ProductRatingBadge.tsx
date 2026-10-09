'use strict';
'use client';

import React from 'react';
import { Star } from 'lucide-react';

interface ProductRatingBadgeProps {
  avgRating?: number | null;
  ratingCount?: number | null;
  size?: 'sm' | 'md';
  showCount?: boolean;
  className?: string;
}

export const ProductRatingBadge: React.FC<ProductRatingBadgeProps> = ({
  avgRating,
  ratingCount = 0,
  size = 'sm',
  showCount = true,
  className = '',
}) => {
  const count = Number(ratingCount) || 0;
  const rating = Number(avgRating) || 0;

  const starSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  if (count === 0 || rating === 0) {
    return (
      <span
        className={`inline-flex items-center text-neutral-400 dark:text-neutral-500 font-medium ${textSize} ${className}`}
        title="Món ăn này chưa có đánh giá từ khách hàng"
      >
        Chưa có đánh giá
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 ${textSize} ${className}`}
      aria-label={`Đánh giá trung bình: ${rating.toFixed(1)} trên 5 sao từ ${count} lượt đánh giá`}
    >
      <span>{rating.toFixed(1)}</span>
      <Star className={`${starSize} fill-amber-400 text-amber-500`} aria-hidden="true" />
      {showCount && (
        <span className="text-neutral-500 dark:text-neutral-400 font-normal">
          ({count})
        </span>
      )}
    </div>
  );
};

export default ProductRatingBadge;
