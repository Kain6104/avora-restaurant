"use client";

import React, { useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { PosCategory } from './pos-types';

interface TouchCategorySidebarProps {
  categories: PosCategory[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  className?: string;
  isDarkMode?: boolean;
}

export const TouchCategorySidebar: React.FC<TouchCategorySidebarProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  className = '',
  isDarkMode = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: offset, behavior: 'smooth' });
    }
  };

  return (
    <div
      className={`w-[145px] sm:w-[160px] md:w-[175px] border-r flex flex-col shrink-0 select-none h-full z-10 transition-colors ${
        isDarkMode
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
      } ${className}`}
    >
      {/* 1. Category Scroll Controls at Top */}
      <div className={`grid grid-cols-2 border-b shrink-0 ${
        isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
      }`}>
        <button
          type="button"
          onClick={() => handleScroll(-160)}
          className={`h-12 flex items-center justify-center border-r transition-colors cursor-pointer ${
            isDarkMode
              ? 'border-slate-700 hover:bg-slate-700 active:bg-slate-600 text-slate-200'
              : 'border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700'
          }`}
          title="Cuộn lên"
        >
          <ChevronUp className="w-5 h-5 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={() => handleScroll(160)}
          className={`h-12 flex items-center justify-center transition-colors cursor-pointer ${
            isDarkMode
              ? 'hover:bg-slate-700 active:bg-slate-600 text-slate-200'
              : 'hover:bg-slate-100 active:bg-slate-200 text-slate-700'
          }`}
          title="Cuộn xuống"
        >
          <ChevronDown className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* 2. Vertical Category Buttons List */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto no-scrollbar flex flex-col divide-y min-h-0 ${
          isDarkMode ? 'divide-slate-800' : 'divide-slate-200'
        }`}
      >
        {/* 'ALL' Category Button */}
        <button
          type="button"
          onClick={() => onSelectCategory('ALL')}
          className={`min-h-[64px] sm:min-h-[70px] px-3 py-2.5 text-center flex items-center justify-center text-xs sm:text-sm font-black uppercase tracking-tight transition-all cursor-pointer ${
            selectedCategoryId === 'ALL'
              ? 'bg-[#da251d] text-white shadow-inner font-black'
              : isDarkMode
              ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 active:bg-slate-700'
              : 'bg-white text-slate-700 hover:bg-red-50/50 hover:text-[#da251d] active:bg-slate-100'
          }`}
        >
          TẤT CẢ
        </button>

        {/* Dynamic Categories */}
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`min-h-[64px] sm:min-h-[70px] px-3 py-2.5 text-center flex items-center justify-center text-xs sm:text-sm font-black uppercase tracking-tight leading-snug transition-all cursor-pointer break-words ${
                isSelected
                  ? 'bg-[#da251d] text-white shadow-inner font-black'
                  : isDarkMode
                  ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 active:bg-slate-700'
                  : 'bg-white text-slate-700 hover:bg-red-50/50 hover:text-[#da251d] active:bg-slate-100'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
