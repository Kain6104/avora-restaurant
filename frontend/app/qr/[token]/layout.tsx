'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { QrSessionProvider } from '@/components/qr-order/QrSessionContext';
import { Loader2 } from 'lucide-react';

function QrSessionWrapper({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const token = (params?.token as string) || '';

  return <QrSessionProvider token={token}>{children}</QrSessionProvider>;
}

export default function QrTokenLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFF8F8] flex flex-col items-center justify-center p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#DA251D] mb-2" />
          <p className="text-xs text-slate-500">Đang khởi tạo...</p>
        </div>
      }
    >
      <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#FFF8F8]">
        {/* Fixed Viewport Background Layer: Giữ cố định 100% viewport khi cuộn trang */}
        <div
          aria-hidden="true"
          className="fixed inset-0 w-full h-full pointer-events-none z-0 bg-top bg-no-repeat bg-cover"
          style={{
            backgroundImage: "url('/images/qr-order/backgrounds/qr-order-page-bg.png')",
            backgroundColor: '#FFF8F8',
          }}
        />
        {/* Scrollable View Layer */}
        <div className="relative z-10 min-h-[100dvh] w-full">
          <QrSessionWrapper>{children}</QrSessionWrapper>
        </div>
      </div>
    </Suspense>
  );
}
