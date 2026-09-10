'use client';

import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import WaiterHeader from './WaiterHeader';
import WaiterBottomNav from './WaiterBottomNav';
import { useWaiterRealtime } from '@/hooks/useWaiterRealtime';
import { useWaiterStore } from '@/store/useWaiterStore';
import { useAdmin } from '@/contexts/AdminContext';
import ConnectionIndicator from '../core/ConnectionIndicator';

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
      if (selectedBranchId === 'ALL') {
        setSelectedBranchId(currentBranch.id);
      }
    }
  }, [currentBranch, selectedBranchId, setSelectedBranchId, setCurrentBranch, setActiveBranchId]);

  // Initialize Realtime WebSocket with real parameters
  useWaiterRealtime(undefined, effectiveBranchId, user?.id);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/waiter-sw.js')
        .then((reg) => console.log('Waiter SW registered', reg))
        .catch((err) => console.error('Waiter SW error', err));
    }
  }, []);

  const selectedTableId = useWaiterStore((s) => s.selectedTableId);
  const selectedOrderId = useWaiterStore((s) => s.selectedOrderId);
  const isDrilldown = Boolean(selectedTableId || selectedOrderId);

  if (!mounted) return null; // Avoid hydration mismatch on PWA

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-50 text-slate-900 overflow-hidden relative">
      {!isDrilldown && <WaiterHeader />}
      
      {/* Main Content Area */}
      <main className={`flex-1 w-full overflow-y-auto overflow-x-hidden touch-pan-y scroll-smooth ${isDrilldown ? 'p-0' : 'pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]'}`}>
        {children}
      </main>

      {!isDrilldown && <WaiterBottomNav />}
      <ConnectionIndicator />
    </div>
  );
}
