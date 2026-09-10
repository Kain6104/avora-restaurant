'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  itemName?: string;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  itemName,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1 && !totalItems) return null;

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const startItem = totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const endItem =
    totalItems && pageSize ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 sm:pt-4 border-t border-slate-100 text-xs text-slate-500 font-medium ${className}`}
    >
      {/* Total count summary */}
      {totalItems !== undefined && (
        <div>
          {startItem && endItem ? (
            <span>
              Hiển thị <strong className="text-slate-800 font-bold">{startItem}</strong> -{' '}
              <strong className="text-slate-800 font-bold">{endItem}</strong> trên tổng{' '}
              <strong className="text-slate-800 font-bold">{totalItems}</strong> {itemName || 'kết quả'}
            </span>
          ) : (
            <span>
              Tổng số: <strong className="text-slate-800 font-bold">{totalItems}</strong> {itemName || 'kết quả'}
            </span>
          )}
        </div>
      )}

      {/* Page controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Trang trước"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} strokeWidth={2} />
          </button>

          {getPageNumbers().map((page, idx) =>
            typeof page === 'number' ? (
              <button
                key={idx}
                type="button"
                onClick={() => onPageChange(page)}
                className={`min-w-8 h-8 px-2 rounded-lg font-bold text-xs transition-all ${
                  currentPage === page
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            ) : (
              <span key={idx} className="px-1 text-slate-400">
                ...
              </span>
            )
          )}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Trang tiếp theo"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
