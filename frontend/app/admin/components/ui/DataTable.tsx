'use client';

import React from 'react';
import EmptyState from './EmptyState';
import { TableSkeleton } from './LoadingSkeleton';
import MobileDataCard from './MobileDataCard';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  headerClassName?: string;
  mobileHidden?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  mobileCardRender?: (item: T, index: number) => React.ReactNode;
  stickyHeader?: boolean;
  onRowClick?: (item: T) => void;
  className?: string;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyIcon,
  mobileCardRender,
  stickyHeader = true,
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  if (loading) {
    return <TableSkeleton rows={6} cols={columns.length} />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        icon={emptyIcon}
      />
    );
  }

  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile view (< md / 768px): Card layout */}
      <div className="md:hidden space-y-2.5">
        {data.map((item, index) => {
          if (mobileCardRender) {
            return (
              <React.Fragment key={keyExtractor(item, index)}>
                {mobileCardRender(item, index)}
              </React.Fragment>
            );
          }

          // Fallback automatic mobile card
          const firstCol = columns[0];
          const secondCol = columns[1];
          const remainingCols = columns.slice(2);

          const title = firstCol.render
            ? firstCol.render(item, index)
            : String((item as any)[firstCol.key] || '');

          const subtitle = secondCol
            ? secondCol.render
              ? secondCol.render(item, index)
              : String((item as any)[secondCol.key] || '')
            : undefined;

          const details = remainingCols
            .filter((c) => !c.mobileHidden)
            .map((c) => ({
              label: typeof c.header === 'string' ? c.header : c.key,
              value: c.render ? c.render(item, index) : String((item as any)[c.key] || ''),
            }));

          return (
            <MobileDataCard
              key={keyExtractor(item, index)}
              title={title}
              subtitle={subtitle}
              details={details}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            />
          );
        })}
      </div>

      {/* Desktop view (>= md / 768px): Full Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead
              className={`bg-slate-50/80 border-b border-slate-100/90 text-slate-500 font-bold uppercase text-[11px] tracking-wider ${
                stickyHeader ? 'sticky top-0 z-10 backdrop-blur-xs' : ''
              }`}
            >
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`px-4 sm:px-5 py-3.5 ${getAlignClass(col.align)} ${
                      col.headerClassName || ''
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item, index) => (
                <tr
                  key={keyExtractor(item, index)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={`hover:bg-slate-50/60 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 sm:px-5 py-3.5 text-slate-700 font-medium ${getAlignClass(
                        col.align
                      )} ${col.className || ''}`}
                    >
                      {col.render
                        ? col.render(item, index)
                        : String((item as any)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
