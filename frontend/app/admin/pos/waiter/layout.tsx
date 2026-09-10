import { Metadata, Viewport } from 'next';
import React from 'react';
import WaiterAppShell from '@/components/waiter/layout/WaiterAppShell';

export const metadata: Metadata = {
  title: 'AVORA Waiter POS',
  description: 'Siêu ứng dụng Order cho Phục vụ AVORA',
  manifest: '/waiter-manifest.json',
  appleWebApp: {
    capable: true,
    title: 'AVORA',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#DA251D',
};

export default function WaiterLayout({ children }: { children: React.ReactNode }) {
  return <WaiterAppShell>{children}</WaiterAppShell>;
}
