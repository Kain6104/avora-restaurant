'use client';

import React from 'react';
import Link from 'next/link';
import { useAdmin } from '@/contexts/AdminContext';
import PermissionGate from '@/components/PermissionGate';
import {
  LayoutDashboard, Users, ShoppingCart, Package, Tags,
  Settings, PieChart, Store, Ticket, Zap, Gift, Crown,
  UserCheck
} from 'lucide-react';

export default function AdminSidebar() {
  const { permissions, role } = useAdmin();

  const renderSection = (title: string, children: React.ReactNode) => {
    // If no children passed permission checks, children will be empty
    return (
      <div className="mb-6">
        <h3 className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          {title}
        </h3>
        <div className="space-y-1">
          {children}
        </div>
      </div>
    );
  };

  const NavLink = ({ href, icon: Icon, children }: { href: string, icon: any, children: React.ReactNode }) => {
    return (
      <Link href={href} className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-700 font-medium transition-colors">
        <Icon size={18} />
        <span>{children}</span>
      </Link>
    );
  };

  return (
    <div className="w-64 bg-white border-r shadow-sm hidden md:flex flex-col h-screen sticky top-0 overflow-y-auto">
      <div className="h-16 flex items-center px-6 border-b font-black text-2xl text-red-600 sticky top-0 bg-white z-10">
        AVORA.
      </div>
      <nav className="flex-1 p-4">
        {renderSection('Tổng quan', (
          <>
            <PermissionGate permission="dashboard.view">
              <NavLink href="/admin/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
            </PermissionGate>
            <PermissionGate permission="reports.view">
              <NavLink href="/admin/reports" icon={PieChart}>Báo Cáo</NavLink>
            </PermissionGate>
          </>
        ))}

        {renderSection('Bán hàng', (
          <>
            <PermissionGate permission="orders.view">
              <NavLink href="/admin/orders" icon={ShoppingCart}>Đơn Hàng</NavLink>
            </PermissionGate>
          </>
        ))}

        {renderSection('Sản phẩm', (
          <>
            <PermissionGate permission="products.view">
              <NavLink href="/admin/products" icon={Package}>Món Ăn</NavLink>
            </PermissionGate>
            <PermissionGate permission="categories.view">
              <NavLink href="/admin/categories" icon={Tags}>Danh Mục</NavLink>
            </PermissionGate>
          </>
        ))}

        {renderSection('Khách hàng', (
          <>
            <PermissionGate permission="users.view">
              <NavLink href="/admin/users" icon={Users}>Khách Hàng</NavLink>
            </PermissionGate>
            {/* Added memberships (requires a specific permission, assuming users.view for now, can be adjusted) */}
            <PermissionGate permission="users.view">
              <NavLink href="/admin/memberships" icon={Crown}>Thẻ Thành Viên</NavLink>
            </PermissionGate>
          </>
        ))}

        {renderSection('Khuyến mãi', (
          <>
            <PermissionGate permission="promotions.view">
              <NavLink href="/admin/vouchers" icon={Ticket}>Vouchers</NavLink>
              <NavLink href="/admin/flash-sales" icon={Zap}>Flash Sale</NavLink>
              <NavLink href="/admin/combos" icon={Gift}>Combo</NavLink>
            </PermissionGate>
          </>
        ))}

        {renderSection('Hệ thống', (
          <>
            {(role === 'ADMIN' || role === 'MANAGER') && (
              <NavLink href="/admin/branches" icon={Store}>Chi Nhánh</NavLink>
            )}
            <PermissionGate permission="settings.view">
              <NavLink href="/admin/settings" icon={Settings}>Cài Đặt</NavLink>
            </PermissionGate>
          </>
        ))}
      </nav>
    </div>
  );
}
