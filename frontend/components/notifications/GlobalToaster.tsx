'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';

export default function GlobalToaster() {
  const pathname = usePathname();
  const isWaiter = pathname?.startsWith('/admin/pos/waiter');

  // 1. DÀNH CHO WAITER (/admin/pos/waiter):
  // Siêu nhỏ gọn, chuyên nghiệp, nằm GIỮA màn hình, cách BOTTOM 100px (trên bottom navigation bar)
  if (isWaiter) {
    return (
      <Toaster
        position="bottom-center"
        containerStyle={{
          bottom: 100,
          zIndex: 999999,
        }}
        toastOptions={{
          duration: 3500,
          className:
            '!bg-slate-900/95 !backdrop-blur-md !text-white !border !border-slate-800/80 !shadow-2xl !rounded-2xl !px-4 !py-2.5 !text-xs !font-bold !max-w-[88vw] !min-h-0 !tracking-tight',
          style: {
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderRadius: '16px',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
            padding: '10px 16px',
            fontSize: '12px',
            fontWeight: 700,
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#0f172a',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#0f172a',
            },
          },
        }}
      />
    );
  }

  // 2. DÀNH CHO POS & ADMIN (100% /admin/*, /admin/pos):
  // Chỉ BÊN TRÁI (top-left), THẤP XUỐNG 1 XÍU (top: 74px) không che Header
  // Nền trắng chuẩn AVORA Premium Light, ĐẦY ĐỦ BACKGROUND, BORDER, SHADOW
  return (
    <Toaster
      position="top-left"
      containerStyle={{
        top: 74,
        left: 16,
        zIndex: 999999,
      }}
      toastOptions={{
        duration: 4000,
        className:
          '!bg-white !text-slate-900 !border !border-slate-200/90 !shadow-xl !rounded-2xl !px-4 !py-3 !text-xs !font-bold !max-w-sm',
        style: {
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          padding: '12px 16px',
          fontSize: '12.5px',
          fontWeight: 700,
        },
        success: {
          iconTheme: {
            primary: '#16a34a',
            secondary: '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#dc2626',
            secondary: '#ffffff',
          },
        },
      }}
    />
  );
}
