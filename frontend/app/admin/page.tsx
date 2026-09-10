'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Store,
  ChefHat,
  UtensilsCrossed,
  LayoutDashboard,
  CalendarCheck,
  Package,
  ShoppingCart,
  Users,
  ShieldCheck,
  PieChart,
  Settings,
  Sparkles,
  ArrowRight,
  Clock,
  Building2,
  KeyRound,
  CheckCircle2,
  Layers,
  Flame,
} from 'lucide-react';

interface QuickActionItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  gradient: string;
  iconColor: string;
  permission: string;
  badge?: string;
  isPrimaryForRole?: boolean;
}

export default function AdminPortalHubPage() {
  const router = useRouter();
  const { user, capabilities, role, effectivePermissions, availableBranches, selectedBranchId } = useAdmin();
  const { locale, t } = useLanguage();
  const [timeStr, setTimeStr] = useState<string>('');

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          weekday: 'long',
          day: '2-digit',
          month: locale === 'en' ? 'short' : '2-digit',
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [locale]);

  const primaryRole = capabilities?.roles?.[0];
  const rawRoleName = primaryRole?.name || role || 'Nhân viên';
  const roleCode = primaryRole?.code || role || 'STAFF';

  const roleName = useMemo(() => {
    if (locale === 'en') {
      if (roleCode === 'ADMIN' || rawRoleName === 'Quản trị viên') return 'Administrator';
      if (roleCode === 'BRANCH_MANAGER' || rawRoleName === 'Quản lý chi nhánh') return 'Branch Manager';
      if (roleCode === 'BRANCH_STAFF' || rawRoleName === 'Nhân viên thu ngân' || rawRoleName === 'Thu ngân') return 'Cashier Staff';
      if (roleCode === 'BRANCH_WAITER' || rawRoleName === 'Nhân viên phục vụ' || rawRoleName === 'Phục vụ bàn') return 'Waiter Staff';
      if (roleCode === 'BRANCH_KITCHEN' || rawRoleName === 'Nhân viên bếp' || rawRoleName === 'Bếp trưởng') return 'Kitchen Staff';
      if (rawRoleName === 'Nhân viên') return 'Staff';
    }
    return rawRoleName;
  }, [locale, roleCode, rawRoleName]);

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (locale === 'en') {
      if (hour < 12) return 'Good morning';
      if (hour < 18) return 'Good afternoon';
      return 'Good evening';
    }
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, [locale]);

  // Workspace tiles
  const ACTION_TILES: QuickActionItem[] = useMemo(() => [
    {
      id: 'waiter',
      title: locale === 'en' ? 'Table Service (Waiter)' : 'Phục vụ bàn (Waiter)',
      subtitle: locale === 'en' ? 'Open tables, take orders, transfer tables & serve in-restaurant guests' : 'Mở bàn, chọn món, chuyển bàn và phục vụ khách tại bàn',
      href: '/admin/pos/waiter',
      icon: UtensilsCrossed,
      gradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
      iconColor: 'text-amber-600 bg-amber-100/70',
      permission: 'waiter.access',
      badge: 'WAITER',
      isPrimaryForRole: roleCode === 'BRANCH_WAITER',
    },
    {
      id: 'pos',
      title: locale === 'en' ? 'Point of Sale (POS)' : 'Điểm bán hàng (POS)',
      subtitle: locale === 'en' ? 'Cashier, bill calculation, order creation & counter receipts' : 'Thu ngân, tính tiền, tạo đơn và in hóa đơn tại quầy',
      href: '/admin/pos',
      icon: Store,
      gradient: 'from-red-500/10 via-rose-500/5 to-transparent',
      iconColor: 'text-red-600 bg-red-100/70',
      permission: 'pos.access',
      badge: locale === 'en' ? 'POS CASHIER' : 'POS THU NGÂN',
      isPrimaryForRole: roleCode === 'BRANCH_STAFF',
    },
    {
      id: 'kds',
      title: locale === 'en' ? 'Kitchen & Bar (KDS)' : 'Bếp & Bar (KDS)',
      subtitle: locale === 'en' ? 'Kitchen display system, cooking progress & station dispatch' : 'Màn hình chế biến món, xác nhận xong món và điều phối bếp',
      href: '/admin/kds',
      icon: ChefHat,
      gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
      iconColor: 'text-emerald-600 bg-emerald-100/70',
      permission: 'kds.access',
      badge: 'KITCHEN KDS',
      isPrimaryForRole: roleCode === 'BRANCH_KITCHEN',
    },
    {
      id: 'dashboard',
      title: locale === 'en' ? 'Enterprise Overview' : 'Tổng quan chuỗi',
      subtitle: locale === 'en' ? 'Real-time revenue reports, order statistics & operational KPIs' : 'Báo cáo doanh thu thực, đơn hàng và các chỉ số KPI vận hành',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
      gradient: 'from-blue-500/10 via-sky-500/5 to-transparent',
      iconColor: 'text-blue-600 bg-blue-100/70',
      permission: 'dashboard.view',
      badge: 'DASHBOARD',
      isPrimaryForRole: roleCode === 'ADMIN' || roleCode === 'BRANCH_MANAGER',
    },
    {
      id: 'tables',
      title: locale === 'en' ? 'Table Floor Map' : 'Sơ đồ bàn ăn',
      subtitle: locale === 'en' ? 'View vacant, occupied, reserved & cleaning table statuses' : 'Xem trạng thái bàn trống, có khách hoặc đang dọn',
      href: '/admin/tables',
      icon: Layers,
      gradient: 'from-violet-500/10 via-purple-500/5 to-transparent',
      iconColor: 'text-violet-600 bg-violet-100/70',
      permission: 'tables.view',
      badge: locale === 'en' ? 'TABLES' : 'BÀN ĂN',
    },
    {
      id: 'reservations',
      title: locale === 'en' ? 'Table Reservations' : 'Lịch đặt bàn',
      subtitle: locale === 'en' ? 'Manage table bookings, guest arrivals & table allocations' : 'Quản lý lịch hẹn, nhận khách trước và xếp bàn',
      href: '/admin/reservations',
      icon: CalendarCheck,
      gradient: 'from-pink-500/10 via-rose-500/5 to-transparent',
      iconColor: 'text-pink-600 bg-pink-100/70',
      permission: 'reservations.view',
      badge: locale === 'en' ? 'RESERVATIONS' : 'ĐẶT BÀN',
    },
    {
      id: 'orders',
      title: locale === 'en' ? 'Orders & Invoices' : 'Đơn hàng & Hóa đơn',
      subtitle: locale === 'en' ? 'Lookup sales history, billing details and payment statuses' : 'Tra cứu toàn bộ lịch sử đơn bán và trạng thái thanh toán',
      href: '/admin/orders',
      icon: ShoppingCart,
      gradient: 'from-indigo-500/10 via-blue-500/5 to-transparent',
      iconColor: 'text-indigo-600 bg-indigo-100/70',
      permission: 'orders.view',
      badge: locale === 'en' ? 'ORDERS' : 'ĐƠN HÀNG',
    },
    {
      id: 'products',
      title: locale === 'en' ? 'Dishes & Menu' : 'Món ăn & Thực đơn',
      subtitle: locale === 'en' ? 'Manage food & beverage catalog, pricing and stock availability' : 'Danh mục thực đơn món ăn, đồ uống và trạng thái món',
      href: '/admin/products',
      icon: Package,
      gradient: 'from-cyan-500/10 via-teal-500/5 to-transparent',
      iconColor: 'text-cyan-600 bg-cyan-100/70',
      permission: 'products.view',
      badge: locale === 'en' ? 'MENU' : 'THỰC ĐƠN',
    },
    {
      id: 'roles',
      title: locale === 'en' ? 'Access Control (RBAC)' : 'Phân quyền (RBAC)',
      subtitle: locale === 'en' ? 'Manage system roles, assign permissions & branch scopes' : 'Quản lý 5 vai trò mặc định, tạo vai trò tùy chỉnh',
      href: '/admin/roles',
      icon: ShieldCheck,
      gradient: 'from-purple-500/10 via-indigo-500/5 to-transparent',
      iconColor: 'text-purple-600 bg-purple-100/70',
      permission: 'roles.view',
      badge: 'RBAC',
    },
    {
      id: 'users',
      title: locale === 'en' ? 'Staff Directory' : 'Quản lý nhân sự',
      subtitle: locale === 'en' ? 'Employee directory, role assignment & branch association' : 'Danh sách nhân viên, gán vai trò và chi nhánh công tác',
      href: '/admin/users',
      icon: Users,
      gradient: 'from-emerald-500/10 via-lime-500/5 to-transparent',
      iconColor: 'text-emerald-600 bg-emerald-100/70',
      permission: 'staff.view',
      badge: locale === 'en' ? 'STAFF' : 'NHÂN SỰ',
    },
    {
      id: 'reports',
      title: locale === 'en' ? 'Advanced Reports' : 'Báo cáo chuyên sâu',
      subtitle: locale === 'en' ? 'Financial metrics, bestselling items and staff performance' : 'Thống kê doanh thu, món bán chạy, hiệu suất làm việc',
      href: '/admin/reports',
      icon: PieChart,
      gradient: 'from-amber-500/10 via-yellow-500/5 to-transparent',
      iconColor: 'text-amber-600 bg-amber-100/70',
      permission: 'reports.view',
      badge: locale === 'en' ? 'REPORTS' : 'BÁO CÁO',
    },
  ], [locale, roleCode]);

  // Filter only actions allowed for this user
  const allowedActions = useMemo(() => {
    return ACTION_TILES.filter((act) => {
      if (roleCode === 'ADMIN') return true;
      const perm = effectivePermissions[act.permission];
      if (!perm) return false;
      if (perm.isGlobal) return true;
      if (!selectedBranchId || selectedBranchId === 'ALL') return perm.branchIds.length > 0;
      return perm.branchIds.includes(selectedBranchId);
    });
  }, [effectivePermissions, roleCode, selectedBranchId]);

  // Current active branch label
  const activeBranchName = useMemo(() => {
    if (selectedBranchId === 'ALL') return locale === 'en' ? 'All Branches' : 'Toàn bộ chi nhánh';
    const found = availableBranches.find((b) => b.id === selectedBranchId);
    return found?.name || (locale === 'en' ? 'Current Branch' : 'Chi nhánh hiện tại');
  }, [selectedBranchId, availableBranches, locale]);

  const initials = (user?.fullName || user?.email || 'A')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 lg:p-10 shadow-xl border border-slate-700/50">
        {/* Background ambient lights */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-red-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            {/* Live Clock & Branch Badge */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 font-mono text-amber-300 font-semibold shadow-2xs">
                <Clock size={13} className="text-amber-400" />
                {timeStr || (locale === 'en' ? 'Syncing time...' : 'Đang đồng bộ giờ...')}
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-slate-200 font-bold">
                <Building2 size={13} className="text-red-400" />
                {activeBranchName}
              </span>
            </div>

            {/* Greeting */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              {greeting},{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-300 to-amber-200">
                {user?.fullName || user?.email?.split('@')[0] || (locale === 'en' ? 'Staff' : 'Nhân sự')}
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {locale === 'en'
                ? 'Welcome to AVORA Restaurant Enterprise Portal. Below are the operational apps and features authorized for your account.'
                : 'Chào mừng bạn đến với Cổng điều hành AVORA Restaurant Enterprise. Dưới đây là các ứng dụng và chức năng vận hành được phân quyền cho tài khoản của bạn.'}
            </p>
          </div>

          {/* Profile Identity Card */}
          <div className="shrink-0 bg-white/5 backdrop-blur-md border border-white/10 p-4 sm:p-5 rounded-2xl flex items-center gap-4 min-w-[240px]">
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center font-black text-white text-base shadow-md overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName || 'User'} className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{user?.fullName || user?.email}</p>
              <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[11px] font-bold text-red-300">
                <ShieldCheck size={12} />
                <span>{roleName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {locale === 'en' ? 'Operating Role' : 'Vai trò vận hành'}
          </span>
          <p className="text-base sm:text-lg font-black text-slate-800 truncate">{roleName}</p>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{roleCode}</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {locale === 'en' ? 'Assigned Permissions' : 'Quyền được phân bổ'}
          </span>
          <p className="text-base sm:text-lg font-black text-indigo-600 flex items-center gap-1.5">
            <KeyRound size={17} />
            {roleCode === 'ADMIN' ? '177 / 177' : Object.keys(effectivePermissions).length}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {locale === 'en' ? 'Active permissions' : 'Quyền hạn hoạt động'}
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {locale === 'en' ? 'Branch Scope' : 'Chi nhánh làm việc'}
          </span>
          <p className="text-base sm:text-lg font-black text-emerald-600 flex items-center gap-1.5">
            <Building2 size={17} />
            {roleCode === 'ADMIN' || capabilities?.assignments?.some((a) => a.branchScope === 'ALL_BRANCHES')
              ? (locale === 'en' ? 'All branches' : 'Tất cả chi nhánh')
              : `${availableBranches.length} ${locale === 'en' ? 'branches' : 'chi nhánh'}`}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {locale === 'en' ? 'Work scope' : 'Phạm vi công tác'}
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {locale === 'en' ? 'Available Modules' : 'Chức năng khả dụng'}
          </span>
          <p className="text-base sm:text-lg font-black text-red-600 flex items-center gap-1.5">
            <Flame size={17} />
            {allowedActions.length} {locale === 'en' ? 'modules' : 'module'}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {locale === 'en' ? 'Ready to access' : 'Sẵn sàng truy cập'}
          </span>
        </div>
      </div>

      {/* Workspace Quick Launch Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              {locale === 'en' ? 'Workspaces & Available Modules' : 'Không gian làm việc & Chức năng khả dụng'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {locale === 'en'
                ? 'Select an application or function to start your shift'
                : 'Chọn ứng dụng hoặc chức năng để bắt đầu ca làm việc của bạn'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {allowedActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.id}
                href={action.href}
                className={`group relative overflow-hidden bg-white p-5 sm:p-6 rounded-2xl border transition-all duration-200 flex flex-col justify-between hover:shadow-lg ${
                  action.isPrimaryForRole
                    ? 'border-red-200 ring-2 ring-red-500/20 shadow-md'
                    : 'border-slate-100 shadow-2xs hover:border-slate-200'
                }`}
              >
                {/* Top gradient highlight */}
                <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${action.gradient}`} />

                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-200 ${action.iconColor}`}
                    >
                      <Icon size={24} strokeWidth={2.2} />
                    </div>

                    {action.badge && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/60">
                        {action.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors flex items-center gap-1.5">
                    {action.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                    {action.subtitle}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-red-600 transition-colors">
                  <span>{locale === 'en' ? 'Open Application' : 'Mở ứng dụng'}</span>
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
