'use client';

import React from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Home,
  Store,
  ChefHat,
  CalendarCheck,
  UtensilsCrossed,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';

interface AdminPageGuardProps {
  permission?: string;
  branchId?: string;
  children: React.ReactNode;
}

/**
 * Guard bọc các trang trong /admin/* để kiểm tra quyền truy cập.
 * Khi người dùng không có quyền:
 * Hiển thị Card 403 "SIÊU ĐẸP" trong vùng main, Sidebar và Header vẫn giữ nguyên để người dùng thao tác.
 */
export function AdminPageGuard({
  permission,
  branchId,
  children,
}: AdminPageGuardProps) {
  const { loading, can, selectedBranchId, capabilities, role } = useAdmin();
  const targetBranch = branchId !== undefined ? branchId : selectedBranchId;
  const isAllowed = !permission || can(permission, targetBranch);

  const primaryRole = capabilities?.roles?.[0];
  const roleName = primaryRole?.name || role || 'Nhân viên';

  // Danh sách các shortcut chức năng hữu ích mà tài khoản NÀY có quyền truy cập
  const availableShortcuts = [
    { label: 'Phục vụ bàn', href: '/admin/pos/waiter', icon: UtensilsCrossed, perm: 'waiter.access' },
    { label: 'POS Bán hàng', href: '/admin/pos', icon: Store, perm: 'pos.access' },
    { label: 'Bếp & Bar (KDS)', href: '/admin/kds', icon: ChefHat, perm: 'kds.access' },
    { label: 'Đặt bàn', href: '/admin/reservations', icon: CalendarCheck, perm: 'reservations.view' },
    { label: 'Sơ đồ bàn', href: '/admin/tables', icon: UtensilsCrossed, perm: 'tables.view' },
    { label: 'Tổng quan', href: '/admin/dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
  ].filter((item) => can(item.perm, targetBranch));

  // Khi chưa có dữ liệu quyền (chỉ xảy ra ở lần cold start đầu tiên chưa có cache):
  // Hiển thị một skeleton placeholder Premium Light thanh lịch, không hiển thị bất kỳ text hay spinner nào,
  // tuyệt đối không lộ nội dung trang trước khi quyền được xác nhận an toàn.
  if (loading && !capabilities) {
    return (
      <div className="w-full space-y-4 animate-pulse">
        {/* Header placeholder */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="space-y-2">
            <div className="h-6 bg-slate-200/70 rounded-xl w-48"></div>
            <div className="h-3.5 bg-slate-100 rounded-md w-72"></div>
          </div>
          <div className="h-9 bg-slate-100 rounded-xl w-28"></div>
        </div>

        {/* Local KPI Cards placeholder */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2 shadow-2xs">
              <div className="h-3 bg-slate-100 rounded w-20"></div>
              <div className="h-6 bg-slate-200/60 rounded w-28"></div>
            </div>
          ))}
        </div>

        {/* Main Content Area placeholder */}
        <div className="w-full h-72 bg-white rounded-2xl border border-slate-100 shadow-2xs"></div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="py-8 sm:py-12 px-4 flex items-center justify-center">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.04)] p-7 sm:p-9 text-center animate-in fade-in zoom-in-95 duration-200">
          {/* Warning Icon (Exactly like Image 3) */}
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center mx-auto mb-4 text-amber-500 shadow-2xs">
            <AlertTriangle className="w-8 h-8" strokeWidth={2.2} />
          </div>

          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mb-2">
            Quyền truy cập bị từ chối
          </h2>

          <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-5">
            Tài khoản của bạn với vai trò{' '}
            <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
              <ShieldCheck size={13} className="text-indigo-600" />
              {roleName}
            </span>{' '}
            không có quyền{' '}
            {permission && (
              <code className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 rounded text-[11px]">
                {permission}
              </code>
            )}{' '}
            để truy cập chức năng này hoặc không được phân công tại chi nhánh đang chọn.
          </p>

          {/* Gợi ý các chức năng được phép */}
          {availableShortcuts.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-slate-50/80 border border-slate-100 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Các chức năng bạn có thể thao tác:
              </p>
              <div className="flex flex-wrap gap-2">
                {availableShortcuts.map((sc) => {
                  const Icon = sc.icon;
                  return (
                    <Link
                      key={sc.href}
                      href={sc.href}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/80 transition-all shadow-2xs hover:text-red-600"
                    >
                      <Icon size={14} className="text-slate-400" />
                      <span>{sc.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại
            </button>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-xs hover:shadow-md cursor-pointer"
            >
              <Home className="w-4 h-4" /> Về cổng quản trị
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
