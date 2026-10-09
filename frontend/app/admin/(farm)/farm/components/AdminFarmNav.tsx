'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Sprout,
  Dna,
  Target,
  ShoppingBag,
  Sliders,
  TrendingUp,
  ShieldAlert,
  Image as ImageIcon,
  Gift,
  Mail,
  Sparkles,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/farm', label: 'Tổng Quan', icon: LayoutDashboard },
  { href: '/admin/farm/garden-layout', label: 'Bố Cục Đảo', icon: Sparkles },
  { href: '/admin/farm/mails', label: 'Hòm Thư & Quà', icon: Mail },
  { href: '/admin/farm/lucky-envelopes', label: 'Lì Xì Cây Thần', icon: Gift },
  { href: '/admin/farm/crops', label: 'Cây Trồng', icon: Sprout },
  { href: '/admin/farm/assets', label: 'Asset Cây', icon: ImageIcon },
  { href: '/admin/farm/mutations', label: 'Đột Biến', icon: Dna },
  { href: '/admin/farm/missions', label: 'Nhiệm Vụ', icon: Target },
  { href: '/admin/farm/shop', label: 'Cửa Hàng & Quà', icon: ShoppingBag },
  { href: '/admin/farm/config', label: 'Cấu Hình Game', icon: Sliders },
  { href: '/admin/farm/economy', label: 'Kinh Tế', icon: TrendingUp },
  { href: '/admin/farm/security', label: 'An Ninh & Soát Trại', icon: ShieldAlert },
];

export default function AdminFarmNav() {
  const pathname = usePathname();

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-xs mb-6 -mx-4 sm:-mx-6 px-4 sm:px-6">
      <div className="flex items-center justify-between overflow-x-auto py-2.5 gap-2 scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold shadow-xs">
            <Sprout className="w-4 h-4" />
          </div>
          <span className="font-serif font-black text-sm text-[#422006] mr-3 hidden md:inline-block">
            AVORA FARM HUB
          </span>
        </div>

        <nav className="flex items-center gap-1 shrink-0">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/admin/farm'
                ? pathname === '/admin/farm'
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
