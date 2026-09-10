'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { AdminProvider } from '@/contexts/AdminContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { NotificationRealtimeProvider } from '@/contexts/NotificationRealtimeProvider';
import AdminHeader from './components/AdminHeader';
import AdminSidebar from './components/AdminSidebar';
import AdminBottomNav from './components/AdminBottomNav';
import AdminFooter from './components/AdminFooter';
import { AdminPageGuard } from '@/components/AdminPageGuard';

/**
 * Danh mục ánh xạ toàn diện 100% route trong /admin/* sang Permission bắt buộc
 */
export const ADMIN_ROUTE_PERMISSIONS: { pattern: RegExp; permission: string }[] = [
  // POS & KDS & Waiter
  { pattern: /^\/admin\/pos\/waiter/, permission: 'waiter.access' },
  { pattern: /^\/admin\/pos/, permission: 'pos.access' },
  { pattern: /^\/admin\/kds/, permission: 'kds.access' },

  // Overview
  { pattern: /^\/admin\/dashboard/, permission: 'dashboard.view' },
  { pattern: /^\/admin\/reports\/products/, permission: 'reports.products.view' },
  { pattern: /^\/admin\/reports/, permission: 'reports.view' },

  // Sales
  { pattern: /^\/admin\/orders/, permission: 'orders.view' },
  { pattern: /^\/admin\/reservations/, permission: 'reservations.view' },
  { pattern: /^\/admin\/tables/, permission: 'tables.view' },

  // Catalog
  { pattern: /^\/admin\/products\/create/, permission: 'products.create' },
  { pattern: /^\/admin\/products\/.*\/edit/, permission: 'products.update' },
  { pattern: /^\/admin\/products/, permission: 'products.view' },
  { pattern: /^\/admin\/categories/, permission: 'categories.view' },
  { pattern: /^\/admin\/combos/, permission: 'combos.view' },

  // People
  { pattern: /^\/admin\/roles\/new/, permission: 'roles.create' },
  { pattern: /^\/admin\/roles/, permission: 'roles.view' },
  { pattern: /^\/admin\/users\/create/, permission: 'staff.create' },
  { pattern: /^\/admin\/users/, permission: 'staff.view' },
  { pattern: /^\/admin\/memberships/, permission: 'membership.view' },

  // Promotions & Marketing
  { pattern: /^\/admin\/articles\/create/, permission: 'articles.create' },
  { pattern: /^\/admin\/articles\/.*\/edit/, permission: 'articles.update' },
  { pattern: /^\/admin\/articles\/comments/, permission: 'comments.view' },
  { pattern: /^\/admin\/articles/, permission: 'articles.view' },
  { pattern: /^\/admin\/vouchers\/create/, permission: 'vouchers.create' },
  { pattern: /^\/admin\/vouchers\/.*\/edit/, permission: 'vouchers.update' },
  { pattern: /^\/admin\/vouchers\/edit/, permission: 'vouchers.update' },
  { pattern: /^\/admin\/vouchers\/.*\/notify/, permission: 'vouchers.update' },
  { pattern: /^\/admin\/vouchers/, permission: 'vouchers.view' },
  { pattern: /^\/admin\/flash-sales/, permission: 'flashsales.view' },
  { pattern: /^\/admin\/banners/, permission: 'vouchers.view' },

  // System
  { pattern: /^\/admin\/branches/, permission: 'branches.view' },
  { pattern: /^\/admin\/operating-slots/, permission: 'operating_slots.view' },
  { pattern: /^\/admin\/payment-methods/, permission: 'payment_methods.view' },
  { pattern: /^\/admin\/settings\/print-templates/, permission: 'print_templates.view' },
  { pattern: /^\/admin\/settings\/kitchen-printers/, permission: 'kitchen_settings.view' },
  { pattern: /^\/admin\/settings/, permission: 'settings.general.view' },
  { pattern: /^\/admin\/audit-logs/, permission: 'audit_logs.view' },
];

function RoutePermissionEnforcer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';

  const requiredPermission = useMemo(() => {
    // /admin is the command center portal hub, accessible to all authenticated staff
    if (pathname === '/admin') {
      return undefined;
    }

    for (const entry of ADMIN_ROUTE_PERMISSIONS) {
      if (entry.pattern.test(pathname)) {
        return entry.permission;
      }
    }
    // Default fallback for any unspecified /admin/* route
    return 'admin.access';
  }, [pathname]);

  return <AdminPageGuard permission={requiredPermission}>{children}</AdminPageGuard>;
}

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPosOrKds = pathname?.startsWith('/admin/pos') || pathname?.startsWith('/admin/kds');

  if (isPosOrKds) {
    return (
      <LanguageProvider>
        <AdminProvider>
          <NotificationRealtimeProvider>
            <div className="min-h-screen w-full max-w-[100vw] bg-gray-100 overflow-hidden select-none font-sans text-slate-800">
              <RoutePermissionEnforcer>
                {children}
              </RoutePermissionEnforcer>
            </div>
          </NotificationRealtimeProvider>
        </AdminProvider>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <AdminProvider>
        <NotificationRealtimeProvider>
          <div className="flex min-h-screen bg-slate-50/70 text-slate-800">
            {/* Unified Sidebar */}
            <AdminSidebar />

            {/* Main Application Area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Unified Fixed Sticky Header */}
              <AdminHeader />

              {/* Page Content Container */}
              <main className="flex-1 px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 pb-20 lg:pb-8 max-w-[1600px] w-full mx-auto">
                <RoutePermissionEnforcer>
                  {children}
                </RoutePermissionEnforcer>
              </main>

              {/* Unified Localized Footer */}
              <AdminFooter />
            </div>

            {/* Mobile App Bottom Navigation */}
            <AdminBottomNav />
          </div>
        </NotificationRealtimeProvider>
      </AdminProvider>
    </LanguageProvider>
  );
}
