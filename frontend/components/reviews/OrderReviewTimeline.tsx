'use strict';
'use client';

import React, { useState } from 'react';
import { UtensilsCrossed, MessageSquarePlus, Clock, CheckCircle2, Star } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import OrderReviewReadonlyCard from './OrderReviewReadonlyCard';
import ReviewMediaViewer from './ReviewMediaViewer';
import OrderReviewFollowUpComposer from './OrderReviewFollowUpComposer';

dayjs.extend(utc);
dayjs.extend(timezone);

interface OrderReviewTimelineProps {
  orderReview: any;
  daysRemaining: number;
  isExpired: boolean;
  onFollowUpAdded: (newFollowUp: any) => void;
}

export const OrderReviewTimeline: React.FC<OrderReviewTimelineProps> = ({
  orderReview,
  daysRemaining,
  isExpired,
  onFollowUpAdded,
}) => {
  if (!orderReview) return null;

  const followUps = orderReview.followUps || [];
  const reply = orderReview.reply;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 1. Đánh giá chính (Readonly Card) */}
      <OrderReviewReadonlyCard review={orderReview} />

      {/* 2. Timeline các phản hồi bổ sung & phản hồi của AVORA */}
      {(followUps.length > 0 || reply) && (
        <div className="relative pl-4 sm:pl-6 space-y-2.5 sm:space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-amber-200">
          {/* Follow-up entries */}
          {followUps.map((fu: any, idx: number) => (
            <div key={fu.id || idx} className="relative space-y-1.5">
              <div className="absolute -left-4 sm:-left-6 top-1 w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center border-2 border-white shadow-2xs">
                <MessageSquarePlus className="w-2.5 h-2.5" />
              </div>

              <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-amber-50/50 via-white to-orange-50/20 border border-amber-200/80 shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-amber-950">
                    Phản hồi bổ sung từ bạn #{idx + 1}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
                    {dayjs(fu.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {fu.content}
                </p>
                {fu.media && fu.media.length > 0 && (
                  <ReviewMediaViewer media={fu.media} className="mt-2" />
                )}
              </div>
            </div>
          ))}

          {/* AVORA Response */}
          {reply && (
            <div className="relative space-y-1.5">
              <div className="absolute -left-4 sm:-left-6 top-1 w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border-2 border-white shadow-2xs">
                <UtensilsCrossed className="w-2.5 h-2.5" />
              </div>

              <div className="p-3 sm:p-4 rounded-xl bg-emerald-50/60 border-l-4 border-emerald-500 border border-emerald-200/70 shadow-2xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                      Phản hồi từ AVORA Restaurant
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-emerald-600/70 font-mono">
                    {dayjs(reply.createdAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm')}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {reply.content}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Composer gửi phản hồi bổ sung nếu còn thời hạn */}
      {!isExpired && daysRemaining > 0 && (
        <OrderReviewFollowUpComposer
          orderReviewId={orderReview.id}
          daysRemaining={daysRemaining}
          onSuccess={onFollowUpAdded}
        />
      )}
    </div>
  );
};

export default OrderReviewTimeline;
