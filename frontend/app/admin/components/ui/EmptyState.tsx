'use client';

import React from 'react';
import { PackageOpen } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title = 'Không có dữ liệu',
  description = 'Chưa có thông tin phù hợp với bộ lọc hiện tại hoặc dữ liệu chưa được khởi tạo.',
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 sm:p-10 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 ${className}`}
    >
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 mb-3 sm:mb-4">
        {icon || <PackageOpen size={28} strokeWidth={1.5} />}
      </div>
      <h4 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
        {title}
      </h4>
      {description && (
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-1 mb-4 font-normal">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
