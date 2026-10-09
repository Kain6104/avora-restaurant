'use client';

import React from 'react';

/**
 * Premium Light Table Skeleton
 * Thiết kế sạch sẽ, nền xám/trắng siêu nhạt, tương thích mobile không giật layout
 */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full bg-white rounded-xl sm:rounded-2xl border border-slate-100/90 overflow-hidden shadow-2xs animate-pulse">
      <div className="h-10 sm:h-12 bg-slate-50/80 border-b border-slate-100 px-3 sm:px-5 flex items-center justify-between">
        <div className="h-3.5 bg-slate-200/60 rounded-md w-1/4"></div>
        <div className="h-3.5 bg-slate-200/50 rounded-md w-1/6"></div>
      </div>
      <div className="divide-y divide-slate-100/80">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-3 sm:px-5 py-2.5 sm:py-3.5 flex items-center gap-3 sm:gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-3 sm:h-3.5 bg-slate-100 rounded-md"
                style={{ width: `${Math.max(15, 100 / cols - 5)}%` }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Premium Light Card Skeleton
 * Padding tối thiểu trên mobile, bo góc êm ái
 */
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl sm:rounded-2xl border border-slate-100/90 p-2.5 sm:p-4 shadow-2xs animate-pulse space-y-2.5"
        >
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-3 bg-slate-100 rounded w-16 sm:w-20"></div>
              <div className="h-5 sm:h-6 bg-slate-200/70 rounded-md w-24 sm:w-32"></div>
            </div>
            <div className="w-7 h-7 sm:w-9 sm:h-9 bg-slate-100 rounded-lg sm:rounded-xl shrink-0"></div>
          </div>
          <div className="h-2.5 bg-slate-100/80 rounded w-20"></div>
        </div>
      ))}
    </div>
  );
}

/**
 * Premium Light Chart Skeleton
 */
export function ChartSkeleton({ height = 'h-64 sm:h-72' }: { height?: string }) {
  return (
    <div
      className={`w-full bg-white rounded-xl sm:rounded-2xl border border-slate-100/90 p-3 sm:p-5 shadow-2xs animate-pulse flex flex-col justify-between ${height}`}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="h-3.5 bg-slate-200/60 rounded-md w-28 sm:w-36"></div>
        <div className="h-3 bg-slate-100 rounded w-16 sm:w-20"></div>
      </div>
      <div className="flex-1 bg-slate-50/60 rounded-xl flex items-end justify-between p-3 sm:p-4 gap-1.5 sm:gap-2">
        {[35, 60, 25, 80, 45, 90, 55, 70, 40, 75].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-200/60 rounded-t-md transition-all"
            style={{ height: `${h}%` }}
          ></div>
        ))}
      </div>
    </div>
  );
}

interface LoadingSkeletonProps {
  variant?: 'table' | 'card' | 'chart';
  rows?: number;
  cols?: number;
  count?: number;
  height?: string;
}

export default function LoadingSkeleton({
  variant = 'table',
  rows,
  cols,
  count,
  height,
}: LoadingSkeletonProps) {
  if (variant === 'card') return <CardSkeleton count={count} />;
  if (variant === 'chart') return <ChartSkeleton height={height} />;
  return <TableSkeleton rows={rows} cols={cols} />;
}
