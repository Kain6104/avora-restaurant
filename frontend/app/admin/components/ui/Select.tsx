'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  placeholder?: string;
  className?: string;
  sizeVariant?: 'sm' | 'md' | 'lg';
}

export default function Select({
  options,
  placeholder,
  className = '',
  sizeVariant = 'md',
  ...props
}: SelectProps) {
  const sizeClasses = {
    sm: 'h-8 text-xs pl-2.5 pr-7',
    md: 'h-9 sm:h-10 text-xs sm:text-sm pl-3 pr-8',
    lg: 'h-11 text-sm pl-3.5 pr-9',
  }[sizeVariant];

  return (
    <div className="relative inline-block w-full">
      <select
        className={`w-full appearance-none bg-white hover:bg-slate-50 text-slate-800 font-medium rounded-xl border border-slate-200/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all cursor-pointer shadow-xs ${sizeClasses} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
        <ChevronDown size={14} strokeWidth={2} />
      </div>
    </div>
  );
}
