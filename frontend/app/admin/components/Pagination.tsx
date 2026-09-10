'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
  itemName?: string;
  pageSize?: number;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  itemName = 'mục',
  pageSize,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1 && !totalItems) return null;

  const startItem = totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const endItem =
    totalItems && pageSize ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <div
      className={`px-4 sm:px-5 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium ${className}`}
    >
      <div>
        {startItem && endItem ? (
          <span>
            Hiển thị <strong className="text-slate-800 font-bold">{startItem}</strong> -{' '}
            <strong className="text-slate-800 font-bold">{endItem}</strong> trên tổng{' '}
            <strong className="text-slate-800 font-bold">{totalItems}</strong> {itemName}
          </span>
        ) : (
          <span>
            Trang <strong className="text-slate-800 font-bold">{currentPage}</strong> /{' '}
            <strong className="text-slate-800 font-bold">{totalPages}</strong>{' '}
            {totalItems !== undefined && (
              <>
                · <strong className="text-slate-800 font-bold">{totalItems}</strong> {itemName}
              </>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Trang trước"
          className="flex items-center gap-1 px-3 py-1.5 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-2xs"
        >
          <ChevronLeft size={14} strokeWidth={2} />
          <span>Trước</span>
        </button>
        <div className="px-2 font-bold text-xs text-slate-700">
          {currentPage} / {totalPages}
        </div>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Trang tiếp theo"
          className="flex items-center gap-1 px-3 py-1.5 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-2xs"
        >
          <span>Tiếp</span>
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
