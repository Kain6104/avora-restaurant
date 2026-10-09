'use client';

import React, { useMemo, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminProvider } from '@/contexts/AdminContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { NotificationRealtimeProvider } from '@/contexts/NotificationRealtimeProvider';
import dynamic from 'next/dynamic';
import AdminHeader from './components/AdminHeader';
import AdminBottomNav from './components/AdminBottomNav';
import AdminFooter from './components/AdminFooter';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { platformBridge } from '@/lib/platform/platform-bridge';
import toast from 'react-hot-toast';
import TopProgressBar from './components/ui/TopProgressBar';

// Client-only dynamic import for AdminSidebar to bypass SSR hydration diffing
const AdminSidebar = dynamic(() => import('./components/AdminSidebar'), {
  ssr: false,
  loading: () => (
    <aside className="hidden md:flex flex-col shrink-0 h-full w-64 border-r border-slate-200 bg-white z-30 shadow-xs select-none">
      <div className="h-16 px-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="h-8 w-28 bg-slate-100 rounded-lg animate-pulse" />
        <div className="w-8 h-8 rounded-xl bg-slate-50" />
      </div>
      <div className="flex-1 py-3 px-2 space-y-4">
        {[1, 2, 3].map((section) => (
          <div key={section} className="space-y-1.5">
            <div className="h-3 w-20 bg-slate-100 rounded mx-3.5" />
            <div className="space-y-1">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-9 bg-slate-50/80 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  ),
});

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
  { pattern: /^\/admin\/reports\/financial/, permission: 'reports.revenue.view' },
  { pattern: /^\/admin\/reports\/tax/, permission: 'reports.revenue.view' },
  { pattern: /^\/admin\/reports\/payment-methods/, permission: 'reports.revenue.view' },
  { pattern: /^\/admin\/reports\/products/, permission: 'reports.products.view' },
  { pattern: /^\/admin\/reports\/vouchers/, permission: 'reports.revenue.view' },
  { pattern: /^\/admin\/reports\/flash-sales/, permission: 'reports.revenue.view' },
  { pattern: /^\/admin\/reports\/customers/, permission: 'reports.revenue.view' },
  { pattern: /^\/admin\/reports\/membership-points/, permission: 'reports.revenue.view' },
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
  { pattern: /^\/admin\/reviews/, permission: 'reviews.view' },

  // System
  { pattern: /^\/admin\/branches/, permission: 'branches.view' },
  { pattern: /^\/admin\/operating-slots/, permission: 'operating_slots.view' },
  { pattern: /^\/admin\/payment-methods/, permission: 'payment_methods.view' },
  { pattern: /^\/admin\/settings\/print-templates/, permission: 'print_templates.view' },
  { pattern: /^\/admin\/settings\/kitchen-printers/, permission: 'kitchen_settings.view' },
  { pattern: /^\/admin\/settings/, permission: 'settings.general.view' },
  { pattern: /^\/admin\/audit-logs/, permission: 'audit_logs.view' },

  // AVORA Farm
  { pattern: /^\/admin\/farm\/garden-layout/, permission: 'farm.manage_crop' },
  { pattern: /^\/admin\/farm\/crops/, permission: 'farm.manage_crop' },
  { pattern: /^\/admin\/farm\/mutations/, permission: 'farm.manage_mutation' },
  { pattern: /^\/admin\/farm\/shop/, permission: 'farm.manage_shop' },
  { pattern: /^\/admin\/farm\/rewards/, permission: 'farm.manage_reward' },
  { pattern: /^\/admin\/farm\/economy/, permission: 'farm.view_economy' },
  { pattern: /^\/admin\/farm\/security/, permission: 'farm.view_security' },
  { pattern: /^\/admin\/farm/, permission: 'farm.view' },
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

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Reset scroll position on route change
  useEffect(() => {
    const container = document.getElementById('admin-main-scroll-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname]);

  // CHỈ tự động quay về màn hình POS trên App Desktop (AVORA POS Desktop WebView2), KHÔNG áp dụng cho trình duyệt Web
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDesktop = platformBridge.isDesktop || Boolean((window as any).IS_AVORA_DESKTOP);

    // Dọn dẹp cờ trên trình duyệt Web để quản trị viên tự do truy cập trang quản trị
    if (!isDesktop) {
      sessionStorage.removeItem('avora_pos_active');
      return;
    }

    // Trên App Desktop: Nếu có lỡ chuyển sang các trang quản trị khác thì tự động quay về POS
    if (pathname && !pathname.startsWith('/admin/pos') && !pathname.startsWith('/login')) {
      toast('Tự động quay trở về màn hình POS...', { id: 'auto-pos-return', icon: '⚡' });
      router.replace('/admin/pos');
    }
  }, [pathname, router]);

  const isPosOrKds = pathname?.startsWith('/admin/pos') || pathname?.startsWith('/admin/kds');

  if (isPosOrKds) {
    return (
      <div className="h-screen max-h-[100dvh] w-full max-w-[100vw] bg-gray-100 overflow-hidden select-none font-sans text-slate-800">
        <RoutePermissionEnforcer>
          {children}
        </RoutePermissionEnforcer>
      </div>
    );
  }

  return (
    <div className="admin-page-wrapper flex h-screen max-h-[100dvh] w-full bg-slate-50/70 text-slate-800 overflow-hidden">
      {/* Unified Desktop Sidebar - Locked and Fixed */}
      <AdminSidebar />

      {/* Main Application Area (Header + Scrollable Main Content + Footer) */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Unified Fixed Sticky Header */}
        <AdminHeader />

        {/* Scrollable Main Content Area: Only this scrolls */}
        <div
          id="admin-main-scroll-container"
          className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative"
        >
          {/* Page Content Container: Mobile 8px-10px, Desktop 16px-24px */}
          <main className="flex-1 px-2 py-2.5 sm:px-4 sm:py-6 pb-24 lg:pb-8 max-w-[1600px] w-full mx-auto">
            <RoutePermissionEnforcer>
              {children}
            </RoutePermissionEnforcer>
          </main>

          {/* Unified Localized Footer */}
          <AdminFooter />
        </div>
      </div>

      {/* Mobile App Bottom Navigation */}
      <AdminBottomNav />
    </div>
  );
}

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AdminProvider>
        <NotificationRealtimeProvider>
          {/* Slim Burgundy Progress Bar on top edge */}
          <TopProgressBar />
          <AdminLayoutInner>{children}</AdminLayoutInner>
        </NotificationRealtimeProvider>
      </AdminProvider>
    </LanguageProvider>
  );
}
