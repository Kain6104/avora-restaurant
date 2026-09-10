'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  LayoutDashboard,
  BarChart3,
  Receipt,
  Layers,
} from 'lucide-react';

export default function AdminBottomNav() {
  const pathname = usePathname();
  const { toggleMobileSidebar, selectedBranchId } = useAdmin();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const url = new URL('/api/admin/orders/unread-count', window.location.origin);
        if (selectedBranchId && selectedBranchId !== 'ALL') {
          url.searchParams.set('branchId', selectedBranchId);
        }
        const res = await fetch(url.toString(), { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.data || 0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [selectedBranchId]);

  const navTabs = [
    {
      href: '/admin/dashboard',
      label: t('nav.dashboard', 'Tổng quan'),
      icon: LayoutDashboard,
      active: pathname === '/admin/dashboard' || pathname === '/admin',
    },
    {
      href: '/admin/reports',
      label: t('nav.reports', 'Báo cáo'),
      icon: BarChart3,
      active: pathname.startsWith('/admin/reports'),
    },
    {
      href: '/admin/orders',
      label: t('nav.orders', 'Đơn hàng'),
      icon: Receipt,
      active: pathname.startsWith('/admin/orders'),
      badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : null,
    },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around">
      {navTabs.map((tab, idx) => {
        const Icon = tab.icon;
        return (
          <Link
            key={idx}
            href={tab.href}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl relative transition-all duration-150 ${
              tab.active ? 'text-red-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Icon size={20} strokeWidth={tab.active ? 2.5 : 2} />
              {tab.badge && (
                <span className="absolute -top-1 -right-2.5 min-w-4 h-4 px-1 bg-red-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border border-white">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
            {tab.active && (
              <span className="absolute bottom-0.5 w-6 h-0.5 bg-red-600 rounded-full" />
            )}
          </Link>
        );
      })}

      {/* 4th Tab: "Tính năng" -> Open full navigation drawer */}
      <button
        type="button"
        onClick={toggleMobileSidebar}
        className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
      >
        <Layers size={20} strokeWidth={2} />
        <span className="text-[10px] tracking-tight mt-0.5">Tính năng</span>
      </button>
    </div>
  );
}
