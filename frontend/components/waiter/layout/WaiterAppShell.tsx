'use client';

import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import WaiterHeader from './WaiterHeader';
import WaiterBottomNav from './WaiterBottomNav';
import { useWaiterRealtime } from '@/hooks/useWaiterRealtime';
import { useWaiterStore } from '@/store/useWaiterStore';
import { useAdmin } from '@/contexts/AdminContext';
import ConnectionIndicator from '../core/ConnectionIndicator';
import AttendanceModal from '../attendance/AttendanceModal';
import QrAttendanceScanner from '../attendance/QrAttendanceScanner';
import { useWaiterBackHandler } from '@/hooks/useWaiterBackHandler';
import { syncEngine } from '@/lib/offline/syncEngine';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function WaiterAppShell({ children }: { children: React.ReactNode }) {
  const { user, selectedBranchId, setSelectedBranchId, availableBranches } = useAdmin();
  const { setActiveBranchId, setCurrentBranch, setCurrentUser } = useWaiterStore();

  // Fetch real POS init data from backend with saved branch support
  const savedBranch = typeof window !== 'undefined'
    ? localStorage.getItem('avora_waiter_selected_branch') || localStorage.getItem('avora_admin_selected_branch')
    : null;
  const targetBranchId = (selectedBranchId && selectedBranchId !== 'ALL') ? selectedBranchId : savedBranch;
  const branchParam = targetBranchId ? `?branchId=${targetBranchId}` : '';
  const { data: initResponse } = useSWR(`/api/pos/init${branchParam}`, fetcher);

  const initData = initResponse?.data;
  const currentBranch = initData?.currentBranch || availableBranches?.find(b => b.id === targetBranchId) || availableBranches?.[0];
  const effectiveBranchId = currentBranch?.id || '';

  // Synchronize context to Waiter store
  useEffect(() => {
    if (user) {
      setCurrentUser({
        id: user.id || '',
        fullName: user.fullName || 'Nhân viên phục vụ',
        role: user.role || 'WAITER',
        email: user.email,
      });
    }
  }, [user, setCurrentUser]);

  useEffect(() => {
    if (currentBranch) {
      setCurrentBranch({
        id: currentBranch.id,
        name: currentBranch.name,
        branchCode: currentBranch.branchCode,
      });
      setActiveBranchId(currentBranch.id);
      syncEngine.setActiveBranch(currentBranch.id);
      if (selectedBranchId === 'ALL') {
        setSelectedBranchId(currentBranch.id);
      }
    }
  }, [currentBranch, selectedBranchId, setSelectedBranchId, setCurrentBranch, setActiveBranchId]);

  // Initialize Realtime WebSocket with real parameters
  useWaiterRealtime(undefined, effectiveBranchId, user?.id);

  // Initialize Android Native Back Handler & Double Back to Exit
  useWaiterBackHandler();

  const isAttendanceModalOpen = useWaiterStore((s) => s.isAttendanceModalOpen);
  const setAttendanceModalOpen = useWaiterStore((s) => s.setAttendanceModalOpen);
  const isAttendanceScannerOpen = useWaiterStore((s) => s.isAttendanceScannerOpen);
  const setAttendanceScannerOpen = useWaiterStore((s) => s.setAttendanceScannerOpen);
  const registerModalHandler = useWaiterStore((s) => s.registerModalHandler);

  // Register Attendance Modal & Scanner with the back navigation stack
  useEffect(() => {
    return registerModalHandler('shell-attendance', () => {
      if (isAttendanceScannerOpen) {
        setAttendanceScannerOpen(false);
        return true;
      }
      if (isAttendanceModalOpen) {
        setAttendanceModalOpen(false);
        return true;
      }
      return false;
    });
  }, [isAttendanceScannerOpen, isAttendanceModalOpen, setAttendanceScannerOpen, setAttendanceModalOpen, registerModalHandler]);

  const [mounted, setMounted] = useState(false);
  const theme = useWaiterStore((s) => s.theme);

  useEffect(() => {
    setMounted(true);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme || 'light');
    }
    // Register Service Worker with safe update handling
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/waiter-sw.js')
        .then((reg) => {
          console.log('[Waiter SW] Registered successfully', reg);
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  installing.postMessage({ type: 'SKIP_WAITING' });
                }
              };
            }
          };
        })
        .catch((err) => console.error('[Waiter SW] Registration failed:', err));
    }
  }, [theme]);

  // Lock document body and intercept touch gestures to prevent iOS rubber-band viewport bounce
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const originalOverscroll = document.body.style.overscrollBehavior;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    const originalHeight = document.body.style.height;

    document.documentElement.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      const target = e.target as HTMLElement | null;
      const scrollable = target?.closest('.overflow-y-auto, .overflow-auto') as HTMLElement | null;

      if (!scrollable) {
        // Touch originated on static header, bottom nav, buttons or background
        if (e.cancelable) {
          e.preventDefault();
        }
        return;
      }

      // Inside scrollable container: stop propagation at boundaries
      const isAtTop = scrollable.scrollTop <= 0;
      const isAtBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;

      if (isAtTop && deltaY > 0) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      if (isAtBottom && deltaY < 0) {
        if (e.cancelable) e.preventDefault();
        return;
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.documentElement.style.overscrollBehavior = '';
      document.documentElement.style.overflow = '';
      document.body.style.overscrollBehavior = originalOverscroll;
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
      document.body.style.height = originalHeight;

      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  const selectedTableId = useWaiterStore((s) => s.selectedTableId);
  const selectedOrderId = useWaiterStore((s) => s.selectedOrderId);
  const isDrilldown = Boolean(selectedTableId || selectedOrderId);

  if (!mounted) return null; // Avoid hydration mismatch on PWA

  return (
    <div className="fixed inset-0 flex flex-col h-[100dvh] max-h-[100dvh] w-full bg-slate-50 text-slate-900 overflow-hidden select-none overscroll-none touch-none">
      {!isDrilldown && <WaiterHeader />}
      
      {/* Main Content Area: Cố định layout, từng màn hình tự quản lý scroll độc lập */}
      <main className="flex-1 min-h-0 w-full overflow-hidden flex flex-col relative touch-auto overscroll-contain">
        {children}
      </main>

      {!isDrilldown && <WaiterBottomNav />}
      <ConnectionIndicator />
      <AttendanceModal />
      <QrAttendanceScanner
        isOpen={isAttendanceScannerOpen}
        onClose={() => setAttendanceScannerOpen(false)}
      />
    </div>
  );
}
