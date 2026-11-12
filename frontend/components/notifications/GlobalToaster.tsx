'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import SwipeableToast from './SwipeableToast';

export default function GlobalToaster() {
  const pathname = usePathname();
  const isWaiter = pathname?.startsWith('/admin/pos/waiter');

  if (isWaiter) {
    return (
      <Toaster
        position="bottom-center"
        containerStyle={{
          bottom: 118,
          zIndex: 999999,
        }}
        toastOptions={{
          duration: 3500,
        }}
      >
        {(t) => <SwipeableToast t={t} />}
      </Toaster>
    );
  }

  // POS & Admin: Top-left with safe-area spacing
  return (
    <Toaster
      position="top-left"
      containerStyle={{
        top: 64,
        left: 16,
        zIndex: 999999,
      }}
      toastOptions={{
        duration: 3800,
      }}
    >
      {(t) => <SwipeableToast t={t} />}
    </Toaster>
  );
}
