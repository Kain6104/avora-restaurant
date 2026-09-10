'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Trang cũ /profile/saved-articles đã được chuyển hướng sang /favorites?tab=articles
 */
export default function SavedArticlesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/favorites?tab=articles');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f7f8fa] flex flex-col items-center justify-center space-y-3">
      <div className="w-10 h-10 border-3 border-[#da251d] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-bold text-slate-500">Đang chuyển hướng đến trang Bài viết đã lưu...</p>
    </div>
  );
}
