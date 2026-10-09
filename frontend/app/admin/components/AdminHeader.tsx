'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRealtimeNotifications } from '@/contexts/NotificationRealtimeProvider';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Menu,
  Search,
  Languages,
  ChevronDown,
  Check,
  User as UserIcon,
  LogOut,
  Settings as SettingsIcon,
  UserCheck,
  CheckCheck,
  Gift,
  ShoppingBag,
  Award,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import BranchSelector from './BranchSelector';
import GlobalSearchModal from './GlobalSearchModal';

export default function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedBranchId, role, user, capabilities, can, toggleMobileSidebar } = useAdmin();
  const { locale, setLocale, t, getRouteTitle } = useLanguage();
  const { unreadCount, openDrawer } = useRealtimeNotifications();

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Ctrl + K / Cmd + K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset avatar error when avatarUrl changes
  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);



  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/login');
    }
  };

  const pageTitle = getRouteTitle(pathname);
  const userName = user?.fullName || user?.email || (locale === 'en' ? 'User' : 'Người dùng');
  
  // Lấy vai trò thực tế từ Enterprise RBAC capabilities
  const primaryRole = capabilities?.roles?.[0];
  const userRoleCode = primaryRole?.code || (user as any)?.role || role || 'USER';
  const userRoleLabel = useMemo(() => {
    if (locale === 'en') {
      if (userRoleCode === 'ADMIN') return 'Super Administrator';
      if (userRoleCode === 'BRANCH_WAITER') return 'Branch Waiter';
      if (userRoleCode === 'BRANCH_MANAGER') return 'Branch Manager';
      if (userRoleCode === 'BRANCH_STAFF') return 'Branch Cashier';
      if (userRoleCode === 'BRANCH_CHEF' || userRoleCode === 'BRANCH_KITCHEN') return 'Branch Kitchen';
      return t(`role.${userRoleCode}`, userRoleCode);
    }
    return (
      primaryRole?.name ||
      (userRoleCode === 'ADMIN'
        ? 'Quản trị viên toàn quyền'
        : userRoleCode === 'BRANCH_WAITER'
        ? 'Phục vụ chi nhánh'
        : userRoleCode === 'BRANCH_MANAGER'
        ? 'Quản lý chi nhánh'
        : userRoleCode === 'BRANCH_STAFF'
        ? 'Nhân viên chi nhánh'
        : userRoleCode === 'BRANCH_CHEF' || userRoleCode === 'BRANCH_KITCHEN'
        ? 'Bếp chi nhánh'
        : t(`role.${userRoleCode}`, userRoleCode))
    );
  }, [locale, userRoleCode, primaryRole, t]);

  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'A';

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 60) return locale === 'en' ? 'Just now' : 'Vừa xong';
      if (diffSec < 3600) return locale === 'en' ? `${Math.floor(diffSec / 60)}m ago` : `${Math.floor(diffSec / 60)} phút trước`;
      if (diffSec < 86400) return locale === 'en' ? `${Math.floor(diffSec / 3600)}h ago` : `${Math.floor(diffSec / 3600)} giờ trước`;
      return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <header className="h-13 sm:h-14 lg:h-18 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] px-2 sm:px-4 lg:px-6 flex items-center justify-between gap-1.5 sm:gap-3 sticky top-0 z-30 transition-all">
        {/* Left Area: Mobile Menu Toggle & Dynamic Page Title */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={toggleMobileSidebar}
            aria-label="Mở menu điều hướng"
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <Menu size={19} strokeWidth={2} />
          </button>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight truncate leading-tight">
              {pageTitle}
            </h1>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium hidden sm:block truncate">
              AVORA Admin · {userRoleLabel}
            </span>
          </div>
        </div>

        {/* Right Area: Branch Selector, Search, Language Selector, Notification, Profile */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* Branch Selector (Desktop & Tablet) */}
          <div className="hidden md:block">
            <BranchSelector />
          </div>

          {/* Global Search Button (Click triggers Ctrl+K modal) */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Tìm kiếm toàn hệ thống"
            className="flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-3 bg-slate-50 hover:bg-slate-100/80 text-slate-500 rounded-xl border border-slate-200/80 text-xs font-medium transition-all shadow-2xs group min-h-[36px]"
          >
            <Search size={14} className="text-slate-400 group-hover:text-red-600 transition-colors" />
            <span className="hidden sm:inline text-slate-400 text-[11px] sm:text-xs">
              {t('header.search', 'Tìm...')}
            </span>
            <kbd className="hidden xl:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white text-slate-400 rounded border border-slate-200 shadow-2xs">
              Ctrl K
            </kbd>
          </button>

          {/* Language Selector Dropdown */}
          <div className="hidden sm:block relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setIsLangOpen(!isLangOpen)}
              aria-label="Đổi ngôn ngữ"
              className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-bold shadow-2xs transition-colors"
            >
              <Languages size={15} className="text-slate-500 shrink-0" />
              <span className="uppercase font-mono">{locale}</span>
              <ChevronDown
                size={13}
                className={`text-slate-400 transition-transform duration-150 ${
                  isLangOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isLangOpen && (
              <div className="absolute right-0 mt-1.5 w-40 bg-white rounded-2xl border border-slate-100 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setLocale('vi');
                    setIsLangOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    locale === 'vi'
                      ? 'bg-red-50 text-red-600 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Tiếng Việt (VI)</span>
                  {locale === 'vi' && <Check size={14} className="text-red-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocale('en');
                    setIsLangOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    locale === 'en'
                      ? 'bg-red-50 text-red-600 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>English (EN)</span>
                  {locale === 'en' && <Check size={14} className="text-red-600" />}
                </button>
              </div>
            )}
          </div>

          {/* Notification Bell Button -> Opens Realtime Notification Center Drawer */}
          <button
            type="button"
            onClick={openDrawer}
            aria-label={t('header.notifications', 'Thông báo')}
            className="relative p-1.5 sm:p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            title={t('header.notifications', 'Thông báo')}
          >
            <Bell size={18} strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-xs animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Profile Chip with Dropdown Menu */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 border-l border-slate-100 cursor-pointer hover:opacity-90 transition-opacity min-h-[40px]"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 flex items-center justify-center text-red-600 font-black text-xs sm:text-sm tracking-wider shadow-2xs shrink-0 overflow-hidden">
                {user?.avatarUrl && !avatarError ? (
                  <img
                    src={user.avatarUrl}
                    alt={userName}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="hidden md:block text-left leading-tight min-w-0 max-w-[130px]">
                <p className="text-xs font-bold text-slate-900 truncate" title={userName}>
                  {userName}
                </p>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider truncate" title={userRoleLabel}>
                  {userRoleLabel}
                </p>
              </div>
              <ChevronDown
                size={13}
                className={`text-slate-400 hidden sm:block transition-transform duration-150 ${
                  isProfileOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-100 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100">
                {/* User Info Header */}
                <div className="px-3 py-2.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{userName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email || 'admin@avora.vn'}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">
                    <UserCheck size={11} />
                    <span>{userRoleLabel}</span>
                  </div>
                </div>

                {/* Quick Links: Only show settings if user has permission */}
                {can('settings.general.view') && (
                  <div className="py-1.5 space-y-0.5 text-xs font-semibold text-slate-700">
                    <Link
                      href="/admin/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <SettingsIcon size={15} className="text-slate-400" />
                      <span>{t('nav.settings', 'Cài đặt hệ thống')}</span>
                    </Link>
                  </div>
                )}

                {/* Logout Button */}
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut size={15} />
                    <span>{t('header.logout', 'Đăng xuất tài khoản')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
