import type { Metadata, Viewport } from 'next';
import React from 'react';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#111b15',
};

export const metadata: Metadata = {
  title: 'AVORA Farm — Vườn Thiền Hoàng Gia',
  description: 'Trải nghiệm nông trại 2.5D Isometric độc quyền trong hệ sinh thái nhà hàng AVORA',
  manifest: '/farm-manifest.json',
  icons: {
    icon: '/favora_logo.png',
    apple: '/favora_logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AVORA Farm',
  },
};

export default function FarmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background-color: #111b15 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          height: 100% !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          max-height: 100dvh !important;
        }
      `}</style>
      <div className="fixed inset-0 w-full h-full min-h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#111b15] select-none">
        {children}
      </div>
    </>
  );
}
