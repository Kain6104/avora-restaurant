'use strict';
'use client';

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReviewReactionButtonsProps {
  reviewId: string;
  initialLikeCount?: number;
  initialDislikeCount?: number;
  initialUserReaction?: 'LIKE' | 'DISLIKE' | null;
  isOwner?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const ReviewReactionButtons: React.FC<ReviewReactionButtonsProps> = ({
  reviewId,
  initialLikeCount = 0,
  initialDislikeCount = 0,
  initialUserReaction = null,
  isOwner = false,
}) => {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [userReaction, setUserReaction] = useState<'LIKE' | 'DISLIKE' | null>(initialUserReaction);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReaction = async (type: 'LIKE' | 'DISLIKE') => {
    if (isOwner) {
      toast.error('Bạn không thể thích hoặc không thích đánh giá của chính mình');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Vui lòng đăng nhập để tương tác với đánh giá này');
      return;
    }

    if (isSubmitting) return;

    // Snapshot current state for rollback
    const prevReaction = userReaction;
    const prevLikes = likeCount;
    const prevDislikes = dislikeCount;

    // Optimistic Update
    if (prevReaction === type) {
      // Toggle off
      setUserReaction(null);
      if (type === 'LIKE') setLikeCount((c) => Math.max(0, c - 1));
      else setDislikeCount((c) => Math.max(0, c - 1));
    } else if (prevReaction && prevReaction !== type) {
      // Switch reaction
      setUserReaction(type);
      if (type === 'LIKE') {
        setLikeCount((c) => c + 1);
        setDislikeCount((c) => Math.max(0, c - 1));
      } else {
        setDislikeCount((c) => c + 1);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    } else {
      // New reaction
      setUserReaction(type);
      if (type === 'LIKE') setLikeCount((c) => c + 1);
      else setDislikeCount((c) => c + 1);
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/product-reviews/${reviewId}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || 'Lỗi gửi tương tác');
      }

      // Sync exact counts from backend response
      if (data.data) {
        setLikeCount(data.data.likeCount);
        setDislikeCount(data.data.dislikeCount);
        setUserReaction(data.data.userReaction);
      }
    } catch (err: any) {
      // Rollback on error
      setUserReaction(prevReaction);
      setLikeCount(prevLikes);
      setDislikeCount(prevDislikes);
      toast.error(err?.message || 'Không thể thực hiện tương tác');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Nút Like */}
      <button
        type="button"
        disabled={isOwner}
        onClick={() => handleReaction('LIKE')}
        aria-pressed={userReaction === 'LIKE'}
        aria-label={`Thích (${likeCount})`}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
          userReaction === 'LIKE'
            ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-xs'
            : 'bg-neutral-50 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
        } ${isOwner ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <ThumbsUp
          className={`w-3.5 h-3.5 ${userReaction === 'LIKE' ? 'fill-amber-500 text-amber-600' : ''}`}
        />
        <span>{likeCount}</span>
      </button>

      {/* Nút Dislike */}
      <button
        type="button"
        disabled={isOwner}
        onClick={() => handleReaction('DISLIKE')}
        aria-pressed={userReaction === 'DISLIKE'}
        aria-label={`Không thích (${dislikeCount})`}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
          userReaction === 'DISLIKE'
            ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 border-neutral-400 dark:border-neutral-600 shadow-xs'
            : 'bg-neutral-50 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
        } ${isOwner ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <ThumbsDown
          className={`w-3.5 h-3.5 ${userReaction === 'DISLIKE' ? 'fill-neutral-600 text-neutral-700' : ''}`}
        />
        <span>{dislikeCount}</span>
      </button>
    </div>
  );
};

export default ReviewReactionButtons;
