'use strict';
'use client';

import React from 'react';
import { Pencil, Trash2, MessageSquare, UtensilsCrossed } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import RatingStars from './RatingStars';
import VerifiedPurchaseBadge from './VerifiedPurchaseBadge';
import ReviewMediaViewer from './ReviewMediaViewer';
import ReviewReactionButtons from './ReviewReactionButtons';

dayjs.extend(utc);
dayjs.extend(timezone);

interface ProductReviewCardProps {
  review: {
    id: string;
    userId: string;
    rating: number;
    content: string;
    isVerifiedPurchase: boolean;
    purchasedAt?: string | null;
    createdAt: string;
    user?: {
      id: string;
      fullName?: string;
      avatarUrl?: string | null;
      membershipTier?: { name: string } | null;
    };
    media?: any[];
    likeCount?: number;
    dislikeCount?: number;
    userReaction?: 'LIKE' | 'DISLIKE' | null;
    reply?: {
      id: string;
      content: string;
      createdAt: string;
      admin?: { fullName?: string };
    } | null;
  };
  currentUserId?: string | null;
  onEdit?: (review: any) => void;
  onDelete?: (reviewId: string) => void;
}

export const ProductReviewCard: React.FC<ProductReviewCardProps> = ({
  review,
  currentUserId,
  onEdit,
  onDelete,
}) => {
  const isOwner = Boolean(currentUserId && currentUserId === review.userId);
  const formattedDate = dayjs(review.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY');
  const userInitials = (review.user?.fullName || 'Khách hàng')
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <article className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-100 shadow-2xs transition-shadow hover:shadow-xs">
      {/* Header card: User info & rating */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {review.user?.avatarUrl ? (
            <img
              src={review.user.avatarUrl}
              alt={review.user.fullName || 'Khách hàng'}
              className="w-10 h-10 rounded-full object-cover border border-amber-200/80 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center border border-amber-200 shrink-0">
              {userInitials || 'AV'}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">
                {review.user?.fullName || 'Khách hàng AVORA'}
              </span>

              {/* Membership Tier Badge */}
              {review.user?.membershipTier?.name && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {review.user.membershipTier.name}
                </span>
              )}

              {/* Verified Purchase Badge */}
              <VerifiedPurchaseBadge
                isVerifiedPurchase={review.isVerifiedPurchase}
                purchasedAt={review.purchasedAt}
              />
            </div>

            <div className="flex items-center gap-2 mt-1">
              <RatingStars rating={review.rating} size="sm" />
              <span className="text-xs font-black text-amber-500 font-mono">
                {review.rating.toFixed(1)}★
              </span>
              <span className="text-xs text-slate-400 font-mono">
                • {formattedDate}
              </span>
            </div>
          </div>
        </div>

        {/* Nút sửa / xóa dành riêng cho chính chủ review */}
        {isOwner && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(review)}
                className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                title="Chỉnh sửa đánh giá của bạn"
                aria-label="Chỉnh sửa đánh giá"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(review.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                title="Xóa đánh giá của bạn"
                aria-label="Xóa đánh giá"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Nội dung đánh giá */}
      <div className="mt-3 text-sm text-slate-700 leading-relaxed break-words whitespace-pre-wrap">
        {review.content}
      </div>

      {/* Media đính kèm (Ảnh & Video) */}
      {review.media && review.media.length > 0 && (
        <ReviewMediaViewer media={review.media} />
      )}

      {/* Footer: Like / Dislike reactions */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <ReviewReactionButtons
          reviewId={review.id}
          initialLikeCount={review.likeCount || 0}
          initialDislikeCount={review.dislikeCount || 0}
          initialUserReaction={review.userReaction || null}
          isOwner={isOwner}
        />
      </div>

      {/* Phản hồi chính thức từ AVORA (Admin Reply) */}
      {review.reply && (
        <div className="mt-4 p-4 rounded-xl bg-amber-50/60 border-l-4 border-amber-500 border border-amber-200/60">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1 bg-amber-500 text-white rounded-md">
              <UtensilsCrossed className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-amber-900 tracking-wide uppercase">
              Phản hồi từ AVORA
            </span>
            <span className="text-xs text-slate-400 font-mono ml-auto">
              {dayjs(review.reply.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY')}
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed pl-6 whitespace-pre-wrap">
            {review.reply.content}
          </p>
        </div>
      )}
    </article>
  );
};

export default ProductReviewCard;
