'use client';

import React from 'react';

interface AdminCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  noPadding?: boolean;
}

export default function AdminCard({
  children,
  className = '',
  title,
  subtitle,
  icon,
  action,
  badge,
  noPadding = false,
}: AdminCardProps) {
  const hasHeader = title || subtitle || icon || action || badge;

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-200 ${className}`}
    >
      {hasHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-100/80">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="p-1.5 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight truncate">
                    {title}
                  </h3>
                  {badge && <div>{badge}</div>}
                </div>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 font-normal mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-3 sm:p-4 lg:p-5'}>{children}</div>
    </div>
  );
}
