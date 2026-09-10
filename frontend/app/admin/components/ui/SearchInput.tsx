'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showShortcut?: boolean;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  onClear,
  className = '',
  size = 'md',
  showShortcut = false,
}: SearchInputProps) {
  const sizeClasses = {
    sm: 'h-8 text-xs pl-8 pr-7',
    md: 'h-9 sm:h-10 text-xs sm:text-sm pl-9 pr-8',
    lg: 'h-11 text-sm pl-10 pr-9',
  }[size];

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  }[size];

  const handleClear = () => {
    onChange('');
    if (onClear) onClear();
  };

  return (
    <div className={`relative flex items-center w-full min-w-0 ${className}`}>
      <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
        <Search size={iconSizes} strokeWidth={2} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-slate-50/80 hover:bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-400 font-medium rounded-xl border border-slate-200/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all duration-150 ${sizeClasses}`}
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Xóa nội dung tìm kiếm"
          className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      ) : showShortcut ? (
        <span className="hidden sm:inline-flex items-center absolute right-2.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-md pointer-events-none">
          Ctrl K
        </span>
      ) : null}
    </div>
  );
}
