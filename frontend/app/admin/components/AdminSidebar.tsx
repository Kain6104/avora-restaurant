'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
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
  Clock,
  CreditCard,
  X,
  Menu,
  ChevronDown,
  ChevronRight,
  Printer,
  Newspaper,
  MessageSquare,
  CalendarCheck,
  UtensilsCrossed,
  ChefHat,
  FileText,
  ShieldCheck,
  Megaphone,
  Layers,
  DollarSign,
  Receipt,
  Sprout,
  Dna,
  ShieldAlert,
} from 'lucide-react';

/* ==========================================================================
   NAVIGATION DATA DEFINITIONS (CHUẨN ACCORDION SUSHI WA)
   ========================================================================== */

export interface LeafNavItem {
  id: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  labelKey: string;
  defaultLabel: string;
  permission: string;
  badge?: React.ReactNode;
  accentColor?: string; // Tùy chọn nhấn màu (VD: Rewards màu vàng hổ phách)
}

export interface AccordionNavGroup {
  id: string;
  titleKey: string;
  defaultTitle: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  items: LeafNavItem[];
}

export type NavEntry =
  | { type: 'item'; data: LeafNavItem }
  | { type: 'accordion'; data: AccordionNavGroup };

export interface NavSection {
  id: string;
  titleKey: string;
  defaultTitle: string;
  entries: NavEntry[];
}

const NAVIGATION_SECTIONS: NavSection[] = [
  // 1. VẬN HÀNH
  {
    id: 'operations',
    titleKey: 'nav.section.operations',
    defaultTitle: 'VẬN HÀNH',
    entries: [
      {
        type: 'item',
        data: {
          id: 'dashboard',
          href: '/admin/dashboard',
          icon: LayoutDashboard,
          labelKey: 'nav.dashboard',
          defaultLabel: 'Tổng quan',
          permission: 'dashboard.view',
        },
      },
      {
        type: 'accordion',
        data: {
          id: 'pos_sales',
          titleKey: 'nav.posGroup',
          defaultTitle: 'POS Bán hàng',
          icon: Store,
          items: [
            {
              id: 'pos',
              href: '/admin/pos',
              icon: Store,
              labelKey: 'nav.pos',
              defaultLabel: 'Bán hàng (POS)',
              permission: 'pos.access',
              badge: (
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-[#da251d] text-white rounded shadow-2xs">
                  POS
                </span>
              ),
            },
            {
              id: 'kds',
              href: '/admin/kds',
              icon: ChefHat,
              labelKey: 'nav.kds',
              defaultLabel: 'Bếp & Bar (KDS)',
              permission: 'kds.access',
              badge: (
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-500 text-white rounded shadow-2xs">
                  KDS
                </span>
              ),
            },
            {
              id: 'tables',
              href: '/admin/tables',
              icon: UtensilsCrossed,
              labelKey: 'nav.tables',
              defaultLabel: 'Quản lý bàn',
              permission: 'tables.view',
            },
            {
              id: 'reservations',
              href: '/admin/reservations',
              icon: CalendarCheck,
              labelKey: 'nav.reservations',
              defaultLabel: 'Đặt bàn',
              permission: 'reservations.view',
            },
          ],
        },
      },
      {
        type: 'item',
        data: {
          id: 'orders',
          href: '/admin/orders',
          icon: ShoppingCart,
          labelKey: 'nav.orders',
          defaultLabel: 'Đơn hàng trực tuyến',
          permission: 'orders.view',
        },
      },
      {
        type: 'accordion',
        data: {
          id: 'reports_group',
          titleKey: 'nav.reportsGroup',
          defaultTitle: 'Báo cáo & Thống kê',
          icon: PieChart,
          items: [
            {
              id: 'reports_financial',
              href: '/admin/reports/financial',
              icon: DollarSign,
              labelKey: 'nav.reportsFinancial',
              defaultLabel: 'Báo cáo tài chính',
              permission: 'reports.revenue.view',
              badge: (
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-[#800020] text-white rounded shadow-2xs">
                  VIP
                </span>
              ),
            },
            {
              id: 'reports_tax',
              href: '/admin/reports/tax',
              icon: Receipt,
              labelKey: 'nav.reportsTax',
              defaultLabel: 'Báo cáo thuế / VAT',
              permission: 'reports.revenue.view',
              badge: (
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-[#800020] text-white rounded shadow-2xs">
                  VAT
                </span>
              ),
            },
            {
              id: 'reports_payment_methods',
              href: '/admin/reports/payment-methods',
              icon: CreditCard,
              labelKey: 'nav.reportsPaymentMethods',
              defaultLabel: 'Phương thức thanh toán',
              permission: 'reports.revenue.view',
              badge: (
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-[#800020] text-white rounded shadow-2xs">
                  PAY
                </span>
              ),
            },
            {
              id: 'reports_products',
              href: '/admin/reports/products',
              icon: Package,
              labelKey: 'nav.reportsProducts',
              defaultLabel: 'Báo cáo mặt hàng',
              permission: 'reports.products.view',
              badge: (
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-[#da251d] text-white rounded shadow-2xs">
                  MỚI
                </span>
              ),
            },
            {
              id: 'reports_vouchers',
              href: '/admin/reports/vouchers',
              icon: Ticket,
              labelKey: 'nav.reportsVouchers',
              defaultLabel: 'Voucher & Khuyến mãi',
              permission: 'reports.revenue.view',
              badge: (
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-[#800020] text-white rounded shadow-2xs">
                  VOUCHER
                </span>
              ),
            },
            {
              id: 'reports_flash_sales',
              href: '/admin/reports/flash-sales',
              icon: Zap,
              labelKey: 'nav.reportsFlashSales',
              defaultLabel: 'Flash Sale & Giờ vàng',
              permission: 'reports.revenue.view',
              badge: (
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-600 text-white rounded shadow-2xs">
                  SALE
                </span>
              ),
            },
            {
              id: 'reports_customers',
              href: '/admin/reports/customers',
              icon: Users,
              labelKey: 'nav.reportsCustomers',
              defaultLabel: 'Báo cáo khách hàng',
              permission: 'reports.revenue.view',
            },
            {
              id: 'reports_membership_points',
              href: '/admin/reports/membership-points',
              icon: Crown,
              labelKey: 'nav.reportsMembershipPoints',
              defaultLabel: 'Hội viên & Điểm',
              permission: 'reports.revenue.view',
              badge: (
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-emerald-700 text-white rounded shadow-2xs">
                  POINT
                </span>
              ),
            },
          ],
        },
      },
    ],
  },

  // 2. NHÂN SỰ & PHÂN QUYỀN
  {
    id: 'people',
    titleKey: 'nav.section.people',
    defaultTitle: 'NHÂN SỰ & CHẤM CÔNG',
    entries: [
      {
        type: 'item',
        data: {
          id: 'users',
          href: '/admin/users',
          icon: Users,
          labelKey: 'nav.users',
          defaultLabel: 'Khách hàng & Nhân sự',
          permission: 'staff.view',
        },
      },
      {
        type: 'item',
        data: {
          id: 'roles',
          href: '/admin/roles',
          icon: ShieldCheck,
          labelKey: 'nav.roles',
          defaultLabel: 'Vai trò & Phân quyền',
          permission: 'roles.view',
          badge: (
            <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-indigo-600 text-white rounded shadow-2xs">
              RBAC
            </span>
          ),
        },
      },
    ],
  },

  // 3. SẢN PHẨM & NỘI DUNG
  {
    id: 'catalog_content',
    titleKey: 'nav.section.content',
    defaultTitle: 'SẢN PHẨM & NỘI DUNG',
    entries: [
      {
        type: 'accordion',
        data: {
          id: 'product_mgmt',
          titleKey: 'nav.productManagement',
          defaultTitle: 'Quản lý Sản phẩm',
          icon: Package,
          items: [
            {
              id: 'products',
              href: '/admin/products',
              icon: Package,
              labelKey: 'nav.products',
              defaultLabel: 'Món ăn',
              permission: 'products.view',
            },
            {
              id: 'categories',
              href: '/admin/categories',
              icon: Tags,
              labelKey: 'nav.categories',
              defaultLabel: 'Danh mục',
              permission: 'categories.view',
            },
            {
              id: 'combos',
              href: '/admin/combos',
              icon: Gift,
              labelKey: 'nav.combos',
              defaultLabel: 'Combo món',
              permission: 'combos.view',
            },
          ],
        },
      },
      {
        type: 'accordion',
        data: {
          id: 'content_mgmt',
          titleKey: 'nav.contentManagement',
          defaultTitle: 'Quản lý Nội dung',
          icon: Newspaper,
          items: [
            {
              id: 'articles',
              href: '/admin/articles',
              icon: Newspaper,
              labelKey: 'nav.articles',
              defaultLabel: 'Tin tức & Bài viết',
              permission: 'articles.view',
            },
            {
              id: 'comments',
              href: '/admin/articles/comments',
              icon: MessageSquare,
              labelKey: 'nav.articleComments',
              defaultLabel: 'Duyệt bình luận',
              permission: 'comments.view',
            },
          ],
        },
      },
    ],
  },

  // 4. MARKETING & KHÁCH HÀNG
  {
    id: 'marketing_loyalty',
    titleKey: 'nav.section.marketing',
    defaultTitle: 'MARKETING & KHÁCH HÀNG',
    entries: [
      {
        type: 'item',
        data: {
          id: 'memberships',
          href: '/admin/memberships',
          icon: Crown,
          labelKey: 'nav.memberships',
          defaultLabel: 'Avora Rewards',
          permission: 'membership.view',
          accentColor: 'text-amber-500 hover:text-amber-600',
        },
      },
      {
        type: 'item',
        data: {
          id: 'reviews',
          href: '/admin/reviews',
          icon: MessageSquare,
          labelKey: 'nav.reviews',
          defaultLabel: 'Đánh giá & Phản hồi',
          permission: 'reviews.view',
          badge: (
            <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-500 text-white rounded shadow-2xs">
              MỚI
            </span>
          ),
        },
      },
      {
        type: 'accordion',
        data: {
          id: 'marketing_campaigns',
          titleKey: 'nav.marketingCampaigns',
          defaultTitle: 'Chiến dịch Marketing',
          icon: Megaphone,
          items: [
            {
              id: 'banners',
              href: '/admin/banners',
              icon: Layers,
              labelKey: 'nav.banners',
              defaultLabel: 'Banner & Popup',
              permission: 'vouchers.view',
            },
            {
              id: 'flash_sales',
              href: '/admin/flash-sales',
              icon: Zap,
              labelKey: 'nav.flashSales',
              defaultLabel: 'Flash Sale',
              permission: 'flashsales.view',
            },
            {
              id: 'vouchers',
              href: '/admin/vouchers',
              icon: Ticket,
              labelKey: 'nav.vouchers',
              defaultLabel: 'Mã giảm giá (Vouchers)',
              permission: 'vouchers.view',
            },
          ],
        },
      },
      {
        type: 'accordion',
        data: {
          id: 'farm_management',
          titleKey: 'nav.farmManagement',
          defaultTitle: 'AVORA Farm (Game)',
          icon: Sprout,
          items: [
            {
              id: 'farm_overview',
              href: '/admin/farm',
              icon: LayoutDashboard,
              labelKey: 'nav.farmOverview',
              defaultLabel: 'Tổng quan Farm',
              permission: 'farm.view',
            },
            {
              id: 'farm_crops',
              href: '/admin/farm/crops',
              icon: Sprout,
              labelKey: 'nav.farmCrops',
              defaultLabel: 'Cây trồng & Hạt',
              permission: 'farm.manage_crop',
            },
            {
              id: 'farm_mutations',
              href: '/admin/farm/mutations',
              icon: Dna,
              labelKey: 'nav.farmMutations',
              defaultLabel: 'Đột biến sinh học',
              permission: 'farm.manage_mutation',
            },
            {
              id: 'farm_shop',
              href: '/admin/farm/shop',
              icon: Gift,
              labelKey: 'nav.farmShop',
              defaultLabel: 'Cửa hàng & Đổi thưởng',
              permission: 'farm.manage_shop',
            },
            {
              id: 'farm_economy',
              href: '/admin/farm/economy',
              icon: PieChart,
              labelKey: 'nav.farmEconomy',
              defaultLabel: 'Kinh tế & Lạm phát',
              permission: 'farm.view_economy',
            },
            {
              id: 'farm_security',
              href: '/admin/farm/security',
              icon: ShieldAlert,
              labelKey: 'nav.farmSecurity',
              defaultLabel: 'Giám sát gian lận',
              permission: 'farm.view_security',
            },
          ],
        },
      },
    ],
  },

  // 5. CÀI ĐẶT HỆ THỐNG
  {
    id: 'system_settings',
    titleKey: 'nav.section.system',
    defaultTitle: 'CÀI ĐẶT HỆ THỐNG',
    entries: [
      {
        type: 'accordion',
        data: {
          id: 'store_config',
          titleKey: 'nav.storeConfig',
          defaultTitle: 'Cấu hình Cửa hàng',
          icon: Store,
          items: [
            {
              id: 'branches',
              href: '/admin/branches',
              icon: Store,
              labelKey: 'nav.branches',
              defaultLabel: 'Cửa hàng/ Chi nhánh',
              permission: 'branches.view',
            },
            {
              id: 'operating_slots',
              href: '/admin/operating-slots',
              icon: Clock,
              labelKey: 'nav.operatingSlots',
              defaultLabel: 'Khung giờ hoạt động',
              permission: 'operating_slots.view',
            },
            {
              id: 'payment_methods',
              href: '/admin/payment-methods',
              icon: CreditCard,
              labelKey: 'nav.paymentMethods',
              defaultLabel: 'Thanh toán',
              permission: 'payment_methods.view',
            },
            {
              id: 'print_templates',
              href: '/admin/settings/print-templates',
              icon: FileText,
              labelKey: 'nav.printTemplates',
              defaultLabel: 'Mẫu in ấn',
              permission: 'print_templates.view',
            },
            {
              id: 'kitchen_printers',
              href: '/admin/settings/kitchen-printers',
              icon: Printer,
              labelKey: 'nav.kitchenPrinters',
              defaultLabel: 'Máy in nhà bếp',
              permission: 'kitchen_settings.view',
            },
            {
              id: 'settings_general',
              href: '/admin/settings',
              icon: Settings,
              labelKey: 'nav.settings',
              defaultLabel: 'Cài đặt chung',
              permission: 'settings.general.view',
            },
          ],
        },
      },
      {
        type: 'item',
        data: {
          id: 'audit_logs',
          href: '/admin/audit-logs',
          icon: History,
          labelKey: 'nav.auditLogs',
          defaultLabel: 'Nhật ký hoạt động',
          permission: 'audit_logs.view',
        },
      },
    ],
  },
];

/* ==========================================================================
   COMPONENT CHÍNH: ADMIN SIDEBAR
   ========================================================================== */

export default function AdminSidebar() {
  const pathname = usePathname();
  const {
    can,
    selectedBranchId,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    isSidebarCollapsed,
    toggleSidebarCollapse,
  } = useAdmin();
  const { t } = useLanguage();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // State mở/đóng từng Accordion
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});

  // State cho Floating Flyout Submenu khi Sidebar collapsed
  const [flyoutState, setFlyoutState] = useState<{
    group: AccordionNavGroup;
    top: number;
    left: number;
    arrowTop: number;
  } | null>(null);

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleGroupMouseEnter = (group: AccordionNavGroup, e: React.MouseEvent<HTMLElement>) => {
    if (!isSidebarCollapsed) return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const flyoutEstimatedHeight = Math.min(360, 48 + group.items.length * 44);
    const maxTop = typeof window !== 'undefined' ? window.innerHeight - flyoutEstimatedHeight - 16 : 400;
    const computedTop = Math.max(12, Math.min(rect.top - 8, maxTop));
    const arrowOffset = Math.max(16, Math.min(rect.top - computedTop + 14, flyoutEstimatedHeight - 24));

    setFlyoutState({
      group,
      top: computedTop,
      left: rect.right + 10,
      arrowTop: arrowOffset,
    });
  };

  const handleGroupMouseLeave = () => {
    if (!isSidebarCollapsed) return;
    closeTimeoutRef.current = setTimeout(() => {
      setFlyoutState(null);
    }, 180);
  };

  const handleFlyoutMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleFlyoutMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setFlyoutState(null);
    }, 180);
  };

  // Tự động đóng flyout khi đổi pathname hoặc chuyển trạng thái sidebar
  useEffect(() => {
    setFlyoutState(null);
  }, [pathname, isSidebarCollapsed]);

  useEffect(() => {
    const handleScrollOrResize = () => {
      setFlyoutState(null);
    };
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, []);

  // Ref tham chiếu đến mục active để tự động cuộn
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);

  // Tự động cuộn mượt mà đến mục active nếu menu ở vị trí bên dưới
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeItemRef.current) {
        activeItemRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [pathname, openAccordions]);

  // Dynamic branding từ Cài đặt hệ thống (GET /api/settings/public)
  const [branding, setBranding] = useState<{
    logoDesktopUrl: string;
    faviconUrl: string;
    restaurantName: string;
  }>({
    logoDesktopUrl: '/avora_logo_ngang.png',
    faviconUrl: '/avora_logo.png',
    restaurantName: 'AVORA Restaurant',
  });

  // Tải cài đặt nhận diện thương hiệu từ máy chủ
  useEffect(() => {
    let isMounted = true;
    const loadPublicSettings = async () => {
      try {
        const res = await fetch('/api/settings/public');
        if (res.ok) {
          const data = await res.json();
          if (data?.data && isMounted) {
            setBranding({
              logoDesktopUrl: data.data.logo_desktop_url || '/avora_logo_ngang.png',
              faviconUrl: data.data.favicon_url || '/avora_logo.png',
              restaurantName: data.data.restaurant_name || 'AVORA Restaurant',
            });
          }
        }
      } catch (err) {
        // Fallback mặc định an toàn nếu lỗi mạng
      }
    };
    loadPublicSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Đóng Mobile Drawer khi thay đổi URL
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  // Kiểm tra route có đang active không (xử lý chính xác tránh trùng lặp route lồng nhau)
  const isNavActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/admin/dashboard') {
      return pathname === '/admin/dashboard' || pathname === '/admin';
    }
    if (href === '/admin/settings') {
      return pathname === '/admin/settings';
    }
    if (href === '/admin/reports') {
      return pathname === '/admin/reports';
    }
    if (href === '/admin/articles') {
      return (
        pathname === '/admin/articles' ||
        (pathname.startsWith('/admin/articles/') && !pathname.startsWith('/admin/articles/comments'))
      );
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  // Tự động mở accordion chứa route hiện tại
  useEffect(() => {
    NAVIGATION_SECTIONS.forEach((section) => {
      section.entries.forEach((entry) => {
        if (entry.type === 'accordion') {
          const hasActiveChild = entry.data.items.some((item) => isNavActive(item.href));
          if (hasActiveChild) {
            setOpenAccordions((prev) => ({ ...prev, [entry.data.id]: true }));
          }
        }
      });
    });
  }, [pathname]);

  const toggleAccordion = (groupId: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const closeSidebar = () => setMobileSidebarOpen(false);

  // Lọc Navigation dựa trên phân quyền RBAC của người dùng (chống Hydration Mismatch bằng mounted guard)
  const authorizedSections = useMemo(() => {
    if (!mounted) {
      return NAVIGATION_SECTIONS;
    }
    return NAVIGATION_SECTIONS.map((section) => {
      const filteredEntries = section.entries
        .map((entry) => {
          if (entry.type === 'item') {
            return can(entry.data.permission, selectedBranchId) ? entry : null;
          } else {
            const allowedChildren = entry.data.items.filter((child) =>
              can(child.permission, selectedBranchId)
            );
            if (allowedChildren.length === 0) return null;
            return {
              type: 'accordion' as const,
              data: {
                ...entry.data,
                items: allowedChildren,
              },
            };
          }
        })
        .filter((entry): entry is NavEntry => entry !== null);

      return {
        ...section,
        entries: filteredEntries,
      };
    }).filter((section) => section.entries.length > 0);
  }, [mounted, can, selectedBranchId]);

  /* ==========================================================================
     RENDER HELPER FUNCTIONS
     ========================================================================== */

  // Render mục đơn (Leaf Item)
  const renderLeafItem = (item: LeafNavItem, collapsed: boolean, onClick?: () => void) => {
    const active = isNavActive(item.href);
    const Icon = item.icon;
    const label = t(item.labelKey, item.defaultLabel);

    if (collapsed) {
      return (
        <div key={item.id} className="relative group flex justify-center py-1 w-full">
          <Link
            ref={active ? activeItemRef : undefined}
            href={item.href}
            prefetch={true}
            onClick={onClick}
            title={label}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-150 ${
              active
                ? 'bg-red-50 text-red-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Icon
              size={20}
              strokeWidth={active ? 2.5 : 2}
              className={active ? 'text-red-600' : item.accentColor || 'text-slate-500'}
            />
            {active && (
              <span className="absolute -left-1 top-2 bottom-2 w-1 bg-red-600 rounded-r-full" />
            )}
          </Link>
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        ref={active ? activeItemRef : undefined}
        href={item.href}
        prefetch={true}
        onClick={onClick}
        className={`group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
          active
            ? 'bg-red-50/85 text-red-600 font-bold border-l-4 border-red-600 shadow-2xs'
            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon
            size={18}
            strokeWidth={active ? 2.4 : 1.9}
            className={`shrink-0 transition-colors ${
              active ? 'text-red-600' : item.accentColor || 'text-slate-400 group-hover:text-slate-600'
            }`}
          />
          <span className={`truncate ${item.accentColor && !active ? item.accentColor : ''}`}>
            {label}
          </span>
        </div>

        {item.badge && <div className="shrink-0">{item.badge}</div>}
      </Link>
    );
  };

  // Render nhóm Accordion
  const renderAccordionGroup = (group: AccordionNavGroup, collapsed: boolean, onClick?: () => void) => {
    const Icon = group.icon;
    const title = t(group.titleKey, group.defaultTitle);
    const isOpen = !!openAccordions[group.id];
    const hasActiveChild = group.items.some((item) => isNavActive(item.href));

    // Chế độ THU NHỎ (Collapsed): Icon căn giữa kèm floating flyout portal sang phải
    if (collapsed) {
      const isFlyoutOpen = flyoutState?.group.id === group.id;
      return (
        <div
          key={group.id}
          className="relative flex justify-center py-1 w-full"
          onMouseEnter={(e) => handleGroupMouseEnter(group, e)}
          onMouseLeave={handleGroupMouseLeave}
        >
          <button
            type="button"
            onClick={(e) => {
              if (isFlyoutOpen) {
                setFlyoutState(null);
              } else {
                handleGroupMouseEnter(group, e);
              }
            }}
            aria-label={title}
            title={title}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-150 cursor-pointer ${
              hasActiveChild || isFlyoutOpen
                ? 'bg-red-50 text-red-600 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Icon
              size={20}
              strokeWidth={hasActiveChild || isFlyoutOpen ? 2.5 : 2}
              className={hasActiveChild || isFlyoutOpen ? 'text-red-600' : 'text-slate-500'}
            />
            {hasActiveChild && (
              <span className="absolute -left-1 top-2 bottom-2 w-1 bg-red-600 rounded-r-full" />
            )}
            {/* Tam giác mũi tên nhỏ chỉ sang phải như ảnh 4 */}
            <span
              className={`absolute right-1 w-0 h-0 border-y-[3px] border-y-transparent border-l-[3.5px] transition-colors ${
                hasActiveChild || isFlyoutOpen
                  ? 'border-l-red-600'
                  : 'border-l-slate-400'
              }`}
            />
          </button>
        </div>
      );
    }

    // Chế độ MỞ RỘNG (Expanded): Accordion Menu phong cách Sushi Wa
    return (
      <div key={group.id} className="space-y-0.5">
        {/* Accordion Parent Header */}
        <button
          type="button"
          onClick={() => toggleAccordion(group.id)}
          className={`w-full group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer select-none ${
            hasActiveChild
              ? 'bg-red-50/85 text-red-600 font-bold border-l-4 border-red-600 shadow-2xs'
              : isOpen
              ? 'text-slate-900 font-semibold bg-slate-50/80'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Icon
              size={18}
              strokeWidth={hasActiveChild ? 2.4 : 1.9}
              className={`shrink-0 transition-colors ${
                hasActiveChild ? 'text-red-600' : 'text-slate-400 group-hover:text-slate-600'
              }`}
            />
            <span className="truncate">{title}</span>
          </div>

          <ChevronDown
            size={16}
            className={`shrink-0 transition-transform duration-200 ${
              isOpen
                ? 'rotate-180 text-red-600'
                : hasActiveChild
                ? 'text-red-600'
                : 'text-slate-400 group-hover:text-slate-600'
            }`}
          />
        </button>

        {/* Accordion Sub-items Animated Container */}
        <div
          className={`grid transition-all duration-200 ease-in-out ${
            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
          }`}
        >
          <div className="overflow-hidden">
            <div className="bg-[#f8fafc] rounded-xl p-1.5 mx-2 my-1 border border-slate-100/80 space-y-0.5">
              {group.items.map((subItem) => {
                const subActive = isNavActive(subItem.href);
                const SubIcon = subItem.icon;
                const subLabel = t(subItem.labelKey, subItem.defaultLabel);

                return (
                  <Link
                    key={subItem.id}
                    ref={subActive ? activeItemRef : undefined}
                    href={subItem.href}
                    prefetch={true}
                    onClick={onClick}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-[12.5px] transition-all duration-150 ${
                      subActive
                        ? 'bg-white text-red-600 font-bold shadow-[0_1px_3px_rgba(218,37,29,0.08)] border border-red-100/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <SubIcon
                        size={16}
                        strokeWidth={subActive ? 2.3 : 1.8}
                        className={`shrink-0 transition-colors ${
                          subActive ? 'text-red-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{subLabel}</span>
                    </div>

                    {subItem.badge && <div className="shrink-0">{subItem.badge}</div>}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ==========================================================================
     DESKTOP SIDEBAR CONTENT
     ========================================================================== */

  const desktopSidebarContent = (
    <div className="flex flex-col h-full bg-white text-slate-800">
      {/* Brand Header */}
      <div
        className={`h-16 px-3.5 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'
          } border-b border-slate-100 shrink-0 transition-all`}
      >
        {!isSidebarCollapsed ? (
          <>
            <Link href="/admin" className="flex items-center gap-2 min-w-0">
              <Image
                src={branding.logoDesktopUrl || '/avora_logo_ngang.png'}
                alt={branding.restaurantName}
                width={135}
                height={36}
                priority
                style={{ width: 'auto', height: 'auto' }}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              aria-label="Thu gọn thanh điều hướng"
              title="Thu gọn menu"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
          </>
        ) : (
          /* Trạng thái THU NHỎ: Bỏ hoàn toàn background, border, border-radius/card của logo AVORA */
          <div className="flex items-center justify-center w-full h-full py-1">
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              aria-label="Mở rộng thanh điều hướng"
              title="Mở rộng menu (Nhấp để mở)"
              className="group/btn relative p-0 flex items-center justify-center cursor-pointer bg-transparent border-0 shadow-none outline-none"
            >
              <Image
                src={branding.faviconUrl || '/avora_logo.png'}
                alt="Avora Favicon"
                width={40}
                height={40}
                priority
                className="w-10 h-10 object-contain bg-transparent border-0 shadow-none rounded-none transition-transform group-hover/btn:scale-105"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#da251d] text-white rounded-full shadow-sm flex items-center justify-center group-hover/btn:bg-red-700 transition-colors">
                <Menu size={11} strokeWidth={2.5} />
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav
        suppressHydrationWarning
        className={`flex-1 overflow-y-auto overflow-x-hidden py-3 select-none ${
          isSidebarCollapsed
            ? 'px-1 space-y-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
            : 'px-2 space-y-3 custom-scrollbar'
        }`}
      >
        {authorizedSections.map((section) => (
          <div key={section.id} className="space-y-0.5">
            {!isSidebarCollapsed && (
              <p className="px-3.5 pt-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                {t(section.titleKey, section.defaultTitle)}
              </p>
            )}

            <div className="space-y-0.5">
              {section.entries.map((entry) => {
                if (entry.type === 'item') {
                  return renderLeafItem(entry.data, isSidebarCollapsed);
                }
                return renderAccordionGroup(entry.data, isSidebarCollapsed);
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  /* ==========================================================================
     RENDER CHÍNH
     ========================================================================== */

  return (
    <>
      {/* Desktop Sticky Sidebar - Fixed Height within Layout */}
      <aside
        className={`hidden md:flex flex-col shrink-0 h-full transition-[width] duration-300 ease-in-out border-r border-slate-200 bg-white z-30 shadow-xs relative select-none ${
          isSidebarCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {desktopSidebarContent}
      </aside>

      {/* Collapsed Mode Floating Flyout Submenu (Mounted directly to document.body) */}
      {mounted &&
        isSidebarCollapsed &&
        flyoutState &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: flyoutState.top,
              left: flyoutState.left,
              zIndex: 9999,
            }}
            onMouseEnter={handleFlyoutMouseEnter}
            onMouseLeave={handleFlyoutMouseLeave}
            className="w-60 bg-white rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] border border-slate-100 p-2 select-none animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Left Caret Arrow pointing to parent item */}
            <div
              style={{ top: flyoutState.arrowTop }}
              className="absolute -left-2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[8px] border-r-white drop-shadow-[-2px_0_1px_rgba(0,0,0,0.06)]"
            />

            {/* Flyout Group Title */}
            <div className="px-3 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {t(flyoutState.group.titleKey, flyoutState.group.defaultTitle)}
              </span>
            </div>

            {/* Submenu Items List */}
            <div className="space-y-0.5">
              {flyoutState.group.items.map((subItem) => {
                const subActive = isNavActive(subItem.href);
                const SubIcon = subItem.icon;
                const subLabel = t(subItem.labelKey, subItem.defaultLabel);
                return (
                  <Link
                    key={subItem.id}
                    ref={subActive ? activeItemRef : undefined}
                    href={subItem.href}
                    prefetch={true}
                    onClick={() => {
                      setFlyoutState(null);
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${
                      subActive
                        ? 'bg-red-50 text-red-600 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <SubIcon
                        size={17}
                        strokeWidth={subActive ? 2.3 : 1.8}
                        className={`shrink-0 transition-colors ${
                          subActive ? 'text-red-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{subLabel}</span>
                    </div>
                    {subItem.badge && <div className="shrink-0">{subItem.badge}</div>}
                  </Link>
                );
              })}
            </div>
          </div>,
          document.body
        )}

      {/* Mobile Drawer Backdrop */}
      {isMobileSidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden animate-fade-in"
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white text-slate-800 md:hidden flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <Link href="/admin/dashboard" prefetch={true} onClick={closeSidebar} className="flex items-center">
            <Image
              src={branding.logoDesktopUrl || '/avora_logo_ngang.png'}
              alt={branding.restaurantName}
              width={135}
              height={36}
              priority
              style={{ width: 'auto', height: 'auto' }}
              className="h-8 w-auto object-contain"
            />
          </Link>
          <button
            type="button"
            onClick={closeSidebar}
            aria-label="Đóng thanh điều hướng"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mobile Navigation List */}
        <nav suppressHydrationWarning className="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar">
          {authorizedSections.map((section) => (
            <div key={section.id} className="space-y-0.5">
              <p className="px-3.5 pt-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                {t(section.titleKey, section.defaultTitle)}
              </p>
              <div className="space-y-0.5">
                {section.entries.map((entry) => {
                  if (entry.type === 'item') {
                    return renderLeafItem(entry.data, false, closeSidebar);
                  }
                  return renderAccordionGroup(entry.data, false, closeSidebar);
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}

