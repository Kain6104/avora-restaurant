'use strict';
'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface RatingStarsProps {
  rating: number;
  maxStars?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showValue?: boolean;
  className?: string;
  id?: string;
}

export const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  maxStars = 5,
  interactive = false,
  onChange,
  size = 'md',
  showValue = false,
  className = '',
  id,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const starSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  const currentRating = hoverRating !== null ? hoverRating : rating;

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (!interactive || !onChange) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(index);
    } else if (e.key === 'ArrowRight' && index < maxStars) {
      e.preventDefault();
      onChange(index + 1);
    } else if (e.key === 'ArrowLeft' && index > 1) {
      e.preventDefault();
      onChange(index - 1);
    }
  };

  return (
    <div
      id={id}
      className={`inline-flex items-center gap-1 ${className}`}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`Đánh giá: ${rating} trên ${maxStars} sao`}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxStars }, (_, i) => {
          const starIndex = i + 1;
          const isFilled = starIndex <= Math.round(currentRating);

          if (interactive) {
            return (
              <button
                key={starIndex}
                type="button"
                role="radio"
                aria-checked={rating === starIndex}
                aria-label={`${starIndex} sao`}
                tabIndex={0}
                className="p-1 rounded transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-500 text-amber-500 cursor-pointer"
                onClick={() => onChange && onChange(starIndex)}
                onMouseEnter={() => setHoverRating(starIndex)}
                onMouseLeave={() => setHoverRating(null)}
                onKeyDown={(e) => handleKeyDown(starIndex, e)}
              >
                <Star
                  className={`${starSizes[size]} transition-colors ${
                    isFilled ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-transparent'
                  }`}
                />
              </button>
            );
          }

          return (
            <span key={starIndex} className="inline-block">
              <Star
                className={`${starSizes[size]} ${
                  isFilled ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-transparent'
                }`}
              />
            </span>
          );
        })}
      </div>
      {showValue && (
        <span className="ml-1 text-sm font-black text-amber-500">
          {rating > 0 ? rating.toFixed(1) : '0'}
        </span>
      )}
    </div>
  );
};
export default RatingStars;
