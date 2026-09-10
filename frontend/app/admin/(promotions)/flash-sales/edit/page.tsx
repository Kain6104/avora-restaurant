'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LegacyEditRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  useEffect(() => {
    if (id) {
      router.replace(`/admin/flash-sales/${id}/edit`);
    } else {
      router.replace('/admin/flash-sales');
    }
  }, [id, router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-xs text-slate-500">
      Đang chuyển hướng đến trình chỉnh sửa Flash Sale...
    </div>
  );
}
