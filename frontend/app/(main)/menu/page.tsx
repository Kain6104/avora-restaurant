import React from 'react';
import MenuClient from './MenuClient';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';

export const metadata = {
  title: 'Thực Đơn Đẳng Cấp & Bảng Giá',
  description: 'Khám phá thực đơn ẩm thực Nhật Bản cao cấp tại AVORA Restaurant: Sashimi tươi sống nhập khẩu, Sushi truyền thống, Bò Wagyu nướng và các set Omakase thượng hạng.',
  openGraph: {
    title: 'Thực Đơn Đẳng Cấp & Bảng Giá | AVORA Restaurant',
    description: 'Khám phá thế giới ẩm thực Nhật Bản tinh tế cùng thực đơn phong phú tại AVORA Restaurant.',
  },
};

export default async function MenuPage() {
  const categories = await fetch(`${API_URL}/api/categories`, { 
    cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' }
  })
    .then(res => res.json())
    .catch(() => []);

  return <MenuClient initialCategories={categories} />;
}
