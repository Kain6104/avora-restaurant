'use client';

import React from 'react';

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm animate-pulse">
      <div className="h-12 bg-slate-50 border-b border-slate-100 px-4 sm:px-6 flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        <div className="h-4 bg-slate-200 rounded w-1/6"></div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 sm:px-6 py-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 bg-slate-100 rounded"
                style={{ width: `${Math.max(15, 100 / cols - 5)}%` }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm animate-pulse space-y-3"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1">
              <div className="h-3 bg-slate-200 rounded w-20"></div>
              <div className="h-6 bg-slate-200 rounded w-32"></div>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-xl"></div>
          </div>
          <div className="h-3 bg-slate-100 rounded w-24"></div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 'h-72' }: { height?: string }) {
  return (
    <div
      className={`w-full bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm animate-pulse flex flex-col justify-between ${height}`}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="h-4 bg-slate-200 rounded w-32"></div>
        <div className="h-4 bg-slate-100 rounded w-20"></div>
      </div>
      <div className="flex-1 bg-slate-50 rounded-xl flex items-end justify-between p-4 gap-2">
        {[40, 65, 30, 85, 50, 95, 60, 75, 45, 80].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-200 rounded-t"
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
