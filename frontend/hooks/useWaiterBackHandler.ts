'use client';

import { useEffect, useRef } from 'react';
import { useWaiterStore } from '@/store/useWaiterStore';
import toast from 'react-hot-toast';

/**
 * Native-style Android Back Navigation & Double-Back-To-Exit Handler
 * Synchronizes physical Android Back button, gestures, and in-app navigation
 */
export function useWaiterBackHandler() {
  const lastBackPressTimeRef = useRef<number>(0);
  const isExitingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Push initial sentinel state into window.history so Android back gesture fires popstate
    try {
      const currentState = window.history.state;
      if (!currentState?.avoraWaiter) {
        window.history.replaceState({ avoraWaiter: true, sentinel: 0 }, '', window.location.href);
      }
      window.history.pushState({ avoraWaiter: true, sentinel: Date.now() }, '', window.location.href);
    } catch (e) {
      console.warn('History state initialization error', e);
    }

    const handlePopState = (event: PopStateEvent) => {
      if (isExitingRef.current) return;

      const store = useWaiterStore.getState();

      // 1. Check & close topmost active modal (Bottom sheets, payment, options, confirm exit, etc.)
      const modalWasClosed = store.closeTopModal();
      if (modalWasClosed) {
        // Re-push sentinel so subsequent Back actions are also caught
        try {
          window.history.pushState({ avoraWaiter: true, sentinel: 1 }, '', window.location.href);
        } catch {}
        return;
      }

      const { activeTab, selectedOrderId, selectedTableId, sourceTab, unsentItems } = store;

      // 2. If in MenuView (adding dishes to current order) -> return to OrderDetailView
      if ((selectedOrderId || selectedTableId) && activeTab === 'MENU') {
        store.setActiveTab(sourceTab || 'TABLES');
        try {
          window.history.pushState({ avoraWaiter: true, sentinel: 1 }, '', window.location.href);
        } catch {}
        return;
      }

      // 3. If in OrderDetailView (viewing an order)
      if (selectedOrderId || selectedTableId) {
        const cartKey = selectedTableId || selectedOrderId;
        const unsent = (cartKey && unsentItems[cartKey]) || [];
        
        // If there are unsent items, do NOT exit immediately.
        // Re-run closeTopModal to let OrderDetailView show its confirm exit dialog
        if (unsent.length > 0) {
          // Triggering closeTopModal will trigger the registered order-detail unsent warning
          store.closeTopModal();
          try {
            window.history.pushState({ avoraWaiter: true, sentinel: 1 }, '', window.location.href);
          } catch {}
          return;
        }

        // Clean exit: return to exactly the origin tab (TABLES, ORDERS, QR)
        store.setSelectedOrderId(null);
        store.setSelectedTableId(null);
        store.setActiveTab(sourceTab || 'TABLES');
        try {
          window.history.pushState({ avoraWaiter: true, sentinel: 1 }, '', window.location.href);
        } catch {}
        return;
      }

      // 4. If on a non-root tab (ORDERS, QR, SETTINGS) -> return to TABLES home screen
      if (activeTab !== 'TABLES') {
        store.setActiveTab('TABLES');
        try {
          window.history.pushState({ avoraWaiter: true, sentinel: 1 }, '', window.location.href);
        } catch {}
        return;
      }

      // 5. At Root Screen (TABLES map with no active order or open modal)
      // Double Back to Exit implementation
      const now = Date.now();
      const diff = now - lastBackPressTimeRef.current;

      if (diff < 2000) {
        // Second Back press within 2000ms -> Exit application
        isExitingRef.current = true;
        toast.dismiss('waiter-double-back');

        // Navigate back in browser history or fallback to admin dashboard
        if (window.history.length > 2) {
          window.history.back();
        } else {
          window.location.href = '/admin';
        }
      } else {
        // First Back press -> Prompt user & start 2-second timer
        lastBackPressTimeRef.current = now;
        try {
          window.history.pushState({ avoraWaiter: true, sentinel: 1 }, '', window.location.href);
        } catch {}

        toast('Nhấn lần nữa để thoát ứng dụng', {
          id: 'waiter-double-back',
          icon: '👋',
          duration: 2000,
          position: 'bottom-center',
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            fontWeight: 'bold',
            fontSize: '12px',
            borderRadius: '9999px',
            padding: '8px 18px',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            marginBottom: '68px',
          },
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      toast.dismiss('waiter-double-back');
    };
  }, []);
}

