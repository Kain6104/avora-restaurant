import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
  itemName?: string;
}

export default function Pagination({ currentPage, totalPages, totalItems, onPageChange, itemName = 'mục' }: PaginationProps) {
  if (totalPages <= 1) return null;
  
  return (
    <div className="p-4 border-t flex items-center justify-between">
      <span className="text-sm text-gray-500">
        Trang {currentPage} / {totalPages} {totalItems !== undefined ? `· ${totalItems} ${itemName}` : ''}
      </span>
      <div className="flex gap-2">
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
        >
          ← Trước
        </button>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
        >
          Tiếp →
        </button>
      </div>
    </div>
  );
}
