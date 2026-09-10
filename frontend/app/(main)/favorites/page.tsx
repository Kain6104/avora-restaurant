import type { Metadata } from 'next';
import { Suspense } from 'react';
import FavoritesClient from './FavoritesClient';

export const metadata: Metadata = {
  title: 'Món Yêu Thích & Bài Viết Đã Lưu | Avora Restaurant',
  description: 'Quản lý toàn bộ danh sách món ăn yêu thích và các bài viết, cẩm nang ẩm thực, khuyến mãi đã lưu tại Avora Restaurant.',
};

export default function FavoritesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f8fa] flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#da251d] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500">Đang tải danh sách yêu thích & đã lưu...</p>
        </div>
      }
    >
      <FavoritesClient />
    </Suspense>
  );
}
