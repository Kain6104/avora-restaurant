'use strict';
'use client';

import React from 'react';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface VerifiedPurchaseBadgeProps {
  isVerifiedPurchase?: boolean;
  purchasedAt?: string | Date | null;
  className?: string;
}

export const VerifiedPurchaseBadge: React.FC<VerifiedPurchaseBadgeProps> = ({
  isVerifiedPurchase,
  purchasedAt,
  className = '',
}) => {
  if (isVerifiedPurchase) {
    const formattedDate = purchasedAt
      ? dayjs(purchasedAt).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY')
      : null;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ${className}`}
        title={formattedDate ? `Đã mua hàng và hoàn thành đơn vào ngày ${formattedDate}` : 'Đã mua hàng tại AVORA'}
      >
        <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>
          Đã mua hàng tại AVORA{formattedDate ? ` ngày ${formattedDate}` : ''}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 ${className}`}
      title="Khách hàng thành viên AVORA"
    >
      <ShieldCheck className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
      <span>Thành viên AVORA</span>
    </span>
  );
};

export default VerifiedPurchaseBadge;
