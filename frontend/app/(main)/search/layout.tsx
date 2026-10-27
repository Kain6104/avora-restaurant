import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Tìm Kiếm Món Ăn & Bài Viết',
  description: 'Tìm kiếm nhanh các món sushi, sashimi, set nướng, voucher ưu đãi và bài viết ẩm thực tại AVORA Restaurant.',
  openGraph: {
    title: 'Tìm Kiếm Món Ăn & Bài Viết | AVORA Restaurant',
    description: 'Tìm kiếm món ngon và ưu đãi tại AVORA Restaurant.',
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
