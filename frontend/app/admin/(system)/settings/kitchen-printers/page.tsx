'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function KitchenPrintersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Đã chuyển toàn bộ cấu hình máy in vào trực tiếp bên trong /admin/pos
    router.replace('/admin/pos?view=printer-settings');
  }, [router]);

  return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500">
      <Loader2 className="w-7 h-7 animate-spin text-[#da251d]" />
      <p className="text-sm font-medium">Đang chuyển sang Cài đặt máy in trực tiếp tại POS...</p>
    </div>
  );
}
