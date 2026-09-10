'use client';

import React from 'react';

interface MobileDataCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  avatar?: React.ReactNode;
  details?: { label: string; value: React.ReactNode }[];
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function MobileDataCard({
  title,
  subtitle,
  badge,
  avatar,
  details = [],
  actions,
  onClick,
  className = '',
}: MobileDataCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-3.5 sm:p-4 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-slate-300' : ''
      } ${className}`}
    >
      {/* Top row: Avatar + Title & Subtitle + Badge */}
      <div className="flex items-start justify-between gap-2.5 pb-2.5 border-b border-slate-50">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {avatar && <div className="shrink-0">{avatar}</div>}
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm text-slate-900 truncate">{title}</div>
            {subtitle && (
              <div className="text-xs text-slate-500 font-normal mt-0.5 truncate">{subtitle}</div>
            )}
          </div>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Details Grid */}
      {details.length > 0 && (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 py-2.5 text-xs">
          {details.map((item, idx) => (
            <div key={idx} className="min-w-0">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                {item.label}
              </span>
              <div className="font-semibold text-slate-700 truncate mt-0.5">{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions footer */}
      {actions && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-50">
          {actions}
        </div>
      )}
    </div>
  );
}
