"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Home, ClipboardList, ShoppingCart, User, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const { cartItems } = useCart();
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const lastScrollY = useRef(0);
  const scrolledUpAcc = useRef(0);

  useEffect(() => {
    const HIDE_THRESHOLD = 10;
    const SHOW_THRESHOLD = 20;

    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const nearBottom = currentY + winHeight >= docHeight - 120;

      // Show scroll-to-top button when past 400px
      setShowScrollTop(currentY > 400);

      if (currentY <= 40 || nearBottom) {
        // At very top or near bottom — always show nav
        setIsVisible(true);
        scrolledUpAcc.current = 0;
      } else if (delta > HIDE_THRESHOLD) {
        // Scrolling down
        setIsVisible(false);
        scrolledUpAcc.current = 0;
      } else if (delta < 0) {
        // Scrolling up — accumulate
        scrolledUpAcc.current += Math.abs(delta);
        if (scrolledUpAcc.current >= SHOW_THRESHOLD) {
          setIsVisible(true);
        }
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Fix active tab: use exact match for all tabs.
  // "Đơn hàng" links to /profile?tab=orders — we check search param
  const navItems = [
    { href: '/', icon: Home, label: 'Trang chủ', match: () => pathname === '/' },
    {
      href: '/orders', icon: ClipboardList, label: 'Đơn hàng',
      match: () => pathname === '/orders' || pathname.startsWith('/orders/'),
    },
    {
      href: '/cart', icon: ShoppingCart, label: 'Giỏ hàng',
      match: () => pathname === '/cart',
      badge: totalItems,
    },
    {
      href: '/profile', icon: User, label: 'Tài khoản',
      match: () => pathname === '/profile' || pathname.startsWith('/profile/'),
    },
  ];

  return (
    <>
      {/* Scroll-to-top FAB — appears above bottom nav on mobile */}
      <div
        className={`md:hidden fixed z-[54] transition-all duration-300 ease-out ${
          showScrollTop ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } ${isVisible ? 'bottom-[68px]' : 'bottom-4'}`}
        style={{ right: '16px' }}
      >
        <button
          onClick={scrollToTop}
          className="w-10 h-10 bg-red-600 text-white rounded-full shadow-lg shadow-red-600/40 flex items-center justify-center hover:bg-red-700 active:scale-95 transition-all"
          aria-label="Lên đầu trang"
        >
          <ChevronUp className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Bottom nav bar */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="h-px bg-gradient-to-r from-transparent via-red-200 to-transparent" />
        <nav
          className="bg-white/96 backdrop-blur-lg border-t border-slate-100 flex items-stretch justify-around"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {navItems.map(({ href, icon: Icon, label, match, badge }) => {
            const active = match();
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 flex-1 transition-colors min-h-[52px] ${
                  active ? 'text-red-600' : 'text-slate-400'
                }`}
              >
                {/* Active top indicator */}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2.5px] bg-red-600 rounded-b-full" />
                )}

                {/* Icon */}
                <div className="relative">
                  <Icon
                    className={`w-[22px] h-[22px] transition-all duration-200 ${active ? 'scale-110' : ''}`}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  {typeof badge === 'number' && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-[9px] font-bold min-w-[15px] h-[15px] px-0.5 rounded-full flex items-center justify-center border-[1.5px] border-white leading-none">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>

                <span className={`text-[9px] font-bold leading-none mt-0.5 ${active ? 'text-red-600' : 'text-slate-400'}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
