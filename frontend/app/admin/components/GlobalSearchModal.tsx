'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Search,
  LayoutDashboard,
  PieChart,
  ShoppingCart,
  Package,
  Tags,
  Gift,
  Users,
  Crown,
  Ticket,
  Zap,
  Store,
  Settings,
  History,
  ArrowRight,
  X,
  Loader2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'navigation' | 'product' | 'category' | 'order' | 'user';
  href: string;
  icon: any;
  badge?: string;
}

export default function GlobalSearchModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Quick navigation pages
  const navPages: SearchResultItem[] = [
    {
      id: 'nav-dashboard',
      title: t('nav.dashboard', 'Tổng quan (Dashboard)'),
      subtitle: 'Bảng điều khiển và các chỉ số kinh doanh',
      category: 'navigation',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'nav-reports',
      title: t('nav.reports', 'Báo cáo & Phân tích'),
      subtitle: 'Thống kê doanh thu, khách hàng và khung giờ',
      category: 'navigation',
      href: '/admin/reports',
      icon: PieChart,
    },
    {
      id: 'nav-orders',
      title: t('nav.orders', 'Quản lý Đơn hàng'),
      subtitle: 'Danh sách và trạng thái các đơn đặt món',
      category: 'navigation',
      href: '/admin/orders',
      icon: ShoppingCart,
    },
    {
      id: 'nav-products',
      title: t('nav.products', 'Thực đơn & Món ăn'),
      subtitle: 'Quản lý món, giá bán, tồn kho và hình ảnh',
      category: 'navigation',
      href: '/admin/products',
      icon: Package,
    },
    {
      id: 'nav-categories',
      title: t('nav.categories', 'Danh mục thực đơn'),
      subtitle: 'Phân loại các nhóm món ăn',
      category: 'navigation',
      href: '/admin/categories',
      icon: Tags,
    },
    {
      id: 'nav-combos',
      title: t('nav.combos', 'Combo món ăn'),
      subtitle: 'Gói ưu đãi và combo hấp dẫn',
      category: 'navigation',
      href: '/admin/combos',
      icon: Gift,
    },
    {
      id: 'nav-users',
      title: t('nav.users', 'Khách hàng & Nhân sự'),
      subtitle: 'Tài khoản người dùng, quản trị và nhân viên',
      category: 'navigation',
      href: '/admin/users',
      icon: Users,
    },
    {
      id: 'nav-memberships',
      title: t('nav.memberships', 'Hạng thẻ thành viên'),
      subtitle: 'Quyền lợi VIP, tích điểm và thăng hạng',
      category: 'navigation',
      href: '/admin/memberships',
      icon: Crown,
    },
    {
      id: 'nav-vouchers',
      title: t('nav.vouchers', 'Mã giảm giá (Vouchers)'),
      subtitle: 'Khuyến mãi và mã giảm giá theo chiến dịch',
      category: 'navigation',
      href: '/admin/vouchers',
      icon: Ticket,
    },
    {
      id: 'nav-flash-sales',
      title: t('nav.flashSales', 'Flash Sale'),
      subtitle: 'Chương trình giảm giá theo khung giờ',
      category: 'navigation',
      href: '/admin/flash-sales',
      icon: Zap,
    },
    {
      id: 'nav-branches',
      title: t('nav.branches', 'Hệ thống Chi nhánh'),
      subtitle: 'Quản lý cửa hàng và định vị bản đồ',
      category: 'navigation',
      href: '/admin/branches',
      icon: Store,
    },
    {
      id: 'nav-settings',
      title: t('nav.settings', 'Cài đặt hệ thống'),
      subtitle: 'Cấu hình thông tin, giờ mở cửa, phí giao hàng',
      category: 'navigation',
      href: '/admin/settings',
      icon: Settings,
    },
    {
      id: 'nav-audit-logs',
      title: t('nav.auditLogs', 'Nhật ký hoạt động (Audit Logs)'),
      subtitle: 'Lịch sử thao tác và bảo mật',
      category: 'navigation',
      href: '/admin/audit-logs',
      icon: History,
    },
  ];

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (!query.trim()) {
      setResults(navPages);
      setSelectedIndex(0);
      return;
    }

    const trimmed = query.trim().toLowerCase();
    const matchedNav = navPages.filter(
      (p) =>
        p.title.toLowerCase().includes(trimmed) ||
        (p.subtitle && p.subtitle.toLowerCase().includes(trimmed))
    );

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [prodRes, catRes, orderRes, userRes] = await Promise.allSettled([
          fetch(`/api/admin/products?search=${encodeURIComponent(trimmed)}&limit=4`, {
            credentials: 'include',
          }).then((r) => r.json()),
          fetch(`/api/admin/categories?search=${encodeURIComponent(trimmed)}&limit=3`, {
            credentials: 'include',
          }).then((r) => r.json()),
          fetch(`/api/admin/orders?search=${encodeURIComponent(trimmed)}&limit=4`, {
            credentials: 'include',
          }).then((r) => r.json()),
          fetch(`/api/admin/users?search=${encodeURIComponent(trimmed)}&limit=3`, {
            credentials: 'include',
          }).then((r) => r.json()),
        ]);

        const extraResults: SearchResultItem[] = [];

        // Products
        if (prodRes.status === 'fulfilled' && prodRes.value?.data) {
          prodRes.value.data.forEach((p: any) => {
            extraResults.push({
              id: `prod-${p.id}`,
              title: p.name,
              subtitle: `${Number(p.price).toLocaleString()} ₫ · ${p.category?.name || 'Món ăn'}`,
              category: 'product',
              href: `/admin/products/${p.id}/edit`,
              icon: Package,
              badge: p.isAvailable ? 'Đang bán' : 'Tạm ngưng',
            });
          });
        }

        // Categories
        if (catRes.status === 'fulfilled' && catRes.value?.data) {
          catRes.value.data.forEach((c: any) => {
            extraResults.push({
              id: `cat-${c.id}`,
              title: c.name,
              subtitle: `Danh mục thực đơn (${c._count?.products || 0} món)`,
              category: 'category',
              href: `/admin/categories`,
              icon: Tags,
            });
          });
        }

        // Orders
        if (orderRes.status === 'fulfilled' && orderRes.value?.data) {
          orderRes.value.data.forEach((o: any) => {
            extraResults.push({
              id: `order-${o.id}`,
              title: `Đơn #${o.orderCode || o.id.slice(0, 8).toUpperCase()}`,
              subtitle: `${o.customerName || 'Khách vãng lai'} · ${Number(o.totalAmount).toLocaleString()} ₫`,
              category: 'order',
              href: `/admin/orders/${o.id}`,
              icon: ShoppingCart,
              badge: o.status,
            });
          });
        }

        // Users
        if (userRes.status === 'fulfilled' && userRes.value?.data) {
          userRes.value.data.forEach((u: any) => {
            extraResults.push({
              id: `user-${u.id}`,
              title: u.fullName || u.email,
              subtitle: `${u.email} · ${u.role}`,
              category: 'user',
              href: `/admin/users`,
              icon: Users,
              badge: u.role,
            });
          });
        }

        setResults([...matchedNav, ...extraResults]);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Error during global search:', err);
        setResults(matchedNav);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleSelect = (item: SearchResultItem) => {
    onClose();
    router.push(item.href);
  };

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 sm:pt-20 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 shrink-0">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm kiếm trang, món ăn, danh mục, đơn hàng, khách hàng..."
            className="flex-1 text-sm bg-transparent text-slate-800 placeholder:text-slate-400 font-medium outline-none"
          />
          {loading && <Loader2 size={16} className="text-red-600 animate-spin shrink-0" />}
          {query && !loading && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold font-mono text-slate-400 bg-slate-100 rounded-lg border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <p className="font-semibold text-slate-600 mb-1">Không tìm thấy kết quả nào</p>
              <p>Thử tìm kiếm với từ khóa khác (VD: pizza, combo, đơn hàng, cài đặt...)</p>
            </div>
          ) : (
            results.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-red-50/80 text-red-950 border border-red-100'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    size={14}
                    className={`shrink-0 ml-2 transition-transform ${
                      isSelected ? 'text-red-600 translate-x-0.5' : 'text-slate-300'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium shrink-0">
          <div className="flex items-center gap-3">
            <span>↑↓ để di chuyển</span>
            <span>↵ để chọn</span>
            <span>ESC để đóng</span>
          </div>
          <span>AVORA Command Menu</span>
        </div>
      </div>
    </div>
  );
}
