'use client';

import React from 'react';

interface FilterBarProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export default function FilterBar({ children, actions, className = '' }: FilterBarProps) {
  return (
    <div
      className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
        {children}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          {actions}
        </div>
      )}
    </div>
  );
}
