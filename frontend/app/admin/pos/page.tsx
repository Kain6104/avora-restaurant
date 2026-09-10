import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PosShell } from '@/components/pos/PosShell';

export const metadata: Metadata = {
  title: 'AVORA POS - Bán Hàng Nhà Hàng Thông Minh',
  description: 'Hệ thống điểm bán hàng POS chuyên nghiệp, realtime cho AVORA Restaurant',
};

export default function AdminPosPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-white">Đang tải AVORA POS...</div>}>
      <PosShell />
    </Suspense>
  );
}
