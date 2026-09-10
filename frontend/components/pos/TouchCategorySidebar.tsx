"use client";

import React, { useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { PosCategory } from './pos-types';

interface TouchCategorySidebarProps {
  categories: PosCategory[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  className?: string;
}

export const TouchCategorySidebar: React.FC<TouchCategorySidebarProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  className = '',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: offset, behavior: 'smooth' });
    }
  };

  return (
    <div
      className={`w-[105px] sm:w-[115px] bg-white border-r border-slate-200 flex flex-col shrink-0 select-none h-full z-10 ${className}`}
    >
      {/* 1. Category Scroll Controls at Top */}
      <div className="grid grid-cols-2 border-b border-slate-200 shrink-0 bg-slate-50">
        <button
          type="button"
          onClick={() => handleScroll(-140)}
          className="h-10 flex items-center justify-center border-r border-slate-200 hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
          title="Cuộn lên"
        >
          <ChevronUp className="w-5 h-5 text-slate-700 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={() => handleScroll(140)}
          className="h-10 flex items-center justify-center hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
          title="Cuộn xuống"
        >
          <ChevronDown className="w-5 h-5 text-slate-700 stroke-[2.5]" />
        </button>
      </div>

      {/* 2. Vertical Category Buttons List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto no-scrollbar flex flex-col divide-y divide-slate-200 min-h-0"
      >
        {/* 'ALL' Category Button */}
        <button
          type="button"
          onClick={() => onSelectCategory('ALL')}
          className={`min-h-[54px] px-2 py-2 text-center flex items-center justify-center text-xs font-black uppercase tracking-tight transition-all cursor-pointer ${
            selectedCategoryId === 'ALL'
              ? 'bg-[#da251d] text-white shadow-inner font-black'
              : 'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100'
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
              className={`min-h-[56px] px-2 py-2 text-center flex items-center justify-center text-[11px] sm:text-xs font-black uppercase tracking-tight leading-tight transition-all cursor-pointer break-words ${
                isSelected
                  ? 'bg-[#da251d] text-white shadow-inner font-black'
                  : 'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100'
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
