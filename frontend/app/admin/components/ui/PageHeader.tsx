'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  badge,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-1 sm:pb-2 ${className}`}
    >
      <div className="space-y-1 min-w-0">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1.5 overflow-x-auto whitespace-nowrap">
            <Link
              href="/admin/dashboard"
              className="hover:text-red-600 transition-colors flex items-center gap-1"
            >
              <Home size={13} />
              <span>Admin</span>
            </Link>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight size={12} className="text-slate-300 shrink-0" />
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-red-600 transition-colors truncate max-w-[150px]"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-slate-600 font-semibold truncate max-w-[200px]">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Title + Badge */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            {title}
          </h1>
          {badge && <div>{badge}</div>}
        </div>

        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      {actions && (
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">{actions}</div>
      )}
    </div>
  );
}
